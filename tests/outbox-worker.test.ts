import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  processPendingEmails,
  formatDateTimeBuenosAires,
  sanitizeErrorMessage,
  isPermanentError,
  parseAndDecryptOutboxPayload,
  calculateBackoffMinutes,
  type ResendClientInterface,
  type SendEmailPayload,
  type SendEmailResult,
  type CustomerBookingPayload,
  type BarberBookingPayload,
} from "../lib/services/email-outbox";
import { encryptOutboxPayload } from "../lib/security";
import type { EmailOutboxItem } from "../lib/db/schema";
import type { DrizzleDb } from "../lib/db";

// Clave segura de prueba para outbox
process.env.OUTBOX_ENCRYPTION_KEY =
  "e83bf6112c2a9c370258167f5b35bfbd2b07e1ba77176d05f32eb7a13dcf8a8b";

/**
 * Cliente Resend simulado en memoria para pruebas sin llamadas de red.
 */
function createMockResendClient(options: {
  sendResult?: SendEmailResult;
  throwError?: Error;
  onSend?: (payload: SendEmailPayload, idempotencyKey?: string) => void;
}) {
  const sentEmails: Array<{ payload: SendEmailPayload; idempotencyKey?: string }> = [];

  const mockClient: ResendClientInterface = {
    emails: {
      send: async (payload, requestOptions) => {
        if (options.throwError) {
          throw options.throwError;
        }

        const idempotencyKey = requestOptions?.idempotencyKey;
        sentEmails.push({ payload, idempotencyKey });
        if (options.onSend) options.onSend(payload, idempotencyKey);

        if (options.sendResult) {
          return options.sendResult;
        }

        return {
          data: { id: "resend-msg-" + Math.random().toString(36).substring(2, 9) },
          error: null,
        };
      },
    },
  };

  return { mockClient, sentEmails };
}

/**
 * Cliente de base de datos simulado para pruebas del worker de outbox.
 */
function createMockOutboxDb(initialRows: EmailOutboxItem[]) {
  const rows: EmailOutboxItem[] = initialRows.map((r) => ({ ...r }));

  const mockDb = {
    transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: (limit: number) => ({
                  for: () => {
                    const now = new Date();
                    // Filtra rows en 'pending' o 'processing' cuyo nextAttemptAt <= now
                    const eligible = rows.filter((r) => {
                      const isTime = r.nextAttemptAt.getTime() <= now.getTime();
                      return (r.status === "pending" || r.status === "processing") && isTime;
                    });
                    return Promise.resolve(eligible.slice(0, limit));
                  },
                }),
              }),
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => {
              // Aplica actualizaciones masivas de claim
              return Promise.resolve();
            },
          }),
        }),
      };
      return callback(mockTx);
    },
    update: () => ({
      set: () => ({
        where: () => {
          return Promise.resolve();
        },
      }),
    }),
  };

  return { mockDb: mockDb as unknown as DrizzleDb, rows };
}

describe("Worker de Notificaciones de Email Outbox (Fase 5A)", () => {
  const sampleCustomerData: CustomerBookingPayload = {
    customerName: "Lucas Silva",
    customerEmail: "lucas@example.com",
    customerPhone: "+542235551234",
    serviceName: "Corte Clásico",
    serviceDurationMinutes: 30,
    servicePriceAmount: 12000,
    currency: "ARS",
    startAt: "2026-10-24T15:00:00.000Z",
    endAt: "2026-10-24T15:30:00.000Z",
    cancellationToken: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };

  // 1. Outbox vacía
  it("1. outbox vacía finaliza sin errores y con métricas en cero", async () => {
    const { mockDb } = createMockOutboxDb([]);
    const { mockClient } = createMockResendClient({});

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 0);
    assert.equal(summary.sent, 0);
    assert.equal(summary.retried, 0);
    assert.equal(summary.failed, 0);
    assert.equal(summary.details.length, 0);
  });

  // 2. Envío exitoso de una notificación de confirmación
  it("2. envía con éxito una notificación de confirmación al cliente y la marca como 'sent'", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-1",
      appointmentId: "appt-1",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000), // En el pasado (lista para enviar)
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    let updatedStatus: string | null = null;
    let updatedMessageId: string | null = null;
    let updatedPayload: Record<string, unknown> | null = null;
    let updatedRecipient: string | null = null;

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: (updates: Record<string, unknown>) => ({
          where: () => {
            if ("status" in updates) updatedStatus = updates.status as string;
            if ("providerMessageId" in updates) updatedMessageId = updates.providerMessageId as string;
            if ("payload" in updates) updatedPayload = updates.payload as Record<string, unknown>;
            if ("recipient" in updates) updatedRecipient = updates.recipient as string;
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient, sentEmails } = createMockResendClient({
      sendResult: { data: { id: "resend-msg-123" }, error: null },
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
      baseUrl: "https://rovebarberia.com",
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 1);
    assert.equal(summary.retried, 0);
    assert.equal(summary.failed, 0);

    // Verificación del envío a Resend
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].payload.to, "lucas@example.com");
    assert.equal(sentEmails[0].idempotencyKey, "outbox-1");
    assert.ok(sentEmails[0].payload.html.includes("https://rovebarberia.com/cancelar/0123456789abcdef"));

    // Verificación de actualización en base de datos
    assert.equal(updatedStatus, "sent");
    assert.equal(updatedMessageId, "resend-msg-123");
    // Sanitización post-envío tanto de payload como de recipient
    assert.equal((updatedPayload as Record<string, unknown> | null)?.sanitized, true);
    assert.equal(updatedRecipient, "[REDACTED]");
  });

  // 3. Construcción correcta de fecha y hora en Buenos Aires
  it("3. formatea la fecha y hora correctamente en la zona 'America/Argentina/Buenos_Aires'", () => {
    // 15:00 UTC en invierno/verano de Argentina (UTC-3) corresponde a las 12:00 hs
    const formatted = formatDateTimeBuenosAires("2026-10-24T15:00:00.000Z");
    assert.equal(formatted.timeStr, "12:00 hs");
    assert.ok(formatted.dateStr.includes("2026"));
    assert.ok(formatted.dateStr.toLowerCase().includes("octubre"));
    assert.ok(formatted.fullStr.includes("12:00 hs"));
  });

  // 4. Descifrado correcto del payload
  it("4. descifra correctamente el payload cifrado con AES-256-GCM en memoria", () => {
    const encrypted = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const decrypted = parseAndDecryptOutboxPayload(encrypted);

    assert.equal(decrypted.customerName, "Lucas Silva");
    assert.equal(decrypted.serviceName, "Corte Clásico");
    assert.equal((decrypted as CustomerBookingPayload).cancellationToken, sampleCustomerData.cancellationToken);
  });

  // 5. Rechazo de payload inválido o ilegible
  it("5. rechaza y marca como fallido terminal un payload ilegible o con alteración criptográfica", async () => {
    const corruptedPayload = {
      iv: "123456789012345678901234",
      tag: "12345678901234567890123456789012",
      ciphertext: "deadbeef",
    };

    const sampleItem: EmailOutboxItem = {
      id: "outbox-corrupted",
      appointmentId: "appt-2",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: corruptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    let terminalStatus: string | null = null;
    let loggedError: string | null = null;

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: (updates: Record<string, unknown>) => ({
          where: () => {
            terminalStatus = updates.status as string;
            loggedError = updates.lastError as string;
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient, sentEmails } = createMockResendClient({});

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 0);
    assert.equal(summary.failed, 1);
    assert.equal(sentEmails.length, 0, "No debe llamar a Resend si el payload está corrupto");
    assert.equal(terminalStatus, "failed");
    assert.ok((loggedError as string | null)?.includes("Descifrado fallido"));
  });

  // 6. Error recuperable del proveedor y programación del reintento
  it("6. reprograma el trabajo con backoff ante error recuperable (429 Rate Limit)", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-rate-limit",
      appointmentId: "appt-3",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    let updatedStatus: string | null = null;
    let updatedAttemptCount: number | null = null;

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: (updates: Record<string, unknown>) => ({
          where: () => {
            updatedStatus = updates.status as string;
            updatedAttemptCount = updates.attemptCount as number;
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient } = createMockResendClient({
      sendResult: {
        data: null,
        error: { message: "Too many requests", statusCode: 429 },
      },
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 0);
    assert.equal(summary.retried, 1);
    assert.equal(summary.failed, 0);

    assert.equal(updatedStatus, "pending");
    assert.equal(updatedAttemptCount, 1);
  });

  // 7. Error permanente y transición al estado terminal
  it("7. marca 'failed' de forma inmediata ante un error permanente del proveedor (422 Unprocessable)", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-invalid-email",
      appointmentId: "appt-4",
      eventType: "booking_confirmed",
      recipient: "invalido@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    let updatedStatus: string | null = null;

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: (updates: Record<string, unknown>) => ({
          where: () => {
            updatedStatus = updates.status as string;
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient } = createMockResendClient({
      sendResult: {
        data: null,
        error: { message: "validation_error: invalid email domain", statusCode: 422 },
      },
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.retried, 0);
    assert.equal(updatedStatus, "failed");
    assert.equal(isPermanentError({ statusCode: 422, message: "validation_error" }), true);
    assert.equal(isPermanentError({ statusCode: 500, message: "internal_server_error" }), false);
  });

  // 8. Límite máximo de intentos
  it("8. transiciona a 'failed' cuando se alcanza el límite máximo de reintentos", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-max-attempts",
      appointmentId: "appt-5",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 4, // Ya falló 4 veces
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: "Network timeout",
      createdAt: new Date(),
      sentAt: null,
    };

    let updatedStatus: string | null = null;
    let updatedAttemptCount: number | null = null;

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: (updates: Record<string, unknown>) => ({
          where: () => {
            updatedStatus = updates.status as string;
            updatedAttemptCount = updates.attemptCount as number;
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient } = createMockResendClient({
      throwError: new Error("Server error 500"),
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
      maxAttempts: 5,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.retried, 0);
    assert.equal(updatedStatus, "failed");
    assert.equal(updatedAttemptCount, 5);
  });

  // 9. Dos workers que no reclamen simultáneamente el mismo trabajo (concurrencia)
  it("9. previene que dos ejecuciones concurrentes reclamen el mismo lote", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    let isLocked = false;

    const mockItem: EmailOutboxItem = {
      id: "outbox-concurrent",
      appointmentId: "appt-6",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    const createConcurrentIndexDb = () =>
      ({
        transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
          const mockTx = {
            select: () => ({
              from: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: () => ({
                      for: (_lockType: string, options?: { skipLocked?: boolean }) => {
                        if (options?.skipLocked && isLocked) {
                          // Si ya está bloqueada por el primer worker, se salta
                          return Promise.resolve([]);
                        }
                        isLocked = true;
                        return Promise.resolve([mockItem]);
                      },
                    }),
                  }),
                }),
              }),
            }),
            update: () => ({
              set: () => ({
                where: () => Promise.resolve(),
              }),
            }),
          };
          return callback(mockTx);
        },
        update: () => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        }),
      } as unknown as DrizzleDb);

    const { mockClient } = createMockResendClient({});

    // Primer worker reclama
    const summaryWorker1 = await processPendingEmails({
      client: createConcurrentIndexDb(),
      resendClient: mockClient,
    });

    // Segundo worker intenta reclamar simultáneamente
    const summaryWorker2 = await processPendingEmails({
      client: createConcurrentIndexDb(),
      resendClient: mockClient,
    });

    assert.equal(summaryWorker1.claimed, 1);
    assert.equal(summaryWorker2.claimed, 0, "El segundo worker debe saltar la fila ya bloqueada");
  });

  // 10. Recuperación de un trabajo abandonado en estado 'processing'
  it("10. recupera automáticamente un trabajo abandonado en 'processing' cuyo lease expiró", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const abandonedItem: EmailOutboxItem = {
      id: "outbox-abandoned",
      appointmentId: "appt-7",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "processing", // Quedó en processing tras caída
      attemptCount: 1,
      nextAttemptAt: new Date(Date.now() - 1000), // Lease expirado (en el pasado)
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([abandonedItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient } = createMockResendClient({});

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 1);
  });

  // 11. Fallo al actualizar el estado después de un envío aceptado
  it("11. maneja excepciones si la base de datos falla al actualizar el estado post-envío", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-db-failure",
      appointmentId: "appt-8",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    let firstUpdate = true;
    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: () => ({
          where: () => {
            if (firstUpdate) {
              firstUpdate = false;
              throw new Error("Neon connection terminated during sent status update");
            }
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient } = createMockResendClient({
      sendResult: { data: { id: "resend-msg-accepted" }, error: null },
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.retried, 1);
    assert.equal(summary.sent, 0, "No debe contabilizar éxito si la actualización de BD falló");
  });

  // 12. Protección frente a registros de logs que puedan revelar datos sensibles
  it("12. sanitizeErrorMessage elimina API keys, tokens y cadenas de conexión de los mensajes", () => {
    const rawError =
      "Error with API key re_1234567890abcdef and token 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef on postgresql://user:pass@ep-host.neon.tech/neondb";

    const sanitized = sanitizeErrorMessage(rawError);

    assert.ok(!sanitized.includes("re_1234567890abcdef"));
    assert.ok(sanitized.includes("[REDACTED_API_KEY]"));
    assert.ok(!sanitized.includes("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"));
    assert.ok(sanitized.includes("[REDACTED_TOKEN]"));
    assert.ok(!sanitized.includes("user:pass@ep-host"));
    assert.ok(sanitized.includes("[REDACTED_DB_URL]"));
  });

  // 13. Sanitización posterior al envío sin perder la capacidad de recuperación de trabajos inciertos
  it("13. no sanitiza ni purga el payload si el envío no fue confirmado exitosamente", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-retry-payload",
      appointmentId: "appt-9",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    let updatedPayload: unknown = "not_touched";

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: (updates: Record<string, unknown>) => ({
          where: () => {
            if ("payload" in updates) {
              updatedPayload = updates.payload;
            }
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient } = createMockResendClient({
      sendResult: { data: null, error: { message: "Internal server error", statusCode: 500 } },
    });

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    // En reintento, el payload original NO debe ser sobrescrito ni sanitizado
    assert.equal(updatedPayload, "not_touched");
  });

  // 14. Notificación al barbero sin token de cancelación
  it("14. envía la notificación del barbero con datos de cliente pero sin token de cancelación", async () => {
    const barberData: BarberBookingPayload = {
      customerName: "Lucas Silva",
      customerEmail: "lucas@example.com",
      customerPhone: "+542235551234",
      serviceName: "Corte Clásico",
      serviceDurationMinutes: 30,
      servicePriceAmount: 12000,
      currency: "ARS",
      startAt: "2026-10-24T15:00:00.000Z",
      endAt: "2026-10-24T15:30:00.000Z",
    };

    const encryptedPayload = encryptOutboxPayload(JSON.stringify(barberData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-barber",
      appointmentId: "appt-10",
      eventType: "booking_confirmed",
      recipient: "barbero@rovebarberia.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient, sentEmails } = createMockResendClient({
      sendResult: { data: { id: "resend-barber-msg" }, error: null },
    });

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].payload.to, "barbero@rovebarberia.com");
    // El email del barbero no debe contener el enlace de cancelación
    assert.equal(sentEmails[0].payload.html.includes("/cancelar/"), false);
    assert.equal(sentEmails[0].payload.text.includes("/cancelar/"), false);
    // Pero sí contiene los datos del cliente
    assert.ok(sentEmails[0].payload.html.includes("Lucas Silva"));
    assert.ok(sentEmails[0].payload.html.includes("+542235551234"));
  });

  // 15. Comportamiento correcto cuando falta RESEND_API_KEY
  it("15. maneja la ausencia de RESEND_API_KEY reprogramando las filas sin abortar con excepción", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
      const sampleItem: EmailOutboxItem = {
        id: "outbox-no-key",
        appointmentId: "appt-11",
        eventType: "booking_confirmed",
        recipient: "lucas@example.com",
        payload: encryptedPayload,
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: new Date(Date.now() - 1000),
        providerMessageId: null,
        lastError: null,
        createdAt: new Date(),
        sentAt: null,
      };

      let updatedStatus: string | null = null;
      let recordedError: string | null = null;

      const mockDb = {
        transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
          const mockTx = {
            select: () => ({
              from: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: () => ({
                      for: () => Promise.resolve([sampleItem]),
                    }),
                  }),
                }),
              }),
            }),
            update: () => ({
              set: () => ({
                where: () => Promise.resolve(),
              }),
            }),
          };
          return callback(mockTx);
        },
        update: () => ({
          set: (updates: Record<string, unknown>) => ({
            where: () => {
              updatedStatus = updates.status as string;
              recordedError = updates.lastError as string;
              return Promise.resolve();
            },
          }),
        }),
      } as unknown as DrizzleDb;

      const summary = await processPendingEmails({
        client: mockDb,
      });

      assert.equal(summary.claimed, 1);
      assert.equal(summary.sent, 0);
      assert.equal(summary.retried, 1);
      assert.equal(updatedStatus, "pending");
      assert.ok((recordedError as string | null)?.includes("RESEND_API_KEY no está configurada"));
    } finally {
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  // 16. Verificación de cálculo de esperas progresivas
  it("16. calculateBackoffMinutes implementa una escala de espera acotada y predecible", () => {
    assert.equal(calculateBackoffMinutes(1), 1);
    assert.equal(calculateBackoffMinutes(2), 5);
    assert.equal(calculateBackoffMinutes(3), 15);
    assert.equal(calculateBackoffMinutes(4), 60);
    assert.equal(calculateBackoffMinutes(5), 120);
    assert.equal(calculateBackoffMinutes(10), 120);
  });

  // 17. Envío que dura más que el timeout configurado (evita colgar el lease)
  it("17. aborta y reprograma con backoff si el envío a Resend supera el requestTimeoutMs", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-timeout-1",
      appointmentId: "appt-timeout",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    let updatedStatus = "";
    let recordedError = "";

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: (updates: Record<string, unknown>) => ({
          where: () => {
            if ("status" in updates) updatedStatus = updates.status as string;
            if ("lastError" in updates) recordedError = updates.lastError as string;
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    // Simula cliente Resend que respeta el AbortSignal y tarda más de requestTimeoutMs
    const mockHangingClient: ResendClientInterface = {
      emails: {
        send: async (_payload, options) => {
          return new Promise((_, reject) => {
            if (options?.signal) {
              options.signal.addEventListener("abort", () => {
                const abortErr = new Error("The operation was aborted due to timeout");
                abortErr.name = "AbortError";
                reject(abortErr);
              });
            }
          });
        },
      },
    };

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockHangingClient,
      requestTimeoutMs: 50, // 50ms timeout para la prueba
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 0);
    assert.equal(summary.retried, 1);
    assert.equal(updatedStatus, "pending");
    assert.ok(
      recordedError.toLowerCase().includes("aborted") ||
      recordedError.toLowerCase().includes("timeout")
    );
  });

  // 18. Preservación estricta de la clave de idempotencia en todos los reintentos
  it("18. mantiene la misma clave de idempotencia (row.id) inalterada a través de múltiples reintentos", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-idempotency-test-uuid",
      appointmentId: "appt-idem",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 1, // Ya reintentó una vez
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: "Previous network error",
      createdAt: new Date(),
      sentAt: null,
    };

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient, sentEmails } = createMockResendClient({
      sendResult: { data: { id: "resend-msg-idem" }, error: null },
    });

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].idempotencyKey, "outbox-idempotency-test-uuid");
  });

  // 19. Semántica de 'sent': requiere aceptación y ID válido del proveedor
  it("19. no transiciona a 'sent' si Resend no devuelve un ID válido de mensaje aceptado", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-missing-id",
      appointmentId: "appt-missing-id",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    let updatedStatus = "";

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: (updates: Record<string, unknown>) => ({
          where: () => {
            if ("status" in updates) updatedStatus = updates.status as string;
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    // Resend devuelve data con id vacío (respuesta anómala)
    const { mockClient } = createMockResendClient({
      sendResult: { data: { id: "" }, error: null },
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 0);
    assert.equal(summary.retried, 1);
    assert.equal(updatedStatus, "pending");
  });

  // 20. El campo recipient no se sanitiza en reintentos fallidos para permitir nuevos despachos
  it("20. conserva el valor de recipient intacto durante reintentos para no perder el destino", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem: EmailOutboxItem = {
      id: "outbox-recipient-retried",
      appointmentId: "appt-recipient",
      eventType: "booking_confirmed",
      recipient: "lucas@example.com",
      payload: encryptedPayload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      providerMessageId: null,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    };

    let touchedRecipient: unknown = "not_modified";

    const mockDb = {
      transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve([sampleItem]),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        };
        return callback(mockTx);
      },
      update: () => ({
        set: (updates: Record<string, unknown>) => ({
          where: () => {
            if ("recipient" in updates) touchedRecipient = updates.recipient;
            return Promise.resolve();
          },
        }),
      }),
    } as unknown as DrizzleDb;

    const { mockClient } = createMockResendClient({
      sendResult: { data: null, error: { message: "Service Unavailable", statusCode: 503 } },
    });

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(touchedRecipient, "not_modified");
  });
});
