# legitAgent v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v2 in three sequential deliveries: source detectors, Playwright live scan, GitHub Action + SARIF.

**Architecture:** Keep `@legit-agent/core` as the source scanner. Add per-rule detectors in `packages/core/src/detectors/` and wire them in `scan.ts`. Live scan lives in a new `@legit-agent/live` package so Playwright never loads during source `scan`. CLI/MCP stay thin wrappers. Action is a composite wrapper around CLI `--sarif`.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, parse5/ts-morph as today, Playwright Chromium for live, SARIF 2.1.0, GitHub composite action.

## Global Constraints

- Product name `legitAgent`; packages `@legit-agent/core`, `@legit-agent/cli`, `@legit-agent/mcp`; new live package `@legit-agent/live`.
- Russian user-facing strings; rule ids stay Latin `PDN.*`.
- Heuristics, not legal advice; keep `DISCLAIMER_RU` unchanged.
- Scan source files: `.html`, `.jsx`, `.tsx` only; same ignore globs as v1.
- TDD: failing test first, watch it fail, then implement.
- Do not bump npm versions until Task 3. Do not publish to npm.
- Do not add `legitagent.config.json`, Vue/Svelte, English CLI, or Playwright inside `core`.
- Work on branch `feat/v2`, not `main`.
- After YAML status changes run `pnpm catalog` and keep `docs/RULES.md` + `website/rules.html` in sync.
- Existing v1 tests must stay green.

---

### Task 1: Phase A — source detectors

**Files:**
- Create: `packages/core/src/detectors/form-prechecked-consent.ts`
- Create: `packages/core/src/detectors/form-no-policy-link.ts`
- Create: `packages/core/src/detectors/policy-incomplete.ts`
- Create: `packages/core/src/detectors/foreign-tracker.ts`
- Create: `packages/core/src/detectors/cookie-no-reject.ts`
- Create: `packages/core/tests/form-prechecked-consent.test.ts`
- Create: `packages/core/tests/form-no-policy-link.test.ts`
- Create: `packages/core/tests/policy-incomplete.test.ts`
- Create: `packages/core/tests/foreign-tracker.test.ts`
- Create: `packages/core/tests/cookie-no-reject.test.ts`
- Create: fixtures under `packages/core/tests/fixtures/` for each case (bad + good)
- Modify: `packages/core/src/detectors/index.ts`, `packages/core/src/scan.ts`
- Modify: `packages/core/rules/forms.yaml`, `policy.yaml`, `trackers.yaml` — set `status: active` for the five rules; rewrite `fix` to drop «Автопроверка — в следующей версии»
- Modify: `packages/core/tests/catalog.test.ts` active list
- Modify: `packages/core/tests/scan.test.ts` — one bad project with all five, one good project with none of them
- Run: `pnpm catalog` after YAML changes

**Interfaces:**
- Consumes: `DetectorArgs`, `findingFromRule`, existing `POLICY` href regex from `policy-no-link.ts` (export it as `POLICY_HREF` from that file or a tiny `patterns.ts` if both need it — prefer exporting from `policy-no-link.ts` rather than duplicating)
- Produces: five detector functions with the same signature as `detectFormNoConsent`; `scanProject` concatenates their findings; catalog `status: active` for those five ids

**Detector rules (implement exactly):**

`detectFormPrecheckedConsent`: skip unless source has `<form` and a PII field (`email|e-mail|phone|tel|name|fio|имя|телефон|почта`) and an `<input`. Flag if a consent checkbox (`type="checkbox"` plus `персональн|согласи|consent|обработк`) is prechecked via `defaultChecked` or `checked={true}` or `checked="checked"` or `checked="true"` or a bare `checked` attribute on that input.

`detectFormNoPolicyLink`: skip unless form+PII+consent checkbox exist. Flag if the file has no `href` matching `privacy|personal-data|политик|pdn|confidential`.

`detectPolicyIncomplete(catalog, files)`: project-level. Policy file = path matches `privacy|personal-data|политик|pdn|confidential` OR source matches `политик[аи].{0,40}(обработк|конфиденциальност|персональн)`. If none, return `[]`. If some exist, flag each that is missing any of: `оператор`, `цел`, `срок`, `отзыв` (case-insensitive).

`detectForeignTracker`: flag `gtag(`, `ga(`, `fbq(`, `google-analytics`, `googletagmanager`, `facebook.net`, `connect.facebook`. Do **not** flag `ym(` or `VK.Retargeting` alone.

`detectCookieNoReject`: skip unless source looks like a cookie banner (`cookie-banner|CookieBanner|cookie consent|куки`). Flag if accept (`принять|accept`) is present and reject (`отклон|отказ|reject|decline`) is not.

- [ ] **Step 1:** Write failing tests and fixtures for all five detectors (TDD).
- [ ] **Step 2:** Run `pnpm --filter @legit-agent/core test` — new tests fail.
- [ ] **Step 3:** Implement detectors, wire `scan.ts`, flip YAML to `active`, update catalog test, `pnpm catalog`.
- [ ] **Step 4:** Full `pnpm test` green.
- [ ] **Step 5:** Commit on `feat/v2`.

```
git add packages/core docs/RULES.md website/rules.html
git commit -m "feat: activate source detectors for five planned 152-FZ rules"
```

---

### Task 2: Phase B — Playwright live scanner

**Files:**
- Create: `packages/live/package.json` name `@legit-agent/live`, version `0.1.1`, type module, depends on `@legit-agent/core` workspace and `playwright`
- Create: `packages/live/tsconfig.json` extending `../../tsconfig.base.json` like other packages
- Create: `packages/live/vitest.config.ts`
- Create: `packages/live/src/index.ts` exporting `scanUrl`
- Create: `packages/live/src/scan-url.ts`
- Create: `packages/live/tests/scan-url.test.ts`
- Create: `packages/live/tests/fixtures/cookies-before-consent.html`
- Create: `packages/live/tests/fixtures/banner-no-reject.html`
- Create: `packages/live/tests/fixtures/foreign-tracker.html`
- Create: `packages/live/tests/fixtures/clean.html`
- Modify: `packages/cli/src/index.ts` — command `scan-url`
- Modify: `packages/cli/package.json` — dependency `@legit-agent/live`
- Modify: `packages/mcp/src/index.ts` and `server.ts` — tool `scan_url`
- Modify: `packages/mcp/package.json` — dependency `@legit-agent/live`
- Modify: `.github/workflows/ci.yml` — install Chromium before `pnpm -r test`
- Modify: `packages/cli/tests/cli.test.ts` — `scan-url` without URL exits 2; with local fixture URL returns json

**Interfaces:**
- Consumes: `defaultCatalog`, `findingFromRule` / `Finding` / `ScanResult` from core; Chromium via `chromium.launch({ headless: true })`
- Produces: `export async function scanUrl(url: string, catalog?: Catalog): Promise<ScanResult>`
  - `scannedFileCount` is `1` on success (the page)
  - `findings[].file` is the URL
  - Invalid/missing URL: throw `Укажите URL сайта` (MCP/CLI catch and show)

Live checks after `page.goto(url, { waitUntil: 'domcontentloaded' })` and a short `networkidle` wait (timeout 10s, don't fail the scan if networkidle never comes — still inspect cookies/DOM/requests):

1. Cookie names from `context.cookies()`. Finding `PDN.COOKIE.BEFORE_CONSENT` if any name matches `/^(_ga|_gid|_gat|_fbp|_ym_|tmr_)/` or equals `_ym_uid` / `_fbp`.
2. DOM: if text/html contains cookie banner hints and a button/link matching `принять|accept` but none matching `отклон|отказ|reject|decline` → `PDN.COOKIE.NO_REJECT`.
3. Request URLs containing `google-analytics`, `googletagmanager`, `facebook.net`, `connect.facebook.net` → `PDN.TRANSFER.FOREIGN_TRACKER`.

Tests start `http.createServer` serving fixtures, call `scanUrl('http://127.0.0.1:<port>/...')`, close server in `after`.

CLI usage when command is `scan-url`: require next arg; support `--json`. Exit codes unchanged.

MCP `scan_url`: required `url` string; same JSON content as `scan`.

- [ ] **Step 1:** Failing tests for `scanUrl` against local fixtures.
- [ ] **Step 2:** Implement `packages/live`, CLI, MCP, CI Chromium install.
- [ ] **Step 3:** `pnpm test` green including live.
- [ ] **Step 4:** Commit.

```
git commit -m "feat: add Playwright live scan for cookies and foreign trackers"
```

---

### Task 3: Phase C — SARIF + GitHub Action + 0.2.0

**Files:**
- Create: `packages/cli/src/sarif.ts` — `toSarif(result: ScanResult): object`
- Create: `packages/cli/tests/sarif.test.ts`
- Modify: `packages/cli/src/index.ts` — `--sarif` optional path
- Create: `.github/actions/legitagent-scan/action.yml`
- Modify: `examples/github-scan.yml` to use the composite action
- Modify: `packages/*/package.json` versions to `0.2.0` (core, cli, mcp, live)
- Modify: MCP server version string `0.2.0`
- Modify: README, website copy if it still says «три детектора в v1»
- Run `pnpm catalog` if YAML already updated

**Interfaces:**
- `toSarif` returns SARIF 2.1.0:
  - `$schema`: `https://json.schemastore.org/sarif-2.1.0.json`
  - `version`: `2.1.0`
  - one run, `tool.driver.name`: `legitAgent`
  - each finding → result with `ruleId`, `level` (`high`→`error`, `medium`→`warning`, `low`→`note`), `message.text` = finding.message, location URI = file, startLine = line or `1` if null
- Action inputs: `root` default `.`; `fail-on-high` default `true`
- Action runs `npx --yes @legit-agent/cli scan ${root} --sarif legitagent.sarif` after checkout is done by the caller
- Uploads SARIF with `github/codeql-action/upload-sarif@v3` `sarif_file: legitagent.sarif` `continue-on-error: true` (upload may fail off GitHub.com)
- If `fail-on-high` is true, action fails when CLI exits 1

Do not add a scan of this monorepo's fixtures to `ci.yml`.

- [ ] **Step 1:** Failing test: `toSarif` maps a high finding to `error` and ruleId.
- [ ] **Step 2:** Implement SARIF, CLI flag, action.yml, example workflow, version 0.2.0, docs.
- [ ] **Step 3:** `pnpm test` green.
- [ ] **Step 4:** Commit.

```
git commit -m "feat: add SARIF output, GitHub Action, and 0.2.0"
```
