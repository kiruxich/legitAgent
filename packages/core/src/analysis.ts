import { Node, SyntaxKind, type CallExpression, type FunctionDeclaration, type ArrowFunction, type FunctionExpression } from 'ts-morph';
import { parseHtml } from './parse-html.js';
import { tryParseJsx } from './parse-jsx.js';
import { htmlFormHasPii, jsxFormHasPii } from './form-fields.js';

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

const CONSENT = /(персональн|согласи|consent|обработк)/i;
const POLICY_HREF = /href\s*=\s*["'][^"']*(privacy|personal-data|политик|pdn|confidential)[^"']*["']/i;
// Django URL tags may contain the same quote character as the surrounding HTML attribute.
const TEMPLATE_POLICY_HREF = /\bhref\s*=\s*(["'])\s*{%\s*url\b[^%]*\b(?:privacy\w*|personal-data|pdn|confidential\w*)\b[^%]*%}\s*\1/i;
const INPUT_TAG = /<input\b[^>]*>/gi;
const TRACKER = /\b(ym|gtag|ga|fbq|VK\.Retargeting)\s*\(/g;
const FOREIGN_TRACKER = /^(gtag|ga|fbq)$/i;
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
  hasPii = htmlFormHasPii(source),
): FormEvidence {
  const hasConsentControl =
    /type=["']checkbox["']/i.test(source) || /<Checkbox\b/.test(source) || /role=["']checkbox["']/i.test(source);
  const hasConsent = hasConsentControl && CONSENT.test(source);
  const hasPolicyLink = POLICY_HREF.test(source) || TEMPLATE_POLICY_HREF.test(source);
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
      jsxFormHasPii(node),
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
  // Consent/settings commands are not event or page-view calls. Still inspect
  // their descendants: a get callback can contain a separate tracking event.
  if (match?.[1]?.toLowerCase() === 'gtag') {
    const command = call.getArguments()[0];
    if (command && Node.isStringLiteral(command) && /^(consent|set|get|js)$/.test(command.getLiteralValue())) return undefined;
  }
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
interface ConsentBranches { whenTrue: ConsentState; whenFalse: ConsentState }
const UNKNOWN_CONSENT: ConsentBranches = { whenTrue: 'unknown', whenFalse: 'unknown' };

function unwrapExpression(node: Node): Node {
  if (Node.isParenthesizedExpression(node) || Node.isAsExpression(node) ||
    Node.isTypeAssertion(node) || Node.isNonNullExpression(node)) return unwrapExpression(node.getExpression());
  return node;
}

function consentSubject(node: Node): boolean {
  const expression = unwrapExpression(node);
  if (!Node.isIdentifier(expression) && !Node.isPropertyAccessExpression(expression)) return false;
  const name = expression.getText();
  return /consent|согласи/i.test(name) || (CONSENT_SUBJECT.test(name) && POSITIVE_CONSENT_EVENT.test(name));
}

function consentBranches(node: Node): ConsentBranches {
  const expression = unwrapExpression(node);
  if (Node.isPrefixUnaryExpression(expression) && expression.getOperatorToken() === SyntaxKind.ExclamationToken) {
    const operand = consentBranches(expression.getOperand());
    return { whenTrue: operand.whenFalse, whenFalse: operand.whenTrue };
  }
  if (Node.isBinaryExpression(expression)) {
    const operator = expression.getOperatorToken().getText();
    const left = unwrapExpression(expression.getLeft());
    const right = unwrapExpression(expression.getRight());
    if (operator === '&&' || operator === '||') {
      const a = consentBranches(left);
      const b = consentBranches(right);
      const either = (x: ConsentState, y: ConsentState): ConsentState =>
        x === 'unknown' ? y : y === 'unknown' || x === y ? x : 'unknown';
      const both = (x: ConsentState, y: ConsentState): ConsentState => x === y ? x : 'unknown';
      return operator === '&&'
        ? { whenTrue: either(a.whenTrue, b.whenTrue), whenFalse: both(a.whenFalse, b.whenFalse) }
        : { whenTrue: both(a.whenTrue, b.whenTrue), whenFalse: either(a.whenFalse, b.whenFalse) };
    }
    if (['===', '!==', '==', '!='].includes(operator)) {
      const subject = consentSubject(left) ? left : consentSubject(right) ? right : undefined;
      if (!subject) return UNKNOWN_CONSENT;
      const literal = subject === left ? right : left;
      let equalState: ConsentState = 'unknown';
      if (literal.getKind() === SyntaxKind.TrueKeyword) equalState = consentBranches(subject).whenTrue;
      else if (literal.getKind() === SyntaxKind.FalseKeyword) equalState = consentBranches(subject).whenFalse;
      else if (Node.isStringLiteral(literal)) {
        const value = literal.getLiteralValue();
        if (/^(granted|accepted|allowed|enabled)$/i.test(value)) equalState = 'granted';
        else if (/^(denied|rejected|declined|revoked|disabled)$/i.test(value)) equalState = 'denied';
      }
      // An unequal value may be unset or unknown; it does not prove consent.
      return operator === '===' || operator === '=='
        ? { whenTrue: equalState, whenFalse: 'unknown' }
        : { whenTrue: 'unknown', whenFalse: equalState };
    }
    return UNKNOWN_CONSENT;
  }
  if (!consentSubject(expression)) return UNKNOWN_CONSENT;
  return NEGATIVE_CONSENT.test(expression.getText())
    ? { whenTrue: 'denied', whenFalse: 'unknown' }
    : { whenTrue: 'granted', whenFalse: 'denied' };
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
      const state = consentBranches(ancestor.getExpression());
      if (isDescendantOf(call, ancestor.getThenStatement())) return state.whenTrue === 'granted';
      const otherwise = ancestor.getElseStatement();
      return Boolean(otherwise && isDescendantOf(call, otherwise) && state.whenFalse === 'granted');
    }
    if (Node.isConditionalExpression(ancestor)) {
      const state = consentBranches(ancestor.getCondition());
      if (isDescendantOf(call, ancestor.getWhenTrue())) return state.whenTrue === 'granted';
      return isDescendantOf(call, ancestor.getWhenFalse()) && state.whenFalse === 'granted';
    }
    if (Node.isBinaryExpression(ancestor) && ancestor.getOperatorToken().getText() === '&&') {
      return isDescendantOf(call, ancestor.getRight()) && consentBranches(ancestor.getLeft()).whenTrue === 'granted';
    }
    if (Node.isBinaryExpression(ancestor) && ancestor.getOperatorToken().getText() === '||') {
      return isDescendantOf(call, ancestor.getRight()) && consentBranches(ancestor.getLeft()).whenFalse === 'granted';
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

interface ScriptRange { start: number; end: number; executable?: boolean }

function embeddedScripts(source: string, filePath: string): ScriptRange[] {
  const ranges: ScriptRange[] = [];
  const visit = (node: ReturnType<typeof parseHtml> | { childNodes?: unknown[] }) => {
    const element = node as {
      tagName?: string;
      attrs?: { name: string; value: string }[];
      childNodes?: unknown[];
      content?: { childNodes?: unknown[] };
      sourceCodeLocation?: { startTag?: { endOffset: number }; endTag?: { startOffset: number } };
    };
    if (element.tagName === 'script') {
      const location = element.sourceCodeLocation;
      const type = element.attrs?.find((attribute) => attribute.name === 'type')?.value.trim().toLowerCase() ?? '';
      const executable = !type || type === 'module' ||
        /^(?:text|application)\/(?:x-)?(?:java|ecma)script(?:\s*;.*)?$/.test(type);
      if (location?.startTag) ranges.push({
        start: location.startTag.endOffset,
        end: location.endTag?.startOffset ?? source.length,
        executable,
      });
    }
    for (const child of element.childNodes ?? []) visit(child as { childNodes?: unknown[] });
    if (element.content) visit(element.content);
  };
  visit(parseHtml(source));
  if (/\.astro$/i.test(filePath)) {
    const frontmatter = source.match(/^\s*---[^\S\n]*\r?\n([\s\S]*?)^---[^\S\n]*(?:\r?\n|$)/m);
    if (frontmatter?.[1]) {
      const start = (frontmatter.index ?? 0) + frontmatter[0].indexOf(frontmatter[1]);
      ranges.push({ start, end: start + frontmatter[1].length });
    }
  }
  return ranges;
}

function fallbackTrackers(source: string, excluded: ScriptRange[] = []): TrackerEvidence[] {
  const trackers: TrackerEvidence[] = [];
  for (const match of source.matchAll(TRACKER)) {
    const offset = match.index ?? 0;
    if (excluded.some(({ start, end }) => offset >= start && offset < end)) continue;
    const name = match[1] ?? 'tracker';
    const startLine = lineAt(source, offset);
    const startOffset = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
    const nextLine = source.indexOf('\n', offset);
    const endOffset = nextLine < 0 ? source.length : nextLine;
    const line = source.slice(startOffset, endOffset) || match[0];
    trackers.push({
      startOffset,
      endOffset,
      startLine,
      endLine: startLine,
      snippet: boundedSnippet(line),
      name,
      guardedByConsent: false,
      foreign: FOREIGN_TRACKER.test(name),
      signals: [
        `tracker call: ${name}`,
        'consent-controlled execution path could not be established',
      ],
    });
  }
  return trackers;
}

function templateTrackers(filePath: string, source: string): TrackerEvidence[] {
  const scripts = embeddedScripts(source, filePath);
  const trackers = scripts.flatMap(({ start, end, executable }, index) => {
    // Data blocks can later be activated by a CMP. Their initial contents are
    // not executable JS, and must also stay excluded from the fallback scan.
    if (executable === false) return [];
    const script = source.slice(start, end);
    const analysis = structuralTrackers(`${filePath}.${index}.tsx`, script) ?? fallbackTrackers(script);
    const precedingLines = lineAt(source, start) - 1;
    return analysis.map((tracker) => ({
      ...tracker,
      startOffset: tracker.startOffset + start,
      endOffset: tracker.endOffset + start,
      startLine: tracker.startLine + precedingLines,
      endLine: tracker.endLine + precedingLines,
    }));
  });
  return [...trackers, ...fallbackTrackers(source, scripts)].sort((a, b) => a.startOffset - b.startOffset);
}

export function analyzeSource(filePath: string, source: string): SourceAnalysis {
  const lower = filePath.toLowerCase();
  const adapter: AnalysisAdapter = /\.[cm]?[jt]sx?$/.test(lower)
    ? 'jsx'
    : /\.html?$/.test(lower) || /^\s*(?:<!doctype|<html|<form)/i.test(source)
      ? 'html'
      : 'template';
  const forms = adapter === 'jsx' ? jsxForms(filePath, source) : adapter === 'html' ? htmlForms(source) : templateForms(source);
  return { adapter, forms, trackers: structuralTrackers(filePath, source) ?? templateTrackers(filePath, source) };
}
