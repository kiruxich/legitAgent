import { findingFromRule, sourceAnalysis, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

export function detectFormPrecheckedConsent(args: DetectorArgs): Finding[] {
  return sourceAnalysis(args).forms
    .filter((form) => form.hasPii && form.hasPrecheckedConsent)
    .map((form) =>
      findingFromRule(args.catalog, 'PDN.FORM.PRECHECKED_CONSENT', args.relativePath, form.startLine, {
        endLine: form.endLine,
        confidence: 'high',
        kind: 'violation',
        evidence: {
          summary: 'Чекбокс согласия внутри формы отмечен заранее.',
          signals: form.signals,
          snippet: form.snippet,
        },
        fingerprintHint: form.snippet,
      }),
    );
}
