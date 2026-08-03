import {
  executePhase697ArchitectureRecoveryProviderCanaryV2C2CliCore,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2CliCoreInput,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-cli-core.ts';

/**
 * Test-only composition seam. This module is deliberately absent from the
 * package index and production CLI. Tests may provide closed fake ports, but
 * they cannot alter the public C2 entry's production composition.
 */
export function runPhase697ArchitectureRecoveryProviderCanaryV2C2CliForTesting(
  input: Phase697ArchitectureRecoveryProviderCanaryV2C2CliCoreInput,
  ports: Phase697ArchitectureRecoveryProviderCanaryV2C2CliCorePorts,
) {
  return executePhase697ArchitectureRecoveryProviderCanaryV2C2CliCore(input, ports);
}
