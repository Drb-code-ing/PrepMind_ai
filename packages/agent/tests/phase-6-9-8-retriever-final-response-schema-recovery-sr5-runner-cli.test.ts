import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  executePhase698RetrieverSchemaRecoverySr5RunnerCliCore,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RUN_ARGUMENT,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-cli-core.ts';

const ROOT_PREFIX = 'prepmind-sr5-runner-cli-';

describe('Phase 6.9.8 Retriever / FinalResponse SR5 runner CLI', () => {
  test('exposes only the bounded zero-provider commands', async () => {
    const lines: string[] = [];
    const code = await executePhase698RetrieverSchemaRecoverySr5RunnerCliCore(
      { args: ['--help'], root: process.cwd(), signal: new AbortController().signal },
      { write: (line) => lines.push(line) },
    );
    expect(code).toBe(0);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      mode: 'zero_provider_reviewed_mock_only',
      providerCalls: 0,
      credentialReads: 0,
      live: false,
      replay: false,
    });
  });

  test('runs one synthetic reviewed-Mock bundle and keeps accounting zero-provider', async () => {
    const root = await mkdtemp(join(tmpdir(), ROOT_PREFIX));
    const lines: string[] = [];
    try {
      const code = await executePhase698RetrieverSchemaRecoverySr5RunnerCliCore(
        {
          args: [PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RUN_ARGUMENT],
          root,
          signal: new AbortController().signal,
        },
        { write: (line) => lines.push(line) },
      );
      expect(code).toBe(0);
      expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
        ok: true,
        providerCalls: 0,
        credentialReads: 0,
        formalEvidence: 0,
        temporarySyntheticEvidence: 1,
        runtime: { dispatches: 12, verifiedUsage: 12 },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects live, credential and extra-argument attempts before ports execute', async () => {
    const lines: string[] = [];
    let touched = false;
    const code = await executePhase698RetrieverSchemaRecoverySr5RunnerCliCore(
      {
        args: [
          'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_CONTROLLED_LIVE_ONCE',
        ],
        root: process.cwd(),
        signal: new AbortController().signal,
      },
      {
        createAdmission: () => {
          touched = true;
          throw new Error('must not execute');
        },
        write: (line) => lines.push(line),
      },
    );
    expect(code).toBe(1);
    expect(touched).toBe(false);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      ok: false,
      code: 'cli_argument_invalid',
      providerCalls: 0,
      credentialReads: 0,
    });
  });
});
