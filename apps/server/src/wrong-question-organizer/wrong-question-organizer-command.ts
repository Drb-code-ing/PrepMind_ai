import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { WrongQuestionOrganizerResult } from '@repo/agent/wrong-question-organizer';

import { PrismaService } from '../database/prisma.service';
import {
  fingerprintWrongQuestionOrganizerOwnerSnapshot,
  type WrongQuestionOrganizerOwnerSnapshot,
  WrongQuestionOrganizerOwnerSnapshotSource,
} from './wrong-question-organizer-owner-snapshot';

export const WRONG_QUESTION_ORGANIZER_COMMAND_VERSION =
  'wrong-question-organizer-command-v1' as const;

const MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;
const TRANSACTION_MAX_WAIT_MS = 2_000;
const TRANSACTION_TIMEOUT_MS = 5_000;
const MAX_DECKS_IN_WRITE_PREFLIGHT = 100;

export type WrongQuestionOrganizerCommandDecision = Readonly<{
  wrongQuestionId: string;
  force: boolean;
  result: WrongQuestionOrganizerResult;
}>;

export type WrongQuestionOrganizerCommandEntry = Readonly<{
  wrongQuestionId: string;
  force: boolean;
  subject: Readonly<{ key: string; displayName: string }>;
  deck:
    | Readonly<{ action: 'reuse'; id: string }>
    | Readonly<{
        action: 'create';
        name: string;
        description: string;
        confidence: number;
      }>;
  reason: string;
  confidence: number;
  signals: readonly string[];
}>;

export type WrongQuestionOrganizerCommand = Readonly<{
  version: typeof WRONG_QUESTION_ORGANIZER_COMMAND_VERSION;
  ownerHash: string;
  snapshotFingerprint: string;
  entries: readonly WrongQuestionOrganizerCommandEntry[];
}>;

export type WrongQuestionOrganizerCommandBuildInput = Readonly<{
  snapshot: WrongQuestionOrganizerOwnerSnapshot;
  decisions: readonly WrongQuestionOrganizerCommandDecision[];
}>;

type AuthorityItem = Prisma.WrongQuestionDeckItemGetPayload<{
  include: { deck: { include: { subjectGroup: true } } };
}>;
type AppliedGroup = Prisma.WrongQuestionSubjectGroupGetPayload<object>;
type AppliedDeck = Prisma.WrongQuestionDeckGetPayload<object>;
type AppliedItem = Prisma.WrongQuestionDeckItemGetPayload<object>;

export type WrongQuestionOrganizerCommandResult =
  | Readonly<{
      status: 'applied';
      entries: readonly Readonly<{
        wrongQuestionId: string;
        subjectGroup: AppliedGroup;
        deck: AppliedDeck;
        item: AppliedItem;
        createdSubjectGroup: boolean;
        createdDeck: boolean;
        createdItem: boolean;
        reason: string;
        confidence: number;
      }>[];
    }>
  | Readonly<{
      status: 'authority';
      entries: readonly Readonly<{
        wrongQuestionId: string;
        item: AuthorityItem;
      }>[];
    }>
  | Readonly<{ status: 'stale'; entries: readonly never[] }>;

export function buildWrongQuestionOrganizerCommand(
  input: WrongQuestionOrganizerCommandBuildInput,
): WrongQuestionOrganizerCommand | null {
  try {
    if (
      input.snapshot.fingerprint !==
        fingerprintWrongQuestionOrganizerOwnerSnapshot(input.snapshot) ||
      input.decisions.length < 1 ||
      input.decisions.length > input.snapshot.targetWrongQuestionIds.length
    ) {
      return null;
    }

    const targetIds = new Set(input.snapshot.targetWrongQuestionIds);
    const questionIds = new Set(
      input.snapshot.wrongQuestions.map(({ id }) => id),
    );
    const deckById = new Map(
      input.snapshot.decks.map((deck) => [deck.id, deck]),
    );
    const seen = new Set<string>();
    const entries: WrongQuestionOrganizerCommandEntry[] = [];

    for (const decision of input.decisions) {
      if (
        !isNonEmptyString(decision.wrongQuestionId) ||
        !targetIds.has(decision.wrongQuestionId) ||
        !questionIds.has(decision.wrongQuestionId) ||
        seen.has(decision.wrongQuestionId) ||
        typeof decision.force !== 'boolean' ||
        !isSafePolicyResult(decision.result)
      ) {
        return null;
      }
      seen.add(decision.wrongQuestionId);

      const matchedDeckId = decision.result.matchedDeckId;
      let deck: WrongQuestionOrganizerCommandEntry['deck'];
      if (matchedDeckId !== undefined) {
        const matched = deckById.get(matchedDeckId);
        if (!matched || matched.subject !== decision.result.subjectKey)
          return null;
        deck = Object.freeze({ action: 'reuse' as const, id: matched.id });
      } else {
        deck = Object.freeze({
          action: 'create' as const,
          name: decision.result.deckName,
          description: decision.result.deckDescription,
          confidence: decision.result.confidence,
        });
      }

      entries.push(
        Object.freeze({
          wrongQuestionId: decision.wrongQuestionId,
          force: decision.force,
          subject: Object.freeze({
            key: decision.result.subjectKey,
            displayName: decision.result.subjectDisplayName,
          }),
          deck,
          reason: decision.result.reason,
          confidence: decision.result.confidence,
          signals: Object.freeze([...decision.result.signals]),
        }),
      );
    }

    return Object.freeze({
      version: WRONG_QUESTION_ORGANIZER_COMMAND_VERSION,
      ownerHash: input.snapshot.ownerHash,
      snapshotFingerprint: input.snapshot.fingerprint,
      entries: Object.freeze(entries),
    });
  } catch {
    return null;
  }
}

@Injectable()
export class WrongQuestionOrganizerCommandExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotSource: WrongQuestionOrganizerOwnerSnapshotSource,
  ) {}

  async execute(input: {
    userId: string;
    ownerHashSecret: string;
    snapshot: WrongQuestionOrganizerOwnerSnapshot;
    command: WrongQuestionOrganizerCommand;
  }): Promise<WrongQuestionOrganizerCommandResult> {
    if (!commandMatchesSnapshot(input.command, input.snapshot))
      return staleResult();

    const runTransaction = () =>
      this.prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${input.snapshot.ownerHash}, 0)
            )
          `;

          const current = await this.snapshotSource.revalidate(transaction, {
            userId: input.userId,
            ownerHashSecret: input.ownerHashSecret,
            snapshot: input.snapshot,
          });
          if (!current) {
            return this.readAuthority(transaction, input.userId, input.command);
          }

          const existingItems =
            await transaction.wrongQuestionDeckItem.findMany({
              where: {
                userId: input.userId,
                wrongQuestionId: {
                  in: input.command.entries.map(
                    ({ wrongQuestionId }) => wrongQuestionId,
                  ),
                },
              },
              include: { deck: { include: { subjectGroup: true } } },
              orderBy: [
                { wrongQuestionId: 'asc' },
                { createdAt: 'asc' },
                { id: 'asc' },
              ],
            });
          const existingByQuestionId = new Map(
            existingItems.map((item) => [item.wrongQuestionId, item]),
          );
          const authoritative = input.command.entries
            .filter(
              (entry) =>
                !entry.force && existingByQuestionId.has(entry.wrongQuestionId),
            )
            .map((entry) => ({
              wrongQuestionId: entry.wrongQuestionId,
              item: existingByQuestionId.get(entry.wrongQuestionId)!,
            }));
          if (authoritative.length > 0) {
            return Object.freeze({
              status: 'authority' as const,
              entries: Object.freeze(
                authoritative.map((entry) => Object.freeze(entry)),
              ),
            });
          }

          const reusedDecks = new Map<string, AppliedDeck>();
          for (const entry of input.command.entries) {
            if (entry.deck.action !== 'reuse' || reusedDecks.has(entry.deck.id))
              continue;
            const deck = await transaction.wrongQuestionDeck.findFirst({
              where: {
                id: entry.deck.id,
                userId: input.userId,
                subjectGroup: { subject: entry.subject.key },
              },
            });
            if (!deck) return staleResult();
            reusedDecks.set(deck.id, deck);
          }

          const groups = new Map<
            string,
            { value: AppliedGroup; created: boolean }
          >();
          const results: Array<
            Extract<
              WrongQuestionOrganizerCommandResult,
              { status: 'applied' }
            >['entries'][number]
          > = [];

          for (const entry of input.command.entries) {
            let groupState = groups.get(entry.subject.key);
            if (!groupState) {
              const existingGroup =
                await transaction.wrongQuestionSubjectGroup.findFirst({
                  where: { userId: input.userId, subject: entry.subject.key },
                });
              const group = await transaction.wrongQuestionSubjectGroup.upsert({
                where: {
                  userId_subject: {
                    userId: input.userId,
                    subject: entry.subject.key,
                  },
                },
                update: { displayName: entry.subject.displayName },
                create: {
                  userId: input.userId,
                  subject: entry.subject.key,
                  displayName: entry.subject.displayName,
                },
              });
              groupState = { value: group, created: existingGroup === null };
              groups.set(entry.subject.key, groupState);
            }

            let deck: AppliedDeck;
            let createdDeck = false;
            if (entry.deck.action === 'reuse') {
              const reused = reusedDecks.get(entry.deck.id);
              if (!reused || reused.subjectGroupId !== groupState.value.id) {
                throw new StaleCommandError();
              }
              deck = reused;
            } else {
              // Exact authority is queried without a window so an older deck cannot
              // fall outside the bounded canonical-variant scan and be duplicated.
              const exactDeck = await transaction.wrongQuestionDeck.findFirst({
                where: {
                  userId: input.userId,
                  subjectGroupId: groupState.value.id,
                  name: entry.deck.name,
                },
              });
              const existingDecks = exactDeck
                ? []
                : await transaction.wrongQuestionDeck.findMany({
                    where: {
                      userId: input.userId,
                      subjectGroupId: groupState.value.id,
                    },
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    take: MAX_DECKS_IN_WRITE_PREFLIGHT + 1,
                  });
              const topicKey = canonicalTopic(entry.deck.name);
              const existingDeck =
                exactDeck ??
                existingDecks
                  .slice(0, MAX_DECKS_IN_WRITE_PREFLIGHT)
                  .find(({ name }) => canonicalTopic(name) === topicKey);
              if (existingDeck) {
                deck = existingDeck;
              } else if (existingDecks.length > MAX_DECKS_IN_WRITE_PREFLIGHT) {
                // The exact-name lookup above is unbounded, while canonical
                // variants stay bounded so the write transaction remains short.
                // If the owner exceeds that bounded window, fail closed instead
                // of creating a topic that could duplicate an older variant.
                throw new StaleCommandError();
              } else {
                deck = await transaction.wrongQuestionDeck.create({
                  data: {
                    userId: input.userId,
                    subjectGroupId: groupState.value.id,
                    name: entry.deck.name,
                    description: entry.deck.description,
                    source: 'AI',
                    nameLocked: false,
                    confidence: entry.deck.confidence,
                  },
                });
                createdDeck = true;
              }
            }

            const existingItem = existingByQuestionId.get(
              entry.wrongQuestionId,
            );
            if (entry.force) {
              await transaction.wrongQuestionDeckItem.deleteMany({
                where: {
                  userId: input.userId,
                  wrongQuestionId: entry.wrongQuestionId,
                  deckId: { not: deck.id },
                },
              });
            }
            const item = await transaction.wrongQuestionDeckItem.upsert({
              where: {
                userId_wrongQuestionId: {
                  userId: input.userId,
                  wrongQuestionId: entry.wrongQuestionId,
                },
              },
              update: {
                deckId: deck.id,
                reason: entry.reason,
                confidence: entry.confidence,
                source: 'AI',
              },
              create: {
                userId: input.userId,
                deckId: deck.id,
                wrongQuestionId: entry.wrongQuestionId,
                reason: entry.reason,
                confidence: entry.confidence,
                source: 'AI',
              },
            });
            results.push(
              Object.freeze({
                wrongQuestionId: entry.wrongQuestionId,
                subjectGroup: groupState.value,
                deck,
                item,
                createdSubjectGroup: groupState.created,
                createdDeck,
                createdItem: existingItem === undefined,
                reason: entry.reason,
                confidence: entry.confidence,
              }),
            );
            groupState = { ...groupState, created: false };
            groups.set(entry.subject.key, groupState);
          }

          return Object.freeze({
            status: 'applied' as const,
            entries: Object.freeze(results),
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: TRANSACTION_MAX_WAIT_MS,
          timeout: TRANSACTION_TIMEOUT_MS,
        },
      );

    for (
      let attempt = 1;
      attempt <= MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await runTransaction();
      } catch (error) {
        if (error instanceof StaleCommandError) return staleResult();
        if (
          attempt === MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS ||
          !isRetryableSerializableTransactionError(error)
        ) {
          throw error;
        }
      }
    }
    return staleResult();
  }

  private async readAuthority(
    transaction: Prisma.TransactionClient,
    userId: string,
    command: WrongQuestionOrganizerCommand,
  ): Promise<WrongQuestionOrganizerCommandResult> {
    const items = await transaction.wrongQuestionDeckItem.findMany({
      where: {
        userId,
        wrongQuestionId: {
          in: command.entries.map(({ wrongQuestionId }) => wrongQuestionId),
        },
      },
      include: { deck: { include: { subjectGroup: true } } },
      orderBy: [
        { wrongQuestionId: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });
    const itemByQuestionId = new Map(
      items.map((item) => [item.wrongQuestionId, item]),
    );
    const entries = command.entries.flatMap((entry) => {
      const item = itemByQuestionId.get(entry.wrongQuestionId);
      return item ? [{ wrongQuestionId: entry.wrongQuestionId, item }] : [];
    });
    if (entries.length === 0) return staleResult();
    return Object.freeze({
      status: 'authority' as const,
      entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    });
  }
}

function commandMatchesSnapshot(
  command: WrongQuestionOrganizerCommand,
  snapshot: WrongQuestionOrganizerOwnerSnapshot,
): boolean {
  try {
    return (
      command.version === WRONG_QUESTION_ORGANIZER_COMMAND_VERSION &&
      command.ownerHash === snapshot.ownerHash &&
      command.snapshotFingerprint === snapshot.fingerprint &&
      snapshot.fingerprint ===
        fingerprintWrongQuestionOrganizerOwnerSnapshot(snapshot) &&
      command.entries.length > 0
    );
  } catch {
    return false;
  }
}

function isSafePolicyResult(value: WrongQuestionOrganizerResult): boolean {
  return (
    isNonEmptyString(value.subjectKey) &&
    isNonEmptyString(value.subjectDisplayName) &&
    isNonEmptyString(value.deckName) &&
    isNonEmptyString(value.deckDescription) &&
    isNonEmptyString(value.reason) &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    Array.isArray(value.signals) &&
    value.signals.every(isNonEmptyString) &&
    (value.matchedDeckId === undefined || isNonEmptyString(value.matchedDeckId))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalTopic(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('zh-CN');
}

function staleResult(): WrongQuestionOrganizerCommandResult {
  return Object.freeze({
    status: 'stale' as const,
    entries: Object.freeze([]),
  });
}

function isRetryableSerializableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034';
  }
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === '40001' || code === 'P2034';
}

class StaleCommandError extends Error {
  constructor() {
    super('WRONG_QUESTION_ORGANIZER_COMMAND_STALE');
  }
}
