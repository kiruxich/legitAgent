import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { DISCLAIMER_RU } from './disclaimer.js';
import { defaultLegalDir, defaultRulesDir } from './paths.js';
import type { Catalog, LegalExcerpt, Rule, RuleStatus } from './types.js';

function loadYamlFiles<T>(dir: string): T[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Каталог не найден: ${dir}`);
    }
    throw err;
  }
  const files = entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
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

const STATUS_RU: Record<RuleStatus, string> = {
  active: 'активно — ищется в коде',
  planned: 'в каталоге — автопоиск в следующей версии',
};

export function renderCatalogMarkdown(catalog = defaultCatalog()): string {
  const lines: string[] = [
    '# Каталог правил legitAgent',
    '',
    `> ${DISCLAIMER_RU}`,
    '',
    'Источник истины: `packages/core/rules/*.yaml` и `packages/core/legal/*.yaml`.',
    'Файл генерируется командой `pnpm catalog`. Не редактируйте вручную.',
    '',
  ];

  const groups: { title: string; status: RuleStatus }[] = [
    { title: 'Активные детекторы', status: 'active' },
    { title: 'Запланированные правила', status: 'planned' },
  ];

  for (const group of groups) {
    const rules = catalog.rules.filter((r) => r.status === group.status);
    if (rules.length === 0) continue;
    lines.push(`## ${group.title}`, '');
    for (const rule of rules) {
      const excerpt = catalog.excerpts[rule.excerptRef];
      lines.push(`### \`${rule.id}\` — ${rule.title}`, '');
      lines.push(`- **Статус:** ${STATUS_RU[rule.status]}`);
      lines.push(`- **Серьёзность:** ${rule.severity}`);
      lines.push(`- **Норма:** ${rule.law}`);
      lines.push(`- **Что находит:** ${rule.message}`);
      lines.push(`- **Как исправить:** ${rule.fix}`);
      if (excerpt) {
        lines.push(`- **Выдержка (${excerpt.article}):** ${excerpt.text}`);
        lines.push(`- **Источник:** ${excerpt.sourceUrl}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
