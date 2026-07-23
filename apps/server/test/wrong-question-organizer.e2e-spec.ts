import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import {
  WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME,
  type WrongQuestionOrganizerModelRuntimeBundle,
} from '../src/wrong-question-organizer/wrong-question-organizer-model-runtime.factory';

describe('WrongQuestionOrganizerController (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let organizerRuntime: WrongQuestionOrganizerModelRuntimeBundle;
  let previousOrganizerGate: string | undefined;
  const emails: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
    process.env.DATABASE_URL ??=
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';
    previousOrganizerGate =
      process.env.WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED;
    process.env.WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();

    server = app.getHttpServer();
    prisma = app.get(PrismaService);
    organizerRuntime = app.get(WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME);
  });

  afterAll(async () => {
    if (emails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: emails } },
      });
    }

    if (previousOrganizerGate === undefined) {
      delete process.env.WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED;
    } else {
      process.env.WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED =
        previousOrganizerGate;
    }

    await app?.close();
  });

  it('organizes wrong questions into subject groups and decks', async () => {
    const user = await registerUser('organize-flow');
    const first = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-flow-a-${Date.now()}`,
      questionText: '计算闭合曲线上的第二型曲线积分。',
    });
    const second = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-flow-b-${Date.now()}`,
      questionText: '用格林公式计算区域边界积分。',
    });

    await organize(user.accessToken, first.id);
    await organize(user.accessToken, second.id);

    const groupResponse = await request(server)
      .get('/wrong-question-groups')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const groups =
      getSuccessData<WrongQuestionGroupListResponse>(groupResponse);

    expect(groups.items).toHaveLength(1);
    expect(groups.items[0]).toMatchObject({
      subject: '高等数学',
      totalCount: 2,
      unresolvedCount: 2,
      resolvedCount: 0,
      deckCount: 1,
    });

    const deckResponse = await request(server)
      .get(`/wrong-question-groups/${groups.items[0].id}/decks`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const decks = getSuccessData<WrongQuestionDeckListResponse>(deckResponse);

    expect(decks.items).toHaveLength(1);
    expect(decks.items[0]).toMatchObject({
      name: '格林公式',
      totalCount: 2,
      unresolvedCount: 2,
    });

    const questionResponse = await request(server)
      .get(`/wrong-question-decks/${decks.items[0].id}/questions`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const questions =
      getSuccessData<WrongQuestionDeckQuestionListResponse>(questionResponse);

    expect(questions.total).toBe(2);
    expect(questions.items.map((item) => item.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it('keeps the batch endpoint default-off with local writes and zero model traces', async () => {
    const user = await registerUser('organizer-batch-default-off');
    const first = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-batch-a-${Date.now()}`,
      questionText: '批量整理：判断格林公式的积分方向。',
    });
    const second = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-batch-b-${Date.now()}`,
      questionText: '批量整理：使用格林公式计算闭合曲线积分。',
    });

    expect(organizerRuntime.config.enabled).toBe(false);
    const response = await request(server)
      .post('/wrong-question-organizer/organize-batch')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ limit: 2 })
      .expect(201);
    const result = getSuccessData<OrganizeWrongQuestionBatchResponse>(response);

    expect(result).toMatchObject({
      organizedCount: 2,
      skippedCount: 0,
      runtime: {
        source: 'local_deterministic',
        disposition: 'gate_disabled',
        degraded: false,
      },
    });
    expect(result.items.map(({ item }) => item.wrongQuestionId).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    await expect(
      prisma.agentTraceRun.count({ where: { userId: user.userId } }),
    ).resolves.toBe(0);
  });

  it('keeps user isolation for groups and decks', async () => {
    const owner = await registerUser('organizer-owner');
    const other = await registerUser('organizer-other');
    const wrongQuestion = await createWrongQuestion(owner.accessToken, {
      sourceGroupId: `organizer-isolation-${Date.now()}`,
    });
    const organized = await organize(owner.accessToken, wrongQuestion.id);

    await request(server)
      .get(`/wrong-question-decks/${organized.deck.id}/questions`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(404)
      .expect((response) => {
        const body = getErrorBody(response);
        expect(body.error.code).toBe('WRONG_QUESTION_DECK_NOT_FOUND');
      });
  });

  it('locks renamed deck names against later organize calls', async () => {
    const user = await registerUser('organizer-locked-name');
    const first = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-lock-a-${Date.now()}`,
    });
    const second = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-lock-b-${Date.now()}`,
      questionText: '继续练习格林公式边界方向判断。',
    });

    const organized = await organize(user.accessToken, first.id);

    const updateResponse = await request(server)
      .patch(`/wrong-question-decks/${organized.deck.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ name: '我的格林公式专题', nameLocked: true })
      .expect(200);
    const updated = getSuccessData<WrongQuestionDeckResponse>(updateResponse);
    expect(updated.name).toBe('我的格林公式专题');
    expect(updated.nameLocked).toBe(true);

    await organize(user.accessToken, second.id);

    const deckResponse = await request(server)
      .get(`/wrong-question-groups/${organized.subjectGroup.id}/decks`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    const decks = getSuccessData<WrongQuestionDeckListResponse>(deckResponse);

    expect(decks.items).toHaveLength(1);
    expect(decks.items[0]).toMatchObject({
      id: organized.deck.id,
      name: '我的格林公式专题',
      nameLocked: true,
      totalCount: 2,
    });
  });

  it('keeps one deck item relation when moving an organized wrong question', async () => {
    const user = await registerUser('organizer-single-relation');
    const first = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-single-relation-a-${Date.now()}`,
      subject: 'Math',
      category: 'line-integral',
      knowledgePoints: ['green-theorem'],
      questionText: 'Use Green theorem to compute a line integral.',
      analysis: 'Convert the line integral to an area integral.',
    });
    const second = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-single-relation-b-${Date.now()}`,
      subject: 'Math',
      category: 'vector-calculus',
      knowledgePoints: ['divergence-theorem'],
      questionText: 'Use divergence theorem to compute flux.',
      analysis: 'Convert flux to a volume integral.',
    });

    const firstOrganized = await organize(user.accessToken, first.id);
    const secondOrganized = await organize(user.accessToken, second.id);
    expect(secondOrganized.deck.id).not.toBe(firstOrganized.deck.id);

    await request(server)
      .post(`/wrong-question-decks/${secondOrganized.deck.id}/items`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ wrongQuestionId: first.id })
      .expect(201);

    const relations = await prisma.wrongQuestionDeckItem.findMany({
      where: {
        userId: user.userId,
        wrongQuestionId: first.id,
      },
      select: {
        deckId: true,
        source: true,
      },
    });

    expect(relations).toEqual([
      {
        deckId: secondOrganized.deck.id,
        source: 'USER',
      },
    ]);
  });

  it('serializes concurrent same-owner topic organization without duplicate empty decks', async () => {
    const user = await registerUser('organizer-concurrent-topic');
    const first = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-concurrent-a-${Date.now()}`,
      questionText: '并发题目 A：使用格林公式。',
    });
    const second = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-concurrent-b-${Date.now()}`,
      questionText: '并发题目 B：使用格林公式。',
    });

    await Promise.all([
      organize(user.accessToken, first.id),
      organize(user.accessToken, second.id),
    ]);

    const decks = await prisma.wrongQuestionDeck.findMany({
      where: { userId: user.userId, name: '格林公式' },
      include: { items: { select: { wrongQuestionId: true } } },
    });

    expect(decks).toHaveLength(1);
    expect(
      decks[0].items.map(({ wrongQuestionId }) => wrongQuestionId).sort(),
    ).toEqual([first.id, second.id].sort());
  });

  it('returns the same 404 authority for missing and cross-owner organizer targets', async () => {
    const owner = await registerUser('organizer-target-owner');
    const other = await registerUser('organizer-target-other');
    const wrongQuestion = await createWrongQuestion(owner.accessToken, {
      sourceGroupId: `organizer-target-owner-${Date.now()}`,
    });
    const targetIds = [wrongQuestion.id, `missing-${Date.now()}`];
    const codes: string[] = [];

    for (const targetId of targetIds) {
      const response = await request(server)
        .post(`/wrong-question-organizer/organize/${targetId}`)
        .set('Authorization', `Bearer ${other.accessToken}`)
        .send({})
        .expect(404);
      codes.push(getErrorBody(response).error.code);
    }

    expect(codes).toEqual([
      'WRONG_QUESTION_NOT_FOUND',
      'WRONG_QUESTION_NOT_FOUND',
    ]);
  });

  it('keeps one authority relation after the force path', async () => {
    const user = await registerUser('organizer-force-unique');
    const first = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-force-a-${Date.now()}`,
      knowledgePoints: ['格林公式'],
    });
    const second = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-force-b-${Date.now()}`,
      category: '曲面积分',
      knowledgePoints: ['高斯公式'],
      questionText: '使用高斯公式计算曲面积分。',
    });
    await organize(user.accessToken, first.id);
    const secondOrganized = await organize(user.accessToken, second.id);

    await request(server)
      .post(`/wrong-question-decks/${secondOrganized.deck.id}/items`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ wrongQuestionId: first.id })
      .expect(201);
    await organize(user.accessToken, first.id, { force: true });

    const relations = await prisma.wrongQuestionDeckItem.findMany({
      where: { userId: user.userId, wrongQuestionId: first.id },
      select: { deckId: true, source: true },
    });
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({ source: 'AI' });
  });

  it('preserves concurrent user rename authority over organizer writes', async () => {
    const user = await registerUser('organizer-concurrent-rename');
    const first = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-rename-a-${Date.now()}`,
    });
    const second = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-rename-b-${Date.now()}`,
      questionText: '继续使用格林公式解题。',
    });
    const organized = await organize(user.accessToken, first.id);

    await Promise.all([
      request(server)
        .patch(`/wrong-question-decks/${organized.deck.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: '用户最终专题', nameLocked: true })
        .expect(200),
      organize(user.accessToken, second.id),
    ]);

    const finalDeck = await prisma.wrongQuestionDeck.findFirstOrThrow({
      where: { id: organized.deck.id, userId: user.userId },
      include: { items: { select: { wrongQuestionId: true } } },
    });
    expect(finalDeck).toMatchObject({ name: '用户最终专题', nameLocked: true });
    expect(
      finalDeck.items.map(({ wrongQuestionId }) => wrongQuestionId).sort(),
    ).toEqual([first.id, second.id].sort());
  });

  it('preserves concurrent user move authority over organizer writes', async () => {
    const user = await registerUser('organizer-concurrent-move');
    const targetSeed = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-move-target-${Date.now()}`,
      category: '曲面积分',
      knowledgePoints: ['高斯公式'],
      questionText: '使用高斯公式计算曲面积分。',
    });
    const target = await organize(user.accessToken, targetSeed.id);
    const moving = await createWrongQuestion(user.accessToken, {
      sourceGroupId: `organizer-move-source-${Date.now()}`,
      knowledgePoints: ['格林公式'],
    });

    await Promise.all([
      organize(user.accessToken, moving.id),
      request(server)
        .post(`/wrong-question-decks/${target.deck.id}/items`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ wrongQuestionId: moving.id })
        .expect(201),
    ]);

    const relations = await prisma.wrongQuestionDeckItem.findMany({
      where: { userId: user.userId, wrongQuestionId: moving.id },
      select: { deckId: true, source: true },
    });
    expect(relations).toEqual([{ deckId: target.deck.id, source: 'USER' }]);
  });

  async function registerUser(label: string) {
    const email = `wrong-question-organizer-${label}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}@example.com`;
    emails.push(email);

    const response = await request(server)
      .post('/auth/register')
      .send({
        email,
        password: 'Passw0rd!2026',
        name: label,
      })
      .expect(201);
    const data = getSuccessData<AuthResponse>(response);

    return {
      accessToken: data.accessToken,
      userId: data.user.id,
    };
  }

  async function createWrongQuestion(
    accessToken: string,
    input: Partial<WrongQuestionPayload> = {},
  ) {
    const response = await request(server)
      .post('/wrong-questions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(buildWrongQuestionPayload(input))
      .expect(201);

    return getSuccessData<WrongQuestionResponse>(response);
  }

  async function organize(
    accessToken: string,
    wrongQuestionId: string,
    input: { force?: boolean } = {},
  ) {
    const response = await request(server)
      .post(`/wrong-question-organizer/organize/${wrongQuestionId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(input)
      .expect(201);

    return getSuccessData<OrganizeWrongQuestionResponse>(response);
  }
});

function buildWrongQuestionPayload(input: Partial<WrongQuestionPayload> = {}) {
  return {
    source: 'OCR',
    sourceGroupId: input.sourceGroupId,
    questionText: input.questionText ?? '计算闭合曲线积分。',
    subject: input.subject ?? '高等数学',
    category: input.category ?? '曲线积分',
    knowledgePoints: input.knowledgePoints ?? ['格林公式'],
    analysis: input.analysis ?? '使用格林公式转化为二重积分。',
    answer: input.answer ?? '12',
    errorType: input.errorType ?? '概念混淆',
    rawContent: input.rawContent ?? 'raw',
  };
}

function getSuccessData<T = unknown>(response: SupertestResponse): T {
  const body = response.body as SuccessEnvelope<T>;

  expect(body.success).toBe(true);
  expect(typeof body.requestId).toBe('string');
  return body.data;
}

function getErrorBody(response: SupertestResponse): ErrorEnvelope {
  const body = response.body as ErrorEnvelope;

  expect(body.success).toBe(false);
  expect(typeof body.requestId).toBe('string');
  return body;
}

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  requestId: string;
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
};

type AuthResponse = {
  user: {
    id: string;
  };
  accessToken: string;
};

type WrongQuestionPayload = {
  sourceGroupId: string;
  questionText: string;
  subject: string;
  category: string;
  knowledgePoints: string[];
  analysis: string;
  answer: string;
  errorType: string;
  rawContent: string;
};

type WrongQuestionResponse = {
  id: string;
  userId: string;
  source: 'OCR' | 'MANUAL' | 'CHAT';
  sourceRecordId: string | null;
  sourceGroupId: string | null;
  imageUrl: string | null;
  questionText: string;
  subject: string;
  category: string;
  knowledgePoints: string[];
  analysis: string;
  answer: string;
  errorType: string | null;
  userNote: string | null;
  rawContent: string | null;
  status: 'UNRESOLVED' | 'RESOLVED';
  createdAt: string;
  updatedAt: string;
};

type WrongQuestionSubjectGroupResponse = {
  id: string;
  userId: string;
  subject: string;
  displayName: string;
  sortOrder: number;
  totalCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  deckCount: number;
  topKnowledgePoints: string[];
  lastUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type WrongQuestionDeckResponse = {
  id: string;
  userId: string;
  subjectGroupId: string;
  name: string;
  description: string | null;
  source: 'AI' | 'USER' | 'SYSTEM';
  nameLocked: boolean;
  confidence: number;
  totalCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  topKnowledgePoints: string[];
  lastUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type WrongQuestionGroupListResponse = {
  items: WrongQuestionSubjectGroupResponse[];
};

type WrongQuestionDeckListResponse = {
  subjectGroup: WrongQuestionSubjectGroupResponse;
  items: WrongQuestionDeckResponse[];
};

type WrongQuestionDeckQuestionListResponse = {
  deck: WrongQuestionDeckResponse;
  items: WrongQuestionResponse[];
  total: number;
  page: number;
  pageSize: number;
};

type OrganizedWrongQuestionItem = {
  subjectGroup: WrongQuestionSubjectGroupResponse;
  deck: WrongQuestionDeckResponse;
  item: {
    id: string;
    deckId: string;
    wrongQuestionId: string;
    reason: string | null;
    confidence: number;
    source: 'AI' | 'USER' | 'SYSTEM';
    createdAt: string;
    updatedAt: string;
  };
  createdSubjectGroup: boolean;
  createdDeck: boolean;
  createdItem: boolean;
  reason: string;
  confidence: number;
};

type OrganizeWrongQuestionResponse = OrganizedWrongQuestionItem & {
  runtime: WrongQuestionOrganizerRuntimeMetadata;
};

type OrganizeWrongQuestionBatchResponse = {
  organizedCount: number;
  skippedCount: number;
  items: OrganizedWrongQuestionItem[];
  runtime: WrongQuestionOrganizerRuntimeMetadata;
};

type WrongQuestionOrganizerRuntimeMetadata = {
  source: 'local_deterministic' | 'hybrid_model';
  disposition: string;
  degraded: boolean;
  traceId?: string;
};
