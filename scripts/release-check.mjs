#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateRealWorldCases } from './benchmark-corpus.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageNames = ['core', 'live', 'cli', 'mcp'];
const packages = packageNames.map((name) => JSON.parse(fs.readFileSync(path.join(root, 'packages', name, 'package.json'), 'utf8')));
const versions = new Set(packages.map((pkg) => pkg.version));
const failures = [];
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const minimumNodeVersion = '>=20.0.0';
if (versions.size !== 1) failures.push(`Версии workspace packages различаются: ${[...versions].join(', ')}`);
const version = packages[0].version;
if (rootPackage.engines?.node !== minimumNodeVersion) failures.push(`Root engines.node должна быть ${minimumNodeVersion}`);
if (rootPackage.engines?.pnpm !== '>=9.15.0') failures.push('Root engines.pnpm должна быть >=9.15.0');
for (const pkg of packages) {
  if (pkg.engines?.node !== minimumNodeVersion) failures.push(`${pkg.name}: engines.node должна быть ${minimumNodeVersion}`);
}
const benchmark = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/corpus.json'), 'utf8'));
const independentCases = validateRealWorldCases(root, benchmark);
if (Number(version.split('.')[0]) >= 1 && independentCases < benchmark.v1MinimumIndependentCases) {
  failures.push(
    `v1 требует минимум ${benchmark.v1MinimumIndependentCases} независимо размеченных real-world benchmark cases; сейчас ${independentCases}`,
  );
}

const mcpSource = fs.readFileSync(path.join(root, 'packages/mcp/src/index.ts'), 'utf8');
if (!mcpSource.includes(`version: '${version}'`)) failures.push(`MCP server version не совпадает с ${version}`);
const action = fs.readFileSync(path.join(root, '.github/actions/legitagent-scan/action.yml'), 'utf8');
if (!action.includes(`@legit-agent/cli@${version}`)) failures.push(`Composite Action не закреплён на CLI ${version}`);
const playwrightVersion = packages[1].dependencies.playwright;
if (!/^\d+\.\d+\.\d+$/.test(playwrightVersion)) failures.push('Playwright dependency должна быть закреплена на точной версии');
if (!action.includes(`playwright@${playwrightVersion}`)) {
  failures.push(`Composite Action должна устанавливать Playwright ${playwrightVersion}`);
}
if (/uses:\s+[^\s]+@(v\d+|main|master)\s*$/m.test(action)) failures.push('В composite Action есть GitHub Action без commit SHA pin');

const ref = process.env.GITHUB_REF ?? '';
const expectedTag = `refs/tags/v${version}`;
if (process.env.LEGITAGENT_REQUIRE_RELEASE_TAG === 'true' && ref !== expectedTag) {
  failures.push(`Release workflow должен запускаться только из тега ${expectedTag}; получен ${ref || 'пустой ref'}`);
} else if (ref.startsWith('refs/tags/v') && ref !== expectedTag) {
  failures.push(`Тег ${ref} не совпадает с package version v${version}`);
}

const workflowsDirectory = path.join(root, '.github');
const workflowFiles = fs.readdirSync(workflowsDirectory, { recursive: true })
  .filter((entry) => typeof entry === 'string' && /\.(?:ya?ml)$/.test(entry))
  .map((entry) => path.join(workflowsDirectory, entry));
for (const workflowFile of workflowFiles) {
  const source = fs.readFileSync(workflowFile, 'utf8');
  for (const match of source.matchAll(/^\s*-?\s*uses:\s*([^\s]+)/gm)) {
    const actionReference = match[1];
    if (actionReference.startsWith('./')) continue;
    const actionRevision = actionReference.split('@')[1];
    if (!/^[0-9a-f]{40}$/i.test(actionRevision ?? '')) {
      failures.push(`${path.relative(root, workflowFile)}: ${actionReference} должна быть закреплена commit SHA`);
    }
  }
}

const packDirectory = process.env.LEGITAGENT_PACK_DIR;
if (packDirectory) {
  for (const pkg of packages) {
    const tarballName = `${pkg.name.slice(1).replace('/', '-')}-${pkg.version}.tgz`;
    const tarballPath = path.join(packDirectory, tarballName);
    if (!fs.existsSync(tarballPath)) {
      failures.push(`Не найден ожидаемый tarball ${tarballPath}`);
      continue;
    }
    let packedPackage;
    try {
      packedPackage = JSON.parse(execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], { encoding: 'utf8' }));
    } catch {
      failures.push(`Невозможно прочитать package.json из ${tarballName}`);
      continue;
    }
    if (packedPackage.name !== pkg.name || packedPackage.version !== pkg.version) {
      failures.push(`${tarballName}: name/version не совпадают с исходным package.json`);
    }
    for (const [dependency, dependencyVersion] of Object.entries(packedPackage.dependencies ?? {})) {
      if (dependency.startsWith('@legit-agent/') && dependencyVersion !== version) {
        failures.push(`${tarballName}: ${dependency} должна ссылаться на ${version}, получено ${dependencyVersion}`);
      }
    }
  }
}

if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Release metadata OK for v${version}.\n`);
