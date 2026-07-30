import {
  runPhase697ArchitectureRecoveryR2Canary,
  type Phase697ArchitectureRecoveryR2SyntheticScenario,
} from './phase-6-9-7-architecture-recovery-r2-canary-runner.ts';
import type { Phase697ArchitectureRecoveryR2CanaryReport } from './phase-6-9-7-architecture-recovery-r2-canary-contract.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_CLI_VERSION =
  'phase-6.9.7-architecture-recovery-r2-provider-canary-cli-v1' as const;

export type Phase697ArchitectureRecoveryR2CanaryCliPorts = Readonly<{
  write(line: string): void;
}>;

const DEFAULT_PORTS: Phase697ArchitectureRecoveryR2CanaryCliPorts = Object.freeze({
  write: (line: string) => process.stdout.write(`${line}\n`),
});

/**
 * R2 exposes only synthetic in-memory modes. It has no Live argument, env
 * reader, credential resolver, filesystem writer, artifact publisher, retry,
 * seal, or recovery path.
 */
export async function runPhase697ArchitectureRecoveryR2CanaryCli(
  args: readonly string[],
  ports: Phase697ArchitectureRecoveryR2CanaryCliPorts = DEFAULT_PORTS,
): Promise<0 | 1> {
  const write = readWritePort(ports);
  if (!write) return 1;
  const mode = readMode(args);
  if (!mode) {
    safeWrite(
      write,
      JSON.stringify({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_CLI_VERSION,
        ok: false,
        code: 'r2_cli_argument_invalid',
      }),
    );
    return 1;
  }

  if (mode === 'mock') {
    const report = await runSynthetic('complete');
    const ok = report.outcome === 'complete' && report.authority === 'synthetic_test';
    if (
      !safeWrite(
        write,
        JSON.stringify({
          version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_CLI_VERSION,
          ok,
          mode,
          report,
        }),
      )
    ) {
      return 1;
    }
    return ok ? 0 : 1;
  }

  const scenarios = await runFaultMatrix();
  const passed = scenarios.filter((scenario) => scenario.passed).length;
  const ok = passed === scenarios.length;
  if (
    !safeWrite(
      write,
      JSON.stringify({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_CLI_VERSION,
        ok,
        mode,
        authority: 'synthetic_test',
        total: scenarios.length,
        passed,
        scenarios,
      }),
    )
  ) {
    return 1;
  }
  return ok ? 0 : 1;
}

type Expected = Readonly<{
  outcome: Phase697ArchitectureRecoveryR2CanaryReport['outcome'];
  category?: Phase697ArchitectureRecoveryR2CanaryReport['providerFailureCategory'];
  subtype?: Phase697ArchitectureRecoveryR2CanaryReport['transportSubtype'];
  responseObserved: boolean;
  runtimeStarted: boolean;
  usageVerified: boolean;
}>;

type Scenario = Readonly<{
  id: string;
  expected: Expected;
  run(): Promise<Phase697ArchitectureRecoveryR2CanaryReport>;
}>;

async function runFaultMatrix() {
  const scenarios: readonly Scenario[] = [
    scenario('complete', {
      outcome: 'complete',
      responseObserved: true,
      usageVerified: true,
    }),
    transportScenario('transport_aborted', 'aborted'),
    transportScenario('transport_timeout', 'timeout'),
    transportScenario('transport_dns', 'dns'),
    transportScenario('transport_tls', 'tls'),
    transportScenario('transport_proxy', 'proxy'),
    transportScenario('transport_refused', 'connection_refused'),
    transportScenario('transport_reset', 'connection_reset'),
    transportScenario('transport_unreachable', 'network_unreachable'),
    transportScenario('transport_unknown', 'unknown'),
    scenario('http_auth', {
      outcome: 'response_observed',
      category: 'http_auth',
      responseObserved: true,
      usageVerified: false,
    }),
    scenario('http_rate_limit', {
      outcome: 'response_observed',
      category: 'http_rate_limit',
      responseObserved: true,
      usageVerified: false,
    }),
    scenario('http_client', {
      outcome: 'response_observed',
      category: 'http_client',
      responseObserved: true,
      usageVerified: false,
    }),
    scenario('http_server', {
      outcome: 'response_observed',
      category: 'http_server',
      responseObserved: true,
      usageVerified: false,
    }),
    scenario('response_invalid', {
      outcome: 'response_invalid',
      category: 'invalid_response',
      responseObserved: false,
      usageVerified: false,
    }),
    scenario('json_invalid', {
      outcome: 'response_observed',
      category: 'structured_output',
      responseObserved: true,
      usageVerified: false,
    }),
    scenario('schema_invalid', {
      outcome: 'response_observed',
      category: 'structured_output',
      responseObserved: true,
      usageVerified: false,
    }),
    scenario('usage_invalid', {
      outcome: 'response_observed',
      category: 'unknown',
      responseObserved: true,
      usageVerified: false,
    }),
    scenario('budget_exceeded', {
      outcome: 'budget_exceeded',
      category: null,
      responseObserved: true,
      usageVerified: true,
    }),
    preAbortedScenario(),
    scenario(
      'runner_timeout',
      {
        outcome: 'timeout',
        category: null,
        responseObserved: false,
        usageVerified: false,
      },
      5,
    ),
  ];

  const results: Array<
    Readonly<{
      id: string;
      passed: boolean;
      outcome: Phase697ArchitectureRecoveryR2CanaryReport['outcome'];
      responseObserved: boolean;
      providerFailureCategory: Phase697ArchitectureRecoveryR2CanaryReport['providerFailureCategory'];
      transportSubtype: Phase697ArchitectureRecoveryR2CanaryReport['transportSubtype'];
    }>
  > = [];
  for (const item of scenarios) {
    const report = await item.run();
    const expected = item.expected;
    const passed =
      report.authority === 'synthetic_test' &&
      report.outcome === expected.outcome &&
      (expected.category === undefined || report.providerFailureCategory === expected.category) &&
      (expected.subtype === undefined || report.transportSubtype === expected.subtype) &&
      report.responseObserved === expected.responseObserved &&
      report.wire.counters.executorInvocations === (expected.runtimeStarted ? 1 : 0) &&
      report.wire.counters.providerDispatches === (expected.runtimeStarted ? 1 : 0) &&
      report.wire.counters.providerResponses === (expected.responseObserved ? 1 : 0) &&
      report.wire.counters.verifiedUsages === (expected.usageVerified ? 1 : 0) &&
      report.budget.reservedCalls === (expected.runtimeStarted ? 1 : 0) &&
      (report.usage !== null) === expected.usageVerified &&
      Object.isFrozen(report) &&
      Object.isFrozen(report.wire) &&
      Object.isFrozen(report.budget) &&
      !JSON.stringify(report).includes('r2-synthetic-raw');
    results.push(
      Object.freeze({
        id: item.id,
        passed,
        outcome: report.outcome,
        responseObserved: report.responseObserved,
        providerFailureCategory: report.providerFailureCategory,
        transportSubtype: report.transportSubtype,
      }),
    );
  }
  return Object.freeze(results);
}

function scenario(
  id: Phase697ArchitectureRecoveryR2SyntheticScenario,
  expected: Omit<Expected, 'runtimeStarted'>,
  timeoutMs = 1_000,
): Scenario {
  return Object.freeze({
    id,
    expected: { ...expected, runtimeStarted: true },
    run: () => runSynthetic(id, timeoutMs),
  });
}

function transportScenario(
  id: Extract<Phase697ArchitectureRecoveryR2SyntheticScenario, `transport_${string}`>,
  subtype: NonNullable<Phase697ArchitectureRecoveryR2CanaryReport['transportSubtype']>,
): Scenario {
  return scenario(id, {
    outcome: 'transport_failed',
    category: 'transport',
    subtype,
    responseObserved: false,
    usageVerified: false,
  });
}

function preAbortedScenario(): Scenario {
  return Object.freeze({
    id: 'pre_aborted',
    expected: {
      outcome: 'aborted',
      category: null,
      responseObserved: false,
      runtimeStarted: false,
      usageVerified: false,
    } satisfies Expected,
    async run() {
      const controller = new AbortController();
      controller.abort();
      return runSynthetic('complete', 1_000, controller.signal);
    },
  });
}

function runSynthetic(
  scenario: Phase697ArchitectureRecoveryR2SyntheticScenario,
  timeoutMs = 1_000,
  signal = new AbortController().signal,
) {
  return runPhase697ArchitectureRecoveryR2Canary({
    mode: 'synthetic',
    scenario,
    timeoutMs,
    signal,
  });
}

function readMode(args: unknown): 'mock' | 'fault-matrix' | null {
  try {
    if (!Array.isArray(args) || args.length !== 1) return null;
    const value = args[0] as unknown;
    return value === 'mock' || value === 'fault-matrix' ? value : null;
  } catch {
    return null;
  }
}

function readWritePort(input: unknown): ((line: string) => void) | null {
  try {
    if (input === DEFAULT_PORTS) return DEFAULT_PORTS.write;
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Object.prototype
    ) {
      return null;
    }
    const keys = Reflect.ownKeys(input);
    const descriptor = Reflect.getOwnPropertyDescriptor(input, 'write');
    return keys.length === 1 &&
      keys[0] === 'write' &&
      descriptor &&
      'value' in descriptor &&
      typeof descriptor.value === 'function'
      ? (descriptor.value as (line: string) => void)
      : null;
  } catch {
    return null;
  }
}

function safeWrite(write: (line: string) => void, line: string): boolean {
  try {
    write(line);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  process.exitCode = await runPhase697ArchitectureRecoveryR2CanaryCli(process.argv.slice(2));
}
