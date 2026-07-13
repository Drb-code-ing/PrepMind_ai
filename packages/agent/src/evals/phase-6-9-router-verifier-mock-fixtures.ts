import { createModelAgentRuntime, type ModelAgentRuntime } from '@repo/ai';

const ROUTER_FIXTURES = {
  router_ambiguous_notes_tutor_01: { route: 'tutor', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_rag_explain_02: { route: 'rag_answer', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_plan_review_03: { route: 'review_analysis', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_review_plan_04: { route: 'review_analysis', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_short_continue_05: { route: 'tutor', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_short_why_06: { route: 'tutor', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_pronoun_07: { route: 'tutor', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_no_context_08: { route: 'chat', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_material_general_09: { route: 'rag_answer', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_today_review_10: { route: 'review_analysis', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_question_deck_11: { route: 'tutor', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_plan_question_12: { route: 'chat', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_rewrite_rag_13: { route: 'rag_answer', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_rewrite_tutor_14: { route: 'tutor', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_mixed_review_15: { route: 'review_analysis', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
  router_ambiguous_mixed_chat_16: { route: 'chat', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' },
} as const;

const VERIFIER_FIXTURES = {
  verifier_conflict_derivative_sign_01: { status: 'conflict', evidenceCodes: ['condition_conflict'] },
  verifier_conflict_matrix_rank_02: { status: 'conflict', evidenceCodes: ['condition_conflict'] },
  verifier_conflict_probability_value_03: { status: 'conflict', evidenceCodes: ['condition_conflict'] },
  verifier_conflict_law_version_04: { status: 'conflict', evidenceCodes: ['condition_conflict'] },
  verifier_conflict_physics_unit_05: { status: 'conflict', evidenceCodes: ['condition_conflict'] },
  verifier_conflict_history_date_06: { status: 'conflict', evidenceCodes: ['condition_conflict'] },
  verifier_conflict_english_condition_07: { status: 'conflict', evidenceCodes: ['condition_conflict'] },
  verifier_conflict_premise_scope_08: { status: 'conflict', evidenceCodes: ['condition_conflict'] },
  verifier_uncertain_possible_error_01: { status: 'suspicious', evidenceCodes: ['stale_or_uncertain'] },
  verifier_uncertain_needs_check_02: { status: 'suspicious', evidenceCodes: ['stale_or_uncertain'] },
  verifier_uncertain_stale_version_03: { status: 'suspicious', evidenceCodes: ['stale_or_uncertain'] },
  verifier_uncertain_unknown_date_04: { status: 'suspicious', evidenceCodes: ['stale_or_uncertain'] },
} as const;

export function phase6943MockCandidateForCase(caseId: string): unknown {
  if (caseId in ROUTER_FIXTURES) {
    return ROUTER_FIXTURES[caseId as keyof typeof ROUTER_FIXTURES];
  }
  if (caseId in VERIFIER_FIXTURES) {
    return VERIFIER_FIXTURES[caseId as keyof typeof VERIFIER_FIXTURES];
  }
  throw new Error('PHASE_6943_UNKNOWN_MOCK_CASE');
}

export function createPhase6943MockRuntime(input: {
  caseId: string;
  agent?: 'router' | 'verifier';
  now?: () => number;
}): Pick<ModelAgentRuntime, 'invokeStructured'> {
  const candidate = phase6943MockCandidateForCase(input.caseId);
  return createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-4-3-test-fixture-v1',
    liveCallsEnabled: false,
    timeoutMs: 10_000,
    mockResponder: async () => candidate,
    ...(input.now ? { now: input.now } : {}),
  });
}
