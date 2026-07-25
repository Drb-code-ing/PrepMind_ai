export const PHASE_6_9_7_V4_INDEPENDENT_ROBUSTNESS_VERSION =
  'phase-6.9.7-tutor-organizer-v4-independent-robustness-v1' as const;
export const PHASE_6_9_7_V4_INDEPENDENT_ROBUSTNESS_SHA256 =
  'sha256:ee3c2b21ea4c1bb4c144c38bd61def45f1d4e36d39a0cea94bc9dbd660b888ad' as const;

const tutorRelations = [
  {
    id: 'independent-tutor-hint-negation-rewrite',
    relation: 'semantic_equivalence',
    utterances: [
      '先不要给完整答案，只提醒我下一步该检查什么。',
      'Do not solve it for me; point me toward the next check.',
      '别直接 reveal final answer，给一个 next-step clue。',
      '只提示下一步，不要完整解答；旁边的草稿纸是绿色的。',
    ],
    contexts: [
      '合成上下文：方程已经移项，下一步需要核对系数。',
      '合成上下文：下一步需要核对系数；此前已经完成移项。',
    ],
  },
  {
    id: 'independent-tutor-step-over-hint-conflict',
    relation: 'primary_evidence_precedence',
    utterances: [
      '我算到 x=4 这一步对吗？如果不对只给我一点提示。',
      'Is it correct that x=4 at this step? If not, give only a small hint.',
      '帮我 check this step 是否成立，别直接给 final answer。',
    ],
    contexts: [
      '合成上下文：待检查的是等式两边同时除以二。',
      '合成上下文：等式两边同时除以二是当前待检查步骤。',
    ],
  },
  {
    id: 'independent-tutor-explanation-positive-over-negated-hint',
    relation: 'negation_boundary',
    utterances: [
      '不要只给提示，请从条件开始完整推导到结论。',
      'Do not stop at a hint; derive the result from the givens.',
      '别只 nudge，我需要完整 reasoning 和 final result。',
    ],
    contexts: [
      '合成上下文：先列样本空间，再计算目标事件。',
      '合成上下文：目标事件计算之前先列样本空间。',
    ],
  },
] as const;

const organizerSnapshots = [
  {
    id: 'independent-organizer-mixed-authority',
    questions: [
      {
        questionId: 'independent-known-math',
        subject: '数学',
        subjectHint: 'math',
        category: '高等数学',
        knowledgePoints: ['泰勒展开', '极限'],
        errorType: '概念混淆',
        questionText: '比较两个展开式在零点附近的余项阶数。',
        analysis: '需要依据展开阶数判断误差。',
        answer: null,
        userNote: null,
        safety: 'safe_for_model',
      },
      {
        questionId: 'independent-unknown-computer',
        subject: null,
        subjectHint: 'unknown',
        category: '系统基础',
        knowledgePoints: ['虚拟内存', '缺页'],
        errorType: '机制混淆',
        questionText: '说明缺页中断发生后页表与缓存如何协同。',
        analysis: '需要区分页表更新和缓存失效。',
        answer: null,
        userNote: null,
        safety: 'safe_for_model',
      },
      {
        questionId: 'independent-unknown-major',
        subject: null,
        subjectHint: 'unknown',
        category: '专业课',
        knowledgePoints: ['传热', '边界条件'],
        errorType: '条件遗漏',
        questionText: '根据边界条件判断稳态导热的温度分布。',
        analysis: '需要先识别材料与边界约束。',
        answer: null,
        userNote: null,
        safety: 'safe_for_model',
      },
      {
        questionId: 'independent-unknown-other',
        subject: null,
        subjectHint: 'unknown',
        category: '艺术史',
        knowledgePoints: ['透视', '构图'],
        errorType: '特征遗漏',
        questionText: '分析单点透视如何改变画面的空间层次。',
        analysis: '需要识别消失点和视觉引导线。',
        answer: null,
        userNote: null,
        safety: 'safe_for_model',
      },
    ],
    decks: [
      {
        deckId: 'independent-deck-math',
        subject: 'math',
        name: '用户锁定的极限专题',
        nameLocked: true,
        keywords: ['极限', '展开式'],
        safety: 'safe_for_model',
      },
      {
        deckId: 'independent-deck-computer',
        subject: 'computer',
        name: '用户锁定的虚拟内存专题',
        nameLocked: true,
        keywords: ['虚拟内存', '缺页'],
        safety: 'safe_for_model',
      },
      {
        deckId: 'independent-deck-major',
        subject: 'major',
        name: '用户锁定的传热专题',
        nameLocked: true,
        keywords: ['传热', '边界条件'],
        safety: 'safe_for_model',
      },
      {
        deckId: 'independent-deck-other',
        subject: 'other',
        name: '用户锁定的艺术构图专题',
        nameLocked: true,
        keywords: ['透视', '构图'],
        safety: 'safe_for_model',
      },
    ],
  },
] as const;

export const PHASE_6_9_7_V4_TUTOR_RELATION_FIXTURES = deepFreeze(tutorRelations);
export const PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES = deepFreeze(organizerSnapshots);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
