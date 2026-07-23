import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  runWrongQuestionOrganizerModelCandidate,
  type WrongQuestionOrganizerModelCandidateEnvelope,
  type WrongQuestionOrganizerModelCandidateItem,
} from '@repo/agent/model-candidates';
import {
  organizeWrongQuestion,
  type WrongQuestionOrganizerInput,
  type WrongQuestionOrganizerResult,
} from '@repo/agent/wrong-question-organizer';
import { Prisma } from '@prisma/client';
import type {
  MoveWrongQuestionToDeckRequest,
  OrganizedWrongQuestionItem,
  OrganizeWrongQuestionBatchRequest,
  OrganizeWrongQuestionBatchResponse,
  OrganizeWrongQuestionRequest,
  OrganizeWrongQuestionResponse,
  UpdateWrongQuestionDeckRequest,
  WrongQuestionDeckItemResponse,
  WrongQuestionDeckListResponse,
  WrongQuestionDeckQuestionListQuery,
  WrongQuestionDeckQuestionListResponse,
  WrongQuestionDeckResponse,
  WrongQuestionGroupListResponse,
  WrongQuestionOrganizerRuntimeDisposition,
  WrongQuestionOrganizerRuntimeMetadata,
  WrongQuestionSubjectGroupResponse,
} from '@repo/types/api/wrong-question-organizer';
import type { WrongQuestionResponse } from '@repo/types/api/wrong-question';

import { AgentTracesService } from '../agent-traces/agent-traces.service';
import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import {
  buildWrongQuestionOrganizerAdmissionTrace,
  buildWrongQuestionOrganizerFinalTrace,
  validateWrongQuestionOrganizerCandidateAdmission,
  type WrongQuestionOrganizerCandidateAdmission,
} from './wrong-question-organizer-agent-trace';
import {
  buildWrongQuestionOrganizerCommand,
  WrongQuestionOrganizerCommandExecutor,
  type WrongQuestionOrganizerCommandResult,
} from './wrong-question-organizer-command';
import { reserveWrongQuestionOrganizerCandidateBudget } from './wrong-question-organizer-model-config';
import {
  WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME,
  type WrongQuestionOrganizerModelRuntimeBundle,
} from './wrong-question-organizer-model-runtime.factory';
import {
  hashWrongQuestionOrganizerOwner,
  type WrongQuestionOrganizerOwnerSnapshot,
  WrongQuestionOrganizerOwnerSnapshotSource,
} from './wrong-question-organizer-owner-snapshot';

const SNAPSHOT_TRANSACTION_MAX_WAIT_MS = 2_000;
const SNAPSHOT_TRANSACTION_TIMEOUT_MS = 5_000;
const MAX_LOCAL_STALE_ATTEMPTS = 2;
const MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;
const MAX_MODEL_CANDIDATE_ITEMS = 12;
const MAX_LOCAL_COMMAND_ITEMS = 12;

type OrganizerScopeResult = Readonly<{
  items: OrganizedWrongQuestionItem[];
  runtime: WrongQuestionOrganizerRuntimeMetadata;
}>;

type LocalRuntimeDisposition = Exclude<
  WrongQuestionOrganizerRuntimeDisposition,
  'candidate_applied'
>;

@Injectable()
export class WrongQuestionOrganizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ServerEnv, true>,
    private readonly snapshotSource: WrongQuestionOrganizerOwnerSnapshotSource,
    private readonly commandExecutor: WrongQuestionOrganizerCommandExecutor,
    @Inject(WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME)
    private readonly modelRuntime: WrongQuestionOrganizerModelRuntimeBundle,
    private readonly agentTracesService: AgentTracesService,
  ) {}

  async listGroups(userId: string): Promise<WrongQuestionGroupListResponse> {
    const groups = await this.prisma.wrongQuestionSubjectGroup.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });

    if (groups.length === 0) {
      return { items: [] };
    }

    const stats = await this.loadGroupStats(
      userId,
      groups.map((group) => group.id),
    );

    return {
      items: groups.map((group) =>
        this.toSubjectGroupResponse(group, stats.groups.get(group.id)),
      ),
    };
  }

  async listDecks(
    userId: string,
    subjectGroupId: string,
  ): Promise<WrongQuestionDeckListResponse> {
    const subjectGroup = await this.prisma.wrongQuestionSubjectGroup.findFirst({
      where: { id: subjectGroupId, userId },
    });

    if (!subjectGroup) {
      throw this.subjectGroupNotFound();
    }

    const decks = await this.prisma.wrongQuestionDeck.findMany({
      where: { userId, subjectGroupId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'asc' }],
    });
    const stats = await this.loadGroupStats(userId, [subjectGroupId]);

    return {
      subjectGroup: this.toSubjectGroupResponse(
        subjectGroup,
        stats.groups.get(subjectGroup.id),
      ),
      items: decks.map((deck) =>
        this.toDeckResponse(deck, stats.decks.get(deck.id)),
      ),
    };
  }

  async listDeckQuestions(
    userId: string,
    deckId: string,
    query: WrongQuestionDeckQuestionListQuery,
  ): Promise<WrongQuestionDeckQuestionListResponse> {
    const deck = await this.prisma.wrongQuestionDeck.findFirst({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw this.deckNotFound();
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.wrongQuestionDeckItem.findMany({
        where: { userId, deckId },
        include: { wrongQuestion: true },
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.wrongQuestionDeckItem.count({ where: { userId, deckId } }),
    ]);
    const stats = await this.loadGroupStats(userId, [deck.subjectGroupId]);

    return {
      deck: this.toDeckResponse(deck, stats.decks.get(deck.id)),
      items: items.map((item) =>
        this.toWrongQuestionResponse(item.wrongQuestion),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async organizeOne(
    userId: string,
    wrongQuestionId: string,
    input: OrganizeWrongQuestionRequest,
    signal?: AbortSignal,
  ): Promise<OrganizeWrongQuestionResponse> {
    const scope = await this.organizeScope({
      userId,
      targets: [{ wrongQuestionId, force: input.force }],
      allowModel: true,
      signal,
    });
    const response = scope.items.find(
      (entry) => entry.item.wrongQuestionId === wrongQuestionId,
    );
    if (response) return { ...response, runtime: scope.runtime };
    throw this.staleError();
  }

  async organizeBatch(
    userId: string,
    input: OrganizeWrongQuestionBatchRequest,
    signal?: AbortSignal,
  ): Promise<OrganizeWrongQuestionBatchResponse> {
    this.assertRequestActive(signal);
    const wrongQuestions = await this.prisma.wrongQuestion.findMany({
      where: {
        userId,
        deckItems: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
      select: {
        id: true,
        subject: true,
        category: true,
        knowledgePoints: true,
        errorType: true,
        questionText: true,
        analysis: true,
      },
    });
    const candidateIds = this.modelRuntime.config.enabled
      ? wrongQuestions
          .filter((wrongQuestion) =>
            this.isPotentialModelCandidate(wrongQuestion),
          )
          .slice(0, MAX_MODEL_CANDIDATE_ITEMS)
          .map(({ id }) => id)
      : [];
    const candidateIdSet = new Set(candidateIds);
    const responses: OrganizedWrongQuestionItem[] = [];
    let runtime = localRuntimeMetadata(
      this.modelRuntime.config.enabled ? 'not_eligible' : 'gate_disabled',
    );

    if (candidateIds.length > 0) {
      const candidateScope = await this.organizeScope({
        userId,
        targets: candidateIds.map((wrongQuestionId) => ({
          wrongQuestionId,
          force: false,
        })),
        allowModel: true,
        signal,
      });
      responses.push(...candidateScope.items);
      runtime = candidateScope.runtime;
    }

    const localIds = wrongQuestions
      .map(({ id }) => id)
      .filter((id) => !candidateIdSet.has(id));
    for (const wrongQuestionIds of chunks(localIds, MAX_LOCAL_COMMAND_ITEMS)) {
      this.assertRequestActive(signal);
      const localScope = await this.organizeScope({
        userId,
        targets: wrongQuestionIds.map((wrongQuestionId) => ({
          wrongQuestionId,
          force: false,
        })),
        allowModel: false,
        signal,
      });
      responses.push(...localScope.items);
    }

    const responseByQuestionId = new Map(
      responses.map((response) => [response.item.wrongQuestionId, response]),
    );
    const items = wrongQuestions.flatMap(({ id }) => {
      const response = responseByQuestionId.get(id);
      return response ? [response] : [];
    });

    return {
      organizedCount: items.length,
      skippedCount: wrongQuestions.length - items.length,
      items,
      runtime,
    };
  }

  private async organizeScope(input: {
    userId: string;
    targets: readonly OrganizerTarget[];
    allowModel: boolean;
    signal?: AbortSignal;
  }): Promise<OrganizerScopeResult> {
    const ownerHashSecret = this.config.get('JWT_SECRET', { infer: true });
    let modelAttemptConsumed =
      !input.allowModel || !this.modelRuntime.config.enabled;
    let runtime = localRuntimeMetadata(
      this.modelRuntime.config.enabled ? 'not_eligible' : 'gate_disabled',
    );

    for (let attempt = 1; attempt <= MAX_LOCAL_STALE_ATTEMPTS; attempt += 1) {
      this.assertRequestActive(input.signal);
      const snapshot = await this.loadOwnerSnapshot(
        input.userId,
        ownerHashSecret,
        input.targets.map(({ wrongQuestionId }) => wrongQuestionId),
      );
      this.assertRequestActive(input.signal);

      const freshBeforeDecision = await this.snapshotSource.revalidate(
        this.prisma,
        {
          userId: input.userId,
          ownerHashSecret,
          snapshot,
        },
      );
      if (!freshBeforeDecision) continue;

      const localDecisions = input.targets.map(({ wrongQuestionId }) => ({
        wrongQuestionId,
        result: this.organizerDecision(snapshot, wrongQuestionId),
      }));
      let decisions = localDecisions;
      let traceContext: OrganizerTraceContext | null = null;
      let postDecisionFenceCompleted = false;

      if (!modelAttemptConsumed) {
        modelAttemptConsumed = true;
        const reservation = reserveWrongQuestionOrganizerCandidateBudget();
        if (reservation === null) {
          runtime = localRuntimeMetadata('fallback_budget_exceeded');
        } else {
          const runId = randomUUID();
          const startedAt = new Date();
          const candidate = await this.safeModelCandidate({
            runId,
            snapshot,
            targets: input.targets,
            budget: reservation.candidateBudget,
            signal: input.signal,
          });
          const candidateFinishedAt = new Date();
          this.assertRequestActive(input.signal);
          runtime = candidateRuntimeMetadata(candidate);
          const admission = candidate
            ? validateWrongQuestionOrganizerCandidateAdmission(
                candidate.observation,
              )
            : null;
          if (
            candidate !== null &&
            candidate.observation.disposition === 'candidate_applied' &&
            admission !== null &&
            candidate.result.length !== input.targets.length
          ) {
            runtime = localRuntimeMetadata('fallback_schema_invalid');
          }
          if (
            admission !== null &&
            candidate !== null &&
            candidate.result.length === input.targets.length
          ) {
            const freshAfterCandidate = await this.snapshotSource.revalidate(
              this.prisma,
              {
                userId: input.userId,
                ownerHashSecret,
                snapshot,
              },
            );
            postDecisionFenceCompleted = true;
            if (!freshAfterCandidate) {
              runtime = localRuntimeMetadata('snapshot_stale');
              continue;
            }
            this.assertRequestActive(input.signal);

            const context = {
              runId,
              snapshotFingerprint: snapshot.fingerprint,
              targetCount: input.targets.length,
              startedAt,
              candidateFinishedAt,
              admission,
            } satisfies OrganizerTraceContext;
            try {
              await this.agentTracesService.createTrace(
                input.userId,
                buildWrongQuestionOrganizerAdmissionTrace(context),
              );
              decisions = input.targets.map((target, index) => ({
                wrongQuestionId: target.wrongQuestionId,
                result: candidate.result[index],
              }));
              traceContext = context;
            } catch {
              decisions = localDecisions;
              runtime = localRuntimeMetadata('fallback_runtime_error');
            }
          }
        }
      }

      if (!postDecisionFenceCompleted) {
        const freshAfterDecision = await this.snapshotSource.revalidate(
          this.prisma,
          {
            userId: input.userId,
            ownerHashSecret,
            snapshot,
          },
        );
        if (!freshAfterDecision) continue;
      }

      if (traceContext && input.signal?.aborted) {
        await this.finalizeTrace(input.userId, traceContext, 'aborted');
        this.assertRequestActive(input.signal);
      }
      this.assertRequestActive(input.signal);

      const command = buildWrongQuestionOrganizerCommand({
        snapshot,
        decisions: input.targets.map((target) => ({
          wrongQuestionId: target.wrongQuestionId,
          force: target.force,
          result:
            decisions.find(
              (entry) => entry.wrongQuestionId === target.wrongQuestionId,
            )?.result ??
            this.organizerDecision(snapshot, target.wrongQuestionId),
        })),
      });
      if (!command) {
        if (traceContext) {
          await this.finalizeTrace(input.userId, traceContext, 'stale');
          runtime = localRuntimeMetadata('snapshot_stale');
        }
        continue;
      }

      let result: WrongQuestionOrganizerCommandResult;
      try {
        result = await this.commandExecutor.execute({
          userId: input.userId,
          ownerHashSecret,
          snapshot,
          command,
        });
      } catch (error) {
        if (traceContext) {
          await this.finalizeTrace(input.userId, traceContext, 'failed');
        }
        throw error;
      }
      if (traceContext) {
        await this.finalizeTrace(input.userId, traceContext, result.status);
        runtime =
          result.status === 'stale'
            ? localRuntimeMetadata('snapshot_stale')
            : hybridRuntimeMetadata(traceContext.runId);
      }
      const responses = await this.commandResultToResponses(
        input.userId,
        input.targets.map(({ wrongQuestionId }) => wrongQuestionId),
        result,
      );
      if (responses.length > 0) return { items: responses, runtime };
    }

    const authorities = await Promise.all(
      input.targets.map(({ wrongQuestionId }) =>
        this.loadExistingOrganization(input.userId, wrongQuestionId),
      ),
    );
    const responses: OrganizedWrongQuestionItem[] = [];
    for (const authority of authorities) {
      if (authority) {
        responses.push(await this.authorityToResponse(input.userId, authority));
      }
    }
    if (responses.length > 0) return { items: responses, runtime };
    throw this.staleError();
  }

  private loadOwnerSnapshot(
    userId: string,
    ownerHashSecret: string,
    wrongQuestionIds: readonly string[],
  ) {
    return this.prisma.$transaction(
      (transaction) =>
        this.snapshotSource.load(transaction, {
          userId,
          ownerHashSecret,
          wrongQuestionIds,
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: SNAPSHOT_TRANSACTION_MAX_WAIT_MS,
        timeout: SNAPSHOT_TRANSACTION_TIMEOUT_MS,
      },
    );
  }

  private async safeModelCandidate(input: {
    runId: string;
    snapshot: WrongQuestionOrganizerOwnerSnapshot;
    targets: readonly OrganizerTarget[];
    budget: Parameters<
      typeof runWrongQuestionOrganizerModelCandidate
    >[0]['budget'];
    signal?: AbortSignal;
  }): Promise<WrongQuestionOrganizerModelCandidateEnvelope | null> {
    try {
      const items = input.targets.map(({ wrongQuestionId }) =>
        this.modelCandidateItem(input.snapshot, wrongQuestionId),
      );
      const force = input.targets[0]?.force ?? false;
      if (input.targets.some((target) => target.force !== force)) return null;
      return await runWrongQuestionOrganizerModelCandidate({
        runId: input.runId,
        items,
        force,
        ownerEligible: true,
        snapshotCurrent: true,
        projectionSource: this.modelProjectionSource(input.snapshot, items),
        runtime: this.modelRuntime.runtime,
        budget: input.budget,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    } catch {
      return null;
    }
  }

  private modelCandidateItem(
    snapshot: WrongQuestionOrganizerOwnerSnapshot,
    wrongQuestionId: string,
  ): WrongQuestionOrganizerModelCandidateItem {
    return {
      deterministicInput: this.organizerInput(snapshot, wrongQuestionId),
      hasExistingItem: snapshot.items.some(
        (item) => item.wrongQuestionId === wrongQuestionId,
      ),
    };
  }

  private modelProjectionSource(
    snapshot: WrongQuestionOrganizerOwnerSnapshot,
    items: readonly WrongQuestionOrganizerModelCandidateItem[],
  ) {
    const deckIds = new Set(
      items.flatMap((item) =>
        (item.deterministicInput.existingDecks ?? []).map(({ id }) => id),
      ),
    );
    return {
      questions: items.map(({ deterministicInput }) => ({
        questionId: deterministicInput.wrongQuestion.id,
        subject: normalizedOrNull(deterministicInput.wrongQuestion.subject),
        subjectHint: organizerSubjectHint(
          deterministicInput.wrongQuestion.subject,
        ),
        category: normalizedOrNull(deterministicInput.wrongQuestion.category),
        knowledgePoints: [
          ...(deterministicInput.wrongQuestion.knowledgePoints ?? []),
        ],
        errorType: normalizedOrNull(deterministicInput.wrongQuestion.errorType),
        questionText: normalizedOrNull(
          deterministicInput.wrongQuestion.questionText,
        ),
        analysis: normalizedOrNull(deterministicInput.wrongQuestion.analysis),
        answer: normalizedOrNull(deterministicInput.wrongQuestion.answer),
        userNote: normalizedOrNull(deterministicInput.wrongQuestion.userNote),
        safety: 'safe_for_model' as const,
      })),
      existingDecks: snapshot.decks
        .filter((deck) => deckIds.has(deck.id))
        .map((deck) => ({
          deckId: deck.id,
          subject: organizerSubjectHint(deck.subject, true),
          name: deck.name,
          nameLocked: deck.nameLocked,
          keywords: [...deck.keywords],
          safety: 'safe_for_model' as const,
        })),
    };
  }

  private organizerInput(
    snapshot: WrongQuestionOrganizerOwnerSnapshot,
    wrongQuestionId: string,
  ): WrongQuestionOrganizerInput {
    const wrongQuestion = snapshot.wrongQuestions.find(
      ({ id }) => id === wrongQuestionId,
    );
    if (!wrongQuestion) throw this.wrongQuestionNotFound();
    const detachedQuestion: WrongQuestionOrganizerInput['wrongQuestion'] = {
      id: wrongQuestion.id,
      subject: wrongQuestion.subject,
      category: wrongQuestion.category,
      knowledgePoints: [...wrongQuestion.knowledgePoints],
      errorType: wrongQuestion.errorType,
      questionText: wrongQuestion.questionText,
      analysis: wrongQuestion.analysis,
      answer: wrongQuestion.answer,
      userNote: wrongQuestion.userNote,
    };
    const firstPass = organizeWrongQuestion({
      wrongQuestion: detachedQuestion,
    });
    const existingDecks = snapshot.decks
      .filter(({ subject }) => subject === firstPass.subjectKey)
      .map((deck) => ({
        id: deck.id,
        name: deck.name,
        nameLocked: deck.nameLocked,
        keywords: [...deck.keywords],
      }));
    return { wrongQuestion: detachedQuestion, existingDecks };
  }

  private isPotentialModelCandidate(input: BatchCandidateRow): boolean {
    if (!input.questionText.trim() && !input.analysis.trim()) return false;
    const local = organizeWrongQuestion({
      wrongQuestion: {
        id: input.id,
        subject: input.subject,
        category: input.category,
        knowledgePoints: input.knowledgePoints,
        errorType: input.errorType,
        questionText: input.questionText,
        analysis: input.analysis,
      },
    });
    return !input.subject.trim() || local.confidence < 0.72;
  }

  private async finalizeTrace(
    userId: string,
    context: OrganizerTraceContext,
    outcome: 'applied' | 'authority' | 'stale' | 'aborted' | 'failed',
  ) {
    try {
      await this.agentTracesService.createTrace(
        userId,
        buildWrongQuestionOrganizerFinalTrace({
          ...context,
          finishedAt: new Date(),
          outcome,
        }),
      );
    } catch {
      // createTrace is atomic; a failed final replacement leaves the admission
      // command_pending trace intact and must not roll back an authorized write.
    }
  }

  private async commandResultToResponses(
    userId: string,
    wrongQuestionIds: readonly string[],
    result: WrongQuestionOrganizerCommandResult,
  ) {
    const responses = await Promise.all(
      wrongQuestionIds.map((wrongQuestionId) =>
        this.commandResultToResponse(userId, wrongQuestionId, result),
      ),
    );
    return responses.filter(
      (response): response is OrganizedWrongQuestionItem => response !== null,
    );
  }

  private assertRequestActive(signal: AbortSignal | undefined) {
    if (signal?.aborted) {
      throw new AppError(
        'WRONG_QUESTION_ORGANIZER_ABORTED',
        '错题整理请求已取消',
        HttpStatus.REQUEST_TIMEOUT,
      );
    }
  }

  private staleError() {
    return new AppError(
      'WRONG_QUESTION_ORGANIZER_STALE',
      '错题整理依据已变化，请重试',
      HttpStatus.CONFLICT,
    );
  }

  async updateDeck(
    userId: string,
    deckId: string,
    input: UpdateWrongQuestionDeckRequest,
  ): Promise<WrongQuestionDeckResponse> {
    const deck = await this.runOwnerWriteTransaction(
      userId,
      async (transaction) => {
        const existing = await transaction.wrongQuestionDeck.findFirst({
          where: { id: deckId, userId },
        });
        if (!existing) throw this.deckNotFound();

        return transaction.wrongQuestionDeck.update({
          where: { id: deckId },
          data: { ...input, source: 'USER' },
        });
      },
    );
    const stats = await this.loadGroupStats(userId, [deck.subjectGroupId]);

    return this.toDeckResponse(deck, stats.decks.get(deck.id));
  }

  async moveToDeck(
    userId: string,
    deckId: string,
    input: MoveWrongQuestionToDeckRequest,
  ): Promise<WrongQuestionDeckItemResponse> {
    const item = await this.runOwnerWriteTransaction(
      userId,
      async (transaction) => {
        const deck = await transaction.wrongQuestionDeck.findFirst({
          where: { id: deckId, userId },
          select: { id: true },
        });
        if (!deck) throw this.deckNotFound();

        const wrongQuestion = await transaction.wrongQuestion.findFirst({
          where: { id: input.wrongQuestionId, userId },
          select: { id: true },
        });
        if (!wrongQuestion) throw this.wrongQuestionNotFound();

        await transaction.wrongQuestionDeckItem.deleteMany({
          where: {
            userId,
            wrongQuestionId: input.wrongQuestionId,
            deckId: { not: deckId },
          },
        });

        return transaction.wrongQuestionDeckItem.upsert({
          where: {
            userId_wrongQuestionId: {
              userId,
              wrongQuestionId: input.wrongQuestionId,
            },
          },
          update: {
            deckId,
            source: input.source,
          },
          create: {
            userId,
            deckId,
            wrongQuestionId: input.wrongQuestionId,
            source: input.source,
            confidence: 1,
            reason: '用户手动归入专题。',
          },
        });
      },
    );

    return this.toDeckItemResponse(item);
  }

  async removeDeckItem(
    userId: string,
    deckId: string,
    wrongQuestionId: string,
  ): Promise<{ ok: true }> {
    await this.runOwnerWriteTransaction(userId, async (transaction) => {
      const deck = await transaction.wrongQuestionDeck.findFirst({
        where: { id: deckId, userId },
        select: { id: true },
      });
      if (!deck) throw this.deckNotFound();

      await transaction.wrongQuestionDeckItem.deleteMany({
        where: { userId, deckId, wrongQuestionId },
      });
    });

    return { ok: true };
  }

  private organizerDecision(
    snapshot: WrongQuestionOrganizerOwnerSnapshot,
    wrongQuestionId: string,
  ): WrongQuestionOrganizerResult {
    return organizeWrongQuestion(
      this.organizerInput(snapshot, wrongQuestionId),
    );
  }

  private async runOwnerWriteTransaction<T>(
    userId: string,
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const ownerHash = hashWrongQuestionOrganizerOwner(
      userId,
      this.config.get('JWT_SECRET', { infer: true }),
    );
    const run = () =>
      this.prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${ownerHash}, 0)
            )
          `;
          return callback(transaction);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: SNAPSHOT_TRANSACTION_MAX_WAIT_MS,
          timeout: SNAPSHOT_TRANSACTION_TIMEOUT_MS,
        },
      );

    for (
      let attempt = 1;
      attempt <= MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await run();
      } catch (error) {
        if (
          attempt === MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS ||
          !isRetryableSerializableTransactionError(error)
        ) {
          throw error;
        }
      }
    }
    throw new Error('WRONG_QUESTION_ORGANIZER_TRANSACTION_RETRY_EXHAUSTED');
  }

  private async commandResultToResponse(
    userId: string,
    wrongQuestionId: string,
    result: WrongQuestionOrganizerCommandResult,
  ): Promise<OrganizedWrongQuestionItem | null> {
    if (result.status === 'stale') return null;
    if (result.status === 'authority') {
      const entry = result.entries.find(
        (candidate) => candidate.wrongQuestionId === wrongQuestionId,
      );
      if (!entry) return null;
      return this.authorityToResponse(userId, entry.item);
    }

    const entry = result.entries.find(
      (candidate) => candidate.wrongQuestionId === wrongQuestionId,
    );
    if (!entry) return null;
    const stats = await this.loadGroupStats(userId, [entry.subjectGroup.id]);
    return {
      subjectGroup: this.toSubjectGroupResponse(
        entry.subjectGroup,
        stats.groups.get(entry.subjectGroup.id),
      ),
      deck: this.toDeckResponse(entry.deck, stats.decks.get(entry.deck.id)),
      item: this.toDeckItemResponse(entry.item),
      createdSubjectGroup: entry.createdSubjectGroup,
      createdDeck: entry.createdDeck,
      createdItem: entry.createdItem,
      reason: entry.reason,
      confidence: entry.confidence,
    };
  }

  private async loadExistingOrganization(
    userId: string,
    wrongQuestionId: string,
  ): Promise<OrganizerAuthorityItem | null> {
    return this.prisma.wrongQuestionDeckItem.findFirst({
      where: { userId, wrongQuestionId },
      include: { deck: { include: { subjectGroup: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async authorityToResponse(
    userId: string,
    item: OrganizerAuthorityItem,
  ): Promise<OrganizedWrongQuestionItem> {
    const stats = await this.loadGroupStats(userId, [item.deck.subjectGroupId]);
    return {
      subjectGroup: this.toSubjectGroupResponse(
        item.deck.subjectGroup,
        stats.groups.get(item.deck.subjectGroupId),
      ),
      deck: this.toDeckResponse(item.deck, stats.decks.get(item.deckId)),
      item: this.toDeckItemResponse(item),
      createdSubjectGroup: false,
      createdDeck: false,
      createdItem: false,
      reason: item.reason ?? '',
      confidence: item.confidence,
    };
  }

  private async loadGroupStats(userId: string, subjectGroupIds: string[]) {
    const stats: OrganizerStats = {
      groups: new Map(),
      decks: new Map(),
    };

    if (subjectGroupIds.length === 0) {
      return stats;
    }

    const decks = await this.prisma.wrongQuestionDeck.findMany({
      where: {
        userId,
        subjectGroupId: { in: subjectGroupIds },
      },
      select: {
        id: true,
        subjectGroupId: true,
      },
    });
    const items = await this.prisma.wrongQuestionDeckItem.findMany({
      where: {
        userId,
        deck: {
          subjectGroupId: { in: subjectGroupIds },
        },
      },
      select: {
        deckId: true,
        wrongQuestionId: true,
        deck: {
          select: {
            subjectGroupId: true,
          },
        },
        wrongQuestion: {
          select: {
            id: true,
            status: true,
            knowledgePoints: true,
            updatedAt: true,
          },
        },
      },
    });

    for (const deck of decks) {
      const groupStat = getOrCreateCountStats(
        stats.groups,
        deck.subjectGroupId,
      );

      groupStat.deckIds.add(deck.id);
      getOrCreateCountStats(stats.decks, deck.id);
    }

    for (const item of items) {
      const groupStat = getOrCreateCountStats(
        stats.groups,
        item.deck.subjectGroupId,
      );
      const deckStat = getOrCreateCountStats(stats.decks, item.deckId);

      groupStat.deckIds.add(item.deckId);
      deckStat.deckIds.add(item.deckId);
      if (!groupStat.questionIds.has(item.wrongQuestionId)) {
        groupStat.questionIds.add(item.wrongQuestionId);
        applyQuestionToStats(groupStat, item.wrongQuestion);
      }
      deckStat.questionIds.add(item.wrongQuestionId);
      applyQuestionToStats(deckStat, item.wrongQuestion);
    }

    return stats;
  }

  private toSubjectGroupResponse(
    group: WrongQuestionSubjectGroupRecord,
    stats: CountStats = emptyStats(),
  ): WrongQuestionSubjectGroupResponse {
    return {
      id: group.id,
      userId: group.userId,
      subject: group.subject,
      displayName: group.displayName,
      sortOrder: group.sortOrder,
      totalCount: stats.totalCount,
      unresolvedCount: stats.unresolvedCount,
      resolvedCount: stats.resolvedCount,
      deckCount: stats.deckIds.size,
      topKnowledgePoints: topKnowledgePoints(stats.knowledgePoints),
      lastUpdatedAt: stats.lastUpdatedAt?.toISOString() ?? null,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  private toDeckResponse(
    deck: WrongQuestionDeckRecord,
    stats: CountStats = emptyStats(),
  ): WrongQuestionDeckResponse {
    return {
      id: deck.id,
      userId: deck.userId,
      subjectGroupId: deck.subjectGroupId,
      name: deck.name,
      description: deck.description,
      source: deck.source,
      nameLocked: deck.nameLocked,
      confidence: deck.confidence,
      totalCount: stats.totalCount,
      unresolvedCount: stats.unresolvedCount,
      resolvedCount: stats.resolvedCount,
      topKnowledgePoints: topKnowledgePoints(stats.knowledgePoints),
      lastUpdatedAt: stats.lastUpdatedAt?.toISOString() ?? null,
      createdAt: deck.createdAt.toISOString(),
      updatedAt: deck.updatedAt.toISOString(),
    };
  }

  private toDeckItemResponse(
    item: WrongQuestionDeckItemRecord,
  ): WrongQuestionDeckItemResponse {
    return {
      id: item.id,
      deckId: item.deckId,
      wrongQuestionId: item.wrongQuestionId,
      reason: item.reason,
      confidence: item.confidence,
      source: item.source,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toWrongQuestionResponse(
    item: WrongQuestionRecord,
  ): WrongQuestionResponse {
    return {
      id: item.id,
      userId: item.userId,
      source: item.source,
      sourceRecordId: item.sourceRecordId,
      sourceGroupId: item.sourceGroupId,
      imageUrl: item.imageUrl,
      questionText: item.questionText,
      subject: item.subject,
      category: item.category,
      knowledgePoints: item.knowledgePoints,
      analysis: item.analysis,
      answer: item.answer,
      errorType: item.errorType,
      userNote: item.userNote,
      rawContent: item.rawContent,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private wrongQuestionNotFound(): AppError {
    return new AppError(
      'WRONG_QUESTION_NOT_FOUND',
      '错题不存在',
      HttpStatus.NOT_FOUND,
    );
  }

  private subjectGroupNotFound(): AppError {
    return new AppError(
      'WRONG_QUESTION_SUBJECT_GROUP_NOT_FOUND',
      '错题学科分组不存在',
      HttpStatus.NOT_FOUND,
    );
  }

  private deckNotFound(): AppError {
    return new AppError(
      'WRONG_QUESTION_DECK_NOT_FOUND',
      '错题专题不存在',
      HttpStatus.NOT_FOUND,
    );
  }
}

function getOrCreateCountStats(
  map: Map<string, CountStats>,
  key: string,
): CountStats {
  const existing = map.get(key);

  if (existing) {
    return existing;
  }

  const created = emptyStats();
  map.set(key, created);
  return created;
}

function applyQuestionToStats(
  stats: CountStats,
  wrongQuestion: StatsWrongQuestionRecord,
): void {
  stats.totalCount += 1;
  if (wrongQuestion.status === 'RESOLVED') {
    stats.resolvedCount += 1;
  } else {
    stats.unresolvedCount += 1;
  }
  stats.lastUpdatedAt = maxDate(stats.lastUpdatedAt, wrongQuestion.updatedAt);

  for (const point of wrongQuestion.knowledgePoints) {
    const normalized = point.trim();
    if (normalized) {
      stats.knowledgePoints.set(
        normalized,
        (stats.knowledgePoints.get(normalized) ?? 0) + 1,
      );
    }
  }
}

function emptyStats(): CountStats {
  return {
    totalCount: 0,
    unresolvedCount: 0,
    resolvedCount: 0,
    deckIds: new Set(),
    questionIds: new Set(),
    knowledgePoints: new Map(),
    lastUpdatedAt: null,
  };
}

function maxDate(left: Date | null, right: Date): Date {
  if (!left || right.getTime() > left.getTime()) {
    return right;
  }

  return left;
}

function topKnowledgePoints(points: Map<string, number>) {
  return [...points.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, 5)
    .map(([point]) => point);
}

type WrongQuestionRecord = Prisma.WrongQuestionGetPayload<object>;
type StatsWrongQuestionRecord = Pick<
  WrongQuestionRecord,
  'id' | 'status' | 'knowledgePoints' | 'updatedAt'
>;
type WrongQuestionSubjectGroupRecord =
  Prisma.WrongQuestionSubjectGroupGetPayload<object>;
type WrongQuestionDeckRecord = Prisma.WrongQuestionDeckGetPayload<object>;
type WrongQuestionDeckItemRecord =
  Prisma.WrongQuestionDeckItemGetPayload<object>;
type OrganizerAuthorityItem = Prisma.WrongQuestionDeckItemGetPayload<{
  include: {
    deck: { include: { subjectGroup: true } };
  };
}>;

type OrganizerTarget = Readonly<{
  wrongQuestionId: string;
  force: boolean;
}>;

type OrganizerTraceContext = Readonly<{
  runId: string;
  snapshotFingerprint: string;
  targetCount: number;
  startedAt: Date;
  candidateFinishedAt: Date;
  admission: WrongQuestionOrganizerCandidateAdmission;
}>;

type BatchCandidateRow = Readonly<{
  id: string;
  subject: string;
  category: string;
  knowledgePoints: readonly string[];
  errorType: string | null;
  questionText: string;
  analysis: string;
}>;

type OrganizerModelSubject =
  | 'math'
  | 'english'
  | 'politics'
  | 'computer'
  | 'major'
  | 'other';

type CountStats = {
  totalCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  deckIds: Set<string>;
  questionIds: Set<string>;
  knowledgePoints: Map<string, number>;
  lastUpdatedAt: Date | null;
};

type OrganizerStats = {
  groups: Map<string, CountStats>;
  decks: Map<string, CountStats>;
};

function organizerSubjectHint(
  value: string | null | undefined,
  requireKnown: true,
): OrganizerModelSubject;
function organizerSubjectHint(
  value: string | null | undefined,
  requireKnown?: false,
): OrganizerModelSubject | 'unknown';
function organizerSubjectHint(
  value: string | null | undefined,
  requireKnown = false,
): OrganizerModelSubject | 'unknown' {
  const normalized = (value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, '');
  if (!normalized) return requireKnown ? 'other' : 'unknown';
  if (normalized === 'math' || normalized.includes('数学')) return 'math';
  if (normalized === 'english' || normalized.includes('英语')) return 'english';
  if (normalized === 'politics' || normalized.includes('政治'))
    return 'politics';
  if (normalized === 'computer' || normalized.includes('计算机'))
    return 'computer';
  if (normalized === 'major' || normalized.includes('专业课')) return 'major';
  return 'other';
}

function normalizedOrNull(value: string | null | undefined): string | null {
  const normalized =
    value?.normalize('NFKC').trim().replace(/\s+/gu, ' ') ?? '';
  return normalized || null;
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function localRuntimeMetadata(
  disposition: LocalRuntimeDisposition,
): WrongQuestionOrganizerRuntimeMetadata {
  return Object.freeze({
    source: 'local_deterministic',
    disposition,
    degraded: disposition !== 'not_eligible' && disposition !== 'gate_disabled',
  });
}

function hybridRuntimeMetadata(
  traceId: string,
): WrongQuestionOrganizerRuntimeMetadata {
  return Object.freeze({
    source: 'hybrid_model',
    disposition: 'candidate_applied',
    degraded: false,
    traceId,
  });
}

function candidateRuntimeMetadata(
  candidate: WrongQuestionOrganizerModelCandidateEnvelope | null,
): WrongQuestionOrganizerRuntimeMetadata {
  if (candidate === null) return localRuntimeMetadata('fallback_runtime_error');
  switch (candidate.observation.disposition) {
    case 'not_eligible':
      return localRuntimeMetadata('not_eligible');
    case 'safety_blocked':
      return localRuntimeMetadata('safety_blocked');
    case 'fallback_invalid_input':
      return localRuntimeMetadata('fallback_invalid_input');
    case 'fallback_schema_invalid':
      return localRuntimeMetadata('fallback_schema_invalid');
    case 'fallback_budget_exceeded':
      return localRuntimeMetadata('fallback_budget_exceeded');
    case 'fallback_timeout':
      return localRuntimeMetadata('fallback_timeout');
    case 'fallback_aborted':
      return localRuntimeMetadata('fallback_aborted');
    case 'fallback_runtime_error':
      return localRuntimeMetadata('fallback_runtime_error');
    case 'candidate_applied':
      // A candidate is not public hybrid evidence until usage/price admission,
      // persisted Trace, and the local authorized command all succeed.
      return localRuntimeMetadata('fallback_usage_invalid');
  }
}

function isRetryableSerializableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034';
  }
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === '40001' || code === 'P2034';
}
