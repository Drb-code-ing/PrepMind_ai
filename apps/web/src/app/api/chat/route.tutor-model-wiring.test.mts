import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Chat route defers Agent runtime creation until after canonical access and context preparation', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const accessIndex = source.indexOf(
    'const canonicalAccess = await resolveCanonicalChatAgentAccess',
  );
  const contextIndex = source.indexOf('accessAndContext = await runChatContextPreparation');
  const runtimeIndex = source.indexOf(
    'createTutorBundle: () => createTutorModelRuntimeBundle({ env: process.env })',
  );
  assert.ok(accessIndex >= 0);
  assert.ok(contextIndex > accessIndex);
  assert.ok(runtimeIndex > contextIndex);
  assert.doesNotMatch(source, /const\s+tutorModelBundle\s*=/u);
  assert.match(
    source,
    /createTutorBundle:\s*\(\)\s*=>\s*createTutorModelRuntimeBundle\(\{\s*env:\s*process\.env\s*\}\)/u,
  );
  assert.match(source, /projectTutorModelAgentObservation\(\s*agentExecution\.tutorObservation/u);
  assert.match(source, /tutor:\s*agentExecution\.tutorObservation/u);
  assert.match(source, /tutor:\s*tutorModelObservation/u);
  assert.match(source, /context:\s*executionContext/u);
});

test('Chat route uses the server-authenticated principal and one bound bearer capability', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const accessIndex = source.indexOf(
    'const canonicalAccess = await resolveCanonicalChatAgentAccess',
  );
  const configuredIndex = source.indexOf('if (!providerStatus.configured)');
  const runtimeBundleIndex = source.indexOf(
    'const modelAgentBundle = createChatModelAgentRuntimeBundle',
  );
  const orchestrationIndex = source.indexOf('await orchestrateChatModelAgents({');
  const orchestrationEnd = source.indexOf('const agentDecision', orchestrationIndex);
  const orchestrationBlock = source.slice(orchestrationIndex, orchestrationEnd);

  assert.ok(accessIndex >= 0);
  assert.ok(configuredIndex > accessIndex);
  assert.ok(runtimeBundleIndex > configuredIndex);
  assert.doesNotMatch(source, /web-chat-user/u);
  assert.match(orchestrationBlock, /executionContext,/u);
  assert.doesNotMatch(orchestrationBlock, /(?:userId|runId|signal):/u);
  assert.match(source, /shouldSearchKnowledgeForChat\(\{[\s\S]*?authenticated:\s*true/u);
  assert.match(
    source,
    /createChatKnowledgeRetrieverSearchPortV1\(\{[\s\S]*?access:\s*canonicalAccess\.access[\s\S]*?executionContext/u,
  );
  assert.match(source, /startAgentTraceSafely\(\s*canonicalAccessToken/u);
  assert.match(
    source,
    /startAgentTraceSafely\(\s*canonicalAccessToken,[\s\S]*?executionContext\.signal/u,
  );
  assert.match(source, /finalizeAgentTraceSafely\(input\.accessToken,\s*terminalPayload\)/u);
  assert.doesNotMatch(source, /searchKnowledgeForChat\(/u);
  assert.doesNotMatch(source, /console\.warn\('\[Chat Auth\]'[\s\S]*?error/u);
});

test('Chat route propagates one execution context through retrieval and FinalResponse', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');

  assert.match(source, /runRealtimeRetrieverCompositionV1\(\{[\s\S]*?context:\s*executionContext/u);
  assert.match(
    source,
    /runFinalResponseAgentNodeV1\(\{[\s\S]*?context:\s*input\.executionContext/u,
  );
  assert.doesNotMatch(source, /streamText\(/u);
});

test('Chat route admits an authenticated turn before the legacy Provider path', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const accessIndex = source.indexOf(
    'const canonicalAccess = await resolveCanonicalChatAgentAccess',
  );
  const anonymousIndex = source.indexOf("if (executionContext.principal.kind === 'anonymous')");
  const bridgeDecisionIndex = source.indexOf(
    'const chatTurnBridgeDecision = resolveChatTurnBridgeDecision',
  );
  const admissionIndex = source.indexOf('const handoff = await admitChatTurnBridge');
  const bridgeRejectIndex = source.indexOf("if (chatTurnBridgeDecision.kind === 'reject')");
  const providerConfiguredIndex = source.indexOf('if (!providerStatus.configured)');
  const traceIndex = source.indexOf('traceStartPayload = buildRealtimeChatTraceStartV1');

  assert.ok(accessIndex >= 0);
  assert.ok(anonymousIndex > accessIndex);
  assert.ok(bridgeDecisionIndex > anonymousIndex);
  assert.ok(bridgeRejectIndex > bridgeDecisionIndex);
  assert.ok(admissionIndex > bridgeDecisionIndex);
  assert.ok(providerConfiguredIndex > admissionIndex);
  assert.ok(traceIndex > providerConfiguredIndex);
  assert.match(
    source,
    /prepareMessages:[\s\S]*?chatMessageApi\.prepareForTurn[\s\S]*?enqueueTurn:[\s\S]*?chatTurnApi\.enqueue/u,
  );
  assert.match(source, /createChatTurnHandoffResponse\(handoff\)/u);
  assert.match(source, /chatTurnBridgeDecision\.kind === 'reject'[\s\S]*?status:\s*400/u);
  assert.match(source, /turn-backed-rejected/u);
});

test('Chat route starts Trace before every Agent runtime, prepares before stream, and finalizes after terminal', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const startIndex = source.indexOf('const traceStarted = await startAgentTraceSafely');
  const contextIndex = source.indexOf('accessAndContext = await runChatContextPreparation');
  const routerIndex = source.indexOf('agentExecutionResult = await orchestrateChatModelAgents');
  const retrievalIndex = source.indexOf(
    'const retrieval = await runRealtimeRetrieverCompositionV1',
  );
  const prepareIndex = source.indexOf('const tracePrepared = await prepareAgentTraceSafely');
  const responseIndex = source.indexOf(
    'const response = bindResponseBodyCancellationV1',
    startIndex,
  );
  const finalResponseIndex = source.indexOf('const execution = await runFinalResponseAgentNodeV1');
  const terminalPayloadIndex = source.indexOf(
    'const terminalPayload = buildRealtimeChatTraceFinalizeV1',
  );
  const finalizeIndex = source.indexOf('await finalizeAgentTraceSafely', terminalPayloadIndex);

  assert.ok(startIndex >= 0);
  assert.ok(contextIndex > startIndex);
  assert.ok(routerIndex > startIndex);
  assert.ok(retrievalIndex > startIndex);
  assert.ok(prepareIndex > retrievalIndex);
  assert.ok(responseIndex > startIndex);
  assert.ok(finalResponseIndex >= 0);
  assert.ok(terminalPayloadIndex > finalResponseIndex);
  assert.ok(finalizeIndex > terminalPayloadIndex);
  assert.match(source, /modelCallId:\s*input\.modelCallId/u);
  assert.match(source, /finalizeUnexpectedAgentTraceSafely\(\{/u);
  assert.match(source, /bindResponseBodyCancellationV1\(/u);
  assert.match(source, /createRequestAbortScopeV1\(req\.signal\)/u);
  assert.match(source, /signal:\s*requestScope\.signal/u);
  assert.match(source, /status:\s*requestAborted\s*\?\s*499\s*:\s*500/u);
  assert.doesNotMatch(
    source,
    /if\s*\(input\.traceStarted\)\s*\{\s*await finalizeAgentTraceSafely/u,
  );
  assert.doesNotMatch(source, /BackgroundJob|Outbox/u);
});
