import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scanProject } from '../src/scan.js';
import { DISCLAIMER_EN } from '../src/disclaimer.js';
import { generatePolicyMarkdown } from '../src/policy.js';
import { findArticle, listCorpus, readCorpus } from '../src/corpus.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('v4 stacks and new detectors', () => {
  it('scans Vue SFC forms', async () => {
    const result = await scanProject(path.join(here, 'fixtures/vue-form'));
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
  });

  it('scans Svelte forms', async () => {
    const result = await scanProject(path.join(here, 'fixtures/svelte-form'));
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
  });

  it('scans Astro shop pages for consumer rules', async () => {
    const result = await scanProject(path.join(here, 'fixtures/astro-shop'));
    const ids = result.findings.map((f) => f.ruleId);
    expect(ids).toEqual(expect.arrayContaining([
      'CONSUMER.OFFER.MISSING',
      'CONSUMER.REQUISITES.MISSING',
      'CONSUMER.RETURN.MISSING',
    ]));
  });

  it('flags ads without erid and skips ads with data-erid', async () => {
    const bad = await scanProject(path.join(here, 'fixtures/bad-erid'));
    const good = await scanProject(path.join(here, 'fixtures/good-erid'));
    expect(bad.findings.some((f) => f.ruleId === 'ADV.ERID.MISSING')).toBe(true);
    expect(good.findings.some((f) => f.ruleId === 'ADV.ERID.MISSING')).toBe(false);
  });

  it('flags localization when a foreign tracker has no RF mention', async () => {
    const bad = await scanProject(path.join(here, 'fixtures/bad-localization'));
    const good = await scanProject(path.join(here, 'fixtures/good-localization'));
    expect(bad.findings.some((f) => f.ruleId === 'PDN.LOCALIZATION.UNCLEAR')).toBe(true);
    expect(good.findings.some((f) => f.ruleId === 'PDN.LOCALIZATION.UNCLEAR')).toBe(false);
  });

  it('does not flag RKN notice when the policy mentions Roskomnadzor', async () => {
    const result = await scanProject(path.join(here, 'fixtures/good-rkn'));
    expect(result.findings.some((f) => f.ruleId === 'PDN.ORG.RKN_NOTICE')).toBe(false);
  });

  it('returns English finding text when lang is en', async () => {
    const result = await scanProject(path.join(here, 'fixtures/vue-form'), undefined, { lang: 'en' });
    const hit = result.findings.find((f) => f.ruleId === 'PDN.FORM.NO_CONSENT');
    expect(hit?.message).toMatch(/consent checkbox/i);
  });
});

describe('corpus', () => {
  it('lists 152-FZ, 38-FZ and ZoZPP and can extract an article', () => {
    const ids = listCorpus().map((e) => e.id).sort();
    expect(ids).toEqual(['152-fz', '38-fz', 'zozpp']);
    expect(readCorpus('152-fz')).toContain('Статья 1');
    expect(findArticle('152-fz', '9')).toMatch(/Статья\s+9/);
  });
});

describe('policy generator', () => {
  it('embeds operator, disclaimer and localization', () => {
    const md = generatePolicyMarkdown({ operator: 'ООО Тест', inn: '123', email: 'a@b.c', site: 'https://t.test' });
    expect(md).toContain('ООО Тест');
    expect(md).toContain('Это эвристическая проверка кода');
    expect(md).toContain('территории Российской Федерации');
    expect(md).toContain('a@b.c');
  });

  it('throws without operator', () => {
    expect(() => generatePolicyMarkdown({ operator: '  ' })).toThrow('Укажите наименование оператора');
  });
});

describe('english disclaimer', () => {
  it('exists', () => {
    expect(DISCLAIMER_EN).toMatch(/not legal advice/i);
  });
});
