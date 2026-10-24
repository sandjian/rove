import type { Appointment } from "../../db/schema";
import type { DrizzleTransaction } from "../../db";
import type { DatabaseClient } from "../../repositories/types";

/**
 * Datos requeridos para solicitar la creación de una reserva.
 */
export interface CreateAppointmentInput {
  /** Identificador único (UUID) del servicio a reservar */
  serviceId: string;

  /** Instante de inicio solicitado para el turno (Date o cadena ISO) */
  startAt: Date | string;

  /** Nombre completo del cliente */
  customerName: string;

  /** Correo electrónico del cliente para envío de confirmación y cancelación */
  customerEmail: string;

  /** Teléfono de contacto del cliente (obligatorio) */
  customerPhone: string;

  /**
   * Instante de referencia temporal para evaluar anticipación y horizonte.
   * Por defecto: new Date(). Permite pruebas deterministas.
   */
  referenceNow?: Date;
}

/**
 * Resultado retornado tras una reserva exitosa y atómica.
 */
export interface CreateAppointmentResult {
  /**
   * El registro persistido de la reserva con estado 'confirmed' y snapshots de servicio.
   */
  appointment: Appointment;

  /**
   * Token criptográfico de cancelación en texto plano (64 caracteres hex).
   * Solo debe utilizarse para construir el enlace de notificación en el flujo de correo.
   * NUNCA debe persistirse en la base de datos en texto plano.
   */
  cancellationToken: string;
}

/**
 * Contexto transaccional admitido por el servicio.
 */
export type TransactionContext = DrizzleTransaction;

/**
 * Interfaz para el cliente ejecutor de transacciones.
 * Compatible con DrizzleDb y clientes simulados de prueba.
 */
export interface TransactionExecutor {
  transaction: <T>(callback: (tx: TransactionContext) => Promise<T>) => Promise<T>;
}

/**
 * Cliente de base de datos aceptado por el servicio de citas.
 */
export type AppointmentServiceClient = DatabaseClient & TransactionExecutor;
