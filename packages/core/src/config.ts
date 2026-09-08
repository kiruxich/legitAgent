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
const CONFIG_KEYS = new Set(['$schema', 'ignore', 'disabled', 'severity', 'baseline', 'suppress', 'cache']);

export function defaultScanConfig(): ScanConfig {
  return { ignore: [], disabled: [], severity: {}, suppress: [] };
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
  for (const key of Object.keys(obj)) {
    if (!CONFIG_KEYS.has(key)) warnings.push({ file: 'legitagent.config.json', message: `Неизвестное поле: ${key}` });
  }
  if (Array.isArray(obj.ignore)) config.ignore = obj.ignore.filter((x) => typeof x === 'string');
  if (Array.isArray(obj.disabled)) config.disabled = obj.disabled.filter((x) => typeof x === 'string');
  if (obj.severity && typeof obj.severity === 'object' && !Array.isArray(obj.severity)) {
    for (const [id, value] of Object.entries(obj.severity as Record<string, unknown>)) {
      if (typeof value === 'string' && SEVERITIES.has(value as Severity)) config.severity[id] = value as Severity;
      else warnings.push({ file: 'legitagent.config.json', message: `Некорректная серьёзность: ${id}` });
    }
  }
  if (typeof obj.baseline === 'string' && obj.baseline.trim()) config.baseline = obj.baseline.trim();
  if (typeof obj.cache === 'boolean') config.cache = obj.cache;
  else if (typeof obj.cache === 'string' && obj.cache.trim()) config.cache = obj.cache.trim();
  else if (obj.cache !== undefined) warnings.push({ file: 'legitagent.config.json', message: 'cache должен быть boolean или путём' });
  if (Array.isArray(obj.suppress)) {
    for (const [index, value] of obj.suppress.entries()) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        warnings.push({ file: 'legitagent.config.json', message: `Некорректное подавление #${index + 1}` });
        continue;
      }
      const item = value as Record<string, unknown>;
      if (typeof item.reason !== 'string' || !item.reason.trim()) {
        warnings.push({ file: 'legitagent.config.json', message: `Для подавления #${index + 1} нужна причина` });
        continue;
      }
      const suppression = {
        reason: item.reason.trim(),
        ...(typeof item.fingerprint === 'string' ? { fingerprint: item.fingerprint } : {}),
        ...(typeof item.ruleId === 'string' ? { ruleId: item.ruleId } : {}),
        ...(typeof item.file === 'string' ? { file: item.file } : {}),
        ...(typeof item.expires === 'string' ? { expires: item.expires } : {}),
      };
      if (!suppression.fingerprint && !suppression.ruleId) {
        warnings.push({ file: 'legitagent.config.json', message: `Подавление #${index + 1} должно содержать fingerprint или ruleId` });
        continue;
      }
      config.suppress.push(suppression);
    }
  }
  return { config, warnings };
}
