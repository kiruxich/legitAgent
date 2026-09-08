import { Node, SyntaxKind, type CallExpression, type FunctionDeclaration, type ArrowFunction, type FunctionExpression } from 'ts-morph';
import { parseHtml } from './parse-html.js';
import { tryParseJsx } from './parse-jsx.js';

export type AnalysisAdapter = 'html' | 'jsx' | 'template';

export interface FormEvidence {
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  snippet: string;
  hasPii: boolean;
  hasConsent: boolean;
  hasPolicyLink: boolean;
  hasPrecheckedConsent: boolean;
  signals: string[];
}

export interface TrackerEvidence {
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  snippet: string;
  name: string;
  guardedByConsent: boolean;
  foreign: boolean;
  signals: string[];
}

export interface SourceAnalysis {
  adapter: AnalysisAdapter;
  forms: FormEvidence[];
  trackers: TrackerEvidence[];
}

const PII = /(email|e-mail|phone|tel|name|fio|имя|телефон|почта)/i;
const CONSENT = /(персональн|согласи|consent|обработк)/i;
const POLICY_HREF = /href\s*=\s*["'][^"']*(privacy|personal-data|политик|pdn|confidential)[^"']*["']/i;
const INPUT_TAG = /<input\b[^>]*>/gi;
const TRACKER = /\b(ym|gtag|ga|fbq|VK\.Retargeting)\s*\(/g;
const FOREIGN_TRACKER = /^(gtag|ga|fbq)$/i;
const CONSENT_GUARD = /if\s*\([^)]*(consent|cookie|tracking|analytics|marketing|метрик|согласи)/i;
const CONSENT_SUBJECT = /(consent|cookie(?:bot)?|tracking|analytics|marketing|согласи|метрик)/i;
const NEGATIVE_CONSENT = /(denied?|declin|reject|revoke|disable|opt.?out|without|отказ|отклон|отозв|запрет)/i;
const POSITIVE_CONSENT_EVENT = /(granted|accept|allow|enable|opt.?in|получен|принят|разреш)/i;

function lineAt(source: string, offset: number): number {
  return source.slice(0, Math.max(0, offset)).split('\n').length;
}

function boundedSnippet(source: string): string {
  const compact = source.trim();
  return compact.length <= 1200 ? compact : `${compact.slice(0, 1200)}…`;
}

function consentContext(source: string, tagStart: number, tag: string): string {
  const before = source.slice(0, tagStart);
  const labelStart = before.toLowerCase().lastIndexOf('<label');
  const labelEndBefore = before.toLowerCase().lastIndexOf('</label>');
  if (labelStart > labelEndBefore) {
    const end = source.toLowerCase().indexOf('</label>', tagStart);
    return source.slice(labelStart, end >= 0 ? end : tagStart + tag.length + 240);
  }
  return source.slice(Math.max(0, tagStart - 160), Math.min(source.length, tagStart + tag.length + 240));
}

function hasPrecheckedConsent(source: string): boolean {
  return [...source.matchAll(INPUT_TAG)].some((match) => {
    const tag = match[0];
    if (!/type=["']checkbox["']/i.test(tag)) return false;
    if (!CONSENT.test(consentContext(source, match.index ?? 0, tag))) return false;
    if (/\b(defaultChecked|checked)\s*=\s*\{\s*false\s*\}/.test(tag)) return false;
    return (
      /\bdefaultChecked(?:\s*=\s*(?:\{\s*true\s*\}|["'](?:checked|true)["']))?(?=[\s/>])/i.test(tag) ||
      /\bchecked\s*=\s*\{\s*true\s*\}/.test(tag) ||
      /\bchecked\s*=\s*["'](?:checked|true)["']/i.test(tag) ||
      /(?:^|\s)checked(?:[\s/>]|$)/.test(tag)
    );
  });
}

function formEvidence(
  source: string,
  startOffset: number,
  endOffset: number,
  startLine: number,
  endLine: number,
): FormEvidence {
  const hasPii = /<input\b/i.test(source) && PII.test(source);
  const hasConsentControl =
    /type=["']checkbox["']/i.test(source) || /<Checkbox\b/.test(source) || /role=["']checkbox["']/i.test(source);
  const hasConsent = hasConsentControl && CONSENT.test(source);
  const hasPolicyLink = POLICY_HREF.test(source);
  const prechecked = hasPrecheckedConsent(source);
  const signals: string[] = [];
  if (hasPii) signals.push('form contains a field that looks like personal data');
  if (hasConsent) signals.push('form contains a consent control');
  if (hasPolicyLink) signals.push('form contains a policy link');
  if (prechecked) signals.push('consent control is pre-checked');
  return {
    startOffset,
    endOffset,
    startLine,
    endLine,
    snippet: boundedSnippet(source),
    hasPii,
    hasConsent,
    hasPolicyLink,
    hasPrecheckedConsent: prechecked,
    signals,
  };
}

function htmlForms(source: string): FormEvidence[] {
  const document = parseHtml(source) as unknown as { childNodes?: unknown[] };
  const forms: FormEvidence[] = [];
  const visit = (node: unknown) => {
    const value = node as {
      tagName?: string;
      childNodes?: unknown[];
      sourceCodeLocation?: { startOffset?: number; endOffset?: number; startLine?: number; endLine?: number };
    };
    if (value.tagName === 'form' && value.sourceCodeLocation?.startOffset !== undefined) {
      const start = value.sourceCodeLocation.startOffset;
      const end = value.sourceCodeLocation.endOffset ?? source.length;
      forms.push(
        formEvidence(
          source.slice(start, end),
          start,
          end,
          value.sourceCodeLocation.startLine ?? lineAt(source, start),
          value.sourceCodeLocation.endLine ?? lineAt(source, end),
        ),
      );
    }
    for (const child of value.childNodes ?? []) visit(child);
  };
  visit(document);
  return forms;
}

function jsxForms(filePath: string, source: string): FormEvidence[] {
  const parsed = tryParseJsx(filePath, source);
  if (!parsed.ok) return templateForms(source);
  return parsed.sourceFile
    .getDescendantsOfKind(SyntaxKind.JsxElement)
    .filter((node) => node.getOpeningElement().getTagNameNode().getText().toLowerCase() === 'form')
    .map((node) => formEvidence(
      node.getText(),
      node.getStart(),
      node.getEnd(),
      node.getStartLineNumber(),
      node.getEndLineNumber(),
    ));
}

function templateForms(source: string): FormEvidence[] {
  const forms: FormEvidence[] = [];
  const pattern = /<form\b[\s\S]*?<\/form\s*>/gi;
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    forms.push(formEvidence(match[0], start, end, lineAt(source, start), lineAt(source, end)));
  }
  return forms;
}

function trackerName(call: CallExpression): string | undefined {
  const expression = call.getExpression().getText();
  const match = expression.match(/^(ym|gtag|ga|fbq)$/i);
  return match?.[1];
}

function enclosingFunctionName(call: CallExpression): string | undefined {
  const fn = call.getFirstAncestor((node): node is FunctionDeclaration | ArrowFunction | FunctionExpression =>
    Node.isFunctionDeclaration(node) || Node.isArrowFunction(node) || Node.isFunctionExpression(node),
  );
  if (!fn) return undefined;
  if (Node.isFunctionDeclaration(fn)) return fn.getName();
  const parent = fn.getParent();
  return parent && Node.isVariableDeclaration(parent) ? parent.getName() : undefined;
}

type ConsentState = 'granted' | 'denied' | 'unknown';

function consentState(expression: string): ConsentState {
  const compact = expression.replace(/\s+/g, ' ');
  if (!CONSENT_SUBJECT.test(compact) || compact.includes('||')) return 'unknown';
  if (NEGATIVE_CONSENT.test(compact)) return 'denied';
  const subject = '(?:[\\w$.]*(?:consent|cookie(?:bot)?|tracking|analytics|marketing|согласи|метрик)[\\w$.]*)';
  if (new RegExp(`!\\s*${subject}`, 'i').test(compact)) return 'denied';
  if (new RegExp(`${subject}\\s*(?:===?|!==?)\\s*(?:false|null|undefined)`, 'i').test(compact)) return 'denied';
  if (new RegExp(`${subject}\\s*(?:!==?|!=)\\s*true`, 'i').test(compact)) return 'denied';
  return 'granted';
}

function isDescendantOf(call: CallExpression, node: Node): boolean {
  return call === node || call.getAncestors().includes(node);
}

function isGrantedEvent(value: string): boolean {
  return CONSENT_SUBJECT.test(value) && POSITIVE_CONSENT_EVENT.test(value) && !NEGATIVE_CONSENT.test(value);
}

function guardedByAncestor(call: CallExpression): boolean {
  return call.getAncestors().some((ancestor) => {
    if (Node.isIfStatement(ancestor)) {
      const state = consentState(ancestor.getExpression().getText());
      if (isDescendantOf(call, ancestor.getThenStatement())) return state === 'granted';
      const otherwise = ancestor.getElseStatement();
      return Boolean(otherwise && isDescendantOf(call, otherwise) && state === 'denied');
    }
    if (Node.isConditionalExpression(ancestor)) {
      const state = consentState(ancestor.getCondition().getText());
      if (isDescendantOf(call, ancestor.getWhenTrue())) return state === 'granted';
      return isDescendantOf(call, ancestor.getWhenFalse()) && state === 'denied';
    }
    if (Node.isBinaryExpression(ancestor) && ancestor.getOperatorToken().getText() === '&&') {
      return isDescendantOf(call, ancestor.getRight()) && consentState(ancestor.getLeft().getText()) === 'granted';
    }
    if (Node.isJsxAttribute(ancestor)) return isGrantedEvent(ancestor.getNameNode().getText());
    if (Node.isCallExpression(ancestor)) {
      const expression = ancestor.getExpression().getText();
      const event = ancestor.getArguments()[0]?.getText() ?? '';
      return /(?:addEventListener|subscribe|\.on|^on)$/i.test(expression) && isGrantedEvent(event);
    }
    return false;
  });
}

function guardedFunctionInvocation(call: CallExpression, allCalls: CallExpression[]): boolean {
  const name = enclosingFunctionName(call);
  if (!name) return false;
  const invocations = allCalls.filter((candidate) => candidate !== call && candidate.getExpression().getText() === name);
  return invocations.length > 0 && invocations.every((candidate) => guardedByAncestor(candidate));
}

function structuralTrackers(filePath: string, source: string): TrackerEvidence[] | null {
  if (!/\.[cm]?[jt]sx?$/i.test(filePath)) return null;
  const parsed = tryParseJsx(filePath, source);
  if (!parsed.ok) return null;
  const calls = parsed.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  return calls.flatMap((call) => {
    const name = trackerName(call);
    if (!name) return [];
    const guardedByConsent = guardedByAncestor(call) || guardedFunctionInvocation(call, calls);
    return [{
      startOffset: call.getStart(),
      endOffset: call.getEnd(),
      startLine: call.getStartLineNumber(),
      endLine: call.getEndLineNumber(),
      snippet: boundedSnippet(call.getText()),
      name,
      guardedByConsent,
      foreign: FOREIGN_TRACKER.test(name),
      signals: [
        `tracker call: ${name}`,
        guardedByConsent ? 'consent-controlled execution path detected' : 'no consent-controlled execution path detected',
      ],
    }];
  });
}

function fallbackTrackers(source: string): TrackerEvidence[] {
  const trackers: TrackerEvidence[] = [];
  for (const match of source.matchAll(TRACKER)) {
    const offset = match.index ?? 0;
    const name = match[1] ?? 'tracker';
    const startLine = lineAt(source, offset);
    const startOffset = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
    const nextLine = source.indexOf('\n', offset);
    const endOffset = nextLine < 0 ? source.length : nextLine;
    const line = source.slice(startOffset, endOffset) || match[0];
    const context = source.slice(Math.max(0, offset - 600), Math.min(source.length, offset + 300));
    const guardedByConsent = CONSENT_GUARD.test(context) ||
      /(?:addEventListener|subscribe|\.on)\s*\([^)]*(?:consent|accept|opt.?in|согласи|принят)[\s\S]{0,500}$/i.test(context);
    trackers.push({
      startOffset,
      endOffset,
      startLine,
      endLine: startLine,
      snippet: boundedSnippet(line),
      name,
      guardedByConsent,
      foreign: FOREIGN_TRACKER.test(name),
      signals: [
        `tracker call: ${name}`,
        guardedByConsent ? 'consent guard detected near tracker call' : 'no consent guard detected near tracker call',
      ],
    });
  }
  return trackers;
}

export function analyzeSource(filePath: string, source: string): SourceAnalysis {
  const lower = filePath.toLowerCase();
  const adapter: AnalysisAdapter = /\.[cm]?[jt]sx?$/.test(lower)
    ? 'jsx'
    : /\.html?$/.test(lower) || /^\s*(?:<!doctype|<html|<form)/i.test(source)
      ? 'html'
      : 'template';
  const forms = adapter === 'jsx' ? jsxForms(filePath, source) : adapter === 'html' ? htmlForms(source) : templateForms(source);
  return { adapter, forms, trackers: structuralTrackers(filePath, source) ?? fallbackTrackers(source) };
}
