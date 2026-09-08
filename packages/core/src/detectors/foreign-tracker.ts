import { findingFromRule, sourceAnalysis, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

export function detectForeignTracker(args: DetectorArgs): Finding[] {
  const call = sourceAnalysis(args).trackers.find((tracker) => tracker.foreign);
  const url = args.source.match(/google-analytics|googletagmanager|facebook\.net|connect\.facebook/i);
  if (!call && !url) return [];
  const line = call?.startLine ?? args.source.slice(0, url?.index ?? 0).split('\n').length;
  const signal = call ? `foreign tracker call: ${call.name}` : `foreign tracker URL: ${url?.[0] ?? 'unknown'}`;
  return [
    findingFromRule(args.catalog, 'PDN.TRANSFER.FOREIGN_TRACKER', args.relativePath, line, {
      confidence: 'medium',
      kind: 'risk',
      evidence: {
        summary: 'Обнаружен иностранный трекер; фактическую трансграничную передачу нужно подтвердить.',
        signals: [signal],
        snippet: call?.snippet,
      },
      fingerprintHint: signal,
    }),
  ];
}
