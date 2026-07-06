import type { KnowledgeSearchHit } from '@repo/types/api/knowledge';

export type RagEvalSafetyExpectation =
  | 'safe-only'
  | 'allows-suspicious'
  | 'no-high-risk';

export type RagEvalCase = {
  id: string;
  name: string;
  query: string;
  topK: number;
  shouldHaveHit: boolean;
  expectedDocumentIds?: string[];
  expectedChunkIds?: string[];
  expectedContentIncludes?: string[];
  forbiddenContentIncludes?: string[];
  minTopScore?: number;
  safetyExpectation?: RagEvalSafetyExpectation;
};

export type RagEvalHit = Pick<
  KnowledgeSearchHit,
  'chunkId' | 'documentId' | 'documentName' | 'content' | 'score' | 'metadata'
>;

export type RagEvalCaseResult = {
  caseId: string;
  name: string;
  passed: boolean;
  hitCount: number;
  topHitMatched: boolean;
  expectedHitFound: boolean;
  forbiddenHitFound: boolean;
  safetyPassed: boolean;
  noHitPassed: boolean;
  reasons: string[];
};

export type RagEvalSummary = {
  total: number;
  passed: number;
  failed: number;
  recallAtK: number;
  top1Accuracy: number;
  safetyPassRate: number;
  noHitPassRate: number;
  results: RagEvalCaseResult[];
};

export type RagEvalRunInput = {
  cases: RagEvalCase[];
  hitsByCaseId: Record<string, RagEvalHit[]>;
};
