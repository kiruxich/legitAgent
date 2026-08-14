import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

const AD_LABEL = />\s*Реклама\s*</i;
const ERID = /erid\s*[:=]|data-erid/i;

export function detectEridMissing(args: DetectorArgs): Finding[] {
  if (!AD_LABEL.test(args.source) || ERID.test(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => AD_LABEL.test(l));
  return [findingFromRule(args.catalog, 'ADV.ERID.MISSING', args.relativePath, line >= 0 ? line + 1 : null)];
}
