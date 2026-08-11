import crypto from "crypto";

// AES-256-GCM encryption for sensitive settings (e.g. LDAP bind password).
// Format stored in DB: enc:v1:<ivBase64>:<tagBase64>:<cipherBase64>
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const secret = process.env.LDAP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "LDAP_ENCRYPTION_KEY tidak dikonfigurasi (minimal 32 karakter)."
    );
  }
  // Derive a fixed 32-byte key from the secret so any secret length works.
  return crypto.createHash("sha256").update(secret).digest();
}

export function isLdapEncryptionConfigured(): boolean {
  return Boolean(process.env.LDAP_ENCRYPTION_KEY);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(value: string): string {
  if (!value) return "";
  // Backward compatibility: legacy plaintext values are returned as-is.
  if (!value.startsWith(PREFIX)) return value;
  const parts = value.split(":");
  if (parts.length !== 4) return "";
  const [, , tagB64, dataB64] = parts;
  try {
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key or corrupted value — never return ciphertext or throw secrets.
    return "";
  }
}
