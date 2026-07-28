import { deepFreezeModelValue } from './model-projection-safety.ts';
import { readV6PlainInputObject } from './v6-model-candidate-support.ts';
import { deriveWrongQuestionOrganizerV5Shortlist } from './wrong-question-organizer-v5-shortlist.ts';
import {
  runWrongQuestionOrganizerV6ModelCandidate,
  type WrongQuestionOrganizerV6CandidateResult,
  type WrongQuestionOrganizerV6CandidateReasonCode,
  type WrongQuestionOrganizerV6ModelCandidateEnvelope,
  type WrongQuestionOrganizerV6ModelCandidateInput,
} from './wrong-question-organizer-v6-model-candidate.ts';
import { WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION } from './wrong-question-organizer-v8-model-contract.ts';
import { createWrongQuestionOrganizerV8RuntimeAdapter } from './wrong-question-organizer-v8-runtime-adapter.ts';
import {
  createWrongQuestionOrganizerV8SchemaDiagnosticCollector,
  type WrongQuestionOrganizerV8BoundedSchemaDiagnostic,
} from './wrong-question-organizer-v8-schema-diagnostic.ts';

export type WrongQuestionOrganizerV8CommandBinding = Readonly<
  Omit<NonNullable<WrongQuestionOrganizerV6CandidateResult['binding']>, 'candidateVersion'> & {
    candidateVersion: typeof WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION;
  }
>;

export type WrongQuestionOrganizerV8CandidateResult = Readonly<{
  binding: WrongQuestionOrganizerV8CommandBinding | null;
  suggestions: WrongQuestionOrganizerV6CandidateResult['suggestions'];
}>;

export type WrongQuestionOrganizerV8ModelCandidateInput =
  WrongQuestionOrganizerV6ModelCandidateInput;

export type WrongQuestionOrganizerV8ModelCandidateEnvelope = Readonly<{
  result: WrongQuestionOrganizerV8CandidateResult;
  observation: WrongQuestionOrganizerV6ModelCandidateEnvelope['observation'];
  boundedSchemaDiagnostic: WrongQuestionOrganizerV8BoundedSchemaDiagnostic | null;
}>;

const DYNAMIC_AUTHORITY_FAILURES = new Set<string>([
  'shortlist_fingerprint_mismatch',
  'question_count_mismatch',
  'duplicate_question_index',
  'question_index_out_of_range',
  'subject_authority_violation',
  'subject_index_out_of_range',
  'deck_action_not_eligible',
  'deck_index_out_of_range',
  'cross_subject_deck',
  'topic_index_out_of_range',
  'cross_subject_topic',
]);

const INPUT_KEYS = new Set([
  'runId',
  'shortlistSource',
  'runtime',
  'budget',
  'revalidateSource',
  'signal',
]);
const REQUIRED_INPUT_KEYS = [
  'runId',
  'shortlistSource',
  'runtime',
  'budget',
  'revalidateSource',
] as const;

const FAIL_CLOSED_V6_RUNTIME = Object.freeze(
  {},
) as WrongQuestionOrganizerV6ModelCandidateInput['runtime'];
const FAIL_CLOSED_V6_INPUT = Object.freeze({}) as WrongQuestionOrganizerV6ModelCandidateInput;

export async function runWrongQuestionOrganizerV8ModelCandidate(
  input: WrongQuestionOrganizerV8ModelCandidateInput,
): Promise<WrongQuestionOrganizerV8ModelCandidateEnvelope> {
  const diagnosticCollector = createWrongQuestionOrganizerV8SchemaDiagnosticCollector();
  const values = readV6PlainInputObject(input, INPUT_KEYS, REQUIRED_INPUT_KEYS);
  if (!values.ok) {
    return liftV6Envelope(
      await runWrongQuestionOrganizerV6ModelCandidate(FAIL_CLOSED_V6_INPUT),
      null,
    );
  }

  const authority = deriveWrongQuestionOrganizerV5Shortlist(values.values.shortlistSource);
  if (!authority.ok) {
    return liftV6Envelope(
      await runWrongQuestionOrganizerV6ModelCandidate(
        createDelegatedV6Input(values.values, FAIL_CLOSED_V6_RUNTIME),
      ),
      null,
    );
  }
  const adapter = createWrongQuestionOrganizerV8RuntimeAdapter({
    runtime: values.values.runtime,
    authority: authority.value,
    diagnosticCollector,
  });
  if (adapter === null) {
    return liftV6Envelope(
      await runWrongQuestionOrganizerV6ModelCandidate(
        createDelegatedV6Input(values.values, FAIL_CLOSED_V6_RUNTIME),
      ),
      null,
    );
  }

  const delegatedInput = createDelegatedV6Input(values.values, adapter.runtime);
  const result = await runWrongQuestionOrganizerV6ModelCandidate(delegatedInput);
  const lastDecision = adapter.readLastDecision();
  const dynamicFailure = adapter.readDynamicFailure();
  let normalizedResult = result;
  if (
    lastDecision !== null &&
    dynamicFailure !== null &&
    result.observation.disposition === 'fallback_schema_invalid' &&
    DYNAMIC_AUTHORITY_FAILURES.has(dynamicFailure)
  ) {
    diagnosticCollector.recordDynamicAuthorityFailure(lastDecision);
    normalizedResult = {
      ...result,
      observation: {
        ...result.observation,
        reasonCodes: ['fallback_schema_invalid', dynamicFailure],
      },
    };
  } else if (
    result.observation.attempted &&
    'trace' in result.observation &&
    result.observation.trace?.structuredOutputStage === 'provider_type_validation'
  ) {
    if (diagnosticCollector.read() === null) diagnosticCollector.recordUnknownFailure();
    normalizedResult = {
      ...result,
      observation: {
        ...result.observation,
        disposition: 'fallback_schema_invalid',
        reasonCodes: [
          'fallback_schema_invalid',
          ...(result.observation.reasonCodes.slice(
            1,
          ) as readonly WrongQuestionOrganizerV6CandidateReasonCode[]),
        ],
      },
    };
  }

  return liftV6Envelope(normalizedResult, diagnosticCollector.read());
}

function createDelegatedV6Input(
  values: Readonly<Record<string, unknown>>,
  runtime: WrongQuestionOrganizerV6ModelCandidateInput['runtime'],
) {
  return {
    runId: values.runId,
    shortlistSource: values.shortlistSource,
    runtime,
    budget: values.budget,
    revalidateSource: values.revalidateSource,
    ...(values.signal === undefined ? {} : { signal: values.signal }),
  } as WrongQuestionOrganizerV6ModelCandidateInput;
}

function liftV6Envelope(
  envelope: WrongQuestionOrganizerV6ModelCandidateEnvelope,
  diagnostic: WrongQuestionOrganizerV8BoundedSchemaDiagnostic | null,
): WrongQuestionOrganizerV8ModelCandidateEnvelope {
  const binding = envelope.result.binding;
  const result: WrongQuestionOrganizerV8CandidateResult = {
    binding:
      binding === null
        ? null
        : {
            candidateVersion: WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION,
            ownerDomain: binding.ownerDomain,
            ownerSnapshotVersion: binding.ownerSnapshotVersion,
            ownerSnapshotFingerprint: binding.ownerSnapshotFingerprint,
            shortlistVersion: binding.shortlistVersion,
            shortlistFingerprint: binding.shortlistFingerprint,
            questionIds: binding.questionIds,
          },
    suggestions: envelope.result.suggestions,
  };
  return deepFreezeModelValue({
    result,
    observation: envelope.observation,
    boundedSchemaDiagnostic: diagnostic,
  });
}
