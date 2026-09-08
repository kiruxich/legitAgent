import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type BrowserContext, type CDPSession, type Locator, type Page } from 'playwright';
import {
  defaultCatalog,
  dedupeFindings,
  findingFromRule,
  scanSources,
  type Catalog,
  type Finding,
} from '@legit-agent/core';
import type {
  CookieName,
  EvidenceShot,
  InteractionStatus,
  LiveScanResult,
  NetworkRequestEvidence,
  StorageName,
} from './evidence.js';
import { assertPublicHttpUrl, startPinnedProxy } from './network-safety.js';

const ANALYTICS_COOKIE = /^(_ga|_gid|_gat|_fbp|_ym_|tmr_)/;
const ANALYTICS_COOKIE_EXACT = new Set(['_ym_uid', '_fbp']);
const BANNER = /cookie-banner|CookieBanner|cookie consent|куки/i;
const ACCEPT = /принять|accept/i;
const REJECT = /отклон|отказ|reject|decline/i;
const FOREIGN = /google-analytics|googletagmanager|facebook\.net|connect\.facebook\.net/;
const COOKIE_CONTROL = /принять|accept|отклон|отказ|reject|decline/i;
const CONSENT_CONTAINER = '[role="dialog"], [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]';
const INTERACTIVE_CONTROL = 'button, a, [role="button"], input[type="button"], input[type="submit"]';

export interface ScanUrlOptions {
  evidenceDir?: string;
  catalog?: Catalog;
  allowPrivateNetwork?: boolean;
  navigationTimeoutMs?: number;
}

function evidenceUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '[invalid-url]';
  }
}

async function validateInputUrl(url: string, allowPrivateNetwork: boolean): Promise<{ navigationUrl: string; publicUrl: string }> {
  if (!url.trim()) throw new Error('Укажите URL сайта');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Укажите URL сайта');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Укажите URL сайта');
  if (!allowPrivateNetwork) await assertPublicHttpUrl(parsed.toString());
  return { navigationUrl: parsed.toString(), publicUrl: evidenceUrl(parsed.toString()) };
}

function isAnalyticsCookie(name: string): boolean {
  return ANALYTICS_COOKIE.test(name) || ANALYTICS_COOKIE_EXACT.has(name);
}

function cookieNames(cookies: Array<{
  name: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}>): CookieName[] {
  return cookies.map(({ name, domain, path: cookiePath, expires, httpOnly, secure, sameSite }) => ({
    name,
    domain,
    path: cookiePath,
    expires,
    httpOnly,
    secure,
    sameSite,
  }));
}

async function storageNames(page: Page): Promise<{
  localStorage: StorageName[];
  sessionStorage: StorageName[];
}> {
  return page.evaluate(() => ({
    localStorage: Object.keys(window.localStorage).sort().map((name) => ({ name })),
    sessionStorage: Object.keys(window.sessionStorage).sort().map((name) => ({ name })),
  }));
}

function flagAnalyticsCookies(
  findings: Finding[],
  catalog: Catalog,
  url: string,
  cookies: { name: string }[],
  phase: 'before consent' | 'after reject',
): void {
  if (!cookies.some((cookie) => isAnalyticsCookie(cookie.name))) return;
  if (findings.some((finding) => finding.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')) return;

  const names = cookies.filter((cookie) => isAnalyticsCookie(cookie.name)).map((cookie) => cookie.name);
  findings.push(findingFromRule(catalog, 'PDN.COOKIE.BEFORE_CONSENT', url, null, {
    confidence: 'high',
    kind: 'risk',
    evidence: {
      summary: phase === 'before consent'
        ? 'До взаимодействия с баннером обнаружены cookie с именами известных аналитических сервисов.'
        : 'После явного отказа обнаружены cookie с именами известных аналитических сервисов.',
      signals: names.map((name) => `cookie ${phase}: ${name}`),
    },
    fingerprintHint: names.sort().join(','),
  }));
}

function withoutSourceSnippet(finding: Finding): Finding {
  return {
    ...finding,
    file: evidenceUrl(finding.file),
    evidence: {
      summary: finding.evidence.summary,
      signals: finding.evidence.signals,
    },
  };
}

async function visibleConsentContainer(page: Page): Promise<Locator | undefined> {
  const containers = page.locator(CONSENT_CONTAINER).filter({ hasText: COOKIE_CONTROL });
  const count = await containers.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = containers.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return undefined;
}

async function hasVisibleControl(container: Locator | undefined, pattern: RegExp): Promise<boolean> {
  if (!container) return false;
  const controls = container.locator(INTERACTIVE_CONTROL).filter({ hasText: pattern });
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    if (await controls.nth(index).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function visibleControl(container: Locator | undefined, pattern: RegExp): Promise<Locator | undefined> {
  if (!container) return undefined;
  const controls = container.locator(INTERACTIVE_CONTROL).filter({ hasText: pattern });
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = controls.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return undefined;
}

async function settleInitialPage(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
  } catch {
    // A continuously polling page is still inspectable.
  }
  try {
    await page.locator(INTERACTIVE_CONTROL).filter({ hasText: COOKIE_CONTROL }).first().waitFor({ timeout: 3_000 });
  } catch {
    // A consent UI may be absent.
  }
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

async function settleInteraction(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: 5_000 });
  } catch {
    // Capture state even if the page keeps polling.
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function writeScreenshotSafely(
  page: Page | Locator,
  evidenceRoot: string,
  fileName: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  const target = path.join(evidenceRoot, fileName);
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new Error(`Небезопасный screenshot path: symbolic link ${fileName}`);
  }
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  const temporary = path.join(evidenceRoot, `.${baseName}.${randomUUID()}.tmp${extension}`);
  try {
    await page.screenshot({ path: temporary, ...options });
    const stat = fs.lstatSync(temporary);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`Небезопасный screenshot asset: ${fileName}`);
    }
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

interface NetworkRecorder {
  session: CDPSession;
  detach(): Promise<void>;
}

async function attachNetworkRecorder(
  context: BrowserContext,
  page: Page,
  phase: { value: NetworkRequestEvidence['phase'] },
  target: NetworkRequestEvidence[],
): Promise<NetworkRecorder> {
  const session = await context.newCDPSession(page);
  const inFlight = new Map<string, NetworkRequestEvidence>();
  await session.send('Network.enable');
  session.on('Network.requestWillBeSent', (event: {
    requestId: string;
    request: { url: string };
    redirectResponse?: unknown;
    type?: string;
    initiator?: { type?: string; url?: string; stack?: { callFrames?: Array<{ url?: string; lineNumber?: number }> } };
  }) => {
    const previous = inFlight.get(event.requestId);
    if (previous?.outcome === 'pending') previous.outcome = 'redirected';
    try {
      const parsed = new URL(event.request.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      const frame = event.initiator?.stack?.callFrames?.find((item) => item.url);
      const initiator = frame?.url
        ? `${event.initiator?.type ?? 'script'}:${evidenceUrl(frame.url)}:${(frame.lineNumber ?? 0) + 1}`
        : event.initiator?.url ? evidenceUrl(event.initiator.url) : event.initiator?.type;
      const item: NetworkRequestEvidence = {
        url: evidenceUrl(event.request.url),
        domain: parsed.hostname,
        resourceType: event.type ?? 'Other',
        phase: phase.value,
        outcome: 'pending',
        ...(initiator ? { initiator } : {}),
      };
      target.push(item);
      inFlight.set(event.requestId, item);
    } catch {
      // Ignore browser-internal and malformed URLs.
    }
  });
  session.on('Network.loadingFinished', (event: { requestId: string }) => {
    const item = inFlight.get(event.requestId);
    if (item?.outcome === 'pending') item.outcome = 'completed';
    inFlight.delete(event.requestId);
  });
  session.on('Network.loadingFailed', (event: { requestId: string; errorText?: string; blockedReason?: string }) => {
    const item = inFlight.get(event.requestId);
    if (item?.outcome === 'pending') {
      item.outcome = event.blockedReason || /ERR_BLOCKED_BY_CLIENT/i.test(event.errorText ?? '') ? 'blocked' : 'failed';
    }
    inFlight.delete(event.requestId);
  });
  return {
    session,
    detach: async () => {
      await session.detach().catch(() => undefined);
    },
  };
}

async function installRequestGuard(page: Page, allowPrivateNetwork: boolean): Promise<void> {
  if (allowPrivateNetwork) return;
  await page.route('**/*', async (route) => {
    try {
      await assertPublicHttpUrl(route.request().url());
      await route.continue();
    } catch {
      await route.abort('blockedbyclient').catch(() => undefined);
    }
  });
}

async function captureAcceptState(args: {
  browser: Browser;
  url: string;
  allowPrivateNetwork: boolean;
  navigationTimeoutMs: number;
  networkRequests: NetworkRequestEvidence[];
}): Promise<{
  status: InteractionStatus;
  cookies: CookieName[];
  storage: { localStorage: StorageName[]; sessionStorage: StorageName[] };
}> {
  const { browser, url, allowPrivateNetwork, navigationTimeoutMs, networkRequests } = args;
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let recorder: NetworkRecorder | undefined;
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    await installRequestGuard(page, allowPrivateNetwork);
    const phase: { value: NetworkRequestEvidence['phase'] } = { value: 'before_accept' };
    recorder = await attachNetworkRecorder(context, page, phase, networkRequests);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
    await settleInitialPage(page);

    const container = await visibleConsentContainer(page);
    const control = await visibleControl(container, ACCEPT);
    let status: InteractionStatus = 'failed';
    if (control) {
      phase.value = 'after_accept';
      try {
        await control.click();
        await settleInteraction(page);
        status = 'completed';
      } catch {
        status = 'failed';
      }
    }
    return {
      status,
      cookies: cookieNames(await context.cookies()),
      storage: await storageNames(page),
    };
  } finally {
    await recorder?.detach();
    await context.close();
  }
}

export async function scanUrl(url: string, options: ScanUrlOptions = {}): Promise<LiveScanResult> {
  const allowPrivateNetwork = options.allowPrivateNetwork === true;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 30_000;
  const { navigationUrl, publicUrl } = await validateInputUrl(url, allowPrivateNetwork);
  const catalog = options.catalog ?? defaultCatalog();
  const evidenceDir = options.evidenceDir;
  const capturedAt = new Date().toISOString();
  const screenshots: EvidenceShot[] = [];

  let evidenceRoot: string | undefined;
  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    evidenceRoot = fs.realpathSync(evidenceDir);
  }

  const proxy = allowPrivateNetwork ? undefined : await startPinnedProxy();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(proxy ? { proxy: { server: proxy.server } } : {}),
      args: ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
    });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    let recorder: NetworkRecorder | undefined;
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      page.setDefaultNavigationTimeout(navigationTimeoutMs);
      await installRequestGuard(page, allowPrivateNetwork);
      const requestUrls: string[] = [];
      const networkRequests: NetworkRequestEvidence[] = [];
      const phase: { value: NetworkRequestEvidence['phase'] } = { value: 'initial' };
      recorder = await attachNetworkRecorder(context, page, phase, networkRequests);
      page.on('request', (request) => requestUrls.push(evidenceUrl(request.url())));

      await page.goto(navigationUrl, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
      await settleInitialPage(page);

      const cookiesBefore = cookieNames(await context.cookies());
      const storageBefore = await storageNames(page);
      const initialContainer = await visibleConsentContainer(page);
      const hadAcceptControl = await hasVisibleControl(initialContainer, ACCEPT);
      const hadRejectControl = await hasVisibleControl(initialContainer, REJECT);

      if (evidenceRoot) {
        await writeScreenshotSafely(page, evidenceRoot, 'page.png', { fullPage: true });
        screenshots.push({ id: 'page', file: 'page.png' });
        if (initialContainer) {
          await writeScreenshotSafely(initialContainer, evidenceRoot, 'banner.png');
          screenshots.push({ id: 'banner', file: 'banner.png' });
        }
      }

      const findings: Finding[] = [];
      flagAnalyticsCookies(findings, catalog, publicUrl, await context.cookies(), 'before consent');
      const html = await page.content();
      findings.push(...scanSources([{ relativePath: publicUrl, source: html }], catalog));

      if (BANNER.test(html) && initialContainer && hadAcceptControl && !hadRejectControl) {
        findings.push(findingFromRule(catalog, 'PDN.COOKIE.NO_REJECT', publicUrl, null, {
          evidence: {
            summary: 'В cookie-интерфейсе найдено принятие, но не найдена кнопка отказа.',
            signals: ['accept control visible', 'reject control not found'],
          },
        }));
      }

      if (requestUrls.some((requestUrl) => FOREIGN.test(requestUrl))) {
        const trackerUrls = requestUrls.filter((requestUrl) => FOREIGN.test(requestUrl));
        findings.push(findingFromRule(catalog, 'PDN.TRANSFER.FOREIGN_TRACKER', publicUrl, null, {
          evidence: {
            summary: 'Браузер зафиксировал попытку запроса к домену иностранного трекера.',
            signals: trackerUrls.slice(0, 10),
          },
          fingerprintHint: trackerUrls.map((item) => {
            try { return new URL(item).hostname; } catch { return item; }
          }).sort().join(','),
        }));
      }

      let rejectStatus: InteractionStatus = 'not_available';
      let cookiesAfterReject = cookiesBefore;
      let storageAfterReject = storageBefore;
      if (hadRejectControl) {
        phase.value = 'after_reject';
        const rejectControl = await visibleControl(initialContainer, REJECT);
        try {
          if (!rejectControl) throw new Error('Reject control disappeared');
          await rejectControl.click();
          await settleInteraction(page);
          rejectStatus = 'completed';
        } catch {
          rejectStatus = 'failed';
        }
        cookiesAfterReject = cookieNames(await context.cookies());
        storageAfterReject = await storageNames(page);
        flagAnalyticsCookies(findings, catalog, publicUrl, await context.cookies(), 'after reject');
      }

      let acceptStatus: InteractionStatus = 'not_available';
      let cookiesAfterAccept: CookieName[] = [];
      let storageAfterAccept = { localStorage: [] as StorageName[], sessionStorage: [] as StorageName[] };
      if (hadAcceptControl) {
        const accepted = await captureAcceptState({
          browser,
          url: navigationUrl,
          allowPrivateNetwork,
          navigationTimeoutMs,
          networkRequests,
        });
        acceptStatus = accepted.status;
        cookiesAfterAccept = accepted.cookies;
        storageAfterAccept = accepted.storage;
      }

      const requestDomains = [...new Set([
        ...requestUrls.flatMap((requestUrl) => {
          try { return [new URL(requestUrl).hostname]; } catch { return []; }
        }),
        ...networkRequests.map((request) => request.domain),
      ])].sort();

      return {
        findings: dedupeFindings(findings).map(withoutSourceSnippet),
        suppressedFindings: [],
        warnings: [],
        scannedFileCount: 1,
        url: publicUrl,
        capturedAt,
        cookiesBefore,
        cookiesAfterReject,
        cookiesAfterAccept,
        rejectStatus,
        acceptStatus,
        localStorageBefore: storageBefore.localStorage,
        localStorageAfterReject: storageAfterReject.localStorage,
        localStorageAfterAccept: storageAfterAccept.localStorage,
        sessionStorageBefore: storageBefore.sessionStorage,
        sessionStorageAfterReject: storageAfterReject.sessionStorage,
        sessionStorageAfterAccept: storageAfterAccept.sessionStorage,
        requestDomains,
        networkRequests,
        screenshots,
        ...(evidenceRoot ? { evidenceDir: evidenceRoot } : {}),
      };
    } finally {
      await recorder?.detach();
      await context.close();
    }
  } finally {
    await browser?.close();
    await proxy?.close();
  }
}
