import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectFormNoPolicyLink } from '../src/detectors/form-no-policy-link.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

function detect(relativePath: string, source: string) {
  return detectFormNoPolicyLink({
    filePath: relativePath,
    relativePath,
    source,
    catalog,
  });
}

describe('detectFormNoPolicyLink', () => {
  it('flags a PII form with consent but no policy href', () => {
    const filePath = path.join(here, 'fixtures/bad-no-policy-link/Contact.tsx');
    const findings = detect('Contact.tsx', readFileSync(filePath, 'utf8'));
    expect(findings.map((f) => f.ruleId)).toContain('PDN.FORM.NO_POLICY_LINK');
  });

  it('does not flag when a policy href is present', () => {
    const filePath = path.join(here, 'fixtures/good-no-policy-link/Contact.tsx');
    const findings = detect('Contact.tsx', readFileSync(filePath, 'utf8'));
    expect(findings).toEqual([]);
  });

  it('skips forms without a consent checkbox', () => {
    const source = '<form><input name="email" /><button>Отправить</button></form>';
    expect(detect('Contact.tsx', source)).toEqual([]);
  });
});
