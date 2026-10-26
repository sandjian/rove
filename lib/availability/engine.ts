import type {
  AvailabilityQueryInput,
  AvailabilityOptions,
  AvailableSlot,
  TimeInterval,
} from "./types";
import {
  assertValidInterval,
  subtractIntervals,
} from "./intervals";

/**
 * Constantes por defecto del motor de disponibilidad.
 */
export const DEFAULT_AVAILABILITY_OPTIONS: Required<AvailabilityOptions> = {
  slotStepMinutes: 15,
  minNoticeHours: 2,
  bookingHorizonDays: 7,
  timeZone: "America/Argentina/Buenos_Aires",
};

/**
 * Estados canónicos de reserva definidos en el esquema de base de datos.
 */
export const CANONICAL_APPOINTMENT_STATUSES = new Set([
  "confirmed",
  "cancelled",
  "completed",
]);

/**
 * Calcula el desplazamiento en milisegundos de una zona horaria IANA respecto a UTC
 * para un instante dado, utilizando la API nativa Intl.
 *
 * Permite alinear los horarios a los minutos reales del reloj local de la zona
 * de negocio de forma determinista e inmune a la zona horaria del servidor.
 *
 * @param date - Instante de referencia.
 * @param timeZone - Identificador IANA de la zona horaria (ej. 'America/Argentina/Buenos_Aires').
 * @returns Desplazamiento en milisegundos (ej. -10800000 para UTC-3).
 */
export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const year = getPart("year");
  const month = getPart("month") - 1;
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");

  const localAsUtc = Date.UTC(year, month, day, hour, minute, second);
  const dateSecondsMs = Math.floor(date.getTime() / 1000) * 1000;
  return localAsUtc - dateSecondsMs;
}

/**
 * Valida exhaustivamente los parámetros de entrada del motor de disponibilidad.
 *
 * @param input - Datos de consulta.
 * @param options - Opciones de configuración.
 * @throws {Error} Si algún parámetro no cumple las reglas de negocio o tipo.
 */
function validateQueryInput(
  input: AvailabilityQueryInput,
  options: Required<AvailabilityOptions>
): void {
  if (!input || typeof input !== "object") {
    throw new Error("Los parámetros de consulta de disponibilidad son obligatorios.");
  }

  const {
    serviceDurationMinutes,
    referenceNow,
    availabilityWindows,
    existingAppointments,
  } = input;

  // 1. Validación de duración del servicio
  if (
    typeof serviceDurationMinutes !== "number" ||
    !Number.isSafeInteger(serviceDurationMinutes) ||
    serviceDurationMinutes <= 0 ||
    serviceDurationMinutes > 480
  ) {
    throw new Error(
      `Duración de servicio inválida (${serviceDurationMinutes}): debe ser un entero seguro entre 1 y 480 minutos.`
    );
  }

  // 2. Validación de referenceNow
  if (referenceNow !== undefined) {
    if (
      !(referenceNow instanceof Date) ||
      !Number.isFinite(referenceNow.getTime())
    ) {
      throw new Error(
        "El instante de referencia (referenceNow) debe ser un objeto Date válido."
      );
    }
  }

  // 3. Validación de opciones numéricas finitas
  if (
    typeof options.slotStepMinutes !== "number" ||
    !Number.isSafeInteger(options.slotStepMinutes) ||
    options.slotStepMinutes <= 0 ||
    options.slotStepMinutes > 120
  ) {
    throw new Error(
      `Cadencia de horarios inválida (${options.slotStepMinutes}): debe ser un entero seguro entre 1 y 120 minutos.`
    );
  }

  if (
    typeof options.minNoticeHours !== "number" ||
    !Number.isFinite(options.minNoticeHours) ||
    options.minNoticeHours < 0 ||
    options.minNoticeHours > 720
  ) {
    throw new Error(
      `Anticipación mínima inválida (${options.minNoticeHours}): debe ser un número finito entre 0 y 720 horas.`
    );
  }

  if (
    typeof options.bookingHorizonDays !== "number" ||
    !Number.isFinite(options.bookingHorizonDays) ||
    options.bookingHorizonDays <= 0 ||
    options.bookingHorizonDays > 365
  ) {
    throw new Error(
      `Horizonte de reservas inválido (${options.bookingHorizonDays}): debe ser un número finito positivo entre 1 y 365 días.`
    );
  }

  // 4. Validación de zona horaria IANA
  if (
    typeof options.timeZone !== "string" ||
    options.timeZone.trim().length === 0
  ) {
    throw new Error(
      "timeZone debe ser una cadena no vacía con un identificador IANA válido."
    );
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: options.timeZone });
  } catch {
    throw new Error(
      `Zona horaria inválida: '${options.timeZone}'. Debe ser un identificador IANA reconocido.`
    );
  }

  // 5. Validación de colecciones de entrada
  if (!Array.isArray(availabilityWindows)) {
    throw new Error("availabilityWindows debe ser un array.");
  }

  for (let i = 0; i < availabilityWindows.length; i++) {
    const window = availabilityWindows[i];
    if (!window || typeof window !== "object") {
      throw new Error(
        `availabilityWindows[${i}] inválido: cada elemento debe ser un objeto no nulo.`
      );
    }
    if (typeof window.isBlocked !== "boolean") {
      throw new Error(
        `Ventana en índice ${i} inválida: el campo isBlocked debe ser booleano.`
      );
    }
    assertValidInterval(window, `availabilityWindows[${i}]`);
  }

  if (!Array.isArray(existingAppointments)) {
    throw new Error("existingAppointments debe ser un array.");
  }

  for (let i = 0; i < existingAppointments.length; i++) {
    const appt = existingAppointments[i];
    if (!appt || typeof appt !== "object") {
      throw new Error(
        `existingAppointments[${i}] inválido: cada elemento debe ser un objeto no nulo.`
      );
    }
    if (
      typeof appt.status !== "string" ||
      !CANONICAL_APPOINTMENT_STATUSES.has(appt.status)
    ) {
      throw new Error(
        `Turno en índice ${i} inválido: el campo status ('${appt.status}') debe ser uno de los estados canónicos: 'confirmed', 'cancelled', 'completed'.`
      );
    }
    assertValidInterval(appt, `existingAppointments[${i}]`);
  }
}

/**
 * Calcula los horarios de turnos disponibles para un servicio determinado.
 *
 * Sigue el algoritmo de 4 pasos:
 * 1. Fusión de franjas laborales habilitadas (isBlocked === false).
 * 2. Sustracción de bloqueos manuales (isBlocked === true).
 * 3. Sustracción de turnos confirmados (status === 'confirmed').
 * 4. Generación de horarios candidatos alineados a la grilla fija del reloj local
 *    de la zona horaria configurada y filtrados por anticipación mínima (>= now + 2h),
 *    horizonte móvil (fin <= now + 7d) e inclusión completa del servicio.
 *
 * @param input - Parámetros de consulta (franjas, turnos, duración de servicio, hora de referencia).
 * @param options - Opciones opcionales de cadencia, anticipación, horizonte y zona horaria.
 * @returns Lista de horarios disponibles ordenados cronológicamente y sin duplicados.
 */
export function calculateAvailableSlots(
  input: AvailabilityQueryInput,
  options?: AvailabilityOptions
): AvailableSlot[] {
  const mergedOptions: Required<AvailabilityOptions> = {
    slotStepMinutes:
      options?.slotStepMinutes ?? DEFAULT_AVAILABILITY_OPTIONS.slotStepMinutes,
    minNoticeHours:
      options?.minNoticeHours ?? DEFAULT_AVAILABILITY_OPTIONS.minNoticeHours,
    bookingHorizonDays:
      options?.bookingHorizonDays ??
      DEFAULT_AVAILABILITY_OPTIONS.bookingHorizonDays,
    timeZone: options?.timeZone ?? DEFAULT_AVAILABILITY_OPTIONS.timeZone,
  };

  validateQueryInput(input, mergedOptions);

  const {
    availabilityWindows,
    existingAppointments,
    serviceDurationMinutes,
  } = input;
  const now = input.referenceNow ?? new Date();

  // Límites temporales absolutos
  const nowTime = now.getTime();
  const minStartTime = nowTime + mergedOptions.minNoticeHours * 60 * 60 * 1000;
  const maxEndTime =
    nowTime + mergedOptions.bookingHorizonDays * 24 * 60 * 60 * 1000;
  const durationMs = serviceDurationMinutes * 60 * 1000;
  const stepMs = mergedOptions.slotStepMinutes * 60 * 1000;

  // Desplazamiento de zona horaria local respecto a UTC en el instante actual
  const tzOffsetMs = getTimeZoneOffsetMs(now, mergedOptions.timeZone);

  // Paso 1: Separar franjas habilitadas de bloqueos manuales
  const workIntervals: TimeInterval[] = [];
  const blockIntervals: TimeInterval[] = [];

  for (const window of availabilityWindows) {
    const interval: TimeInterval = {
      startAt: window.startAt,
      endAt: window.endAt,
    };
    if (window.isBlocked) {
      blockIntervals.push(interval);
    } else {
      workIntervals.push(interval);
    }
  }

  // Paso 2: Filtrar turnos confirmados que ocupan agenda
  // (turnos cancelados o completados no bloquean disponibilidad futura)
  const confirmedAppointments: TimeInterval[] = existingAppointments
    .filter((appt) => appt.status === "confirmed")
    .map((appt) => ({
      startAt: appt.startAt,
      endAt: appt.endAt,
    }));

  // Paso 3: Calcular intervalos libres netos:
  // Franjas Habilitadas - (Bloqueos ∪ Turnos Confirmados)
  const occupiedIntervals: TimeInterval[] = [
    ...blockIntervals,
    ...confirmedAppointments,
  ];
  const freeIntervals = subtractIntervals(workIntervals, occupiedIntervals);

  if (freeIntervals.length === 0) {
    return [];
  }

  // Paso 4: Generar candidatos alineados a la grilla fija del reloj local
  const availableSlots: AvailableSlot[] = [];
  const seenStartTimes = new Set<number>();

  for (const freeInterval of freeIntervals) {
    const freeStart = freeInterval.startAt.getTime();
    const freeEnd = freeInterval.endAt.getTime();

    // Alinear el inicio al reloj local en la zona horaria especificada:
    // (T_local) = freeStart + tzOffsetMs
    // nextT_local = Math.ceil(freeStartLocal / stepMs) * stepMs
    // nextT_utc = nextT_local - tzOffsetMs
    const freeStartLocal = freeStart + tzOffsetMs;
    const firstCandidateStartLocal =
      Math.ceil(freeStartLocal / stepMs) * stepMs;
    const firstCandidateStart = firstCandidateStartLocal - tzOffsetMs;

    for (
      let candidateStart = firstCandidateStart;
      candidateStart + durationMs <= freeEnd;
      candidateStart += stepMs
    ) {
      const candidateEnd = candidateStart + durationMs;

      // Regla de anticipación mínima: inicio >= now + 2 horas
      if (candidateStart < minStartTime) {
        continue;
      }

      // Regla de horizonte de reserva: fin <= now + 7 días corridos
      if (candidateEnd > maxEndTime) {
        continue;
      }

      // Evitar duplicados si coincidieran fronteras
      if (seenStartTimes.has(candidateStart)) {
        continue;
      }

      seenStartTimes.add(candidateStart);

      const startDate = new Date(candidateStart);
      const endDate = new Date(candidateEnd);

      availableSlots.push({
        startAt: startDate,
        endAt: endDate,
        startIso: startDate.toISOString(),
        endIso: endDate.toISOString(),
      });
    }
  }

  // Ordenar cronológicamente ascendente
  return availableSlots.sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime()
  );
}
