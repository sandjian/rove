import { after } from "next/server";
import { Resend } from "resend";
import { db } from "../../db";
import { appointments } from "../../db/schema";
import {
  getActiveServiceById,
  getAvailabilityQueryData,
} from "../../repositories";
import { calculateAvailableSlots } from "../../availability";
import {
  generateCancellationToken,
  hashCancellationToken,
} from "../../security";
import {
  renderCustomerConfirmationEmail,
  renderBarberNotificationEmail,
} from "../email-outbox/templates";
import type { ResendClientInterface } from "../email-outbox/types";
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
 * Programa una tarea asíncrona en segundo plano utilizando `after()` de Next.js 16
 * (que extiende el ciclo de vida de la función serverless en Vercel mediante `waitUntil`
 * después de haber enviado la respuesta a la interfaz).
 *
 * Si se ejecuta fuera de un contexto de request de Next.js (ej. tests unitarios o CLI),
 * hace fallback seguro ejecutando la promesa sin `await`.
 */
function runInBackground(task: () => Promise<void>): void {
  try {
    after(async () => {
      try {
        await task();
      } catch (error) {
        console.error(
          "[createAppointment] Error despachando correos en after():",
          error instanceof Error ? error.message : error
        );
      }
    });
  } catch {
    void task().catch((error) => {
      console.error(
        "[createAppointment] Error despachando correos en segundo plano:",
        error instanceof Error ? error.message : error
      );
    });
  }
}

/**
 * Despacha directamente los correos de confirmación (al cliente y opcionalmente al barbero)
 * mediante Resend sin pasar por la tabla `email_outbox`.
 */
export async function dispatchBookingConfirmationEmails(
  params: {
    appointmentId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    serviceName: string;
    serviceDurationMinutes: number;
    servicePriceAmount: number;
    currency: string;
    startAtIso: string;
    endAtIso: string;
    cancellationToken: string;
  },
  injectedResendClient?: ResendClientInterface
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const resend: ResendClientInterface | null =
    injectedResendClient ??
    (apiKey ? (new Resend(apiKey) as unknown as ResendClientInterface) : null);

  if (!resend) {
    return;
  }

  const baseUrl =
    process.env.BOOKING_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "Rove Barbería <reservas@rovebarberia.com>";

  const customerEmailContent = renderCustomerConfirmationEmail({
    payload: {
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      serviceName: params.serviceName,
      serviceDurationMinutes: params.serviceDurationMinutes,
      servicePriceAmount: params.servicePriceAmount,
      currency: params.currency,
      startAt: params.startAtIso,
      endAt: params.endAtIso,
      cancellationToken: params.cancellationToken,
    },
    baseUrl,
  });

  const tasks: Promise<unknown>[] = [
    resend.emails
      .send(
        {
          from: fromEmail,
          to: params.customerEmail,
          subject: customerEmailContent.subject,
          html: customerEmailContent.html,
          text: customerEmailContent.text,
        },
        {
          idempotencyKey: `booking-customer-${params.appointmentId}`,
        }
      )
      .then((res) => {
        if (res.error) {
          console.error(
            `[createAppointment] Error de Resend al enviar confirmación al cliente (${params.appointmentId}):`,
            res.error.message
          );
        }
      }),
  ];

  const barberEmail = process.env.BARBER_NOTIFICATION_EMAIL?.trim();
  if (barberEmail && barberEmail.length > 0) {
    const barberEmailContent = renderBarberNotificationEmail({
      payload: {
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
        serviceName: params.serviceName,
        serviceDurationMinutes: params.serviceDurationMinutes,
        servicePriceAmount: params.servicePriceAmount,
        currency: params.currency,
        startAt: params.startAtIso,
        endAt: params.endAtIso,
      },
    });

    tasks.push(
      resend.emails
        .send(
          {
            from: fromEmail,
            to: barberEmail,
            subject: barberEmailContent.subject,
            html: barberEmailContent.html,
            text: barberEmailContent.text,
          },
          {
            idempotencyKey: `booking-barber-${params.appointmentId}`,
          }
        )
        .then((res) => {
          if (res.error) {
            console.error(
              `[createAppointment] Error de Resend al enviar aviso al barbero (${params.appointmentId}):`,
              res.error.message
            );
          }
        })
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Servicio de Aplicación: Creación de Reservas con despacho de correo directo en segundo plano.
 *
 * Ejecuta el flujo completo de confirmación garantizando:
 * 1. Validación estricta de parámetros sin confiar en datos de duración o precio del cliente.
 * 2. Consulta y verificación del servicio activo en la base de datos.
 * 3. Cálculo inmutable del instante de finalización `endAt` en el servidor.
 * 4. Verificación de anticipación mínima (2h) y horizonte móvil (168h / 7 días corridos).
 * 5. Evaluación de disponibilidad real mediante el motor (`calculateAvailableSlots`).
 * 6. Generación de token criptográfico de cancelación y almacenamiento exclusivo de su hash SHA-256.
 * 7. Inserción atómica del turno confirmado respaldada por la restricción GiST (23P01).
 * 8. Despacho directo de emails vía Resend en segundo plano usando `after()` de Next.js 16
 *    sin bloquear la respuesta al cliente ni depender de un Cron Job de Outbox.
 *
 * @param input - Datos de la reserva solicitada.
 * @param client - Cliente de base de datos opcional (por defecto: instancia Neon de db).
 * @param resendClient - Cliente Resend opcional para inyección en pruebas.
 * @returns Reserva confirmada y token en claro para notificación.
 * @throws {BookingError} Errores de dominio tipados ante cualquier violación o conflicto.
 */
export async function createAppointment(
  input: CreateAppointmentInput,
  client: AppointmentServiceClient = db,
  resendClient?: ResendClientInterface
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

  // 8. Ejecutar persistencia de la reserva en PostgreSQL
  let newAppointment;
  try {
    newAppointment = await client.transaction(async (tx: TransactionContext) => {
      const [inserted] = await tx
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

      return inserted;
    });
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

  // 9. Despachar correos de confirmación en segundo plano usando after() de Next.js 16
  runInBackground(() =>
    dispatchBookingConfirmationEmails(
      {
        appointmentId: newAppointment.id,
        customerName,
        customerEmail,
        customerPhone,
        serviceName: service.name,
        serviceDurationMinutes: service.durationMinutes,
        servicePriceAmount: service.priceAmount,
        currency: "ARS",
        startAtIso: startAt.toISOString(),
        endAtIso: endAt.toISOString(),
        cancellationToken: rawToken,
      },
      resendClient
    )
  );

  return {
    appointment: newAppointment,
    cancellationToken: rawToken,
  };
}
