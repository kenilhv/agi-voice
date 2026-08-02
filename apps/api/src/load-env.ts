import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

/** Load a local, ignored .env whether the API is started from the repo root or its package. */
export function loadVoiceFuzzEnv(): void {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
  const envPath = candidates.find((candidate) => existsSync(candidate));
  if (envPath) loadEnvFile(envPath);
}
