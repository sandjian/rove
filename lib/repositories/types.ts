import type { Service, AvailabilityWindow, Appointment } from "../db/schema";
import type { DrizzleDb, DrizzleTransaction } from "../db";

/**
 * Interfaz de consulta para el catálogo de servicios.
 */
export interface ServicesQueryInterface {
  findMany: (options?: {
    where?: unknown;
    orderBy?: unknown;
  }) => Promise<Service[]>;
  findFirst: (options?: {
    where?: unknown;
  }) => Promise<Service | undefined>;
}

/**
 * Interfaz de consulta para las ventanas de disponibilidad y bloqueos.
 */
export interface AvailabilityWindowsQueryInterface {
  findMany: (options?: {
    where?: unknown;
    orderBy?: unknown;
  }) => Promise<AvailabilityWindow[]>;
}

/**
 * Interfaz de consulta para los turnos existentes.
 */
export interface AppointmentsQueryInterface {
  findMany: (options?: {
    where?: unknown;
    orderBy?: unknown;
  }) => Promise<Appointment[]>;
}

/**
 * Lector de base de datos desacoplado, compatible tanto con la instancia real de
 * Drizzle como con adaptadores de prueba sin dependencias de red.
 */
export interface DbReader {
  query: {
    services: ServicesQueryInterface;
    availabilityWindows: AvailabilityWindowsQueryInterface;
    appointments: AppointmentsQueryInterface;
  };
}
/**
 * Cliente de base de datos aceptado por los repositorios.
 */
export type DatabaseClient = DrizzleDb | DrizzleTransaction | DbReader;

/**
 * Parámetros para la consulta unificada de datos del motor de disponibilidad.
 */
export interface GetAvailabilityDataParams {
  /** Identificador único del servicio solicitado (UUID) */
  serviceId: string;
  /** Instante de referencia temporal (por defecto: now) */
  referenceNow?: Date;
  /** Horizonte de reservas en días (por defecto: 7) */
  horizonDays?: number;
}
