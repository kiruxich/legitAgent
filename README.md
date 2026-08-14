<p align="center"><img src="assets/logo.png" width="280" alt="legitAgent" /></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@legit-agent/cli"><img alt="npm" src="https://img.shields.io/npm/v/@legit-agent/cli?label=@legit-agent/cli" /></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-green" /></a>
</p>

# legitAgent

Проверка сайта на типичные риски **152-ФЗ** прямо в Cursor, Claude, Kimi и в терминале.

Подключите MCP — агент сам просканирует HTML/JSX/TSX, покажет находки со статьёй закона и подскажет, как исправить. Либо одна команда в CI:

```bash
npx @legit-agent/cli scan
```

**Это эвристическая проверка кода, а не юридическое заключение.** legitAgent не заменяет юриста и не гарантирует соответствие закону. Решение принимает человек.

---

## Быстрый старт

Нужен Node.js 20+. Пакеты ставить не обязательно — достаточно `npx`.

### MCP (Cursor, Claude, Kimi и другие)

Один и тот же сервер:

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

| Клиент | Куда вставить |
|---|---|
| **Cursor** | `.cursor/mcp.json` в корне проекта |
| **Claude Code** | `.mcp.json` в корне проекта, либо `claude mcp add --transport stdio legitagent -- npx -y @legit-agent/mcp` |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` (после правки перезапустить Claude) |
| **Kimi Code** | `~/.kimi-code/mcp.json` или `.kimi-code/mcp.json` |
| **Kimi CLI** | `kimi mcp add --transport stdio legitagent -- npx -y @legit-agent/mcp` или `~/.kimi/mcp.json` |
| **Windsurf, Cline, Continue, Copilot** | тот же `mcpServers`; если спрашивают транспорт — `stdio` |

После подключения: «проверь этот репозиторий на 152-ФЗ», «покажи каталог правил», «объясни PDN.FORM.NO_CONSENT».

### CLI

```bash
npx @legit-agent/cli scan
npx @legit-agent/cli scan ./my-site
npx @legit-agent/cli scan ./my-site --json
```

Вывод по-русски: файл, строка, что не так, как исправить, цитата нормы.

| Код выхода | Значение |
|---|---|
| `0` | Нет серьёзных находок (в том числе нечего сканировать) |
| `1` | Есть хотя бы одна находка `high` |
| `2` | Нет команды `scan` |

В CI достаточно `npx @legit-agent/cli scan --json`: ненулевой код — стоп пайплайна.

---

## Возможности

Один движок [`@legit-agent/core`](https://www.npmjs.com/package/@legit-agent/core), две оболочки: [`@legit-agent/mcp`](https://www.npmjs.com/package/@legit-agent/mcp) и [`@legit-agent/cli`](https://www.npmjs.com/package/@legit-agent/cli).

### Инструменты MCP

| Инструмент | Что делает |
|---|---|
| `scan` | Сканирует проект. Необязательный `root` — путь к репозиторию (по умолчанию текущая папка). |
| `list_rules` | Полный каталог правил 152-ФЗ для сайта. |
| `explain_rule` | Правило, выдержка статьи, как исправить, дисклеймер. Нужен `ruleId`. |

Агент сам предлагает патч по находкам — MCP только проверяет и объясняет.

Ответ `scan`: список `findings` (правило, файл, строка, severity, сообщение, фикс, цитата), `warnings` по битым файлам, `scannedFileCount`. Если путь нечитаем: `Укажите корень проекта`.

### Что проверяется в коде

Сканер читает `.html`, `.jsx`, `.tsx` (React / Next.js). Пропускает `node_modules`, `.next`, `dist`, `build`, `coverage`, `.git`. Синтаксически сломанный файл не роняет проверку — он уходит в предупреждение. Пустой проект — валидный результат, не ошибка.

| id | Что находит | Норма |
|---|---|---|
| `PDN.FORM.NO_CONSENT` | Форма с именем, email или телефоном без чекбокса согласия | 152-ФЗ ст. 9 |
| `PDN.TRACKER.NO_CONSENT` | Яндекс.Метрика, gtag, GA, Meta Pixel, VK.Retargeting без проверки согласия | 152-ФЗ ст. 6 |
| `PDN.POLICY.NO_LINK` | В проекте нет ссылки на политику обработки ПДн | 152-ФЗ ст. 18.1 |

### Полный чек-лист

Помимо автопоиска агент знает весь каталог и по `explain_rule` разбирает каждый пункт: зачем правило, какая статья, что сделать.

**Формы и согласие** — `PDN.FORM.NO_CONSENT`, предзаполненный чекбокс (`PDN.FORM.PRECHECKED_CONSENT`), ссылка на политику рядом с согласием (`PDN.FORM.NO_POLICY_LINK`).

**Политика ПДн** — ссылка в проекте (`PDN.POLICY.NO_LINK`), состав документа: оператор, цели, сроки, отзыв (`PDN.POLICY.INCOMPLETE`).

**Метрики и cookie** — трекер без opt-in (`PDN.TRACKER.NO_CONSENT`), cookie до согласия (`PDN.COOKIE.BEFORE_CONSENT`), баннер без отказа (`PDN.COOKIE.NO_REJECT`), иностранный трекер / трансграничная передача (`PDN.TRANSFER.FOREIGN_TRACKER`).

**Организация** — локализация баз в РФ (`PDN.LOCALIZATION.UNCLEAR`), уведомление Роскомнадзора (`PDN.ORG.RKN_NOTICE`).

У каждого правила в репозитории есть короткая выдержка статьи. Без выдержки правило в каталог не попадает.

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
- `packages/cli` — команда `legitagent scan`
- `packages/mcp` — stdio-сервер для агентов

Правила: `packages/core/rules/*.yaml`. Закон: `packages/core/legal/*.yaml`.

---

## Релиз

Пакеты живут на [npmjs.com/org/legit-agent](https://www.npmjs.com/org/legit-agent), не в GitHub Packages.

Новая версия: одинаковый `version` в трёх `packages/*/package.json`, коммит в `main`, тег `vX.Y.Z`, `git push origin vX.Y.Z`. GitHub Actions публикует core → cli → mcp и открывает GitHub Release.

---

## Лицензия

[MIT](LICENSE)
