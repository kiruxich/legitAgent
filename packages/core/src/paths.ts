import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function defaultRulesDir(): string {
  return path.join(packageRoot(), 'rules');
}

export function defaultLegalDir(): string {
  return path.join(packageRoot(), 'legal');
}
