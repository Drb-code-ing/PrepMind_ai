import { z } from 'zod';

import {
  PHASE_6_9_7_SMALL_SAMPLE_EXACT_CONFIRMATION,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA,
  type Phase697SmallSampleConsumedProxyAttestation,
  type Phase697SmallSampleSource,
} from './phase-6-9-tutor-organizer-small-sample-authority.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA,
  type Phase697SmallSampleReport,
} from './phase-6-9-tutor-organizer-small-sample-contract.ts';
import type {
  Phase697SmallSampleCrashSealResult,
  Phase697SmallSampleReservation,
} from './phase-6-9-tutor-organizer-small-sample-durability.ts';
import type {
  Phase697SmallSampleHarness,
  RunPhase697SmallSampleInput,
} from './run-phase-6-9-tutor-organizer-small-sample.ts';

export const PHASE_6_9_7_SMALL_SAMPLE_CLI_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-cli-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_CRASH_SEAL_CONFIRMATION =
  'I_SEAL_PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_CRASH_ONLY_ONCE' as const;

export type Phase697SmallSampleCliCoreInput = Readonly<{
  args: readonly string[];
  root: string;
  authorizationEnv: Readonly<Record<string, string | undefined>>;
  signal: AbortSignal;
}>;

export type Phase697SmallSampleCliCorePorts = Readonly<{
  authority: 'controlled_live' | 'synthetic_test';
  preflight(signal: AbortSignal): Promise<unknown>;
  consumeProxyAttestation(value: unknown): Phase697SmallSampleConsumedProxyAttestation;
  readSource(root: string): Promise<Phase697SmallSampleSource>;
  readApproval(env: Readonly<Record<string, string | undefined>>): true;
  readCredential(env: Readonly<Record<string, string | undefined>>): string;
  reserve(input: {
    root: string;
    runId: string;
    runScope: 'branch';
    authority: 'controlled_live' | 'synthetic_test';
    mode: 'live';
    executorProvenance: 'deepseek_network' | 'synthetic_test';
    createdAt: string;
    source: Phase697SmallSampleSource;
    proxyAttestation: Phase697SmallSampleConsumedProxyAttestation;
  }): Promise<Phase697SmallSampleReservation>;
  createHarness(input: { runId: string; credential: string }): Phase697SmallSampleHarness;
  run(input: RunPhase697SmallSampleInput): Promise<Readonly<Phase697SmallSampleReport>>;
  validate(input: { root: string }): Promise<Readonly<{ ok: boolean; runId: string | null }>>;
  seal(input: { root: string }): Promise<Phase697SmallSampleCrashSealResult>;
  randomUUID(): string;
  now(): number;
  write(line: string): void;
}>;

export async function executePhase697SmallSampleCliCore(
  rawInput: Phase697SmallSampleCliCoreInput,
  rawPorts: Phase697SmallSampleCliCorePorts,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  if (!input || !ports) return 1;

  const blocked = (code: string, details: Readonly<Record<string, unknown>> = {}) => {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_7_SMALL_SAMPLE_CLI_VERSION,
        ok: false,
        evidenceSealed: false,
        qualityAuthority: 'none',
        code,
        ...details,
      }),
    );
    return 1 as const;
  };

  if (hasExactArgument(input.args, PHASE_6_9_7_SMALL_SAMPLE_CRASH_SEAL_CONFIRMATION)) {
    const result = await ports.seal({ root: input.root });
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_7_SMALL_SAMPLE_CLI_VERSION,
        evidenceSealed: result.ok,
        qualityAuthority: 'none',
        ...result,
      }),
    );
    return result.ok ? 0 : 1;
  }
  if (!hasExactArgument(input.args, PHASE_6_9_7_SMALL_SAMPLE_EXACT_CONFIRMATION)) {
    return blocked('cli_argument_invalid', { providerCalls: 0 });
  }
  if (isAborted(input.signal)) return blocked('preflight_aborted', { providerCalls: 0 });

  let consumedProxyAttestation: Phase697SmallSampleConsumedProxyAttestation;
  try {
    const attestation = await ports.preflight(input.signal);
    // Synchronous single-consume is deliberately the first action after the
    // preflight await and before source, approval, credential, or marker I/O.
    consumedProxyAttestation = ports.consumeProxyAttestation(attestation);
  } catch {
    return blocked('preflight_rejected', { providerCalls: 0 });
  }

  let source: Phase697SmallSampleSource;
  try {
    source = PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA.parse(await ports.readSource(input.root));
  } catch {
    return blocked('source_invalid', { providerCalls: 0 });
  }
  if (isAborted(input.signal)) return blocked('source_aborted', { providerCalls: 0 });

  try {
    ports.readApproval(input.authorizationEnv);
  } catch {
    return blocked('live_not_authorized', { providerCalls: 0 });
  }
  let credential: string;
  try {
    credential = ports.readCredential(input.authorizationEnv);
  } catch {
    return blocked('live_configuration_invalid', { providerCalls: 0 });
  }
  if (isAborted(input.signal)) {
    return blocked('live_aborted_before_reservation', { providerCalls: 0 });
  }

  let runId: string;
  let createdAt: string;
  try {
    runId = z.string().uuid().parse(ports.randomUUID());
    createdAt = z.string().datetime({ offset: true }).parse(new Date(ports.now()).toISOString());
  } catch {
    return blocked('live_preflight_invalid', { providerCalls: 0 });
  }

  const executorProvenance =
    ports.authority === 'controlled_live'
      ? ('deepseek_network' as const)
      : ('synthetic_test' as const);
  let reservation: Phase697SmallSampleReservation;
  try {
    reservation = await ports.reserve({
      root: input.root,
      runId,
      runScope: 'branch',
      authority: ports.authority,
      mode: 'live',
      executorProvenance,
      createdAt,
      source,
      proxyAttestation: consumedProxyAttestation,
    });
  } catch {
    return blocked('live_once_already_consumed_or_evidence_io', { providerCalls: 0 });
  }

  let report: Phase697SmallSampleReport;
  try {
    const harness = ports.createHarness({ runId, credential });
    if (harness.mode !== 'live' || harness.executorProvenance !== executorProvenance) {
      throw new Error('harness_authority_mismatch');
    }
    report = PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.parse(
      await ports.run({
        runId,
        runScope: 'branch',
        approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
        sourceHashes: source.sourceHashes,
        harness,
        lifecycle: reservation.lifecycle,
        signal: input.signal,
      }),
    );
  } catch {
    return blocked('live_runtime_or_evidence_io');
  }

  try {
    const published = await reservation.publishArtifact(report);
    const validation = await ports.validate({ root: input.root });
    if (!validation.ok || validation.runId !== runId) throw new Error('bundle_invalid');
    const passed = report.gate === 'small_sample_quality_gate_passed';
    if (
      !safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_7_SMALL_SAMPLE_CLI_VERSION,
          ok: passed,
          evidenceSealed: true,
          authority: ports.authority,
          qualityAuthority:
            ports.authority === 'controlled_live' && passed ? 'small_sample_semantic_gate' : 'none',
          runId,
          gate: report.gate,
          guards: report.safety.guardVerifiedZeroCalls,
          runtimeAccounting: report.runtimeAccounting,
          wire: report.wire,
          metrics: report.metrics,
          latency: report.latency,
          usage: report.usage,
          safety: report.safety,
          artifactSha256: published.evidenceSha256,
        }),
      )
    ) {
      return 1;
    }
    return passed ? 0 : 1;
  } catch {
    return blocked('live_evidence_io');
  }
}

function readInput(value: unknown): Phase697SmallSampleCliCoreInput | null {
  const fields = readExactOwnData(value, ['args', 'authorizationEnv', 'root', 'signal']);
  if (
    !fields ||
    !Array.isArray(fields.args) ||
    fields.args.some((entry) => typeof entry !== 'string') ||
    !isRecord(fields.authorizationEnv) ||
    typeof fields.root !== 'string' ||
    fields.root.length === 0 ||
    !isAbortSignal(fields.signal)
  ) {
    return null;
  }
  return Object.freeze({
    args: Object.freeze(fields.args.map((entry) => String(entry))),
    root: fields.root,
    authorizationEnv: fields.authorizationEnv as Record<string, string | undefined>,
    signal: fields.signal,
  });
}

function readPorts(value: unknown): Phase697SmallSampleCliCorePorts | null {
  const fields = readExactOwnData(value, [
    'authority',
    'consumeProxyAttestation',
    'createHarness',
    'now',
    'preflight',
    'randomUUID',
    'readApproval',
    'readCredential',
    'readSource',
    'reserve',
    'run',
    'seal',
    'validate',
    'write',
  ]);
  if (
    !fields ||
    (fields.authority !== 'controlled_live' && fields.authority !== 'synthetic_test') ||
    Object.entries(fields).some(
      ([key, field]) => key !== 'authority' && typeof field !== 'function',
    )
  ) {
    return null;
  }
  return Object.freeze(fields as unknown as Phase697SmallSampleCliCorePorts);
}

function readExactOwnData(value: unknown, expectedKeys: readonly string[]) {
  try {
    if (!isRecord(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const fields = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      fields[key] = descriptor.value;
    }
    return fields;
  } catch {
    return null;
  }
}

function hasExactArgument(args: readonly string[], expected: string) {
  try {
    return args.length === 1 && args[0] === expected;
  } catch {
    return false;
  }
}

function safeWrite(write: (line: string) => void, line: string) {
  try {
    write(line);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}
