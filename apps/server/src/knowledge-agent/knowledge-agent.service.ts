import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { analyzeKnowledgeDedup } from '@repo/agent/knowledge-dedup';
import { organizeKnowledgeDocuments } from '@repo/agent/knowledge-organizer';
import {
  runKnowledgeDedupModelCandidate,
  runKnowledgeOrganizerModelCandidate,
} from '@repo/agent/model-candidates';
import type {
  KnowledgeAgentRuntimeMetadata,
  KnowledgeAgentSuggestionQuery,
  KnowledgeAgentSuggestionResponse,
  KnowledgeDedupResult,
  KnowledgeOrganizerResult,
} from '@repo/types/api/knowledge-agent';

import { AgentTracesService } from '../agent-traces/agent-traces.service';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { reserveKnowledgeCandidateBudgets } from './knowledge-model-config';
import {
  KNOWLEDGE_MODEL_RUNTIMES,
  type KnowledgeModelRuntimeBundle,
} from './knowledge-model-runtime.factory';
import {
  buildKnowledgeSuggestionTrace,
  toKnowledgeRuntimeMetadata,
} from './knowledge-agent-trace';
import {
  type KnowledgeOwnerSnapshot,
  KnowledgeOwnerSnapshotSource,
} from './knowledge-owner-snapshot';

const SNAPSHOT_TRANSACTION_MAX_WAIT_MS = 2_000;
const SNAPSHOT_TRANSACTION_TIMEOUT_MS = 5_000;

@Injectable()
export class KnowledgeAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ServerEnv, true>,
    private readonly snapshotSource: KnowledgeOwnerSnapshotSource,
    @Inject(KNOWLEDGE_MODEL_RUNTIMES)
    private readonly modelRuntimes: KnowledgeModelRuntimeBundle,
    private readonly agentTracesService: AgentTracesService,
  ) {}

  async getSuggestions(
    userId: string,
    query: KnowledgeAgentSuggestionQuery,
    signal?: AbortSignal,
  ): Promise<KnowledgeAgentSuggestionResponse> {
    const now = new Date();
    // This snapshot is request-local and never persisted. The required JWT secret is
    // used only as domain-separated HMAC key material so raw owner IDs never enter
    // fingerprints; rotating it merely changes fingerprints for later requests.
    const ownerHashSecret = this.config.get('JWT_SECRET', { infer: true });
    const snapshot = await this.prisma.$transaction(
      (transaction) =>
        this.snapshotSource.load(transaction, {
          userId,
          ownerHashSecret,
          ...(query.documentId ? { documentId: query.documentId } : {}),
          limit: query.limit,
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: SNAPSHOT_TRANSACTION_MAX_WAIT_MS,
        timeout: SNAPSHOT_TRANSACTION_TIMEOUT_MS,
      },
    );

    const fresh = await this.snapshotSource.revalidate(this.prisma, {
      userId,
      ownerHashSecret,
      snapshot,
    });
    if (!fresh) return this.localResponse(snapshot, now, 'snapshot_stale');

    const { dedupEnabled, organizerEnabled } = this.modelRuntimes.config;
    if (!dedupEnabled && !organizerEnabled) {
      return this.localResponse(snapshot, now, 'gate_disabled');
    }

    const reservations = reserveKnowledgeCandidateBudgets();
    if (reservations === null) {
      return this.localResponse(snapshot, now, 'fallback_budget_exhausted');
    }

    const runId = randomUUID();
    const startedAt = new Date();
    const deterministicInput = this.deterministicInput(snapshot, now);
    const projectionSource = this.projectionSource(snapshot);
    const local = this.localValues(snapshot, now);

    // Both immutable reservations are created before either Promise starts.
    // Disabled candidates stay zero-call and resolve alongside the enabled one.
    const dedupPromise = dedupEnabled
      ? this.safeDedupCandidate({
          runId,
          deterministicInput: {
            ...deterministicInput,
            ...(snapshot.targetDocumentId
              ? { targetDocumentId: snapshot.targetDocumentId }
              : {}),
          },
          projectionSource,
          budget: reservations.dedupBudget,
          fallback: local.dedup,
          ...(signal ? { signal } : {}),
        })
      : Promise.resolve({
          value: local.dedup,
          observation: null,
          disposition: 'gate_disabled' as const,
          reasonCode: 'gate_disabled',
        });
    const organizerPromise = organizerEnabled
      ? this.safeOrganizerCandidate({
          runId,
          deterministicInput,
          projectionSource,
          budget: reservations.organizerBudget,
          fallback: local.organizer,
          ...(signal ? { signal } : {}),
        })
      : Promise.resolve({
          value: local.organizer,
          observation: null,
          disposition: 'gate_disabled' as const,
          reasonCode: 'gate_disabled',
        });
    const [dedupCandidate, organizerCandidate] = await Promise.all([
      dedupPromise,
      organizerPromise,
    ]);

    const stillFresh = await this.snapshotSource.revalidate(this.prisma, {
      userId,
      ownerHashSecret,
      snapshot,
    });
    const finalDisposition = stillFresh
      ? undefined
      : ('snapshot_stale' as const);
    const finalReason = stillFresh ? undefined : 'snapshot_stale';
    const initialDedupRuntime = toKnowledgeRuntimeMetadata({
      observation: dedupCandidate.observation,
      traceId: runId,
      disposition: finalDisposition ?? dedupCandidate.disposition,
      reasonCode: finalReason ?? dedupCandidate.reasonCode,
    });
    const initialOrganizerRuntime = toKnowledgeRuntimeMetadata({
      observation: organizerCandidate.observation,
      traceId: runId,
      disposition: finalDisposition ?? organizerCandidate.disposition,
      reasonCode: finalReason ?? organizerCandidate.reasonCode,
    });
    const values = stillFresh
      ? {
          dedup: dedupCandidate.value,
          organizer: organizerCandidate.value,
        }
      : local;

    try {
      await this.agentTracesService.createTrace(
        userId,
        buildKnowledgeSuggestionTrace({
          runId,
          startedAt,
          finishedAt: new Date(),
          dedup: {
            runtime: initialDedupRuntime,
            observation: dedupCandidate.observation,
            usageRef: `provider_call_${runId}_dedup`,
          },
          organizer: {
            runtime: initialOrganizerRuntime,
            observation: organizerCandidate.observation,
            usageRef: `provider_call_${runId}_organizer`,
          },
        }),
      );
    } catch {
      return this.attachRuntime(local, now, {
        dedup: toKnowledgeRuntimeMetadata({
          observation: dedupCandidate.observation,
          traceId: null,
          disposition: 'fallback_runtime_error',
          reasonCode: 'trace_unavailable',
        }),
        organizer: toKnowledgeRuntimeMetadata({
          observation: organizerCandidate.observation,
          traceId: null,
          disposition: 'fallback_runtime_error',
          reasonCode: 'trace_unavailable',
        }),
      });
    }

    return this.attachRuntime(values, now, {
      dedup: initialDedupRuntime,
      organizer: initialOrganizerRuntime,
    });
  }

  private localResponse(
    snapshot: KnowledgeOwnerSnapshot,
    now: Date,
    disposition: Extract<
      KnowledgeAgentRuntimeMetadata['disposition'],
      'gate_disabled' | 'snapshot_stale' | 'fallback_budget_exhausted'
    >,
  ): KnowledgeAgentSuggestionResponse {
    const degraded = disposition !== 'gate_disabled';
    const runtime = toKnowledgeRuntimeMetadata({
      traceId: null,
      disposition,
      reasonCode: disposition,
      attempted: false,
    });
    return this.attachRuntime(this.localValues(snapshot, now), now, {
      dedup: { ...runtime, degraded },
      organizer: { ...runtime, degraded },
    });
  }

  private localValues(snapshot: KnowledgeOwnerSnapshot, now: Date) {
    const input = this.deterministicInput(snapshot, now);
    return {
      dedup: analyzeKnowledgeDedup({
        ...input,
        ...(snapshot.targetDocumentId
          ? { targetDocumentId: snapshot.targetDocumentId }
          : {}),
      }),
      organizer: organizeKnowledgeDocuments(input),
    };
  }

  private deterministicInput(snapshot: KnowledgeOwnerSnapshot, now: Date) {
    return {
      now: now.toISOString(),
      documents: snapshot.documents,
    };
  }

  private projectionSource(snapshot: KnowledgeOwnerSnapshot) {
    return {
      ...(snapshot.targetDocumentId
        ? { targetDocumentId: snapshot.targetDocumentId }
        : {}),
      documents: snapshot.documents.map((document) => ({
        documentId: document.id,
        name: document.name,
        type: document.type,
        relativeTime: 'same_time' as const,
        safety: 'safe_for_model' as const,
        summaries: document.chunkSummaries.map((text) => ({
          text,
          safety: 'safe_for_model' as const,
        })),
      })),
      pairs: snapshot.semanticPairs.map((pair) => ({
        leftDocumentId: pair.leftDocumentId,
        rightDocumentId: pair.rightDocumentId,
        evidenceBand:
          pair.evidenceBand === 'high'
            ? ('high' as const)
            : ('medium' as const),
      })),
    };
  }

  private async safeDedupCandidate(input: {
    runId: string;
    deterministicInput: Parameters<
      typeof runKnowledgeDedupModelCandidate
    >[0]['deterministicInput'];
    projectionSource: ReturnType<KnowledgeAgentService['projectionSource']>;
    budget: Parameters<typeof runKnowledgeDedupModelCandidate>[0]['budget'];
    fallback: KnowledgeDedupResult;
    signal?: AbortSignal;
  }) {
    try {
      const candidate = await runKnowledgeDedupModelCandidate({
        runId: input.runId,
        deterministicInput: input.deterministicInput,
        projectionSource: input.projectionSource,
        runtime: this.modelRuntimes.dedupRuntime,
        budget: input.budget,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      return {
        ...candidate,
        disposition: undefined,
        reasonCode: undefined,
      };
    } catch {
      return {
        value: input.fallback,
        observation: null,
        disposition: 'fallback_runtime_error' as const,
        reasonCode: 'candidate_execution_failed',
      };
    }
  }

  private async safeOrganizerCandidate(input: {
    runId: string;
    deterministicInput: Parameters<
      typeof runKnowledgeOrganizerModelCandidate
    >[0]['deterministicInput'];
    projectionSource: ReturnType<KnowledgeAgentService['projectionSource']>;
    budget: Parameters<typeof runKnowledgeOrganizerModelCandidate>[0]['budget'];
    fallback: KnowledgeOrganizerResult;
    signal?: AbortSignal;
  }) {
    try {
      const candidate = await runKnowledgeOrganizerModelCandidate({
        runId: input.runId,
        deterministicInput: input.deterministicInput,
        projectionSource: input.projectionSource,
        runtime: this.modelRuntimes.organizerRuntime,
        budget: input.budget,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      return {
        ...candidate,
        disposition: undefined,
        reasonCode: undefined,
      };
    } catch {
      return {
        value: input.fallback,
        observation: null,
        disposition: 'fallback_runtime_error' as const,
        reasonCode: 'candidate_execution_failed',
      };
    }
  }

  private attachRuntime(
    values: {
      dedup: KnowledgeDedupResult;
      organizer: KnowledgeOrganizerResult;
    },
    now: Date,
    runtimes: {
      dedup: KnowledgeAgentRuntimeMetadata;
      organizer: KnowledgeAgentRuntimeMetadata;
    },
  ): KnowledgeAgentSuggestionResponse {
    return {
      generatedAt: now.toISOString(),
      dedup: { ...values.dedup, runtime: runtimes.dedup },
      organizer: { ...values.organizer, runtime: runtimes.organizer },
    };
  }
}
