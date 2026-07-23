import { describe, expect, test } from 'bun:test';

import type { StructuredModelExecutor } from '@repo/ai';

import {
  phase69TutorCases,
  phase69WrongQuestionOrganizerCases,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import {
  createPhase697TutorOrganizerLiveHarness,
  createPhase697TutorOrganizerMockHarness,
  runPhase697TutorOrganizerPairedEval,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';

describe('phase 6.9.7 Tutor/Organizer paired runner', () => {
  test('runs one Tutor and one Organizer concurrently for every paired index', async () => {
    const base = createPhase697TutorOrganizerMockHarness();
    let active = 0;
    let maximumActive = 0;
    const withDelay = async <T>(operation: () => Promise<T>) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      try {
        return await operation();
      } finally {
        active -= 1;
      }
    };

    const report = await runPhase697TutorOrganizerPairedEval({
      ...base,
      runTutor: (entry) => withDelay(() => base.runTutor(entry)),
      runOrganizer: (entry) => withDelay(() => base.runOrganizer(entry)),
    });

    expect(maximumActive).toBeGreaterThanOrEqual(2);
    expect(report.latency.pairedCandidateSamplesMs).toHaveLength(24);
    expect(report.caseEntries.filter((entry) => entry.zeroCallVerified)).toHaveLength(24);
    expect(report.caseEntries.reduce((sum, entry) => sum + entry.runtimeInvocations, 0)).toBe(48);
    for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
      const pair = report.caseEntries.filter((entry) => entry.pairedRunIndex === pairedRunIndex);
      expect(pair.map((entry) => entry.agent).sort()).toEqual([
        'tutor',
        'wrong_question_organizer',
      ]);
    }
  });

  test('keeps failed runtime outcomes in the fixed 48-case denominator', async () => {
    const base = createPhase697TutorOrganizerMockHarness();
    let replaced = false;
    const report = await runPhase697TutorOrganizerPairedEval({
      ...base,
      async runTutor(entry) {
        const result = await base.runTutor(entry);
        if (replaced) return result;
        replaced = true;
        return {
          ...result,
          canonicalSchemaSuccess: false,
          candidateDisposition: 'fallback_schema_invalid' as const,
          observation: { ...result.observation, validOutput: false },
        };
      },
    });

    expect(report.metrics.tutor.scoredCases).toBe(24);
    expect(report.metrics.tutor.invalidCases).toBe(1);
    expect(report.safety.strictRuntimeSuccesses).toBe(47);
    expect(report.caseEntries).toHaveLength(72);
    expect(report.gate).toBe('quality_gate_failed');
  });

  test('derives zero-call outcomes from guards instead of echoing expected reason', async () => {
    const harness = createPhase697TutorOrganizerMockHarness();
    const routeCase = phase69TutorCases.find((entry) => entry.id === 'tutor-route-not-tutor');
    if (!routeCase || routeCase.expectedRuntimeInvocations !== 0) {
      throw new Error('missing route zero-call fixture');
    }

    const result = await harness.runZeroCall({
      ...routeCase,
      expected: { zeroCallReason: 'budget_exhausted' },
    });

    expect(result).toMatchObject({
      runtimeInvocations: 0,
      observedReason: 'route_not_tutor',
    });
  });

  test('drives both real candidate contracts with a no-network Live executor', async () => {
    const tutorCases = phase69TutorCases.filter((entry) => entry.expectedRuntimeInvocations === 1);
    const organizerCases = phase69WrongQuestionOrganizerCases.filter(
      (entry) => entry.expectedRuntimeInvocations === 1,
    );
    let tutorInvocations = 0;
    let organizerInvocations = 0;
    const tutorExecutor: StructuredModelExecutor = async () => {
      const entry = tutorCases[tutorInvocations++]!;
      return {
        object: {
          intent: entry.expected.intent,
          depth: entry.expected.depth,
          confidence: 'high',
          evidenceCodes: [tutorEvidence(entry.expected.intent)],
        },
        usage: { inputTokens: 420, outputTokens: 90 },
      };
    };
    const organizerExecutor: StructuredModelExecutor = async (request) => {
      const entry = organizerCases[organizerInvocations++]!;
      const projection = JSON.parse(request.userPrompt) as {
        questions: Array<{ subjectHint: string }>;
      };
      return {
        object: {
          decisions: entry.expected.decisions.map((decision) => ({
            questionIndex: decision.questionIndex,
            subject:
              projection.questions[decision.questionIndex]?.subjectHint === 'unknown'
                ? decision.subject
                : 'keep_local',
            deck:
              decision.deckAction === 'reuse_existing'
                ? {
                    action: 'reuse_existing',
                    deckIndex: decision.deckIndex,
                  }
                : {
                    action: 'create_topic',
                    topicLabel: decision.canonicalTopicLabel,
                  },
            confidence: decision.confidence,
            evidenceCodes: decision.requiredEvidenceCodes,
          })),
        },
        usage: { inputTokens: 760, outputTokens: 180 },
      };
    };

    const report = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerLiveHarness({
        tutorExecutor,
        organizerExecutor,
        runScope: 'branch',
        executorProvenance: 'synthetic_test',
      }),
    );

    expect(tutorInvocations).toBe(24);
    expect(organizerInvocations).toBe(24);
    expect(report.safety.zeroCallVerified).toBe(24);
    expect(report.safety.strictRuntimeSuccesses).toBe(48);
    expect(report.metrics.tutor.semanticScore).toBe(1);
    expect(report.metrics.organizer.semanticScore).toBe(1);
    expect(report.identities.executorProvenance).toBe('synthetic_test');
    expect(report.gate).toBe('quality_gate_failed');
  });

  test('keeps a thrown harness case in the report instead of dropping the denominator', async () => {
    const base = createPhase697TutorOrganizerMockHarness();
    let thrown = false;
    const report = await runPhase697TutorOrganizerPairedEval({
      ...base,
      async runOrganizer(entry) {
        if (!thrown) {
          thrown = true;
          throw new Error('synthetic runner failure');
        }
        return base.runOrganizer(entry);
      },
    });

    expect(report.caseEntries).toHaveLength(72);
    expect(report.metrics.organizer.scoredDecisions).toBe(32);
    expect(report.metrics.organizer.invalidDecisions).toBe(1);
    expect(report.safety.strictRuntimeSuccesses).toBe(47);
  });
});

function tutorEvidence(
  intent:
    | 'explain_solution'
    | 'socratic_hint'
    | 'step_check'
    | 'concept_bridge'
    | 'general_follow_up',
) {
  switch (intent) {
    case 'explain_solution':
      return 'full_explanation_request';
    case 'socratic_hint':
      return 'implicit_hint_request';
    case 'step_check':
      return 'submitted_step';
    case 'concept_bridge':
      return 'concept_gap';
    case 'general_follow_up':
      return 'contextual_reference';
  }
}
