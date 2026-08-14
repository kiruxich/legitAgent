import { findingFromRule } from './helpers.js';
import { collectsPdn } from './pdn.js';
import type { Catalog, Finding } from '../types.js';

const FOREIGN = /gtag\(|ga\(|fbq\(|google-analytics|googletagmanager|facebook\.net|connect\.facebook/;
const LOCALIZED =
  /на территории\s*(РФ|Российск)|локализац|Российской Федерации|хранени\w{0,8}[^\n]{0,80}(РФ|Росси)/i;
const RKN = /Роскомнадзор|pd\.rkn|реестр операторов|уведомлен\w{0,12}\s+уполномоченн/i;

export function detectLocalizationUnclear(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[] {
  if (!collectsPdn(args.files)) return [];
  const foreign = args.files.find((f) => FOREIGN.test(f.source));
  if (!foreign) return [];
  if (args.files.some((f) => LOCALIZED.test(f.source))) return [];
  const line = foreign.source.split(/\n/).findIndex((l) => FOREIGN.test(l));
  return [findingFromRule(args.catalog, 'PDN.LOCALIZATION.UNCLEAR', foreign.relativePath, line >= 0 ? line + 1 : null)];
}

export function detectRknNotice(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[] {
  if (!collectsPdn(args.files)) return [];
  if (args.files.some((f) => RKN.test(f.source))) return [];
  return [findingFromRule(args.catalog, 'PDN.ORG.RKN_NOTICE', args.files[0]?.relativePath ?? '.', null)];
}
