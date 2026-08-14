# legitAgent — v7

Дата: 2026-08-14  
Статус: к реализации (v0.7.0).

v1–v6 остаются в силе: эвристики, не юрзаключение; MCP не пишет патчи в репозиторий клиента (агент чинит по скиллу); YAML-каталог; MIT; `@legit-agent/*`; облака и платного тарифа нет.

## Цель

Три пункта:

1. **Always-on в Cursor.** User MCP уже есть. Добавляются user rule и скиллы: перед коммитом формы / метрики / cookie-баннера агент вызывает `scan`, при `confirm` чинит, пересканирует.
2. **Доказательная пачка.** `scan-url` пишет скрин баннера, имена cookie до и после отказа, цитату статьи, timestamp, JSON, SARIF и PDF. После деплоя — issue и опционально Telegram, если сломали согласие.
3. **Второй проход моделью (вариант B).** Кандидаты эвристик → `confirm` / `reject` / `ask_human`. CI остаётся детерминированным (без LLM). В PDF и SARIF пачки попадают только `confirm` и `ask_human`.

## Второй проход

Новый модуль `@legit-agent/core`: `reviewFindings`.

- Вход: `Finding[]` и сниппеты файла (строка находки ± 15 строк, либо весь HTML живой страницы обрезанный до 8_000 символов).
- Выход: `ReviewedFinding[]` (`Finding` + `verdict` + `reason`).
- `forEvidencePack(reviewed)` — отбрасывает `verdict === 'reject'`.
- LLM: опциональный `LlmComplete`. Если не передан — `createLlmComplete()` из env:
  - `LEGITAGENT_LLM_API_KEY` (обязателен для сети)
  - `LEGITAGENT_LLM_BASE_URL` по умолчанию `https://api.openai.com/v1`
  - `LEGITAGENT_LLM_MODEL` по умолчанию `gpt-4o-mini`
- Нет ключа / нет `complete`: fallback без сети. `SOFT_RULE_IDS` → `ask_human`, остальные → `confirm`. Причина: `нет LLM, эвристика`.
- `SOFT_RULE_IDS`: `PDN.ORG.RKN_NOTICE`, `PDN.LOCALIZATION.UNCLEAR`, `PDN.POLICY.INCOMPLETE`, `PDN.POLICY.NO_LINK`, `CONSUMER.OFFER.MISSING`, `CONSUMER.REQUISITES.MISSING`, `CONSUMER.RETURN.MISSING`.
- Промпт модели: вернуть JSON-массив `{ ruleId, file, verdict, reason }`. Если по сниппету нельзя доказать нарушение — `ask_human`. Не выдумывать факты. Некорректный JSON или пропуск пункта → `ask_human`.
- `scan` / GitHub Action source-scan **не** вызывают review. `fail-on-high` считает сырые эвристики.

## Доказательная пачка

`scanUrl(url, { evidenceDir? })` в `@legit-agent/live`.

Поля `LiveScanResult` (расширяет `ScanResult`):

- `capturedAt` — ISO-8601 UTC
- `cookiesBefore` / `cookiesAfterReject` — только `{ name }`, без значений
- `screenshots` — `{ id, file }` относительные имена файлов в `evidenceDir`
- `evidenceDir` если задан

Скриншоты: `page.png` (вся страница после гидрации), `banner.png` (если найден баннер по текущим селекторам cookie-control). Cookie до отказа снимаются после гидрации, после клика «отказ» — повторно.

`writeEvidencePack({ dir, live, reviewed, disclaimer })`:

- `evidence.json` — url, timestamp, cookies, screenshots, reviewed (без `reject`), дисклеймер
- `evidence.sarif` — SARIF 2.1.0 только по `forEvidencePack`
- `evidence.pdf` — Playwright `page.pdf()` из HTML: timestamp, url, таблица находок (правило, вердикт, цитата, файл), встроенные скрины, дисклеймер. Это не юридическое заключение.

CLI: `legitagent scan-url <url> [--json] [--review] [--evidence [dir]] [--notify-telegram]`

- `--evidence` без пути → `legitagent-evidence/`
- `--review` вызывает `reviewFindings` (LLM или fallback)
- `--notify-telegram` шлёт в Telegram, если заданы `LEGITAGENT_TELEGRAM_BOT_TOKEN` и `LEGITAGENT_TELEGRAM_CHAT_ID`. Текст: url, timestamp, число confirm/ask_human, high. Если есть PDF — `sendDocument`, иначе `sendMessage`. Нет токена при флаге → код выхода `2`.

MCP:

- `review` — `root?`, `lang?`. Сканирует проект, ревьюит, возвращает `reviewed` (все три вердикта).
- `scan_url` — опционально `evidenceDir`. Возвращает live-результат; если dir задан — пишет скрины. Review пачки делает CLI/`--review`, MCP `scan_url` сам review не включает (чат вызывает `review` по findings или агент следует скиллу).

Для пачки из MCP: скилл `/scan-url` после `scan_url` вызывает `review` по тем же findings, если инструмент `review` доступен, и не показывает `reject` как нарушение.

Мониторинг: `examples/github-watch.yml` + опциональные входы композитного action `url` и `evidence-dir`. Если `url` задан — `scan-url --review --evidence` вместо `scan`. Issue при high среди **сырых** findings live-скана (детерминизм CI). Telegram — если secrets `LEGITAGENT_TELEGRAM_BOT_TOKEN` / `LEGITAGENT_TELEGRAM_CHAT_ID` переданы в env шага. Source-scan без url как в v6.

## Cursor always-on

Текст user rule (и `docs/cursor-user-rule.md`):

Перед коммитом или сдачей изменений в HTML/JSX/TSX/Vue/Svelte/Astro, если затронуты форма с ПДн, метрика/трекер или cookie-баннер: вызови MCP `scan` сервера legitagent, затем `review`. Находки с `verdict: confirm` исправь по полю `fix`, затем снова `scan` + `review`. Не коммить, пока есть `confirm` с `severity: high`, если пользователь явно не принял риск. `reject` не чини. `ask_human` покажи человеку. Это эвристика, не юридическое заключение.

Скилл `/check` дополняется циклом scan → review → fix confirm → rescan. Новый скилл `/fix` — то же. `/scan-url` — live + не показывать reject.

После реализации правило добавляется в Cursor User rules (если ещё нет дубликата).

## Документация и релиз

README, лендинг, plugin `0.7.0`, пакеты `0.7.0`, MCP server version `0.7.0`, Action pin `cli@0.7.0`, example `@v0.7.0`. Дисклеймер без изменения смысла.

## Вне скоупа

Хост Playwright, кабинет, paywall, замена детекторов моделью, отправка значений cookie, вызов LLM из CI source-scan.
