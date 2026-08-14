#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  ConfigError,
  generatePolicyMarkdown,
  scanProject,
  type Lang,
} from '@legit-agent/core';
import { formatHuman } from './format.js';
import { toSarif } from './sarif.js';

function usage(command?: string): string {
  if (command === 'scan-url') return 'Использование: legitagent scan-url <url> [--json] [--lang ru|en]';
  if (command === 'scan') return 'Использование: legitagent scan [путь] [--json] [--sarif [файл]] [--lang ru|en]';
  if (command === 'init-policy') {
    return 'Использование: legitagent init-policy --operator <имя> [--inn] [--ogrn] [--email] [--site] [--address] [--out файл]';
  }
  return 'Использование: legitagent scan [путь] [--json] [--sarif [файл]] [--lang ru|en]\n             legitagent scan-url <url> [--json] [--lang ru|en]\n             legitagent init-policy --operator <имя> [--out файл]';
}

function parseArgs(argv: string[]) {
  const json = argv.includes('--json');
  let sarifPath: string | undefined;
  let lang: Lang = 'ru';
  const rest: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') continue;
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
  return { json, sarifPath, lang, rest, flags };
}

async function main() {
  const { json, sarifPath, lang, rest, flags } = parseArgs(process.argv.slice(2));
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
    const { scanUrl } = await import('@legit-agent/live');
    const result = await scanUrl(url);
    if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else process.stdout.write(formatHuman(result, lang) + '\n');
    const high = result.findings.some((f) => f.severity === 'high');
    process.exit(high ? 1 : 0);
  }
  if (cmd !== 'scan') {
    console.error(usage());
    process.exit(2);
  }
  const root = path.resolve(rest[1] ?? process.cwd());
  const result = await scanProject(root, undefined, { lang });
  if (sarifPath) {
    fs.writeFileSync(sarifPath, JSON.stringify(toSarif(result), null, 2) + '\n');
  }
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(formatHuman(result, lang) + '\n');
  const high = result.findings.some((f) => f.severity === 'high');
  process.exit(high ? 1 : 0);
}

main().catch((err) => {
  console.error((err as Error).message ?? err);
  process.exit(err instanceof ConfigError ? 2 : 1);
});
