import fs from 'node:fs';
import path from 'node:path';
import type { AutofixChange, AutofixResult, Finding } from './types.js';

const MANUAL_RECIPES: Record<string, string> = {
  'PDN.FORM.NO_CONSENT': 'Добавить незаполненный consent-control с текстом, соответствующим конкретной цели обработки.',
  'PDN.FORM.NO_POLICY_LINK': 'Добавить рядом с согласием ссылку на фактический URL политики.',
  'PDN.TRACKER.NO_CONSENT': 'Перенести запуск tracker в существующий consent-controlled execution path.',
};

const INPUT_TAG = /<input\b[^>]*>/gi;
const CONSENT = /(персональн|согласи|consent|обработк)/i;

function safeFile(root: string, relative: string): string | undefined {
  const resolvedRoot = path.resolve(root);
  const file = path.resolve(resolvedRoot, relative);
  if (!file.startsWith(`${resolvedRoot}${path.sep}`)) return undefined;
  try {
    const realRoot = fs.realpathSync(resolvedRoot);
    const realFile = fs.realpathSync(file);
    if (!realFile.startsWith(`${realRoot}${path.sep}`) || !fs.statSync(realFile).isFile()) return undefined;
    return realFile;
  } catch {
    return undefined;
  }
}

function consentContext(source: string, tagStart: number, tag: string): string {
  const before = source.slice(0, tagStart);
  const labelStart = before.toLowerCase().lastIndexOf('<label');
  const labelEndBefore = before.toLowerCase().lastIndexOf('</label>');
  if (labelStart > labelEndBefore) {
    const end = source.toLowerCase().indexOf('</label>', tagStart);
    return source.slice(labelStart, end >= 0 ? end : tagStart + tag.length + 240);
  }
  return source.slice(Math.max(0, tagStart - 160), Math.min(source.length, tagStart + tag.length + 240));
}

function removeStaticCheckedAttribute(tag: string): string {
  return tag
    .replace(/\s+defaultChecked(?:\s*=\s*(?:\{\s*true\s*\}|["'](?:checked|true)["']))?(?=[\s/>])/gi, '')
    .replace(/\s+checked\s*=\s*\{\s*true\s*\}/gi, '')
    .replace(/\s+checked(?:\s*=\s*["'](?:checked|true)["'])?(?=[\s/>])/gi, '');
}

function removePrecheckedConsentControls(source: string): string {
  return source.replace(INPUT_TAG, (tag, offset: number) => {
    if (!/type=["']checkbox["']/i.test(tag) || !CONSENT.test(consentContext(source, offset, tag))) return tag;
    return removeStaticCheckedAttribute(tag);
  });
}

function removePrechecked(source: string, finding: Finding): { source: string; changed: boolean } {
  const lines = source.split('\n');
  const start = Math.max(0, (finding.line ?? 1) - 1);
  const end = Math.min(lines.length, finding.endLine ?? finding.line ?? lines.length);
  const before = lines.slice(start, end).join('\n');
  const after = removePrecheckedConsentControls(before);
  if (after === before) return { source, changed: false };
  lines.splice(start, end - start, ...after.split('\n'));
  return { source: lines.join('\n'), changed: true };
}

export function applySafeAutofixes(root: string, findings: Finding[], write = false): AutofixResult {
  const changes: AutofixChange[] = [];
  const changedFiles = new Set<string>();
  const sources = new Map<string, string>();

  for (const finding of findings) {
    const file = safeFile(root, finding.file);
    if (!file || !fs.existsSync(file)) continue;
    if (finding.ruleId === 'PDN.FORM.PRECHECKED_CONSENT') {
      const current = sources.get(file) ?? fs.readFileSync(file, 'utf8');
      const fixed = removePrechecked(current, finding);
      changes.push({
        ruleId: finding.ruleId,
        file: finding.file,
        line: finding.line,
        safety: 'safe',
        description: 'Убрать статическое предварительное состояние consent-checkbox.',
        applied: write && fixed.changed,
      });
      if (fixed.changed) {
        sources.set(file, fixed.source);
        changedFiles.add(finding.file);
      }
      continue;
    }
    const description = MANUAL_RECIPES[finding.ruleId];
    if (description) {
      changes.push({ ruleId: finding.ruleId, file: finding.file, line: finding.line, safety: 'manual', description, applied: false });
    }
  }

  if (write) {
    for (const [file, source] of sources) fs.writeFileSync(file, source);
  }
  return { changes, changedFiles: [...changedFiles].sort() };
}
