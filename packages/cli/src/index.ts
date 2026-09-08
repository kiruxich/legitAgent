#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  applySafeAutofixes,
  ConfigError,
  createBaseline,
  createLlmComplete,
  countBlockingFindings,
  disclaimer,
  generatePolicyMarkdown,
  loadBaseline,
  reviewFindings,
  scanProject,
  snippetAround,
  type Confidence,
  type Lang,
} from '@legit-agent/core';
import { formatHuman } from './format.js';
import { notifyTelegram } from './notify.js';
import { toSarif } from './sarif.js';

function usage(command?: string): string {
  if (command === 'scan-url') {
    return 'Использование: legitagent scan-url <url> [--json] [--lang ru|en] [--review] [--evidence [dir]] [--sarif [файл]] [--notify-telegram] [--allow-private-network] [--fail-on-confidence high|medium|low]';
  }
  if (command === 'scan') {
    return 'Использование: legitagent scan [путь] [--json] [--sarif [файл]] [--lang ru|en] [--review] [--changed-files a.tsx,b.html] [--baseline файл] [--write-baseline [файл]] [--cache] [--cache-file путь] [--fail-on-confidence high|medium|low]';
  }
  if (command === 'fix') return 'Использование: legitagent fix [путь] [--write] [--json] [--cache]';
  if (command === 'init-policy') {
    return 'Использование: legitagent init-policy --operator <имя> [--inn] [--ogrn] [--email] [--site] [--address] [--out файл]';
  }
  return 'Использование: legitagent scan [путь] [--json] [--sarif [файл]] [--lang ru|en] [--review]\n             legitagent scan-url <url> [--json] [--lang ru|en] [--review] [--evidence [dir]] [--sarif [файл]] [--notify-telegram]\n             legitagent init-policy --operator <имя> [--out файл]';
}

function parseArgs(argv: string[]) {
  const json = argv.includes('--json');
  const review = argv.includes('--review');
  const notifyTelegramFlag = argv.includes('--notify-telegram');
  const allowPrivateNetwork = argv.includes('--allow-private-network');
  const writeFixes = argv.includes('--write');
  let cache: boolean | string | undefined = argv.includes('--cache') ? true : undefined;
  let sarifPath: string | undefined;
  let evidenceDir: string | undefined;
  let baselinePath: string | undefined;
  let writeBaselinePath: string | undefined;
  let changedFiles: string[] | undefined;
  let failOnConfidence: Confidence = 'low';
  let lang: Lang = 'ru';
  const rest: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json' || arg === '--review' || arg === '--notify-telegram' || arg === '--allow-private-network' || arg === '--write' || arg === '--cache') continue;
    if (arg === '--cache-file') {
      const next = argv[++i];
      if (!next || next.startsWith('-')) throw new ConfigError('Укажите путь после --cache-file');
      cache = next;
      continue;
    }
    if (arg === '--sarif') {
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        sarifPath = next;
        i += 1;
      } else {
        sarifPath = 'legitagent.sarif';
      }
      continue;
    }
    if (arg === '--evidence') {
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        evidenceDir = next;
        i += 1;
      } else {
        evidenceDir = 'legitagent-evidence';
      }
      continue;
    }
    if (arg === '--lang') {
      const next = argv[++i];
      if (next !== 'ru' && next !== 'en') {
        throw new ConfigError('Укажите --lang ru или --lang en');
      }
      lang = next;
      continue;
    }
    if (arg === '--changed-files') {
      const next = argv[++i];
      if (!next || next.startsWith('-')) throw new ConfigError('Укажите список файлов после --changed-files');
      changedFiles = next.split(',').map((file) => file.trim()).filter(Boolean);
      continue;
    }
    if (arg === '--baseline') {
      const next = argv[++i];
      if (!next || next.startsWith('-')) throw new ConfigError('Укажите файл после --baseline');
      baselinePath = next;
      continue;
    }
    if (arg === '--write-baseline') {
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        writeBaselinePath = next;
        i += 1;
      } else {
        writeBaselinePath = '.legitagent-baseline.json';
      }
      continue;
    }
    if (arg === '--fail-on-confidence') {
      const next = argv[++i];
      if (next !== 'high' && next !== 'medium' && next !== 'low') {
        throw new ConfigError('Укажите --fail-on-confidence high, medium или low');
      }
      failOnConfidence = next;
      continue;
    }
    if (arg.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      flags[arg.slice(2)] = argv[++i];
      continue;
    }
    rest.push(arg);
  }
  return {
    json,
    review,
    notifyTelegramFlag,
    allowPrivateNetwork,
    writeFixes,
    cache,
    sarifPath,
    evidenceDir,
    baselinePath,
    writeBaselinePath,
    changedFiles,
    failOnConfidence,
    lang,
    rest,
    flags,
  };
}

function buildLiveSnippets(
  live: {
    cookiesBefore: { name: string }[];
    cookiesAfterReject: { name: string }[];
    cookiesAfterAccept: { name: string }[];
    localStorageAfterAccept: { name: string }[];
    sessionStorageAfterAccept: { name: string }[];
    networkRequests: { domain: string; resourceType: string; phase: string; outcome: string }[];
    findings: { fingerprint: string; file: string; message: string; evidence: { summary: string; signals: string[] } }[];
  },
): Record<string, string> {
  const liveContext = {
    cookiesBefore: live.cookiesBefore.map(({ name }) => ({ name })),
    cookiesAfterReject: live.cookiesAfterReject.map(({ name }) => ({ name })),
    cookiesAfterAccept: live.cookiesAfterAccept.map(({ name }) => ({ name })),
    localStorageAfterAccept: live.localStorageAfterAccept.map(({ name }) => ({ name })),
    sessionStorageAfterAccept: live.sessionStorageAfterAccept.map(({ name }) => ({ name })),
    networkRequests: live.networkRequests.slice(0, 100).map(({ domain, resourceType, phase, outcome }) => ({
      domain, resourceType, phase, outcome,
    })),
  };
  const snippets: Record<string, string> = {};
  for (const finding of live.findings) {
    snippets[finding.fingerprint] = JSON.stringify({
      live: liveContext,
      finding: {
        message: finding.message,
        evidence: {
          summary: finding.evidence.summary,
          signals: finding.evidence.signals,
        },
      },
    });
  }
  return snippets;
}

function formatNotifySummary(
  live: { url: string; capturedAt: string; findings: { severity: string }[] },
  reviewed: { verdict: string }[],
): string {
  const rawHigh = live.findings.some((f) => f.severity === 'high');
  const confirm = reviewed.filter((f) => f.verdict === 'confirm').length;
  const askHuman = reviewed.filter((f) => f.verdict === 'ask_human').length;
  return [
    `legitAgent scan-url: ${live.url}`,
    `capturedAt: ${live.capturedAt}`,
    `confirm: ${confirm}`,
    `ask_human: ${askHuman}`,
    `raw high: ${rawHigh ? 'yes' : 'no'}`,
  ].join('\n');
}

async function main() {
  const {
    json, review, notifyTelegramFlag, allowPrivateNetwork, writeFixes, cache, sarifPath, evidenceDir, baselinePath,
    writeBaselinePath, changedFiles, failOnConfidence, lang, rest, flags,
  } = parseArgs(process.argv.slice(2));
  const cmd = rest[0];
  if (cmd === 'init-policy') {
    const md = generatePolicyMarkdown({
      operator: flags.operator ?? '',
      inn: flags.inn,
      ogrn: flags.ogrn,
      email: flags.email,
      site: flags.site,
      address: flags.address,
    });
    if (flags.out) fs.writeFileSync(flags.out, md);
    else process.stdout.write(md);
    process.exit(0);
  }
  if (cmd === 'scan-url') {
    const url = rest[1];
    if (!url) {
      console.error(usage('scan-url'));
      process.exit(2);
    }
    const { scanUrl, writeEvidencePack } = await import('@legit-agent/live');
    const result = await scanUrl(url, { ...(evidenceDir ? { evidenceDir } : {}), allowPrivateNetwork });
    let reviewed;
    if (review || evidenceDir || notifyTelegramFlag) {
      const complete = createLlmComplete(process.env);
      reviewed = await reviewFindings(result.findings, buildLiveSnippets(result), complete);
    }
    let packPaths;
    if (evidenceDir && reviewed) {
      packPaths = await writeEvidencePack({
        dir: evidenceDir,
        live: result,
        reviewed,
        disclaimer: disclaimer(lang),
      });
    }
    if (sarifPath) {
      fs.writeFileSync(sarifPath, JSON.stringify(toSarif(result), null, 2) + '\n');
    }
    const output = reviewed ? { ...result, reviewed } : result;
    if (json) process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    else process.stdout.write(formatHuman(result, lang) + '\n');
    if (notifyTelegramFlag) {
      if (!reviewed) {
        const complete = createLlmComplete(process.env);
        reviewed = await reviewFindings(result.findings, buildLiveSnippets(result), complete);
      }
      const summary = formatNotifySummary(result, reviewed);
      await notifyTelegram(summary, packPaths?.pdf);
    }
    const high = countBlockingFindings(result.findings, failOnConfidence) > 0;
    process.exit(high ? 1 : 0);
  }
  if (cmd !== 'scan' && cmd !== 'fix') {
    console.error(usage());
    process.exit(2);
  }
  const root = path.resolve(rest[1] ?? process.cwd());
  const loadedBaseline = baselinePath ? loadBaseline(root, baselinePath) : undefined;
  const baselineFingerprints = loadedBaseline?.fingerprints;
  const result = await scanProject(root, undefined, { lang, changedFiles, baselineFingerprints, cache });
  if (loadedBaseline) result.warnings.unshift(...loadedBaseline.warnings);
  if (cmd === 'fix') {
    const fixes = applySafeAutofixes(root, result.findings, writeFixes);
    const output = { ...fixes, dryRun: !writeFixes };
    if (json) process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    else {
      for (const change of fixes.changes) process.stdout.write(`[${change.safety}] ${change.ruleId} ${change.file}:${change.line ?? 1} — ${change.description}\n`);
      process.stdout.write(writeFixes ? `Изменено файлов: ${fixes.changedFiles.length}\n` : 'Dry run: добавьте --write для безопасных механических исправлений.\n');
    }
    process.exit(0);
  }
  if (writeBaselinePath) {
    const outputPath = path.resolve(root, writeBaselinePath);
    const baseline = createBaseline(
      [...result.findings, ...result.suppressedFindings].map((finding) => finding.fingerprint),
    );
    fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2) + '\n');
  }
  let reviewed;
  if (review) {
    const snippets: Record<string, string> = {};
    for (const finding of result.findings) {
      const filePath = path.join(root, finding.file);
      if (!fs.existsSync(filePath)) continue;
      try {
        const source = fs.readFileSync(filePath, 'utf8');
        snippets[finding.fingerprint] = snippetAround(source, finding.line);
      } catch {
        // skip unreadable files
      }
    }
    const complete = createLlmComplete(process.env);
    reviewed = await reviewFindings(result.findings, snippets, complete);
  }
  if (sarifPath) {
    fs.writeFileSync(sarifPath, JSON.stringify(toSarif(result), null, 2) + '\n');
  }
  const output = reviewed ? { ...result, reviewed } : result;
  if (json) process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  else process.stdout.write(formatHuman(result, lang) + '\n');
  const high = countBlockingFindings(result.findings, failOnConfidence) > 0;
  process.exit(high ? 1 : 0);
}

main().catch((err) => {
  console.error((err as Error).message ?? err);
  process.exit(err instanceof ConfigError ? 2 : 1);
});
