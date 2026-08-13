import fg from 'fast-glob';

const IGNORE = ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**'];

export async function discoverSourceFiles(root: string): Promise<string[]> {
  return fg(['**/*.html', '**/*.jsx', '**/*.tsx'], {
    cwd: root,
    absolute: true,
    ignore: IGNORE,
    dot: false,
  });
}
