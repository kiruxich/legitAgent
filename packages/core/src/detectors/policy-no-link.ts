import { findingFromRule } from './helpers.js';
import type { Catalog, Finding } from '../types.js';

export const POLICY_HREF = /href\s*=\s*["'][^"']*(privacy|personal-data|политик|pdn|confidential)[^"']*["']/i;

export function detectPolicyNoLink(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[] {
  const hit = args.files.find((f) => POLICY_HREF.test(f.source) || /политик[аи] конфиденциальности/i.test(f.source));
  if (hit) return [];
  const file = args.files.length === 1 ? (args.files[0]?.relativePath ?? '.') : '.';
  return [findingFromRule(args.catalog, 'PDN.POLICY.NO_LINK', file, null)];
}
