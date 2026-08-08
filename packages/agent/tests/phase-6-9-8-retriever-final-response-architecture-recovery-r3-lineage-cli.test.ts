import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_SEAL_ARG,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_VALIDATE_ARG,
  executePhase698ArchitectureRecoveryCliCore,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-cli-core.ts';
import {
  createPhase698ArchitectureRecoverySyntheticAdmissionForTest,
  validatePhase698ArchitectureRecoverySourceObservationForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts';

describe('Phase 6.9.8 Architecture Recovery R3 lineage and CLI security', () => {
  test('source admission rejects old Task 9C identity, branch drift, formal evidence, and source parity drift', () => {
    const { source } = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
    const base = {
      root: 'C:/synthetic',
      branch: source.branch,
      head: source.commit,
      tracking: source.trackingCommit,
      remote: source.remoteCommit,
      approvedSourceCommit: source.approvedSourceCommit,
      workingTreeClean: true,
      formalArtifactCount: 0,
      sourceBundleSha256: source.sourceBundleSha256,
    };
    expect(validatePhase698ArchitectureRecoverySourceObservationForTest(source, base)).toBe(false);
    for (const mutation of [
      { branch: 'main' },
      { formalArtifactCount: 1 },
      { tracking: '1'.repeat(40) },
      { remote: '2'.repeat(40) },
      { approvedSourceCommit: '3'.repeat(40) },
      { sourceBundleSha256: '4'.repeat(64) },
    ]) {
      expect(
        validatePhase698ArchitectureRecoverySourceObservationForTest(
          { ...source, admissionAuthority: 'git_verified' },
          { ...base, ...mutation },
        ),
      ).toBe(false);
    }
  });

  test('CLI accepts only the two zero-provider maintenance argv values and never exposes a Live command', async () => {
    for (const args of [
      [],
      ['live'],
      ['controlled-live'],
      ['--help'],
      ['task9c'],
      ['unexpected', 'arg'],
    ]) {
      const calls: string[] = [];
      const output: string[] = [];
      const code = await executePhase698ArchitectureRecoveryCliCore(
        { args, root: 'C:/synthetic' },
        {
          validate: async () => {
            calls.push('validate');
            return { ok: true } as never;
          },
          seal: async () => {
            calls.push('seal');
            return { ok: true } as never;
          },
          write: (value) => output.push(value),
        },
      );
      expect(code).toBe(1);
      expect(calls).toEqual([]);
      expect(output.join('')).not.toContain('credential');
      expect(output.join('')).not.toContain('DEEPSEEK');
      expect(output.join('')).not.toContain('DASHSCOPE');
    }
  });

  test('CLI dispatches exact validate/seal maintenance operations with bounded output', async () => {
    for (const [arg, expected] of [
      [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_VALIDATE_ARG, 'validate'],
      [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_SEAL_ARG, 'seal'],
    ] as const) {
      const calls: string[] = [];
      const output: string[] = [];
      const code = await executePhase698ArchitectureRecoveryCliCore(
        { args: [arg], root: 'C:/synthetic' },
        {
          validate: async () => {
            calls.push('validate');
            return { ok: true, qualityAuthority: 'none' } as never;
          },
          seal: async () => {
            calls.push('seal');
            return { ok: true, disposition: 'crash_only_sealed' } as never;
          },
          write: (value) => output.push(value),
        },
      );
      expect(code).toBe(0);
      expect(calls).toEqual([expected]);
      expect(output.join('').length).toBeLessThan(1024);
      expect(output.join('')).not.toContain('C:/synthetic');
    }
  });
});
