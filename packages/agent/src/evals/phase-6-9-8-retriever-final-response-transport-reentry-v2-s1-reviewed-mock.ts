import {
  createPhase698TransportReentryV2C2SyntheticAdmissionForTest,
  makePhase698TransportReentryV2C2SyntheticConfigurationForTest,
  type Phase698TransportReentryV2C2Slot,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts';
import {
  createPhase698TransportReentryV2C2SyntheticRootForTest,
  removePhase698TransportReentryV2C2SyntheticRootForTest,
  runPhase698TransportReentryV2C2Synthetic,
  Phase698TransportReentryV2C2SyntheticPortFailure,
  type Phase698TransportReentryV2C2SyntheticPorts,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts';
import {
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_ADAPTERS,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_VERSION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_GATE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_MAX_COST_CNY,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_REPORT_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_RUN_ID,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_VERSION,
  phase698TransportReentryV2S1Canonical,
  phase698TransportReentryV2S1Sha256,
  createPhase698TransportReentryV2S1SyntheticAdmissionForTest,
  consumePhase698TransportReentryV2S1AdmissionCapability,
  type Phase698TransportReentryV2S1AdapterAudit,
  type Phase698TransportReentryV2S1Checkpoint,
  type Phase698TransportReentryV2S1ReviewedMockReport,
  type Phase698TransportReentryV2S1Source,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-contract.ts';
import { PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE } from './phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FORBIDDEN_DEPENDENCIES = Object.freeze([
  'root_dotenv',
  'provider_credential',
  'external_network',
  'raw_provider_response',
  'evaluation_expected_output',
  'evaluation_oracle',
  'business_write',
  'trace_write',
  'background_job',
  'outbox',
]);

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_DESCRIPTOR = Object.freeze({
  version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_VERSION,
  lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  adapterSlots: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_ADAPTERS,
  transport: 'c2_synthetic_port_seam',
  responderInput: 'actual_bounded_synthetic_payload',
  providerCalls: 0,
  credentialReads: 0,
  formalEvidence: 0,
  forbiddenDependencies: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FORBIDDEN_DEPENDENCIES,
});

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_SHA256 =
  `sha256:${phase698TransportReentryV2S1Sha256(
    phase698TransportReentryV2S1Canonical(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_DESCRIPTOR),
  )}` as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_FACTORY_SHA256 =
  'sha256:c50b257dd79cd0f9a36f6f93a375ac19deda8b1e9d15ef9cc0d845ad5f64cc20' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_REPORT_SHA256 =
  '8538b13ca16e8c011f00fcec815ca10de60638cd3ddc7e543edeb2d49b96c068' as const;

export type Phase698TransportReentryV2S1Fault =
  'abort' | 'timeout' | 'transport' | 'schema' | 'usage';

export type Phase698TransportReentryV2S1ReviewedMockHarness = Readonly<{
  ports: Phase698TransportReentryV2C2SyntheticPorts;
  audits: readonly Phase698TransportReentryV2S1AdapterAudit[];
}>;

export function createPhase698TransportReentryV2S1ReviewedMockHarnessForTest(
  input: Readonly<{
    faults?: Partial<Record<Phase698TransportReentryV2C2Slot, Phase698TransportReentryV2S1Fault>>;
    onAudit?: (audit: Phase698TransportReentryV2S1AdapterAudit) => void;
  }> = {},
): Phase698TransportReentryV2S1ReviewedMockHarness {
  const audits: Phase698TransportReentryV2S1AdapterAudit[] = [];
  const createPort = (
    adapter: (typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_ADAPTERS)[number],
  ): Phase698TransportReentryV2C2SyntheticPorts[Phase698TransportReentryV2C2Slot] => {
    return async ({ signal }) => {
      if (signal.aborted) throw new Phase698TransportReentryV2C2SyntheticPortFailure('abort');
      const fault = input.faults?.[adapter.slot];
      if (fault === 'abort' || fault === 'timeout' || fault === 'transport') {
        throw new Phase698TransportReentryV2C2SyntheticPortFailure(fault);
      }
      if (fault === 'schema' || fault === 'usage') {
        throw new Phase698TransportReentryV2C2SyntheticPortFailure(fault, {
          responseObserved: true,
        });
      }
      const audit = Object.freeze({
        slot: adapter.slot,
        adapterId: adapter.adapterId,
        provider: adapter.provider,
        modelRef: adapter.modelRef,
        mode: 'reviewed_mock' as const,
        inputShape: 'fact_free_bounded' as const,
        outputShape: 'strict_usage_envelope' as const,
        dispatches: 1 as const,
        responses: 1 as const,
        verifiedUsage: 1 as const,
        providerCalls: 0 as const,
        credentialReads: 0 as const,
        rawDataRetained: false as const,
        oracleRead: false as const,
      });
      audits.push(audit);
      input.onAudit?.(audit);
      return Object.freeze({
        usage:
          adapter.slot === 'qwen'
            ? { inputTokens: 128, outputTokens: 0, totalTokens: 128 }
            : adapter.slot === 'rewrite'
              ? { inputTokens: 96, outputTokens: 24, totalTokens: 120 }
              : { inputTokens: 256, outputTokens: 96, totalTokens: 352 },
        durationMs: adapter.slot === 'final_response' ? 4 : adapter.slot === 'qwen' ? 3 : 2,
      });
    };
  };
  const ports: Phase698TransportReentryV2C2SyntheticPorts = Object.freeze({
    rewrite: createPort(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_ADAPTERS[0]),
    qwen: createPort(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_ADAPTERS[1]),
    final_response: createPort(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_ADAPTERS[2]),
  });
  return Object.freeze({ ports: Object.freeze(ports), audits });
}

export async function buildPhase698TransportReentryV2S1ReviewedMockCheckpoint(): Promise<Phase698TransportReentryV2S1Checkpoint> {
  const root = await createPhase698TransportReentryV2C2SyntheticRootForTest();
  try {
    const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
    const s1Admission = createPhase698TransportReentryV2S1SyntheticAdmissionForTest();
    const admittedSource = consumePhase698TransportReentryV2S1AdmissionCapability(
      s1Admission.capability,
      'synthetic_test',
    );
    const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
    const harness = createPhase698TransportReentryV2S1ReviewedMockHarnessForTest();
    const result = await runPhase698TransportReentryV2C2Synthetic({
      root,
      admissionCapability: admission.capability,
      configurationCapability: configuration.capability,
      reservationCapability: admission.reservationCapability,
      ports: harness.ports,
      runId: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_RUN_ID,
    });
    if (!result.validation.ok || !result.report.passed || harness.audits.length !== 3) {
      throw new Error('S1_REVIEWED_MOCK_RUNNER_GATE_INVALID');
    }
    const report = PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_REPORT_SCHEMA.parse(
      buildReport(result.report, result.validation, admittedSource.source, harness.audits),
    );
    const reportSha256 = phase698TransportReentryV2S1Sha256(
      phase698TransportReentryV2S1Canonical(report),
    );
    if (
      (!PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_FACTORY_SHA256.includes('__') &&
        PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_SHA256 !==
          PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_FACTORY_SHA256) ||
      (!PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_REPORT_SHA256.includes('__') &&
        reportSha256 !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_REPORT_SHA256)
    ) {
      throw new Error('S1_REVIEWED_MOCK_SHA_NOT_FROZEN');
    }
    return Object.freeze({
      authority: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_AUTHORITY,
      qualityAuthority: 'none' as const,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      formalEvidence: 0 as const,
      factorySha256: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_SHA256,
      reportSha256,
      report,
    });
  } finally {
    await removePhase698TransportReentryV2C2SyntheticRootForTest(root);
  }
}

export async function runPhase698TransportReentryV2S1FaultMatrixForTest() {
  const cases: readonly (Phase698TransportReentryV2S1Fault | 'success' | 'abort_before_qwen')[] = [
    'success',
    'timeout',
    'transport',
    'schema',
    'usage',
    'abort_before_qwen',
  ];
  const outcomes: Array<
    Readonly<{ fault: string; bundleValid: boolean; providerCalls: 0; audits: number }>
  > = [];
  for (const fault of cases) {
    const root = await createPhase698TransportReentryV2C2SyntheticRootForTest();
    try {
      const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
      const harness = createPhase698TransportReentryV2S1ReviewedMockHarnessForTest(
        fault === 'success' || fault === 'abort_before_qwen' ? {} : { faults: { rewrite: fault } },
      );
      const result = await runPhase698TransportReentryV2C2Synthetic({
        root,
        admissionCapability: admission.capability,
        configurationCapability: configuration.capability,
        reservationCapability: admission.reservationCapability,
        ports: harness.ports,
        abortBeforeSlot: fault === 'abort_before_qwen' ? 'qwen' : undefined,
      });
      outcomes.push({
        fault,
        bundleValid: result.validation.ok,
        providerCalls: result.validation.providerCalls,
        audits: harness.audits.length,
      });
    } finally {
      await removePhase698TransportReentryV2C2SyntheticRootForTest(root);
    }
  }
  return outcomes;
}

function buildReport(
  runnerReport: Awaited<ReturnType<typeof runPhase698TransportReentryV2C2Synthetic>>['report'],
  validation: Awaited<ReturnType<typeof runPhase698TransportReentryV2C2Synthetic>>['validation'],
  source: Phase698TransportReentryV2S1Source,
  audits: readonly Phase698TransportReentryV2S1AdapterAudit[],
): Phase698TransportReentryV2S1ReviewedMockReport {
  const usage = runnerReport.slots.map((slot) => slot.usage).filter((value) => value !== null);
  const inputTokens = usage.reduce((sum, value) => sum + (value?.inputTokens ?? 0), 0);
  const outputTokens = usage.reduce((sum, value) => sum + (value?.outputTokens ?? 0), 0);
  const totalTokens = usage.reduce((sum, value) => sum + (value?.totalTokens ?? 0), 0);
  const passed =
    validation.ok &&
    runnerReport.passed &&
    audits.length === 3 &&
    audits.every(
      (audit) => audit.dispatches === 1 && audit.responses === 1 && audit.verifiedUsage === 1,
    );
  return {
    schemaVersion: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    authority: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_AUTHORITY,
    qualityAuthority: 'none',
    runId: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_RUN_ID,
    source,
    factory: {
      version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_VERSION,
      sha256: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_SHA256,
      adapterCount: 3,
      responderInput: 'actual_bounded_synthetic_payload',
      expectedRead: false,
      oracleRead: false,
    },
    execution: {
      mode: 'reviewed_mock',
      authority: 'synthetic_test',
      providerCalls: 0,
      credentialReads: 0,
      syntheticPortCalls: 3,
      retry: false,
      replay: false,
      resume: false,
      backfill: false,
      backgroundJob: false,
      outbox: false,
      traceWrites: 0,
      businessWrites: 0,
    },
    adapters: [...audits],
    runner: {
      authority: runnerReport.authority,
      gate: runnerReport.gate,
      passed: runnerReport.passed,
      plannedSlots: 3,
      startedSlots: runnerReport.startedSlots,
      completedSlots: runnerReport.completedSlots,
      verifiedUsageSlots: runnerReport.verifiedUsageSlots,
      syntheticPortCalls: runnerReport.syntheticPortCalls,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
      breakerOpen: runnerReport.breaker.open,
      breakerReason: runnerReport.breaker.reason,
      reportRawDataRetained: runnerReport.rawDataRetained,
    },
    wire: {
      runnerReservations: exactlyThree(
        runnerReport.slots.reduce((sum, slot) => sum + slot.runnerWire.reservations, 0),
      ),
      runnerDispatches: exactlyThree(
        runnerReport.slots.reduce((sum, slot) => sum + slot.runnerWire.dispatches, 0),
      ),
      runnerReturns: exactlyThree(
        runnerReport.slots.reduce((sum, slot) => sum + slot.runnerWire.harnessReturns, 0),
      ),
      runnerVerifiedResults: exactlyThree(
        runnerReport.slots.reduce((sum, slot) => sum + slot.runnerWire.verifiedResults, 0),
      ),
      providerExecutions: exactlyThree(
        runnerReport.slots.reduce((sum, slot) => sum + slot.providerWire.executions, 0),
      ),
      providerDispatches: exactlyThree(
        runnerReport.slots.reduce((sum, slot) => sum + slot.providerWire.dispatches, 0),
      ),
      providerResponses: exactlyThree(
        runnerReport.slots.reduce((sum, slot) => sum + slot.providerWire.responses, 0),
      ),
      providerVerifiedUsage: exactlyThree(
        runnerReport.slots.reduce((sum, slot) => sum + slot.providerWire.verifiedUsage, 0),
      ),
    },
    usage: {
      slots: 3,
      inputTokens,
      outputTokens,
      totalTokens,
      verifiedProviderCostCny: null,
      syntheticEstimateCny: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_MAX_COST_CNY,
    },
    safety: {
      permissionFailures: 0,
      crossOwnerFailures: 0,
      credentialFailures: 0,
      rawDataRetained: false,
      falseExecutionFailures: 0,
    },
    formalEvidence: {
      approvedTagCount: 0,
      markerCount: 0,
      journalCount: 0,
      artifactCount: 0,
      recoveryClaimCount: 0,
    },
    gate: {
      status: passed
        ? PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_GATE
        : 'transport_reentry_v2_s1_mock_quality_gate_failed',
      passed,
      qualityAuthority: 'none',
      failureReasons: passed ? [] : ['reviewed_mock_gate_failed'],
    },
  };
}

function exactlyThree(value: number): 3 {
  if (value !== 3) throw new Error('S1_REVIEWED_MOCK_WIRE_INVALID');
  return 3;
}
