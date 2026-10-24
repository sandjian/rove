import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createAppointment,
  ServiceNotFoundError,
  InvalidBookingDataError,
  BookingNoticeError,
  BookingHorizonError,
  SlotNotAvailableError,
  ConcurrentBookingConflictError,
  BookingPersistenceError,
  type AppointmentServiceClient,
  type TransactionContext,
} from "../lib/services/appointments";
import { hashCancellationToken, decryptOutboxPayload } from "../lib/security";
import type {
  Service,
  AvailabilityWindow,
  Appointment,
  EmailOutboxItem,
} from "../lib/db/schema";

// Clave de prueba para cifrado de outbox (64 caracteres hex no triviales)
process.env.OUTBOX_ENCRYPTION_KEY =
  "e83bf6112c2a9c370258167f5b35bfbd2b07e1ba77176d05f32eb7a13dcf8a8b";

/**
 * Generador de cliente simulado para pruebas de servicio transaccional.
 */
function createMockAppointmentClient(options: {
  service?: Service | null;
  windows?: AvailabilityWindow[];
  existingAppointments?: Appointment[];
  throwOnAppointmentInsert?: Error;
  throwOnOutboxInsert?: Error;
  onCommit?: () => void;
  onRollback?: () => void;
}) {
  const {
    service = null,
    windows = [],
    existingAppointments = [],
    throwOnAppointmentInsert,
    throwOnOutboxInsert,
    onCommit,
    onRollback,
  } = options;

  const insertedAppointments: Appointment[] = [];
  const insertedOutbox: EmailOutboxItem[] = [];
  let transactionCalled = false;

  const mockClient = {
    query: {
      services: {
        findFirst: async () => service ?? undefined,
        findMany: async () => (service ? [service] : []),
      },
      availabilityWindows: {
        findMany: async () => windows,
      },
      appointments: {
        findMany: async () => existingAppointments,
      },
    },
    transaction: async <T>(
      callback: (tx: TransactionContext) => Promise<T>
    ): Promise<T> => {
      transactionCalled = true;
      const mockTx = {
        insert: (table: unknown) => ({
          values: (values: unknown) => {
            const execute = async () => {
              const tableObj = table as { serviceId?: unknown } | undefined;
              if (tableObj && tableObj.serviceId) {
                // Inserción en appointments
                if (throwOnAppointmentInsert) {
                  if (onRollback) onRollback();
                  throw throwOnAppointmentInsert;
                }
                const valObj = values as Record<string, unknown>;
                const record = {
                  id: "appt-" + Math.random().toString(36).substring(2, 9),
                  serviceId: String(valObj.serviceId),
                  customerName: String(valObj.customerName),
                  customerEmail: String(valObj.customerEmail),
                  customerPhone: String(valObj.customerPhone),
                  startAt: valObj.startAt as Date,
                  endAt: valObj.endAt as Date,
                  status: String(valObj.status),
                  serviceNameSnapshot: String(valObj.serviceNameSnapshot),
                  serviceDurationSnapshot: Number(valObj.serviceDurationSnapshot),
                  servicePriceSnapshot: Number(valObj.servicePriceSnapshot),
                  currency: String(valObj.currency),
                  cancellationTokenHash: String(valObj.cancellationTokenHash),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  cancelledAt: null,
                } as Appointment;
                insertedAppointments.push(record);
                return [record];
              }

              // Inserción en email_outbox
              if (throwOnOutboxInsert) {
                if (onRollback) onRollback();
                throw throwOnOutboxInsert;
              }
              const entries = (
                Array.isArray(values) ? values : [values]
              ) as Array<Record<string, unknown>>;
              const saved: EmailOutboxItem[] = [];
              for (const entry of entries) {
                const outboxRecord = {
                  id: "outbox-" + Math.random().toString(36).substring(2, 9),
                  appointmentId: String(entry.appointmentId),
                  eventType: String(entry.eventType),
                  recipient: String(entry.recipient),
                  payload: entry.payload,
                  status: String(entry.status),
                  attemptCount: 0,
                  nextAttemptAt: new Date(),
                  providerMessageId: null,
                  lastError: null,
                  createdAt: new Date(),
                  sentAt: null,
                } as unknown as EmailOutboxItem;
                insertedOutbox.push(outboxRecord);
                saved.push(outboxRecord);
              }
              return saved;
            };

            return {
              returning: execute,
              then: (
                onfulfilled?: (val: unknown) => unknown,
                onrejected?: (reason: unknown) => unknown
              ) => execute().then(onfulfilled, onrejected),
            };
          },
        }),
      } as unknown as TransactionContext;

      try {
        const res = await callback(mockTx);
        if (onCommit) onCommit();
        return res;
      } catch (err) {
        if (onRollback) onRollback();
        throw err;
      }
    },
  };

  return {
    client: mockClient as unknown as AppointmentServiceClient,
    insertedAppointments,
    insertedOutbox,
    wasTransactionCalled: () => transactionCalled,
  };
}

describe("Servicio de Creación Transaccional de Reservas (Fase 4)", () => {
  const serviceId = "550e8400-e29b-41d4-a716-446655440000";
  const baseService: Service = {
    id: serviceId,
    name: "Corte y Barba",
    description: "Corte con tijera y perfilado de barba",
    priceAmount: 15000,
    durationMinutes: 45,
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fixedNow = new Date("2026-10-24T12:00:00.000Z"); // Sábado 12:00 UTC (09:00 ART)

  // Ventana laboral: Sábado de 14:00 a 20:00 UTC
  const sampleWindow: AvailabilityWindow = {
    id: "win-1",
    startAt: new Date("2026-10-24T14:00:00.000Z"),
    endAt: new Date("2026-10-24T20:00:00.000Z"),
    isBlocked: false,
    reason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 1. Reserva válida con cálculo correcto de hora de finalización
  it("1. realiza reserva válida calculando endAt con la duración de la base de datos", async () => {
    const { client, insertedAppointments, insertedOutbox, wasTransactionCalled } =
      createMockAppointmentClient({
        service: baseService,
        windows: [sampleWindow],
      });

    // 15:00 UTC (12:00 ART): cumple anticipación (3h > 2h) y alineación a grilla (15m)
    const requestedStart = new Date("2026-10-24T15:00:00.000Z");

    const result = await createAppointment(
      {
        serviceId,
        startAt: requestedStart,
        customerName: "Lucas Silva",
        customerEmail: "lucas@example.com",
        customerPhone: "+542235551234",
        referenceNow: fixedNow,
      },
      client
    );

    assert.ok(wasTransactionCalled(), "Debe haberse ejecutado en una transacción");
    assert.equal(insertedAppointments.length, 1);
    assert.equal(insertedOutbox.length, 1);

    // Verificación de fin del turno: 15:00 + 45 min = 15:45
    assert.equal(result.appointment.startAt.toISOString(), "2026-10-24T15:00:00.000Z");
    assert.equal(result.appointment.endAt.toISOString(), "2026-10-24T15:45:00.000Z");
    assert.equal(result.appointment.status, "confirmed");
    assert.equal(result.appointment.serviceNameSnapshot, "Corte y Barba");
    assert.equal(result.appointment.serviceDurationSnapshot, 45);
    assert.equal(result.appointment.servicePriceSnapshot, 15000);
    assert.equal(result.appointment.currency, "ARS");
  });

  // 2. Servicio inexistente o inactivo
  it("2. rechaza la reserva si el servicio no existe o está inactivo", async () => {
    const { client: clientNotFound } = createMockAppointmentClient({
      service: null,
    });

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: new Date("2026-10-24T15:00:00.000Z"),
            customerName: "Lucas Silva",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          clientNotFound
        ),
      ServiceNotFoundError
    );

    const { client: clientInactive } = createMockAppointmentClient({
      service: { ...baseService, isActive: false },
    });

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: new Date("2026-10-24T15:00:00.000Z"),
            customerName: "Lucas Silva",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          clientInactive
        ),
      ServiceNotFoundError
    );
  });

  // 3. Anticipación mínima de dos horas
  it("3. rechaza la reserva si se solicita con menos de dos horas de anticipación", async () => {
    const { client } = createMockAppointmentClient({
      service: baseService,
      windows: [sampleWindow],
    });

    // 13:45 UTC es 1h 45m después de fixedNow (12:00 UTC) -> Menor a 2 horas
    const tooSoon = new Date("2026-10-24T13:45:00.000Z");

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: tooSoon,
            customerName: "Lucas Silva",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          client
        ),
      BookingNoticeError
    );
  });

  // 4. Límite exacto del horizonte de 168 horas (7 días corridos)
  it("4. rechaza la reserva si el turno excede el horizonte móvil de 168 horas", async () => {
    const { client } = createMockAppointmentClient({
      service: baseService,
      windows: [
        sampleWindow,
        {
          id: "win-future",
          startAt: new Date("2026-10-31T00:00:00.000Z"),
          endAt: new Date("2026-10-31T23:00:00.000Z"),
          isBlocked: false,
          reason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    // 168 horas exactas desde fixedNow (2026-10-24T12:00Z) es 2026-10-31T12:00Z.
    // Un turno a las 11:30 con duración 45m termina a las 12:15Z (> 168h).
    const exceedsEndAt = new Date("2026-10-31T11:30:00.000Z");

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: exceedsEndAt,
            customerName: "Lucas Silva",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          client
        ),
      BookingHorizonError
    );
  });

  // 5. Horario no incluido entre los slots disponibles (descanso o turno ocupado)
  it("5. rechaza la reserva si el horario no está disponible según el motor", async () => {
    // Bloqueo manual de 15:00 a 16:00
    const blockWindow: AvailabilityWindow = {
      id: "win-block",
      startAt: new Date("2026-10-24T15:00:00.000Z"),
      endAt: new Date("2026-10-24T16:00:00.000Z"),
      isBlocked: true,
      reason: "Descanso / Almuerzo",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { client } = createMockAppointmentClient({
      service: baseService,
      windows: [sampleWindow, blockWindow],
    });

    // 15:15 está dentro del bloqueo manual
    const blockedStart = new Date("2026-10-24T15:15:00.000Z");

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: blockedStart,
            customerName: "Lucas Silva",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          client
        ),
      SlotNotAvailableError
    );
  });

  // 6. Validación de datos de entrada inválidos
  it("6. rechaza datos de reserva con teléfono vacío, email inválido o UUID incorrecto", async () => {
    const { client } = createMockAppointmentClient({ service: baseService });

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId: "no-es-uuid",
            startAt: new Date("2026-10-24T15:00:00.000Z"),
            customerName: "Lucas",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          client
        ),
      InvalidBookingDataError
    );

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: new Date("2026-10-24T15:00:00.000Z"),
            customerName: "Lucas",
            customerEmail: "email-invalido",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          client
        ),
      InvalidBookingDataError
    );

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: new Date("2026-10-24T15:00:00.000Z"),
            customerName: "Lucas",
            customerEmail: "lucas@example.com",
            customerPhone: "", // Teléfono vacío
            referenceNow: fixedNow,
          },
          client
        ),
      InvalidBookingDataError
    );
  });

  // 7. Persistencia del hash del token, nunca del token en claro
  it("7. persiste únicamente el hash SHA-256 del token y cifra el payload en email_outbox", async () => {
    const { client, insertedAppointments, insertedOutbox } =
      createMockAppointmentClient({
        service: baseService,
        windows: [sampleWindow],
      });

    const result = await createAppointment(
      {
        serviceId,
        startAt: new Date("2026-10-24T15:00:00.000Z"),
        customerName: "Lucas Silva",
        customerEmail: "lucas@example.com",
        customerPhone: "+542235551234",
        referenceNow: fixedNow,
      },
      client
    );

    const savedAppointment = insertedAppointments[0];
    const outboxRecord = insertedOutbox[0];

    // Token en claro devuelto: 64 caracteres hex
    assert.equal(typeof result.cancellationToken, "string");
    assert.equal(result.cancellationToken.length, 64);

    // La base almacena el hash, no el token en claro
    assert.notEqual(savedAppointment.cancellationTokenHash, result.cancellationToken);
    assert.equal(
      savedAppointment.cancellationTokenHash,
      hashCancellationToken(result.cancellationToken)
    );

    // En email_outbox, el payload COMPLETO está cifrado con AES-256-GCM (Zero-Knowledge en reposo)
    const payload = outboxRecord.payload as unknown as {
      iv: string;
      tag: string;
      ciphertext: string;
      customerName?: string;
      customerPhone?: string;
    };
    assert.ok(payload.iv);
    assert.ok(payload.tag);
    assert.ok(payload.ciphertext);
    // Ningún dato personal existe en texto plano en el payload persistido
    assert.equal(payload.customerName, undefined);
    assert.equal(payload.customerPhone, undefined);

    // Descifrar el payload produce los datos completos y el token original
    const decryptedRaw = decryptOutboxPayload(payload);
    const parsedData = JSON.parse(decryptedRaw) as {
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      cancellationToken: string;
    };
    assert.equal(parsedData.customerName, "Lucas Silva");
    assert.equal(parsedData.customerEmail, "lucas@example.com");
    assert.equal(parsedData.customerPhone, "+542235551234");
    assert.equal(parsedData.cancellationToken, result.cancellationToken);
  });

  // 8. Inserción atómica dentro de la misma transacción
  it("8. inserta la reserva y la notificación dentro de la misma transacción", async () => {
    let commitCount = 0;
    const { client, insertedAppointments, insertedOutbox } =
      createMockAppointmentClient({
        service: baseService,
        windows: [sampleWindow],
        onCommit: () => {
          commitCount++;
        },
      });

    await createAppointment(
      {
        serviceId,
        startAt: new Date("2026-10-24T15:00:00.000Z"),
        customerName: "Lucas Silva",
        customerEmail: "lucas@example.com",
        customerPhone: "+542235551234",
        referenceNow: fixedNow,
      },
      client
    );

    assert.equal(commitCount, 1, "Debe comprometerse en un único commit");
    assert.equal(insertedAppointments.length, 1);
    assert.equal(insertedOutbox.length, 1);
  });

  // 9. Rollback completo si falla la inserción de una notificación
  it("9. aborta y revierte la reserva si falla la inserción de email_outbox", async () => {
    let rollbackExecuted = false;
    const { client } = createMockAppointmentClient({
      service: baseService,
      windows: [sampleWindow],
      throwOnOutboxInsert: new Error("Outbox table write failure"),
      onRollback: () => {
        rollbackExecuted = true;
      },
    });

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: new Date("2026-10-24T15:00:00.000Z"),
            customerName: "Lucas Silva",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          client
        ),
      BookingPersistenceError
    );

    assert.ok(rollbackExecuted, "El rollback debe ejecutarse si falla outbox");
  });

  // 10. Conversión correcta de la violación GiST 23P01 a ConcurrentBookingConflictError
  it("10. convierte la violación de exclusión GiST (23P01) en ConcurrentBookingConflictError", async () => {
    const gistError = Object.assign(
      new Error(
        'conflicting key value violates exclusion constraint "no_overlapping_confirmed_appointments"'
      ),
      {
        code: "23P01",
        constraint: "no_overlapping_confirmed_appointments",
      }
    );

    const { client } = createMockAppointmentClient({
      service: baseService,
      windows: [sampleWindow],
      throwOnAppointmentInsert: gistError,
    });

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: new Date("2026-10-24T15:00:00.000Z"),
            customerName: "Lucas Silva",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          client
        ),
      ConcurrentBookingConflictError
    );
  });

  // 11. Conversión de violación GiST cuando Drizzle envuelve el error de driver dentro de cause
  it("11. detecta 23P01 incluso cuando Drizzle envuelve el error de driver dentro de cause", async () => {
    const wrappedDrizzleError = Object.assign(
      new Error("Failed query: insert into appointments..."),
      {
        cause: {
          code: "23P01",
          constraint: "no_overlapping_confirmed_appointments",
          message:
            'conflicting key value violates exclusion constraint "no_overlapping_confirmed_appointments"',
        },
      }
    );

    const { client } = createMockAppointmentClient({
      service: baseService,
      windows: [sampleWindow],
      throwOnAppointmentInsert: wrappedDrizzleError,
    });

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: new Date("2026-10-24T15:00:00.000Z"),
            customerName: "Lucas Silva",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          client
        ),
      ConcurrentBookingConflictError
    );
  });

  // 12. Propagación de otros errores de base de datos como BookingPersistenceError
  it("12. propaga errores de conexión o infraestructura como BookingPersistenceError sin exponer internals", async () => {
    const dbError = Object.assign(
      new Error("Connection terminated unexpectedly by peer"),
      {
        code: "ECONNRESET",
      }
    );

    const { client } = createMockAppointmentClient({
      service: baseService,
      windows: [sampleWindow],
      throwOnAppointmentInsert: dbError,
    });

    await assert.rejects(
      async () =>
        createAppointment(
          {
            serviceId,
            startAt: new Date("2026-10-24T15:00:00.000Z"),
            customerName: "Lucas Silva",
            customerEmail: "lucas@example.com",
            customerPhone: "+542235551234",
            referenceNow: fixedNow,
          },
          client
        ),
      BookingPersistenceError
    );
  });

  // 13. Notificación al barbero si está configurada la variable BARBER_NOTIFICATION_EMAIL
  it("13. encola notificación para el barbero únicamente si BARBER_NOTIFICATION_EMAIL está configurada", async () => {
    const originalBarber = process.env.BARBER_NOTIFICATION_EMAIL;

    try {
      process.env.BARBER_NOTIFICATION_EMAIL = "barbero@rovebarberia.com";

      const { client, insertedOutbox } = createMockAppointmentClient({
        service: baseService,
        windows: [sampleWindow],
      });

      await createAppointment(
        {
          serviceId,
          startAt: new Date("2026-10-24T15:00:00.000Z"),
          customerName: "Lucas Silva",
          customerEmail: "lucas@example.com",
          customerPhone: "+542235551234",
          referenceNow: fixedNow,
        },
        client
      );

      assert.equal(insertedOutbox.length, 2);
      const recipients = insertedOutbox.map((o) => o.recipient);
      assert.ok(recipients.includes("lucas@example.com"));
      assert.ok(recipients.includes("barbero@rovebarberia.com"));
    } finally {
      process.env.BARBER_NOTIFICATION_EMAIL = originalBarber;
    }
  });
});
