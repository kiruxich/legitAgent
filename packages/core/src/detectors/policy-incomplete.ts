import { findingFromRule } from './helpers.js';
import type { Catalog, Finding } from '../types.js';

const POLICY_PATH = /(privacy|personal-data|политик|pdn|confidential)/i;
const HEADING_POLICY = /<h[12]\b[^>]*>[\s\S]{0,200}?политик/i;
const POLICY_WORDS = [/обработк/i, /персональн/i, /конфиденциальн/i, /субъект/i, /согласи/i, /оператор/i];
const REQUIRED = [/оператор/i, /цел/i, /срок/i, /отзыв/i];
const MIN_BODY_LENGTH = 400;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSubstantialPolicyPage(source: string): boolean {
  if (!HEADING_POLICY.test(source)) return false;
  const text = stripTags(source);
  const wordHits = POLICY_WORDS.filter((re) => re.test(text)).length;
  return text.length >= MIN_BODY_LENGTH || wordHits >= 3;
}

function isPolicyFile(file: { relativePath: string; source: string }): boolean {
  return POLICY_PATH.test(file.relativePath) || isSubstantialPolicyPage(file.source);
}

function isIncomplete(source: string): boolean {
  return REQUIRED.some((re) => !re.test(source));
}

export function detectPolicyIncomplete(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[] {
  const policies = args.files.filter(isPolicyFile);
  if (policies.length === 0) return [];
  return policies
    .filter((file) => isIncomplete(file.source))
    .map((file) => {
      const line = file.source.split(/\n/).findIndex((l) => HEADING_POLICY.test(l) || POLICY_PATH.test(l));
      return findingFromRule(args.catalog, 'PDN.POLICY.INCOMPLETE', file.relativePath, line >= 0 ? line + 1 : 1);
    });
}
