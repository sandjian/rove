"use server";

import { getActiveServices, getActiveServiceById } from "@/lib/repositories/services.repository";
import { getAvailabilityQueryData } from "@/lib/repositories/availability.repository";
import { calculateAvailableSlots } from "@/lib/availability/engine";
import { createAppointment } from "@/lib/services/appointments/create-appointment";
import { cancelAppointmentByToken } from "@/lib/services/appointments/cancel-appointment";
import { BookingError } from "@/lib/services/appointments/errors";

export interface ServiceDto {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceAmount: number;
  currency: string;
}

export interface SlotDto {
  startIso: string;
  endIso: string;
  timeLabel: string; // ej: "10:00"
  dateKey: string;   // ej: "2026-10-25"
  dayLabel: string;  // ej: "Lunes 25 Oct"
}

export interface DaySlotsDto {
  dateKey: string;
  dayLabel: string;
  slots: SlotDto[];
}

export interface BookingSubmissionInput {
  serviceId: string;
  startIso: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface BookingActionResult {
  success: boolean;
  appointment?: {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    serviceName: string;
    durationMinutes: number;
    priceAmount: number;
    currency: string;
    startIso: string;
    endIso: string;
  };
  cancellationToken?: string;
  error?: string;
}

export interface CancellationActionResult {
  success: boolean;
  alreadyCancelled?: boolean;
  message?: string;
  error?: string;
}

const BUENOS_AIRES_TZ = "America/Argentina/Buenos_Aires";

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: BUENOS_AIRES_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: BUENOS_AIRES_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUENOS_AIRES_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Obtiene los servicios activos del catálogo para presentarlos en el selector de turnos.
 */
export async function getServicesAction(): Promise<{
  success: boolean;
  services: ServiceDto[];
  error?: string;
}> {
  try {
    const rawServices = await getActiveServices();
    const services: ServiceDto[] = rawServices.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      durationMinutes: s.durationMinutes,
      priceAmount: s.priceAmount,
      currency: "ARS",
    }));

    return { success: true, services };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar servicios";
    return { success: false, services: [], error: message };
  }
}

/**
 * Consulta la disponibilidad para un servicio en los próximos 7 días corridos,
 * calculando los horarios libres y agrupándolos por día en hora local argentina.
 */
export async function getAvailableSlotsAction(serviceId: string): Promise<{
  success: boolean;
  days: DaySlotsDto[];
  error?: string;
}> {
  try {
    if (!serviceId || typeof serviceId !== "string" || serviceId.trim().length === 0) {
      return { success: false, days: [], error: "Identificador de servicio no válido." };
    }

    const service = await getActiveServiceById(serviceId.trim());
    if (!service || !service.isActive) {
      return { success: false, days: [], error: "El servicio solicitado no está disponible." };
    }

    const now = new Date();
    const queryData = await getAvailabilityQueryData({
      serviceId: service.id,
      referenceNow: now,
      horizonDays: 7,
    });

    const calculatedSlots = calculateAvailableSlots(queryData);

    // Agrupar los slots por día local (Buenos Aires)
    const daysMap = new Map<string, { dayLabel: string; slots: SlotDto[] }>();

    for (const slot of calculatedSlots) {
      const dateKey = dateKeyFormatter.format(slot.startAt); // "YYYY-MM-DD"
      const rawDayLabel = dayFormatter.format(slot.startAt); // "lun, 25 oct"
      const capitalizedDayLabel =
        rawDayLabel.charAt(0).toUpperCase() + rawDayLabel.slice(1).replace(".", "");

      const timeLabel = timeFormatter.format(slot.startAt);

      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          dayLabel: capitalizedDayLabel,
          slots: [],
        });
      }

      daysMap.get(dateKey)!.slots.push({
        startIso: slot.startIso,
        endIso: slot.endIso,
        timeLabel,
        dateKey,
        dayLabel: capitalizedDayLabel,
      });
    }

    const days: DaySlotsDto[] = Array.from(daysMap.entries()).map(([dateKey, group]) => ({
      dateKey,
      dayLabel: group.dayLabel,
      slots: group.slots,
    }));

    return { success: true, days };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al calcular disponibilidad.";
    return { success: false, days: [], error: message };
  }
}

/**
 * Crea una reserva de forma atómica, despacha los correos de confirmación en segundo
 * plano mediante `after()` de Next.js 16 y devuelve el token de cancelación criptográfico.
 */
export async function bookAppointmentAction(
  input: BookingSubmissionInput
): Promise<BookingActionResult> {
  try {
    if (!input || typeof input !== "object") {
      return { success: false, error: "Datos de reserva inválidos." };
    }

    const { serviceId, startIso, customerName, customerEmail, customerPhone } = input;

    if (!serviceId || !startIso || !customerName || !customerEmail || !customerPhone) {
      return {
        success: false,
        error: "Por favor completá todos los campos obligatorios del formulario.",
      };
    }

    const startAt = new Date(startIso);
    if (Number.isNaN(startAt.getTime())) {
      return { success: false, error: "La fecha y horario seleccionados no son válidos." };
    }

    const result = await createAppointment({
      serviceId: serviceId.trim(),
      startAt,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      customerPhone: customerPhone.trim(),
      referenceNow: new Date(),
    });

    return {
      success: true,
      cancellationToken: result.cancellationToken,
      appointment: {
        id: result.appointment.id,
        customerName: result.appointment.customerName,
        customerEmail: result.appointment.customerEmail,
        customerPhone: result.appointment.customerPhone,
        serviceName: result.appointment.serviceNameSnapshot,
        durationMinutes: result.appointment.serviceDurationSnapshot,
        priceAmount: result.appointment.servicePriceSnapshot,
        currency: result.appointment.currency,
        startIso: result.appointment.startAt.toISOString(),
        endIso: result.appointment.endAt.toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof BookingError) {
      return { success: false, error: error.message };
    }

    const message = error instanceof Error ? error.message : "Error inesperado al confirmar la reserva.";
    return { success: false, error: message };
  }
}

/**
 * Cancela una reserva mediante su token criptográfico.
 */
export async function cancelAppointmentAction(rawToken: string): Promise<CancellationActionResult> {
  try {
    const result = await cancelAppointmentByToken(rawToken);

    if (!result.success) {
      return { success: false, error: result.error ?? "No se pudo cancelar la reserva." };
    }

    if (result.alreadyCancelled) {
      return {
        success: true,
        alreadyCancelled: true,
        message: "Esta reserva ya se encontraba cancelada previamente.",
      };
    }

    return {
      success: true,
      alreadyCancelled: false,
      message: "Tu reserva ha sido cancelada exitosamente. Se ha liberado el turno.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al procesar la cancelación.";
    return { success: false, error: message };
  }
}
