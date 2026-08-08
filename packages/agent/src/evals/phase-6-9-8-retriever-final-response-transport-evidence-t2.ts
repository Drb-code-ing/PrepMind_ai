import { z } from 'zod';

import { deepFreezeModelValue } from '../model-candidates/model-projection-safety.ts';
import {
  parsePhase698TransportEvidenceDiagnostic,
  phase698TransportEvidenceStagesBefore,
  phase698TransportEvidenceWireForBoundary,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_FAMILIES,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES,
  type Phase698TransportEvidenceDiagnostic,
  type Phase698TransportEvidenceFamily,
  type Phase698TransportEvidenceProviderBoundary,
  type Phase698TransportEvidenceReasonCode,
  type Phase698TransportEvidenceStage,
} from './phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';
import {
  createPhase698TransportEvidenceFinalResponseCapability,
  recordPhase698TransportEvidenceFinalResponseObservation,
} from './phase-6-9-8-retriever-final-response-transport-evidence-final-response.ts';
import {
  createPhase698TransportEvidenceQwenCapability,
  recordPhase698TransportEvidenceQwenObservation,
} from './phase-6-9-8-retriever-final-response-transport-evidence-qwen.ts';
import {
  createPhase698TransportEvidenceRewriteCapability,
  recordPhase698TransportEvidenceRewriteObservation,
} from './phase-6-9-8-retriever-final-response-transport-evidence-rewrite.ts';

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t2-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY =
  'zero_provider_transport_evidence_t2' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE =
  'transport_evidence_t2_zero_provider_passed' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE_FAILED =
  'transport_evidence_t2_zero_provider_failed' as const;

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_KINDS = [
  'boundary',
  'failure',
  'race',
  'capability',
  'publication',
] as const;
export type Phase698TransportEvidenceT2CaseKind =
  (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_KINDS)[number];

const ACCEPTED_EXPECTATION_SCHEMA = z
  .object({
    disposition: z.literal('accepted'),
    stage: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES),
    reasonCode: z.enum([
      'applied',
      'aborted',
      'timeout',
      'dns',
      'tls',
      'proxy',
      'connection_refused',
      'connection_reset',
      'network_unreachable',
      'http_status',
      'envelope_invalid',
      'schema_invalid',
      'stream_event_invalid',
      'usage_invalid',
      'unknown',
    ]),
    providerBoundary: z.enum([
      'not_dispatched',
      'dispatched_no_response',
      'response_observed',
      'response_and_usage_observed',
      'unknown',
    ]),
  })
  .strict();
const REJECTED_EXPECTATION_SCHEMA = z
  .object({
    disposition: z.literal('rejected'),
    failureCode: z.enum([
      'abort_before_start',
      'capability_forged',
      'capability_reused',
      'capability_cross_family',
      'publication_invalid',
    ]),
  })
  .strict();
type AcceptedExpectation = z.infer<typeof ACCEPTED_EXPECTATION_SCHEMA>;
type RejectedExpectation = z.infer<typeof REJECTED_EXPECTATION_SCHEMA>;

export type Phase698TransportEvidenceT2CaseSpec = Readonly<{
  caseId: string;
  family: Phase698TransportEvidenceFamily;
  kind: Phase698TransportEvidenceT2CaseKind;
  expected: AcceptedExpectation | RejectedExpectation;
}>;

function accepted(
  stage: Phase698TransportEvidenceStage,
  reasonCode: Phase698TransportEvidenceReasonCode,
  providerBoundary: Phase698TransportEvidenceProviderBoundary,
): AcceptedExpectation {
  return ACCEPTED_EXPECTATION_SCHEMA.parse({
    disposition: 'accepted',
    stage,
    reasonCode,
    providerBoundary,
  });
}

function rejected(failureCode: RejectedExpectation['failureCode']): RejectedExpectation {
  return { disposition: 'rejected', failureCode };
}

const FIXED_CASES: readonly Phase698TransportEvidenceT2CaseSpec[] =
  PHASE_6_9_8_TRANSPORT_EVIDENCE_FAMILIES.flatMap((family) => [
    {
      caseId: `${family}-boundary-not-dispatched`,
      family,
      kind: 'boundary',
      expected: accepted('preflight', 'unknown', 'not_dispatched'),
    },
    {
      caseId: `${family}-boundary-dispatched-no-response`,
      family,
      kind: 'boundary',
      expected: accepted('dispatch_started', 'unknown', 'dispatched_no_response'),
    },
    {
      caseId: `${family}-boundary-response-observed`,
      family,
      kind: 'boundary',
      expected: accepted('response_observed', 'envelope_invalid', 'response_observed'),
    },
    {
      caseId: `${family}-boundary-response-and-usage-observed`,
      family,
      kind: 'boundary',
      expected: accepted('terminal', 'applied', 'response_and_usage_observed'),
    },
    {
      caseId: `${family}-failure-aborted`,
      family,
      kind: 'failure',
      expected: accepted('preflight', 'aborted', 'not_dispatched'),
    },
    {
      caseId: `${family}-failure-timeout`,
      family,
      kind: 'failure',
      expected: accepted('dispatch_started', 'timeout', 'dispatched_no_response'),
    },
    {
      caseId: `${family}-failure-transport-error`,
      family,
      kind: 'failure',
      expected: accepted('dispatch_started', 'unknown', 'dispatched_no_response'),
    },
    {
      caseId: `${family}-failure-contract-error`,
      family,
      kind: 'failure',
      expected: accepted('response_observed', 'schema_invalid', 'response_observed'),
    },
  ]);

const EXTRA_CASES: readonly Phase698TransportEvidenceT2CaseSpec[] = [
  {
    caseId: 'race-parent-abort-child-timeout',
    family: 'rewrite',
    kind: 'race',
    expected: accepted('dispatch_started', 'aborted', 'dispatched_no_response'),
  },
  {
    caseId: 'race-abort-dispatch-boundaries',
    family: 'qwen',
    kind: 'race',
    expected: accepted('dispatch_started', 'aborted', 'dispatched_no_response'),
  },
  {
    caseId: 'capability-forged',
    family: 'rewrite',
    kind: 'capability',
    expected: rejected('capability_forged'),
  },
  {
    caseId: 'capability-reused',
    family: 'qwen',
    kind: 'capability',
    expected: rejected('capability_reused'),
  },
  {
    caseId: 'capability-cross-family',
    family: 'final_response',
    kind: 'capability',
    expected: rejected('capability_cross_family'),
  },
  {
    caseId: 'publication-missing-fields',
    family: 'final_response',
    kind: 'publication',
    expected: rejected('publication_invalid'),
  },
];

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_MANIFEST = deepFreezeModelValue([
  ...FIXED_CASES,
  ...EXTRA_CASES,
]);

const CLASSIFIER_FIXTURES = [
  ['aborted', 'rewrite', 'dispatch_started', 'aborted', 'dispatched_no_response'],
  ['timeout', 'rewrite', 'dispatch_started', 'timeout', 'dispatched_no_response'],
  ['dns', 'rewrite', 'dispatch_started', 'dns', 'dispatched_no_response'],
  ['tls', 'qwen', 'dispatch_started', 'tls', 'dispatched_no_response'],
  ['proxy', 'qwen', 'dispatch_started', 'proxy', 'dispatched_no_response'],
  [
    'connection-refused',
    'qwen',
    'dispatch_started',
    'connection_refused',
    'dispatched_no_response',
  ],
  ['connection-reset', 'qwen', 'dispatch_started', 'connection_reset', 'dispatched_no_response'],
  [
    'network-unreachable',
    'final_response',
    'dispatch_started',
    'network_unreachable',
    'dispatched_no_response',
  ],
  ['http-status', 'final_response', 'response_observed', 'http_status', 'response_observed'],
  [
    'envelope-invalid',
    'final_response',
    'response_observed',
    'envelope_invalid',
    'response_observed',
  ],
  ['schema-invalid', 'rewrite', 'response_observed', 'schema_invalid', 'response_observed'],
  [
    'stream-event-invalid',
    'final_response',
    'response_observed',
    'stream_event_invalid',
    'response_observed',
  ],
  ['usage-invalid', 'qwen', 'usage_observed', 'usage_invalid', 'response_and_usage_observed'],
  ['applied', 'final_response', 'terminal', 'applied', 'response_and_usage_observed'],
  ['unknown', 'rewrite', 'dispatch_started', 'unknown', 'unknown'],
] as const;

export type Phase698TransportEvidenceT2ClassifierFixture = Readonly<{
  fixtureId: string;
  family: Phase698TransportEvidenceFamily;
  stage: Phase698TransportEvidenceStage;
  reasonCode: Phase698TransportEvidenceReasonCode;
  providerBoundary: Phase698TransportEvidenceProviderBoundary;
}>;

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CLASSIFIER_FIXTURES: readonly Phase698TransportEvidenceT2ClassifierFixture[] =
  deepFreezeModelValue(
    CLASSIFIER_FIXTURES.map(([fixtureId, family, stage, reasonCode, providerBoundary]) => ({
      fixtureId,
      family,
      stage,
      reasonCode,
      providerBoundary,
    })),
  );

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_RESULT_SCHEMA = z
  .object({
    caseId: z.string().min(1).max(128),
    family: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_FAMILIES),
    kind: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_KINDS),
    passed: z.boolean(),
    disposition: z.enum(['accepted', 'rejected']),
    failureCode: z
      .enum([
        'abort_before_start',
        'capability_forged',
        'capability_reused',
        'capability_cross_family',
        'publication_invalid',
      ])
      .nullable(),
    diagnostic: z
      .object({
        lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
        callId: z.string().min(1).max(128),
        family: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_FAMILIES),
        phase: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_FAMILIES),
        stage: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES),
        reasonCode: z.enum([
          'applied',
          'aborted',
          'timeout',
          'dns',
          'tls',
          'proxy',
          'connection_refused',
          'connection_reset',
          'network_unreachable',
          'http_status',
          'envelope_invalid',
          'schema_invalid',
          'stream_event_invalid',
          'usage_invalid',
          'unknown',
        ]),
        providerBoundary: z.enum([
          'not_dispatched',
          'dispatched_no_response',
          'response_observed',
          'response_and_usage_observed',
          'unknown',
        ]),
        runnerWire: z
          .object({
            reservations: z.union([z.literal(0), z.literal(1)]),
            dispatches: z.union([z.literal(0), z.literal(1)]),
            harnessReturns: z.union([z.literal(0), z.literal(1)]),
            verifiedResults: z.union([z.literal(0), z.literal(1)]),
          })
          .strict(),
        providerWire: z
          .object({
            executions: z.union([z.literal(0), z.literal(1)]),
            dispatches: z.union([z.literal(0), z.literal(1)]),
            responses: z.union([z.literal(0), z.literal(1)]),
            verifiedUsage: z.union([z.literal(0), z.literal(1)]),
          })
          .strict(),
        diagnosticStages: z.array(z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES)),
        rawDataRetained: z.literal(false),
      })
      .strict()
      .nullable(),
    rawDataRetained: z.literal(false),
  })
  .strict();

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
    authority: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY),
    qualityAuthority: z.literal('none'),
    gate: z.enum([
      PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE,
      PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE_FAILED,
    ]),
    passed: z.boolean(),
    caseCount: z.literal(30),
    passedCases: z.number().int().min(0).max(30),
    classifierCount: z.literal(CLASSIFIER_FIXTURES.length),
    passedClassifiers: z.number().int().min(0).max(CLASSIFIER_FIXTURES.length),
    syntheticCalls: z.number().int().min(0),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    formalEvidence: z.literal(0),
    productWrites: z.literal(0),
    cases: z.array(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_RESULT_SCHEMA).length(30),
    classifiers: z
      .array(
        z
          .object({
            fixtureId: z.string().min(1).max(128),
            accepted: z.boolean(),
            diagnostic: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_RESULT_SCHEMA.shape.diagnostic,
            rawDataRetained: z.literal(false),
          })
          .strict(),
      )
      .length(CLASSIFIER_FIXTURES.length),
    rawDataRetained: z.literal(false),
  })
  .strict();

export type Phase698TransportEvidenceT2CaseResult = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_RESULT_SCHEMA
>;
export type Phase698TransportEvidenceT2Report = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA
>;

export function runPhase698TransportEvidenceT2Static(
  input: {
    signal?: AbortSignal;
  } = {},
): Phase698TransportEvidenceT2Report {
  const abortedBeforeStart = input.signal?.aborted === true;
  const results = PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_MANIFEST.map((spec) =>
    abortedBeforeStart ? notStartedCase(spec) : runCase(spec),
  );
  const classifiers = abortedBeforeStart
    ? PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CLASSIFIER_FIXTURES.map((fixture) => ({
        fixtureId: fixture.fixtureId,
        accepted: false,
        diagnostic: null,
        rawDataRetained: false as const,
      }))
    : PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CLASSIFIER_FIXTURES.map(runClassifier);
  const passedCases = results.filter((result) => result.passed).length;
  const passedClassifiers = classifiers.filter((fixture) => fixture.accepted).length;
  const passed =
    !abortedBeforeStart &&
    passedCases === PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_MANIFEST.length &&
    passedClassifiers === PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CLASSIFIER_FIXTURES.length;
  return PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA.parse(
    deepFreezeModelValue({
      version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_VERSION,
      lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
      authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY,
      qualityAuthority: 'none' as const,
      gate: passed
        ? PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE
        : PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE_FAILED,
      passed,
      caseCount: 30 as const,
      passedCases,
      classifierCount: CLASSIFIER_FIXTURES.length,
      passedClassifiers,
      syntheticCalls: abortedBeforeStart
        ? 0
        : PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_MANIFEST.length,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      formalEvidence: 0 as const,
      productWrites: 0 as const,
      cases: results,
      classifiers,
      rawDataRetained: false as const,
    }),
  );
}

function runCase(spec: Phase698TransportEvidenceT2CaseSpec): Phase698TransportEvidenceT2CaseResult {
  if (spec.expected.disposition === 'rejected') return runRejectedCase(spec);
  if (spec.caseId === 'race-abort-dispatch-boundaries') {
    const beforeCapability = createPhase698TransportEvidenceQwenCapability(`${spec.caseId}-before`);
    const afterCapability = createPhase698TransportEvidenceQwenCapability(`${spec.caseId}-after`);
    const beforeExpectation = accepted('preflight', 'aborted', 'not_dispatched');
    const before = recordPhase698TransportEvidenceQwenObservation(
      beforeCapability,
      buildObservation('qwen', `${spec.caseId}-before`, beforeExpectation),
    );
    const after = recordPhase698TransportEvidenceQwenObservation(
      afterCapability,
      buildObservation('qwen', `${spec.caseId}-after`, spec.expected),
    );
    const passed =
      before !== null &&
      matchesExpectation(before, beforeExpectation) &&
      after !== null &&
      matchesExpectation(after, spec.expected);
    return freezeCase({
      caseId: spec.caseId,
      family: spec.family,
      kind: spec.kind,
      passed,
      disposition: passed ? 'accepted' : 'rejected',
      failureCode: passed ? null : 'publication_invalid',
      diagnostic: after,
      rawDataRetained: false,
    });
  }
  const capability = createCapability(spec.family, spec.caseId);
  const observation = buildObservation(spec.family, spec.caseId, spec.expected);
  const recorded = recordObservation(spec.family, capability, observation);
  const acceptedResult = recorded !== null && matchesExpectation(recorded, spec.expected);
  return freezeCase({
    caseId: spec.caseId,
    family: spec.family,
    kind: spec.kind,
    passed: acceptedResult,
    disposition: acceptedResult ? 'accepted' : 'rejected',
    failureCode: acceptedResult ? null : 'publication_invalid',
    diagnostic: recorded,
    rawDataRetained: false,
  });
}

function runRejectedCase(
  spec: Phase698TransportEvidenceT2CaseSpec,
): Phase698TransportEvidenceT2CaseResult {
  const expectation = REJECTED_EXPECTATION_SCHEMA.parse(spec.expected);
  switch (expectation.failureCode) {
    case 'capability_forged': {
      const capability = createPhase698TransportEvidenceRewriteCapability(spec.caseId);
      const forged = {
        version: capability.version,
        lineage: capability.lineage,
        family: capability.family,
        phase: capability.phase,
        callId: capability.callId,
      };
      const observation = buildObservation(
        'rewrite',
        spec.caseId,
        accepted('terminal', 'applied', 'response_and_usage_observed'),
      );
      const recorded = recordPhase698TransportEvidenceRewriteObservation(forged, observation);
      return rejectedCaseResult(spec, recorded, 'capability_forged');
    }
    case 'capability_reused': {
      const capability = createPhase698TransportEvidenceQwenCapability(spec.caseId);
      const observation = buildObservation(
        'qwen',
        spec.caseId,
        accepted('terminal', 'applied', 'response_and_usage_observed'),
      );
      const first = recordPhase698TransportEvidenceQwenObservation(capability, observation);
      const second = recordPhase698TransportEvidenceQwenObservation(capability, observation);
      return rejectedCaseResult(
        spec,
        second,
        first === null ? 'publication_invalid' : 'capability_reused',
      );
    }
    case 'capability_cross_family': {
      const capability = createPhase698TransportEvidenceRewriteCapability(spec.caseId);
      const observation = buildObservation(
        'rewrite',
        spec.caseId,
        accepted('terminal', 'applied', 'response_and_usage_observed'),
      );
      const recorded = recordPhase698TransportEvidenceQwenObservation(capability, observation);
      return rejectedCaseResult(spec, recorded, 'capability_cross_family');
    }
    case 'publication_invalid': {
      const malformed = {
        ...buildObservation(
          'final_response',
          spec.caseId,
          accepted('terminal', 'applied', 'response_and_usage_observed'),
        ),
        missing: true,
      };
      const recorded = parsePhase698TransportEvidenceDiagnostic(malformed);
      return rejectedCaseResult(spec, recorded, 'publication_invalid');
    }
    case 'abort_before_start':
      return rejectedCaseResult(spec, null, 'abort_before_start');
    default:
      return rejectedCaseResult(spec, null, 'publication_invalid');
  }
}

function rejectedCaseResult(
  spec: Phase698TransportEvidenceT2CaseSpec,
  diagnostic: Phase698TransportEvidenceDiagnostic | null,
  failureCode: RejectedExpectation['failureCode'],
): Phase698TransportEvidenceT2CaseResult {
  return freezeCase({
    caseId: spec.caseId,
    family: spec.family,
    kind: spec.kind,
    passed: diagnostic === null,
    disposition: diagnostic === null ? 'rejected' : 'accepted',
    failureCode: diagnostic === null ? failureCode : null,
    diagnostic,
    rawDataRetained: false,
  });
}

function notStartedCase(
  spec: Phase698TransportEvidenceT2CaseSpec,
): Phase698TransportEvidenceT2CaseResult {
  return freezeCase({
    caseId: spec.caseId,
    family: spec.family,
    kind: spec.kind,
    passed: false,
    disposition: 'rejected',
    failureCode: 'abort_before_start',
    diagnostic: null,
    rawDataRetained: false,
  });
}

function runClassifier(fixture: Phase698TransportEvidenceT2ClassifierFixture) {
  const expectation = accepted(fixture.stage, fixture.reasonCode, fixture.providerBoundary);
  const observation = buildObservation(
    fixture.family,
    `classifier-${fixture.fixtureId}`,
    expectation,
  );
  const parsed = parsePhase698TransportEvidenceDiagnostic(observation);
  return deepFreezeModelValue({
    fixtureId: fixture.fixtureId,
    accepted: parsed !== null && matchesExpectation(parsed, expectation),
    diagnostic: parsed,
    rawDataRetained: false as const,
  });
}

function buildObservation(
  family: Phase698TransportEvidenceFamily,
  callId: string,
  expectation: AcceptedExpectation,
): Phase698TransportEvidenceDiagnostic {
  const wire =
    expectation.providerBoundary === 'unknown'
      ? {
          runnerWire: {
            reservations: 1 as const,
            dispatches: 1 as const,
            harnessReturns: 0 as const,
            verifiedResults: 0 as const,
          },
          providerWire: {
            executions: 1 as const,
            dispatches: 1 as const,
            responses: 0 as const,
            verifiedUsage: 0 as const,
          },
        }
      : phase698TransportEvidenceWireForBoundary(expectation.providerBoundary);
  const diagnosticStages =
    expectation.reasonCode === 'applied'
      ? [...PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES]
      : [...phase698TransportEvidenceStagesBefore(expectation.stage)];
  const value = {
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    callId,
    family,
    phase: family,
    stage: expectation.stage,
    reasonCode: expectation.reasonCode,
    providerBoundary: expectation.providerBoundary,
    ...wire,
    diagnosticStages,
    rawDataRetained: false as const,
  };
  const parsed = parsePhase698TransportEvidenceDiagnostic(value);
  if (parsed === null) throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_FIXTURE_INVALID');
  return parsed;
}

function createCapability(family: Phase698TransportEvidenceFamily, callId: string) {
  switch (family) {
    case 'rewrite':
      return createPhase698TransportEvidenceRewriteCapability(callId);
    case 'qwen':
      return createPhase698TransportEvidenceQwenCapability(callId);
    case 'final_response':
      return createPhase698TransportEvidenceFinalResponseCapability(callId);
    default:
      return assertNeverFamily(family);
  }
}

function recordObservation(
  family: Phase698TransportEvidenceFamily,
  capability: unknown,
  observation: Phase698TransportEvidenceDiagnostic,
) {
  switch (family) {
    case 'rewrite':
      return recordPhase698TransportEvidenceRewriteObservation(capability, observation);
    case 'qwen':
      return recordPhase698TransportEvidenceQwenObservation(capability, observation);
    case 'final_response':
      return recordPhase698TransportEvidenceFinalResponseObservation(capability, observation);
    default:
      return assertNeverFamily(family);
  }
}

function matchesExpectation(
  diagnostic: Phase698TransportEvidenceDiagnostic,
  expectation: AcceptedExpectation,
) {
  return (
    diagnostic.stage === expectation.stage &&
    diagnostic.reasonCode === expectation.reasonCode &&
    diagnostic.providerBoundary === expectation.providerBoundary &&
    diagnostic.rawDataRetained === false
  );
}

function freezeCase(
  value: Phase698TransportEvidenceT2CaseResult,
): Phase698TransportEvidenceT2CaseResult {
  return deepFreezeModelValue(value);
}

function assertNeverFamily(value: never): never {
  throw new Error(`PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_FAMILY_INVALID:${String(value)}`);
}
