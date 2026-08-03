import type { WrongQuestionOrganizerV9ModelCandidateEnvelope } from '@repo/agent/wrong-question-organizer-v9';
import { agentTraceCreateRequestSchema } from '@repo/types/api/agent-trace';

import {
  buildWrongQuestionOrganizerAdmissionTrace,
  buildWrongQuestionOrganizerFinalTrace,
  validateWrongQuestionOrganizerCandidateAdmission,
} from './wrong-question-organizer-agent-trace';

describe('wrong-question organizer agent trace', () => {
  it('admits only a successful exact runtime observation with positive verified usage and price', () => {
    const admission = validateWrongQuestionOrganizerCandidateAdmission(
      candidateObservation(),
    );

    expect(admission).toMatchObject({
      usage: { inputTokens: 120, outputTokens: 40 },
      estimatedCostCny: 0.0006,
    });
    expect(Object.isFrozen(admission)).toBe(true);

    for (const observation of [
      candidateObservation({ attempted: false }),
      candidateObservation({ disposition: 'fallback_runtime_error' }),
      candidateObservation({ usage: { inputTokens: 0, outputTokens: 40 } }),
      candidateObservation({ usage: { inputTokens: 121, outputTokens: 40 } }),
      candidateObservation({ trace: { provider: 'mock' } }),
      candidateObservation({ trace: { model: 'deepseek-v4-flash' } }),
      candidateObservation({ trace: { status: 'failed' } }),
      candidateObservation({ trace: { maxOutputTokens: 799 } }),
      candidateObservation({ budget: { usedCalls: 0 } }),
    ]) {
      expect(
        validateWrongQuestionOrganizerCandidateAdmission(observation),
      ).toBeNull();
    }
  });

  it('builds a schema-valid admission trace with command_pending and no raw identity', () => {
    const admission = validateWrongQuestionOrganizerCandidateAdmission(
      candidateObservation(),
    );
    expect(admission).not.toBeNull();
    const trace = buildWrongQuestionOrganizerAdmissionTrace({
      runId: 'run_safe_1',
      snapshotFingerprint: `sha256:${'a'.repeat(64)}`,
      targetCount: 2,
      startedAt: new Date('2026-07-23T08:00:00.000Z'),
      candidateFinishedAt: new Date('2026-07-23T08:00:00.120Z'),
      admission: admission!,
    });

    expect(agentTraceCreateRequestSchema.parse(trace)).toEqual(trace);
    expect(trace).toMatchObject({
      runId: 'run_safe_1',
      route: 'wrong_question_organize',
      mode: 'live',
      modelProvider: 'deepseek',
      modelName: 'deepseek-v4-pro',
      inputTokenEstimate: 120,
      outputTokenEstimate: 40,
      pricingKnown: false,
      costEstimate: 0,
      degraded: false,
    });
    expect(trace.steps.map((step) => step.node)).toEqual([
      'wrong_question_organizer_parent',
      'wrong_question_organizer_deterministic',
      'wrong_question_organizer_candidate',
      'wrong_question_organizer_command_pending',
    ]);
    const serialized = JSON.stringify(trace);
    expect(serialized).toContain(
      'version=wrong-question-organizer-model-candidate-v9',
    );
    expect(serialized).not.toContain('user_1');
    expect(serialized).not.toContain('wrong_1');
    expect(serialized).not.toContain('api_key');
  });

  it('admits the explicit sealed replay as mock zero-cost evidence without promoting it to Live', () => {
    const replayObservation = candidateObservation({
      trace: {
        mode: 'mock',
        provider: 'mock',
        model:
          'phase-6.9.7-sr6-sealed-replay-87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be',
      },
    });
    expect(
      validateWrongQuestionOrganizerCandidateAdmission(replayObservation),
    ).toBeNull();
    const admission = validateWrongQuestionOrganizerCandidateAdmission(
      replayObservation,
      'sr5_sealed_replay',
    );
    expect(admission).toMatchObject({
      runtimeAuthority: 'sr5_sealed_replay',
      estimatedCostCny: 0,
      trace: {
        mode: 'mock',
        provider: 'mock',
        model:
          'phase-6.9.7-sr6-sealed-replay-87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be',
      },
    });
    const trace = buildWrongQuestionOrganizerAdmissionTrace({
      runId: 'run_sr6_replay_1',
      snapshotFingerprint: `sha256:${'c'.repeat(64)}`,
      targetCount: 1,
      startedAt: new Date('2026-08-03T08:00:00.000Z'),
      candidateFinishedAt: new Date('2026-08-03T08:00:00.010Z'),
      admission: admission!,
    });
    expect(agentTraceCreateRequestSchema.parse(trace)).toEqual(trace);
    expect(trace).toMatchObject({
      mode: 'mock',
      modelProvider: 'mock',
      modelName:
        'phase-6.9.7-sr6-sealed-replay-87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be',
      pricingKnown: false,
      costEstimate: 0,
    });
    expect(JSON.stringify(trace)).toContain('authority=sr5_sealed_replay');
    expect(JSON.stringify(trace)).not.toContain('pricing=cny_known');
  });

  it('uses the same run id and atomically replaces pending with the final command step', () => {
    const admission = validateWrongQuestionOrganizerCandidateAdmission(
      candidateObservation(),
    );
    const trace = buildWrongQuestionOrganizerFinalTrace({
      runId: 'run_safe_1',
      snapshotFingerprint: `sha256:${'a'.repeat(64)}`,
      targetCount: 2,
      startedAt: new Date('2026-07-23T08:00:00.000Z'),
      candidateFinishedAt: new Date('2026-07-23T08:00:00.120Z'),
      finishedAt: new Date('2026-07-23T08:00:00.180Z'),
      admission: admission!,
      outcome: 'applied',
    });

    expect(agentTraceCreateRequestSchema.parse(trace)).toEqual(trace);
    expect(trace.runId).toBe('run_safe_1');
    expect(trace.steps.map((step) => step.node)).not.toContain(
      'wrong_question_organizer_command_pending',
    );
    expect(trace.steps.at(-1)).toMatchObject({
      node: 'wrong_question_organizer_command',
      status: 'completed',
      outputSummary: 'state=applied;authority=local_command',
    });
  });
});

function candidateObservation(
  overrides: {
    attempted?: boolean;
    disposition?: string;
    usage?: { inputTokens: number; outputTokens: number };
    trace?: Record<string, unknown>;
    budget?: Record<string, unknown>;
  } = {},
): WrongQuestionOrganizerV9ModelCandidateEnvelope['observation'] {
  const usage = overrides.usage ?? { inputTokens: 120, outputTokens: 40 };
  const trace = {
    runIdHash: `sha256:${'b'.repeat(64)}`,
    task: 'wrong_question_organization',
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    status: 'succeeded',
    inputTokens: 120,
    outputTokens: 40,
    maxOutputTokens: 800,
    durationMs: 120,
    degraded: false,
    ...overrides.trace,
  };
  const budget = {
    maxCalls: 1,
    usedCalls: 1,
    maxInputTokens: 3500,
    usedInputTokens: 300,
    maxOutputTokens: 800,
    usedOutputTokens: 800,
    ...overrides.budget,
  };
  return {
    attempted: overrides.attempted ?? true,
    disposition:
      (overrides.disposition as 'candidate_applied') ?? 'candidate_applied',
    budget,
    usage,
    trace,
    reasonCodes: ['candidate_applied', 'semantic_organization'],
  } as WrongQuestionOrganizerV9ModelCandidateEnvelope['observation'];
}
