import { findingFromRule } from './helpers.js';
import type { Catalog, Finding } from '../types.js';

const POLICY_PATH = /(privacy|personal-data|политик|pdn|confidential)/i;
const POLICY_TEXT = /политик[аи].{0,40}(обработк|конфиденциальност|персональн)/i;
const REQUIRED = [/оператор/i, /цел/i, /срок/i, /отзыв/i];

function isPolicyFile(file: { relativePath: string; source: string }): boolean {
  return POLICY_PATH.test(file.relativePath) || POLICY_TEXT.test(file.source);
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
      const line = file.source.split(/\n/).findIndex((l) => POLICY_TEXT.test(l) || POLICY_PATH.test(l));
      return findingFromRule(args.catalog, 'PDN.POLICY.INCOMPLETE', file.relativePath, line >= 0 ? line + 1 : 1);
    });
}
