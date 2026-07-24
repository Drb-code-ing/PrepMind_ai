export const PHASE_6_9_7_V2_ROBUSTNESS_SUITE_VERSION =
  'phase-6.9.7-tutor-organizer-v2-robustness-v1' as const;

const tutorFixtures = [
  {
    id: 'robustness-tutor-socratic-paraphrase',
    variants: [
      '先别把过程全部铺开，只推我往下一步。',
      'Give me a nudge toward the next move without solving it outright.',
      '先别展开 full solution，给点 clue 让我自己推。',
      '先别把过程全部铺开，只推我往下一步。今天的纸张是蓝色的。',
    ],
    contextVariants: [
      '合成题上下文：先写已知条件，再判断等式变形。',
      '合成题上下文：先判断等式变形，再写已知条件。',
    ],
    decision: {
      intent: 'socratic_hint',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['implicit_hint_request'],
    },
  },
  {
    id: 'robustness-tutor-step-check-paraphrase',
    variants: [
      '我写成 x=3，这个推导站得住吗？',
      'Does my derivation hold after moving the constant?',
      '我写成 x=3；does this derivation hold？',
    ],
    contextVariants: [
      '一元一次方程：移项后系数保持为三。',
      '一元一次方程：系数保持为三，再完成移项。',
    ],
    decision: {
      intent: 'step_check',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['submitted_step'],
    },
  },
  {
    id: 'robustness-tutor-concept-bridge-paraphrase',
    variants: [
      '这个变形背后的依据和前一条定义怎样衔接？',
      'Which principle makes the transformation valid and links it to the prior definition?',
      '这个 transformation 的依据怎样 connect 到前面定义？',
    ],
    contextVariants: [
      '函数题上下文：定义域限制在前，单调性结论在后。',
      '函数题上下文：单调性结论在后，定义域限制在前。',
    ],
    decision: {
      intent: 'concept_bridge',
      depth: 'deep',
      confidence: 'high',
      evidenceCodes: ['concept_gap'],
    },
  },
  {
    id: 'robustness-tutor-explain-paraphrase',
    variants: [
      '请从条件开始完整推到结论，中间环节都保留。',
      'Walk through the derivation from the givens to the result, retaining every key transition.',
      '请从 givens 一路推到 result，保留关键 transition。',
    ],
    contextVariants: [
      '概率题上下文：先列样本空间，再计算事件概率。',
      '概率题上下文：先计算事件概率，再核对样本空间。',
    ],
    decision: {
      intent: 'explain_solution',
      depth: 'deep',
      confidence: 'high',
      evidenceCodes: ['full_explanation_request'],
    },
  },
  {
    id: 'robustness-tutor-general-follow-up-paraphrase',
    variants: [
      '沿着刚才的内容，我们接着看哪个部分？',
      'Where do we continue from the previous reasoning?',
      '沿着 previous reasoning，where do we continue？',
    ],
    contextVariants: [
      '几何题上下文：辅助线已经画出，角度关系尚未代入。',
      '几何题上下文：角度关系尚未代入，辅助线已经画出。',
    ],
    decision: {
      intent: 'general_follow_up',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['contextual_reference'],
    },
  },
] as const;

const organizerSubjectFixtures = [
  {
    id: 'robustness-organizer-math-series',
    subject: 'math',
    questionText: '比较两个无穷级数的收敛速度，并说明判别依据。',
    topicLabel: '级数判敛',
  },
  {
    id: 'robustness-organizer-english-subjunctive',
    subject: 'english',
    questionText: '辨析与过去事实相反的虚拟语气结构。',
    topicLabel: '虚拟语气',
  },
  {
    id: 'robustness-organizer-politics-surplus-value',
    subject: 'politics',
    questionText: '分析劳动力商品如何产生剩余价值。',
    topicLabel: '剩余价值',
  },
  {
    id: 'robustness-organizer-computer-tcp-close',
    subject: 'computer',
    questionText: '说明 TCP 四次挥手中的状态转换与等待原因。',
    topicLabel: 'TCP连接释放',
  },
  {
    id: 'robustness-organizer-major-thermodynamics',
    subject: 'major',
    questionText: '根据热力学第一定律计算封闭系统的能量变化。',
    topicLabel: '热力学第一定律',
  },
  {
    id: 'robustness-organizer-other-composition',
    subject: 'other',
    questionText: '识别文艺复兴绘画中三角构图的视觉作用。',
    topicLabel: '绘画构图',
  },
] as const;

export const PHASE_6_9_7_V2_TUTOR_ROBUSTNESS_FIXTURES = deepFreeze(tutorFixtures);
export const PHASE_6_9_7_V2_ORGANIZER_SUBJECT_FIXTURES = deepFreeze(organizerSubjectFixtures);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
