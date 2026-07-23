import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Chat route defers Tutor bundle creation until after access/context preparation and final routing', async () => {
  const source = await readFile(new URL('./route.ts', import.meta.url), 'utf8');
  const accessIndex = source.indexOf(
    'const accessAndContext = await runChatAccessAndContextPreparation',
  );
  const runtimeIndex = source.indexOf(
    'createTutorBundle: () => createTutorModelRuntimeBundle({ env: process.env })',
  );
  assert.ok(accessIndex >= 0);
  assert.ok(runtimeIndex > accessIndex);
  assert.doesNotMatch(source, /const\s+tutorModelBundle\s*=/u);
  assert.match(
    source,
    /createTutorBundle:\s*\(\)\s*=>\s*createTutorModelRuntimeBundle\(\{\s*env:\s*process\.env\s*\}\)/u,
  );
  assert.match(source, /projectTutorModelAgentObservation\(\s*agentExecution\.tutorObservation/u);
  assert.match(source, /tutor:\s*agentExecution\.tutorObservation/u);
  assert.match(source, /tutor:\s*tutorModelObservation/u);
  assert.match(source, /signal:\s*req\.signal/u);
});
