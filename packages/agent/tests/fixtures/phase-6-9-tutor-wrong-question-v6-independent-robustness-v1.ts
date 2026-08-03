export const PHASE_6_9_7_V6_INDEPENDENT_ROBUSTNESS_VERSION =
  'phase-6.9.7-tutor-organizer-v6-independent-robustness-v1' as const;
export const PHASE_6_9_7_V6_INDEPENDENT_ROBUSTNESS_SHA256 =
  'sha256:314543fe1694c0caa2b8fc48fa79a1bfcd751eb0431664ffafb9ceee3103904b' as const;

const tutorRelations = [
  {
    id: 'v6-heldout-tutor-step-precedence',
    expectedIntent: 'step_check',
    utterances: [
      '我把两边同时除以三，这一步对吗？如果不对只给一点提示。',
      'Is this correct after dividing both sides by three? If not, give me one hint.',
      '帮我 check this step 是否成立；引用“完整推导”只是旁边批注。',
    ],
    contexts: [null, '合成上下文：当前待核对的是等式两边同时除以三。'],
  },
  {
    id: 'v6-heldout-tutor-explain-negated-hint',
    expectedIntent: 'explain_solution',
    utterances: [
      '不要只给提示，请从条件开始完整推导到结论。',
      'Do not stop at a hint; walk through the whole solution from the givens.',
      '别只 nudge，我需要完整解释整个 reasoning chain。',
    ],
    contexts: [null, '合成上下文：已知条件与目标结论均已列出。'],
  },
  {
    id: 'v6-heldout-tutor-concept-bridge',
    expectedIntent: 'concept_bridge',
    utterances: [
      '我不明白为什么这个公式成立，请解释背后的概念联系。',
      "I don't understand why this relationship holds; explain the underlying principle.",
      '公式和 theorem 的 connection 没串起来，核心依据是什么？',
    ],
    contexts: [null, '合成上下文：当前公式来自同一个定义的两种等价写法。'],
  },
  {
    id: 'v6-heldout-tutor-hint-quoted-noise',
    expectedIntent: 'socratic_hint',
    utterances: [
      '我卡住了，请先给我一点提示，不要直接揭晓结果。',
      'I am stuck; give me a nudge without revealing the result.',
      'The margin says "check this step"; give me a nudge without revealing the result.',
    ],
    contexts: [null, '合成上下文：已经完成变量代换，下一步尚未展开。'],
  },
  {
    id: 'v6-heldout-tutor-context-follow-up',
    expectedIntent: 'general_follow_up',
    utterances: [
      '结合上面的解题记录，接下来怎么继续分析？',
      'Continue from where we left off and tell me what to examine next.',
      '那这个变形接下来呢？旁边的草稿纸是蓝色的。',
    ],
    contexts: [
      '合成上下文：先整理已知条件，再检查目标式。',
      '合成上下文：检查目标式之前，先整理已知条件。',
    ],
  },
] as const;

const tutorBoundaries = [
  {
    id: 'v6-heldout-tutor-unknown-signal',
    latestUserText: '草稿纸是蓝色的，页码位于右下角。',
    activeStudyContext: null,
    expectedReason: 'no_model_signal',
  },
  {
    id: 'v6-heldout-tutor-quoted-signal-only',
    latestUserText: 'The printed label says "check this step" and nothing else is requested.',
    activeStudyContext: null,
    expectedReason: 'no_model_signal',
  },
] as const;

const organizerSnapshots = [
  {
    id: 'v6-heldout-organizer-six-subject-overlap',
    source: {
      ownerDomain: `hmac-sha256:${'1'.repeat(64)}`,
      ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
      ownerSnapshotFingerprint: `sha256:${'2'.repeat(64)}`,
      safety: 'safe_for_model',
      questions: [
        {
          id: 'v6-heldout-question-math',
          subject: '数学',
          category: '高等数学',
          knowledgePoints: ['泰勒展开'],
          errorType: null,
          questionText: '比较两个泰勒展开式的余项阶数。',
          analysis: '需要核对展开阶数。',
          status: 'UNRESOLVED',
          updatedAt: '2026-07-27T09:00:00.000Z',
        },
        {
          id: 'v6-heldout-question-english',
          subject: null,
          category: null,
          knowledgePoints: [],
          errorType: null,
          questionText: 'Identify the author attitude implied by the contrast in the passage.',
          analysis: 'Use the surrounding evidence rather than one isolated word.',
          status: 'UNRESOLVED',
          updatedAt: '2026-07-27T09:00:01.000Z',
        },
        {
          id: 'v6-heldout-question-politics',
          subject: null,
          category: null,
          knowledgePoints: [],
          errorType: null,
          questionText: '材料关联年度重要会议与当前政策主题。',
          analysis: '需要识别时事背景。',
          status: 'UNRESOLVED',
          updatedAt: '2026-07-27T09:00:02.000Z',
        },
        {
          id: 'v6-heldout-question-computer',
          subject: null,
          category: null,
          knowledgePoints: [],
          errorType: null,
          questionText: 'A database index misses the leftmost-prefix rule.',
          analysis: 'Inspect the composite index ordering.',
          status: 'UNRESOLVED',
          updatedAt: '2026-07-27T09:00:03.000Z',
        },
        {
          id: 'v6-heldout-question-major',
          subject: null,
          category: null,
          knowledgePoints: [],
          errorType: null,
          questionText: 'Use the Routh criterion to check control system stability.',
          analysis: 'The sign changes determine the unstable roots.',
          status: 'UNRESOLVED',
          updatedAt: '2026-07-27T09:00:04.000Z',
        },
        {
          id: 'v6-heldout-question-other',
          subject: null,
          category: null,
          knowledgePoints: [],
          errorType: null,
          questionText: 'Compare the painting styles and perspective of two periods.',
          analysis: 'Focus on composition and spatial depth.',
          status: 'UNRESOLVED',
          updatedAt: '2026-07-27T09:00:05.000Z',
        },
      ],
      decks: [
        {
          id: 'v6-heldout-deck-math',
          subject: 'math',
          name: '用户锁定的泰勒专题',
          nameLocked: true,
          keywords: ['泰勒展开', '余项'],
          updatedAt: '2026-07-27T09:01:00.000Z',
        },
        {
          id: 'v6-heldout-deck-english',
          subject: 'english',
          name: '阅读推断',
          nameLocked: true,
          keywords: ['作者立场', 'reading inference'],
          updatedAt: '2026-07-27T09:01:01.000Z',
        },
        {
          id: 'v6-heldout-deck-politics',
          subject: 'politics',
          name: '时事专题',
          nameLocked: false,
          keywords: ['重要会议', '政策主题'],
          updatedAt: '2026-07-27T09:01:02.000Z',
        },
        {
          id: 'v6-heldout-deck-computer',
          subject: 'computer',
          name: '数据库索引',
          nameLocked: false,
          keywords: ['database index', 'leftmost-prefix'],
          updatedAt: '2026-07-27T09:01:03.000Z',
        },
        {
          id: 'v6-heldout-deck-major',
          subject: 'major',
          name: '控制系统稳定性',
          nameLocked: false,
          keywords: ['routh criterion', 'system stability'],
          updatedAt: '2026-07-27T09:01:04.000Z',
        },
        {
          id: 'v6-heldout-deck-other',
          subject: 'other',
          name: '艺术构图',
          nameLocked: false,
          keywords: ['painting style', 'perspective', 'composition'],
          updatedAt: '2026-07-27T09:01:05.000Z',
        },
      ],
    },
    expectations: [
      {
        questionId: 'v6-heldout-question-math',
        subject: 'math',
        deckId: 'v6-heldout-deck-math',
        confidence: 'high',
      },
      {
        questionId: 'v6-heldout-question-english',
        subject: 'english',
        deckId: 'v6-heldout-deck-english',
        confidence: 'high',
      },
      {
        questionId: 'v6-heldout-question-politics',
        subject: 'politics',
        deckId: 'v6-heldout-deck-politics',
        confidence: 'high',
      },
      {
        questionId: 'v6-heldout-question-computer',
        subject: 'computer',
        deckId: 'v6-heldout-deck-computer',
        confidence: 'high',
      },
      {
        questionId: 'v6-heldout-question-major',
        subject: 'major',
        deckId: 'v6-heldout-deck-major',
        confidence: 'high',
      },
      {
        questionId: 'v6-heldout-question-other',
        subject: 'other',
        deckId: 'v6-heldout-deck-other',
        confidence: 'high',
      },
    ],
  },
] as const;

export const PHASE_6_9_7_V6_TUTOR_RELATION_FIXTURES = deepFreeze(tutorRelations);
export const PHASE_6_9_7_V6_TUTOR_BOUNDARY_FIXTURES = deepFreeze(tutorBoundaries);
export const PHASE_6_9_7_V6_ORGANIZER_SNAPSHOT_FIXTURES = deepFreeze(organizerSnapshots);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
