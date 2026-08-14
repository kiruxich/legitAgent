import type { ScanResult, Severity } from '@legit-agent/core';

const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = {
  high: 'error',
  medium: 'warning',
  low: 'note',
};

export function toSarif(result: ScanResult): object {
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'legitAgent' } },
        results: result.findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: LEVEL[finding.severity],
          message: { text: finding.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.file },
                region: { startLine: finding.line ?? 1 },
              },
            },
          ],
        })),
      },
    ],
  };
}
