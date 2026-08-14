<p align="center"><img src="assets/logo.png" width="280" alt="legitAgent" /></p>

<p align="center">
  <a href="https://github.com/kiruxich/legitAgent/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/kiruxich/legitAgent/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://www.npmjs.com/package/@legit-agent/cli"><img alt="npm" src="https://img.shields.io/npm/v/@legit-agent/cli?label=@legit-agent/cli" /></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-green" /></a>
</p>

# legitAgent

Проверка сайта на типичные риски **152-ФЗ**, **38-ФЗ** и **ЗоЗПП** прямо в Cursor, Claude, Kimi и в терминале.

Сайт: [kiruxich.github.io/legitAgent](https://kiruxich.github.io/legitAgent/). Каталог правил: [docs/RULES.md](docs/RULES.md). Сломанный пример: [legitAgent-demo](https://github.com/kiruxich/legitAgent-demo).

Подключите MCP — агент сам просканирует HTML/JSX/TSX/Vue/Svelte/Astro, покажет находки со статьёй закона и подскажет, как исправить. В Cursor после установки плагина те же действия доступны через `/check`, `/scan`, `/scan-url`. Либо одна команда в CI, GitHub Action с выгрузкой SARIF, либо `scan-url` для живой страницы: тот же каталог по DOM плюс cookie до согласия.

```bash
npx @legit-agent/cli scan
```

**Это эвристическая проверка кода, а не юридическое заключение.** legitAgent не заменяет юриста и не гарантирует соответствие закону. Решение принимает человек.

---

## Быстрый старт

Нужен Node.js 20+. Пакеты ставить не обязательно — достаточно `npx`.

### MCP (Cursor, Claude, Kimi и другие)

Один и тот же сервер. `@latest` и `--prefer-online`: при каждом запуске Cursor, Claude, Kimi и других IDE npx берёт текущий релиз с npm, а не кэш. Уже открытый чат сам не обновится — нужен перезапуск окна / MCP.

В Cursor одной кнопкой: [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=legitagent&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcHJlZmVyLW9ubGluZSIsIkBsZWdpdC1hZ2VudC9tY3BAbGF0ZXN0Il19).

```json
{
  "mcpServers": {
    "legitagent": {
      "command": "npx",
      "args": ["-y", "--prefer-online", "@legit-agent/mcp@latest"]
    }
  }
}
```

| Клиент | Куда вставить |
|---|---|
| **Cursor** | **User** (все проекты): `~/.cursor/mcp.json` — туда же пишет [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=legitagent&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcHJlZmVyLW9ubGluZSIsIkBsZWdpdC1hZ2VudC9tY3BAbGF0ZXN0Il19). **Проект** (только этот репозиторий): `.cursor/mcp.json`. Скиллы `/check` … — Marketplace или `~/.cursor/plugins/local` |
| **Claude Code** | `claude mcp add --transport stdio legitagent -- npx -y --prefer-online @legit-agent/mcp@latest` |
| **Claude Desktop** | тот же JSON в `claude_desktop_config.json`. Инструменты: `scan`, `scan_url`, `list_rules`, `explain_rule`, `generate_policy`, `get_law`. Слэша `/check` нет — пишете «проверь проект». |
| **Kimi Code** | `~/.kimi-code/mcp.json` или `.kimi-code/mcp.json` |
| **Kimi CLI** | `kimi mcp add --transport stdio legitagent -- npx -y --prefer-online @legit-agent/mcp@latest` или `~/.kimi/mcp.json` |
| **Windsurf, Cline, Continue, Copilot** | тот же `mcpServers`; если спрашивают транспорт — `stdio` |

После подключения: «проверь этот репозиторий на 152-ФЗ», «покажи каталог правил», «объясни PDN.FORM.NO_CONSENT».

В Cursor те же действия вызываются через `/` (скиллы плагина, карточка при наведении берётся из `description`). Локально: `~/.cursor/plugins/local/legitagent`. В каталоге у всех — после публикации на Marketplace. В ChatGPT и Kimi слэша Cursor нет: там работают MCP-инструменты, не `/check`.

| Команда | MCP |
|---|---|
| `/check` | `scan` текущего проекта |
| `/scan` | `scan` |
| `/scan-url https://example.com` | `scan_url` |
| `/list-rules` | `list_rules` |
| `/explain-rule PDN.FORM.NO_CONSENT` | `explain_rule` |
| `/generate-policy ООО Пример` | `generate_policy` |
| `/get-law 152-fz 9` | `get_law` |

Slash-команда не заменяет MCP: она говорит агенту вызвать инструмент. Без включённого сервера `legitagent` скана не будет.

### CLI

```bash
npx @legit-agent/cli scan
npx @legit-agent/cli scan ./my-site
npx @legit-agent/cli scan ./my-site --json
npx @legit-agent/cli scan ./my-site --sarif
npx @legit-agent/cli scan ./my-site --sarif findings.sarif
npx @legit-agent/cli scan ./my-site --lang en
npx @legit-agent/cli scan-url https://example.com --json
npx @legit-agent/cli init-policy --operator "ООО Ромашка" --inn 123 --email privacy@site.ru --out privacy.md
```

### Конфиг

В корне проекта можно положить `legitagent.config.json`:

```json
{
  "ignore": ["**/vendor/**"],
  "disabled": ["PDN.COOKIE.NO_REJECT"],
  "severity": { "PDN.TRANSFER.FOREIGN_TRACKER": "low" }
}
```

Нет файла — как раньше. Невалидный JSON: код выхода `2`.

Вывод по-русски по умолчанию; `--lang en` — английские сообщения. Файл, строка, что не так, как исправить, цитата нормы.

`init-policy` печатает **черновик** политики обработки ПДн (не юридический документ). Корпус 152-ФЗ / 38-ФЗ / ЗоЗПП лежит в `packages/core/legal/corpus/`; обновить с pravo.gov.ru: `pnpm fetch-law`.

`--sarif` без пути пишет `legitagent.sarif` (SARIF 2.1.0). `scan-url` открывает страницу в Chromium: ждёт гидрацию SPA, нажимает «отказ», если кнопка есть, смотрит cookie до и после этого, и прогоняет тот же каталог правил по HTML страницы (формы, политика, ERID, витрина, трекеры).

| Код выхода | Значение |
|---|---|
| `0` | Нет серьёзных находок (в том числе нечего сканировать) |
| `1` | Есть хотя бы одна находка `high` |
| `2` | Нет команды / `scan-url` без URL / невалидный `legitagent.config.json` |

В CI достаточно `npx @legit-agent/cli@0.6.0 scan --json`: ненулевой код — стоп пайплайна. Для code scanning скопируйте [`examples/github-scan.yml`](examples/github-scan.yml) в `.github/workflows/legitagent.yml` — он вызывает композитное действие [`.github/actions/legitagent-scan`](.github/actions/legitagent-scan/action.yml) с пином `@v0.6.0`: пишет SARIF, загружает его в GitHub, комментирует PR с результатами и при push в `main` создаёт или обновляет issue при находках `high`.

---

## Возможности

Один движок [`@legit-agent/core`](https://www.npmjs.com/package/@legit-agent/core), живой сканер [`@legit-agent/live`](https://www.npmjs.com/package/@legit-agent/live), оболочки [`@legit-agent/mcp`](https://www.npmjs.com/package/@legit-agent/mcp) и [`@legit-agent/cli`](https://www.npmjs.com/package/@legit-agent/cli).

### Инструменты MCP

| Инструмент | Что делает |
|---|---|
| `scan` | Сканирует проект. Необязательные `root` и `lang` (`ru` / `en`). |
| `scan_url` | Проверяет живой URL: cookie, баннер, формы, политика, ERID, витрина, иностранные трекеры; ждёт гидрацию SPA и кликает «отказ», если кнопка есть. |
| `list_rules` | Полный каталог правил. |
| `explain_rule` | Правило, выдержка статьи, как исправить, дисклеймер. Нужен `ruleId`. |
| `generate_policy` | Черновик политики обработки ПДн. Нужен `operator`. Не юридическое заключение. |
| `get_law` | Текст из корпуса (`152-fz`, `38-fz`, `zozpp`), опционально номер статьи. |

Агент сам предлагает патч по находкам — MCP только проверяет и объясняет.

Ответ `scan`: список `findings` (правило, файл, строка, severity, сообщение, фикс, цитата), `warnings` по битым файлам, `scannedFileCount`. Если путь нечитаем: `Укажите корень проекта`.

### Что проверяется в коде

Сканер читает `.html`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`. Пропускает `node_modules`, `.next`, `dist`, `build`, `coverage`, `.git`. Синтаксически сломанный файл не роняет проверку — он уходит в предупреждение. Пустой проект — валидный результат, не ошибка.

| id | Что находит | Норма |
|---|---|---|
| `PDN.FORM.NO_CONSENT` | Форма с именем, email или телефоном без чекбокса согласия | 152-ФЗ ст. 9 |
| `PDN.FORM.PRECHECKED_CONSENT` | Предзаполненный чекбокс согласия | 152-ФЗ ст. 9 |
| `PDN.FORM.NO_POLICY_LINK` | Согласие без ссылки на политику | 152-ФЗ ст. 9 |
| `PDN.POLICY.NO_LINK` | В проекте нет ссылки на политику обработки ПДн | 152-ФЗ ст. 18.1 |
| `PDN.POLICY.INCOMPLETE` | Политика без оператора, целей, сроков или порядка отзыва | 152-ФЗ ст. 18.1 |
| `PDN.TRACKER.NO_CONSENT` | Яндекс.Метрика, gtag, GA, Meta Pixel, VK.Retargeting без проверки согласия | 152-ФЗ ст. 6 |
| `PDN.COOKIE.NO_REJECT` | Cookie-баннер без возможности отказа | 152-ФЗ ст. 9 |
| `PDN.TRANSFER.FOREIGN_TRACKER` | Иностранный трекер / возможная трансграничная передача | 152-ФЗ ст. 6 |
| `PDN.LOCALIZATION.UNCLEAR` | Форма с ПДн и иностранный трекер без указания локализации баз в РФ (`low`) | 152-ФЗ ст. 18 |
| `PDN.ORG.RKN_NOTICE` | Форма с ПДн без следов уведомления РКН (`low`) | 152-ФЗ ст. 22 |
| `ADV.ERID.MISSING` | Пометка «Реклама» без erid | 38-ФЗ ст. 5 |
| `CONSUMER.OFFER.MISSING` | Витрина без оферты | ЗоЗПП ст. 8 |
| `CONSUMER.REQUISITES.MISSING` | Витрина без ИНН/ОГРН | ЗоЗПП ст. 7 |
| `CONSUMER.RETURN.MISSING` | Витрина без условий возврата | ЗоЗПП ст. 18 |

### Полный чек-лист

Помимо автопоиска агент знает весь каталог и по `explain_rule` разбирает каждый пункт: зачем правило, какая статья, что сделать.

**Формы и согласие** — `PDN.FORM.NO_CONSENT`, предзаполненный чекбокс (`PDN.FORM.PRECHECKED_CONSENT`), ссылка на политику рядом с согласием (`PDN.FORM.NO_POLICY_LINK`).

**Политика ПДн** — ссылка в проекте (`PDN.POLICY.NO_LINK`), состав документа: оператор, цели, сроки, отзыв (`PDN.POLICY.INCOMPLETE`).

**Метрики и cookie** — трекер без opt-in (`PDN.TRACKER.NO_CONSENT`), cookie до согласия (`PDN.COOKIE.BEFORE_CONSENT`, живой `scan-url`), баннер без отказа (`PDN.COOKIE.NO_REJECT`), иностранный трекер / трансграничная передача (`PDN.TRANSFER.FOREIGN_TRACKER`).

**Организация** — локализация баз в РФ (`PDN.LOCALIZATION.UNCLEAR`) и уведомление Роскомнадзора (`PDN.ORG.RKN_NOTICE`): только если есть форма с ПДн, серьёзность `low`. CMP вроде Cookiebot не считается «метрикой без согласия».

**Реклама** — пометка «Реклама» без идентификатора (`ADV.ERID.MISSING`).

**Витрина** — оферта, реквизиты, возврат (`CONSUMER.*`).

У каждого правила в репозитории есть короткая выдержка статьи. Без выдержки правило в каталог не попадает.

Полный каталог с выдержками закона: [docs/RULES.md](docs/RULES.md). На сайте — [страница правил](https://kiruxich.github.io/legitAgent/rules.html).

Проверить, что сканер вообще что-то находит: клонируйте [legitAgent-demo](https://github.com/kiruxich/legitAgent-demo) (форма без согласия, метрика без opt-in, нет политики) и выполните `npx @legit-agent/cli scan`.

---

## Разработка

```bash
git clone https://github.com/kiruxich/legitAgent.git
cd legitAgent
pnpm install
pnpm test
pnpm build
```

Монорепозиторий pnpm:

- `packages/core` — каталог YAML, выдержки закона, парсеры, детекторы, `scanProject`
- `packages/cli` — команды `legitagent scan`, `scan-url`, `init-policy`, вывод `--json` / `--sarif` / `--lang`
- `packages/live` — Playwright-сканер живой страницы
- `packages/mcp` — stdio-сервер для агентов

Правила: `packages/core/rules/*.yaml`. Выдержки: `packages/core/legal/*.yaml`. Корпус законов: `packages/core/legal/corpus/` (`pnpm fetch-law`). Каталог для людей: `pnpm catalog` → `docs/RULES.md` и `website/rules.html`.

---

## Релиз

Пакеты живут на [npmjs.com/org/legit-agent](https://www.npmjs.com/org/legit-agent), не в GitHub Packages.

Новая версия: одинаковый `version` в `packages/*/package.json` (core, cli, live, mcp), коммит в `main`, тег `vX.Y.Z`, `git push origin vX.Y.Z`. GitHub Actions публикует core → live → cli → mcp и открывает GitHub Release.

---

## Лицензия

[MIT](LICENSE)
