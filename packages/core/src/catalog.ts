import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { defaultLegalDir, defaultRulesDir } from './paths.js';
import type { Catalog, LegalExcerpt, Rule } from './types.js';

function loadYamlFiles<T>(dir: string): T[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const items: T[] = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const raw = readFileSync(full, 'utf8');
    let parsed: unknown;
    try {
      parsed = yaml.load(raw);
    } catch (err) {
      throw new Error(`Некорректный YAML: ${full}: ${(err as Error).message}`);
    }
    if (Array.isArray(parsed)) items.push(...(parsed as T[]));
    else if (parsed && typeof parsed === 'object') items.push(parsed as T);
  }
  return items;
}

export function loadCatalog(rulesDir: string, legalDir: string): Catalog {
  const rules = loadYamlFiles<Rule>(rulesDir);
  const excerptList = loadYamlFiles<LegalExcerpt>(legalDir);
  const excerpts: Record<string, LegalExcerpt> = {};
  for (const e of excerptList) excerpts[e.id] = e;
  for (const rule of rules) {
    if (!excerpts[rule.excerptRef]) {
      throw new Error(
        `Правило ${rule.id} ссылается на отсутствующую выдержку "${rule.excerptRef}"`,
      );
    }
  }
  return { rules, excerpts };
}

export function defaultCatalog(): Catalog {
  return loadCatalog(defaultRulesDir(), defaultLegalDir());
}
