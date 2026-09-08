import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applySafeAutofixes } from '../src/autofix.js';
import { scanProject } from '../src/scan.js';

describe('safe autofix recipes', () => {
  it('previews and removes only a static prechecked consent state', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-fix-'));
    const file = path.join(root, 'Form.tsx');
    fs.writeFileSync(file, '<form><input name="email"/><label><input type="checkbox" defaultChecked/>Согласие на обработку персональных данных</label></form>');
    const findings = (await scanProject(root)).findings;
    const preview = applySafeAutofixes(root, findings, false);
    expect(preview.changes.some((change) => change.safety === 'safe' && !change.applied)).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toContain('defaultChecked');

    const applied = applySafeAutofixes(root, findings, true);
    expect(applied.changedFiles).toEqual(['Form.tsx']);
    expect(fs.readFileSync(file, 'utf8')).not.toContain('defaultChecked');
  });

  it('does not change a prechecked non-consent checkbox in the same form', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-fix-scoped-'));
    const file = path.join(root, 'Form.tsx');
    fs.writeFileSync(file, `<form>
      <input name="email" />
      <label><input type="checkbox" name="newsletter" defaultChecked />Подписка</label>
      <label><input type="checkbox" name="pdn" defaultChecked />Согласие на обработку персональных данных</label>
    </form>`);
    const findings = (await scanProject(root)).findings;
    applySafeAutofixes(root, findings, true);
    const fixed = fs.readFileSync(file, 'utf8');
    expect(fixed).toContain('name="newsletter" defaultChecked');
    expect(fixed).toContain('name="pdn" />');
  });

  it('does not follow a project symlink when writing', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-fix-symlink-'));
    const root = path.join(parent, 'project');
    const outside = path.join(parent, 'outside.tsx');
    fs.mkdirSync(root);
    fs.writeFileSync(outside, '<input type="checkbox" defaultChecked /> Согласие на обработку персональных данных');
    fs.symlinkSync(outside, path.join(root, 'linked.tsx'));
    const result = applySafeAutofixes(root, [{
      fingerprint: 'forged', ruleId: 'PDN.FORM.PRECHECKED_CONSENT', file: 'linked.tsx', line: 1, endLine: 1,
      severity: 'high', confidence: 'high', kind: 'violation', message: '', fix: '', excerpt: '', legalBasis: [],
      evidence: { summary: '', signals: [] },
    }], true);
    expect(result.changes).toEqual([]);
    expect(fs.readFileSync(outside, 'utf8')).toContain('defaultChecked');
  });
});
