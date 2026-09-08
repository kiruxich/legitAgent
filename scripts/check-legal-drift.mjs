#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchLaw, LAWS } from './fetch-pravo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusDir = path.join(root, 'packages/core/legal/corpus');
const legalDir = path.join(root, 'packages/core/legal');
const index = JSON.parse(fs.readFileSync(path.join(corpusDir, 'index.json'), 'utf8'));
const offline = process.argv.includes('--offline');
const digest = (text) => crypto.createHash('sha256').update(text.trim()).digest('hex');
const failures = [];

for (const entry of index) {
  const snapshot = fs.readFileSync(path.join(corpusDir, entry.file), 'utf8').split(/\n\n/).slice(1).join('\n\n');
  if (digest(snapshot) !== entry.snapshotSha256) failures.push(`${entry.id}: локальный snapshot изменён без обновления hash`);
  if (!offline) {
    const law = LAWS.find((item) => item.id === entry.id);
    const current = await fetchLaw(law);
    const currentHash = digest(current.text);
    if (currentHash !== entry.snapshotSha256) {
      failures.push(`${entry.id}: официальный текст изменился (${entry.snapshotSha256} -> ${currentHash})`);
    }
  }
}

const maxAgeDays = 180;
for (const file of fs.readdirSync(legalDir).filter((name) => /\.ya?ml$/.test(name))) {
  const source = fs.readFileSync(path.join(legalDir, file), 'utf8');
  const verifiedAt = source.match(/^verifiedAt:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1];
  if (!verifiedAt) {
    failures.push(`${file}: отсутствует verifiedAt`);
    continue;
  }
  const ageDays = (Date.now() - Date.parse(verifiedAt)) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays > maxAgeDays) failures.push(`${file}: источник проверен более ${maxAgeDays} дней назад`);
}

if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Legal snapshots OK (${offline ? 'offline' : 'remote'}).\n`);
