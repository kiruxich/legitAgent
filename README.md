<p align="center"><img src="assets/logo.png" width="280" alt="legitAgent" /></p>

# legitAgent

Проверка исходников сайта на типичные риски [152-ФЗ](https://pravo.gov.ru/) — в Cursor, Claude, Kimi и любом другом MCP-клиенте, либо в терминале.

Сканер читает `.html`, `.jsx` и `.tsx` (React / Next.js) и ищет грубые дыры по персональным данным: форма без согласия, метрика без opt-in, нет ссылки на политику. Остальные пункты чек-листа агент умеет **объяснить**, даже если ещё не умеет найти их в коде.

**Это эвристическая проверка кода, а не юридическое заключение.** legitAgent не заменяет юриста и не гарантирует соответствие закону. Решение о том, нарушаете вы требования или нет, принимает человек.

Пакеты: [`@legit-agent/core`](https://www.npmjs.com/package/@legit-agent/core) · [`@legit-agent/cli`](https://www.npmjs.com/package/@legit-agent/cli) · [`@legit-agent/mcp`](https://www.npmjs.com/package/@legit-agent/mcp)  
Репозиторий: [github.com/kiruxich/legitAgent](https://github.com/kiruxich/legitAgent)

---

## Что умеет

Один движок (`@legit-agent/core`), две оболочки: MCP и CLI.

| Возможность | MCP | CLI |
|---|---|---|
| Просканировать проект | инструмент `scan` | `npx @legit-agent/cli scan [путь]` |
| Каталог всех правил, включая ещё не реализованные | `list_rules` | нет (смотрите YAML / спросите агента) |
| Объяснить правило: статья, цитата, как чинить | `explain_rule` | нет |
| JSON для скриптов и CI | ответ `scan` | `--json` |
| Код выхода `1` при находке `high` | — | да |

MCP **не пишет патчи**. Агент (Cursor, Claude, Kimi) сам предлагает правку, получив список находок.

### Что ищет сканер сейчас (`active`)

Сканируются только `.html` / `.jsx` / `.tsx`. Игнорируются `node_modules`, `.next`, `dist`, `build`, `coverage`, `.git`. Сломанный синтаксис не роняет скан: файл пропускается с предупреждением. Пустой проект — не ошибка.

| id | Суть | Статья |
|---|---|---|
| `PDN.FORM.NO_CONSENT` | Форма с именем / email / телефоном без чекбокса согласия | 152-ФЗ ст. 9 |
| `PDN.TRACKER.NO_CONSENT` | `ym` / `gtag` / `ga` / `fbq` / `VK.Retargeting` вызываются сразу, без проверки согласия | 152-ФЗ ст. 6 |
| `PDN.POLICY.NO_LINK` | В проекте нет ссылки на политику (`privacy`, `политик`, `/pdn` и похожие) | 152-ФЗ ст. 18.1 |

### Что есть в каталоге, но ещё не ищется в коде (`planned`)

Эти правила видны в `list_rules` и `explain_rule`. Автодетектор появится позже (часть — только с живым браузером).

| id | Суть |
|---|---|
| `PDN.FORM.PRECHECKED_CONSENT` | Чекбокс согласия предзаполнен (`checked` / `defaultChecked`) |
| `PDN.FORM.NO_POLICY_LINK` | Рядом с согласием нет ссылки на политику |
| `PDN.POLICY.INCOMPLETE` | В тексте политики нет оператора, целей, сроков, отзыва |
| `PDN.COOKIE.BEFORE_CONSENT` | Аналитические cookie до opt-in (нужен живой сайт) |
| `PDN.COOKIE.NO_REJECT` | В баннере нет отказа, только «Принять» |
| `PDN.TRANSFER.FOREIGN_TRACKER` | Иностранный трекер / трансграничная передача |
| `PDN.LOCALIZATION.UNCLEAR` | Локализация баз ПДн в РФ (по исходникам обычно не видно) |
| `PDN.ORG.RKN_NOTICE` | Уведомление Роскомнадзора (оргмера, не код) |

### Чего нет и не будет в этой версии

Живой обход сайта (Playwright), GitHub Action-сканер в PR, Vue/Svelte, полный корпус законов, генерация текста политики, конфиг-файл проекта. Список отложенного: [бэклог](docs/superpowers/specs/2026-08-13-legitagent-backlog.md).

---

## MCP: общий фрагмент

Сервер — stdio, без ключей и без своего конфига:

```json
{
  "mcpServers": {
    "legitagent": {
      "command": "npx",
      "args": ["-y", "@legit-agent/mcp"]
    }
  }
}
```

Нужны Node.js 20+ и сеть в первый раз (скачать пакет). Инструменты:

- **`scan`** — необязательный аргумент `root` (путь к проекту; по умолчанию текущая папка). Возвращает `findings`, `warnings`, `scannedFileCount`.
- **`list_rules`** — весь каталог (`active` + `planned`).
- **`explain_rule`** — обязательный `ruleId`, например `PDN.FORM.NO_CONSENT`. В ответе правило, выдержка статьи и дисклеймер.

Если `root` нечитаем, `scan` отвечает: `Укажите корень проекта`.

---

### Cursor

Файл `.cursor/mcp.json` в корне проекта (или глобальные MCP-настройки Cursor). Вставьте фрагмент выше, перезапустите MCP / окно агента.

Примеры запросов агенту: «проверь этот репозиторий на 152-ФЗ», «покажи все правила», «объясни PDN.TRACKER.NO_CONSENT».

### Claude (Claude Code и Claude Desktop)

Claude Code — в корне проверяемого проекта файл `.mcp.json` с тем же фрагментом, либо:

```bash
claude mcp add --transport stdio legitagent -- npx -y @legit-agent/mcp
```

Claude Desktop (macOS) — `~/Library/Application Support/Claude/claude_desktop_config.json`, тот же объект `mcpServers`. После правки перезапустите Claude.

### Kimi (Kimi Code и Kimi CLI)

Kimi Code: пользовательский `~/.kimi-code/mcp.json` или проектный `.kimi-code/mcp.json` — тот же фрагмент `mcpServers`.

Kimi CLI:

```bash
kimi mcp add --transport stdio legitagent -- npx -y @legit-agent/mcp
```

Либо положите JSON в `~/.kimi/mcp.json`.

### Другие клиенты (Windsurf, Cline, Continue, Copilot, …)

Почти везде тот же ключ `mcpServers` и команда `npx -y @legit-agent/mcp`. Если клиент просит `type` / `transport`, укажите `stdio`.

---

## CLI

```bash
npx @legit-agent/cli scan
npx @legit-agent/cli scan ./my-site
npx @legit-agent/cli scan ./my-site --json
```

Человеческий вывод — по-русски: файл, строка, сообщение, как исправить, цитата нормы, дисклеймер.

Коды выхода:

| Код | Когда |
|---|---|
| `0` | Нет находок `high` (в том числе пустой проект) |
| `1` | Есть хотя бы одна находка с `severity: high` |
| `2` | Нет команды `scan` |

Для CI: `npx @legit-agent/cli scan --json`; ненулевой код можно использовать как fail-on-high.

---

## Разработка из исходников

```bash
git clone https://github.com/kiruxich/legitAgent.git
cd legitAgent
pnpm install
pnpm test
pnpm build
```

Монорепозиторий pnpm: `packages/core` (каталог YAML + детекторы + `scanProject`), `packages/cli`, `packages/mcp`. Правила — `packages/core/rules/*.yaml`, выдержки статей — `packages/core/legal/*.yaml`. У каждого правила обязателен `excerptRef`.

Спецификация v1: [docs/superpowers/specs/2026-08-13-legitagent-design.md](docs/superpowers/specs/2026-08-13-legitagent-design.md).

---

## Как выпустить новую версию

Пуш в `main` **сам ничего не публикует**: ни npm, ни GitHub Releases. Сайдбар GitHub «Packages» — это GitHub Packages (`npm.pkg.github.com`), не [npmjs.com](https://www.npmjs.com/org/legit-agent). Мы публикуем на npmjs, поэтому этот блок на GitHub намеренно пустой.

Релиз:

1. Поднять `version` в `packages/core`, `packages/cli`, `packages/mcp` (одинаково).
2. Закоммитить в `main`.
3. Поставить тег и запушить его:

```bash
git tag v0.1.1
git push origin v0.1.1
```

4. Workflow [`.github/workflows/publish.yml`](.github/workflows/publish.yml) прогонит тесты и выложит три пакета на npm через Trusted Publisher (OIDC, без `NPM_TOKEN`). На теге также создаётся GitHub Release.

Уже опубликованную версию (сейчас `0.1.0`) повторно выкладывать нельзя.

---

## Лицензия

[MIT](LICENSE)
