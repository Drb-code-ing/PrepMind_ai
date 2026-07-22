import type { KnowledgeAgentDocumentInput } from '../nodes/knowledge-dedup.ts';

export const PHASE_6_9_KNOWLEDGE_AGENT_DATASET_VERSION =
  'phase-6.9-knowledge-agents-v1' as const;

export type KnowledgeSemanticRelation =
  | 'semantic_duplicate'
  | 'possible_revision'
  | 'complementary'
  | 'unrelated';

export type KnowledgeOrganizerSubject =
  | 'math'
  | 'english'
  | 'politics'
  | 'computer'
  | 'major'
  | 'other';

export type KnowledgeOrganizerResourceType =
  | 'lecture'
  | 'notes'
  | 'past_exam'
  | 'mistakes'
  | 'practice'
  | 'reference'
  | 'other';

export type KnowledgeZeroCallReason =
  | 'exact_hash_sufficient'
  | 'agent_gate_disabled'
  | 'live_calls_disabled'
  | 'request_aborted'
  | 'budget_exhausted'
  | 'target_owner_mismatch'
  | 'target_missing'
  | 'no_documents'
  | 'all_unprocessed'
  | 'no_safe_embedding'
  | 'below_similarity_threshold'
  | 'credential_material'
  | 'prompt_injection'
  | 'unsafe_metadata'
  | 'hostile_accessor'
  | 'no_safe_projection';

export type KnowledgeAgentEvalInput = Readonly<{
  now: string;
  targetDocumentId?: string;
  documents: readonly KnowledgeAgentDocumentInput[];
}>;

type KnowledgeAgentCaseBase = Readonly<{
  id: `${'dedup' | 'organizer'}-${string}`;
  tags: readonly string[];
  criticalSafetyCase: boolean;
  candidateEligible: boolean;
  input: KnowledgeAgentEvalInput;
  securityContext: Readonly<{
    requestOwnerRef: 'owner-a';
    targetOwnerRef: 'owner-a' | 'owner-b' | null;
  }>;
}>;

export type Phase69KnowledgeDedupZeroCallCase = KnowledgeAgentCaseBase &
  Readonly<{
    agent: 'dedup';
    subset: 'exact_hash' | 'guard_zero_call';
    expectedRuntimeInvocations: 0;
    zeroCallReason: KnowledgeZeroCallReason;
    expected: Readonly<{
      exactDuplicateDocumentIds: readonly string[];
    }>;
  }>;

export type Phase69KnowledgeDedupRuntimeCase = KnowledgeAgentCaseBase &
  Readonly<{
    agent: 'dedup';
    subset: KnowledgeSemanticRelation;
    expectedRuntimeInvocations: 1;
    pairedRunIndex: number;
    expected: Readonly<{
      relation: KnowledgeSemanticRelation;
      pairDocumentIds: readonly [string, string];
      localRevisionSignal: boolean;
    }>;
  }>;

export type Phase69KnowledgeDedupCase =
  | Phase69KnowledgeDedupZeroCallCase
  | Phase69KnowledgeDedupRuntimeCase;

export type Phase69KnowledgeOrganizerZeroCallCase = KnowledgeAgentCaseBase &
  Readonly<{
    agent: 'organizer';
    subset: 'guard_zero_call';
    expectedRuntimeInvocations: 0;
    zeroCallReason: KnowledgeZeroCallReason;
    expected: Readonly<Record<string, never>>;
  }>;

export type Phase69KnowledgeOrganizerRuntimeCase = KnowledgeAgentCaseBase &
  Readonly<{
    agent: 'organizer';
    subset: 'semantic_organization';
    expectedRuntimeInvocations: 1;
    pairedRunIndex: number;
    expected: Readonly<{
      subject: KnowledgeOrganizerSubject;
      resourceType: KnowledgeOrganizerResourceType;
      topicLabels: readonly string[];
      collectionPairs: readonly (readonly [string, string])[];
      coverage: Readonly<{
        singleDocument: boolean;
        invalidLabelChallenge: boolean;
      }>;
    }>;
  }>;

export type Phase69KnowledgeOrganizerCase =
  | Phase69KnowledgeOrganizerZeroCallCase
  | Phase69KnowledgeOrganizerRuntimeCase;

export type Phase69KnowledgeAgentCase =
  | Phase69KnowledgeDedupCase
  | Phase69KnowledgeOrganizerCase;

const NOW = '2026-07-21T08:00:00.000Z';

const dedupZeroCallDefinitions = [
  ['dedup-exact-hash-01', 'exact_hash_primary', 'exact_hash_sufficient', true],
  ['dedup-exact-hash-02', 'exact_hash_targeted', 'exact_hash_sufficient', true],
  ['dedup-gate-off', 'gate_disabled', 'agent_gate_disabled', false],
  ['dedup-live-off', 'live_disabled', 'live_calls_disabled', false],
  ['dedup-aborted', 'aborted', 'request_aborted', false],
  ['dedup-budget-exhausted', 'budget_exhausted', 'budget_exhausted', false],
  ['dedup-target-owner-mismatch', 'owner_mismatch', 'target_owner_mismatch', false],
  ['dedup-target-missing', 'target_missing', 'target_missing', false],
  ['dedup-no-documents', 'no_documents', 'no_documents', false],
  ['dedup-all-unprocessed', 'all_unprocessed', 'all_unprocessed', false],
  ['dedup-no-safe-embedding', 'no_safe_embedding', 'no_safe_embedding', false],
  ['dedup-below-threshold', 'below_threshold', 'below_similarity_threshold', false],
  ['dedup-filename-credential', 'filename_credential', 'credential_material', false],
  ['dedup-summary-injection', 'summary_injection', 'prompt_injection', false],
  ['dedup-safety-metadata-unknown', 'metadata_unknown', 'unsafe_metadata', false],
  ['dedup-hostile-accessor', 'hostile_accessor', 'hostile_accessor', false],
] as const satisfies readonly (readonly [
  string,
  string,
  KnowledgeZeroCallReason,
  boolean,
])[];

export const phase69KnowledgeDedupCases: readonly Phase69KnowledgeDedupCase[] =
  Object.freeze([
    ...dedupZeroCallDefinitions.map(([id, slug, reason, exactHash], index) =>
      buildDedupZeroCallCase({ id, slug, reason, exactHash, index }),
    ),
    ...buildDedupRuntimeCases(),
  ]);

const organizerZeroCallDefinitions = [
  ['organizer-gate-off', 'gate_disabled', 'agent_gate_disabled'],
  ['organizer-live-off', 'live_disabled', 'live_calls_disabled'],
  ['organizer-aborted', 'aborted', 'request_aborted'],
  ['organizer-budget-exhausted', 'budget_exhausted', 'budget_exhausted'],
  ['organizer-no-documents', 'no_documents', 'no_documents'],
  ['organizer-no-safe-projection', 'no_safe_projection', 'no_safe_projection'],
  ['organizer-summary-credential', 'summary_credential', 'credential_material'],
  ['organizer-hostile-accessor', 'hostile_accessor', 'hostile_accessor'],
] as const satisfies readonly (readonly [string, string, KnowledgeZeroCallReason])[];

export const phase69KnowledgeOrganizerCases: readonly Phase69KnowledgeOrganizerCase[] =
  Object.freeze([
    ...organizerZeroCallDefinitions.map(([id, slug, reason], index) =>
      buildOrganizerZeroCallCase({ id, slug, reason, index }),
    ),
    ...buildOrganizerRuntimeCases(),
  ]);

export const PHASE_6_9_KNOWLEDGE_AGENT_CASES: readonly Phase69KnowledgeAgentCase[] =
  Object.freeze([
    ...phase69KnowledgeDedupCases,
    ...phase69KnowledgeOrganizerCases,
  ]);

function buildDedupZeroCallCase(input: {
  id: string;
  slug: string;
  reason: KnowledgeZeroCallReason;
  exactHash: boolean;
  index: number;
}): Phase69KnowledgeDedupZeroCallCase {
  const left = documentFixture({
    id: `dedup_zero_${pad(input.index)}_left`,
    name: `合成资料甲${input.index + 1}.pdf`,
    summary: '合成评测资料的安全摘要。',
    hash: input.exactHash ? `exact_hash_${input.index}` : `left_hash_${input.index}`,
    status: input.reason === 'all_unprocessed' ? 'PENDING' : 'DONE',
  });
  const right = documentFixture({
    id: `dedup_zero_${pad(input.index)}_right`,
    name: `合成资料乙${input.index + 1}.pdf`,
    summary: '另一份合成评测资料的安全摘要。',
    hash: input.exactHash ? `exact_hash_${input.index}` : `right_hash_${input.index}`,
    status: input.reason === 'all_unprocessed' ? 'PENDING' : 'DONE',
  });
  const documents = input.reason === 'no_documents' ? [] : [left, right];
  const targetDocumentId = input.reason === 'target_owner_mismatch'
    ? 'dedup_foreign_owner_target'
    : input.reason === 'target_missing'
      ? 'dedup_missing_target'
      : input.slug === 'exact_hash_targeted'
        ? left.id
        : undefined;
  const targetOwnerRef = input.reason === 'target_owner_mismatch'
    ? 'owner-b'
    : input.reason === 'target_missing'
      ? null
      : 'owner-a';

  return deepFreeze({
    id: input.id as `dedup-${string}`,
    agent: 'dedup',
    subset: input.exactHash ? 'exact_hash' : 'guard_zero_call',
    tags: uniqueTags(['zero_call', input.reason]),
    criticalSafetyCase: [
      'target_owner_mismatch',
      'credential_material',
      'prompt_injection',
      'hostile_accessor',
    ].includes(input.reason),
    candidateEligible: false,
    expectedRuntimeInvocations: 0,
    zeroCallReason: input.reason,
    input: buildInput(documents, targetDocumentId),
    securityContext: deepFreeze({
      requestOwnerRef: 'owner-a' as const,
      targetOwnerRef,
    }),
    expected: deepFreeze({
      exactDuplicateDocumentIds: input.exactHash ? [left.id, right.id] : [],
    }),
  });
}

function buildDedupRuntimeCases(): readonly Phase69KnowledgeDedupRuntimeCase[] {
  const cases: Phase69KnowledgeDedupRuntimeCase[] = [];
  const semanticDuplicateTopics = [
    ['极限核心方法', '函数极限速查', '极限、等价无穷小与连续性的核心方法。'],
    ['矩阵秩精要', '线性空间考点', '矩阵秩、线性相关与向量空间的统一总结。'],
    ['英语长难句拆解', '阅读句法手册', '英语阅读中的从句、修饰关系与句法拆分。'],
    ['操作系统同步', '并发控制笔记', '进程同步、互斥锁与信号量的完整知识图谱。'],
    ['政治实践论', '认识论要点', '实践、认识、真理与检验标准的系统归纳。'],
    ['概率分布公式', '随机变量清单', '随机变量分布、期望与方差的公式总结。'],
  ] as const;
  const revisionTopics = [
    ['春季线性代数讲义', '暑期线代修订稿', '线性代数课程讲义，补充了特征值章节。'],
    ['英语阅读基础册', '英语阅读强化资料', '英语阅读训练资料，更新了题型与解析。'],
    ['数据结构课堂稿', '算法结构期末版', '数据结构复习资料，增加了图算法内容。'],
    ['政治理论初稿', '政治理论冲刺稿', '政治理论提纲，修正了时事章节。'],
    ['高等数学上册整理', '微积分上册修订', '微积分上册资料，更新了积分例题。'],
    ['专业课复习提要', '专业课考试定稿', '专业课复习资料，补充了最新考试范围。'],
  ] as const;
  const complementaryTopics = [
    ['高数概念讲义', '高数配套习题', '数学 极限 导数概念。', '数学 极限 导数练习。'],
    ['线性代数公式', '线性代数真题', '线性代数核心公式。', '线性代数历年真题。'],
    ['英语阅读方法', '英语阅读练习', '英语 阅读方法。', '英语 阅读练习。'],
    ['政治马原笔记', '政治马原题库', '政治 马原理论。', '政治 马原练习。'],
    ['计算机网络讲义', '计算机网络实验', '计算机 网络协议。', '计算机 网络实验。'],
    ['概率论概念', '概率论错题', '数学 概率概念。', '数学 概率错题。'],
  ] as const;
  const unrelatedTopics = [
    ['英语词汇表', '矩阵运算手册', '英语词汇与记忆方法。', '矩阵运算与秩。'],
    ['政治理论提纲', '计算机网络实验', '政治理论考点。', '计算机网络抓包实验。'],
    ['概率公式清单', '英语写作模板', '概率分布公式。', '英语写作结构。'],
    ['操作系统笔记', '高等数学真题', '进程与内存管理。', '极限与积分真题。'],
    ['法律基础讲义', '数据库索引笔记', '法律基础概念。', '数据库索引原理。'],
    ['教育学理论', '机械设计图册', '教育学理论。', '机械零件设计。'],
  ] as const;

  semanticDuplicateTopics.forEach(([leftName, rightName, summary], index) => {
    cases.push(
      dedupRuntimeCase(index, 'semantic_duplicate', leftName, rightName, summary, summary, false),
    );
  });
  revisionTopics.forEach(([leftName, rightName, summary], index) => {
    cases.push(
      dedupRuntimeCase(index + 6, 'possible_revision', leftName, rightName, summary, summary, true),
    );
  });
  complementaryTopics.forEach(([leftName, rightName, leftSummary, rightSummary], index) => {
    cases.push(
      dedupRuntimeCase(
        index + 12,
        'complementary',
        leftName,
        rightName,
        leftSummary,
        rightSummary,
        false,
      ),
    );
  });
  unrelatedTopics.forEach(([leftName, rightName, leftSummary, rightSummary], index) => {
    cases.push(
      dedupRuntimeCase(
        index + 18,
        'unrelated',
        leftName,
        rightName,
        leftSummary,
        rightSummary,
        false,
      ),
    );
  });
  return Object.freeze(cases);
}

function dedupRuntimeCase(
  pairedRunIndex: number,
  relation: KnowledgeSemanticRelation,
  leftName: string,
  rightName: string,
  leftSummary: string,
  rightSummary: string,
  localRevisionSignal: boolean,
): Phase69KnowledgeDedupRuntimeCase {
  const left = documentFixture({
    id: `dedup_runtime_${pad(pairedRunIndex)}_left`,
    name: `${leftName}.pdf`,
    summary: leftSummary,
    hash: `dedup_left_${pairedRunIndex}`,
    updatedDay: 1,
  });
  const right = documentFixture({
    id: `dedup_runtime_${pad(pairedRunIndex)}_right`,
    name: `${rightName}.pdf`,
    summary: rightSummary,
    hash: `dedup_right_${pairedRunIndex}`,
    updatedDay: localRevisionSignal ? 15 : 1,
  });
  return deepFreeze({
    id: `dedup-runtime-${pad(pairedRunIndex + 1)}`,
    agent: 'dedup',
    subset: relation,
    tags: uniqueTags(['runtime', relation]),
    criticalSafetyCase: false,
    candidateEligible: true,
    expectedRuntimeInvocations: 1,
    pairedRunIndex,
    input: buildInput([left, right]),
    securityContext: deepFreeze({
      requestOwnerRef: 'owner-a' as const,
      targetOwnerRef: 'owner-a' as const,
    }),
    expected: deepFreeze({
      relation,
      pairDocumentIds: [left.id, right.id] as const,
      localRevisionSignal,
    }),
  });
}

function buildOrganizerZeroCallCase(input: {
  id: string;
  slug: string;
  reason: KnowledgeZeroCallReason;
  index: number;
}): Phase69KnowledgeOrganizerZeroCallCase {
  const documents =
    input.reason === 'no_documents'
      ? []
      : [
          documentFixture({
            id: `organizer_zero_${pad(input.index)}`,
            name: `合成整理资料${input.index + 1}.md`,
            summary: '合成整理评测的安全摘要。',
            hash: `organizer_zero_hash_${input.index}`,
          }),
        ];
  return deepFreeze({
    id: input.id as `organizer-${string}`,
    agent: 'organizer',
    subset: 'guard_zero_call',
    tags: uniqueTags(['zero_call', input.reason]),
    criticalSafetyCase: ['credential_material', 'hostile_accessor'].includes(input.reason),
    candidateEligible: false,
    expectedRuntimeInvocations: 0,
    zeroCallReason: input.reason,
    input: buildInput(documents),
    securityContext: deepFreeze({
      requestOwnerRef: 'owner-a' as const,
      targetOwnerRef: 'owner-a' as const,
    }),
    expected: deepFreeze({}),
  });
}

function buildOrganizerRuntimeCases(): readonly Phase69KnowledgeOrganizerRuntimeCase[] {
  const subjectDefinitions = [
    ['math', ['极限方法', '矩阵结构', '概率模型', '微积分真题']],
    ['english', ['长难句', '阅读策略', '写作结构', '词汇复习']],
    ['politics', ['实践认识', '历史脉络', '理论框架', '时事专题']],
    ['computer', ['数据结构', '操作系统', '计算机网络', '数据库系统']],
    ['major', ['数字电路', '工程力学', '财务管理', '法学专题']],
    ['other', ['项目管理', '艺术史', '教育理论：专题', '天文学导论']],
  ] as const satisfies readonly (readonly [KnowledgeOrganizerSubject, readonly string[]])[];
  const resourceTypes: readonly KnowledgeOrganizerResourceType[] = [
    'notes',
    'lecture',
    'practice',
    'past_exam',
    'mistakes',
    'reference',
    'other',
  ];
  const resourceLabels: Readonly<Record<KnowledgeOrganizerResourceType, string>> = {
    lecture: '讲义',
    notes: '笔记',
    past_exam: '真题',
    mistakes: '错题',
    practice: '练习',
    reference: '参考资料',
    other: '资料',
  };
  const cases: Phase69KnowledgeOrganizerRuntimeCase[] = [];

  for (const [subjectIndex, [subject, topics]] of subjectDefinitions.entries()) {
    for (const [topicIndex, topic] of topics.entries()) {
      const pairedRunIndex = subjectIndex * 4 + topicIndex;
      const resourceType = resourceTypes[pairedRunIndex % resourceTypes.length];
      const resourceLabel = resourceLabels[resourceType];
      const singleDocument = topicIndex === 3;
      const invalidLabelChallenge = pairedRunIndex === 22;
      const left = documentFixture({
        id: `organizer_runtime_${pad(pairedRunIndex)}_left`,
        name: `${topic}${resourceLabel}.md`,
        summary: `${topic}的合成课程资料与核心概念。`,
        hash: `organizer_left_${pairedRunIndex}`,
      });
      const right = documentFixture({
        id: `organizer_runtime_${pad(pairedRunIndex)}_right`,
        name: `${topic}补充${resourceLabel}.txt`,
        summary: `${topic}的补充资料与复习重点。`,
        hash: `organizer_right_${pairedRunIndex}`,
      });
      cases.push(
        deepFreeze({
          id: `organizer-runtime-${pad(pairedRunIndex + 1)}`,
          agent: 'organizer',
          subset: 'semantic_organization',
          tags: uniqueTags([
            'runtime',
            subject,
            resourceType,
            ...(singleDocument ? ['single_document'] : []),
            ...(invalidLabelChallenge ? ['invalid_label_challenge'] : []),
          ]),
          criticalSafetyCase: false,
          candidateEligible: true,
          expectedRuntimeInvocations: 1,
          pairedRunIndex,
          input: buildInput(singleDocument ? [left] : [left, right]),
          securityContext: deepFreeze({
            requestOwnerRef: 'owner-a' as const,
            targetOwnerRef: 'owner-a' as const,
          }),
          expected: deepFreeze({
            subject,
            resourceType,
            topicLabels: [invalidLabelChallenge ? '教育理论专题' : topic],
            collectionPairs: singleDocument
              ? []
              : [[left.id, right.id] as const],
            coverage: deepFreeze({
              singleDocument,
              invalidLabelChallenge,
            }),
          }),
        }),
      );
    }
  }
  return Object.freeze(cases);
}

function documentFixture(input: {
  id: string;
  name: string;
  summary: string;
  hash: string;
  status?: KnowledgeAgentDocumentInput['status'];
  updatedDay?: number;
}): KnowledgeAgentDocumentInput {
  const updatedDay = input.updatedDay ?? 1;
  return deepFreeze({
    id: input.id,
    name: input.name,
    type: input.name.endsWith('.md')
      ? 'MD'
      : input.name.endsWith('.txt')
        ? 'TXT'
        : 'PDF',
    size: 4096,
    status: input.status ?? 'DONE',
    sourceType: 'UPLOAD',
    contentHash: input.hash,
    chunkCount: 2,
    processedAt: `2026-07-${pad(updatedDay)}T07:30:00.000Z`,
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: `2026-07-${pad(updatedDay)}T07:30:00.000Z`,
    chunkSummaries: deepFreeze([input.summary]),
  });
}

function buildInput(
  documents: readonly KnowledgeAgentDocumentInput[],
  targetDocumentId?: string,
): KnowledgeAgentEvalInput {
  return deepFreeze({
    now: NOW,
    documents: deepFreeze([...documents]),
    ...(targetDocumentId ? { targetDocumentId } : {}),
  });
}

function uniqueTags(tags: readonly string[]) {
  return deepFreeze([...new Set(tags)]);
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
