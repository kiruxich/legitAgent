import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { ScanWarning } from './types.js';

export interface BaselineFile {
  version: 1;
  generatedAt: string;
  fingerprints: string[];
}

export function createBaseline(fingerprints: string[], now = new Date()): BaselineFile {
  return {
    version: 1,
    generatedAt: now.toISOString(),
    fingerprints: [...new Set(fingerprints)].sort(),
  };
}

export function loadBaseline(
  root: string,
  baselinePath: string | undefined,
): { fingerprints: string[]; warnings: ScanWarning[] } {
  if (!baselinePath) return { fingerprints: [], warnings: [] };
  const resolvedRoot = path.resolve(root);
  const explicitlyAbsolute = path.isAbsolute(baselinePath);
  const file = path.resolve(resolvedRoot, baselinePath);
  if (!explicitlyAbsolute && file !== resolvedRoot && !file.startsWith(`${resolvedRoot}${path.sep}`)) {
    return { fingerprints: [], warnings: [{ file: baselinePath, message: 'Baseline должен находиться внутри корня проекта' }] };
  }
  if (!existsSync(file)) {
    return { fingerprints: [], warnings: [{ file: baselinePath, message: 'Baseline не найден' }] };
  }
  try {
    const realRoot = path.resolve(root);
    const realFile = realpathSync(file);
    const canonicalRoot = realpathSync(realRoot);
    if (!explicitlyAbsolute && realFile !== canonicalRoot && !realFile.startsWith(`${canonicalRoot}${path.sep}`)) {
      return { fingerprints: [], warnings: [{ file: baselinePath, message: 'Baseline не должен проходить через внешний symlink' }] };
    }
  } catch {
    return { fingerprints: [], warnings: [{ file: baselinePath, message: 'Baseline недоступен' }] };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const fingerprints = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as BaselineFile).fingerprints)
        ? (parsed as BaselineFile).fingerprints
        : null;
    if (!fingerprints || !fingerprints.every((item) => typeof item === 'string')) throw new Error();
    return { fingerprints, warnings: [] };
  } catch {
    return { fingerprints: [], warnings: [{ file: baselinePath, message: 'Некорректный baseline' }] };
  }
}
