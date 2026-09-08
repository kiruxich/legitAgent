#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  handleExplainRule,
  handleAutofix,
  handleCreateBaseline,
  handleGeneratePolicy,
  handleGetLaw,
  handleListRules,
  handleReview,
  handleScan,
  handleScanUrl,
} from './server.js';

const server = new Server({ name: 'legitagent', version: '0.8.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan',
      description:
        'Проверить папку проекта на риски 152-ФЗ, 38-ФЗ и ЗоЗПП. Всегда передай абсолютный root workspace. Без root процесс может оказаться в домашнем каталоге — его сканер отклонит.',
      inputSchema: {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Абсолютный корень открытого проекта' },
          lang: { type: 'string', description: 'ru или en' },
          changedFiles: { type: 'array', items: { type: 'string' }, description: 'Относительные пути изменённых файлов' },
          baseline: { type: 'string', description: 'Относительный путь к baseline' },
          cache: { oneOf: [{ type: 'boolean' }, { type: 'string' }], description: 'Включить incremental cache или задать его путь' },
          minimumConfidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    {
      name: 'review',
      description:
        'Второй проход по находкам scan. По умолчанию offline: данные не отправляются. OpenRouter используется только при LEGITAGENT_REVIEW_MODE=openrouter и настроенном ключе; тогда передаются findings и связанные сниппеты. Не юридическое заключение.',
      inputSchema: {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Абсолютный корень открытого проекта, тот же что у scan' },
          lang: { type: 'string', description: 'ru или en' },
          changedFiles: { type: 'array', items: { type: 'string' } },
          baseline: { type: 'string' },
          cache: { oneOf: [{ type: 'boolean' }, { type: 'string' }] },
          minimumConfidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    {
      name: 'create_baseline',
      description: 'Создать baseline текущих findings внутри root проекта. Это операция записи.',
      inputSchema: {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Абсолютный корень открытого проекта' },
          output: { type: 'string', description: 'Путь внутри root; по умолчанию .legitagent-baseline.json' },
          lang: { type: 'string', description: 'ru или en' },
        },
        required: ['root'],
      },
    },
    {
      name: 'autofix',
      description: 'Показать безопасные механические fix-рецепты. По умолчанию dry-run; write=true изменяет только заранее разрешённые конструкции.',
      inputSchema: {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Абсолютный корень открытого проекта' },
          write: { type: 'boolean', description: 'Применить safe-рецепты; по умолчанию false' },
          lang: { type: 'string', description: 'ru или en' },
        },
        required: ['root'],
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
        'Проверить живой сайт в браузере: cookie, storage, network initiators, баннер, формы, политика, ERID, витрина, иностранные трекеры. Сравнивает изолированные состояния до/после Reject и Accept.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL сайта' },
          evidenceDir: {
            type: 'string',
            description: 'Каталог для скриншотов (page.png, banner.png). JSON/SARIF/PDF — только CLI scan-url --evidence',
          },
          root: {
            type: 'string',
            description: 'Абсолютный корень проекта. Обязателен, если передан evidenceDir',
          },
          allowPrivateNetwork: {
            type: 'boolean',
            description: 'Явно разрешить localhost/private IP. По умолчанию false',
          },
        },
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
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  try {
    if (name === 'scan') {
      const data = await handleScan(args.root as string | undefined, args.lang as string | undefined, args as Parameters<typeof handleScan>[2]);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'review') {
      const data = await handleReview(args.root as string | undefined, args.lang as string | undefined, args as Parameters<typeof handleReview>[2]);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'create_baseline') {
      const data = await handleCreateBaseline(args.root as string | undefined, args.output as string | undefined, args.lang as string | undefined);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'autofix') {
      const data = await handleAutofix(args.root as string | undefined, args.write === true, args.lang as string | undefined);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'list_rules') {
      return { content: [{ type: 'text', text: JSON.stringify(handleListRules(), null, 2) }] };
    }
    if (name === 'explain_rule') {
      return { content: [{ type: 'text', text: JSON.stringify(handleExplainRule(args.ruleId as string, args.lang as string | undefined), null, 2) }] };
    }
    if (name === 'scan_url') {
      const data = await handleScanUrl(
        args.url as string | undefined,
        args.evidenceDir as string | undefined,
        args.root as string | undefined,
        args.allowPrivateNetwork === true,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'generate_policy') {
      const text = handleGeneratePolicy(args as Parameters<typeof handleGeneratePolicy>[0]);
      return { content: [{ type: 'text', text }] };
    }
    if (name === 'get_law') {
      const data = handleGetLaw(args.lawId as string | undefined, args.article as string | undefined);
      return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
    }
    throw new Error(`Неизвестный инструмент: ${name}`);
  } catch (err) {
    return { content: [{ type: 'text', text: (err as Error).message }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
