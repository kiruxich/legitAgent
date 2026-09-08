import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

const BANNER = /cookie-banner|CookieBanner|cookie consent|куки/i;
const ACCEPT = /принять|accept/i;
const REJECT = /отклон|отказ|reject|decline/i;

export function detectCookieNoReject(args: DetectorArgs): Finding[] {
  if (!BANNER.test(args.source)) return [];
  if (!ACCEPT.test(args.source) || REJECT.test(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => BANNER.test(l));
  const startLine = line >= 0 ? line + 1 : null;
  return [findingFromRule(args.catalog, 'PDN.COOKIE.NO_REJECT', args.relativePath, startLine, {
    confidence: 'medium',
    kind: 'risk',
    evidence: {
      summary: 'В коде cookie-баннера найдено принятие, но не найден элемент отказа.',
      signals: ['cookie banner marker', 'accept control', 'reject control not found'],
      snippet: startLine ? args.source.split(/\n/)[startLine - 1] : undefined,
    },
  })];
}
