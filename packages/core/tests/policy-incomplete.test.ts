import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectPolicyIncomplete } from '../src/detectors/policy-incomplete.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

describe('detectPolicyIncomplete', () => {
  it('flags a policy file missing required terms', () => {
    const source = readFileSync(path.join(here, 'fixtures/bad-incomplete-policy/privacy.html'), 'utf8');
    const findings = detectPolicyIncomplete({
      catalog,
      files: [{ relativePath: 'privacy.html', source }],
    });
    expect(findings.map((f) => f.ruleId)).toContain('PDN.POLICY.INCOMPLETE');
    expect(findings[0]?.file).toBe('privacy.html');
  });

  it('does not flag a policy with operator, purpose, term, and withdrawal', () => {
    const source = readFileSync(path.join(here, 'fixtures/good-complete-policy/privacy.html'), 'utf8');
    const findings = detectPolicyIncomplete({
      catalog,
      files: [{ relativePath: 'privacy.html', source }],
    });
    expect(findings).toEqual([]);
  });

  it('returns no findings when the project has no policy file', () => {
    const source = readFileSync(path.join(here, 'fixtures/no-policy/page.tsx'), 'utf8');
    const findings = detectPolicyIncomplete({
      catalog,
      files: [{ relativePath: 'page.tsx', source }],
    });
    expect(findings).toEqual([]);
  });

  it('does not treat a footer or nav link as a policy document', () => {
    const files = [
      {
        relativePath: 'layout.tsx',
        source: `<footer><a href="/privacy">Политика конфиденциальности</a></footer>`,
      },
      {
        relativePath: 'Header.tsx',
        source: `<nav><a href="/privacy">Политика конфиденциальности</a></nav>`,
      },
    ];
    expect(detectPolicyIncomplete({ catalog, files })).toEqual([]);
  });

  it('flags a substantial policy page that is not named like a policy file', () => {
    const body = 'Текст о том, как сайт использует сведения посетителей. '.repeat(20);
    const source = `<html><body><h1>Политика</h1><p>${body}</p></body></html>`;
    const findings = detectPolicyIncomplete({
      catalog,
      files: [{ relativePath: 'pages/legal.tsx', source }],
    });
    expect(findings.map((f) => f.ruleId)).toContain('PDN.POLICY.INCOMPLETE');
    expect(findings[0]?.file).toBe('pages/legal.tsx');
  });
});
