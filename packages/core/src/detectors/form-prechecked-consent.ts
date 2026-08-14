import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

const PII = /(email|e-mail|phone|tel|name|fio|имя|телефон|почта)/i;
const CONSENT = /(персональн|согласи|consent|обработк)/i;
const INPUT_TAG = /<input\b[^>]*>/gi;

function hasPiiForm(source: string): boolean {
  return /<form[\s>]/i.test(source) && /<input\b/i.test(source) && PII.test(source);
}

function consentContext(source: string, tagStart: number, tag: string): string {
  const before = source.slice(0, tagStart);
  let lastOpen = -1;
  const labelOpen = /<label\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = labelOpen.exec(before))) lastOpen = match.index;
  const lastClose = before.toLowerCase().lastIndexOf('</label>');
  if (lastOpen > lastClose) {
    const end = source.toLowerCase().indexOf('</label>', tagStart);
    return source.slice(lastOpen, end >= 0 ? end : tagStart + tag.length);
  }
  const prevTag = before.lastIndexOf('>');
  const preceding = before.slice(prevTag + 1);
  const after = source.slice(tagStart + tag.length);
  const next = after.search(/<\/?(?:input|label|form|button)\b/i);
  const following = next >= 0 ? after.slice(0, next) : after.slice(0, 240);
  return preceding + tag + following;
}

function isConsentCheckbox(source: string, tagStart: number, tag: string): boolean {
  return /type=["']checkbox["']/i.test(tag) && CONSENT.test(consentContext(source, tagStart, tag));
}

function isPrechecked(tag: string): boolean {
  if (/\bdefaultChecked\s*=\s*\{\s*false\s*\}/.test(tag)) return false;
  if (/\bchecked\s*=\s*\{\s*false\s*\}/.test(tag)) return false;
  if (/\bdefaultChecked\b/.test(tag)) return true;
  if (/checked\s*=\s*\{\s*true\s*\}/.test(tag)) return true;
  if (/checked\s*=\s*["'](?:checked|true)["']/i.test(tag)) return true;
  if (/(?:^|\s)checked(?:[\s/>]|$)/.test(tag)) return true;
  return false;
}

export function detectFormPrecheckedConsent(args: DetectorArgs): Finding[] {
  if (!hasPiiForm(args.source)) return [];
  const tags = [...args.source.matchAll(INPUT_TAG)];
  const precheckedConsent = tags.some((match) => {
    const tag = match[0];
    const index = match.index ?? 0;
    return isConsentCheckbox(args.source, index, tag) && isPrechecked(tag);
  });
  if (!precheckedConsent) return [];
  const line = args.source.split(/\n/).findIndex((l) => /<form[\s>]/i.test(l));
  return [findingFromRule(args.catalog, 'PDN.FORM.PRECHECKED_CONSENT', args.relativePath, line >= 0 ? line + 1 : null)];
}
