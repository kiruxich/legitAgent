import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeSource, scanSources } from '../src/index.js';

const fixture = (name: string) => fs.readFileSync(new URL(`../../../benchmarks/real-world/${name}`, import.meta.url), 'utf8');
const trackerRule = (source: string) => scanSources([{ relativePath: 'page.html', source }])
  .filter((finding) => finding.ruleId === 'PDN.TRACKER.NO_CONSENT');

describe('real-world semantic regressions (same source groups, not new independent cases)', () => {
  it('distinguishes the imported inert analytics block from its activated version', () => {
    const source = fixture('gta-inert-analytics/analytics.html');
    expect(trackerRule(source)).toHaveLength(0);
    expect(trackerRule(source.replaceAll('text/plain', 'text/javascript'))).toHaveLength(1);
  });

  it('recognizes the Django policy route without treating arbitrary template text as a link', () => {
    const source = fixture('vas3k-join/join.html');
    expect(analyzeSource('join.html', source).forms[0]).toMatchObject({ hasPolicyLink: true, hasPrecheckedConsent: false });
    const withoutPolicy = source.replaceAll('"privacy_policy"', '"about"');
    expect(analyzeSource('join.html', withoutPolicy).forms[0].hasPolicyLink).toBe(false);
    const checked = source.replace('name="iconsent"', 'name="iconsent" checked');
    expect(analyzeSource('join.html', checked).forms[0].hasPrecheckedConsent).toBe(true);
  });

  it('recognizes a component-backed email field while preserving search as a negative case', () => {
    const source = fixture('hoppscotch-email-login/Login.vue');
    expect(analyzeSource('Login.vue', source).forms[0].hasPii).toBe(true);
    expect(analyzeSource('Login.vue', source.replace('type="email"', 'type="search"')).forms[0].hasPii).toBe(false);
    expect(analyzeSource('Search.tsx', 'const form = <form><Input type="search" name="query" /></form>')
      .forms[0].hasPii).toBe(false);
    expect(analyzeSource('Card.tsx', 'const form = <form><Card type="email" /></form>')
      .forms[0].hasPii).toBe(false);
  });

  it('does not hide an event inside a configuration callback or an unknown command', () => {
    const source = `gtag('consent', 'default', { analytics_storage: 'denied' });
      gtag('set', { campaign_name: 'example' });
      gtag('get', 'G-EXAMPLE', 'client_id', () => gtag('event', 'view'));
      gtag(command, 'G-EXAMPLE');`;
    const trackers = analyzeSource('setup.js', source).trackers;
    expect(trackers).toHaveLength(2);
    expect(trackers[0].snippet).toContain("gtag('event'");
    expect(trackers[1].snippet).toContain('gtag(command');
  });

  it.each(['text/plain', 'application/json', 'application/ld+json', ' TEXT/PLAIN '])('excludes %s data blocks, including fallback matches', (type) => {
    const source = `<script type="${type}">gtag('config', 'G-EXAMPLE');</script>`;
    expect(analyzeSource('page.html', source).trackers).toEqual([]);
  });

  it.each(['module', 'text/javascript', 'application/javascript'])('still detects executable %s scripts', (type) => {
    const source = `<script type="${type}">gtag('config', 'G-EXAMPLE');</script>`;
    expect(analyzeSource('page.html', source).trackers).toHaveLength(1);
  });
});
