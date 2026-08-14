import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../src/index.ts');
const fixture = path.resolve(here, '../../core/tests/fixtures/bad-form');
const cleanLive = path.resolve(here, '../../live/tests/fixtures/clean.html');
const formNoConsentLive = path.resolve(here, '../../live/tests/fixtures/form-no-consent.html');

function runCli(args: string[], cwd?: string) {
  return spawnSync('npx', ['tsx', cli, ...args], { encoding: 'utf8', cwd });
}

function runCliAsync(args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', cli, ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

describe('cli', () => {
  it('prints json findings and exits 1 on high', () => {
    const result = runCli(['scan', fixture, '--json']);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.findings.some((f: { ruleId: string }) => f.ruleId === 'PDN.FORM.NO_CONSENT')).toBe(true);
  });

  it('writes SARIF to the given --sarif path and still exits 1 on high', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-sarif-'));
    const out = path.join(dir, 'out.sarif');
    const result = runCli(['scan', fixture, '--sarif', out]);
    expect(result.status).toBe(1);
    const sarif = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results.some((r: { ruleId: string; level: string }) => r.ruleId === 'PDN.FORM.NO_CONSENT' && r.level === 'error')).toBe(true);
  });

  it('defaults --sarif without a path to legitagent.sarif', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-sarif-'));
    const result = runCli(['scan', fixture, '--sarif'], dir);
    expect(result.status).toBe(1);
    const sarif = JSON.parse(fs.readFileSync(path.join(dir, 'legitagent.sarif'), 'utf8'));
    expect(sarif.runs[0].tool.driver.name).toBe('legitAgent');
  });

  it('exits 2 when scan-url is missing a URL', () => {
    const result = runCli(['scan-url']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('scan-url');
  });

  it('prints English findings with --lang en', () => {
    const result = runCli(['scan', fixture, '--json', '--lang', 'en']);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout);
    const hit = parsed.findings.find((f: { ruleId: string }) => f.ruleId === 'PDN.FORM.NO_CONSENT');
    expect(hit.message).toMatch(/consent checkbox/i);
  });

  it('writes a policy draft', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-pol-'));
    const out = path.join(dir, 'policy.md');
    const result = runCli(['init-policy', '--operator', 'ООО Ромашка', '--out', out]);
    expect(result.status).toBe(0);
    expect(fs.readFileSync(out, 'utf8')).toContain('ООО Ромашка');
  });

  it('exits 2 on invalid legitagent.config.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-cfg-'));
    fs.writeFileSync(path.join(dir, 'legitagent.config.json'), '{not json');
    const result = runCli(['scan', dir, '--json']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Некорректный legitagent.config.json');
  });

  it('includes reviewed in scan --review --json and exits 1 on raw high', () => {
    const result = runCli(['scan', fixture, '--json', '--review']);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.reviewed).toBeDefined();
    expect(parsed.reviewed.some((f: { ruleId: string; verdict: string }) => f.ruleId === 'PDN.FORM.NO_CONSENT' && f.verdict)).toBe(true);
    expect(parsed.findings.some((f: { severity: string }) => f.severity === 'high')).toBe(true);
  });

  it('scan-url --review --evidence writes evidence pack', async () => {
    const html = fs.readFileSync(cleanLive);
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve((server.address() as AddressInfo).port);
      });
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-ev-'));
    try {
      const result = await runCliAsync([
        'scan-url',
        `http://127.0.0.1:${port}/clean.html`,
        '--json',
        '--review',
        '--evidence',
        dir,
      ]);
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.reviewed).toBeDefined();
      expect(fs.existsSync(path.join(dir, 'evidence.json'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'evidence.sarif'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'evidence.pdf'))).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }, 60_000);

  it('exits 2 when --notify-telegram is set without credentials', async () => {
    const html = fs.readFileSync(cleanLive);
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve((server.address() as AddressInfo).port);
      });
    });
    try {
      const result = await runCliAsync([
        'scan-url',
        `http://127.0.0.1:${port}/clean.html`,
        '--notify-telegram',
      ]);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('LEGITAGENT_TELEGRAM_BOT_TOKEN');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }, 30_000);

  it('scan-url --sarif writes raw high findings', async () => {
    const html = fs.readFileSync(formNoConsentLive);
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve((server.address() as AddressInfo).port);
      });
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-sarif-url-'));
    const out = path.join(dir, 'raw.sarif');
    try {
      const result = await runCliAsync([
        'scan-url',
        `http://127.0.0.1:${port}/form-no-consent.html`,
        '--review',
        '--sarif',
        out,
      ]);
      expect(result.status).toBe(1);
      const sarif = JSON.parse(fs.readFileSync(out, 'utf8'));
      expect(
        sarif.runs[0].results.some(
          (r: { ruleId: string; level: string }) => r.ruleId === 'PDN.FORM.NO_CONSENT' && r.level === 'error',
        ),
      ).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }, 30_000);

  it('prints json for scan-url against a local fixture', async () => {
    const html = fs.readFileSync(cleanLive);
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve((server.address() as AddressInfo).port);
      });
    });
    try {
      const result = await runCliAsync(['scan-url', `http://127.0.0.1:${port}/clean.html`, '--json']);
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.scannedFileCount).toBe(1);
      expect(parsed.findings).toEqual([]);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }, 30_000);
});
