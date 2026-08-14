#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { handleExplainRule, handleListRules, handleScan } from './server.js';

const server = new Server({ name: 'legitagent', version: '0.1.1' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan',
      description: 'Проверить проект на типичные риски 152-ФЗ по исходникам HTML/JSX/TSX',
      inputSchema: {
        type: 'object',
        properties: { root: { type: 'string', description: 'Корень проекта' } },
      },
    },
    {
      name: 'list_rules',
      description: 'Показать каталог правил, включая ещё не реализованные детекторы',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'explain_rule',
      description: 'Объяснить правило, цитату статьи и как исправить',
      inputSchema: {
        type: 'object',
        properties: { ruleId: { type: 'string' } },
        required: ['ruleId'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, string>;
  try {
    if (name === 'scan') {
      const data = await handleScan(args.root);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'list_rules') {
      return { content: [{ type: 'text', text: JSON.stringify(handleListRules(), null, 2) }] };
    }
    if (name === 'explain_rule') {
      return { content: [{ type: 'text', text: JSON.stringify(handleExplainRule(args.ruleId), null, 2) }] };
    }
    throw new Error(`Неизвестный инструмент: ${name}`);
  } catch (err) {
    return { content: [{ type: 'text', text: (err as Error).message }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
