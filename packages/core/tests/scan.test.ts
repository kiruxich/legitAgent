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

  it('finds all five phase-A rules in a bad project', async () => {
    const result = await scanProject(path.join(here, 'fixtures/bad-v2-source'));
    const ids = result.findings.map((f) => f.ruleId);
    expect(ids).toEqual(expect.arrayContaining([
      'PDN.FORM.PRECHECKED_CONSENT',
      'PDN.FORM.NO_POLICY_LINK',
      'PDN.POLICY.INCOMPLETE',
      'PDN.TRANSFER.FOREIGN_TRACKER',
      'PDN.COOKIE.NO_REJECT',
    ]));
  });

  it('does not flag the five phase-A rules in a good project', async () => {
    const result = await scanProject(path.join(here, 'fixtures/good-v2-source'));
    const ids = new Set(result.findings.map((f) => f.ruleId));
    expect(ids.has('PDN.FORM.PRECHECKED_CONSENT')).toBe(false);
    expect(ids.has('PDN.FORM.NO_POLICY_LINK')).toBe(false);
    expect(ids.has('PDN.POLICY.INCOMPLETE')).toBe(false);
    expect(ids.has('PDN.TRANSFER.FOREIGN_TRACKER')).toBe(false);
    expect(ids.has('PDN.COOKIE.NO_REJECT')).toBe(false);
  });

  it('honors ignore globs from legitagent.config.json', async () => {
    const result = await scanProject(path.join(here, 'fixtures/config-ignore'));
    expect(result.findings.some((f) => f.file.includes('vendor'))).toBe(false);
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
  });

  it('drops disabled rule findings', async () => {
    const result = await scanProject(path.join(here, 'fixtures/config-disabled'));
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(false);
  });

  it('overrides severity from config', async () => {
    const result = await scanProject(path.join(here, 'fixtures/config-severity'));
    const hit = result.findings.find((f) => f.ruleId === 'PDN.TRANSFER.FOREIGN_TRACKER');
    expect(hit?.severity).toBe('low');
  });

  it('throws ConfigError for invalid JSON', async () => {
    await expect(scanProject(path.join(here, 'fixtures/config-invalid'))).rejects.toThrow(
      'Некорректный legitagent.config.json',
    );
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
