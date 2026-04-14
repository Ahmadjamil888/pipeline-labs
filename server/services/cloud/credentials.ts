import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): string {
  return (
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    crypto
      .createHash('sha256')
      .update(`${process.env.SUPABASE_URL || 'pipeline-labs'}:${process.env.SUPABASE_SERVICE_KEY || 'dev'}`)
      .digest('hex')
  );
}

export function encryptCredentials(credentials: Record<string, string>): { encrypted: string; nonce: string } {
  const nonce = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(getEncryptionKey(), 'hex'), nonce);
  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted + authTag.toString('hex'),
    nonce: nonce.toString('hex'),
  };
}

export function decryptCredentials(encrypted: string, nonce: string): Record<string, string> {
  const authTagLength = 16;
  const authTag = Buffer.from(encrypted.slice(-authTagLength * 2), 'hex');
  const ciphertext = encrypted.slice(0, -authTagLength * 2);
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(getEncryptionKey(), 'hex'),
    Buffer.from(nonce, 'hex')
  );

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

export function unwrapStoredCredentials(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  if ('encrypted' in payload && 'nonce' in payload) {
    return decryptCredentials(
      String((payload as { encrypted: unknown }).encrypted),
      String((payload as { nonce: unknown }).nonce)
    );
  }

  return payload as Record<string, string>;
}

export function maskCredentials(creds: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(creds)) {
    if (typeof value !== 'string') {
      masked[key] = value as unknown as string;
      continue;
    }

    if (value.length <= 4) {
      masked[key] = '****';
      continue;
    }

    masked[key] = value.slice(0, 4) + '****' + value.slice(-4);
  }

  return masked;
}
