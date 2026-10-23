import { randomBytes, createHash } from "node:crypto";

/**
 * Longitud en bytes del token de cancelación criptográfico.
 * 32 bytes proveen 256 bits de entropía.
 */
const TOKEN_BYTES_LENGTH = 32;

/**
 * Genera un token de cancelación criptográficamente seguro de 256 bits (32 bytes)
 * codificado como una cadena hexadecimal de 64 caracteres.
 *
 * Cumple con los requisitos de URL-safety para enlaces de cancelación y alta entropía.
 *
 * @returns Token aleatorio en formato hexadecimal (64 caracteres).
 */
export function generateCancellationToken(): string {
  const buffer = randomBytes(TOKEN_BYTES_LENGTH);
  return buffer.toString("hex");
}

/**
 * Calcula el hash SHA-256 de un token de cancelación de manera determinista.
 *
 * El valor resultante se almacena en la base de datos (appointments.cancellation_token_hash)
 * para validar solicitudes de cancelación sin persistir el token en texto plano.
 *
 * @param token - Token original en texto plano.
 * @returns Hash SHA-256 en formato hexadecimal de 64 caracteres.
 * @throws {Error} Si el token es inválido o está vacío (sin exponer datos sensibles en el mensaje).
 */
export function hashCancellationToken(token: string): string {
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new Error("El token a hashear debe ser una cadena de texto no vacía.");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}
