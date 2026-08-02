import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createModelAgentBudget,
  createModelAgentRuntime,
  type Phase697V7WireCapability,
} from '@repo/ai';

import {
  PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
} from './phase-6-9-tutor-organizer-full-gate-baseline.ts';
import {
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256,
  PHASE_6_9_7_FULL_GATE_PRICING_PROFILE,
  calculatePhase697FullGateCostCny,
  type Phase697FullGateCaseEntry,
} from './phase-6-9-tutor-organizer-full-gate-contract.ts';
import {
  PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
  computePhase697FullGateCanonicalSha256,
} from './phase-6-9-tutor-organizer-full-gate-manifest.ts';
import {
  PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_SHA256,
  PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_VERSION,
  createPhase697FullGateReviewedMockHarness,
  type Phase697FullGateReviewedMockContractFault,
  type Phase697FullGateReviewedMockFault,
  type Phase697FullGateReviewedMockRequestAudit,
} from './phase-6-9-tutor-organizer-full-gate-mock.ts';
import { PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256 } from './phase-6-9-tutor-organizer-schema-recovery-authority.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED,
  PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_CONTRACT_VERSION,
  PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_VERSION,
  PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION,
  type Phase697SchemaRecoverySchemaObservation,
} from './phase-6-9-tutor-organizer-schema-recovery-contract.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_ARTIFACT_VERSION,
  PHASE_6_9_7_SCHEMA_RECOVERY_DURABILITY_VERSION,
  PHASE_6_9_7_SCHEMA_RECOVERY_JOURNAL_RECORD_VERSION,
  PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_VERSION,
} from './phase-6-9-tutor-organizer-schema-recovery-durability.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_RUNNER_VERSION,
  type Phase697SchemaRecoveryHarness,
  type Phase697SchemaRecoveryRuntimeResult,
} from './run-phase-6-9-tutor-organizer-schema-recovery.ts';
import type { Phase697V2TutorRuntimeCase } from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
  PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
} from './phase-6-9-tutor-wrong-question-v6-live.ts';
import {
  TUTOR_SCHEMA_RECOVERY_CANDIDATE_VERSION,
  runTutorSchemaRecoveryModelCandidate,
  type TutorSchemaRecoveryModelCandidateEnvelope,
} from '../model-candidates/tutor-schema-recovery-model-candidate.ts';
import {
  TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
  createTutorSchemaRecoveryDiagnosticCollector,
  type TutorSchemaRecoveryBoundedDiagnostic,
} from '../model-candidates/tutor-schema-recovery-contract.ts';
import { formatTutorV6ModelPolicyForPrompt } from '../model-candidates/tutor-v6-model-contract.ts';
import { TUTOR_V6_MODEL_PROJECTION_VERSION } from '../model-candidates/tutor-v6-model-projection.ts';
import { buildTutorStrategy } from '../nodes/tutor.ts';
import { TUTOR_BOUNDED_INTENTS } from '../policies/tutor-strategy-policy.ts';

export const PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-reviewed-mock-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_CHECKPOINT_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-sr4-checkpoint-v1' as const;

export const PHASE_6_9_7_SCHEMA_RECOVERY_EXTENSION_TUTOR_CASE_IDS = Object.freeze([
  'tutor-v2-runtime-04',
  'tutor-v2-runtime-08',
  'tutor-v2-runtime-12',
  'tutor-v2-runtime-16',
  'tutor-v2-runtime-20',
  'tutor-v2-runtime-24',
] as const);

const SYNTHETIC_CREDENTIAL = 'schema-recovery-sr4-zero-network-key';
const DIRECT_COMPLETIONS_URL = 'https://api.deepseek.com/v1/chat/completions';
const TUTOR_MAX_INPUT_TOKENS = 1_200;
const TUTOR_MAX_OUTPUT_TOKENS = 300;
const EXTENSION_SENTINEL = 'schema-recovery-sr4-extension-must-not-escape';
const EXTENSION_CASES = new Set<string>(PHASE_6_9_7_SCHEMA_RECOVERY_EXTENSION_TUTOR_CASE_IDS);

const TUTOR_SYSTEM_PROMPT = [
  'Classify only the bounded Tutor intent supplied as JSON.',
  formatTutorV6ModelPolicyForPrompt(),
].join('\n');

const DIRECT_REQUEST_SCHEMA = z
  .object({
    model: z.literal('deepseek-v4-pro'),
    thinking: z.object({ type: z.literal('disabled') }).strict(),
    response_format: z.object({ type: z.literal('json_object') }).strict(),
    max_tokens: z.literal(TUTOR_MAX_OUTPUT_TOKENS),
    stream: z.literal(false),
    messages: z.tuple([
      z.object({ role: z.literal('system'), content: z.string() }).strict(),
      z.object({ role: z.literal('user'), content: z.string() }).strict(),
    ]),
  })
  .strict();

const TUTOR_PROMPT_SCHEMA = z
  .object({
    version: z.literal(TUTOR_V6_MODEL_PROJECTION_VERSION),
    latestText: z.string(),
    activeContext: z.object({ available: z.boolean(), excerpt: z.string().optional() }).strict(),
    authorityBinding: z
      .object({
        localSignalAuthoritySha256: z.string().regex(/^[a-f0-9]{64}$/u),
        localStrategyAuthoritySha256: z.string().regex(/^[a-f0-9]{64}$/u),
      })
      .strict(),
    eligibleIntents: z
      .array(
        z
          .object({
            intentIndex: z.number().int().min(0).max(4),
            intent: z.enum(TUTOR_BOUNDED_INTENTS),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();

const REVIEWED_MOCK_FACTORY_SOURCE = deepFreeze({
  version: PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_VERSION,
  upstreamFullGateFactoryVersion: PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_VERSION,
  upstreamFullGateFactorySha256: PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_SHA256,
  tutorCandidateVersion: TUTOR_SCHEMA_RECOVERY_CANDIDATE_VERSION,
  tutorContractSha256: TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
  organizerCandidate: 'wrong_question_organizer_v9_via_reviewed_full_gate_factory',
  adapter: 'first_party_deepseek_v4_pro_direct_with_synthetic_fetch_delegate',
  runnerVersion: PHASE_6_9_7_SCHEMA_RECOVERY_RUNNER_VERSION,
  responderInput: 'actual_bounded_system_and_user_prompt',
  tutorSelection: 'first_locally_eligible_intent_ordinal',
  extensionTutorCaseIds: PHASE_6_9_7_SCHEMA_RECOVERY_EXTENSION_TUTOR_CASE_IDS,
  extensionHandling: 'bounded_audit_then_discard_before_local_authority',
  authority: 'schema_recovery_mock_quality_not_evidence',
  qualityAuthority: 'none',
  providerCalls: 0,
  forbidden: [
    'credential_read',
    'network_delegate',
    'dataset_expected_or_oracle_in_responder',
    'production_live_composition_injection',
    'formal_sr5_evidence',
    'provider_quality_authority',
    'business_write',
  ],
});

export const PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_SHA256 =
  `sha256:${sha256Canonical(REVIEWED_MOCK_FACTORY_SOURCE)}` as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FROZEN_SHA256 =
  'sha256:8f18c1c2a73790818f63b64e0da67852900d341c99b9f599e9838eba41c93d44' as const;

if (
  PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_SHA256 !==
  PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FROZEN_SHA256
) {
  throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_SHA_MISMATCH');
}

const REVIEWED_MOCK_CHECKPOINT = deepFreeze({
  version: PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_CHECKPOINT_VERSION,
  schemaRecoverySourceManifestSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256,
  fullGateManifestSha256: PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
  fullGateEvalPolicySha256: PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256,
  deterministicBaselineAuthoritySha256: PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256,
  deterministicBaselineReportSha256: PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
  deterministicBaselineFileSha256: PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
  reviewedMockFactoryVersion: PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_VERSION,
  reviewedMockFactorySha256: PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_SHA256,
  reportVersion: PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_VERSION,
  reportContractVersion: PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_CONTRACT_VERSION,
  runnerVersion: PHASE_6_9_7_SCHEMA_RECOVERY_RUNNER_VERSION,
  durabilityVersion: PHASE_6_9_7_SCHEMA_RECOVERY_DURABILITY_VERSION,
  markerVersion: PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_VERSION,
  journalRecordVersion: PHASE_6_9_7_SCHEMA_RECOVERY_JOURNAL_RECORD_VERSION,
  artifactVersion: PHASE_6_9_7_SCHEMA_RECOVERY_ARTIFACT_VERSION,
  checkpointAuthority: 'zero_provider_full_gate_schema_recovery_reviewed_mock_static',
  qualityAuthority: 'none',
});

export const PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_CHECKPOINT_SHA256 =
  computePhase697FullGateCanonicalSha256(REVIEWED_MOCK_CHECKPOINT);
export const PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FROZEN_CHECKPOINT_SHA256 =
  '03bb81a65b0ae838646191fb58abf2dcf0af73f5e720812b5789a185afcb6960' as const;

if (
  PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_CHECKPOINT_SHA256 !==
  PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FROZEN_CHECKPOINT_SHA256
) {
  throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_CHECKPOINT_SHA_MISMATCH');
}

export type Phase697SchemaRecoveryReviewedMockInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  faults?: Readonly<Record<string, Phase697FullGateReviewedMockFault | undefined>>;
  contractFaults?: Readonly<Record<string, Phase697FullGateReviewedMockContractFault | undefined>>;
  onRequest?: (request: Phase697FullGateReviewedMockRequestAudit) => void;
}>;

/**
 * SR4-only zero-provider composition. Tutor crosses the independent recovery
 * envelope/parser/projection/local merger; Organizer retains the reviewed V9
 * option-authority path. The first-party adapter receives only an injected
 * synthetic fetch delegate, while the SR3 runner owns schema/wire durability.
 */
export function createPhase697SchemaRecoveryReviewedMockHarness(
  input: Phase697SchemaRecoveryReviewedMockInput,
): Readonly<Phase697SchemaRecoveryHarness> {
  const reviewed = createPhase697FullGateReviewedMockHarness(input);
  return Object.freeze({
    mode: 'mock' as const,
    executorProvenance: 'mock_synthetic' as const,
    runGuard: reviewed.runGuard,
    runTutor: (entry, signal, capability) => runTutorMock(entry, signal, capability, input),
    async runOrganizer(entry, signal, capability) {
      const result = await reviewed.runOrganizer(entry, signal, capability);
      return Object.freeze({
        ...result,
        schema: schemaForRuntimeResult(result),
      });
    },
  });
}

async function runTutorMock(
  entry: Phase697V2TutorRuntimeCase,
  signal: AbortSignal,
  capability: Phase697V7WireCapability,
  input: Phase697SchemaRecoveryReviewedMockInput,
): Promise<Phase697SchemaRecoveryRuntimeResult> {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: SYNTHETIC_CREDENTIAL,
      baseURL: PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
      model: 'deepseek-v4-pro',
    },
    capability,
    {
      fetch: createTutorSyntheticFetch({
        caseId: entry.id,
        fault: input.faults?.[entry.id],
        onRequest: input.onRequest,
      }),
    },
  );
  if (adapter.provenance !== 'synthetic_test') {
    throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_MOCK_ADAPTER_PROVENANCE_INVALID');
  }

  let runtimeInvocations = 0;
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
    executor: async (request) => {
      runtimeInvocations += 1;
      return adapter.executor(request);
    },
  });
  const startedAt = performance.now();
  const candidate = await runTutorSchemaRecoveryModelCandidate({
    runId: `${input.runId}:schema-recovery:tutor:${entry.pairedRunIndex}`,
    finalRoute: 'tutor',
    latestUserText: entry.input.latestUserText,
    ...(entry.input.activeStudyContext === undefined
      ? {}
      : { activeStudyContext: entry.input.activeStudyContext }),
    deterministic: buildTutorStrategy({
      latestUserText: entry.input.latestUserText,
      activeStudyContext: entry.input.activeStudyContext,
    }),
    safety: {
      latestUserText: 'safe_for_model',
      ...(entry.input.activeStudyContext === undefined
        ? {}
        : { activeStudyContext: 'safe_for_model' as const }),
    },
    runtime,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: TUTOR_MAX_INPUT_TOKENS,
      maxOutputTokens: TUTOR_MAX_OUTPUT_TOKENS,
    }),
    signal,
  });
  return mapTutorCandidate({
    entry,
    candidate,
    runtimeInvocations,
    orchestrationDurationMs: performance.now() - startedAt,
    signal,
    contractFault: input.contractFaults?.[entry.id],
  });
}

function mapTutorCandidate(input: {
  entry: Phase697V2TutorRuntimeCase;
  candidate: TutorSchemaRecoveryModelCandidateEnvelope;
  runtimeInvocations: number;
  orchestrationDurationMs: number;
  signal: AbortSignal;
  contractFault: Phase697FullGateReviewedMockContractFault | undefined;
}): Phase697SchemaRecoveryRuntimeResult {
  const trace =
    input.candidate.observation.attempted && 'trace' in input.candidate.observation
      ? input.candidate.observation.trace
      : undefined;
  const durationMs = readNonNegativeFinite(trace?.durationMs);
  const usage = readVerifiedUsage(input.candidate);
  const schemaSuccess =
    input.candidate.schemaDiagnostic === null ||
    input.candidate.schemaDiagnostic.reasonCode === 'extension_fields_discarded';
  const success =
    input.runtimeInvocations === 1 &&
    input.candidate.observation.disposition === 'candidate_applied' &&
    input.candidate.observation.attempted &&
    trace !== undefined &&
    trace.mode === 'live' &&
    trace.provider === 'deepseek' &&
    trace.model === 'deepseek-v4-pro' &&
    trace.status === 'succeeded' &&
    durationMs !== null &&
    durationMs <= PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS &&
    usage !== null &&
    schemaSuccess;

  if (success && input.contractFault === 'semantic_axes_drift') {
    return failedResult(
      'attempted_failed',
      'dynamic_authority',
      rejectedObservation('dynamic_authority'),
      true,
    );
  }
  if (success) {
    const expected = input.entry.expected;
    const actual = input.candidate.result;
    return Object.freeze({
      disposition: 'succeeded' as const,
      failureCategory: 'none' as const,
      strictRuntimeSuccess: true,
      durationMs,
      orchestrationDurationMs: Math.max(
        durationMs,
        readNonNegativeFinite(input.orchestrationDurationMs) ?? durationMs,
      ),
      usage,
      semantic: Object.freeze({
        agent: 'tutor' as const,
        observation: Object.freeze({
          caseId: input.entry.id,
          expectedIntent: expected.intent,
          actualIntent: actual.intent === 'answer_direct' ? null : actual.intent,
          expectedDepth: expected.depth,
          actualDepth: actual.depth,
          expectedContextUse: expected.contextUse,
          actualContextUse: actual.shouldUseActiveStudyContext,
          expectedGuidingQuestion: expected.guidingQuestion,
          actualGuidingQuestion: actual.shouldAskGuidingQuestion,
          expectedFinalAnswer: expected.finalAnswer,
          actualFinalAnswer: actual.shouldGiveFinalAnswer,
          expectedAnswerStructure: [...expected.answerStructure],
          actualAnswerStructure: [...actual.answerStructure],
          validOutput: true,
        }),
      }),
      safety: CLEAR_SAFETY,
      schema: successObservation(input.candidate.schemaDiagnostic),
    });
  }

  const aborted =
    isAborted(input.signal) || input.candidate.observation.disposition === 'fallback_aborted';
  const failureCategory = aborted
    ? isAborted(input.signal)
      ? ('external_abort' as const)
      : ('abort' as const)
    : classifyTutorFailure(input.candidate, input.runtimeInvocations);
  return failedResult(
    aborted ? 'attempted_aborted' : 'attempted_failed',
    failureCategory,
    schemaForTutorFailure(input.candidate, failureCategory),
    failureCategory === 'dynamic_authority' || failureCategory === 'internal',
  );
}

function createTutorSyntheticFetch(input: {
  caseId: string;
  fault: Phase697FullGateReviewedMockFault | undefined;
  onRequest: Phase697SchemaRecoveryReviewedMockInput['onRequest'];
}): typeof fetch {
  return (url, init) => {
    if (input.fault === 'fetch_sync_throw') {
      throw new Error('SCHEMA_RECOVERY_SR4_SYNTHETIC_FETCH_SYNC_THROW');
    }
    const request = parseTutorDirectRequest(url, init);
    input.onRequest?.(
      Object.freeze({
        agent: 'tutor',
        caseId: input.caseId,
        url: DIRECT_COMPLETIONS_URL,
        systemPrompt: request.messages[0].content,
        userPrompt: request.messages[1].content,
        maxOutputTokens: request.max_tokens,
      }),
    );
    if (input.fault === 'fetch_reject') {
      return Promise.reject(new Error('SCHEMA_RECOVERY_SR4_SYNTHETIC_FETCH_REJECT'));
    }
    if (input.fault === 'wait_for_abort') return rejectWhenAborted(init?.signal);
    if (input.fault === 'ignore_abort') return new Promise<Response>(() => undefined);

    const projection = TUTOR_PROMPT_SCHEMA.parse(JSON.parse(request.messages[1].content));
    const selected = projection.eligibleIntents[0];
    if (!selected) throw new Error('SCHEMA_RECOVERY_SR4_TUTOR_ORDINAL_UNAVAILABLE');
    const output = EXTENSION_CASES.has(input.caseId)
      ? {
          intentIndex: selected.intentIndex,
          syntheticEnvelopeMeta: { source: EXTENSION_SENTINEL, confidence: 0.93 },
        }
      : { intentIndex: selected.intentIndex };
    return Promise.resolve(buildTutorSyntheticResponse(request, output, input.fault));
  };
}

function parseTutorDirectRequest(
  url: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
) {
  const normalizedUrl =
    typeof url === 'string'
      ? url
      : url instanceof URL
        ? url.href
        : url instanceof Request
          ? url.url
          : null;
  if (
    normalizedUrl !== DIRECT_COMPLETIONS_URL ||
    init?.method !== 'POST' ||
    typeof init.body !== 'string'
  ) {
    throw new Error('SCHEMA_RECOVERY_SR4_TUTOR_REQUEST_SHAPE_INVALID');
  }
  const headers = new Headers(init.headers);
  if (
    headers.get('authorization') !== `Bearer ${SYNTHETIC_CREDENTIAL}` ||
    headers.get('content-type') !== 'application/json'
  ) {
    throw new Error('SCHEMA_RECOVERY_SR4_TUTOR_REQUEST_HEADERS_INVALID');
  }
  const request = DIRECT_REQUEST_SCHEMA.parse(JSON.parse(init.body));
  if (request.messages[0].content !== TUTOR_SYSTEM_PROMPT) {
    throw new Error('SCHEMA_RECOVERY_SR4_TUTOR_CANDIDATE_REQUEST_INVALID');
  }
  return request;
}

function buildTutorSyntheticResponse(
  request: z.infer<typeof DIRECT_REQUEST_SCHEMA>,
  output: unknown,
  fault: Phase697FullGateReviewedMockFault | undefined,
) {
  const faultedOutput = fault === 'schema_mismatch' ? { unexpected: true } : output;
  const usage = syntheticUsage(request, faultedOutput);
  if (fault === 'http_auth') return new Response('synthetic auth', { status: 401 });
  if (fault === 'http_rate_limit') return new Response('synthetic rate limit', { status: 429 });
  if (fault === 'http_client') return new Response('synthetic client', { status: 422 });
  if (fault === 'http_server') return new Response('synthetic server', { status: 503 });
  if (fault === 'abnormal_status') return responseWithStatus(302);
  if (fault === 'empty_response') return new Response('', { status: 200 });
  if (fault === 'malformed_response_json') return new Response('{invalid', { status: 200 });

  const content =
    fault === 'missing_completion'
      ? undefined
      : fault === 'malformed_completion_json'
        ? '{invalid'
        : JSON.stringify(faultedOutput);
  const payload: Record<string, unknown> = {
    choices: [{ message: { ...(content === undefined ? {} : { content }) } }],
    usage: {
      prompt_tokens: usage.inputTokens,
      completion_tokens: usage.outputTokens,
      completion_tokens_details: {
        reasoning_tokens: fault === 'positive_reasoning_tokens' ? 1 : 0,
      },
    },
  };
  if (fault === 'reasoning_content') {
    payload.choices = [{ message: { content, reasoning_content: 'synthetic reasoning' } }];
  }
  if (fault === 'usage_missing') delete payload.usage;
  if (fault === 'usage_zero') (payload.usage as Record<string, unknown>).prompt_tokens = 0;
  if (fault === 'usage_negative') (payload.usage as Record<string, unknown>).prompt_tokens = -1;
  if (fault === 'usage_fractional') (payload.usage as Record<string, unknown>).prompt_tokens = 1.5;
  if (fault === 'usage_overflow') {
    (payload.usage as Record<string, unknown>).prompt_tokens = Number.MAX_SAFE_INTEGER + 1;
  }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function classifyTutorFailure(
  candidate: TutorSchemaRecoveryModelCandidateEnvelope,
  runtimeInvocations: number,
): Phase697FullGateCaseEntry['failureCategory'] {
  if (runtimeInvocations > 1) return 'internal';
  if (candidate.observation.disposition === 'fallback_budget_exceeded') return 'budget';
  if (candidate.observation.disposition === 'fallback_timeout') return 'timeout';
  const diagnostic = candidate.schemaDiagnostic;
  if (diagnostic !== null && diagnostic.reasonCode !== 'extension_fields_discarded') {
    if (diagnostic.stage === 'local_authority' || diagnostic.stage === 'local_merger') {
      return 'dynamic_authority';
    }
    if (diagnostic.stage === 'usage') return 'usage';
    return 'schema';
  }
  const trace =
    candidate.observation.attempted && 'trace' in candidate.observation
      ? candidate.observation.trace
      : undefined;
  if (trace?.errorCode === 'TIMEOUT') return 'timeout';
  if (trace?.providerFailureCategory === 'transport') return 'transport';
  if (trace?.providerFailureCategory?.startsWith('http_')) return 'http';
  if (
    trace?.providerFailureCategory === 'structured_output' ||
    trace?.providerFailureCategory === 'invalid_response' ||
    trace?.structuredOutputStage !== undefined
  ) {
    return 'schema';
  }
  if (
    candidate.observation.attempted &&
    (trace?.providerFailureCategory === 'unknown' || !validUsage(candidate.observation.usage))
  ) {
    return 'usage';
  }
  return 'internal';
}

function successObservation(
  diagnostic: TutorSchemaRecoveryBoundedDiagnostic | null,
): Phase697SchemaRecoverySchemaObservation {
  return PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse(
    diagnostic === null
      ? { outcome: 'canonical', diagnostic: null }
      : { outcome: 'extension_fields_discarded', diagnostic },
  );
}

function schemaForTutorFailure(
  candidate: TutorSchemaRecoveryModelCandidateEnvelope,
  category: Phase697FullGateCaseEntry['failureCategory'],
): Phase697SchemaRecoverySchemaObservation {
  if (isContractFailureCategory(category)) {
    const diagnostic =
      candidate.schemaDiagnostic !== null &&
      candidate.schemaDiagnostic.reasonCode !== 'extension_fields_discarded'
        ? candidate.schemaDiagnostic
        : diagnosticForCategory(category);
    return PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse({
      outcome: 'rejected',
      diagnostic,
    });
  }
  return PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED;
}

function schemaForRuntimeResult(
  result: Omit<Phase697SchemaRecoveryRuntimeResult, 'schema'>,
): Phase697SchemaRecoverySchemaObservation {
  if (result.disposition === 'succeeded') {
    return PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse({
      outcome: 'canonical',
      diagnostic: null,
    });
  }
  return isContractFailureCategory(result.failureCategory)
    ? rejectedObservation(result.failureCategory)
    : PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED;
}

function rejectedObservation(
  category: 'schema' | 'dynamic_authority' | 'usage',
): Phase697SchemaRecoverySchemaObservation {
  return PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse({
    outcome: 'rejected',
    diagnostic: diagnosticForCategory(category),
  });
}

function diagnosticForCategory(category: 'schema' | 'dynamic_authority' | 'usage') {
  const collector = createTutorSchemaRecoveryDiagnosticCollector();
  if (category === 'schema') collector.recordProjectedSchemaFailure();
  else if (category === 'dynamic_authority') collector.recordLocalAuthorityFailure();
  else collector.recordUsageFailure();
  const diagnostic = collector.read();
  if (diagnostic === null) {
    throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_MOCK_DIAGNOSTIC_UNAVAILABLE');
  }
  return diagnostic;
}

function isContractFailureCategory(
  category: Phase697FullGateCaseEntry['failureCategory'],
): category is 'schema' | 'dynamic_authority' | 'usage' {
  return category === 'schema' || category === 'dynamic_authority' || category === 'usage';
}

function failedResult(
  disposition: 'attempted_failed' | 'attempted_aborted',
  failureCategory: Phase697FullGateCaseEntry['failureCategory'],
  schema: Phase697SchemaRecoverySchemaObservation,
  criticalFailure: boolean,
): Phase697SchemaRecoveryRuntimeResult {
  return Object.freeze({
    disposition,
    failureCategory,
    strictRuntimeSuccess: false,
    durationMs: null,
    orchestrationDurationMs: null,
    usage: null,
    semantic: null,
    safety: criticalFailure
      ? Object.freeze({ ...CLEAR_SAFETY, criticalFailure: true })
      : CLEAR_SAFETY,
    schema,
  });
}

function readVerifiedUsage(candidate: TutorSchemaRecoveryModelCandidateEnvelope) {
  const usage = candidate.observation.usage;
  if (!validUsage(usage)) return null;
  return Object.freeze({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCostCny: calculatePhase697FullGateCostCny(usage.inputTokens, usage.outputTokens),
    pricingProfile: PHASE_6_9_7_FULL_GATE_PRICING_PROFILE,
  });
}

function validUsage(value: Readonly<{ inputTokens: number; outputTokens: number }>) {
  return (
    Number.isSafeInteger(value.inputTokens) &&
    value.inputTokens > 0 &&
    value.inputTokens <= TUTOR_MAX_INPUT_TOKENS &&
    Number.isSafeInteger(value.outputTokens) &&
    value.outputTokens > 0 &&
    value.outputTokens <= TUTOR_MAX_OUTPUT_TOKENS
  );
}

function syntheticUsage(request: z.infer<typeof DIRECT_REQUEST_SCHEMA>, output: unknown) {
  return Object.freeze({
    inputTokens: Math.min(
      TUTOR_MAX_INPUT_TOKENS,
      Math.max(
        1,
        Math.ceil(request.messages.map((message) => message.content).join('\n').length / 4),
      ),
    ),
    outputTokens: Math.min(
      TUTOR_MAX_OUTPUT_TOKENS,
      Math.max(1, Math.ceil(JSON.stringify(output).length / 4)),
    ),
  });
}

function rejectWhenAborted(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error('SCHEMA_RECOVERY_SR4_SYNTHETIC_ABORT_SIGNAL_MISSING'));
      return;
    }
    const rejectAborted = () => reject(new Error('SCHEMA_RECOVERY_SR4_SYNTHETIC_ABORTED'));
    if (signal.aborted) {
      rejectAborted();
      return;
    }
    signal.addEventListener('abort', rejectAborted, { once: true });
  });
}

function responseWithStatus(status: number): Response {
  const target = new Response('{}', { status: 200 });
  return new Proxy(target, {
    get(inner, property) {
      if (property === 'status') return status;
      return Reflect.get(inner, property, inner) as unknown;
    },
  });
}

function readNonNegativeFinite(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

function sha256Canonical(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const CLEAR_SAFETY = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
  lockedNameChanged: false,
  writeCommandLeaked: false,
});
