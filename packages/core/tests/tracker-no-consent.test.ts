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

  it('follows a guarded call into a tracker initializer', () => {
    const source = `
      function startAnalytics() { gtag('config', 'G-1'); }
      if (consentStore.analytics) { startAnalytics(); }
    `;
    const findings = detectTrackerNoConsent({ filePath: 'flow.ts', relativePath: 'flow.ts', source, catalog });
    expect(findings).toEqual([]);
  });

  it('recognizes consent event handlers but not an unrelated CMP import', () => {
    const guarded = `window.addEventListener('consent-granted', () => fbq('init', '1'));`;
    expect(detectTrackerNoConsent({ filePath: 'event.ts', relativePath: 'event.ts', source: guarded, catalog })).toEqual([]);

    const unguarded = `import CookieConsent from 'cookie-consent';\ngtag('config', 'G-1');`;
    expect(detectTrackerNoConsent({ filePath: 'bad.ts', relativePath: 'bad.ts', source: unguarded, catalog })).toHaveLength(1);
  });

  it('does not treat negative consent branches or analytics names as consent', () => {
    const cases = [
      `if (!consent) { gtag('config', 'G-1'); }`,
      `if (consent) {} else { gtag('config', 'G-1'); }`,
      `function initAnalytics() { gtag('config', 'G-1'); }\ninitAnalytics();`,
      `window.addEventListener('consent-revoked', () => gtag('config', 'G-1'));`,
    ];
    for (const source of cases) {
      expect(detectTrackerNoConsent({ filePath: 'bad.ts', relativePath: 'bad.ts', source, catalog }), source).toHaveLength(1);
    }
  });

  it('requires every local invocation of a tracker initializer to be guarded', () => {
    const source = `
      function startAnalytics() { gtag('config', 'G-1'); }
      if (consent) startAnalytics();
      startAnalytics();
    `;
    expect(detectTrackerNoConsent({ filePath: 'mixed.ts', relativePath: 'mixed.ts', source, catalog })).toHaveLength(1);
  });
});
