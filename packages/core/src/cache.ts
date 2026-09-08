import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeSource, type SourceAnalysis } from './analysis.js';
import type { ScanWarning } from './types.js';

const CACHE_VERSION = 1;
const ANALYZER_VERSION = 'real-world-v5';

interface CacheEntry {
  hash: string;
  analysis: SourceAnalysis;
}

interface AnalysisCacheFile {
  version: number;
  analyzerVersion: string;
  entries: Record<string, CacheEntry>;
}

export interface CacheSource {
  relativePath: string;
  filePath: string;
  source: string;
}

export interface CachedAnalysisResult {
  analyses: Map<string, SourceAnalysis>;
  stats: { hits: number; misses: number; path: string };
  warnings: ScanWarning[];
}

function digest(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function resolveCachePath(root: string, setting: boolean | string): string {
  const resolvedRoot = path.resolve(root);
  const cachePath = path.resolve(resolvedRoot, typeof setting === 'string' ? setting : '.legitagent/cache-v1.json');
  if (cachePath !== resolvedRoot && !cachePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Файл cache должен находиться внутри корня проекта');
  }
  const realRoot = fs.realpathSync(resolvedRoot);
  let existingAncestor = cachePath;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }
  const realAncestor = fs.realpathSync(existingAncestor);
  if (realAncestor !== realRoot && !realAncestor.startsWith(`${realRoot}${path.sep}`)) {
    throw new Error('Файл cache должен находиться внутри корня проекта и не проходить через внешний symlink');
  }
  return cachePath;
}

function loadCache(file: string): AnalysisCacheFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as AnalysisCacheFile;
    if (
      parsed.version !== CACHE_VERSION ||
      parsed.analyzerVersion !== ANALYZER_VERSION ||
      !parsed.entries ||
      typeof parsed.entries !== 'object' ||
      !Object.values(parsed.entries).every((entry) =>
        entry &&
        typeof entry.hash === 'string' &&
        isSourceAnalysis(entry.analysis),
      )
    ) {
      throw new Error('version mismatch');
    }
    return parsed;
  } catch {
    return { version: CACHE_VERSION, analyzerVersion: ANALYZER_VERSION, entries: {} };
  }
}

function isRange(value: unknown): value is { startOffset: number; endOffset: number; snippet: string } {
  if (!value || typeof value !== 'object') return false;
  const range = value as Record<string, unknown>;
  return Number.isInteger(range.startOffset) &&
    Number.isInteger(range.endOffset) &&
    (range.startOffset as number) >= 0 &&
    (range.endOffset as number) >= (range.startOffset as number) &&
    typeof range.snippet === 'string';
}

function isSourceAnalysis(value: unknown): value is SourceAnalysis {
  if (!value || typeof value !== 'object') return false;
  const analysis = value as Partial<SourceAnalysis>;
  return (analysis.adapter === 'html' || analysis.adapter === 'jsx' || analysis.adapter === 'template') &&
    Array.isArray(analysis.forms) && analysis.forms.every(isRange) &&
    Array.isArray(analysis.trackers) && analysis.trackers.every(isRange);
}

function withoutSource(analysis: SourceAnalysis): SourceAnalysis {
  return {
    ...analysis,
    forms: analysis.forms.map((form) => ({ ...form, snippet: '' })),
    trackers: analysis.trackers.map((tracker) => ({ ...tracker, snippet: '' })),
  };
}

function boundedSnippet(value: string): string {
  const compact = value.trim();
  return compact.length <= 1_200 ? compact : `${compact.slice(0, 1_200)}…`;
}

function withSnippets(analysis: SourceAnalysis, source: string): SourceAnalysis {
  const snippet = (startOffset: number, endOffset: number) =>
    boundedSnippet(source.slice(startOffset, Math.min(source.length, endOffset)));
  return {
    ...analysis,
    forms: analysis.forms.map((form) => ({ ...form, snippet: snippet(form.startOffset, form.endOffset) })),
    trackers: analysis.trackers.map((tracker) => ({ ...tracker, snippet: snippet(tracker.startOffset, tracker.endOffset) })),
  };
}

export function analyzeWithCache(
  root: string,
  sources: CacheSource[],
  setting: boolean | string,
): CachedAnalysisResult {
  const file = resolveCachePath(root, setting);
  const cache = loadCache(file);
  const analyses = new Map<string, SourceAnalysis>();
  const nextEntries: Record<string, CacheEntry> = {};
  let hits = 0;
  let misses = 0;

  for (const source of sources) {
    const hash = digest(source.source);
    const cached = cache.entries[source.relativePath];
    const analysis = cached?.hash === hash
      ? (hits += 1, withSnippets(cached.analysis, source.source))
      : (misses += 1, analyzeSource(source.filePath, source.source));
    analyses.set(source.relativePath, analysis);
    nextEntries[source.relativePath] = { hash, analysis: withoutSource(analysis) };
  }

  const warnings: ScanWarning[] = [];
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify({
      version: CACHE_VERSION,
      analyzerVersion: ANALYZER_VERSION,
      entries: nextEntries,
    })}\n`);
    fs.renameSync(temporary, file);
  } catch (error) {
    warnings.push({ file: path.relative(root, file), message: `Не удалось записать cache: ${(error as Error).message}` });
  }

  return { analyses, stats: { hits, misses, path: path.relative(root, file) }, warnings };
}
