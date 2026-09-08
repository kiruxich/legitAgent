import { findingFromRule, sourceAnalysis, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

export function detectTrackerNoConsent(args: DetectorArgs): Finding[] {
  return sourceAnalysis(args).trackers
    .filter((tracker) => !tracker.guardedByConsent)
    .map((tracker) =>
      findingFromRule(args.catalog, 'PDN.TRACKER.NO_CONSENT', args.relativePath, tracker.startLine, {
        endLine: tracker.endLine,
        confidence: 'medium',
        kind: 'risk',
        evidence: {
          summary: `Вызов ${tracker.name} не защищён проверкой согласия.`,
          signals: tracker.signals,
          snippet: tracker.snippet,
        },
        fingerprintHint: `${tracker.name}:${tracker.snippet}`,
      }),
    );
}
