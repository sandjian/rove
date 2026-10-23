/**
 * Representa un intervalo de tiempo continuo semiabierto: [startAt, endAt).
 * El instante startAt está incluido; el instante endAt está excluido.
 */
export interface TimeInterval {
  startAt: Date;
  endAt: Date;
}

/**
 * Entrada de franjas de disponibilidad o bloqueos manuales,
 * compatible con la tabla `availability_windows`.
 */
export interface AvailabilityWindowInput {
  startAt: Date;
  endAt: Date;
  isBlocked: boolean;
  reason?: string | null;
}

/**
 * Entrada de turnos existentes en el sistema,
 * compatible con la tabla `appointments`.
 */
export interface AppointmentSlotInput {
  startAt: Date;
  endAt: Date;
  status: string;
}

/**
 * Horario candidato disponible para reservar un servicio.
 */
export interface AvailableSlot {
  /** Instante de inicio del turno [T) */
  startAt: Date;
  /** Instante de finalización del turno [T + duración) */
  endAt: Date;
  /** Representación ISO 8601 del inicio (UTC) */
  startIso: string;
  /** Representación ISO 8601 del fin (UTC) */
  endIso: string;
}

/**
 * Parámetros de consulta para el motor de disponibilidad.
 */
export interface AvailabilityQueryInput {
  /** Franjas de trabajo habilitadas y bloqueos manuales */
  availabilityWindows: AvailabilityWindowInput[];
  /** Turnos registrados en el sistema */
  existingAppointments: AppointmentSlotInput[];
  /** Duración del servicio solicitado en minutos (1 a 480) */
  serviceDurationMinutes: number;
  /** Instante de referencia temporal para evaluar anticipación y horizonte (inyectable para pruebas) */
  referenceNow?: Date;
}

/**
 * Opciones de configuración del motor de disponibilidad.
 */
export interface AvailabilityOptions {
  /** Cadencia entre horarios de inicio candidatos en minutos (por defecto: 15) */
  slotStepMinutes?: number;
  /** Anticipación mínima requerida en horas respecto a referenceNow (por defecto: 2) */
  minNoticeHours?: number;
  /** Horizonte móvil en días corridos respecto a referenceNow (por defecto: 7) */
  bookingHorizonDays?: number;
  /** Identificador IANA de la zona horaria del negocio (por defecto: 'America/Argentina/Buenos_Aires') */
  timeZone?: string;
}
