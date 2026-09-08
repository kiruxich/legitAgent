import type { Confidence, Finding } from './types.js';

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function isBlockingFinding(finding: Finding, minimumConfidence: Confidence = 'low'): boolean {
  return finding.severity === 'high' &&
    CONFIDENCE_RANK[finding.confidence] >= CONFIDENCE_RANK[minimumConfidence];
}

export function countBlockingFindings(findings: Finding[], minimumConfidence: Confidence = 'low'): number {
  return findings.filter((finding) => isBlockingFinding(finding, minimumConfidence)).length;
}
