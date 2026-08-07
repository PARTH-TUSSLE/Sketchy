import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is not set or too short. Set a value of at least 32 chars in .env"
    );
  }
  return secret;
}

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, KEY_LENGTH, SCRYPT_PARAMS).toString(
    "hex"
  );
  return `${salt}$${derived}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split("$");
  if (!salt || !expectedHex) {
    return false;
  }
  try {
    const derived = scryptSync(plain, salt, KEY_LENGTH, SCRYPT_PARAMS).toString(
      "hex"
    );
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(derived, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}