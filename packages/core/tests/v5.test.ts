import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectFormNoConsent } from '../src/detectors/form-no-consent.js';
import { detectTrackerNoConsent } from '../src/detectors/tracker-no-consent.js';
import { scanProject, scanSources } from '../src/scan.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

describe('v5 quieter org heuristics', () => {
  it('does not flag localization or RKN on a foreign tracker without a PII form', async () => {
    const result = await scanProject(path.join(here, 'fixtures/tracker-only'));
    const ids = result.findings.map((f) => f.ruleId);
    expect(ids).not.toContain('PDN.LOCALIZATION.UNCLEAR');
    expect(ids).not.toContain('PDN.ORG.RKN_NOTICE');
    expect(ids).toContain('PDN.TRANSFER.FOREIGN_TRACKER');
  });

  it('flags localization only when a PII form and a foreign tracker are both present', async () => {
    const bad = await scanProject(path.join(here, 'fixtures/bad-localization'));
    const good = await scanProject(path.join(here, 'fixtures/good-localization'));
    expect(bad.findings.some((f) => f.ruleId === 'PDN.LOCALIZATION.UNCLEAR')).toBe(true);
    expect(bad.findings.find((f) => f.ruleId === 'PDN.LOCALIZATION.UNCLEAR')?.severity).toBe('low');
    expect(good.findings.some((f) => f.ruleId === 'PDN.LOCALIZATION.UNCLEAR')).toBe(false);
  });

  it('does not treat a lone «Купить» CTA as a shop', async () => {
    const result = await scanProject(path.join(here, 'fixtures/buy-cta-only'));
    expect(result.findings.some((f) => f.ruleId.startsWith('CONSUMER.'))).toBe(false);
  });
});

describe('v5 consent wrappers', () => {
  it('does not flag a tracker behind Cookiebot', () => {
    const findings = detectTrackerNoConsent({
      filePath: 'cmp.ts',
      relativePath: 'cmp.ts',
      source: `Cookiebot.consent.marketing && ym(1, 'init', {});`,
      catalog,
    });
    expect(findings).toEqual([]);
  });

  it('does not flag a form that uses a Checkbox component for consent', () => {
    const findings = detectFormNoConsent({
      filePath: 'Form.tsx',
      relativePath: 'Form.tsx',
      source: `<form><input name="email" /><Checkbox /> согласие на обработку персональных данных</form>`,
      catalog,
    });
    expect(findings).toEqual([]);
  });
});

describe('scanSources', () => {
  it('runs form and policy detectors on a single HTML snapshot', () => {
    const findings = scanSources(
      [
        {
          relativePath: 'https://shop.test/',
          source: `<form><input name="email" /></form><span>Реклама</span><button class="add-to-cart">В корзину</button>`,
        },
      ],
      catalog,
    );
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'PDN.FORM.NO_CONSENT',
        'PDN.POLICY.NO_LINK',
        'ADV.ERID.MISSING',
        'CONSUMER.OFFER.MISSING',
      ]),
    );
    expect(findings.every((f) => f.file === 'https://shop.test/')).toBe(true);
  });
});
