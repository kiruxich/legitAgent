import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DISCLAIMER_RU } from '../src/disclaimer.js';
import { explainRule, listRules, scanProject } from '../src/scan.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('scanProject', () => {
  it('finds a bad form', async () => {
    const result = await scanProject(path.join(here, 'fixtures/bad-form'));
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
    expect(result.scannedFileCount).toBeGreaterThan(0);
  });

  it('does not flag a good form for NO_CONSENT', async () => {
    const result = await scanProject(path.join(here, 'fixtures/good-form'));
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(false);
  });

  it('returns empty findings and zero files for empty project', async () => {
    const result = await scanProject(path.join(here, 'fixtures/empty-project'));
    expect(result.scannedFileCount).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('does not throw on broken jsx; records a warning', async () => {
    const result = await scanProject(path.join(here, 'fixtures/broken-jsx'));
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('listRules / explainRule', () => {
  it('lists planned and active rules', () => {
    const rules = listRules();
    expect(rules.some((r) => r.status === 'planned')).toBe(true);
    expect(rules.some((r) => r.status === 'active')).toBe(true);
  });

  it('explains a rule with excerpt and disclaimer', () => {
    const explained = explainRule('PDN.FORM.NO_CONSENT');
    expect(explained.excerpt.text.length).toBeGreaterThan(0);
    expect(explained.disclaimer).toBe(DISCLAIMER_RU);
  });
});
