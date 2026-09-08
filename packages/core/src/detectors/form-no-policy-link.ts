import { findingFromRule, sourceAnalysis, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

export function detectFormNoPolicyLink(args: DetectorArgs): Finding[] {
  return sourceAnalysis(args).forms
    .filter((form) => form.hasPii && form.hasConsent && !form.hasPolicyLink)
    .map((form) =>
      findingFromRule(args.catalog, 'PDN.FORM.NO_POLICY_LINK', args.relativePath, form.startLine, {
        endLine: form.endLine,
        confidence: 'high',
        kind: 'violation',
        evidence: {
          summary: 'В форме есть согласие, но в пределах этой формы не найдена ссылка на политику.',
          signals: form.signals,
          snippet: form.snippet,
        },
        fingerprintHint: form.snippet,
      }),
    );
}
