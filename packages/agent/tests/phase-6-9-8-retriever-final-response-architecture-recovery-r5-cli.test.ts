import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ACCEPTANCE,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ENV,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_EXACT_CONFIRMATION,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_APPROVAL_ENV,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_REWRITE_CREDENTIAL_ENV,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_FINAL_RESPONSE_CREDENTIAL_ENV,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_QWEN_CREDENTIAL_ENV,
  executePhase698ArchitectureRecoveryR5CliCore,
  type Phase698ArchitectureRecoveryR5CliCorePorts,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-r5-cli-core.ts';
import { createPhase698ArchitectureRecoverySyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts';
import {
  createPhase698ArchitectureRecoveryR5LiveHarness,
  evaluatePhase698ArchitectureRecoveryR5CitationCoverageForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-r5-live.ts';

function ports(overrides: Partial<Phase698ArchitectureRecoveryR5CliCorePorts> = {}) {
  const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
  const calls: string[] = [];
  const output: string[] = [];
  const base: Phase698ArchitectureRecoveryR5CliCorePorts = {
    authority: 'controlled_live',
    readSource: () => {
      calls.push('source');
      return admission;
    },
    readDataBoundary: () => {
      calls.push('boundary');
      return true;
    },
    readApproval: () => {
      calls.push('approval');
      return true;
    },
    readRewriteCredential: () => {
      calls.push('rewrite_credential');
      return 'rewrite-key';
    },
    readFinalResponseCredential: () => {
      calls.push('final_credential');
      return 'final-key';
    },
    readQwenCredential: () => {
      calls.push('qwen_credential');
      return 'qwen-key';
    },
    reserve: async () => {
      calls.push('reserve');
      throw new Error('not expected');
    },
    createHarness: () => {
      calls.push('harness');
      throw new Error('not expected');
    },
    run: async () => {
      calls.push('run');
      throw new Error('not expected');
    },
    validate: async () => ({ ok: false, runId: null }),
    seal: async () => ({ ok: false, code: 'marker_missing_or_invalid' }),
    randomUUID: () => '00000000-0000-4000-8000-000000000001',
    now: () => 0,
    write: (line) => output.push(line),
  };
  return { ports: Object.freeze({ ...base, ...overrides }), calls, output };
}

describe('Phase 6.9.8 Architecture Recovery R5 CLI boundary', () => {
  test('rejects every non-exact argv before source or credential access', async () => {
    for (const args of [
      [],
      ['live'],
      ['retry'],
      ['resume'],
      ['replay'],
      ['backfill'],
      ['--help'],
      ['a', 'b'],
    ]) {
      const state = ports();
      const code = await executePhase698ArchitectureRecoveryR5CliCore(
        { args, root: 'C:/synthetic', authorizationEnv: {}, signal: new AbortController().signal },
        state.ports,
      );
      expect(code).toBe(1);
      expect(state.calls).toEqual([]);
      expect(state.output.join('')).not.toContain('DEEPSEEK');
      expect(state.output.join('')).not.toContain('QWEN');
    }
  });

  test('checks source then data boundary then approval before late-binding credentials', async () => {
    const state = ports();
    const testPorts = {
      ...state.ports,
      readDataBoundary: () => {
        state.calls.push('boundary');
        throw new Error('boundary rejected');
      },
    } as Phase698ArchitectureRecoveryR5CliCorePorts;
    const code = await executePhase698ArchitectureRecoveryR5CliCore(
      {
        args: [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_EXACT_CONFIRMATION],
        root: 'C:/synthetic',
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      testPorts,
    );
    expect(code).toBe(1);
    expect(state.calls).toEqual(['source', 'boundary']);
    expect(state.calls.some((entry) => entry.endsWith('credential'))).toBe(false);
  });

  test('requires the independent R5 environment names and exact values', async () => {
    const env = {
      [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ENV]:
        PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ACCEPTANCE,
      [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_APPROVAL_ENV]: 'wrong',
      [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_REWRITE_CREDENTIAL_ENV]: 'a',
      [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_FINAL_RESPONSE_CREDENTIAL_ENV]: 'b',
      [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_QWEN_CREDENTIAL_ENV]: 'c',
    };
    const state = ports();
    const testPorts = {
      ...state.ports,
      readDataBoundary: () => {
        state.calls.push('boundary');
        return true as const;
      },
      readApproval: () => {
        state.calls.push('approval');
        throw new Error('bad approval');
      },
    } as Phase698ArchitectureRecoveryR5CliCorePorts;
    const code = await executePhase698ArchitectureRecoveryR5CliCore(
      {
        args: [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_EXACT_CONFIRMATION],
        root: 'C:/synthetic',
        authorizationEnv: env,
        signal: new AbortController().signal,
      },
      testPorts,
    );
    expect(code).toBe(1);
    expect(state.calls).toEqual(['source', 'boundary', 'approval']);
  });

  test('R5 harness rejects injected dependencies and non-canonical Qwen endpoints before any call', () => {
    const credentials = {
      rewriteDeepseekApiKey: 'rewrite-key',
      finalResponseDeepseekApiKey: 'final-key',
      qwenApiKey: 'qwen-key',
      qwenBaseURL: 'https://example.invalid',
    };
    expect(() =>
      createPhase698ArchitectureRecoveryR5LiveHarness({
        runId: 'r5-run',
        credentials,
      }),
    ).toThrow('QWEN_ENDPOINT_INVALID');
    expect(() =>
      createPhase698ArchitectureRecoveryR5LiveHarness({
        runId: 'r5-run',
        credentials: {
          ...credentials,
          qwenBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        },
        fetch: globalThis.fetch,
      } as never),
    ).toThrow('CONFIGURATION_INVALID');
  });

  test('citation coverage is exact, including no-evidence, missing, extra, and duplicate cases', () => {
    expect(
      evaluatePhase698ArchitectureRecoveryR5CitationCoverageForTest({
        requiredCitationIds: [],
        observedCitationIds: [],
      }),
    ).toMatchObject({ satisfied: true, requiredCitationCount: 0, observedCitationCount: 0 });
    for (const observedCitationIds of [['citation_a'], ['citation_a', 'citation_a']]) {
      expect(
        evaluatePhase698ArchitectureRecoveryR5CitationCoverageForTest({
          requiredCitationIds: [],
          observedCitationIds,
        }).satisfied,
      ).toBe(false);
    }
    expect(
      evaluatePhase698ArchitectureRecoveryR5CitationCoverageForTest({
        requiredCitationIds: ['citation_a', 'citation_b'],
        observedCitationIds: ['citation_a'],
      }).satisfied,
    ).toBe(false);
    expect(
      evaluatePhase698ArchitectureRecoveryR5CitationCoverageForTest({
        requiredCitationIds: ['citation_a'],
        observedCitationIds: ['citation_a', 'citation_extra'],
      }).satisfied,
    ).toBe(false);
    expect(
      evaluatePhase698ArchitectureRecoveryR5CitationCoverageForTest({
        requiredCitationIds: ['citation_a', 'citation_b'],
        observedCitationIds: ['citation_a', 'citation_b'],
      }).satisfied,
    ).toBe(true);
  });

  test('marks a post-reservation runtime exception as requiring crash-only seal', async () => {
    const state = ports();
    const reservation = {
      runId: '00000000-0000-4000-8000-000000000001',
      markerRelativePath: '.tmp/marker',
      journalRelativePath: '.tmp/journal',
      lifecycle: {} as never,
      publishArtifact: async () => ({
        relativePath: '.tmp/artifact',
        evidenceSha256: '0'.repeat(64),
      }),
    } as never;
    const testPorts = {
      ...state.ports,
      reserve: async () => {
        state.calls.push('reserve');
        return reservation;
      },
      createHarness: () => {
        state.calls.push('harness');
        return {
          runMode: 'controlled_live' as const,
          transportAuthority: 'external_provider' as const,
          runGuard: async () => ({
            observedReasonCode: 'not_required',
            zeroCallVerified: true,
            permissionFailure: false,
            crossOwnerFailure: false,
            credentialFailure: false,
            injectionFailure: false,
          }),
          invokeCall: async () => {
            throw new Error('not reached');
          },
        };
      },
      run: async () => {
        state.calls.push('run');
        throw new Error('synthetic runtime failure');
      },
    } as Phase698ArchitectureRecoveryR5CliCorePorts;
    const code = await executePhase698ArchitectureRecoveryR5CliCore(
      {
        args: [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_EXACT_CONFIRMATION],
        root: 'C:/synthetic',
        authorizationEnv: {
          [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ENV]:
            PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ACCEPTANCE,
          [PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_APPROVAL_ENV]:
            PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_EXACT_CONFIRMATION,
        },
        signal: new AbortController().signal,
      },
      testPorts,
    );
    expect(code).toBe(1);
    expect(state.calls).toEqual([
      'source',
      'boundary',
      'approval',
      'rewrite_credential',
      'final_credential',
      'qwen_credential',
      'reserve',
      'harness',
      'run',
    ]);
    const output = JSON.parse(state.output.at(-1) ?? '{}') as Record<string, unknown>;
    expect(output).toMatchObject({
      ok: false,
      code: 'live_runtime_or_evidence_io',
      providerCalls: null,
      credentialReads: 3,
      reservationConsumed: true,
      crashOnlySealRequired: true,
      reservationRunId: reservation.runId,
    });
  });
});
