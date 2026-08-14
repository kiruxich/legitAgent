import { DISCLAIMER_EN, DISCLAIMER_RU, type Lang, type ScanResult } from '@legit-agent/core';

export function formatHuman(result: ScanResult, lang: Lang = 'ru'): string {
  const d = lang === 'en' ? DISCLAIMER_EN : DISCLAIMER_RU;
  const lines: string[] = [];
  if (result.scannedFileCount === 0) {
    lines.push(
      lang === 'en'
        ? 'Nothing to scan: no .html/.jsx/.tsx/.vue/.svelte/.astro files.'
        : 'Нечего сканировать: нет файлов .html/.jsx/.tsx/.vue/.svelte/.astro.',
    );
    lines.push(d);
    return lines.join('\n');
  }
  if (result.findings.length === 0) {
    lines.push(
      lang === 'en'
        ? `Files scanned: ${result.scannedFileCount}. No findings.`
        : `Файлов проверено: ${result.scannedFileCount}. Нарушений не найдено.`,
    );
  } else {
    lines.push(
      lang === 'en'
        ? `Files scanned: ${result.scannedFileCount}. Findings: ${result.findings.length}.`
        : `Файлов проверено: ${result.scannedFileCount}. Находок: ${result.findings.length}.`,
    );
    for (const f of result.findings) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`\n[${f.severity}] ${f.ruleId} (${loc})`);
      lines.push(f.message);
      lines.push(lang === 'en' ? `How to fix: ${f.fix}` : `Как исправить: ${f.fix}`);
      lines.push(lang === 'en' ? `Law: ${f.excerpt}` : `Норма: ${f.excerpt}`);
    }
  }
  for (const w of result.warnings) {
    lines.push(lang === 'en' ? `Warning ${w.file}: ${w.message}` : `Предупреждение ${w.file}: ${w.message}`);
  }
  lines.push(d);
  return lines.join('\n');
}
