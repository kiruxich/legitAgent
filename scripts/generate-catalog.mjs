#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultCatalog,
  DISCLAIMER_RU,
  renderCatalogMarkdown,
} from '../packages/core/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = defaultCatalog();

writeFileSync(path.join(root, 'docs/RULES.md'), renderCatalogMarkdown(catalog));

function esc(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const STATUS_LABEL = {
  active: 'активно',
  planned: 'planned',
};

function ruleCard(rule) {
  const excerpt = catalog.excerpts[rule.excerptRef];
  return `<article class="rule">
  <h3><code>${esc(rule.id)}</code> — ${esc(rule.title)}</h3>
  <div class="rule-meta">
    <span class="tag tag-${esc(rule.status)}">${esc(STATUS_LABEL[rule.status])}</span>
    <span class="tag tag-${esc(rule.severity)}">${esc(rule.severity)} · ${esc(rule.law)}</span>
  </div>
  <p>${esc(rule.message)}</p>
  <p><strong>Как исправить:</strong> ${esc(rule.fix)}</p>
  <p class="excerpt">${esc(excerpt.text)} <a href="${esc(excerpt.sourceUrl)}" target="_blank" rel="noopener">${esc(excerpt.article)}</a></p>
</article>`;
}

const active = catalog.rules.filter((r) => r.status === 'active').map(ruleCard).join('\n');
const planned = catalog.rules.filter((r) => r.status === 'planned').map(ruleCard).join('\n');

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Каталог правил — legitAgent</title>
  <meta name="description" content="Полный каталог правил 152-ФЗ: активные детекторы и запланированные проверки legitAgent." />
  <link rel="icon" href="logo.png" type="image/png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="glow glow-a" aria-hidden="true"></div>
  <div class="glow glow-b" aria-hidden="true"></div>

  <header class="nav">
    <a class="brand" href="index.html">
      <img src="logo.png" width="36" height="36" alt="" />
      <span><span class="brand-light">Legit</span><span class="brand-bold">Agent</span></span>
    </a>
    <nav class="nav-links">
      <a href="index.html#features">Возможности</a>
      <a href="rules.html">Правила</a>
      <a href="https://github.com/kiruxich/legitAgent-demo" target="_blank" rel="noopener">Демо</a>
      <a href="https://github.com/kiruxich/legitAgent" target="_blank" rel="noopener">GitHub</a>
      <a class="btn btn-sm" href="https://www.npmjs.com/package/@legit-agent/cli" target="_blank" rel="noopener">npm</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <p class="eyebrow">каталог · YAML · 152-ФЗ</p>
      <h1>Все правила в одном месте</h1>
      <p class="lead">
        ${esc(DISCLAIMER_RU)}
        Источник истины — YAML в репозитории; эта страница генерируется командой <code>pnpm catalog</code>.
      </p>
    </section>

    <section class="section">
      <h2>Активные детекторы</h2>
      <p class="section-lead">Ищутся в HTML, JSX и TSX при <code>scan</code>.</p>
      <div class="rules-list">
${active}
      </div>
    </section>

    <section class="section">
      <h2>Запланированные правила</h2>
      <p class="section-lead">Агент объясняет их через <code>explain_rule</code>. Автопоиск — в следующих версиях.</p>
      <div class="rules-list">
${planned}
      </div>
    </section>
  </main>

  <footer class="footer">
    <img src="logo.png" width="48" height="48" alt="legitAgent" />
    <p>
      <a href="index.html">Лендинг</a>
      ·
      <a href="https://github.com/kiruxich/legitAgent/blob/main/docs/RULES.md" target="_blank" rel="noopener">docs/RULES.md</a>
      · MIT
    </p>
  </footer>
</body>
</html>
`;

writeFileSync(path.join(root, 'website/rules.html'), html);
console.log('Wrote docs/RULES.md and website/rules.html');
