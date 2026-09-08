import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateEvidenceChecks, validateRealWorldCases } from './benchmark-corpus.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/corpus.json'), 'utf8'));
const sourceCase = manifest.cases.find((entry) => entry.id === 'vas3k-join');

test('counts a source group once even when a case is repeated', () => {
  assert.equal(validateRealWorldCases(root, { cases: [sourceCase, sourceCase] }), 1);
});

test('rejects source edits that have not been reviewed', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-corpus-test-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const directory = path.join(temporary, sourceCase.path);
  fs.cpSync(path.join(root, sourceCase.path), directory, { recursive: true });
  fs.appendFileSync(path.join(directory, 'join.html'), '<script>gtag("config", "G-EXAMPLE")</script>');
  assert.throws(() => validateRealWorldCases(temporary, { cases: [sourceCase] }), /reviewed hash differs/);
});

test('requires a strict source review before counting a real-world case', () => {
  assert.throws(() => validateRealWorldCases(root, { cases: [{ ...sourceCase, strict: false }] }), /missing strict source review/);
});

test('rejects silently changed expected labels', () => {
  assert.throws(() => validateRealWorldCases(root, { cases: [{ ...sourceCase, rules: {} }] }), /reviewed labels differ/);
});

test('evidence checks reject missing forms even if negative rule labels pass', () => {
  const failures = evaluateEvidenceChecks([{ file: 'Form.vue', forms: [{ hasPii: false }] }], [
    { relativePath: 'Form.vue', analysis: { forms: [], trackers: [] } },
  ], []);
  assert.ok(failures.some((failure) => failure.field === 'Form.vue.forms.length'));
});

test('per-file rule labels do not accidentally score another file or project-wide findings', () => {
  const checks = [{ file: 'setup.js', rules: { 'PDN.TRACKER.NO_CONSENT': false } }];
  const sources = [{ relativePath: 'setup.js', analysis: { forms: [], trackers: [] } }];
  const elsewhere = [{ file: 'loader.js', ruleId: 'PDN.TRACKER.NO_CONSENT' }];
  assert.deepEqual(evaluateEvidenceChecks(checks, sources, elsewhere), []);
  assert.equal(evaluateEvidenceChecks(checks, sources, [{ file: 'setup.js', ruleId: 'PDN.TRACKER.NO_CONSENT' }]).length, 1);
});
