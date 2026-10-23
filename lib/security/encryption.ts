import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import type { EncryptedPayload } from "./types";

/**
 * Algoritmo de cifrado autenticado estándar para datos en reposo.
 */
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

/**
 * Tamaño requerido de la clave en bytes (256 bits = 32 bytes).
 */
const KEY_BYTES_LENGTH = 32;

/**
 * Tamaño requerido de la clave en caracteres hexadecimales.
 */
const KEY_HEX_LENGTH = KEY_BYTES_LENGTH * 2; // 64 caracteres

/**
 * Tamaño estándar del IV / nonce para AES-GCM (96 bits = 12 bytes).
 */
const IV_BYTES_LENGTH = 12;
const IV_HEX_LENGTH = IV_BYTES_LENGTH * 2; // 24 caracteres

/**
 * Tamaño estándar del tag de autenticación en AES-GCM (128 bits = 16 bytes).
 */
const TAG_BYTES_LENGTH = 16;
const TAG_HEX_LENGTH = TAG_BYTES_LENGTH * 2; // 32 caracteres

/**
 * Patrones de claves no seguras o de ejemplo prohibidos en la configuración.
 */
const FORBIDDEN_KEY_PATTERNS = [
  /^0+$/i, // Todo ceros
  /^f+$/i, // Todo efe
  /^(0123456789abcdef){4}$/i, // Secuencia trivial
  /^(abcdef0123456789){4}$/i,
];

/**
 * Obtiene y valida la clave de cifrado simétrica desde la variable de entorno
 * `OUTBOX_ENCRYPTION_KEY`.
 *
 * @returns Buffer de 32 bytes listo para su uso con AES-256-GCM.
 * @throws {Error} Si la variable no está configurada, no es hexadecimal, no tiene 32 bytes o es insegura.
 */
export function getOutboxEncryptionKey(): Buffer {
  const keyHex = process.env.OUTBOX_ENCRYPTION_KEY;

  if (!keyHex || typeof keyHex !== "string") {
    throw new Error(
      "La variable de entorno OUTBOX_ENCRYPTION_KEY no está configurada. Debe ser una cadena hexadecimal de 64 caracteres."
    );
  }

  const trimmedKey = keyHex.trim();

  if (trimmedKey.length !== KEY_HEX_LENGTH) {
    throw new Error(
      `OUTBOX_ENCRYPTION_KEY inválida: se esperaban exactamente ${KEY_HEX_LENGTH} caracteres hexadecimales (32 bytes), pero se recibieron ${trimmedKey.length}.`
    );
  }

  const isHexOnly = /^[0-9a-fA-F]+$/.test(trimmedKey);
  if (!isHexOnly) {
    throw new Error(
      "OUTBOX_ENCRYPTION_KEY inválida: contiene caracteres que no pertenecen al formato hexadecimal (0-9, a-f)."
    );
  }

  // Prevenir valores de ejemplo o triviales
  for (const pattern of FORBIDDEN_KEY_PATTERNS) {
    if (pattern.test(trimmedKey)) {
      throw new Error(
        "OUTBOX_ENCRYPTION_KEY insegura: no se permiten valores de ejemplo o patrones triviales."
      );
    }
  }

  const keyBuffer = Buffer.from(trimmedKey, "hex");
  if (keyBuffer.length !== KEY_BYTES_LENGTH) {
    throw new Error(
      `OUTBOX_ENCRYPTION_KEY inválida: el buffer decodificado tiene ${keyBuffer.length} bytes en lugar de los ${KEY_BYTES_LENGTH} requeridos.`
    );
  }

  return keyBuffer;
}

/**
 * Cifra un texto en claro utilizando AES-256-GCM con un IV aleatorio de 12 bytes.
 *
 * Genera un vector de inicialización único para cada llamada y produce un tag
 * de autenticación de 16 bytes.
 *
 * @param plaintext - Texto en claro a cifrar.
 * @param keyOverride - Buffer de clave opcional (si se omite, se valida y obtiene de OUTBOX_ENCRYPTION_KEY).
 * @returns Objeto EncryptedPayload con iv, tag y ciphertext en formato hexadecimal.
 */
export function encryptOutboxPayload(
  plaintext: string,
  keyOverride?: Buffer
): EncryptedPayload {
  if (typeof plaintext !== "string") {
    throw new Error("El texto a cifrar debe ser una cadena de texto.");
  }

  const key = keyOverride ?? getOutboxEncryptionKey();
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES_LENGTH) {
    throw new Error("Clave de cifrado inválida: debe ser un Buffer de 32 bytes.");
  }

  // IV aleatorio de 12 bytes para cada operación (sin reutilización)
  const iv = randomBytes(IV_BYTES_LENGTH);

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertextPart1 = cipher.update(plaintext, "utf8", "hex");
  const ciphertextPart2 = cipher.final("hex");
  const ciphertext = ciphertextPart1 + ciphertextPart2;

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    tag: authTag.toString("hex"),
    ciphertext,
  };
}

/**
 * Descifra y valida la autenticidad de un paquete cifrado mediante AES-256-GCM.
 *
 * Si el ciphertext, el IV, el tag o la clave han sido alterados o son incorrectos,
 * la operación falla de manera atómica sin retornar texto parcial.
 *
 * @param payload - Objeto con iv, tag y ciphertext en hexadecimal.
 * @param keyOverride - Buffer de clave opcional (si se omite, se valida y obtiene de OUTBOX_ENCRYPTION_KEY).
 * @returns Texto original en claro.
 * @throws {Error} Si el payload es inválido o falla la verificación criptográfica.
 */
export function decryptOutboxPayload(
  payload: EncryptedPayload,
  keyOverride?: Buffer
): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de descifrado inválido: se esperaba un objeto.");
  }

  const { iv, tag, ciphertext } = payload;

  if (
    typeof iv !== "string" ||
    typeof tag !== "string" ||
    typeof ciphertext !== "string"
  ) {
    throw new Error(
      "Payload de descifrado inválido: los campos 'iv', 'tag' y 'ciphertext' son obligatorios y deben ser cadenas."
    );
  }

  if (iv.length !== IV_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(iv)) {
    throw new Error(
      `IV inválido: debe ser una cadena hexadecimal de exactamente ${IV_HEX_LENGTH} caracteres (12 bytes).`
    );
  }

  if (tag.length !== TAG_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(tag)) {
    throw new Error(
      `Tag de autenticación inválido: debe ser una cadena hexadecimal de exactamente ${TAG_HEX_LENGTH} caracteres (16 bytes).`
    );
  }

  if (ciphertext.length > 0 && !/^[0-9a-fA-F]+$/.test(ciphertext)) {
    throw new Error(
      "Ciphertext inválido: debe ser una cadena en formato hexadecimal."
    );
  }

  const key = keyOverride ?? getOutboxEncryptionKey();
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES_LENGTH) {
    throw new Error("Clave de descifrado inválida: debe ser un Buffer de 32 bytes.");
  }

  const ivBuffer = Buffer.from(iv, "hex");
  const tagBuffer = Buffer.from(tag, "hex");
  const ciphertextBuffer = Buffer.from(ciphertext, "hex");

  try {
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(tagBuffer);

    const decryptedPart1 = decipher.update(ciphertextBuffer, undefined, "utf8");
    const decryptedPart2 = decipher.final("utf8");

    return decryptedPart1 + decryptedPart2;
  } catch {
    // Error deliberadamente genérico para no filtrar detalles internos ni texto parcial
    throw new Error(
      "Fallo de autenticación o descifrado: el contenido cifrado, el tag o la clave son inválidos."
    );
  }
}
