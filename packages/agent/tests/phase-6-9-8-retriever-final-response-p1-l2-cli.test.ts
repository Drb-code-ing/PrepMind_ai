import {
  readPhase698P1L2RootCredentialProjection,
  safePhase698P1L2CliResult,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-cli-core.ts';
import {
  createPhase698P1L2SyntheticRootForTest,
  removePhase698P1L2SyntheticRootForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-durability.ts';
import { describe, expect, test } from 'bun:test';

describe('Phase 6.9.8 P1 L2 controlled CLI boundary', () => {
  test('projects only the two owned credential capabilities and accepts equal Qwen aliases', async () => {
    const root = await createPhase698P1L2SyntheticRootForTest();
    try {
      await Bun.write(
        `${root}/.env`,
        [
          'DATABASE_URL=ignored',
          'DEEPSEEK_API_KEY=deepseek-test',
          'QWEN_API_KEY=qwen-test',
          'Qwen_API_KEY=qwen-test',
          'UNRELATED_SECRET=ignored',
        ].join('\n'),
      );
      const result = await readPhase698P1L2RootCredentialProjection(root);
      expect(result).toEqual({
        ok: true,
        credentials: {
          deepseekApiKey: 'deepseek-test',
          qwenApiKey: 'qwen-test',
          credentialReads: 2,
        },
      });
    } finally {
      await removePhase698P1L2SyntheticRootForTest(root);
    }
  });

  test('fails closed on missing, conflicting, or malformed owned aliases', async () => {
    const root = await createPhase698P1L2SyntheticRootForTest();
    try {
      await Bun.write(
        `${root}/.env`,
        'DEEPSEEK_API_KEY=deepseek\nQWEN_API_KEY=one\nQwen_API_KEY=two\n',
      );
      expect(await readPhase698P1L2RootCredentialProjection(root)).toEqual({
        ok: false,
        code: 'alias_conflict',
      });
      await Bun.write(`${root}/.env`, 'DEEPSEEK_API_KEY=deepseek\nQWEN_API_KEY=bad value\n');
      expect(await readPhase698P1L2RootCredentialProjection(root)).toEqual({
        ok: false,
        code: 'credential_configuration_invalid',
      });
      await Bun.write(`${root}/.env`, 'DEEPSEEK_API_KEY=deepseek\n');
      expect(await readPhase698P1L2RootCredentialProjection(root)).toEqual({
        ok: false,
        code: 'credential_missing',
      });
    } finally {
      await removePhase698P1L2SyntheticRootForTest(root);
    }
  });

  test('safe result omits credential material and arbitrary fields', () => {
    const output = safePhase698P1L2CliResult({
      ok: false,
      code: 'credential_missing',
      runId: 'run-id',
      providerCalls: 0,
      credentialReads: 0,
      verifiedCostCny: null,
      gate: 'none',
    });
    expect(output).not.toContain('deepseek');
    expect(output).not.toContain('qwen');
    expect(JSON.parse(output)).toEqual({
      ok: false,
      code: 'credential_missing',
      runId: 'run-id',
      providerCalls: 0,
      credentialReads: 0,
      verifiedCostCny: null,
      gate: 'none',
    });
  });
});
