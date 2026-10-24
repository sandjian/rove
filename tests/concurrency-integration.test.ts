import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { sql } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import type { DrizzleDb } from "../lib/db";
import { executeAtomicLeaseTransition } from "../lib/services/email-outbox/worker";

if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

const testDbUrl = process.env.TEST_DATABASE_URL;

/**
 * Espera de forma determinista a que Worker A (PID blockedPid) esté efectivamente
 * bloqueado en PostgreSQL por Worker B (PID blockingPid) sobre el registro de prueba.
 *
 * Inspecciona pg_stat_activity y pg_blocking_pids. Si no se confirma el bloqueo dentro
 * de timeoutMs, lanza un error con el diagnóstico completo de las conexiones para fallar el test.
 */
async function waitForWorkerABlockedByB(
  monitorPool: Pool,
  blockedPid: number,
  blockingPid: number,
  testId: string,
  timeoutMs = 5000
): Promise<{ pid: number; wait_event_type: string; wait_event: string; query: string }> {
  const startTime = Date.now();
  const pollIntervalMs = 25;

  while (Date.now() - startTime < timeoutMs) {
    const res = await monitorPool.query<{
      pid: number;
      wait_event_type: string | null;
      wait_event: string | null;
      query: string | null;
      is_blocked_by_b: boolean;
    }>(
      `SELECT 
         pid,
         wait_event_type,
         wait_event,
         query,
         $2 = ANY(pg_blocking_pids(pid)) AS is_blocked_by_b
       FROM pg_stat_activity 
       WHERE pid = $1`,
      [blockedPid, blockingPid]
    );

    const row = res.rows[0];
    if (
      row &&
      row.wait_event_type === "Lock" &&
      row.is_blocked_by_b &&
      row.query &&
      row.query.includes("email_outbox") &&
      row.query.toLowerCase().includes("for update")
    ) {
      // Verificar también en pg_locks que blockedPid tiene una concesión pendiente (granted = false)
      const lockRes = await monitorPool.query<{ count: string }>(
        `SELECT count(*) as count FROM pg_locks WHERE pid = $1 AND NOT granted`,
        [blockedPid]
      );
      if (Number(lockRes.rows[0]?.count || 0) > 0) {
        return {
          pid: row.pid,
          wait_event_type: row.wait_event_type,
          wait_event: row.wait_event || "unknown",
          query: row.query,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Si venció el tiempo sin confirmar el bloqueo, recopilar diagnóstico exhaustivo y fallar
  const diagRes = await monitorPool.query(
    `SELECT pid, state, wait_event_type, wait_event, query, pg_blocking_pids(pid) as blocking_pids 
     FROM pg_stat_activity 
     WHERE pid IN ($1, $2)`,
    [blockedPid, blockingPid]
  );

  throw new Error(
    `[DIAGNÓSTICO CONCURRENCIA] Fallo de sincronización: Tiempo agotado (${timeoutMs} ms) esperando que ` +
    `Worker A (PID ${blockedPid}) quede bloqueado por Worker B (PID ${blockingPid}) sobre el registro '${testId}'.\n` +
    `Estado de las sesiones en PostgreSQL:\n${JSON.stringify(diagRes.rows, null, 2)}`
  );
}

/**
 * Espera de forma determinista a que el reloj interno de PostgreSQL (clock_timestamp())
 * supere la fecha objetivo de expiración del lease.
 */
async function waitForDbClockPast(
  monitorPool: Pool,
  targetTimestamp: Date,
  timeoutMs = 5000
): Promise<void> {
  const startTime = Date.now();
  const pollIntervalMs = 25;

  while (Date.now() - startTime < timeoutMs) {
    const res = await monitorPool.query<{ has_passed: boolean }>(
      `SELECT (clock_timestamp() > $1) AS has_passed`,
      [targetTimestamp.toISOString()]
    );
    if (res.rows[0]?.has_passed) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `[DIAGNÓSTICO CONCURRENCIA] Tiempo agotado (${timeoutMs} ms) esperando que el reloj de PostgreSQL ` +
    `supere la fecha de expiración ${targetTimestamp.toISOString()}.`
  );
}

describe("Prueba de Integración de Concurrencia Real de Leases (PostgreSQL)", () => {
  if (!testDbUrl) {
    it.skip("ℹ️ OMITIDO: TEST_DATABASE_URL no está configurada.", () => {
      // Documentación del entorno requerido según Sección 3 del requerimiento:
      // 1. Base PostgreSQL dedicada de pruebas (ej. Neon branch aislada o PostgreSQL local de test).
      // 2. Tabla email_outbox creada mediante drizzle-kit migrate o migración equivalente.
      // 3. Variable TEST_DATABASE_URL definida en entorno:
      //    TEST_DATABASE_URL="postgresql://usuario:password@host:5432/test_db?sslmode=require"
    });
    return;
  }

  let poolA: Pool;
  let poolB: Pool;
  let poolMonitor: Pool;
  let dbA: DrizzleDb;
  let pidA: number;
  let pidB: number;
  let pidMonitor: number;

  before(async () => {
    // Configurar 3 pools independientes con max: 1 para garantizar conexiones persistentes y PIDs identificables
    poolA = new Pool({ connectionString: testDbUrl, max: 1 });
    poolB = new Pool({ connectionString: testDbUrl, max: 1 });
    poolMonitor = new Pool({ connectionString: testDbUrl, max: 1 });

    dbA = drizzle(poolA, { schema });

    // Obtener PIDs de backend de PostgreSQL de cada conexión
    const [resA, resB, resM] = await Promise.all([
      poolA.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"),
      poolB.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"),
      poolMonitor.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"),
    ]);

    pidA = Number(resA.rows[0].pid);
    pidB = Number(resB.rows[0].pid);
    pidMonitor = Number(resM.rows[0].pid);

    assert.notEqual(pidA, pidB, "Worker A y Worker B deben tener PIDs de PostgreSQL diferentes");
    assert.notEqual(pidA, pidMonitor, "Worker A y Monitor deben tener PIDs de PostgreSQL diferentes");
    assert.notEqual(pidB, pidMonitor, "Worker B y Monitor deben tener PIDs de PostgreSQL diferentes");
  });

  after(async () => {
    await Promise.allSettled([
      poolA?.end(),
      poolB?.end(),
      poolMonitor?.end(),
    ]);
  });

  // Escenario A — Cambio de titularidad
  // 1. El Worker B bloquea la fila.
  // 2. El Worker A inicia executeAtomicLeaseTransition y queda esperando.
  // 3. El lease original vence.
  // 4. El Worker B asigna un token nuevo y confirma la transacción.
  // 5. El Worker A se desbloquea y debe retornar false.
  // 6. La fila debe conservar el token de B y no debe registrar la transición obsoleta de A.
  it("Escenario A: Worker A en espera de bloqueo no sobrescribe a Worker B tras cambio de titularidad", async () => {
    const testId = randomUUID();
    const tokenA = "token-worker-A-" + randomUUID();
    const tokenB = "token-worker-B-" + randomUUID();

    // 1. Insertar registro de prueba con expiración en 400 ms
    await poolMonitor.query(
      `INSERT INTO email_outbox (id, appointment_id, event_type, recipient, payload, status, attempt_count, lease_token, next_attempt_at)
       VALUES ($1, $2, 'booking_confirmed', '[ENCRYPTED_IN_PAYLOAD]', '{"test":true}'::jsonb, 'processing', 1, $3, clock_timestamp() + INTERVAL '400 milliseconds')`,
      [testId, randomUUID(), tokenA]
    );

    const initRow = await poolMonitor.query<{ next_attempt_at: Date }>(
      `SELECT next_attempt_at FROM email_outbox WHERE id = $1`,
      [testId]
    );
    const originalNextAttemptAt = new Date(initRow.rows[0].next_attempt_at);

    const clientB = await poolB.connect();

    try {
      // 2. Worker B bloquea la fila en una transacción abierta
      await clientB.query("BEGIN");
      await clientB.query("SELECT id FROM email_outbox WHERE id = $1 FOR UPDATE", [testId]);

      // 3. Worker A inicia executeAtomicLeaseTransition para marcar 'sent' y entra en espera en PostgreSQL
      const workerAPromise = executeAtomicLeaseTransition(
        dbA,
        { id: testId, leaseToken: tokenA },
        {
          status: "sent",
          sentAt: sql`clock_timestamp()`,
          providerMessageId: "provider-msg-stale-A",
          payload: { sanitized: true },
          leaseToken: null,
        }
      );

      // 4. Verificación determinista: confirmar fehacientemente que Worker A (pidA) está esperando
      // el bloqueo de la fila retenida por Worker B (pidB). Falla con error si no ocurre en 5s.
      const lockStatus = await waitForWorkerABlockedByB(poolMonitor, pidA, pidB, testId, 5000);
      assert.equal(lockStatus.wait_event_type, "Lock", "Worker A debe estar en wait_event_type = 'Lock'");

      // 5. Esperar deterministamente a que el reloj de PostgreSQL supere el vencimiento del lease original
      await waitForDbClockPast(poolMonitor, originalNextAttemptAt, 5000);

      // 6. Worker B asigna legítimamente el nuevo leaseToken y confirma la transacción (COMMIT)
      await clientB.query(
        `UPDATE email_outbox 
         SET lease_token = $1, next_attempt_at = clock_timestamp() + INTERVAL '5 minutes'
         WHERE id = $2`,
        [tokenB, testId]
      );
      await clientB.query("COMMIT");

      // 7. Worker A se desbloquea tras el commit de Worker B
      const workerAResult = await workerAPromise;

      // 8. Verificaciones de seguridad
      assert.equal(
        workerAResult,
        false,
        "Worker A DEBE recibir false indicando que perdió la propiedad del lease tras el desbloqueo"
      );

      // 9. Verificar estado persistido en base de datos: pertenece íntegramente a Worker B
      const finalRes = await poolMonitor.query<{
        status: string;
        lease_token: string;
        provider_message_id: string | null;
        sent_at: Date | null;
      }>(
        `SELECT status, lease_token, provider_message_id, sent_at FROM email_outbox WHERE id = $1`,
        [testId]
      );

      const finalRow = finalRes.rows[0];
      assert.ok(finalRow, "El registro debe existir en base de datos");
      assert.equal(finalRow.status, "processing", "El estado debe permanecer 'processing' (Worker A no mutó a 'sent')");
      assert.equal(finalRow.lease_token, tokenB, "El lease_token persistido debe ser el de Worker B");
      assert.equal(finalRow.provider_message_id, null, "No debe registrarse providerMessageId de Worker A");
      assert.equal(finalRow.sent_at, null, "sent_at no debe haberse registrado");
    } finally {
      // Liberar transacción de Worker B si quedó pendiente por algún error
      await clientB.query("ROLLBACK").catch(() => {});
      clientB.release();
      // Limpieza garantizada del registro de prueba
      await poolMonitor.query("DELETE FROM email_outbox WHERE id = $1", [testId]).catch(() => {});
    }
  });

  // Escenario B — Expiración sin modificación de la fila
  // 1. El Worker B bloquea la fila sin modificarla.
  // 2. El Worker A inicia la transición y queda esperando.
  // 3. El lease vence mientras A espera.
  // 4. B libera el bloqueo mediante ROLLBACK.
  // 5. A debe detectar la expiración, retornar false y no extender el lease.
  it("Escenario B: Worker A en espera de bloqueo aborta si el lease expira sin modificación previa de la fila", async () => {
    const testId = randomUUID();
    const tokenA = "token-worker-A2-" + randomUUID();

    // 1. Insertar registro de prueba con vencimiento corto (400 ms)
    await poolMonitor.query(
      `INSERT INTO email_outbox (id, appointment_id, event_type, recipient, payload, status, attempt_count, lease_token, next_attempt_at)
       VALUES ($1, $2, 'booking_confirmed', '[ENCRYPTED_IN_PAYLOAD]', '{"test":true}'::jsonb, 'processing', 1, $3, clock_timestamp() + INTERVAL '400 milliseconds')`,
      [testId, randomUUID(), tokenA]
    );

    const initRow = await poolMonitor.query<{ next_attempt_at: Date }>(
      `SELECT next_attempt_at FROM email_outbox WHERE id = $1`,
      [testId]
    );
    const originalNextAttemptAt = new Date(initRow.rows[0].next_attempt_at);

    const clientB = await poolB.connect();

    try {
      // 2. Worker B bloquea la fila de forma exclusiva sin modificarla
      await clientB.query("BEGIN");
      await clientB.query("SELECT id FROM email_outbox WHERE id = $1 FOR UPDATE", [testId]);

      // 3. Worker A intenta renovar el lease (+10 minutos) y queda bloqueado en PostgreSQL
      const workerAPromise = executeAtomicLeaseTransition(
        dbA,
        { id: testId, leaseToken: tokenA },
        {
          nextAttemptAt: sql`clock_timestamp() + INTERVAL '10 minutes'`,
        }
      );

      // 4. Confirmación determinista de espera por bloqueo en PostgreSQL (falla si no ocurre en 5s)
      const lockStatus = await waitForWorkerABlockedByB(poolMonitor, pidA, pidB, testId, 5000);
      assert.equal(lockStatus.wait_event_type, "Lock", "Worker A debe estar bloqueado en PostgreSQL");

      // 5. Esperar deterministamente a que el reloj de PostgreSQL supere el vencimiento del lease original
      await waitForDbClockPast(poolMonitor, originalNextAttemptAt, 5000);

      // 6. Worker B libera el bloqueo SIN modificar la fila mediante ROLLBACK
      await clientB.query("ROLLBACK");

      // 7. Worker A se desbloquea tras el ROLLBACK de Worker B
      const workerAResult = await workerAPromise;

      // 8. Verificaciones de seguridad
      assert.equal(
        workerAResult,
        false,
        "Worker A DEBE abortar y retornar false porque el lease expiró mientras esperaba el bloqueo"
      );

      // 9. Verificar estado persistido en base de datos: el lease NO fue extendido a +10 minutos y permanece vencido
      const finalRes = await poolMonitor.query<{
        status: string;
        lease_token: string;
        next_attempt_at: Date;
      }>(
        `SELECT status, lease_token, next_attempt_at FROM email_outbox WHERE id = $1`,
        [testId]
      );

      const finalRow = finalRes.rows[0];
      assert.ok(finalRow, "El registro debe existir en base de datos");
      assert.equal(finalRow.status, "processing", "El estado debe permanecer 'processing'");
      assert.equal(finalRow.lease_token, tokenA, "El lease_token original no debe haber sido alterado");

      // Comprobar con el reloj real de PostgreSQL que next_attempt_at sigue en el pasado
      const clockRes = await poolMonitor.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      const dbNow = new Date(clockRes.rows[0].now).getTime();
      const persistedNextAttempt = new Date(finalRow.next_attempt_at).getTime();

      assert.ok(
        persistedNextAttempt <= dbNow,
        `next_attempt_at (${persistedNextAttempt}) debe ser menor o igual a dbNow (${dbNow}) y no haber sido extendido a +10 min`
      );
    } finally {
      await clientB.query("ROLLBACK").catch(() => {});
      clientB.release();
      await poolMonitor.query("DELETE FROM email_outbox WHERE id = $1", [testId]).catch(() => {});
    }
  });
});
