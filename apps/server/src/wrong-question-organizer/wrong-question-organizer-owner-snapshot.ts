import { createHash, createHmac } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppError } from '../common/errors/app-error';

export const WRONG_QUESTION_ORGANIZER_OWNER_SNAPSHOT_VERSION =
  'wrong-question-organizer-owner-snapshot-v1' as const;

const WRONG_QUESTION_ORGANIZER_POLICY_VERSION =
  'wrong-question-organizer-policy-v1';
const WRONG_QUESTION_ORGANIZER_PROJECTION_VERSION =
  'wrong-question-organizer-model-projection-v1';
const OWNER_HASH_DOMAIN = `${WRONG_QUESTION_ORGANIZER_OWNER_SNAPSHOT_VERSION}\0owner\0`;
const MAX_TARGET_WRONG_QUESTIONS = 12;
const MAX_SUBJECT_GROUPS = 20;
const MAX_DECKS = 20;
const MAX_DECK_ITEMS_FOR_KEYWORDS = 20;
const MAX_DECK_KEYWORDS = 8;

export type WrongQuestionOrganizerOwnerWrongQuestion = Readonly<{
  id: string;
  source: 'OCR' | 'MANUAL' | 'CHAT';
  sourceRecordId: string | null;
  sourceGroupId: string | null;
  questionText: string;
  subject: string;
  category: string;
  knowledgePoints: readonly string[];
  analysis: string;
  answer: string;
  errorType: string | null;
  userNote: string | null;
  rawContent: string | null;
  status: 'UNRESOLVED' | 'RESOLVED';
  createdAt: string;
  updatedAt: string;
}>;

export type WrongQuestionOrganizerOwnerSubjectGroup = Readonly<{
  id: string;
  subject: string;
  displayName: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}>;

export type WrongQuestionOrganizerOwnerDeck = Readonly<{
  id: string;
  subjectGroupId: string;
  subject: string;
  name: string;
  description: string | null;
  source: 'AI' | 'USER' | 'SYSTEM';
  nameLocked: boolean;
  confidence: number;
  keywords: readonly string[];
  createdAt: string;
  updatedAt: string;
}>;

export type WrongQuestionOrganizerOwnerItem = Readonly<{
  id: string;
  deckId: string;
  wrongQuestionId: string;
  reason: string | null;
  confidence: number;
  source: 'AI' | 'USER' | 'SYSTEM';
  createdAt: string;
  updatedAt: string;
}>;

export type WrongQuestionOrganizerOwnerSnapshotMaterial = Readonly<{
  version: typeof WRONG_QUESTION_ORGANIZER_OWNER_SNAPSHOT_VERSION;
  ownerHash: string;
  targetWrongQuestionIds: readonly string[];
  wrongQuestions: readonly WrongQuestionOrganizerOwnerWrongQuestion[];
  subjectGroups: readonly WrongQuestionOrganizerOwnerSubjectGroup[];
  decks: readonly WrongQuestionOrganizerOwnerDeck[];
  items: readonly WrongQuestionOrganizerOwnerItem[];
}>;

export type WrongQuestionOrganizerOwnerSnapshot = Readonly<
  WrongQuestionOrganizerOwnerSnapshotMaterial & { fingerprint: string }
>;

export type WrongQuestionOrganizerOwnerSnapshotLoadInput = Readonly<{
  userId: string;
  ownerHashSecret: string;
  wrongQuestionIds: readonly string[];
}>;

export type WrongQuestionOrganizerOwnerSnapshotRevalidateInput = Readonly<{
  userId: string;
  ownerHashSecret: string;
  snapshot: WrongQuestionOrganizerOwnerSnapshot;
}>;

type SnapshotPrisma = Pick<
  Prisma.TransactionClient,
  | '$executeRawUnsafe'
  | 'wrongQuestion'
  | 'wrongQuestionDeckItem'
  | 'wrongQuestionSubjectGroup'
  | 'wrongQuestionDeck'
>;

const WRONG_QUESTION_SELECT = {
  id: true,
  source: true,
  sourceRecordId: true,
  sourceGroupId: true,
  questionText: true,
  subject: true,
  category: true,
  knowledgePoints: true,
  analysis: true,
  answer: true,
  errorType: true,
  userNote: true,
  rawContent: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WrongQuestionSelect;

const SUBJECT_GROUP_SELECT = {
  id: true,
  subject: true,
  displayName: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WrongQuestionSubjectGroupSelect;

const DECK_SELECT = {
  id: true,
  subjectGroupId: true,
  name: true,
  description: true,
  source: true,
  nameLocked: true,
  confidence: true,
  createdAt: true,
  updatedAt: true,
  subjectGroup: { select: { subject: true } },
  items: {
    select: {
      id: true,
      createdAt: true,
      wrongQuestion: {
        select: {
          knowledgePoints: true,
          category: true,
          errorType: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    take: MAX_DECK_ITEMS_FOR_KEYWORDS,
  },
} satisfies Prisma.WrongQuestionDeckSelect;

const ITEM_SELECT = {
  id: true,
  deckId: true,
  wrongQuestionId: true,
  reason: true,
  confidence: true,
  source: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WrongQuestionDeckItemSelect;

type WrongQuestionRow = Prisma.WrongQuestionGetPayload<{
  select: typeof WRONG_QUESTION_SELECT;
}>;
type SubjectGroupRow = Prisma.WrongQuestionSubjectGroupGetPayload<{
  select: typeof SUBJECT_GROUP_SELECT;
}>;
type DeckRow = Prisma.WrongQuestionDeckGetPayload<{
  select: typeof DECK_SELECT;
}>;
type ItemRow = Prisma.WrongQuestionDeckItemGetPayload<{
  select: typeof ITEM_SELECT;
}>;

@Injectable()
export class WrongQuestionOrganizerOwnerSnapshotSource {
  async load(
    transaction: SnapshotPrisma,
    input: WrongQuestionOrganizerOwnerSnapshotLoadInput,
  ): Promise<WrongQuestionOrganizerOwnerSnapshot> {
    const scope = validateScope(input);
    await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return this.readSnapshot(
      transaction,
      input.userId,
      input.ownerHashSecret,
      scope,
    );
  }

  async revalidate(
    prisma: Omit<SnapshotPrisma, '$executeRawUnsafe'>,
    input: WrongQuestionOrganizerOwnerSnapshotRevalidateInput,
  ): Promise<boolean> {
    try {
      const scope = validateScope({
        userId: input.userId,
        ownerHashSecret: input.ownerHashSecret,
        wrongQuestionIds: input.snapshot.targetWrongQuestionIds,
      });
      if (
        input.snapshot.version !==
          WRONG_QUESTION_ORGANIZER_OWNER_SNAPSHOT_VERSION ||
        input.snapshot.ownerHash !==
          hashWrongQuestionOrganizerOwner(
            input.userId,
            input.ownerHashSecret,
          ) ||
        input.snapshot.fingerprint !==
          fingerprintWrongQuestionOrganizerOwnerSnapshot(input.snapshot)
      ) {
        return false;
      }

      const fresh = await this.readSnapshot(
        prisma,
        input.userId,
        input.ownerHashSecret,
        scope,
      );
      return fresh.fingerprint === input.snapshot.fingerprint;
    } catch {
      return false;
    }
  }

  private async readSnapshot(
    prisma: Omit<SnapshotPrisma, '$executeRawUnsafe'>,
    userId: string,
    ownerHashSecret: string,
    targetWrongQuestionIds: readonly string[],
  ): Promise<WrongQuestionOrganizerOwnerSnapshot> {
    const [wrongQuestionRows, itemRows, groupRows, deckRows] =
      await Promise.all([
        prisma.wrongQuestion.findMany({
          where: { userId, id: { in: [...targetWrongQuestionIds] } },
          select: WRONG_QUESTION_SELECT,
        }),
        prisma.wrongQuestionDeckItem.findMany({
          where: {
            userId,
            wrongQuestionId: { in: [...targetWrongQuestionIds] },
          },
          select: ITEM_SELECT,
          orderBy: [
            { wrongQuestionId: 'asc' },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        }),
        prisma.wrongQuestionSubjectGroup.findMany({
          where: { userId },
          select: SUBJECT_GROUP_SELECT,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: MAX_SUBJECT_GROUPS,
        }),
        prisma.wrongQuestionDeck.findMany({
          where: { userId },
          select: DECK_SELECT,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: MAX_DECKS,
        }),
      ]);

    if (wrongQuestionRows.length !== targetWrongQuestionIds.length) {
      throwWrongQuestionNotFound();
    }
    const wrongQuestionById = new Map(
      (wrongQuestionRows as WrongQuestionRow[]).map((row) => [row.id, row]),
    );
    const orderedWrongQuestions = targetWrongQuestionIds.map((id) => {
      const row = wrongQuestionById.get(id);
      if (!row) throwWrongQuestionNotFound();
      return detachWrongQuestion(row);
    });

    const material: WrongQuestionOrganizerOwnerSnapshotMaterial = {
      version: WRONG_QUESTION_ORGANIZER_OWNER_SNAPSHOT_VERSION,
      ownerHash: hashWrongQuestionOrganizerOwner(userId, ownerHashSecret),
      targetWrongQuestionIds: [...targetWrongQuestionIds],
      wrongQuestions: orderedWrongQuestions,
      subjectGroups: (groupRows as SubjectGroupRow[]).map(detachSubjectGroup),
      decks: (deckRows as DeckRow[]).map(detachDeck),
      items: (itemRows as ItemRow[]).map(detachItem),
    };
    return deepFreezeSnapshot({
      ...material,
      fingerprint: fingerprintWrongQuestionOrganizerOwnerSnapshot(material),
    });
  }
}

export function fingerprintWrongQuestionOrganizerOwnerSnapshot(
  input: WrongQuestionOrganizerOwnerSnapshotMaterial,
): string {
  return `sha256:${createHash('sha256')
    .update(
      stableJson({
        snapshotVersion: input.version,
        policyVersion: WRONG_QUESTION_ORGANIZER_POLICY_VERSION,
        projectionVersion: WRONG_QUESTION_ORGANIZER_PROJECTION_VERSION,
        ownerHash: input.ownerHash,
        targetWrongQuestionIds: [...input.targetWrongQuestionIds],
        wrongQuestions: [...input.wrongQuestions].sort(byId),
        subjectGroups: [...input.subjectGroups].sort(byId),
        decks: [...input.decks]
          .map((deck) => ({ ...deck, keywords: [...deck.keywords] }))
          .sort(byId),
        items: [...input.items].sort(byId),
      }),
    )
    .digest('hex')}`;
}

function validateScope(
  input: WrongQuestionOrganizerOwnerSnapshotLoadInput,
): readonly string[] {
  if (!input.userId.trim()) {
    throw new Error('WRONG_QUESTION_ORGANIZER_OWNER_SCOPE_INVALID');
  }
  if (
    typeof input.ownerHashSecret !== 'string' ||
    input.ownerHashSecret.length < 16
  ) {
    throw new Error('WRONG_QUESTION_ORGANIZER_OWNER_SECRET_INVALID');
  }
  const rawIds: unknown = input.wrongQuestionIds;
  if (!isStringArray(rawIds)) {
    throw new Error('WRONG_QUESTION_ORGANIZER_TARGET_SCOPE_INVALID');
  }
  const ids: readonly string[] = rawIds;
  if (
    ids.length < 1 ||
    ids.length > MAX_TARGET_WRONG_QUESTIONS ||
    ids.some((id) => !id.trim()) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error('WRONG_QUESTION_ORGANIZER_TARGET_SCOPE_INVALID');
  }
  return Object.freeze(ids.map((id) => id));
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

export function hashWrongQuestionOrganizerOwner(
  userId: string,
  secret: string,
): string {
  if (!userId.trim()) {
    throw new Error('WRONG_QUESTION_ORGANIZER_OWNER_SCOPE_INVALID');
  }
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('WRONG_QUESTION_ORGANIZER_OWNER_SECRET_INVALID');
  }
  return `hmac-sha256:${createHmac('sha256', secret)
    .update(OWNER_HASH_DOMAIN)
    .update(userId)
    .digest('hex')}`;
}

function detachWrongQuestion(
  row: WrongQuestionRow,
): WrongQuestionOrganizerOwnerWrongQuestion {
  return {
    id: row.id,
    source: row.source,
    sourceRecordId: row.sourceRecordId,
    sourceGroupId: row.sourceGroupId,
    questionText: row.questionText,
    subject: row.subject,
    category: row.category,
    knowledgePoints: [...row.knowledgePoints],
    analysis: row.analysis,
    answer: row.answer,
    errorType: row.errorType,
    userNote: row.userNote,
    rawContent: row.rawContent,
    status: row.status,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function detachSubjectGroup(
  row: SubjectGroupRow,
): WrongQuestionOrganizerOwnerSubjectGroup {
  return {
    id: row.id,
    subject: row.subject,
    displayName: row.displayName,
    sortOrder: row.sortOrder,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function detachDeck(row: DeckRow): WrongQuestionOrganizerOwnerDeck {
  return {
    id: row.id,
    subjectGroupId: row.subjectGroupId,
    subject: row.subjectGroup.subject,
    name: row.name,
    description: row.description,
    source: row.source,
    nameLocked: row.nameLocked,
    confidence: row.confidence,
    keywords: collectDeckKeywords(row),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function detachItem(row: ItemRow): WrongQuestionOrganizerOwnerItem {
  return {
    id: row.id,
    deckId: row.deckId,
    wrongQuestionId: row.wrongQuestionId,
    reason: row.reason,
    confidence: row.confidence,
    source: row.source,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function collectDeckKeywords(row: DeckRow): string[] {
  const values = row.items.flatMap((item) => [
    ...item.wrongQuestion.knowledgePoints,
    item.wrongQuestion.category,
    item.wrongQuestion.errorType,
  ]);
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    keywords.push(normalized);
    if (keywords.length === MAX_DECK_KEYWORDS) break;
  }
  return keywords;
}

function toIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function byId<T extends { id: string }>(left: T, right: T): number {
  return compareCodeUnits(left.id, right.id);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreezeSnapshot(
  snapshot: WrongQuestionOrganizerOwnerSnapshot,
): WrongQuestionOrganizerOwnerSnapshot {
  return Object.freeze({
    ...snapshot,
    targetWrongQuestionIds: Object.freeze([...snapshot.targetWrongQuestionIds]),
    wrongQuestions: Object.freeze(
      snapshot.wrongQuestions.map((question) =>
        Object.freeze({
          ...question,
          knowledgePoints: Object.freeze([...question.knowledgePoints]),
        }),
      ),
    ),
    subjectGroups: Object.freeze(
      snapshot.subjectGroups.map((group) => Object.freeze({ ...group })),
    ),
    decks: Object.freeze(
      snapshot.decks.map((deck) =>
        Object.freeze({ ...deck, keywords: Object.freeze([...deck.keywords]) }),
      ),
    ),
    items: Object.freeze(
      snapshot.items.map((item) => Object.freeze({ ...item })),
    ),
  });
}

function throwWrongQuestionNotFound(): never {
  throw new WrongQuestionNotFoundError();
}

class WrongQuestionNotFoundError extends AppError {
  readonly status = HttpStatus.NOT_FOUND;

  constructor() {
    super('WRONG_QUESTION_NOT_FOUND', '错题不存在', HttpStatus.NOT_FOUND);
  }
}
