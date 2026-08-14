# legitAgent v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v0.3.0 with project config, deeper live scan, and GitHub Action PR comments plus high-finding issues.

**Architecture:** `scanProject` loads `legitagent.config.json` from the scan root and applies ignore/disabled/severity internally. Live scan stays in `@legit-agent/live` and only gains wait/click steps. Action stays a composite wrapper: it still runs the published CLI for the scan, then formats `legitagent.sarif` with a script that lives in the action directory.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, Playwright, SARIF 2.1.0, GitHub composite action, `actions/github-script@v7`.

## Global Constraints

- Product name `legitAgent`; packages `@legit-agent/core`, `@legit-agent/cli`, `@legit-agent/mcp`, `@legit-agent/live`.
- Russian user-facing strings; rule ids stay Latin `PDN.*`.
- Heuristics, not legal advice; keep `DISCLAIMER_RU` unchanged.
- Scan source files remain `.html`, `.jsx`, `.tsx` only; do not add Vue/Svelte/Astro.
- TDD: failing test first, watch it fail, then implement.
- Do not bump npm versions until Task 5. Do not publish or tag until Task 5 is committed.
- No `allowlist` of rules. No `scan-url` reading `legitagent.config.json`.
- Do not click Accept/принять on live pages. Click reject only.
- Work on branch `feat/v3`, not `main`.
- Existing v1/v2 tests must stay green.
- Do not scan this monorepo's fixtures from `ci.yml`.

---

### Task 1: Project config in core

**Files:**
- Create: `packages/core/src/config.ts`
- Create: `packages/core/tests/config.test.ts`
- Create: `packages/core/tests/fixtures/config-ignore/keep/Form.tsx` (bad form with email+no consent)
- Create: `packages/core/tests/fixtures/config-ignore/vendor/Skip.tsx` (same bad form)
- Create: `packages/core/tests/fixtures/config-ignore/legitagent.config.json`
- Create: `packages/core/tests/fixtures/config-disabled/Form.tsx` (bad form)
- Create: `packages/core/tests/fixtures/config-disabled/legitagent.config.json`
- Create: `packages/core/tests/fixtures/config-severity/tracker.tsx` (inline `gtag(`)
- Create: `packages/core/tests/fixtures/config-severity/legitagent.config.json`
- Create: `packages/core/tests/fixtures/config-invalid/legitagent.config.json` (text `{not json`)
- Modify: `packages/core/src/types.ts` — add `ScanConfig`, `ConfigError`
- Modify: `packages/core/src/discover.ts` — extra ignore globs
- Modify: `packages/core/src/scan.ts` — load config, filter, override severity
- Modify: `packages/core/src/index.ts` — export `loadScanConfig`, `ConfigError`, `ScanConfig`
- Modify: `packages/core/tests/discover.test.ts` — extra ignore
- Modify: `packages/core/tests/scan.test.ts` — three config fixtures plus invalid JSON

**Interfaces:**
- Consumes: existing `discoverSourceFiles`, `scanProject`, `findingFromRule`, `Severity`
- Produces:
  - `class ConfigError extends Error` with `name = 'ConfigError'`
  - `interface ScanConfig { ignore: string[]; disabled: string[]; severity: Record<string, Severity> }`
  - `function defaultScanConfig(): ScanConfig` → empty arrays/object
  - `function loadScanConfig(root: string): { config: ScanConfig; warnings: ScanWarning[] }`
  - `discoverSourceFiles(root: string, extraIgnore?: string[]): Promise<string[]>`
  - `scanProject` reads config from `root`; missing file = defaults; invalid JSON throws `ConfigError('Некорректный legitagent.config.json')`

**Config JSON mapping:** missing keys default to empty. Extra JSON keys ignored. `disabled` unknown id → warning `{ file: 'legitagent.config.json', message: 'Неизвестное правило: <id>' }`. `severity` unknown id → same warning, skip key. `severity` value not `high|medium|low` → warning `{ file: 'legitagent.config.json', message: 'Некорректная серьёзность: <id>' }`, skip key.

`discover.ts` must keep builtin ignore and append `extraIgnore`:

```ts
import fg from 'fast-glob';

const IGNORE = ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**'];

export async function discoverSourceFiles(root: string, extraIgnore: string[] = []): Promise<string[]> {
  return fg(['**/*.html', '**/*.jsx', '**/*.tsx'], {
    cwd: root,
    absolute: true,
    ignore: [...IGNORE, ...extraIgnore],
    dot: false,
  });
}
```

`config.ts` outline:

```ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ScanConfig, ScanWarning, Severity } from './types.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const SEVERITIES = new Set<Severity>(['high', 'medium', 'low']);

export function defaultScanConfig(): ScanConfig {
  return { ignore: [], disabled: [], severity: {} };
}

export function loadScanConfig(root: string): { config: ScanConfig; warnings: ScanWarning[] } {
  const file = path.join(root, 'legitagent.config.json');
  if (!existsSync(file)) return { config: defaultScanConfig(), warnings: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new ConfigError('Некорректный legitagent.config.json');
  }
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const config = defaultScanConfig();
  const warnings: ScanWarning[] = [];
  if (Array.isArray(obj.ignore)) config.ignore = obj.ignore.filter((x) => typeof x === 'string');
  if (Array.isArray(obj.disabled)) config.disabled = obj.disabled.filter((x) => typeof x === 'string');
  // severity: copy only valid Severities; unknown rule ids still copied here — scanProject warns using catalog
  if (obj.severity && typeof obj.severity === 'object' && !Array.isArray(obj.severity)) {
    for (const [id, value] of Object.entries(obj.severity as Record<string, unknown>)) {
      if (typeof value === 'string' && SEVERITIES.has(value as Severity)) config.severity[id] = value as Severity;
      else warnings.push({ file: 'legitagent.config.json', message: `Некорректная серьёзность: ${id}` });
    }
  }
  return { config, warnings };
}
```

In `scanProject`, after loading catalog, call `loadScanConfig(root)`. For each `disabled` / `severity` key, if `!catalog.rules.some(r => r.id === id)` push warning `Неизвестное правило: ${id}`. Discover with `config.ignore`. After detectors, `findings = findings.filter(f => !config.disabled.includes(f.ruleId))`. Then for each finding, if `config.severity[f.ruleId]` set `finding.severity`. Concatenate config warnings onto `warnings`.

Fixtures: copy the bad-form `Contact.tsx` pattern (form + email input, no consent checkbox) into `keep/Form.tsx` and `vendor/Skip.tsx`. Config-ignore file:

```json
{ "ignore": ["vendor/**"] }
```

config-disabled:

```json
{ "disabled": ["PDN.FORM.NO_CONSENT"] }
```

config-severity tracker.tsx can be a short file containing `gtag(` and `google-analytics` so `PDN.TRANSFER.FOREIGN_TRACKER` fires. Config:

```json
{ "severity": { "PDN.TRANSFER.FOREIGN_TRACKER": "low" } }
```

- [ ] **Step 1:** Write failing tests in `config.test.ts`, `scan.test.ts`, `discover.test.ts` and add fixtures. Do not implement `config.ts` yet.

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadScanConfig } from '../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('loadScanConfig', () => {
  it('returns defaults when the file is missing', () => {
    const { config, warnings } = loadScanConfig(path.join(here, 'fixtures/empty-project'));
    expect(config).toEqual({ ignore: [], disabled: [], severity: {} });
    expect(warnings).toEqual([]);
  });

  it('throws ConfigError on invalid JSON', () => {
    expect(() => loadScanConfig(path.join(here, 'fixtures/config-invalid'))).toThrow(ConfigError);
    expect(() => loadScanConfig(path.join(here, 'fixtures/config-invalid'))).toThrow(
      'Некорректный legitagent.config.json',
    );
  });
});
```

Add to `scan.test.ts`:

```ts
  it('honors ignore globs from legitagent.config.json', async () => {
    const result = await scanProject(path.join(here, 'fixtures/config-ignore'));
    expect(result.findings.some((f) => f.file.includes('vendor'))).toBe(false);
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
  });

  it('drops disabled rule findings', async () => {
    const result = await scanProject(path.join(here, 'fixtures/config-disabled'));
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(false);
  });

  it('overrides severity from config', async () => {
    const result = await scanProject(path.join(here, 'fixtures/config-severity'));
    const hit = result.findings.find((f) => f.ruleId === 'PDN.TRANSFER.FOREIGN_TRACKER');
    expect(hit?.severity).toBe('low');
  });

  it('throws ConfigError for invalid JSON', async () => {
    await expect(scanProject(path.join(here, 'fixtures/config-invalid'))).rejects.toThrow(
      'Некорректный legitagent.config.json',
    );
  });
```

Add to `discover.test.ts`:

```ts
  it('applies extra ignore globs', async () => {
    const root = path.join(here, 'fixtures/config-ignore');
    const files = await discoverSourceFiles(root, ['vendor/**']);
    expect(files.some((f) => f.includes('vendor'))).toBe(false);
    expect(files.some((f) => f.endsWith('Form.tsx'))).toBe(true);
  });
```

- [ ] **Step 2:** Run `pnpm --filter @legit-agent/core test` — new tests fail (missing module / missing behavior).

- [ ] **Step 3:** Implement `config.ts`, types, discover extra ignore, scanProject wiring, exports.

- [ ] **Step 4:** Run `pnpm --filter @legit-agent/core test` — all green. Then `pnpm test` — all green.

- [ ] **Step 5:** Commit

```
git add packages/core
git commit -m "feat: load legitagent.config.json for ignore, disabled rules, and severity"
```

---

### Task 2: CLI exit 2 on bad config

**Files:**
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/tests/cli.test.ts`
- Modify: `packages/core/src/index.ts` if `ConfigError` not already exported from Task 1

**Interfaces:**
- Consumes: `ConfigError` from `@legit-agent/core`, existing CLI `main().catch`
- Produces: invalid config during `scan` exits `2` and prints `Некорректный legitagent.config.json` to stderr. Other errors still exit `1`. `scan-url` unchanged.

In `index.ts` catch:

```ts
import { ConfigError, scanProject } from '@legit-agent/core';

main().catch((err) => {
  console.error((err as Error).message ?? err);
  process.exit(err instanceof ConfigError ? 2 : 1);
});
```

CLI test (tmp dir with `{not json`):

```ts
  it('exits 2 on invalid legitagent.config.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-cfg-'));
    fs.writeFileSync(path.join(dir, 'legitagent.config.json'), '{not json');
    const result = runCli(['scan', dir, '--json']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Некорректный legitagent.config.json');
  });
```

- [ ] **Step 1:** Write the failing CLI test.
- [ ] **Step 2:** Run `pnpm --filter @legit-agent/cli test` — the new test fails (exit 1 instead of 2).
- [ ] **Step 3:** Import `ConfigError` and map it to exit 2.
- [ ] **Step 4:** Run `pnpm --filter @legit-agent/cli test` then `pnpm test` — green.
- [ ] **Step 5:** Commit

```
git add packages/cli packages/core/src/index.ts
git commit -m "fix: exit 2 when legitagent.config.json is invalid"
```

---

### Task 3: Deeper live scan

**Files:**
- Modify: `packages/live/src/scan-url.ts`
- Modify: `packages/live/tests/scan-url.test.ts`
- Create: `packages/live/tests/fixtures/delayed-cookie.html`
- Create: `packages/live/tests/fixtures/cookie-on-reject.html`
- Create: `packages/live/tests/fixtures/banner-with-reject.html`

**Interfaces:**
- Consumes: existing `scanUrl(url, catalog?)`, same analytics cookie names, same BANNER/ACCEPT/REJECT/FOREIGN regexes
- Produces: same `ScanResult` shape. After load: networkidle (10s, swallow), wait for a cookie-ish control up to 3s (swallow), then always `await new Promise((r) => setTimeout(r, 2000))`. Snapshot HTML/cookies/requests. Flag `NO_REJECT` and `FOREIGN_TRACKER` from that snapshot (same logic as now). If a reject control exists (`button, a` whose text matches REJECT), click the first, swallow errors, wait networkidle 5s swallow. Re-read cookies. Flag `BEFORE_CONSENT` if an analytics cookie exists after the 2s wait **or** after the reject click. Never click Accept.

`delayed-cookie.html`: no banner; `setTimeout(() => { document.cookie = '_ga=GA1.2.1.1; path=/'; }, 1800)`.

`cookie-on-reject.html`: `#cookie-banner` with buttons «Принять» and «Отклонить»; reject handler sets `document.cookie = '_ga=...; path=/'`. No cookie on load.

`banner-with-reject.html`: same banner buttons, no cookie scripts. Expect no `BEFORE_CONSENT`, no `NO_REJECT`.

Keep existing v2 tests. Add:

```ts
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
```

Reject click helper: collect `button, a` text like today; if some text matches REJECT, click that locator (`page.locator('button, a').filter({ hasText: REJECT }).first()`).

- [ ] **Step 1:** Add fixtures and failing tests. Do not change `scan-url.ts` yet except if tests cannot import.
- [ ] **Step 2:** Run `pnpm --filter @legit-agent/live test` — new tests fail.
- [ ] **Step 3:** Implement wait, reject click, cookie re-check. Keep v2 findings working.
- [ ] **Step 4:** Run live tests then `pnpm test` — green. Live tests are slower; 2s sleep is required by spec.
- [ ] **Step 5:** Commit

```
git add packages/live
git commit -m "feat: wait for hydration and click reject during live scan"
```

---

### Task 4: Action PR comment and high issue

**Files:**
- Create: `.github/actions/legitagent-scan/format-report.mjs`
- Create: `packages/cli/tests/github-report.test.ts` (imports the mjs from repo root)
- Modify: `.github/actions/legitagent-scan/action.yml`
- Modify: `examples/github-scan.yml` — add `pull-requests: write` and `issues: write`. Leave `uses: ...@main` until Task 5.

**Interfaces:**
- Consumes: SARIF object written by current CLI (`runs[0].results[]` with `ruleId`, `level`, `message.text`, `locations[0].physicalLocation.artifactLocation.uri`)
- Produces: `formatReport(sarif) => string` markdown starting with `<!-- legitagent-scan -->`. If no results: `legitAgent: нарушений не найдено.` If results: heading `legitAgent` and a bullet per result `` `ruleId` (level) — uri ``. `countHigh(sarif) => number` of `level === 'error'`.

`format-report.mjs`:

```js
export function countHigh(sarif) {
  const results = sarif?.runs?.[0]?.results ?? [];
  return results.filter((r) => r.level === 'error').length;
}

export function formatReport(sarif) {
  const results = sarif?.runs?.[0]?.results ?? [];
  const lines = ['<!-- legitagent-scan -->', '## legitAgent', ''];
  if (results.length === 0) {
    lines.push('Нарушений не найдено.');
    return lines.join('\n') + '\n';
  }
  for (const r of results) {
    const uri = r.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? '';
    lines.push(`- \`${r.ruleId}\` (${r.level}) — ${uri}`);
  }
  return lines.join('\n') + '\n';
}
```

Test file imports `../../../.github/actions/legitagent-scan/format-report.mjs` from `packages/cli/tests`.

`action.yml` new inputs with defaults `'true'`:

- `comment-on-pr`
- `create-issue-on-high`

After Upload SARIF, add two `actions/github-script@v7` steps. Use `actions/github-script@v7` `script` that reads `legitagent.sarif` (if missing, skip). For comment: `if: github.event_name == 'pull_request' && inputs.comment-on-pr == 'true'`. List comments on the PR, find body containing `<!-- legitagent-scan -->`, update or create. For issue: `if: github.event_name != 'pull_request' && inputs.create-issue-on-high == 'true'`. If `countHigh === 0`, do nothing. Else list open issues with label `legitagent` and title `legitAgent: находки high`; update body or create with that title and label (`issues.create` may need to create label — if label missing, create issue without failing; try `issues.create` with `labels: ['legitagent']` and swallow label errors by retrying unlabeled, OR use `issues.addLabels` continue-on-error). Prefer: create issue with labels, `continue-on-error: true` on the whole issue step is too broad. Implementation: `github.rest.issues.create({ ..., labels: ['legitagent'] })` — GitHub creates the label on the fly on many repos; if it 422, retry without labels.

Do not change fail-on-high logic.

`examples/github-scan.yml` permissions become:

```yaml
permissions:
  contents: read
  security-events: write
  pull-requests: write
  issues: write
```

- [ ] **Step 1:** Write `github-report.test.ts` against a not-yet-complete mjs (or write mjs exports first only as empty throwing functions so the test fails on assertion). Prefer: create mjs with wrong/empty format, test expects the marker and empty-state sentence — TDD: test first, then mjs.
- [ ] **Step 2:** Run `pnpm --filter @legit-agent/cli test` — new test fails.
- [ ] **Step 3:** Implement mjs, action.yml steps, example permissions.
- [ ] **Step 4:** CLI tests + `pnpm test` green. Cannot run github-script in CI of this repo against a fake PR; unit-test the formatter only.
- [ ] **Step 5:** Commit

```
git add .github/actions/legitagent-scan examples/github-scan.yml packages/cli/tests/github-report.test.ts
git commit -m "feat: comment on PRs and open an issue when scan finds high risks"
```

---

### Task 5: 0.3.0 docs, pins, versions

**Files:**
- Modify: `packages/core/package.json`, `packages/cli/package.json`, `packages/mcp/package.json`, `packages/live/package.json` version `0.3.0`
- Modify: `packages/mcp/src/index.ts` server version `'0.3.0'`
- Modify: `.github/actions/legitagent-scan/action.yml` — `npx --yes @legit-agent/cli@0.3.0`
- Modify: `examples/github-scan.yml` — `uses: kiruxich/legitAgent/.github/actions/legitagent-scan@v0.3.0`
- Modify: `README.md` — config example, scan-url hydration/reject, Action comment/issue, pin `@v0.3.0`
- Modify: `website/index.html` — mention config + PR comment if the hero/features still describe only v2 scan-url
- Modify: `packages/mcp/src/index.ts` `scan_url` description to mention отказ/гидрация (one sentence)
- Modify: `packages/cli/src/index.ts` usage only if needed; human formatter unchanged

README config section (place after CLI flags):

```markdown
### Конфиг

В корне проекта можно положить `legitagent.config.json`:

\`\`\`json
{
  "ignore": ["**/vendor/**"],
  "disabled": ["PDN.COOKIE.NO_REJECT"],
  "severity": { "PDN.TRANSFER.FOREIGN_TRACKER": "low" }
}
\`\`\`

Нет файла — как раньше. Невалидный JSON: код выхода `2`.
```

Update scan-url blurb: после загрузки ждёт гидрацию SPA, нажимает «отказ», если кнопка есть, и смотрит cookie после этого.

- [ ] **Step 1:** No new unit test required for version strings except MCP if a test snapshots `0.2.0` — grep `0.2.0` in `packages/` and tests; update any assertion.
- [ ] **Step 2:** Apply version + docs + pins.
- [ ] **Step 3:** `pnpm test` green. `rg '0\\.2\\.0' packages README.md examples website -g '!docs/**'` should only miss nothing in shipped packages.
- [ ] **Step 4:** Commit

```
git add packages .github/actions examples README.md website/index.html
git commit -m "chore: release 0.3.0 with config, live reject click, and Action reports"
```

Do not `git tag` or `git push` from this task. The controller tags after review.

---

## Self-review

1. Spec coverage: config, live wait/reject/cookies, Action comment+issue, pin `@v0.3.0`, package 0.3.0 — Tasks 1–5. Vue/Svelte explicitly out.
2. No TBD placeholders. Signatures: `loadScanConfig`, `ConfigError`, `discoverSourceFiles(root, extraIgnore?)`, `formatReport`, `countHigh`.
3. Action still uses npm CLI for scanning; formatter is in-repo so a git tag is enough without waiting for npm during Action checkout of this repo. Consumer workflows pin `@v0.3.0` which exists only after the controller pushes the tag.
