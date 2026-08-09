import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_VALIDATE_ARGUMENT,
  executePhase698RetrieverSchemaRecoverySr3CliCore,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-cli-core.ts';

const signal = new AbortController().signal;

describe('Phase 6.9.8 Retriever Schema Recovery SR3 CLI boundary', () => {
  test('exposes a strict zero-provider validate command without entering source or runner', async () => {
    const output: string[] = [];
    let validateCalls = 0;
    let sourceCalls = 0;
    const code = await executePhase698RetrieverSchemaRecoverySr3CliCore(
      { args: [PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_VALIDATE_ARGUMENT], root: 'root', signal },
      {
        validate: () => {
          validateCalls += 1;
          return {
            ok: true,
            runId: '00000000-0000-4000-8000-000000000013',
            gate: {
              status: 'schema_recovery_mock_quality_not_evidence',
              passed: true,
              qualityAuthority: 'none',
              failureReasons: [],
            },
            qualityAuthority: 'none',
            journalRecords: 72,
            finalJournalEvent: 'evidence_published',
            reportLogicalSha256: 'a'.repeat(64),
            physicalArtifactSha256: 'b'.repeat(64),
            providerCalls: 0,
            credentialReads: 0,
          } as const;
        },
        readSource: () => {
          sourceCalls += 1;
          throw new Error('must not read source for validate');
        },
        write: (line) => output.push(line),
      },
    );
    expect(code).toBe(0);
    expect(validateCalls).toBe(1);
    expect(sourceCalls).toBe(0);
    expect(JSON.parse(output[0] ?? '{}')).toMatchObject({ operation: 'validate', ok: true });
  });

  test('rejects extra arguments before any boundary reader', async () => {
    const output: string[] = [];
    let sourceCalls = 0;
    const code = await executePhase698RetrieverSchemaRecoverySr3CliCore(
      {
        args: [PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_VALIDATE_ARGUMENT, 'extra'],
        root: 'root',
        signal,
      },
      {
        readSource: () => {
          sourceCalls += 1;
          throw new Error('must not read source');
        },
        write: (line) => output.push(line),
      },
    );
    expect(code).toBe(1);
    expect(sourceCalls).toBe(0);
    expect(JSON.parse(output[0] ?? '{}')).toMatchObject({ code: 'cli_argument_invalid' });
  });
});
