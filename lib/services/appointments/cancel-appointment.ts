import { after } from "next/server";
import { Resend } from "resend";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { appointments, type Appointment } from "../../db/schema";
import { hashCancellationToken } from "../../security";
import { renderCustomerCancellationEmail } from "../email-outbox/templates";
import type { ResendClientInterface } from "../email-outbox/types";
import type { DrizzleDb } from "../../db";

export interface CancelAppointmentResult {
  success: boolean;
  appointment?: Appointment;
  alreadyCancelled?: boolean;
  error?: string;
}

function runInBackground(task: () => Promise<void>): void {
  try {
    after(async () => {
      try {
        await task();
      } catch (error) {
        console.error(
          "[cancelAppointmentByToken] Error despachando correo en after():",
          error instanceof Error ? error.message : error
        );
      }
    });
  } catch {
    void task().catch((error) => {
      console.error(
        "[cancelAppointmentByToken] Error despachando correo en segundo plano:",
        error instanceof Error ? error.message : error
      );
    });
  }
}

async function dispatchCustomerCancellationEmail(
  appointment: Appointment,
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

  const emailContent = renderCustomerCancellationEmail({
    payload: {
      customerName: appointment.customerName,
      serviceName: appointment.serviceNameSnapshot,
      startAt: appointment.startAt.toISOString(),
    },
    baseUrl,
  });

  const res = await resend.emails.send(
    {
      from: fromEmail,
      to: appointment.customerEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    },
    {
      idempotencyKey: `cancel-customer-${appointment.id}`,
    }
  );

  if (res.error) {
    console.error(
      `[cancelAppointmentByToken] Error de Resend al enviar cancelación (${appointment.id}):`,
      res.error.message
    );
  }
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
 * 4. Despacha la notificación de cancelación directamente vía Resend en segundo plano con `after()`.
 */
export async function cancelAppointmentByToken(
  rawToken: string,
  client: DrizzleDb = db,
  resendClient?: ResendClientInterface
): Promise<CancelAppointmentResult> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length !== 64) {
    return { success: false, error: "El enlace o token de cancelación no es válido." };
  }

  const tokenHash = hashCancellationToken(rawToken.trim());

  try {
    const result = await client.transaction(async (tx) => {
      const [appointment] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.cancellationTokenHash, tokenHash))
        .for("update");

      if (!appointment) {
        return {
          success: false,
          error: "No se encontró ninguna reserva asociada a este enlace de cancelación.",
        } satisfies CancelAppointmentResult;
      }

      if (appointment.status === "cancelled") {
        return {
          success: true,
          alreadyCancelled: true,
          appointment,
        } satisfies CancelAppointmentResult;
      }

      const [updated] = await tx
        .update(appointments)
        .set({
          status: "cancelled",
          cancelledAt: sql`clock_timestamp()`,
        })
        .where(eq(appointments.id, appointment.id))
        .returning();

      return {
        success: true,
        alreadyCancelled: false,
        appointment: updated,
      } satisfies CancelAppointmentResult;
    });

    if (result.success && !result.alreadyCancelled && result.appointment) {
      const cancelledAppointment = result.appointment;
      runInBackground(() =>
        dispatchCustomerCancellationEmail(cancelledAppointment, resendClient)
      );
    }

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error inesperado";
    return {
      success: false,
      error: `Error al procesar la cancelación en el sistema: ${msg}`,
    };
  }
}
