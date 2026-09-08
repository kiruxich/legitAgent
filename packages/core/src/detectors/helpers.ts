import { createHash } from 'node:crypto';
import { analyzeSource, type SourceAnalysis } from '../analysis.js';
import type { Catalog, Confidence, Finding, FindingEvidence, FindingKind, Lang, Rule } from '../types.js';

export function localizedRule(rule: Rule, lang: Lang = 'ru'): Pick<Rule, 'message' | 'fix' | 'title'> {
  if (lang === 'en') {
    return {
      title: rule.titleEn ?? rule.title,
      message: rule.messageEn ?? rule.message,
      fix: rule.fixEn ?? rule.fix,
    };
  }
  return { title: rule.title, message: rule.message, fix: rule.fix };
}

export interface DetectorArgs {
  filePath: string;
  relativePath: string;
  source: string;
  catalog: Catalog;
  analysis?: SourceAnalysis;
}

export type Detector = (args: DetectorArgs) => Finding[];

export function sourceAnalysis(args: DetectorArgs): SourceAnalysis {
  return args.analysis ?? analyzeSource(args.filePath, args.source);
}

export interface FindingDetails {
  endLine?: number | null;
  confidence?: Confidence;
  kind?: FindingKind;
  evidence?: Partial<FindingEvidence>;
  fingerprintHint?: string;
}

function fingerprint(parts: string[]): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 20);
}

export function findingFromRule(
  catalog: Catalog,
  ruleId: string,
  file: string,
  line: number | null,
  details: FindingDetails = {},
): Finding {
  const rule = catalog.rules.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Unknown rule ${ruleId}`);
  const excerpt = catalog.excerpts[rule.excerptRef];
  const evidence: FindingEvidence = {
    summary: details.evidence?.summary ?? rule.message,
    signals: details.evidence?.signals ?? [],
    ...(details.evidence?.snippet ? { snippet: details.evidence.snippet } : {}),
  };
  const stableHint = (details.fingerprintHint ?? evidence.signals.join('|')).replace(/\s+/g, ' ').trim();
  return {
    fingerprint: fingerprint([
      ruleId,
      file,
      stableHint,
    ]),
    ruleId,
    file,
    line,
    endLine: details.endLine ?? line,
    severity: rule.severity,
    confidence: details.confidence ?? rule.confidence ?? 'medium',
    kind: details.kind ?? rule.kind ?? 'risk',
    message: rule.message,
    fix: rule.fix,
    excerpt: excerpt.text,
    legalBasis: [rule.law],
    evidence,
  };
}

export function localizeFinding(catalog: Catalog, finding: Finding, lang: Lang): Finding {
  if (lang !== 'en') return finding;
  const rule = catalog.rules.find((r) => r.id === finding.ruleId);
  if (!rule) return finding;
  const loc = localizedRule(rule, 'en');
  return { ...finding, message: loc.message, fix: loc.fix };
}
