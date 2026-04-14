import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for encrypting GSC refresh tokens at rest.
// Key must be 32 bytes, provided via GSC_TOKEN_ENCRYPTION_KEY (hex-encoded).
//
// Format of encrypted string: base64(iv || authTag || ciphertext)
// - iv: 12 bytes (GCM recommended)
// - authTag: 16 bytes
// - ciphertext: variable

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.GSC_TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "GSC_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("encrypted blob too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
