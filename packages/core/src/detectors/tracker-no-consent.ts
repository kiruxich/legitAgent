import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

const TRACKER = /\b(ym|gtag|ga|fbq|VK\.Retargeting)\s*\(/;
const CMP =
  /Cookiebot|tarteaucitron|OneTrust|cookieyes|CookieConsent|cookie-consent|hasMarketingConsent/i;

export function detectTrackerNoConsent(args: DetectorArgs): Finding[] {
  if (!TRACKER.test(args.source)) return [];
  if (CMP.test(args.source)) return [];
  if (/\bconsent\b/i.test(args.source) && /if\s*\(/i.test(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => TRACKER.test(l));
  return [findingFromRule(args.catalog, 'PDN.TRACKER.NO_CONSENT', args.relativePath, line >= 0 ? line + 1 : null)];
}
