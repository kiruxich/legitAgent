#!/usr/bin/env node
import path from 'node:path';
import { scanProject } from '@legitagent/core';
import { formatHuman } from './format.js';

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const filtered = args.filter((a) => a !== '--json');
  const cmd = filtered[0];
  if (cmd !== 'scan') {
    console.error('Использование: legitagent scan [путь] [--json]');
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
