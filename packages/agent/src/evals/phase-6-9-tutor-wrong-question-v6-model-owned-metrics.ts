import { z } from 'zod';

import {
  PHASE_6_9_7_V6_DATASET_BINDING,
  type Phase697V6SubjectDecision,
} from './phase-6-9-tutor-wrong-question-v6-dataset-binding.ts';
import { PHASE_6_9_7_V6_EVAL_POLICY } from './phase-6-9-tutor-wrong-question-v6-policy.ts';
import { TUTOR_BOUNDED_INTENTS } from '../policies/tutor-strategy-policy.ts';

const SUBJECT_DECISION_SCHEMA = z.discriminatedUnion('action', [
  z.object({ action: z.literal('keep_local') }).strict(),
  z
    .object({
      action: z.literal('select_subject'),
      subjectIndex: z.number().int().min(0).max(5),
    })
    .strict(),
]);

const INPUT_SCHEMA = z
  .object({
    tutor: z
      .array(
        z
          .object({
            caseId: z.string().min(1).max(128),
            intent: z.enum(TUTOR_BOUNDED_INTENTS).nullable(),
          })
          .strict(),
      )
      .max(PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.tutorIntent.denominator),
    organizer: z
      .array(
        z
          .object({
            decisionId: z.string().min(1).max(160),
            subjectDecision: SUBJECT_DECISION_SCHEMA.nullable(),
            deckAction: z.enum(['reuse_existing', 'create_topic']).nullable(),
            targetOrdinal: z.number().int().min(0).max(19).nullable(),
          })
          .strict(),
      )
      .max(PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.organizerSubjectDecision.denominator),
  })
  .strict();

export type Phase697V6ModelOwnedMetric = Readonly<{
  correct: number;
  denominator: number;
  accuracy: number;
  complete: boolean;
  passed: boolean;
}>;

export type Phase697V6ModelOwnedMetrics = Readonly<{
  tutorIntent: Phase697V6ModelOwnedMetric;
  organizerSubjectDecision: Phase697V6ModelOwnedMetric;
  organizerDeckAction: Phase697V6ModelOwnedMetric;
  organizerTargetOrdinal: Phase697V6ModelOwnedMetric;
  qualityGatePassed: boolean;
}>;

export type Phase697V6ModelOwnedMetricsResult =
  | Readonly<{ ok: true; value: Phase697V6ModelOwnedMetrics }>
  | Readonly<{
      ok: false;
      reasonCode: 'invalid_input' | 'duplicate_observation' | 'unknown_observation';
    }>;

export function scorePhase697V6ModelOwnedMetrics(
  input: unknown,
): Phase697V6ModelOwnedMetricsResult {
  let parsed: ReturnType<typeof INPUT_SCHEMA.safeParse>;
  try {
    parsed = INPUT_SCHEMA.safeParse(input);
  } catch {
    return { ok: false, reasonCode: 'invalid_input' };
  }
  if (!parsed.success) return { ok: false, reasonCode: 'invalid_input' };
  if (
    hasDuplicates(parsed.data.tutor.map((entry) => entry.caseId)) ||
    hasDuplicates(parsed.data.organizer.map((entry) => entry.decisionId))
  ) {
    return { ok: false, reasonCode: 'duplicate_observation' };
  }
  const tutorExpected = new Map(
    PHASE_6_9_7_V6_DATASET_BINDING.tutorModelOwnedExpectations.map((entry) => [
      entry.caseId,
      entry,
    ]),
  );
  const organizerExpected = new Map(
    PHASE_6_9_7_V6_DATASET_BINDING.organizerModelOwnedExpectations.map((entry) => [
      entry.decisionId,
      entry,
    ]),
  );
  if (
    parsed.data.tutor.some((entry) => !tutorExpected.has(entry.caseId)) ||
    parsed.data.organizer.some((entry) => !organizerExpected.has(entry.decisionId))
  ) {
    return { ok: false, reasonCode: 'unknown_observation' };
  }

  const tutorActual = new Map(parsed.data.tutor.map((entry) => [entry.caseId, entry]));
  const organizerActual = new Map(parsed.data.organizer.map((entry) => [entry.decisionId, entry]));
  const tutorComplete = tutorActual.size === tutorExpected.size;
  const organizerComplete = organizerActual.size === organizerExpected.size;
  const tutorCorrect = [...tutorExpected.values()].filter(
    (expected) => tutorActual.get(expected.caseId)?.intent === expected.intent,
  ).length;
  let subjectCorrect = 0;
  let deckCorrect = 0;
  let targetCorrect = 0;
  for (const expected of organizerExpected.values()) {
    const actual = organizerActual.get(expected.decisionId);
    const deckActionMatches = actual?.deckAction === expected.deckAction;
    if (sameSubjectDecision(actual?.subjectDecision ?? null, expected.subjectDecision)) {
      subjectCorrect += 1;
    }
    if (deckActionMatches) deckCorrect += 1;
    if (deckActionMatches && actual?.targetOrdinal === expected.targetOrdinal) targetCorrect += 1;
  }

  const tutorIntent = buildMetric(
    tutorCorrect,
    PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.tutorIntent.denominator,
    PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.tutorIntent.minimumCorrect,
    tutorComplete,
  );
  const organizerSubjectDecision = buildMetric(
    subjectCorrect,
    PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.organizerSubjectDecision.denominator,
    PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.organizerSubjectDecision.minimumCorrect,
    organizerComplete,
  );
  const organizerDeckAction = buildMetric(
    deckCorrect,
    PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.organizerDeckAction.denominator,
    PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.organizerDeckAction.minimumCorrect,
    organizerComplete,
  );
  const organizerTargetOrdinal = buildMetric(
    targetCorrect,
    PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.organizerTargetOrdinal.denominator,
    PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality.organizerTargetOrdinal.minimumCorrect,
    organizerComplete,
  );
  return {
    ok: true,
    value: Object.freeze({
      tutorIntent,
      organizerSubjectDecision,
      organizerDeckAction,
      organizerTargetOrdinal,
      qualityGatePassed:
        tutorIntent.passed &&
        organizerSubjectDecision.passed &&
        organizerDeckAction.passed &&
        organizerTargetOrdinal.passed,
    }),
  };
}

function sameSubjectDecision(
  actual: Phase697V6SubjectDecision | null,
  expected: Phase697V6SubjectDecision,
) {
  if (actual === null || actual.action !== expected.action) return false;
  return (
    actual.action === 'keep_local' ||
    (expected.action === 'select_subject' && actual.subjectIndex === expected.subjectIndex)
  );
}

function buildMetric(
  correct: number,
  denominator: number,
  minimumCorrect: number,
  complete: boolean,
): Phase697V6ModelOwnedMetric {
  return Object.freeze({
    correct,
    denominator,
    accuracy: correct / denominator,
    complete,
    passed: complete && correct >= minimumCorrect,
  });
}

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length;
}
