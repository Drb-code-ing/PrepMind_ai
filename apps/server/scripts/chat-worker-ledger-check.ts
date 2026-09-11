import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { Job } from 'bullmq';
import { createModelAgentRuntime } from '@repo/ai';

import {
  ChatRunBudgetRepository,
  DEFAULT_CHAT_RUN_BUDGET_POLICY,
} from '../src/chat-run-budget/chat-run-budget.repository';
import { ChatRunBudgetStageRunner } from '../src/chat-turns/chat-run-budget-stage-runner';
import {
  ChatResponseWorkerService,
  DeterministicChatResponseGenerator,
  type ChatResponseGeneratorInput,
} from '../src/chat-turns/chat-response-worker.service';
import { ChatVerifierStageService } from '../src/chat-turns/chat-verifier-stage';
import type { ChatRouterStageService } from '../src/chat-turns/chat-router-stage';
import type { ChatRetrieverStageService } from '../src/chat-turns/chat-retriever-stage';
import type { PrismaService } from '../src/database/prisma.service';
import {
  CHAT_RESPONSE_QUEUE,
  CHAT_RESPONSE_JOB,
  CHAT_RESPONSE_RESOURCE_TYPE,
  CHAT_RESPONSE_COMPLETED_EVENT,
  CHAT_RESPONSE_FAILED_EVENT,
} from '../src/chat-turns/chat-turn.constants';

/** Called only with the parent check's isolated tmpfs database. No env or network executor. */
export async function checkChatWorkerLedger(client: PrismaClient) {
  const repository = new ChatRunBudgetRepository(client as PrismaService);
  const runner = new ChatRunBudgetStageRunner(repository);
  const owner = await client.user.create({
    data: {
      email: `${randomUUID()}@example.invalid`,
      passwordHash: 'synthetic-only',
    },
  });
  const checks: string[] = [];
  for (const outcome of [
    'no-candidate',
    'success',
    'invalid-schema',
  ] as const) {
    const conversation = await client.conversation.create({
      data: { userId: owner.id },
    });
    const message = await client.chatMessage.create({
      data: {
        userId: owner.id,
        conversationId: conversation.id,
        role: 'USER',
        order: 1,
        content: '这份资料能否可靠支持当前学习结论？',
      },
    });
    const turn = await client.chatTurn.create({
      data: {
        userId: owner.id,
        conversationId: conversation.id,
        clientRequestId: randomUUID(),
        inputHash: `sha256:${'0'.repeat(64)}`,
        inputMessageIds: [message.id],
        budgetPolicyVersion: 'chat-v1',
      },
    });
    await repository.createLedger(
      owner.id,
      turn.id,
      DEFAULT_CHAT_RUN_BUDGET_POLICY,
    );
    const background = await client.backgroundJob.create({
      data: {
        userId: owner.id,
        queueName: CHAT_RESPONSE_QUEUE,
        jobName: CHAT_RESPONSE_JOB,
        resourceType: CHAT_RESPONSE_RESOURCE_TYPE,
        resourceId: turn.id,
      },
    });
    let executions = 0;
    let generationCalls = 0;
    const runtime = createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      liveCallsEnabled: true,
      timeoutMs: 500,
      executor: () => {
        executions += 1;
        return Promise.resolve({
          object:
            outcome === 'invalid-schema'
              ? { status: 'invalid' }
              : { status: 'suspicious', evidenceCodes: ['stale_or_uncertain'] },
          usage: { inputTokens: 200, outputTokens: 30 },
        });
      },
    });
    const verifier = new ChatVerifierStageService(runner, {
      enabled: true,
      runtime,
    });
    const router = {
      run: () =>
        Promise.resolve({
          route: {
            name: 'rag_answer',
            confidence: 1,
            reason: 'synthetic route',
            requiresRag: true,
            requiresHumanApproval: false,
          },
        }),
    } as unknown as ChatRouterStageService;
    const retriever = {
      run: () =>
        Promise.resolve({
          degraded: false,
          chunks: [
            {
              documentId: 'synthetic-document',
              documentTitle: 'Notes',
              chunkId: 'synthetic-chunk',
              score: 0.9,
              content: '这条推导可能有误，使用之前需要重新检查计算过程。',
            },
          ],
        }),
    } as unknown as ChatRetrieverStageService;
    const deterministic = new DeterministicChatResponseGenerator();
    const worker = new ChatResponseWorkerService(
      client as PrismaService,
      {
        accounting: 'none',
        generate: (input: ChatResponseGeneratorInput) => {
          generationCalls += 1;
          if (outcome !== 'no-candidate')
            assert.equal(input.verifierResult?.status, 'suspicious');
          return deterministic.generate(input);
        },
      },
      undefined,
      repository,
      runner,
      outcome === 'no-candidate' ? undefined : router,
      retriever,
      verifier,
    );
    const job = {
      id: background.id,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        turnId: turn.id,
        backgroundJobId: background.id,
        inputHash: turn.inputHash,
        budgetPolicyVersion: 'chat-v1',
      },
      discard: () =>
        assert.fail('successful synthetic turn must not be discarded'),
    } as unknown as Job<unknown>;

    await worker.process(job);
    const completed = await client.chatTurn.findUniqueOrThrow({
      where: { id: turn.id },
    });
    assert.equal(completed.status, 'SUCCEEDED');
    assert.ok(completed.responseMessageId);
    assert.equal(
      (
        await client.backgroundJob.findUniqueOrThrow({
          where: { id: background.id },
        })
      ).status,
      'SUCCEEDED',
    );
    const lease = await client.chatRunBudgetReservation.findUniqueOrThrow({
      where: {
        id_userId: { id: `worker:${turn.id}:1`, userId: owner.id },
      },
    });
    assert.equal(lease.status, 'SETTLED');
    assert.deepEqual(
      [
        lease.inputTokens,
        lease.outputTokens,
        lease.usageInputTokens,
        lease.usageOutputTokens,
        lease.usageCostMicros,
      ],
      [0, 0, 0, 0, 0],
    );
    if (outcome !== 'no-candidate') {
      const child = await client.chatRunBudgetReservation.findUniqueOrThrow({
        where: {
          id_userId: { id: `verifier:${turn.id}:1`, userId: owner.id },
        },
      });
      assert.equal(
        child.status,
        outcome === 'success' ? 'SETTLED' : 'UNCERTAIN',
      );
      if (outcome === 'success') assert.equal(child.usageCostMicros, 780);
    }
    const ledger = await repository.findLedger(owner.id, turn.id);
    assert.equal(ledger?.usedCalls, outcome === 'success' ? 2 : 1);
    assert.equal(ledger?.heldCalls, outcome === 'invalid-schema' ? 1 : 0);
    assert.equal(ledger?.usedCostMicros, outcome === 'success' ? 780 : 0);
    assert.equal(
      ledger?.heldCostMicros,
      outcome === 'invalid-schema' ? 30_000 : 0,
    );
    await worker.process(job);
    assert.equal(generationCalls, 1);
    assert.equal(executions, outcome === 'no-candidate' ? 0 : 1);
    assert.equal(
      await client.chatMessage.count({
        where: { conversationId: conversation.id, role: 'ASSISTANT' },
      }),
      1,
    );
    assert.equal(
      await client.outboxEvent.count({
        where: { aggregateId: turn.id, type: CHAT_RESPONSE_COMPLETED_EVENT },
      }),
      1,
    );
    assert.equal(
      (await repository.findLedger(owner.id, turn.id))?.heldCalls,
      ledger?.heldCalls,
    );
    checks.push(`worker-ledger-${outcome}-terminal-replay`);
    console.log(`passed: worker-ledger-${outcome}`);
  }
  return [
    ...checks,
    ...(await checkFinalResponseLedger(client, repository, runner, owner.id)),
  ];
}

async function checkFinalResponseLedger(
  client: PrismaClient,
  repository: ChatRunBudgetRepository,
  runner: ChatRunBudgetStageRunner,
  ownerId: string,
) {
  const checks: string[] = [];
  for (const outcome of [
    'success',
    'missing-usage',
    'over-limit',
    'admission-denied',
  ] as const) {
    console.log(`checking: final-response-ledger-${outcome}`);
    const conversation = await client.conversation.create({
      data: { userId: ownerId },
    });
    const message = await client.chatMessage.create({
      data: {
        userId: ownerId,
        conversationId: conversation.id,
        role: 'USER',
        order: 1,
        content: 'Synthetic final response budget check.',
      },
    });
    const turn = await client.chatTurn.create({
      data: {
        userId: ownerId,
        conversationId: conversation.id,
        clientRequestId: randomUUID(),
        inputHash: `sha256:${'1'.repeat(64)}`,
        inputMessageIds: [message.id],
        budgetPolicyVersion: 'chat-v1',
      },
    });
    await repository.createLedger(ownerId, turn.id, {
      ...DEFAULT_CHAT_RUN_BUDGET_POLICY,
      ...(outcome === 'admission-denied' ? { maxCalls: 1 } : {}),
    });
    const background = await client.backgroundJob.create({
      data: {
        userId: ownerId,
        queueName: CHAT_RESPONSE_QUEUE,
        jobName: CHAT_RESPONSE_JOB,
        resourceType: CHAT_RESPONSE_RESOURCE_TYPE,
        resourceId: turn.id,
      },
    });
    let generationCalls = 0;
    const worker = new ChatResponseWorkerService(
      client as PrismaService,
      {
        accounting: 'deepseek-v4-pro',
        generate: (input) => {
          generationCalls += 1;
          assert.deepEqual(input.generationBudget, {
            inputTokens: 2500,
            outputTokens: 1200,
            costMicros: 15000,
          });
          return Promise.resolve({
            content: 'Synthetic answer.',
            generator: 'synthetic-final-v1',
            usage:
              outcome === 'missing-usage'
                ? null
                : {
                    inputTokens: outcome === 'over-limit' ? 2501 : 200,
                    outputTokens: 30,
                  },
          });
        },
      },
      undefined,
      repository,
      runner,
    );
    const job = {
      id: background.id,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        turnId: turn.id,
        backgroundJobId: background.id,
        inputHash: turn.inputHash,
        budgetPolicyVersion: 'chat-v1',
      },
      discard: () => undefined,
    } as unknown as Job<unknown>;
    await worker.process(job);
    const completed = await client.chatTurn.findUniqueOrThrow({
      where: { id: turn.id },
    });
    const success = outcome === 'success';
    const denied = outcome === 'admission-denied';
    assert.equal(completed.status, success ? 'SUCCEEDED' : 'FAILED');
    assert.equal(
      completed.errorCode,
      success ? null : denied ? 'BUDGET_EXHAUSTED' : 'OUTPUT_INVALID',
    );
    assert.equal(
      (
        await client.backgroundJob.findUniqueOrThrow({
          where: { id: background.id },
        })
      ).status,
      completed.status,
    );
    const final = await client.chatRunBudgetReservation.findUnique({
      where: {
        id_userId: { id: `final_response:${turn.id}:1`, userId: ownerId },
      },
    });
    if (denied) assert.equal(final, null);
    else {
      assert.equal(final?.status, success ? 'SETTLED' : 'UNCERTAIN');
      assert.equal(final?.usageCostMicros, success ? 780 : 0);
    }
    const ledger = await repository.findLedger(ownerId, turn.id);
    assert.equal(ledger?.usedCalls, success ? 2 : 0);
    assert.equal(ledger?.heldCalls, success ? 0 : denied ? 1 : 2);
    assert.equal(ledger?.usedInputTokens, success ? 200 : 0);
    assert.equal(ledger?.usedOutputTokens, success ? 30 : 0);
    assert.equal(ledger?.usedCostMicros, success ? 780 : 0);
    assert.equal(ledger?.heldCostMicros, success || denied ? 0 : 15000);
    await worker.process(job);
    assert.equal(generationCalls, denied ? 0 : 1);
    assert.equal(
      await client.chatMessage.count({
        where: { conversationId: conversation.id, role: 'ASSISTANT' },
      }),
      success ? 1 : 0,
    );
    assert.equal(
      await client.outboxEvent.count({
        where: {
          aggregateId: turn.id,
          type: success
            ? CHAT_RESPONSE_COMPLETED_EVENT
            : CHAT_RESPONSE_FAILED_EVENT,
        },
      }),
      1,
    );
    assert.equal(
      (await repository.findLedger(ownerId, turn.id))?.heldCalls,
      ledger?.heldCalls,
    );
    checks.push(`final-response-ledger-${outcome}-terminal-replay`);
  }
  return checks;
}
