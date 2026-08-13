import type { Catalog, Finding } from '../types.js';

export interface DetectorArgs {
  filePath: string;
  relativePath: string;
  source: string;
  catalog: Catalog;
}

export type Detector = (args: DetectorArgs) => Finding[];

export function findingFromRule(
  catalog: Catalog,
  ruleId: string,
  file: string,
  line: number | null,
): Finding {
  const rule = catalog.rules.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Unknown rule ${ruleId}`);
  const excerpt = catalog.excerpts[rule.excerptRef];
  return {
    ruleId,
    file,
    line,
    severity: rule.severity,
    message: rule.message,
    fix: rule.fix,
    excerpt: excerpt.text,
  };
}
