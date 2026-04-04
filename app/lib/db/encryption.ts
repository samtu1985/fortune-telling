import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // Fallback: use a deterministic key derived from another secret
    // This is less secure but avoids breaking when ENCRYPTION_KEY is not set
    const fallback = process.env.AUTH_SECRET || "default-encryption-key-change-me";
    return Buffer.from(fallback.padEnd(32, "0").slice(0, 32), "utf-8");
  }
  // Key should be 32 bytes (256 bits), hex-encoded (64 chars) or base64
  if (key.length === 64) return Buffer.from(key, "hex");
  if (key.length === 44) return Buffer.from(key, "base64");
  return Buffer.from(key.padEnd(32, "0").slice(0, 32), "utf-8");
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";
  const key = getKey();
  const [ivHex, tagHex, encHex] = ciphertext.split(":");
  if (!ivHex || !tagHex || !encHex) return ""; // not encrypted, return empty
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf-8");
}
