import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectForeignTracker } from '../src/detectors/foreign-tracker.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

function detect(relativePath: string, source: string) {
  return detectForeignTracker({
    filePath: relativePath,
    relativePath,
    source,
    catalog,
  });
}

describe('detectForeignTracker', () => {
  it('flags gtag() as a foreign tracker', () => {
    const filePath = path.join(here, 'fixtures/bad-foreign-tracker/analytics.tsx');
    const findings = detect('analytics.tsx', readFileSync(filePath, 'utf8'));
    expect(findings.map((f) => f.ruleId)).toContain('PDN.TRANSFER.FOREIGN_TRACKER');
  });

  it('does not flag ym() or VK.Retargeting alone', () => {
    const filePath = path.join(here, 'fixtures/good-foreign-tracker/metrika.tsx');
    expect(detect('metrika.tsx', readFileSync(filePath, 'utf8'))).toEqual([]);
    expect(detect('vk.tsx', 'VK.Retargeting.Init(1);')).toEqual([]);
  });

  it('flags ga(, fbq(, google-analytics, googletagmanager, facebook.net, connect.facebook', () => {
    const snippets = [
      'ga("send", "pageview");',
      'fbq("init", "1");',
      'src="https://www.google-analytics.com/analytics.js"',
      'src="https://www.googletagmanager.com/gtm.js"',
      'src="https://facebook.net/en_US/fbevents.js"',
      'src="https://connect.facebook.net/en_US/fbevents.js"',
    ];
    for (const source of snippets) {
      expect(detect('x.tsx', source).map((f) => f.ruleId), source).toContain(
        'PDN.TRANSFER.FOREIGN_TRACKER',
      );
    }
  });
});
