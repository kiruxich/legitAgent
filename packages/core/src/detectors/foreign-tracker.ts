import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

const FOREIGN = /gtag\(|ga\(|fbq\(|google-analytics|googletagmanager|facebook\.net|connect\.facebook/;

export function detectForeignTracker(args: DetectorArgs): Finding[] {
  if (!FOREIGN.test(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => FOREIGN.test(l));
  return [findingFromRule(args.catalog, 'PDN.TRANSFER.FOREIGN_TRACKER', args.relativePath, line >= 0 ? line + 1 : null)];
}
