# legitAgent — спецификация v2

Дата: 2026-08-14  
Статус: согласовано — три фазы подряд: исходники, живой сайт, GitHub Action

v1 остаётся в силе: эвристики, не юрзаключение; MCP не пишет патчи; YAML-каталог; React/Next HTML+JSX+TSX; тексты по-русски; MIT; `@legit-agent/*`.

---

## Зачем

В v1 агент **находит** три дыры и **объясняет** остальные. v2 включает автопоиск там, где это честно видно: сначала в исходниках, потом в браузере, потом в CI чужого репозитория.

Три фазы — три поставки. Каждая сама по себе полезна. Не смешивать Playwright в фазу A и не публиковать Action до SARIF в CLI.

---

## Фаза A — детекторы в исходниках

Тот же `scanProject`. Новые искатели подключаются рядом с тремя существующими. Правило становится `active` только вместе с детектором и тестами.

### Включаем в `active`

| id | Где смотреть | Когда находка | Когда молчать |
|---|---|---|---|
| `PDN.FORM.PRECHECKED_CONSENT` | Файл с `<form>` и ПДн-полями | Чекбокс согласия с `defaultChecked` / `checked={true}` / `checked` / `checked="checked"` | Нет формы с ПДн или чекбокс согласия не предзаполнен |
| `PDN.FORM.NO_POLICY_LINK` | Тот же файл, что форма | Есть форма с ПДн **и** чекбокс согласия, но в файле нет `href` на политику (тот же regex, что у `PDN.POLICY.NO_LINK`) | Нет согласия (это уже `NO_CONSENT`) или ссылка на политику в том же файле есть |
| `PDN.POLICY.INCOMPLETE` | Весь проект, как `NO_LINK` | Есть файл-политика, в тексте нет хотя бы одного: `оператор`, `цел`, `срок`, `отзыв` (без учёта регистра) | Файла-политики нет — тогда срабатывает только `NO_LINK`, не `INCOMPLETE` |
| `PDN.TRANSFER.FOREIGN_TRACKER` | Файл | Вызов/URL иностранного трекера: `gtag(`, `ga(`, `fbq(`, `google-analytics`, `googletagmanager`, `facebook.net`, `connect.facebook` | Только `ym(` / Яндекс.Метрика / `VK.Retargeting` — это не трансграничка |
| `PDN.COOKIE.NO_REJECT` | Файл | Похоже на cookie-баннер (`cookie-banner`, `CookieBanner`, `куки`, `cookie consent`) и есть «принять»/`accept`, но нет отказа (`отклон`, `отказ`, `reject`, `decline`) | Баннера в файле не видно |

Файл-политика: путь содержит `privacy`, `personal-data`, `политик`, `pdn`, `confidential` **или** в тексте есть «политик(а/и) обработки / конфиденциальности / персональных».

### Остаются `planned` (только `explain_rule`)

- `PDN.COOKIE.BEFORE_CONSENT` — по исходникам слабо; это фаза B
- `PDN.LOCALIZATION.UNCLEAR` — хостинг, не JSX
- `PDN.ORG.RKN_NOTICE` — оргмера, не код

В YAML у включаемых правил убрать фразу «Автопроверка — в следующей версии» из `fix`. Каталог перегенерировать: `pnpm catalog`.

Тесты: новые фикстуры в `packages/core/tests/fixtures/`, отдельные `*.test.ts` на каждый детектор, плюс `scanProject` на одной «плохой» папке со всеми A-находками и одной «хорошей», где их нет. Обновить `defaultCatalog` active-список.

Не добавлять конфиг проекта, Vue, английский вывод, bump версии npm.

---

## Фаза B — сканер живого сайта (Playwright)

Новый пакет `@legit-agent/live`. `core` **не** зависит от Playwright.

- `scanUrl(url: string, catalog?: Catalog): Promise<ScanResult>` — тот же `ScanResult`, что у исходников
- CLI: `legitagent scan-url <url> [--json]` (в `@legit-agent/cli`, динамический импорт `@legit-agent/live`)
- MCP: инструмент `scan_url` с обязательным `url`
- Без URL / невалидный URL — явная ошибка по-русски, не пустой успех

Браузер: Chromium. Открыть URL, дождаться загрузки. Не кликать «принять».

Находки с живой страницы:

| id | Как |
|---|---|
| `PDN.COOKIE.BEFORE_CONSENT` | После load, до клика по баннеру, в `context.cookies()` есть cookie не из строго необходимого набора (`session`, `csrf`, `i18n`, `theme` и короткие технические). Рекламные/аналитические имена (`_ga`, `_gid`, `_ym_uid`, `_fbp`, `tmr_lvid`) — находка |
| `PDN.COOKIE.NO_REJECT` | В DOM есть баннер/диалог про cookie, кнопка принять есть, кнопки отказа нет |
| `PDN.TRANSFER.FOREIGN_TRACKER` | В логе запросов URL с `google-analytics`, `googletagmanager`, `facebook.net`, `connect.facebook.net` |

Тесты без интернета: локальный `http.createServer` раздаёт HTML-фикстуры; Playwright ходит на `127.0.0.1`. В CI: `pnpm exec playwright install chromium` перед тестами live.

`scan` исходников не вызывает Playwright.

---

## Фаза C — GitHub Action + SARIF

CLI: `legitagent scan [путь] [--json] [--sarif [файл]]`. `--sarif` без пути пишет `legitagent.sarif`. SARIF 2.1.0, один `run`, `results[].ruleId` = id правила, `level` из severity (`high`→`error`, `medium`→`warning`, `low`→`note`), `locations` с файлом и строкой.

Композитное действие `.github/actions/legitagent-scan/action.yml`:

- inputs: `root` (default `.`), `fail-on-high` (default `true`)
- запускает CLI, пишет SARIF, `upload-sarif` если есть `GITHUB_TOKEN`
- ненулевой код при high, если `fail-on-high`

Пример: `examples/github-scan.yml` перевести на это действие. Не сканировать фикстуры этого монорепо в `ci.yml` (ложные срабатывания).

В конце фазы C: версия пакетов `0.2.0`, README/лендинг/каталог про v2, дисклеймер без изменений по смыслу.

---

## Совместимость

- Старый `scan` / `list_rules` / `explain_rule` не ломаются
- Код выхода CLI: `0` нет high, `1` есть high, `2` нет команды
- Фикстуры v1 (bad-form, good-form, metrika, policy) должны по-прежнему проходить свои тесты
