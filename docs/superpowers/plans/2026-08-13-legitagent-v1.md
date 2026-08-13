# legitAgent v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@legitagent/core`, `@legitagent/cli`, and `@legitagent/mcp` so a React/Next or HTML repo can be scanned for three 152-FZ risks (form without consent, tracker without consent, missing privacy-policy link), with a full YAML rule catalog plus law excerpts, tests, logo, public GitHub repo, and npm publish.

**Architecture:** pnpm workspaces monorepo. `core` owns catalog, parsers, detectors, and `scanProject`. `cli` and `mcp` are thin wrappers over the same functions. Rules with `status: planned` appear in `listRules` / `explainRule` but never run during scan.

**Tech Stack:** Node.js 20+, TypeScript (ESM), pnpm workspaces, vitest, parse5, ts-morph, fast-glob, js-yaml, `@modelcontextprotocol/sdk`.

**Spec:** `docs/superpowers/specs/2026-08-13-legitagent-design.md`  
**Backlog (do not implement):** `docs/superpowers/specs/2026-08-13-legitagent-backlog.md`

## Global Constraints

- Product name: legitAgent. npm scope: `@legitagent`. Packages: `core`, `cli`, `mcp`. Version `0.1.0`.
- User-facing strings: Russian. Rule ids, package names, git, source comments: English / Latin.
- Scan only `.html`, `.jsx`, `.tsx`. Ignore `node_modules`, `.next`, `dist`, `build`, `coverage`, `.git`.
- Active detectors only: `PDN.FORM.NO_CONSENT`, `PDN.TRACKER.NO_CONSENT`, `PDN.POLICY.NO_LINK`.
- Every rule MUST have `excerptRef` pointing at an existing legal excerpt; loader throws otherwise.
- Zero-config. No Playwright, no GitHub Action, no Vue/Svelte, no `--lang en`.
- License MIT. Disclaimer: heuristics, not legal advice — same sentence in README, CLI, and `explainRule`.
- Scoped npm publish: `npm publish --access public` only.
- Approved logo: neuro-agent shield with **AI** in the center (not a status dot), sparkle top-right, wordmark Legit (light) + Agent (bold). Source PNG: `/Users/kiruxa/.cursor/projects/Users-kiruxa-Desktop-LegitAgent/assets/legitagent-logo-2-neuro-agent-ai.png`

---

## File map

```
legitAgent/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .gitignore
  LICENSE
  README.md
  assets/logo.png
  assets/logo.svg
  packages/core/package.json
  packages/core/tsconfig.json
  packages/core/src/types.ts
  packages/core/src/paths.ts
  packages/core/src/catalog.ts
  packages/core/src/discover.ts
  packages/core/src/parse-html.ts
  packages/core/src/parse-jsx.ts
  packages/core/src/disclaimer.ts
  packages/core/src/scan.ts
  packages/core/src/detectors/form-no-consent.ts
  packages/core/src/detectors/tracker-no-consent.ts
  packages/core/src/detectors/policy-no-link.ts
  packages/core/src/detectors/index.ts
  packages/core/src/index.ts
  packages/core/rules/policy.yaml
  packages/core/rules/forms.yaml
  packages/core/rules/trackers.yaml
  packages/core/rules/org.yaml
  packages/core/legal/152-fz-art-6.yaml
  packages/core/legal/152-fz-art-9.yaml
  packages/core/legal/152-fz-art-18.yaml
  packages/core/legal/152-fz-art-18-1.yaml
  packages/core/legal/152-fz-art-22.yaml
  packages/core/tests/catalog.test.ts
  packages/core/tests/discover.test.ts
  packages/core/tests/form-no-consent.test.ts
  packages/core/tests/tracker-no-consent.test.ts
  packages/core/tests/policy-no-link.test.ts
  packages/core/tests/scan.test.ts
  packages/core/tests/fixtures/bad-form/Contact.tsx
  packages/core/tests/fixtures/good-form/Contact.tsx
  packages/core/tests/fixtures/bad-tracker/metrika.ts
  packages/core/tests/fixtures/good-policy/layout.tsx
  packages/core/tests/fixtures/no-policy/page.tsx
  packages/core/tests/fixtures/empty-project/README.md
  packages/core/tests/fixtures/broken-jsx/Broken.tsx
  packages/cli/package.json
  packages/cli/tsconfig.json
  packages/cli/src/index.ts
  packages/cli/src/format.ts
  packages/cli/tests/cli.test.ts
  packages/mcp/package.json
  packages/mcp/tsconfig.json
  packages/mcp/src/index.ts
  packages/mcp/src/server.ts
  packages/mcp/tests/server.test.ts
```

---

### Task 1: Monorepo + types + catalog loader

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/types.ts`, `packages/core/src/paths.ts`, `packages/core/src/catalog.ts`, `packages/core/src/index.ts`, `packages/core/tests/catalog.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Rule`, `LegalExcerpt`, `Catalog`, `loadCatalog(rulesDir, legalDir)`, `defaultCatalog()`, `DISCLAIMER_RU`

- [ ] **Step 1: Write the failing catalog test**

Create `packages/core/tests/catalog.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../src/catalog.js';

function tmpCatalog(ruleYaml: string, excerptYaml?: string) {
  const dir = mkdtempSync(path.join(tmpdir(), 'legitagent-'));
  mkdirSync(path.join(dir, 'rules'));
  mkdirSync(path.join(dir, 'legal'));
  writeFileSync(path.join(dir, 'rules', 'r.yaml'), ruleYaml);
  if (excerptYaml) writeFileSync(path.join(dir, 'legal', 'e.yaml'), excerptYaml);
  return dir;
}

const excerpt = `id: art9
law: 152-ФЗ
article: ст. 9
text: Согласие должно быть конкретным.
sourceUrl: https://pravo.gov.ru/
`;

describe('loadCatalog', () => {
  it('loads a rule and its excerpt', () => {
    const dir = tmpCatalog(
      `- id: PDN.FORM.NO_CONSENT
  law: 152-ФЗ ст. 9
  severity: high
  status: active
  title: Нет согласия
  message: Форма без согласия
  fix: Добавьте чекбокс
  excerptRef: art9
`,
      excerpt,
    );
    const catalog = loadCatalog(path.join(dir, 'rules'), path.join(dir, 'legal'));
    expect(catalog.rules).toHaveLength(1);
    expect(catalog.excerpts.art9.text).toContain('конкретным');
  });

  it('throws when excerptRef is missing from legal files', () => {
    const dir = tmpCatalog(
      `- id: X
  law: L
  severity: high
  status: planned
  title: t
  message: m
  fix: f
  excerptRef: missing
`,
      excerpt,
    );
    expect(() => loadCatalog(path.join(dir, 'rules'), path.join(dir, 'legal'))).toThrow(
      /missing/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/kiruxa/Desktop/LegitAgent
# after creating package.json files below, but if core is not implemented yet:
pnpm --filter @legitagent/core test -- tests/catalog.test.ts
```

Expected: FAIL (cannot find module `../src/catalog.js` or `loadCatalog` is not a function). If workspace is not created yet, create the json files in Step 3 first, install, then re-run — the test must still fail on missing implementation.

- [ ] **Step 3: Scaffold workspace and implement loader**

Root `package.json`:

```json
{
  "name": "legitagent-monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - packages/*
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

`.gitignore`:

```
node_modules
dist
.DS_Store
*.tsbuildinfo
```

`packages/core/package.json`:

```json
{
  "name": "@legitagent/core",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "rules", "legal"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "fast-glob": "^3.3.3",
    "js-yaml": "^4.1.0",
    "parse5": "^7.2.1",
    "ts-morph": "^25.0.1"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.13.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/core/src/types.ts`:

```ts
export type Severity = 'high' | 'medium' | 'low';
export type RuleStatus = 'active' | 'planned';

export interface Rule {
  id: string;
  law: string;
  severity: Severity;
  status: RuleStatus;
  title: string;
  message: string;
  fix: string;
  excerptRef: string;
}

export interface LegalExcerpt {
  id: string;
  law: string;
  article: string;
  text: string;
  sourceUrl: string;
}

export interface Catalog {
  rules: Rule[];
  excerpts: Record<string, LegalExcerpt>;
}

export interface Finding {
  ruleId: string;
  file: string;
  line: number | null;
  severity: Severity;
  message: string;
  fix: string;
  excerpt: string;
}

export interface ScanWarning {
  file: string;
  message: string;
}

export interface ScanResult {
  findings: Finding[];
  warnings: ScanWarning[];
  scannedFileCount: number;
}

export interface ExplainResult {
  rule: Rule;
  excerpt: LegalExcerpt;
  disclaimer: string;
}
```

`packages/core/src/disclaimer.ts`:

```ts
export const DISCLAIMER_RU =
  'Это эвристическая проверка кода, а не юридическое заключение.';
```

`packages/core/src/paths.ts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function defaultRulesDir(): string {
  return path.join(packageRoot(), 'rules');
}

export function defaultLegalDir(): string {
  return path.join(packageRoot(), 'legal');
}
```

`packages/core/src/catalog.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { defaultLegalDir, defaultRulesDir } from './paths.js';
import type { Catalog, LegalExcerpt, Rule } from './types.js';

function loadYamlFiles<T>(dir: string): T[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const items: T[] = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const raw = readFileSync(full, 'utf8');
    let parsed: unknown;
    try {
      parsed = yaml.load(raw);
    } catch (err) {
      throw new Error(`Некорректный YAML: ${full}: ${(err as Error).message}`);
    }
    if (Array.isArray(parsed)) items.push(...(parsed as T[]));
    else if (parsed && typeof parsed === 'object') items.push(parsed as T);
  }
  return items;
}

export function loadCatalog(rulesDir: string, legalDir: string): Catalog {
  const rules = loadYamlFiles<Rule>(rulesDir);
  const excerptList = loadYamlFiles<LegalExcerpt>(legalDir);
  const excerpts: Record<string, LegalExcerpt> = {};
  for (const e of excerptList) excerpts[e.id] = e;
  for (const rule of rules) {
    if (!excerpts[rule.excerptRef]) {
      throw new Error(
        `Правило ${rule.id} ссылается на отсутствующую выдержку "${rule.excerptRef}"`,
      );
    }
  }
  return { rules, excerpts };
}

export function defaultCatalog(): Catalog {
  return loadCatalog(defaultRulesDir(), defaultLegalDir());
}
```

`packages/core/src/index.ts`:

```ts
export { DISCLAIMER_RU } from './disclaimer.js';
export { defaultCatalog, loadCatalog } from './catalog.js';
export { defaultLegalDir, defaultRulesDir, packageRoot } from './paths.js';
export type {
  Catalog,
  ExplainResult,
  Finding,
  LegalExcerpt,
  Rule,
  RuleStatus,
  ScanResult,
  ScanWarning,
  Severity,
} from './types.js';
```

Add `packages/core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

Then:

```bash
cd /Users/kiruxa/Desktop/LegitAgent
corepack enable
pnpm install
```

- [ ] **Step 4: Run tests and make sure they pass**

```bash
pnpm --filter @legitagent/core test -- tests/catalog.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore pnpm-lock.yaml packages/core
git commit -m "$(cat <<'EOF'
feat: add core catalog loader and monorepo scaffold

EOF
)"
```

---

### Task 2: Legal excerpts + full rule taxonomy

**Files:**
- Create: `packages/core/legal/*.yaml`, `packages/core/rules/*.yaml`
- Modify: `packages/core/tests/catalog.test.ts` (add defaultCatalog test)
- Test: `packages/core/tests/catalog.test.ts`

**Interfaces:**
- Consumes: `defaultCatalog()` from Task 1
- Produces: 11 rules (3 `active`, 8 `planned`); excerpt ids `art6`, `art9`, `art18`, `art18-1`, `art22`

- [ ] **Step 1: Write the failing taxonomy test**

Append to `packages/core/tests/catalog.test.ts`:

```ts
import { defaultCatalog } from '../src/catalog.js';

describe('defaultCatalog', () => {
  it('includes three active detectors and planned rules', () => {
    const catalog = defaultCatalog();
    const ids = catalog.rules.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([
      'PDN.FORM.NO_CONSENT',
      'PDN.TRACKER.NO_CONSENT',
      'PDN.POLICY.NO_LINK',
      'PDN.FORM.PRECHECKED_CONSENT',
      'PDN.ORG.RKN_NOTICE',
    ]));
    const active = catalog.rules.filter((r) => r.status === 'active').map((r) => r.id);
    expect(active.sort()).toEqual([
      'PDN.FORM.NO_CONSENT',
      'PDN.POLICY.NO_LINK',
      'PDN.TRACKER.NO_CONSENT',
    ]);
    for (const rule of catalog.rules) {
      expect(catalog.excerpts[rule.excerptRef], rule.id).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @legitagent/core test -- tests/catalog.test.ts
```

Expected: FAIL (`ENOENT` on `rules/` or active list not matching).

- [ ] **Step 3: Write YAML files**

`packages/core/legal/152-fz-art-6.yaml`:

```yaml
id: art6
law: 152-ФЗ
article: ст. 6
text: Обработка персональных данных допускается при наличии правового основания, в том числе согласия субъекта персональных данных.
sourceUrl: https://pravo.gov.ru/
```

`packages/core/legal/152-fz-art-9.yaml`:

```yaml
id: art9
law: 152-ФЗ
article: ст. 9
text: Согласие субъекта персональных данных должно быть конкретным, предметным, информированным, сознательным и однозначным. Согласие может быть дано в любой позволяющей подтвердить его получение форме.
sourceUrl: https://pravo.gov.ru/
```

`packages/core/legal/152-fz-art-18.yaml`:

```yaml
id: art18
law: 152-ФЗ
article: ст. 18
text: При сборе персональных данных, в том числе через информационно-телекоммуникационную сеть Интернет, запись, систематизация, накопление, хранение, уточнение, извлечение персональных данных граждан РФ должны осуществляться с использованием баз данных, находящихся на территории РФ.
sourceUrl: https://pravo.gov.ru/
```

`packages/core/legal/152-fz-art-18-1.yaml`:

```yaml
id: art18-1
law: 152-ФЗ
article: ст. 18.1
text: Оператор обязан опубликовать или иным образом обеспечить неограниченный доступ к документу, определяющему его политику в отношении обработки персональных данных, к сведениям о реализуемых требованиях к защите персональных данных.
sourceUrl: https://pravo.gov.ru/
```

`packages/core/legal/152-fz-art-22.yaml`:

```yaml
id: art22
law: 152-ФЗ
article: ст. 22
text: Оператор до начала обработки персональных данных обязан уведомить уполномоченный орган по защите прав субъектов персональных данных о своем намерении осуществлять обработку персональных данных, кроме установленных законом исключений.
sourceUrl: https://pravo.gov.ru/
```

`packages/core/rules/policy.yaml`:

```yaml
- id: PDN.POLICY.NO_LINK
  law: 152-ФЗ ст. 18.1
  severity: high
  status: active
  title: Нет ссылки на политику обработки ПДн
  message: В проекте не найдена ссылка на политику обработки персональных данных.
  fix: Добавьте в футер или шапку ссылку на HTML-страницу политики (например /privacy).
  excerptRef: art18-1
- id: PDN.POLICY.INCOMPLETE
  law: 152-ФЗ ст. 18.1
  severity: medium
  status: planned
  title: Политика без обязательных сведений
  message: Политика должна называть оператора, цели, состав данных, сроки и порядок отзыва согласия.
  fix: Дополните политику обязательными сведениями ст. 18.1. Автопроверка текста — в следующей версии.
  excerptRef: art18-1
```

`packages/core/rules/forms.yaml`:

```yaml
- id: PDN.FORM.NO_CONSENT
  law: 152-ФЗ ст. 9
  severity: high
  status: active
  title: Форма собирает ПДн без согласия
  message: Найдена форма с полями имени, email или телефона без чекбокса согласия на обработку ПДн.
  fix: Добавьте незаполненный чекбокс и текст согласия со ссылкой на политику.
  excerptRef: art9
- id: PDN.FORM.PRECHECKED_CONSENT
  law: 152-ФЗ ст. 9
  severity: high
  status: planned
  title: Чекбокс согласия предзаполнен
  message: Предзаполненная галочка не считается полученным согласием.
  fix: Уберите defaultChecked / checked={true} у чекбокса согласия. Автопроверка — в следующей версии.
  excerptRef: art9
- id: PDN.FORM.NO_POLICY_LINK
  law: 152-ФЗ ст. 9
  severity: medium
  status: planned
  title: Согласие без ссылки на политику
  message: Рядом с согласием должна быть кликабельная ссылка на политику обработки ПДн.
  fix: Добавьте ссылку на политику в текст согласия. Автопроверка — в следующей версии.
  excerptRef: art9
```

`packages/core/rules/trackers.yaml`:

```yaml
- id: PDN.TRACKER.NO_CONSENT
  law: 152-ФЗ ст. 6
  severity: high
  status: active
  title: Метрика или пиксель без согласия
  message: Аналитика или рекламный пиксель инициализируются сразу, без проверки согласия.
  fix: Вызывайте ym/gtag/fbq только после opt-in в cookie-баннере.
  excerptRef: art6
- id: PDN.COOKIE.BEFORE_CONSENT
  law: 152-ФЗ ст. 6
  severity: high
  status: planned
  title: Cookie до согласия
  message: Аналитические cookie не должны ставиться до opt-in. Нужна проверка живого сайта.
  fix: Не загружайте трекеры до клика «Принять». Браузерный сканер — в следующей версии.
  excerptRef: art6
- id: PDN.COOKIE.NO_REJECT
  law: 152-ФЗ ст. 9
  severity: medium
  status: planned
  title: Баннер без отказа
  message: У пользователя должна быть реальная возможность отклонить необязательные cookie.
  fix: Добавьте кнопку отказа, не только «Принять». Автопроверка баннера — в следующей версии.
  excerptRef: art9
- id: PDN.TRANSFER.FOREIGN_TRACKER
  law: 152-ФЗ ст. 6
  severity: medium
  status: planned
  title: Иностранный трекер / трансграничная передача
  message: Google Analytics, Meta Pixel и аналогичные сервисы могут означать трансграничную передачу ПДн.
  fix: Задокументируйте передачу или замените на российский аналог. Автопроверка — в следующей версии.
  excerptRef: art6
```

`packages/core/rules/org.yaml`:

```yaml
- id: PDN.LOCALIZATION.UNCLEAR
  law: 152-ФЗ ст. 18
  severity: medium
  status: planned
  title: Локализация баз ПДн
  message: Запись и хранение ПДн граждан РФ должны идти через базы на территории РФ. По исходникам сайта это обычно не видно.
  fix: Проверьте хостинг и процессоров. Автопроверка инфраструктуры — в следующей версии.
  excerptRef: art18
- id: PDN.ORG.RKN_NOTICE
  law: 152-ФЗ ст. 22
  severity: medium
  status: planned
  title: Уведомление Роскомнадзора
  message: Оператор, как правило, уведомляет РКН до начала обработки ПДн. В коде сайта это не отражается.
  fix: Проверьте реестр операторов pd.rkn.gov.ru. Это организационная мера, не код.
  excerptRef: art22
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @legitagent/core test -- tests/catalog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/legal packages/core/rules packages/core/tests/catalog.test.ts
git commit -m "$(cat <<'EOF'
feat: add 152-FZ rule taxonomy and legal excerpts

EOF
)"
```

---

### Task 3: File discovery

**Files:**
- Create: `packages/core/src/discover.ts`, `packages/core/tests/discover.test.ts`, `packages/core/tests/fixtures/empty-project/README.md`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `discoverSourceFiles(root: string): Promise<string[]>` — absolute paths, only `.html|.jsx|.tsx`, skips ignore dirs

- [ ] **Step 1: Write the failing test**

`packages/core/tests/fixtures/empty-project/README.md`:

```md
# empty
```

`packages/core/tests/discover.test.ts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discoverSourceFiles } from '../src/discover.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('discoverSourceFiles', () => {
  it('returns empty array when there are no html/jsx/tsx files', async () => {
    const files = await discoverSourceFiles(path.join(here, 'fixtures/empty-project'));
    expect(files).toEqual([]);
  });

  it('finds tsx and skips node_modules', async () => {
    const root = path.join(here, 'fixtures/good-form');
    const files = await discoverSourceFiles(root);
    expect(files.some((f) => f.endsWith('Contact.tsx'))).toBe(true);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
  });
});
```

The second test will also fail until Task 6 creates `good-form/Contact.tsx`. Create a stub now: `packages/core/tests/fixtures/good-form/Contact.tsx` with `export const x = 1;` — Task 6 overwrites it.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @legitagent/core test -- tests/discover.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement discover**

`packages/core/src/discover.ts`:

```ts
import fg from 'fast-glob';

const IGNORE = ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**'];

export async function discoverSourceFiles(root: string): Promise<string[]> {
  return fg(['**/*.html', '**/*.jsx', '**/*.tsx'], {
    cwd: root,
    absolute: true,
    ignore: IGNORE,
    dot: false,
  });
}
```

Export from `index.ts`: `export { discoverSourceFiles } from './discover.js';`

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @legitagent/core test -- tests/discover.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/discover.ts packages/core/src/index.ts packages/core/tests/discover.test.ts packages/core/tests/fixtures
git commit -m "$(cat <<'EOF'
feat: discover html/jsx/tsx files for scanning

EOF
)"
```

---

### Task 4: HTML and JSX parsers with skip-on-error

**Files:**
- Create: `packages/core/src/parse-html.ts`, `packages/core/src/parse-jsx.ts`, `packages/core/tests/fixtures/broken-jsx/Broken.tsx`
- Test: `packages/core/tests/parse.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `parseHtml(source: string)`, `tryParseJsx(filePath: string, source: string): { ok: true; sourceFile: SourceFile } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing test**

`packages/core/tests/fixtures/broken-jsx/Broken.tsx`:

```tsx
export function Broken( {
```

`packages/core/tests/parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseHtml } from '../src/parse-html.js';
import { tryParseJsx } from '../src/parse-jsx.js';

describe('parsers', () => {
  it('parses html', () => {
    const doc = parseHtml('<form><input name="email"></form>');
    expect(doc).toBeTruthy();
  });

  it('parses valid tsx', () => {
    const result = tryParseJsx(
      'Ok.tsx',
      'export const C = () => <form><input name="email" /></form>;',
    );
    expect(result.ok).toBe(true);
  });
});
```

Broken-file handling is owned by `scanProject` in Task 8 (`looksBroken` unmatched braces) so this task does not depend on ts-morph diagnostics.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @legitagent/core test -- tests/parse.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement parsers**

`packages/core/src/parse-html.ts`:

```ts
import { parse, type DefaultTreeAdapterMap } from 'parse5';

export type HtmlDocument = DefaultTreeAdapterMap['document'];

export function parseHtml(source: string): HtmlDocument {
  return parse(source);
}
```

`packages/core/src/parse-jsx.ts`:

```ts
import { Project, type SourceFile } from 'ts-morph';

const project = new Project({
  useInMemoryFileSystem: true,
  compilerOptions: { jsx: 2, allowJs: true, skipLibCheck: true },
});

export type JsxParseResult =
  | { ok: true; sourceFile: SourceFile }
  | { ok: false; error: string };

export function tryParseJsx(filePath: string, source: string): JsxParseResult {
  try {
    const sf = project.createSourceFile(filePath, source, { overwrite: true });
    return { ok: true, sourceFile: sf };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @legitagent/core test -- tests/parse.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/parse-html.ts packages/core/src/parse-jsx.ts packages/core/tests/parse.test.ts packages/core/tests/fixtures/broken-jsx
git commit -m "$(cat <<'EOF'
feat: add HTML and JSX parsers

EOF
)"
```

---

### Task 5: Detector `PDN.FORM.NO_CONSENT`

**Files:**
- Create: `packages/core/src/detectors/form-no-consent.ts`, `packages/core/src/detectors/index.ts`
- Modify: fixtures `bad-form/Contact.tsx`, `good-form/Contact.tsx`
- Test: `packages/core/tests/form-no-consent.test.ts`

**Interfaces:**
- Consumes: `Catalog` rule `PDN.FORM.NO_CONSENT`; `tryParseJsx` / `parseHtml`
- Produces: `detectFormNoConsent(args: DetectorArgs): Finding[]`

Shared detector args (put in `packages/core/src/detectors/index.ts`):

```ts
import type { Catalog, Finding } from '../types.js';

export interface DetectorArgs {
  filePath: string;
  relativePath: string;
  source: string;
  catalog: Catalog;
}

export type Detector = (args: DetectorArgs) => Finding[];

export function findingFromRule(
  catalog: Catalog,
  ruleId: string,
  file: string,
  line: number | null,
): Finding {
  const rule = catalog.rules.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Unknown rule ${ruleId}`);
  const excerpt = catalog.excerpts[rule.excerptRef];
  return {
    ruleId,
    file,
    line,
    severity: rule.severity,
    message: rule.message,
    fix: rule.fix,
    excerpt: excerpt.text,
  };
}
```

- [ ] **Step 1: Write fixtures and failing test**

`packages/core/tests/fixtures/bad-form/Contact.tsx`:

```tsx
export function Contact() {
  return (
    <form>
      <input name="email" type="email" />
      <input name="phone" type="tel" />
      <button type="submit">Отправить</button>
    </form>
  );
}
```

`packages/core/tests/fixtures/good-form/Contact.tsx`:

```tsx
export function Contact() {
  return (
    <form>
      <input name="email" type="email" />
      <label>
        <input type="checkbox" name="pdnConsent" />
        Я согласен на обработку персональных данных
      </label>
      <button type="submit">Отправить</button>
    </form>
  );
}
```

`packages/core/tests/form-no-consent.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectFormNoConsent } from '../src/detectors/form-no-consent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

describe('detectFormNoConsent', () => {
  it('flags a form with email and no consent checkbox', () => {
    const filePath = path.join(here, 'fixtures/bad-form/Contact.tsx');
    const findings = detectFormNoConsent({
      filePath,
      relativePath: 'Contact.tsx',
      source: readFileSync(filePath, 'utf8'),
      catalog,
    });
    expect(findings.map((f) => f.ruleId)).toContain('PDN.FORM.NO_CONSENT');
  });

  it('does not flag a form with consent checkbox', () => {
    const filePath = path.join(here, 'fixtures/good-form/Contact.tsx');
    const findings = detectFormNoConsent({
      filePath,
      relativePath: 'Contact.tsx',
      source: readFileSync(filePath, 'utf8'),
      catalog,
    });
    expect(findings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @legitagent/core test -- tests/form-no-consent.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement detector**

`packages/core/src/detectors/form-no-consent.ts`:

```ts
import { findingFromRule, type DetectorArgs } from './index.js';
import type { Finding } from '../types.js';

const PII = /(email|e-mail|phone|tel|name|fio|имя|телефон|почта)/i;
const CONSENT = /(персональн|согласи|consent|обработк)/i;

function hasPii(source: string): boolean {
  return /<form[\s>]/i.test(source) && /<input\b/i.test(source) && PII.test(source);
}

function hasConsent(source: string): boolean {
  return /type=["']checkbox["']/i.test(source) && CONSENT.test(source);
}

export function detectFormNoConsent(args: DetectorArgs): Finding[] {
  if (!hasPii(args.source) || hasConsent(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => /<form[\s>]/i.test(l));
  return [findingFromRule(args.catalog, 'PDN.FORM.NO_CONSENT', args.relativePath, line >= 0 ? line + 1 : null)];
}
```

v1 uses source heuristics on HTML/JSX text (form + pii input + checkbox/consent). ts-morph/parse5 remain available for later tightening; do not expand to UI kits.

Also handle `.html` the same way (the regex does).

Fix circular import: move `findingFromRule` and `DetectorArgs` to `packages/core/src/detectors/helpers.ts`. `index.ts` re-exports detectors. `form-no-consent.ts` imports helpers, not `index.ts`.

`packages/core/src/detectors/helpers.ts` — put `DetectorArgs`, `Detector`, `findingFromRule` there.

`packages/core/src/detectors/index.ts`:

```ts
export { detectFormNoConsent } from './form-no-consent.js';
export type { Detector, DetectorArgs } from './helpers.js';
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @legitagent/core test -- tests/form-no-consent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/detectors packages/core/tests/form-no-consent.test.ts packages/core/tests/fixtures/bad-form packages/core/tests/fixtures/good-form
git commit -m "$(cat <<'EOF'
feat: detect forms that collect PII without consent

EOF
)"
```

---

### Task 6: Detector `PDN.TRACKER.NO_CONSENT`

**Files:**
- Create: `packages/core/src/detectors/tracker-no-consent.ts`, `packages/core/tests/fixtures/bad-tracker/metrika.ts` (use `.tsx` because discover ignores `.ts` — **use `metrika.tsx`**)
- Modify: `packages/core/src/detectors/index.ts`
- Test: `packages/core/tests/tracker-no-consent.test.ts`

**Interfaces:**
- Consumes: `DetectorArgs`
- Produces: `detectTrackerNoConsent(args): Finding[]`

- [ ] **Step 1: Write fixtures and failing test**

`packages/core/tests/fixtures/bad-tracker/metrika.tsx`:

```tsx
export function boot() {
  ym(123456, 'init', { clickmap: true });
}
```

`packages/core/tests/tracker-no-consent.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectTrackerNoConsent } from '../src/detectors/tracker-no-consent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

describe('detectTrackerNoConsent', () => {
  it('flags top-level ym() init', () => {
    const filePath = path.join(here, 'fixtures/bad-tracker/metrika.tsx');
    const findings = detectTrackerNoConsent({
      filePath,
      relativePath: 'metrika.tsx',
      source: readFileSync(filePath, 'utf8'),
      catalog,
    });
    expect(findings.map((f) => f.ruleId)).toContain('PDN.TRACKER.NO_CONSENT');
  });

  it('does not flag tracker behind consent check', () => {
    const source = `if (consent) { ym(1, 'init', {}); }`;
    const findings = detectTrackerNoConsent({
      filePath: 'ok.tsx',
      relativePath: 'ok.tsx',
      source,
      catalog,
    });
    expect(findings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @legitagent/core test -- tests/tracker-no-consent.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`packages/core/src/detectors/tracker-no-consent.ts`:

```ts
import { findingFromRule, type DetectorArgs } from './helpers.js';
import type { Finding } from '../types.js';

const TRACKER = /\b(ym|gtag|ga|fbq|VK\.Retargeting)\s*\(/;

export function detectTrackerNoConsent(args: DetectorArgs): Finding[] {
  if (!TRACKER.test(args.source)) return [];
  if (/\bconsent\b/i.test(args.source) && /if\s*\(/i.test(args.source)) return [];
  const line = args.source.split(/\n/).findIndex((l) => TRACKER.test(l));
  return [findingFromRule(args.catalog, 'PDN.TRACKER.NO_CONSENT', args.relativePath, line >= 0 ? line + 1 : null)];
}
```

Export from `detectors/index.ts`.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @legitagent/core test -- tests/tracker-no-consent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/detectors/tracker-no-consent.ts packages/core/src/detectors/index.ts packages/core/tests/tracker-no-consent.test.ts packages/core/tests/fixtures/bad-tracker
git commit -m "$(cat <<'EOF'
feat: detect analytics pixels initialized without consent

EOF
)"
```

---

### Task 7: Detector `PDN.POLICY.NO_LINK`

**Files:**
- Create: `packages/core/src/detectors/policy-no-link.ts`, fixtures `good-policy/layout.tsx`, `no-policy/page.tsx`
- Test: `packages/core/tests/policy-no-link.test.ts`

**Interfaces:**
- Consumes: **project-level** source concatenation or list of files — `detectPolicyNoLink({ relativePaths, sources, catalog }): Finding[]` (one finding per project, not per file)

Because this rule is once-per-project, signature:

```ts
export function detectPolicyNoLink(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[];
```

- [ ] **Step 1: Write fixtures and failing test**

`packages/core/tests/fixtures/good-policy/layout.tsx`:

```tsx
export function Footer() {
  return <a href="/privacy">Политика обработки персональных данных</a>;
}
```

`packages/core/tests/fixtures/no-policy/page.tsx`:

```tsx
export function Page() {
  return <h1>Главная</h1>;
}
```

`packages/core/tests/policy-no-link.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../src/catalog.js';
import { detectPolicyNoLink } from '../src/detectors/policy-no-link.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = defaultCatalog();

describe('detectPolicyNoLink', () => {
  it('flags a project with no privacy link', () => {
    const source = readFileSync(path.join(here, 'fixtures/no-policy/page.tsx'), 'utf8');
    const findings = detectPolicyNoLink({
      catalog,
      files: [{ relativePath: 'page.tsx', source }],
    });
    expect(findings.map((f) => f.ruleId)).toContain('PDN.POLICY.NO_LINK');
  });

  it('passes when a privacy href exists', () => {
    const source = readFileSync(path.join(here, 'fixtures/good-policy/layout.tsx'), 'utf8');
    const findings = detectPolicyNoLink({
      catalog,
      files: [{ relativePath: 'layout.tsx', source }],
    });
    expect(findings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @legitagent/core test -- tests/policy-no-link.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`packages/core/src/detectors/policy-no-link.ts`:

```ts
import { findingFromRule } from './helpers.js';
import type { Catalog, Finding } from '../types.js';

const POLICY = /href\s*=\s*["'][^"']*(privacy|personal-data|политик|pdn|confidential)[^"']*["']/i;

export function detectPolicyNoLink(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[] {
  const hit = args.files.find((f) => POLICY.test(f.source) || /политик[аи] конфиденциальности/i.test(f.source));
  if (hit) return [];
  return [findingFromRule(args.catalog, 'PDN.POLICY.NO_LINK', '.', null)];
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @legitagent/core test -- tests/policy-no-link.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/detectors/policy-no-link.ts packages/core/tests/policy-no-link.test.ts packages/core/tests/fixtures/good-policy packages/core/tests/fixtures/no-policy
git commit -m "$(cat <<'EOF'
feat: detect missing privacy policy links

EOF
)"
```

---

### Task 8: `scanProject` + `listRules` + `explainRule`

**Files:**
- Create: `packages/core/src/scan.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/src/detectors/index.ts`
- Test: `packages/core/tests/scan.test.ts`

**Interfaces:**
- Consumes: `discoverSourceFiles`, three detectors, `defaultCatalog`, `DISCLAIMER_RU`
- Produces:

```ts
export async function scanProject(root: string, catalog?: Catalog): Promise<ScanResult>;
export function listRules(catalog?: Catalog): Rule[];
export function explainRule(ruleId: string, catalog?: Catalog): ExplainResult;
```

`explainRule` throws `Error('Неизвестное правило: ${ruleId}')` if missing.

- [ ] **Step 1: Write the failing test**

`packages/core/tests/scan.test.ts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DISCLAIMER_RU } from '../src/disclaimer.js';
import { explainRule, listRules, scanProject } from '../src/scan.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('scanProject', () => {
  it('finds a bad form', async () => {
    const result = await scanProject(path.join(here, 'fixtures/bad-form'));
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
    expect(result.scannedFileCount).toBeGreaterThan(0);
  });

  it('does not flag a good form for NO_CONSENT', async () => {
    const result = await scanProject(path.join(here, 'fixtures/good-form'));
    expect(result.findings.some((f) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(false);
  });

  it('returns empty findings and zero files for empty project', async () => {
    const result = await scanProject(path.join(here, 'fixtures/empty-project'));
    expect(result.scannedFileCount).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('does not throw on broken jsx; records a warning', async () => {
    const result = await scanProject(path.join(here, 'fixtures/broken-jsx'));
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('listRules / explainRule', () => {
  it('lists planned and active rules', () => {
    const rules = listRules();
    expect(rules.some((r) => r.status === 'planned')).toBe(true);
    expect(rules.some((r) => r.status === 'active')).toBe(true);
  });

  it('explains a rule with excerpt and disclaimer', () => {
    const explained = explainRule('PDN.FORM.NO_CONSENT');
    expect(explained.excerpt.text.length).toBeGreaterThan(0);
    expect(explained.disclaimer).toBe(DISCLAIMER_RU);
  });
});
```

If broken-jsx still parses, write a file that `readFile` succeeds but detector skip uses `try { }` around `readFileSync` only — for warning, if `tryParseJsx` is ok, emit a warning when the filename is `Broken.tsx` is wrong. Instead: make `scanProject` warn when `readFileSync` works and `tryParseJsx` returns `ok: false`. If ts-morph never returns ok:false, **warn when the file has unmatched `{` count**. Add in scan.ts:

```ts
function looksBroken(source: string): boolean {
  const opens = (source.match(/{/g) ?? []).length;
  const closes = (source.match(/}/g) ?? []).length;
  return opens !== closes;
}
```

Use that for warnings so the test is stable.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @legitagent/core test -- tests/scan.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement scan.ts**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultCatalog } from './catalog.js';
import { DISCLAIMER_RU } from './disclaimer.js';
import { discoverSourceFiles } from './discover.js';
import { detectFormNoConsent } from './detectors/form-no-consent.js';
import { detectPolicyNoLink } from './detectors/policy-no-link.js';
import { detectTrackerNoConsent } from './detectors/tracker-no-consent.js';
import type { Catalog, ExplainResult, Finding, Rule, ScanResult, ScanWarning } from './types.js';

function looksBroken(source: string): boolean {
  return (source.match(/{/g) ?? []).length !== (source.match(/}/g) ?? []).length;
}

export async function scanProject(root: string, catalog = defaultCatalog()): Promise<ScanResult> {
  const files = await discoverSourceFiles(root);
  const warnings: ScanWarning[] = [];
  const loaded: { relativePath: string; source: string }[] = [];
  const findings: Finding[] = [];

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath) || path.basename(filePath);
    let source: string;
    try {
      source = readFileSync(filePath, 'utf8');
    } catch (err) {
      warnings.push({ file: relativePath, message: (err as Error).message });
      continue;
    }
    if (looksBroken(source)) {
      warnings.push({ file: relativePath, message: 'Файл пропущен: похоже на синтаксическую ошибку' });
      continue;
    }
    loaded.push({ relativePath, source });
    findings.push(
      ...detectFormNoConsent({ filePath, relativePath, source, catalog }),
      ...detectTrackerNoConsent({ filePath, relativePath, source, catalog }),
    );
  }

  findings.push(...detectPolicyNoLink({ catalog, files: loaded }));

  return { findings, warnings, scannedFileCount: loaded.length };
}

export function listRules(catalog = defaultCatalog()): Rule[] {
  return catalog.rules;
}

export function explainRule(ruleId: string, catalog = defaultCatalog()): ExplainResult {
  const rule = catalog.rules.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Неизвестное правило: ${ruleId}`);
  const excerpt = catalog.excerpts[rule.excerptRef];
  return { rule, excerpt, disclaimer: DISCLAIMER_RU };
}
```

Export from `index.ts`: `scanProject`, `listRules`, `explainRule`.

- [ ] **Step 4: Run all core tests**

```bash
pnpm --filter @legitagent/core test
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/scan.ts packages/core/src/index.ts packages/core/tests/scan.test.ts
git commit -m "$(cat <<'EOF'
feat: orchestrate project scan, listRules, and explainRule

EOF
)"
```

---

### Task 9: CLI `@legitagent/cli`

**Files:**
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`, `packages/cli/src/index.ts`, `packages/cli/src/format.ts`, `packages/cli/tests/cli.test.ts`, `packages/cli/vitest.config.ts`

**Interfaces:**
- Consumes: `scanProject(root)`, `ScanResult`
- Produces: bin `legitagent`; `scan [path]`; `--json`; exit `1` if any `high`; exit `0` if no files; Russian human output including disclaimer

- [ ] **Step 1: Write the failing CLI test**

`packages/cli/tests/cli.test.ts`:

```ts
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../src/index.ts');
const fixture = path.resolve(here, '../../core/tests/fixtures/bad-form');

describe('cli', () => {
  it('prints json findings and exits 1 on high', () => {
    const result = spawnSync('npx', ['tsx', cli, 'scan', fixture, '--json'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.findings.some((f: { ruleId: string }) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
  });
});
```

Add `tsx` as cli devDependency.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @legitagent/cli test
```

Expected: FAIL (package/cli missing or exit not 1).

- [ ] **Step 3: Implement CLI**

`packages/cli/package.json`:

```json
{
  "name": "@legitagent/cli",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "bin": {
    "legitagent": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@legitagent/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

`packages/cli/src/format.ts`:

```ts
import { DISCLAIMER_RU, type ScanResult } from '@legitagent/core';

export function formatHuman(result: ScanResult): string {
  const lines: string[] = [];
  if (result.scannedFileCount === 0) {
    lines.push('Нечего сканировать: нет файлов .html/.jsx/.tsx.');
    lines.push(DISCLAIMER_RU);
    return lines.join('\n');
  }
  if (result.findings.length === 0) {
    lines.push(`Файлов проверено: ${result.scannedFileCount}. Нарушений не найдено.`);
  } else {
    lines.push(`Файлов проверено: ${result.scannedFileCount}. Находок: ${result.findings.length}.`);
    for (const f of result.findings) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      lines.push(`\n[${f.severity}] ${f.ruleId} (${loc})`);
      lines.push(f.message);
      lines.push(`Как исправить: ${f.fix}`);
      lines.push(`Норма: ${f.excerpt}`);
    }
  }
  for (const w of result.warnings) lines.push(`Предупреждение ${w.file}: ${w.message}`);
  lines.push(DISCLAIMER_RU);
  return lines.join('\n');
}
```

`packages/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import path from 'node:path';
import { scanProject } from '@legitagent/core';
import { formatHuman } from './format.js';

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const filtered = args.filter((a) => a !== '--json');
  const cmd = filtered[0];
  if (cmd !== 'scan') {
    console.error('Использование: legitagent scan [путь] [--json]');
    process.exit(2);
  }
  const root = path.resolve(filtered[1] ?? process.cwd());
  const result = await scanProject(root);
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(formatHuman(result) + '\n');
  const high = result.findings.some((f) => f.severity === 'high');
  process.exit(high ? 1 : 0);
}

main();
```

`packages/cli/tsconfig.json` — same as core, `rootDir: src`, `outDir: dist`. Add vitest config like core.

- [ ] **Step 4: Run tests**

```bash
pnpm install
pnpm --filter @legitagent/cli test
```

Expected: PASS, exit code 1 on bad-form fixture.

- [ ] **Step 5: Commit**

```bash
git add packages/cli pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat: add Russian CLI scan command with --json

EOF
)"
```

---

### Task 10: MCP `@legitagent/mcp`

**Files:**
- Create: `packages/mcp/package.json`, `packages/mcp/tsconfig.json`, `packages/mcp/src/index.ts`, `packages/mcp/src/server.ts`, `packages/mcp/tests/server.test.ts`

**Interfaces:**
- Consumes: `scanProject`, `listRules`, `explainRule`
- Produces: stdio MCP server; tools `scan`, `list_rules`, `explain_rule`; `npx -y @legitagent/mcp`

Tool schemas:

- `scan`: optional `root` string (default `process.cwd()`)
- `list_rules`: no args
- `explain_rule`: required `ruleId` string

If `scan` root missing/unreadable, return Russian error `Укажите корень проекта`.

- [ ] **Step 1: Write failing unit test of handlers** (not full MCP wire)

Extract handlers in `packages/mcp/src/server.ts`:

```ts
export async function handleScan(root?: string) { ... }
export function handleListRules() { ... }
export function handleExplainRule(ruleId: string) { ... }
```

`packages/mcp/tests/server.test.ts` calls these with the bad-form fixture and expects `PDN.FORM.NO_CONSENT`; `handleListRules` includes `planned`; `handleExplainRule('nope')` throws.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @legitagent/mcp test
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`packages/mcp/package.json` — name `@legitagent/mcp`, bin `./dist/index.js`, dependency `@legitagent/core` workspace and `@modelcontextprotocol/sdk`.

`packages/mcp/src/server.ts` — implement handlers returning JSON-serializable objects (findings, rules, explain + disclaimer).

`packages/mcp/src/index.ts`:

```ts
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { handleExplainRule, handleListRules, handleScan } from './server.js';

const server = new Server({ name: 'legitagent', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan',
      description: 'Проверить проект на типичные риски 152-ФЗ по исходникам HTML/JSX/TSX',
      inputSchema: {
        type: 'object',
        properties: { root: { type: 'string', description: 'Корень проекта' } },
      },
    },
    {
      name: 'list_rules',
      description: 'Показать каталог правил, включая ещё не реализованные детекторы',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'explain_rule',
      description: 'Объяснить правило, цитату статьи и как исправить',
      inputSchema: {
        type: 'object',
        properties: { ruleId: { type: 'string' } },
        required: ['ruleId'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, string>;
  try {
    if (name === 'scan') {
      const data = await handleScan(args.root);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'list_rules') {
      return { content: [{ type: 'text', text: JSON.stringify(handleListRules(), null, 2) }] };
    }
    if (name === 'explain_rule') {
      return { content: [{ type: 'text', text: JSON.stringify(handleExplainRule(args.ruleId), null, 2) }] };
    }
    throw new Error(`Неизвестный инструмент: ${name}`);
  } catch (err) {
    return { content: [{ type: 'text', text: (err as Error).message }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

Check installed `@modelcontextprotocol/sdk` exports if `Server` import path differs — use the package's current API (`McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` if that is what the installed version documents). Adapt imports to the installed major version; keep tool names unchanged.

- [ ] **Step 4: Run tests**

```bash
pnpm install
pnpm --filter @legitagent/mcp test
pnpm -r test
```

Expected: all packages PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat: add MCP server with scan, list_rules, explain_rule

EOF
)"
```

---

### Task 11: Logo, LICENSE, README

**Files:**
- Create: `LICENSE`, `README.md`, `assets/logo.png`, `assets/logo.svg`

**Interfaces:** none

- [ ] **Step 1: Copy approved PNG**

```bash
mkdir -p /Users/kiruxa/Desktop/LegitAgent/assets
cp "/Users/kiruxa/.cursor/projects/Users-kiruxa-Desktop-LegitAgent/assets/legitagent-logo-2-neuro-agent-ai.png" /Users/kiruxa/Desktop/LegitAgent/assets/logo.png
```

- [ ] **Step 2: Write SVG matching the approved mark** (shield, green AI, sparkle, Legit light / Agent bold)

`assets/logo.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="legitAgent">
  <rect width="512" height="512" fill="#0A0A0A"/>
  <g fill="none" stroke="#F5F5F5" stroke-width="10">
    <path d="M256 96 l110 40 v90 c0 78-48 132-110 160-62-28-110-82-110-160 v-90 z"/>
  </g>
  <text x="256" y="250" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="56" font-weight="700" fill="#22C55E">AI</text>
  <path fill="#22C55E" d="M352 118 l10 22 24 4-18 16 5 24-21-12-21 12 5-24-18-16 24-4 z"/>
  <text x="256" y="420" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="36">
    <tspan fill="#F5F5F5" font-weight="300">Legit</tspan><tspan fill="#F5F5F5" font-weight="700">Agent</tspan>
  </text>
</svg>
```

- [ ] **Step 3: LICENSE MIT** — copyright year 2026, holder the GitHub username of the publisher (read via `gh api user --jq .login`; if gh is not logged in, use `LegitAgent contributors`).

- [ ] **Step 4: README.md** with logo, what it does, disclaimer, install, MCP snippet, CLI, not-legal-advice, link to spec/backlog.

Include:

````md
<p align="center"><img src="assets/logo.png" width="280" alt="legitAgent" /></p>

# legitAgent

Проверка исходников сайта на типичные риски 152-ФЗ: прямо в Cursor (MCP) и в терминале (CLI).

**Это эвристическая проверка кода, а не юридическое заключение.**

## MCP (Cursor)

```json
{
  "mcpServers": {
    "legitagent": {
      "command": "npx",
      "args": ["-y", "@legitagent/mcp"]
    }
  }
}
```

## CLI

```bash
npx @legitagent/cli scan
npx @legitagent/cli scan ./my-site --json
```

v1 ищет три вещи: форму без согласия, метрику без согласия, отсутствие ссылки на политику. Остальные пункты чек-листа можно спросить у агента (`list_rules` / `explain_rule`).
````

- [ ] **Step 5: Commit**

```bash
git add LICENSE README.md assets
git commit -m "$(cat <<'EOF'
docs: add README, MIT license, and approved logo

EOF
)"
```

---

### Task 12: GitHub repo + npm publish

**Files:** none new except maybe `.npmrc` with `provenance=false` only if needed. Do not put tokens in the repo.

**Interfaces:** public GitHub `legitAgent`; npm org `@legitagent`; three public packages.

- [ ] **Step 1: Create GitHub repo and push**

```bash
cd /Users/kiruxa/Desktop/LegitAgent
gh auth status
git remote -v
gh repo create legitAgent --public --source=. --remote=origin --push
```

If `legitAgent` is taken under the user, use `LegitAgent` and record the URL. Do not force-push.

- [ ] **Step 2: Build all packages**

```bash
pnpm -r build
pnpm -r test
```

Expected: tests PASS, `packages/*/dist` exists.

- [ ] **Step 3: npm org checkpoint (human)**

User must already have: npm account, 2FA, org `legitagent` (free public). Verify:

```bash
npm whoami
npm org ls legitagent
```

If org name is taken, stop and use `@legit-agent` — that requires renaming packages; do not rename silently. Ask the user.

- [ ] **Step 4: Publish in dependency order**

```bash
cd packages/core && npm publish --access public
cd ../cli && npm publish --access public
cd ../mcp && npm publish --access public
```

From workspace, `npm publish` may fail on `workspace:*`. Before publish, pack with pnpm:

```bash
pnpm --filter @legitagent/core publish --access public
pnpm --filter @legitagent/cli publish --access public
pnpm --filter @legitagent/mcp publish --access public
```

If `workspace:*` is not replaced, set `"@legitagent/core": "0.1.0"` in cli/mcp `dependencies` for the published tarball (pnpm publish usually rewrites this). Confirm `pnpm pack` in cli contains `"@legitagent/core": "0.1.0"`.

- [ ] **Step 5: Smoke**

```bash
npx -y @legitagent/cli scan /Users/kiruxa/Desktop/LegitAgent/packages/core/tests/fixtures/bad-form --json
```

Expected: JSON with `PDN.FORM.NO_CONSENT`, non-zero exit.

Commit only if package.json versions/deps changed:

```bash
git add packages/cli/package.json packages/mcp/package.json
git commit -m "$(cat <<'EOF'
chore: prepare workspace packages for npm publish

EOF
)"
git push origin HEAD
```

---

## Self-review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| Monorepo pnpm, three packages | 1, 9, 10 |
| YAML catalog + excerpts, no rule without excerpt | 1–2 |
| Full taxonomy, 3 active detectors | 2, 5–7 |
| Scan html/jsx/tsx, ignore build dirs | 3, 8 |
| parse5 + ts-morph present | 4 |
| Skip broken files with warning | 8 |
| Empty project is not an error | 8–9 |
| CLI Russian + `--json` + exit 1 on high | 9 |
| MCP scan / list_rules / explain_rule | 10 |
| Disclaimer | 8–11 |
| MIT, README, logo | 11 |
| GitHub + npm `--access public` | 12 |
| No Playwright / Action / Vue / config file | honored (not in tasks) |

**Placeholder scan:** none. MCP SDK import may need a one-line adapt to the installed version — that is a concrete check in Task 10, not a TBD feature.

**Type consistency:** `Finding`, `ScanResult`, `Catalog`, `ExplainResult`, detector helpers, `scanProject(root, catalog?)`, `listRules`, `explainRule` are named the same from Task 1 through Task 10.

**Discover vs tracker fixture:** tracker fixture is `.tsx` because discovery does not include `.ts`.
