import { and, lt, gt, asc, eq } from "drizzle-orm";
import {
  availabilityWindows,
  appointments,
  type AvailabilityWindow,
  type Appointment,
} from "../db/schema";
import { db } from "../db";
import type {
  AvailabilityWindowInput,
  AppointmentSlotInput,
  AvailabilityQueryInput,
} from "../availability/types";
import type { DatabaseClient, GetAvailabilityDataParams } from "./types";
import { getActiveServiceById } from "./services.repository";

/**
 * Convierte un valor a Date y valida que sea un instante finito.
 */
function toValidDate(val: Date | string | number, fieldName: string): Date {
  const date = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(date.getTime()) || !Number.isFinite(date.getTime())) {
    throw new Error(`Fecha inválida en campo '${fieldName}': '${String(val)}'.`);
  }
  return date;
}

/**
 * Mapea un registro de la tabla availability_windows al tipo AvailabilityWindowInput del motor.
 *
 * @param row - Registro de la base de datos.
 * @returns Estructura tipada para el motor de disponibilidad.
 * @throws {Error} Si el registro contiene fechas inválidas o endAt <= startAt.
 */
export function mapAvailabilityWindowRecord(
  row: AvailabilityWindow
): AvailabilityWindowInput {
  if (!row || typeof row !== "object") {
    throw new Error("Registro de ventana de disponibilidad inválido: debe ser un objeto no nulo.");
  }

  const startAt = toValidDate(row.startAt, "startAt");
  const endAt = toValidDate(row.endAt, "endAt");

  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error(
      `Registro corrupto en availability_windows (id: ${row.id}): endAt (${endAt.toISOString()}) debe ser estrictamente posterior a startAt (${startAt.toISOString()}).`
    );
  }

  return {
    startAt,
    endAt,
    isBlocked: Boolean(row.isBlocked),
    reason: row.reason,
  };
}

/**
 * Mapea un registro de la tabla appointments al tipo AppointmentSlotInput del motor.
 *
 * @param row - Registro de la base de datos.
 * @returns Estructura tipada para el motor de disponibilidad.
 * @throws {Error} Si el registro contiene fechas inválidas o endAt <= startAt.
 */
export function mapAppointmentRecord(
  row: Appointment
): AppointmentSlotInput {
  if (!row || typeof row !== "object") {
    throw new Error("Registro de turno inválido: debe ser un objeto no nulo.");
  }

  const startAt = toValidDate(row.startAt, "startAt");
  const endAt = toValidDate(row.endAt, "endAt");

  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error(
      `Registro corrupto en appointments (id: ${row.id}): endAt (${endAt.toISOString()}) debe ser estrictamente posterior a startAt (${startAt.toISOString()}).`
    );
  }

  if (typeof row.status !== "string" || row.status.trim().length === 0) {
    throw new Error(`Registro corrupto en appointments (id: ${row.id}): campo status inválido.`);
  }

  return {
    startAt,
    endAt,
    status: row.status,
  };
}

/**
 * Obtiene las ventanas de disponibilidad y bloqueos que intersecan un rango temporal dado [startDate, endDate).
 *
 * Condición de solapamiento de intervalos: startAt < endDate AND endAt > startDate.
 *
 * @param startDate - Instante inicial del rango.
 * @param endDate - Instante final del rango.
 * @param client - Cliente de base de datos.
 * @returns Lista de franjas y bloqueos mapeados para el motor.
 */
export async function getAvailabilityWindowsInRange(
  startDate: Date,
  endDate: Date,
  client: DatabaseClient = db
): Promise<AvailabilityWindowInput[]> {
  const start = toValidDate(startDate, "startDate");
  const end = toValidDate(endDate, "endDate");

  if (end.getTime() <= start.getTime()) {
    throw new Error("Rango de consulta inválido: endDate debe ser posterior a startDate.");
  }

  try {
    const records = await client.query.availabilityWindows.findMany({
      where: and(
        lt(availabilityWindows.startAt, end),
        gt(availabilityWindows.endAt, start)
      ),
      orderBy: [asc(availabilityWindows.startAt)],
    });

    return records.map(mapAvailabilityWindowRecord);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    throw new Error(`Error al consultar ventanas de disponibilidad: ${message}`);
  }
}

/**
 * Obtiene exclusivamente los turnos confirmados que ocupan agenda en el rango temporal dado.
 * Excluye turnos cancelados o completados que no deben bloquear disponibilidad.
 *
 * @param startDate - Instante inicial del rango.
 * @param endDate - Instante final del rango.
 * @param client - Cliente de base de datos.
 * @returns Lista de turnos confirmados ocupantes mapeados para el motor.
 */
export async function getOccupyingAppointmentsInRange(
  startDate: Date,
  endDate: Date,
  client: DatabaseClient = db
): Promise<AppointmentSlotInput[]> {
  const start = toValidDate(startDate, "startDate");
  const end = toValidDate(endDate, "endDate");

  if (end.getTime() <= start.getTime()) {
    throw new Error("Rango de consulta inválido: endDate debe ser posterior a startDate.");
  }

  try {
    const records = await client.query.appointments.findMany({
      where: and(
        eq(appointments.status, "confirmed"),
        lt(appointments.startAt, end),
        gt(appointments.endAt, start)
      ),
      orderBy: [asc(appointments.startAt)],
    });

    return records.map(mapAppointmentRecord);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    throw new Error(`Error al consultar turnos ocupados: ${message}`);
  }
}

/**
 * Adaptador de lectura unificado: recupera el servicio, las ventanas de disponibilidad
 * y los turnos confirmados en la ventana de horizonte, devolviendo un objeto
 * directamente compatible con calculateAvailableSlots().
 *
 * @param params - Parámetros de consulta (serviceId, referenceNow, horizonDays).
 * @param client - Cliente de base de datos.
 * @returns Objeto AvailabilityQueryInput listo para alimentar al motor.
 * @throws {Error} Si el servicio no existe o está inactivo, o ante errores de consulta.
 */
export async function getAvailabilityQueryData(
  params: GetAvailabilityDataParams,
  client: DatabaseClient = db
): Promise<AvailabilityQueryInput> {
  const { serviceId, referenceNow = new Date(), horizonDays = 7 } = params;

  if (typeof serviceId !== "string" || serviceId.trim().length === 0) {
    throw new Error("serviceId debe ser una cadena no vacía.");
  }

  const now = toValidDate(referenceNow, "referenceNow");
  if (!Number.isFinite(horizonDays) || horizonDays <= 0 || horizonDays > 365) {
    throw new Error(`horizonDays inválido (${horizonDays}): debe ser un número positivo entre 1 y 365.`);
  }

  // 1. Obtener servicio activo
  const service = await getActiveServiceById(serviceId, client);
  if (!service) {
    throw new Error(`Servicio no encontrado o inactivo: '${serviceId}'.`);
  }

  // 2. Definir rango de consulta [now, now + horizonDays * 24h)
  const endDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  // 3. Consultar ventanas de disponibilidad y turnos ocupados en paralelo
  const [windows, occupyingAppointments] = await Promise.all([
    getAvailabilityWindowsInRange(now, endDate, client),
    getOccupyingAppointmentsInRange(now, endDate, client),
  ]);

  return {
    serviceDurationMinutes: service.durationMinutes,
    availabilityWindows: windows,
    existingAppointments: occupyingAppointments,
    referenceNow: now,
  };
}
