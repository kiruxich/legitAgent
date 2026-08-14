import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultCatalog } from './catalog.js';
import { loadScanConfig } from './config.js';
import { disclaimer } from './disclaimer.js';
import { discoverSourceFiles } from './discover.js';
import { localizeFinding } from './detectors/helpers.js';
import { detectCookieNoReject } from './detectors/cookie-no-reject.js';
import { detectConsumerShop } from './detectors/consumer-shop.js';
import { detectEridMissing } from './detectors/erid-missing.js';
import { detectFormNoConsent } from './detectors/form-no-consent.js';
import { detectFormNoPolicyLink } from './detectors/form-no-policy-link.js';
import { detectFormPrecheckedConsent } from './detectors/form-prechecked-consent.js';
import { detectForeignTracker } from './detectors/foreign-tracker.js';
import { detectLocalizationUnclear, detectRknNotice } from './detectors/org-checklist.js';
import { detectPolicyIncomplete } from './detectors/policy-incomplete.js';
import { detectPolicyNoLink } from './detectors/policy-no-link.js';
import { detectTrackerNoConsent } from './detectors/tracker-no-consent.js';
import type { Catalog, ExplainResult, Finding, Lang, Rule, ScanOptions, ScanResult, ScanWarning } from './types.js';

function looksBroken(filePath: string, source: string): boolean {
  if (/\.(vue|svelte|astro)$/i.test(filePath)) return false;
  return (source.match(/{/g) ?? []).length !== (source.match(/}/g) ?? []).length;
}

export async function scanProject(
  root: string,
  catalog = defaultCatalog(),
  options: ScanOptions = {},
): Promise<ScanResult> {
  const lang: Lang = options.lang === 'en' ? 'en' : 'ru';
  const { config, warnings: configWarnings } = loadScanConfig(root);
  const warnings: ScanWarning[] = [...configWarnings];

  for (const id of config.disabled) {
    if (!catalog.rules.some((r) => r.id === id)) {
      warnings.push({ file: 'legitagent.config.json', message: `Неизвестное правило: ${id}` });
    }
  }
  for (const id of Object.keys(config.severity)) {
    if (!catalog.rules.some((r) => r.id === id)) {
      warnings.push({ file: 'legitagent.config.json', message: `Неизвестное правило: ${id}` });
    }
  }

  const files = await discoverSourceFiles(root, config.ignore);
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
    if (looksBroken(filePath, source)) {
      warnings.push({ file: relativePath, message: 'Файл пропущен: похоже на синтаксическую ошибку' });
      continue;
    }
    loaded.push({ relativePath, source });
    findings.push(
      ...detectFormNoConsent({ filePath, relativePath, source, catalog }),
      ...detectFormPrecheckedConsent({ filePath, relativePath, source, catalog }),
      ...detectFormNoPolicyLink({ filePath, relativePath, source, catalog }),
      ...detectTrackerNoConsent({ filePath, relativePath, source, catalog }),
      ...detectForeignTracker({ filePath, relativePath, source, catalog }),
      ...detectCookieNoReject({ filePath, relativePath, source, catalog }),
      ...detectEridMissing({ filePath, relativePath, source, catalog }),
    );
  }

  if (loaded.length > 0) {
    findings.push(...detectPolicyNoLink({ catalog, files: loaded }));
    findings.push(...detectPolicyIncomplete({ catalog, files: loaded }));
    findings.push(...detectLocalizationUnclear({ catalog, files: loaded }));
    findings.push(...detectRknNotice({ catalog, files: loaded }));
    findings.push(...detectConsumerShop({ catalog, files: loaded }));
  }

  const filtered = findings.filter((f) => !config.disabled.includes(f.ruleId)).map((f) => localizeFinding(catalog, f, lang));
  for (const finding of filtered) {
    const override = config.severity[finding.ruleId];
    if (override) finding.severity = override;
  }

  return { findings: filtered, warnings, scannedFileCount: loaded.length };
}

export function listRules(catalog = defaultCatalog()): Rule[] {
  return catalog.rules;
}

export function explainRule(ruleId: string, catalog = defaultCatalog(), lang: Lang = 'ru'): ExplainResult {
  const rule = catalog.rules.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Неизвестное правило: ${ruleId}`);
  const excerpt = catalog.excerpts[rule.excerptRef];
  return { rule, excerpt, disclaimer: disclaimer(lang) };
}
