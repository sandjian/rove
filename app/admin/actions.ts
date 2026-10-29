"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, availabilityWindows, services } from "@/lib/db/schema";
import { getAdminSession, setAdminSessionCookie, clearAdminSessionCookie } from "@/lib/security/admin-auth";
import { renderAdminCancellationEmail } from "@/lib/services/email-outbox/templates";

export interface AdminAppointmentDto {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  durationMinutes: number;
  priceAmount: number;
  currency: string;
  status: "confirmed" | "cancelled" | "completed";
  startAt: string;
  endAt: string;
  createdAt: string;
  formattedTime: string;
  formattedDate: string;
}

export interface AdminAvailabilityWindowDto {
  id: string;
  startAt: string;
  endAt: string;
  isBlocked: boolean;
  reason: string | null;
  formattedTime: string;
  formattedDate: string;
}

/**
 * Autenticación de Administrador / Barbero.
 * En desarrollo/producción permite login seguro o fallback de bootstrap.
 */
export async function loginAdminAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "").trim();

    if (!email || !password) {
      return { success: false, error: "Ingresá email y contraseña." };
    }

    // Por seguridad, verificamos contra tabla o clave de admin definida en env
    const expectedPassword = process.env.ADMIN_DEFAULT_PASSWORD || "rove2026";
    const expectedEmail = (process.env.ADMIN_DEFAULT_EMAIL || "admin@rove.com").toLowerCase();

    // Verificación
    if (email !== expectedEmail || password !== expectedPassword) {
      return { success: false, error: "Credenciales de administrador incorrectas." };
    }

    await setAdminSessionCookie({
      userId: "admin-master",
      email,
      createdAt: Date.now(),
    });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error inesperado";
    return { success: false, error: msg };
  }
}

export async function logoutAdminAction() {
  await clearAdminSessionCookie();
}

/**
 * Consulta todas las citas para el panel administrativo, con filtro opcional de fecha o estado.
 */
export async function getAdminAppointmentsAction(dateFilterIso?: string): Promise<{
  success: boolean;
  appointments: AdminAppointmentDto[];
  error?: string;
}> {
  const session = await getAdminSession();
  if (!session) {
    return { success: false, appointments: [], error: "No autorizado." };
  }

  try {
    let whereCondition = undefined;

    if (dateFilterIso) {
      const selected = new Date(dateFilterIso);
      const startOfDay = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 0, 0, 0);
      const endOfDay = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 23, 59, 59, 999);

      whereCondition = and(
        gte(appointments.startAt, startOfDay),
        lte(appointments.startAt, endOfDay)
      );
    }

    const rows = await db
      .select()
      .from(appointments)
      .where(whereCondition)
      .orderBy(desc(appointments.startAt))
      .limit(100);

    const timeFmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const dateFmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    const list: AdminAppointmentDto[] = rows.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      customerEmail: r.customerEmail,
      customerPhone: r.customerPhone,
      serviceName: r.serviceNameSnapshot,
      durationMinutes: r.serviceDurationSnapshot,
      priceAmount: r.servicePriceSnapshot,
      currency: r.currency,
      status: r.status as "confirmed" | "cancelled" | "completed",
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      formattedTime: timeFmt.format(r.startAt),
      formattedDate: dateFmt.format(r.startAt),
    }));

    return { success: true, appointments: list };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al consultar citas";
    return { success: false, appointments: [], error: msg };
  }
}

/**
 * Marca una cita como 'completed'.
 */
export async function completeAppointmentAdminAction(appointmentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getAdminSession();
  if (!session) return { success: false, error: "No autorizado." };

  try {
    await db
      .update(appointments)
      .set({
        status: "completed",
        updatedAt: sql`clock_timestamp()`,
      })
      .where(eq(appointments.id, appointmentId));

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al actualizar cita";
    return { success: false, error: msg };
  }
}

/**
 * Cancela una cita desde el panel administrativo y despacha la notificación al cliente
 * en segundo plano mediante `after()` de Next.js 16.
 */
export async function cancelAppointmentAdminAction(
  appointmentId: string,
  reason: string = "Cancelación por el profesional"
): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession();
  if (!session) return { success: false, error: "No autorizado." };

  try {
    const cancelledAppt = await db.transaction(async (tx) => {
      const [appt] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .for("update");

      if (!appt) {
        throw new Error("No se encontró la reserva indicada.");
      }

      if (appt.status === "cancelled") {
        return null;
      }

      const [updated] = await tx
        .update(appointments)
        .set({
          status: "cancelled",
          cancelledAt: sql`clock_timestamp()`,
          updatedAt: sql`clock_timestamp()`,
        })
        .where(eq(appointments.id, appt.id))
        .returning();

      return updated;
    });

    if (cancelledAppt) {
      after(async () => {
        try {
          const apiKey = process.env.RESEND_API_KEY?.trim();
          if (!apiKey) return;

          const resend = new Resend(apiKey);
          const baseUrl =
            process.env.BOOKING_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:3000";
          const fromEmail =
            process.env.RESEND_FROM_EMAIL ||
            "Rove Barbería <reservas@rovebarberia.com>";

          const emailContent = renderAdminCancellationEmail({
            payload: {
              customerName: cancelledAppt.customerName,
              serviceName: cancelledAppt.serviceNameSnapshot,
              startAt: cancelledAppt.startAt.toISOString(),
              adminReason: reason,
            },
            baseUrl,
          });

          const res = await resend.emails.send(
            {
              from: fromEmail,
              to: cancelledAppt.customerEmail,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            },
            {
              idempotencyKey: `cancel-admin-${cancelledAppt.id}`,
            }
          );

          if (res.error) {
            console.error(
              `[cancelAppointmentAdminAction] Error de Resend (${cancelledAppt.id}):`,
              res.error.message
            );
          }
        } catch (emailErr) {
          console.error(
            "[cancelAppointmentAdminAction] Error enviando correo en segundo plano:",
            emailErr instanceof Error ? emailErr.message : emailErr
          );
        }
      });
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al cancelar cita";
    return { success: false, error: msg };
  }
}

/**
 * Obtiene las ventanas de disponibilidad y bloqueos recientes.
 */
export async function getAdminWindowsAction(): Promise<{
  success: boolean;
  windows: AdminAvailabilityWindowDto[];
  error?: string;
}> {
  const session = await getAdminSession();
  if (!session) return { success: false, windows: [], error: "No autorizado." };

  try {
    const rows = await db
      .select()
      .from(availabilityWindows)
      .orderBy(desc(availabilityWindows.startAt))
      .limit(50);

    const timeFmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const dateFmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    return {
      success: true,
      windows: rows.map((w) => ({
        id: w.id,
        startAt: w.startAt.toISOString(),
        endAt: w.endAt.toISOString(),
        isBlocked: w.isBlocked,
        reason: w.reason,
        formattedTime: `${timeFmt.format(w.startAt)} - ${timeFmt.format(w.endAt)}`,
        formattedDate: dateFmt.format(w.startAt),
      })),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener ventanas";
    return { success: false, windows: [], error: msg };
  }
}

/**
 * Crea un bloqueo manual en la agenda (ej. vacaciones, almuerzo, turno médico).
 */
export async function createManualBlockAction(input: {
  startIso: string;
  endIso: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession();
  if (!session) return { success: false, error: "No autorizado." };

  try {
    const startAt = new Date(input.startIso);
    const endAt = new Date(input.endIso);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) {
      return { success: false, error: "Las fechas del bloqueo no son válidas." };
    }

    await db.insert(availabilityWindows).values({
      startAt,
      endAt,
      isBlocked: true,
      reason: input.reason || "Bloqueo administrativo",
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al crear bloqueo";
    return { success: false, error: msg };
  }
}

/**
 * Elimina un bloqueo manual existente.
 */
export async function deleteManualBlockAction(blockId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession();
  if (!session) return { success: false, error: "No autorizado." };

  try {
    await db.delete(availabilityWindows).where(eq(availabilityWindows.id, blockId));
    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al eliminar bloqueo";
    return { success: false, error: msg };
  }
}

export interface AdminKpiData {
  completedTodayCount: number;
  remainingTodayCount: number;
  futureAppointmentsCount: number;
  totalWeekCount: number;
  totalMonthCount: number;
  recentUnseenCount: number;
}

export interface ServiceItemDto {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  durationMinutes: number;
  isActive: boolean;
  sortOrder: number;
  imageUrl?: string | null;
}

/**
 * Obtiene métricas y KPIs del Dashboard principal según las nuevas reglas de negocio:
 * - KPI 1: Progreso del día (Completados / Restantes)
 * - KPI 2: Turnos futuros agendados a partir de mañana (excluyendo hoy)
 * - KPI 3: Volumen dual (Semana y Mes)
 */
export async function getAdminKpisAction(): Promise<{ success: boolean; kpis?: AdminKpiData; error?: string }> {
  const session = await getAdminSession();
  if (!session) return { success: false, error: "No autorizado." };

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. KPI 1: Turnos de Hoy (Completados vs Restantes)
    const todayRows = await db
      .select()
      .from(appointments)
      .where(and(gte(appointments.startAt, startOfToday), lte(appointments.startAt, endOfToday)));

    const activeToday = todayRows.filter((a) => a.status !== "cancelled");
    const completedTodayCount = activeToday.filter((a) => a.status === "completed").length;
    const remainingTodayCount = activeToday.filter((a) => a.status === "confirmed").length;

    // 2. KPI 2: Turnos futuros (excluyendo hoy)
    const futureRows = await db
      .select()
      .from(appointments)
      .where(gte(appointments.startAt, tomorrowStart));
    const futureAppointmentsCount = futureRows.filter((a) => a.status === "confirmed").length;

    // 3. KPI 3: Volumen Dual (Semana y Mes)
    // Semana actual (lunes a domingo)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekRows = await db
      .select()
      .from(appointments)
      .where(and(gte(appointments.startAt, startOfWeek), lte(appointments.startAt, endOfWeek)));
    const totalWeekCount = weekRows.filter((a) => a.status !== "cancelled").length;

    // Mes actual (1° del mes al último día del mes)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthRows = await db
      .select()
      .from(appointments)
      .where(and(gte(appointments.startAt, startOfMonth), lte(appointments.startAt, endOfMonth)));
    const totalMonthCount = monthRows.filter((a) => a.status !== "cancelled").length;

    // Turnos recientes no vistos (últimas 24h)
    const recentRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(gte(appointments.createdAt, last24Hours));
    const recentUnseenCount = Number(recentRows[0]?.count || 0);

    return {
      success: true,
      kpis: {
        completedTodayCount,
        remainingTodayCount,
        futureAppointmentsCount,
        totalWeekCount,
        totalMonthCount,
        recentUnseenCount,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error calculando métricas" };
  }
}

/**
 * Obtiene el catálogo completo de servicios para el editor.
 */
export async function getAdminServicesAction(): Promise<{ success: boolean; services: ServiceItemDto[]; error?: string }> {
  const session = await getAdminSession();
  if (!session) return { success: false, services: [], error: "No autorizado." };

  try {
    const rows = await db.select().from(services).orderBy(services.sortOrder);
    return {
      success: true,
      services: rows.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        priceAmount: s.priceAmount,
        durationMinutes: s.durationMinutes,
        isActive: s.isActive,
        sortOrder: s.sortOrder,
      })),
    };
  } catch (error) {
    return { success: false, services: [], error: error instanceof Error ? error.message : "Error al obtener servicios" };
  }
}

/**
 * Actualiza los atributos de un servicio en la base de datos y revalida vistas.
 */
export async function updateServiceAction(input: {
  id: string;
  name: string;
  priceAmount: number;
  durationMinutes: number;
  isActive: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession();
  if (!session) return { success: false, error: "No autorizado." };

  try {
    await db
      .update(services)
      .set({
        name: input.name,
        priceAmount: input.priceAmount,
        durationMinutes: input.durationMinutes,
        isActive: input.isActive,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(eq(services.id, input.id));

    revalidatePath("/admin/servicios");
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al actualizar servicio" };
  }
}

export interface AdminNotificationDto {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  formattedTime: string;
  formattedDate: string;
  status: "confirmed" | "cancelled" | "completed";
  createdAt: string;
  isObsolete: boolean;
}

/**
 * Obtiene las notificaciones de nuevos turnos agendados recientemente.
 * Permite al panel de administración enterarse en tiempo real de nuevas reservas.
 */
export async function getAdminNotificationsAction(): Promise<{
  success: boolean;
  notifications: AdminNotificationDto[];
  error?: string;
}> {
  const session = await getAdminSession();
  if (!session) return { success: false, notifications: [], error: "No autorizado." };

  try {
    const rows = await db
      .select()
      .from(appointments)
      .orderBy(desc(appointments.createdAt))
      .limit(20);

    const timeFmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const dateFmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    const now = new Date();

    const notifications: AdminNotificationDto[] = rows.map((r) => {
      // Un turno es obsoleto para una notificación de "nuevo turno" si ya fue cancelado
      // o si la fecha de inicio del turno ya pasó hace más de 24 horas.
      const isPast = r.endAt.getTime() < now.getTime();
      const isObsolete = r.status === "cancelled" || isPast;

      return {
        id: r.id,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        serviceName: r.serviceNameSnapshot,
        formattedTime: timeFmt.format(r.startAt),
        formattedDate: dateFmt.format(r.startAt),
        status: r.status as "confirmed" | "cancelled" | "completed",
        createdAt: r.createdAt.toISOString(),
        isObsolete,
      };
    });

    return { success: true, notifications };
  } catch (error) {
    return {
      success: false,
      notifications: [],
      error: error instanceof Error ? error.message : "Error al cargar notificaciones",
    };
  }
}

