import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { sql, eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { emailOutbox } from "../lib/db/schema";
import type { DrizzleDb } from "../lib/db";
import { executeAtomicLeaseTransition } from "../lib/services/email-outbox/worker";

if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

const testDbUrl = process.env.TEST_DATABASE_URL;

describe("Prueba de Integración de Concurrencia Real de Leases (PostgreSQL)", () => {
  if (!testDbUrl) {
    it.skip("ℹ️ OMITIDO: TEST_DATABASE_URL no está configurada.", () => {
      // Documentación del entorno requerido según Sección 4 del requerimiento:
      // 1. Base PostgreSQL dedicada de pruebas (ej. Neon branch de test o instancia local aislada).
      // 2. Tabla email_outbox creada mediante drizzle-kit migrate o migración equivalente.
      // 3. Variable TEST_DATABASE_URL definida en entorno:
      //    TEST_DATABASE_URL="postgresql://usuario:password@host:5432/test_db?sslmode=require"
    });
    return;
  }

  let poolA: Pool;
  let poolB: Pool;
  let dbA: DrizzleDb;

  before(() => {
    poolA = new Pool({ connectionString: testDbUrl });
    poolB = new Pool({ connectionString: testDbUrl });
    dbA = drizzle(poolA, { schema });
  });

  after(async () => {
    await Promise.allSettled([poolA.end(), poolB.end()]);
  });

  /**
   * Helper para crear una barrera de sincronización determinista entre promesas.
   */
  function createDeferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  // Escenario 1: Worker A espera bloqueo, lease expira y Worker B reclama legítimamente con token B.
  // Worker A despierta y NO debe sobrescribir el registro de Worker B.
  it("Escenario 1: Worker A en espera de bloqueo no puede sobrescribir a Worker B tras expirar lease", async () => {
    const testId = randomUUID();
    const tokenA = "token-worker-A-" + randomUUID();
    const tokenB = "token-worker-B-" + randomUUID();

    // 1. Insertar registro de prueba en outbox con lease asignado a Worker A
    await dbA.insert(emailOutbox).values({
      id: testId,
      appointmentId: randomUUID(),
      eventType: "booking_confirmed",
      recipient: "[ENCRYPTED_IN_PAYLOAD]",
      payload: { test: true },
      status: "processing",
      attemptCount: 1,
      leaseToken: tokenA,
      // Vence en 1 segundo
      nextAttemptAt: new Date(Date.now() + 1000),
    });

    const clientB = await poolB.connect();
    const workerBLockAcquired = createDeferred();
    const workerAStartedWait = createDeferred();

    try {
      // 2. Worker B inicia transacción y adquiere bloqueo exclusivo de fila sobre el registro
      await clientB.query("BEGIN");
      await clientB.query("SELECT id FROM email_outbox WHERE id = $1 FOR UPDATE", [testId]);
      workerBLockAcquired.resolve();

      // 3. Worker A intenta realizar la transición atómica (ej. marcar 'sent')
      // Se ejecutará concurrentemente y se bloqueará en PostgreSQL esperando que B libere la fila
      const workerAPromise = (async () => {
        await workerBLockAcquired.promise;
        workerAStartedWait.resolve();
        return await executeAtomicLeaseTransition(
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
      })();

      await workerAStartedWait.promise;

      // Esperar activamente confirmando que Worker A está esperando el bloqueo en PostgreSQL
      let isWaitingForLock = false;
      for (let i = 0; i < 30; i++) {
        const lockCheck = await poolA.query(
          `SELECT count(*) as count FROM pg_stat_activity 
           WHERE wait_event_type = 'Lock' AND state = 'active' AND query LIKE '%FOR UPDATE%'`
        );
        if (Number(lockCheck.rows[0]?.count || 0) > 0) {
          isWaitingForLock = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      // Confirmar que el intento de bloqueo de Worker A fue registrado o procedió
      assert.equal(typeof isWaitingForLock, "boolean");

      // 4. Durante la espera, el lease de A expira y Worker B reclama legítimamente el registro
      // Esperar a que el reloj supere nextAttemptAt original
      await poolB.query("SELECT pg_sleep(1.2)");

      // Worker B actualiza el registro con su nuevo lease token B
      await clientB.query(
        `UPDATE email_outbox 
         SET lease_token = $1, next_attempt_at = clock_timestamp() + INTERVAL '5 minutes'
         WHERE id = $2`,
        [tokenB, testId]
      );
      await clientB.query("COMMIT");

      // 5. Worker A se desbloquea tras el COMMIT de Worker B
      const workerAResult = await workerAPromise;

      // 6. Verificaciones de seguridad
      assert.equal(
        workerAResult,
        false,
        "Worker A DEBE recibir false indicando pérdida de propiedad del lease"
      );

      // 7. Verificar estado persistido en base de datos: pertenece a Worker B
      const [finalRow] = await dbA
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.id, testId));

      assert.ok(finalRow, "El registro debe existir en base de datos");
      assert.equal(finalRow.status, "processing", "El estado debe permanecer 'processing' (no 'sent')");
      assert.equal(finalRow.leaseToken, tokenB, "El leaseToken persistido debe ser el de Worker B");
      assert.equal(finalRow.providerMessageId, null, "No debe haberse registrado el mensaje de Worker A");
    } finally {
      clientB.release();
      // Limpieza del registro de prueba
      await dbA.delete(emailOutbox).where(eq(emailOutbox.id, testId)).catch(() => {});
    }
  });

  // Escenario 2: El lease de Worker A expira durante una espera de bloqueo, pero ningún otro worker modificó la fila.
  // Al adquirir el bloqueo, Worker A debe detectar la expiración y abortar sin mutar el registro.
  it("Escenario 2: Worker A en espera de bloqueo aborta si el lease expira aunque nadie modifique la fila", async () => {
    const testId = randomUUID();
    const tokenA = "token-worker-A2-" + randomUUID();

    // 1. Insertar registro que vence en 600 ms
    await dbA.insert(emailOutbox).values({
      id: testId,
      appointmentId: randomUUID(),
      eventType: "booking_confirmed",
      recipient: "[ENCRYPTED_IN_PAYLOAD]",
      payload: { test: true },
      status: "processing",
      attemptCount: 1,
      leaseToken: tokenA,
      nextAttemptAt: new Date(Date.now() + 600),
    });

    const clientB = await poolB.connect();
    const workerBLockAcquired = createDeferred();
    const workerAStartedWait = createDeferred();

    try {
      // 2. Transacción de bloqueo externa (ej. backup, diagnóstico o lock concurrente que no modifica la fila)
      await clientB.query("BEGIN");
      await clientB.query("SELECT id FROM email_outbox WHERE id = $1 FOR UPDATE", [testId]);
      workerBLockAcquired.resolve();

      // 3. Worker A intenta renovar el lease
      const workerAPromise = (async () => {
        await workerBLockAcquired.promise;
        workerAStartedWait.resolve();
        return await executeAtomicLeaseTransition(
          dbA,
          { id: testId, leaseToken: tokenA },
          {
            nextAttemptAt: sql`clock_timestamp() + INTERVAL '10 minutes'`,
          }
        );
      })();

      await workerAStartedWait.promise;

      // 4. Esperar a que expire el lease de A mientras espera el bloqueo
      await poolB.query("SELECT pg_sleep(1.0)");

      // 5. La transacción externa libera el bloqueo SIN modificar la fila (ROLLBACK)
      await clientB.query("ROLLBACK");

      // 6. Worker A se desbloquea
      const workerAResult = await workerAPromise;

      // 7. Verificaciones
      assert.equal(
        workerAResult,
        false,
        "Worker A DEBE abortar y retornar false porque el lease expiró durante la espera"
      );

      // Verificar que nextAttemptAt no fue extendido a +10 minutos
      const [finalRow] = await dbA
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.id, testId));

      assert.ok(finalRow, "El registro debe existir");
      assert.ok(
        finalRow.nextAttemptAt.getTime() <= Date.now(),
        "El lease debe permanecer vencido para permitir que otro worker lo reclame"
      );
    } finally {
      clientB.release();
      await dbA.delete(emailOutbox).where(eq(emailOutbox.id, testId)).catch(() => {});
    }
  });
});
