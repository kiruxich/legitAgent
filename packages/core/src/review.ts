import type { Finding, ReviewedFinding, Verdict } from './types.js';

export type { ReviewedFinding, Verdict } from './types.js';

export type LlmComplete = (prompt: string) => Promise<string>;

export const SOFT_RULE_IDS: readonly string[] = [
  'PDN.ORG.RKN_NOTICE',
  'PDN.LOCALIZATION.UNCLEAR',
  'PDN.POLICY.INCOMPLETE',
  'PDN.POLICY.NO_LINK',
  'CONSUMER.OFFER.MISSING',
  'CONSUMER.REQUISITES.MISSING',
  'CONSUMER.RETURN.MISSING',
];

const FALLBACK_REASON = 'нет LLM, эвристика';
const PARSE_FAIL_REASON = 'модель не разобрала ответ';

export function forEvidencePack(reviewed: ReviewedFinding[]): ReviewedFinding[] {
  return reviewed.filter((f) => f.verdict === 'confirm' || f.verdict === 'ask_human');
}

export function snippetAround(source: string, line: number | null, radius = 15): string {
  const lines = source.split('\n');
  if (line === null || line < 1) return lines.slice(0, radius * 2 + 1).join('\n');
  const idx = line - 1;
  const start = Math.max(0, idx - radius);
  const end = Math.min(lines.length, idx + radius + 1);
  return lines.slice(start, end).join('\n');
}

export function createLlmComplete(env?: NodeJS.ProcessEnv): LlmComplete | undefined {
  const e = env ?? process.env;
  const key = e.LEGITAGENT_LLM_API_KEY?.trim();
  if (!key) return undefined;

  const base = (e.LEGITAGENT_LLM_API_BASE ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = e.LEGITAGENT_LLM_MODEL ?? 'gpt-4o-mini';

  return async (prompt: string) => {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`LLM API error: ${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  };
}

function isValidVerdict(v: unknown): v is Verdict {
  return v === 'confirm' || v === 'reject' || v === 'ask_human';
}

function fallbackReview(findings: Finding[]): ReviewedFinding[] {
  return findings.map((f) => ({
    ...f,
    verdict: SOFT_RULE_IDS.includes(f.ruleId) ? 'ask_human' : 'confirm',
    reason: FALLBACK_REASON,
  }));
}

function buildPrompt(findings: Finding[], snippets: Record<string, string>): string {
  const items = findings.map((f) => ({
    ruleId: f.ruleId,
    file: f.file,
    message: f.message,
    excerpt: f.excerpt,
    snippet: snippets[f.file] ?? '',
  }));
  return `Review compliance findings. Reply with a JSON array only. Each object: { "ruleId", "file", "verdict", "reason" }. Verdict: "confirm", "reject", or "ask_human". If the snippet cannot prove a violation, use "ask_human".

${JSON.stringify(items, null, 2)}`;
}

type LlmRow = { ruleId: string; file: string; verdict: Verdict; reason: string };

function parseLlmResponse(text: string): LlmRow[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as LlmRow[];
  } catch {
    return null;
  }
}

export async function reviewFindings(
  findings: Finding[],
  snippets: Record<string, string>,
  complete?: LlmComplete,
): Promise<ReviewedFinding[]> {
  if (findings.length === 0) return [];

  let llm = complete;
  if (llm === undefined) {
    llm = createLlmComplete(process.env);
  }

  if (!llm) {
    return fallbackReview(findings);
  }

  const response = await llm(buildPrompt(findings, snippets));
  const rows = parseLlmResponse(response);

  return findings.map((f) => {
    if (!rows) {
      return { ...f, verdict: 'ask_human' as const, reason: PARSE_FAIL_REASON };
    }
    const row = rows.find((r) => r.ruleId === f.ruleId && r.file === f.file);
    if (!row || !isValidVerdict(row.verdict)) {
      return { ...f, verdict: 'ask_human' as const, reason: PARSE_FAIL_REASON };
    }
    return { ...f, verdict: row.verdict, reason: String(row.reason ?? '') };
  });
}
