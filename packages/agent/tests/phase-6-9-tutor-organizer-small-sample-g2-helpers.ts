import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireCapability,
} from '@repo/ai';
import { z } from 'zod';

import {
  PHASE_6_9_7_SMALL_SAMPLE_APPROVED_SOURCE_REF,
  PHASE_6_9_7_SMALL_SAMPLE_CONTROLLED_LIVE_BRANCH,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA,
  consumePhase697SmallSampleProxyAttestation,
  createPhase697SmallSampleSyntheticProxyAttestationForTest,
  type Phase697SmallSampleSource,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-authority.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA,
  buildPhase697SmallSampleReport,
  calculatePhase697SmallSampleCostCny,
  type Phase697SmallSampleCaseEntry,
  type Phase697SmallSampleReport,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-contract.ts';
import { reservePhase697SmallSampleAttempt } from '../src/evals/phase-6-9-tutor-organizer-small-sample-durability.ts';
import { PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES } from '../src/evals/phase-6-9-tutor-organizer-small-sample-manifest.ts';
import {
  phase697V2OrganizerCases,
  phase697V2TutorCases,
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2TutorRuntimeCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import type {
  Phase697SmallSampleHarness,
  Phase697SmallSampleLaneIdentity,
  Phase697SmallSampleLifecycle,
  Phase697SmallSampleRuntimeCase,
  Phase697SmallSampleRuntimeResult,
} from '../src/evals/run-phase-6-9-tutor-organizer-small-sample.ts';

export const G2_RUN_ID = '00000000-0000-4000-8000-000000000972';
export const G2_CREATED_AT = '2026-07-31T08:00:00.000Z';
export const G2_SAFE = Object.freeze({
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

export function createG2Source(): Phase697SmallSampleSource {
  const commit = 'a'.repeat(40);
  return PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA.parse({
    sourceVersion: 'phase-6.9.7-tutor-organizer-small-sample-source-v1',
    branch: PHASE_6_9_7_SMALL_SAMPLE_CONTROLLED_LIVE_BRANCH,
    commit,
    trackingCommit: commit,
    remoteCommit: commit,
    approvedRunnableSourceRef: PHASE_6_9_7_SMALL_SAMPLE_APPROVED_SOURCE_REF,
    approvedRunnableSourceCommit: commit,
    trackedWorktreeClean: true,
    formalArtifactCount: 0,
    sourceHashes: createG2SourceHashes(),
  });
}

export function createG2SourceHashes() {
  return Object.freeze({
    tutorPromptSha256: 'b'.repeat(64),
    tutorSchemaSha256: 'c'.repeat(64),
    tutorMergerSha256: 'd'.repeat(64),
    organizerPromptSha256: 'e'.repeat(64),
    organizerSchemaSha256: 'f'.repeat(64),
    organizerMergerSha256: '1'.repeat(64),
    adapterSha256: '2'.repeat(64),
  });
}

export async function reserveG2SyntheticAttempt(root: string, runId = G2_RUN_ID) {
  const attestation = createPhase697SmallSampleSyntheticProxyAttestationForTest();
  const consumed = consumePhase697SmallSampleProxyAttestation(attestation, 'synthetic_test');
  return reservePhase697SmallSampleAttempt({
    root,
    runId,
    runScope: 'branch',
    authority: 'synthetic_test',
    mode: 'live',
    executorProvenance: 'synthetic_test',
    createdAt: G2_CREATED_AT,
    source: createG2Source(),
    proxyAttestation: consumed,
  });
}

export function createG2PassingReport(
  runId = G2_RUN_ID,
  executorProvenance: 'deepseek_network' | 'synthetic_test' = 'synthetic_test',
): Phase697SmallSampleReport {
  const source = createG2Source();
  return buildPhase697SmallSampleReport({
    runId,
    runScope: 'branch',
    mode: 'live',
    executorProvenance,
    approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
    sourceHashes: source.sourceHashes,
    caseEntries: createG2PassingEntries(),
  });
}

export function createG2PassingEntries(): Phase697SmallSampleCaseEntry[] {
  const tutorById = new Map(phase697V2TutorCases.map((entry) => [entry.id, entry]));
  const organizerById = new Map(phase697V2OrganizerCases.map((entry) => [entry.id, entry]));
  return PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.map((expected, index) => {
    if (expected.kind === 'guard') return passingGuardEntry(expected);
    const testCase =
      expected.agent === 'tutor'
        ? tutorById.get(expected.caseId)
        : organizerById.get(expected.caseId);
    if (!testCase || testCase.expectedRuntimeInvocations !== 1) {
      throw new Error('PHASE_6_9_7_SMALL_SAMPLE_G2_FIXTURE_MISSING');
    }
    return runtimeEntry(testCase, index + 100);
  });
}

export function createG2SuccessHarness(
  input: {
    onGuard?: (caseId: string) => void;
    onRuntimeStart?: (entry: Phase697SmallSampleRuntimeCase) => void | Promise<void>;
    mutateRuntimeResult?: (
      entry: Phase697SmallSampleRuntimeCase,
      result: Phase697SmallSampleRuntimeResult,
    ) => Phase697SmallSampleRuntimeResult;
  } = {},
): Phase697SmallSampleHarness {
  const run = async (
    entry: Phase697SmallSampleRuntimeCase,
    signal: AbortSignal,
    capability: Phase697V7WireCapability,
  ) => {
    await input.onRuntimeStart?.(entry);
    await driveG2SyntheticWire(capability, signal);
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
        safety: G2_SAFE,
      });
    },
    runTutor: (entry, signal, capability) => run(entry, signal, capability),
    runOrganizer: (entry, signal, capability) => run(entry, signal, capability),
  });
}

export async function driveG2SyntheticWire(
  capability: Phase697V7WireCapability,
  signal: AbortSignal,
) {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: 'g2-synthetic-never-network',
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
    userPrompt: 'Synthetic G2 wire fixture.',
    maxOutputTokens: 64,
    signal,
  });
}

export function successRuntimeResult(
  entry: Phase697SmallSampleRuntimeCase,
): Phase697SmallSampleRuntimeResult {
  const parsed = runtimeEntry(entry, entry.agent === 'tutor' ? 120 : 220);
  return Object.freeze({
    disposition: 'succeeded',
    failureCategory: 'none',
    strictRuntimeSuccess: true,
    durationMs: parsed.durationMs,
    usage: parsed.usage,
    semantic: parsed.semantic,
    safety: parsed.safety,
  });
}

export function createG2MemoryLifecycle() {
  const trace: string[] = [];
  const terminals = new Map<string, Phase697SmallSampleCaseEntry>();
  const stages = new Map<string, string[]>();
  const lifecycle: Phase697SmallSampleLifecycle = Object.freeze({
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
  entry: (typeof PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES)[number],
): Phase697SmallSampleLaneIdentity {
  if (entry.kind !== 'runtime' || entry.pairedRunIndex === null) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_G2_RUNTIME_IDENTITY_INVALID');
  }
  return {
    caseId: entry.caseId,
    agent: entry.agent,
    pairedRunIndex: entry.pairedRunIndex,
  };
}

function passingGuardEntry(expected: (typeof PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES)[number]) {
  return PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
    entryVersion: 'phase-6.9.7-tutor-organizer-small-sample-entry-v1',
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
    usage: null,
    semantic: null,
    safety: G2_SAFE,
  });
}

function runtimeEntry(
  entry: Phase697V2TutorRuntimeCase | Phase697V2OrganizerRuntimeCase,
  durationMs: number,
) {
  const usage = {
    inputTokens: 100,
    outputTokens: 20,
    estimatedCostCny: calculatePhase697SmallSampleCostCny(100, 20),
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
  return PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
    entryVersion: 'phase-6.9.7-tutor-organizer-small-sample-entry-v1',
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
    usage,
    semantic,
    safety: G2_SAFE,
  });
}
