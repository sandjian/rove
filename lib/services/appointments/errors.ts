/**
 * Error base del dominio de reservas.
 */
export abstract class BookingError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * El servicio solicitado no existe en la base de datos o está marcado como inactivo.
 */
export class ServiceNotFoundError extends BookingError {
  readonly code = "SERVICE_NOT_FOUND";

  constructor(serviceId: string) {
    super(`El servicio solicitado ('${serviceId}') no existe o se encuentra inactivo.`);
  }
}

/**
 * Los datos proporcionados por el cliente contienen errores de formato o validación.
 */
export class InvalidBookingDataError extends BookingError {
  readonly code = "INVALID_BOOKING_DATA";

  constructor(message: string) {
    super(message);
  }
}

/**
 * La reserva no cumple con la anticipación mínima requerida (2 horas).
 */
export class BookingNoticeError extends BookingError {
  readonly code = "INSUFFICIENT_NOTICE";

  constructor(minNoticeHours = 2) {
    super(
      `Las reservas requieren una anticipación mínima de ${minNoticeHours} horas respecto al horario actual.`
    );
  }
}

/**
 * El turno solicitado excede el horizonte máximo de reservas (7 días corridos / 168 horas).
 */
export class BookingHorizonError extends BookingError {
  readonly code = "EXCEEDS_BOOKING_HORIZON";

  constructor(horizonHours = 168) {
    super(
      `El horario solicitado excede el horizonte máximo de reserva permitido (${horizonHours} horas / 7 días corridos).`
    );
  }
}

/**
 * El horario solicitado no coincide con ningún horario libre según las reglas de negocio
 * y el estado actual de la agenda (franjas, descansos, turnos existentes).
 */
export class SlotNotAvailableError extends BookingError {
  readonly code = "SLOT_NOT_AVAILABLE";

  constructor(requestedIso: string) {
    super(
      `El horario solicitado (${requestedIso}) no se encuentra disponible para el servicio seleccionado.`
    );
  }
}

/**
 * Conflicto de concurrencia: la reserva fue rechazada por la restricción de exclusión GiST
 * porque otra transacción confirmó el mismo horario en simultáneo.
 */
export class ConcurrentBookingConflictError extends BookingError {
  readonly code = "CONCURRENT_BOOKING_CONFLICT";

  constructor() {
    super(
      "El horario solicitado acaba de ser confirmado por otra reserva. Por favor, seleccioná otro horario disponible."
    );
  }
}

/**
 * Error de persistencia o fallo inesperado durante la transacción de reserva.
 */
export class BookingPersistenceError extends BookingError {
  readonly code = "BOOKING_PERSISTENCE_ERROR";

  constructor(message = "Ocurrió un error al procesar y confirmar la reserva. Por favor, intentá nuevamente.") {
    super(message);
  }
}
