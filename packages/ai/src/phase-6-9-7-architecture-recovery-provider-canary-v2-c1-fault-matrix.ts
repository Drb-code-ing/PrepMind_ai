import { z } from 'zod';

import { PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES } from './phase-6-9-7-architecture-recovery-proxy-preflight.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
  type Phase697ArchitectureRecoveryProviderCanaryV2C1Report,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c1-contract.ts';
import {
  consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation,
  runPhase697ArchitectureRecoveryProviderCanaryV2C1,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c1.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-fault-matrix-v1' as const;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS =
  Object.freeze([
    'direct_ready',
    'loopback_ready',
    'loopback_unavailable',
    'listener_probe_failed',
    'listener_probe_hang',
    'abort_before',
    'abort_during',
    'hostile_accessor',
    'hostile_descriptor',
    'no_proxy_rejected',
    'proxy_conflict_rejected',
    'capability_replay',
    'capability_concurrency',
    'capability_clone',
    'legacy_identity_rejected',
  ] as const);

export type Phase697ArchitectureRecoveryProviderCanaryV2C1FaultScenario =
  (typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS)[number];

const ATTESTATION_CODES = Object.freeze([
  'attestation_consumed',
  'attestation_invalid',
  'attestation_replayed',
] as const);

const CASE_SCHEMA = z
  .object({
    scenario: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS),
    passed: z.boolean(),
    preflightCode: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES).nullable(),
    attestationCode: z.enum(ATTESTATION_CODES).nullable(),
    listenerProbeCalls: z.union([z.literal(0), z.literal(1)]),
    providerCalls: z.literal(0),
    rawDataRetained: z.literal(false),
  })
  .strict();

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_SCHEMA = z
  .object({
    version: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_VERSION,
    ),
    namespace: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE),
    authority: z.literal('synthetic_test'),
    qualityAuthority: z.literal('none'),
    providerHealth: z.literal('unknown'),
    zeroNetwork: z.literal(true),
    scenarioCount: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS.length,
    ),
    passed: z.number().int().min(0),
    failed: z.number().int().min(0),
    providerCalls: z.literal(0),
    downstream: z
      .object({
        credentialReads: z.literal(0),
        sourceReads: z.literal(0),
        markerWrites: z.literal(0),
        providerDelegates: z.literal(0),
      })
      .strict(),
    cases: z.array(CASE_SCHEMA).readonly(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.cases.length !== value.scenarioCount ||
      value.passed !== value.cases.filter((entry) => entry.passed).length ||
      value.failed !== value.cases.filter((entry) => !entry.passed).length ||
      value.passed + value.failed !== value.scenarioCount
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'fault_matrix_count_invalid' });
    }
    for (let index = 0; index < value.cases.length; index += 1) {
      if (
        value.cases[index]?.scenario !==
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS[index]
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'fault_matrix_order_invalid' });
        break;
      }
    }
  });

export type Phase697ArchitectureRecoveryProviderCanaryV2C1FaultMatrixReport = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_SCHEMA
>;

const LOOPBACK_PROXY = 'http://127.0.0.1:7897';
const RAW_SENTINEL = 'v2-c1-fault-raw-value';

/**
 * Runs a closed, in-process matrix. It exposes no fetch, credential, source,
 * marker, output-path, retry, or Provider injection point.
 */
export async function runPhase697ArchitectureRecoveryProviderCanaryV2C1FaultMatrix(): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C1FaultMatrixReport> {
  const cases = [];
  for (const scenario of PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS) {
    try {
      cases.push(await runScenario(scenario));
    } catch {
      cases.push(
        caseResult({
          scenario,
          passed: false,
          preflightCode: null,
          attestationCode: null,
          listenerProbeCalls: 0,
        }),
      );
    }
  }
  const parsed = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_SCHEMA.parse({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_MATRIX_VERSION,
    namespace: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
    authority: 'synthetic_test',
    qualityAuthority: 'none',
    providerHealth: 'unknown',
    zeroNetwork: true,
    scenarioCount: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_FAULT_SCENARIOS.length,
    passed: cases.filter((entry) => entry.passed).length,
    failed: cases.filter((entry) => !entry.passed).length,
    providerCalls: 0,
    downstream: {
      credentialReads: 0,
      sourceReads: 0,
      markerWrites: 0,
      providerDelegates: 0,
    },
    cases,
  });
  return Object.freeze({
    ...parsed,
    downstream: Object.freeze({ ...parsed.downstream }),
    cases: Object.freeze(parsed.cases.map((entry) => Object.freeze({ ...entry }))),
  });
}

async function runScenario(scenario: Phase697ArchitectureRecoveryProviderCanaryV2C1FaultScenario) {
  switch (scenario) {
    case 'direct_ready': {
      const admission = await directAdmission();
      const consumed = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
        admission.attestation,
      );
      return fromReport(
        scenario,
        admission.report,
        consumed.code,
        consumed.ok && admission.attestation !== null,
      );
    }
    case 'loopback_ready': {
      const admission = await loopbackAdmission(async () => true);
      const consumed = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
        admission.attestation,
      );
      return fromReport(
        scenario,
        admission.report,
        consumed.code,
        consumed.ok && admission.attestation !== null,
      );
    }
    case 'loopback_unavailable': {
      const admission = await loopbackAdmission(async () => false);
      return fromReport(
        scenario,
        admission.report,
        null,
        admission.attestation === null &&
          admission.report.preflight.code === 'loopback_proxy_unavailable',
      );
    }
    case 'listener_probe_failed': {
      const admission = await loopbackAdmission(async () => {
        throw new Error(RAW_SENTINEL);
      });
      return fromReport(
        scenario,
        admission.report,
        null,
        admission.attestation === null &&
          admission.report.preflight.code === 'listener_probe_failed',
      );
    }
    case 'listener_probe_hang': {
      const admission = await loopbackAdmission(() => new Promise<boolean>(() => undefined));
      return fromReport(
        scenario,
        admission.report,
        null,
        admission.attestation === null &&
          admission.report.preflight.code === 'loopback_proxy_unavailable',
      );
    }
    case 'abort_before': {
      const controller = new AbortController();
      controller.abort();
      const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
        { env: { HTTPS_PROXY: LOOPBACK_PROXY }, signal: controller.signal },
        {
          async probeLoopbackListener() {
            return true;
          },
        },
      );
      return fromReport(
        scenario,
        admission.report,
        null,
        admission.attestation === null && admission.report.preflight.code === 'aborted',
      );
    }
    case 'abort_during': {
      const controller = new AbortController();
      const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
        { env: { HTTPS_PROXY: LOOPBACK_PROXY }, signal: controller.signal },
        {
          async probeLoopbackListener() {
            controller.abort();
            return true;
          },
        },
      );
      return fromReport(
        scenario,
        admission.report,
        null,
        admission.attestation === null && admission.report.preflight.code === 'aborted',
      );
    }
    case 'hostile_accessor': {
      let reads = 0;
      const env: Record<string, unknown> = {};
      Object.defineProperty(env, 'HTTPS_PROXY', {
        enumerable: true,
        get() {
          reads += 1;
          return RAW_SENTINEL;
        },
      });
      const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
        { env, signal: new AbortController().signal },
        {
          async probeLoopbackListener() {
            return true;
          },
        },
      );
      return fromReport(
        scenario,
        admission.report,
        null,
        reads === 0 &&
          admission.attestation === null &&
          admission.report.preflight.code === 'proxy_environment_invalid',
      );
    }
    case 'hostile_descriptor': {
      const env = new Proxy(Object.create(null) as Record<string, unknown>, {
        getOwnPropertyDescriptor() {
          throw new Error(RAW_SENTINEL);
        },
      });
      const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
        { env, signal: new AbortController().signal },
        {
          async probeLoopbackListener() {
            return true;
          },
        },
      );
      return fromReport(
        scenario,
        admission.report,
        null,
        admission.attestation === null &&
          admission.report.preflight.code === 'proxy_environment_invalid',
      );
    }
    case 'no_proxy_rejected': {
      const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
        { env: { NO_PROXY: 'api.deepseek.com' }, signal: new AbortController().signal },
        {
          async probeLoopbackListener() {
            return true;
          },
        },
      );
      return fromReport(
        scenario,
        admission.report,
        null,
        admission.attestation === null &&
          admission.report.preflight.code === 'no_proxy_unsupported',
      );
    }
    case 'proxy_conflict_rejected': {
      const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
        {
          env: { HTTPS_PROXY: LOOPBACK_PROXY, https_proxy: 'http://127.0.0.1:7898' },
          signal: new AbortController().signal,
        },
        {
          async probeLoopbackListener() {
            return true;
          },
        },
      );
      return fromReport(
        scenario,
        admission.report,
        null,
        admission.attestation === null &&
          admission.report.preflight.code === 'proxy_config_conflict',
      );
    }
    case 'capability_replay': {
      const admission = await directAdmission();
      const first = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
        admission.attestation,
      );
      const replay = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
        admission.attestation,
      );
      return fromReport(
        scenario,
        admission.report,
        replay.code,
        first.ok && !replay.ok && replay.code === 'attestation_replayed',
      );
    }
    case 'capability_concurrency': {
      const admission = await directAdmission();
      const results = await Promise.all(
        Array.from({ length: 8 }, async () =>
          consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
            admission.attestation,
          ),
        ),
      );
      const winners = results.filter((entry) => entry.ok).length;
      const replayed = results.filter((entry) => entry.code === 'attestation_replayed').length;
      return fromReport(
        scenario,
        admission.report,
        winners === 1 ? 'attestation_consumed' : 'attestation_invalid',
        winners === 1 && replayed === 7,
      );
    }
    case 'capability_clone': {
      const admission = await directAdmission();
      const clone = Object.freeze({ ...admission.attestation });
      const rejected = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(clone);
      const original = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
        admission.attestation,
      );
      return fromReport(
        scenario,
        admission.report,
        rejected.code,
        rejected.code === 'attestation_invalid' && original.ok,
      );
    }
    case 'legacy_identity_rejected': {
      const rejected = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
        Object.freeze({
          version: 'phase-6.9.7-architecture-recovery-r3-provider-canary-report-v1',
        }),
      );
      return caseResult({
        scenario,
        passed: rejected.code === 'attestation_invalid',
        preflightCode: null,
        attestationCode: rejected.code,
        listenerProbeCalls: 0,
      });
    }
    default:
      return assertNeverScenario(scenario);
  }
}

function fromReport(
  scenario: Phase697ArchitectureRecoveryProviderCanaryV2C1FaultScenario,
  report: Phase697ArchitectureRecoveryProviderCanaryV2C1Report,
  attestationCode: (typeof ATTESTATION_CODES)[number] | null,
  passed: boolean,
) {
  return caseResult({
    scenario,
    passed,
    preflightCode: report.preflight.code,
    attestationCode,
    listenerProbeCalls: report.preflight.listenerProbeCalls,
  });
}

function caseResult(input: {
  scenario: Phase697ArchitectureRecoveryProviderCanaryV2C1FaultScenario;
  passed: boolean;
  preflightCode: (typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES)[number] | null;
  attestationCode: (typeof ATTESTATION_CODES)[number] | null;
  listenerProbeCalls: 0 | 1;
}) {
  return Object.freeze({
    ...input,
    providerCalls: 0 as const,
    rawDataRetained: false as const,
  });
}

function directAdmission() {
  return runPhase697ArchitectureRecoveryProviderCanaryV2C1(
    { env: {}, signal: new AbortController().signal },
    {
      async probeLoopbackListener() {
        return true;
      },
    },
  );
}

function loopbackAdmission(probeLoopbackListener: () => Promise<boolean>) {
  return runPhase697ArchitectureRecoveryProviderCanaryV2C1(
    { env: { HTTPS_PROXY: LOOPBACK_PROXY }, signal: new AbortController().signal },
    { probeLoopbackListener },
  );
}

function assertNeverScenario(value: never): never {
  void value;
  throw new Error('PROVIDER_CANARY_V2_C1_FAULT_SCENARIO_INVARIANT_FAILED');
}
