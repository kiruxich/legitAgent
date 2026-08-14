import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ScanConfig, ScanWarning, Severity } from './types.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const SEVERITIES = new Set<Severity>(['high', 'medium', 'low']);

export function defaultScanConfig(): ScanConfig {
  return { ignore: [], disabled: [], severity: {} };
}

export function loadScanConfig(root: string): { config: ScanConfig; warnings: ScanWarning[] } {
  const file = path.join(root, 'legitagent.config.json');
  if (!existsSync(file)) return { config: defaultScanConfig(), warnings: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new ConfigError('Некорректный legitagent.config.json');
  }
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const config = defaultScanConfig();
  const warnings: ScanWarning[] = [];
  if (Array.isArray(obj.ignore)) config.ignore = obj.ignore.filter((x) => typeof x === 'string');
  if (Array.isArray(obj.disabled)) config.disabled = obj.disabled.filter((x) => typeof x === 'string');
  if (obj.severity && typeof obj.severity === 'object' && !Array.isArray(obj.severity)) {
    for (const [id, value] of Object.entries(obj.severity as Record<string, unknown>)) {
      if (typeof value === 'string' && SEVERITIES.has(value as Severity)) config.severity[id] = value as Severity;
      else warnings.push({ file: 'legitagent.config.json', message: `Некорректная серьёзность: ${id}` });
    }
  }
  return { config, warnings };
}
