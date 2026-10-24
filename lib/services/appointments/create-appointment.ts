import { db } from "../../db";
import { appointments, emailOutbox } from "../../db/schema";
import {
  getActiveServiceById,
  getAvailabilityQueryData,
} from "../../repositories";
import { calculateAvailableSlots } from "../../availability";
import {
  generateCancellationToken,
  hashCancellationToken,
  encryptOutboxPayload,
} from "../../security";
import {
  BookingError,
  ServiceNotFoundError,
  InvalidBookingDataError,
  BookingNoticeError,
  BookingHorizonError,
  SlotNotAvailableError,
  ConcurrentBookingConflictError,
  BookingPersistenceError,
} from "./errors";
import type {
  CreateAppointmentInput,
  CreateAppointmentResult,
  AppointmentServiceClient,
  TransactionContext,
} from "./types";
import type { EncryptedPayload } from "../../security/types";

/**
 * Expresión regular para validar formato básico de correo electrónico.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Expresión regular para validar formato UUID v4.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Convierte un valor a Date y valida que sea un instante finito.
 */
function toValidDate(val: Date | string | number, fieldName: string): Date {
  const date = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(date.getTime()) || !Number.isFinite(date.getTime())) {
    throw new InvalidBookingDataError(
      `El campo '${fieldName}' no contiene una fecha válida: '${String(val)}'.`
    );
  }
  return date;
}

/**
 * Valida exhaustivamente los datos de entrada de la reserva antes de interactuar
 * con la base de datos.
 */
function validateInput(input: CreateAppointmentInput): {
  serviceId: string;
  startAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  referenceNow: Date;
} {
  if (!input || typeof input !== "object") {
    throw new InvalidBookingDataError(
      "Se requiere un objeto con los datos de la reserva."
    );
  }

  const {
    serviceId,
    startAt,
    customerName,
    customerEmail,
    customerPhone,
    referenceNow,
  } = input;

  if (typeof serviceId !== "string" || !UUID_REGEX.test(serviceId.trim())) {
    throw new InvalidBookingDataError(
      "serviceId debe ser un identificador UUID válido."
    );
  }

  if (typeof customerName !== "string" || customerName.trim().length === 0) {
    throw new InvalidBookingDataError(
      "customerName es obligatorio y no puede estar vacío."
    );
  }
  const trimmedName = customerName.trim();
  if (trimmedName.length > 120) {
    throw new InvalidBookingDataError(
      "customerName excede la longitud máxima permitida (120 caracteres)."
    );
  }

  if (typeof customerEmail !== "string" || !EMAIL_REGEX.test(customerEmail.trim())) {
    throw new InvalidBookingDataError(
      "customerEmail debe ser una dirección de correo electrónico válida."
    );
  }
  const trimmedEmail = customerEmail.trim().toLowerCase();
  if (trimmedEmail.length > 255) {
    throw new InvalidBookingDataError(
      "customerEmail excede la longitud máxima permitida (255 caracteres)."
    );
  }

  if (typeof customerPhone !== "string" || customerPhone.trim().length === 0) {
    throw new InvalidBookingDataError(
      "customerPhone es obligatorio para confirmar la reserva."
    );
  }
  const trimmedPhone = customerPhone.trim();
  if (trimmedPhone.length > 50) {
    throw new InvalidBookingDataError(
      "customerPhone excede la longitud máxima permitida (50 caracteres)."
    );
  }

  const validStartAt = toValidDate(startAt, "startAt");
  const validReferenceNow = referenceNow
    ? toValidDate(referenceNow, "referenceNow")
    : new Date();

  return {
    serviceId: serviceId.trim(),
    startAt: validStartAt,
    customerName: trimmedName,
    customerEmail: trimmedEmail,
    customerPhone: trimmedPhone,
    referenceNow: validReferenceNow,
  };
}

/**
 * Detecta si un error proviene de una violación de la restricción de exclusión GiST
 * (`no_overlapping_confirmed_appointments`, código SQLSTATE 23P01).
 */
function isGistExclusionViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as Record<string, unknown>;
  const cause = (err.cause ?? {}) as Record<string, unknown>;

  const code = err.code ?? cause.code;
  const constraint = err.constraint ?? cause.constraint;
  const message =
    (typeof err.message === "string" ? err.message : "") +
    (typeof cause.message === "string" ? " " + cause.message : "");

  return (
    code === "23P01" ||
    constraint === "no_overlapping_confirmed_appointments" ||
    message.includes("no_overlapping_confirmed_appointments") ||
    message.includes("exclusion constraint")
  );
}

/**
 * Servicio de Aplicación: Creación Transaccional de Reservas.
 *
 * Ejecuta el flujo completo de confirmación garantizando:
 * 1. Validación estricta de parámetros sin confiar en datos de duración o precio del cliente.
 * 2. Consulta y verificación del servicio activo en la base de datos.
 * 3. Cálculo inmutable del instante de finalización `endAt` en el servidor.
 * 4. Verificación de anticipación mínima (2h) y horizonte móvil (168h / 7 días corridos).
 * 5. Evaluación de disponibilidad real mediante el motor (`calculateAvailableSlots`).
 * 6. Generación de token criptográfico de cancelación y almacenamiento exclusivo de su hash SHA-256.
 * 7. Cifrado simétrico AES-256-GCM del token para la cola de notificaciones (`email_outbox`).
 * 8. Transacción PostgreSQL atómica: inserción de turno confirmado + encolado de notificación.
 * 9. Protección contra solapamientos concurrentes respaldada por la restricción GiST (23P01).
 *
 * @param input - Datos de la reserva solicitada.
 * @param client - Cliente de base de datos opcional (por defecto: instancia Neon de db).
 * @returns Reserva confirmada y token en claro para notificación.
 * @throws {BookingError} Errores de dominio tipados ante cualquier violación o conflicto.
 */
export async function createAppointment(
  input: CreateAppointmentInput,
  client: AppointmentServiceClient = db
): Promise<CreateAppointmentResult> {
  // 1. Validar y sanear datos de entrada
  const {
    serviceId,
    startAt,
    customerName,
    customerEmail,
    customerPhone,
    referenceNow,
  } = validateInput(input);

  const nowTime = referenceNow.getTime();
  const startTime = startAt.getTime();

  // 2. Comprobar anticipación mínima de 2 horas respecto a referenceNow
  const minNoticeMs = 2 * 60 * 60 * 1000;
  if (startTime < nowTime + minNoticeMs) {
    throw new BookingNoticeError(2);
  }

  // 3. Comprobar horizonte móvil máximo de 7 días corridos (168 horas) desde referenceNow
  const maxHorizonMs = 7 * 24 * 60 * 60 * 1000;
  if (startTime > nowTime + maxHorizonMs) {
    throw new BookingHorizonError(168);
  }

  // 4. Obtener servicio activo de la base de datos (nunca confiar en precio o duración del cliente)
  const service = await getActiveServiceById(serviceId, client);
  if (!service || !service.isActive) {
    throw new ServiceNotFoundError(serviceId);
  }

  // 5. Calcular endAt en el servidor a partir de la duración oficial del servicio
  const serviceDurationMs = service.durationMinutes * 60 * 1000;
  const endAt = new Date(startTime + serviceDurationMs);

  // El final del turno no puede superar el límite del horizonte de 168 horas
  if (endAt.getTime() > nowTime + maxHorizonMs) {
    throw new BookingHorizonError(168);
  }

  // 6. Consultar agenda y evaluar disponibilidad con el motor
  const queryData = await getAvailabilityQueryData(
    {
      serviceId,
      referenceNow,
      horizonDays: 7,
    },
    client
  );

  const availableSlots = calculateAvailableSlots(queryData);
  const isSlotAvailable = availableSlots.some(
    (slot) => slot.startAt.getTime() === startTime
  );

  if (!isSlotAvailable) {
    throw new SlotNotAvailableError(startAt.toISOString());
  }

  // 7. Generar token de cancelación y hash criptográfico
  const rawToken = generateCancellationToken();
  const tokenHash = hashCancellationToken(rawToken);

  // 8. Ejecutar persistencia en una única transacción PostgreSQL atómica
  try {
    const result = await client.transaction(async (tx: TransactionContext) => {
      // 8.1 Insertar reserva con estado 'confirmed' y snapshots inmutables
      const [newAppointment] = await tx
        .insert(appointments)
        .values({
          serviceId: service.id,
          customerName,
          customerEmail,
          customerPhone,
          startAt,
          endAt,
          status: "confirmed",
          serviceNameSnapshot: service.name,
          serviceDurationSnapshot: service.durationMinutes,
          servicePriceSnapshot: service.priceAmount,
          currency: "ARS",
          cancellationTokenHash: tokenHash,
        })
        .returning();

      // 8.2 Preparar notificaciones con cifrado de datos en reposo a nivel de aplicación
      const customerNotificationData = {
        customerName,
        customerEmail,
        customerPhone,
        serviceName: service.name,
        serviceDurationMinutes: service.durationMinutes,
        servicePriceAmount: service.priceAmount,
        currency: "ARS",
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        cancellationToken: rawToken,
        recipientEmail: customerEmail,
      };
      const encryptedCustomerPayload = encryptOutboxPayload(
        JSON.stringify(customerNotificationData)
      );

      const outboxEntries: Array<{
        appointmentId: string;
        eventType: string;
        recipient: string;
        payload: EncryptedPayload;
        status: string;
      }> = [
        {
          appointmentId: newAppointment.id,
          eventType: "booking_confirmed",
          recipient: "[ENCRYPTED_IN_PAYLOAD]",
          payload: encryptedCustomerPayload,
          status: "pending",
        },
      ];

      // Notificación al barbero si está configurada la variable de entorno
      const barberEmail = process.env.BARBER_NOTIFICATION_EMAIL?.trim();
      if (barberEmail && barberEmail.length > 0) {
        const barberNotificationData = {
          customerName,
          customerEmail,
          customerPhone,
          serviceName: service.name,
          serviceDurationMinutes: service.durationMinutes,
          servicePriceAmount: service.priceAmount,
          currency: "ARS",
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          recipientEmail: barberEmail,
        };
        const encryptedBarberPayload = encryptOutboxPayload(
          JSON.stringify(barberNotificationData)
        );

        outboxEntries.push({
          appointmentId: newAppointment.id,
          eventType: "booking_confirmed",
          recipient: "[ENCRYPTED_IN_PAYLOAD]",
          payload: encryptedBarberPayload,
          status: "pending",
        });
      }

      await tx.insert(emailOutbox).values(outboxEntries);

      return newAppointment;
    });

    return {
      appointment: result,
      cancellationToken: rawToken,
    };
  } catch (error) {
    // Manejo y traducción explícita de violación de exclusión GiST por concurrencia
    if (isGistExclusionViolation(error)) {
      throw new ConcurrentBookingConflictError();
    }

    // Propagar errores de dominio ya identificados
    if (error instanceof BookingError) {
      throw error;
    }

    // Envolver errores de infraestructura o conexión sin exponer detalles internos
    const message = error instanceof Error ? error.message : "Error desconocido";
    throw new BookingPersistenceError(
      `Fallo en la persistencia transaccional de la reserva: ${message}`
    );
  }
}
