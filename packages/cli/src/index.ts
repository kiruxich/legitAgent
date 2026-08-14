#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { scanProject } from '@legit-agent/core';
import { formatHuman } from './format.js';
import { toSarif } from './sarif.js';

function usage(command?: string): string {
  if (command === 'scan-url') return 'Использование: legitagent scan-url <url> [--json]';
  if (command === 'scan') return 'Использование: legitagent scan [путь] [--json] [--sarif [файл]]';
  return 'Использование: legitagent scan [путь] [--json] [--sarif [файл]]\n             legitagent scan-url <url> [--json]';
}

function parseArgs(argv: string[]) {
  const json = argv.includes('--json');
  let sarifPath: string | undefined;
  const rest: string[] = [];
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
    rest.push(arg);
  }
  return { json, sarifPath, rest };
}

async function main() {
  const { json, sarifPath, rest } = parseArgs(process.argv.slice(2));
  const cmd = rest[0];
  if (cmd === 'scan-url') {
    const url = rest[1];
    if (!url) {
      console.error(usage('scan-url'));
      process.exit(2);
    }
    const { scanUrl } = await import('@legit-agent/live');
    const result = await scanUrl(url);
    if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else process.stdout.write(formatHuman(result) + '\n');
    const high = result.findings.some((f) => f.severity === 'high');
    process.exit(high ? 1 : 0);
  }
  if (cmd !== 'scan') {
    console.error(usage());
    process.exit(2);
  }
  const root = path.resolve(rest[1] ?? process.cwd());
  const result = await scanProject(root);
  if (sarifPath) {
    fs.writeFileSync(sarifPath, JSON.stringify(toSarif(result), null, 2) + '\n');
  }
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(formatHuman(result) + '\n');
  const high = result.findings.some((f) => f.severity === 'high');
  process.exit(high ? 1 : 0);
}

main().catch((err) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
