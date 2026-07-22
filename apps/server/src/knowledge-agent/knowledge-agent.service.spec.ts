import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  runKnowledgeDedupModelCandidate,
  runKnowledgeOrganizerModelCandidate,
  type ModelCandidateObservation,
} from '@repo/agent/model-candidates';

import { AgentTracesService } from '../agent-traces/agent-traces.service';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { KnowledgeAgentService } from './knowledge-agent.service';
import type { KnowledgeModelRuntimeBundle } from './knowledge-model-runtime.factory';
import { KnowledgeOwnerSnapshotSource } from './knowledge-owner-snapshot';
import type { KnowledgeSemanticCandidateSource } from './knowledge-semantic-candidate.source';

jest.mock('@repo/agent/model-candidates', () => {
  const actual = jest.requireActual<
    typeof import('@repo/agent/model-candidates')
  >('@repo/agent/model-candidates');
  return {
    ...actual,
    runKnowledgeDedupModelCandidate: jest.fn(),
    runKnowledgeOrganizerModelCandidate: jest.fn(),
  };
});

describe('KnowledgeAgentService', () => {
  const now = new Date('2026-07-21T08:00:00.000Z');
  const events: string[] = [];
  const tx = {
    $executeRawUnsafe: jest.fn(),
    document: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    chunk: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    document: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    chunk: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const config = {
    get: jest.fn((key: keyof ServerEnv) =>
      key === 'JWT_SECRET'
        ? 'test-jwt-secret-with-domain-separation'
        : undefined,
    ),
  };
  const agentTracesService = {
    createTrace: jest.fn(),
  };
  const dedupCandidate = jest.mocked(runKnowledgeDedupModelCandidate);
  const organizerCandidate = jest.mocked(runKnowledgeOrganizerModelCandidate);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    events.length = 0;

    config.get.mockImplementation((key: keyof ServerEnv) =>
      key === 'JWT_SECRET'
        ? 'test-jwt-secret-with-domain-separation'
        : undefined,
    );
    agentTracesService.createTrace.mockResolvedValue({ run: {}, steps: [] });
    dedupCandidate.mockResolvedValue(dedupEnvelope());
    organizerCandidate.mockResolvedValue(organizerEnvelope());

    tx.$executeRawUnsafe.mockImplementation(() => {
      events.push('tx:read-only');
      return Promise.resolve(0);
    });
    tx.document.findFirst.mockImplementation(() => {
      events.push('tx:target');
      return Promise.resolve(null);
    });
    tx.document.findMany.mockImplementation(() => {
      events.push('tx:documents');
      return Promise.resolve(defaultRows());
    });
    prisma.document.findMany.mockImplementation(() => {
      events.push('revalidate:documents');
      return Promise.resolve(defaultRows());
    });
    tx.chunk.findMany.mockImplementation(() => {
      events.push('tx:chunks');
      return Promise.resolve(
        defaultRows().flatMap((document) => document.chunks),
      );
    });
    prisma.chunk.findMany.mockImplementation(() => {
      events.push('revalidate:chunks');
      return Promise.resolve(
        defaultRows().flatMap((document) => document.chunks),
      );
    });
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => {
        events.push('transaction:start');
        const result = await callback(tx);
        events.push('transaction:end');
        return result;
      },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService(
    options: {
      dedupEnabled?: boolean;
      organizerEnabled?: boolean;
    } = {},
  ) {
    const semanticSource = {
      load: jest.fn(
        (
          _transaction: unknown,
          scope: { documents: readonly { id: string }[] },
        ) =>
          Promise.resolve({
            version: 'knowledge-semantic-shortlist-v1' as const,
            selectedChunks: scope.documents.map((document) => ({
              id: `${document.id}-chunk-1`,
              documentId: document.id,
              index: 0,
            })),
            pairs:
              scope.documents.length >= 2
                ? [
                    {
                      leftDocumentId: scope.documents[0].id,
                      rightDocumentId: scope.documents[1].id,
                      score: 0.84,
                      evidenceBand: 'candidate' as const,
                    },
                  ]
                : [],
          }),
      ),
    } as unknown as KnowledgeSemanticCandidateSource;
    const runtimes = {
      config: {
        dedupEnabled: options.dedupEnabled ?? false,
        organizerEnabled: options.organizerEnabled ?? false,
        dedupTimeoutMs: 4500,
        organizerTimeoutMs: 4500,
        mode:
          options.dedupEnabled || options.organizerEnabled ? 'live' : 'mock',
        provider:
          options.dedupEnabled || options.organizerEnabled
            ? 'deepseek'
            : 'mock',
        model: 'deepseek-v4-pro',
        promptVersion: 'knowledge-agents-v1',
        pricingKnown: true,
      },
      dedupRuntime: { invokeStructured: jest.fn() },
      organizerRuntime: { invokeStructured: jest.fn() },
    } as unknown as KnowledgeModelRuntimeBundle;
    return new KnowledgeAgentService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<ServerEnv, true>,
      new KnowledgeOwnerSnapshotSource(semanticSource),
      runtimes,
      agentTracesService as unknown as AgentTracesService,
    );
  }

  it('loads all governed facts in one bounded RepeatableRead transaction and revalidates only after it closes', async () => {
    const result = await createService().getSuggestions('user_1', {
      limit: 50,
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 2_000,
      timeout: 5_000,
    });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SET TRANSACTION READ ONLY',
    );
    expect(tx.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_1' },
        take: 20,
      }),
    );
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    expect(events).toEqual([
      'transaction:start',
      'tx:read-only',
      'tx:documents',
      'tx:chunks',
      'transaction:end',
      'revalidate:documents',
      'revalidate:chunks',
    ]);
    expect(result.generatedAt).toBe(now.toISOString());
    expect(result.organizer.collections[0]?.name).toBe('数学资料');
    expect(result.organizer.tags[0]?.labels).toContain('数学');
    expect(
      result.dedup.items.some((item) => item.kind === 'complementary'),
    ).toBe(true);
    expect(result.dedup.runtime).toMatchObject({
      source: 'local_deterministic',
      disposition: 'gate_disabled',
      attempted: false,
      degraded: false,
      traceId: null,
    });
    expect(result.organizer.runtime.disposition).toBe('gate_disabled');
    expect(dedupCandidate).not.toHaveBeenCalled();
    expect(organizerCandidate).not.toHaveBeenCalled();
  });

  it('checks and includes an out-of-window target inside the same transaction without exceeding the limit', async () => {
    const target = createDocument('doc_old', {
      name: '高等数学 导数讲义.pdf',
      contentHash: 'sha256:old',
    });
    const recent = createDocument('doc_recent', {
      name: '高等数学 导数练习.pdf',
      contentHash: 'sha256:recent',
    });
    tx.document.findMany.mockImplementationOnce(() => {
      events.push('tx:documents');
      return Promise.resolve([recent]);
    });
    tx.document.findFirst.mockImplementationOnce(() => {
      events.push('tx:target');
      return Promise.resolve(target);
    });
    prisma.document.findMany.mockImplementationOnce(() => {
      events.push('revalidate:documents');
      return Promise.resolve([target]);
    });
    tx.chunk.findMany.mockResolvedValueOnce(target.chunks);
    prisma.chunk.findMany.mockResolvedValueOnce(target.chunks);

    const result = await createService().getSuggestions('user_1', {
      documentId: 'doc_old',
      limit: 1,
    });

    expect(tx.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc_old', userId: 'user_1' },
      }),
    );
    expect(tx.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    for (const item of result.dedup.items) {
      expect(item.documentIds).toContain('doc_old');
      expect(item.documentIds).not.toContain('doc_recent');
    }
  });

  it('throws the existing 404 from inside the snapshot transaction for a missing or cross-owner target', async () => {
    tx.document.findMany.mockImplementationOnce(() => {
      events.push('tx:documents');
      return Promise.resolve([]);
    });
    tx.document.findFirst.mockImplementationOnce(() => {
      events.push('tx:target');
      return Promise.resolve(null);
    });

    await expect(
      createService().getSuggestions('user_1', {
        documentId: 'doc_other',
        limit: 20,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });

    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    expect(prisma.document.findMany).not.toHaveBeenCalled();
    expect(events).not.toContain('transaction:end');
  });

  it('returns deterministic local advice and performs no writes when preflight detects snapshot drift', async () => {
    prisma.document.findMany.mockImplementationOnce(() => {
      events.push('revalidate:documents');
      return Promise.resolve(
        defaultRows().map((row, index) =>
          index === 0
            ? { ...row, updatedAt: new Date('2026-07-21T09:00:00.000Z') }
            : row,
        ),
      );
    });

    const result = await createService().getSuggestions('user_1', {
      limit: 20,
    });

    expect(result.dedup.summary.length).toBeGreaterThan(0);
    expect(result.organizer.summary.length).toBeGreaterThan(0);
    expect(result.dedup.runtime.disposition).toBe('snapshot_stale');
    expect(result.organizer.runtime.disposition).toBe('snapshot_stale');
    expectNoWrites();
  });

  it('fails closed to deterministic local advice when preflight throws', async () => {
    prisma.document.findMany.mockRejectedValueOnce(new Error('db body secret'));

    const result = await createService().getSuggestions('user_1', {
      limit: 20,
    });

    expect(result.dedup.summary.length).toBeGreaterThan(0);
    expect(result.organizer.summary.length).toBeGreaterThan(0);
    expect(result.dedup.runtime.disposition).toBe('snapshot_stale');
    expect(result.organizer.runtime.disposition).toBe('snapshot_stale');
    expectNoWrites();
  });

  it('starts both eligible candidates before awaiting either one', async () => {
    const started: string[] = [];
    const releases: Array<() => void> = [];
    dedupCandidate.mockImplementation(
      () =>
        new Promise((resolve) => {
          started.push('dedup');
          releases.push(() => resolve(dedupEnvelope()));
        }),
    );
    organizerCandidate.mockImplementation(
      () =>
        new Promise((resolve) => {
          started.push('organizer');
          releases.push(() => resolve(organizerEnvelope()));
        }),
    );

    const pending = createService({
      dedupEnabled: true,
      organizerEnabled: true,
    }).getSuggestions('user_1', { limit: 20 });
    for (let index = 0; index < 20 && started.length < 2; index += 1) {
      await Promise.resolve();
    }

    expect(started).toEqual(['dedup', 'organizer']);
    releases.forEach((release) => release());
    const result = await pending;
    expect(result.dedup.runtime.disposition).toBe('candidate_applied');
    expect(result.organizer.runtime.disposition).toBe('candidate_applied');
    expect(result.dedup.runtime.traceId).toEqual(expect.any(String));
    expect(agentTracesService.createTrace).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['dedup', true, false, 1, 0],
    ['organizer', false, true, 0, 1],
  ] as const)(
    'honors the independent %s gate without invoking the disabled candidate',
    async (
      _name,
      dedupEnabled,
      organizerEnabled,
      dedupCalls,
      organizerCalls,
    ) => {
      const result = await createService({
        dedupEnabled,
        organizerEnabled,
      }).getSuggestions('user_1', { limit: 20 });

      expect(dedupCandidate).toHaveBeenCalledTimes(dedupCalls);
      expect(organizerCandidate).toHaveBeenCalledTimes(organizerCalls);
      expect(result.dedup.runtime.disposition).toBe(
        dedupEnabled ? 'candidate_applied' : 'gate_disabled',
      );
      expect(result.organizer.runtime.disposition).toBe(
        organizerEnabled ? 'candidate_applied' : 'gate_disabled',
      );
    },
  );

  it('passes frozen independent reservations and the target only to Dedup', async () => {
    const abortController = new AbortController();
    await createService({
      dedupEnabled: true,
      organizerEnabled: true,
    }).getSuggestions(
      'user_1',
      { documentId: 'doc_1', limit: 20 },
      abortController.signal,
    );

    const dedupInput = dedupCandidate.mock.calls[0]?.[0];
    const organizerInput = organizerCandidate.mock.calls[0]?.[0];
    expect(dedupInput?.deterministicInput).toMatchObject({
      targetDocumentId: 'doc_1',
    });
    expect(organizerInput?.deterministicInput).not.toHaveProperty(
      'targetDocumentId',
    );
    expect(dedupInput?.budget).toMatchObject({
      maxCalls: 1,
      maxInputTokens: 3000,
      maxOutputTokens: 500,
    });
    expect(organizerInput?.budget).toMatchObject({
      maxCalls: 1,
      maxInputTokens: 3000,
      maxOutputTokens: 700,
    });
    expect(Object.isFrozen(dedupInput?.budget)).toBe(true);
    expect(Object.isFrozen(organizerInput?.budget)).toBe(true);
    expect(dedupInput?.signal).toBe(abortController.signal);
    expect(organizerInput?.signal).toBe(abortController.signal);
  });

  it('discards both candidate values when the post-candidate snapshot fence is stale', async () => {
    prisma.document.findMany
      .mockImplementationOnce(() => Promise.resolve(defaultRows()))
      .mockImplementationOnce(() =>
        Promise.resolve(
          defaultRows().map((row, index) =>
            index === 0
              ? { ...row, updatedAt: new Date('2026-07-21T09:00:00.000Z') }
              : row,
          ),
        ),
      );

    const result = await createService({
      dedupEnabled: true,
      organizerEnabled: true,
    }).getSuggestions('user_1', { limit: 20 });

    expect(result.dedup.runtime.disposition).toBe('snapshot_stale');
    expect(result.organizer.runtime.disposition).toBe('snapshot_stale');
    expect(result.dedup.runtime.degraded).toBe(true);
    expect(result.dedup.signals).not.toContain('modelSemanticDedup');
  });

  it('fails closed to local suggestions when Trace persistence is unavailable', async () => {
    agentTracesService.createTrace.mockRejectedValueOnce(
      new Error('database body secret'),
    );

    const result = await createService({
      dedupEnabled: true,
      organizerEnabled: true,
    }).getSuggestions('user_1', { limit: 20 });

    expect(result.dedup.runtime).toMatchObject({
      source: 'local_deterministic',
      disposition: 'fallback_runtime_error',
      reasonCode: 'trace_unavailable',
      degraded: true,
      traceId: null,
    });
    expect(result.organizer.runtime.disposition).toBe('fallback_runtime_error');
    expect(result.dedup.signals).not.toContain('modelSemanticDedup');
    expectNoWrites();
  });

  it('does not write documents or chunks while generating advice', async () => {
    await createService().getSuggestions('user_1', { limit: 20 });
    expectNoWrites();
  });

  function expectNoWrites() {
    for (const client of [prisma, tx]) {
      expect(client.document.create).not.toHaveBeenCalled();
      expect(client.document.update).not.toHaveBeenCalled();
      expect(client.document.updateMany).not.toHaveBeenCalled();
      expect(client.document.delete).not.toHaveBeenCalled();
      expect(client.document.deleteMany).not.toHaveBeenCalled();
      expect(client.chunk.create).not.toHaveBeenCalled();
      expect(client.chunk.createMany).not.toHaveBeenCalled();
      expect(client.chunk.update).not.toHaveBeenCalled();
      expect(client.chunk.updateMany).not.toHaveBeenCalled();
      expect(client.chunk.delete).not.toHaveBeenCalled();
      expect(client.chunk.deleteMany).not.toHaveBeenCalled();
    }
  }
});

function dedupEnvelope() {
  return {
    value: {
      summary: '模型语义去重建议。',
      items: [],
      signals: ['modelSemanticDedup'],
    },
    observation: candidateObservation('knowledge_dedup', 120, 30, 410),
  };
}

function organizerEnvelope() {
  return {
    value: {
      summary: '模型语义整理建议。',
      collections: [],
      tags: [],
      signals: ['modelSemanticOrganizer'],
    },
    observation: candidateObservation('knowledge_organizer', 180, 40, 520),
  };
}

function candidateObservation(
  task: 'knowledge_dedup' | 'knowledge_organizer',
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
): ModelCandidateObservation<string> {
  return {
    attempted: true,
    disposition: 'candidate_applied',
    budget: {
      maxCalls: 1,
      usedCalls: 1,
      maxInputTokens: 3000,
      usedInputTokens: 3000,
      maxOutputTokens: task === 'knowledge_dedup' ? 500 : 700,
      usedOutputTokens: task === 'knowledge_dedup' ? 500 : 700,
    },
    usage: { inputTokens, outputTokens },
    reasonCodes: ['candidate_applied', 'semantic_match'],
    trace: {
      runIdHash: `sha256:${'a'.repeat(64)}`,
      task,
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      status: 'succeeded',
      inputTokens,
      outputTokens,
      maxOutputTokens: task === 'knowledge_dedup' ? 500 : 700,
      durationMs,
      degraded: false,
    },
  };
}

function defaultRows() {
  return [
    createDocument('doc_1', {
      name: '高等数学 导数讲义.pdf',
      contentHash: 'sha256:a',
      chunks: [
        createChunk('doc_1-chunk-1', 'doc_1', {
          content: '导数 极限 函数'.repeat(30),
        }),
      ],
      chunkCount: 5,
    }),
    createDocument('doc_2', {
      name: '高等数学 导数练习.pdf',
      contentHash: 'sha256:b',
      chunks: [
        createChunk('doc_2-chunk-1', 'doc_2', { content: '导数应用题' }),
      ],
      chunkCount: 1,
    }),
  ];
}

function createDocument(
  id: string,
  overrides: Partial<DocumentRecord> & { chunkCount?: number } = {},
): DocumentRecord {
  const createdAt = new Date('2026-07-21T08:00:00.000Z');
  const chunks = overrides.chunks ?? [createChunk(`${id}-chunk-1`, id)];
  const chunkCount = overrides.chunkCount ?? chunks.length;
  return {
    id,
    name: '高等数学 导数讲义.pdf',
    type: 'PDF',
    size: 1024,
    status: 'DONE',
    sourceType: 'UPLOAD',
    contentHash: 'sha256:a',
    processedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    chunks,
    _count: { chunks: chunkCount },
    ...overrides,
  };
}

function createChunk(
  id: string,
  documentId: string,
  overrides: Partial<ChunkRecord> = {},
): ChunkRecord {
  return {
    id,
    documentId,
    userId: 'user_1',
    content: '导数 极限 函数',
    index: 0,
    metadata: {
      safety: {
        riskLevel: 'low',
        categories: [],
        matchedPatterns: [],
        safeForPrompt: true,
      },
    },
    ...overrides,
  };
}

type ChunkRecord = {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  index: number;
  metadata: Record<string, unknown>;
};

type DocumentRecord = {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'MD' | 'TXT';
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  sourceType: 'UPLOAD' | 'NOTE' | 'WRONG_QUESTION' | 'OCR' | 'CHAT';
  contentHash: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  chunks: ChunkRecord[];
  _count: { chunks: number };
};
