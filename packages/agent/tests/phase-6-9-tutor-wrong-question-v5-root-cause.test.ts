import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
  phase69TutorCases,
  type Phase69TutorRuntimeCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import { resolvePhase697CanonicalDiagnostic } from '../src/evals/phase-6-9-tutor-wrong-question-bounded-diagnostics.ts';
import {
  runTutorModelCandidate,
  type TutorModelCandidateInput,
} from '../src/model-candidates/tutor-model-candidate.ts';
import { buildTutorStrategy } from '../src/nodes/tutor.ts';

const FROZEN_V1_SHA256 = '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e';

function runtimeCase(id: string) {
  const fixture = phase69TutorCases.find((entry) => entry.id === id);
  if (fixture?.subset !== 'runtime') throw new Error(`missing runtime fixture: ${id}`);
  return fixture as Phase69TutorRuntimeCase;
}

function createTrackedMockRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-v5-root-cause',
    liveCallsEnabled: false,
    timeoutMs: 500,
    mockResponder: () => output,
  });
  const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      requests.push(request as ModelAgentRequest<unknown>);
      return inner.invokeStructured(request);
    },
  };
  return { requests, runtime };
}

function candidateInput(
  fixture: Phase69TutorRuntimeCase,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
): TutorModelCandidateInput {
  return {
    runId: `v5-root-cause-${fixture.id}`,
    finalRoute: 'tutor',
    latestUserText: fixture.input.latestUserText,
    ...(fixture.input.activeStudyContext !== undefined
      ? { activeStudyContext: fixture.input.activeStudyContext }
      : {}),
    deterministic: buildTutorStrategy({
      latestUserText: fixture.input.latestUserText,
      ...(fixture.input.activeStudyContext !== undefined
        ? { activeStudyContext: fixture.input.activeStudyContext }
        : {}),
    }),
    safety: {
      latestUserText: 'safe_for_model',
      ...(fixture.input.activeStudyContext !== undefined
        ? { activeStudyContext: 'safe_for_model' }
        : {}),
    },
    runtime,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 1_200,
      maxOutputTokens: 300,
    }),
  };
}

describe('Phase 6.9.7 V5 zero-provider root-cause evidence', () => {
  test('preserves the frozen V1 dataset while proving tutor-runtime-06 is cross-topic and mis-tagged', () => {
    const fixture = runtimeCase('tutor-runtime-06');

    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256).toBe(FROZEN_V1_SHA256);
    expect(fixture.pairedRunIndex).toBe(5);
    expect(fixture.input.latestUserText).toBe('我把 x 移到左边后得到 2x=6，这里有没有算偏？');
    expect(fixture.input.activeStudyContext).toBe(
      'Synthetic calculus exercise: inspect the next derivative step.',
    );
    expect(fixture.tags).toContain('en');
    expect(fixture.tags).not.toContain('zh');
    expect(fixture.expected.intent).toBe('step_check');
  });

  test.each([
    {
      evidenceCodes: ['submitted_step'],
      expectedDisposition: 'candidate_applied',
      expectedReason: null,
    },
    {
      evidenceCodes: ['submitted_step', 'contextual_reference'],
      expectedDisposition: 'candidate_applied',
      expectedReason: null,
    },
    {
      evidenceCodes: ['contextual_reference'],
      expectedDisposition: 'fallback_schema_invalid',
      expectedReason: 'invalid_evidence_association',
    },
    {
      evidenceCodes: ['concept_gap'],
      expectedDisposition: 'fallback_schema_invalid',
      expectedReason: 'invalid_evidence_association',
    },
  ] as const)(
    'applies the product candidate contract to runtime-06 evidence $evidenceCodes',
    async ({ evidenceCodes, expectedDisposition, expectedReason }) => {
      const fixture = runtimeCase('tutor-runtime-06');
      const { requests, runtime } = createTrackedMockRuntime({
        intent: 'step_check',
        depth: 'standard',
        confidence: 'high',
        evidenceCodes,
      });
      const input = candidateInput(fixture, runtime);

      const result = await runTutorModelCandidate(input);

      expect(requests).toHaveLength(1);
      expect(result.observation.disposition).toBe(expectedDisposition);
      if (expectedReason === null) {
        expect(result.result.intent).toBe('step_check');
        expect(result.observation.reasonCodes).not.toContain('invalid_evidence_association');
      } else {
        expect(result.result).toEqual(input.deterministic);
        expect(result.observation.reasonCodes).toContain(expectedReason);
      }
    },
  );

  test('sends the incoherent V1 text/context pair to the same product candidate used by paired eval', async () => {
    const fixture = runtimeCase('tutor-runtime-06');
    const { requests, runtime } = createTrackedMockRuntime({
      intent: 'step_check',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['submitted_step'],
    });
    const input = candidateInput(fixture, runtime);

    expect(input.deterministic.intent).toBe('general_follow_up');
    await runTutorModelCandidate(input);

    const prompt = JSON.parse(requests[0]?.userPrompt ?? '{}') as {
      latestText?: string;
      activeContext?: { available?: boolean; excerpt?: string };
      deterministic?: { intent?: string };
      ambiguitySignals?: string[];
    };
    expect(prompt.latestText).toContain('x 移到左边');
    expect(prompt.latestText).toContain('2x=6');
    expect(prompt.activeContext?.available).toBe(true);
    expect(prompt.activeContext?.excerpt).toContain('calculus exercise');
    expect(prompt.activeContext?.excerpt).toContain('derivative step');
    expect(prompt.deterministic?.intent).toBe('general_follow_up');
    expect(prompt.ambiguitySignals).toContain('submitted_step');
  });

  test('maps the product rejection to the V4 dynamic-contract diagnostic without changing it', async () => {
    const fixture = runtimeCase('tutor-runtime-06');
    const { runtime } = createTrackedMockRuntime({
      intent: 'step_check',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['contextual_reference'],
    });

    const result = await runTutorModelCandidate(candidateInput(fixture, runtime));
    const diagnostic = resolvePhase697CanonicalDiagnostic({
      agent: 'tutor',
      structuredObjectCaptured: true,
      rawSchemaValid: true,
      candidateDisposition: result.observation.disposition,
      reasonCodes: result.observation.reasonCodes,
    });

    expect(result.observation.disposition).toBe('fallback_schema_invalid');
    expect(result.observation.reasonCodes).toContain('invalid_evidence_association');
    expect(diagnostic).toEqual({
      canonicalValidationStage: 'dynamic_contract',
      canonicalFailureReason: 'invalid_evidence_association',
    });
  });
});
