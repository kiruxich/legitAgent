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
