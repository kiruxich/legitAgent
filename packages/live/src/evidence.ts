import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  forEvidencePack,
  type Finding,
  type ReviewedFinding,
  type ScanResult,
  type Severity,
} from '@legit-agent/core';

export interface CookieName {
  name: string;
}

export interface EvidenceShot {
  id: string;
  file: string;
}

export interface LiveEvidence {
  capturedAt: string;
  url: string;
  cookiesBefore: CookieName[];
  cookiesAfterReject: CookieName[];
  screenshots: EvidenceShot[];
}

export interface LiveScanResult extends ScanResult {
  url: string;
  capturedAt: string;
  cookiesBefore: CookieName[];
  cookiesAfterReject: CookieName[];
  screenshots: EvidenceShot[];
  evidenceDir?: string;
  html?: string;
}

const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = {
  high: 'error',
  medium: 'warning',
  low: 'note',
};

function toSarif(findings: Finding[]): object {
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'legitAgent' } },
        results: findings.map((finding) => ({
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPdfHtml(
  live: LiveScanResult,
  packFindings: ReviewedFinding[],
  disclaimerText: string,
): string {
  const shotBase = live.evidenceDir ?? '';
  const rows = packFindings
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.ruleId)}</td><td>${escapeHtml(f.verdict)}</td><td>${escapeHtml(f.excerpt)}</td><td>${escapeHtml(f.file)}</td></tr>`,
    )
    .join('');
  const imgs = live.screenshots
    .map((s) => {
      const src = path.join(shotBase, s.file);
      return `<figure><figcaption>${escapeHtml(s.id)}</figcaption><img src="file://${src}" style="max-width:100%"/></figure>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"/><title>legitAgent evidence</title>
<style>
body { font-family: sans-serif; margin: 2rem; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #ccc; padding: 0.4rem; text-align: left; font-size: 12px; }
.disclaimer { margin-top: 2rem; font-size: 11px; color: #555; }
figure { margin: 1rem 0; }
</style>
</head>
<body>
<h1>legitAgent</h1>
<p><strong>capturedAt:</strong> ${escapeHtml(live.capturedAt)}</p>
<p><strong>url:</strong> ${escapeHtml(live.url ?? '')}</p>
<table>
<thead><tr><th>ruleId</th><th>verdict</th><th>excerpt</th><th>file</th></tr></thead>
<tbody>${rows}</tbody>
</table>
${imgs}
<p class="disclaimer">${escapeHtml(disclaimerText)}</p>
</body>
</html>`;
}

export async function writeEvidencePack(args: {
  dir: string;
  live: LiveScanResult;
  reviewed: ReviewedFinding[];
  disclaimer: string;
}): Promise<{ json: string; sarif: string; pdf: string }> {
  const { dir, live, reviewed, disclaimer: disclaimerText } = args;
  fs.mkdirSync(dir, { recursive: true });

  const packFindings = forEvidencePack(reviewed);
  const jsonPath = path.join(dir, 'evidence.json');
  const sarifPath = path.join(dir, 'evidence.sarif');
  const pdfPath = path.join(dir, 'evidence.pdf');

  const evidence = {
    url: live.url,
    capturedAt: live.capturedAt,
    timestamp: live.capturedAt,
    cookiesBefore: live.cookiesBefore,
    cookiesAfterReject: live.cookiesAfterReject,
    screenshots: live.screenshots,
    disclaimer: disclaimerText,
    findings: packFindings,
    reviewed: packFindings,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(evidence, null, 2) + '\n');
  fs.writeFileSync(sarifPath, JSON.stringify(toSarif(packFindings), null, 2) + '\n');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(buildPdfHtml(live, packFindings, disclaimerText), { waitUntil: 'load' });
    await page.pdf({ path: pdfPath, format: 'A4' });
    await page.close();
  } finally {
    await browser.close();
  }

  return {
    json: path.resolve(jsonPath),
    sarif: path.resolve(sarifPath),
    pdf: path.resolve(pdfPath),
  };
}
