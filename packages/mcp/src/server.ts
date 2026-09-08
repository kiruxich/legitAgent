import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import {
  explainRule,
  applySafeAutofixes,
  countBlockingFindings,
  createBaseline,
  findArticle,
  generatePolicyMarkdown,
  listCorpus,
  listRules,
  readCorpus,
  reviewFindings,
  assertSafeScanRoot,
  loadBaseline,
  scanProject,
  snippetAround,
  type Lang,
  type Confidence,
  type ScanOptions,
} from '@legit-agent/core';

function resolveRoot(root?: string): string {
  return path.resolve(root ?? process.cwd());
}

function assertReadableRoot(root: string): void {
  try {
    accessSync(root, constants.R_OK);
  } catch {
    throw new Error('Укажите корень проекта');
  }
}

function isInside(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

/**
 * Resolves each existing component below root instead of relying only on a
 * lexical `path.resolve` check. New directories are created one at a time, so
 * callers can safely use a normal nested path without traversing a symlink.
 */
function prepareContainedDirectory(root: string, directory: string): string {
  const canonicalRoot = realpathSync(root);
  const target = path.resolve(directory);
  if (!isInside(canonicalRoot, target)) {
    throw new Error('Путь должен находиться внутри root проекта');
  }

  const relative = path.relative(canonicalRoot, target);
  let current = canonicalRoot;
  for (const component of relative ? relative.split(path.sep) : []) {
    current = path.join(current, component);
    if (!existsSync(current)) {
      mkdirSync(current);
    }

    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('Путь не должен проходить через symbolic link или файл');
    }
    if (!isInside(canonicalRoot, realpathSync(current))) {
      throw new Error('Путь не должен выходить за пределы root проекта');
    }
  }
  return target;
}

function resolveContainedOutput(root: string, output: string): { root: string; target: string } {
  const canonicalRoot = realpathSync(root);
  const target = path.resolve(canonicalRoot, output);
  if (!isInside(canonicalRoot, target) || target === canonicalRoot) {
    throw new Error('Baseline должен находиться внутри root проекта');
  }

  prepareContainedDirectory(canonicalRoot, path.dirname(target));
  if (existsSync(target)) {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      throw new Error('Baseline не должен быть symbolic link или директорией');
    }
  }
  return { root: canonicalRoot, target };
}

function writeAtomicFile(target: string, content: string): void {
  const temporary = `${target}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`;
  let descriptor: number | undefined;
  try {
    // O_EXCL prevents following or replacing a pre-existing temporary path.
    descriptor = openSync(temporary, 'wx', 0o600);
    writeFileSync(descriptor, content, 'utf8');
    closeSync(descriptor);
    descriptor = undefined;
    // rename replaces the directory entry itself; it never follows a final symlink.
    renameSync(temporary, target);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function parseLang(lang?: string): Lang {
  return lang === 'en' ? 'en' : 'ru';
}

export interface McpScanOptions {
  changedFiles?: string[];
  baseline?: string;
  cache?: boolean | string;
  minimumConfidence?: Confidence;
}

async function scanForMcp(root: string, lang: string | undefined, options: McpScanOptions = {}) {
  const loadedBaseline = options.baseline ? loadBaseline(root, options.baseline) : undefined;
  const scanOptions: ScanOptions = {
    lang: parseLang(lang),
    changedFiles: options.changedFiles,
    baselineFingerprints: loadedBaseline?.fingerprints,
    cache: options.cache,
  };
  const result = await scanProject(root, undefined, scanOptions);
  if (loadedBaseline) result.warnings.unshift(...loadedBaseline.warnings);
  return {
    ...result,
    gate: {
      minimumConfidence: options.minimumConfidence ?? 'low',
      blockingFindings: countBlockingFindings(result.findings, options.minimumConfidence ?? 'low'),
    },
  };
}

export async function handleScan(root?: string, lang?: string, options: McpScanOptions = {}) {
  const resolved = resolveRoot(root);
  assertReadableRoot(resolved);
  return scanForMcp(resolved, lang, options);
}

export async function handleReview(root?: string, lang?: string, options: McpScanOptions = {}) {
  const resolved = resolveRoot(root);
  assertReadableRoot(resolved);
  const scanResult = await scanForMcp(resolved, lang, options);

  const snippets: Record<string, string> = {};
  for (const finding of scanResult.findings) {
    const filePath = path.join(resolved, finding.file);
    if (!existsSync(filePath)) continue;
    try {
      const source = readFileSync(filePath, 'utf8');
      snippets[finding.fingerprint] = snippetAround(source, finding.line);
    } catch {
      // skip unreadable files
    }
  }

  const reviewed = await reviewFindings(scanResult.findings, snippets);
  return { ...scanResult, reviewed };
}

export async function handleCreateBaseline(root?: string, output = '.legitagent-baseline.json', lang?: string) {
  const resolved = resolveRoot(root);
  assertReadableRoot(resolved);
  assertSafeScanRoot(resolved);
  const { root: canonicalRoot, target } = resolveContainedOutput(resolved, output);
  const result = await scanProject(canonicalRoot, undefined, { lang: parseLang(lang) });
  const baseline = createBaseline([...result.findings, ...result.suppressedFindings].map((finding) => finding.fingerprint));
  writeAtomicFile(target, `${JSON.stringify(baseline, null, 2)}\n`);
  return { path: target, findingCount: baseline.fingerprints.length };
}

export async function handleAutofix(root?: string, write = false, lang?: string) {
  const resolved = resolveRoot(root);
  assertReadableRoot(resolved);
  assertSafeScanRoot(resolved);
  const result = await scanProject(resolved, undefined, { lang: parseLang(lang) });
  return { ...applySafeAutofixes(resolved, result.findings, write), dryRun: !write };
}

export function handleListRules() {
  return listRules();
}

export function handleExplainRule(ruleId: string, lang?: string) {
  return explainRule(ruleId, undefined, parseLang(lang));
}

export async function handleScanUrl(
  url?: string,
  evidenceDir?: string,
  root?: string,
  allowPrivateNetwork = false,
) {
  if (!url?.trim()) throw new Error('Укажите URL сайта');
  let safeEvidenceDir: string | undefined;
  if (evidenceDir?.trim()) {
    if (!root?.trim()) throw new Error('Для evidenceDir передайте абсолютный root проекта');
    const resolvedRoot = resolveRoot(root);
    assertReadableRoot(resolvedRoot);
    assertSafeScanRoot(resolvedRoot);
    const canonicalRoot = realpathSync(resolvedRoot);
    safeEvidenceDir = path.resolve(canonicalRoot, evidenceDir.trim());
    if (!isInside(canonicalRoot, safeEvidenceDir)) {
      throw new Error('evidenceDir должен находиться внутри root проекта');
    }
    safeEvidenceDir = prepareContainedDirectory(canonicalRoot, safeEvidenceDir);
  }
  const { scanUrl } = await import('@legit-agent/live');
  return scanUrl(url, { ...(safeEvidenceDir ? { evidenceDir: safeEvidenceDir } : {}), allowPrivateNetwork });
}

export function handleGeneratePolicy(args: {
  operator?: string;
  inn?: string;
  ogrn?: string;
  email?: string;
  site?: string;
  address?: string;
}) {
  return generatePolicyMarkdown({
    operator: args.operator ?? '',
    inn: args.inn,
    ogrn: args.ogrn,
    email: args.email,
    site: args.site,
    address: args.address,
  });
}

export function handleGetLaw(lawId?: string, article?: string) {
  if (!lawId?.trim()) {
    return listCorpus();
  }
  if (article?.trim()) return findArticle(lawId, article);
  return readCorpus(lawId);
}
