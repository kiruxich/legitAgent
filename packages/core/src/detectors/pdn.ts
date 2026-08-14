export const PII = /(email|e-mail|phone|tel|name|fio|имя|телефон|почта)/i;
export const CONSENT = /(персональн|согласи|consent|обработк)/i;

export function hasPiiForm(source: string): boolean {
  return /<form[\s>]/i.test(source) && /<input\b/i.test(source) && PII.test(source);
}

export function hasConsentControl(source: string): boolean {
  const control =
    /type=["']checkbox["']/i.test(source) || /<Checkbox\b/.test(source) || /role=["']checkbox["']/i.test(source);
  return control && CONSENT.test(source);
}

export function collectsPdn(files: { source: string }[]): boolean {
  return files.some((f) => hasPiiForm(f.source));
}
