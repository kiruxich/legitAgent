import { DISCLAIMER_RU, type ScanResult } from '@legitagent/core';

export function formatHuman(result: ScanResult): string {
  const lines: string[] = [];
  if (result.scannedFileCount === 0) {
    lines.push('Нечего сканировать: нет файлов .html/.jsx/.tsx.');
    lines.push(DISCLAIMER_RU);
    return lines.join('\n');
  }
  if (result.findings.length === 0) {
    lines.push(`Файлов проверено: ${result.scannedFileCount}. Нарушений не найдено.`);
  } else {
    lines.push(`Файлов проверено: ${result.scannedFileCount}. Находок: ${result.findings.length}.`);
    for (const f of result.findings) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`\n[${f.severity}] ${f.ruleId} (${loc})`);
      lines.push(f.message);
      lines.push(`Как исправить: ${f.fix}`);
      lines.push(`Норма: ${f.excerpt}`);
    }
  }
  for (const w of result.warnings) lines.push(`Предупреждение ${w.file}: ${w.message}`);
  lines.push(DISCLAIMER_RU);
  return lines.join('\n');
}
