import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Chat route defers Agent runtime creation until after canonical access and context preparation', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const accessIndex = source.indexOf(
    'const canonicalAccess = await resolveCanonicalChatAgentAccess',
  );
  const contextIndex = source.indexOf('const accessAndContext = await runChatContextPreparation');
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
  assert.match(source, /signal:\s*executionContext\.signal/u);
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
  assert.match(
    source,
    /shouldSearchKnowledgeForChat\(\{[\s\S]*?authenticated:\s*executionContext\.principal\.kind\s*===\s*'authenticated'/u,
  );
  assert.match(source, /searchKnowledgeForChat\(\{[\s\S]*?accessToken:\s*canonicalAccessToken/u);
  assert.match(source, /recordAgentTraceSafely\(canonicalAccessToken/u);
  assert.doesNotMatch(source, /console\.warn\('\[Chat Auth\]'[\s\S]*?error/u);
});

test('Chat route propagates request cancellation into the final live model stream', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');

  assert.match(
    source,
    /function\s+createLiveChatResponse[\s\S]*?signal:\s*AbortSignal[\s\S]*?streamText\(\{[\s\S]*?abortSignal:\s*input\.signal/u,
  );
  assert.match(
    source,
    /return\s+createLiveChatResponse\(\{[\s\S]*?signal:\s*executionContext\.signal/u,
  );
});
