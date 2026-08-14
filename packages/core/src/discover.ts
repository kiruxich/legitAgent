import fg from 'fast-glob';

const IGNORE = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.git/**',
  '**/.Trash/**',
  '**/.Trashes/**',
];

export async function discoverSourceFiles(root: string, extraIgnore: string[] = []): Promise<string[]> {
  return fg(['**/*.html', '**/*.jsx', '**/*.tsx', '**/*.vue', '**/*.svelte', '**/*.astro'], {
    cwd: root,
    absolute: true,
    ignore: [...IGNORE, ...extraIgnore],
    dot: false,
  });
}
