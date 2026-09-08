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

export function sourceSyntaxError(filePath: string, source: string): string | undefined {
  if (!/\.[cm]?[jt]sx?$/i.test(filePath)) return undefined;
  const parsed = tryParseJsx(filePath, source);
  if (!parsed.ok) return parsed.error;
  const diagnostic = project.getProgram().compilerObject.getSyntacticDiagnostics(parsed.sourceFile.compilerNode)[0];
  if (!diagnostic) return undefined;
  const message = diagnostic.messageText;
  return typeof message === 'string' ? message : message.messageText;
}
