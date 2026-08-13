import { describe, expect, it } from 'vitest';
import { parseHtml } from '../src/parse-html.js';
import { tryParseJsx } from '../src/parse-jsx.js';

describe('parsers', () => {
  it('parses html', () => {
    const doc = parseHtml('<form><input name="email"></form>');
    expect(doc).toBeTruthy();
  });

  it('parses valid tsx', () => {
    const result = tryParseJsx(
      'Ok.tsx',
      'export const C = () => <form><input name="email" /></form>;',
    );
    expect(result.ok).toBe(true);
  });
});
