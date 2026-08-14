import { findingFromRule } from './helpers.js';
import type { Catalog, Finding } from '../types.js';

const FOREIGN = /gtag\(|ga\(|fbq\(|google-analytics|googletagmanager|facebook\.net|connect\.facebook/;
const LOCALIZED = /на территории\s*(РФ|Российск)|локализац/i;

export function detectLocalizationUnclear(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[] {
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
  const processesPdn = args.files.some(
    (f) =>
      (/<form[\s>]/i.test(f.source) && /(email|e-mail|phone|tel|name|fio|имя|телефон|почта)/i.test(f.source)) ||
      /ym\(|gtag\(|fbq\(/i.test(f.source),
  );
  if (!processesPdn) return [];
  if (args.files.some((f) => /Роскомнадзор|уведомлен\w{0,8}\s+уполномоченн|pd\.rkn/i.test(f.source))) return [];
  return [findingFromRule(args.catalog, 'PDN.ORG.RKN_NOTICE', args.files[0]?.relativePath ?? '.', null)];
}