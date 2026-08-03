import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_APPROVAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONTROLLED_LIVE_BRANCH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CREDENTIAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CRASH_SEAL_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_SOURCE_SCHEMA,
  type Phase697ArchitectureRecoveryR3CanaryReport,
  type Phase697ArchitectureRecoveryR3CanarySource,
} from './phase-6-9-7-architecture-recovery-r3-canary-contract.ts';
import {
  reservePhase697ArchitectureRecoveryR3Canary,
  sealPhase697ArchitectureRecoveryR3InterruptedCanary,
  validatePhase697ArchitectureRecoveryR3CanaryBundle,
  type Phase697ArchitectureRecoveryR3CanaryReservation,
} from './phase-6-9-7-architecture-recovery-r3-canary-durability.ts';
import {
  createPhase697ArchitectureRecoveryR3ControlledLiveCanaryTransport,
  runPhase697ArchitectureRecoveryR3Canary,
  type Phase697V7WireStage,
} from './phase-6-9-7-architecture-recovery-r3-canary-runner.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CLI_VERSION =
  'phase-6.9.7-architecture-recovery-r3-provider-canary-cli-v1' as const;

export type Phase697ArchitectureRecoveryR3CanaryCliInput = Readonly<{
  args: readonly string[];
  env: Record<string, unknown>;
  root: string;
  signal: AbortSignal;
}>;

type Phase697ArchitectureRecoveryR3CanaryCliPorts = Readonly<{
  now(): number;
  randomUUID(): string;
  readSource(root: string): Promise<Phase697ArchitectureRecoveryR3CanarySource>;
  reserve(input: {
    root: string;
    runId: string;
    createdAt: string;
    source: Phase697ArchitectureRecoveryR3CanarySource;
  }): Promise<Phase697ArchitectureRecoveryR3CanaryReservation>;
  runControlledLive(input: {
    credential: string;
    timeoutMs: 5_000;
    signal: AbortSignal;
    appendWireStage(stage: Phase697V7WireStage): Promise<void>;
  }): Promise<Phase697ArchitectureRecoveryR3CanaryReport>;
  sealInterrupted(input: {
    root: string;
  }): ReturnType<typeof sealPhase697ArchitectureRecoveryR3InterruptedCanary>;
  write(line: string): void;
}>;

const DEFAULT_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DEFAULT_PORTS: Phase697ArchitectureRecoveryR3CanaryCliPorts = Object.freeze({
  now: () => Date.now(),
  randomUUID,
  readSource: readGitSource,
  reserve: reservePhase697ArchitectureRecoveryR3Canary,
  async runControlledLive(input) {
    const transport = createPhase697ArchitectureRecoveryR3ControlledLiveCanaryTransport({
      apiKey: input.credential,
      appendStage: (stage) => input.appendWireStage(stage),
    });
    return runPhase697ArchitectureRecoveryR3Canary({
      transport,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
  },
  sealInterrupted: sealPhase697ArchitectureRecoveryR3InterruptedCanary,
  write: (line) => process.stdout.write(`${line}\n`),
});

/**
 * The R3 CLI is a separate one-shot controlled-Live boundary. It never accepts
 * a URL, model, fetch, output path, retry, resume, replay, or generic key.
 * A fixed marker is durably reserved before the single executor can dispatch.
 */
export async function runPhase697ArchitectureRecoveryR3CanaryCli(
  rawInput: Phase697ArchitectureRecoveryR3CanaryCliInput,
): Promise<0 | 1> {
  return executePhase697ArchitectureRecoveryR3CanaryCli(rawInput, DEFAULT_PORTS);
}

async function executePhase697ArchitectureRecoveryR3CanaryCli(
  rawInput: Phase697ArchitectureRecoveryR3CanaryCliInput,
  ports: Phase697ArchitectureRecoveryR3CanaryCliPorts,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  if (!input) return 1;
  const blocked = (code: string) => {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CLI_VERSION,
        ok: false,
        evidenceSealed: false,
        code,
      }),
    );
    return 1 as const;
  };
  if (hasCrashSealConfirmation(input.args)) {
    const result = await ports.sealInterrupted({ root: input.root });
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CLI_VERSION,
        evidenceSealed: result.ok,
        ...result,
      }),
    );
    return result.ok ? 0 : 1;
  }
  if (!hasExactConfirmation(input.args)) return blocked('r3_cli_argument_invalid');
  if (
    readOwnDataString(input.env, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_APPROVAL_ENV) !==
    'true'
  ) {
    return blocked('r3_live_not_authorized');
  }
  const credential = readOwnDataString(
    input.env,
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CREDENTIAL_ENV,
  );
  if (!isValidCredential(credential)) return blocked('r3_live_configuration_invalid');
  if (isSignalAborted(input.signal)) return blocked('r3_live_aborted_before_reservation');

  let source: Phase697ArchitectureRecoveryR3CanarySource;
  let runId: string;
  let createdAt: string;
  try {
    source = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_SOURCE_SCHEMA.parse(
      await ports.readSource(input.root),
    );
    runId = ports.randomUUID();
    createdAt = new Date(ports.now()).toISOString();
  } catch {
    return blocked('r3_live_preflight_invalid');
  }

  let reservation: Phase697ArchitectureRecoveryR3CanaryReservation;
  try {
    reservation = await ports.reserve({ root: input.root, runId, createdAt, source });
  } catch {
    return blocked('r3_live_once_already_consumed_or_evidence_io');
  }

  let report: Phase697ArchitectureRecoveryR3CanaryReport;
  try {
    report = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA.parse(
      await ports.runControlledLive({
        credential,
        timeoutMs: 5_000,
        signal: input.signal,
        appendWireStage: reservation.appendWireStage,
      }),
    );
    if (report.authority !== 'controlled_live') throw new Error();
  } catch {
    return blocked('r3_live_runtime_or_evidence_io');
  }

  try {
    const terminal = await reservation.appendTerminal(report);
    const generatedAt = new Date(ports.now()).toISOString();
    const artifact = reservation.buildArtifact({ generatedAt, report, terminal });
    const published = await reservation.publishArtifact(artifact);
    const validation = await validatePhase697ArchitectureRecoveryR3CanaryBundle({
      root: input.root,
    });
    if (!validation.ok || validation.runId !== runId) throw new Error();
    const complete = report.providerReport.outcome === 'complete';
    if (
      !safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CLI_VERSION,
          ok: complete,
          evidenceSealed: true,
          authority: 'controlled_live',
          runId,
          outcome: report.providerReport.outcome,
          responseObserved: report.providerReport.responseObserved,
          wire: report.providerReport.wire.counters,
          usage: report.providerReport.usage,
          estimatedCostCny: report.cost.estimatedCostCny,
          artifactSha256: published.evidenceSha256,
        }),
      )
    ) {
      return 1;
    }
    return complete ? 0 : 1;
  } catch {
    return blocked('r3_live_evidence_io');
  }
}

async function readGitSource(root: string): Promise<Phase697ArchitectureRecoveryR3CanarySource> {
  const branch = gitOutput(root, ['branch', '--show-current']);
  const commit = gitOutput(root, ['rev-parse', 'HEAD']);
  const trackingCommit = gitOutput(root, ['rev-parse', '@{u}']);
  const trackedWorktreeClean =
    gitStatus(root, ['diff', '--quiet']) === 0 &&
    gitStatus(root, ['diff', '--cached', '--quiet']) === 0;
  return PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_SOURCE_SCHEMA.parse({
    branch,
    commit,
    trackingCommit,
    trackedWorktreeClean,
  });
}

function gitOutput(root: string, args: readonly string[]) {
  const result = spawnSync('git', [...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') throw new Error();
  return result.stdout.trim();
}

function gitStatus(root: string, args: readonly string[]) {
  return spawnSync('git', [...args], { cwd: root, windowsHide: true }).status;
}

function readInput(value: unknown): Phase697ArchitectureRecoveryR3CanaryCliInput | null {
  const values = readExactOwnDataValues(value, ['args', 'env', 'root', 'signal']);
  if (
    !values ||
    !Array.isArray(values.args) ||
    values.args.some((value) => typeof value !== 'string') ||
    !isPlainRecord(values.env) ||
    typeof values.root !== 'string' ||
    values.root.length === 0 ||
    !isAbortSignal(values.signal)
  ) {
    return null;
  }
  return Object.freeze({
    args: Object.freeze(values.args.map((value) => String(value))),
    env: values.env,
    root: values.root,
    signal: values.signal,
  });
}

function hasExactConfirmation(args: readonly string[]) {
  try {
    return (
      args.length === 1 && args[0] === PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION
    );
  } catch {
    return false;
  }
}

function hasCrashSealConfirmation(args: readonly string[]) {
  try {
    return (
      args.length === 1 &&
      args[0] === PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CRASH_SEAL_CONFIRMATION
    );
  } catch {
    return false;
  }
}

function readOwnDataString(value: Record<string, unknown>, key: string) {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor && typeof descriptor.value === 'string'
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

function isValidCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 512 &&
    value === value.trim() &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}

function isSignalAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  } catch {
    return false;
  }
}

function readExactOwnDataValues(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      values[key] = descriptor.value;
    }
    return values;
  } catch {
    return null;
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

if (import.meta.main) {
  process.exitCode = await runPhase697ArchitectureRecoveryR3CanaryCli({
    args: process.argv.slice(2),
    env: process.env,
    root: DEFAULT_ROOT,
    signal: new AbortController().signal,
  });
}

if (PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONTROLLED_LIVE_BRANCH.length === 0) {
  throw new Error('PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_BRANCH_INVALID');
}
