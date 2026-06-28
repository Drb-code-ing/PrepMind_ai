import type { AgentRoute } from '@repo/types/api/agent';
import type {
  ReviewAgentInput,
  ReviewAgentPriority,
} from '@repo/types/api/review-agent';

import type { KnowledgeVerifierStatus } from '../nodes/knowledge-verifier.ts';
import type { WrongQuestionOrganizerInput } from '../nodes/wrong-question-organizer.ts';

export type Phase67EvalCase =
  | {
      kind: 'router';
      name: string;
      input: string;
      expectedRoute: AgentRoute;
      requiresRag?: boolean;
    }
  | {
      kind: 'tutor';
      name: string;
      latestUserText: string;
      activeStudyContext?: string;
      expectedIntent: string;
    }
  | {
      kind: 'verifier';
      name: string;
      query: string;
      chunks: Array<{
        documentId: string;
        documentTitle: string;
        chunkId: string;
        content: string;
        score: number;
      }>;
      expectedStatus: KnowledgeVerifierStatus;
    }
  | {
      kind: 'organizer';
      name: string;
      wrongQuestion: WrongQuestionOrganizerInput['wrongQuestion'];
      expectedSubjectKey: string;
      expectedDeckName: string;
    }
  | {
      kind: 'review';
      name: string;
      input: ReviewAgentInput;
      expectedPriority: ReviewAgentPriority;
      expectedSignal: string;
    }
  | {
      kind: 'planner';
      name: string;
      expectedSignal: string;
      expectedCapacityNotice: boolean;
    }
  | {
      kind: 'memory';
      name: string;
      expectedType: string;
      explicitPreferenceText: string;
    };

export const phase67EvalCases: Phase67EvalCase[] = [
  {
    kind: 'router',
    name: 'routes normal greeting to chat',
    input: '你好',
    expectedRoute: 'chat',
  },
  {
    kind: 'router',
    name: 'routes solution question to tutor',
    input: '这道导数题为什么要先求单调区间？',
    expectedRoute: 'tutor',
  },
  {
    kind: 'router',
    name: 'routes document grounded question to rag',
    input: '根据我上传的线代讲义，解释矩阵秩的定义。',
    expectedRoute: 'rag_answer',
    requiresRag: true,
  },
  {
    kind: 'tutor',
    name: 'classifies hint request',
    latestUserText: '先别给答案，给我一点提示。',
    activeStudyContext: '已知函数 f(x)=x^2-2x，求最小值。',
    expectedIntent: 'socratic_hint',
  },
  {
    kind: 'tutor',
    name: 'classifies full solution request',
    latestUserText: '请讲一下这道题怎么做，并说明每一步原因。',
    expectedIntent: 'explain_solution',
  },
  {
    kind: 'verifier',
    name: 'trusts useful high-score retrieved chunks',
    query: '矩阵秩是什么？',
    chunks: [
      {
        documentId: 'doc_1',
        documentTitle: '线代讲义',
        chunkId: 'chunk_1',
        content: '矩阵的秩是矩阵行向量组或列向量组的最大线性无关组所含向量个数。',
        score: 0.91,
      },
    ],
    expectedStatus: 'trusted',
  },
  {
    kind: 'organizer',
    name: 'organizes math derivative wrong question',
    wrongQuestion: {
      id: 'wrong_eval_1',
      subject: '数学',
      category: '函数与导数',
      knowledgePoints: ['导数应用'],
      errorType: '审题错误',
      questionText: '已知函数单调性，求参数范围。',
    },
    expectedSubjectKey: '数学',
    expectedDeckName: '导数应用',
  },
  {
    kind: 'review',
    name: 'flags high review pressure',
    input: {
      now: '2026-06-28T00:00:00.000Z',
      weakKnowledgePoints: [
        {
          label: '导数应用',
          subject: '数学',
          deckName: '导数应用',
          wrongCount: 6,
          recentAgainCount: 3,
          averageDifficulty: 4.6,
          averageStability: 1.8,
        },
      ],
      cardSummary: {
        dueCount: 8,
        overdueCount: 5,
        highDifficultyCount: 4,
        lowStabilityCount: 5,
      },
      recentReviewSummary: {
        totalReviews: 12,
        againCount: 3,
        hardCount: 4,
        goodCount: 4,
        easyCount: 1,
      },
    },
    expectedPriority: 'high',
    expectedSignal: 'overdue',
  },
  {
    kind: 'planner',
    name: 'suggests capacity relief when plan is over capacity',
    expectedSignal: 'capacityOver',
    expectedCapacityNotice: true,
  },
  {
    kind: 'memory',
    name: 'extracts explanation preference',
    explicitPreferenceText: '以后讲题时请先给我提示，再给完整答案。',
    expectedType: 'EXPLANATION_PREFERENCE',
  },
];
