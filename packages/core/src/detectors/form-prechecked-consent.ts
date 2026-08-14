import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

const PII = /(email|e-mail|phone|tel|name|fio|имя|телефон|почта)/i;
const CONSENT = /(персональн|согласи|consent|обработк)/i;

function hasPiiForm(source: string): boolean {
  return /<form[\s>]/i.test(source) && /<input\b/i.test(source) && PII.test(source);
}

function hasConsentCheckbox(source: string): boolean {
  return /type=["']checkbox["']/i.test(source) && CONSENT.test(source);
}

function isPrechecked(tag: string): boolean {
  if (/\bdefaultChecked\b/.test(tag)) return true;
  if (/checked\s*=\s*\{\s*true\s*\}/.test(tag)) return true;
  if (/checked\s*=\s*["'](?:checked|true)["']/i.test(tag)) return true;
  if (/(?:^|\s)checked(?:\s|\/|$)/.test(tag)) return true;
  return false;
}

export function detectFormPrecheckedConsent(args: DetectorArgs): Finding[] {
  if (!hasPiiForm(args.source) || !hasConsentCheckbox(args.source)) return [];
  const tags = args.source.match(/<input\b[^>]*>/gi) ?? [];
  const prechecked = tags.some((tag) => /type=["']checkbox["']/i.test(tag) && isPrechecked(tag));
  if (!prechecked) return [];
  const line = args.source.split(/\n/).findIndex((l) => /<form[\s>]/i.test(l));
  return [findingFromRule(args.catalog, 'PDN.FORM.PRECHECKED_CONSENT', args.relativePath, line >= 0 ? line + 1 : null)];
}
