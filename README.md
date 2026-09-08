![legitAgent](assets/logo.png)

![CI](https://github.com/kiruxich/legitAgent/actions/workflows/ci.yml/badge.svg)![npm](https://img.shields.io/npm/v/@legit-agent/cli?label=@legit-agent/cli)![MIT](https://img.shields.io/badge/license-MIT-green)

# legitAgent

Проверка сайта на типичные риски **152-ФЗ**, **38-ФЗ** и **ЗоЗПП** прямо в Cursor, Claude, Kimi и в терминале.

Сайт: [kiruxich.github.io/legitAgent](https://kiruxich.github.io/legitAgent/). Каталог правил: [docs/RULES.md](docs/RULES.md). Сломанный пример: [legitAgent-demo](https://github.com/kiruxich/legitAgent-demo).

Подключите MCP — агент локально просканирует HTML/JS/TS/JSX/TSX/Vue/Svelte/Astro, покажет находки со статьёй закона, confidence, evidence и подскажет, как исправить. В Cursor после установки плагина те же действия доступны через `/check`, `/scan`, `/scan-url`. Либо одна команда в CI, GitHub Action с выгрузкой SARIF, либо `scan-url` для живой страницы: тот же каталог по DOM плюс cookie/storage/network до и после Reject и Accept.

```bash
npx @legit-agent/cli scan
```

**Это эвристическая проверка кода, а не юридическое заключение.** legitAgent не заменяет юриста и не гарантирует соответствие закону. Решение принимает человек.

---

🛡 **Нужен Enterprise-аудит?** Разрабатываем кастомные высоконагруженные системы и проводим юридический и технический аудит кода. Получите бесплатный отчет по нагрузке и соответствию 152-ФЗ для вашей инфраструктуры: Свяжитесь со мной в Telegram: [@kirillsklemin](https://t.me/kirillsklemin)

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


| Клиент                                 | Куда вставить                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cursor**                             | **User** (все проекты): `~/.cursor/mcp.json` — туда же пишет [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=legitagent&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcHJlZmVyLW9ubGluZSIsIkBsZWdpdC1hZ2VudC9tY3BAbGF0ZXN0Il19). **Проект** (только этот репозиторий): `.cursor/mcp.json`. Скиллы `/check` … — Marketplace или `~/.cursor/plugins/local` |
| **Claude Code**                        | `claude mcp add --transport stdio legitagent -- npx -y --prefer-online @legit-agent/mcp@latest`                                                                                                                                                                                                                                                                                   |
| **Claude Desktop**                     | тот же JSON в `claude_desktop_config.json`. Инструменты: `scan`, `review`, `autofix`, `create_baseline`, `scan_url`, `list_rules`, `explain_rule`, `generate_policy`, `get_law`. Слэша `/check` нет — пишете «проверь проект».                                                                                                                                                                                  |
| **Kimi Code**                          | `~/.kimi-code/mcp.json` или `.kimi-code/mcp.json`                                                                                                                                                                                                                                                                                                                                 |
| **Kimi CLI**                           | `kimi mcp add --transport stdio legitagent -- npx -y --prefer-online @legit-agent/mcp@latest` или `~/.kimi/mcp.json`                                                                                                                                                                                                                                                              |
| **Windsurf, Cline, Continue, Copilot** | тот же `mcpServers`; если спрашивают транспорт — `stdio`                                                                                                                                                                                                                                                                                                                          |


После подключения: «проверь этот репозиторий на 152-ФЗ», «покажи каталог правил», «объясни PDN.FORM.NO_CONSENT».

В Cursor те же действия вызываются через `/` (скиллы плагина, карточка при наведении берётся из `description`). Локально: `~/.cursor/plugins/local/legitagent`. В каталоге у всех — после публикации на Marketplace. В ChatGPT и Kimi слэша Cursor нет: там работают MCP-инструменты, не `/check`.


| Команда                             | MCP                                                |
| ----------------------------------- | -------------------------------------------------- |
| `/check`                            | `scan` + локальный offline-review; LLM только при явной настройке |
| `/fix`                              | `scan` + `review`, preview safe-рецептов, запись только по явному подтверждению, перескан |
| `/scan`                             | `scan`                                             |
| `/scan-url https://example.com`     | `scan_url`                                         |
| `/list-rules`                       | `list_rules`                                       |
| `/explain-rule PDN.FORM.NO_CONSENT` | `explain_rule`                                     |
| `/generate-policy ООО Пример`       | `generate_policy`                                  |
| `/get-law 152-fz 9`                 | `get_law`                                          |


Slash-команда не заменяет MCP: она говорит агенту вызвать инструмент. Без включённого сервера `legitagent` скана не будет.

### CLI

```bash
npx @legit-agent/cli scan
npx @legit-agent/cli scan ./my-site
npx @legit-agent/cli scan ./my-site --json
npx @legit-agent/cli scan ./my-site --sarif
npx @legit-agent/cli scan ./my-site --sarif findings.sarif
npx @legit-agent/cli scan ./my-site --lang en
npx @legit-agent/cli scan ./my-site --review --json
npx @legit-agent/cli scan ./my-site --changed-files src/Form.tsx,src/Cookie.tsx
npx @legit-agent/cli scan ./my-site --write-baseline
npx @legit-agent/cli scan ./my-site --baseline .legitagent-baseline.json
npx @legit-agent/cli scan ./my-site --fail-on-confidence medium
npx @legit-agent/cli scan ./my-site --cache
npx @legit-agent/cli fix ./my-site --json
npx @legit-agent/cli fix ./my-site --write
npx @legit-agent/cli scan-url https://example.com --json
npx @legit-agent/cli scan-url https://example.com --review --evidence legitagent-evidence
npx @legit-agent/cli scan-url https://example.com --review --evidence --notify-telegram
npx @legit-agent/cli scan-url https://example.com --sarif legitagent.sarif
npx @legit-agent/cli init-policy --operator "ООО Ромашка" --inn 123 --email privacy@site.ru --out privacy.md
```

`--review` добавляет второй проход. По умолчанию он **не вызывает LLM и не отправляет данные в сеть**: обычные находки получают `not_reviewed`, а неоднозначные проверки — `ask_human`. Код выхода и SARIF считаются по детерминированным findings, поэтому результат CI не зависит от LLM.

`scan-url --evidence [dir]` пишет evidence pack: скриншоты баннера, раздельные состояния до/после Reject и Accept, метаданные cookie без значений, имена ключей local/session storage, network resource type и инициатор без query string, `evidence.json`, `evidence.sarif`, `evidence.pdf`. **Скриншоты могут визуально содержать персональные, секретные или иные чувствительные данные** — храните и передавайте evidence pack с соответствующими ограничениями доступа и не публикуйте его без проверки. В пачку попадают все находки, кроме отклонённых LLM (`reject`). Локальные/private URL по умолчанию запрещены; для доверенной внутренней цели нужен явный `--allow-private-network`.

Telegram (опционально): `LEGITAGENT_TELEGRAM_BOT_TOKEN`, `LEGITAGENT_TELEGRAM_CHAT_ID` + флаг `--notify-telegram`. Без credentials — код выхода `2`.

#### Review, OpenRouter и приватность

У legitAgent нет собственного облака. Source scan, live scan, baseline, suppressions, SARIF и evidence pack выполняются на машине пользователя или runner-е CI. LLM необязателен:

| Режим | Настройка | Куда уходят данные |
| --- | --- | --- |
| `offline` | режим по умолчанию | Никуда; LLM не вызывается |
| `local` | `LEGITAGENT_REVIEW_MODE=local`, `LEGITAGENT_LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1`, `LEGITAGENT_LLM_MODEL=...` | На loopback endpoint с `/chat/completions`; удалённый host отклоняется |
| `openrouter` | `LEGITAGENT_REVIEW_MODE=openrouter`, `LEGITAGENT_OPENROUTER_API_KEY=...` | В OpenRouter и к выбранному им/model-провайдеру |

Для OpenRouter модель по умолчанию — `openrouter/auto`; её можно зафиксировать через `LEGITAGENT_LLM_MODEL`. Если ключ `LEGITAGENT_OPENROUTER_API_KEY` задан, а режим не указан, выбирается `openrouter`; иначе — `offline`. Старое имя `LEGITAGENT_LLM_API_KEY` временно поддерживается как alias ключа OpenRouter.

OpenRouter review использует строгий JSON Schema, batches, timeout/retry и process-local cache по fingerprint+snippet. Защитные лимиты: `LEGITAGENT_LLM_BATCH_SIZE` (10), `LEGITAGENT_LLM_MAX_FINDINGS` (100), `LEGITAGENT_LLM_MAX_PROMPT_CHARS` (48000), `LEGITAGENT_LLM_MAX_OUTPUT_TOKENS` (2000), `LEGITAGENT_LLM_MAX_COST_USD` (0.25), `LEGITAGENT_LLM_TIMEOUT_MS` (30000), `LEGITAGENT_LLM_RETRIES` (1). `LEGITAGENT_LLM_MAX_COST_USD` — это post-response budget для batch review: после достижения суммарного `usage.cost` новые batches не отправляются, но последний уже отправленный batch может превысить порог. Это не hard provider spend cap. Ответ показывает фактически выбранную модель в `reviewModel`.

По умолчанию запрос просит маршрутизатор OpenRouter выбирать провайдера с Zero Data Retention и запрещённым provider data collection; это preference маршрутизации, а не абсолютная гарантия хранения. Ограничить маршрутизацию можно через `LEGITAGENT_OPENROUTER_ONLY_PROVIDERS`, исключить провайдеров — через `LEGITAGENT_OPENROUTER_IGNORE_PROVIDERS`; списки разделяются запятыми. Ценовые ограничения провайдера задаются `LEGITAGENT_OPENROUTER_MAX_PROMPT_PRICE` и `LEGITAGENT_OPENROUTER_MAX_COMPLETION_PRICE`. Отключение ZDR требует явного `LEGITAGENT_OPENROUTER_ZDR=false`.

При `openrouter` отправляются только поля находок, выдержки норм и связанные фрагменты исходников — не весь репозиторий. Очевидные значения `key`/`token`/`secret`/`password`/`authorization` маскируются, фрагменты ограничиваются по размеру. Это best-effort защита: перед включением внешнего review проверьте политику обработки данных OpenRouter и выбранного model-провайдера.

User rule для Cursor always-on: скопируйте текст из `[docs/cursor-user-rule.md](docs/cursor-user-rule.md)` в User rules.

### Конфиг

В корне проекта можно положить `legitagent.config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/kiruxich/legitAgent/main/packages/core/config.schema.json",
  "ignore": ["**/vendor/**"],
  "disabled": ["PDN.COOKIE.NO_REJECT"],
  "severity": { "PDN.TRANSFER.FOREIGN_TRACKER": "low" },
  "baseline": ".legitagent-baseline.json",
  "cache": true,
  "suppress": [
    {
      "ruleId": "PDN.COOKIE.NO_REJECT",
      "file": "src/legacy/**",
      "reason": "Принято владельцем риска до миграции CMP",
      "expires": "2026-12-31"
    }
  ]
}
```

Подавление требует причину и может быть ограничено rule/file/fingerprint и сроком. Для точечного исключения рядом с кодом: `legitagent-ignore-next-line RULE_ID -- причина`. Создать baseline текущих находок: `--write-baseline`; в последующих запусках передать `--baseline` или указать файл в конфиге. Baseline и suppressions не удаляют находки из модели данных — они переходят в `suppressedFindings` вместе с источником и причиной подавления.

Нет файла — используются безопасные значения по умолчанию. Невалидный JSON: код выхода `2`.

`cache: true` сохраняет только hash, диапазоны строк и структурные сигналы в `.legitagent/cache-v1.json`; фрагменты исходного кода в cache не записываются. Cache можно включить CLI-флагом `--cache` или задать путь через `--cache-file`. Неизвестные поля конфига попадают в warnings; JSON Schema поставляется с `@legit-agent/core`.

`legitagent fix` всегда работает как dry-run. Только `--write` применяет allowlist безопасных механических рецептов ко всем соответствующим находкам свежего scan; сейчас автоматически снимается статическое prechecked-состояние consent checkbox. Это не LLM-gated patching: перед `--write` проверьте preview. Добавление юридического текста, URL политики и consent-flow остаётся manual recipe.

Вывод по-русски по умолчанию; `--lang en` — английские сообщения. Каждая находка содержит стабильный `fingerprint`, диапазон строк, `kind` (`violation`, `risk`, `manual_check`), `confidence`, наблюдаемые сигналы, правовое основание и способ исправления.

`init-policy` печатает **черновик** политики обработки ПДн (не юридический документ). Корпус 152-ФЗ / 38-ФЗ / ЗоЗПП лежит в `packages/core/legal/corpus/`; обновить с pravo.gov.ru: `pnpm fetch-law`.

`--sarif` без пути пишет `legitagent.sarif` (SARIF 2.1.0). `scan-url` открывает страницу в Chromium в изолированных контекстах: ждёт гидрацию SPA, отдельно проверяет состояния до/после Reject и Accept, сравнивает cookie/storage/network и прогоняет тот же каталог правил по HTML страницы. `scan_url` в MCP при `evidenceDir` сохраняет только скриншоты; полный evidence pack (JSON/SARIF/PDF) создаёт CLI.


| Код выхода | Значение                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| `0`        | Нет серьёзных находок (в том числе нечего сканировать)                                                       |
| `1`        | Есть хотя бы одна находка `high` с confidence не ниже `--fail-on-confidence`                                 |
| `2`        | Нет команды / `scan-url` без URL / невалидный `legitagent.config.json` / `--notify-telegram` без credentials |


В CI достаточно `npx @legit-agent/cli@0.8.0 scan --json`: ненулевой код — стоп пайплайна. Source-scan без `--review` не запускает второй проход; даже с `--review` сеть не используется в режиме `offline`. Для code scanning скопируйте `[examples/github-scan.yml](examples/github-scan.yml)` в `.github/workflows/legitagent.yml` — он вызывает композитное действие `[.github/actions/legitagent-scan](.github/actions/legitagent-scan/action.yml)` с пином `@v0.8.0`: пишет SARIF, загружает его в GitHub, поддерживает baseline/changed-files/confidence threshold, комментирует PR и создаёт issue при новых находках `high`. Для мониторинга живого сайта после деплоя — `[examples/github-watch.yml](examples/github-watch.yml)` (`scan-url --review --evidence`, опционально Telegram и OpenRouter).

---



## Возможности

Один движок `[@legit-agent/core](https://www.npmjs.com/package/@legit-agent/core)`, живой сканер `[@legit-agent/live](https://www.npmjs.com/package/@legit-agent/live)`, оболочки `[@legit-agent/mcp](https://www.npmjs.com/package/@legit-agent/mcp)` и `[@legit-agent/cli](https://www.npmjs.com/package/@legit-agent/cli)`.

### Инструменты MCP


| Инструмент        | Что делает                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scan`            | Сканирует проект. Необязательные `root` и `lang` (`ru` / `en`).                                                                                                             |
| `review`          | Второй проход по findings. Offline по умолчанию; локальная LLM или OpenRouter включаются только пользовательской env-настройкой (для OpenRouter достаточно ключа, если режим не переопределён). Необязательные `root` и `lang`. |
| `create_baseline` | Создаёт baseline текущих fingerprints внутри `root`. Операция записи. |
| `autofix`         | Возвращает safe/manual fix-рецепты; dry-run по умолчанию, запись только при `write: true`. |
| `scan_url`        | Проверяет живой URL: cookie, баннер, формы, политика, ERID, витрина, иностранные трекеры; ждёт гидрацию SPA и отдельно проверяет Reject/Accept внутри баннера. Опционально `evidenceDir`; private network запрещена по умолчанию. |
| `list_rules`      | Полный каталог правил.                                                                                                                                                      |
| `explain_rule`    | Правило, выдержка статьи, как исправить, дисклеймер. Нужен `ruleId`.                                                                                                        |
| `generate_policy` | Черновик политики обработки ПДн. Нужен `operator`. Не юридическое заключение.                                                                                               |
| `get_law`         | Текст из корпуса (`152-fz`, `38-fz`, `zozpp`), опционально номер статьи.                                                                                                    |


`scan` и `review` принимают `changedFiles`, `baseline`, `cache` и `minimumConfidence`; ответ содержит единый confidence gate. При changed-files весь проект остаётся контекстом для project-wide правил, но локальные findings фильтруются по изменённым файлам. `autofix` принимает отдельный `write` и по умолчанию ничего не меняет.

Ответ `scan`: `findings`, `suppressedFindings`, `warnings`, `scannedFileCount`. У находки есть fingerprint, файл и диапазон строк, severity, confidence, kind, evidence, legalBasis, сообщение и фикс. Если путь нечитаем: `Укажите корень проекта`.

### Что проверяется в коде

Сканер читает `.html`, `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.vue`, `.svelte`, `.astro`. Пропускает `node_modules`, `.next`, `dist`, `build`, `coverage`, `.git`. Для JS/TS анализируется путь от consent-condition/event handler до функции запуска tracker. Синтаксически сломанный файл не роняет проверку — он уходит в предупреждение.


| id                             | Что находит                                                                | Норма           |
| ------------------------------ | -------------------------------------------------------------------------- | --------------- |
| `PDN.FORM.NO_CONSENT`          | Форма с именем, email или телефоном без чекбокса согласия                  | 152-ФЗ ст. 9    |
| `PDN.FORM.PRECHECKED_CONSENT`  | Предзаполненный чекбокс согласия                                           | 152-ФЗ ст. 9    |
| `PDN.FORM.NO_POLICY_LINK`      | Согласие без ссылки на политику                                            | 152-ФЗ ст. 9    |
| `PDN.POLICY.NO_LINK`           | В проекте нет ссылки на политику обработки ПДн                             | 152-ФЗ ст. 18.1 |
| `PDN.POLICY.INCOMPLETE`        | Политика без оператора, целей, сроков или порядка отзыва                   | 152-ФЗ ст. 18.1 |
| `PDN.TRACKER.NO_CONSENT`       | Яндекс.Метрика, gtag, GA, Meta Pixel, VK.Retargeting без проверки согласия | 152-ФЗ ст. 6    |
| `PDN.COOKIE.NO_REJECT`         | Cookie-баннер без возможности отказа                                       | 152-ФЗ ст. 9    |
| `PDN.TRANSFER.FOREIGN_TRACKER` | Иностранный трекер / возможная трансграничная передача                     | 152-ФЗ ст. 12   |
| `PDN.LOCALIZATION.UNCLEAR`     | Форма с ПДн и иностранный трекер без указания локализации баз в РФ (`low`) | 152-ФЗ ст. 18   |
| `PDN.ORG.RKN_NOTICE`           | Форма с ПДн без следов уведомления РКН (`low`)                             | 152-ФЗ ст. 22   |
| `ADV.ERID.MISSING`             | Пометка «Реклама» без erid                                                 | 38-ФЗ ст. 18.1  |
| `CONSUMER.OFFER.MISSING`       | Витрина без доступных условий дистанционной продажи                        | ЗоЗПП ст. 26.1  |
| `CONSUMER.REQUISITES.MISSING`  | Витрина без реквизитов продавца                                            | ЗоЗПП ст. 9     |
| `CONSUMER.RETURN.MISSING`      | Витрина без условий возврата                                               | ЗоЗПП ст. 26.1  |




### Полный чек-лист

Помимо автопоиска агент знает весь каталог и по `explain_rule` разбирает каждый пункт: зачем правило, какая статья, что сделать.

**Формы и согласие** — `PDN.FORM.NO_CONSENT`, предзаполненный чекбокс (`PDN.FORM.PRECHECKED_CONSENT`), ссылка на политику рядом с согласием (`PDN.FORM.NO_POLICY_LINK`).

**Политика ПДн** — ссылка в проекте (`PDN.POLICY.NO_LINK`), состав документа: оператор, цели, сроки, отзыв (`PDN.POLICY.INCOMPLETE`).

**Метрики и cookie** — трекер без opt-in (`PDN.TRACKER.NO_CONSENT`), cookie до согласия (`PDN.COOKIE.BEFORE_CONSENT`, живой `scan-url`), баннер без отказа (`PDN.COOKIE.NO_REJECT`), иностранный трекер / трансграничная передача (`PDN.TRANSFER.FOREIGN_TRACKER`).

**Организация** — локализация баз в РФ (`PDN.LOCALIZATION.UNCLEAR`) и уведомление Роскомнадзора (`PDN.ORG.RKN_NOTICE`): только если есть форма с ПДн, серьёзность `low`. CMP вроде Cookiebot не считается «метрикой без согласия».

**Реклама** — пометка «Реклама» без идентификатора (`ADV.ERID.MISSING`).

**Витрина** — условия дистанционной продажи, реквизиты продавца, возврат (`CONSUMER.`*). Отдельный документ с названием «оферта» не считается безусловно обязательным автоматически — правило просит проверить доступность обязательной информации до заказа.

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
pnpm benchmark
pnpm legal:check
pnpm release:check
```

Монорепозиторий pnpm:

- `packages/core` — каталог YAML, выдержки закона, парсеры, детекторы, `scanProject`
- `packages/cli` — команды `legitagent scan`, `scan-url`, `init-policy`, вывод `--json` / `--sarif` / `--lang`
- `packages/live` — Playwright-сканер живой страницы
- `packages/mcp` — stdio-сервер для агентов

Правила: `packages/core/rules/*.yaml`. Выдержки: `packages/core/legal/*.yaml`. Корпус законов: `packages/core/legal/corpus/` (`pnpm fetch-law`). Каталог для людей: `pnpm catalog` → `docs/RULES.md` и `website/rules.html`.

`pnpm benchmark` берёт 20 synthetic regression seed-кейсов, разворачивает их в 100 семантически эквивалентных parser-stability сценариев и считает TP/FP/FN/TN, precision/recall по правилам и framework. Форматные мутации не являются 100 независимыми real-world cases: перед v1 корпус всё равно должен быть дополнен анонимизированными примерами с независимой ручной разметкой.

`pnpm legal:check` проверяет integrity hash локальных snapshot-ов и свежесть `verifiedAt`. Еженедельный workflow `legal-drift.yml` сравнивает snapshot с источником; изменение закона блокирует задачу до ручной ревизии и обновления hash.

---



## Релиз

Пакеты живут на [npmjs.com/org/legit-agent](https://www.npmjs.com/org/legit-agent), не в GitHub Packages.

Новая версия: одинаковый `version` в `packages/*/package.json` (core, cli, live, mcp), `pnpm release:check`, коммит в `main`, тег `vX.Y.Z`, `git push origin vX.Y.Z`. Workflow использует commit-SHA pins для сторонних Actions, npm Trusted Publishing с provenance, генерирует SPDX SBOM, создаёт build attestation и прикладывает tarballs/SBOM к GitHub Release.

Для `v1.0.0` release-check дополнительно требует минимум `100` entries с `provenance: "independent-real-world"` в `benchmarks/corpus.json`. Synthetic seeds и их пять мутаций в этот gate не засчитываются; пока корпус не дополнен, публикуемая версия остаётся `0.x`.

---



## Лицензия

[MIT](LICENSE)
