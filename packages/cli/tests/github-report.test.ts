import { describe, expect, it } from 'vitest';
import { countHigh, formatReport } from '../../../.github/actions/legitagent-scan/format-report.mjs';

function sarif(results: Array<{ ruleId: string; level: string; uri?: string }> = []) {
  return {
    runs: [
      {
        results: results.map((r) => ({
          ruleId: r.ruleId,
          level: r.level,
          message: { text: 'test' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: r.uri ?? 'src/form.tsx' },
              },
            },
          ],
        })),
      },
    ],
  };
}

describe('formatReport', () => {
  it('starts with marker and reports no violations when empty', () => {
    const report = formatReport(sarif());
    expect(report).toMatch(/^<!-- legitagent-scan -->/);
    expect(report).toContain('## legitAgent');
    expect(report).toContain('Нарушений не найдено.');
  });

  it('lists each result as a bullet with ruleId, level, and uri', () => {
    const report = formatReport(
      sarif([
        { ruleId: 'PDN.FORM.NO_CONSENT', level: 'error', uri: 'src/form.tsx' },
        { ruleId: 'PDN.COOKIE.NO_REJECT', level: 'warning', uri: 'src/cookie.tsx' },
      ]),
    );
    expect(report).toContain('<!-- legitagent-scan -->');
    expect(report).toContain('- `PDN.FORM.NO_CONSENT` (error) — src/form.tsx');
    expect(report).toContain('- `PDN.COOKIE.NO_REJECT` (warning) — src/cookie.tsx');
  });
});

describe('countHigh', () => {
  it('counts results with level error', () => {
    expect(countHigh(sarif())).toBe(0);
    expect(
      countHigh(
        sarif([
          { ruleId: 'A', level: 'error' },
          { ruleId: 'B', level: 'warning' },
          { ruleId: 'C', level: 'error' },
        ]),
      ),
    ).toBe(2);
  });

  it('returns 0 for missing or empty sarif', () => {
    expect(countHigh({})).toBe(0);
    expect(countHigh({ runs: [] })).toBe(0);
  });
});
