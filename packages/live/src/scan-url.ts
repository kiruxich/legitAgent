import { chromium } from 'playwright';
import {
  defaultCatalog,
  dedupeFindings,
  findingFromRule,
  scanSources,
  type Catalog,
  type Finding,
  type ScanResult,
} from '@legit-agent/core';

const ANALYTICS_COOKIE = /^(_ga|_gid|_gat|_fbp|_ym_|tmr_)/;
const ANALYTICS_COOKIE_EXACT = new Set(['_ym_uid', '_fbp']);
const BANNER = /cookie-banner|CookieBanner|cookie consent|куки/i;
const ACCEPT = /принять|accept/i;
const REJECT = /отклон|отказ|reject|decline/i;
const FOREIGN = /google-analytics|googletagmanager|facebook\.net|connect\.facebook\.net/;
const COOKIE_CONTROL = /принять|accept|отклон|отказ|reject|decline/i;

function assertUrl(url: string): string {
  if (!url.trim()) throw new Error('Укажите URL сайта');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Укажите URL сайта');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Укажите URL сайта');
  }
  return url;
}

function isAnalyticsCookie(name: string): boolean {
  return ANALYTICS_COOKIE.test(name) || ANALYTICS_COOKIE_EXACT.has(name);
}

function flagBeforeConsent(
  findings: Finding[],
  catalog: Catalog,
  url: string,
  cookies: { name: string }[],
): void {
  if (cookies.some((c) => isAnalyticsCookie(c.name))) {
    if (!findings.some((f) => f.ruleId === 'PDN.COOKIE.BEFORE_CONSENT')) {
      findings.push(findingFromRule(catalog, 'PDN.COOKIE.BEFORE_CONSENT', url, null));
    }
  }
}

export async function scanUrl(url: string, catalog: Catalog = defaultCatalog()): Promise<ScanResult> {
  assertUrl(url);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const requestUrls: string[] = [];
    page.on('request', (req) => {
      requestUrls.push(req.url());
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
    } catch {
      // still inspect cookies/DOM/requests
    }

    try {
      await page.locator('button, a').filter({ hasText: COOKIE_CONTROL }).first().waitFor({ timeout: 3_000 });
    } catch {
      // banner may appear later or not at all
    }

    await new Promise((r) => setTimeout(r, 2000));

    const findings: Finding[] = [];
    flagBeforeConsent(findings, catalog, url, await context.cookies());

    const html = await page.content();
    findings.push(...scanSources([{ relativePath: url, source: html }], catalog));

    if (BANNER.test(html)) {
      const texts = await page.locator('button, a').allTextContents();
      const hasAccept = texts.some((t) => ACCEPT.test(t));
      const hasReject = texts.some((t) => REJECT.test(t));
      if (hasAccept && !hasReject) {
        findings.push(findingFromRule(catalog, 'PDN.COOKIE.NO_REJECT', url, null));
      }
    }

    if (requestUrls.some((u) => FOREIGN.test(u))) {
      findings.push(findingFromRule(catalog, 'PDN.TRANSFER.FOREIGN_TRACKER', url, null));
    }

    const texts = await page.locator('button, a').allTextContents();
    if (texts.some((t) => REJECT.test(t))) {
      try {
        await page.locator('button, a').filter({ hasText: REJECT }).first().click();
        try {
          await page.waitForLoadState('networkidle', { timeout: 5_000 });
        } catch {
          // continue after reject click
        }
      } catch {
        // swallow click errors
      }
      flagBeforeConsent(findings, catalog, url, await context.cookies());
    }

    return { findings: dedupeFindings(findings), warnings: [], scannedFileCount: 1 };
  } finally {
    await browser.close();
  }
}
