import type { DrizzleDb } from "../../db";

/**
 * Datos requeridos para la notificación de confirmación al cliente.
 */
export interface CustomerBookingPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  serviceDurationMinutes: number;
  servicePriceAmount: number;
  currency: string;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  cancellationToken: string; // Token en claro recuperado tras descifrado en memoria
}

/**
 * Datos requeridos para la notificación de reserva al barbero.
 */
export interface BarberBookingPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  serviceDurationMinutes: number;
  servicePriceAmount: number;
  currency: string;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
}

/**
 * Unión de payloads válidos de notificación de turnos.
 */
export type BookingOutboxPayload = CustomerBookingPayload | BarberBookingPayload;

/**
 * Interfaz de envío de email para Resend.
 */
export interface SendEmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

/**
 * Resultado devuelto por el envío en Resend.
 */
export interface SendEmailResult {
  data: { id: string } | null;
  error: { message: string; name?: string; statusCode?: number } | null;
}

/**
 * Cliente de Resend desacoplado e inyectable.
 */
export interface ResendClientInterface {
  emails: {
    send: (
      payload: SendEmailPayload,
      options?: {
        idempotencyKey?: string;
        headers?: Record<string, string>;
        signal?: AbortSignal;
      }
    ) => Promise<SendEmailResult>;
  };
}

/**
 * Opciones de ejecución del worker de despacho de outbox.
 */
export interface ProcessPendingEmailsOptions {
  /** Cantidad máxima de notificaciones a reclamar en este lote (por defecto: 10) */
  batchSize?: number;

  /** Límite de reintentos antes de marcar el estado terminal 'failed' (por defecto: 5) */
  maxAttempts?: number;

  /** Minutos de gracia tras los cuales un trabajo en 'processing' se considera abandonado (por defecto: 5) */
  lockTimeoutMinutes?: number;

  /** Timeout de red en milisegundos para cada llamada a Resend antes de abortar (por defecto: 15000 ms) */
  requestTimeoutMs?: number;

  /** Cliente de base de datos inyectable (por defecto: instancia db de Neon) */
  client?: DrizzleDb;

  /** Cliente de Resend inyectable (por defecto: instancia construida con RESEND_API_KEY) */
  resendClient?: ResendClientInterface;

  /** URL base para construir enlaces de cancelación (ej. https://rovebarberia.com) */
  baseUrl?: string;

  /** Remitente configurado (por defecto: RESEND_FROM_EMAIL o 'Rove Barbería <reservas@rovebarberia.com>') */
  fromEmail?: string;
}

/**
 * Detalle de cada notificación procesada por el worker.
 */
export interface ProcessedEmailDetail {
  id: string;
  eventType: string;
  recipient: string;
  status: "sent" | "retried" | "failed";
  providerMessageId?: string;
  error?: string;
  terminal?: boolean;
}

/**
 * Resumen consolidado devuelto por la ejecución del worker.
 * No contiene información personal ni secretos.
 */
export interface ProcessPendingEmailsSummary {
  /** Total de notificaciones reclamadas en el lote */
  claimed: number;

  /** Notificaciones enviadas exitosamente y confirmadas por Resend */
  sent: number;

  /** Notificaciones que sufrieron error recuperable y fueron reprogramadas */
  retried: number;

  /** Notificaciones que alcanzaron error permanente o límite de intentos */
  failed: number;

  /** Detalle no confidencial de cada trabajo procesado */
  details: ProcessedEmailDetail[];
}
