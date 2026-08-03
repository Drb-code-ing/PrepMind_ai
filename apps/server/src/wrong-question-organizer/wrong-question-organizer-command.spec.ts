import { Prisma } from '@prisma/client';

import {
  buildWrongQuestionOrganizerCommand,
  WrongQuestionOrganizerCommandExecutor,
} from './wrong-question-organizer-command';
import {
  fingerprintWrongQuestionOrganizerOwnerSnapshot,
  type WrongQuestionOrganizerOwnerSnapshot,
} from './wrong-question-organizer-owner-snapshot';

const NOW = '2026-07-23T00:00:00.000Z';
const OWNER_SECRET = 'snapshot-secret-at-least-16-bytes';

describe('WrongQuestionOrganizerCommandExecutor', () => {
  const material = {
    version: 'wrong-question-organizer-owner-snapshot-v1' as const,
    ownerHash: `hmac-sha256:${'a'.repeat(64)}`,
    targetWrongQuestionIds: ['wrong_1'],
    wrongQuestions: [
      {
        id: 'wrong_1',
        source: 'OCR' as const,
        sourceRecordId: null,
        sourceGroupId: null,
        questionText: '计算闭合曲线积分。',
        subject: '高等数学',
        category: '曲线积分',
        knowledgePoints: ['格林公式'],
        analysis: '使用格林公式。',
        answer: '12',
        errorType: '概念混淆',
        userNote: null,
        rawContent: null,
        status: 'UNRESOLVED' as const,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    subjectGroups: [],
    decks: [],
    items: [],
  };
  const snapshot = {
    ...material,
    fingerprint: fingerprintWrongQuestionOrganizerOwnerSnapshot(material),
  } satisfies WrongQuestionOrganizerOwnerSnapshot;
  const policy = {
    subjectKey: '高等数学',
    subjectDisplayName: '高等数学',
    deckName: '格林公式',
    deckDescription: '用于整理高等数学中的格林公式相关错题。',
    reason: '根据知识点归入「格林公式」。',
    confidence: 0.86,
    signals: ['knowledgePoint'],
  };

  function buildCommand() {
    const command = buildWrongQuestionOrganizerCommand({
      snapshot,
      decisions: [{ wrongQuestionId: 'wrong_1', force: false, result: policy }],
    });
    expect(command).not.toBeNull();
    return command!;
  }

  it('builds a deeply frozen model-free command bound to the snapshot', () => {
    const command = buildCommand();

    expect(command.snapshotFingerprint).toBe(snapshot.fingerprint);
    expect(command.ownerHash).toBe(snapshot.ownerHash);
    expect(command.entries).toHaveLength(1);
    expect(command.entries[0]).toMatchObject({
      wrongQuestionId: 'wrong_1',
      force: false,
      deck: { action: 'create', name: '格林公式' },
    });
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(command.entries)).toBe(true);
    expect(JSON.stringify(command)).not.toMatch(
      /prompt|provider|apiKey|userId/iu,
    );
  });

  it('rejects a forged matched deck that is absent from the owner snapshot', () => {
    expect(
      buildWrongQuestionOrganizerCommand({
        snapshot,
        decisions: [
          {
            wrongQuestionId: 'wrong_1',
            force: false,
            result: { ...policy, matchedDeckId: 'cross_owner_deck' },
          },
        ],
      }),
    ).toBeNull();
  });

  it('locks by owner, revalidates inside the write transaction, and applies only local commands', async () => {
    const events: string[] = [];
    const group = {
      id: 'group_1',
      userId: 'user_1',
      subject: '高等数学',
      displayName: '高等数学',
      sortOrder: 0,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    };
    const deck = {
      id: 'deck_1',
      userId: 'user_1',
      subjectGroupId: 'group_1',
      name: '格林公式',
      description: policy.deckDescription,
      source: 'AI' as const,
      nameLocked: false,
      confidence: 0.86,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    };
    const item = {
      id: 'item_1',
      userId: 'user_1',
      deckId: 'deck_1',
      wrongQuestionId: 'wrong_1',
      reason: policy.reason,
      confidence: 0.86,
      source: 'AI' as const,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    };
    const tx = {
      $executeRaw: jest.fn(() => {
        events.push('lock');
        return Promise.resolve(0);
      }),
      wrongQuestionSubjectGroup: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(group),
      },
      wrongQuestionDeck: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue(deck),
      },
      wrongQuestionDeckItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue(item),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
    const snapshotSource = {
      revalidate: jest.fn(() => {
        events.push('revalidate');
        return Promise.resolve(true);
      }),
    };
    const executor = new WrongQuestionOrganizerCommandExecutor(
      prisma as never,
      snapshotSource as never,
    );

    const result = await executor.execute({
      userId: 'user_1',
      ownerHashSecret: OWNER_SECRET,
      snapshot,
      command: buildCommand(),
    });

    expect(events).toEqual(['lock', 'revalidate']);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 2_000,
      timeout: 5_000,
    });
    expect(tx.wrongQuestionSubjectGroup.upsert).toHaveBeenCalled();
    expect(tx.wrongQuestionDeck.create).toHaveBeenCalled();
    expect(tx.wrongQuestionDeckItem.upsert).toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'applied',
      entries: [{ createdDeck: true }],
    });
  });

  it('returns current user authority without writing when the third fence is stale', async () => {
    const authoritative = {
      id: 'item_user',
      userId: 'user_1',
      deckId: 'deck_user',
      wrongQuestionId: 'wrong_1',
      reason: '用户手动归入专题。',
      confidence: 1,
      source: 'USER' as const,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
      deck: {
        id: 'deck_user',
        userId: 'user_1',
        subjectGroupId: 'group_user',
        name: '用户专题',
        description: null,
        source: 'USER' as const,
        nameLocked: true,
        confidence: 1,
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
        subjectGroup: {
          id: 'group_user',
          userId: 'user_1',
          subject: '高等数学',
          displayName: '高等数学',
          sortOrder: 0,
          createdAt: new Date(NOW),
          updatedAt: new Date(NOW),
        },
      },
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      wrongQuestionDeckItem: {
        findMany: jest.fn().mockResolvedValue([authoritative]),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      wrongQuestionSubjectGroup: { findFirst: jest.fn(), upsert: jest.fn() },
      wrongQuestionDeck: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
    const executor = new WrongQuestionOrganizerCommandExecutor(
      prisma as never,
      { revalidate: jest.fn().mockResolvedValue(false) } as never,
    );

    const result = await executor.execute({
      userId: 'user_1',
      ownerHashSecret: OWNER_SECRET,
      snapshot,
      command: buildCommand(),
    });

    expect(result).toMatchObject({
      status: 'authority',
      entries: [{ item: authoritative }],
    });
    expect(tx.wrongQuestionSubjectGroup.upsert).not.toHaveBeenCalled();
    expect(tx.wrongQuestionDeck.create).not.toHaveBeenCalled();
    expect(tx.wrongQuestionDeckItem.upsert).not.toHaveBeenCalled();
  });

  it('reuses an exact older topic even when it is outside the bounded variant scan', async () => {
    const group = {
      id: 'group_1',
      userId: 'user_1',
      subject: '高等数学',
      displayName: '高等数学',
      sortOrder: 0,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    };
    const olderDeck = {
      id: 'deck_older_than_window',
      userId: 'user_1',
      subjectGroupId: group.id,
      name: '格林公式',
      description: policy.deckDescription,
      source: 'AI' as const,
      nameLocked: false,
      confidence: 0.86,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    };
    const createdItem = {
      id: 'item_older_deck',
      userId: 'user_1',
      deckId: olderDeck.id,
      wrongQuestionId: 'wrong_1',
      reason: policy.reason,
      confidence: policy.confidence,
      source: 'AI' as const,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      wrongQuestionSubjectGroup: {
        findFirst: jest.fn().mockResolvedValue(group),
        upsert: jest.fn().mockResolvedValue(group),
      },
      wrongQuestionDeck: {
        findFirst: jest.fn().mockResolvedValue(olderDeck),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      wrongQuestionDeckItem: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue(createdItem),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
    const executor = new WrongQuestionOrganizerCommandExecutor(
      prisma as never,
      { revalidate: jest.fn().mockResolvedValue(true) } as never,
    );

    const result = await executor.execute({
      userId: 'user_1',
      ownerHashSecret: OWNER_SECRET,
      snapshot,
      command: buildCommand(),
    });

    expect(tx.wrongQuestionDeck.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        subjectGroupId: group.id,
        name: '格林公式',
      },
    });
    expect(tx.wrongQuestionDeck.findMany).not.toHaveBeenCalled();
    expect(tx.wrongQuestionDeck.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'applied',
      entries: [{ deck: olderDeck, createdDeck: false }],
    });
  });

  it('fails closed instead of duplicating a canonical topic beyond the bounded scan', async () => {
    const group = {
      id: 'group_1',
      userId: 'user_1',
      subject: '高等数学',
      displayName: '高等数学',
      sortOrder: 0,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    };
    const recentDecks = Array.from({ length: 100 }, (_, index) => ({
      id: `deck_${String(index).padStart(3, '0')}`,
      userId: 'user_1',
      subjectGroupId: group.id,
      name: `专题 ${index}`,
      description: null,
      source: 'AI' as const,
      nameLocked: false,
      confidence: 0.8,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    }));
    const olderCanonicalVariant = {
      ...recentDecks[0],
      id: 'deck_older_variant',
      name: 'ＧＲＥＥＮ　ＦＯＲＭＵＬＡ',
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      wrongQuestionSubjectGroup: {
        findFirst: jest.fn().mockResolvedValue(group),
        upsert: jest.fn().mockResolvedValue(group),
      },
      wrongQuestionDeck: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest
          .fn()
          .mockResolvedValue([...recentDecks, olderCanonicalVariant]),
        create: jest.fn(),
      },
      wrongQuestionDeckItem: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
    const executor = new WrongQuestionOrganizerCommandExecutor(
      prisma as never,
      { revalidate: jest.fn().mockResolvedValue(true) } as never,
    );
    const command = buildWrongQuestionOrganizerCommand({
      snapshot,
      decisions: [
        {
          wrongQuestionId: 'wrong_1',
          force: false,
          result: {
            ...policy,
            deckName: 'Green Formula',
            deckDescription: 'Green Formula topic.',
          },
        },
      ],
    });
    expect(command).not.toBeNull();

    const result = await executor.execute({
      userId: 'user_1',
      ownerHashSecret: OWNER_SECRET,
      snapshot,
      command: command!,
    });

    expect(tx.wrongQuestionDeck.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 }),
    );
    expect(tx.wrongQuestionDeck.create).not.toHaveBeenCalled();
    expect(tx.wrongQuestionDeckItem.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'stale', entries: [] });
  });

  it('retries only the bounded database transaction on serialization conflicts', async () => {
    const prisma = {
      $transaction: jest
        .fn()
        .mockRejectedValueOnce({ code: '40001' })
        .mockResolvedValueOnce({ status: 'stale', entries: [] }),
    };
    const executor = new WrongQuestionOrganizerCommandExecutor(
      prisma as never,
      { revalidate: jest.fn() } as never,
    );

    await expect(
      executor.execute({
        userId: 'user_1',
        ownerHashSecret: OWNER_SECRET,
        snapshot,
        command: buildCommand(),
      }),
    ).resolves.toEqual({ status: 'stale', entries: [] });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
