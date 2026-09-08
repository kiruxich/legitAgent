import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { disclaimer, type ReviewedFinding } from '@legit-agent/core';
import { scanUrl, writeEvidencePack } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');

function startFixtureServer(): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
    if (urlPath.includes('google-analytics') || urlPath.includes('facebook')) {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end('');
      return;
    }
    const name = path.basename(urlPath) || 'clean.html';
    const file = path.join(fixtures, name);
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(file));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port });
    });
  });
}

describe('evidence pack', () => {
  let server: http.Server;
  let port: number;
  let origin: string;

  beforeAll(async () => {
    ({ server, port } = await startFixtureServer());
    origin = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('captures screenshots and writes evidence pack with filtered findings', async () => {
    const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-evidence-'));
    const url = `${origin}/banner-no-reject.html?token=must-not-leak#private`;

    const live = await scanUrl(url, { evidenceDir, allowPrivateNetwork: true });
    expect(fs.existsSync(path.join(evidenceDir, 'page.png'))).toBe(true);
    live.cookiesBefore = [{ name: 'session', value: 'cookie-value-secret' } as never];
    live.localStorageBefore = [{ name: 'access_token=storage-name-secret', value: 'storage-value-secret' } as never];
    live.networkRequests.push({
      url: `${origin}/pixel?token=network-query-secret`,
      domain: '127.0.0.1',
      resourceType: 'Image',
      phase: 'initial',
      outcome: 'completed',
      headers: { authorization: 'Bearer network-header-secret' },
    } as never);
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-outside-'));
    fs.writeFileSync(path.join(outsideDir, 'secret.svg'), '<svg><text>outside-file-secret</text></svg>');
    live.screenshots.push({ id: 'escape', file: path.relative(evidenceDir, path.join(outsideDir, 'secret.svg')) });
    fs.symlinkSync(path.join(outsideDir, 'secret.svg'), path.join(evidenceDir, 'linked-secret.svg'));
    live.screenshots.push({ id: 'symlink-escape', file: 'linked-secret.svg' });

    const confirm: ReviewedFinding = {
      fingerprint: 'cookie-1',
      ruleId: 'PDN.COOKIE.NO_REJECT',
      file: url,
      line: null,
      endLine: null,
      severity: 'low',
      confidence: 'medium',
      kind: 'risk',
      message: 'нет отказа',
      fix: 'добавьте отказ',
      excerpt: 'ст. 18',
      legalBasis: ['152-ФЗ ст. 9'],
      evidence: {
        summary: 'banner token=summary-secret',
        signals: [
          `request ${origin}/collect?token=signal-query-secret`,
          'authorization: Bearer signal-header-secret',
        ],
        snippet: '<input value="source-snippet-secret">',
      },
      verdict: 'confirm',
      reason: 'баннер без отказа; password=reason-secret',
      reviewMode: 'custom',
      dataShared: false,
    };
    const reject: ReviewedFinding = {
      fingerprint: 'policy-1',
      ruleId: 'PDN.POLICY.NO_LINK',
      file: url,
      line: null,
      endLine: null,
      severity: 'medium',
      confidence: 'medium',
      kind: 'risk',
      message: 'нет ссылки',
      fix: 'добавьте ссылку',
      excerpt: 'ст. 18',
      legalBasis: ['152-ФЗ ст. 18.1'],
      evidence: { summary: 'policy', signals: ['no link'] },
      verdict: 'reject',
      reason: 'ссылка есть',
      reviewMode: 'custom',
      dataShared: false,
    };

    const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-pack-'));
    const paths = await writeEvidencePack({
      dir: packDir,
      live,
      reviewed: [confirm, reject],
      disclaimer: disclaimer('ru'),
    });

    expect(paths.json).toBe(path.join(packDir, 'evidence.json'));
    expect(paths.sarif).toBe(path.join(packDir, 'evidence.sarif'));
    expect(paths.pdf).toBe(path.join(packDir, 'evidence.pdf'));
    expect(fs.existsSync(paths.json)).toBe(true);
    expect(fs.existsSync(paths.sarif)).toBe(true);
    expect(fs.existsSync(paths.pdf)).toBe(true);

    const pdf = fs.readFileSync(paths.pdf).toString('latin1');
    const imageObjects = pdf.match(/<<(?:(?!>>)[\s\S])*\/Subtype\s*\/Image(?:(?!>>)[\s\S])*>>/g) ?? [];
    for (const shot of live.screenshots.filter((shot) => shot.id === 'page' || shot.id === 'banner')) {
      const png = fs.readFileSync(path.join(evidenceDir, shot.file));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      expect(imageObjects.some((object) =>
        new RegExp(`/Width\\s+${width}\\b`).test(object) && new RegExp(`/Height\\s+${height}\\b`).test(object),
      ), `PDF must embed the ${shot.id} screenshot (${width}×${height})`).toBe(true);
    }

    const json = JSON.parse(fs.readFileSync(paths.json, 'utf8')) as {
      findings: unknown[];
      reviewed: unknown[];
      capturedAt: string;
      timestamp: string;
      url: string;
      screenshots: Array<{ id: string; file: string }>;
      networkRequests: Array<Record<string, unknown>>;
    };
    expect(json.findings).toHaveLength(1);
    expect(json.reviewed).toHaveLength(1);
    expect(json.timestamp).toBe(json.capturedAt);
    expect(json.url).toBe(`${origin}/banner-no-reject.html`);
    expect(json.screenshots.some((shot) => shot.id === 'escape')).toBe(false);
    expect(json.screenshots.some((shot) => shot.id === 'symlink-escape')).toBe(false);
    expect(json.networkRequests.at(-1)).not.toHaveProperty('headers');
    expect(json.findings[0]).toMatchObject({ ruleId: 'PDN.COOKIE.NO_REJECT', verdict: 'confirm' });

    const jsonText = fs.readFileSync(paths.json, 'utf8');
    const sarifText = fs.readFileSync(paths.sarif, 'utf8');
    for (const secret of [
      'must-not-leak',
      'cookie-value-secret',
      'storage-value-secret',
      'storage-name-secret',
      'network-query-secret',
      'network-header-secret',
      'summary-secret',
      'signal-query-secret',
      'signal-header-secret',
      'source-snippet-secret',
      'reason-secret',
      'outside-file-secret',
    ]) {
      expect(jsonText).not.toContain(secret);
      expect(sarifText).not.toContain(secret);
    }

    const sarif = JSON.parse(sarifText) as { version: string };
    expect(sarif.version).toBe('2.1.0');

    const unsafePackDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-pack-symlink-'));
    const outsidePdf = path.join(outsideDir, 'outside.pdf');
    fs.writeFileSync(outsidePdf, 'outside-pdf-sentinel');
    fs.symlinkSync(outsidePdf, path.join(unsafePackDir, 'evidence.pdf'));
    await expect(writeEvidencePack({
      dir: unsafePackDir,
      live,
      reviewed: [confirm],
      disclaimer: disclaimer('ru'),
    })).rejects.toThrow('symbolic link evidence.pdf');
    expect(fs.readFileSync(outsidePdf, 'utf8')).toBe('outside-pdf-sentinel');
  });
});
