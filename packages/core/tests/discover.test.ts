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
});
