import { createHash } from 'node:crypto';

import {
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY,
  PHASE_6_9_7_FULL_GATE_PRICING_PROFILE,
} from './phase-6-9-tutor-organizer-full-gate-contract.ts';
import { PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES } from './phase-6-9-tutor-organizer-full-gate-manifest.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY,
  PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE,
} from './phase-6-9-tutor-organizer-small-sample-contract.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_VERSION,
  createPhase697SmallSampleReviewedMockHarness,
  type Phase697SmallSampleReviewedMockContractFault,
  type Phase697SmallSampleReviewedMockFault,
  type Phase697SmallSampleReviewedMockRequestAudit,
} from './phase-6-9-tutor-organizer-small-sample-mock.ts';
import { PHASE_6_9_7_V7_SYNTHETIC_FAULTS } from './phase-6-9-tutor-wrong-question-v7-mock.ts';
import { PHASE_6_9_7_V9_PROVIDER_LIKE_FAULTS } from './phase-6-9-tutor-wrong-question-v9-mock.ts';
import type {
  Phase697FullGateHarness,
  Phase697FullGateRuntimeResult,
} from './run-phase-6-9-tutor-organizer-full-gate.ts';

export const PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_VERSION =
  'phase-6.9.7-tutor-organizer-full-gate-reviewed-mock-v1' as const;

const REVIEWED_MOCK_FACTORY_SOURCE = Object.freeze({
  version: PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_VERSION,
  upstreamFactoryVersion: PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_VERSION,
  upstreamFactorySha256: PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_SHA256,
  tutorCandidate: 'tutor_v6',
  organizerCandidate: 'wrong_question_organizer_v9',
  adapter: 'first_party_direct_with_synthetic_fetch_delegate',
  runner: 'phase_6_9_7_full_gate_f2',
  responderInput: 'actual_bounded_system_and_user_prompt',
  postCandidateProjection: 'local_authority_rebuild_before_full_gate_observation',
  tutorOrchestration: 'measured_around_candidate_and_never_below_candidate_duration',
  faultAdmission: 'known_fault_known_runtime_lane_and_agent_compatible',
  authority: 'mock_quality_not_evidence',
  qualityAuthority: 'none',
  providerCalls: 0,
  forbidden: [
    'credential_read',
    'network_delegate',
    'dataset_answer_table_in_responder',
    'production_live_composition_injection',
    'provider_quality_authority',
    'business_write',
  ],
});

export const PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_SHA256 =
  `sha256:${sha256Canonical(REVIEWED_MOCK_FACTORY_SOURCE)}` as const;
export const PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FROZEN_SHA256 =
  'sha256:53bcf0d4378f9a6c36b867053201f41bebbc7b05bf14f94edd0f24fc9f22da55' as const;

if (
  PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_SHA256 !==
  PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FROZEN_SHA256
) {
  throw new Error('PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_SHA_MISMATCH');
}

export type Phase697FullGateReviewedMockFault = Phase697SmallSampleReviewedMockFault;
export type Phase697FullGateReviewedMockContractFault =
  Phase697SmallSampleReviewedMockContractFault;
export type Phase697FullGateReviewedMockRequestAudit = Phase697SmallSampleReviewedMockRequestAudit;

export type Phase697FullGateReviewedMockHarnessInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  faults?: Readonly<Record<string, Phase697FullGateReviewedMockFault | undefined>>;
  contractFaults?: Readonly<Record<string, Phase697FullGateReviewedMockContractFault | undefined>>;
  onRequest?: (request: Phase697FullGateReviewedMockRequestAudit) => void;
}>;

const RUNTIME_AGENTS = new Map(
  PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES.filter((entry) => entry.kind === 'runtime').map(
    (entry) => [entry.caseId, entry.agent] as const,
  ),
);
const V7_FAULTS = new Set<string>(PHASE_6_9_7_V7_SYNTHETIC_FAULTS);
const V9_ONLY_FAULTS = new Set<string>(PHASE_6_9_7_V9_PROVIDER_LIKE_FAULTS);

/**
 * S3-only zero-provider composition. It deliberately reuses the reviewed S2
 * candidate/validator/local-merger chain and adapts only its result envelope to
 * the F2 full-gate runner. The production Live harness remains closed to fetch,
 * model, URL, clock, and executor injection.
 */
export function createPhase697FullGateReviewedMockHarness(
  input: Phase697FullGateReviewedMockHarnessInput,
): Readonly<Phase697FullGateHarness> {
  assertPolicyParity();
  assertFaultAdmission(input);
  const reviewed = createPhase697SmallSampleReviewedMockHarness(input);
  return Object.freeze({
    mode: 'mock' as const,
    executorProvenance: 'mock_synthetic' as const,
    runGuard: (entry) => reviewed.runGuard(entry),
    async runTutor(entry, signal, wireCapability) {
      const startedAt = performance.now();
      const result = await reviewed.runTutor(entry, signal, wireCapability);
      return adaptRuntimeResult(
        result,
        result.strictRuntimeSuccess && result.durationMs !== null
          ? Math.max(result.durationMs, performance.now() - startedAt)
          : null,
      );
    },
    async runOrganizer(entry, signal, wireCapability) {
      const result = await reviewed.runOrganizer(entry, signal, wireCapability);
      return adaptRuntimeResult(result, null);
    },
  });
}

function adaptRuntimeResult(
  result: Awaited<
    ReturnType<ReturnType<typeof createPhase697SmallSampleReviewedMockHarness>['runTutor']>
  >,
  orchestrationDurationMs: number | null,
): Phase697FullGateRuntimeResult {
  return Object.freeze({
    disposition: result.disposition,
    failureCategory: result.failureCategory,
    strictRuntimeSuccess: result.strictRuntimeSuccess,
    durationMs: result.durationMs,
    orchestrationDurationMs,
    usage: result.usage,
    semantic: result.semantic,
    safety: result.safety,
  });
}

function assertPolicyParity() {
  const small = PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY;
  const full = PHASE_6_9_7_FULL_GATE_EVAL_POLICY;
  if (
    PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE !== PHASE_6_9_7_FULL_GATE_PRICING_PROFILE ||
    small.latency.tutorHardTimeoutMs !== full.latency.tutorHardTimeoutMs ||
    small.latency.organizerHardTimeoutMs !== full.latency.organizerHardTimeoutMs ||
    small.laneBudget.tutor.calls !== full.budget.tutorPerLane.callsMax ||
    small.laneBudget.tutor.inputTokensMax !== full.budget.tutorPerLane.inputTokensMax ||
    small.laneBudget.tutor.outputTokensMax !== full.budget.tutorPerLane.outputTokensMax ||
    small.laneBudget.tutor.cnyMax !== full.budget.tutorPerLane.costCnyMax ||
    small.laneBudget.wrongQuestionOrganizer.calls !== full.budget.organizerPerLane.callsMax ||
    small.laneBudget.wrongQuestionOrganizer.inputTokensMax !==
      full.budget.organizerPerLane.inputTokensMax ||
    small.laneBudget.wrongQuestionOrganizer.outputTokensMax !==
      full.budget.organizerPerLane.outputTokensMax ||
    small.laneBudget.wrongQuestionOrganizer.cnyMax !== full.budget.organizerPerLane.costCnyMax
  ) {
    throw new Error('PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_POLICY_DRIFT');
  }
}

function assertFaultAdmission(input: Phase697FullGateReviewedMockHarnessInput) {
  for (const [caseId, fault] of Object.entries(input.faults ?? {})) {
    if (fault === undefined) continue;
    const agent = RUNTIME_AGENTS.get(caseId);
    if (
      agent === undefined ||
      (!V7_FAULTS.has(fault) && !V9_ONLY_FAULTS.has(fault)) ||
      (agent === 'tutor' && V9_ONLY_FAULTS.has(fault))
    ) {
      throw new Error('PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FAULT_INVALID');
    }
  }
  for (const [caseId, fault] of Object.entries(input.contractFaults ?? {})) {
    if (fault === undefined) continue;
    const agent = RUNTIME_AGENTS.get(caseId);
    if (
      agent === undefined ||
      !['semantic_axes_drift', 'write_command_leak'].includes(fault) ||
      (fault === 'write_command_leak' && agent !== 'wrong_question_organizer')
    ) {
      throw new Error('PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_CONTRACT_FAULT_INVALID');
    }
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
