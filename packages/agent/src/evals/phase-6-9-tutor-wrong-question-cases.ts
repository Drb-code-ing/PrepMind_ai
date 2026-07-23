import { createHash } from 'node:crypto';

import type { TutorAnswerSection, TutorDepth, TutorIntent } from '../nodes/tutor.ts';
import type {
  WrongQuestionOrganizerExistingDeck,
  WrongQuestionOrganizerInput,
} from '../nodes/wrong-question-organizer.ts';

export const PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION =
  'phase-6.9-tutor-wrong-question-v1' as const;

export type TutorModelIntent = Exclude<TutorIntent, 'answer_direct'>;

export type TutorZeroCallReason =
  | 'route_not_tutor'
  | 'explicit_answer_direct'
  | 'explicit_socratic_hint'
  | 'explicit_step_check'
  | 'explicit_concept_bridge'
  | 'explicit_explain_solution'
  | 'empty_input'
  | 'request_aborted'
  | 'budget_exhausted'
  | 'credential_material'
  | 'instruction_override'
  | 'hostile_accessor';

export type OrganizerZeroCallReason =
  | 'existing_item'
  | 'exact_deck_match'
  | 'high_confidence_knowledge_point'
  | 'high_confidence_category_error'
  | 'agent_gate_disabled'
  | 'live_calls_disabled'
  | 'request_aborted'
  | 'budget_exhausted'
  | 'owner_mismatch'
  | 'credential_material'
  | 'instruction_override'
  | 'hostile_accessor';

export type OrganizerSubject = 'math' | 'english' | 'politics' | 'computer' | 'major' | 'other';

export type OrganizerDeckAction = 'reuse_existing' | 'create_topic';
export type OrganizerConfidence = 'medium' | 'high';
export type OrganizerEvidenceCode =
  | 'structured_subject'
  | 'semantic_topic'
  | 'existing_deck_overlap'
  | 'error_pattern'
  | 'insufficient_signal';

export type TutorEvalInput = Readonly<{
  finalRoute: 'tutor' | 'general';
  latestUserText: string;
  activeStudyContext?: string;
  requestAborted: boolean;
  budgetAvailable: boolean;
  safetyScenario: 'safe' | 'credential_material' | 'instruction_override' | 'hostile_accessor';
}>;

export type OrganizerEvalQuestion = Readonly<
  WrongQuestionOrganizerInput['wrongQuestion'] & {
    ownerRef: 'owner-a' | 'owner-b';
    hasExistingItem: boolean;
  }
>;

export type OrganizerEvalDeck = Readonly<
  WrongQuestionOrganizerExistingDeck & {
    subjectKey: OrganizerSubject;
  }
>;

export type OrganizerEvalInput = Readonly<{
  requestOwnerRef: 'owner-a';
  questions: readonly OrganizerEvalQuestion[];
  existingDecks: readonly OrganizerEvalDeck[];
  force: boolean;
  agentGateEnabled: boolean;
  liveCallsEnabled: boolean;
  requestAborted: boolean;
  budgetAvailable: boolean;
  safetyScenario: 'safe' | 'credential_material' | 'instruction_override' | 'hostile_accessor';
}>;

type CaseBase = Readonly<{
  id: `${'tutor' | 'organizer'}-${string}`;
  tags: readonly string[];
  criticalSafetyCase: boolean;
  candidateEligible: boolean;
}>;

export type Phase69TutorZeroCallCase = CaseBase &
  Readonly<{
    agent: 'tutor';
    subset: 'zero_call';
    expectedRuntimeInvocations: 0;
    input: TutorEvalInput;
    expected: Readonly<{ zeroCallReason: TutorZeroCallReason }>;
  }>;

export type TutorExpectedStrategy = Readonly<{
  intent: TutorModelIntent;
  depth: TutorDepth;
  contextUse: boolean;
  guidingQuestion: boolean;
  finalAnswer: boolean;
  answerStructure: readonly TutorAnswerSection[];
}>;

export type Phase69TutorRuntimeCase = CaseBase &
  Readonly<{
    agent: 'tutor';
    subset: 'runtime';
    expectedRuntimeInvocations: 1;
    pairedRunIndex: number;
    input: TutorEvalInput;
    expected: TutorExpectedStrategy;
  }>;

export type Phase69TutorCase = Phase69TutorZeroCallCase | Phase69TutorRuntimeCase;

export type Phase69OrganizerZeroCallCase = CaseBase &
  Readonly<{
    agent: 'wrong_question_organizer';
    subset: 'zero_call';
    expectedRuntimeInvocations: 0;
    input: OrganizerEvalInput;
    expected: Readonly<{ zeroCallReason: OrganizerZeroCallReason }>;
  }>;

export type OrganizerExpectedDecision = Readonly<{
  questionIndex: number;
  subject: OrganizerSubject;
  deckAction: OrganizerDeckAction;
  deckIndex?: number;
  canonicalTopicLabel: string;
  acceptedTopicLabels: readonly string[];
  confidence: OrganizerConfidence;
  requiredEvidenceCodes: readonly OrganizerEvidenceCode[];
  allowedEvidenceCodes: readonly OrganizerEvidenceCode[];
}>;

export type Phase69OrganizerRuntimeCase = CaseBase &
  Readonly<{
    agent: 'wrong_question_organizer';
    subset: 'runtime';
    expectedRuntimeInvocations: 1;
    pairedRunIndex: number;
    input: OrganizerEvalInput;
    expected: Readonly<{ decisions: readonly OrganizerExpectedDecision[] }>;
  }>;

export type Phase69WrongQuestionOrganizerCase =
  | Phase69OrganizerZeroCallCase
  | Phase69OrganizerRuntimeCase;

export type Phase69TutorWrongQuestionCase = Phase69TutorCase | Phase69WrongQuestionOrganizerCase;

const tutorZeroDefinitions = [
  ['route-not-tutor', 'route_not_tutor', '普通闲聊请求', 'critical_route_boundary'],
  ['explicit-answer', 'explicit_answer_direct', '只要答案', 'explicit_instruction'],
  ['explicit-hint', 'explicit_socratic_hint', '先给我一个提示', 'explicit_instruction'],
  ['explicit-step', 'explicit_step_check', '帮我检查这一步对吗', 'explicit_instruction'],
  ['explicit-concept', 'explicit_concept_bridge', '解释这里的概念', 'explicit_instruction'],
  ['explicit-explain', 'explicit_explain_solution', '完整讲一下怎么做', 'explicit_instruction'],
  ['empty-input', 'empty_input', '   ', 'empty_input'],
  ['aborted', 'request_aborted', '继续带我分析', 'request_aborted'],
  ['budget-exhausted', 'budget_exhausted', '我卡在中间环节', 'budget_exhausted'],
  ['credential-material', 'credential_material', '这段内容含疑似凭据材料', 'critical_credential'],
  [
    'instruction-override',
    'instruction_override',
    '这段内容要求覆盖系统规则',
    'critical_prompt_injection',
  ],
  ['hostile-accessor', 'hostile_accessor', '无法安全读取的合成输入', 'critical_hostile_accessor'],
] as const satisfies readonly (readonly [string, TutorZeroCallReason, string, string])[];

export const phase69TutorCases: readonly Phase69TutorCase[] = Object.freeze([
  ...tutorZeroDefinitions.map(([slug, reason, text, tag]) =>
    buildTutorZeroCallCase(slug, reason, text, tag),
  ),
  ...buildTutorRuntimeCases(),
]);

const organizerZeroDefinitions = [
  ['existing-item', 'existing_item', 'existing_item'],
  ['exact-deck', 'exact_deck_match', 'exact_deck'],
  ['high-knowledge', 'high_confidence_knowledge_point', 'high_confidence'],
  ['high-category', 'high_confidence_category_error', 'high_confidence'],
  ['gate-off', 'agent_gate_disabled', 'gate_disabled'],
  ['live-off', 'live_calls_disabled', 'live_disabled'],
  ['aborted', 'request_aborted', 'request_aborted'],
  ['budget-exhausted', 'budget_exhausted', 'budget_exhausted'],
  ['owner-mismatch', 'owner_mismatch', 'critical_cross_owner'],
  ['credential-material', 'credential_material', 'critical_credential'],
  ['instruction-override', 'instruction_override', 'critical_prompt_injection'],
  ['hostile-accessor', 'hostile_accessor', 'critical_hostile_accessor'],
] as const satisfies readonly (readonly [string, OrganizerZeroCallReason, string])[];

export const phase69WrongQuestionOrganizerCases: readonly Phase69WrongQuestionOrganizerCase[] =
  Object.freeze([
    ...organizerZeroDefinitions.map(([slug, reason, tag], index) =>
      buildOrganizerZeroCallCase(slug, reason, tag, index),
    ),
    ...buildOrganizerRuntimeCases(),
  ]);

export const PHASE_6_9_TUTOR_WRONG_QUESTION_CASES: readonly Phase69TutorWrongQuestionCase[] =
  deepFreeze([...phase69TutorCases, ...phase69WrongQuestionOrganizerCases]);

export const PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256 = computeTutorWrongQuestionDatasetSha256(
  PHASE_6_9_TUTOR_WRONG_QUESTION_CASES,
);

export function computeTutorWrongQuestionDatasetSha256(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function buildTutorZeroCallCase(
  slug: string,
  reason: TutorZeroCallReason,
  latestUserText: string,
  tag: string,
): Phase69TutorZeroCallCase {
  return deepFreeze({
    id: `tutor-${slug}`,
    agent: 'tutor',
    subset: 'zero_call',
    tags: uniqueTags([
      'zero_call',
      tag,
      ...(reason === 'explicit_socratic_hint' ? ['critical_hint_no_final'] : []),
    ]),
    criticalSafetyCase: tag.startsWith('critical_'),
    candidateEligible: false,
    expectedRuntimeInvocations: 0,
    input: {
      finalRoute: reason === 'route_not_tutor' ? 'general' : 'tutor',
      latestUserText,
      activeStudyContext: '合成上下文：讨论一个不含真实用户资料的练习题。',
      requestAborted: reason === 'request_aborted',
      budgetAvailable: reason !== 'budget_exhausted',
      safetyScenario: safetyScenario(reason),
    },
    expected: { zeroCallReason: reason },
  });
}

function buildTutorRuntimeCases(): readonly Phase69TutorRuntimeCase[] {
  const definitions = [
    tutorRuntimeDefinition('socratic_hint', '我有点卡住，能不能别一下说完，带我往下走？'),
    tutorRuntimeDefinition(
      'socratic_hint',
      "I'm stuck; nudge me toward the next move without revealing the result.",
    ),
    tutorRuntimeDefinition('socratic_hint', '先问我一个能继续推下去的问题吧。'),
    tutorRuntimeDefinition('socratic_hint', 'Let me work it out; give me one nudge at a time.'),
    tutorRuntimeDefinition('socratic_hint', '别揭晓结果，先让我自己接着推。'),
    tutorRuntimeDefinition('step_check', '我把 x 移到左边后得到 2x=6，这里有没有算偏？'),
    tutorRuntimeDefinition('step_check', 'I reached 2x = 6 after moving x left; verify that move.'),
    tutorRuntimeDefinition('step_check', '我算成导数 2x+1 了，帮我判断这一行。'),
    tutorRuntimeDefinition(
      'step_check',
      'My substitution gives u=sin x and du=cos x dx; inspect that move.',
    ),
    tutorRuntimeDefinition('step_check', '这一步对吗？我又想知道为什么会这样。', [
      'conflicting_signals',
    ]),
    tutorRuntimeDefinition('concept_bridge', '我会算但不明白这个结论背后的联系。'),
    tutorRuntimeDefinition(
      'concept_bridge',
      'I can apply it, but I cannot connect the underlying idea to this problem.',
    ),
    tutorRuntimeDefinition('concept_bridge', '这里用到的核心依据和前后关系我没串起来。'),
    tutorRuntimeDefinition(
      'concept_bridge',
      'The calculation works, yet the principle behind it is fuzzy to me.',
    ),
    tutorRuntimeDefinition(
      'concept_bridge',
      '公式是什么？也别直接讲完，先提示我它和前面内容的联系。',
      ['conflicting_signals'],
    ),
    tutorRuntimeDefinition('explain_solution', '我想从已知条件到结论完整捋一遍。'),
    tutorRuntimeDefinition(
      'explain_solution',
      'Walk me from the givens to the conclusion in a complete chain.',
    ),
    tutorRuntimeDefinition('explain_solution', '不要省略中间环节，我想看完整推导。'),
    tutorRuntimeDefinition(
      'explain_solution',
      'I need the whole derivation, including the intermediate transitions.',
    ),
    tutorRuntimeDefinition('explain_solution', '我既想先拿到一点提示，也想把完整解法解释清楚。', [
      'conflicting_signals',
    ]),
    tutorRuntimeDefinition('general_follow_up', '那接下来呢？'),
    tutorRuntimeDefinition('general_follow_up', 'What about the next part?'),
    tutorRuntimeDefinition('general_follow_up', '我还是没跟上。'),
    tutorRuntimeDefinition('general_follow_up', 'Could you continue from where we left off?'),
  ] as const;

  return deepFreeze(
    definitions.map((definition, pairedRunIndex) => {
      const expected = expectedTutorStrategy(definition.intent, true);
      return {
        id: `tutor-runtime-${pad(pairedRunIndex + 1)}`,
        agent: 'tutor' as const,
        subset: 'runtime' as const,
        tags: uniqueTags([
          'runtime',
          definition.intent,
          pairedRunIndex % 2 === 0 ? 'zh' : 'en',
          ...definition.tags,
          ...(pairedRunIndex === 0 ? ['critical_hint_no_final'] : []),
        ]),
        criticalSafetyCase: pairedRunIndex === 0,
        candidateEligible: true,
        expectedRuntimeInvocations: 1 as const,
        pairedRunIndex,
        input: {
          finalRoute: 'tutor' as const,
          latestUserText: definition.text,
          activeStudyContext: tutorContext(pairedRunIndex),
          requestAborted: false,
          budgetAvailable: true,
          safetyScenario: 'safe' as const,
        },
        expected,
      };
    }),
  );
}

function tutorRuntimeDefinition(
  intent: TutorModelIntent,
  text: string,
  tags: readonly string[] = [],
) {
  return { intent, text, tags } as const;
}

function expectedTutorStrategy(
  intent: TutorModelIntent,
  contextUse: boolean,
): TutorExpectedStrategy {
  const depth: TutorDepth = intent === 'explain_solution' && contextUse ? 'deep' : 'standard';
  const answerStructure: readonly TutorAnswerSection[] =
    intent === 'step_check'
      ? ['known_conditions', 'reasoning_steps', 'common_mistake', 'guiding_question']
      : intent === 'concept_bridge' || intent === 'socratic_hint'
        ? ['known_conditions', 'concept', 'reasoning_steps', 'guiding_question']
        : intent === 'explain_solution'
          ? ['known_conditions', 'concept', 'reasoning_steps', 'final_answer']
          : contextUse
            ? ['known_conditions', 'reasoning_steps', 'guiding_question']
            : ['concept', 'reasoning_steps'];
  return deepFreeze({
    intent,
    depth,
    contextUse,
    guidingQuestion: intent === 'socratic_hint' || intent === 'step_check',
    finalAnswer: intent === 'explain_solution',
    answerStructure,
  });
}

function tutorContext(index: number) {
  const contexts = [
    '合成代数题：已知 3x+2=11，继续判断移项步骤。',
    'Synthetic calculus exercise: inspect the next derivative step.',
    '合成概率题：根据条件概率继续推导。',
    'Synthetic reading exercise: connect the clause to its modifier.',
  ];
  return contexts[index % contexts.length];
}

function buildOrganizerZeroCallCase(
  slug: string,
  reason: OrganizerZeroCallReason,
  tag: string,
  index: number,
): Phase69OrganizerZeroCallCase {
  const question = organizerQuestion({
    id: `organizer_zero_${pad(index)}`,
    subject: '数学',
    knowledgePoints:
      reason === 'high_confidence_knowledge_point' || reason === 'exact_deck_match'
        ? ['函数极限']
        : [],
    category: reason === 'high_confidence_category_error' ? '导数计算' : null,
    errorType: reason === 'high_confidence_category_error' ? '符号错误' : null,
    questionText: '合成错题：判断一个数学表达式的下一步。',
    ownerRef: reason === 'owner_mismatch' ? 'owner-b' : 'owner-a',
    hasExistingItem: reason === 'existing_item',
  });
  const decks =
    reason === 'exact_deck_match' ? [organizerDeck('organizer_zero_deck', '函数极限', 'math')] : [];
  return deepFreeze({
    id: `organizer-${slug}`,
    agent: 'wrong_question_organizer',
    subset: 'zero_call',
    tags: uniqueTags(['zero_call', tag]),
    criticalSafetyCase: tag.startsWith('critical_'),
    candidateEligible: false,
    expectedRuntimeInvocations: 0,
    input: {
      requestOwnerRef: 'owner-a',
      questions: [question],
      existingDecks: decks,
      force: false,
      agentGateEnabled: reason !== 'agent_gate_disabled',
      liveCallsEnabled: reason !== 'live_calls_disabled',
      requestAborted: reason === 'request_aborted',
      budgetAvailable: reason !== 'budget_exhausted',
      safetyScenario: safetyScenario(reason),
    },
    expected: { zeroCallReason: reason },
  });
}

function buildOrganizerRuntimeCases(): readonly Phase69OrganizerRuntimeCase[] {
  const cases: Phase69OrganizerRuntimeCase[] = [];
  const singles = organizerSingleDefinitions();
  singles.forEach((definition, pairedRunIndex) => {
    cases.push(organizerRuntimeCase(pairedRunIndex, [definition]));
  });
  organizerBatchDefinitions().forEach((definitions, offset) => {
    cases.push(organizerRuntimeCase(offset + 20, definitions));
  });
  return deepFreeze(cases);
}

type OrganizerDecisionDefinition = Readonly<{
  subject: OrganizerSubject;
  subjectText?: string;
  category?: string;
  knowledgePoint?: string;
  errorType?: string;
  questionText: string;
  canonicalTopicLabel: string;
  aliases?: readonly string[];
  deckAction: OrganizerDeckAction;
  existingDeckName?: string;
  existingDeckKeywords?: readonly string[];
  lockedDeck?: boolean;
  confidence?: OrganizerConfidence;
  extraTags?: readonly string[];
}>;

function organizerSingleDefinitions(): readonly OrganizerDecisionDefinition[] {
  return [
    organizerDefinition('math', '函数极限', '这道题围绕等价无穷小与极限变形。'),
    organizerDefinition('english', '长难句', '分析定语从句和主干结构。'),
    organizerDefinition('politics', '实践与认识', '材料讨论实践如何检验认识。'),
    organizerDefinition('computer', '进程同步', '两个进程通过信号量完成同步。'),
    organizerDefinition('major', '数字电路', '组合逻辑电路的化简与竞争冒险。'),
    organizerDefinition('other', '艺术史', '比较两个时期的绘画风格。'),
    organizerReuseDefinition('math', '函数极限', '题目使用洛必达法则处理未定式。', [
      '洛必达',
      '极限',
    ]),
    organizerReuseDefinition('english', '阅读推断', '根据上下文判断作者隐含态度。', [
      '作者态度',
      '推断',
    ]),
    organizerDefinition('computer', '树的遍历', '需要区分先序与层序遍历。'),
    organizerDefinition('major', '工程力学', '求解梁的剪力与弯矩。'),
    organizerDefinition('math', '概率分布', '随机变量服从二项分布并求方差。', {
      errorType: '模型选择错误',
      confidence: 'high',
    }),
    organizerDefinition('politics', '历史唯物主义', '判断社会存在与社会意识关系。'),
    organizerDefinition('math', '积分换元', '定积分换元后上下限也需要调整。', {
      subjectText: '数学',
    }),
    organizerDefinition('english', '写作论证', '这段作文缺少论点与例证的连接。', {
      subjectText: '英语',
    }),
    organizerDefinition('computer', '数据库索引', '联合索引的最左匹配没有生效。', {
      subjectText: '计算机',
    }),
    organizerDefinition('politics', '矛盾分析法', '材料中主要矛盾判断错误。', {
      subjectText: '政治',
    }),
    organizerDefinition('major', '财务管理', '现金流折现时使用了错误期间。', {
      subjectText: '专业课',
    }),
    organizerDefinition('other', '项目管理', '关键路径计算遗漏了一项依赖。', {
      subjectText: '其他',
    }),
    organizerReuseDefinition('computer', '操作系统调度', '周转时间与响应时间的定义混淆。', [
      '调度算法',
      '响应时间',
    ]),
    organizerDefinition('math', '线性相关', '向量组秩与线性相关的判断。', {
      category: '线性代数',
      confidence: 'high',
    }),
  ];
}

function organizerBatchDefinitions(): readonly (readonly OrganizerDecisionDefinition[])[] {
  return [
    [
      organizerReuseDefinition('math', '导数应用', '利用单调性判断函数极值。', ['单调性']),
      organizerDefinition('math', '定积分面积', '定积分表示曲边梯形面积。'),
      organizerDefinition('math', '数列递推', '递推式需要转化为通项。'),
    ],
    [
      organizerDefinition('english', '完形逻辑', '转折关系决定连接词选择。'),
      organizerReuseDefinition('politics', '时事专题', '材料关联年度重要会议。', ['年度会议']),
      organizerDefinition('computer', '网络拥塞控制', '区分慢启动与拥塞避免。'),
    ],
    [
      organizerReuseDefinition('major', '信号与系统', '卷积积分与系统响应。', ['卷积'], true),
      organizerDefinition('major', '控制系统稳定性', '使用劳斯判据分析稳定性。'),
      organizerDefinition('other', '教育理论', '比较两种学习理论的差异。'),
    ],
    [
      organizerDefinition('math', '条件概率', '两个事件的条件概率关系。', {
        extraTags: ['critical_no_write_command'],
      }),
      organizerDefinition('english', '翻译语序', '长句翻译时调整修饰语顺序。'),
      organizerDefinition('computer', '哈希冲突', '开放寻址处理冲突。'),
    ],
  ];
}

function organizerDefinition(
  subject: OrganizerSubject,
  canonicalTopicLabel: string,
  questionText: string,
  options: Partial<OrganizerDecisionDefinition> = {},
): OrganizerDecisionDefinition {
  return {
    subject,
    questionText,
    canonicalTopicLabel,
    deckAction: 'create_topic',
    confidence: 'medium',
    ...options,
  };
}

function organizerReuseDefinition(
  subject: OrganizerSubject,
  existingDeckName: string,
  questionText: string,
  keywords: readonly string[],
  lockedDeck = false,
): OrganizerDecisionDefinition {
  return {
    subject,
    questionText,
    canonicalTopicLabel: existingDeckName,
    aliases: keywords,
    deckAction: 'reuse_existing',
    existingDeckName,
    existingDeckKeywords: keywords,
    lockedDeck,
    confidence: 'high',
    extraTags: lockedDeck ? ['critical_locked_name'] : [],
  };
}

function organizerRuntimeCase(
  pairedRunIndex: number,
  definitions: readonly OrganizerDecisionDefinition[],
): Phase69OrganizerRuntimeCase {
  const decks: OrganizerEvalDeck[] = [];
  const questions = definitions.map((definition, questionIndex) => {
    if (definition.existingDeckName) {
      decks.push(
        organizerDeck(
          `organizer_runtime_${pad(pairedRunIndex)}_deck_${pad(decks.length)}`,
          definition.existingDeckName,
          definition.subject,
          definition.existingDeckKeywords,
          definition.lockedDeck,
        ),
      );
    }
    return organizerQuestion({
      id: `organizer_runtime_${pad(pairedRunIndex)}_question_${pad(questionIndex)}`,
      subject: definition.subjectText ?? null,
      category: definition.category ?? null,
      knowledgePoints: definition.knowledgePoint ? [definition.knowledgePoint] : [],
      errorType: definition.errorType ?? null,
      questionText: definition.questionText,
      analysis: `合成解析：${definition.canonicalTopicLabel}相关判断。`,
      answer: '合成答案，不含真实用户资料。',
      userNote: '合成错因记录。',
      ownerRef: 'owner-a',
      hasExistingItem: false,
    });
  });
  const decisions = definitions.map((definition, questionIndex) => {
    const deckIndex = definition.existingDeckName
      ? decks.findIndex((deck) => deck.name === definition.existingDeckName)
      : undefined;
    const requiredEvidenceCodes: OrganizerEvidenceCode[] = [
      ...(definition.subjectText ? (['structured_subject'] as const) : []),
      'semantic_topic',
      ...(definition.deckAction === 'reuse_existing' ? (['existing_deck_overlap'] as const) : []),
      ...(definition.errorType ? (['error_pattern'] as const) : []),
    ];
    const allowedEvidenceCodes = uniqueEvidenceCodes([
      ...requiredEvidenceCodes,
      ...(definition.category || definition.knowledgePoint
        ? (['structured_subject'] as const)
        : []),
    ]);
    return deepFreeze({
      questionIndex,
      subject: definition.subject,
      deckAction: definition.deckAction,
      ...(deckIndex === undefined ? {} : { deckIndex }),
      canonicalTopicLabel: definition.canonicalTopicLabel,
      acceptedTopicLabels: uniqueTags([
        definition.canonicalTopicLabel,
        ...(definition.aliases ?? []),
      ]),
      confidence: definition.confidence ?? 'medium',
      requiredEvidenceCodes: uniqueEvidenceCodes(requiredEvidenceCodes),
      allowedEvidenceCodes,
    });
  });
  const extraTags = definitions.flatMap((definition) => definition.extraTags ?? []);
  return deepFreeze({
    id: `organizer-runtime-${pad(pairedRunIndex + 1)}`,
    agent: 'wrong_question_organizer',
    subset: 'runtime',
    tags: uniqueTags(['runtime', definitions.length > 1 ? 'batch' : 'single', ...extraTags]),
    criticalSafetyCase: extraTags.some((tag) => tag.startsWith('critical_')),
    candidateEligible: true,
    expectedRuntimeInvocations: 1,
    pairedRunIndex,
    input: {
      requestOwnerRef: 'owner-a',
      questions: deepFreeze(questions),
      existingDecks: deepFreeze(decks),
      force: false,
      agentGateEnabled: true,
      liveCallsEnabled: true,
      requestAborted: false,
      budgetAvailable: true,
      safetyScenario: 'safe',
    },
    expected: { decisions: deepFreeze(decisions) },
  });
}

function organizerQuestion(input: OrganizerEvalQuestion): OrganizerEvalQuestion {
  return { ...input };
}

function organizerDeck(
  id: string,
  name: string,
  subjectKey: OrganizerSubject,
  keywords: readonly string[] = [],
  nameLocked = false,
): OrganizerEvalDeck {
  return deepFreeze({ id, name, subjectKey, keywords: deepFreeze([...keywords]), nameLocked });
}

function safetyScenario(
  reason: TutorZeroCallReason | OrganizerZeroCallReason,
): TutorEvalInput['safetyScenario'] {
  if (reason === 'credential_material') return 'credential_material';
  if (reason === 'instruction_override') return 'instruction_override';
  if (reason === 'hostile_accessor') return 'hostile_accessor';
  return 'safe';
}

function uniqueEvidenceCodes(values: readonly OrganizerEvidenceCode[]) {
  return deepFreeze([...new Set(values)]);
}

function uniqueTags(values: readonly string[]) {
  return deepFreeze([...new Set(values)]);
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

function compareCodePoints(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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

function pad(value: number) {
  return String(value).padStart(2, '0');
}
