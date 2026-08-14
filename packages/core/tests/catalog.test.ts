import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISCLAIMER_RU } from '../src/disclaimer.js';
import { defaultCatalog, loadCatalog, renderCatalogMarkdown } from '../src/catalog.js';
import { packageRoot } from '../src/paths.js';

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

  it('throws a clear error when rules dir is missing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'legitagent-'));
    mkdirSync(path.join(dir, 'legal'));
    const missingRules = path.join(dir, 'rules');
    expect(() => loadCatalog(missingRules, path.join(dir, 'legal'))).toThrow(
      `Каталог не найден: ${missingRules}`,
    );
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

describe('defaultCatalog', () => {
  it('includes active detectors and planned rules', () => {
    const catalog = defaultCatalog();
    const ids = catalog.rules.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([
      'PDN.FORM.NO_CONSENT',
      'PDN.TRACKER.NO_CONSENT',
      'PDN.POLICY.NO_LINK',
      'PDN.FORM.PRECHECKED_CONSENT',
      'PDN.ORG.RKN_NOTICE',
    ]));
    const active = catalog.rules.filter((r) => r.status === 'active').map((r) => r.id);
    expect(active.sort()).toEqual([
      'PDN.COOKIE.BEFORE_CONSENT',
      'PDN.COOKIE.NO_REJECT',
      'PDN.FORM.NO_CONSENT',
      'PDN.FORM.NO_POLICY_LINK',
      'PDN.FORM.PRECHECKED_CONSENT',
      'PDN.POLICY.INCOMPLETE',
      'PDN.POLICY.NO_LINK',
      'PDN.TRACKER.NO_CONSENT',
      'PDN.TRANSFER.FOREIGN_TRACKER',
    ]);
    for (const rule of catalog.rules) {
      expect(catalog.excerpts[rule.excerptRef], rule.id).toBeDefined();
    }
  });
});

describe('renderCatalogMarkdown', () => {
  it('lists every rule with status, excerpt, and disclaimer', () => {
    const catalog = defaultCatalog();
    const md = renderCatalogMarkdown(catalog);
    expect(md).toContain('# Каталог правил legitAgent');
    expect(md).toContain(DISCLAIMER_RU);
    expect(md).toContain('Активные детекторы');
    expect(md).toContain('Запланированные правила');
    for (const rule of catalog.rules) {
      expect(md, rule.id).toContain(`\`${rule.id}\``);
      expect(md, rule.id).toContain(rule.title);
      expect(md, rule.id).toContain(rule.message);
      expect(md, rule.id).toContain(rule.fix);
      expect(md, rule.id).toContain(rule.law);
      const excerpt = catalog.excerpts[rule.excerptRef];
      expect(md, rule.id).toContain(excerpt.text);
    }
  });

  it('matches the committed docs/RULES.md', () => {
    const committed = readFileSync(
      path.join(packageRoot(), '..', '..', 'docs', 'RULES.md'),
      'utf8',
    );
    expect(committed).toBe(renderCatalogMarkdown(defaultCatalog()));
  });
});
