import type { Finding, ScanResult } from '@legit-agent/core';
import { describe, expect, it } from 'vitest';
import { toSarif } from '../src/sarif.js';

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'PDN.FORM.NO_CONSENT',
    file: 'src/form.tsx',
    line: 12,
    severity: 'high',
    message: 'Форма без согласия',
    fix: 'Добавьте чекбокс',
    excerpt: 'ст. 9',
    ...overrides,
  };
}

function scan(findings: Finding[]): ScanResult {
  return { findings, warnings: [], scannedFileCount: findings.length };
}

function firstResult(sarif: ReturnType<typeof toSarif>) {
  const doc = sarif as {
    $schema: string;
    version: string;
    runs: Array<{
      tool: { driver: { name: string } };
      results: Array<{
        ruleId: string;
        level: string;
        message: { text: string };
        locations: Array<{
          physicalLocation: {
            artifactLocation: { uri: string };
            region: { startLine: number };
          };
        }>;
      }>;
    }>;
  };
  return doc;
}

describe('toSarif', () => {
  it('maps a high finding to error and ruleId', () => {
    const doc = firstResult(toSarif(scan([finding()])));
    expect(doc.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json');
    expect(doc.version).toBe('2.1.0');
    expect(doc.runs).toHaveLength(1);
    expect(doc.runs[0].tool.driver.name).toBe('legitAgent');
    const result = doc.runs[0].results[0];
    expect(result.ruleId).toBe('PDN.FORM.NO_CONSENT');
    expect(result.level).toBe('error');
    expect(result.message.text).toBe('Форма без согласия');
    expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe('src/form.tsx');
    expect(result.locations[0].physicalLocation.region.startLine).toBe(12);
  });

  it('maps medium to warning and low to note', () => {
    const doc = firstResult(
      toSarif(
        scan([
          finding({ ruleId: 'PDN.FORM.NO_POLICY_LINK', severity: 'medium', message: 'нет ссылки' }),
          finding({ ruleId: 'PDN.COOKIE.NO_REJECT', severity: 'low', message: 'нет отказа' }),
        ]),
      ),
    );
    expect(doc.runs[0].results.map((r) => r.level)).toEqual(['warning', 'note']);
    expect(doc.runs[0].results.map((r) => r.ruleId)).toEqual([
      'PDN.FORM.NO_POLICY_LINK',
      'PDN.COOKIE.NO_REJECT',
    ]);
  });

  it('uses startLine 1 when finding.line is null', () => {
    const doc = firstResult(toSarif(scan([finding({ line: null })])));
    expect(doc.runs[0].results[0].locations[0].physicalLocation.region.startLine).toBe(1);
  });
});
