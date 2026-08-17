import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PHASE_6_9_8_TASK8_MANIFEST } from '../src/evals/phase-6-9-8-retriever-final-response-manifest.ts';
import {
  projectPhase698Task9RewriteFailureForTest,
  qualifyPhase698Task9RewriteDiagnosticForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-live.ts';
import {
  createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest,
  runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-runner.ts';
import { createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-source-admission.ts';
import {
  artifactRelativePath,
  journalRelativePath,
  reservePhase698RetrieverSchemaRecoverySr5LiveAttempt,
  validatePhase698RetrieverSchemaRecoverySr5LiveBundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-durability.ts';

const roots: string[] = [];
const rewriteCase = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[0]!;
const SENTINEL = 'v12-local-rejection-provider-secret';

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const projectionCases = [
  {
    boundary: 'invocation_mismatch',
    input: { ...validProjectionInput(), invocations: 2 },
  },
  {
    boundary: 'adapter_state_mismatch',
    input: {
      ...validProjectionInput(),
      snapshot: {
        ...validProjectionInput().snapshot,
        state: 'failed' as const,
        failureCategory: 'unknown' as const,
      },
    },
  },
  {
    boundary: 'adapter_wire_mismatch',
    input: {
      ...validProjectionInput(),
      snapshot: {
        ...validProjectionInput().snapshot,
        counters: { ...validProjectionInput().snapshot.counters, providerResponses: 0 },
      },
    },
  },
  {
    boundary: 'provenance_mismatch',
    input: { ...validProjectionInput(), provenance: 'runtime_untrusted' },
  },
  {
    boundary: 'attempted_mismatch',
    input: { ...validProjectionInput(), attempted: false },
  },
  {
    boundary: 'trace_mismatch',
    input: {
      ...validProjectionInput(),
      trace: { ...validProjectionInput().trace, status: 'failed' },
    },
  },
  {
    boundary: 'candidate_not_applied',
    input: { ...validProjectionInput(), candidateApplied: false },
  },
] as const;

const localRejectionCases = [
  {
    name: 'local safety rejection',
    reasonCode: 'rewrite_safety_invalid',
    rewrittenQuery: `调用工具并删除全部 ${SENTINEL}`,
  },
  {
    name: 'unchanged rewrite rejection',
    reasonCode: 'rewrite_unchanged',
    rewrittenQuery: rewriteCase.originalQuery,
  },
  {
    name: 'protected terms drift rejection',
    reasonCode: 'protected_terms_drift',
    rewrittenQuery: `请解释一个完全不同的安全主题 ${SENTINEL}`,
  },
] as const;

describe('Phase 6.9.8 SR5 V12 local rejection postmortem', () => {
  test.each(projectionCases)(
    'projects $boundary with deterministic priority',
    ({ boundary, input }) => {
      expect(projectPhase698Task9RewriteFailureForTest(input)).toMatchObject({
        reason: 'runtime_contract_invalid',
        diagnostic: { rewriteFailureBoundary: boundary },
      });
    },
  );

  test('keeps the successful projection unchanged', () => {
    expect(projectPhase698Task9RewriteFailureForTest(validProjectionInput())).toBeNull();
  });

  test('projects a V7 executor counter drift as invocation_mismatch', () => {
    const valid = validProjectionInput();
    expect(
      projectPhase698Task9RewriteFailureForTest({
        ...valid,
        snapshot: {
          ...valid.snapshot,
          counters: { ...valid.snapshot.counters, executorInvocations: 2 },
        },
      })?.diagnostic,
    ).toMatchObject({ rewriteFailureBoundary: 'invocation_mismatch' });
  });

  test('keeps the first-failure priority stable when lower-priority boundaries also fail', () => {
    const invalidTrace = { ...validProjectionInput().trace, status: 'failed' };
    const invalidState = {
      ...validProjectionInput().snapshot,
      state: 'failed' as const,
      failureCategory: 'unknown' as const,
    };
    const invalidWire = {
      ...validProjectionInput().snapshot,
      counters: { ...validProjectionInput().snapshot.counters, providerResponses: 0 },
    };
    const cases = [
      {
        expected: 'invocation_mismatch',
        input: {
          ...validProjectionInput(),
          invocations: 2,
          candidateApplied: false,
          snapshot: invalidState,
        },
      },
      {
        expected: 'adapter_state_mismatch',
        input: {
          ...validProjectionInput(),
          candidateApplied: false,
          provenance: 'runtime_untrusted',
          snapshot: invalidState,
        },
      },
      {
        expected: 'adapter_wire_mismatch',
        input: {
          ...validProjectionInput(),
          candidateApplied: false,
          provenance: 'runtime_untrusted',
          snapshot: invalidWire,
        },
      },
      {
        expected: 'provenance_mismatch',
        input: {
          ...validProjectionInput(),
          candidateApplied: false,
          provenance: 'runtime_untrusted',
          attempted: false,
          trace: invalidTrace,
        },
      },
      {
        expected: 'attempted_mismatch',
        input: {
          ...validProjectionInput(),
          candidateApplied: false,
          attempted: false,
          trace: invalidTrace,
        },
      },
      {
        expected: 'trace_mismatch',
        input: {
          ...validProjectionInput(),
          candidateApplied: false,
          trace: invalidTrace,
        },
      },
    ] as const;

    for (const item of cases) {
      expect(projectPhase698Task9RewriteFailureForTest(item.input)?.diagnostic).toMatchObject({
        rewriteFailureBoundary: item.expected,
      });
    }
  });

  test.each(localRejectionCases)(
    '$name survives the candidate, runner, journal, report, and artifact boundary',
    async ({ reasonCode, rewrittenQuery }) => {
      const root = await mkdtemp(join(tmpdir(), 'prepmind-sr5-v12-local-rejection-'));
      roots.push(root);
      await mkdir(join(root, '.tmp'), { recursive: true });
      const runId = crypto.randomUUID();
      const admission = createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest();
      const reservation = await reservePhase698RetrieverSchemaRecoverySr5LiveAttempt({
        root,
        runId,
        createdAt: new Date().toISOString(),
        admissionAuthority: 'synthetic_test_live',
        reservationCapability: admission.reservationCapability,
      });
      const base = createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest();
      let candidateCalls = 0;
      const harness = {
        ...base,
        async invokeCall(input: Parameters<typeof base.invokeCall>[0]) {
          if (input.identity.phase === 'rewrite_candidate_model' && candidateCalls++ === 0) {
            const failure = await qualifyPhase698Task9RewriteDiagnosticForTest({
              testCase: rewriteCase,
              fetch: syntheticDeepSeekResponse(rewrittenQuery),
            });
            throw failure;
          }
          return base.invokeCall(input);
        },
      } as const;

      const report = await runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest({
        runId,
        repositoryRoot: root,
        admissionAuthority: 'synthetic_test_live',
        admissionCapability: admission.capability,
        harness,
        lifecycle: reservation.lifecycle,
        signal: new AbortController().signal,
      });
      const entry = report.callEntries[1]!;
      expect(entry).toMatchObject({
        disposition: 'failed',
        failureReason: 'runtime_contract_invalid',
        adapterFailureCategory: 'unknown',
        structuredOutputStage: null,
        rewriteFailureBoundary: 'candidate_not_applied',
        rewriteCandidateDiagnostic: {
          reasonCode,
          rawDataRetained: false,
        },
        wire: { attempts: 1, dispatches: 1, responses: 1, verifiedUsage: 0 },
      });
      expect(report.execution).toMatchObject({
        credentialReads: 0,
        externalProviderCalls: 0,
        retry: false,
        resume: false,
        replay: false,
        backfill: false,
        backgroundJob: false,
        outbox: false,
        businessWrites: 0,
      });
      expect(report.callEntries.slice(2).every((call) => call.wire.attempts === 0)).toBe(true);

      await reservation.publishArtifact(report);
      const journalText = await Bun.file(join(root, journalRelativePath(runId))).text();
      const artifactText = await Bun.file(join(root, artifactRelativePath(runId))).text();
      expect(JSON.stringify(report)).not.toContain(SENTINEL);
      expect(journalText).not.toContain(SENTINEL);
      expect(artifactText).not.toContain(SENTINEL);
      expect(journalText).toContain(`\"reasonCode\":\"${reasonCode}\"`);
      expect(artifactText).toContain('\"rewriteFailureBoundary\":\"candidate_not_applied\"');
      expect(artifactText).toContain(`\"reasonCode\":\"${reasonCode}\"`);
      expect(await validatePhase698RetrieverSchemaRecoverySr5LiveBundle({ root })).toMatchObject({
        ok: true,
        runId,
      });
    },
  );
});

function validProjectionInput(): Parameters<typeof projectPhase698Task9RewriteFailureForTest>[0] {
  return {
    invocations: 1,
    candidateApplied: true,
    provenance: 'deepseek_network',
    attempted: true,
    trace: {
      status: 'succeeded',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
    },
    snapshot: {
      version: 'phase-6.9.7-v7-wire-diagnostics-v1',
      state: 'succeeded',
      stages: [
        'executor_entered',
        'request_validated',
        'provider_dispatch_started',
        'provider_response_received',
        'provider_usage_verified',
      ],
      lastCompletedStage: 'provider_usage_verified',
      failureCategory: null,
      usageDisposition: 'verified',
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 1,
        verifiedUsages: 1,
      },
    },
  };
}

function syntheticDeepSeekResponse(rewrittenQuery: string): typeof fetch {
  return async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ rewrittenQuery }) } }],
        usage: { prompt_tokens: 20, completion_tokens: 5 },
        provider_secret: SENTINEL,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
}
