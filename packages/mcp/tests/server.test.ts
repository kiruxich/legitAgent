import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  handleExplainRule,
  handleCreateBaseline,
  handleAutofix,
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

  it('keeps MCP autofix in dry-run unless write is explicit', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-mcp-fix-'));
    const file = path.join(root, 'Form.tsx');
    fs.writeFileSync(file, '<form><input name="email"/><label><input type="checkbox" defaultChecked/>Согласие на обработку персональных данных</label></form>');
    const preview = await handleAutofix(root);
    expect(preview.dryRun).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toContain('defaultChecked');
  });

  it('supports changed-files, cache, confidence gate, and baseline creation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-mcp-options-'));
    fs.copyFileSync(path.join(badForm, 'Contact.tsx'), path.join(root, 'Contact.tsx'));
    const result = await handleScan(root, 'ru', {
      changedFiles: ['Contact.tsx'], cache: true, minimumConfidence: 'high',
    });
    expect(result.contextFileCount).toBeGreaterThanOrEqual(1);
    expect(result.cache?.misses).toBeGreaterThanOrEqual(0);
    expect(result.gate.minimumConfidence).toBe('high');
    const baseline = await handleCreateBaseline(root, '.legitagent-test-baseline.json');
    expect(baseline.findingCount).toBeGreaterThan(0);
    fs.unlinkSync(baseline.path);
  });

  it('creates a baseline in a new nested directory inside root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-mcp-baseline-nested-'));
    fs.copyFileSync(path.join(badForm, 'Contact.tsx'), path.join(root, 'Contact.tsx'));
    const baseline = await handleCreateBaseline(root, 'reports/baselines/current.json');
    expect(baseline.path).toBe(path.join(fs.realpathSync(root), 'reports/baselines/current.json'));
    expect(fs.existsSync(baseline.path)).toBe(true);
  });

  it('refuses creating a baseline through an outward symlink', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-mcp-baseline-root-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-mcp-baseline-outside-'));
    fs.copyFileSync(path.join(badForm, 'Contact.tsx'), path.join(root, 'Contact.tsx'));
    fs.symlinkSync(outside, path.join(root, 'escape'), 'dir');

    await expect(handleCreateBaseline(root, 'escape/baseline.json')).rejects.toThrow(/symbolic link|пределы root/i);
    expect(fs.existsSync(path.join(outside, 'baseline.json'))).toBe(false);
  });

  it('refuses the home directory', async () => {
    const os = await import('node:os');
    await expect(handleScan(os.homedir())).rejects.toThrow(/домашний каталог|корень диска/);
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

  it('refuses an evidence directory through an outward symlink before scanning', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-mcp-evidence-root-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-mcp-evidence-outside-'));
    fs.symlinkSync(outside, path.join(root, 'escape'), 'dir');

    await expect(handleScanUrl('https://example.com', 'escape/evidence', root)).rejects.toThrow(
      /symbolic link|пределы root/i,
    );
    expect(fs.existsSync(path.join(outside, 'evidence'))).toBe(false);
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

describe('handleReview', () => {
  it('reviews a project and returns verdicts', async () => {
    const { handleReview } = await import('../src/server.js');
    const result = await handleReview(badForm);
    expect(result.reviewed.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT' && f.verdict)).toBe(true);
  });
});
