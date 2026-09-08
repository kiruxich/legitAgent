import { findingFromRule, sourceAnalysis, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

export function detectFormNoConsent(args: DetectorArgs): Finding[] {
  return sourceAnalysis(args).forms
    .filter((form) => form.hasPii && !form.hasConsent)
    .map((form) =>
      findingFromRule(args.catalog, 'PDN.FORM.NO_CONSENT', args.relativePath, form.startLine, {
        endLine: form.endLine,
        confidence: 'high',
        kind: 'violation',
        evidence: {
          summary: 'Форма собирает похожие на персональные данные поля, но внутри неё нет элемента согласия.',
          signals: form.signals,
          snippet: form.snippet,
        },
        fingerprintHint: form.snippet,
      }),
    );
}
