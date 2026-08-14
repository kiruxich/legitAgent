import { accessSync, constants } from 'node:fs';
import path from 'node:path';
import {
  explainRule,
  findArticle,
  generatePolicyMarkdown,
  listCorpus,
  listRules,
  readCorpus,
  scanProject,
  type Lang,
} from '@legit-agent/core';

function resolveRoot(root?: string): string {
  return path.resolve(root ?? process.cwd());
}

function assertReadableRoot(root: string): void {
  try {
    accessSync(root, constants.R_OK);
  } catch {
    throw new Error('Укажите корень проекта');
  }
}

function parseLang(lang?: string): Lang {
  return lang === 'en' ? 'en' : 'ru';
}

export async function handleScan(root?: string, lang?: string) {
  const resolved = resolveRoot(root);
  assertReadableRoot(resolved);
  return scanProject(resolved, undefined, { lang: parseLang(lang) });
}

export function handleListRules() {
  return listRules();
}

export function handleExplainRule(ruleId: string, lang?: string) {
  return explainRule(ruleId, undefined, parseLang(lang));
}

export async function handleScanUrl(url?: string) {
  if (!url?.trim()) throw new Error('Укажите URL сайта');
  const { scanUrl } = await import('@legit-agent/live');
  return scanUrl(url);
}

export function handleGeneratePolicy(args: {
  operator?: string;
  inn?: string;
  ogrn?: string;
  email?: string;
  site?: string;
  address?: string;
}) {
  return generatePolicyMarkdown({
    operator: args.operator ?? '',
    inn: args.inn,
    ogrn: args.ogrn,
    email: args.email,
    site: args.site,
    address: args.address,
  });
}

export function handleGetLaw(lawId?: string, article?: string) {
  if (!lawId?.trim()) {
    return listCorpus();
  }
  if (article?.trim()) return findArticle(lawId, article);
  return readCorpus(lawId);
}
