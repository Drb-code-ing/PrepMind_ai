import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256,
  PHASE_6_9_8_TASK8_MANIFEST,
  PHASE_6_9_8_TASK8_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_POLICY_SHA256,
  validatePhase698Task8FrozenManifest,
} from '../src/evals/phase-6-9-8-retriever-final-response-manifest.ts';
import {
  PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256,
  PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256,
  validatePhase698Task8ReviewedMockFactory,
} from '../src/evals/phase-6-9-8-retriever-final-response-mock-responder.ts';
import {
  buildPhase698Task8ReviewedMockStaticV1,
  computePhase698Task8GitSourceBundleSha256,
  createPhase698Task8SingleRunCapability,
  PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256,
  PHASE_6_9_8_TASK8_SOURCE_BRANCH,
  PHASE_6_9_8_TASK8_SOURCE_ADMISSION_SCHEMA_VERSION,
  PHASE_6_9_8_TASK8_SOURCE_PATHS,
  runPhase698Task8ReviewedMockStaticV1,
  scorePhase698Task8ReviewedMockGate,
  validatePhase698Task8ReviewedMockBytes,
  validatePhase698Task8SourceAdmission,
  type Phase698Task8Report,
} from '../src/evals/phase-6-9-8-retriever-final-response-static.ts';

describe('Phase 6.9.8 Task 8 reviewed Mock/static checkpoint', () => {
  test('freezes one 48-case lineage, policy, and prompt-only factory identity', () => {
    expect(PHASE_6_9_8_TASK8_MANIFEST.guardCases).toHaveLength(16);
    expect(PHASE_6_9_8_TASK8_MANIFEST.rewriteCases).toHaveLength(16);
    expect(PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases).toHaveLength(16);
    expect(
      new Set(
        [
          ...PHASE_6_9_8_TASK8_MANIFEST.guardCases,
          ...PHASE_6_9_8_TASK8_MANIFEST.rewriteCases,
          ...PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases,
        ].map((entry) => entry.caseId),
      ).size,
    ).toBe(48);
    expect(PHASE_6_9_8_TASK8_MANIFEST_SHA256).toBe(PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256);
    expect(PHASE_6_9_8_TASK8_POLICY_SHA256).toBe(PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256);
    expect(PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256).toBe(
      PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256,
    );
    expect(validatePhase698Task8FrozenManifest().ok).toBe(true);
    expect(validatePhase698Task8ReviewedMockFactory().ok).toBe(true);
  });

  test('runs 16/16 guard, rewrite, and FinalResponse cases without Provider authority', async () => {
    const bundle = await buildPhase698Task8ReviewedMockStaticV1();
    expect(bundle.sha256).toBe(PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256);
    expect(bundle.report).toMatchObject({
      authority: 'zero_provider_retriever_final_response_reviewed_mock_static',
      qualityAuthority: 'none',
      execution: {
        mode: 'reviewed_mock',
        responderInput: 'actual_bounded_prompt',
        provider: 'none',
        providerCalls: 0,
        credentialReads: 0,
        qwenEmbeddingCalls: 0,
        retry: false,
        replay: false,
        backgroundJob: false,
        outbox: false,
        sourceAdmissionExecuted: false,
      },
      caseCounts: { guards: 16, rewriteRuntime: 16, finalResponseRuntime: 16, total: 48 },
      guards: { passCount: 16, zeroCallCount: 16 },
      rewrite: {
        strictCount: 16,
        accountedUsageCount: 16,
        runtimeInvocationCount: 16,
        originalRecallAt5: 0.875,
        originalNdcgAt5: 0.56923614767,
        candidateRecallAt5: 1,
        candidateNdcgAt5: 1,
        candidateNdcgUplift: 0.43076385233,
        criticalTargetRecall: 1,
        intentPreservation: 1,
        unsafeRewriteCount: 0,
        latencyAuthority: null,
      },
      finalResponse: {
        strictCount: 16,
        terminalCount: 16,
        accountedUsageCount: 16,
        groundedRubric: 1,
        citationPrecision: 1,
        requiredCitationRecall: 1,
        criticalNoticeRecall: 1,
        falseToolSuccessCount: 0,
        falseCitationCount: 0,
        latencyAuthority: null,
      },
      safety: { criticalFailureCount: 0 },
      cost: {
        deepseekSyntheticEstimateCny: 0.027366,
        qwenVerifiedCostCny: null,
        aggregateVerifiedCostCny: null,
      },
      formalLive: { markerCount: 0, journalCount: 0, evidenceCount: 0, recoveryClaimCount: 0 },
      gate: {
        status: 'mock_quality_not_evidence',
        passed: true,
        qualityAuthority: 'none',
        failureReasons: [],
      },
    });
    expect(bundle.report.rewriteEntries.every((entry) => entry.strict)).toBe(true);
    expect(bundle.report.finalResponseEntries.every((entry) => entry.strict)).toBe(true);
    expect(bundle.report.rewriteEntries.every((entry) => entry.runtimeInvocations === 1)).toBe(
      true,
    );
    expect(bundle.report.finalResponseEntries.every((entry) => entry.executorCalls === 1)).toBe(
      true,
    );
  });

  test('keeps prompts, answers, owner ids, chunks, and credentials out of the report', async () => {
    const bundle = await buildPhase698Task8ReviewedMockStaticV1();
    const serialized = bundle.canonicalBytes;
    for (const forbidden of [
      '这一步为什么要除以质量',
      '牛顿第二定律说明合外力',
      'owner_task8',
      'target_chunk_rewrite',
      'final_chunk_final',
      'api_key',
      'sk-abcdefghijklmnop',
      'DEEPSEEK_API_KEY',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(
      bundle.report.rewriteEntries.every((entry) =>
        /^[0-9a-f]{64}$/u.test(entry.promptAudit.userPromptSha256),
      ),
    ).toBe(true);
    expect(
      bundle.report.finalResponseEntries.every((entry) =>
        /^[0-9a-f]{64}$/u.test(entry.promptAudit.userPromptSha256),
      ),
    ).toBe(true);
  });

  test('validates exact canonical bytes and rejects mutation or invalid UTF-8', async () => {
    const bundle = await buildPhase698Task8ReviewedMockStaticV1();
    await expect(validatePhase698Task8ReviewedMockBytes(bundle.canonicalBytes)).resolves.toEqual({
      ok: true,
      sha256: PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256,
      gate: 'mock_quality_not_evidence',
    });
    await expect(
      validatePhase698Task8ReviewedMockBytes(
        bundle.canonicalBytes.replace('providerCalls":0', 'providerCalls":1'),
      ),
    ).resolves.toEqual({ ok: false, reasonCode: 'bytes_mismatch' });
    await expect(validatePhase698Task8ReviewedMockBytes(new Uint8Array([0xff]))).resolves.toEqual({
      ok: false,
      reasonCode: 'invalid_utf8',
    });
  });

  test('fails the scorer closed when a critical safety count drifts', async () => {
    const bundle = await buildPhase698Task8ReviewedMockStaticV1();
    const cloned = structuredClone(bundle.report) as Phase698Task8Report;
    const { gate: _gate, ...withoutGate } = cloned;
    const drifted = {
      ...withoutGate,
      safety: { ...withoutGate.safety, criticalFailureCount: 1 },
    };
    expect(scorePhase698Task8ReviewedMockGate(drifted)).toEqual({
      status: 'mock_quality_gate_failed',
      passed: false,
      qualityAuthority: 'none',
      failureReasons: ['safety'],
    });
    expect(
      scorePhase698Task8ReviewedMockGate({
        ...withoutGate,
        finalResponse: { ...withoutGate.finalResponse, strictCount: 15 },
      }),
    ).toEqual({
      status: 'mock_quality_gate_failed',
      passed: false,
      qualityAuthority: 'none',
      failureReasons: ['final_strict'],
    });
    expect(
      scorePhase698Task8ReviewedMockGate({
        ...withoutGate,
        finalResponse: { ...withoutGate.finalResponse, accountedUsageCount: 15 },
      }),
    ).toEqual({
      status: 'mock_quality_gate_failed',
      passed: false,
      qualityAuthority: 'none',
      failureReasons: ['final_usage'],
    });
  });

  test('consumes a capability before execution and never retries the same run', async () => {
    const capability = createPhase698Task8SingleRunCapability();
    const first = await runPhase698Task8ReviewedMockStaticV1(capability);
    expect(first.report.gate.passed).toBe(true);
    await expect(runPhase698Task8ReviewedMockStaticV1(capability)).rejects.toThrow(
      'PHASE_6_9_8_TASK8_SINGLE_RUN_CAPABILITY_INVALID',
    );
    await expect(
      runPhase698Task8ReviewedMockStaticV1(
        Object.freeze({ lineage: 'phase-6.9.8-retriever-final-response-v1' }),
      ),
    ).rejects.toThrow('PHASE_6_9_8_TASK8_SINGLE_RUN_CAPABILITY_INVALID');
  });

  test('recomputes source admission from clean Git blobs and rejects forged claims', async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), 'phase-6-9-8-task8-source-'));
    try {
      runGit(repositoryRoot, ['init', '-b', PHASE_6_9_8_TASK8_SOURCE_BRANCH]);
      runGit(repositoryRoot, ['config', 'user.email', 'task8@example.invalid']);
      runGit(repositoryRoot, ['config', 'user.name', 'Task 8 Fixture']);
      runGit(repositoryRoot, ['config', 'core.autocrlf', 'false']);
      await writeFile(join(repositoryRoot, '.gitignore'), '.codex/\n', 'utf8');
      for (const path of PHASE_6_9_8_TASK8_SOURCE_PATHS) {
        const absolutePath = join(repositoryRoot, ...path.split('/'));
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, `fixture:${path}\n`, 'utf8');
      }
      runGit(repositoryRoot, ['add', '--', '.gitignore', ...PHASE_6_9_8_TASK8_SOURCE_PATHS]);
      runGit(repositoryRoot, ['commit', '-m', 'fixture source']);
      const commit = runGit(repositoryRoot, ['rev-parse', 'HEAD']);
      runGit(repositoryRoot, ['remote', 'add', 'origin', repositoryRoot]);
      runGit(repositoryRoot, [
        'update-ref',
        `refs/remotes/origin/${PHASE_6_9_8_TASK8_SOURCE_BRANCH}`,
        commit,
      ]);
      runGit(repositoryRoot, [
        'config',
        `branch.${PHASE_6_9_8_TASK8_SOURCE_BRANCH}.remote`,
        'origin',
      ]);
      runGit(repositoryRoot, [
        'config',
        `branch.${PHASE_6_9_8_TASK8_SOURCE_BRANCH}.merge`,
        `refs/heads/${PHASE_6_9_8_TASK8_SOURCE_BRANCH}`,
      ]);
      expect(runGit(repositoryRoot, ['branch', '--show-current'])).toBe(
        PHASE_6_9_8_TASK8_SOURCE_BRANCH,
      );
      expect(runGit(repositoryRoot, ['rev-parse', '--verify', '@{upstream}'])).toBe(commit);
      expect(
        runGit(repositoryRoot, [
          'rev-parse',
          '--verify',
          `refs/remotes/origin/${PHASE_6_9_8_TASK8_SOURCE_BRANCH}`,
        ]),
      ).toBe(commit);
      await mkdir(join(repositoryRoot, '.codex'), { recursive: true });
      await writeFile(join(repositoryRoot, '.codex', 'config.toml'), 'local = true\n', 'utf8');
      expect(runGit(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all'])).toBe(
        '',
      );
      const sourceBundle = computePhase698Task8GitSourceBundleSha256(repositoryRoot, commit);
      expect(sourceBundle.ok).toBe(true);
      if (!sourceBundle.ok) throw new Error('source bundle fixture failed');
      const admission = {
        schemaVersion: PHASE_6_9_8_TASK8_SOURCE_ADMISSION_SCHEMA_VERSION,
        lineage: 'phase-6.9.8-retriever-final-response-v1',
        branch: PHASE_6_9_8_TASK8_SOURCE_BRANCH,
        sourceCommitSha: commit,
        trackingCommitSha: commit,
        remoteCommitSha: commit,
        workingTreeClean: true,
        sourceBundleSha256: sourceBundle.sha256,
        manifestSha256: PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
        policySha256: PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256,
        reviewedMockFactorySha256: PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256,
        reviewedMockReportSha256: PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256,
        originalBaselineManifestSha256:
          '8a1788aa8973507555931ce358c08dcd739dd166636376f6ddcc2eff3a33654d',
        originalBaselineReportSha256:
          'a1478f22a4a2fad154496c4ffbfd761532c102fe3ae9453d1916a10ba2c26442',
        priceIdentity: {
          model: 'deepseek-v4-pro',
          baseURL: 'https://api.deepseek.com/v1',
          profile: 'deepseek-v4-pro-cny-2026-07-15',
          inputPerMillionCny: 3,
          outputPerMillionCny: 6,
        },
        execution: {
          singleRun: true,
          retry: false,
          replay: false,
          providerCalls: 0,
          credentialReads: 0,
        },
        formalLive: { markerCount: 0, journalCount: 0, evidenceCount: 0, recoveryClaimCount: 0 },
      } as const;
      expect(validatePhase698Task8SourceAdmission(admission, repositoryRoot).ok).toBe(true);
      expect(
        validatePhase698Task8SourceAdmission(
          { ...admission, sourceBundleSha256: 'b'.repeat(64) },
          repositoryRoot,
        ),
      ).toEqual({ ok: false, reasonCode: 'source_admission_invalid' });
      expect(
        validatePhase698Task8SourceAdmission(
          { ...admission, remoteCommitSha: 'c'.repeat(40) },
          repositoryRoot,
        ),
      ).toEqual({ ok: false, reasonCode: 'source_admission_invalid' });
      expect(
        validatePhase698Task8SourceAdmission(
          {
            ...admission,
            formalLive: { ...admission.formalLive, evidenceCount: 1 },
          },
          repositoryRoot,
        ),
      ).toEqual({ ok: false, reasonCode: 'source_admission_invalid' });
      await writeFile(join(repositoryRoot, 'dirty.txt'), 'dirty\n', 'utf8');
      expect(validatePhase698Task8SourceAdmission(admission, repositoryRoot)).toEqual({
        ok: false,
        reasonCode: 'source_admission_invalid',
      });
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  test('keeps the responder implementation structurally separated from manifest and oracle data', async () => {
    const source = await readFile(
      new URL(
        '../src/evals/phase-6-9-8-retriever-final-response-mock-responder.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(source).not.toMatch(/from ['"].*retriever-final-response-manifest/iu);
    expect(source).not.toMatch(/caseId\s*(?:===|==|:)/u);
    expect(source).toContain("rewriteResponderInput: 'actual_runtime_user_prompt'");
    expect(source).toContain("finalResponseResponderInput: 'actual_stream_user_prompt'");
  });
});

function runGit(repositoryRoot: string, args: readonly string[]): string {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
  if (result.status !== 0 || result.signal !== null) {
    throw new Error('PHASE_6_9_8_TASK8_GIT_FIXTURE_FAILED');
  }
  return result.stdout.trim();
}
