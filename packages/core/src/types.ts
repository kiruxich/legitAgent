export type Severity = 'high' | 'medium' | 'low';
export type RuleStatus = 'active' | 'planned';
export type Lang = 'ru' | 'en';

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
}

export interface LegalExcerpt {
  id: string;
  law: string;
  article: string;
  text: string;
  sourceUrl: string;
}

export interface Catalog {
  rules: Rule[];
  excerpts: Record<string, LegalExcerpt>;
}

export interface Finding {
  ruleId: string;
  file: string;
  line: number | null;
  severity: Severity;
  message: string;
  fix: string;
  excerpt: string;
}

export type Verdict = 'confirm' | 'reject' | 'ask_human';

export interface ReviewedFinding extends Finding {
  verdict: Verdict;
  reason: string;
}

export interface ScanWarning {
  file: string;
  message: string;
}

export interface ScanConfig {
  ignore: string[];
  disabled: string[];
  severity: Record<string, Severity>;
}

export interface ScanResult {
  findings: Finding[];
  warnings: ScanWarning[];
  scannedFileCount: number;
}

export interface ScanOptions {
  lang?: Lang;
}

export interface ExplainResult {
  rule: Rule;
  excerpt: LegalExcerpt;
  disclaimer: string;
}
