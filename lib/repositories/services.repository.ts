import { eq, and, asc } from "drizzle-orm";
import { services, type Service } from "../db/schema";
import { db } from "../db";
import type { DatabaseClient } from "./types";

/**
 * Obtiene todos los servicios activos del catálogo ordenados por sortOrder y nombre.
 *
 * @param client - Cliente de base de datos (por defecto: db de Neon).
 * @returns Lista de servicios activos.
 * @throws {Error} Si la consulta falla.
 */
export async function getActiveServices(
  client: DatabaseClient = db
): Promise<Service[]> {
  try {
    const result = await client.query.services.findMany({
      where: eq(services.isActive, true),
      orderBy: [asc(services.sortOrder), asc(services.name)],
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    throw new Error(`Error al consultar catálogo de servicios activos: ${message}`);
  }
}

/**
 * Obtiene un servicio activo específico por su identificador.
 * Si el servicio no existe o se encuentra inactivo, retorna null.
 *
 * @param serviceId - Identificador único (UUID) del servicio.
 * @param client - Cliente de base de datos (por defecto: db de Neon).
 * @returns El servicio activo o null si no existe o está inactivo.
 * @throws {Error} Si el ID es inválido o la consulta falla.
 */
export async function getActiveServiceById(
  serviceId: string,
  client: DatabaseClient = db
): Promise<Service | null> {
  if (typeof serviceId !== "string" || serviceId.trim().length === 0) {
    throw new Error("serviceId debe ser una cadena de texto no vacía.");
  }

  try {
    const result = await client.query.services.findFirst({
      where: and(eq(services.id, serviceId.trim()), eq(services.isActive, true)),
    });

    return result ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    throw new Error(`Error al consultar servicio por ID (${serviceId}): ${message}`);
  }
}
