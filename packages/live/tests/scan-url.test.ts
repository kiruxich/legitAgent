import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanUrl } from '../src/index.js';

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

describe('scanUrl', () => {
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

  it('flags analytics cookies set before consent', async () => {
    const url = `${origin}/cookies-before-consent.html`;
    const result = await scanUrl(url);
    expect(result.scannedFileCount).toBe(1);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')?.file).toBe(url);
  });

  it('flags a cookie banner with accept but no reject', async () => {
    const url = `${origin}/banner-no-reject.html`;
    const result = await scanUrl(url);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.NO_REJECT')).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'PDN.COOKIE.NO_REJECT')?.file).toBe(url);
    expect(result.capturedAt).toMatch(/^\d{4}-/);
    expect(Array.isArray(result.cookiesBefore)).toBe(true);
  });

  it('flags foreign tracker requests', async () => {
    const url = `${origin}/foreign-tracker.html`;
    const result = await scanUrl(url);
    expect(result.findings.some((f) => f.ruleId === 'PDN.TRANSFER.FOREIGN_TRACKER')).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'PDN.TRANSFER.FOREIGN_TRACKER')?.file).toBe(url);
  });

  it('returns no findings for a clean page', async () => {
    const result = await scanUrl(`${origin}/clean.html`);
    expect(result.scannedFileCount).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it('throws a Russian error for a missing or invalid URL', async () => {
    await expect(scanUrl('')).rejects.toThrow('Укажите URL сайта');
    await expect(scanUrl('not-a-url')).rejects.toThrow('Укажите URL сайта');
  });

  it('flags analytics cookies set after SPA delay', async () => {
    const result = await scanUrl(`${origin}/delayed-cookie.html`);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')).toBe(true);
  });

  it('flags analytics cookies set when the user clicks reject', async () => {
    const result = await scanUrl(`${origin}/cookie-on-reject.html`);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.NO_REJECT')).toBe(false);
  });

  it('does not flag a banner that has a reject button and sets no cookies', async () => {
    const result = await scanUrl(`${origin}/banner-with-reject.html`);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')).toBe(false);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.NO_REJECT')).toBe(false);
  });

  it('flags a live form without a consent checkbox', async () => {
    const url = `${origin}/form-no-consent.html`;
    const result = await scanUrl(url);
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')?.file).toBe(url);
  });

  it('flags visible ads without erid', async () => {
    const url = `${origin}/ad-no-erid.html`;
    const result = await scanUrl(url);
    expect(result.findings.some((f) => f.ruleId === 'ADV.ERID.MISSING')).toBe(true);
  });

  it('flags a live shop without an offer', async () => {
    const url = `${origin}/shop-no-offer.html`;
    const result = await scanUrl(url);
    expect(result.findings.some((f) => f.ruleId === 'CONSUMER.OFFER.MISSING')).toBe(true);
  });

  it('flags a live page without a privacy policy link', async () => {
    const url = `${origin}/no-policy.html`;
    const result = await scanUrl(url);
    expect(result.findings.some((f) => f.ruleId === 'PDN.POLICY.NO_LINK')).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'PDN.POLICY.NO_LINK')?.file).toBe(url);
  });
});
