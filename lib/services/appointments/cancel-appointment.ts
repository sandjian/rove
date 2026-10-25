import { eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { appointments, emailOutbox, type Appointment } from "../../db/schema";
import { hashCancellationToken, encryptOutboxPayload } from "../../security";
import type { DrizzleDb } from "../../db";

export interface CancelAppointmentResult {
  success: boolean;
  appointment?: Appointment;
  alreadyCancelled?: boolean;
  error?: string;
}

/**
 * Consulta los datos públicos de una cita mediante su token de cancelación.
 */
export async function getAppointmentByCancellationToken(
  rawToken: string,
  client: DrizzleDb = db
): Promise<Appointment | null> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length !== 64) {
    return null;
  }

  const tokenHash = hashCancellationToken(rawToken.trim());
  const [appointment] = await client
    .select()
    .from(appointments)
    .where(eq(appointments.cancellationTokenHash, tokenHash))
    .limit(1);

  return appointment ?? null;
}

/**
 * Cancela de forma atómica una reserva utilizando su token criptográfico en texto claro.
 *
 * 1. Verifica la existencia de la cita mediante el hash SHA-256 del token.
 * 2. Si ya está cancelada, informa el estado sin error.
 * 3. Actualiza el estado a 'cancelled' y registra la fecha de cancelación.
 * 4. Encola una notificación transaccional en email_outbox para alertar al barbero y al cliente.
 */
export async function cancelAppointmentByToken(
  rawToken: string,
  client: DrizzleDb = db
): Promise<CancelAppointmentResult> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length !== 64) {
    return { success: false, error: "El enlace o token de cancelación no es válido." };
  }

  const tokenHash = hashCancellationToken(rawToken.trim());

  try {
    return await client.transaction(async (tx) => {
      const [appointment] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.cancellationTokenHash, tokenHash))
        .for("update");

      if (!appointment) {
        return {
          success: false,
          error: "No se encontró ninguna reserva asociada a este enlace de cancelación.",
        };
      }

      if (appointment.status === "cancelled") {
        return {
          success: true,
          alreadyCancelled: true,
          appointment,
        };
      }

      const [updated] = await tx
        .update(appointments)
        .set({
          status: "cancelled",
          cancelledAt: sql`clock_timestamp()`,
        })
        .where(eq(appointments.id, appointment.id))
        .returning();

      // Encolar notificación en email_outbox
      const notificationData = {
        customerName: appointment.customerName,
        customerEmail: appointment.customerEmail,
        customerPhone: appointment.customerPhone,
        serviceName: appointment.serviceNameSnapshot,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        recipientEmail: appointment.customerEmail,
      };

      const encryptedPayload = encryptOutboxPayload(
        JSON.stringify(notificationData)
      );

      await tx.insert(emailOutbox).values({
        appointmentId: appointment.id,
        eventType: "customer_cancellation",
        recipient: "[ENCRYPTED_IN_PAYLOAD]",
        payload: encryptedPayload,
        status: "pending",
      });

      return {
        success: true,
        alreadyCancelled: false,
        appointment: updated,
      };
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error inesperado";
    return {
      success: false,
      error: `Error al procesar la cancelación en el sistema: ${msg}`,
    };
  }
}
