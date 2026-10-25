import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "rove_admin_session";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

export interface AdminSession {
  userId: string;
  email: string;
  createdAt: number;
}

function getSessionKey(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET || "rove-barberia-admin-secret-development-only-change-in-prod";
  // Derivamos clave simétrica fija de 32 bytes con scrypt
  return scryptSync(secret, "rove_salt_admin_auth", 32);
}

/**
 * Cifra la sesión en una cookie token segura AES-256-GCM.
 */
export function sealSession(session: AdminSession): string {
  const key = getSessionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const payload = JSON.stringify(session);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Descifra y valida la cookie token de sesión.
 */
export function unsealSession(token: string): AdminSession | null {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");

    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return null;

    const key = getSessionKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    const session: AdminSession = JSON.parse(decrypted.toString("utf8"));

    // Expiración
    const ageSeconds = (Date.now() - session.createdAt) / 1000;
    if (ageSeconds > MAX_AGE_SECONDS) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Establece la cookie de sesión HTTP-only.
 */
export async function setAdminSessionCookie(session: AdminSession) {
  const cookieStore = await cookies();
  const sealed = sealSession(session);

  cookieStore.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Obtiene la sesión actual de la cookie o null si no está autenticado.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return unsealSession(token);
}

/**
 * Elimina la cookie de sesión para logout.
 */
export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
