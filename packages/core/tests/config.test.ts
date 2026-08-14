import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadScanConfig } from '../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('loadScanConfig', () => {
  it('returns defaults when the file is missing', () => {
    const { config, warnings } = loadScanConfig(path.join(here, 'fixtures/empty-project'));
    expect(config).toEqual({ ignore: [], disabled: [], severity: {} });
    expect(warnings).toEqual([]);
  });

  it('throws ConfigError on invalid JSON', () => {
    expect(() => loadScanConfig(path.join(here, 'fixtures/config-invalid'))).toThrow(ConfigError);
    expect(() => loadScanConfig(path.join(here, 'fixtures/config-invalid'))).toThrow(
      'Некорректный legitagent.config.json',
    );
  });
});
