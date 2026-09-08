import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
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
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

export interface StorageName {
  name: string;
}

export interface EvidenceShot {
  id: string;
  file: string;
}

export interface NetworkRequestEvidence {
  url: string;
  domain: string;
  resourceType: string;
  phase: 'initial' | 'after_reject' | 'before_accept' | 'after_accept';
  outcome: 'pending' | 'completed' | 'failed' | 'blocked' | 'redirected';
  initiator?: string;
}

export type InteractionStatus = 'not_available' | 'completed' | 'failed';

export interface LiveEvidence {
  capturedAt: string;
  url: string;
  cookiesBefore: CookieName[];
  cookiesAfterReject: CookieName[];
  cookiesAfterAccept: CookieName[];
  rejectStatus: InteractionStatus;
  acceptStatus: InteractionStatus;
  screenshots: EvidenceShot[];
  localStorageBefore: StorageName[];
  localStorageAfterReject: StorageName[];
  localStorageAfterAccept: StorageName[];
  sessionStorageBefore: StorageName[];
  sessionStorageAfterReject: StorageName[];
  sessionStorageAfterAccept: StorageName[];
  requestDomains: string[];
  networkRequests: NetworkRequestEvidence[];
}

export interface LiveScanResult extends ScanResult {
  url: string;
  capturedAt: string;
  cookiesBefore: CookieName[];
  cookiesAfterReject: CookieName[];
  cookiesAfterAccept: CookieName[];
  rejectStatus: InteractionStatus;
  acceptStatus: InteractionStatus;
  screenshots: EvidenceShot[];
  localStorageBefore: StorageName[];
  localStorageAfterReject: StorageName[];
  localStorageAfterAccept: StorageName[];
  sessionStorageBefore: StorageName[];
  sessionStorageAfterReject: StorageName[];
  sessionStorageAfterAccept: StorageName[];
  requestDomains: string[];
  networkRequests: NetworkRequestEvidence[];
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
          partialFingerprints: { legitAgentFingerprint: finding.fingerprint },
          properties: {
            confidence: finding.confidence,
            kind: finding.kind,
            evidence: finding.evidence,
            legalBasis: finding.legalBasis,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.file },
                region: {
                  startLine: finding.line ?? 1,
                  ...(finding.endLine ? { endLine: finding.endLine } : {}),
                },
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

function redactUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return value;
  }
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, (match) => {
      const trailing = match.match(/[),.;]+$/)?.[0] ?? '';
      const core = trailing ? match.slice(0, -trailing.length) : match;
      return `${redactUrl(core)}${trailing}`;
    })
    .replace(
      /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|session(?:id)?)\s*[:=]\s*)(?:bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      '$1[REDACTED]',
    )
    .replace(/((?:set-)?cookie\s*:\s*)[^\r\n]+/gi, '$1[REDACTED]');
}

function sanitizeCookieNames(cookies: CookieName[]): CookieName[] {
  return cookies.map((cookie) => ({
    name: redactSensitiveText(cookie.name),
    ...(cookie.domain !== undefined ? { domain: redactSensitiveText(cookie.domain) } : {}),
    ...(cookie.path !== undefined ? { path: redactSensitiveText(cookie.path) } : {}),
    ...(cookie.expires !== undefined ? { expires: cookie.expires } : {}),
    ...(cookie.httpOnly !== undefined ? { httpOnly: cookie.httpOnly } : {}),
    ...(cookie.secure !== undefined ? { secure: cookie.secure } : {}),
    ...(cookie.sameSite !== undefined ? { sameSite: cookie.sameSite } : {}),
  }));
}

function sanitizeStorageNames(storage: StorageName[]): StorageName[] {
  return storage.map(({ name }) => ({ name: redactSensitiveText(name) }));
}

function sanitizeDomain(value: string): string {
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return '[invalid-domain]';
  }
}

function sanitizeNetworkRequests(requests: NetworkRequestEvidence[]): NetworkRequestEvidence[] {
  return requests.map((request) => ({
    url: redactUrl(request.url),
    domain: sanitizeDomain(request.domain),
    resourceType: redactSensitiveText(request.resourceType),
    phase: request.phase,
    outcome: request.outcome,
    ...(request.initiator ? { initiator: redactSensitiveText(request.initiator) } : {}),
  }));
}

function sanitizeReviewedFinding(finding: ReviewedFinding): ReviewedFinding {
  return {
    ...finding,
    file: redactUrl(finding.file),
    message: redactSensitiveText(finding.message),
    fix: redactSensitiveText(finding.fix),
    excerpt: redactSensitiveText(finding.excerpt),
    legalBasis: finding.legalBasis.map(redactSensitiveText),
    evidence: {
      summary: redactSensitiveText(finding.evidence.summary),
      signals: finding.evidence.signals.map(redactSensitiveText),
    },
    reason: redactSensitiveText(finding.reason),
  };
}

interface SafeScreenshotAsset {
  shot: EvidenceShot;
  absolute: string;
  device: bigint | number;
  inode: bigint | number;
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function safeScreenshotAssets(live: LiveScanResult): SafeScreenshotAsset[] {
  if (!live.evidenceDir) return [];
  let root: string;
  try {
    root = fs.realpathSync(live.evidenceDir);
  } catch {
    return [];
  }
  return live.screenshots.flatMap(({ id, file }) => {
    const absolute = path.resolve(root, file);
    if (!isWithinRoot(root, absolute)) return [];
    const relative = path.relative(root, absolute);
    let cursor = root;
    try {
      for (const component of relative.split(path.sep)) {
        cursor = path.join(cursor, component);
        if (fs.lstatSync(cursor).isSymbolicLink()) return [];
      }
      const stat = fs.lstatSync(absolute, { bigint: true });
      if (!stat.isFile()) return [];
      const real = fs.realpathSync(absolute);
      if (!isWithinRoot(root, real)) return [];
      return [{
        shot: { id: redactSensitiveText(id), file: relative },
        absolute: real,
        device: stat.dev,
        inode: stat.ino,
      }];
    } catch {
      return [];
    }
  });
}

function readScreenshotAsset(asset: SafeScreenshotAsset): Buffer {
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  const descriptor = fs.openSync(asset.absolute, fs.constants.O_RDONLY | noFollow);
  try {
    const stat = fs.fstatSync(descriptor, { bigint: true });
    if (!stat.isFile() || stat.dev !== asset.device || stat.ino !== asset.inode) {
      throw new Error('Screenshot asset changed during evidence generation');
    }
    return fs.readFileSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function stageScreenshotAssets(
  outputRoot: string,
  assets: SafeScreenshotAsset[],
): { dir: string; screenshots: EvidenceShot[] } {
  const stagingDir = fs.mkdtempSync(path.join(outputRoot, '.legitagent-pdf-assets-'));
  try {
    const screenshots = assets.map((asset, index) => {
      const extension = path.extname(asset.shot.file).toLowerCase();
      const safeExtension = /^\.(?:png|jpe?g|webp)$/.test(extension) ? extension : '.bin';
      const file = `screenshot-${index}${safeExtension}`;
      fs.writeFileSync(path.join(stagingDir, file), readScreenshotAsset(asset), { flag: 'wx', mode: 0o600 });
      return { id: asset.shot.id, file };
    });
    return { dir: stagingDir, screenshots };
  } catch (error) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

function assertOutputIsNotSymlink(file: string): void {
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) {
    throw new Error(`Небезопасный evidence output path: symbolic link ${path.basename(file)}`);
  }
}

function writeTextAtomically(file: string, contents: string): void {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
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
        `<tr><td>${escapeHtml(f.ruleId)}</td><td>${escapeHtml(f.kind)}</td><td>${escapeHtml(f.confidence)}</td><td>${escapeHtml(f.verdict)}</td><td>${escapeHtml(f.evidence.summary)}</td><td>${escapeHtml(f.excerpt)}</td><td>${escapeHtml(f.file)}</td></tr>`,
    )
    .join('');
  const imgs = live.screenshots
    .map((s) => {
      const src = pathToFileURL(path.join(shotBase, s.file)).href;
      return `<figure><figcaption>${escapeHtml(s.id)}</figcaption><img src="${escapeHtml(src)}" style="max-width:100%"/></figure>`;
    })
    .join('');
  const requests = live.networkRequests.slice(0, 100).map((request) =>
    `<tr><td>${escapeHtml(request.phase)}</td><td>${escapeHtml(request.outcome)}</td><td>${escapeHtml(request.domain)}</td><td>${escapeHtml(request.resourceType)}</td><td>${escapeHtml(request.initiator ?? '')}</td></tr>`,
  ).join('');

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
<p><strong>url:</strong> ${escapeHtml(redactUrl(live.url ?? ''))}</p>
<p><strong>cookies:</strong> before ${live.cookiesBefore.length}, after reject ${live.cookiesAfterReject.length}, after accept ${live.cookiesAfterAccept.length}</p>
<p><strong>interactions:</strong> reject ${escapeHtml(live.rejectStatus)}, accept ${escapeHtml(live.acceptStatus)}</p>
<table>
<thead><tr><th>ruleId</th><th>kind</th><th>confidence</th><th>verdict</th><th>evidence</th><th>excerpt</th><th>file</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<h2>Network evidence</h2>
<table>
<thead><tr><th>phase</th><th>outcome</th><th>domain</th><th>resourceType</th><th>initiator</th></tr></thead>
<tbody>${requests}</tbody>
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
  const outputRoot = fs.realpathSync(dir);

  const packFindings = forEvidencePack(reviewed).map(sanitizeReviewedFinding);
  const cookiesBefore = sanitizeCookieNames(live.cookiesBefore);
  const cookiesAfterReject = sanitizeCookieNames(live.cookiesAfterReject);
  const cookiesAfterAccept = sanitizeCookieNames(live.cookiesAfterAccept);
  const localStorageBefore = sanitizeStorageNames(live.localStorageBefore);
  const localStorageAfterReject = sanitizeStorageNames(live.localStorageAfterReject);
  const localStorageAfterAccept = sanitizeStorageNames(live.localStorageAfterAccept);
  const sessionStorageBefore = sanitizeStorageNames(live.sessionStorageBefore);
  const sessionStorageAfterReject = sanitizeStorageNames(live.sessionStorageAfterReject);
  const sessionStorageAfterAccept = sanitizeStorageNames(live.sessionStorageAfterAccept);
  const networkRequests = sanitizeNetworkRequests(live.networkRequests);
  const screenshotAssets = safeScreenshotAssets(live);
  const screenshots = screenshotAssets.map(({ shot }) => shot);
  const sanitizedLive: LiveScanResult = {
    ...live,
    url: redactUrl(live.url),
    cookiesBefore,
    cookiesAfterReject,
    cookiesAfterAccept,
    localStorageBefore,
    localStorageAfterReject,
    localStorageAfterAccept,
    sessionStorageBefore,
    sessionStorageAfterReject,
    sessionStorageAfterAccept,
    requestDomains: live.requestDomains.map(sanitizeDomain),
    networkRequests,
    screenshots,
    html: undefined,
  };
  const jsonPath = path.join(outputRoot, 'evidence.json');
  const sarifPath = path.join(outputRoot, 'evidence.sarif');
  const pdfPath = path.join(outputRoot, 'evidence.pdf');
  for (const output of [jsonPath, sarifPath, pdfPath]) assertOutputIsNotSymlink(output);

  const evidence = {
    url: sanitizedLive.url,
    capturedAt: live.capturedAt,
    timestamp: live.capturedAt,
    cookiesBefore,
    cookiesAfterReject,
    cookiesAfterAccept,
    rejectStatus: live.rejectStatus,
    acceptStatus: live.acceptStatus,
    localStorageBefore,
    localStorageAfterReject,
    localStorageAfterAccept,
    sessionStorageBefore,
    sessionStorageAfterReject,
    sessionStorageAfterAccept,
    requestDomains: sanitizedLive.requestDomains,
    networkRequests,
    screenshots,
    disclaimer: disclaimerText,
    findings: packFindings,
    reviewed: packFindings,
  };

  writeTextAtomically(jsonPath, JSON.stringify(evidence, null, 2) + '\n');
  writeTextAtomically(sarifPath, JSON.stringify(toSarif(packFindings), null, 2) + '\n');

  const staged = stageScreenshotAssets(outputRoot, screenshotAssets);
  const pdfLive: LiveScanResult = {
    ...sanitizedLive,
    evidenceDir: staged.dir,
    screenshots: staged.screenshots,
  };
  const temporaryPdf = path.join(outputRoot, `.evidence.pdf.${randomUUID()}.tmp`);
  try {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      try {
        await page.setContent(buildPdfHtml(pdfLive, packFindings, disclaimerText), { waitUntil: 'load' });
        await page.pdf({ path: temporaryPdf, format: 'A4' });
        const stat = fs.lstatSync(temporaryPdf);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Небезопасный temporary PDF asset');
        fs.renameSync(temporaryPdf, pdfPath);
      } finally {
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (fs.existsSync(temporaryPdf)) fs.rmSync(temporaryPdf, { force: true });
    fs.rmSync(staged.dir, { recursive: true, force: true });
  }

  return {
    json: path.resolve(dir, 'evidence.json'),
    sarif: path.resolve(dir, 'evidence.sarif'),
    pdf: path.resolve(dir, 'evidence.pdf'),
  };
}
