import type {
  KnowledgeOrganizerCollection,
  KnowledgeOrganizerTag,
} from '@repo/types/api/knowledge-agent';

import { analyzeKnowledgeDedup } from '../nodes/knowledge-dedup.ts';
import { organizeKnowledgeDocuments } from '../nodes/knowledge-organizer.ts';
import {
  PHASE_6_9_KNOWLEDGE_AGENT_CASES,
  PHASE_6_9_KNOWLEDGE_AGENT_DATASET_VERSION,
  phase69KnowledgeDedupCases,
  phase69KnowledgeOrganizerCases,
  type KnowledgeOrganizerSubject,
  type KnowledgeSemanticRelation,
  type Phase69KnowledgeDedupRuntimeCase,
  type Phase69KnowledgeOrganizerRuntimeCase,
} from './phase-6-9-knowledge-agent-cases.ts';
import {
  buildKnowledgeAgentSemanticMetrics,
  type KnowledgeAgentMetricsResult,
  type KnowledgeDedupRuntimeObservation,
  type KnowledgeOrganizerRuntimeObservation,
} from './phase-6-9-knowledge-agent-metrics.ts';

export type KnowledgeAgentDeterministicBaselineRun = Readonly<{
  caseId: string;
  agent: 'dedup' | 'organizer';
  passed: boolean;
  criticalFailure: boolean;
  expectedCode: string;
  actualCode: string;
}>;

export type KnowledgeAgentDeterministicBaselineReport = Readonly<{
  datasetVersion: typeof PHASE_6_9_KNOWLEDGE_AGENT_DATASET_VERSION;
  mode: 'deterministic';
  counts: Readonly<{
    cases: number;
    zeroCallCases: number;
    runtimeCases: number;
    pairedRequests: number;
  }>;
  runs: readonly KnowledgeAgentDeterministicBaselineRun[];
  summary: Readonly<{
    passed: number;
    failed: number;
    criticalFailures: number;
    inputTokens: 0;
    outputTokens: 0;
    estimatedCostCny: 0;
    providerInvocations: 0;
  }>;
  metrics: KnowledgeAgentMetricsResult;
}>;

export function runKnowledgeAgentDeterministicBaseline(): KnowledgeAgentDeterministicBaselineReport {
  const dedupResults = phase69KnowledgeDedupCases
    .filter(
      (testCase): testCase is Phase69KnowledgeDedupRuntimeCase =>
        testCase.expectedRuntimeInvocations === 1,
    )
    .map(runDedupCase);
  const organizerResults = phase69KnowledgeOrganizerCases
    .filter(
      (testCase): testCase is Phase69KnowledgeOrganizerRuntimeCase =>
        testCase.expectedRuntimeInvocations === 1,
    )
    .map(runOrganizerCase);
  const runs = deepFreeze([
    ...dedupResults.map((result) => result.run),
    ...organizerResults.map((result) => result.run),
  ]);
  const runtimeCases = PHASE_6_9_KNOWLEDGE_AGENT_CASES.filter(
    (testCase) => testCase.expectedRuntimeInvocations === 1,
  );

  return deepFreeze({
    datasetVersion: PHASE_6_9_KNOWLEDGE_AGENT_DATASET_VERSION,
    mode: 'deterministic',
    counts: {
      cases: PHASE_6_9_KNOWLEDGE_AGENT_CASES.length,
      zeroCallCases:
        PHASE_6_9_KNOWLEDGE_AGENT_CASES.length - runtimeCases.length,
      runtimeCases: runtimeCases.length,
      pairedRequests: new Set(
        runtimeCases.map((testCase) => testCase.pairedRunIndex),
      ).size,
    },
    runs,
    summary: {
      passed: runs.filter((run) => run.passed).length,
      failed: runs.filter((run) => !run.passed).length,
      criticalFailures: runs.filter((run) => run.criticalFailure).length,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCny: 0,
      providerInvocations: 0,
    },
    metrics: buildKnowledgeAgentSemanticMetrics(
      dedupResults.map((result) => result.observation),
      organizerResults.map((result) => result.observation),
    ),
  });
}

function runDedupCase(testCase: Phase69KnowledgeDedupRuntimeCase): Readonly<{
  run: KnowledgeAgentDeterministicBaselineRun;
  observation: KnowledgeDedupRuntimeObservation;
}> {
  try {
    const result = analyzeKnowledgeDedup({
      now: testCase.input.now,
      documents: testCase.input.documents,
      ...(testCase.input.targetDocumentId
        ? { targetDocumentId: testCase.input.targetDocumentId }
        : {}),
    });
    const actualRelation = inferDedupRelation(
      result.items,
      testCase.expected.pairDocumentIds,
    );
    const passed = actualRelation === testCase.expected.relation;
    return deepFreeze({
      run: {
        caseId: testCase.id,
        agent: 'dedup',
        passed,
        criticalFailure: testCase.criticalSafetyCase && !passed,
        expectedCode: testCase.expected.relation,
        actualCode: actualRelation,
      },
      observation: {
        caseId: testCase.id,
        expectedRelation: testCase.expected.relation,
        actualRelation,
        revisionExpected: testCase.expected.localRevisionSignal,
        validOutput: true,
      },
    });
  } catch {
    return deepFreeze({
      run: {
        caseId: testCase.id,
        agent: 'dedup',
        passed: false,
        criticalFailure: testCase.criticalSafetyCase,
        expectedCode: testCase.expected.relation,
        actualCode: 'deterministic_error',
      },
      observation: {
        caseId: testCase.id,
        expectedRelation: testCase.expected.relation,
        actualRelation: null,
        revisionExpected: testCase.expected.localRevisionSignal,
        validOutput: false,
      },
    });
  }
}

function runOrganizerCase(
  testCase: Phase69KnowledgeOrganizerRuntimeCase,
): Readonly<{
  run: KnowledgeAgentDeterministicBaselineRun;
  observation: KnowledgeOrganizerRuntimeObservation;
}> {
  try {
    const result = organizeKnowledgeDocuments({
      now: testCase.input.now,
      documents: testCase.input.documents,
    });
    const actualSubject = inferOrganizerSubject(result.tags);
    const actualTopicLabels = inferTopicLabels(result.tags);
    const actualCollectionPairs = collectionPairs(result.collections);
    const passed =
      actualSubject === testCase.expected.subject &&
      sameStringSet(actualTopicLabels, testCase.expected.topicLabels) &&
      samePairSet(actualCollectionPairs, testCase.expected.collectionPairs);
    return deepFreeze({
      run: {
        caseId: testCase.id,
        agent: 'organizer',
        passed,
        criticalFailure: testCase.criticalSafetyCase && !passed,
        expectedCode: testCase.expected.subject,
        actualCode: actualSubject ?? 'no_subject',
      },
      observation: {
        caseId: testCase.id,
        expectedSubject: testCase.expected.subject,
        actualSubject,
        expectedTopicLabels: testCase.expected.topicLabels,
        actualTopicLabels,
        expectedCollectionPairs: testCase.expected.collectionPairs,
        actualCollectionPairs,
        validOutput: true,
      },
    });
  } catch {
    return deepFreeze({
      run: {
        caseId: testCase.id,
        agent: 'organizer',
        passed: false,
        criticalFailure: testCase.criticalSafetyCase,
        expectedCode: testCase.expected.subject,
        actualCode: 'deterministic_error',
      },
      observation: {
        caseId: testCase.id,
        expectedSubject: testCase.expected.subject,
        actualSubject: null,
        expectedTopicLabels: testCase.expected.topicLabels,
        actualTopicLabels: [],
        expectedCollectionPairs: testCase.expected.collectionPairs,
        actualCollectionPairs: [],
        validOutput: false,
      },
    });
  }
}

function inferDedupRelation(
  items: readonly { kind: string; documentIds: readonly string[] }[],
  expectedPair: readonly [string, string],
): KnowledgeSemanticRelation {
  const item = items.find(
    (candidate) =>
      expectedPair.every((documentId) =>
        candidate.documentIds.includes(documentId),
      ) &&
      (candidate.kind === 'possible_revision' ||
        candidate.kind === 'complementary'),
  );
  if (item?.kind === 'possible_revision') return 'possible_revision';
  if (item?.kind === 'complementary') return 'complementary';
  return 'unrelated';
}

const subjectLabels: Readonly<Record<string, KnowledgeOrganizerSubject>> = {
  数学: 'math',
  英语: 'english',
  政治: 'politics',
  计算机: 'computer',
  专业课: 'major',
  其它: 'other',
};
const reservedLabels = new Set([
  ...Object.keys(subjectLabels),
  '讲义',
  '笔记',
  '真题',
  '错题',
  '练习',
  '参考资料',
  '其它资料',
]);

function inferOrganizerSubject(
  tags: readonly KnowledgeOrganizerTag[],
): KnowledgeOrganizerSubject | null {
  for (const tag of tags) {
    for (const label of tag.labels) {
      const subject = subjectLabels[label];
      if (subject) return subject;
    }
  }
  return null;
}

function inferTopicLabels(tags: readonly KnowledgeOrganizerTag[]) {
  return deepFreeze(
    [...new Set(tags.flatMap((tag) => tag.labels))]
      .filter((label) => !reservedLabels.has(label))
      .sort(),
  );
}

function collectionPairs(collections: readonly KnowledgeOrganizerCollection[]) {
  const pairs: [string, string][] = [];
  for (const collection of collections) {
    const ids = [...new Set(collection.documentIds)].sort();
    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        pairs.push([ids[leftIndex], ids[rightIndex]]);
      }
    }
  }
  return deepFreeze(pairs);
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return (
    new Set(left).size === new Set(right).size &&
    [...new Set(left)].every((value) => new Set(right).has(value))
  );
}

function samePairSet(
  left: readonly (readonly [string, string])[],
  right: readonly (readonly [string, string])[],
) {
  return sameStringSet(left.map(canonicalPair), right.map(canonicalPair));
}

function canonicalPair(pair: readonly [string, string]) {
  return [...pair].sort().join('|');
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}
