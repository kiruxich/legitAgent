import { findingFromRule } from './helpers.js';
import { collectsPdn } from './pdn.js';
import type { Catalog, Finding } from '../types.js';
import { analyzeSource, type SourceAnalysis } from '../analysis.js';
import { findForeignTrackerUrl } from '../tracker-hosts.js';

const LOCALIZED =
  /на территории\s*(РФ|Российск)|локализац|Российской Федерации|хранени\w{0,8}[^\n]{0,80}(РФ|Росси)/i;
const RKN = /Роскомнадзор|pd\.rkn|реестр операторов|уведомлен\w{0,12}\s+уполномоченн/i;

export function detectLocalizationUnclear(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string; analysis?: SourceAnalysis }[];
}): Finding[] {
  if (!collectsPdn(args.files)) return [];
  const foreign = args.files.map((file) => ({
    file,
    call: (file.analysis ?? analyzeSource(file.relativePath, file.source)).trackers.find((tracker) => tracker.foreign),
    url: findForeignTrackerUrl(file.source),
  })).find(({ call, url }) => call || url);
  if (!foreign) return [];
  if (args.files.some((f) => LOCALIZED.test(f.source))) return [];
  const line = foreign.call?.startLine ?? foreign.file.source.slice(0, foreign.url!.index).split('\n').length;
  return [findingFromRule(args.catalog, 'PDN.LOCALIZATION.UNCLEAR', foreign.file.relativePath, line, {
    kind: 'manual_check',
    confidence: 'low',
    evidence: {
      summary: 'Проект собирает ПДн и содержит иностранный трекер, но место первичной записи данных нельзя подтвердить по коду.',
      signals: ['personal-data form', 'foreign tracker', 'localization statement not found'],
    },
  })];
}

export function detectRknNotice(args: {
  catalog: Catalog;
  files: { relativePath: string; source: string }[];
}): Finding[] {
  if (!collectsPdn(args.files)) return [];
  if (args.files.some((f) => RKN.test(f.source))) return [];
  return [findingFromRule(args.catalog, 'PDN.ORG.RKN_NOTICE', args.files[0]?.relativePath ?? '.', null, {
    kind: 'manual_check',
    confidence: 'low',
    evidence: {
      summary: 'Наличие или применимость уведомления Роскомнадзора невозможно достоверно определить по исходникам сайта.',
      signals: ['personal-data form', 'RKN notice evidence not found in project'],
    },
  })];
}
