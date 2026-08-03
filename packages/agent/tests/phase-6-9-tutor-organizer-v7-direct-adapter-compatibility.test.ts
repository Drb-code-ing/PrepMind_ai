import { describe, expect, test } from 'bun:test';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createPhase697V7WireDiagnostics,
} from '@repo/ai';
import {
  formatTutorV6ModelPolicyForPrompt,
  TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256,
  TUTOR_V6_MODEL_DECISION_SCHEMA,
  TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256,
} from '@repo/agent/tutor-v6';
import {
  formatWrongQuestionOrganizerV6ModelPolicyForPrompt,
  WRONG_QUESTION_ORGANIZER_V6_FROZEN_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA,
  WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256,
} from '@repo/agent/wrong-question-organizer-v6';

const CONFIG = Object.freeze({
  provider: 'deepseek' as const,
  apiKey: 'r1-compatibility-sentinel-key',
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-pro',
});

describe('Phase 6.9.7 V7 R1 direct adapter V6 schema compatibility', () => {
  test('passes the canonical Tutor V6 strict schema and prompt without changing its SHA', async () => {
    expect(TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256).toBe(TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256);
    const result = await runThroughAdapter({
      schema: TUTOR_V6_MODEL_DECISION_SCHEMA,
      systemPrompt: formatTutorV6ModelPolicyForPrompt(),
      userPrompt: JSON.stringify({
        projectionVersion: 'tutor-model-projection-v6',
        eligibleIntents: [{ intentIndex: 0, intent: 'socratic_hint' }],
      }),
      output: { intentIndex: 0 },
      maxOutputTokens: 300,
    });
    expect(result.object).toEqual({ intentIndex: 0 });
    expect(result.stages).toHaveLength(8);
    expect(result.requestBytes).toContain('tutor-model-candidate-v6');
    expect(JSON.stringify(result.object)).not.toContain('preferredDepth');
  });

  test('passes the canonical Organizer V6 ordinal-only schema and prompt without changing its SHA', async () => {
    expect(WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V6_FROZEN_MODEL_PROMPT_SHA256,
    );
    const shortlistFingerprint = `sha256:${'a'.repeat(64)}`;
    const output = {
      shortlistFingerprint,
      decisions: [
        {
          questionIndex: 0,
          subjectDecision: { action: 'keep_local' },
          deckDecision: { action: 'create_topic', topicIndex: 0 },
        },
      ],
    } as const;
    const result = await runThroughAdapter({
      schema: WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA,
      systemPrompt: formatWrongQuestionOrganizerV6ModelPolicyForPrompt(),
      userPrompt: JSON.stringify({
        shortlistFingerprint,
        questions: [{ questionIndex: 0, topicOptions: [{ topicIndex: 0 }] }],
      }),
      output,
      maxOutputTokens: 800,
    });
    expect(result.object).toEqual(output);
    expect(result.stages).toHaveLength(8);
    expect(result.requestBytes).toContain('wrong-question-organizer-model-candidate-v6');
    for (const forbidden of ['confidence', 'subjectId', 'deckId', 'writeCommand']) {
      expect(JSON.stringify(result.object)).not.toContain(forbidden);
    }
  });
});

async function runThroughAdapter<T>(input: {
  schema: import('zod').z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  output: T;
  maxOutputTokens: number;
}) {
  const stages: string[] = [];
  let requestBytes = '';
  const diagnostics = createPhase697V7WireDiagnostics({
    appendStage(stage) {
      stages.push(stage);
    },
  });
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(CONFIG, diagnostics.capability, {
    fetch: async (_url, init) => {
      requestBytes = String(init?.body);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(input.output) } }],
          usage: {
            prompt_tokens: 64,
            completion_tokens: 16,
            completion_tokens_details: { reasoning_tokens: 0 },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  const result = await adapter.executor({
    schema: input.schema,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    maxOutputTokens: input.maxOutputTokens,
    signal: new AbortController().signal,
  });
  return { object: result.object, requestBytes, stages };
}
