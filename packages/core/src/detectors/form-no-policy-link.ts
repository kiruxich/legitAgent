import { findingFromRule, type DetectorArgs } from './helpers.js';
import { hasConsentControl, hasPiiForm } from './pdn.js';
import type { Finding } from '../types.js';
import { POLICY_HREF } from './policy-no-link.js';

export function detectFormNoPolicyLink(args: DetectorArgs): Finding[] {
  if (!hasPiiForm(args.source) || !hasConsentControl(args.source)) return [];
  if (POLICY_HREF.test(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => /<form[\s>]/i.test(l));
  return [findingFromRule(args.catalog, 'PDN.FORM.NO_POLICY_LINK', args.relativePath, line >= 0 ? line + 1 : null)];
}
