export type Severity = 'high' | 'medium' | 'low';
export type RuleStatus = 'active' | 'planned';
export type Lang = 'ru' | 'en';
export type Confidence = 'high' | 'medium' | 'low';
export type FindingKind = 'violation' | 'risk' | 'manual_check';

export interface Rule {
  id: string;
  law: string;
  severity: Severity;
  status: RuleStatus;
  title: string;
  titleEn?: string;
  message: string;
  messageEn?: string;
  fix: string;
  fixEn?: string;
  excerptRef: string;
  kind?: FindingKind;
  confidence?: Confidence;
}

export interface LegalExcerpt {
  id: string;
  law: string;
  article: string;
  text: string;
  sourceUrl: string;
  verifiedAt?: string;
  effectiveFrom?: string;
}

export interface FindingEvidence {
  summary: string;
  signals: string[];
  snippet?: string;
}

export interface FindingSuppression {
  source: 'baseline' | 'inline' | 'config';
  reason: string;
}

export interface Catalog {
  rules: Rule[];
  excerpts: Record<string, LegalExcerpt>;
}

export interface Finding {
  fingerprint: string;
  ruleId: string;
  file: string;
  line: number | null;
  endLine: number | null;
  severity: Severity;
  confidence: Confidence;
  kind: FindingKind;
  message: string;
  fix: string;
  excerpt: string;
  legalBasis: string[];
  evidence: FindingEvidence;
  suppression?: FindingSuppression;
}

export type Verdict = 'confirm' | 'reject' | 'ask_human' | 'not_reviewed';
export type ReviewMode = 'offline' | 'local' | 'openrouter' | 'custom';

export interface ReviewedFinding extends Finding {
  verdict: Verdict;
  reason: string;
  reviewMode: ReviewMode;
  dataShared: boolean;
  reviewModel?: string;
}

export interface ReviewOptions {
  batchSize?: number;
  maxFindings?: number;
  maxPromptChars?: number;
  maxCostUsd?: number;
}

export interface ScanWarning {
  file: string;
  message: string;
}

export interface ScanConfig {
  ignore: string[];
  disabled: string[];
  severity: Record<string, Severity>;
  suppress: ScanSuppression[];
  baseline?: string;
  cache?: boolean | string;
}

export interface ScanSuppression {
  fingerprint?: string;
  ruleId?: string;
  file?: string;
  reason: string;
  expires?: string;
}

export interface ScanResult {
  findings: Finding[];
  suppressedFindings: Finding[];
  warnings: ScanWarning[];
  scannedFileCount: number;
  contextFileCount?: number;
  cache?: { hits: number; misses: number; path: string };
}

export interface ScanOptions {
  lang?: Lang;
  changedFiles?: string[];
  baselineFingerprints?: string[];
  cache?: boolean | string;
}

export interface AutofixChange {
  ruleId: string;
  file: string;
  line: number | null;
  safety: 'safe' | 'manual';
  description: string;
  applied: boolean;
}

export interface AutofixResult {
  changes: AutofixChange[];
  changedFiles: string[];
}

export interface ExplainResult {
  rule: Rule;
  excerpt: LegalExcerpt;
  disclaimer: string;
}
