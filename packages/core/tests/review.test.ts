import { describe, expect, it, vi } from 'vitest';
import type { Finding } from '../src/types.js';
import { forEvidencePack, reviewFindings, SOFT_RULE_IDS, createLlmComplete } from '../src/review.js';

const form: Finding = {
  ruleId: 'PDN.FORM.NO_CONSENT',
  file: 'Form.tsx',
  line: 3,
  severity: 'high',
  message: 'form',
  fix: 'checkbox',
  excerpt: 'ст. 9',
};
const rkn: Finding = {
  ruleId: 'PDN.ORG.RKN_NOTICE',
  file: 'App.tsx',
  line: 1,
  severity: 'low',
  message: 'rkn',
  fix: 'check',
  excerpt: 'ст. 22',
};

describe('reviewFindings', () => {
  it('falls back without LLM: soft ask_human, others confirm', async () => {
    const reviewed = await reviewFindings([form, rkn], { 'Form.tsx': '<form/>' });
    expect(reviewed.find((f) => f.ruleId === form.ruleId)?.verdict).toBe('confirm');
    expect(reviewed.find((f) => f.ruleId === rkn.ruleId)?.verdict).toBe('ask_human');
    expect(SOFT_RULE_IDS).toContain('PDN.ORG.RKN_NOTICE');
  });

  it('uses LLM JSON and drops reject from the evidence pack', async () => {
    const complete = async () =>
      JSON.stringify([
        { ruleId: form.ruleId, file: form.file, verdict: 'confirm', reason: 'нет чекбокса' },
        { ruleId: rkn.ruleId, file: rkn.file, verdict: 'reject', reason: 'CTA не магазин' },
      ]);
    const reviewed = await reviewFindings([form, rkn], {}, complete);
    expect(reviewed.map((f) => f.verdict).sort()).toEqual(['confirm', 'reject']);
    const pack = forEvidencePack(reviewed);
    expect(pack).toHaveLength(1);
    expect(pack[0].ruleId).toBe(form.ruleId);
  });

  it('marks unparsed LLM rows as ask_human', async () => {
    const reviewed = await reviewFindings([form], {}, async () => 'not json');
    expect(reviewed[0].verdict).toBe('ask_human');
  });

  it('reads LEGITAGENT_LLM_BASE_URL for the API base', async () => {
    const prev = process.env.LEGITAGENT_LLM_BASE_URL;
    const prevLegacy = process.env.LEGITAGENT_LLM_API_BASE;
    delete process.env.LEGITAGENT_LLM_API_BASE;
    process.env.LEGITAGENT_LLM_BASE_URL = 'https://llm.example/v1';
    process.env.LEGITAGENT_LLM_API_KEY = 'test-key';
    try {
      const complete = createLlmComplete(process.env);
      expect(complete).toBeDefined();
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '[]' } }] }), { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      await complete!('prompt');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://llm.example/v1/chat/completions',
        expect.objectContaining({ method: 'POST' }),
      );
    } finally {
      vi.unstubAllGlobals();
      if (prev === undefined) delete process.env.LEGITAGENT_LLM_BASE_URL;
      else process.env.LEGITAGENT_LLM_BASE_URL = prev;
      if (prevLegacy === undefined) delete process.env.LEGITAGENT_LLM_API_BASE;
      else process.env.LEGITAGENT_LLM_API_BASE = prevLegacy;
      delete process.env.LEGITAGENT_LLM_API_KEY;
    }
  });
});
