import type { Catalog, Finding, Lang, Rule } from '../types.js';

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

export function localizeFinding(catalog: Catalog, finding: Finding, lang: Lang): Finding {
  if (lang !== 'en') return finding;
  const rule = catalog.rules.find((r) => r.id === finding.ruleId);
  if (!rule) return finding;
  const loc = localizedRule(rule, 'en');
  return { ...finding, message: loc.message, fix: loc.fix };
}
