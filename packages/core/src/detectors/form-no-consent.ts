import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

const PII = /(email|e-mail|phone|tel|name|fio|имя|телефон|почта)/i;
const CONSENT = /(персональн|согласи|consent|обработк)/i;

function hasPii(source: string): boolean {
  return /<form[\s>]/i.test(source) && /<input\b/i.test(source) && PII.test(source);
}

function hasConsent(source: string): boolean {
  return /type=["']checkbox["']/i.test(source) && CONSENT.test(source);
}

export function detectFormNoConsent(args: DetectorArgs): Finding[] {
  if (!hasPii(args.source) || hasConsent(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => /<form[\s>]/i.test(l));
  return [findingFromRule(args.catalog, 'PDN.FORM.NO_CONSENT', args.relativePath, line >= 0 ? line + 1 : null)];
}
