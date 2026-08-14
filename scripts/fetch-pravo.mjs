#!/usr/bin/env node
/**
 * Downloads official law texts from pravo.gov.ru (IPS) into packages/core/legal/corpus/.
 * Heuristic HTML strip — not a certified consolidated edition.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LAWS = [
  {
    id: '152-fz',
    nd: '102108261',
    title: 'Федеральный закон от 27.07.2006 № 152-ФЗ «О персональных данных»',
  },
  {
    id: '38-fz',
    nd: '102105292',
    title: 'Федеральный закон от 13.03.2006 № 38-ФЗ «О рекламе»',
  },
  {
    id: 'zozpp',
    nd: '102014512',
    title: 'Закон РФ от 07.02.1992 № 2300-1 «О защите прав потребителей»',
  },
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'packages/core/legal/corpus');

function sourceUrl(nd) {
  return `http://pravo.gov.ru/proxy/ips/?doc_itself=&nd=${nd}&page=1&rdk=0`;
}

function decodeHtml(buf) {
  try {
    return new TextDecoder('windows-1251').decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export async function fetchLaw(law) {
  const url = sourceUrl(law.nd);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'legitAgent-law-crawler/0.4 (+https://github.com/kiruxich/legitAgent)',
      Accept: 'text/html',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const html = decodeHtml(Buffer.from(await res.arrayBuffer()));
  const text = stripHtml(html);
  if (text.length < 8000 || !/Статья\s+1/i.test(text)) {
    throw new Error(`${law.id}: нет полного текста закона (${text.length} символов) с ${url}`);
  }
  return { ...law, url, text };
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const index = [];
  for (const law of LAWS) {
    const fetched = await fetchLaw(law);
    const file = `${law.id}.txt`;
    const header = `${fetched.title}\nИсточник: ${fetched.url}\nСкачано: ${new Date().toISOString()}\n\n`;
    writeFileSync(path.join(outDir, file), header + fetched.text + '\n');
    index.push({ id: law.id, title: law.title, nd: law.nd, sourceUrl: fetched.url, file });
    console.log(`Wrote ${file} (${fetched.text.length} chars)`);
  }
  writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
