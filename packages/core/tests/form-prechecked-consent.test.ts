import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectFormPrecheckedConsent } from '../src/detectors/form-prechecked-consent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

function detect(relativePath: string, source: string) {
  return detectFormPrecheckedConsent({
    filePath: relativePath,
    relativePath,
    source,
    catalog,
  });
}

describe('detectFormPrecheckedConsent', () => {
  it('flags a consent checkbox with defaultChecked', () => {
    const filePath = path.join(here, 'fixtures/bad-prechecked/Contact.tsx');
    const findings = detect('Contact.tsx', readFileSync(filePath, 'utf8'));
    expect(findings.map((f) => f.ruleId)).toContain('PDN.FORM.PRECHECKED_CONSENT');
  });

  it('does not flag an unchecked consent checkbox', () => {
    const filePath = path.join(here, 'fixtures/good-prechecked/Contact.tsx');
    const findings = detect('Contact.tsx', readFileSync(filePath, 'utf8'));
    expect(findings).toEqual([]);
  });

  it('flags a HTML boolean checked> consent checkbox', () => {
    const filePath = path.join(here, 'fixtures/bad-prechecked/contact.html');
    const findings = detect('contact.html', readFileSync(filePath, 'utf8'));
    expect(findings.map((f) => f.ruleId)).toContain('PDN.FORM.PRECHECKED_CONSENT');
  });

  it('flags checked={true}, checked="checked", checked="true", and bare checked', () => {
    const variants = [
      '<input type="checkbox" checked={true} />',
      '<input type="checkbox" checked="checked" />',
      '<input type="checkbox" checked="true" />',
      '<input type="checkbox" checked />',
    ];
    for (const checkbox of variants) {
      const source = `<form><input name="email" />${checkbox} согласие на обработку персональных данных</form>`;
      expect(detect('Contact.tsx', source).map((f) => f.ruleId), checkbox).toContain(
        'PDN.FORM.PRECHECKED_CONSENT',
      );
    }
  });

  it('does not flag a form without PII or without a consent checkbox', () => {
    expect(detect('x.tsx', '<form><input type="checkbox" defaultChecked /> согласие</form>')).toEqual([]);
    expect(
      detect('x.tsx', '<form><input name="email" /><input type="checkbox" defaultChecked /></form>'),
    ).toEqual([]);
  });

  it('does not flag a prechecked newsletter when the PDN checkbox is unchecked', () => {
    const source = `<form>
      <input name="email" type="email" />
      <label><input type="checkbox" name="newsletter" defaultChecked /> Подписка на рассылку</label>
      <label><input type="checkbox" name="pdnConsent" /> Я согласен на обработку персональных данных</label>
    </form>`;
    expect(detect('Contact.tsx', source)).toEqual([]);
  });

  it('still flags a prechecked PDN checkbox next to a newsletter checkbox', () => {
    const source = `<form>
      <input name="email" type="email" />
      <label><input type="checkbox" name="newsletter" defaultChecked /> Подписка на рассылку</label>
      <label><input type="checkbox" name="pdnConsent" defaultChecked /> Я согласен на обработку персональных данных</label>
    </form>`;
    expect(detect('Contact.tsx', source).map((f) => f.ruleId)).toContain('PDN.FORM.PRECHECKED_CONSENT');
  });

  it('does not flag defaultChecked={false} or checked={false}', () => {
    const sources = [
      `<form><input name="email" /><input type="checkbox" defaultChecked={false} /> согласие на обработку персональных данных</form>`,
      `<form><input name="email" /><input type="checkbox" checked={false} /> согласие на обработку персональных данных</form>`,
    ];
    for (const source of sources) {
      expect(detect('Contact.tsx', source), source).toEqual([]);
    }
  });
});
