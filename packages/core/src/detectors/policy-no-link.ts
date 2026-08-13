import { findingFromRule } from './helpers.js';
import type { Catalog, Finding } from '../types.js';

const POLICY = /href\s*=\s*["'][^"']*(privacy|personal-data|политик|pdn|confidential)[^"']*["']/i;

export function detectPolicyNoLink(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[] {
  const hit = args.files.find((f) => POLICY.test(f.source) || /политик[аи] конфиденциальности/i.test(f.source));
  if (hit) return [];
  return [findingFromRule(args.catalog, 'PDN.POLICY.NO_LINK', '.', null)];
}
