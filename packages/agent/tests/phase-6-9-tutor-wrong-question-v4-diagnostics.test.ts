import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_TUTOR_WRONG_QUESTION_CASES } from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v3-contract.ts';
import {
  PHASE_6_9_7_V4_CASE_DIAGNOSTIC_SCHEMA,
  PHASE_6_9_7_V4_DIAGNOSTIC_REPORT_SCHEMA,
  buildPhase697V4DiagnosticReport,
  projectPhase697V4CaseDiagnostic,
  type Phase697V4CaseDiagnostic,
  type Phase697V4SemanticObservation,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-diagnostics.ts';
import { runPhase697TutorOrganizerPairedEvalV3 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v3-paired.ts';
import {
  createPhase697TutorOrganizerMockHarness,
  runPhase697TutorOrganizerPairedEval,
  runPhase697TutorOrganizerPairedEvalV2,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';
import {
  WRONG_QUESTION_ORGANIZER_V4_FAILURE_DIAGNOSTIC_SCHEMA,
  validateWrongQuestionOrganizerModelDecision,
  validateWrongQuestionOrganizerModelDecisionV4,
  type WrongQuestionOrganizerV4FailureDiagnostic,
} from '../src/model-candidates/wrong-question-organizer-model-contract.ts';

const singleKnownContext = {
  questions: [{ subjectHint: 'math' }],
  decks: [{ subject: 'math' }, { subject: 'english' }],
} as const;
const singleUnknownContext = {
  questions: [{ subjectHint: 'unknown' }],
  decks: [{ subject: 'math' }, { subject: 'english' }],
} as const;

describe('Phase 6.9.7 Tutor/Organizer V4 bounded diagnostics', () => {
  test('returns the first Organizer failure in the frozen subject to confidence order', () => {
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        organizerDecision({
          subject: 'math',
          deck: { action: 'create_topic', topicLabel: '函数极限' },
          confidence: 'high',
          evidenceCodes: ['insufficient_signal'],
        }),
        singleKnownContext,
      ),
    ).toEqual(failedOrganizerDiagnostic('subject', 'known_subject_requires_keep_local'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        organizerDecision({
          subject: 'keep_local',
          deck: { action: 'create_topic', topicLabel: '函数极限' },
          confidence: 'medium',
          evidenceCodes: ['insufficient_signal'],
        }),
        singleUnknownContext,
      ),
    ).toEqual(failedOrganizerDiagnostic('subject', 'unknown_subject_requires_bounded_subject'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        organizerDecision({
          subject: 'math',
          deck: { action: 'reuse_existing', deckIndex: 2 },
          confidence: 'high',
          evidenceCodes: ['existing_deck_overlap'],
        }),
        singleUnknownContext,
      ),
    ).toEqual(failedOrganizerDiagnostic('deck', 'deck_index_out_of_range'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        organizerDecision({
          subject: 'math',
          deck: { action: 'reuse_existing', deckIndex: 1 },
          confidence: 'high',
          evidenceCodes: ['existing_deck_overlap'],
        }),
        singleUnknownContext,
      ),
    ).toEqual(failedOrganizerDiagnostic('deck', 'cross_subject_deck'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        organizerDecision({
          subject: 'math',
          deck: { action: 'create_topic', topicLabel: '未分类' },
          confidence: 'medium',
          evidenceCodes: ['semantic_topic'],
        }),
        singleUnknownContext,
      ),
    ).toEqual(failedOrganizerDiagnostic('topic', 'topic_label_invalid'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        organizerDecision({
          subject: 'keep_local',
          deck: { action: 'create_topic', topicLabel: '函数极限' },
          confidence: 'medium',
          evidenceCodes: ['semantic_topic'],
        }),
        singleKnownContext,
      ),
    ).toEqual(failedOrganizerDiagnostic('evidence', 'known_subject_evidence_missing'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        organizerDecision({
          subject: 'math',
          deck: { action: 'reuse_existing', deckIndex: 0 },
          confidence: 'high',
          evidenceCodes: ['semantic_topic'],
        }),
        singleUnknownContext,
      ),
    ).toEqual(failedOrganizerDiagnostic('evidence', 'deck_action_evidence_missing'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        organizerDecision({
          subject: 'math',
          deck: { action: 'create_topic', topicLabel: '函数极限' },
          confidence: 'high',
          evidenceCodes: ['insufficient_signal'],
        }),
        singleUnknownContext,
      ),
    ).toEqual(failedOrganizerDiagnostic('confidence', 'confidence_evidence_conflict'));
  });

  test('maps the detailed chain back to unchanged legacy reason codes', () => {
    expect(
      validateWrongQuestionOrganizerModelDecision(
        organizerDecision({
          subject: 'math',
          deck: { action: 'create_topic', topicLabel: '函数极限' },
          confidence: 'medium',
          evidenceCodes: ['semantic_topic'],
        }),
        singleKnownContext,
      ),
    ).toEqual({ ok: false, reasonCode: 'subject_authority_violation' });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        organizerDecision({
          subject: 'math',
          deck: { action: 'create_topic', topicLabel: '未分类' },
          confidence: 'medium',
          evidenceCodes: ['semantic_topic'],
        }),
        singleUnknownContext,
      ),
    ).toEqual({ ok: false, reasonCode: 'unsafe_topic_label' });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        organizerDecision({
          subject: 'math',
          deck: { action: 'reuse_existing', deckIndex: 0 },
          confidence: 'high',
          evidenceCodes: ['semantic_topic'],
        }),
        singleUnknownContext,
      ),
    ).toEqual({ ok: false, reasonCode: 'invalid_evidence_association' });
  });

  test('rejects free text and mismatched Organizer stage/axis/reason tuples', () => {
    expect(
      WRONG_QUESTION_ORGANIZER_V4_FAILURE_DIAGNOSTIC_SCHEMA.safeParse({
        stage: 'dynamic_contract',
        axis: 'subject',
        reasonCode: 'known_subject_requires_keep_local',
      }).success,
    ).toBe(true);
    for (const invalid of [
      {
        stage: 'raw_schema',
        axis: 'subject',
        reasonCode: 'known_subject_requires_keep_local',
      },
      { stage: 'dynamic_contract', axis: 'topic', reasonCode: 'free text' },
      {
        stage: 'dynamic_contract',
        axis: 'confidence',
        reasonCode: 'known_subject_evidence_missing',
      },
    ]) {
      expect(WRONG_QUESTION_ORGANIZER_V4_FAILURE_DIAGNOSTIC_SCHEMA.safeParse(invalid).success).toBe(
        false,
      );
    }
  });

  test('separates not-started, contract-failure, semantic-mismatch, and semantic-match cases', () => {
    const notStarted = projectPhase697V4CaseDiagnostic({
      caseId: 'tutor-zero-route',
      agent: 'tutor',
      notStartedReason: 'case_guard',
      runtimeContractSuccess: null,
      contractFailureStage: null,
      semanticObservation: null,
      organizerDynamicFailure: null,
    });
    const contractFailure = projectPhase697V4CaseDiagnostic({
      caseId: 'organizer-runtime-01',
      agent: 'wrong_question_organizer',
      notStartedReason: null,
      runtimeContractSuccess: false,
      contractFailureStage: 'dynamic_contract',
      semanticObservation: null,
      organizerDynamicFailure: {
        stage: 'dynamic_contract',
        axis: 'topic',
        reasonCode: 'topic_label_invalid',
      },
    });
    const semanticMismatch = projectPhase697V4CaseDiagnostic({
      caseId: 'tutor-runtime-01',
      agent: 'tutor',
      notStartedReason: null,
      runtimeContractSuccess: true,
      contractFailureStage: null,
      semanticObservation: tutorObservation({ intent: false }),
      organizerDynamicFailure: null,
    });
    const semanticMatch = projectPhase697V4CaseDiagnostic({
      caseId: 'organizer-runtime-02',
      agent: 'wrong_question_organizer',
      notStartedReason: null,
      runtimeContractSuccess: true,
      contractFailureStage: null,
      semanticObservation: organizerObservation(),
      organizerDynamicFailure: null,
    });

    expect(notStarted?.executionClassification).toBe('not_started');
    expect(contractFailure?.executionClassification).toBe('executed_contract_failure');
    expect(semanticMismatch).toMatchObject({
      executionClassification: 'executed_semantic_mismatch',
      semanticMatch: false,
    });
    expect(semanticMatch).toMatchObject({
      executionClassification: 'executed_semantic_match',
      semanticMatch: true,
    });
    expect(Object.isFrozen(semanticMismatch)).toBe(true);
    expect(Object.isFrozen(semanticMismatch?.semanticObservation?.axes)).toBe(true);
    expect(
      projectPhase697V4CaseDiagnostic({
        caseId: 'tutor-runtime-01',
        agent: 'tutor',
        notStartedReason: 'quality_breaker',
        runtimeContractSuccess: false,
        contractFailureStage: 'dynamic_contract',
        semanticObservation: null,
        organizerDynamicFailure: null,
      }),
    ).toBeNull();
    expect(
      projectPhase697V4CaseDiagnostic({
        caseId: 'organizer-runtime-01',
        agent: 'wrong_question_organizer',
        notStartedReason: null,
        runtimeContractSuccess: false,
        contractFailureStage: 'dynamic_contract',
        semanticObservation: null,
        organizerDynamicFailure: null,
      }),
    ).toBeNull();
    expect(
      projectPhase697V4CaseDiagnostic({
        caseId: 'organizer-runtime-01',
        agent: 'wrong_question_organizer',
        notStartedReason: null,
        runtimeContractSuccess: false,
        contractFailureStage: 'provider_runtime',
        semanticObservation: null,
        organizerDynamicFailure: null,
      })?.executionClassification,
    ).toBe('executed_contract_failure');
    expect(
      PHASE_6_9_7_V4_CASE_DIAGNOSTIC_SCHEMA.safeParse({
        ...semanticMatch,
        rawModelOutput: 'forbidden',
      }).success,
    ).toBe(false);

    let getterCalls = 0;
    const hostile = {
      caseId: 'tutor-runtime-01',
      agent: 'tutor',
      notStartedReason: null,
      runtimeContractSuccess: true,
      contractFailureStage: null,
      semanticObservation: tutorObservation(),
      organizerDynamicFailure: null,
    };
    Object.defineProperty(hostile, 'semanticObservation', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return tutorObservation();
      },
    });
    expect(
      projectPhase697V4CaseDiagnostic(
        hostile as unknown as Parameters<typeof projectPhase697V4CaseDiagnostic>[0],
      ),
    ).toBeNull();
    expect(getterCalls).toBe(0);
  });

  test('builds a strict 72-case bounded report with derived counts only', () => {
    const entries = buildCanonicalV4Entries();
    const report = buildPhase697V4DiagnosticReport(entries);
    expect(report).not.toBeNull();
    expect(report?.counts).toEqual({
      notStarted: 24,
      executedContractFailures: 1,
      executedSemanticMismatches: 1,
      executedSemanticMatches: 46,
    });
    expect(report?.contractFailureStageCounts.dynamic_contract).toBe(1);
    expect(report?.tutorSemanticMismatchAxisCounts.intent).toBe(1);
    expect(report?.organizerDynamicFailureReasonCounts.topic_label_invalid).toBe(1);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report?.caseEntries)).toBe(true);
    expect(
      PHASE_6_9_7_V4_DIAGNOSTIC_REPORT_SCHEMA.safeParse({
        ...report,
        counts: { ...report?.counts, notStarted: 25 },
      }).success,
    ).toBe(false);
    expect(buildPhase697V4DiagnosticReport([...entries.slice(0, -1), entries[0]!])).toBeNull();
  });

  test('keeps V4 fields absent from V1/V2/V3 and preserves generated history bytes', async () => {
    const v1 = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerMockHarness({
        runId: '00000000-0000-4000-8000-000000000411',
      }),
    );
    const v2 = await runPhase697TutorOrganizerPairedEvalV2(
      createPhase697TutorOrganizerMockHarness({
        runId: '00000000-0000-4000-8000-000000000412',
      }),
    );
    const v3 = await runPhase697TutorOrganizerPairedEvalV3(
      createPhase697TutorOrganizerMockHarness({
        runId: '00000000-0000-4000-8000-000000000413',
      }),
    );
    const reports = [v1, v2, v3] as const;
    const before = reports.map(stableSha256);

    for (const report of reports) {
      expect(
        report.caseEntries.every(
          (entry) =>
            !Object.hasOwn(entry, 'diagnosticVersion') &&
            !Object.hasOwn(entry, 'executionClassification') &&
            !Object.hasOwn(entry, 'semanticObservation') &&
            !Object.hasOwn(entry, 'organizerDynamicFailure'),
        ),
      ).toBe(true);
      expect(PHASE_6_9_7_V4_DIAGNOSTIC_REPORT_SCHEMA.safeParse(report).success).toBe(false);
    }

    expect(oldReportRejectsV4Field(v1, PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA)).toBe(true);
    expect(oldReportRejectsV4Field(v2, PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA)).toBe(true);
    expect(oldReportRejectsV4Field(v3, PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA)).toBe(true);
    expect(reports.map(stableSha256)).toEqual(before);
  });
});

function organizerDecision(
  decision: Readonly<{
    subject: 'keep_local' | 'math';
    deck:
      | Readonly<{ action: 'reuse_existing'; deckIndex: number }>
      | Readonly<{ action: 'create_topic'; topicLabel: string }>;
    confidence: 'medium' | 'high';
    evidenceCodes: readonly (
      | 'structured_subject'
      | 'semantic_topic'
      | 'existing_deck_overlap'
      | 'error_pattern'
      | 'insufficient_signal'
    )[];
  }>,
) {
  return { decisions: [{ questionIndex: 0, ...decision }] };
}

function failedOrganizerDiagnostic(
  axis: WrongQuestionOrganizerV4FailureDiagnostic['axis'],
  reasonCode: WrongQuestionOrganizerV4FailureDiagnostic['reasonCode'],
) {
  return {
    ok: false,
    diagnostic: { stage: 'dynamic_contract', axis, reasonCode },
  } as const;
}

function tutorObservation(
  overrides: Partial<Extract<Phase697V4SemanticObservation, { agent: 'tutor' }>['axes']> = {},
): Extract<Phase697V4SemanticObservation, { agent: 'tutor' }> {
  return {
    agent: 'tutor',
    axes: {
      intent: true,
      depth: true,
      evidenceAssociation: true,
      contextUse: true,
      guidingPolicy: true,
      finalAnswerBoundary: true,
      answerStructure: true,
      ...overrides,
    },
    moreSpecificPrimaryEvidenceSuppressed: null,
  };
}

function organizerObservation(
  overrides: Partial<
    Extract<Phase697V4SemanticObservation, { agent: 'wrong_question_organizer' }>['axes']
  > = {},
): Extract<Phase697V4SemanticObservation, { agent: 'wrong_question_organizer' }> {
  return {
    agent: 'wrong_question_organizer',
    axes: {
      subject: true,
      deck: true,
      topic: true,
      evidence: true,
      confidence: true,
      ...overrides,
    },
  };
}

function buildCanonicalV4Entries(): readonly Phase697V4CaseDiagnostic[] {
  let tutorRuntime = 0;
  let organizerRuntime = 0;
  return PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((testCase) => {
    if (testCase.expectedRuntimeInvocations === 0) {
      return requireDiagnostic(
        projectPhase697V4CaseDiagnostic({
          caseId: testCase.id,
          agent: testCase.agent,
          notStartedReason: 'case_guard',
          runtimeContractSuccess: null,
          contractFailureStage: null,
          semanticObservation: null,
          organizerDynamicFailure: null,
        }),
      );
    }
    if (testCase.agent === 'tutor') {
      const first = tutorRuntime === 0;
      tutorRuntime += 1;
      return requireDiagnostic(
        projectPhase697V4CaseDiagnostic({
          caseId: testCase.id,
          agent: testCase.agent,
          notStartedReason: null,
          runtimeContractSuccess: true,
          contractFailureStage: null,
          semanticObservation: tutorObservation(first ? { intent: false } : {}),
          organizerDynamicFailure: null,
        }),
      );
    }
    const first = organizerRuntime === 0;
    organizerRuntime += 1;
    return requireDiagnostic(
      projectPhase697V4CaseDiagnostic({
        caseId: testCase.id,
        agent: testCase.agent,
        notStartedReason: null,
        runtimeContractSuccess: first ? false : true,
        contractFailureStage: first ? 'dynamic_contract' : null,
        semanticObservation: first ? null : organizerObservation(),
        organizerDynamicFailure: first
          ? {
              stage: 'dynamic_contract',
              axis: 'topic',
              reasonCode: 'topic_label_invalid',
            }
          : null,
      }),
    );
  });
}

function requireDiagnostic(
  value: Readonly<Phase697V4CaseDiagnostic> | null,
): Phase697V4CaseDiagnostic {
  if (value === null) throw new Error('expected V4 diagnostic projection');
  return value;
}

function oldReportRejectsV4Field(
  report: { caseEntries: readonly Record<string, unknown>[] },
  schema: { safeParse(value: unknown): { success: boolean } },
) {
  return !schema.safeParse({
    ...report,
    caseEntries: report.caseEntries.map((entry, index) =>
      index === 0
        ? { ...entry, diagnosticVersion: 'phase-6.9.7-v4-bounded-diagnostics-v1' }
        : entry,
    ),
  }).success;
}

function stableSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
