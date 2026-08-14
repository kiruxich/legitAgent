---
name: scan-url
description: >-
  Открывает живой URL в Chromium и проверяет DOM плюс cookie:
  согласие, политика, ERID, витрина, иностранные трекеры.
  Нужен адрес после команды.
---

# Scan URL

1. Вызови MCP-инструмент `scan_url` сервера legitagent.
   - URL — из текста после `/scan-url`. Если URL нет, спроси и не вызывай инструмент без него.
   - Опционально `evidenceDir` для скриншотов (page.png, banner.png). Полную evidence pack (JSON, SARIF, PDF) создаёт CLI `scan-url --evidence`, не MCP.
2. Покажи `findings` из ответа `scan_url`. **Не вызывай MCP `review`** — он пересканирует проект с диска, а не live-страницу.
3. Находки по RKN, локализации, витрине и неполной политике (`PDN.ORG.RKN_NOTICE`, `PDN.LOCALIZATION.UNCLEAR`, `CONSUMER.*`, `PDN.POLICY.INCOMPLETE`) **не трактуй как доказанное нарушение** — покажи как `ask_human` для решения человека.
4. Остальные findings показывай как эвристические сигналы; не выдумывай дополнительных нарушений.
5. Дисклеймер: эвристика, не юридическое заключение.
