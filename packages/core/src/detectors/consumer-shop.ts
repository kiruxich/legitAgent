import { findingFromRule } from './helpers.js';
import type { Catalog, Finding } from '../types.js';

const SHOP = /корзин|купить|оформить заказ|addToCart|add-to-cart/i;
const OFFER = /оферт|публичн\w{0,8}\s+договор/i;
const REQUISITES = /\bИНН\b|\bОГРН\b/;
const RETURN = /возврат|обмен товар/i;

export function detectConsumerShop(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[] {
  const shop = args.files.find((f) => SHOP.test(f.source));
  if (!shop) return [];
  const all = args.files.map((f) => f.source).join('\n');
  const findings: Finding[] = [];
  const line = shop.source.split(/\n/).findIndex((l) => SHOP.test(l));
  const loc = line >= 0 ? line + 1 : null;
  if (!OFFER.test(all)) {
    findings.push(findingFromRule(args.catalog, 'CONSUMER.OFFER.MISSING', shop.relativePath, loc));
  }
  if (!REQUISITES.test(all)) {
    findings.push(findingFromRule(args.catalog, 'CONSUMER.REQUISITES.MISSING', shop.relativePath, loc));
  }
  if (!RETURN.test(all)) {
    findings.push(findingFromRule(args.catalog, 'CONSUMER.RETURN.MISSING', shop.relativePath, loc));
  }
  return findings;
}
