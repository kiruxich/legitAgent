import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectPolicyNoLink } from '../src/detectors/policy-no-link.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

describe('detectPolicyNoLink', () => {
  it('flags a project with no privacy link', () => {
    const source = readFileSync(path.join(here, 'fixtures/no-policy/page.tsx'), 'utf8');
    const findings = detectPolicyNoLink({
      catalog,
      files: [{ relativePath: 'page.tsx', source }],
    });
    expect(findings.map((f) => f.ruleId)).toContain('PDN.POLICY.NO_LINK');
  });

  it('passes when a privacy href exists', () => {
    const source = readFileSync(path.join(here, 'fixtures/good-policy/layout.tsx'), 'utf8');
    const findings = detectPolicyNoLink({
      catalog,
      files: [{ relativePath: 'layout.tsx', source }],
    });
    expect(findings).toEqual([]);
  });
});
