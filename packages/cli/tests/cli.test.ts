import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../src/index.ts');
const fixture = path.resolve(here, '../../core/tests/fixtures/bad-form');

describe('cli', () => {
  it('prints json findings and exits 1 on high', () => {
    const result = spawnSync('npx', ['tsx', cli, 'scan', fixture, '--json'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.findings.some((f: { ruleId: string }) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
  });
});
