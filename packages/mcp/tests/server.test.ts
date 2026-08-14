import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  handleExplainRule,
  handleGeneratePolicy,
  handleGetLaw,
  handleListRules,
  handleScan,
  handleScanUrl,
} from '../src/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const badForm = path.resolve(here, '../../core/tests/fixtures/bad-form');

describe('handleScan', () => {
  it('finds PDN.FORM.NO_CONSENT in bad-form fixture', async () => {
    const result = await handleScan(badForm);
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
  });

  it('throws when root is missing or unreadable', async () => {
    await expect(handleScan('/nonexistent/path/legitagent-mcp-test')).rejects.toThrow(
      'Укажите корень проекта',
    );
  });
});

describe('handleListRules', () => {
  it('includes advertising and consumer rules', () => {
    const rules = handleListRules();
    expect(rules.some((r) => r.id === 'ADV.ERID.MISSING')).toBe(true);
    expect(rules.some((r) => r.id === 'CONSUMER.OFFER.MISSING')).toBe(true);
  });
});

describe('handleExplainRule', () => {
  it('throws for unknown rule id', () => {
    expect(() => handleExplainRule('nope')).toThrow();
  });
});

describe('handleScanUrl', () => {
  it('throws when url is missing', async () => {
    await expect(handleScanUrl()).rejects.toThrow('Укажите URL сайта');
  });
});

describe('handleGeneratePolicy', () => {
  it('returns a draft with the operator name', () => {
    expect(handleGeneratePolicy({ operator: 'ООО Тест' })).toContain('ООО Тест');
  });
});

describe('handleGetLaw', () => {
  it('lists corpus ids and returns article 9 of 152-FZ', () => {
    const list = handleGetLaw() as { id: string }[];
    expect(list.some((e) => e.id === '152-fz')).toBe(true);
    expect(handleGetLaw('152-fz', '9')).toMatch(/Статья\s+9/);
  });
});
