import { parse, type DefaultTreeAdapterMap } from 'parse5';

export type HtmlDocument = DefaultTreeAdapterMap['document'];

export function parseHtml(source: string): HtmlDocument {
  return parse(source);
}
