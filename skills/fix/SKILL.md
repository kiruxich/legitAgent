---
name: fix
description: >-
  Исправляет подтверждённые находки legitAgent: scan, review, fix confirm, rescan.
  Не трогает reject. Эвристика, не юридическое заключение.
---

# Fix

1. Вызови MCP `scan` сервера legitagent. Всегда передай абсолютный `root` открытого workspace (или путь пользователя).
2. Вызови MCP `review` с тем же контекстом. Offline-review возвращает `not_reviewed`: такую находку, как и `ask_human`, нельзя автоматически считать подтверждённой.
3. Вызови MCP `autofix` с `write: false`. Покажи safe и manual recipes. `write: true` применяет все safe-рецепты свежего scan, а не только LLM-`confirm`, поэтому перед записью проверь preview и не применяй его при неоднозначных находках.
4. Только в рамках явной команды пользователя `/fix` и после проверки preview передай `write: true`. У `autofix` нет per-finding фильтра: если preview содержит `reject`, `ask_human` или `not_reviewed`, не используй `write: true`; manual recipes оставь человеку.
5. После правок снова `scan` + `review`. Повторяй, пока не останется `confirm` с `severity: high`, если пользователь явно не принял риск.
6. Покажи человеку все `ask_human` и `not_reviewed`. Напомни: это эвристика, не юридическое заключение.
