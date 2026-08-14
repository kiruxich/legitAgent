# legitAgent v7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v0.7.0 with LLM review (confirm/reject/ask_human), a live evidence pack (screenshots, cookies, PDF/SARIF), Cursor scan-fix-rescan skills, and optional Telegram/issue watch after deploy.

**Architecture:** Detectors stay deterministic. `reviewFindings` in core labels candidates. Live `scanUrl` optionally writes screenshots and cookie-name timelines. CLI/MCP compose review + pack. GitHub Action source-scan never calls the LLM; an optional URL mode runs `scan-url --review --evidence` and may notify Telegram.

**Tech Stack:** TypeScript, vitest, Playwright (already in `@legit-agent/live`), `fetch` for OpenAI-compatible LLM and Telegram. No new npm dependencies.

## Global Constraints

- Heuristic, not a legal opinion. Disclaimer text meaning must not change.
- MIT, `@legit-agent/*`, no cloud product, no paid plan.
- CI source `scan` and `fail-on-high` use raw detector findings only — never LLM.
- Evidence pack and PDF/SARIF include only `confirm` and `ask_human` (`forEvidencePack`).
- Cookie evidence stores names only, never values.
- No new runtime npm dependencies. PDF via Playwright. LLM and Telegram via `fetch`.
- User-facing strings Russian; rule ids Latin.
- TDD: failing test first, then minimal implementation.
- Work from this worktree. Do not switch to `main`. Commit on `feat/v7`.
- Do not bump to 0.7.0 until Task 3. Do not `git push` or tag.
- If something is unspecified, use this plan's defaults. Do not ask the user.

---

### Task 1: LLM review in core

**Files:**
- Create: `packages/core/src/review.ts`
- Create: `packages/core/tests/review.test.ts`
- Modify: `packages/core/src/types.ts` — add `Verdict`, `ReviewedFinding`
- Modify: `packages/core/src/index.ts` — export review API and types
- Modify: `packages/mcp/src/server.ts` — `handleReview`
- Modify: `packages/mcp/src/index.ts` — tool `review`
- Modify: `packages/mcp/tests/server.test.ts` — review tests

**Interfaces:**
- Consumes: `Finding` from `packages/core/src/types.ts`
- Produces:

```ts
export type Verdict = 'confirm' | 'reject' | 'ask_human';

export interface ReviewedFinding extends Finding {
  verdict: Verdict;
  reason: string;
}

export type LlmComplete = (prompt: string) => Promise<string>;

export const SOFT_RULE_IDS: readonly string[] = [
  'PDN.ORG.RKN_NOTICE',
  'PDN.LOCALIZATION.UNCLEAR',
  'PDN.POLICY.INCOMPLETE',
  'PDN.POLICY.NO_LINK',
  'CONSUMER.OFFER.MISSING',
  'CONSUMER.REQUISITES.MISSING',
  'CONSUMER.RETURN.MISSING',
];

export function forEvidencePack(reviewed: ReviewedFinding[]): ReviewedFinding[]

export async function reviewFindings(
  findings: Finding[],
  snippets: Record<string, string>,
  complete?: LlmComplete,
): Promise<ReviewedFinding[]>

export function createLlmComplete(
  env?: NodeJS.ProcessEnv,
): LlmComplete | undefined

export function snippetAround(source: string, line: number | null, radius = 15): string
```

`snippets` keys are `finding.file`. Missing snippet → empty string.

`createLlmComplete` returns `undefined` unless `LEGITAGENT_LLM_API_KEY` is a non-empty string. POST `{base}/chat/completions` with JSON `{ model, temperature: 0, messages: [{ role: 'user', content: prompt }] }`. Parse `choices[0].message.content`. Default base `https://api.openai.com/v1`, model `gpt-4o-mini`. Authorization `Bearer ${key}`.

When `complete` is omitted, call `createLlmComplete(process.env)`. If still undefined, fallback: soft ids `ask_human` reason `нет LLM, эвристика`; else `confirm` same reason.

When `complete` is provided, one prompt for all findings. Instruct: reply with a JSON array only, objects `{ "ruleId", "file", "verdict", "reason" }`. If the snippet cannot prove a violation, `ask_human`. Include ruleId, file, message, excerpt, snippet per finding. Parse: extract first `[...]` JSON array. Invalid verdict or missing row → that finding `ask_human` reason `модель не разобрала ответ`.

`handleReview(root?: string, lang?: string)`: same root rules as `handleScan`; `scanProject`; build snippets by reading files already scanned (use `scanProject` result files — if only `file`+`line` available, `readFileSync` of `path.join(root, finding.file)` when the file exists). Return `{ ...scanResult, reviewed }`.

MCP tool `review`: optional `root`, `lang`. Description: `Второй проход по находкам scan: confirm, reject или ask_human. Не юридическое заключение.`

- [ ] **Step 1: Write the failing test** in `packages/core/tests/review.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Finding } from '../src/types.js';
import { forEvidencePack, reviewFindings, SOFT_RULE_IDS } from '../src/review.js';

const form: Finding = {
  ruleId: 'PDN.FORM.NO_CONSENT',
  file: 'Form.tsx',
  line: 3,
  severity: 'high',
  message: 'form',
  fix: 'checkbox',
  excerpt: 'ст. 9',
};
const rkn: Finding = {
  ruleId: 'PDN.ORG.RKN_NOTICE',
  file: 'App.tsx',
  line: 1,
  severity: 'low',
  message: 'rkn',
  fix: 'check',
  excerpt: 'ст. 22',
};

describe('reviewFindings', () => {
  it('falls back without LLM: soft ask_human, others confirm', async () => {
    const reviewed = await reviewFindings([form, rkn], { 'Form.tsx': '<form/>' });
    expect(reviewed.find((f) => f.ruleId === form.ruleId)?.verdict).toBe('confirm');
    expect(reviewed.find((f) => f.ruleId === rkn.ruleId)?.verdict).toBe('ask_human');
    expect(SOFT_RULE_IDS).toContain('PDN.ORG.RKN_NOTICE');
  });

  it('uses LLM JSON and drops reject from the evidence pack', async () => {
    const complete = async () =>
      JSON.stringify([
        { ruleId: form.ruleId, file: form.file, verdict: 'confirm', reason: 'нет чекбокса' },
        { ruleId: rkn.ruleId, file: rkn.file, verdict: 'reject', reason: 'CTA не магазин' },
      ]);
    const reviewed = await reviewFindings([form, rkn], {}, complete);
    expect(reviewed.map((f) => f.verdict).sort()).toEqual(['confirm', 'reject']);
    const pack = forEvidencePack(reviewed);
    expect(pack).toHaveLength(1);
    expect(pack[0].ruleId).toBe(form.ruleId);
  });

  it('marks unparsed LLM rows as ask_human', async () => {
    const reviewed = await reviewFindings([form], {}, async () => 'not json');
    expect(reviewed[0].verdict).toBe('ask_human');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @legit-agent/core test -- tests/review.test.ts`

Expected: FAIL — cannot find `../src/review.js` or exports.

- [ ] **Step 3: Write minimal implementation** in `packages/core/src/review.ts` matching the interfaces above. Export types from `types.ts` as well (`Verdict`, `ReviewedFinding`). Re-export from `index.ts`.

- [ ] **Step 4: MCP tests then handlers**

Add to `packages/mcp/tests/server.test.ts`:

```ts
it('reviews a project and returns verdicts', async () => {
  const { handleReview } = await import('../src/server.js');
  const result = await handleReview(badForm);
  expect(result.reviewed.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT' && f.verdict)).toBe(true);
});
```

Implement `handleReview`. Register tool `review` in `packages/mcp/src/index.ts` (keep server version `0.6.0` until Task 3).

- [ ] **Step 5: Run tests**

`pnpm --filter @legit-agent/core test` and `pnpm --filter @legit-agent/mcp test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/review.ts packages/core/src/types.ts packages/core/src/index.ts packages/core/tests/review.test.ts packages/mcp/src/server.ts packages/mcp/src/index.ts packages/mcp/tests/server.test.ts
git commit -m "feat: review detector findings as confirm, reject, or ask_human"
```

---

### Task 2: Live evidence pack

**Files:**
- Create: `packages/live/src/evidence.ts`
- Create: `packages/live/tests/evidence.test.ts`
- Modify: `packages/live/src/scan-url.ts` — capture cookies, screenshots, timestamp
- Modify: `packages/live/src/index.ts` — export `scanUrl`, `writeEvidencePack`, types
- Modify: `packages/live/tests/scan-url.test.ts` — evidence fields on an existing fixture
- Modify: `packages/cli/src/sarif.ts` — accept `Finding[]` or `ScanResult` (keep `toSarif(result: ScanResult)` working; if needed add `toSarifFindings(findings: Finding[])`)

**Interfaces:**
- Consumes: `ScanResult`, `Finding`, `ReviewedFinding`, `forEvidencePack`, `disclaimer` from core; `toSarif` from cli is NOT imported into live (avoid cycle). Live writes SARIF itself with the same 2.1.0 shape as `packages/cli/src/sarif.ts` (duplicate the small mapper in `evidence.ts`, or put a shared `toSarif` in core). **Put `toSarif(result: { findings: Finding[] })` in `packages/core/src/sarif.ts` and switch CLI to import it.** If moving SARIF would balloon this task, duplicate the 20-line mapper in live `evidence.ts` — prefer move to core if CLI tests still pass.
- Produces:

```ts
export interface CookieName { name: string }

export interface EvidenceShot { id: string; file: string }

export interface LiveEvidence {
  capturedAt: string;
  url: string;
  cookiesBefore: CookieName[];
  cookiesAfterReject: CookieName[];
  screenshots: EvidenceShot[];
}

export interface LiveScanResult extends ScanResult {
  capturedAt: string;
  cookiesBefore: CookieName[];
  cookiesAfterReject: CookieName[];
  screenshots: EvidenceShot[];
  evidenceDir?: string;
}

export async function scanUrl(
  url: string,
  options?: { evidenceDir?: string; catalog?: Catalog },
): Promise<LiveScanResult>

export async function writeEvidencePack(args: {
  dir: string;
  live: LiveScanResult;
  reviewed: ReviewedFinding[];
  disclaimer: string;
}): Promise<{ json: string; sarif: string; pdf: string }>
```

`scanUrl` always returns `capturedAt` (ISO UTC), cookie name lists, and `screenshots` (empty if no `evidenceDir`). Existing tests that check `findings` must still pass.

When `evidenceDir` is set: `fs.mkdirSync(dir, { recursive: true })`; `page.screenshot({ path: join(dir, 'page.png'), fullPage: true })` after hydration, before reject click; if a cookie-control button exists, screenshot that locator to `banner.png`. Record `{ id: 'page', file: 'page.png' }` etc.

`writeEvidencePack`: mkdir dir; `evidence.json` with url, capturedAt, cookiesBefore, cookiesAfterReject, screenshots, disclaimer, `findings: forEvidencePack(reviewed)` (full reviewed finding objects). `evidence.sarif` from those findings. `evidence.pdf` via Playwright chromium: HTML with heading legitAgent, capturedAt, url, table of pack findings (ruleId, verdict, excerpt, file), `<img>` for each screenshot path, disclaimer paragraph; `page.pdf({ path, format: 'A4' })`. Close that extra page/browser. Return absolute paths.

- [ ] **Step 1: Failing tests** in `packages/live/tests/evidence.test.ts` plus one assertion in `scan-url.test.ts` that `capturedAt` matches `/^\d{4}-/` and `cookiesBefore` is an array.

Evidence test: start the same fixture server pattern as `scan-url.test.ts`; `scanUrl(banner-no-reject url, { evidenceDir: tmp })`; expect `page.png` exists; `writeEvidencePack` with one `confirm` and one `reject`; expect JSON findings length 1 (reject dropped); expect `evidence.pdf` and `evidence.sarif` exist; SARIF `version` `2.1.0`.

- [ ] **Step 2: Run** `pnpm --filter @legit-agent/live test -- tests/evidence.test.ts`

Expected: FAIL missing exports.

- [ ] **Step 3: Implement** `scan-url.ts` capture + `evidence.ts`. Keep `scanUrl(url)` working for old callers (`options` optional).

- [ ] **Step 4: Run** `pnpm --filter @legit-agent/live test`

Expected: PASS (existing 12 + new).

- [ ] **Step 5: Commit**

```bash
git add packages/live packages/core/src/sarif.ts packages/cli/src/sarif.ts packages/core/src/index.ts packages/cli/tests
git commit -m "feat: capture live evidence screenshots, cookies, and PDF pack"
```

(Only add core sarif files if you moved the mapper.)

---

### Task 3: CLI, watch, Cursor skills, docs, 0.7.0

**Files:**
- Modify: `packages/cli/src/index.ts` — `--review`, `scan-url --evidence`, `--notify-telegram`
- Create: `packages/cli/src/notify.ts` — `notifyTelegram(text: string, filePath?: string, env?: NodeJS.ProcessEnv): Promise<void>`
- Modify: `packages/cli/tests/cli.test.ts`
- Create: `packages/cli/tests/notify.test.ts`
- Modify: `packages/mcp/src/index.ts` — `scan_url.evidenceDir`; server version `0.7.0`
- Modify: `packages/mcp/src/server.ts` — pass evidenceDir
- Create: `examples/github-watch.yml`
- Modify: `.github/actions/legitagent-scan/action.yml` — optional `url`, `evidence-dir`; pin `cli@0.7.0`
- Modify: `examples/github-scan.yml` — `@v0.7.0`
- Modify: `skills/check/SKILL.md`, `skills/scan-url/SKILL.md`
- Create: `skills/fix/SKILL.md`
- Create: `docs/cursor-user-rule.md`
- Modify: README.md, website/index.html, `.cursor-plugin/plugin.json`
- Modify: `packages/*/package.json` versions `0.7.0` (core, cli, live, mcp)
- Modify: `docs/superpowers/specs/2026-08-14-legitagent-v7-design.md` status to поставлено

**Interfaces:**
- Consumes: `reviewFindings`, `createLlmComplete`, `forEvidencePack`, `snippetAround` from core; `scanUrl`, `writeEvidencePack` from live; `notifyTelegram`
- Produces: CLI flags and MCP `evidenceDir`; watch example; 0.7.0 pins

`notifyTelegram`: if missing token or chat id, throw `Error('Укажите LEGITAGENT_TELEGRAM_BOT_TOKEN и LEGITAGENT_TELEGRAM_CHAT_ID')`. If `filePath` set, POST `https://api.telegram.org/bot${token}/sendDocument` with `FormData` (chat_id, caption, document file). Else POST `.../sendMessage` JSON `{ chat_id, text }`. Tests mock `globalThis.fetch`.

CLI `scan --review --json`: after `scanProject`, build snippets from files on disk, `reviewFindings`, JSON includes `reviewed`. Exit code still based on **raw** findings high (CI-safe even with `--review`).

CLI `scan-url --review --evidence [dir] --notify-telegram`: scanUrl with evidenceDir; review live findings (snippet = page not available — use `JSON.stringify(cookies)` + finding.message as snippet keyed by `finding.file`); writeEvidencePack with forEvidencePack inside writeEvidencePack; notify with summary. Exit 1 if raw live findings have high.

Action: if `inputs.url != ''`, run `npx --yes @legit-agent/cli@0.7.0 scan-url URL --evidence "${{ inputs.evidence-dir }}" --review --sarif` — **scan-url does not need --sarif**; evidence pack writes evidence.sarif. Then upload `evidence.sarif` if present else `legitagent.sarif`. Keep existing scan path when url empty. Pin cli@0.7.0 in both paths.

`examples/github-watch.yml`: on `workflow_dispatch` (input url) and `schedule: cron '0 6 * * 1'`. Job uses the composite action with `url: ${{ inputs.url || vars.LEGITAGENT_WATCH_URL }}`. permissions issues write, contents read. Document in comments that Telegram secrets are optional env on the action step — add action input skip; watch yml can pass env TELEGRAM to a step `npx scan-url --notify-telegram` only if we add env passthrough. Simplest: watch yml runs:

```yaml
- uses: actions/checkout@v4
- uses: kiruxich/legitAgent/.github/actions/legitagent-scan@v0.7.0
  with:
    url: ${{ github.event.inputs.url || vars.LEGITAGENT_WATCH_URL }}
    fail-on-high: true
  env:
    LEGITAGENT_TELEGRAM_BOT_TOKEN: ${{ secrets.LEGITAGENT_TELEGRAM_BOT_TOKEN }}
    LEGITAGENT_TELEGRAM_CHAT_ID: ${{ secrets.LEGITAGENT_TELEGRAM_CHAT_ID }}
    LEGITAGENT_LLM_API_KEY: ${{ secrets.LEGITAGENT_LLM_API_KEY }}
```

When url is set, action must invoke `--notify-telegram` only if both telegram env vars are non-empty (bash test).

Skills `/check` and `/fix`: call `scan` then `review`; fix `confirm`; rescan; do not treat `reject` as a bug; show `ask_human` to the user; disclaimer.

`docs/cursor-user-rule.md`: exact user-rule text from the v7 spec.

README: document `--review`, `--evidence`, Telegram env, User rule file, MCP `review`, CI does not call LLM.

Website hero can mention v0.7.0 and evidence pack in one sentence. CLI pin `@0.7.0`.

- [ ] **Step 1: Failing CLI/notify tests** then implement notify + CLI flags.

- [ ] **Step 2: Action, watch yml, skills, docs, versions 0.7.0.**

- [ ] **Step 3: `pnpm -r build && pnpm -r test`**

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/cli packages/mcp examples .github skills docs README.md website .cursor-plugin packages/*/package.json packages/mcp/src/index.ts
git commit -m "feat: ship v0.7.0 evidence pack, review CLI, and Cursor fix loop"
```

Do not tag or push.
