import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireCapability,
} from '@repo/ai';
import { z } from 'zod';

import {
  PHASE_6_9_7_FULL_GATE_APPROVED_SOURCE_REF,
  PHASE_6_9_7_FULL_GATE_CONTROLLED_LIVE_BRANCH,
  PHASE_6_9_7_FULL_GATE_SOURCE_SCHEMA,
  consumePhase697FullGateProxyAttestation,
  createPhase697FullGateSyntheticProxyAttestationForTest,
  type Phase697FullGateSource,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-authority.ts';
import {
  PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_FULL_GATE_SOURCE_HASHES,
  buildPhase697FullGateReport,
  calculatePhase697FullGateCostCny,
  type Phase697FullGateCaseEntry,
  type Phase697FullGateReport,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-contract.ts';
import { reservePhase697FullGateAttempt } from '../src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts';
import { PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES } from '../src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts';
import {
  phase697V2OrganizerCases,
  phase697V2TutorCases,
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2TutorRuntimeCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import type {
  Phase697FullGateHarness,
  Phase697FullGateLaneIdentity,
  Phase697FullGateLifecycle,
  Phase697FullGateRuntimeCase,
  Phase697FullGateRuntimeResult,
} from '../src/evals/run-phase-6-9-tutor-organizer-full-gate.ts';

export const F2_RUN_ID = '00000000-0000-4000-8000-000000000972';
export const F2_CREATED_AT = '2026-07-31T08:00:00.000Z';
export const F2_SAFE = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
  lockedNameChanged: false,
  writeCommandLeaked: false,
});

const ZERO_WIRE = Object.freeze({
  executorEntered: 0 as const,
  providerDispatchStarted: 0 as const,
  providerResponseReceived: 0 as const,
  verifiedUsageObserved: 0 as const,
});
const FULL_WIRE = Object.freeze({
  executorEntered: 1 as const,
  providerDispatchStarted: 1 as const,
  providerResponseReceived: 1 as const,
  verifiedUsageObserved: 1 as const,
});
const SYNTHETIC_OUTPUT_SCHEMA = z.object({ ok: z.literal(true) }).strict();

export function createF2Source(): Phase697FullGateSource {
  const commit = 'a'.repeat(40);
  return PHASE_6_9_7_FULL_GATE_SOURCE_SCHEMA.parse({
    sourceVersion: 'phase-6.9.7-tutor-organizer-full-gate-source-v1',
    branch: PHASE_6_9_7_FULL_GATE_CONTROLLED_LIVE_BRANCH,
    commit,
    trackingCommit: commit,
    remoteCommit: commit,
    approvedRunnableSourceRef: PHASE_6_9_7_FULL_GATE_APPROVED_SOURCE_REF,
    approvedRunnableSourceCommit: commit,
    trackedWorktreeClean: true,
    formalArtifactCount: 0,
    sourceHashes: createF2SourceHashes(),
  });
}

export function createF2SourceHashes() {
  return PHASE_6_9_7_FULL_GATE_SOURCE_HASHES;
}

export async function reserveF2SyntheticAttempt(root: string, runId = F2_RUN_ID) {
  const attestation = createPhase697FullGateSyntheticProxyAttestationForTest();
  const consumed = consumePhase697FullGateProxyAttestation(attestation, 'synthetic_test');
  return reservePhase697FullGateAttempt({
    root,
    runId,
    runScope: 'branch',
    authority: 'synthetic_test',
    mode: 'live',
    executorProvenance: 'synthetic_test',
    createdAt: F2_CREATED_AT,
    source: createF2Source(),
    proxyAttestation: consumed,
  });
}

export function createF2PassingReport(
  runId = F2_RUN_ID,
  executorProvenance: 'deepseek_network' | 'synthetic_test' = 'synthetic_test',
): Phase697FullGateReport {
  const source = createF2Source();
  return buildPhase697FullGateReport({
    runId,
    runScope: 'branch',
    mode: 'live',
    executorProvenance,
    approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
    caseEntries: createF2PassingEntries(),
  });
}

export function createF2PassingEntries(): Phase697FullGateCaseEntry[] {
  const tutorById = new Map(phase697V2TutorCases.map((entry) => [entry.id, entry]));
  const organizerById = new Map(phase697V2OrganizerCases.map((entry) => [entry.id, entry]));
  return PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES.map((expected, index) => {
    if (expected.kind === 'guard') return passingGuardEntry(expected);
    const testCase =
      expected.agent === 'tutor'
        ? tutorById.get(expected.caseId)
        : organizerById.get(expected.caseId);
    if (!testCase || testCase.expectedRuntimeInvocations !== 1) {
      throw new Error('PHASE_6_9_7_FULL_GATE_F2_FIXTURE_MISSING');
    }
    return runtimeEntry(testCase, index + 100);
  });
}

export function createF2SuccessHarness(
  input: {
    onGuard?: (caseId: string) => void;
    onRuntimeStart?: (entry: Phase697FullGateRuntimeCase) => void | Promise<void>;
    mutateRuntimeResult?: (
      entry: Phase697FullGateRuntimeCase,
      result: Phase697FullGateRuntimeResult,
    ) => Phase697FullGateRuntimeResult;
  } = {},
): Phase697FullGateHarness {
  const run = async (
    entry: Phase697FullGateRuntimeCase,
    signal: AbortSignal,
    capability: Phase697V7WireCapability,
  ) => {
    await input.onRuntimeStart?.(entry);
    await driveF2SyntheticWire(capability, signal);
    const result = successRuntimeResult(entry);
    return input.mutateRuntimeResult?.(entry, result) ?? result;
  };
  return Object.freeze({
    mode: 'live' as const,
    executorProvenance: 'synthetic_test' as const,
    async runGuard(entry) {
      input.onGuard?.(entry.id);
      return Object.freeze({
        runtimeInvocations: 0,
        zeroCallVerified: true,
        safety: F2_SAFE,
      });
    },
    runTutor: (entry, signal, capability) => run(entry, signal, capability),
    runOrganizer: (entry, signal, capability) => run(entry, signal, capability),
  });
}

export async function driveF2SyntheticWire(
  capability: Phase697V7WireCapability,
  signal: AbortSignal,
) {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: 'f2-synthetic-never-network',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
    },
    capability,
    {
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    },
  );
  await adapter.executor({
    schema: SYNTHETIC_OUTPUT_SCHEMA,
    systemPrompt: 'Return one strict object.',
    userPrompt: 'Synthetic F2 wire fixture.',
    maxOutputTokens: 64,
    signal,
  });
}

export function successRuntimeResult(
  entry: Phase697FullGateRuntimeCase,
): Phase697FullGateRuntimeResult {
  const parsed = runtimeEntry(entry, entry.agent === 'tutor' ? 120 : 220);
  return Object.freeze({
    disposition: 'succeeded',
    failureCategory: 'none',
    strictRuntimeSuccess: true,
    durationMs: parsed.durationMs,
    orchestrationDurationMs: parsed.orchestrationDurationMs,
    usage: parsed.usage,
    semantic: parsed.semantic,
    safety: parsed.safety,
  });
}

export function createF2MemoryLifecycle() {
  const trace: string[] = [];
  const terminals = new Map<string, Phase697FullGateCaseEntry>();
  const stages = new Map<string, string[]>();
  const lifecycle: Phase697FullGateLifecycle = Object.freeze({
    async appendGuardTerminal(entry) {
      trace.push(`guard:${entry.caseId}`);
      terminals.set(entry.caseId, entry);
    },
    async reserveLane(identity) {
      trace.push(`reserve:${identity.caseId}`);
      stages.set(identity.caseId, []);
      return Object.freeze({
        async appendWireStage(stage) {
          trace.push(`wire:${identity.caseId}:${stage}`);
          stages.get(identity.caseId)?.push(stage);
        },
      });
    },
    async appendLaneTerminal(identity, entry) {
      trace.push(`terminal:${identity.caseId}`);
      terminals.set(identity.caseId, entry);
    },
    async appendLaneNotStarted(entry) {
      trace.push(`not-started:${entry.caseId}`);
      terminals.set(entry.caseId, entry);
    },
    async appendPairTerminal(pairedRunIndex) {
      trace.push(`pair:${pairedRunIndex}`);
    },
    async appendRunTerminal(report) {
      trace.push(`run:${report.gate}`);
    },
  });
  return { lifecycle, trace, terminals, stages };
}

export function runtimeIdentity(
  entry: (typeof PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES)[number],
): Phase697FullGateLaneIdentity {
  if (entry.kind !== 'runtime' || entry.pairedRunIndex === null) {
    throw new Error('PHASE_6_9_7_FULL_GATE_F2_RUNTIME_IDENTITY_INVALID');
  }
  return {
    caseId: entry.caseId,
    agent: entry.agent,
    pairedRunIndex: entry.pairedRunIndex,
  };
}

function passingGuardEntry(expected: (typeof PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES)[number]) {
  return PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA.parse({
    entryVersion: 'phase-6.9.7-tutor-organizer-full-gate-entry-v1',
    caseId: expected.caseId,
    agent: expected.agent,
    executionKind: 'guard',
    pairedRunIndex: null,
    disposition: 'not_started_guard',
    failureCategory: 'none',
    strictRuntimeSuccess: false,
    zeroCallVerified: true,
    wire: ZERO_WIRE,
    durationMs: null,
    orchestrationDurationMs: null,
    usage: null,
    semantic: null,
    safety: F2_SAFE,
  });
}

function runtimeEntry(
  entry: Phase697V2TutorRuntimeCase | Phase697V2OrganizerRuntimeCase,
  durationMs: number,
) {
  const usage = {
    inputTokens: 100,
    outputTokens: 20,
    estimatedCostCny: calculatePhase697FullGateCostCny(100, 20),
    pricingProfile: 'deepseek-v4-pro-cny-2026-07-15' as const,
  };
  const semantic =
    entry.agent === 'tutor'
      ? {
          agent: 'tutor' as const,
          observation: {
            caseId: entry.id,
            expectedIntent: entry.expected.intent,
            actualIntent: entry.expected.intent,
            expectedDepth: entry.expected.depth,
            actualDepth: entry.expected.depth,
            expectedContextUse: entry.expected.contextUse,
            actualContextUse: entry.expected.contextUse,
            expectedGuidingQuestion: entry.expected.guidingQuestion,
            actualGuidingQuestion: entry.expected.guidingQuestion,
            expectedFinalAnswer: entry.expected.finalAnswer,
            actualFinalAnswer: entry.expected.finalAnswer,
            expectedAnswerStructure: [...entry.expected.answerStructure],
            actualAnswerStructure: [...entry.expected.answerStructure],
            validOutput: true,
          },
        }
      : {
          agent: 'wrong_question_organizer' as const,
          observations: entry.expected.decisions.map((decision) => ({
            decisionId: `${entry.id}:q${decision.questionIndex}`,
            expectedSubject: decision.subject,
            actualSubject: decision.subject,
            expectedDeckAction: decision.deckAction,
            actualDeckAction: decision.deckAction,
            expectedDeckIndex: decision.deckIndex ?? null,
            actualDeckIndex: decision.deckIndex ?? null,
            canonicalTopicLabel: decision.canonicalTopicLabel,
            acceptedTopicLabels: [...decision.acceptedTopicLabels],
            actualTopicLabel: decision.canonicalTopicLabel,
            expectedConfidence: decision.confidence,
            actualConfidence: decision.confidence,
            requiredEvidenceCodes: [...decision.requiredEvidenceCodes],
            allowedEvidenceCodes: [...decision.allowedEvidenceCodes],
            actualEvidenceCodes: [...decision.requiredEvidenceCodes],
            validOutput: true,
          })),
        };
  return PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA.parse({
    entryVersion: 'phase-6.9.7-tutor-organizer-full-gate-entry-v1',
    caseId: entry.id,
    agent: entry.agent,
    executionKind: 'runtime',
    pairedRunIndex: entry.pairedRunIndex,
    disposition: 'succeeded',
    failureCategory: 'none',
    strictRuntimeSuccess: true,
    zeroCallVerified: false,
    wire: FULL_WIRE,
    durationMs,
    orchestrationDurationMs: entry.agent === 'tutor' ? durationMs + 10 : null,
    usage,
    semantic,
    safety: F2_SAFE,
  });
}
