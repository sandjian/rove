import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  processPendingEmails,
  formatDateTimeBuenosAires,
  sanitizeErrorMessage,
  isPermanentError,
  parseAndDecryptOutboxPayload,
  calculateBackoffMinutes,
  escapeHtml,
  renderCustomerConfirmationEmail,
  renderBarberNotificationEmail,
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

interface RecordedUpdateOp {
  updates: Record<string, unknown>;
  sql: string;
  params: unknown[];
  isRenewal: boolean;
  isFinalize: boolean;
}

interface MockOutboxDbOptions {
  simulateLostLeaseOnRenewal?: boolean;
  simulateLostLeaseOnFinalize?: boolean;
  simulateLostLeaseOnMissingApiKey?: boolean;
  simulateLostLeaseOnPayloadError?: boolean;
  throwOnUpdate?: Error;
  onUpdate?: (updates: Record<string, unknown>, whereClause?: unknown) => void;
  isLocked?: boolean;
}

/**
 * Cliente de base de datos simulado para pruebas completas del worker de outbox.
 * Inspecciona y valida las condiciones SQL reales (where) generadas por Drizzle mediante PgDialect.
 */
function createMockOutboxDb(
  initialRows: EmailOutboxItem[],
  options: MockOutboxDbOptions = {}
) {
  const rows = initialRows.map((r) => ({ ...r }));
  let locked = options.isLocked ?? false;
  const capturedClaimTokens: string[] = [];
  const recordedUpdateOps: RecordedUpdateOp[] = [];
  const capturedClaimSelectOps: Array<{ sql: string; params: unknown[] }> = [];
  const capturedClaimUpdateOps: Array<{ updates: Record<string, unknown>; sql: string; params: unknown[] }> = [];
  const dialect = new PgDialect();

  const mockDb = {
    transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: (whereClause?: unknown) => {
              if (whereClause) {
                const query = dialect.sqlToQuery(whereClause as SQL);
                capturedClaimSelectOps.push({ sql: query.sql, params: query.params });
              }
              return {
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
              };
            },
          }),
        }),
        update: () => ({
          set: (updates: Record<string, unknown>) => ({
            where: (whereClause?: unknown) => {
              if (updates.leaseToken) {
                capturedClaimTokens.push(updates.leaseToken as string);
              }
              let whereSql = "";
              let whereParams: unknown[] = [];
              if (whereClause) {
                const query = dialect.sqlToQuery(whereClause as SQL);
                whereSql = query.sql;
                whereParams = query.params;
              }
              capturedClaimUpdateOps.push({ updates, sql: whereSql, params: whereParams });
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

          let whereSql = "";
          let whereParams: unknown[] = [];
          if (whereClause) {
            const query = dialect.sqlToQuery(whereClause as SQL);
            whereSql = query.sql;
            whereParams = query.params;
          }

          const isRenewal = "nextAttemptAt" in updates && !("status" in updates);
          const isFinalize = "status" in updates;

          recordedUpdateOps.push({
            updates,
            sql: whereSql,
            params: whereParams,
            isRenewal,
            isFinalize,
          });

          // Renovación de lease: contiene nextAttemptAt sin status
          if (isRenewal && options.simulateLostLeaseOnRenewal) {
            return createMockUpdateBuilder(undefined, []);
          }

          // Ausencia de API key: contiene status 'pending' y lastError con RESEND_API_KEY
          if (
            options.simulateLostLeaseOnMissingApiKey &&
            updates.status === "pending" &&
            String(updates.lastError || "").includes("RESEND_API_KEY")
          ) {
            return createMockUpdateBuilder(undefined, []);
          }

          // Payload corrupto: contiene status 'failed' y lastError con descifrado/payload
          if (
            options.simulateLostLeaseOnPayloadError &&
            updates.status === "failed" &&
            (String(updates.lastError || "").toLowerCase().includes("payload") ||
             String(updates.lastError || "").toLowerCase().includes("descifrado"))
          ) {
            return createMockUpdateBuilder(undefined, []);
          }

          // Finalización (sent, failed, pending retry): contiene status
          if (isFinalize && options.simulateLostLeaseOnFinalize) {
            return createMockUpdateBuilder(undefined, []);
          }

          return createMockUpdateBuilder(undefined, [{ id: "mock-id" }]);
        },
      }),
    }),
  };

  return {
    mockDb: mockDb as unknown as DrizzleDb,
    rows,
    capturedClaimTokens,
    recordedUpdateOps,
    capturedClaimSelectOps,
    capturedClaimUpdateOps,
  };
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
  // Sección 8 — Pruebas de Auditoría de Lease y Control de Propiedad
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

  // 3. Worker que pierde el lease antes de renovar y verificación de condiciones SQL de renovación
  it("Auditoría 3: renovación condiciona explícitamente id, status, lease_token y next_attempt_at >= clock_timestamp()", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-lost-renew",
      appointmentId: "appt-renew",
      payload: encryptedPayload,
    });

    const { mockDb, capturedClaimTokens, recordedUpdateOps } = createMockOutboxDb([sampleItem], {
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

    // Verificación profunda de las condiciones SQL reales de renovación
    const renewalOp = recordedUpdateOps.find((op) => op.isRenewal);
    assert.ok(renewalOp, "Debe haberse ejecutado una operación de renovación de lease");
    assert.ok(renewalOp.sql.includes('"email_outbox"."id" = $'), "Debe condicionar por id");
    assert.ok(renewalOp.sql.includes('"email_outbox"."status" = $'), "Debe condicionar por status");
    assert.ok(renewalOp.sql.includes('"email_outbox"."lease_token" = $'), "Debe condicionar por lease_token");
    assert.ok(
      renewalOp.sql.includes('"email_outbox"."next_attempt_at" >= clock_timestamp()'),
      "Debe exigir que el lease siga vigente (next_attempt_at >= clock_timestamp())"
    );
    assert.ok(
      renewalOp.params.includes(capturedClaimTokens[0]),
      "Debe incluir el token de lease exacto en los parámetros"
    );
    assert.ok(renewalOp.params.includes("processing"), "Debe exigir status 'processing'");
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

  // 6. Worker antiguo que intenta marcar 'sent' después de perder la propiedad: no modifica la fila y valida SQL
  it("Auditoría 6: worker antiguo que perdió propiedad no sobrescribe estado al intentar marcar 'sent' (valida leaseToken en SQL)", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-stale-sent",
      appointmentId: "appt-stale",
      payload: encryptedPayload,
    });

    // Simula que la actualización de finalización sent afecta 0 filas (otro worker cambió el token)
    const { mockDb, capturedClaimTokens, recordedUpdateOps } = createMockOutboxDb([sampleItem], {
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

    // Verificación de que la finalización sent condicionó por id, status, lease_token, vigencia temporal e invalidó propiedad
    const sentOp = recordedUpdateOps.find((op) => op.isFinalize && op.updates.status === "sent");
    assert.ok(sentOp, "Debe haber intentado la actualización 'sent'");
    assert.ok(sentOp.sql.includes('"email_outbox"."id" = $'), "Debe condicionar por id");
    assert.ok(sentOp.sql.includes('"email_outbox"."status" = $'), "Debe condicionar por status 'processing'");
    assert.ok(sentOp.sql.includes('"email_outbox"."lease_token" = $'), "Debe condicionar por lease_token");
    assert.ok(
      sentOp.sql.includes('"email_outbox"."next_attempt_at" >= clock_timestamp()'),
      "Debe exigir que el lease siga vigente (next_attempt_at >= clock_timestamp())"
    );
    assert.ok(sentOp.params.includes(capturedClaimTokens[0]), "Debe incluir el lease_token en los parámetros");
    assert.ok(sentOp.params.includes("processing"), "Debe condicionar que el estado sea 'processing'");
    assert.equal(sentOp.updates.leaseToken, null, "Debe invalidar leaseToken al finalizar");
  });

  // 7. Worker antiguo que intenta registrar un error o reintento después de perder la propiedad
  it("Auditoría 7: worker antiguo que perdió propiedad no sobrescribe estado al intentar registrar error o reintento", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-stale-err",
      appointmentId: "appt-stale-err",
      payload: encryptedPayload,
    });

    const { mockDb, capturedClaimTokens, recordedUpdateOps } = createMockOutboxDb([sampleItem], {
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
    assert.equal(summary.sent, 0);
    assert.equal(summary.retried, 0);
    assert.equal(summary.failed, 0);
    assert.ok(
      summary.details[0].error?.includes("perdió la propiedad del lease antes de reprogramar")
    );

    const retryOp = recordedUpdateOps.find((op) => op.isFinalize && op.updates.status === "pending");
    assert.ok(retryOp, "Debe haber intentado registrar reintento");
    assert.ok(retryOp.sql.includes('"email_outbox"."id" = $'), "Debe condicionar por id");
    assert.ok(retryOp.sql.includes('"email_outbox"."status" = $'), "Debe condicionar por status 'processing'");
    assert.ok(retryOp.sql.includes('"email_outbox"."lease_token" = $'), "Debe condicionar por lease_token");
    assert.ok(
      retryOp.sql.includes('"email_outbox"."next_attempt_at" >= clock_timestamp()'),
      "Debe exigir que el lease siga vigente (next_attempt_at >= clock_timestamp())"
    );
    assert.ok(retryOp.params.includes(capturedClaimTokens[0]), "Debe incluir el lease_token en los parámetros");
    assert.ok(retryOp.params.includes("processing"), "Debe condicionar que el estado sea 'processing'");
    assert.equal(retryOp.updates.leaseToken, null, "Debe invalidar leaseToken en reintento");
  });

  // 8. Dos workers que intentan reclamar trabajos simultáneamente
  it("Auditoría 8: previene reclamos concurrentes duplicados mediante FOR UPDATE SKIP LOCKED", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-concurrency-lock",
      appointmentId: "appt-conc",
      payload: encryptedPayload,
    });

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
      recipient: "[ENCRYPTED_IN_PAYLOAD]",
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
      recipient: "lucas.legacy@example.com",
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
  // Sección 5 — Pruebas de Seguridad: Escapado HTML contra XSS en Templates
  // =========================================================================

  // 16. escapeHtml escapa caracteres especiales (<, >, &, ", ')
  it("Auditoría XSS 16: escapeHtml escapa rigurosamente caracteres peligrosos en HTML", () => {
    const raw = `<script>alert("XSS") & alert('test')</script>`;
    const escaped = escapeHtml(raw);

    assert.ok(!escaped.includes("<"));
    assert.ok(!escaped.includes(">"));
    assert.ok(!escaped.includes('"'));
    assert.ok(!escaped.includes("'"));
    assert.ok(escaped.includes("&lt;script&gt;"));
    assert.ok(escaped.includes("&quot;XSS&quot;"));
    assert.ok(escaped.includes("&amp;"));
    assert.ok(escaped.includes("&#39;test&#39;"));
    assert.ok(escaped.includes("&lt;/script&gt;"));
  });

  // 17. renderCustomerConfirmationEmail escapa valores dinámicos en HTML sin alterar el texto plano
  it("Auditoría XSS 17: renderCustomerConfirmationEmail escapa HTML pero preserva texto plano", () => {
    const maliciousCustomerPayload: CustomerBookingPayload = {
      ...sampleCustomerData,
      customerName: `Lucas <img src=x onerror=alert("name")>`,
      serviceName: `Corte & Barba "VIP" <Edición 'Especial'>`,
    };

    const rendered = renderCustomerConfirmationEmail({
      payload: maliciousCustomerPayload,
      baseUrl: "https://rovebarberia.com",
    });

    // En HTML los valores deben estar completamente escapados
    assert.ok(!rendered.html.includes("<img src=x onerror="));
    assert.ok(rendered.html.includes("&lt;img src=x onerror=alert(&quot;name&quot;)&gt;"));
    assert.ok(rendered.html.includes("Corte &amp; Barba &quot;VIP&quot; &lt;Edición &#39;Especial&#39;&gt;"));

    // En texto plano deben permanecer intactos los caracteres originales para legibilidad
    assert.ok(rendered.text.includes(`Hola Lucas <img src=x onerror=alert("name")>,`));
    assert.ok(rendered.text.includes(`- Servicio: Corte & Barba "VIP" <Edición 'Especial'>`));
    // La URL de cancelación debe conservarse válida
    assert.ok(rendered.text.includes("/cancelar/0123456789abcdef"));
    assert.ok(rendered.html.includes("/cancelar/0123456789abcdef"));
  });

  // 18. renderBarberNotificationEmail escapa valores dinámicos en HTML
  it("Auditoría XSS 18: renderBarberNotificationEmail escapa datos de cliente y servicio en HTML", () => {
    const maliciousBarberPayload: BarberBookingPayload = {
      customerName: `<b onmouseover="alert('xss')">Lucas</b>`,
      customerEmail: `test+<1>@example.com`,
      recipientEmail: "barbero@rovebarberia.com",
      customerPhone: "+542235551234",
      serviceName: `Corte & Lavado "Express"`,
      serviceDurationMinutes: 30,
      servicePriceAmount: 12000,
      currency: "ARS",
      startAt: "2026-10-24T15:00:00.000Z",
      endAt: "2026-10-24T15:30:00.000Z",
    };

    const rendered = renderBarberNotificationEmail({
      payload: maliciousBarberPayload,
    });

    // En HTML
    assert.ok(!rendered.html.includes("<b onmouseover="));
    assert.ok(rendered.html.includes("&lt;b onmouseover=&quot;alert(&#39;xss&#39;)&quot;&gt;Lucas&lt;/b&gt;"));
    assert.ok(rendered.html.includes("test+&lt;1&gt;@example.com"));
    assert.ok(rendered.html.includes("Corte &amp; Lavado &quot;Express&quot;"));

    // En texto plano
    assert.ok(rendered.text.includes(`<b onmouseover="alert('xss')">Lucas</b>`));
    assert.ok(rendered.text.includes(`test+<1>@example.com`));
    assert.ok(rendered.text.includes(`Corte & Lavado "Express"`));
  });

  // =========================================================================
  // Pruebas Funcionales y Casos Límite Complementarios
  // =========================================================================

  // 19. Outbox vacía
  it("19. outbox vacía finaliza sin errores y con métricas en cero", async () => {
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

  // 20. Formato de fecha en Buenos Aires
  it("20. formatea la fecha y hora correctamente en la zona 'America/Argentina/Buenos_Aires'", () => {
    const formatted = formatDateTimeBuenosAires("2026-10-24T15:00:00.000Z");
    assert.equal(formatted.timeStr, "12:00 hs");
    assert.ok(formatted.dateStr.includes("2026"));
    assert.ok(formatted.dateStr.toLowerCase().includes("octubre"));
    assert.ok(formatted.fullStr.includes("12:00 hs"));
  });

  // 21. Descifrado correcto de payload AES-256-GCM
  it("21. descifra correctamente el payload cifrado con AES-256-GCM en memoria", () => {
    const encrypted = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const decrypted = parseAndDecryptOutboxPayload(encrypted);

    assert.equal(decrypted.customerName, "Lucas Silva");
    assert.equal(decrypted.serviceName, "Corte Clásico");
    assert.equal((decrypted as CustomerBookingPayload).cancellationToken, sampleCustomerData.cancellationToken);
  });

  // 22. Rechazo de payload alterado criptográficamente
  it("22. rechaza y marca como fallido terminal un payload ilegible o con alteración criptográfica", async () => {
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

  // 23. Reprogramación ante error recuperable (429 Rate Limit)
  it("23. reprograma el trabajo con backoff ante error recuperable (429 Rate Limit)", async () => {
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

  // 24. Error permanente del proveedor (422)
  it("24. marca 'failed' de forma inmediata ante un error permanente del proveedor (422 Unprocessable)", async () => {
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

  // 25. Límite máximo de reintentos
  it("25. transiciona a 'failed' cuando se alcanza el límite máximo de reintentos", async () => {
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

  // 26. Manejo de excepciones en actualización de base de datos post-envío
  it("26. maneja excepciones si la base de datos falla al actualizar el estado post-envío", async () => {
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

  // 27. No sanitiza ni purga el payload si el envío no fue confirmado exitosamente
  it("27. no sanitiza ni purga el payload si el envío no fue confirmado exitosamente", async () => {
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

  // 28. Notificación al barbero sin token de cancelación
  it("28. envía la notificación del barbero con datos del cliente pero sin enlace de cancelación", async () => {
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

  // 29. Ausencia de RESEND_API_KEY reprograma sin lanzar excepción
  it("29. maneja la ausencia de RESEND_API_KEY reprogramando las filas sin abortar con excepción", async () => {
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

  // 30. Escala de esperas progresivas (backoff)
  it("30. calculateBackoffMinutes implementa una escala de espera acotada y predecible", () => {
    assert.equal(calculateBackoffMinutes(1), 1);
    assert.equal(calculateBackoffMinutes(2), 5);
    assert.equal(calculateBackoffMinutes(3), 15);
    assert.equal(calculateBackoffMinutes(4), 60);
    assert.equal(calculateBackoffMinutes(5), 120);
    assert.equal(calculateBackoffMinutes(10), 120);
  });

  // 31. Conservación de recipient durante reintentos
  it("31. conserva el valor de recipient intacto durante reintentos para no perder el destino", async () => {
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

  // =========================================================================
  // Sección 9 — Pruebas de Auditoría de Leases Temporales (Fase 5A)
  // =========================================================================

  // 32. El marcado de fallo definitivo ('failed') condiciona estrictamente id, status, lease_token y next_attempt_at >= clock_timestamp()
  it("Auditoría 32: marcado de fallo definitivo condiciona id, status, lease_token y next_attempt_at >= clock_timestamp() y no incrementa failed si afecta 0 filas", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-fail-lease",
      appointmentId: "appt-fail-lease",
      payload: encryptedPayload,
    });

    const { mockDb, capturedClaimTokens, recordedUpdateOps } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnFinalize: true, // Simula que el lease expiró al actualizar
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
    assert.equal(summary.sent, 0);
    assert.equal(summary.retried, 0);
    assert.equal(summary.failed, 0, "No debe registrar failed si la actualización afectó 0 filas");
    assert.ok(
      summary.details[0].error?.includes("perdió la propiedad del lease antes de persistir failed")
    );

    // Verificación de SQL generado con PgDialect
    const failOp = recordedUpdateOps.find((op) => op.isFinalize && op.updates.status === "failed");
    assert.ok(failOp, "Debe haber intentado la actualización 'failed'");
    assert.ok(failOp.sql.includes('"email_outbox"."id" = $'), "Debe condicionar por id");
    assert.ok(failOp.sql.includes('"email_outbox"."status" = $'), "Debe condicionar por status 'processing'");
    assert.ok(failOp.sql.includes('"email_outbox"."lease_token" = $'), "Debe condicionar por lease_token");
    assert.ok(
      failOp.sql.includes('"email_outbox"."next_attempt_at" >= clock_timestamp()'),
      "Debe exigir que el lease siga vigente (next_attempt_at >= clock_timestamp())"
    );
    assert.ok(failOp.params.includes(capturedClaimTokens[0]), "Debe incluir el lease_token en los parámetros");
    assert.ok(failOp.params.includes("processing"), "Debe condicionar que el estado sea 'processing'");
    assert.equal(failOp.updates.leaseToken, null, "Debe invalidar leaseToken al finalizar");
  });

  // 33. Ausencia de RESEND_API_KEY exige lease vigente (next_attempt_at >= clock_timestamp()) y maneja 0 filas
  it("Auditoría 33: ausencia de RESEND_API_KEY exige id, status, lease_token y next_attempt_at >= clock_timestamp() y no incrementa retried si afecta 0 filas", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
      const sampleItem = createSampleOutboxItem({
        id: "outbox-no-key-lost-lease",
        appointmentId: "appt-no-key-lost-lease",
        payload: encryptedPayload,
      });

      const { mockDb, capturedClaimTokens, recordedUpdateOps } = createMockOutboxDb([sampleItem], {
        simulateLostLeaseOnMissingApiKey: true,
      });

      const summary = await processPendingEmails({
        client: mockDb,
      });

      assert.equal(summary.claimed, 1);
      assert.equal(summary.sent, 0);
      assert.equal(summary.retried, 0, "No debe registrar retried si la actualización afectó 0 filas");
      assert.ok(
        summary.details[0].error?.includes("Propiedad de lease perdida al intentar reprogramar")
      );

      const noKeyOp = recordedUpdateOps.find(
        (op) => op.isFinalize && op.updates.status === "pending" && String(op.updates.lastError || "").includes("RESEND_API_KEY")
      );
      assert.ok(noKeyOp, "Debe haber intentado la reprogramación por falta de API key");
      assert.ok(noKeyOp.sql.includes('"email_outbox"."id" = $'), "Debe condicionar por id");
      assert.ok(noKeyOp.sql.includes('"email_outbox"."status" = $'), "Debe condicionar por status 'processing'");
      assert.ok(noKeyOp.sql.includes('"email_outbox"."lease_token" = $'), "Debe condicionar por lease_token");
      assert.ok(
        noKeyOp.sql.includes('"email_outbox"."next_attempt_at" >= clock_timestamp()'),
        "Debe exigir que el lease siga vigente (next_attempt_at >= clock_timestamp())"
      );
      assert.ok(noKeyOp.params.includes(capturedClaimTokens[0]), "Debe incluir el lease_token en los parámetros");
      assert.ok(noKeyOp.params.includes("processing"), "Debe condicionar que el estado sea 'processing'");
    } finally {
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  // 34. Payload corrupto / fallo de descifrado exige lease vigente (next_attempt_at >= clock_timestamp()) y maneja 0 filas
  it("Auditoría 34: payload corrupto exige id, status, lease_token y next_attempt_at >= clock_timestamp() y no incrementa failed si afecta 0 filas", async () => {
    const corruptedPayload = {
      iv: "123456789012345678901234",
      tag: "12345678901234567890123456789012",
      ciphertext: "badbeefcafe",
    };

    const sampleItem = createSampleOutboxItem({
      id: "outbox-corrupted-lost-lease",
      appointmentId: "appt-corrupted-lost-lease",
      payload: corruptedPayload,
    });

    const { mockDb, capturedClaimTokens, recordedUpdateOps } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnPayloadError: true,
    });
    const { mockClient } = createMockResendClient({});

    const summary = await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
    });

    assert.equal(summary.claimed, 1);
    assert.equal(summary.sent, 0);
    assert.equal(summary.retried, 0);
    assert.equal(summary.failed, 0, "No debe registrar failed si la actualización afectó 0 filas");
    assert.ok(
      summary.details[0].error?.includes("Propiedad de lease perdida al intentar marcar fallo")
    );

    const payloadErrOp = recordedUpdateOps.find(
      (op) => op.isFinalize && op.updates.status === "failed" && String(op.updates.lastError || "").includes("Descifrado fallido")
    );
    assert.ok(payloadErrOp, "Debe haber intentado marcar fallo por payload inválido");
    assert.ok(payloadErrOp.sql.includes('"email_outbox"."id" = $'), "Debe condicionar por id");
    assert.ok(payloadErrOp.sql.includes('"email_outbox"."status" = $'), "Debe condicionar por status 'processing'");
    assert.ok(payloadErrOp.sql.includes('"email_outbox"."lease_token" = $'), "Debe condicionar por lease_token");
    assert.ok(
      payloadErrOp.sql.includes('"email_outbox"."next_attempt_at" >= clock_timestamp()'),
      "Debe exigir que el lease siga vigente (next_attempt_at >= clock_timestamp())"
    );
    assert.ok(payloadErrOp.params.includes(capturedClaimTokens[0]), "Debe incluir el lease_token en los parámetros");
    assert.ok(payloadErrOp.params.includes("processing"), "Debe condicionar que el estado sea 'processing'");
  });

  // 35. Concurrencia entre workers: Worker 1 con lease expirado no puede sobrescribir a Worker 2 con token nuevo
  it("Auditoría 35: concurrencia: worker antiguo no puede sobrescribir a un nuevo worker que reclamó con nuevo token", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-two-workers-race",
      appointmentId: "appt-race",
      payload: encryptedPayload,
    });

    // Simular que el worker 1 pierde el lease en la finalización porque worker 2 tomó el registro
    const { mockDb: dbWorker1, capturedClaimTokens: tokensWorker1 } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnFinalize: true, // Afecta 0 filas para worker 1
    });

    // Simular que el worker 2 tiene el lease legítimo
    const { mockDb: dbWorker2, capturedClaimTokens: tokensWorker2 } = createMockOutboxDb([sampleItem]);

    const { mockClient } = createMockResendClient({
      sendResult: { data: { id: "resend-msg-race" }, error: null },
    });

    // Worker 1 ejecuta pero su lease expiró antes de persistir
    const summary1 = await processPendingEmails({
      client: dbWorker1,
      resendClient: mockClient,
    });

    // Worker 2 ejecuta con lease vigente
    const summary2 = await processPendingEmails({
      client: dbWorker2,
      resendClient: mockClient,
    });

    // Worker 1 detectó pérdida de propiedad y no incrementó sent
    assert.equal(summary1.claimed, 1);
    assert.equal(summary1.sent, 0);
    assert.ok(summary1.details[0].error?.includes("perdió la propiedad del lease"));

    // Worker 2 finalizó exitosamente
    assert.equal(summary2.claimed, 1);
    assert.equal(summary2.sent, 1);
    assert.equal(summary2.details[0].status, "sent");

    // Los tokens reclamados por cada worker fueron completamente distintos
    assert.notEqual(tokensWorker1[0], tokensWorker2[0]);
  });

  // 36. Actualizaciones que afectan cero filas nunca incrementan contadores de éxito ni confirmación
  it("Auditoría 36: ninguna actualización que afecte cero filas incrementa contadores de éxito ni transición", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-zero-rows-metrics",
      appointmentId: "appt-zero-rows",
      payload: encryptedPayload,
    });

    // 1. Caso sent afectando 0 filas
    const { mockDb: dbSentZero } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnFinalize: true,
    });
    const { mockClient: clientSent } = createMockResendClient({
      sendResult: { data: { id: "resend-msg-ok" }, error: null },
    });
    const summarySent = await processPendingEmails({
      client: dbSentZero,
      resendClient: clientSent,
    });
    assert.equal(summarySent.sent, 0, "sent debe permanecer 0 si afectó 0 filas");

    // 2. Caso retry transitorio afectando 0 filas
    const { mockDb: dbRetryZero } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnFinalize: true,
    });
    const { mockClient: clientRetry } = createMockResendClient({
      throwError: new Error("503 Service Unavailable"),
    });
    const summaryRetry = await processPendingEmails({
      client: dbRetryZero,
      resendClient: clientRetry,
    });
    assert.equal(summaryRetry.retried, 0, "retried debe permanecer 0 si afectó 0 filas");

    // 3. Caso failure permanente afectando 0 filas
    const { mockDb: dbFailZero } = createMockOutboxDb([sampleItem], {
      simulateLostLeaseOnFinalize: true,
    });
    const { mockClient: clientFail } = createMockResendClient({
      sendResult: { data: null, error: { message: "validation_error", statusCode: 400 } },
    });
    const summaryFail = await processPendingEmails({
      client: dbFailZero,
      resendClient: clientFail,
    });
    assert.equal(summaryFail.failed, 0, "failed debe permanecer 0 si afectó 0 filas");
  });

  // 37. Asignación inicial de lease en claimPendingOutboxRows y selección de candidatos utilizan clock_timestamp()
  it("Auditoría 37: claimPendingOutboxRows selecciona candidatos y asigna lease utilizando clock_timestamp() e intervalos parametrizados", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-claim-precision",
      appointmentId: "appt-claim-precision",
      payload: encryptedPayload,
    });

    const { mockDb, capturedClaimSelectOps, capturedClaimUpdateOps } = createMockOutboxDb([sampleItem]);
    const { mockClient } = createMockResendClient({});

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
      lockTimeoutMinutes: 7,
    });

    const dialect = new PgDialect();

    // Verificación de la consulta SELECT FOR UPDATE SKIP LOCKED
    assert.ok(capturedClaimSelectOps.length > 0, "Debe registrar la consulta SELECT de candidatos");
    const selectSql = capturedClaimSelectOps[0].sql;
    assert.ok(
      selectSql.includes('"email_outbox"."next_attempt_at" <= clock_timestamp()'),
      "La selección de candidatos pendientes o abandonados debe evaluar contra clock_timestamp()"
    );

    // Verificación del UPDATE de asignación inicial del lease
    assert.ok(capturedClaimUpdateOps.length > 0, "Debe registrar el UPDATE de asignación del lease");
    const claimOp = capturedClaimUpdateOps[0];
    const nextAttemptAtQuery = dialect.sqlToQuery(claimOp.updates.nextAttemptAt as SQL);
    assert.ok(
      nextAttemptAtQuery.sql.includes("clock_timestamp() + ($1 || ' minutes')::interval"),
      "La asignación del lease debe calcular el vencimiento a partir de clock_timestamp()"
    );
    assert.ok(
      nextAttemptAtQuery.params.includes(7),
      "Debe vincular correctamente el parámetro lockTimeoutMinutes (7 minutos)"
    );
  });

  // 38. Renovación previa al envío calcula el vencimiento utilizando clock_timestamp() y parámetro acotado
  it("Auditoría 38: renovación previa al envío calcula next_attempt_at con clock_timestamp() y parámetro vinculado", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const sampleItem = createSampleOutboxItem({
      id: "outbox-renew-precision",
      appointmentId: "appt-renew-precision",
      payload: encryptedPayload,
    });

    const { mockDb, recordedUpdateOps } = createMockOutboxDb([sampleItem]);
    const { mockClient } = createMockResendClient({});

    await processPendingEmails({
      client: mockDb,
      resendClient: mockClient,
      lockTimeoutMinutes: 10,
    });

    const dialect = new PgDialect();
    const renewalOp = recordedUpdateOps.find((op) => op.isRenewal);
    assert.ok(renewalOp, "Debe haber registrado la operación de renovación");

    const renewalNextAttemptQuery = dialect.sqlToQuery(renewalOp.updates.nextAttemptAt as SQL);
    assert.ok(
      renewalNextAttemptQuery.sql.includes("clock_timestamp() + ($1 || ' minutes')::interval"),
      "La renovación del lease debe calcular el nuevo vencimiento a partir de clock_timestamp()"
    );
    assert.ok(
      renewalNextAttemptQuery.params.includes(10),
      "Debe vincular el parámetro lockTimeoutMinutes de forma acotada (10 minutos)"
    );
  });

  // 39. Reintento con backoff y finalización exitosa (sent) utilizan clock_timestamp() en asignaciones
  it("Auditoría 39: reintento con backoff y persistencia sent_at utilizan clock_timestamp() en sus asignaciones SET", async () => {
    const encryptedPayload = encryptOutboxPayload(JSON.stringify(sampleCustomerData));
    const dialect = new PgDialect();

    // 1. Caso sent_at en finalización exitosa
    const itemSent = createSampleOutboxItem({
      id: "outbox-sent-clock",
      appointmentId: "appt-sent-clock",
      payload: encryptedPayload,
    });
    const { mockDb: dbSent, recordedUpdateOps: opsSent } = createMockOutboxDb([itemSent]);
    const { mockClient: clientSent } = createMockResendClient({});
    await processPendingEmails({
      client: dbSent,
      resendClient: clientSent,
    });

    const sentOp = opsSent.find((op) => op.isFinalize && op.updates.status === "sent");
    assert.ok(sentOp, "Debe registrar operación sent");
    const sentAtQuery = dialect.sqlToQuery(sentOp.updates.sentAt as SQL);
    assert.ok(
      sentAtQuery.sql.includes("clock_timestamp()"),
      "sent_at debe registrar la hora de reloj real del despacho mediante clock_timestamp()"
    );

    // 2. Caso backoff en reintento
    const itemRetry = createSampleOutboxItem({
      id: "outbox-retry-clock",
      appointmentId: "appt-retry-clock",
      payload: encryptedPayload,
      attemptCount: 1, // segundo intento -> backoff de 5 minutos
    });
    const { mockDb: dbRetry, recordedUpdateOps: opsRetry } = createMockOutboxDb([itemRetry]);
    const { mockClient: clientRetry } = createMockResendClient({
      throwError: new Error("503 Service Unavailable"),
    });
    await processPendingEmails({
      client: dbRetry,
      resendClient: clientRetry,
    });

    const retryOp = opsRetry.find((op) => op.isFinalize && op.updates.status === "pending");
    assert.ok(retryOp, "Debe registrar operación de reintento");
    const retryNextAttemptQuery = dialect.sqlToQuery(retryOp.updates.nextAttemptAt as SQL);
    assert.ok(
      retryNextAttemptQuery.sql.includes("clock_timestamp() + ($1 || ' minutes')::interval"),
      "El cálculo del próximo intento debe partir del clock_timestamp() real del fallo"
    );
    assert.ok(
      retryNextAttemptQuery.params.includes(5),
      "Debe vincular los minutos de backoff correspondientes (5 minutos para intento 2)"
    );
  });
});
