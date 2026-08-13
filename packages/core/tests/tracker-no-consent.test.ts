import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectTrackerNoConsent } from '../src/detectors/tracker-no-consent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

describe('detectTrackerNoConsent', () => {
  it('flags top-level ym() init', () => {
    const filePath = path.join(here, 'fixtures/bad-tracker/metrika.tsx');
    const findings = detectTrackerNoConsent({
      filePath,
      relativePath: 'metrika.tsx',
      source: readFileSync(filePath, 'utf8'),
      catalog,
    });
    expect(findings.map((f) => f.ruleId)).toContain('PDN.TRACKER.NO_CONSENT');
  });

  it('does not flag tracker behind consent check', () => {
    const source = `if (consent) { ym(1, 'init', {}); }`;
    const findings = detectTrackerNoConsent({
      filePath: 'ok.tsx',
      relativePath: 'ok.tsx',
      source,
      catalog,
    });
    expect(findings).toEqual([]);
  });
});
