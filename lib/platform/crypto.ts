import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getMasterKey(): Buffer {
  const secret = process.env.PLATFORM_SECRETS_KEY;
  if (!secret) {
    throw new Error(
      'PLATFORM_SECRETS_KEY environment variable is required. ' +
        'This key encrypts all tenant database credentials — it must never fall back to a default value.'
    );
  }
  // Hash to ensure key is exactly 32 bytes (256 bits)
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plain text database password using AES-256-GCM.
 * Output format: iv_hex:tag_hex:ciphertext_hex
 */
export function encryptPassword(plainText: string): string {
  const key = getMasterKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted database password string.
 */
export function decryptPassword(encryptedString: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted password payload format.');
  }

  const key = getMasterKey();
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export const encryptCredential = encryptPassword;
export const decryptCredential = decryptPassword;

