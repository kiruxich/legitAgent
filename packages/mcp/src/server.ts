import { accessSync, constants } from 'node:fs';
import path from 'node:path';
import { explainRule, listRules, scanProject } from '@legit-agent/core';

function resolveRoot(root?: string): string {
  return path.resolve(root ?? process.cwd());
}

function assertReadableRoot(root: string): void {
  try {
    accessSync(root, constants.R_OK);
  } catch {
    throw new Error('Укажите корень проекта');
  }
}

export async function handleScan(root?: string) {
  const resolved = resolveRoot(root);
  assertReadableRoot(resolved);
  return scanProject(resolved);
}

export function handleListRules() {
  return listRules();
}

export function handleExplainRule(ruleId: string) {
  return explainRule(ruleId);
}

export async function handleScanUrl(url?: string) {
  if (!url?.trim()) throw new Error('Укажите URL сайта');
  const { scanUrl } = await import('@legit-agent/live');
  return scanUrl(url);
}
