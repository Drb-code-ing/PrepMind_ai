import {
  reserveModelAgentBudget,
  type ModelAgentRequest,
  type ModelAgentResult,
  type ModelAgentRuntime,
} from '@repo/ai';

import { estimateCandidateInputTokens } from './model-candidate-policy.ts';
import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';
import { deepFreezeModelValue } from './model-projection-safety.ts';
import { snapshotV6Runtime } from './v6-model-candidate-support.ts';
import type { WrongQuestionOrganizerV5ShortlistAuthority } from './wrong-question-organizer-v5-shortlist.ts';
import {
  WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA,
  type WrongQuestionOrganizerV6ModelDecision,
} from './wrong-question-organizer-v6-model-contract.ts';
import {
  WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA,
  WRONG_QUESTION_ORGANIZER_V8_SYSTEM_PROMPT,
  convertWrongQuestionOrganizerV8DecisionToV6Shape,
  validateWrongQuestionOrganizerV8ModelDecision,
  type WrongQuestionOrganizerV8DecisionFailureCode,
  type WrongQuestionOrganizerV8ModelDecision,
} from './wrong-question-organizer-v8-model-contract.ts';
import type { WrongQuestionOrganizerV8SchemaDiagnosticCollector } from './wrong-question-organizer-v8-schema-diagnostic.ts';

const WRONG_QUESTION_ORGANIZER_MAX_OUTPUT_TOKENS = 800;
const ADAPTER_FAILURE = 'WRONG_QUESTION_ORGANIZER_V8_RUNTIME_ADAPTER_FAILED';

export type WrongQuestionOrganizerV8RuntimeAdapter = Readonly<{
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  readLastDecision(): WrongQuestionOrganizerV8ModelDecision | null;
  readDynamicFailure(): WrongQuestionOrganizerV8DecisionFailureCode | null;
}>;

export function createWrongQuestionOrganizerV8RuntimeAdapter(
  input: Readonly<{
    runtime: unknown;
    authority: WrongQuestionOrganizerV5ShortlistAuthority;
    diagnosticCollector: WrongQuestionOrganizerV8SchemaDiagnosticCollector;
  }>,
): WrongQuestionOrganizerV8RuntimeAdapter | null {
  try {
    const runtime = snapshotV6Runtime(input.runtime);
    if (runtime === null) return null;
    let lastDecision: WrongQuestionOrganizerV8ModelDecision | null = null;
    let dynamicFailure: WrongQuestionOrganizerV8DecisionFailureCode | null = null;

    return Object.freeze({
      runtime: {
        async invokeStructured<T>(request: ModelAgentRequest<T>): Promise<ModelAgentResult<T>> {
          try {
            assertExpectedV6Request(request);
            const preview = reserveModelAgentBudget(request.budget, {
              inputTokens: request.estimatedInputTokens,
              outputTokens: request.maxOutputTokens,
            });
            if (!preview.ok) throw new Error(ADAPTER_FAILURE);

            const v8EstimatedInputTokens = estimateCandidateInputTokens([
              WRONG_QUESTION_ORGANIZER_V8_SYSTEM_PROMPT,
              request.userPrompt,
            ]);
            if (v8EstimatedInputTokens > request.estimatedInputTokens) {
              input.diagnosticCollector.recordUnknownFailure();
              throw new Error(ADAPTER_FAILURE);
            }

            const v8Request: ModelAgentRequest<WrongQuestionOrganizerV8ModelDecision> = {
              runId: request.runId,
              task: request.task,
              schema: input.diagnosticCollector.schema,
              systemPrompt: WRONG_QUESTION_ORGANIZER_V8_SYSTEM_PROMPT,
              userPrompt: request.userPrompt,
              estimatedInputTokens: request.estimatedInputTokens,
              maxOutputTokens: request.maxOutputTokens,
              budget: request.budget,
              ...(request.signal ? { signal: request.signal } : {}),
            };
            const rawResult: unknown = await runtime.invokeStructured(v8Request);
            const sanitized = sanitizeModelCandidateRuntimeResult({
              value: rawResult,
              dataSchema: WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA,
              task: 'wrong_question_organization',
              maxOutputTokens: WRONG_QUESTION_ORGANIZER_MAX_OUTPUT_TOKENS,
              callerBudget: request.budget,
              previewBudget: preview.budget,
            });
            if (sanitized === null) {
              input.diagnosticCollector.recordUnknownFailure();
              throw new Error(ADAPTER_FAILURE);
            }
            if (!sanitized.ok) return sanitized;

            lastDecision = deepFreezeModelValue(sanitized.data);
            const dynamicValidation = validateWrongQuestionOrganizerV8ModelDecision({
              decision: lastDecision,
              authority: input.authority,
            });
            dynamicFailure = dynamicValidation.ok ? null : dynamicValidation.reasonCode;
            const mapped: WrongQuestionOrganizerV6ModelDecision = dynamicValidation.ok
              ? convertWrongQuestionOrganizerV8DecisionToV6Shape(lastDecision)
              : buildV6StaticRejectionShape(lastDecision, input.authority.shortlistFingerprint);
            return {
              ok: true,
              data: mapped as T,
              budget: sanitized.budget,
              usage: sanitized.usage,
              trace: sanitized.trace,
            };
          } catch {
            throw new Error(ADAPTER_FAILURE);
          }
        },
      },
      readLastDecision() {
        return lastDecision;
      },
      readDynamicFailure() {
        return dynamicFailure;
      },
    });
  } catch {
    return null;
  }
}

function buildV6StaticRejectionShape(
  decision: WrongQuestionOrganizerV8ModelDecision,
  authorityFingerprint: string,
): WrongQuestionOrganizerV6ModelDecision {
  // The outer V6 sanitizer still requires its historical nested static schema. A V8 dynamic
  // rejection can contain a targetIndex that is valid for the fixed shape but outside one legacy
  // conditional branch. This guaranteed fingerprint mismatch transports only the rejection through
  // that sanitizer; the original model decision is never merged or repaired, and V8 reports the
  // actual bounded dynamic reason after the local rejection returns.
  const last = authorityFingerprint.at(-1);
  const differentFingerprint = `${authorityFingerprint.slice(0, -1)}${last === '0' ? '1' : '0'}`;
  return {
    shortlistFingerprint: differentFingerprint,
    decisions: decision.decisions.map((entry) => ({
      questionIndex: entry.questionIndex,
      subjectDecision:
        entry.subjectIndex === null
          ? ({ action: 'keep_local' } as const)
          : ({ action: 'select_subject', subjectIndex: entry.subjectIndex } as const),
      deckDecision: { action: 'reuse_existing', deckIndex: 0 } as const,
    })),
  };
}

function assertExpectedV6Request<T>(request: ModelAgentRequest<T>) {
  if (
    request.task !== 'wrong_question_organization' ||
    (request.schema as unknown) !== WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA ||
    request.maxOutputTokens !== WRONG_QUESTION_ORGANIZER_MAX_OUTPUT_TOKENS ||
    typeof request.runId !== 'string' ||
    request.runId.trim().length === 0 ||
    typeof request.userPrompt !== 'string' ||
    !Number.isSafeInteger(request.estimatedInputTokens) ||
    request.estimatedInputTokens <= 0
  ) {
    throw new Error(ADAPTER_FAILURE);
  }
}
