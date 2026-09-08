import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeSource, scanSources } from '../packages/core/dist/index.js';
import { evaluateEvidenceChecks, validateRealWorldCases } from './benchmark-corpus.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/corpus.json'), 'utf8'));
const independentCases = validateRealWorldCases(root, manifest);
const strictFailures = [];
const metrics = new Map();
const frameworkMetrics = new Map();
const seedMetrics = new Map();
const seedFrameworkMetrics = new Map();
const supported = /\.(?:html|jsx|tsx|js|ts|mjs|cjs|vue|svelte|astro)$/i;

function readSources(dir) {
  const result = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (supported.test(entry.name)) {
        result.push({ relativePath: path.relative(dir, file), filePath: file, source: fs.readFileSync(file, 'utf8') });
      }
    }
  };
  visit(dir);
  return result;
}

function framework(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  return ext === 'htm' ? 'html' : ext || 'unknown';
}

function mutate(source, index) {
  if (index === 0) return source;
  if (index === 1) return `\n${source}`;
  if (index === 2) return source.replace(/\n/g, '\n  ');
  if (index === 3) return source.replace(/\n/g, '\r\n');
  return `${source}\n\n`;
}

function updateMetric(target, ruleId, expected, found) {
  const row = target.get(ruleId) ?? { tp: 0, fp: 0, fn: 0, tn: 0 };
  if (expected && found) row.tp += 1;
  else if (expected && !found) row.fn += 1;
  else if (!expected && found) row.fp += 1;
  else row.tn += 1;
  target.set(ruleId, row);
}

for (const testCase of manifest.cases) {
  const seeds = readSources(path.join(root, testCase.path));
  for (let variant = 0; variant < manifest.mutationCount; variant += 1) {
    const sources = seeds.map((file) => {
      const source = mutate(file.source, variant);
      return { ...file, source, analysis: analyzeSource(file.filePath, source) };
    });
    const findings = scanSources(sources);
    const actual = new Set(findings.map((finding) => finding.ruleId));
    strictFailures.push(...evaluateEvidenceChecks(testCase.checks, sources, findings)
      .map((failure) => ({ case: testCase.name, variant, ...failure })));
    const frameworks = [...new Set(sources.map((file) => framework(file.relativePath)))];
    for (const [ruleId, expected] of Object.entries(testCase.rules)) {
      const found = actual.has(ruleId);
      if (testCase.strict && expected !== found) {
        strictFailures.push({ case: testCase.name, variant, field: ruleId, expected, actual: found });
      }
      updateMetric(metrics, ruleId, expected, found);
      if (variant === 0) updateMetric(seedMetrics, ruleId, expected, found);
      for (const name of frameworks) {
        const target = frameworkMetrics.get(name) ?? new Map();
        updateMetric(target, ruleId, expected, found);
        frameworkMetrics.set(name, target);
        if (variant === 0) {
          const seedTarget = seedFrameworkMetrics.get(name) ?? new Map();
          updateMetric(seedTarget, ruleId, expected, found);
          seedFrameworkMetrics.set(name, seedTarget);
        }
      }
    }
  }
}

function rows(source) {
  return [...source.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ruleId, row]) => ({
    ruleId,
    ...row,
    labeled: row.tp + row.fp + row.fn + row.tn,
    precision: row.tp + row.fp === 0 ? 1 : row.tp / (row.tp + row.fp),
    recall: row.tp + row.fn === 0 ? 1 : row.tp / (row.tp + row.fn),
  }));
}

const report = rows(metrics);
const seedReport = rows(seedMetrics);
const expandedCases = manifest.cases.length * manifest.mutationCount;
const output = {
  corpusVersion: manifest.version,
  seedCases: manifest.cases.length,
  independentCases,
  strictFailures,
  v1MinimumIndependentCases: manifest.v1MinimumIndependentCases,
  expandedCases,
  thresholds: manifest.thresholds,
  seedRules: seedReport,
  seedFrameworks: Object.fromEntries([...seedFrameworkMetrics.entries()].map(([name, value]) => [name, rows(value)])),
  rules: report,
  frameworks: Object.fromEntries([...frameworkMetrics.entries()].map(([name, value]) => [name, rows(value)])),
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (
  strictFailures.length > 0 ||
  expandedCases < manifest.thresholds.minimumExpandedCases ||
  seedReport.some((row) =>
    row.tp + row.fn < manifest.thresholds.minimumPositiveSeedsPerRule ||
    row.tn + row.fp < manifest.thresholds.minimumNegativeSeedsPerRule,
  ) ||
  report.some((row) =>
    row.precision < manifest.thresholds.precision ||
    row.recall < manifest.thresholds.recall ||
    row.labeled < manifest.thresholds.minimumLabeledExamplesPerRule,
  )
) process.exitCode = 1;
