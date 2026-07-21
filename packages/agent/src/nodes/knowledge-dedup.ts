import type {
  KnowledgeDedupItem,
  KnowledgeDedupResult,
} from '@repo/types/api/knowledge-agent';

export type KnowledgeAgentDocumentInput = {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'MD' | 'TXT';
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  sourceType: 'UPLOAD' | 'NOTE' | 'WRONG_QUESTION' | 'OCR' | 'CHAT';
  contentHash: string | null;
  chunkCount: number;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  chunkSummaries: readonly string[];
};

export type KnowledgeDedupInput = {
  now: string;
  targetDocumentId?: string;
  documents: readonly KnowledgeAgentDocumentInput[];
};

export const MAX_KNOWLEDGE_DEDUP_SUGGESTIONS = 5;

export function analyzeKnowledgeDedup(input: KnowledgeDedupInput): KnowledgeDedupResult {
  const orderedDocuments = orderDocuments(input.documents, input.targetDocumentId);
  const targetDocumentId = input.targetDocumentId;
  const items: KnowledgeDedupItem[] = [];
  const signals = new Set<string>();

  addExactDuplicateSuggestions(orderedDocuments, items, signals, targetDocumentId);
  addRevisionSuggestions(orderedDocuments, items, signals, targetDocumentId);
  addComplementarySuggestions(orderedDocuments, items, signals, targetDocumentId);

  const uniqueItems = dedupeItems(items).slice(0, MAX_KNOWLEDGE_DEDUP_SUGGESTIONS);
  if (uniqueItems.length === 0) {
    signals.add('insufficientSignal');
    return {
      summary: '当前资料信号不足，暂时没有发现明确的重复、版本或互补关系。',
      items: [
        {
          kind: 'insufficient_signal',
          severity: 'info',
          documentIds: orderedDocuments[0] ? [orderedDocuments[0].id] : ['none'],
          title: '资料关系信号不足',
          reason: '资料数量、处理状态或内容摘要不足，暂时只能人工判断。',
          recommendation: 'review_manually',
          confidence: 0.35,
          signals: ['insufficientSignal'],
        },
      ],
      signals: [...signals],
    };
  }

  return {
    summary: `发现 ${uniqueItems.length} 条资料关系建议。`,
    items: uniqueItems,
    signals: [...signals],
  };
}

function addExactDuplicateSuggestions(
  documents: readonly KnowledgeAgentDocumentInput[],
  items: KnowledgeDedupItem[],
  signals: Set<string>,
  targetDocumentId?: string,
) {
  const byHash = new Map<string, KnowledgeAgentDocumentInput[]>();
  for (const document of documents) {
    if (!document.contentHash) continue;
    const existing = byHash.get(document.contentHash) ?? [];
    existing.push(document);
    byHash.set(document.contentHash, existing);
  }

  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    if (targetDocumentId && !group.some((document) => document.id === targetDocumentId)) {
      continue;
    }

    signals.add('exactDuplicate');
    items.push({
      kind: 'exact_duplicate',
      severity: 'warning',
      documentIds: group.map((document) => document.id),
      title: '发现完全重复资料',
      reason: '这些资料的内容 hash 相同，通常说明是同一份文件。',
      recommendation: 'use_existing',
      confidence: 0.96,
      signals: ['contentHash'],
    });
  }
}

function addRevisionSuggestions(
  documents: readonly KnowledgeAgentDocumentInput[],
  items: KnowledgeDedupItem[],
  signals: Set<string>,
  targetDocumentId?: string,
) {
  for (let index = 0; index < documents.length; index += 1) {
    for (let next = index + 1; next < documents.length; next += 1) {
      const left = documents[index];
      const right = documents[next];
      if (!left || !right || left.type !== right.type) continue;
      if (!pairIncludesTarget(left, right, targetDocumentId)) continue;
      if (left.contentHash && right.contentHash && left.contentHash === right.contentHash) {
        continue;
      }

      if (!filenameRevisionMatch(left.name, right.name)) continue;

      signals.add('revisionCandidate');
      items.push({
        kind: 'possible_revision',
        severity: 'warning',
        documentIds: [left.id, right.id],
        title: '疑似同一资料的不同版本',
        reason: '文件名高度相似，但内容 hash 不同，可能是旧版和新版。',
        recommendation: 'review_manually',
        confidence: 0.78,
        signals: ['filenameOverlap', 'differentContentHash'],
      });
    }
  }
}

function addComplementarySuggestions(
  documents: readonly KnowledgeAgentDocumentInput[],
  items: KnowledgeDedupItem[],
  signals: Set<string>,
  targetDocumentId?: string,
) {
  for (let index = 0; index < documents.length; index += 1) {
    for (let next = index + 1; next < documents.length; next += 1) {
      const left = documents[index];
      const right = documents[next];
      if (!left || !right) continue;
      if (!pairIncludesTarget(left, right, targetDocumentId)) continue;
      if (left.contentHash && right.contentHash && left.contentHash === right.contentHash) {
        continue;
      }
      if (filenameRevisionMatch(left.name, right.name)) continue;

      const overlap = topicOverlap(topicTokens(left), topicTokens(right));
      if (overlap.length === 0) continue;

      signals.add('complementaryMaterial');
      items.push({
        kind: 'complementary',
        severity: 'info',
        documentIds: [left.id, right.id],
        title: '同主题互补资料',
        reason: `这些资料都提到了「${overlap[0]}」，但文件名不像同一版本，适合一起保留。`,
        recommendation: 'keep_both',
        confidence: 0.7,
        signals: ['topicOverlap'],
      });
    }
  }
}

function orderDocuments(
  documents: readonly KnowledgeAgentDocumentInput[],
  targetDocumentId?: string,
) {
  if (!targetDocumentId) return [...documents];

  return [...documents].sort((left, right) => {
    if (left.id === targetDocumentId) return -1;
    if (right.id === targetDocumentId) return 1;
    return 0;
  });
}

function filenameRevisionMatch(left: string, right: string) {
  const normalizedLeft = normalizeFilename(left);
  const normalizedRight = normalizeFilename(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

export function hasKnowledgeRevisionSignal(
  left: KnowledgeAgentDocumentInput,
  right: KnowledgeAgentDocumentInput,
): boolean {
  const leftVersion = extractVersionSignal(left.name);
  const rightVersion = extractVersionSignal(right.name);
  if (leftVersion !== null || rightVersion !== null) {
    return leftVersion !== rightVersion;
  }

  const leftTimestamp = Date.parse(left.updatedAt);
  const rightTimestamp = Date.parse(right.updatedAt);
  return (
    Number.isFinite(leftTimestamp) &&
    Number.isFinite(rightTimestamp) &&
    leftTimestamp !== rightTimestamp
  );
}

function extractVersionSignal(value: string): string | null {
  const match = value
    .normalize('NFKC')
    .toLowerCase()
    .match(/(?:\bv(?:ersion)?\s*|版本\s*)(\d+(?:\.\d+)*)|(?:新版|旧版)/u);
  return match?.[1] ?? match?.[0] ?? null;
}

function pairIncludesTarget(
  left: KnowledgeAgentDocumentInput,
  right: KnowledgeAgentDocumentInput,
  targetDocumentId?: string,
) {
  return !targetDocumentId || left.id === targetDocumentId || right.id === targetDocumentId;
}

function normalizeFilename(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/copy|副本|新版|旧版/gi, '')
    .replace(/[-_\s]*(v|version|版本)\s*\d+(\.\d+)?/gi, '')
    .replace(/[()\[\]（）【】\-_\s]/g, '');
}

function topicTokens(document: KnowledgeAgentDocumentInput) {
  const text = [document.name, ...document.chunkSummaries].join(' ');
  return new Set(extractTopicTokens(text));
}

function extractTopicTokens(text: string) {
  const normalized = text.normalize('NFKC').toLowerCase();
  const tokens: string[] = [];
  const dictionary = [
    '数学',
    '高数',
    '考研数学',
    '极限',
    '导数',
    '英语',
    '阅读',
    '政治',
    '计算机',
    '线性代数',
  ];

  for (const token of dictionary) {
    if (normalized.includes(token.toLowerCase())) {
      tokens.push(token === '高数' || token === '考研数学' ? '数学' : token);
    }
  }

  return [...new Set(tokens)];
}

function topicOverlap(left: Set<string>, right: Set<string>) {
  return [...left].filter((token) => right.has(token));
}

function dedupeItems(items: KnowledgeDedupItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${[...item.documentIds].sort().join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const knowledgeDedupNode = analyzeKnowledgeDedup;
