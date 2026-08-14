# legitAgent — v6

Дата: 2026-08-14  
Статус: релиз v0.6.0. Облака и платного тарифа нет.

## Состав

1. Cursor-плагин: `.cursor-plugin/plugin.json`, `mcp.json`, скиллы `/check`, `/scan`, `/scan-url`, `/list-rules`, `/explain-rule`, `/generate-policy`, `/get-law`.
2. MCP в IDE всегда `@latest` + `--prefer-online`: при старте Cursor / Claude / Kimi берётся текущий npm, не кэш. Уже запущенный процесс сам не обновляется.
3. Рекомендуемая установка в Cursor — **User** (`~/.cursor/mcp.json`, кнопка Add to Cursor). Проектный `.cursor/mcp.json` — только текущий репозиторий.
4. Лендинг и README под актуальное: 15 правил, Vue/Svelte/Astro, полный `scan-url`, `init-policy`, корпус, скиллы, deeplink Add to Cursor.
5. Всё MIT и бесплатно. Хост Playwright и кабинет не входят. Канонический сайт — GitHub Pages (`kiruxich.github.io/legitAgent`), не Vercel.

CI Action остаётся на пине `cli@0.6.0`, чтобы пайплайн не скакал.
