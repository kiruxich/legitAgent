import fg from 'fast-glob';

const IGNORE = ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**'];

export async function discoverSourceFiles(root: string, extraIgnore: string[] = []): Promise<string[]> {
  return fg(['**/*.html', '**/*.jsx', '**/*.tsx'], {
    cwd: root,
    absolute: true,
    ignore: [...IGNORE, ...extraIgnore],
    dot: false,
  });
}
