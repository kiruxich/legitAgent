export type Severity = 'high' | 'medium' | 'low';
export type RuleStatus = 'active' | 'planned';

export interface Rule {
  id: string;
  law: string;
  severity: Severity;
  status: RuleStatus;
  title: string;
  message: string;
  fix: string;
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

export interface ExplainResult {
  rule: Rule;
  excerpt: LegalExcerpt;
  disclaimer: string;
}
