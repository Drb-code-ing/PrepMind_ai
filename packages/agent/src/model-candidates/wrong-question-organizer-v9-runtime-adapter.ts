import type { ModelAgentRequest, ModelAgentResult, ModelAgentRuntime } from '@repo/ai';

import { snapshotV6Runtime } from './v6-model-candidate-support.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS,
  buildWrongQuestionOrganizerV9PromptParts,
  type WrongQuestionOrganizerV9ModelProjection,
} from './wrong-question-organizer-v9-model-projection.ts';
import type { WrongQuestionOrganizerV9ModelDecision } from './wrong-question-organizer-v9-model-contract.ts';
import type { WrongQuestionOrganizerV9SchemaDiagnosticCollector } from './wrong-question-organizer-v9-schema-diagnostic.ts';

const MAX_OUTPUT_TOKENS = 800;
const ADAPTER_FAILURE = 'WRONG_QUESTION_ORGANIZER_V9_RUNTIME_ADAPTER_FAILED';

export type WrongQuestionOrganizerV9RuntimeAdapter = Readonly<{
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  estimatedInputTokens: number;
}>;

export function createWrongQuestionOrganizerV9RuntimeAdapter(
  input: Readonly<{
    runtime: unknown;
    projection: WrongQuestionOrganizerV9ModelProjection;
    diagnosticCollector: WrongQuestionOrganizerV9SchemaDiagnosticCollector;
  }>,
): WrongQuestionOrganizerV9RuntimeAdapter | null {
  try {
    const runtime = snapshotV6Runtime(input.runtime);
    if (runtime === null) return null;
    const expected = buildWrongQuestionOrganizerV9PromptParts(input.projection);
    if (
      !expected.ok ||
      expected.value.estimatedInputTokens > WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS
    ) {
      return null;
    }

    return Object.freeze({
      estimatedInputTokens: expected.value.estimatedInputTokens,
      runtime: {
        async invokeStructured<T>(request: ModelAgentRequest<T>): Promise<ModelAgentResult<T>> {
          try {
            const rebuilt = buildWrongQuestionOrganizerV9PromptParts(input.projection);
            if (!rebuilt.ok) throw new Error(ADAPTER_FAILURE);
            assertExpectedV9Request(request, rebuilt.value, input.diagnosticCollector.schema);
            return (await runtime.invokeStructured(
              request as unknown as ModelAgentRequest<WrongQuestionOrganizerV9ModelDecision>,
            )) as ModelAgentResult<T>;
          } catch {
            throw new Error(ADAPTER_FAILURE);
          }
        },
      },
    });
  } catch {
    return null;
  }
}

function assertExpectedV9Request<T>(
  request: ModelAgentRequest<T>,
  expected: Extract<
    ReturnType<typeof buildWrongQuestionOrganizerV9PromptParts>,
    { ok: true }
  >['value'],
  schema: WrongQuestionOrganizerV9SchemaDiagnosticCollector['schema'],
) {
  if (
    request.task !== 'wrong_question_organization' ||
    request.schema !== (schema as unknown) ||
    request.systemPrompt !== expected.parts[0] ||
    request.userPrompt !== expected.parts[1] ||
    request.estimatedInputTokens !== expected.estimatedInputTokens ||
    request.maxOutputTokens !== MAX_OUTPUT_TOKENS ||
    typeof request.runId !== 'string' ||
    request.runId.trim().length === 0 ||
    !Number.isSafeInteger(request.estimatedInputTokens) ||
    request.estimatedInputTokens <= 0 ||
    request.estimatedInputTokens > WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS
  ) {
    throw new Error(ADAPTER_FAILURE);
  }
}
