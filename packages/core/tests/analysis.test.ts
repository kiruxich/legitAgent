import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBaseline, loadBaseline } from '../src/baseline.js';
import { scanProject, scanSources } from '../src/scan.js';

describe('structured source analysis', () => {
  it('scopes consent to the form that contains it', () => {
    const source = `
      <form id="good">
        <input name="email" />
        <label><input type="checkbox" />Согласие на обработку персональных данных</label>
      </form>
      <form id="bad">
        <input name="phone" />
      </form>`;
    const findings = scanSources([{ relativePath: 'forms.html', source }]);
    const hits = findings.filter((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT');
    expect(hits).toHaveLength(1);
    expect(hits[0].evidence.snippet).toContain('id="bad"');
    expect(hits[0].confidence).toBe('high');
  });

  it('keeps multiple findings in the same file with stable fingerprints', () => {
    const source = `
      <form id="one"><input name="email" /></form>
      <form id="two"><input name="phone" /></form>`;
    const findings = scanSources([{ relativePath: 'forms.html', source }]).filter(
      (finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT',
    );
    expect(findings).toHaveLength(2);
    expect(new Set(findings.map((finding) => finding.fingerprint)).size).toBe(2);
    expect(findings.every((finding) => finding.endLine !== null)).toBe(true);
  });
});

describe('adoption controls', () => {
  it('reuses cached structural analysis and invalidates changed files', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-cache-'));
    const file = path.join(root, 'Form.tsx');
    fs.writeFileSync(file, '<form><input name="email" /></form>');
    const first = await scanProject(root, undefined, { cache: true });
    const second = await scanProject(root, undefined, { cache: true });
    expect(first.cache).toMatchObject({ hits: 0, misses: 1 });
    expect(second.cache).toMatchObject({ hits: 1, misses: 0 });
    const cacheText = fs.readFileSync(path.join(root, '.legitagent/cache-v1.json'), 'utf8');
    expect(cacheText).not.toContain('<form>');
    expect(second.findings.find((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT')?.evidence.snippet).toContain('<form>');
    expect(second.findings).toEqual(first.findings);
    fs.writeFileSync(file, '<form><input name="phone" /></form>');
    const changed = await scanProject(root, undefined, { cache: true });
    expect(changed.cache).toMatchObject({ hits: 0, misses: 1 });
  });

  it('keeps a long bounded snippet and baseline fingerprint identical on cache hits', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-cache-long-'));
    const file = path.join(root, 'Form.tsx');
    fs.writeFileSync(file, `<form><input name="email" />${'long-evidence-'.repeat(140)}</form>`);

    const first = await scanProject(root, undefined, { cache: true });
    const second = await scanProject(root, undefined, { cache: true });
    const firstFinding = first.findings.find((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT')!;
    const secondFinding = second.findings.find((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT')!;

    expect(firstFinding.evidence.snippet).toHaveLength(1_201);
    expect(firstFinding.evidence.snippet?.endsWith('…')).toBe(true);
    expect(secondFinding.evidence.snippet).toBe(firstFinding.evidence.snippet);
    expect(secondFinding.fingerprint).toBe(firstFinding.fingerprint);

    const baseline = createBaseline(first.findings.map((finding) => finding.fingerprint));
    const baselined = await scanProject(root, undefined, {
      cache: true,
      baselineFingerprints: baseline.fingerprints,
    });
    expect(baselined.findings).toEqual([]);
    expect(baselined.suppressedFindings).toHaveLength(first.findings.length);
  });

  it('ignores malformed cached analyses instead of crashing or trusting them', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-cache-malformed-'));
    fs.writeFileSync(path.join(root, 'Form.tsx'), '<form><input name="email" /></form>');
    fs.mkdirSync(path.join(root, '.legitagent'));
    fs.writeFileSync(path.join(root, '.legitagent/cache-v1.json'), JSON.stringify({
      version: 1,
      analyzerVersion: 'consent-flow-v3',
      entries: { 'Form.tsx': { hash: 'forged', analysis: { forms: null, trackers: null } } },
    }));
    const result = await scanProject(root, undefined, { cache: true });
    expect(result.cache).toMatchObject({ hits: 0, misses: 1 });
    expect(result.findings.some((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
  });

  it('supports changed files and baseline fingerprints', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-controls-'));
    fs.writeFileSync(path.join(root, 'a.tsx'), '<form><input name="email" /></form>');
    fs.writeFileSync(path.join(root, 'b.tsx'), '<form><input name="phone" /></form>');

    const changed = await scanProject(root, undefined, { changedFiles: ['a.tsx'] });
    expect(changed.scannedFileCount).toBe(1);
    expect(changed.findings.length).toBeGreaterThan(0);
    expect(changed.contextFileCount).toBe(2);
    expect(changed.findings.some((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT' && finding.file === 'a.tsx')).toBe(true);

    const baseline = createBaseline(changed.findings.map((finding) => finding.fingerprint));
    const rescanned = await scanProject(root, undefined, {
      changedFiles: ['a.tsx'],
      baselineFingerprints: baseline.fingerprints,
    });
    expect(rescanned.findings).toEqual([]);
    expect(rescanned.suppressedFindings).toHaveLength(changed.findings.length);
    expect(rescanned.suppressedFindings.every((finding) => finding.suppression?.source === 'baseline')).toBe(true);
  });

  it('matches Windows-style changedFiles against POSIX-normalized discovered paths', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-windows-changed-'));
    fs.mkdirSync(path.join(root, 'nested'));
    fs.writeFileSync(path.join(root, 'nested', 'Form.tsx'), '<form><input name="email" /></form>');
    const result = await scanProject(root, undefined, { changedFiles: ['nested\\Form.tsx'] });
    expect(result.scannedFileCount).toBe(1);
    expect(result.findings.some((finding) =>
      finding.ruleId === 'PDN.FORM.NO_CONSENT' && finding.file === 'nested/Form.tsx',
    )).toBe(true);
  });

  it('treats an explicit empty changed-file set as an empty scan', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-empty-changed-'));
    fs.writeFileSync(path.join(root, 'Form.tsx'), '<form><input name="email" /></form>');
    const result = await scanProject(root, undefined, { changedFiles: [] });
    expect(result.scannedFileCount).toBe(0);
    expect(result.contextFileCount).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it('does not load a baseline from outside the project root', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-baseline-path-'));
    const root = path.join(parent, 'project');
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(parent, 'outside.json'), JSON.stringify(['forged']));
    const result = loadBaseline(root, '../outside.json');
    expect(result.fingerprints).toEqual([]);
    expect(result.warnings[0]?.message).toContain('внутри корня проекта');
  });

  it('loads an explicitly selected absolute baseline outside the project root', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-baseline-absolute-'));
    const root = path.join(parent, 'project');
    const baseline = path.join(parent, 'baseline.json');
    fs.mkdirSync(root);
    fs.writeFileSync(baseline, JSON.stringify(createBaseline(['known-fingerprint'])));
    const result = loadBaseline(root, baseline);
    expect(result).toEqual({ fingerprints: ['known-fingerprint'], warnings: [] });
  });

  it('does not load a baseline through an external symlink', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-baseline-symlink-'));
    const root = path.join(parent, 'project');
    const outside = path.join(parent, 'outside.json');
    fs.mkdirSync(root);
    fs.writeFileSync(outside, JSON.stringify(['forged']));
    fs.symlinkSync(outside, path.join(root, 'baseline.json'));
    const result = loadBaseline(root, 'baseline.json');
    expect(result.fingerprints).toEqual([]);
    expect(result.warnings[0]?.message).toContain('symlink');
  });

  it('does not write cache through a directory symlink outside the project', async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-cache-symlink-'));
    const root = path.join(parent, 'project');
    const outside = path.join(parent, 'outside');
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(root, 'Form.tsx'), '<form><input name="email" /></form>');
    fs.symlinkSync(outside, path.join(root, 'cache-link'));
    await expect(scanProject(root, undefined, { cache: 'cache-link/cache.json' })).rejects.toThrow('внешний symlink');
    expect(fs.existsSync(path.join(outside, 'cache.json'))).toBe(false);
  });

  it('keeps fingerprints stable when a finding moves to another line', () => {
    const source = '<form><input name="email" /></form>';
    const first = scanSources([{ relativePath: 'Form.html', source }]);
    const moved = scanSources([{ relativePath: 'Form.html', source: `\n\n${source}` }]);
    const firstFinding = first.find((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT');
    const movedFinding = moved.find((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT');
    expect(movedFinding?.line).not.toBe(firstFinding?.line);
    expect(movedFinding?.fingerprint).toBe(firstFinding?.fingerprint);
  });

  it('requires a reason for inline suppression', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-inline-'));
    fs.writeFileSync(
      path.join(root, 'Form.tsx'),
      '// legitagent-ignore-next-line PDN.FORM.NO_CONSENT -- accepted legacy form\n<form><input name="email" /></form>',
    );
    const result = await scanProject(root);
    expect(result.findings.some((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(false);
    expect(result.suppressedFindings.some((finding) =>
      finding.ruleId === 'PDN.FORM.NO_CONSENT' && finding.suppression?.reason === 'accepted legacy form',
    )).toBe(true);
  });
});
