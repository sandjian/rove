import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateCancellationToken,
  hashCancellationToken,
} from "../lib/security/tokens";

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
