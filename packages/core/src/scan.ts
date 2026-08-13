import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultCatalog } from './catalog.js';
import { DISCLAIMER_RU } from './disclaimer.js';
import { discoverSourceFiles } from './discover.js';
import { detectFormNoConsent } from './detectors/form-no-consent.js';
import { detectPolicyNoLink } from './detectors/policy-no-link.js';
import { detectTrackerNoConsent } from './detectors/tracker-no-consent.js';
import type { Catalog, ExplainResult, Finding, Rule, ScanResult, ScanWarning } from './types.js';

function looksBroken(source: string): boolean {
  return (source.match(/{/g) ?? []).length !== (source.match(/}/g) ?? []).length;
}

export async function scanProject(root: string, catalog = defaultCatalog()): Promise<ScanResult> {
  const files = await discoverSourceFiles(root);
  const warnings: ScanWarning[] = [];
  const loaded: { relativePath: string; source: string }[] = [];
  const findings: Finding[] = [];

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath) || path.basename(filePath);
    let source: string;
    try {
      source = readFileSync(filePath, 'utf8');
    } catch (err) {
      warnings.push({ file: relativePath, message: (err as Error).message });
      continue;
    }
    if (looksBroken(source)) {
      warnings.push({ file: relativePath, message: 'Файл пропущен: похоже на синтаксическую ошибку' });
      continue;
    }
    loaded.push({ relativePath, source });
    findings.push(
      ...detectFormNoConsent({ filePath, relativePath, source, catalog }),
      ...detectTrackerNoConsent({ filePath, relativePath, source, catalog }),
    );
  }

  if (loaded.length > 0) {
    findings.push(...detectPolicyNoLink({ catalog, files: loaded }));
  }

  return { findings, warnings, scannedFileCount: loaded.length };
}

export function listRules(catalog = defaultCatalog()): Rule[] {
  return catalog.rules;
}

export function explainRule(ruleId: string, catalog = defaultCatalog()): ExplainResult {
  const rule = catalog.rules.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Неизвестное правило: ${ruleId}`);
  const excerpt = catalog.excerpts[rule.excerptRef];
  return { rule, excerpt, disclaimer: DISCLAIMER_RU };
}
