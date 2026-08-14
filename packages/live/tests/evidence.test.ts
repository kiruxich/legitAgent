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
    const url = `${origin}/banner-no-reject.html`;

    const live = await scanUrl(url, { evidenceDir });
    expect(fs.existsSync(path.join(evidenceDir, 'page.png'))).toBe(true);

    const confirm: ReviewedFinding = {
      ruleId: 'PDN.COOKIE.NO_REJECT',
      file: url,
      line: null,
      severity: 'low',
      message: 'нет отказа',
      fix: 'добавьте отказ',
      excerpt: 'ст. 18',
      verdict: 'confirm',
      reason: 'баннер без отказа',
    };
    const reject: ReviewedFinding = {
      ruleId: 'PDN.POLICY.NO_LINK',
      file: url,
      line: null,
      severity: 'medium',
      message: 'нет ссылки',
      fix: 'добавьте ссылку',
      excerpt: 'ст. 18',
      verdict: 'reject',
      reason: 'ссылка есть',
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

    const json = JSON.parse(fs.readFileSync(paths.json, 'utf8')) as {
      findings: unknown[];
      reviewed: unknown[];
      capturedAt: string;
      timestamp: string;
    };
    expect(json.findings).toHaveLength(1);
    expect(json.reviewed).toHaveLength(1);
    expect(json.timestamp).toBe(json.capturedAt);
    expect(json.findings[0]).toMatchObject({ ruleId: 'PDN.COOKIE.NO_REJECT', verdict: 'confirm' });

    const sarif = JSON.parse(fs.readFileSync(paths.sarif, 'utf8')) as { version: string };
    expect(sarif.version).toBe('2.1.0');
  });
});
