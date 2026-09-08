import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanUrl } from '../src/index.js';
import { isForeignTrackerUrl } from '../src/scan-url.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');

function startFixtureServer(): Promise<{ server: http.Server; port: number; requests: Map<string, number> }> {
  const requests = new Map<string, number>();
  const server = http.createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
    requests.set(urlPath, (requests.get(urlPath) ?? 0) + 1);
    if (urlPath === '/redirect-to-error.html') {
      res.writeHead(302, { location: '/http-error.html?token=redirect-secret' });
      res.end();
      return;
    }
    if (urlPath === '/http-error.html' || (urlPath === '/accept-http-error.html' && requests.get(urlPath)! > 1)) {
      res.writeHead(503, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>Service unavailable</h1><a href="/privacy">Privacy policy</a>');
      return;
    }
    if (urlPath === '/accept-http-error.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<div role="dialog"><p>Cookie consent</p><button>Accept</button><button>Reject</button></div><a href="/privacy">Privacy policy</a>');
      return;
    }
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
      resolve({ server, port, requests });
    });
  });
}

describe('scanUrl', () => {
  let server: http.Server;
  let port: number;
  let origin: string;
  let requests: Map<string, number>;

  beforeAll(async () => {
    ({ server, port, requests } = await startFixtureServer());
    origin = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('flags analytics cookies set before consent', async () => {
    const url = `${origin}/cookies-before-consent.html`;
    const result = await scanUrl(url, { allowPrivateNetwork: true });
    expect(result.scannedFileCount).toBe(1);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')?.file).toBe(url);
  });

  it('flags a cookie banner with accept but no reject', async () => {
    const url = `${origin}/banner-no-reject.html`;
    const result = await scanUrl(url, { allowPrivateNetwork: true });
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.NO_REJECT')).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'PDN.COOKIE.NO_REJECT')?.file).toBe(url);
    expect(result.capturedAt).toMatch(/^\d{4}-/);
    expect(Array.isArray(result.cookiesBefore)).toBe(true);
  });

  it('does not mistake a same-origin analytics asset path for a foreign tracker request', async () => {
    const url = `${origin}/foreign-tracker.html`;
    const result = await scanUrl(url, { allowPrivateNetwork: true });
    expect(result.networkRequests.some((request) => request.url === `${origin}/google-analytics/analytics.js`)).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'PDN.TRANSFER.FOREIGN_TRACKER')).toBe(false);
  });

  it.each(['http-error.html', 'redirect-to-error.html', 'missing.html'])('rejects an HTTP error instead of auditing its error page: %s', async (route) => {
    const scan = scanUrl(`${origin}/${route}?token=input-secret`, { allowPrivateNetwork: true });
    await expect(scan)
      .rejects.toThrow(/Не удалось проверить страницу: HTTP (503|404)/);
    await expect(scan)
      .rejects.not.toThrow(/input-secret|redirect-secret/);
  });

  it('rejects an HTTP error on the fresh navigation used to measure Accept', async () => {
    await expect(scanUrl(`${origin}/accept-http-error.html`, { allowPrivateNetwork: true }))
      .rejects.toThrow('Не удалось проверить страницу: HTTP 503');
    expect(requests.get('/accept-http-error.html')).toBe(2);
  });

  it('does not click Accept or Reject in an unrelated consent dialog', async () => {
    const result = await scanUrl(`${origin}/unrelated-dialog.html`, { allowPrivateNetwork: true });
    expect(result.acceptStatus).toBe('not_available');
    expect(result.rejectStatus).toBe('not_available');
    expect(requests.has('/unexpected-accept')).toBe(false);
    expect(requests.has('/unexpected-reject')).toBe(false);
  });

  it('does not click ambiguous actions even when the dialog mentions cookies', async () => {
    const result = await scanUrl(`${origin}/ambiguous-cookie-actions.html`, { allowPrivateNetwork: true });
    expect(result.acceptStatus).toBe('not_available');
    expect(result.rejectStatus).toBe('not_available');
    expect(requests.has('/unexpected-order-action')).toBe(false);
    expect(requests.has('/unexpected-deletion-action')).toBe(false);
  });

  it('skips unrelated dialogs and operates the cookie dialog that follows them', async () => {
    const result = await scanUrl(`${origin}/mixed-dialogs.html`, { allowPrivateNetwork: true });
    expect(result.acceptStatus).toBe('completed');
    expect(result.rejectStatus).toBe('completed');
    expect(result.cookiesAfterAccept.map((cookie) => cookie.name)).toContain('_ga_cookie_accept');
    expect(result.cookiesAfterReject.map((cookie) => cookie.name)).toContain('cookie_reject');
    expect(requests.has('/unexpected-accept')).toBe(false);
    expect(requests.has('/unexpected-reject')).toBe(false);
  });

  it('returns no findings for a clean page', async () => {
    const result = await scanUrl(`${origin}/clean.html`, { allowPrivateNetwork: true });
    expect(result.scannedFileCount).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it('throws a Russian error for a missing or invalid URL', async () => {
    await expect(scanUrl('')).rejects.toThrow('Укажите URL сайта');
    await expect(scanUrl('not-a-url')).rejects.toThrow('Укажите URL сайта');
  });

  it('blocks localhost unless private network access is explicit', async () => {
    await expect(scanUrl(`${origin}/clean.html`)).rejects.toThrow('private-network');
  });

  it('does not write a screenshot through an existing symlink', async () => {
    const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-shot-symlink-'));
    const outsideFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-shot-outside-')), 'outside.png');
    fs.writeFileSync(outsideFile, 'outside-screenshot-sentinel');
    fs.symlinkSync(outsideFile, path.join(evidenceDir, 'page.png'));
    await expect(scanUrl(`${origin}/clean.html`, {
      allowPrivateNetwork: true,
      evidenceDir,
    })).rejects.toThrow('symbolic link page.png');
    expect(fs.readFileSync(outsideFile, 'utf8')).toBe('outside-screenshot-sentinel');
  });

  it.each([
    'http://[::1]/',
    'http://100.64.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[fe90::1]/',
  ])('blocks a non-public direct target: %s', async (url) => {
    await expect(scanUrl(url)).rejects.toThrow('private-network');
  });

  it('flags analytics cookies set after SPA delay', async () => {
    const result = await scanUrl(`${origin}/delayed-cookie.html`, { allowPrivateNetwork: true });
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')).toBe(true);
  });

  it('flags analytics cookies set when the user clicks reject', async () => {
    const result = await scanUrl(`${origin}/cookie-on-reject.html`, { allowPrivateNetwork: true });
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.NO_REJECT')).toBe(false);
  });

  it('does not flag a banner that has a reject button and sets no cookies', async () => {
    const result = await scanUrl(`${origin}/banner-with-reject.html`, { allowPrivateNetwork: true });
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')).toBe(false);
    expect(result.findings.some((f) => f.ruleId === 'PDN.COOKIE.NO_REJECT')).toBe(false);
  });

  it('captures separate post-accept state without exposing storage values', async () => {
    const result = await scanUrl(`${origin}/cookie-on-accept.html`, { allowPrivateNetwork: true });
    expect(result.cookiesAfterAccept.some((cookie) => cookie.name === '_ga')).toBe(true);
    expect(result.localStorageAfterAccept).toEqual([{ name: 'analyticsConsent' }]);
    expect(result.networkRequests.some((request) => request.phase === 'before_accept' || request.phase === 'after_accept')).toBe(true);
    expect(result.acceptStatus).toBe('completed');
    expect(JSON.stringify(result)).not.toContain('after-accept');
    expect(JSON.stringify(result)).not.toContain('accepted');
    expect(result.html).toBeUndefined();
  });

  it('isolates reject and accept in fresh contexts and labels click-triggered requests', async () => {
    const result = await scanUrl(`${origin}/cookie-on-both.html?token=input-query-secret`, {
      allowPrivateNetwork: true,
    });
    expect(result.url).toBe(`${origin}/cookie-on-both.html`);
    expect(result.rejectStatus).toBe('completed');
    expect(result.acceptStatus).toBe('completed');
    expect(result.cookiesAfterReject.map((cookie) => cookie.name)).toContain('_ga_reject');
    expect(result.cookiesAfterReject.map((cookie) => cookie.name)).not.toContain('_ga_accept');
    expect(result.cookiesAfterAccept.map((cookie) => cookie.name)).toContain('_ga_accept');
    expect(result.cookiesAfterAccept.map((cookie) => cookie.name)).not.toContain('_ga_reject');
    expect(result.networkRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'after_reject', outcome: 'completed', url: `${origin}/reject-beacon` }),
      expect.objectContaining({ phase: 'after_accept', outcome: 'completed', url: `${origin}/accept-beacon` }),
    ]));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('input-query-secret');
    expect(serialized).not.toContain('accept-query-secret');
    expect(serialized).not.toContain('reject-query-secret');
    expect(serialized).not.toContain('accept-cookie-secret');
    expect(serialized).not.toContain('reject-cookie-secret');
    expect(serialized).not.toContain('accept-storage-secret');
    expect(serialized).not.toContain('reject-storage-secret');
  });

  it('flags a live form without a consent checkbox', async () => {
    const url = `${origin}/form-no-consent.html`;
    const result = await scanUrl(url, { allowPrivateNetwork: true });
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')?.file).toBe(url);
  });

  it('flags visible ads without erid', async () => {
    const url = `${origin}/ad-no-erid.html`;
    const result = await scanUrl(url, { allowPrivateNetwork: true });
    expect(result.findings.some((f) => f.ruleId === 'ADV.ERID.MISSING')).toBe(true);
  });

  it('flags a live shop without an offer', async () => {
    const url = `${origin}/shop-no-offer.html`;
    const result = await scanUrl(url, { allowPrivateNetwork: true });
    expect(result.findings.some((f) => f.ruleId === 'CONSUMER.OFFER.MISSING')).toBe(true);
  });

  it('flags a live page without a privacy policy link', async () => {
    const url = `${origin}/no-policy.html`;
    const result = await scanUrl(url, { allowPrivateNetwork: true });
    expect(result.findings.some((f) => f.ruleId === 'PDN.POLICY.NO_LINK')).toBe(true);
    expect(result.findings.find((f) => f.ruleId === 'PDN.POLICY.NO_LINK')?.file).toBe(url);
  });
});

describe('foreign tracker URL classification', () => {
  it.each([
    'https://google-analytics.com/collect',
    'https://www.google-analytics.com/collect',
    'https://region1.google-analytics.com/collect',
    'https://www.googletagmanager.com/gtm.js',
    'https://CONNECT.FACEBOOK.NET./en_US/fbevents.js',
  ])('recognizes a tracker domain: %s', (url) => {
    expect(isForeignTrackerUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/google-analytics/analytics.js',
    'https://example.com/?next=https://google-analytics.com',
    'https://google-analytics.com.example.com/collect',
    'https://not-google-analytics.com/collect',
    'https://google-analytics.com@example.com/collect',
    'file://google-analytics.com/collect',
    '/google-analytics/analytics.js',
  ])('ignores a path, lookalike, credentials, or non-HTTP URL: %s', (url) => {
    expect(isForeignTrackerUrl(url)).toBe(false);
  });
});
