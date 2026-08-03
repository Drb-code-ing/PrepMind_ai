import type {
  Phase697V2Case,
  Phase697V2Language,
  Phase697V2OrganizerCase,
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorCase,
  Phase697V2TutorExerciseFamily,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';

export type Phase697V2CoherenceIssue = Readonly<{
  code: string;
  caseId?: string;
  path?: string;
}>;

export type Phase697V2CoherenceReport = Readonly<{
  ok: boolean;
  issues: readonly Phase697V2CoherenceIssue[];
  counts: Readonly<{
    cases: number;
    zeroCall: number;
    runtime: number;
    pairedRequests: number;
    tutor: number;
    organizer: number;
    organizerDecisionUnits: number;
  }>;
  tutorRuntimeLanguages: Readonly<Record<Phase697V2Language, number>>;
}>;

type DatasetInput = Readonly<{
  version: string;
  cases: readonly Phase697V2Case[];
  tutorCases: readonly Phase697V2TutorCase[];
  organizerCases: readonly Phase697V2OrganizerCase[];
}>;

const VERSION = 'phase-6.9-tutor-wrong-question-v2';
const V1_SHA256 = '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e';

const TUTOR_FAMILY_TERMS: Readonly<Record<Phase697V2TutorExerciseFamily, readonly RegExp[]>> = {
  algebra_linear_equation: [/\bx\b/i, /方程|移项|代数/, /equation|algebra/i],
  calculus_derivative: [/导数|求导|微分/, /derivative|differentiat|calculus/i],
  probability_conditional: [/概率|事件/, /probability|conditional|P\s*\(/i],
  english_reading: [/从句|句子|修饰|阅读/, /clause|modifier|sentence|reading/i],
};

export function assertPhase697V2DatasetCoherence(input: DatasetInput): Phase697V2CoherenceReport {
  const report = validatePhase697V2DatasetCoherence(input);
  if (!report.ok) {
    throw new Error(
      'PHASE_6_9_7_V2_DATASET_INCOHERENT:' +
        report.issues.map((issue) => issue.code + ':' + (issue.caseId ?? 'dataset')).join(','),
    );
  }
  return report;
}

export function validatePhase697V2DatasetCoherence(input: DatasetInput): Phase697V2CoherenceReport {
  const issues: Phase697V2CoherenceIssue[] = [];
  const runtime = input.cases.filter((testCase) => testCase.expectedRuntimeInvocations === 1);
  const zeroCall = input.cases.filter((testCase) => testCase.expectedRuntimeInvocations === 0);
  const organizerRuntime = input.organizerCases.filter(
    (testCase): testCase is Phase697V2OrganizerRuntimeCase =>
      testCase.expectedRuntimeInvocations === 1,
  );
  const tutorRuntime = input.tutorCases.filter(
    (testCase): testCase is Phase697V2TutorRuntimeCase => testCase.expectedRuntimeInvocations === 1,
  );
  const languageCounts: Record<Phase697V2Language, number> = { zh: 0, en: 0, mixed: 0 };

  if (input.version !== VERSION) issues.push({ code: 'dataset_version_invalid' });
  exactCount(input.cases.length, 72, 'dataset_case_count_invalid', issues);
  exactCount(input.tutorCases.length, 36, 'tutor_case_count_invalid', issues);
  exactCount(input.organizerCases.length, 36, 'organizer_case_count_invalid', issues);
  exactCount(zeroCall.length, 24, 'zero_call_count_invalid', issues);
  exactCount(runtime.length, 48, 'runtime_count_invalid', issues);
  exactCount(tutorRuntime.length, 24, 'tutor_runtime_count_invalid', issues);
  exactCount(organizerRuntime.length, 24, 'organizer_runtime_count_invalid', issues);

  const ids = input.cases.map((testCase) => testCase.id);
  if (new Set(ids).size !== ids.length) issues.push({ code: 'duplicate_case_id' });
  if (ids.some((id) => !/^(tutor|organizer)-v2-[a-z0-9-]{3,80}$/.test(id))) {
    issues.push({ code: 'case_id_namespace_invalid' });
  }
  if (!isDeepFrozen(input.cases)) issues.push({ code: 'dataset_not_deep_frozen' });

  if (
    runtime.some(
      (testCase) =>
        !Number.isSafeInteger(testCase.pairedRunIndex) ||
        testCase.pairedRunIndex < 0 ||
        testCase.pairedRunIndex > 23,
    )
  ) {
    issues.push({ code: 'paired_runtime_index_invalid' });
  }

  const serialized = JSON.stringify(input.cases);
  if (serialized.includes(V1_SHA256) || serialized.includes('sourceV1CaseId')) {
    issues.push({ code: 'v1_identity_leakage' });
  }

  for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
    const pair = runtime.filter((testCase) => testCase.pairedRunIndex === pairedRunIndex);
    const agents = pair.map((testCase) => testCase.agent).sort();
    if (pair.length !== 2 || agents[0] !== 'tutor' || agents[1] !== 'wrong_question_organizer') {
      issues.push({ code: 'paired_runtime_invalid', path: String(pairedRunIndex) });
    }
  }

  for (const testCase of input.tutorCases) {
    validateTutorCase(testCase, issues);
    if (testCase.expectedRuntimeInvocations === 1) {
      languageCounts[testCase.authority.language] += 1;
    }
  }
  if (languageCounts.zh !== 12 || languageCounts.en !== 10 || languageCounts.mixed !== 2) {
    issues.push({ code: 'tutor_language_quota_invalid' });
  }

  for (const testCase of input.organizerCases) validateOrganizerCase(testCase, issues);

  return deepFreeze({
    ok: issues.length === 0,
    issues: deepFreeze(issues),
    counts: {
      cases: input.cases.length,
      zeroCall: zeroCall.length,
      runtime: runtime.length,
      pairedRequests: new Set(runtime.map((testCase) => testCase.pairedRunIndex)).size,
      tutor: input.tutorCases.length,
      organizer: input.organizerCases.length,
      organizerDecisionUnits: organizerRuntime.reduce(
        (total, testCase) => total + testCase.expected.decisions.length,
        0,
      ),
    },
    tutorRuntimeLanguages: languageCounts,
  });
}

export function projectPhase697V2TutorFixture(testCase: Phase697V2TutorRuntimeCase) {
  return deepFreeze({
    language: testCase.authority.language,
    exerciseFamily: testCase.authority.exerciseFamily,
    latestUserText: testCase.input.latestUserText,
    activeStudyContext: testCase.authority.context.text,
  });
}

export function projectPhase697V2OrganizerFixture(testCase: Phase697V2OrganizerRuntimeCase) {
  return deepFreeze({
    batchRelation: testCase.authority.batchRelation,
    questions: testCase.input.questions.map((question, questionIndex) => {
      const authority = testCase.authority.decisions.find(
        (decision) => decision.questionIndex === questionIndex,
      );
      if (!authority) throw new Error('PHASE_6_9_7_V2_ORGANIZER_AUTHORITY_MISSING');
      return {
        questionOrdinal: questionIndex,
        language: question.language,
        exerciseFamily: question.exerciseFamily,
        structuredSubjectAuthority: question.structuredSubjectAuthority,
        taxonomySubjectAuthority: question.taxonomySubjectAuthority,
        category: question.category,
        knowledgePoints: question.knowledgePoints,
        errorType: question.errorType,
        questionText: question.questionText,
        subjectCandidates: authority.subjectCandidates,
        topicCandidates: authority.topicCandidates.map((candidate, topicIndex) => ({
          topicOrdinal: topicIndex,
          label: candidate.label,
          aliases: candidate.aliases,
          subject: candidate.subject,
          source: candidate.source,
        })),
      };
    }),
    existingDecks: testCase.input.existingDecks.map((deck, deckIndex) => ({
      deckOrdinal: deckIndex,
      name: deck.name,
      subjectKey: deck.subjectKey,
      keywords: deck.keywords,
      nameLocked: deck.nameLocked,
    })),
  });
}

function validateTutorCase(testCase: Phase697V2TutorCase, issues: Phase697V2CoherenceIssue[]) {
  const authority = testCase.authority;
  if (!testCase.tags.includes(authority.language)) {
    issues.push({ code: 'tutor_language_tag_missing', caseId: testCase.id });
  }
  if (
    authority.language !== authority.context.language ||
    authority.exerciseFamily !== authority.context.exerciseFamily ||
    testCase.input.activeStudyContext !== authority.context.text ||
    authority.context.source !== 'synthetic'
  ) {
    issues.push({ code: 'tutor_context_authority_mismatch', caseId: testCase.id });
  }
  if (testCase.expectedRuntimeInvocations !== 1) return;
  if (!matchesLanguage(testCase.input.latestUserText, authority.language)) {
    issues.push({ code: 'tutor_latest_language_mismatch', caseId: testCase.id });
  }
  if (!matchesLanguage(authority.context.text, authority.language)) {
    issues.push({ code: 'tutor_context_language_mismatch', caseId: testCase.id });
  }
  if (!matchesFamily(authority.context.text, authority.exerciseFamily)) {
    issues.push({ code: 'tutor_context_family_mismatch', caseId: testCase.id });
  }
  if (
    testCase.expected.intent !== 'general_follow_up' &&
    !matchesFamily(testCase.input.latestUserText, authority.exerciseFamily)
  ) {
    issues.push({ code: 'tutor_latest_family_mismatch', caseId: testCase.id });
  }
}

function validateOrganizerCase(
  testCase: Phase697V2OrganizerCase,
  issues: Phase697V2CoherenceIssue[],
) {
  for (const [questionIndex, question] of testCase.input.questions.entries()) {
    if (!matchesLanguage(question.questionText ?? '', question.language)) {
      issues.push({
        code: 'organizer_question_language_mismatch',
        caseId: testCase.id,
        path: String(questionIndex),
      });
    }
    const structured = normalizeStructuredSubject(question.subject);
    if (structured !== question.structuredSubjectAuthority) {
      issues.push({
        code: 'organizer_structured_subject_mismatch',
        caseId: testCase.id,
        path: String(questionIndex),
      });
    }
  }
  if (testCase.expectedRuntimeInvocations !== 1) {
    if (testCase.authority.decisions.length !== 0) {
      issues.push({ code: 'organizer_zero_call_authority_not_empty', caseId: testCase.id });
    }
    return;
  }
  if (
    testCase.expected.decisions.length !== testCase.input.questions.length ||
    testCase.authority.decisions.length !== testCase.input.questions.length
  ) {
    issues.push({ code: 'organizer_decision_cardinality_invalid', caseId: testCase.id });
    return;
  }
  const expectedSubjects = new Set(testCase.expected.decisions.map((decision) => decision.subject));
  if (testCase.authority.batchRelation === 'single' && testCase.input.questions.length !== 1) {
    issues.push({ code: 'organizer_single_batch_relation_invalid', caseId: testCase.id });
  }
  if (
    testCase.authority.batchRelation === 'same_subject_batch' &&
    (testCase.input.questions.length <= 1 || expectedSubjects.size !== 1)
  ) {
    issues.push({ code: 'organizer_same_subject_batch_invalid', caseId: testCase.id });
  }
  if (
    testCase.authority.batchRelation === 'cross_subject_batch' &&
    (testCase.input.questions.length <= 1 || expectedSubjects.size <= 1)
  ) {
    issues.push({ code: 'organizer_cross_subject_batch_invalid', caseId: testCase.id });
  }

  for (const expected of testCase.expected.decisions) {
    const authority = testCase.authority.decisions.find(
      (decision) => decision.questionIndex === expected.questionIndex,
    );
    const question = testCase.input.questions[expected.questionIndex];
    if (!authority || !question) {
      issues.push({
        code: 'organizer_decision_authority_missing',
        caseId: testCase.id,
        path: String(expected.questionIndex),
      });
      continue;
    }
    if (question.taxonomySubjectAuthority !== expected.subject) {
      issues.push({
        code: 'organizer_taxonomy_subject_mismatch',
        caseId: testCase.id,
        path: String(expected.questionIndex),
      });
    }
    if (
      authority.subjectCandidates.length === 0 ||
      new Set(authority.subjectCandidates).size !== authority.subjectCandidates.length ||
      !authority.subjectCandidates.includes(expected.subject)
    ) {
      issues.push({
        code: 'organizer_subject_candidates_invalid',
        caseId: testCase.id,
        path: String(expected.questionIndex),
      });
    }
    const normalizedTopics = authority.topicCandidates.map((candidate) =>
      normalizeLabel(candidate.label),
    );
    if (
      authority.topicCandidates.length !== 3 ||
      new Set(normalizedTopics).size !== normalizedTopics.length ||
      authority.topicCandidates.some(
        (candidate) =>
          candidate.subject !== expected.subject ||
          candidate.label.trim().length === 0 ||
          new Set(candidate.aliases.map(normalizeLabel)).size !== candidate.aliases.length,
      )
    ) {
      issues.push({
        code: 'organizer_topic_candidates_invalid',
        caseId: testCase.id,
        path: String(expected.questionIndex),
      });
    }
    const selected = authority.topicCandidates[expected.topicCandidateIndex];
    if (
      !selected ||
      normalizeLabel(selected.label) !== normalizeLabel(expected.canonicalTopicLabel)
    ) {
      issues.push({
        code: 'organizer_topic_ordinal_mismatch',
        caseId: testCase.id,
        path: String(expected.questionIndex),
      });
    }
    if (expected.deckAction === 'reuse_existing') {
      const deck = testCase.input.existingDecks[expected.deckIndex ?? -1];
      if (!deck || normalizeLabel(deck.name) !== normalizeLabel(expected.canonicalTopicLabel)) {
        issues.push({
          code: 'organizer_reuse_deck_mismatch',
          caseId: testCase.id,
          path: String(expected.questionIndex),
        });
      }
    }
  }
}

function matchesLanguage(value: string, language: Phase697V2Language) {
  const hanCount = (value.match(/[\u3400-\u9fff]/g) ?? []).length;
  const englishWords = value.match(/[A-Za-z]{3,}/g) ?? [];
  if (language === 'zh') return hanCount >= 2;
  if (language === 'en') return hanCount === 0 && englishWords.length >= 2;
  return hanCount >= 2 && englishWords.length >= 1;
}

function matchesFamily(value: string, family: Phase697V2TutorExerciseFamily) {
  return TUTOR_FAMILY_TERMS[family].some((pattern) => pattern.test(value));
}

function normalizeStructuredSubject(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const normalized = normalizeLabel(value).replace(/\s+/g, '');
  const mapping = new Map<string, 'math' | 'english' | 'politics' | 'computer' | 'major' | 'other'>(
    [
      ['数学', 'math'],
      ['英语', 'english'],
      ['政治', 'politics'],
      ['计算机', 'computer'],
      ['专业课', 'major'],
      ['其他', 'other'],
      ['其它', 'other'],
    ],
  );
  return mapping.get(normalized) ?? null;
}

function exactCount(
  actual: number,
  expected: number,
  code: string,
  issues: Phase697V2CoherenceIssue[],
) {
  if (actual !== expected) issues.push({ code });
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isDeepFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value !== 'object' || value === null) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
