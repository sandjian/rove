import { eq, and, or, lte, gte, asc, inArray, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db, type DrizzleDb } from "../../db";
import { emailOutbox, type EmailOutboxItem } from "../../db/schema";
import { decryptOutboxPayload } from "../../security";
import type { EncryptedPayload } from "../../security/types";
import type {
  ProcessPendingEmailsOptions,
  ProcessPendingEmailsSummary,
  ProcessedEmailDetail,
  ResendClientInterface,
  SendEmailResult,
  CustomerBookingPayload,
  BarberBookingPayload,
} from "./types";
import {
  renderCustomerConfirmationEmail,
  renderBarberNotificationEmail,
} from "./templates";

/**
 * Intervalos de espera progresiva (backoff exponencial) en minutos.
 */
export function calculateBackoffMinutes(attemptCount: number): number {
  switch (attemptCount) {
    case 1:
      return 1; // 1 minuto
    case 2:
      return 5; // 5 minutos
    case 3:
      return 15; // 15 minutos
    case 4:
      return 60; // 1 hora
    default:
      return 120; // 2 horas
  }
}

/**
 * Sanitiza los mensajes de error para no exponer tokens, claves ni URLs con credenciales en logs o en la base de datos.
 */
export function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== "string") {
    return "Error desconocido en el proveedor de correo.";
  }

  return rawMessage
    .replace(/re_[a-zA-Z0-9_]+/g, "[REDACTED_API_KEY]")
    .replace(/[0-9a-fA-F]{64}/g, "[REDACTED_TOKEN]")
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[REDACTED_DB_URL]")
    .slice(0, 500);
}

/**
 * Clasifica si un error devuelto por Resend o por el sistema es definitivo (no recuperable)
 * o transitorio (recuperable mediante reintento).
 */
export function isPermanentError(error: { message?: string; statusCode?: number; name?: string } | unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { message?: string; statusCode?: number; name?: string };

  // Errores HTTP permanentes típicos (400 Bad Request, 422 Unprocessable, 401/403 Auth)
  if (err.statusCode && [400, 401, 403, 422].includes(err.statusCode)) {
    return true;
  }

  const msg = (err.message || "").toLowerCase();

  // Errores de validación de Resend o datos irreparables
  if (
    msg.includes("validation_error") ||
    msg.includes("invalid_email") ||
    msg.includes("missing required") ||
    msg.includes("domain is not verified") ||
    msg.includes("descifrado fallido") ||
    msg.includes("payload corrupto") ||
    msg.includes("payload inválido")
  ) {
    return true;
  }

  return false;
}

/**
 * Descifra e interpreta el payload almacenado en email_outbox.
 * Admite tanto el formato nuevo de payload íntegramente cifrado como el formato con encryptedToken.
 */
export function parseAndDecryptOutboxPayload(
  rawPayload: unknown
): CustomerBookingPayload | BarberBookingPayload {
  if (!rawPayload || typeof rawPayload !== "object") {
    throw new Error("Payload inválido o ausente en el registro de outbox.");
  }

  const payloadObj = rawPayload as Record<string, unknown>;

  // Caso 1: Payload completamente cifrado ({ iv, tag, ciphertext })
  if (
    typeof payloadObj.iv === "string" &&
    typeof payloadObj.tag === "string" &&
    typeof payloadObj.ciphertext === "string"
  ) {
    try {
      const decryptedJson = decryptOutboxPayload(payloadObj as unknown as EncryptedPayload);
      const parsed = JSON.parse(decryptedJson) as Record<string, unknown>;

      if (!parsed.customerName || !parsed.customerEmail || !parsed.serviceName || !parsed.startAt) {
        throw new Error("Payload descifrado incompleto: faltan campos obligatorios.");
      }

      return parsed as unknown as CustomerBookingPayload | BarberBookingPayload;
    } catch (decryptErr) {
      const msg = decryptErr instanceof Error ? decryptErr.message : "Error criptográfico";
      throw new Error(`Descifrado fallido de payload de outbox: ${msg}`);
    }
  }

  // Caso 2: Formato heredado con encryptedToken ({ customerName, ..., encryptedToken: { iv, tag, ciphertext } })
  if (payloadObj.encryptedToken && typeof payloadObj.encryptedToken === "object") {
    try {
      const tokenDecrypted = decryptOutboxPayload(payloadObj.encryptedToken as EncryptedPayload);
      return {
        ...payloadObj,
        cancellationToken: tokenDecrypted,
      } as unknown as CustomerBookingPayload;
    } catch (decryptErr) {
      const msg = decryptErr instanceof Error ? decryptErr.message : "Error criptográfico";
      throw new Error(`Descifrado fallido del token de outbox: ${msg}`);
    }
  }

  // Caso 3: Notificación de barbero en formato no cifrado
  if (payloadObj.customerName && payloadObj.serviceName && payloadObj.startAt) {
    return payloadObj as unknown as BarberBookingPayload;
  }

  throw new Error("Formato de payload no reconocido o no soportado.");
}

/**
 * Reclama de forma atómica un lote de notificaciones listas para ser despachadas
 * utilizando SELECT ... FOR UPDATE SKIP LOCKED.
 *
 * Evita que dos workers concurrentes procesen la misma notificación y previene
 * bloqueos de larga duración cerrando la transacción inmediatamente tras reclamar.
 */
export async function claimPendingOutboxRows(
  client: DrizzleDb,
  batchSize: number,
  lockTimeoutMinutes: number
): Promise<EmailOutboxItem[]> {
  return await client.transaction(async (tx) => {
    // 1. Seleccionar filas candidatas (pendientes vencidas o procesamientos abandonados)
    const candidates = await tx
      .select()
      .from(emailOutbox)
      .where(
        or(
          and(eq(emailOutbox.status, "pending"), lte(emailOutbox.nextAttemptAt, sql`NOW()`)),
          and(eq(emailOutbox.status, "processing"), lte(emailOutbox.nextAttemptAt, sql`NOW()`))
        )
      )
      .orderBy(asc(emailOutbox.nextAttemptAt))
      .limit(batchSize)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) {
      return [];
    }

    const candidateIds = candidates.map((row) => row.id);

    // 2. Marcar como 'processing' y extender nextAttemptAt como lease temporal contra caídas
    await tx
      .update(emailOutbox)
      .set({
        status: "processing",
        nextAttemptAt: sql`NOW() + (${lockTimeoutMinutes} || ' minutes')::interval`,
      })
      .where(inArray(emailOutbox.id, candidateIds));

    return candidates;
  });
}

/**
 * Procesa las notificaciones pendientes de email_outbox y las despacha vía Resend.
 *
 * Garantías:
 * - Concurrencia segura: FOR UPDATE SKIP LOCKED impide reclamos duplicados.
 * - Desacoplamiento de red: las llamadas a Resend se realizan fuera de la transacción de BD.
 * - Idempotencia: envía el UUID de outbox como Idempotency-Key a Resend.
 * - Seguridad en reposo: descifra los datos sensibles únicamente en memoria.
 * - Sanitización post-envío: purga el payload confidencial tras la confirmación de entrega.
 *
 * @param options - Opciones de configuración y dependencias inyectables.
 * @returns Resumen estructurado sin información sensible.
 */
export async function processPendingEmails(
  options: ProcessPendingEmailsOptions = {}
): Promise<ProcessPendingEmailsSummary> {
  const {
    batchSize = 10,
    maxAttempts = 5,
    lockTimeoutMinutes = 5,
    requestTimeoutMs = 15000,
    client = db,
    resendClient,
    baseUrl = process.env.BOOKING_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    fromEmail = process.env.RESEND_FROM_EMAIL || "Rove Barbería <reservas@rovebarberia.com>",
  } = options;

  const summary: ProcessPendingEmailsSummary = {
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    details: [],
  };

  // 1. Reclamar lote de notificaciones de forma segura mediante SELECT ... FOR UPDATE SKIP LOCKED
  const claimedRows = await claimPendingOutboxRows(client, batchSize, lockTimeoutMinutes);
  summary.claimed = claimedRows.length;

  if (claimedRows.length === 0) {
    return summary;
  }

  // 2. Inicializar cliente Resend si no fue inyectado
  let resolvedResend: ResendClientInterface | null = resendClient ?? null;
  if (!resolvedResend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      // Si no hay API Key configurada, marcar error de infraestructura y suspender
      const errMessage = "RESEND_API_KEY no está configurada en las variables de entorno.";
      for (const row of claimedRows) {
        await client
          .update(emailOutbox)
          .set({
            status: "pending",
            nextAttemptAt: sql`NOW() + INTERVAL '1 minute'`,
            lastError: errMessage,
          })
          .where(and(eq(emailOutbox.id, row.id), eq(emailOutbox.status, "processing")));

        summary.retried++;
        summary.details.push({
          id: row.id,
          eventType: row.eventType,
          recipient: row.recipient,
          status: "retried",
          error: errMessage,
        });
      }
      return summary;
    }

    resolvedResend = new Resend(apiKey.trim()) as unknown as ResendClientInterface;
  }

  // 3. Procesar individualmente cada notificación reclamada
  for (const row of claimedRows) {
    const detail: ProcessedEmailDetail = {
      id: row.id,
      eventType: row.eventType,
      recipient: row.recipient,
      status: "failed",
    };

    try {
      // 3.0 Verificar y renovar el lease para este registro antes del despacho de red.
      // Si el lease expiró mientras se procesaban filas previas del lote y otro worker lo tomó,
      // evitamos enviar un correo concurrente redundante.
      await client
        .update(emailOutbox)
        .set({
          nextAttemptAt: sql`NOW() + (${lockTimeoutMinutes} || ' minutes')::interval`,
        })
        .where(
          and(
            eq(emailOutbox.id, row.id),
            eq(emailOutbox.status, "processing"),
            gte(emailOutbox.nextAttemptAt, sql`NOW()`)
          )
        );

      // 3.1 Descifrar payload en memoria
      let payloadData: CustomerBookingPayload | BarberBookingPayload;
      try {
        payloadData = parseAndDecryptOutboxPayload(row.payload);
      } catch (parseErr) {
        const errorMsg = sanitizeErrorMessage(
          parseErr instanceof Error ? parseErr.message : "Error al descifrar payload"
        );

        // Fallo no recuperable: marcar terminal 'failed'
        await client
          .update(emailOutbox)
          .set({
            status: "failed",
            attemptCount: row.attemptCount + 1,
            lastError: errorMsg,
          })
          .where(and(eq(emailOutbox.id, row.id), eq(emailOutbox.status, "processing")));

        summary.failed++;
        detail.status = "failed";
        detail.error = errorMsg;
        detail.terminal = true;
        summary.details.push(detail);
        continue;
      }

      // 3.2 Construir contenido de correo según tipo de evento
      let emailContent: { subject: string; html: string; text: string };

      let isCustomerNotification = false;
      if (row.eventType === "booking_confirmed") {
        if ("cancellationToken" in payloadData && payloadData.cancellationToken) {
          isCustomerNotification = true;
          // Confirmación al cliente
          emailContent = renderCustomerConfirmationEmail({
            payload: payloadData,
            baseUrl,
          });
        } else {
          // Aviso operativo al barbero (sin enlace de cancelación)
          isCustomerNotification = false;
          emailContent = renderBarberNotificationEmail({
            payload: payloadData as BarberBookingPayload,
          });
        }
      } else {
        throw new Error(`Tipo de evento no soportado para envío: '${row.eventType}'.`);
      }

      // Resolver destinatario según el tipo de notificación
      const targetRecipient = isCustomerNotification
        ? ("recipientEmail" in payloadData && (payloadData as Record<string, unknown>).recipientEmail
            ? String((payloadData as Record<string, unknown>).recipientEmail)
            : "customerEmail" in payloadData && payloadData.customerEmail
            ? String(payloadData.customerEmail)
            : row.recipient)
        : ("recipientEmail" in payloadData && (payloadData as Record<string, unknown>).recipientEmail
            ? String((payloadData as Record<string, unknown>).recipientEmail)
            : row.recipient);

      // 3.3 Enviar a través de Resend con clave de idempotencia y timeout de red acotado.
      // La clave de idempotencia es SIEMPRE el UUID inmutable de la fila (row.id) en todos los reintentos.
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), requestTimeoutMs);

      let sendResult: SendEmailResult;
      try {
        sendResult = await resolvedResend.emails.send(
          {
            from: fromEmail,
            to: targetRecipient,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          },
          {
            idempotencyKey: row.id, // Preservada inmutable en todos los intentos
            signal: abortController.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      // 3.4 Confirmación de aceptación por parte del proveedor (Resend).
      // NOTA SEMÁNTICA: El estado 'sent' representa que Resend aceptó el mensaje y asignó un providerMessageId.
      // No garantiza la entrega efectiva en la bandeja de entrada del destinatario (lo cual requeriría webhooks de Resend).
      if (sendResult.error) {
        throw sendResult.error;
      }

      const providerMessageId = sendResult.data?.id;
      if (!providerMessageId) {
        throw new Error("Resend no devolvió un identificador de mensaje válido.");
      }

      // 3.5 Éxito confirmado: actualizar outbox con verificación de estado y sanitizar payload y recipient
      await client
        .update(emailOutbox)
        .set({
          status: "sent",
          sentAt: sql`NOW()`,
          providerMessageId,
          lastError: null,
          recipient: "[REDACTED]",
          payload: { sanitized: true, sentAt: new Date().toISOString() },
        })
        .where(
          and(
            eq(emailOutbox.id, row.id),
            eq(emailOutbox.status, "processing")
          )
        );

      summary.sent++;
      detail.status = "sent";
      detail.providerMessageId = providerMessageId;
    } catch (sendError) {
      const errorMsg = sanitizeErrorMessage(
        sendError instanceof Error ? sendError.message : String(sendError)
      );
      const isPermanent = isPermanentError(sendError);
      const newAttemptCount = row.attemptCount + 1;

      if (isPermanent || newAttemptCount >= maxAttempts) {
        // Estado terminal: 'failed'
        await client
          .update(emailOutbox)
          .set({
            status: "failed",
            attemptCount: newAttemptCount,
            lastError: errorMsg,
          })
          .where(
            and(
              eq(emailOutbox.id, row.id),
              eq(emailOutbox.status, "processing")
            )
          );

        summary.failed++;
        detail.status = "failed";
        detail.error = errorMsg;
        detail.terminal = true;
      } else {
        // Estado transitorio: reprogramar con espera progresiva
        // NOTA: El payload y recipient NO se sanitizan aquí para permitir el reintento futuro.
        const backoffMinutes = calculateBackoffMinutes(newAttemptCount);
        await client
          .update(emailOutbox)
          .set({
            status: "pending",
            attemptCount: newAttemptCount,
            nextAttemptAt: sql`NOW() + (${backoffMinutes} || ' minutes')::interval`,
            lastError: errorMsg,
          })
          .where(
            and(
              eq(emailOutbox.id, row.id),
              eq(emailOutbox.status, "processing")
            )
          );

        summary.retried++;
        detail.status = "retried";
        detail.error = errorMsg;
      }
    }

    summary.details.push(detail);
  }

  return summary;
}
