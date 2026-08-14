import fs from 'node:fs';
import path from 'node:path';
import { ConfigError } from '@legit-agent/core';

export async function notifyTelegram(
  text: string,
  filePath?: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const token = env.LEGITAGENT_TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.LEGITAGENT_TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    throw new ConfigError('Укажите LEGITAGENT_TELEGRAM_BOT_TOKEN и LEGITAGENT_TELEGRAM_CHAT_ID');
  }

  const base = `https://api.telegram.org/bot${token}`;

  if (filePath) {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', text);
    form.append('document', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
    const res = await fetch(`${base}/sendDocument`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Telegram sendDocument: ${res.status}`);
    return;
  }

  const res = await fetch(`${base}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage: ${res.status}`);
}
