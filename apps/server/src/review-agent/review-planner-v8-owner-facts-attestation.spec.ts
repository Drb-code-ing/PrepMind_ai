import { createReviewPlannerV8OwnerFactsAttestor } from './review-planner-v8-product-acceptance-composition';

describe('V8 Review Planner owner facts attestation', () => {
  it('changes the digest and reports a write when an owner-scoped ReviewTask is added under a different id', async () => {
    const fixture = createFixture();
    const before = await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'before',
    });

    fixture.rows.reviewTask.push(
      owned('review-owner', {
        id: 'review-task-extra',
        userId: 'review-owner',
        cardId: 'review-card',
        reviewLogId: null,
        scheduledDate: '2026-07-19',
        dueAt: new Date('2026-07-19T00:00:00.000Z'),
        status: 'PENDING',
        source: 'FSRS',
        completedAt: null,
        skippedAt: null,
        createdAt: new Date('2026-07-18T00:00:00.000Z'),
        updatedAt: new Date('2026-07-18T00:00:00.000Z'),
      }),
    );

    const after = await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'after',
    });
    await readUnchangedPlannerSnapshots(fixture.attestor);

    expect(after).not.toBe(before);
    await expect(fixture.attestor.verifyOwnerIsolation()).resolves.toEqual({
      crossAccountInvisible: true,
      businessWrites: 1,
    });
  });

  it('changes the digest and reports a write when a fixed fixture scalar field changes', async () => {
    const fixture = createFixture();
    const before = await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'before',
    });
    const question = fixture.rows.wrongQuestion.find(
      (row) => row.value.id === 'review-question',
    );
    if (!question) throw new Error('test fixture missing');
    question.value.analysis = 'mutated acceptance fixture';

    const after = await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'after',
    });
    await readUnchangedPlannerSnapshots(fixture.attestor);

    expect(after).not.toBe(before);
    await expect(fixture.attestor.verifyOwnerIsolation()).resolves.toEqual({
      crossAccountInvisible: true,
      businessWrites: 1,
    });
  });

  it('excludes different-owner records from the digest and write count', async () => {
    const fixture = createFixture();
    const before = await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'before',
    });
    fixture.rows.reviewTask.push(
      owned('unrelated-owner', {
        ...fixture.rows.reviewTask[0].value,
        id: 'unrelated-task',
        userId: 'unrelated-owner',
      }),
    );
    const after = await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'after',
    });
    await readUnchangedPlannerSnapshots(fixture.attestor);

    expect(after).toBe(before);
    await expect(fixture.attestor.verifyOwnerIsolation()).resolves.toEqual({
      crossAccountInvisible: true,
      businessWrites: 0,
    });
  });

  it('hashes identical facts identically when Prisma returns them in a different order', async () => {
    const fixture = createFixture();
    fixture.rows.reviewTask.push(
      owned('review-owner', {
        ...fixture.rows.reviewTask[0].value,
        id: 'review-task-a',
        reviewLogId: null,
        scheduledDate: '2026-07-19',
      }),
    );
    const before = await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'before',
    });
    fixture.returnReverse = true;
    const after = await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'after',
    });

    expect(after).toBe(before);
  });

  it('counts added, removed, and modified owner records instead of hard-coding zero', async () => {
    const fixture = createFixture();
    await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'before',
    });
    await fixture.attestor.readFactsDigest({
      component: 'planner',
      phase: 'before',
    });

    fixture.rows.reviewTask.push(
      owned('review-owner', {
        ...fixture.rows.reviewTask[0].value,
        id: 'review-task-added',
        reviewLogId: null,
        scheduledDate: '2026-07-19',
      }),
    );
    fixture.rows.wrongQuestionDeck = fixture.rows.wrongQuestionDeck.filter(
      (row) => row.value.id !== 'review-deck',
    );
    const plannerPreference = fixture.rows.reviewPreference.find(
      (row) => row.ownerId === 'planner-owner',
    );
    if (!plannerPreference) throw new Error('test fixture missing');
    plannerPreference.value.dailyMinutes = 90;

    await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'after',
    });
    await fixture.attestor.readFactsDigest({
      component: 'planner',
      phase: 'after',
    });

    await expect(fixture.attestor.verifyOwnerIsolation()).resolves.toEqual({
      crossAccountInvisible: true,
      businessWrites: 3,
    });
  });

  it('freshly detects a review-owner write that occurs after its cached after snapshot', async () => {
    const fixture = createFixture();
    await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'before',
    });
    await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'after',
    });
    await fixture.attestor.readFactsDigest({
      component: 'planner',
      phase: 'before',
    });
    await fixture.attestor.readFactsDigest({
      component: 'planner',
      phase: 'after',
    });

    fixture.rows.reviewTask.push(
      owned('review-owner', {
        ...fixture.rows.reviewTask[0].value,
        id: 'review-task-after-cached-snapshot',
        reviewLogId: null,
        scheduledDate: '2026-07-20',
      }),
    );

    await expect(fixture.attestor.verifyOwnerIsolation()).resolves.toEqual({
      crossAccountInvisible: true,
      businessWrites: 1,
    });
  });

  it('fails closed when any component is missing a before or after snapshot', async () => {
    const fixture = createFixture();
    await fixture.attestor.readFactsDigest({
      component: 'review',
      phase: 'before',
    });

    await expect(fixture.attestor.verifyOwnerIsolation()).rejects.toThrow(
      'V8_PRODUCT_ACCEPTANCE_FACTS_SNAPSHOT_MISSING',
    );
  });
});

type ScalarRow = Record<string, unknown> & { id: string };
type OwnedRow = { ownerId: string; value: ScalarRow };
type TableName =
  | 'wrongQuestionSubjectGroup'
  | 'wrongQuestionDeck'
  | 'wrongQuestion'
  | 'wrongQuestionDeckItem'
  | 'card'
  | 'reviewLog'
  | 'reviewTask'
  | 'reviewPreference';
type Rows = Record<TableName, OwnedRow[]>;

function createFixture() {
  const rows = createRows();
  const fixture = { rows, returnReverse: false };
  const prisma = Object.fromEntries(
    (Object.keys(rows) as TableName[]).map((table) => [
      table,
      {
        findMany: jest.fn((input: { where: Record<string, unknown> }) => {
          const ownerId =
            table === 'reviewLog'
              ? (input.where.card as { userId: string }).userId
              : (input.where.userId as string);
          const result = fixture.rows[table]
            .filter((row) => row.ownerId === ownerId)
            .map((row) => ({ ...row.value }));
          return Promise.resolve(
            fixture.returnReverse ? result.reverse() : result,
          );
        }),
        count: jest.fn((input: { where: { id: string; userId: string } }) =>
          Promise.resolve(
            fixture.rows[table].filter(
              (row) =>
                row.value.id === input.where.id &&
                row.ownerId === input.where.userId,
            ).length,
          ),
        ),
      },
    ]),
  );
  const fixtureIds = Array.from(
    { length: 16 },
    (_, index) => `unused-${index}`,
  );
  fixtureIds[2] = 'review-question';
  fixtureIds[10] = 'planner-question';
  const attestor = createReviewPlannerV8OwnerFactsAttestor({
    prisma,
    accountIds: { review: 'review-owner', planner: 'planner-owner' },
    fixtureIds,
  });
  return { ...fixture, prisma, attestor };
}

async function readUnchangedPlannerSnapshots(
  attestor: ReturnType<typeof createReviewPlannerV8OwnerFactsAttestor>,
) {
  await attestor.readFactsDigest({ component: 'planner', phase: 'before' });
  await attestor.readFactsDigest({ component: 'planner', phase: 'after' });
}

function createRows(): Rows {
  const rows = Object.fromEntries(
    (
      Object.keys({
        wrongQuestionSubjectGroup: true,
        wrongQuestionDeck: true,
        wrongQuestion: true,
        wrongQuestionDeckItem: true,
        card: true,
        reviewLog: true,
        reviewTask: true,
        reviewPreference: true,
      }) as TableName[]
    ).map((table) => [table, []]),
  ) as Rows;
  for (const component of ['review', 'planner'] as const) {
    const ownerId = `${component}-owner`;
    const at = new Date('2026-07-18T00:00:00.000Z');
    rows.wrongQuestionSubjectGroup.push(
      owned(ownerId, {
        id: `${component}-group`,
        userId: ownerId,
        subject: 'math',
        displayName: 'Math',
        sortOrder: 0,
        createdAt: at,
        updatedAt: at,
      }),
    );
    rows.wrongQuestionDeck.push(
      owned(ownerId, {
        id: `${component}-deck`,
        userId: ownerId,
        subjectGroupId: `${component}-group`,
        name: 'Algebra',
        description: null,
        source: 'SYSTEM',
        nameLocked: false,
        confidence: 1,
        createdAt: at,
        updatedAt: at,
      }),
    );
    rows.wrongQuestion.push(
      owned(ownerId, {
        id: `${component}-question`,
        userId: ownerId,
        source: 'OCR',
        sourceRecordId: null,
        sourceGroupId: null,
        imageUrl: null,
        questionText: 'x + 1 = 2',
        subject: 'math',
        category: 'algebra',
        knowledgePoints: ['linear-equation'],
        analysis: 'acceptance fixture',
        answer: '1',
        errorType: null,
        userNote: null,
        rawContent: null,
        status: 'UNRESOLVED',
        createdAt: at,
        updatedAt: at,
      }),
    );
    rows.wrongQuestionDeckItem.push(
      owned(ownerId, {
        id: `${component}-item`,
        userId: ownerId,
        deckId: `${component}-deck`,
        wrongQuestionId: `${component}-question`,
        reason: null,
        confidence: 1,
        source: 'SYSTEM',
        createdAt: at,
        updatedAt: at,
      }),
    );
    rows.card.push(
      owned(ownerId, {
        id: `${component}-card`,
        userId: ownerId,
        questionId: null,
        wrongQuestionId: `${component}-question`,
        difficulty: 8,
        stability: 1,
        retrievability: 0.4,
        lastReview: at,
        nextReview: at,
        reviewCount: 2,
        lapses: 1,
        state: 'REVIEW',
        suspendedAt: null,
        createdAt: at,
        updatedAt: at,
      }),
    );
    rows.reviewLog.push(
      owned(ownerId, {
        id: `${component}-log`,
        cardId: `${component}-card`,
        rating: 2,
        scheduledDays: 1,
        elapsedDays: 2,
        reviewDurationMs: null,
        stabilityBefore: 0.8,
        stabilityAfter: 1,
        difficultyBefore: 7.5,
        difficultyAfter: 8,
        reviewedAt: at,
        clientMutationId: null,
      }),
    );
    rows.reviewTask.push(
      owned(ownerId, {
        id: `${component}-task`,
        userId: ownerId,
        cardId: `${component}-card`,
        reviewLogId: `${component}-log`,
        scheduledDate: '2026-07-18',
        dueAt: at,
        status: 'COMPLETED',
        source: 'FSRS',
        completedAt: at,
        skippedAt: null,
        createdAt: at,
        updatedAt: at,
      }),
    );
    rows.reviewPreference.push(
      owned(ownerId, {
        id: `${component}-preference`,
        userId: ownerId,
        dailyMinutes: 25,
        dailyCardLimit: 12,
        preferredReviewTime: '20:30',
        reminderEnabled: true,
        reminderLeadMinutes: 30,
        weekendMode: 'same',
        planWindowDays: 7,
        createdAt: at,
        updatedAt: at,
      }),
    );
  }
  return rows;
}

function owned(ownerId: string, value: ScalarRow): OwnedRow {
  return { ownerId, value };
}
