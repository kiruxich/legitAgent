import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discoverSourceFiles } from '../src/discover.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('discoverSourceFiles', () => {
  it('returns empty array when there are no html/jsx/tsx files', async () => {
    const files = await discoverSourceFiles(path.join(here, 'fixtures/empty-project'));
    expect(files).toEqual([]);
  });

  it('finds tsx and skips node_modules', async () => {
    const root = path.join(here, 'fixtures/good-form');
    const files = await discoverSourceFiles(root);
    expect(files.some((f) => f.endsWith('Contact.tsx'))).toBe(true);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
  });

  it('finds vue, svelte and astro files', async () => {
    const vue = await discoverSourceFiles(path.join(here, 'fixtures/vue-form'));
    const svelte = await discoverSourceFiles(path.join(here, 'fixtures/svelte-form'));
    const astro = await discoverSourceFiles(path.join(here, 'fixtures/astro-shop'));
    expect(vue.some((f) => f.endsWith('.vue'))).toBe(true);
    expect(svelte.some((f) => f.endsWith('.svelte'))).toBe(true);
    expect(astro.some((f) => f.endsWith('.astro'))).toBe(true);
  });

  it('applies extra ignore globs', async () => {
    const root = path.join(here, 'fixtures/config-ignore');
    const files = await discoverSourceFiles(root, ['vendor/**']);
    expect(files.some((f) => f.includes('vendor'))).toBe(false);
    expect(files.some((f) => f.endsWith('Form.tsx'))).toBe(true);
  });

  it('skips .Trash even when it contains html', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-trash-'));
    fs.mkdirSync(path.join(dir, '.Trash'));
    fs.writeFileSync(path.join(dir, '.Trash', 'old.html'), '<form><input name="email" /></form>');
    fs.writeFileSync(path.join(dir, 'ok.tsx'), 'export const x = 1;\n');
    const files = await discoverSourceFiles(dir);
    expect(files.some((f) => f.includes('.Trash'))).toBe(false);
    expect(files.some((f) => f.endsWith('ok.tsx'))).toBe(true);
  });

  it('does not scan source files through symlinks', async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'legit-discover-symlink-'));
    const root = path.join(parent, 'project');
    const outside = path.join(parent, 'outside');
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'external.tsx'), '<form><input name="email" /></form>');
    fs.symlinkSync(path.join(outside, 'external.tsx'), path.join(root, 'linked.tsx'));
    fs.symlinkSync(outside, path.join(root, 'linked-dir'));
    const files = await discoverSourceFiles(root);
    expect(files).toEqual([]);
  });
});
