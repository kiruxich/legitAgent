#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  handleExplainRule,
  handleGeneratePolicy,
  handleGetLaw,
  handleListRules,
  handleScan,
  handleScanUrl,
} from './server.js';

const server = new Server({ name: 'legitagent', version: '0.5.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan',
      description: 'Проверить проект на риски 152-ФЗ, 38-ФЗ и ЗоЗПП по HTML/JSX/TSX/Vue/Svelte/Astro',
      inputSchema: {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Корень проекта' },
          lang: { type: 'string', description: 'ru или en' },
        },
      },
    },
    {
      name: 'list_rules',
      description: 'Показать каталог правил',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'explain_rule',
      description: 'Объяснить правило, цитату статьи и как исправить',
      inputSchema: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          lang: { type: 'string', description: 'ru или en' },
        },
        required: ['ruleId'],
      },
    },
    {
      name: 'scan_url',
      description:
        'Проверить живой сайт в браузере: cookie, баннер, формы, политика, ERID, витрина, иностранные трекеры. После загрузки ждёт гидрацию SPA, нажимает «отказ», если кнопка есть, и смотрит cookie после этого.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL сайта' } },
        required: ['url'],
      },
    },
    {
      name: 'generate_policy',
      description:
        'Черновик политики обработки ПДн. Это не юридическое заключение. Нужно наименование оператора.',
      inputSchema: {
        type: 'object',
        properties: {
          operator: { type: 'string' },
          inn: { type: 'string' },
          ogrn: { type: 'string' },
          email: { type: 'string' },
          site: { type: 'string' },
          address: { type: 'string' },
        },
        required: ['operator'],
      },
    },
    {
      name: 'get_law',
      description: 'Текст закона из корпуса pravo.gov.ru: 152-fz, 38-fz, zozpp. Без id — список.',
      inputSchema: {
        type: 'object',
        properties: {
          lawId: { type: 'string', description: '152-fz | 38-fz | zozpp' },
          article: { type: 'string', description: 'Номер статьи, например 9' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, string>;
  try {
    if (name === 'scan') {
      const data = await handleScan(args.root, args.lang);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'list_rules') {
      return { content: [{ type: 'text', text: JSON.stringify(handleListRules(), null, 2) }] };
    }
    if (name === 'explain_rule') {
      return { content: [{ type: 'text', text: JSON.stringify(handleExplainRule(args.ruleId, args.lang), null, 2) }] };
    }
    if (name === 'scan_url') {
      const data = await handleScanUrl(args.url);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'generate_policy') {
      const text = handleGeneratePolicy(args);
      return { content: [{ type: 'text', text }] };
    }
    if (name === 'get_law') {
      const data = handleGetLaw(args.lawId, args.article);
      return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
    }
    throw new Error(`Неизвестный инструмент: ${name}`);
  } catch (err) {
    return { content: [{ type: 'text', text: (err as Error).message }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
