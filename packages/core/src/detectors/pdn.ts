import { analyzeSource, type SourceAnalysis } from '../analysis.js';

export function hasPiiForm(source: string): boolean {
  return analyzeSource('snippet.html', source).forms.some((form) => form.hasPii);
}

export function hasConsentControl(source: string): boolean {
  return analyzeSource('snippet.html', source).forms.some((form) => form.hasConsent);
}

export function collectsPdn(files: { source: string; relativePath?: string; filePath?: string; analysis?: SourceAnalysis }[]): boolean {
  return files.some((file) => (file.analysis ?? analyzeSource(file.filePath ?? file.relativePath ?? 'snippet.html', file.source))
    .forms.some((form) => form.hasPii));
}
