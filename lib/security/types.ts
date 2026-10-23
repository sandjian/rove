/**
 * Representa el paquete de datos cifrados mediante AES-256-GCM.
 * Todos los componentes binarios se serializan en cadenas hexadecimales.
 */
export interface EncryptedPayload {
  /**
   * Vector de inicialización (IV / nonce) de 12 bytes (96 bits)
   * serializado como 24 caracteres hexadecimales.
   */
  iv: string;

  /**
   * Tag de autenticación GCM de 16 bytes (128 bits)
   * serializado como 32 caracteres hexadecimales.
   */
  tag: string;

  /**
   * Texto cifrado (ciphertext) resultante serializado en hexadecimal.
   */
  ciphertext: string;
}
