import { analyzeMemory } from '../nodes/memory.ts';
import { planStudy } from '../nodes/planner.ts';
import { analyzeReview } from '../nodes/review.ts';
import { buildTutorStrategy } from '../nodes/tutor.ts';
import { analyzeKnowledgeDedup } from '../nodes/knowledge-dedup.ts';
import { organizeKnowledgeDocuments } from '../nodes/knowledge-organizer.ts';
import { verifyKnowledgeChunks } from '../nodes/knowledge-verifier.ts';
import { organizeWrongQuestion } from '../nodes/wrong-question-organizer.ts';
import { routeAgentRequest } from '../router.ts';
import { createInitialAgentState } from '../state.ts';
import type { Phase67EvalCase } from './phase-6-7-cases.ts';

export type Phase67EvalResult = {
  name: string;
  passed: boolean;
  detail: string;
};

export function runPhase67EvalCase(testCase: Phase67EvalCase): Phase67EvalResult {
  if (testCase.kind === 'router') {
    const result = routeAgentRequest(
      createInitialAgentState({
        runId: `eval_${slug(testCase.name)}`,
        userId: 'eval_user',
        text: testCase.input,
      }),
    );
    const routeMatches = result.name === testCase.expectedRoute;
    const ragMatches =
      typeof testCase.requiresRag === 'boolean'
        ? result.requiresRag === testCase.requiresRag
        : true;

    return {
      name: testCase.name,
      passed: routeMatches && ragMatches,
      detail: `route=${result.name} requiresRag=${result.requiresRag}`,
    };
  }

  if (testCase.kind === 'tutor') {
    const result = buildTutorStrategy({
      latestUserText: testCase.latestUserText,
      activeStudyContext: testCase.activeStudyContext,
    });

    return {
      name: testCase.name,
      passed: result.intent === testCase.expectedIntent,
      detail: `intent=${result.intent} depth=${result.depth}`,
    };
  }

  if (testCase.kind === 'verifier') {
    const result = verifyKnowledgeChunks({
      query: testCase.query,
      chunks: testCase.chunks,
    });

    return {
      name: testCase.name,
      passed:
        result.status === testCase.expectedStatus &&
        (testCase.expectedReasonIncludes
          ? result.reason.includes(testCase.expectedReasonIncludes)
          : true),
      detail: `status=${result.status} reason=${result.reason} checked=${result.debug.checkedChunkCount}`,
    };
  }

  if (testCase.kind === 'organizer') {
    const result = organizeWrongQuestion({
      wrongQuestion: testCase.wrongQuestion,
    });

    return {
      name: testCase.name,
      passed:
        result.subjectKey === testCase.expectedSubjectKey &&
        result.deckName === testCase.expectedDeckName,
      detail: `subject=${result.subjectKey} deck=${result.deckName}`,
    };
  }

  if (testCase.kind === 'review') {
    const result = analyzeReview(testCase.input);

    return {
      name: testCase.name,
      passed:
        result.priority === testCase.expectedPriority &&
        result.signals.includes(testCase.expectedSignal),
      detail: `priority=${result.priority} signals=${result.signals.join(',')}`,
    };
  }

  if (testCase.kind === 'planner') {
    const result = planStudy(createPlannerOverCapacityInput());

    return {
      name: testCase.name,
      passed:
        result.signals.includes(testCase.expectedSignal) &&
        Boolean(result.capacityNotice) === testCase.expectedCapacityNotice,
      detail: `signals=${result.signals.join(',')} capacityNotice=${Boolean(
        result.capacityNotice,
      )}`,
    };
  }

  if (testCase.kind === 'knowledge_dedup') {
    const result = analyzeKnowledgeDedup({
      now: '2026-06-29T00:00:00.000Z',
      documents: [
        knowledgeDocument('doc_1', '链式法则 v1.pdf', 'sha256:old', [
          '链式法则 导数',
        ]),
        knowledgeDocument('doc_2', '链式法则 v2.pdf', 'sha256:new', [
          '链式法则 导数 新版',
        ]),
      ],
    });

    return {
      name: testCase.name,
      passed: result.items.some((item) => item.kind === testCase.expectedKind),
      detail: `items=${result.items.map((item) => item.kind).join(',')}`,
    };
  }

  if (testCase.kind === 'knowledge_organizer') {
    const result = organizeKnowledgeDocuments({
      now: '2026-06-29T00:00:00.000Z',
      documents: [
        knowledgeDocument('doc_1', '高等数学 导数讲义.pdf', 'sha256:a', [
          '导数 极限 函数',
        ]),
        knowledgeDocument('doc_2', '高等数学 导数练习.pdf', 'sha256:b', [
          '导数应用题',
        ]),
      ],
    });

    return {
      name: testCase.name,
      passed: result.collections.some(
        (collection) => collection.name === testCase.expectedCollectionName,
      ),
      detail: `collections=${result.collections
        .map((collection) => collection.name)
        .join(',')}`,
    };
  }

  const result = analyzeMemory({
    now: '2026-06-28T00:00:00.000Z',
    recentChatSignals: [
      {
        conversationId: 'conversation_eval_1',
        messageId: 'chat_eval_1',
        text: testCase.explicitPreferenceText,
        createdAt: '2026-06-28T00:00:00.000Z',
      },
    ],
    weakPointSignals: [],
    reviewSignals: {
      consecutiveActiveDays: 0,
      totalReviewsInWindow: 0,
    },
    existingMemories: [],
  });

  return {
    name: testCase.name,
    passed: result.candidates.some((candidate) => candidate.type === testCase.expectedType),
    detail: `candidates=${result.candidates.map((candidate) => candidate.type).join(',')}`,
  };
}

function createPlannerOverCapacityInput(): Parameters<typeof planStudy>[0] {
  const review = analyzeReview({
    now: '2026-06-28T00:00:00.000Z',
    weakKnowledgePoints: [],
    cardSummary: {
      dueCount: 0,
      overdueCount: 0,
      highDifficultyCount: 0,
      lowStabilityCount: 0,
    },
    recentReviewSummary: {
      totalReviews: 4,
      againCount: 0,
      hardCount: 0,
      goodCount: 4,
      easyCount: 0,
    },
  });

  return {
    review,
    plan: {
      startDate: '2026-06-28',
      endDate: '2026-07-04',
      generatedThroughDate: '2026-07-04',
      summary: {
        overdueCount: 0,
        todayDueCount: 0,
        upcomingDueCount: 42,
        estimatedTotalMinutes: 180,
        peakDay: {
          date: '2026-06-30',
          count: 18,
        },
        intensity: 'heavy',
        capacityStatus: 'over',
        dailyMinutes: 30,
        dailyCardLimit: 20,
      },
      days: [
        {
          date: '2026-06-30',
          label: '周二',
          dueCount: 18,
          overdueCount: 0,
          pendingCount: 18,
          completedCount: 0,
          skippedCount: 0,
          estimatedMinutes: 72,
          intensity: 'heavy',
          pressureScore: 72,
          capacityStatus: 'over',
          reasons: ['到期卡片较多'],
        },
      ],
      suggestion: {
        title: '未来复习压力偏高',
        description: '建议提前拆分高峰日任务。',
        actionLabel: '查看计划',
        actionHref: '/plan',
      },
    },
    preference: {
      dailyMinutes: 30,
      dailyCardLimit: 20,
      preferredReviewTime: '20:00',
      reminderEnabled: true,
      reminderLeadMinutes: 30,
      weekendMode: 'same',
      planWindowDays: 7,
      updatedAt: '2026-06-28T00:00:00.000Z',
    },
  };
}

function knowledgeDocument(
  id: string,
  name: string,
  contentHash: string,
  chunkSummaries: string[],
) {
  return {
    id,
    name,
    type: 'PDF' as const,
    size: 1024,
    status: 'DONE' as const,
    sourceType: 'UPLOAD' as const,
    contentHash,
    chunkCount: chunkSummaries.length,
    processedAt: '2026-06-29T00:00:00.000Z',
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
    chunkSummaries,
  };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
