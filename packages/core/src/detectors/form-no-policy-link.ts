import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';
import { POLICY_HREF } from './policy-no-link.js';

const PII = /(email|e-mail|phone|tel|name|fio|имя|телефон|почта)/i;
const CONSENT = /(персональн|согласи|consent|обработк)/i;

function hasPiiForm(source: string): boolean {
  return /<form[\s>]/i.test(source) && /<input\b/i.test(source) && PII.test(source);
}

function hasConsentCheckbox(source: string): boolean {
  return /type=["']checkbox["']/i.test(source) && CONSENT.test(source);
}

export function detectFormNoPolicyLink(args: DetectorArgs): Finding[] {
  if (!hasPiiForm(args.source) || !hasConsentCheckbox(args.source)) return [];
  if (POLICY_HREF.test(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => /<form[\s>]/i.test(l));
  return [findingFromRule(args.catalog, 'PDN.FORM.NO_POLICY_LINK', args.relativePath, line >= 0 ? line + 1 : null)];
}
