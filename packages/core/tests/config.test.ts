import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadScanConfig } from '../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('loadScanConfig', () => {
  it('returns defaults when the file is missing', () => {
    const { config, warnings } = loadScanConfig(path.join(here, 'fixtures/empty-project'));
    expect(config).toEqual({ ignore: [], disabled: [], severity: {}, suppress: [] });
    expect(warnings).toEqual([]);
  });

  it('throws ConfigError on invalid JSON', () => {
    expect(() => loadScanConfig(path.join(here, 'fixtures/config-invalid'))).toThrow(ConfigError);
    expect(() => loadScanConfig(path.join(here, 'fixtures/config-invalid'))).toThrow(
      'Некорректный legitagent.config.json',
    );
  });

  it('loads baseline and reasoned suppressions and warns about unsafe entries', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legitagent-config-'));
    fs.writeFileSync(
      path.join(root, 'legitagent.config.json'),
      JSON.stringify({
        $schema: './config.schema.json',
        baseline: '.legitagent-baseline.json',
        cache: true,
        typo: true,
        suppress: [
          { ruleId: 'PDN.COOKIE.NO_REJECT', file: 'src/**', reason: 'accepted', expires: '2026-12-31' },
          { ruleId: 'PDN.FORM.NO_CONSENT' },
        ],
      }),
    );
    const { config, warnings } = loadScanConfig(root);
    expect(config.baseline).toBe('.legitagent-baseline.json');
    expect(config.cache).toBe(true);
    expect(config.suppress).toEqual([
      { ruleId: 'PDN.COOKIE.NO_REJECT', file: 'src/**', reason: 'accepted', expires: '2026-12-31' },
    ]);
    expect(warnings.some((warning) => warning.message.includes('нужна причина'))).toBe(true);
    expect(warnings.some((warning) => warning.message.includes('Неизвестное поле: typo'))).toBe(true);
  });
});
