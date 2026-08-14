export const DISCLAIMER_RU =
  'Это эвристическая проверка кода, а не юридическое заключение.';

export const DISCLAIMER_EN =
  'This is a heuristic code check, not legal advice.';

export function disclaimer(lang: 'ru' | 'en' = 'ru'): string {
  return lang === 'en' ? DISCLAIMER_EN : DISCLAIMER_RU;
}
