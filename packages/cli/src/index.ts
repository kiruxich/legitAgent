#!/usr/bin/env node
import path from 'node:path';
import { scanProject } from '@legit-agent/core';
import { formatHuman } from './format.js';

function usage(command?: string): string {
  if (command === 'scan-url') return 'Использование: legitagent scan-url <url> [--json]';
  if (command === 'scan') return 'Использование: legitagent scan [путь] [--json]';
  return 'Использование: legitagent scan [путь] [--json]\n             legitagent scan-url <url> [--json]';
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const filtered = args.filter((a) => a !== '--json');
  const cmd = filtered[0];
  if (cmd === 'scan-url') {
    const url = filtered[1];
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
  const root = path.resolve(filtered[1] ?? process.cwd());
  const result = await scanProject(root);
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(formatHuman(result) + '\n');
  const high = result.findings.some((f) => f.severity === 'high');
  process.exit(high ? 1 : 0);
}

main().catch((err) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
