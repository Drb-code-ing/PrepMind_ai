import { randomUUID } from 'node:crypto';

import {
  admitPhase698P1G2Source,
  issuePhase698P1G2SourceAdmissionCapability,
  type Phase698P1G2SourceSnapshot,
} from './phase-6-9-8-retriever-final-response-p1-g2-source-admission.ts';
import {
  createPhase698P1G2DeterministicHarness,
  runPhase698P1G2,
} from './phase-6-9-8-retriever-final-response-p1-g2-runner.ts';
import {
  createPhase698P1G2SyntheticRootForTest,
  recoverPhase698P1G2InterruptedAttempt,
  removePhase698P1G2SyntheticRootForTest,
  reservePhase698P1G2Attempt,
  validatePhase698P1G2Bundle,
} from './phase-6-9-8-retriever-final-response-p1-g2-durability.ts';
import { buildPhase698P1DeterministicSubsetBaseline } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';

export const PHASE_6_9_8_P1_G2_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-p1-g2-cli-v1' as const;
export const PHASE_6_9_8_P1_G2_RUN_CONFIRMATION =
  'RUN_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_G2_ZERO_PROVIDER_ONCE' as const;
export const PHASE_6_9_8_P1_G2_VALIDATE_CONFIRMATION =
  'VALIDATE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_G2_BUNDLE_ZERO_PROVIDER' as const;
export const PHASE_6_9_8_P1_G2_RECOVER_CONFIRMATION =
  'RECOVER_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_G2_CRASH_ONLY_ONCE' as const;

export type Phase698P1G2CliInput = Readonly<{
  args: readonly string[];
  root: string;
  signal: AbortSignal;
  snapshot?: Phase698P1G2SourceSnapshot;
}>;

export type Phase698P1G2CliPorts = Readonly<{
  write(line: string): void;
  snapshot(): Promise<Phase698P1G2SourceSnapshot>;
  isProcessAlive(processId: number): boolean;
}>;

export async function executePhase698P1G2CliCore(
  input: Phase698P1G2CliInput,
  ports: Phase698P1G2CliPorts,
): Promise<0 | 1> {
  if (!validInput(input, ports) || input.signal.aborted || input.args.length !== 1) {
    safeWrite(ports, blocked('operation_invalid'));
    return 1;
  }
  const command = input.args[0];
  if (command === PHASE_6_9_8_P1_G2_VALIDATE_CONFIRMATION) {
    const result = await validatePhase698P1G2Bundle({ root: input.root });
    safeWrite(ports, {
      version: PHASE_6_9_8_P1_G2_CLI_VERSION,
      operation: 'validate',
      ...result,
    });
    return result.ok ? 0 : 1;
  }
  if (command === PHASE_6_9_8_P1_G2_RECOVER_CONFIRMATION) {
    const result = await recoverPhase698P1G2InterruptedAttempt({
      root: input.root,
      isProcessAlive: ports.isProcessAlive,
    });
    safeWrite(ports, { version: PHASE_6_9_8_P1_G2_CLI_VERSION, operation: 'recover', ...result });
    return result.ok ? 0 : 1;
  }
  if (command !== PHASE_6_9_8_P1_G2_RUN_CONFIRMATION) {
    safeWrite(ports, blocked('confirmation_required'));
    return 1;
  }

  let snapshot: Phase698P1G2SourceSnapshot;
  try {
    snapshot = input.snapshot ?? (await ports.snapshot());
  } catch {
    safeWrite(ports, blocked('source_snapshot_invalid'));
    return 1;
  }
  const admission = admitPhase698P1G2Source(snapshot);
  if (!admission.ok) {
    safeWrite(ports, blocked(admission.code));
    return 1;
  }
  const baseline = await buildPhase698P1DeterministicSubsetBaseline();
  let root: string | null = null;
  try {
    root = input.root || (await createPhase698P1G2SyntheticRootForTest());
    const reservation = await reservePhase698P1G2Attempt({
      root,
      runId: randomUUID(),
      source: admission.source,
    });
    const capability = issuePhase698P1G2SourceAdmissionCapability(snapshot);
    // The source capability is consumed by the runner; reservation itself is
    // deliberately bound to the already admitted, immutable source object.
    const run = await runPhase698P1G2({
      runId: reservation.runId,
      sourceAdmissionCapability: capability,
      baselineBundle: baseline,
      harness: createPhase698P1G2DeterministicHarness(baseline),
      lifecycle: reservation.lifecycle,
      signal: input.signal,
    });
    await reservation.publishArtifact(run.report);
    const validation = await validatePhase698P1G2Bundle({ root });
    safeWrite(ports, {
      version: PHASE_6_9_8_P1_G2_CLI_VERSION,
      operation: 'run',
      ok: validation.ok,
      gate: run.gate.status,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
      validation,
    });
    return validation.ok ? 0 : 1;
  } catch {
    safeWrite(ports, blocked('runner_failed'));
    return 1;
  } finally {
    if (root && root !== input.root)
      await removePhase698P1G2SyntheticRootForTest(root).catch(() => undefined);
  }
}

function validInput(input: unknown, ports: unknown): input is Phase698P1G2CliInput {
  if (typeof input !== 'object' || input === null || typeof ports !== 'object' || ports === null)
    return false;
  const value = input as Record<string, unknown>;
  const portValue = ports as Record<string, unknown>;
  return (
    Array.isArray(value.args) &&
    value.args.every((entry) => typeof entry === 'string') &&
    typeof value.root === 'string' &&
    value.signal instanceof AbortSignal &&
    typeof portValue.write === 'function' &&
    typeof portValue.snapshot === 'function' &&
    typeof portValue.isProcessAlive === 'function'
  );
}

function blocked(code: string) {
  return {
    version: PHASE_6_9_8_P1_G2_CLI_VERSION,
    operation: 'blocked',
    ok: false,
    code: /^[a-z0-9_]{1,96}$/u.test(code) ? code : 'operation_invalid',
    providerCalls: 0,
    credentialReads: 0,
    formalEvidence: 0,
  } as const;
}

function safeWrite(ports: Phase698P1G2CliPorts, value: unknown) {
  try {
    ports.write(JSON.stringify(value));
  } catch {
    // CLI output is best effort and never changes the durable state machine.
  }
}
