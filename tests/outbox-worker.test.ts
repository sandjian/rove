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

// Clave segura de prueba para outbox (32 bytes hex)
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
 * Helper para simular QueryBuilders de Drizzle con soporte para .returning() y thenable.
 */
function createMockUpdateBuilder(
  onExecuted?: () => void,
  affectedRows: Array<{ id: string }> = [{ id: "mock-id" }]
) {
  const promise = Promise.resolve(affectedRows);
  return {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
    returning: () => {
      if (onExecuted) onExecuted();
      return Promise.resolve(affectedRows);
    },
  };
}

/**
 * Generador de filas simuladas de email_outbox con valores por defecto válidos.
 */
function createSampleOutboxItem(overrides: Partial<EmailOutboxItem> = {}): EmailOutboxItem {
  return {
    id: "outbox-" + Math.random().toString(36).substring(2, 9),
    appointmentId: "appt-" + Math.random().toString(36).substring(2, 9),
    eventType: "booking_confirmed",
    recipient: "[ENCRYPTED_IN_PAYLOAD]",
    payload: {},
    status: "pending",
    attemptCount: 0,
    nextAttemptAt: new Date(Date.now() - 1000),
    leaseToken: null,
    providerMessageId: null,
    lastError: null,
    createdAt: new Date(),
    sentAt: null,
    ...overrides,
  };
}

interface MockOutboxDbOptions {
  simulateLostLeaseOnRenewal?: boolean;
  simulateLostLeaseOnFinalize?: boolean;
  throwOnUpdate?: Error;
  onUpdate?: (updates: Record<string, unknown>, whereClause?: unknown) => void;
  isLocked?: boolean;
}

/**
 * Cliente de base de datos simulado para pruebas completas del worker de outbox y control de leases.
 */
function createMockOutboxDb(
  initialRows: EmailOutboxItem[],
  options: MockOutboxDbOptions = {}
) {
  const rows = initialRows.map((r) => ({ ...r }));
  let locked = options.isLocked ?? false;
  const capturedClaimTokens: string[] = [];

  const mockDb = {
    transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: (limit: number) => ({
                  for: (_lockType: string, lockOptions?: { skipLocked?: boolean }) => {
                    const now = new Date();
                    if (lockOptions?.skipLocked && locked) {
                      return Promise.resolve([]);
                    }
                    const eligible = rows.filter((r) => {
                      const isTime = r.nextAttemptAt.getTime() <= now.getTime();
                      return (r.status === "pending" || r.status === "processing") && isTime;
                    });
                    if (lockOptions?.skipLocked) {
                      locked = true;
                    }
                    return Promise.resolve(eligible.slice(0, limit));
                  },
                }),
              }),
            }),
          }),
        }),
        update: () => ({
          set: (updates: Record<string, unknown>) => ({
            where: () => {
              if (updates.leaseToken) {
                capturedClaimTokens.push(updates.leaseToken as string);
              }
              return createMockUpdateBuilder();
            },
          }),
        }),
      };
      return callback(mockTx);
    },
    update: () => ({
      set: (updates: Record<string, unknown>) => ({
        where: (whereClause: unknown) => {
          if (options.throwOnUpdate) {
            throw options.throwOnUpdate;
          }
          if (options.onUpdate) {
            options.onUpdate(updates, whereClause);
          }

          // Renovación de lease: contiene nextAttemptAt sin status
          const isRenewal = "nextAttemptAt" in updates && !("status" in updates);
          if (isRenewal && options.simulateLostLeaseOnRenewal) {
            return createMockUpdateBuilder(undefined, []);
          }

          // Finalización (sent, failed, pending retry): contiene status
          const isFinalize = "status" in updates;
          if (isFinalize && options.simulateLostLeaseOnFinalize) {
            return createMockUpdateBuilder(undefined, []);
          }

          return createMockUpdateBuilder(undefined, [{ id: "mock-id" }]);
        },
      }),
    }),
  };

  return { mockDb: mockDb as unknown as DrizzleDb, rows, capturedClaimTokens };
}

describe("Worker de Notificaciones de Email Outbox (Fase 5A)", () => {
  const sampleCustomerData: CustomerBookingPayload = {
    customerName: "Lucas Silva",
    customerEmail: "lucas@example.com",
    recipientEmail: "lucas@example.com",
    customerPhone: "+542235551234",
    serviceName: "Corte Clásico",
    serviceDurationMinutes: 30,
    servicePriceAmount: 12000,
    currency: "ARS",
    startAt: "2026-10-24T15:00:00.000Z",
    endAt: "2026-10-24T15:30:00.000Z",
    cancellationToken: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };

  // =========================================================================
  // Sección 8 — 15 Pruebas Obligatorias de Auditoría Correctiva
  // =========================================================================

  // 1. Reclamación de una fila con un token de lease único generado criptográficamente
  it("Auditoría 1: reclamación de una fila asigna un lease_token único", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-claim-1",
      appointmentId: "appt-1",
      payload: encryptedPayload,
    });

    const { mockDb, capturedClaimTokens } = createMockOutboxDb([sampleItem]);
    const { mockClient } = createMockResendClient({
      sendResult: { data: { id: "resend-claim-msg" }, error: null },
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(capturedClaimTokens.length, 1);
    const token = capturedClaimTokens[0];
    assert.equal(typeof token, "string");
    // Formato UUIDv4 estándar de 36 caracteres
    assert.match(token, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  // 2. Reclamaciones sucesivas que generan tokens diferentes
  it("Auditoría 2: reclamaciones sucesivas generan tokens de lease criptográficamente distintos", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const item1 = createSampleOutboxItem({
      id: "outbox-succ-1",
      appointmentId: "appt-1",
      payload: encryptedPayload,
    });
    const item2 = createSampleOutboxItem({
      id: "outbox-succ-2",
      appointmentId: "appt-2",
      payload: encryptedPayload,
    });

    const { mockDb, capturedClaimTokens } = createMockOutboxDb([item1, item2]);
    const { mockClient } = createMockResendClient({});

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(capturedClaimTokens.length, 2);
    assert.notEqual(capturedClaimTokens[0], capturedClaimTokens[1]);
  });

  // 3. Worker que pierde el lease antes de renovar
  it("Auditoría 3: detecta pérdida de lease si las condiciones de renovación no se cumplen", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-lost-renew",
      appointmentId: "appt-renew",
      payload: encryptedPayload,
    });

    // Simula que la renovación afecta 0 filas (lease expiró o token no coincide)
    const { mockDb } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnRenewal: true,
    });
    const { mockClient, sentEmails } = createMockResendClient({});

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 0);
    assert.equal(summary.retried, 1);
    assert.equal(sentEmails.length, 0);
    assert.ok(summary.details[0].error?.includes("Propiedad de lease perdida"));
  });

  // 4. Renovación que afecta cero filas: no se envía el correo
  it("Auditoría 4: si la renovación afecta cero filas, detiene el procesamiento y NO envía el correo a Resend", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-abort-send",
      appointmentId: "appt-abort",
      payload: encryptedPayload,
    });

    let resendCalled = false;
    const { mockDb } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnRenewal: true,
    });
    const { mockClient } = createMockResendClient({
      onSend: () => {
        resendCalled = true;
      },
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(resendCalled, false, "Resend NUNCA debe ser invocado si la renovación falló");
    assert.equal(summary.sent, 0);
  });

  // 5. Otro worker que reclama el trabajo después de expirar el lease
  it("Auditoría 5: un nuevo worker puede reclamar un trabajo en 'processing' cuyo lease anterior expiró", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const abandonedItem = createSampleOutboxItem({
      id: "outbox-reclaim-expired",
      appointmentId: "appt-reclaim",
      payload: encryptedPayload,
      status: "processing", // Estaba en processing con worker previo
      leaseToken: "old-abandoned-worker-token",
      attemptCount: 1,
      nextAttemptAt: new Date(Date.now() - 5000), // Lease anterior ya expiró
    });

    const { mockDb, capturedClaimTokens } = createMockOutboxDb([abandonedItem]);
    const { mockClient, sentEmails } = createMockResendClient({});

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 1);
    assert.equal(sentEmails.length, 1);
    // Debe haber asignado un nuevo token diferente al anterior
    assert.equal(capturedClaimTokens.length, 1);
    assert.notEqual(capturedClaimTokens[0], "old-abandoned-worker-token");
  });

  // 6. Worker antiguo que intenta marcar 'sent' después de perder la propiedad: no modifica la fila
  it("Auditoría 6: worker antiguo que perdió propiedad no sobrescribe estado al intentar marcar 'sent'", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-stale-sent",
      appointmentId: "appt-stale",
      payload: encryptedPayload,
    });

    // Simula que la actualización de finalización sent afecta 0 filas (otro worker cambió el token)
    const { mockDb } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnFinalize: true,
    });
    const { mockClient } = createMockResendClient({
      sendResult: { data: { id: "resend-stale-accepted" }, error: null },
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 0, "No debe registrar sent si afectó 0 filas");
    assert.ok(
      summary.details[0].error?.includes("perdió la propiedad del lease antes de persistir sent")
    );
  });

  // 7. Worker antiguo que intenta registrar un error o reintento después de perder la propiedad: no modifica la fila
  it("Auditoría 7: worker antiguo que perdió propiedad no sobrescribe estado al intentar registrar error o reintento", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-stale-err",
      appointmentId: "appt-stale-err",
      payload: encryptedPayload,
    });

    // Simula fallo en Resend y pérdida de lease al finalizar el error (0 filas afectadas)
    const { mockDb } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnFinalize: true,
    });
    const { mockClient } = createMockResendClient({
      throwError: new Error("500 Internal Server Error"),
    });

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    // Al afectar 0 filas, no debe computar retried ni failed como operación efectiva
    assert.equal(summary.sent, 0);
    assert.equal(summary.retried, 0);
    assert.equal(summary.failed, 0);
  });

  // 8. Dos workers que intentan reclamar trabajos simultáneamente
  it("Auditoría 8: previene reclamos concurrentes duplicados mediante FOR UPDATE SKIP LOCKED", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-concurrency-lock",
      appointmentId: "appt-conc",
      payload: encryptedPayload,
    });

    // Instancia con exclusión mutua de bloqueo simulada
    let locked = false;
    const createLockedDb = () =>
      createMockOutboxDb([sampleItem], {
        get isLocked() {
          return locked;
        },
      });

    const { mockClient } = createMockResendClient({});

    // Worker 1 reclama y activa el bloqueo
    locked = false;
    const { mockDb: dbWorker1 } = createLockedDb();
    const summary1 = await processPendingEmails({
      client: dbWorker1,
      resendClient: mockClient,
    });
    assert.equal(summary1.claimed, 1);

    // Worker 2 intenta reclamar simultáneamente mientras worker 1 mantiene el bloqueo
    locked = true;
    const { mockDb: dbWorker2 } = createLockedDb();
    const summary2 = await processPendingEmails({
      client: dbWorker2,
      resendClient: mockClient,
    });
    assert.equal(summary2.claimed, 0, "Worker 2 debe omitir la fila bloqueada");
  });

  // 9. Timeout de Resend y posterior reintento
  it("Auditoría 9: timeout de Resend es abortado limpiamente y reprogramado con backoff", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-timeout-test",
      appointmentId: "appt-timeout",
      payload: encryptedPayload,
    });

    let updatedStatus = "";
    let recordedError = "";
    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: (updates) => {
        if ("status" in updates) updatedStatus = updates.status as string;
        if ("lastError" in updates) recordedError = updates.lastError as string;
      },
    });

    const hangingClient: ResendClientInterface = {
      emails: {
        send: async (_payload, reqOptions) => {
          return new Promise((_, reject) => {
            if (reqOptions?.signal) {
              reqOptions.signal.addEventListener("abort", () => {
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
      resendClient: hangingClient,
      requestTimeoutMs: 50,
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

  // 10. Reutilización de la clave de idempotencia entre reintentos
  it("Auditoría 10: reutiliza estrictamente row.id como idempotencyKey en todos los reintentos", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-fixed-idempotency-key",
      appointmentId: "appt-idem",
      payload: encryptedPayload,
      attemptCount: 2, // Reintento número 3
      lastError: "Previous transient error",
    });

    const { mockDb } = createMockOutboxDb([sampleItem]);
    const { mockClient, sentEmails } = createMockResendClient({
      sendResult: { data: { id: "resend-msg-idem" }, error: null },
    });

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].idempotencyKey, "outbox-fixed-idempotency-key");
  });

  // 11. Respuesta sin ID del proveedor: no se marca como 'sent'
  it("Auditoría 11: respuesta de Resend sin identificador válido de mensaje no se transiciona a 'sent'", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-no-msg-id",
      appointmentId: "appt-noid",
      payload: encryptedPayload,
    });

    let finalStatus = "";
    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: (updates) => {
        if ("status" in updates) finalStatus = updates.status as string;
      },
    });

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
    assert.equal(finalStatus, "pending");
  });

  // 12. Destinatario recuperado correctamente del payload cifrado
  it("Auditoría 12: recupera y descifra el destinatario exclusivamente desde el payload en memoria", async () => {
    const payloadWithSecretRecipient: CustomerBookingPayload = {
      ...sampleCustomerData,
      recipientEmail: "cliente.confidencial@example.com",
    };
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(payloadWithSecretRecipient));

    const sampleItem = createSampleOutboxItem({
      id: "outbox-payload-recipient",
      appointmentId: "appt-secret",
      recipient: "[ENCRYPTED_IN_PAYLOAD]", // En BD nunca figura el correo real
      payload: encryptedPayload,
    });

    const { mockDb } = createMockOutboxDb([sampleItem]);
    const { mockClient, sentEmails } = createMockResendClient({});

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].payload.to, "cliente.confidencial@example.com");
  });

  // 13. Ausencia del destinatario en texto claro después de la transición de esquema
  it("Auditoría 13: ausencia de recipient en texto claro en reposo (placeholder en espera, [REDACTED] post-envío)", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-no-plaintext",
      appointmentId: "appt-privacy",
      recipient: "[ENCRYPTED_IN_PAYLOAD]",
      payload: encryptedPayload,
    });

    let persistedRecipient = "";
    let persistedPayload: Record<string, unknown> | null = null;

    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: (updates) => {
        if ("recipient" in updates) persistedRecipient = updates.recipient as string;
        if ("payload" in updates) persistedPayload = updates.payload as Record<string, unknown>;
      },
    });
    const { mockClient } = createMockResendClient({});

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    // En reposo post-envío, recipient queda [REDACTED] y payload sanitizado
    assert.equal(persistedRecipient, "[REDACTED]");
    assert.equal((persistedPayload as { sanitized?: boolean } | null)?.sanitized, true);
  });

  // 14. Conservación de la compatibilidad con los formatos de payload realmente existentes
  it("Auditoría 14: compatible con filas legacy (recipient en texto claro sin recipientEmail en payload)", async () => {
    // Formato legacy anterior: payload sin recipientEmail
    const legacyCustomerData = {
      customerName: "Lucas Silva",
      customerEmail: "lucas.legacy@example.com",
      customerPhone: "+542235551234",
      serviceName: "Corte Clásico",
      serviceDurationMinutes: 30,
      servicePriceAmount: 12000,
      currency: "ARS",
      startAt: "2026-10-24T15:00:00.000Z",
      endAt: "2026-10-24T15:30:00.000Z",
      cancellationToken: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    };
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(legacyCustomerData));

    const legacyItem = createSampleOutboxItem({
      id: "outbox-legacy-format",
      appointmentId: "appt-legacy",
      recipient: "lucas.legacy@example.com", // Columna con correo legacy
      payload: encryptedPayload,
    });

    const { mockDb } = createMockOutboxDb([legacyItem]);
    const { mockClient, sentEmails } = createMockResendClient({});

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 1);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].payload.to, "lucas.legacy@example.com");
  });

  // 15. Sanitización de errores y ausencia de datos sensibles en logs
  it("Auditoría 15: sanitización rigurosa de errores elimina emails, tokens, api keys y urls de base de datos", () => {
    const sensitiveError =
      "Error with API key re_1234567890abcdef, token 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef, recipient lucas@example.com on postgresql://user:pass@ep-host.neon.tech/neondb";

    const sanitized = sanitizeErrorMessage(sensitiveError);

    assert.ok(!sanitized.includes("lucas@example.com"));
    assert.ok(sanitized.includes("[REDACTED_EMAIL]"));
    assert.ok(!sanitized.includes("re_1234567890abcdef"));
    assert.ok(sanitized.includes("[REDACTED_API_KEY]"));
    assert.ok(!sanitized.includes("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"));
    assert.ok(sanitized.includes("[REDACTED_TOKEN]"));
    assert.ok(!sanitized.includes("user:pass@ep-host"));
    assert.ok(sanitized.includes("[REDACTED_DB_URL]"));
  });

  // =========================================================================
  // Pruebas Funcionales y Casos Límite Complementarios
  // =========================================================================

  // 16. Outbox vacía
  it("16. outbox vacía finaliza sin errores y con métricas en cero", async () => {
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

  // 17. Formato de fecha en Buenos Aires
  it("17. formatea la fecha y hora correctamente en la zona 'America/Argentina/Buenos_Aires'", () => {
    const formatted = formatDateTimeBuenosAires("2026-10-24T15:00:00.000Z");
    assert.equal(formatted.timeStr, "12:00 hs");
    assert.ok(formatted.dateStr.includes("2026"));
    assert.ok(formatted.dateStr.toLowerCase().includes("octubre"));
    assert.ok(formatted.fullStr.includes("12:00 hs"));
  });

  // 18. Descifrado correcto de payload AES-256-GCM
  it("18. descifra correctamente el payload cifrado con AES-256-GCM en memoria", () => {
    const encrypted = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const decrypted = parseAndDecryptOutboxPayload(encrypted);

    assert.equal(decrypted.customerName, "Lucas Silva");
    assert.equal(decrypted.serviceName, "Corte Clásico");
    assert.equal((decrypted as CustomerBookingPayload).cancellationToken, sampleCustomerData.cancellationToken);
  });

  // 19. Rechazo de payload alterado criptográficamente
  it("19. rechaza y marca como fallido terminal un payload ilegible o con alteración criptográfica", async () => {
    const corruptedPayload = {
      iv: "123456789012345678901234",
      tag: "12345678901234567890123456789012",
      ciphertext: "deadbeef",
    };

    const sampleItem = createSampleOutboxItem({
      id: "outbox-corrupted",
      appointmentId: "appt-2",
      payload: corruptedPayload,
    });

    let terminalStatus = "";
    let loggedError = "";

    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: (updates) => {
        if ("status" in updates) terminalStatus = updates.status as string;
        if ("lastError" in updates) loggedError = updates.lastError as string;
      },
    });
    const { mockClient, sentEmails } = createMockResendClient({});

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 0);
    assert.equal(summary.failed, 1);
    assert.equal(sentEmails.length, 0);
    assert.equal(terminalStatus, "failed");
    assert.ok(loggedError.includes("Descifrado fallido"));
  });

  // 20. Reprogramación ante error recuperable (429 Rate Limit)
  it("20. reprograma el trabajo con backoff ante error recuperable (429 Rate Limit)", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-rate-limit",
      appointmentId: "appt-3",
      payload: encryptedPayload,
    });

    let updatedStatus = "";
    let updatedAttemptCount = 0;

    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: (updates) => {
        if ("status" in updates) updatedStatus = updates.status as string;
        if ("attemptCount" in updates) updatedAttemptCount = updates.attemptCount as number;
      },
    });
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
    assert.equal(updatedStatus, "pending");
    assert.equal(updatedAttemptCount, 1);
  });

  // 21. Error permanente del proveedor (422)
  it("21. marca 'failed' de forma inmediata ante un error permanente del proveedor (422 Unprocessable)", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-invalid-email",
      appointmentId: "appt-4",
      payload: encryptedPayload,
    });

    let updatedStatus = "";
    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: (updates) => {
        if ("status" in updates) updatedStatus = updates.status as string;
      },
    });
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

  // 22. Límite máximo de reintentos
  it("22. transiciona a 'failed' cuando se alcanza el límite máximo de reintentos", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-max-attempts",
      appointmentId: "appt-5",
      payload: encryptedPayload,
      attemptCount: 4, // Intento 5 alcanzará el límite
      lastError: "Network timeout",
    });

    let updatedStatus = "";
    let updatedAttemptCount = 0;

    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: (updates) => {
        if ("status" in updates) updatedStatus = updates.status as string;
        if ("attemptCount" in updates) updatedAttemptCount = updates.attemptCount as number;
      },
    });
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

  // 23. Manejo de excepciones en actualización de base de datos post-envío
  it("23. maneja excepciones si la base de datos falla al actualizar el estado post-envío", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-db-failure",
      appointmentId: "appt-8",
      payload: encryptedPayload,
    });

    let updateCount = 0;
    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: () => {
        updateCount++;
        // La primera llamada post-envío falla (simulando corte de conexión a BD)
        if (updateCount === 2) {
          throw new Error("Neon connection terminated during sent status update");
        }
      },
    });

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

  // 24. No sanitiza ni purga el payload si el envío no fue confirmado exitosamente
  it("24. no sanitiza ni purga el payload si el envío no fue confirmado exitosamente", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-retry-payload",
      appointmentId: "appt-9",
      payload: encryptedPayload,
    });

    let updatedPayload: unknown = "not_touched";
    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: (updates) => {
        if ("payload" in updates) {
          updatedPayload = updates.payload;
        }
      },
    });
    const { mockClient } = createMockResendClient({
      sendResult: { data: null, error: { message: "Internal server error", statusCode: 500 } },
    });

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(updatedPayload, "not_touched");
  });

  // 25. Notificación al barbero sin token de cancelación
  it("25. envía la notificación del barbero con datos del cliente pero sin enlace de cancelación", async () => {
    const barberData: BarberBookingPayload = {
      customerName: "Lucas Silva",
      customerEmail: "lucas@example.com",
      recipientEmail: "barbero@rovebarberia.com",
      customerPhone: "+542235551234",
      serviceName: "Corte Clásico",
      serviceDurationMinutes: 30,
      servicePriceAmount: 12000,
      currency: "ARS",
      startAt: "2026-10-24T15:00:00.000Z",
      endAt: "2026-10-24T15:30:00.000Z",
    };

    const encryptedPayload = encryptOutboxPayload(JSON.stringify(barberData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-barber",
      appointmentId: "appt-10",
      payload: encryptedPayload,
    });

    const { mockDb } = createMockOutboxDb([sampleItem]);
    const { mockClient, sentEmails } = createMockResendClient({
      sendResult: { data: { id: "resend-barber-msg" }, error: null },
    });

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].payload.to, "barbero@rovebarberia.com");
    assert.equal(sentEmails[0].payload.html.includes("/cancelar/"), false);
    assert.equal(sentEmails[0].payload.text.includes("/cancelar/"), false);
    assert.ok(sentEmails[0].payload.html.includes("Lucas Silva"));
    assert.ok(sentEmails[0].payload.html.includes("+542235551234"));
  });

  // 26. Ausencia de RESEND_API_KEY reprograma sin lanzar excepción
  it("26. maneja la ausencia de RESEND_API_KEY reprogramando las filas sin abortar con excepción", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
      const sampleItem = createSampleOutboxItem({
        id: "outbox-no-key",
        appointmentId: "appt-11",
        payload: encryptedPayload,
      });

      let updatedStatus = "";
      let recordedError = "";

      const { mockDb } = createMockOutboxDb([sampleItem], {
        onUpdate: (updates) => {
          if ("status" in updates) updatedStatus = updates.status as string;
          if ("lastError" in updates) recordedError = updates.lastError as string;
        },
      });

      const summary = await processPendingEmails({
        client: mockDb,
      });

      assert.equal(summary.claimed, 1);
      assert.equal(summary.sent, 0);
      assert.equal(summary.retried, 1);
      assert.equal(updatedStatus, "pending");
      assert.ok(recordedError.includes("RESEND_API_KEY no está configurada"));
    } finally {
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  // 27. Escala de esperas progresivas (backoff)
  it("27. calculateBackoffMinutes implementa una escala de espera acotada y predecible", () => {
    assert.equal(calculateBackoffMinutes(1), 1);
    assert.equal(calculateBackoffMinutes(2), 5);
    assert.equal(calculateBackoffMinutes(3), 15);
    assert.equal(calculateBackoffMinutes(4), 60);
    assert.equal(calculateBackoffMinutes(5), 120);
    assert.equal(calculateBackoffMinutes(10), 120);
  });

  // 28. Conservación de recipient durante reintentos
  it("28. conserva el valor de recipient intacto durante reintentos para no perder el destino", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-recipient-retried",
      appointmentId: "appt-recipient",
      payload: encryptedPayload,
    });

    let touchedRecipient: unknown = "not_modified";
    const { mockDb } = createMockOutboxDb([sampleItem], {
      onUpdate: (updates) => {
        if ("recipient" in updates) touchedRecipient = updates.recipient;
      },
    });
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
