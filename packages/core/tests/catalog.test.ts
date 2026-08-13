import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../src/catalog.js';

function tmpCatalog(ruleYaml: string, excerptYaml?: string) {
  const dir = mkdtempSync(path.join(tmpdir(), 'legitagent-'));
  mkdirSync(path.join(dir, 'rules'));
  mkdirSync(path.join(dir, 'legal'));
  writeFileSync(path.join(dir, 'rules', 'r.yaml'), ruleYaml);
  if (excerptYaml) writeFileSync(path.join(dir, 'legal', 'e.yaml'), excerptYaml);
  return dir;
}

const excerpt = `id: art9
law: 152-ФЗ
article: ст. 9
text: Согласие должно быть конкретным.
sourceUrl: https://pravo.gov.ru/
`;

describe('loadCatalog', () => {
  it('loads a rule and its excerpt', () => {
    const dir = tmpCatalog(
      `- id: PDN.FORM.NO_CONSENT
  law: 152-ФЗ ст. 9
  severity: high
  status: active
  title: Нет согласия
  message: Форма без согласия
  fix: Добавьте чекбокс
  excerptRef: art9
`,
      excerpt,
    );
    const catalog = loadCatalog(path.join(dir, 'rules'), path.join(dir, 'legal'));
    expect(catalog.rules).toHaveLength(1);
    expect(catalog.excerpts.art9.text).toContain('конкретным');
  });

  it('throws when excerptRef is missing from legal files', () => {
    const dir = tmpCatalog(
      `- id: X
  law: L
  severity: high
  status: planned
  title: t
  message: m
  fix: f
  excerptRef: missing
`,
      excerpt,
    );
    expect(() => loadCatalog(path.join(dir, 'rules'), path.join(dir, 'legal'))).toThrow(
      /missing/,
    );
  });
});
