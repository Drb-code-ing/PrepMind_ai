import type { ModelAgentRequest, ModelAgentResult, ModelAgentRuntime } from '@repo/ai';

import { deepFreezeModelValue } from './model-projection-safety.ts';
import {
  createTutorSchemaRecoveryDiagnosticCollector,
  type TutorSchemaRecoveryBoundedDiagnostic,
  type TutorSchemaRecoveryProjectedDecision,
} from './tutor-schema-recovery-contract.ts';
import {
  runTutorV6ModelCandidate,
  type TutorV6ModelCandidateEnvelope,
  type TutorV6ModelCandidateInput,
} from './tutor-v6-model-candidate.ts';
import { TUTOR_V6_MODEL_DECISION_SCHEMA } from './tutor-v6-model-contract.ts';
import { readV6PlainInputObject, snapshotV6Runtime } from './v6-model-candidate-support.ts';

export const TUTOR_SCHEMA_RECOVERY_CANDIDATE_VERSION =
  'phase-6.9.7-tutor-schema-recovery-candidate-v1' as const;

export type TutorSchemaRecoveryModelCandidateInput = TutorV6ModelCandidateInput;

export type TutorSchemaRecoveryModelCandidateEnvelope = Readonly<{
  result: TutorV6ModelCandidateEnvelope['result'];
  observation: TutorV6ModelCandidateEnvelope['observation'];
  schemaDiagnostic: TutorSchemaRecoveryBoundedDiagnostic | null;
}>;

const INPUT_KEYS = new Set([
  'runId',
  'finalRoute',
  'latestUserText',
  'activeStudyContext',
  'deterministic',
  'safety',
  'runtime',
  'budget',
  'signal',
]);
const REQUIRED_INPUT_KEYS = [
  'runId',
  'finalRoute',
  'latestUserText',
  'deterministic',
  'safety',
  'runtime',
  'budget',
] as const;

const FAIL_CLOSED_V6_INPUT = Object.freeze({}) as TutorV6ModelCandidateInput;
const FAIL_CLOSED_V6_RUNTIME = Object.freeze({}) as TutorV6ModelCandidateInput['runtime'];
const ADAPTER_FAILURE = 'TUTOR_SCHEMA_RECOVERY_RUNTIME_ADAPTER_FAILED';

export async function runTutorSchemaRecoveryModelCandidate(
  input: TutorSchemaRecoveryModelCandidateInput,
): Promise<TutorSchemaRecoveryModelCandidateEnvelope> {
  const collector = createTutorSchemaRecoveryDiagnosticCollector();
  const source = readV6PlainInputObject(input, INPUT_KEYS, REQUIRED_INPUT_KEYS);
  if (!source.ok) {
    return liftV6Envelope(await runTutorV6ModelCandidate(FAIL_CLOSED_V6_INPUT), null);
  }

  const runtime = snapshotV6Runtime(source.values.runtime);
  const delegatedInput = createDelegatedV6Input(
    source.values,
    runtime === null
      ? FAIL_CLOSED_V6_RUNTIME
      : createSchemaRecoveryRuntime(runtime, collector.schema),
  );
  const envelope = await runTutorV6ModelCandidate(delegatedInput);
  classifyPostRuntimeStage(envelope, collector);
  return liftV6Envelope(envelope, collector.read());
}

function createSchemaRecoveryRuntime(
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  schema: ReturnType<typeof createTutorSchemaRecoveryDiagnosticCollector>['schema'],
): Pick<ModelAgentRuntime, 'invokeStructured'> {
  let calls = 0;
  return Object.freeze({
    async invokeStructured<T>(request: ModelAgentRequest<T>): Promise<ModelAgentResult<T>> {
      if (calls !== 0) throw new Error(ADAPTER_FAILURE);
      calls += 1;
      assertExpectedV6Request(request);
      const projectedRequest: ModelAgentRequest<TutorSchemaRecoveryProjectedDecision> = {
        runId: request.runId,
        task: request.task,
        schema,
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        estimatedInputTokens: request.estimatedInputTokens,
        maxOutputTokens: request.maxOutputTokens,
        budget: request.budget,
        ...(request.signal ? { signal: request.signal } : {}),
      };
      return (await runtime.invokeStructured(projectedRequest)) as ModelAgentResult<T>;
    },
  });
}

function assertExpectedV6Request<T>(request: ModelAgentRequest<T>) {
  if (
    request.task !== 'tutor_strategy' ||
    (request.schema as unknown) !== TUTOR_V6_MODEL_DECISION_SCHEMA ||
    request.maxOutputTokens !== 300 ||
    typeof request.runId !== 'string' ||
    request.runId.trim().length === 0 ||
    typeof request.systemPrompt !== 'string' ||
    typeof request.userPrompt !== 'string' ||
    !Number.isSafeInteger(request.estimatedInputTokens) ||
    request.estimatedInputTokens <= 0
  ) {
    throw new Error(ADAPTER_FAILURE);
  }
}

function createDelegatedV6Input(
  values: Readonly<Record<string, unknown>>,
  runtime: TutorV6ModelCandidateInput['runtime'],
): TutorV6ModelCandidateInput {
  return {
    runId: values.runId,
    finalRoute: values.finalRoute,
    latestUserText: values.latestUserText,
    ...(values.activeStudyContext === undefined
      ? {}
      : { activeStudyContext: values.activeStudyContext }),
    deterministic: values.deterministic,
    safety: values.safety,
    runtime,
    budget: values.budget,
    ...(values.signal === undefined ? {} : { signal: values.signal }),
  } as TutorV6ModelCandidateInput;
}

function classifyPostRuntimeStage(
  envelope: TutorV6ModelCandidateEnvelope,
  collector: ReturnType<typeof createTutorSchemaRecoveryDiagnosticCollector>,
) {
  if (envelope.observation.disposition === 'candidate_applied') {
    collector.recordApplied();
    return;
  }
  if (envelope.observation.disposition !== 'fallback_schema_invalid') return;
  const reasons = new Set<string>(envelope.observation.reasonCodes);
  if (reasons.has('authority_merge_invalid')) {
    collector.recordLocalMergerFailure();
    return;
  }
  if (
    reasons.has('signal_authority_invalid') ||
    reasons.has('preferred_depth_authority_invalid') ||
    reasons.has('authority_binding_mismatch') ||
    reasons.has('intent_index_out_of_range')
  ) {
    collector.recordLocalAuthorityFailure();
    return;
  }
  if (reasons.has('schema_invalid')) {
    collector.recordProjectedSchemaFailure();
    return;
  }
  if (collector.read() === null) collector.recordUnknownFailure();
}

function liftV6Envelope(
  envelope: TutorV6ModelCandidateEnvelope,
  diagnostic: TutorSchemaRecoveryBoundedDiagnostic | null,
): TutorSchemaRecoveryModelCandidateEnvelope {
  return deepFreezeModelValue({
    result: envelope.result,
    observation: envelope.observation,
    schemaDiagnostic: diagnostic,
  });
}
