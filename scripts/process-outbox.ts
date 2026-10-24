import { existsSync } from "node:fs";
import { processPendingEmails } from "../lib/services/email-outbox";

// Carga automática de variables locales si existen (Node 20+)
if (existsSync(".env.local")) {
  try {
    process.loadEnvFile?.(".env.local");
  } catch {
    // Si falla la carga automática, continúa con las variables del entorno
  }
} else if (existsSync(".env")) {
  try {
    process.loadEnvFile?.(".env");
  } catch {
    // Ignorar si no existe
  }
}

/**
 * Script ejecutor CLI para el procesamiento controlado de notificaciones pendientes en la outbox.
 *
 * Uso:
 * npm run outbox:process
 */
async function main() {
  console.log("[Worker] Iniciando procesamiento de notificaciones pendientes...");

  try {
    const summary = await processPendingEmails({
      batchSize: 20,
      maxAttempts: 5,
    });

    console.log("[Worker] Lote finalizado:");
    console.log(`  - Reclamados:   ${summary.claimed}`);
    console.log(`  - Enviados:     ${summary.sent}`);
    console.log(`  - Reintentados: ${summary.retried}`);
    console.log(`  - Fallidos:     ${summary.failed}`);

    if (summary.details.length > 0) {
      for (const d of summary.details) {
        if (d.status === "sent") {
          console.log(`    [✓] ID: ${d.id} | Tipo: ${d.eventType} | MsgID: ${d.providerMessageId}`);
        } else if (d.status === "retried") {
          console.log(`    [↻] ID: ${d.id} | Reintento programado | Error: ${d.error}`);
        } else {
          console.log(`    [✗] ID: ${d.id} | Fallo terminal | Error: ${d.error}`);
        }
      }
    }

    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Error crítico de ejecución: ${msg}`);
    process.exit(1);
  }
}

main();
