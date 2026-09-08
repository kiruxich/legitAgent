import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

const AD_LABEL = />\s*Реклама\s*</i;
const ERID = /erid\s*[:=]|data-erid/i;

export function detectEridMissing(args: DetectorArgs): Finding[] {
  if (!AD_LABEL.test(args.source) || ERID.test(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => AD_LABEL.test(l));
  const startLine = line >= 0 ? line + 1 : null;
  return [findingFromRule(args.catalog, 'ADV.ERID.MISSING', args.relativePath, startLine, {
    evidence: {
      summary: 'Найдена явная пометка «Реклама», но рядом в файле не найден erid.',
      signals: ['advertising label', 'erid not found'],
      snippet: startLine ? args.source.split(/\n/)[startLine - 1] : undefined,
    },
  })];
}
