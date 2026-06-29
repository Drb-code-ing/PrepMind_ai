import type {
  KnowledgeOrganizerCollection,
  KnowledgeOrganizerResult,
  KnowledgeOrganizerTag,
} from '@repo/types/api/knowledge-agent';

import type { KnowledgeAgentDocumentInput } from './knowledge-dedup.ts';

export type KnowledgeOrganizerInput = {
  now: string;
  documents: readonly KnowledgeAgentDocumentInput[];
};

type SubjectKey = 'math' | 'english' | 'politics' | 'computer' | 'major' | 'other';

const SUBJECT_LABELS: Record<SubjectKey, string> = {
  math: '数学',
  english: '英语',
  politics: '政治',
  computer: '计算机',
  major: '专业课',
  other: '其它',
};

export function organizeKnowledgeDocuments(
  input: KnowledgeOrganizerInput,
): KnowledgeOrganizerResult {
  if (input.documents.length === 0) {
    return {
      summary: '当前没有可整理的资料。',
      collections: [],
      tags: [],
      signals: ['insufficientSignal'],
    };
  }

  const tags = input.documents.flatMap((document) => buildTags(document));
  const collections = buildCollections(input.documents, tags);
  const signals = new Set<string>();

  if (collections.length > 0) signals.add('topicCluster');
  if (tags.length > 0) signals.add('documentTags');
  if (signals.size === 0) signals.add('insufficientSignal');

  return {
    summary:
      collections.length > 0
        ? `建议整理为 ${collections.length} 个资料集合。`
        : '当前资料更适合先保留为单份资料标签。',
    collections,
    tags,
    signals: [...signals],
  };
}

function buildTags(document: KnowledgeAgentDocumentInput): KnowledgeOrganizerTag[] {
  const subject = inferSubject(document);
  const resourceType = inferResourceType(document);
  const labels = [
    subject ? SUBJECT_LABELS[subject] : '',
    resourceType ?? '',
  ].filter(Boolean);

  if (labels.length === 0) return [];

  return [
    {
      documentId: document.id,
      labels,
      reason: '根据资料名称和片段摘要识别出整理标签。',
      confidence: document.status === 'DONE' ? 0.8 : 0.62,
    },
  ];
}

function buildCollections(
  documents: readonly KnowledgeAgentDocumentInput[],
  tags: readonly KnowledgeOrganizerTag[],
): KnowledgeOrganizerCollection[] {
  const bySubject = new Map<string, string[]>();

  for (const tag of tags) {
    const subject = tag.labels.find((label) =>
      Object.values(SUBJECT_LABELS).includes(label),
    );
    if (!subject || subject === SUBJECT_LABELS.other) continue;

    const ids = bySubject.get(subject) ?? [];
    ids.push(tag.documentId);
    bySubject.set(subject, ids);
  }

  return [...bySubject.entries()]
    .filter(([, documentIds]) => documentIds.length >= 2)
    .map(([subject, documentIds]) => ({
      name: `${subject}资料`,
      description: `${subject}相关讲义、笔记和练习资料。`,
      documentIds: documents
        .filter((document) => documentIds.includes(document.id))
        .map((document) => document.id),
      reason: `至少 ${documentIds.length} 份资料都识别为${subject}主题。`,
      confidence: 0.82,
      signals: [`subject:${subject}`],
    }));
}

function inferSubject(document: KnowledgeAgentDocumentInput): SubjectKey | null {
  const text = documentText(document);
  if (/数学|高数|考研数学|导数|极限|线性代数/.test(text)) return 'math';
  if (/英语|english|reading|阅读|词汇|四级|六级/.test(text)) return 'english';
  if (/政治|马原|毛概|思修/.test(text)) return 'politics';
  if (/计算机|computer|数据结构|操作系统|网络/.test(text)) return 'computer';
  if (/专业课/.test(text)) return 'major';
  return null;
}

function inferResourceType(document: KnowledgeAgentDocumentInput) {
  const text = documentText(document);
  if (/讲义|lecture|handout/.test(text)) return '讲义';
  if (/笔记|note|notes/.test(text)) return '笔记';
  if (/真题|past paper|exam/.test(text)) return '真题';
  if (/错题/.test(text)) return '错题';
  if (/练习|习题|practice/.test(text)) return '练习';
  return null;
}

function documentText(document: KnowledgeAgentDocumentInput) {
  return [document.name, ...document.chunkSummaries]
    .join(' ')
    .normalize('NFKC')
    .toLowerCase();
}

export const knowledgeOrganizerNode = organizeKnowledgeDocuments;
