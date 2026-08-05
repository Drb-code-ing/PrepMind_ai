import { calculateQwenTextEmbeddingV4CostCny } from '@repo/ai';

import {
  PHASE_6_9_8_TASK9_REPORT_SCHEMA,
  calculatePhase698Task9DeepseekCostCny,
  canonicalPhase698Task9Json,
  expectedPhase698Task9CallSchedule,
  sha256Phase698Task9,
  type Phase698Task9Report,
  type Phase698Task9WireStage,
} from './phase-6-9-8-retriever-final-response-task9-contract.ts';
import { PHASE_6_9_8_TASK8_MANIFEST } from './phase-6-9-8-retriever-final-response-manifest.ts';
import {
  buildPhase698Task8ReviewedMockStaticV1,
  type Phase698Task8FinalResponseReportEntry,
  type Phase698Task8RewriteReportEntry,
} from './phase-6-9-8-retriever-final-response-static.ts';
import {
  runPhase698Task9ForTest,
  type Phase698Task9CallLifecycle,
  type Phase698Task9CallResult,
  type Phase698Task9Harness,
  type Phase698Task9Lifecycle,
} from './phase-6-9-8-retriever-final-response-task9-runner.ts';
import { createPhase698Task9SyntheticAdmissionForTest } from './phase-6-9-8-retriever-final-response-task9-source-admission.ts';

export const PHASE_6_9_8_TASK9B_STATIC_AUTHORITY =
  'zero_provider_retriever_final_response_runner_durability' as const;
export const PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_VERSION =
  'phase-6.9.8-retriever-final-response-task9b-reviewed-mock-factory-v1' as const;
export const PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_DESCRIPTOR = Object.freeze({
  version: PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_VERSION,
  source: 'task8_frozen_reviewed_mock_projection',
  transport: 'synthetic_injected',
  qwenInputTokensPerCall: 128,
  durationsMs: Object.freeze({
    call: 10,
    finalTtft: 100,
    finalTotal: 300,
    finalEndToEnd: 500,
  }),
});
export const PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_SHA256 = sha256Phase698Task9(
  canonicalPhase698Task9Json(PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_DESCRIPTOR),
);
export const PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_FROZEN_SHA256 =
  '38e35703c9a1485325ff48f4b9986b66091ad780b8a7967837cc1379f28ba586' as const;
export const PHASE_6_9_8_TASK9B_REVIEWED_MOCK_REPORT_FROZEN_SHA256 =
  '820d7b2aa25478205cedeed6875d455d5daa4950f51dba1dec38131c0b208f07' as const;

const REVIEWED_MOCK_RUN_ID = '00000000-0000-4000-8000-000000000009';
const QWEN_INPUT_TOKENS = 128;

export type Phase698Task9BReviewedMockCheckpoint = Readonly<{
  authority: typeof PHASE_6_9_8_TASK9B_STATIC_AUTHORITY;
  qualityAuthority: 'none';
  providerCalls: 0;
  credentialReads: 0;
  syntheticTransportInvocations: 64;
  qwenExternalCalls: 0;
  deepseekExternalCalls: 0;
  formal: Readonly<{
    approvedTagCount: 0;
    markerCount: 0;
    journalCount: 0;
    evidenceCount: 0;
    recoveryClaimCount: 0;
  }>;
  reviewedMockFactorySha256: string;
  reportLogicalSha256: string;
  report: Phase698Task9Report;
  lifecycleEvents: readonly string[];
}>;

export async function buildPhase698Task9BReviewedMockCheckpoint(): Promise<Phase698Task9BReviewedMockCheckpoint> {
  const task8 = await buildPhase698Task8ReviewedMockStaticV1();
  const harness = createReviewedMockHarness(
    task8.report.rewriteEntries,
    task8.report.finalResponseEntries,
  );
  const recording = createRecordingLifecycle(REVIEWED_MOCK_RUN_ID);
  const admission = createPhase698Task9SyntheticAdmissionForTest();
  const now = createDeterministicClock();
  const report = PHASE_6_9_8_TASK9_REPORT_SCHEMA.parse(
    await runPhase698Task9ForTest(
      {
        runId: REVIEWED_MOCK_RUN_ID,
        authority: 'synthetic_test',
        credentialReads: 0,
        admissionCapability: admission.capability,
        harness,
        lifecycle: recording.lifecycle,
        signal: new AbortController().signal,
      },
      { now },
    ),
  );
  if (
    PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_SHA256 !==
      PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_FROZEN_SHA256 ||
    sha256Phase698Task9(canonicalPhase698Task9Json(report)) !==
      PHASE_6_9_8_TASK9B_REVIEWED_MOCK_REPORT_FROZEN_SHA256 ||
    !report.gate.passed ||
    report.gate.status !== 'task9b_mock_quality_not_evidence' ||
    report.qualityAuthority !== 'none' ||
    report.execution.externalProviderCalls !== 0 ||
    report.execution.transportInvocations !== 64 ||
    report.execution.qwenEmbeddingInvocations !== 32
  ) {
    throw new Error(
      `PHASE_6_9_8_TASK9B_REVIEWED_MOCK_GATE_INVALID:${canonicalPhase698Task9Json({
        gate: report.gate,
        execution: report.execution,
        events: recording.events.slice(0, 24),
      })}`,
    );
  }
  return deepFreeze({
    authority: PHASE_6_9_8_TASK9B_STATIC_AUTHORITY,
    qualityAuthority: 'none' as const,
    providerCalls: 0 as const,
    credentialReads: 0 as const,
    syntheticTransportInvocations: 64 as const,
    qwenExternalCalls: 0 as const,
    deepseekExternalCalls: 0 as const,
    formal: {
      approvedTagCount: 0 as const,
      markerCount: 0 as const,
      journalCount: 0 as const,
      evidenceCount: 0 as const,
      recoveryClaimCount: 0 as const,
    },
    reviewedMockFactorySha256: PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_SHA256,
    reportLogicalSha256: sha256Phase698Task9(canonicalPhase698Task9Json(report)),
    report,
    lifecycleEvents: recording.events,
  });
}

/** Synthetic-only harness for isolated runner/durability tests. */
export async function createPhase698Task9ReviewedMockHarnessForTest(): Promise<Phase698Task9Harness> {
  const task8 = await buildPhase698Task8ReviewedMockStaticV1();
  return createReviewedMockHarness(task8.report.rewriteEntries, task8.report.finalResponseEntries);
}

function createReviewedMockHarness(
  rewrites: readonly Phase698Task8RewriteReportEntry[],
  finals: readonly Phase698Task8FinalResponseReportEntry[],
): Phase698Task9Harness {
  const rewriteById = new Map(rewrites.map((entry) => [entry.caseId, entry]));
  const finalById = new Map(finals.map((entry) => [entry.caseId, entry]));
  return Object.freeze({
    transportAuthority: 'synthetic_injected' as const,
    async runGuard(testCase) {
      return Object.freeze({
        observedReasonCode: testCase.expectedReasonCode,
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      });
    },
    async invokeCall(input) {
      if (input.signal.aborted) throw new Error('synthetic_aborted');
      if (input.identity.phase === 'final_response_model') {
        const entry = finalById.get(input.identity.caseId);
        if (!entry?.strict || entry.accountedUsage === null)
          throw new Error('final_fixture_invalid');
        return finalResult(entry);
      }
      const entry = rewriteById.get(input.identity.caseId);
      const testCase = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.find(
        (candidate) => candidate.caseId === input.identity.caseId,
      );
      if (!entry?.strict || !testCase) throw new Error('rewrite_fixture_invalid');
      if (input.identity.phase === 'rewrite_candidate_model') {
        const usage = {
          inputTokens: entry.accountedUsage.inputTokens,
          outputTokens: Math.max(1, entry.accountedUsage.outputTokens),
        };
        return Object.freeze({
          phase: 'rewrite_candidate_model' as const,
          executedQuery: [...new Set([testCase.retrievalAnchor, ...testCase.requiredTerms])].join(
            ' ',
          ),
          intentPreserved: entry.intentPreserved,
          unsafeRewrite: entry.unsafeRewrite,
          usage,
          verifiedCostCny: calculatePhase698Task9DeepseekCostCny(
            usage.inputTokens,
            usage.outputTokens,
          ),
        });
      }
      if (
        input.identity.phase === 'rewrite_candidate_retrieval' &&
        (typeof input.rewrittenQuery !== 'string' || input.rewrittenQuery.length === 0)
      ) {
        throw new Error('candidate_query_missing');
      }
      return retrievalResult(input.identity.phase, entry);
    },
  });
}

function retrievalResult(
  phase: 'rewrite_original_retrieval' | 'rewrite_candidate_retrieval',
  entry: Phase698Task8RewriteReportEntry,
): Phase698Task9CallResult {
  const candidate = phase === 'rewrite_candidate_retrieval';
  return Object.freeze({
    phase,
    targetRank: candidate ? entry.candidateTargetRank : entry.baselineTargetRank,
    recallAt5: candidate ? entry.candidateRecallAt5 : entry.baselineRecallAt5,
    ndcgAt5: candidate ? entry.candidateNdcgAt5 : entry.baselineNdcgAt5,
    usage: { inputTokens: QWEN_INPUT_TOKENS, outputTokens: 0 },
    verifiedCostCny: calculateQwenTextEmbeddingV4CostCny(QWEN_INPUT_TOKENS),
  });
}

function finalResult(entry: Phase698Task8FinalResponseReportEntry): Phase698Task9CallResult {
  const usage = entry.accountedUsage;
  if (usage === null || entry.terminal !== 'response_completed') {
    throw new Error('PHASE_6_9_8_TASK9B_FINAL_FIXTURE_INVALID');
  }
  return Object.freeze({
    phase: 'final_response_model' as const,
    responseTextHash: entry.responseTextHash,
    terminal: 'response_completed' as const,
    terminalCount: 1 as const,
    terminalLast: true as const,
    grounded: entry.grounded,
    noticeSatisfied: entry.noticeSatisfied,
    requiredCitationCount: entry.requiredCitationCount,
    observedCitationCount: entry.observedCitationCount,
    citationTruePositiveCount: entry.citationTruePositiveCount,
    falseToolSuccess: entry.falseToolSuccess,
    falseCitation: entry.falseCitation,
    ttftMs: PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_DESCRIPTOR.durationsMs.finalTtft,
    totalMs: PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_DESCRIPTOR.durationsMs.finalTotal,
    endToEndMs: PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_DESCRIPTOR.durationsMs.finalEndToEnd,
    usage: { ...usage },
    verifiedCostCny: calculatePhase698Task9DeepseekCostCny(usage.inputTokens, usage.outputTokens),
  });
}

function createRecordingLifecycle(runId: string): Readonly<{
  lifecycle: Phase698Task9Lifecycle;
  events: readonly string[];
}> {
  const expectedCalls = expectedPhase698Task9CallSchedule();
  const events: string[] = [];
  const reserved = new Map<string, Phase698Task9WireStage[]>();
  let guardIndex = 0;
  let callIndex = 0;
  let rewriteIndex = 0;
  let finalIndex = 0;
  let terminal = false;

  const lifecycle: Phase698Task9Lifecycle = Object.freeze({
    runId,
    async appendGuardTerminal(entry) {
      if (entry.caseId !== PHASE_6_9_8_TASK8_MANIFEST.guardCases[guardIndex]?.caseId)
        failLifecycle();
      guardIndex += 1;
      events.push(`guard:${entry.caseId}:${entry.disposition}`);
    },
    async reserveCall(identity): Promise<Phase698Task9CallLifecycle> {
      const expected = expectedCalls[callIndex];
      if (!expected || expected.callId !== identity.callId || reserved.has(identity.callId)) {
        failLifecycle();
      }
      const stages: Phase698Task9WireStage[] = [];
      reserved.set(identity.callId, stages);
      events.push(`reserve:${identity.callId}`);
      return Object.freeze({
        async appendWireStage(stage, preparedSuccess) {
          const expectedStage = ['dispatch_started', 'response_received', 'usage_verified'][
            stages.length
          ] as Phase698Task9WireStage | undefined;
          if (stage !== expectedStage) failLifecycle();
          if (
            (stage === 'usage_verified') !== (preparedSuccess !== undefined) ||
            (preparedSuccess !== undefined &&
              (preparedSuccess.callId !== identity.callId ||
                preparedSuccess.disposition !== 'succeeded'))
          ) {
            failLifecycle();
          }
          stages.push(stage);
          events.push(`wire:${identity.callId}:${stage}`);
        },
      });
    },
    async appendCallTerminal(entry) {
      const expected = expectedCalls[callIndex];
      if (!expected || expected.callId !== entry.callId) failLifecycle();
      const stages = reserved.get(entry.callId);
      if (entry.disposition.startsWith('not_started_')) {
        if (stages !== undefined) failLifecycle();
      } else if (stages === undefined) {
        failLifecycle();
      }
      callIndex += 1;
      events.push(`call:${entry.callId}:${entry.disposition}`);
    },
    async appendRewriteTerminal(entry) {
      if (entry.caseId !== PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[rewriteIndex]?.caseId) {
        failLifecycle();
      }
      rewriteIndex += 1;
      events.push(`rewrite:${entry.caseId}:${entry.strict ? 'strict' : 'incomplete'}`);
    },
    async appendFinalTerminal(entry) {
      if (entry.caseId !== PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases[finalIndex]?.caseId) {
        failLifecycle();
      }
      finalIndex += 1;
      events.push(`final:${entry.caseId}:${entry.strict ? 'strict' : 'incomplete'}`);
    },
    async appendRunTerminal(report) {
      if (
        terminal ||
        guardIndex !== 16 ||
        callIndex !== 64 ||
        rewriteIndex !== 16 ||
        finalIndex !== 16 ||
        report.runId !== runId
      ) {
        failLifecycle();
      }
      terminal = true;
      events.push(`run:${report.gate.status}`);
    },
  });
  return Object.freeze({ lifecycle, events });
}

function failLifecycle(): never {
  throw new Error('PHASE_6_9_8_TASK9B_RECORDING_LIFECYCLE_INVALID');
}

function createDeterministicClock() {
  let value = 0;
  let atStart = true;
  return () => {
    if (atStart) {
      atStart = false;
      return value;
    }
    atStart = true;
    value += PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_DESCRIPTOR.durationsMs.call;
    return value;
  };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
