import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  preparePhase698TransportReentryV2C1Projection,
  preparePhase698TransportReentryV2C1ProjectionFromRootEnv,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts';
import {
  consumePhase698TransportReentryV2DedicatedCapability,
  inspectPhase698TransportReentryV2Preflight,
  makePhase698TransportReentryV2SyntheticPreflightInput,
  parsePhase698TransportReentryV2DotEnv,
  parsePhase698TransportReentryV2DotEnvBytes,
  readPhase698TransportReentryV2GenericCredentials,
  resolvePhase698TransportReentryV2RepositoryRoot,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';

const PACKAGE_DIR = resolve(import.meta.dir, '..');
const PACKAGE_JSON_PATH = resolve(PACKAGE_DIR, 'package.json');
const C1_SCRIPT_PATH = resolve(
  PACKAGE_DIR,
  'scripts/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts',
);

function expectFailure(value: unknown, reasonCode: string) {
  expect(value).toEqual({ ok: false, reasonCode });
}

describe('Phase 6.9.8 Transport Re-entry V2 C1 parser', () => {
  test('accepts UTF-8 BOM, CRLF, LF and bounded single/double quoted values', () => {
    const input =
      '\uFEFF# fixture\r\nDEEPSEEK_API_KEY=deepseek-fixture\r\nQWEN_API_KEY="qwen-fixture"\n';
    expect(parsePhase698TransportReentryV2DotEnv(input)).toEqual({
      ok: true,
      values: { DEEPSEEK_API_KEY: 'deepseek-fixture', QWEN_API_KEY: 'qwen-fixture' },
    });
    expect(parsePhase698TransportReentryV2DotEnvBytes(new TextEncoder().encode(input))).toEqual({
      ok: true,
      values: { DEEPSEEK_API_KEY: 'deepseek-fixture', QWEN_API_KEY: 'qwen-fixture' },
    });
  });

  test('fails closed for duplicate, unknown, empty, interpolation and non-ASCII fields', () => {
    expectFailure(
      parsePhase698TransportReentryV2DotEnv('DEEPSEEK_API_KEY=one\nDEEPSEEK_API_KEY=two'),
      'duplicate_key',
    );
    expectFailure(parsePhase698TransportReentryV2DotEnv('OTHER_KEY=value'), 'unknown_key');
    expectFailure(parsePhase698TransportReentryV2DotEnv('QWEN_API_KEY='), 'empty_value');
    expectFailure(parsePhase698TransportReentryV2DotEnv('QWEN_API_KEY=${HOST}'), 'interpolation');
    expectFailure(parsePhase698TransportReentryV2DotEnv('QWEN_API_KEY=密钥'), 'non_ascii');
  });

  test('fails closed for multiline and malformed quoted values', () => {
    expectFailure(parsePhase698TransportReentryV2DotEnv('QWEN_API_KEY="line\\\nnext'), 'multiline');
    expectFailure(parsePhase698TransportReentryV2DotEnv('QWEN_API_KEY="unterminated'), 'multiline');
    expectFailure(parsePhase698TransportReentryV2DotEnv('QWEN_API_KEY="a"tail'), 'multiline');
    expectFailure(parsePhase698TransportReentryV2DotEnv('QWEN_API_KEY= value'), 'invalid_line');
    expectFailure(parsePhase698TransportReentryV2DotEnv('QWEN_API_KEY=value\rnext'), 'multiline');
  });

  test('accepts only own data properties and rejects accessor/extra-field objects', () => {
    const accessor = Object.defineProperty({}, 'DEEPSEEK_API_KEY', {
      enumerable: true,
      get: () => 'secret',
    });
    Object.defineProperty(accessor, 'QWEN_API_KEY', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'qwen',
    });
    expectFailure(readPhase698TransportReentryV2GenericCredentials(accessor), 'accessor_input');
    expectFailure(
      readPhase698TransportReentryV2GenericCredentials({
        DEEPSEEK_API_KEY: 'deepseek',
        QWEN_API_KEY: 'qwen',
        OTHER_AGENT_KEY: 'must-not-enter',
      }),
      'extra_field',
    );
    expectFailure(
      readPhase698TransportReentryV2GenericCredentials({ DEEPSEEK_API_KEY: 'deepseek' }),
      'credential_missing',
    );
  });
});

describe('Phase 6.9.8 Transport Re-entry V2 C1 path and gate ordering', () => {
  test('package entry uses the launcher contract without ambient bun env injection', async () => {
    const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8')) as {
      scripts?: Record<string, unknown>;
      exports?: Record<string, unknown>;
    };
    const command = packageJson.scripts?.['eval:phase-6-9-8:transport-reentry:v2:c1'];
    expect(command).toBe(
      'bun scripts/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts',
    );
    expect(String(command)).not.toContain('--env-file');
    expect(packageJson.exports?.['./transport-reentry-v2-c1']).toBe(
      './src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts',
    );
    const script = await readFile(C1_SCRIPT_PATH, 'utf8');
    expect(script).not.toContain('process.env');
  });

  test('resolves the repository from launcher location independent of package cwd', () => {
    const expectedRoot = resolve(PACKAGE_DIR, '../..');
    expect(
      resolvePhase698TransportReentryV2RepositoryRoot(resolve(PACKAGE_DIR, 'scripts/future.ts')),
    ).toBe(expectedRoot);
    expect(
      resolvePhase698TransportReentryV2RepositoryRoot(
        new URL('../scripts/future.ts', import.meta.url),
      ),
    ).toBe(expectedRoot);
  });

  test('does not inspect a hostile credential accessor when preflight is blocked', () => {
    let getterCalls = 0;
    const hostile = Object.defineProperty({}, 'DEEPSEEK_API_KEY', {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 'hostile';
      },
    });
    Object.defineProperty(hostile, 'QWEN_API_KEY', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'hostile-qwen',
    });
    const blocked = makePhase698TransportReentryV2SyntheticPreflightInput({
      authorization: 'wrong',
    });
    expectFailure(preparePhase698TransportReentryV2C1Projection(blocked, hostile), 'gate_invalid');
    expect(getterCalls).toBe(0);
  });

  test('hostile ambient process.env cannot replace the launcher-file fixture', () => {
    const originalDeepseek = process.env.DEEPSEEK_API_KEY;
    const originalQwen = process.env.QWEN_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'ambient-hostile-deepseek';
    process.env.QWEN_API_KEY = 'ambient-hostile-qwen';
    try {
      const preflight = makePhase698TransportReentryV2SyntheticPreflightInput();
      let requestedPath = '';
      const result = preparePhase698TransportReentryV2C1ProjectionFromRootEnv(
        preflight,
        resolve(PACKAGE_DIR, 'scripts/future.ts'),
        (path) => {
          requestedPath = path;
          return new TextEncoder().encode(
            'DEEPSEEK_API_KEY=file-deepseek\nQWEN_API_KEY=file-qwen\n',
          );
        },
      );
      expect(result.ok).toBe(true);
      expect(requestedPath).toBe(resolve(PACKAGE_DIR, '../../.env'));
      if (!result.ok) return;
      expect(result.projection.lineage).toBe(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE);
      const consumed = consumePhase698TransportReentryV2DedicatedCapability(
        result.projection.rewrite,
        'rewrite',
        PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.rewrite,
      );
      expect(consumed).toMatchObject({ credentialAvailable: true });
      expect(consumed && typeof consumed === 'object' && 'apiKey' in consumed).toBe(false);
    } finally {
      if (originalDeepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = originalDeepseek;
      if (originalQwen === undefined) delete process.env.QWEN_API_KEY;
      else process.env.QWEN_API_KEY = originalQwen;
    }
  });

  test('issues opaque dedicated capabilities with single-use and family/call binding', () => {
    const result = preparePhase698TransportReentryV2C1Projection(
      makePhase698TransportReentryV2SyntheticPreflightInput(),
      { DEEPSEEK_API_KEY: 'deepseek-file', QWEN_API_KEY: 'qwen-file' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.projection.rewrite)).toEqual([
      'version',
      'lineage',
      'family',
      'callId',
    ]);
    expect('apiKey' in result.projection.rewrite).toBe(false);
    expect(
      consumePhase698TransportReentryV2DedicatedCapability(
        result.projection.rewrite,
        'rewrite',
        'rewrite_01',
      ),
    ).toMatchObject({ family: 'rewrite', callId: 'rewrite_01', credentialAvailable: true });
    expectFailure(
      consumePhase698TransportReentryV2DedicatedCapability(
        result.projection.rewrite,
        'rewrite',
        'rewrite_01',
      ),
      'capability_reused',
    );
    expectFailure(
      consumePhase698TransportReentryV2DedicatedCapability(
        result.projection.qwen,
        'rewrite',
        'qwen_01',
      ),
      'family_mismatch',
    );
    expectFailure(
      consumePhase698TransportReentryV2DedicatedCapability(
        result.projection.final_response,
        'final_response',
        'wrong_01',
      ),
      'call_mismatch',
    );
    expectFailure(
      consumePhase698TransportReentryV2DedicatedCapability(
        {
          version: result.projection.qwen.version,
          lineage: result.projection.qwen.lineage,
          family: 'qwen',
          callId: 'qwen_01',
        },
        'qwen',
        'qwen_01',
      ),
      'capability_invalid',
    );
  });

  test('preflight rejects source drift and non-zero provider calls', () => {
    const sourceDrift = makePhase698TransportReentryV2SyntheticPreflightInput({
      source: {
        ...makePhase698TransportReentryV2SyntheticPreflightInput().source,
        remoteCommit: '1'.repeat(40),
      },
    });
    expectFailure(inspectPhase698TransportReentryV2Preflight(sourceDrift), 'gate_invalid');
    expectFailure(
      inspectPhase698TransportReentryV2Preflight(
        makePhase698TransportReentryV2SyntheticPreflightInput({
          proxy: { code: 'direct_ready', providerCalls: 1, listenerProbeCalls: 0 },
        }),
      ),
      'gate_invalid',
    );
  });
});
