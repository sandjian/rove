import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  generateCancellationToken,
  hashCancellationToken,
} from "../lib/security/tokens";
import {
  encryptOutboxPayload,
  decryptOutboxPayload,
  getOutboxEncryptionKey,
} from "../lib/security/encryption";
import type { EncryptedPayload } from "../lib/security/types";

describe("Seguridad — Tokens y Hashes de Cancelación", () => {
  it("el token generado tiene la longitud esperada (64 caracteres hexadecimales / 32 bytes)", () => {
    const token = generateCancellationToken();
    assert.equal(typeof token, "string");
    assert.equal(token.length, 64);
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  it("dos generaciones independientes producen tokens distintos", () => {
    const token1 = generateCancellationToken();
    const token2 = generateCancellationToken();
    assert.notEqual(token1, token2);
  });

  it("el hash SHA-256 es determinista para una misma entrada", () => {
    const token = generateCancellationToken();
    const hash1 = hashCancellationToken(token);
    const hash2 = hashCancellationToken(token);

    assert.equal(typeof hash1, "string");
    assert.equal(hash1.length, 64);
    assert.equal(hash1, hash2);
  });

  it("entradas diferentes producen hashes diferentes", () => {
    const token1 = generateCancellationToken();
    const token2 = generateCancellationToken();
    const hash1 = hashCancellationToken(token1);
    const hash2 = hashCancellationToken(token2);

    assert.notEqual(hash1, hash2);
  });

  it("el token original y el hash son valores distintos", () => {
    const token = generateCancellationToken();
    const hash = hashCancellationToken(token);

    assert.notEqual(token, hash);
  });

  it("rechaza tokens vacíos o no válidos sin exponer datos", () => {
    assert.throws(() => hashCancellationToken(""), {
      message: /debe ser una cadena de texto no vacía/,
    });
    // @ts-expect-error probando entrada con tipo inválido en runtime
    assert.throws(() => hashCancellationToken(null), {
      message: /debe ser una cadena de texto no vacía/,
    });
    // @ts-expect-error probando entrada undefined en runtime
    assert.throws(() => hashCancellationToken(undefined), {
      message: /debe ser una cadena de texto no vacía/,
    });
  });
});

describe("Seguridad — Cifrado y Descifrado AES-256-GCM", () => {
  // Clave de prueba de 32 bytes (256 bits) generada criptográficamente para el suite
  const testKeyA = randomBytes(32);
  const testKeyB = randomBytes(32);

  it("cifrar y descifrar un texto devuelve exactamente el texto original", () => {
    const originalText = "cancel_token_sample_f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5";
    const encrypted = encryptOutboxPayload(originalText, testKeyA);

    assert.equal(typeof encrypted.iv, "string");
    assert.equal(encrypted.iv.length, 24); // 12 bytes hex
    assert.equal(typeof encrypted.tag, "string");
    assert.equal(encrypted.tag.length, 32); // 16 bytes hex
    assert.equal(typeof encrypted.ciphertext, "string");

    const decrypted = decryptOutboxPayload(encrypted, testKeyA);
    assert.equal(decrypted, originalText);
  });

  it("cifrar dos veces el mismo texto genera IVs y ciphertexts diferentes", () => {
    const text = "https://rove.com.ar/cancelar/abc123token456";
    const enc1 = encryptOutboxPayload(text, testKeyA);
    const enc2 = encryptOutboxPayload(text, testKeyA);

    assert.notEqual(enc1.iv, enc2.iv);
    assert.notEqual(enc1.ciphertext, enc2.ciphertext);
    assert.notEqual(enc1.tag, enc2.tag);

    // Ambos deben descifrar al mismo texto original
    assert.equal(decryptOutboxPayload(enc1, testKeyA), text);
    assert.equal(decryptOutboxPayload(enc2, testKeyA), text);
  });

  it("una modificación del ciphertext provoca un fallo de autenticación", () => {
    const text = "mensaje-confidencial";
    const encrypted = encryptOutboxPayload(text, testKeyA);

    // Alterar un carácter del ciphertext
    const tamperedChar = encrypted.ciphertext[0] === "a" ? "b" : "a";
    const tamperedCiphertext = tamperedChar + encrypted.ciphertext.slice(1);

    const tamperedPayload: EncryptedPayload = {
      ...encrypted,
      ciphertext: tamperedCiphertext,
    };

    assert.throws(() => decryptOutboxPayload(tamperedPayload, testKeyA), {
      message: /Fallo de autenticación o descifrado/,
    });
  });

  it("un tag incorrecto provoca un fallo de autenticación", () => {
    const text = "mensaje-confidencial";
    const encrypted = encryptOutboxPayload(text, testKeyA);

    // Alterar el tag de autenticación
    const tamperedTag =
      (encrypted.tag[0] === "0" ? "1" : "0") + encrypted.tag.slice(1);

    const tamperedPayload: EncryptedPayload = {
      ...encrypted,
      tag: tamperedTag,
    };

    assert.throws(() => decryptOutboxPayload(tamperedPayload, testKeyA), {
      message: /Fallo de autenticación o descifrado/,
    });
  });

  it("un IV de longitud incorrecta es rechazado", () => {
    const text = "mensaje";
    const encrypted = encryptOutboxPayload(text, testKeyA);

    // IV de 10 bytes (20 hex) en lugar de 12 bytes (24 hex)
    const invalidIvPayload: EncryptedPayload = {
      ...encrypted,
      iv: encrypted.iv.slice(0, 20),
    };

    assert.throws(() => decryptOutboxPayload(invalidIvPayload, testKeyA), {
      message: /IV inválido/,
    });
  });

  it("un payload con formato inválido es rechazado", () => {
    // @ts-expect-error comprobación de payload nulo en runtime
    assert.throws(() => decryptOutboxPayload(null, testKeyA), {
      message: /Payload de descifrado inválido/,
    });

    // @ts-expect-error comprobación de campos faltantes
    assert.throws(() => decryptOutboxPayload({ iv: "abc" }, testKeyA), {
      message: /Payload de descifrado inválido/,
    });

    const nonHexPayload: EncryptedPayload = {
      iv: "zzzzzzzzzzzzzzzzzzzzzzzz",
      tag: "0123456789abcdef0123456789abcdef",
      ciphertext: "abcd",
    };

    assert.throws(() => decryptOutboxPayload(nonHexPayload, testKeyA), {
      message: /IV inválido/,
    });
  });

  it("una clave diferente de la utilizada para cifrar no permite descifrar", () => {
    const secretText = "token-secreto-para-el-correo";
    const encrypted = encryptOutboxPayload(secretText, testKeyA);

    // Intentar descifrar con testKeyB distinta
    assert.throws(() => decryptOutboxPayload(encrypted, testKeyB), {
      message: /Fallo de autenticación o descifrado/,
    });
  });

  it("no devuelve datos parcialmente descifrados ante error de autenticación", () => {
    const secretText = "este texto largo no debe filtrarse bajo ninguna circunstancia";
    const encrypted = encryptOutboxPayload(secretText, testKeyA);

    // Corromper el tag
    const corruptedPayload: EncryptedPayload = {
      ...encrypted,
      tag: "f".repeat(32),
    };

    let result: string | null = null;
    try {
      result = decryptOutboxPayload(corruptedPayload, testKeyA);
    } catch {
      // Esperado
    }

    assert.equal(result, null);
  });
});

describe("Seguridad — Validación de OUTBOX_ENCRYPTION_KEY", () => {
  const originalEnv = process.env.OUTBOX_ENCRYPTION_KEY;

  it("falla si la variable de entorno no está configurada", () => {
    delete process.env.OUTBOX_ENCRYPTION_KEY;
    assert.throws(() => getOutboxEncryptionKey(), {
      message: /OUTBOX_ENCRYPTION_KEY no está configurada/,
    });
  });

  it("falla si la clave tiene menos de 64 caracteres hex (32 bytes)", () => {
    process.env.OUTBOX_ENCRYPTION_KEY = "0123456789abcdef"; // 16 caracteres
    assert.throws(() => getOutboxEncryptionKey(), {
      message: /se esperaban exactamente 64 caracteres/,
    });
  });

  it("falla si la clave contiene caracteres no hexadecimales", () => {
    process.env.OUTBOX_ENCRYPTION_KEY = "g".repeat(64);
    assert.throws(() => getOutboxEncryptionKey(), {
      message: /no pertenecen al formato hexadecimal/,
    });
  });

  it("falla si la clave utiliza patrones triviales o inseguros", () => {
    process.env.OUTBOX_ENCRYPTION_KEY = "0".repeat(64);
    assert.throws(() => getOutboxEncryptionKey(), {
      message: /OUTBOX_ENCRYPTION_KEY insegura/,
    });
  });

  it("obtiene un Buffer válido de 32 bytes cuando la clave es correcta", () => {
    const validKeyHex = randomBytes(32).toString("hex");
    process.env.OUTBOX_ENCRYPTION_KEY = validKeyHex;

    const buffer = getOutboxEncryptionKey();
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.length, 32);
    assert.equal(buffer.toString("hex"), validKeyHex);
  });

  it("cifra y descifra usando la variable de entorno automáticamente", () => {
    const validKeyHex = randomBytes(32).toString("hex");
    process.env.OUTBOX_ENCRYPTION_KEY = validKeyHex;

    const message = "prueba_con_variable_de_entorno";
    const encrypted = encryptOutboxPayload(message);
    const decrypted = decryptOutboxPayload(encrypted);

    assert.equal(decrypted, message);
  });

  // Restaurar entorno
  process.env.OUTBOX_ENCRYPTION_KEY = originalEnv;
});
