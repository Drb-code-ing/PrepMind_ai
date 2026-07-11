import assert from 'node:assert/strict';

import {
  actionProposalSchema,
  agentRouteSchema,
  agentRunSchema,
  agentStateSchema,
  agentStepSchema,
  agentContextPolicySchema,
  routerResultSchema,
  shouldUseLiveAgentModelSchema,
} from '../src/api/agent.ts';

function run() {
  testRoutes();
  testActionProposal();
  testAgentState();
  testRouterResult();
  testRunAndStep();
  testLiveModelGate();
}

function testRoutes() {
  assert.equal(agentRouteSchema.parse('chat'), 'chat');
  assert.equal(agentRouteSchema.parse('tutor'), 'tutor');
  assert.equal(agentRouteSchema.parse('rag_answer'), 'rag_answer');
  assert.throws(() => agentRouteSchema.parse('always_memory'));
}

function testActionProposal() {
  const result = actionProposalSchema.parse({
    id: 'proposal_1',
    type: 'SAVE_MEMORY',
    title: '记录讲解偏好',
    summary: '用户希望后续用苏格拉底方式讲题。',
    reason: '用户明确表达“以后都这样讲”。',
    confidence: 0.92,
    payload: { style: 'socratic' },
    status: 'pending',
    createdAt: '2026-06-20T10:00:00.000Z',
  });

  assert.equal(result.type, 'SAVE_MEMORY');
  assert.equal(result.status, 'pending');
  assert.throws(() =>
    actionProposalSchema.parse({
      ...result,
      confidence: 1.2,
    }),
  );
}

function testAgentState() {
  const result = agentStateSchema.parse({
    runId: 'run_1',
    userId: 'user_1',
    input: {
      text: '这道题为什么这样做？',
      attachments: [],
    },
    proposals: [],
    errors: [],
  });

  assert.equal(result.runId, 'run_1');
  assert.equal(result.input.text, '这道题为什么这样做？');
  assert.deepEqual(result.proposals, []);

  const enriched = agentStateSchema.parse({
    runId: 'run_2',
    userId: 'user_1',
    input: {
      text: 'How should I solve this derivative problem?',
      attachments: [],
    },
    chatContext: {
      recentMessages: [{ role: 'user', content: 'How should I solve it?' }],
      summaryBuffer: 'The learner has recently reviewed chain rule mistakes.',
      contextPolicy: {
        recentMessageCount: 1,
        summaryIncluded: true,
        droppedMessageCount: 4,
        estimatedTokenCount: 320,
      },
    },
    loopControl: {
      stepCount: 1,
      maxSteps: 6,
      maxRepeatedTransition: 2,
      startedAt: '2026-06-29T00:00:00.000Z',
      transitions: ['RouterAgent->TutorAgent'],
    },
    proposals: [],
    errors: [],
  });

  assert.equal(
    enriched.chatContext?.summaryBuffer,
    'The learner has recently reviewed chain rule mistakes.',
  );
  assert.equal(enriched.chatContext?.contextPolicy?.summaryIncluded, true);
  assert.deepEqual(enriched.loopControl?.transitions, ['RouterAgent->TutorAgent']);

  const contextPolicy = agentContextPolicySchema.parse({
    recentMessageCount: 4,
    summaryIncluded: true,
    droppedMessageCount: 8,
    estimatedTokenCount: 940,
    layerTokenCounts: {
      mandatory: 120,
      agentGuidance: 20,
      stateGuidance: 18,
      activeStudy: 80,
      recentMessages: 400,
      rag: 200,
      summary: 120,
    },
    droppedLayers: ['rag', 'stateGuidance'],
    summaryVersion: 1,
    summaryStatus: 'generated',
  });

  assert.equal(contextPolicy.layerTokenCounts?.mandatory, 120);
  assert.equal(contextPolicy.layerTokenCounts?.stateGuidance, 18);
  assert.deepEqual(contextPolicy.droppedLayers, ['rag', 'stateGuidance']);
  const legacyContextPolicy = agentContextPolicySchema.parse({
    ...contextPolicy,
    layerTokenCounts: {
      mandatory: 120,
      agentGuidance: 20,
      activeStudy: 80,
      recentMessages: 400,
      rag: 200,
      summary: 120,
    },
  });
  assert.equal(legacyContextPolicy.layerTokenCounts?.stateGuidance, 0);
  assert.throws(() =>
    agentContextPolicySchema.parse({
      ...legacyContextPolicy,
      layerTokenCounts: { ...legacyContextPolicy.layerTokenCounts, rawSecret: 1 },
    }),
  );
  assert.throws(() =>
    agentContextPolicySchema.parse({ ...contextPolicy, droppedLayers: ['recentMessages'] }),
  );
  assert.throws(() =>
    agentContextPolicySchema.parse({ ...contextPolicy, droppedLayers: ['rag', 'rag'] }),
  );
  assert.equal(
    agentContextPolicySchema.parse({
      ...contextPolicy,
      droppedLayers: [
        'agentGuidance',
        'stateGuidance',
        'activeStudy',
        'rag',
        'summary',
      ],
    }).droppedLayers?.length,
    5,
  );
  assert.throws(() =>
    agentContextPolicySchema.parse({
      ...contextPolicy,
      recentMessageCount: Number.MAX_SAFE_INTEGER + 1,
    }),
  );
}

function testRouterResult() {
  const result = routerResultSchema.parse({
    name: 'tutor',
    confidence: 0.86,
    reason: '用户在追问题目解法。',
    requiresRag: false,
    requiresHumanApproval: false,
  });

  assert.equal(result.name, 'tutor');
  assert.equal(result.requiresRag, false);
}

function testRunAndStep() {
  const run = agentRunSchema.parse({
    id: 'run_1',
    userId: 'user_1',
    conversationId: 'conversation_1',
    route: 'chat',
    status: 'completed',
    startedAt: '2026-06-20T10:00:00.000Z',
    finishedAt: '2026-06-20T10:00:01.000Z',
    totalDurationMs: 1000,
    inputTokenEstimate: 80,
    outputTokenEstimate: 120,
    modelProvider: 'mock',
    modelName: 'mock-agent',
    costEstimate: 0,
  });

  const step = agentStepSchema.parse({
    id: 'step_1',
    runId: run.id,
    node: 'RouterAgent',
    status: 'completed',
    startedAt: '2026-06-20T10:00:00.000Z',
    finishedAt: '2026-06-20T10:00:00.020Z',
    durationMs: 20,
    inputSummary: '用户请求讲题',
    outputSummary: 'route=tutor',
    errorMessage: null,
  });

  assert.equal(step.runId, 'run_1');
  assert.equal(step.status, 'completed');
}

function testLiveModelGate() {
  assert.equal(
    shouldUseLiveAgentModelSchema.parse({
      providerMode: 'mock',
      enableLiveCalls: false,
      inputTokenBudget: 2500,
      outputTokenBudget: 1200,
    }),
    false,
  );

  assert.equal(
    shouldUseLiveAgentModelSchema.parse({
      providerMode: 'live',
      enableLiveCalls: true,
      inputTokenBudget: 2500,
      outputTokenBudget: 1200,
    }),
    true,
  );

  assert.throws(() =>
    shouldUseLiveAgentModelSchema.parse({
      providerMode: 'live',
      enableLiveCalls: true,
      inputTokenBudget: 12000,
      outputTokenBudget: 1200,
    }),
  );
}

run();
