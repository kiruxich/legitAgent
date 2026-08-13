<p align="center"><img src="assets/logo.png" width="280" alt="legitAgent" /></p>

# legitAgent

Проверка исходников сайта на типичные риски 152-ФЗ: прямо в Cursor (MCP) и в терминале (CLI).

**Это эвристическая проверка кода, а не юридическое заключение.** legitAgent не заменяет юриста и не гарантирует соответствие закону. Решение о том, нарушаете вы требования или нет, принимает человек.

## Установка

Пакеты публикуются в npm под организацией `@legit-agent`. Для разработки из исходников:

```bash
git clone https://github.com/kiruxich/LegitAgent.git
cd LegitAgent
pnpm install
pnpm build
```

Для использования без клонирования репозитория достаточно `npx` (см. CLI и MCP ниже).

## MCP (Cursor)

Добавьте сервер в `.cursor/mcp.json`:

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

Инструменты: `scan`, `list_rules`, `explain_rule`.

## CLI

```bash
npx @legit-agent/cli scan
npx @legit-agent/cli scan ./my-site --json
```

v1 ищет три вещи: форму без согласия, метрику без согласия, отсутствие ссылки на политику. Остальные пункты чек-листа можно спросить у агента (`list_rules` / `explain_rule`).

## Документация

- [Спецификация v1](docs/superpowers/specs/2026-08-13-legitagent-design.md)
- [Бэклог (не реализовано в v1)](docs/superpowers/specs/2026-08-13-legitagent-backlog.md)

## Лицензия

[MIT](LICENSE)
