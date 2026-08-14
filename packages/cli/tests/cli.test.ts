import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '../src/index.ts');
const fixture = path.resolve(here, '../../core/tests/fixtures/bad-form');
const cleanLive = path.resolve(here, '../../live/tests/fixtures/clean.html');

function runCli(args: string[]) {
  return spawnSync('npx', ['tsx', cli, ...args], { encoding: 'utf8' });
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

  it('exits 2 when scan-url is missing a URL', () => {
    const result = runCli(['scan-url']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('scan-url');
  });

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
