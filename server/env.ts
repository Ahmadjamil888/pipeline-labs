import fs from 'fs';
import path from 'path';

let loaded = false;

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const separator = trimmed.indexOf('=');
  if (separator === -1) return null;

  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function ensureEnvLoaded(): void {
  if (loaded) return;

  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    loaded = true;
    return;
  }

  const contents = fs.readFileSync(envPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;

    const [key, value] = parsed;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  loaded = true;
}

export function getServerPort(): number {
  ensureEnvLoaded();

  const rawPort = Number(process.env.SERVER_PORT || process.env.PORT || 3001);
  if (rawPort === 8080 && process.env.NODE_ENV !== 'production') {
    return 3001;
  }

  return Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 3001;
}

export function getAllowedOrigins(): string[] {
  ensureEnvLoaded();

  const configured = (process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set([
      ...configured,
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'https://pipelinelabs-ashen.vercel.app',
    ])
  );
}
