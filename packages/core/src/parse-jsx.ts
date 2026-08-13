import { Project, type SourceFile } from 'ts-morph';

const project = new Project({
  useInMemoryFileSystem: true,
  compilerOptions: { jsx: 2, allowJs: true, skipLibCheck: true },
});

export type JsxParseResult =
  | { ok: true; sourceFile: SourceFile }
  | { ok: false; error: string };

export function tryParseJsx(filePath: string, source: string): JsxParseResult {
  try {
    const sf = project.createSourceFile(filePath, source, { overwrite: true });
    return { ok: true, sourceFile: sf };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
