# legitAgent — спецификация v3

Дата: 2026-08-14  
Статус: к реализации (v0.3.0). Vue/Svelte/Astro и бэклог «пункт 8» не входят.

v1 и v2 остаются в силе: эвристики, не юрзаключение; MCP не пишет патчи; YAML-каталог; React/Next HTML+JSX+TSX; тексты по-русски; MIT; `@legit-agent/*`.

## Зачем

После v2 сканер находит больше, чем чужой репозиторий готов терпеть без настроек. Живой `scan-url` смотрит страницу один раз и не нажимает «отказ». Action только грузит SARIF. v3 закрывает это, не расширяя стеки файлов.

## Состав релиза 0.3.0

1. `legitagent.config.json` — ignore, отключение правил, подмена severity.
2. Более глубокий `scan-url` — гидрация SPA, клик «отказ», cookie после отказа.
3. GitHub Action — комментарий в PR, Issue при `high`, `fail-on-high` как сейчас.
4. Пример Action и `npx` в action.yml прибиты к тегу/версии `0.3.0`, не к `@main`.

Не входит: Vue/Svelte/Astro, `PDN.LOCALIZATION.UNCLEAR`, `PDN.ORG.RKN_NOTICE`, английский вывод, генератор политик, LLM, свой домен.

## Конфиг

Файл только в корне скана: `legitagent.config.json`. Нет файла — поведение v2. Пустой объект `{}` — то же самое.

```json
{
  "ignore": ["**/vendor/**", "legacy/**"],
  "disabled": ["PDN.COOKIE.NO_REJECT"],
  "severity": {
    "PDN.TRANSFER.FOREIGN_TRACKER": "low"
  }
}
```

Правила:

- `ignore` — дополнительные глобы `fast-glob` поверх встроенных (`node_modules`, `.next`, `dist`, `build`, `coverage`, `.git`). Не заменяют встроенные.
- `disabled` — эти `ruleId` не попадают в `findings`. Несуществующий id → `ScanWarning`, скан продолжается.
- `severity` — подмена `high`/`medium`/`low` на находке после детекта. Неизвестный id или значение не из трёх → warning, ключ пропускается.
- Лишние ключи JSON игнорируются.
- Невалидный JSON → ошибка `ConfigError`, сообщение `Некорректный legitagent.config.json`. CLI код выхода `2`. MCP пробрасывает ошибку.
- Нет allowlist «сканируй только эти правила».
- `scan-url` конфиг проекта не читает (нет корня проекта).

`scanProject` сам читает конфиг из `root`. CLI и MCP не парсят файл отдельно.

## Live scan

`scanUrl(url)` по-прежнему один URL, локальные фикстуры, без интернета.

После `goto`:

1. Дождаться `domcontentloaded`, затем `networkidle` (таймаут 10s, как сейчас, ошибку глотать).
2. Подождать появления cookie-баннера до 3s (`button`/`a`/текст куки). Если нет — всё равно подождать 2s гидрации SPA (`setTimeout` 2000), чтобы отложенные cookie успели записаться.
3. Снять cookie и HTML. `PDN.COOKIE.NO_REJECT` и `PDN.TRANSFER.FOREIGN_TRACKER` — по этому снимку (баннер мог появиться после гидрации).
4. Если есть кнопка отказа (`отклон|отказ|reject|decline`) — кликнуть первую, подождать `networkidle` до 5s (ошибку глотать).
5. Снова снять cookie. `PDN.COOKIE.BEFORE_CONSENT`, если аналитическая cookie есть **после гидрации** или **после клика «отказ»** (отказ не освобождает от находки, если `_ga` осталась или появилась).
6. Кнопку «принять» / `accept` не нажимать.

Старые фикстуры v2 должны по-прежнему ловить те же rule id. Новые:

- cookie через `setTimeout` ~1.8s без баннера → `BEFORE_CONSENT`;
- баннер с «Отклонить», cookie `_ga` ставится только в обработчике отказа → `BEFORE_CONSENT`;
- баннер с отказом, cookie не ставится никогда → нет `BEFORE_CONSENT` и нет `NO_REJECT`.

## GitHub Action

Композитное `.github/actions/legitagent-scan`.

Входы (к существующим `root`, `fail-on-high`):

- `comment-on-pr` — по умолчанию `true`. Если событие `pull_request` — создать или обновить комментарий с маркером `<!-- legitagent-scan -->`.
- `create-issue-on-high` — по умолчанию `true`. Если событие не PR и есть хотя бы один SARIF `level: error` — создать или обновить открытый Issue с заголовком `legitAgent: находки high` и меткой `legitagent`. Нет high — Issue не создавать и не закрывать.

Текст комментария/Issue строится из `legitagent.sarif` скриптом рядом с action (не из npm-пакета, чтобы тег репозитория самодостаточен). Список: ruleId, uri, level. Если находок нет — одна строка, что нарушений не найдено.

Пример `examples/github-scan.yml`:

- `uses: kiruxich/legitAgent/.github/actions/legitagent-scan@v0.3.0`
- permissions: `contents: read`, `security-events: write`, `pull-requests: write`, `issues: write`

В `action.yml` вызов CLI: `npx --yes @legit-agent/cli@0.3.0` (не latest). `fail-on-high` без изменения смысла.

## Документация

README и лендинг: конфиг, более глубокий `scan-url`, комментарий/Issue. Дисклеймер без изменений по смыслу. Версии пакетов и MCP `0.3.0`.

## Успех

- Чужой репозиторий может заглушить правило и папку без форка сканера.
- `scan-url` ловит отложенные cookie и cookie, которые ставят по клику «отказ».
- PR в чужом репо видит комментарий; пуш в default с high открывает Issue.
- `git tag v0.3.0` публикует четыре пакета через существующий `publish.yml`.
