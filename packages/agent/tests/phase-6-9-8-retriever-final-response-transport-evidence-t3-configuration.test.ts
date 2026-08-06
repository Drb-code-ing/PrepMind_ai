import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

const PACKAGE_DIR = resolve(import.meta.dir, '..');
const REPOSITORY_ROOT = resolve(PACKAGE_DIR, '../..');
const PACKAGE_JSON_PATH = resolve(PACKAGE_DIR, 'package.json');
const CONTROLLED_SCRIPT_PATH = resolve(
  PACKAGE_DIR,
  'scripts/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-cli.ts',
);
const SEAL_SCRIPT_PATH = resolve(
  PACKAGE_DIR,
  'scripts/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-seal-cli.ts',
);

describe('Phase 6.9.8 T3 configuration composition', () => {
  test('binds the controlled package command to the repository root .env', async () => {
    const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8')) as {
      scripts?: Record<string, unknown>;
    };
    const command = packageJson.scripts?.[
      'eval:phase-6-9-8:transport-evidence:t3:controlled'
    ];

    expect(typeof command).toBe('string');
    expect(command).toContain('bun --env-file=../../.env');
    expect(resolve(PACKAGE_DIR, '../../.env')).toBe(resolve(REPOSITORY_ROOT, '.env'));
  });

  test('keeps the crash-only seal entry free of credential composition and Provider ports', async () => {
    const [controlledSource, sealSource] = await Promise.all([
      readFile(CONTROLLED_SCRIPT_PATH, 'utf8'),
      readFile(SEAL_SCRIPT_PATH, 'utf8'),
    ]);

    expect(controlledSource).not.toContain('DEEPSEEK_API_KEY=');
    expect(controlledSource).not.toContain('Qwen_API_KEY=');
    expect(sealSource).not.toContain('process.env');
    expect(sealSource).not.toContain('DEEPSEEK_API_KEY');
    expect(sealSource).not.toContain('Qwen_API_KEY');
    expect(sealSource).not.toContain('fetch(');
    expect(sealSource).toContain('I_SEAL_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_CONTROLLED_CRASH_ONLY_ONCE');
  });
});
