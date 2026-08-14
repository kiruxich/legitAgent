import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectCookieNoReject } from '../src/detectors/cookie-no-reject.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

function detect(relativePath: string, source: string) {
  return detectCookieNoReject({
    filePath: relativePath,
    relativePath,
    source,
    catalog,
  });
}

describe('detectCookieNoReject', () => {
  it('flags a cookie banner with accept but no reject', () => {
    const filePath = path.join(here, 'fixtures/bad-cookie-banner/Banner.tsx');
    const findings = detect('Banner.tsx', readFileSync(filePath, 'utf8'));
    expect(findings.map((f) => f.ruleId)).toContain('PDN.COOKIE.NO_REJECT');
  });

  it('does not flag a banner that has a reject button', () => {
    const filePath = path.join(here, 'fixtures/good-cookie-banner/Banner.tsx');
    const findings = detect('Banner.tsx', readFileSync(filePath, 'utf8'));
    expect(findings).toEqual([]);
  });

  it('skips files that do not look like a cookie banner', () => {
    expect(detect('page.tsx', '<button>Принять</button>')).toEqual([]);
  });
});
