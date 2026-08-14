import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { packageRoot } from './paths.js';

export interface CorpusEntry {
  id: string;
  title: string;
  nd: string;
  sourceUrl: string;
  file: string;
}

export function corpusDir(): string {
  return path.join(packageRoot(), 'legal', 'corpus');
}

export function listCorpus(): CorpusEntry[] {
  const indexPath = path.join(corpusDir(), 'index.json');
  if (!existsSync(indexPath)) return [];
  return JSON.parse(readFileSync(indexPath, 'utf8')) as CorpusEntry[];
}

export function readCorpus(id: string): string {
  const entry = listCorpus().find((e) => e.id === id);
  if (!entry) throw new Error(`Неизвестный закон: ${id}`);
  return readFileSync(path.join(corpusDir(), entry.file), 'utf8');
}

export function findArticle(id: string, article: string): string {
  const text = readCorpus(id);
  const needle = article.replace(/^ст\.?\s*/i, '').trim();
  const re = new RegExp(`Статья\\s+${needle.replace('.', '\\.')}\\b`, 'i');
  const start = text.search(re);
  if (start < 0) throw new Error(`Статья не найдена: ${id} ${article}`);
  const rest = text.slice(start + 1);
  const next = rest.search(/\n\s*Статья\s+\d+/);
  return (next < 0 ? text.slice(start) : text.slice(start, start + 1 + next)).trim();
}
