import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS,
  WRONG_QUESTION_ORGANIZER_DECISION_POLICY,
  type WrongQuestionOrganizerBoundedSubject,
} from '../policies/wrong-question-organizer-policy.ts';
import {
  clonePlainEvidenceData,
  deepFreezeModelValue,
  scanCompleteModelField,
  truncateUnicodeScalars,
  type ModelProjectionSafetyReasonCode,
} from './model-projection-safety.ts';

export const WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION =
  'wrong-question-organizer-shortlist-v5' as const;
export const WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_VERSION =
  'wrong-question-organizer-shortlist-rules-v1' as const;

const MAX_QUESTIONS = 12;
const MAX_DECKS = 20;
const MAX_KNOWLEDGE_POINTS = 12;
const MAX_DECK_KEYWORDS = 8;
const MAX_TOPIC_CANDIDATES = 8;
const MAX_TEXT_UTF16 = 16_384;
const MAX_TOTAL_TEXT_UTF16 = 65_536;
const MAX_PROJECTED_TEXT_SCALARS = 320;
const HASH_PATTERN = /^(?:sha256|hmac-sha256):[a-f0-9]{64}$/;
const VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/;

const SUBJECT_ORDER = new Map(
  WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS.map((subject, index) => [subject, index]),
);

const SUBJECT_SIGNAL_SOURCE = deepFreezeModelValue([
  {
    subject: 'math',
    patterns: [
      '数学',
      '代数',
      '几何',
      '函数',
      '极限',
      '导数',
      '积分',
      '概率',
      '矩阵',
      '洛必达',
      '未定式',
      '随机变量',
      '方差',
      '线性代数',
      '向量组',
      '单调性',
      '递推式',
      'math',
      'calculus',
      'algebra',
      'probability',
      'matrix',
      'binomial distribution',
      'linear dependence',
    ],
  },
  {
    subject: 'english',
    patterns: [
      '英语',
      '阅读理解',
      '完形',
      '翻译',
      '写作',
      'grammar',
      'reading',
      'english',
      'translation',
      'vocabulary',
      'main clause',
      'relative-clause',
      'author attitude',
      'essay',
      'cloze',
      'connective',
      'modifier',
    ],
  },
  {
    subject: 'politics',
    patterns: [
      '政治',
      '马原',
      '毛概',
      '认识论',
      '唯物',
      '辩证',
      '时政',
      '实践',
      '社会存在',
      '主要矛盾',
      '重要会议',
      'politics',
      'dialectic',
    ],
  },
  {
    subject: 'computer',
    patterns: [
      '计算机',
      '数据结构',
      '算法',
      '操作系统',
      '数据库',
      '计算机网络',
      '软件',
      '进程',
      '信号量',
      '临界区',
      '遍历',
      '周转时间',
      '响应时间',
      '拥塞',
      '哈希',
      'computer',
      'algorithm',
      'database',
      'operating system',
      'network',
      'processes',
      'semaphores',
      'critical section',
      'slow start',
      'hash collision',
    ],
  },
  {
    subject: 'major',
    patterns: [
      '专业课',
      '数字电路',
      '信号与系统',
      '控制系统',
      '工程力学',
      '财务管理',
      '电路',
      '逻辑电路',
      '竞争冒险',
      '剪力',
      '弯矩',
      '现金流',
      '卷积积分',
      '系统响应',
      'major course',
      'control system',
      'engineering mechanics',
      'finance',
      'routh criterion',
      'system stability',
    ],
  },
  {
    subject: 'other',
    patterns: [
      '其他',
      '艺术史',
      '教育理论',
      '学习理论',
      '项目管理',
      'painting',
      'education',
      'learning theory',
      'project management',
      'other',
    ],
  },
] as const satisfies readonly Readonly<{
  subject: WrongQuestionOrganizerBoundedSubject;
  patterns: readonly string[];
}>[]);

const TOPIC_SIGNAL_SOURCE = deepFreezeModelValue([
  ['函数极限', 'math', ['等价无穷小', '函数极限', 'limit transformation']],
  ['导数应用', 'math', ['导数应用', '切线', '单调区间', 'derivative application']],
  ['定积分面积', 'math', ['定积分', '曲边梯形', 'area under']],
  ['概率分布', 'math', ['概率分布', '随机变量', 'distribution']],
  ['条件概率', 'math', ['条件概率', '贝叶斯', 'conditional probability']],
  ['线性相关', 'math', ['线性相关', '向量组', 'linear dependence']],
  ['数列递推', 'math', ['数列递推', '递推式', 'recurrence']],
  [
    '长难句',
    'english',
    ['长难句', '从句', 'long sentence', 'clause structure', 'main clause', 'relative-clause'],
  ],
  ['阅读推断', 'english', ['阅读推断', '作者态度', 'reading inference']],
  ['完形逻辑', 'english', ['完形', 'cloze', 'contrast relation', 'connective']],
  ['写作论证', 'english', ['写作论证', 'essay argument', 'writing argument', 'supporting example']],
  ['翻译语序', 'english', ['翻译语序', 'translation order', 'translation', 'modifier', '语序']],
  ['实践与认识', 'politics', ['实践与认识', '认识来源', '实践', 'practice and cognition']],
  ['矛盾分析法', 'politics', ['矛盾分析', '主要矛盾', 'dialectical contradiction']],
  ['历史唯物主义', 'politics', ['历史唯物', '社会存在', 'historical materialism']],
  ['时事专题', 'politics', ['时事', '年度重要会议', '重要会议', 'current affairs']],
  ['操作系统调度', 'computer', ['进程调度', '操作系统调度', 'cpu scheduling']],
  [
    '进程同步',
    'computer',
    ['进程同步', '信号量', 'process synchronization', 'semaphores', 'critical section'],
  ],
  ['数据库索引', 'computer', ['数据库索引', 'b+树', 'database index', '联合索引', '最左匹配']],
  ['树的遍历', 'computer', ['先序遍历', '层序遍历', 'tree traversal']],
  [
    '网络拥塞控制',
    'computer',
    ['拥塞控制', 'tcp congestion', 'slow start', 'congestion avoidance'],
  ],
  ['哈希冲突', 'computer', ['哈希冲突', '散列表冲突', 'hash collision']],
  [
    '数字电路',
    'major',
    ['数字电路', '逻辑门', '触发器', 'digital circuit', '逻辑电路', '竞争冒险'],
  ],
  ['信号与系统', 'major', ['信号与系统', '傅里叶', 'signal and system']],
  [
    '控制系统稳定性',
    'major',
    ['控制系统稳定', '根轨迹', 'control stability', 'control system stability', 'routh criterion'],
  ],
  ['工程力学', 'major', ['工程力学', '受力分析', 'engineering mechanics', '剪力', '弯矩']],
  ['财务管理', 'major', ['财务管理', '现金流', 'finance management']],
  ['艺术史', 'other', ['艺术史', '绘画风格', 'painting style']],
  ['教育理论', 'other', ['教育理论', '教学理论', '学习理论', 'education theory']],
  ['项目管理', 'other', ['项目管理', '关键路径', 'project management', 'critical-path']],
  ['积分换元', 'math', ['积分换元', '换元后上下限', 'substitution in integral']],
] as const satisfies readonly Readonly<
  readonly [string, WrongQuestionOrganizerBoundedSubject, readonly string[]]
>[]);

const SHORTLIST_RULE_SOURCE = deepFreezeModelValue({
  version: WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_VERSION,
  limits: {
    questions: MAX_QUESTIONS,
    decks: MAX_DECKS,
    knowledgePoints: MAX_KNOWLEDGE_POINTS,
    deckKeywords: MAX_DECK_KEYWORDS,
    topicCandidates: MAX_TOPIC_CANDIDATES,
    maxTextUtf16: MAX_TEXT_UTF16,
    maxTotalTextUtf16: MAX_TOTAL_TEXT_UTF16,
    maxProjectedTextScalars: MAX_PROJECTED_TEXT_SCALARS,
  },
  sort: {
    questions: 'question_id_code_point_asc',
    decks: 'subject_name_id_code_point_asc',
    topics: 'source_priority_label_code_point_asc',
    subjects: 'signal_score_desc_bounded_subject_order',
  },
  normalization: 'NFKC_trim_lower_collapse_whitespace',
  duplicateDeckResolution: 'same_subject_normalized_name_lowest_id_with_all_ids_fingerprinted',
  structuredSubjectAuthority: 'exact_known_subject_precedes_taxonomy',
  subjectSignals: SUBJECT_SIGNAL_SOURCE,
  topicSignals: TOPIC_SIGNAL_SOURCE,
});

export const WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256 =
  sha256Canonical(SHORTLIST_RULE_SOURCE);
export const WRONG_QUESTION_ORGANIZER_V5_FROZEN_SHORTLIST_RULES_SHA256 =
  '9747383ca2ad9dfdc143a55d23ccb62ba14dc7d84ff82d3c7bfe21f0371299d3' as const;

if (
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256 !==
  WRONG_QUESTION_ORGANIZER_V5_FROZEN_SHORTLIST_RULES_SHA256
) {
  throw new Error('WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA_MISMATCH');
}

export type WrongQuestionOrganizerV5Subject = WrongQuestionOrganizerBoundedSubject;
export type WrongQuestionOrganizerV5TopicSource =
  | 'knowledge_point'
  | 'category'
  | 'error_type'
  | 'question_semantic';

export type WrongQuestionOrganizerV5ShortlistSource = Readonly<{
  ownerDomain: string;
  ownerSnapshotVersion: string;
  ownerSnapshotFingerprint: string;
  safety: 'safe_for_model' | 'unsafe' | 'unknown';
  questions: readonly Readonly<{
    id: string;
    subject?: string | null;
    category?: string | null;
    knowledgePoints?: readonly string[] | null;
    errorType?: string | null;
    questionText?: string | null;
    analysis?: string | null;
    status?: string | null;
    updatedAt?: string | null;
  }>[];
  decks: readonly Readonly<{
    id: string;
    subject: string;
    name: string;
    nameLocked?: boolean;
    keywords?: readonly string[] | null;
    updatedAt?: string | null;
  }>[];
}>;

export type WrongQuestionOrganizerV5ShortlistAuthority = Readonly<{
  version: typeof WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION;
  rulesVersion: typeof WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_VERSION;
  rulesSha256: string;
  shortlistFingerprint: string;
  provenance: Readonly<{
    generator: 'local_deterministic';
    subjectAuthority: 'structured_then_taxonomy';
    topicAuthority: 'bounded_local_candidates';
    ordinalAuthority: 'stable_local_snapshot';
  }>;
  source: WrongQuestionOrganizerV5ShortlistSource;
  decks: readonly Readonly<{
    deckIndex: number;
    deckId: string;
    foldedDeckIds: readonly string[];
    subject: WrongQuestionOrganizerV5Subject;
    name: string;
    normalizedName: string;
    nameLocked: boolean;
    keywords: readonly string[];
  }>[];
  questions: readonly Readonly<{
    questionIndex: number;
    questionId: string;
    structuredSubject: WrongQuestionOrganizerV5Subject | null;
    subjectCandidates: readonly WrongQuestionOrganizerV5Subject[];
    topicCandidates: readonly Readonly<{
      topicIndex: number;
      label: string;
      normalizedLabel: string;
      subject: WrongQuestionOrganizerV5Subject;
      source: WrongQuestionOrganizerV5TopicSource;
    }>[];
    eligibleDeckActions: readonly ('reuse_existing' | 'create_topic')[];
    projected: Readonly<{
      category?: string;
      knowledgePoints?: readonly string[];
      errorType?: string;
      questionExcerpt?: string;
      analysisExcerpt?: string;
    }>;
  }>[];
}>;

export type WrongQuestionOrganizerV5ShortlistFailureCode =
  | ModelProjectionSafetyReasonCode
  | 'unsafe_metadata'
  | 'candidate_shortlist_empty'
  | 'subject_authority_unresolved'
  | 'shortlist_authority_invalid';

export type WrongQuestionOrganizerV5ShortlistResult =
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV5ShortlistAuthority }>
  | Readonly<{ ok: false; reasonCode: WrongQuestionOrganizerV5ShortlistFailureCode }>;

const NULLABLE_TEXT = z.string().nullable().optional();
const SOURCE_SCHEMA = z
  .object({
    ownerDomain: z.string().regex(HASH_PATTERN),
    ownerSnapshotVersion: z.string().regex(VERSION_PATTERN),
    ownerSnapshotFingerprint: z.string().regex(HASH_PATTERN),
    safety: z.enum(['safe_for_model', 'unsafe', 'unknown']),
    questions: z
      .array(
        z
          .object({
            id: z.string().min(1).max(256),
            subject: NULLABLE_TEXT,
            category: NULLABLE_TEXT,
            knowledgePoints: z.array(z.string()).max(MAX_KNOWLEDGE_POINTS).nullable().optional(),
            errorType: NULLABLE_TEXT,
            questionText: NULLABLE_TEXT,
            analysis: NULLABLE_TEXT,
            status: NULLABLE_TEXT,
            updatedAt: NULLABLE_TEXT,
          })
          .strict(),
      )
      .min(1)
      .max(MAX_QUESTIONS),
    decks: z
      .array(
        z
          .object({
            id: z.string().min(1).max(256),
            subject: z.string(),
            name: z.string(),
            nameLocked: z.boolean().optional(),
            keywords: z.array(z.string()).max(MAX_DECK_KEYWORDS).nullable().optional(),
            updatedAt: NULLABLE_TEXT,
          })
          .strict(),
      )
      .max(MAX_DECKS),
  })
  .strict();

export function deriveWrongQuestionOrganizerV5Shortlist(
  input: unknown,
): WrongQuestionOrganizerV5ShortlistResult {
  try {
    const cloned = clonePlainEvidenceData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'invalid_input' };
    const parsed = SOURCE_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'invalid_input' };
    const built = buildAuthority(parsed.data);
    if (!built.ok) return built;
    return validateWrongQuestionOrganizerV5Shortlist(built.value).ok
      ? built
      : { ok: false, reasonCode: 'shortlist_authority_invalid' };
  } catch {
    return { ok: false, reasonCode: 'invalid_input' };
  }
}

export function validateWrongQuestionOrganizerV5Shortlist(
  input: unknown,
): WrongQuestionOrganizerV5ShortlistResult {
  try {
    const cloned = clonePlainEvidenceData(input);
    if (!cloned.ok || typeof cloned.value !== 'object' || cloned.value === null) {
      return { ok: false, reasonCode: 'shortlist_authority_invalid' };
    }
    const candidate = cloned.value as Record<string, unknown>;
    if (
      candidate.version !== WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION ||
      candidate.rulesVersion !== WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_VERSION ||
      candidate.rulesSha256 !== WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256
    ) {
      return { ok: false, reasonCode: 'shortlist_authority_invalid' };
    }
    const rebuilt = deriveAuthorityWithoutValidation(candidate.source);
    if (!rebuilt.ok || JSON.stringify(rebuilt.value) !== JSON.stringify(candidate)) {
      return { ok: false, reasonCode: 'shortlist_authority_invalid' };
    }
    return { ok: true, value: deepFreezeModelValue(rebuilt.value) };
  } catch {
    return { ok: false, reasonCode: 'shortlist_authority_invalid' };
  }
}

function deriveAuthorityWithoutValidation(input: unknown): WrongQuestionOrganizerV5ShortlistResult {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok) return { ok: false, reasonCode: 'shortlist_authority_invalid' };
  const parsed = SOURCE_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) return { ok: false, reasonCode: 'shortlist_authority_invalid' };
  return buildAuthority(parsed.data);
}

function buildAuthority(
  sourceInput: z.infer<typeof SOURCE_SCHEMA>,
): WrongQuestionOrganizerV5ShortlistResult {
  if (sourceInput.safety !== 'safe_for_model') {
    return { ok: false, reasonCode: 'unsafe_metadata' };
  }
  if (
    new Set(sourceInput.questions.map((question) => question.id)).size !==
    sourceInput.questions.length
  ) {
    return { ok: false, reasonCode: 'invalid_input' };
  }
  if (new Set(sourceInput.decks.map((deck) => deck.id)).size !== sourceInput.decks.length) {
    return { ok: false, reasonCode: 'invalid_input' };
  }

  let totalTextUtf16 = 0;
  const scan = (value: string | null | undefined, rejectWrite = true) => {
    if (value === undefined || value === null) return { ok: true as const, value: undefined };
    totalTextUtf16 += value.length;
    const checked = scanCompleteModelField(value, {
      maxUtf16CodeUnits: MAX_TEXT_UTF16,
      rejectToolOrWriteInstruction: rejectWrite,
    });
    return checked.ok ? { ok: true as const, value: checked.value.trim() || undefined } : checked;
  };

  const normalizedQuestions: Array<z.infer<typeof SOURCE_SCHEMA>['questions'][number]> = [];
  for (const question of sourceInput.questions) {
    const subject = scan(question.subject);
    const category = scan(question.category);
    const errorType = scan(question.errorType);
    const questionText = scan(question.questionText);
    const analysis = scan(question.analysis);
    const status = scan(question.status, false);
    const updatedAt = scan(question.updatedAt, false);
    const knowledgePoints = (question.knowledgePoints ?? []).map((value) => scan(value));
    if (!subject.ok) return subject;
    if (!category.ok) return category;
    if (!errorType.ok) return errorType;
    if (!questionText.ok) return questionText;
    if (!analysis.ok) return analysis;
    if (!status.ok) return status;
    if (!updatedAt.ok) return updatedAt;
    const failedKnowledgePoint = knowledgePoints.find((field) => !field.ok);
    if (failedKnowledgePoint && !failedKnowledgePoint.ok) return failedKnowledgePoint;
    const normalizedKnowledgePoints = uniqueSorted(
      knowledgePoints.flatMap((field) => (field.ok && field.value ? [field.value] : [])),
    );
    normalizedQuestions.push({
      id: question.id,
      ...(subject.value ? { subject: subject.value } : {}),
      ...(category.value ? { category: category.value } : {}),
      ...(question.knowledgePoints ? { knowledgePoints: normalizedKnowledgePoints } : {}),
      ...(errorType.value ? { errorType: errorType.value } : {}),
      ...(questionText.value ? { questionText: questionText.value } : {}),
      ...(analysis.value ? { analysis: analysis.value } : {}),
      ...(status.value ? { status: status.value } : {}),
      ...(updatedAt.value ? { updatedAt: updatedAt.value } : {}),
    });
  }

  const normalizedDeckRows: Array<z.infer<typeof SOURCE_SCHEMA>['decks'][number]> = [];
  for (const deck of sourceInput.decks) {
    const subject = scan(deck.subject);
    const name = scan(deck.name);
    const updatedAt = scan(deck.updatedAt, false);
    const keywords = (deck.keywords ?? []).map((value) => scan(value));
    if (!subject.ok) return subject;
    if (!name.ok) return name;
    if (!updatedAt.ok) return updatedAt;
    const failedKeyword = keywords.find((field) => !field.ok);
    if (failedKeyword && !failedKeyword.ok) return failedKeyword;
    if (!subject.value || !name.value) return { ok: false, reasonCode: 'invalid_input' };
    normalizedDeckRows.push({
      id: deck.id,
      subject: subject.value,
      name: name.value,
      nameLocked: Boolean(deck.nameLocked),
      keywords: uniqueSorted(
        keywords.flatMap((field) => (field.ok && field.value ? [field.value] : [])),
      ),
      ...(updatedAt.value ? { updatedAt: updatedAt.value } : {}),
    });
  }
  if (totalTextUtf16 > MAX_TOTAL_TEXT_UTF16) {
    return { ok: false, reasonCode: 'field_too_large' };
  }

  const questions = [...normalizedQuestions].sort((left, right) => compareText(left.id, right.id));
  const sourceDecks = [...normalizedDeckRows].sort((left, right) => compareText(left.id, right.id));
  const deckBuild = buildDeckAuthority(sourceDecks);
  if (!deckBuild.ok) return deckBuild;

  const questionAuthorities: WrongQuestionOrganizerV5ShortlistAuthority['questions'][number][] = [];
  for (const [questionIndex, question] of questions.entries()) {
    const structuredSubject = resolveStructuredSubject(question.subject);
    const subjectCandidates = structuredSubject
      ? [structuredSubject]
      : deriveSubjectCandidates(question);
    const topicCandidates = buildTopicCandidates(question, subjectCandidates[0]);
    const hasSameSubjectDeck = deckBuild.value.some((deck) =>
      subjectCandidates.includes(deck.subject),
    );
    const eligibleDeckActions: ('reuse_existing' | 'create_topic')[] = [
      ...(hasSameSubjectDeck ? (['reuse_existing'] as const) : []),
      ...(topicCandidates.length > 0 ? (['create_topic'] as const) : []),
    ];
    questionAuthorities.push({
      questionIndex,
      questionId: question.id,
      structuredSubject,
      subjectCandidates,
      topicCandidates,
      eligibleDeckActions,
      projected: compactProjectedQuestion(question),
    });
  }

  const source: WrongQuestionOrganizerV5ShortlistSource = {
    ownerDomain: sourceInput.ownerDomain,
    ownerSnapshotVersion: sourceInput.ownerSnapshotVersion,
    ownerSnapshotFingerprint: sourceInput.ownerSnapshotFingerprint,
    safety: 'safe_for_model',
    questions,
    decks: sourceDecks,
  };
  const withoutFingerprint = {
    version: WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
    rulesVersion: WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_VERSION,
    rulesSha256: WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256,
    provenance: {
      generator: 'local_deterministic' as const,
      subjectAuthority: 'structured_then_taxonomy' as const,
      topicAuthority: 'bounded_local_candidates' as const,
      ordinalAuthority: 'stable_local_snapshot' as const,
    },
    source,
    decks: deckBuild.value,
    questions: questionAuthorities,
  };
  return {
    ok: true,
    value: deepFreezeModelValue({
      ...withoutFingerprint,
      shortlistFingerprint: `sha256:${sha256Canonical(withoutFingerprint)}`,
    }),
  };
}

function buildDeckAuthority(
  decks: readonly z.infer<typeof SOURCE_SCHEMA>['decks'][number][],
):
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV5ShortlistAuthority['decks'] }>
  | Readonly<{ ok: false; reasonCode: WrongQuestionOrganizerV5ShortlistFailureCode }> {
  const groups = new Map<string, (typeof decks)[number][]>();
  for (const deck of decks) {
    const subject = resolveStructuredSubject(deck.subject);
    if (subject === null) return { ok: false, reasonCode: 'subject_authority_unresolved' };
    const normalizedName = normalizeLabel(deck.name);
    if (!isSafeTopicLabel(deck.name)) return { ok: false, reasonCode: 'candidate_shortlist_empty' };
    const key = `${subject}\0${normalizedName}`;
    const group = groups.get(key) ?? [];
    group.push(deck);
    groups.set(key, group);
  }
  const authorities = [...groups.values()]
    .map((rows) => {
      const ordered = [...rows].sort((left, right) => compareText(left.id, right.id));
      const selected = ordered[0];
      const subject = resolveStructuredSubject(selected.subject)!;
      return {
        deckId: selected.id,
        foldedDeckIds: ordered.map((deck) => deck.id),
        subject,
        name: selected.name,
        normalizedName: normalizeLabel(selected.name),
        nameLocked: ordered.some((deck) => Boolean(deck.nameLocked)),
        keywords: uniqueSorted(
          ordered.flatMap((deck) => deck.keywords ?? []).map((keyword) => keyword.trim()),
        ).slice(0, MAX_DECK_KEYWORDS),
      };
    })
    .sort(
      (left, right) =>
        (SUBJECT_ORDER.get(left.subject) ?? 99) - (SUBJECT_ORDER.get(right.subject) ?? 99) ||
        compareText(left.normalizedName, right.normalizedName) ||
        compareText(left.deckId, right.deckId),
    )
    .map((deck, deckIndex) => ({ deckIndex, ...deck }));
  return { ok: true, value: deepFreezeModelValue(authorities) };
}

function deriveSubjectCandidates(
  question: z.infer<typeof SOURCE_SCHEMA>['questions'][number],
): readonly WrongQuestionOrganizerV5Subject[] {
  const haystack = normalizeLabel(
    [
      question.category,
      ...(question.knowledgePoints ?? []),
      question.errorType,
      question.questionText,
      question.analysis,
    ]
      .filter(Boolean)
      .join(' '),
  );
  const ranked = SUBJECT_SIGNAL_SOURCE.map((entry) => ({
    subject: entry.subject,
    score: entry.patterns.reduce(
      (score, pattern) => score + (haystack.includes(normalizeLabel(pattern)) ? 1 : 0),
      0,
    ),
  }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (SUBJECT_ORDER.get(left.subject) ?? 99) - (SUBJECT_ORDER.get(right.subject) ?? 99),
    )
    .slice(0, 3)
    .map((entry) => entry.subject);
  return deepFreezeModelValue(ranked.length > 0 ? ranked : ['other']);
}

function buildTopicCandidates(
  question: z.infer<typeof SOURCE_SCHEMA>['questions'][number],
  primarySubject: WrongQuestionOrganizerV5Subject,
): WrongQuestionOrganizerV5ShortlistAuthority['questions'][number]['topicCandidates'] {
  const candidates: Array<{
    label: string;
    normalizedLabel: string;
    subject: WrongQuestionOrganizerV5Subject;
    source: WrongQuestionOrganizerV5TopicSource;
    priority: number;
  }> = [];
  const add = (label: string | null | undefined, source: WrongQuestionOrganizerV5TopicSource) => {
    const value = label?.trim();
    if (!value || !isSafeTopicLabel(value)) return;
    candidates.push({
      label: truncateUnicodeScalars(
        value,
        WRONG_QUESTION_ORGANIZER_DECISION_POLICY.topicLabel.maxUnicodeScalars,
      ),
      normalizedLabel: normalizeLabel(value),
      subject: primarySubject,
      source,
      priority: topicSourcePriority(source),
    });
  };
  for (const knowledgePoint of question.knowledgePoints ?? [])
    add(knowledgePoint, 'knowledge_point');
  add(question.category, 'category');
  add(question.errorType, 'error_type');
  const semanticText = normalizeLabel(
    [question.questionText, question.analysis].filter(Boolean).join(' '),
  );
  for (const [label, subject, patterns] of TOPIC_SIGNAL_SOURCE) {
    if (
      subject === primarySubject &&
      patterns.some((pattern) => semanticText.includes(normalizeLabel(pattern)))
    ) {
      add(label, 'question_semantic');
    }
  }
  const byKey = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const current = byKey.get(candidate.normalizedLabel);
    if (!current || candidate.priority < current.priority)
      byKey.set(candidate.normalizedLabel, candidate);
  }
  return deepFreezeModelValue(
    [...byKey.values()]
      .sort(
        (left, right) =>
          left.priority - right.priority ||
          compareText(left.normalizedLabel, right.normalizedLabel) ||
          compareText(left.label, right.label),
      )
      .slice(0, MAX_TOPIC_CANDIDATES)
      .map((candidate, topicIndex) => ({
        topicIndex,
        label: candidate.label,
        normalizedLabel: candidate.normalizedLabel,
        subject: candidate.subject,
        source: candidate.source,
      })),
  );
}

function compactProjectedQuestion(
  question: z.infer<typeof SOURCE_SCHEMA>['questions'][number],
): WrongQuestionOrganizerV5ShortlistAuthority['questions'][number]['projected'] {
  return {
    ...(question.category ? { category: truncateUnicodeScalars(question.category, 96) } : {}),
    ...(question.knowledgePoints?.length
      ? {
          knowledgePoints: question.knowledgePoints.map((value) =>
            truncateUnicodeScalars(value, 96),
          ),
        }
      : {}),
    ...(question.errorType ? { errorType: truncateUnicodeScalars(question.errorType, 96) } : {}),
    ...(question.questionText
      ? {
          questionExcerpt: truncateUnicodeScalars(
            question.questionText,
            MAX_PROJECTED_TEXT_SCALARS,
          ),
        }
      : {}),
    ...(question.analysis
      ? { analysisExcerpt: truncateUnicodeScalars(question.analysis, MAX_PROJECTED_TEXT_SCALARS) }
      : {}),
  };
}

function resolveStructuredSubject(
  value: string | null | undefined,
): WrongQuestionOrganizerV5Subject | null {
  const normalized = normalizeLabel(value ?? '');
  const exact: Readonly<Record<string, WrongQuestionOrganizerV5Subject>> = {
    math: 'math',
    maths: 'math',
    mathematics: 'math',
    数学: 'math',
    english: 'english',
    英语: 'english',
    politics: 'politics',
    政治: 'politics',
    computer: 'computer',
    cs: 'computer',
    计算机: 'computer',
    major: 'major',
    'major course': 'major',
    专业课: 'major',
    other: 'other',
    其他: 'other',
  };
  return exact[normalized] ?? null;
}

function isSafeTopicLabel(value: string) {
  const scalars = Array.from(value.trim());
  const normalized = normalizeLabel(value);
  return (
    scalars.length >= WRONG_QUESTION_ORGANIZER_DECISION_POLICY.topicLabel.minUnicodeScalars &&
    scalars.length <= WRONG_QUESTION_ORGANIZER_DECISION_POLICY.topicLabel.maxUnicodeScalars &&
    !WRONG_QUESTION_ORGANIZER_DECISION_POLICY.topicLabel.forbiddenGenericLabels.some(
      (label) => normalizeLabel(label) === normalized,
    )
  );
}

function topicSourcePriority(source: WrongQuestionOrganizerV5TopicSource) {
  if (source === 'knowledge_point') return 0;
  if (source === 'category') return 1;
  if (source === 'error_type') return 2;
  return 3;
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort(compareText);
}

function sha256Canonical(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

function compareText(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
