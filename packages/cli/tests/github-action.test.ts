import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const actionPath = fileURLToPath(new URL('../../../.github/actions/legitagent-scan/action.yml', import.meta.url));
const action = fs.readFileSync(actionPath, 'utf8');
const cliVersion = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const temporaryDirectories: string[] = [];

// Execute the actual action's block scalars; inputs are expanded exactly where
// GitHub would insert them, so accidental interpolation into code is exercised.
function step(name: string): string {
  const start = action.indexOf(`    - name: ${name}\n`);
  if (start < 0) throw new Error(`Missing action step: ${name}`);
  const end = action.indexOf('\n    - ', start + 1);
  return action.slice(start, end < 0 ? undefined : end);
}

function block(source: string, key: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.trim() === `${key}: |`);
  if (start < 0) throw new Error(`Missing action block: ${key}`);
  const indentation = lines[start].length - lines[start].trimStart().length + 2;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && line.length - line.trimStart().length < indentation) break;
    body.push(line.slice(indentation));
  }
  return body.join('\n');
}

function expand(source: string, values: Record<string, string>): string {
  return source.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_, expression: string) => values[expression] ?? '');
}

function environment(source: string, values: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const match of source.matchAll(/^\s+(LEGITAGENT_\w+): (.+)$/gm)) {
    env[match[1]] = expand(match[2], values);
  }
  return env;
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-action-test-'));
  temporaryDirectories.push(root);
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'npx'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.LEGITAGENT_TEST_LOG, JSON.stringify(args) + '\\n');
if (args.some((arg) => arg.startsWith('playwright@'))) {
  process.exitCode = Number(process.env.LEGITAGENT_TEST_INSTALL_EXIT_CODE || 0);
} else {
  if (process.env.LEGITAGENT_TEST_WRITE_REPORT === 'true') {
    fs.writeFileSync('legitagent.sarif', JSON.stringify({version:'2.1.0',runs:[{results:[]}]}));
  }
  process.exitCode = Number(process.env.LEGITAGENT_TEST_NPX_EXIT_CODE || 0);
}
`, { mode: 0o755 });
  return { root, bin, log: path.join(root, 'commands.jsonl'), output: path.join(root, 'output') };
}

function runScan(
  fixture: ReturnType<typeof setup>,
  values: Record<string, string> = {},
  extraEnv: NodeJS.ProcessEnv = {},
) {
  const source = step('Scan');
  const inputs = {
    'inputs.root': '.',
    'inputs.fail-on-confidence': 'low',
    ...values,
  };
  return spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', expand(block(source, 'run'), inputs)], {
    cwd: fixture.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...environment(source, inputs),
      PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`,
      GITHUB_OUTPUT: fixture.output,
      LEGITAGENT_TEST_LOG: fixture.log,
      LEGITAGENT_TEST_WRITE_REPORT: 'true',
      ...extraEnv,
    },
  });
}

function enforce(fixture: ReturnType<typeof setup>, code: string, failOnHigh = 'false') {
  const source = step('Enforce scan result');
  const values = { 'steps.scan.outputs.exit_code': code, 'inputs.fail-on-high': failOnHigh };
  return spawnSync('bash', ['-c', expand(block(source, 'run'), values)], {
    cwd: fixture.root,
    encoding: 'utf8',
    env: { ...process.env, ...environment(source, values) },
  });
}

afterEach(() => {
  for (const root of temporaryDirectories.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('GitHub composite action', () => {
  it('passes PR filenames and all source scan inputs as literal arguments', () => {
    const fixture = setup();
    const hostileFilename = '$(touch injected).tsx';
    const root = 'project $(touch injected-root)';
    const baseline = 'baseline `touch injected-baseline`.json';
    const confidence = 'low$(touch injected-confidence)';
    fs.writeFileSync(path.join(fixture.root, hostileFilename), '');
    const result = runScan(fixture, {
      'inputs.root': root,
      'inputs.changed-files': hostileFilename,
      'inputs.baseline': baseline,
      'inputs.fail-on-confidence': confidence,
    });
    expect(result.status, result.stderr).toBe(0);
    const args = JSON.parse(fs.readFileSync(fixture.log, 'utf8').trim());
    expect(args).toEqual([
      '--yes', `@legit-agent/cli@${cliVersion}`, 'scan', root,
      '--sarif', 'legitagent.sarif', '--fail-on-confidence', confidence,
      '--baseline', baseline, '--changed-files', hostileFilename,
    ]);
    for (const name of ['injected', 'injected-root', 'injected-baseline', 'injected-confidence']) {
      expect(fs.existsSync(path.join(fixture.root, name))).toBe(false);
    }
  });

  it('passes live URL and evidence directory literally without command substitution', () => {
    const fixture = setup();
    const url = 'https://example.com/$(touch injected-url)';
    const evidence = 'evidence `touch injected-evidence`';
    const result = runScan(fixture, { 'inputs.url': url, 'inputs.evidence-dir': evidence });
    expect(result.status, result.stderr).toBe(0);
    const commands = fs.readFileSync(fixture.log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(commands[1]).toContain(url);
    expect(commands[1]).toContain(evidence);
    expect(fs.existsSync(path.join(fixture.root, 'injected-url'))).toBe(false);
    expect(fs.existsSync(path.join(fixture.root, 'injected-evidence'))).toBe(false);
  });

  it.each([
    { cliExit: 1, report: true, gateExit: 0 },
    { cliExit: 3, report: false, gateExit: 3 },
    { cliExit: 1, report: false, gateExit: 3 },
    { cliExit: 0, report: false, gateExit: 3 },
    { cliExit: 2, report: false, gateExit: 2 },
  ])('advisory mode handles CLI exit $cliExit and report=$report correctly', ({ cliExit, report, gateExit }) => {
    const fixture = setup();
    // A stale report must not turn a failed run into a completed scan.
    fs.writeFileSync(path.join(fixture.root, 'legitagent.sarif'), JSON.stringify({ version: '2.1.0', runs: [{ results: [] }] }));
    const result = runScan(fixture, {}, {
      LEGITAGENT_TEST_NPX_EXIT_CODE: String(cliExit),
      LEGITAGENT_TEST_WRITE_REPORT: String(report),
    });
    expect(result.status, result.stderr).toBe(0);
    const code = fs.readFileSync(fixture.output, 'utf8').match(/^exit_code=(\d+)$/m)?.[1];
    expect(code).toBeDefined();
    expect(enforce(fixture, code!).status).toBe(gateExit);
  });

  it('still fails on high findings when enforcement is enabled', () => {
    const fixture = setup();
    expect(enforce(fixture, '1', 'true').status).toBe(1);
  });

  it('fails immediately if browser installation fails', () => {
    const fixture = setup();
    const result = runScan(fixture, { 'inputs.url': 'https://example.com' }, { LEGITAGENT_TEST_INSTALL_EXIT_CODE: '1' });
    expect(result.status).toBe(3);
    expect(fs.readFileSync(fixture.log, 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('keeps GitHub inputs out of JavaScript source', () => {
    for (const name of ['Comment on PR', 'Create or update issue on high']) {
      const script = block(step(name), 'script');
      expect(script).not.toContain('${{');
      expect(script).toContain('process.env.LEGITAGENT_ACTION_PATH');
    }
    expect(block(step('Create or update issue on high'), 'script')).toContain('process.env.LEGITAGENT_FAIL_ON_CONFIDENCE');
  });
});
