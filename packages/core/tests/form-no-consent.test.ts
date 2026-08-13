import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectFormNoConsent } from '../src/detectors/form-no-consent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

describe('detectFormNoConsent', () => {
  it('flags a form with email and no consent checkbox', () => {
    const filePath = path.join(here, 'fixtures/bad-form/Contact.tsx');
    const findings = detectFormNoConsent({
      filePath,
      relativePath: 'Contact.tsx',
      source: readFileSync(filePath, 'utf8'),
      catalog,
    });
    expect(findings.map((f) => f.ruleId)).toContain('PDN.FORM.NO_CONSENT');
  });

  it('does not flag a form with consent checkbox', () => {
    const filePath = path.join(here, 'fixtures/good-form/Contact.tsx');
    const findings = detectFormNoConsent({
      filePath,
      relativePath: 'Contact.tsx',
      source: readFileSync(filePath, 'utf8'),
      catalog,
    });
    expect(findings).toEqual([]);
  });
});
