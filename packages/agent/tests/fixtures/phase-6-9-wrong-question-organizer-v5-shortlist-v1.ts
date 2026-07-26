import { createHash } from 'node:crypto';

import type {
  WrongQuestionOrganizerV5ShortlistSource,
  WrongQuestionOrganizerV5Subject,
} from '../../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';

export const PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURE_VERSION =
  'phase-6.9.7-organizer-v5-shortlist-held-out-v1' as const;

export type OrganizerV5ShortlistFixture = Readonly<{
  id: string;
  language: 'zh' | 'en' | 'mixed';
  category: 'topic' | 'taxonomy' | 'locked' | 'dedupe' | 'batch';
  variant: 'canonical' | 'reordered';
  source: WrongQuestionOrganizerV5ShortlistSource;
  expected: readonly Readonly<{
    questionId: string;
    subject: WrongQuestionOrganizerV5Subject;
    topicLabel?: string;
    deckName?: string;
  }>[];
}>;

type BaseFixture = Omit<OrganizerV5ShortlistFixture, 'id' | 'variant'> & Readonly<{ slug: string }>;

const OWNER = `hmac-sha256:${'b'.repeat(64)}`;

const BASES: readonly BaseFixture[] = [
  base(
    'math-limit',
    'zh',
    'topic',
    [
      question('q-math-limit', {
        subject: '数学',
        knowledgePoints: ['函数极限', '等价无穷小'],
        questionText: '用等价无穷小处理这个极限。',
      }),
    ],
    [],
    [{ questionId: 'q-math-limit', subject: 'math', topicLabel: '函数极限' }],
  ),
  base(
    'english-reading',
    'en',
    'taxonomy',
    [
      question('q-english-reading', {
        questionText:
          'Use the paragraph context for a reading inference about the author attitude.',
      }),
    ],
    [],
    [{ questionId: 'q-english-reading', subject: 'english', topicLabel: '阅读推断' }],
  ),
  base(
    'politics-history',
    'zh',
    'taxonomy',
    [
      question('q-politics-history', {
        questionText: '分析社会存在与社会意识的关系，属于历史唯物主义。',
      }),
    ],
    [],
    [{ questionId: 'q-politics-history', subject: 'politics', topicLabel: '历史唯物主义' }],
  ),
  base(
    'computer-schedule',
    'en',
    'taxonomy',
    [
      question('q-computer-schedule', {
        questionText: 'Compare round-robin with priority CPU scheduling in an operating system.',
      }),
    ],
    [],
    [{ questionId: 'q-computer-schedule', subject: 'computer', topicLabel: '操作系统调度' }],
  ),
  base(
    'major-control',
    'mixed',
    'taxonomy',
    [
      question('q-major-control', {
        questionText: '用 root locus 判断 control system stability 与闭环极点。',
      }),
    ],
    [],
    [{ questionId: 'q-major-control', subject: 'major', topicLabel: '控制系统稳定性' }],
  ),
  base(
    'other-painting',
    'en',
    'taxonomy',
    [
      question('q-other-painting', {
        questionText: 'Compare the painting styles of two historical periods in art history.',
      }),
    ],
    [],
    [{ questionId: 'q-other-painting', subject: 'other', topicLabel: '艺术史' }],
  ),
  base(
    'locked-signal-deck',
    'mixed',
    'locked',
    [
      question('q-locked-signal', {
        subject: '专业课',
        questionText: '用 Fourier transform 分析信号频谱。',
      }),
    ],
    [deck('deck-locked-signal', '专业课', '信号与系统', ['傅里叶', '频谱'], true)],
    [{ questionId: 'q-locked-signal', subject: 'major', deckName: '信号与系统' }],
  ),
  base(
    'duplicate-math-deck',
    'zh',
    'dedupe',
    [
      question('q-duplicate-limit', {
        subject: '数学',
        knowledgePoints: ['函数极限'],
        questionText: '极限变形。',
      }),
    ],
    [
      deck('deck-limit-b', '数学', '函数极限', ['极限', '无穷小']),
      deck('deck-limit-a', '数学', '函数极限', ['无穷小', '极限']),
    ],
    [{ questionId: 'q-duplicate-limit', subject: 'math', deckName: '函数极限' }],
  ),
  base(
    'same-subject-batch',
    'zh',
    'batch',
    [
      question('q-batch-integral', {
        subject: '数学',
        knowledgePoints: ['定积分面积'],
        questionText: '用定积分计算面积。',
      }),
      question('q-batch-derivative', {
        subject: '数学',
        knowledgePoints: ['导数应用'],
        questionText: '判断切线斜率。',
      }),
    ],
    [],
    [
      { questionId: 'q-batch-derivative', subject: 'math', topicLabel: '导数应用' },
      { questionId: 'q-batch-integral', subject: 'math', topicLabel: '定积分面积' },
    ],
  ),
  base(
    'cross-subject-batch',
    'mixed',
    'batch',
    [
      question('q-cross-translation', {
        questionText: 'Adjust the translation order for this long sentence.',
      }),
      question('q-cross-database', {
        questionText: 'Explain how a B+ tree supports a database index.',
      }),
      question('q-cross-mechanics', {
        questionText: '工程力学中的受力分析与平衡方程。',
      }),
    ],
    [],
    [
      { questionId: 'q-cross-database', subject: 'computer', topicLabel: '数据库索引' },
      { questionId: 'q-cross-mechanics', subject: 'major', topicLabel: '工程力学' },
      { questionId: 'q-cross-translation', subject: 'english', topicLabel: '翻译语序' },
    ],
  ),
  base(
    'computer-category',
    'en',
    'topic',
    [
      question('q-computer-category', {
        subject: 'computer',
        category: '数据库索引',
        questionText: 'Choose the correct index for this query.',
      }),
    ],
    [],
    [{ questionId: 'q-computer-category', subject: 'computer', topicLabel: '数据库索引' }],
  ),
  base(
    'math-error-type',
    'mixed',
    'topic',
    [
      question('q-math-error', {
        subject: 'math',
        errorType: '概率分布',
        questionText: 'I selected the wrong distribution for this random variable.',
      }),
    ],
    [],
    [{ questionId: 'q-math-error', subject: 'math', topicLabel: '概率分布' }],
  ),
];

export const PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES: readonly OrganizerV5ShortlistFixture[] =
  deepFreeze(
    BASES.flatMap((entry) => [materialize(entry, 'canonical'), materialize(entry, 'reordered')]),
  );

export function computeOrganizerV5ShortlistFixtureSha256(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

export const PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURE_SHA256 =
  computeOrganizerV5ShortlistFixtureSha256(PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES);
export const PHASE_6_9_7_ORGANIZER_V5_FROZEN_SHORTLIST_FIXTURE_SHA256 =
  '49336b123cb56741b3aab0fb23c2e9341e938a3f1b4c4e4f48774a94365ee097' as const;

if (
  PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURE_SHA256 !==
  PHASE_6_9_7_ORGANIZER_V5_FROZEN_SHORTLIST_FIXTURE_SHA256
) {
  throw new Error('PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURE_SHA_MISMATCH');
}

function base(
  slug: string,
  language: BaseFixture['language'],
  category: BaseFixture['category'],
  questions: WrongQuestionOrganizerV5ShortlistSource['questions'],
  decks: WrongQuestionOrganizerV5ShortlistSource['decks'],
  expected: BaseFixture['expected'],
): BaseFixture {
  return {
    slug,
    language,
    category,
    source: source(slug, questions, decks),
    expected,
  };
}

function source(
  slug: string,
  questions: WrongQuestionOrganizerV5ShortlistSource['questions'],
  decks: WrongQuestionOrganizerV5ShortlistSource['decks'],
): WrongQuestionOrganizerV5ShortlistSource {
  const fingerprintSeed = createHash('sha256').update(`fixture:${slug}`).digest('hex');
  return {
    ownerDomain: OWNER,
    ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
    ownerSnapshotFingerprint: `sha256:${fingerprintSeed}`,
    safety: 'safe_for_model',
    questions,
    decks,
  };
}

function question(
  id: string,
  value: Omit<WrongQuestionOrganizerV5ShortlistSource['questions'][number], 'id'>,
): WrongQuestionOrganizerV5ShortlistSource['questions'][number] {
  return {
    id,
    ...value,
    status: 'UNRESOLVED',
    updatedAt: '2026-07-26T08:00:00.000Z',
  };
}

function deck(
  id: string,
  subject: string,
  name: string,
  keywords: readonly string[],
  nameLocked = false,
): WrongQuestionOrganizerV5ShortlistSource['decks'][number] {
  return {
    id,
    subject,
    name,
    keywords,
    nameLocked,
    updatedAt: '2026-07-26T08:00:00.000Z',
  };
}

function materialize(
  entry: BaseFixture,
  variant: OrganizerV5ShortlistFixture['variant'],
): OrganizerV5ShortlistFixture {
  const sourceValue =
    variant === 'canonical'
      ? entry.source
      : {
          ...entry.source,
          questions: [...entry.source.questions].reverse().map((question) => ({
            ...question,
            ...(question.knowledgePoints
              ? { knowledgePoints: [...question.knowledgePoints].reverse() }
              : {}),
          })),
          decks: [...entry.source.decks].reverse().map((value) => ({
            ...value,
            ...(value.keywords ? { keywords: [...value.keywords].reverse() } : {}),
          })),
        };
  return {
    id: `organizer-v5-held-out-${entry.slug}-${variant}`,
    language: entry.language,
    category: entry.category,
    variant,
    source: sourceValue,
    expected: entry.expected,
  };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}
