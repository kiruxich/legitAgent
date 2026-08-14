import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyTelegram } from '../src/notify.js';

describe('notifyTelegram', () => {
  const env = {
    LEGITAGENT_TELEGRAM_BOT_TOKEN: 'token123',
    LEGITAGENT_TELEGRAM_CHAT_ID: 'chat456',
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when token or chat id is missing', async () => {
    await expect(notifyTelegram('hi', undefined, {})).rejects.toThrow(
      'Укажите LEGITAGENT_TELEGRAM_BOT_TOKEN и LEGITAGENT_TELEGRAM_CHAT_ID',
    );
    await expect(notifyTelegram('hi', undefined, { LEGITAGENT_TELEGRAM_BOT_TOKEN: 't' })).rejects.toThrow(
      'Укажите LEGITAGENT_TELEGRAM_BOT_TOKEN и LEGITAGENT_TELEGRAM_CHAT_ID',
    );
  });

  it('posts sendMessage when no filePath', async () => {
    await notifyTelegram('summary text', undefined, env);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken123/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: 'chat456', text: 'summary text' }),
      }),
    );
  });

  it('posts sendDocument when filePath is set', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-tg-'));
    const file = path.join(dir, 'evidence.pdf');
    fs.writeFileSync(file, 'pdf-bytes');
    await notifyTelegram('caption', file, env);
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toBe('https://api.telegram.org/bottoken123/sendDocument');
    expect(call[1]?.method).toBe('POST');
    const body = call[1]?.body;
    expect(body).toBeInstanceOf(FormData);
  });
});
