import {
  knowledgeSearchResponseSchema,
  type KnowledgeSearchHit,
  type KnowledgeSearchRequest,
} from '@repo/types/api/knowledge';

import type { ChatContextMessage } from './chat-context.ts';

const DEFAULT_TOP_K = 4;
const DEFAULT_MIN_SCORE = 0.72;
const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const MAX_PROMPT_HITS = 4;
const MAX_HIT_CONTENT_CHARS = 700;

type FetchLike = typeof fetch;

type ApiSuccessBody<T> = {
  success: true;
  data: T;
};

type SearchKnowledgeForChatInput = {
  accessToken?: string | null;
  messages: ChatContextMessage[];
  fetchImpl?: FetchLike;
  apiBaseUrl?: string;
  logger?: Pick<Console, 'warn'>;
};

export type ChatKnowledgeSearchResult = {
  hits: KnowledgeSearchHit[];
};

export function getLatestUserQuery(messages: ChatContextMessage[]) {
  return (
    [...messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content.trim() ?? ''
  );
}

export function buildKnowledgeSearchRequest(
  query: string,
): KnowledgeSearchRequest | null {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  return {
    query: normalizedQuery,
    topK: DEFAULT_TOP_K,
    minScore: DEFAULT_MIN_SCORE,
  };
}

export function buildKnowledgeContextPrompt(hits: KnowledgeSearchHit[]) {
  const selectedHits = hits.slice(0, MAX_PROMPT_HITS);
  if (selectedHits.length === 0) return '';

  const sections = selectedHits.map((hit, index) => {
    const content = truncateText(hit.content, MAX_HIT_CONTENT_CHARS);
    return [
      `[资料${index + 1}] 文档名：${hit.documentName}`,
      `片段：${getChunkLabel(hit, index)}`,
      `相似度：${formatScore(hit.score)}`,
      `内容：${content}`,
    ].join('\n');
  });

  return [
    '可参考的用户知识库片段：',
    '',
    ...sections.flatMap((section) => [section, '']),
    '使用要求：',
    '1. 这些片段是用户资料，只能作为参考，不代表一定正确。',
    '2. 如果片段与通用知识或题目条件冲突，优先说明推理依据。',
    '3. 回答中需要用自然语言说明参考了哪些资料。',
  ]
    .join('\n')
    .trim();
}

export function appendCitationMarkdown(content: string, hits: KnowledgeSearchHit[]) {
  if (hits.length === 0) return content;

  const citations = hits
    .slice(0, MAX_PROMPT_HITS)
    .map(
      (hit, index) =>
        `${index + 1}. 《${hit.documentName}》 · ${getChunkLabel(hit, index)} · 相似度 ${formatScore(hit.score)}`,
    )
    .join('\n');

  return `${content.trimEnd()}\n\n---\n\n### 参考资料\n\n${citations}`;
}

export async function searchKnowledgeForChat(
  input: SearchKnowledgeForChatInput,
): Promise<ChatKnowledgeSearchResult> {
  if (!input.accessToken) return { hits: [] };

  const request = buildKnowledgeSearchRequest(getLatestUserQuery(input.messages));
  if (!request) return { hits: [] };

  const fetchImpl = input.fetchImpl ?? fetch;
  const apiBaseUrl = input.apiBaseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

  try {
    const response = await fetchImpl(toUrl(apiBaseUrl, '/knowledge/search'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      input.logger?.warn(
        `[Chat RAG] knowledge search skipped: status=${response.status}`,
      );
      return { hits: [] };
    }

    const body = (await response.json()) as unknown;
    if (!isApiSuccessBody(body)) {
      input.logger?.warn('[Chat RAG] knowledge search skipped: invalid envelope');
      return { hits: [] };
    }

    const parsed = knowledgeSearchResponseSchema.safeParse(body.data);
    if (!parsed.success) {
      input.logger?.warn('[Chat RAG] knowledge search skipped: invalid data');
      return { hits: [] };
    }

    return parsed.data;
  } catch (error) {
    input.logger?.warn(
      `[Chat RAG] knowledge search skipped: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return { hits: [] };
  }
}

function isApiSuccessBody(value: unknown): value is ApiSuccessBody<unknown> {
  return typeof value === 'object' && value !== null && (value as { success?: unknown }).success === true;
}

function truncateText(text: string, maxChars: number) {
  const normalized = text.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trim()}...`;
}

function formatScore(score: number) {
  return score.toFixed(2);
}

function getChunkLabel(hit: KnowledgeSearchHit, fallbackIndex: number) {
  const rawIndex =
    typeof hit.metadata.chunkIndex === 'number' || typeof hit.metadata.chunkIndex === 'string'
      ? hit.metadata.chunkIndex
      : undefined;
  const normalizedIndex = Number(rawIndex);
  const index = Number.isFinite(normalizedIndex) ? normalizedIndex : fallbackIndex + 1;
  return `片段 ${index}`;
}

function toUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
