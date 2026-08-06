import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_TASK9_SOURCE_SCHEMA,
  buildPhase698Task9Report,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-contract.ts';
import {
  PHASE_6_9_8_TASK9C_APPROVAL_ENV,
  PHASE_6_9_8_TASK9C_CRASH_SEAL_CONFIRMATION,
  PHASE_6_9_8_TASK9C_DATA_BOUNDARY_ACCEPTANCE,
  PHASE_6_9_8_TASK9C_DATA_BOUNDARY_ENV,
  PHASE_6_9_8_TASK9C_EXACT_CONFIRMATION,
  PHASE_6_9_8_TASK9C_FINAL_RESPONSE_CREDENTIAL_ENV,
  PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV,
  PHASE_6_9_8_TASK9C_REWRITE_CREDENTIAL_ENV,
  executePhase698Task9CliCore,
  readPhase698Task9Approval,
  readPhase698Task9Credential,
  readPhase698Task9DataBoundary,
  type Phase698Task9CliCorePorts,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-cli-core.ts';
import { buildPhase698Task9BReviewedMockCheckpoint } from '../src/evals/phase-6-9-8-retriever-final-response-task9-reviewed-mock.ts';
import { createPhase698Task9SyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-task9-source-admission.ts';

const RUN_ID = '00000000-0000-4000-8000-000000000099';
const CREATED_AT_MS = Date.parse('2026-08-05T00:00:00.000Z');

describe('Phase 6.9.8 Task 9B CLI and admission boundary', () => {
  test('executes the fixed admission order and emits no credential material', async () => {
    const order: string[] = [];
    const output: string[] = [];
    const secret = 'task9-test-secret-never-print';
    const env = authorizationEnv(secret);
    const fixture = await controlledFixture();
    const ports = cliPorts(order, output, fixture);

    const exitCode = await executePhase698Task9CliCore(
      {
        args: [PHASE_6_9_8_TASK9C_EXACT_CONFIRMATION],
        root: process.cwd(),
        authorizationEnv: env,
        signal: new AbortController().signal,
      },
      ports,
    );

    expect(exitCode).toBe(0);
    expect(order).toEqual([
      'source',
      'data_boundary',
      'approval',
      'rewrite_credential',
      'final_response_credential',
      'qwen_credential',
      'uuid',
      'now',
      'reserve',
      'create_harness',
      'run',
      'publish',
      'validate',
      'write',
    ]);
    expect(output).toHaveLength(1);
    expect(output[0]).not.toContain(secret);
    expect(JSON.parse(output[0]!)).toMatchObject({
      ok: true,
      evidenceSealed: true,
      authority: 'controlled_live',
      qualityAuthority: 'retriever_final_response_semantic_gate',
      runId: RUN_ID,
    });
  });

  test('rejects wrong argv before source, authorization, credentials, marker, or Provider', async () => {
    const order: string[] = [];
    const output: string[] = [];
    const fixture = await controlledFixture();

    const exitCode = await executePhase698Task9CliCore(
      {
        args: ['continue'],
        root: process.cwd(),
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      cliPorts(order, output, fixture),
    );

    expect(exitCode).toBe(1);
    expect(order).toEqual(['write']);
    expect(JSON.parse(output[0]!)).toMatchObject({
      ok: false,
      code: 'cli_argument_invalid',
      providerCalls: 0,
      credentialReads: 0,
    });
  });

  test('requires source parity before fresh data acceptance and exact one-shot approval', async () => {
    const order: string[] = [];
    const output: string[] = [];
    const fixture = await controlledFixture();
    const env = authorizationEnv('safe-test-secret');
    delete env[PHASE_6_9_8_TASK9C_DATA_BOUNDARY_ENV];

    const exitCode = await executePhase698Task9CliCore(
      {
        args: [PHASE_6_9_8_TASK9C_EXACT_CONFIRMATION],
        root: process.cwd(),
        authorizationEnv: env,
        signal: new AbortController().signal,
      },
      cliPorts(order, output, fixture),
    );

    expect(exitCode).toBe(1);
    expect(order).toEqual(['source', 'data_boundary', 'write']);
    expect(JSON.parse(output[0]!)).toMatchObject({
      code: 'data_boundary_not_accepted',
      providerCalls: 0,
      credentialReads: 0,
    });
  });

  test('counts partial dedicated credential reads and never reserves after configuration failure', async () => {
    const order: string[] = [];
    const output: string[] = [];
    const fixture = await controlledFixture();
    const env = authorizationEnv('safe-test-secret');
    delete env[PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV];

    const exitCode = await executePhase698Task9CliCore(
      {
        args: [PHASE_6_9_8_TASK9C_EXACT_CONFIRMATION],
        root: process.cwd(),
        authorizationEnv: env,
        signal: new AbortController().signal,
      },
      cliPorts(order, output, fixture),
    );

    expect(exitCode).toBe(1);
    expect(order).toEqual([
      'source',
      'data_boundary',
      'approval',
      'rewrite_credential',
      'final_response_credential',
      'qwen_credential',
      'write',
    ]);
    expect(JSON.parse(output[0]!)).toMatchObject({
      code: 'live_configuration_invalid',
      providerCalls: 0,
      credentialReads: 2,
    });
  });

  test('crash-only seal is isolated from source, authorization, credentials, and Provider', async () => {
    const order: string[] = [];
    const output: string[] = [];
    const fixture = await controlledFixture();
    const ports = cliPorts(order, output, fixture, {
      seal: async () => {
        order.push('seal');
        return { ok: false as const, code: 'marker_missing_or_invalid' as const };
      },
    });

    const exitCode = await executePhase698Task9CliCore(
      {
        args: [PHASE_6_9_8_TASK9C_CRASH_SEAL_CONFIRMATION],
        root: process.cwd(),
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      ports,
    );

    expect(exitCode).toBe(1);
    expect(order).toEqual(['seal', 'write']);
    expect(JSON.parse(output[0]!)).toMatchObject({
      providerCalls: 0,
      evidenceSealed: false,
      code: 'marker_missing_or_invalid',
    });
  });

  test('credential and approval readers reject accessor-backed or malformed environment values', () => {
    let getterCalls = 0;
    const hostile = {} as Record<string, string | undefined>;
    Object.defineProperty(hostile, PHASE_6_9_8_TASK9C_REWRITE_CREDENTIAL_ENV, {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'must-not-be-read';
      },
    });

    expect(() =>
      readPhase698Task9Credential(hostile, PHASE_6_9_8_TASK9C_REWRITE_CREDENTIAL_ENV),
    ).toThrow('PHASE_6_9_8_TASK9_CREDENTIAL_INVALID');
    expect(getterCalls).toBe(0);
    expect(() => readPhase698Task9DataBoundary({})).toThrow();
    expect(() => readPhase698Task9Approval({})).toThrow();
    expect(() =>
      readPhase698Task9Credential(
        { [PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV]: ' contains-space ' },
        PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV,
      ),
    ).toThrow();
  });
});

async function controlledFixture() {
  const checkpoint = await buildPhase698Task9BReviewedMockCheckpoint();
  const synthetic = createPhase698Task9SyntheticAdmissionForTest().source;
  const source = PHASE_6_9_8_TASK9_SOURCE_SCHEMA.parse({
    ...synthetic,
    admissionAuthority: 'git_verified',
  });
  const report = buildPhase698Task9Report({
    runId: RUN_ID,
    authority: 'controlled_live',
    completionMode: 'runtime',
    source,
    credentialReads: 3,
    guardEntries: checkpoint.report.guardEntries,
    callEntries: checkpoint.report.callEntries.map((entry) => ({
      ...entry,
      transportAuthority: 'external_provider' as const,
    })),
    rewriteEntries: checkpoint.report.rewriteEntries,
    finalResponseEntries: checkpoint.report.finalResponseEntries,
  });
  return Object.freeze({ source, report });
}

function cliPorts(
  order: string[],
  output: string[],
  fixture: Awaited<ReturnType<typeof controlledFixture>>,
  overrides: Partial<Phase698Task9CliCorePorts> = {},
): Phase698Task9CliCorePorts {
  const ports: Phase698Task9CliCorePorts = {
    authority: 'controlled_live',
    readSource() {
      order.push('source');
      return Object.freeze({
        source: fixture.source,
        capability: Object.freeze({
          version: 'phase-6.9.8-retriever-final-response-task9-admission-capability-v1',
        }),
        reservationCapability: Object.freeze({
          version: 'phase-6.9.8-retriever-final-response-task9-reservation-admission-capability-v1',
        }),
      });
    },
    readDataBoundary(env) {
      order.push('data_boundary');
      return readPhase698Task9DataBoundary(env);
    },
    readApproval(env) {
      order.push('approval');
      return readPhase698Task9Approval(env);
    },
    readRewriteCredential(env) {
      order.push('rewrite_credential');
      return readPhase698Task9Credential(env, PHASE_6_9_8_TASK9C_REWRITE_CREDENTIAL_ENV);
    },
    readFinalResponseCredential(env) {
      order.push('final_response_credential');
      return readPhase698Task9Credential(env, PHASE_6_9_8_TASK9C_FINAL_RESPONSE_CREDENTIAL_ENV);
    },
    readQwenCredential(env) {
      order.push('qwen_credential');
      return readPhase698Task9Credential(env, PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV);
    },
    async reserve(input) {
      order.push('reserve');
      return Object.freeze({
        runId: input.runId,
        markerRelativePath:
          '.tmp/phase-6-9-8-retriever-final-response-task9c-controlled-live.marker',
        journalRelativePath: `.tmp/fake-${input.runId}.journal.jsonl`,
        lifecycle: noopLifecycle(input.runId),
        async publishArtifact() {
          order.push('publish');
          return Object.freeze({ relativePath: '.tmp/fake.json', evidenceSha256: 'a'.repeat(64) });
        },
      });
    },
    createHarness() {
      order.push('create_harness');
      return Object.freeze({
        transportAuthority: 'external_provider' as const,
        runGuard: async () => {
          throw new Error('not invoked by CLI unit port');
        },
        invokeCall: async () => {
          throw new Error('not invoked by CLI unit port');
        },
      });
    },
    async run() {
      order.push('run');
      return fixture.report;
    },
    async validate() {
      order.push('validate');
      return Object.freeze({
        ok: true,
        runId: RUN_ID,
        gate: fixture.report.gate,
        journalRecords: 372,
        finalJournalEvent: 'evidence_published',
        reportLogicalSha256: 'b'.repeat(64),
        physicalArtifactSha256: 'a'.repeat(64),
      });
    },
    seal: async () => ({ ok: false as const, code: 'marker_missing_or_invalid' as const }),
    randomUUID() {
      order.push('uuid');
      return RUN_ID;
    },
    now() {
      order.push('now');
      return CREATED_AT_MS;
    },
    write(line) {
      order.push('write');
      output.push(line);
    },
  };
  return Object.freeze({ ...ports, ...overrides });
}

function noopLifecycle(runId: string) {
  return Object.freeze({
    runId,
    appendGuardTerminal: async () => undefined,
    reserveCall: async () => Object.freeze({ appendWireStage: async () => undefined }),
    appendCallTerminal: async () => undefined,
    appendRewriteTerminal: async () => undefined,
    appendFinalTerminal: async () => undefined,
    appendRunTerminal: async () => undefined,
  });
}

function authorizationEnv(secret: string) {
  return {
    [PHASE_6_9_8_TASK9C_DATA_BOUNDARY_ENV]: PHASE_6_9_8_TASK9C_DATA_BOUNDARY_ACCEPTANCE,
    [PHASE_6_9_8_TASK9C_APPROVAL_ENV]: PHASE_6_9_8_TASK9C_EXACT_CONFIRMATION,
    [PHASE_6_9_8_TASK9C_REWRITE_CREDENTIAL_ENV]: secret,
    [PHASE_6_9_8_TASK9C_FINAL_RESPONSE_CREDENTIAL_ENV]: secret,
    [PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV]: secret,
  };
}
