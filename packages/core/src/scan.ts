import { readFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultCatalog } from './catalog.js';
import { analyzeSource } from './analysis.js';
import { analyzeWithCache } from './cache.js';
import { loadBaseline } from './baseline.js';
import { ConfigError, loadScanConfig } from './config.js';
import { disclaimer } from './disclaimer.js';
import { discoverSourceFiles } from './discover.js';
import { localizeFinding } from './detectors/helpers.js';
import { detectCookieNoReject } from './detectors/cookie-no-reject.js';
import { detectConsumerShop } from './detectors/consumer-shop.js';
import { detectEridMissing } from './detectors/erid-missing.js';
import { detectFormNoConsent } from './detectors/form-no-consent.js';
import { detectFormNoPolicyLink } from './detectors/form-no-policy-link.js';
import { detectFormPrecheckedConsent } from './detectors/form-prechecked-consent.js';
import { detectForeignTracker } from './detectors/foreign-tracker.js';
import { detectLocalizationUnclear, detectRknNotice } from './detectors/org-checklist.js';
import { detectPolicyIncomplete } from './detectors/policy-incomplete.js';
import { detectPolicyNoLink } from './detectors/policy-no-link.js';
import { detectTrackerNoConsent } from './detectors/tracker-no-consent.js';
import type { Catalog, ExplainResult, Finding, Lang, Rule, ScanOptions, ScanResult, ScanWarning } from './types.js';

export interface SourceFile {
  relativePath: string;
  source: string;
  filePath?: string;
  analysis?: ReturnType<typeof analyzeSource>;
}

function looksBroken(filePath: string, source: string): boolean {
  if (/\.(vue|svelte|astro)$/i.test(filePath)) return false;
  return (source.match(/{/g) ?? []).length !== (source.match(/}/g) ?? []).length;
}

export function scanSources(files: SourceFile[], catalog: Catalog = defaultCatalog()): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const filePath = file.filePath ?? file.relativePath;
    const args = {
      filePath,
      relativePath: file.relativePath,
      source: file.source,
      catalog,
      analysis: file.analysis ?? analyzeSource(filePath, file.source),
    };
    findings.push(
      ...detectFormNoConsent(args),
      ...detectFormPrecheckedConsent(args),
      ...detectFormNoPolicyLink(args),
      ...detectTrackerNoConsent(args),
      ...detectForeignTracker(args),
      ...detectCookieNoReject(args),
      ...detectEridMissing(args),
    );
  }
  if (files.length > 0) {
    findings.push(...detectPolicyNoLink({ catalog, files }));
    findings.push(...detectPolicyIncomplete({ catalog, files }));
    findings.push(...detectLocalizationUnclear({ catalog, files }));
    findings.push(...detectRknNotice({ catalog, files }));
    findings.push(...detectConsumerShop({ catalog, files }));
  }
  return findings;
}

export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = f.fingerprint;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*');
  return new RegExp(`^${escaped}$`).test(value.replace(/\\/g, '/'));
}

function inlineSuppressionReason(finding: Finding, source: string | undefined): string | undefined {
  if (!source || finding.line === null) return undefined;
  const lines = source.split('\n');
  const candidates = [lines[finding.line - 1], lines[finding.line - 2]].filter(Boolean) as string[];
  for (const line of candidates) {
    const match = line.match(/legitagent-ignore(?:-next-line)?\s+([A-Z0-9.*_-]+)\s+--\s+(.+)/i);
    if (match && (match[1] === finding.ruleId || match[1] === '*')) return match[2]?.trim();
  }
  return undefined;
}

function configuredSuppressionReason(
  finding: Finding,
  suppressions: ReturnType<typeof loadScanConfig>['config']['suppress'],
  warnings: ScanWarning[],
): string | undefined {
  for (const suppression of suppressions) {
    if (suppression.expires) {
      const expiry = Date.parse(suppression.expires);
      if (!Number.isFinite(expiry)) {
        warnings.push({ file: 'legitagent.config.json', message: `Некорректная дата expires: ${suppression.expires}` });
        continue;
      }
      if (expiry < Date.now()) continue;
    }
    if (suppression.fingerprint && suppression.fingerprint !== finding.fingerprint) continue;
    if (suppression.ruleId && suppression.ruleId !== finding.ruleId) continue;
    if (suppression.file && !wildcardMatch(suppression.file, finding.file)) continue;
    return suppression.reason;
  }
  return undefined;
}

export const UNSAFE_ROOT_MESSAGE =
  'Не сканирую домашний каталог или корень диска. Укажите папку проекта.';

function canonicalPath(value: string): string {
  const resolved = path.resolve(value);
  try {
    return realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

export function isUnsafeScanRoot(root: string, home = os.homedir()): boolean {
  const canonicalRoot = canonicalPath(root);
  return canonicalRoot === path.parse(canonicalRoot).root || canonicalRoot === canonicalPath(home);
}

export function assertSafeScanRoot(root: string, home = os.homedir()): void {
  if (isUnsafeScanRoot(root, home)) throw new ConfigError(UNSAFE_ROOT_MESSAGE);
}

function normalizeChangedFiles(root: string, changedFiles: string[] | undefined, warnings: ScanWarning[]): Set<string> | undefined {
  if (changedFiles === undefined) return undefined;
  const resolvedRoot = path.resolve(root);
  const normalized = new Set<string>();
  for (const input of changedFiles) {
    if (!input.trim()) continue;
    const absolute = path.resolve(resolvedRoot, input);
    const relative = path.relative(resolvedRoot, absolute);
    if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      warnings.push({ file: input, message: 'Changed file находится вне корня проекта и проигнорирован' });
      continue;
    }
    if (relative) normalized.add(relative.replace(/\\/g, '/'));
  }
  return normalized;
}

export async function scanProject(
  root: string,
  catalog = defaultCatalog(),
  options: ScanOptions = {},
): Promise<ScanResult> {
  assertSafeScanRoot(root);
  const lang: Lang = options.lang === 'en' ? 'en' : 'ru';
  const { config, warnings: configWarnings } = loadScanConfig(root);
  const warnings: ScanWarning[] = [...configWarnings];
  const loadedBaseline = options.baselineFingerprints
    ? { fingerprints: options.baselineFingerprints, warnings: [] }
    : loadBaseline(root, config.baseline);
  warnings.push(...loadedBaseline.warnings);
  const baseline = new Set(loadedBaseline.fingerprints);

  for (const id of config.disabled) {
    if (!catalog.rules.some((r) => r.id === id)) {
      warnings.push({ file: 'legitagent.config.json', message: `Неизвестное правило: ${id}` });
    }
  }
  for (const id of Object.keys(config.severity)) {
    if (!catalog.rules.some((r) => r.id === id)) {
      warnings.push({ file: 'legitagent.config.json', message: `Неизвестное правило: ${id}` });
    }
  }

  const files = await discoverSourceFiles(root, config.ignore);
  const changed = normalizeChangedFiles(root, options.changedFiles, warnings);
  const loaded: SourceFile[] = [];

  for (const filePath of files) {
    const relativePath = (path.relative(root, filePath) || path.basename(filePath)).replace(/\\/g, '/');
    let source: string;
    try {
      source = readFileSync(filePath, 'utf8');
    } catch (err) {
      warnings.push({ file: relativePath, message: (err as Error).message });
      continue;
    }
    if (looksBroken(filePath, source)) {
      warnings.push({ file: relativePath, message: 'Файл пропущен: похоже на синтаксическую ошибку' });
      continue;
    }
    loaded.push({ relativePath, source, filePath });
  }

  const cacheSetting = options.cache ?? config.cache ?? false;
  let cacheStats: ScanResult['cache'];
  if (cacheSetting) {
    const cached = analyzeWithCache(
      root,
      loaded.map((file) => ({ relativePath: file.relativePath, filePath: file.filePath!, source: file.source })),
      cacheSetting,
    );
    warnings.push(...cached.warnings);
    cacheStats = cached.stats;
    for (const file of loaded) file.analysis = cached.analyses.get(file.relativePath);
  }

  const candidates = dedupeFindings(scanSources(loaded, catalog))
    .filter((f) => !config.disabled.includes(f.ruleId))
    .filter((f) => !changed || (changed.size > 0 && (f.file === '.' || changed.has(f.file))))
    .map((f) => localizeFinding(catalog, f, lang));
  for (const finding of candidates) {
    const override = config.severity[finding.ruleId];
    if (override) finding.severity = override;
  }

  const sources = new Map(loaded.map((file) => [file.relativePath, file.source]));
  const findings: Finding[] = [];
  const suppressedFindings: Finding[] = [];
  for (const finding of candidates) {
    if (baseline.has(finding.fingerprint)) {
      suppressedFindings.push({ ...finding, suppression: { source: 'baseline', reason: 'Присутствует в baseline' } });
      continue;
    }
    const inlineReason = inlineSuppressionReason(finding, sources.get(finding.file));
    if (inlineReason) {
      suppressedFindings.push({ ...finding, suppression: { source: 'inline', reason: inlineReason } });
      continue;
    }
    const configReason = configuredSuppressionReason(finding, config.suppress, warnings);
    if (configReason) {
      suppressedFindings.push({ ...finding, suppression: { source: 'config', reason: configReason } });
      continue;
    }
    findings.push(finding);
  }

  const scannedFileCount = changed ? loaded.filter((file) => changed.has(file.relativePath)).length : loaded.length;
  return {
    findings,
    suppressedFindings,
    warnings,
    scannedFileCount,
    ...(changed ? { contextFileCount: loaded.length } : {}),
    ...(cacheStats ? { cache: cacheStats } : {}),
  };
}

export function listRules(catalog = defaultCatalog()): Rule[] {
  return catalog.rules;
}

export function explainRule(ruleId: string, catalog = defaultCatalog(), lang: Lang = 'ru'): ExplainResult {
  const rule = catalog.rules.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Неизвестное правило: ${ruleId}`);
  const excerpt = catalog.excerpts[rule.excerptRef];
  return { rule, excerpt, disclaimer: disclaimer(lang) };
}
