import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeSource } from '../src/analysis.js';
import { scanProject, scanSources } from '../src/scan.js';

const roots: string[] = [];
function project(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-regressions-'));
  roots.push(root);
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function trackerAnalysis(script: string, extension: string) {
  const source = /^(ts|tsx)$/.test(extension) ? script : `<script>\n${script}\n</script>`;
  return analyzeSource(`page.${extension}`, source).trackers;
}

describe('consent branch analysis across source formats', () => {
  const tracker = 'gtag("config", "G-1")';
  const unsafe = [
    `if (!consent) { ${tracker}; }`,
    `if (consent) {} else { ${tracker}; }`,
    `if (consent !== false) {} else { ${tracker}; }`,
    `if (false !== consent) {} else { ${tracker}; }`,
    `if (consent === false) { ${tracker}; }`,
    `if (consent === false) {} else { ${tracker}; }`,
    `if (consent != false) {} else { ${tracker}; }`,
    `if (consent == false) { ${tracker}; }`,
    `if (consent !== true) { ${tracker}; }`,
    `if (consent != true) { ${tracker}; }`,
    `if (consent === undefined) {} else { ${tracker}; }`,
    `if (consent !== null) { ${tracker}; }`,
    `if (consent || debug) { ${tracker}; }`,
    `if (consent && ready) {} else { ${tracker}; }`,
    `${tracker}; if (consent) {}`, // Nearby checks cannot guard an earlier call.
    `if (consent) {} ${tracker};`,
    `if (cookieBannerOpen) { ${tracker}; }`,
    `if (consentDenied) { ${tracker}; }`,
    `window.addEventListener('consent-revoked', () => ${tracker});`,
  ];
  const guarded = [
    `if (consent) { ${tracker}; }`,
    `if (!consent) {} else { ${tracker}; }`,
    `if (consent === true) { ${tracker}; }`,
    `if (true === consent) { ${tracker}; }`,
    `if (consent !== true) {} else { ${tracker}; }`,
    `if (consent != true) {} else { ${tracker}; }`,
    `if (consent == true) { ${tracker}; }`,
    `if (consent === 'granted') { ${tracker}; }`,
    `if (consent && ready) { ${tracker}; }`,
    `if (!consent || !ready) {} else { ${tracker}; }`,
    `consent && ${tracker};`,
    `!consent || ${tracker};`,
    `Cookiebot.consent.marketing && ${tracker};`,
    `window.addEventListener('consent-granted', () => ${tracker});`,
  ];
  for (const extension of ['ts', 'tsx', 'html', 'vue', 'svelte', 'astro']) {
    it(`retains denied or unknown paths in .${extension}`, () => {
      for (const source of unsafe) {
        expect(trackerAnalysis(source, extension), source).toMatchObject([{ guardedByConsent: false }]);
      }
    });
    it(`recognizes positively guarded paths in .${extension}`, () => {
      for (const source of guarded) {
        expect(trackerAnalysis(source, extension), source).toMatchObject([{ guardedByConsent: true }]);
      }
    });
  }
  it('preserves original locations and does not duplicate embedded script calls', () => {
    const source = `<html>\n<script>\nif (!consent) { ${tracker}; }\n</script>\n</html>`;
    const [call, duplicate] = analyzeSource('page.html', source).trackers;
    expect(duplicate).toBeUndefined();
    expect(call.startLine).toBe(3);
    expect(source.slice(call.startOffset, call.endOffset)).toBe(tracker);
  });
  it('analyzes Astro frontmatter and keeps unrelated consent text from guarding inline handlers', () => {
    expect(analyzeSource('page.astro', `---\nif (!consent) { ${tracker}; }\n---\n<p>hello</p>`).trackers)
      .toMatchObject([{ guardedByConsent: false }]);
    expect(analyzeSource('page.html', `<script>if (consent) {}</script><button onclick='${tracker}'>Run</button>`).trackers)
      .toMatchObject([{ guardedByConsent: false }]);
  });
});

describe('personal data field evidence', () => {
  for (const extension of ['html', 'tsx', 'vue', 'svelte', 'astro']) {
    it(`does not classify attribute names, comments, or unrelated copy as PII in .${extension}`, () => {
      const source = `<form className="email-search"><input type="search" name="q" /><input name="productName" /><input type="hidden" name="email" /><p>Contact us by email.</p></form>`;
      const findings = scanSources([{ relativePath: `page.${extension}`, source }]);
      expect(findings.filter((finding) => ['PDN.FORM.NO_CONSENT', 'PDN.ORG.RKN_NOTICE', 'PDN.LOCALIZATION.UNCLEAR'].includes(finding.ruleId))).toEqual([]);
    });
    it(`recognizes field attributes and associated labels in .${extension}`, () => {
      const fields = [
        '<input type = "email" />',
        '<input name="contactEmail" />',
        '<input autocomplete="given-name" />',
        '<input placeholder="Ваш телефон" />',
        '<label>Ваше имя<input /></label>',
        `<label ${extension === 'tsx' ? 'htmlFor' : 'for'}="contact">Email</label><input id="contact" />`,
      ];
      for (const field of fields) {
        const findings = scanSources([{ relativePath: `page.${extension}`, source: `<form>${field}</form>` }]);
        expect(findings.some((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT'), field).toBe(true);
        expect(findings.some((finding) => finding.ruleId === 'PDN.ORG.RKN_NOTICE'), field).toBe(true);
      }
    });
  }
  it('handles static JSX expression attributes and does not guess dynamic field names', () => {
    const source = `<form><input name={'email'} /></form>`;
    expect(analyzeSource('page.tsx', source).forms[0].hasPii).toBe(true);
    expect(analyzeSource('page.tsx', '<form><input name={fieldName} /></form>').forms[0].hasPii).toBe(false);
  });
});

describe('scan syntax handling and cache compatibility', () => {
  it('scans valid HTML and JavaScript with literal braces in text, strings, comments and regexes', async () => {
    const root = project();
    fs.writeFileSync(path.join(root, 'page.html'), '<p>Opening brace: {</p><form><input name="email" /></form>');
    fs.writeFileSync(path.join(root, 'tracker.ts'), 'const opening = "{";\nconst pattern = /[}]/;\n// unmatched {\ngtag("config", "G-1");');
    const result = await scanProject(root);
    expect(result.scannedFileCount).toBe(2);
    expect(result.warnings).toEqual([]);
    expect(result.findings.some((finding) => finding.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
    expect(result.findings.some((finding) => finding.ruleId === 'PDN.TRACKER.NO_CONSENT')).toBe(true);
  });
  it('reports actual parser errors while retaining inspectable code from the file', async () => {
    const root = project();
    fs.writeFileSync(path.join(root, 'tracker.ts'), 'gtag("config", "G-1");\nexport function Broken( {');
    const result = await scanProject(root);
    expect(result.scannedFileCount).toBe(1);
    expect(result.warnings[0].message).toContain('Синтаксическая ошибка');
    expect(result.findings.some((finding) => finding.ruleId === 'PDN.TRACKER.NO_CONSENT')).toBe(true);
  });
  it('invalidates cached consent results produced before the corrected analyzer', async () => {
    const root = project();
    fs.writeFileSync(path.join(root, 'tracker.html'), '<script>if (!consent) { gtag("config", "G-1"); }</script>');
    await scanProject(root, undefined, { cache: true });
    const cachePath = path.join(root, '.legitagent/cache-v1.json');
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    cache.analyzerVersion = 'consent-flow-v3';
    cache.entries['tracker.html'].analysis.trackers[0].guardedByConsent = true;
    fs.writeFileSync(cachePath, JSON.stringify(cache));
    const result = await scanProject(root, undefined, { cache: true });
    expect(result.cache).toMatchObject({ hits: 0, misses: 1 });
    expect(result.findings.some((finding) => finding.ruleId === 'PDN.TRACKER.NO_CONSENT')).toBe(true);
  });
});

describe('seller requisites with Cyrillic boundaries', () => {
  it.each(['ИНН: 7701234567', 'ОГРН: 1027700123456', 'ОГРНИП 123456789012345', '(инн) 7701234567'])(
    'recognizes %s', (requisites) => {
      const findings = scanSources([{ relativePath: 'shop.html', source: `<button class="add-to-cart">Купить</button><p>${requisites}</p>` }]);
      expect(findings.some((finding) => finding.ruleId === 'CONSUMER.REQUISITES.MISSING')).toBe(false);
    },
  );
  it('does not confuse a longer Cyrillic word with ИНН', () => {
    const findings = scanSources([{ relativePath: 'shop.html', source: '<button class="add-to-cart">Купить</button><p>Инновации</p>' }]);
    expect(findings.some((finding) => finding.ruleId === 'CONSUMER.REQUISITES.MISSING')).toBe(true);
  });
});
