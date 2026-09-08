import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Used by both benchmark and release checks: extra views of the same source
// cannot increase the independence count, and unreviewed edits fail closed.
export function validateRealWorldCases(root, manifest) {
  const groups = new Set();
  for (const testCase of manifest.cases) {
    if (testCase.provenance !== 'independent-real-world') continue;
    const fail = (message) => { throw new Error(`${testCase.name}: ${message}`); };
    const base = path.resolve(root, 'benchmarks/real-world');
    const directory = path.resolve(root, testCase.path);
    if (!directory.startsWith(`${base}${path.sep}`)) fail('real-world path must be inside benchmarks/real-world');
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'provenance.json'), 'utf8'));
    if (!testCase.id || metadata.id !== testCase.id || !metadata.repository || !/^[a-f0-9]{40}$/.test(metadata.commit)) {
      fail('missing pinned source provenance');
    }
    if (!testCase.independenceGroup || metadata.independenceGroup !== testCase.independenceGroup) fail('missing source group');
    if (testCase.strict !== true || !metadata.review?.rationale || !metadata.review?.date) fail('missing strict source review');
    if (!Object.keys(testCase.rules ?? {}).length && !testCase.checks?.length) fail('case has no labels');
    if (!metadata.files?.length || !metadata.license || !metadata.licenseUrl) fail('missing source/license records');
    if (!isDeepStrictEqual(metadata.labels, { rules: testCase.rules, checks: testCase.checks ?? [] })) fail('reviewed labels differ');
    const verify = (filename, hash) => {
      if (path.basename(filename) !== filename || !/^[a-f0-9]{64}$/.test(hash ?? '')) fail('invalid file/hash record');
      if (sha256(path.join(directory, filename)) !== hash) fail(`reviewed hash differs: ${filename}`);
    };
    verify(metadata.licenseFile, metadata.licenseSha256);
    for (const file of metadata.files) {
      verify(file.filename, file.sha256);
      if (!file.sourceUrl?.startsWith(`https://github.com/${metadata.repository}/blob/${metadata.commit}/`) ||
          !/^[a-f0-9]{64}$/.test(file.upstreamSha256 ?? '')) fail(`missing upstream pin/hash: ${file.filename}`);
    }
    const sources = fs.readdirSync(directory).filter((name) => /\.(?:html|jsx|tsx|js|ts|mjs|cjs|vue|svelte|astro|php|erb|twig)$/i.test(name)).sort();
    if (!isDeepStrictEqual(sources, metadata.files.map((file) => file.filename).sort()) ||
        fs.readdirSync(directory, { withFileTypes: true }).some((entry) => entry.isDirectory())) fail('unreviewed source inventory');
    groups.add(testCase.independenceGroup);
  }
  return groups.size;
}

// Checks inspect the public analyzer's evidence as well as scoped rule output.
// Exact list lengths prevent a missing parser result from passing negative labels.
export function evaluateEvidenceChecks(checks, sources, findings) {
  const failures = [];
  const compare = (field, expected, actual) => {
    if (!isDeepStrictEqual(expected, actual)) failures.push({ field, expected, actual });
  };
  for (const check of checks ?? []) {
    const source = sources.find((file) => file.relativePath === check.file);
    if (!source?.analysis) {
      failures.push({ field: check.file, expected: 'analyzed source', actual: 'missing' });
      continue;
    }
    for (const section of ['forms', 'trackers']) {
      if (!Object.hasOwn(check, section)) continue;
      const actual = source.analysis[section];
      compare(`${check.file}.${section}.length`, check[section].length, actual.length);
      check[section].forEach((expected, index) => {
        for (const [property, value] of Object.entries(expected)) {
          if (property === 'snippetIncludes') {
            compare(`${check.file}.${section}[${index}].snippetIncludes(${value})`, true, actual[index]?.snippet.includes(value) ?? false);
          } else compare(`${check.file}.${section}[${index}].${property}`, value, actual[index]?.[property]);
        }
      });
    }
    for (const needle of check.textIncludes ?? []) {
      compare(`${check.file}.textIncludes(${needle})`, true, source.source.includes(needle));
    }
    for (const [ruleId, expected] of Object.entries(check.rules ?? {})) {
      compare(`${check.file}.${ruleId}`, expected, findings.some((finding) => finding.file === check.file && finding.ruleId === ruleId));
    }
  }
  return failures;
}
