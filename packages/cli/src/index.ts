#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  ConfigError,
  createLlmComplete,
  disclaimer,
  generatePolicyMarkdown,
  reviewFindings,
  scanProject,
  snippetAround,
  type Lang,
} from '@legit-agent/core';
import { formatHuman } from './format.js';
import { notifyTelegram } from './notify.js';
import { toSarif } from './sarif.js';

function usage(command?: string): string {
  if (command === 'scan-url') {
    return 'Использование: legitagent scan-url <url> [--json] [--lang ru|en] [--review] [--evidence [dir]] [--notify-telegram]';
  }
  if (command === 'scan') {
    return 'Использование: legitagent scan [путь] [--json] [--sarif [файл]] [--lang ru|en] [--review]';
  }
  if (command === 'init-policy') {
    return 'Использование: legitagent init-policy --operator <имя> [--inn] [--ogrn] [--email] [--site] [--address] [--out файл]';
  }
  return 'Использование: legitagent scan [путь] [--json] [--sarif [файл]] [--lang ru|en] [--review]\n             legitagent scan-url <url> [--json] [--lang ru|en] [--review] [--evidence [dir]] [--notify-telegram]\n             legitagent init-policy --operator <имя> [--out файл]';
}

function parseArgs(argv: string[]) {
  const json = argv.includes('--json');
  const review = argv.includes('--review');
  const notifyTelegramFlag = argv.includes('--notify-telegram');
  let sarifPath: string | undefined;
  let evidenceDir: string | undefined;
  let lang: Lang = 'ru';
  const rest: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json' || arg === '--review' || arg === '--notify-telegram') continue;
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
        evidenceDir = 'evidence';
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
    if (arg.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      flags[arg.slice(2)] = argv[++i];
      continue;
    }
    rest.push(arg);
  }
  return { json, review, notifyTelegramFlag, sarifPath, evidenceDir, lang, rest, flags };
}

function buildLiveSnippets(
  live: {
    cookiesBefore: { name: string }[];
    cookiesAfterReject: { name: string }[];
    findings: { file: string; message: string }[];
  },
): Record<string, string> {
  const cookieJson = JSON.stringify({
    cookiesBefore: live.cookiesBefore,
    cookiesAfterReject: live.cookiesAfterReject,
  });
  const snippets: Record<string, string> = {};
  for (const finding of live.findings) {
    snippets[finding.file] = `${cookieJson}\n${finding.message}`;
  }
  return snippets;
}

function formatNotifySummary(live: { url: string; findings: { severity: string }[] }, reviewed: { verdict: string }[]): string {
  const high = live.findings.filter((f) => f.severity === 'high').length;
  const confirm = reviewed.filter((f) => f.verdict === 'confirm').length;
  const askHuman = reviewed.filter((f) => f.verdict === 'ask_human').length;
  return `legitAgent scan-url: ${live.url}\nhigh (сырые): ${high}\nconfirm: ${confirm}\nask_human: ${askHuman}`;
}

async function main() {
  const { json, review, notifyTelegramFlag, sarifPath, evidenceDir, lang, rest, flags } = parseArgs(
    process.argv.slice(2),
  );
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
    const result = await scanUrl(url, evidenceDir ? { evidenceDir } : undefined);
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
    const output = reviewed ? { ...result, reviewed } : result;
    if (json) process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    else process.stdout.write(formatHuman(result, lang) + '\n');
    if (notifyTelegramFlag && reviewed) {
      const summary = formatNotifySummary(result, reviewed);
      await notifyTelegram(summary, packPaths?.pdf);
    }
    const high = result.findings.some((f) => f.severity === 'high');
    process.exit(high ? 1 : 0);
  }
  if (cmd !== 'scan') {
    console.error(usage());
    process.exit(2);
  }
  const root = path.resolve(rest[1] ?? process.cwd());
  const result = await scanProject(root, undefined, { lang });
  let reviewed;
  if (review) {
    const snippets: Record<string, string> = {};
    for (const finding of result.findings) {
      const filePath = path.join(root, finding.file);
      if (!fs.existsSync(filePath)) continue;
      try {
        const source = fs.readFileSync(filePath, 'utf8');
        snippets[finding.file] = snippetAround(source, finding.line);
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
  const high = result.findings.some((f) => f.severity === 'high');
  process.exit(high ? 1 : 0);
}

main().catch((err) => {
  console.error((err as Error).message ?? err);
  process.exit(err instanceof ConfigError ? 2 : 1);
});
