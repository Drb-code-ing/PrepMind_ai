import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { PHASE_6_9_8_TASK8_MANIFEST } from '../src/evals/phase-6-9-8-retriever-final-response-manifest.ts';
import {
  qualifyPhase698Task9RewriteDiagnosticForTest,
  qualifyPhase698Task9RewriteV11CompatibilityForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-live.ts';
import { runPhase697ArchitectureRecoveryProxyPreflight } from '@repo/ai';
import {
  createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest,
  runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-runner.ts';
import { createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-source-admission.ts';
import {
  artifactRelativePath,
  journalRelativePath,
  reservePhase698RetrieverSchemaRecoverySr5LiveAttempt,
  validatePhase698RetrieverSchemaRecoverySr5LiveBundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-durability.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE as V10_EVIDENCE_NAMESPACE } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-contract.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE as V11_EVIDENCE_NAMESPACE } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-live-contract.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE as V12_EVIDENCE_NAMESPACE,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_ARGUMENT,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-contract.ts';
import { executePhase698RetrieverSchemaRecoverySr5LiveCliCore } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-cli-core.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG as V12_APPROVED_TAG } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-contract.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG as V10_APPROVED_TAG } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG as V11_APPROVED_TAG } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-contract.ts';
import { createPhase698RetrieverSchemaRecoverySr5V12DirectHostProcessEnv } from '../scripts/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-cli.ts';

const roots: string[] = [];
const rewriteCase = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[0]!;
const SENTINEL = 'v12-provider-secret-must-not-leak';

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const diagnosticCases = [
  {
    name: 'object-missing',
    payload: () => ({
      choices: [{ message: {} }],
      usage: { prompt_tokens: 2, completion_tokens: 1 },
      provider_secret: SENTINEL,
    }),
    category: 'provider_object_missing' as const,
    stage: 'provider_object_missing' as const,
  },
  {
    name: 'json-parse',
    payload: () => ({
      choices: [{ message: { content: `not-json:${SENTINEL}` } }],
      usage: { prompt_tokens: 2, completion_tokens: 1 },
      provider_secret: SENTINEL,
    }),
    category: 'provider_json_parse' as const,
    stage: 'provider_json_parse' as const,
  },
  {
    name: 'type-validation',
    payload: () => ({
      choices: [{ message: { content: '{"rewrittenQuery":1}' } }],
      usage: { prompt_tokens: 2, completion_tokens: 1 },
      provider_secret: SENTINEL,
    }),
    category: 'provider_type_validation' as const,
    stage: 'provider_type_validation' as const,
  },
  {
    name: 'response-audit',
    payload: () => ({
      choices: [{ message: { content: '{"rewrittenQuery":"safe"}', reasoning_content: null } }],
      usage: { prompt_tokens: 2, completion_tokens: 1 },
      provider_secret: SENTINEL,
    }),
    category: 'response_audit' as const,
    stage: null,
  },
  {
    name: 'usage-validation',
    payload: () => ({
      choices: [{ message: { content: '{"rewrittenQuery":"safe"}' } }],
      usage: { prompt_tokens: 0, completion_tokens: 1 },
      provider_secret: SENTINEL,
    }),
    category: 'usage_validation' as const,
    stage: null,
  },
] as const;

describe('Phase 6.9.8 SR5 V12 diagnostic recovery', () => {
  test('keeps V10, V11, and V12 source and evidence identities disjoint', () => {
    expect(V10_APPROVED_TAG).toBe(
      'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v10-approved',
    );
    expect(V12_APPROVED_TAG).toBe(
      'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v12-approved',
    );
    expect(V11_APPROVED_TAG).toBe(
      'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v11-approved',
    );
    expect(V10_EVIDENCE_NAMESPACE).toBe(
      'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v10',
    );
    expect(V12_EVIDENCE_NAMESPACE).toBe(
      'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v12',
    );
    expect(V11_EVIDENCE_NAMESPACE).toBe(
      'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v11',
    );
    expect(new Set([V10_APPROVED_TAG, V11_APPROVED_TAG, V12_APPROVED_TAG]).size).toBe(3);
    expect(
      new Set([V10_EVIDENCE_NAMESPACE, V11_EVIDENCE_NAMESPACE, V12_EVIDENCE_NAMESPACE]).size,
    ).toBe(3);
  });

  test('keeps the V12 CLI authorization gate ahead of credentials', async () => {
    const writes: string[] = [];
    let credentialReads = 0;
    const code = await executePhase698RetrieverSchemaRecoverySr5LiveCliCore(
      {
        args: [PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_ARGUMENT],
        root: 'synthetic-root',
        proxyEnv: {},
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      {
        readCredential: () => {
          credentialReads += 1;
          return 'must-not-read';
        },
        write: (line) => writes.push(line),
      },
    );
    expect(code).toBe(1);
    expect(credentialReads).toBe(0);
    expect(JSON.parse(writes[0] ?? '{}')).toMatchObject({
      code: 'data_boundary_not_accepted',
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
      businessWrites: 0,
    });
  });

  test('fixes the V12 production host to direct mode without inherited proxy state', async () => {
    const directHostEnv = createPhase698RetrieverSchemaRecoverySr5V12DirectHostProcessEnv({
      Path: 'C:\\Windows',
      http_proxy: 'http://127.0.0.1:7897',
      Https_Proxy: 'http://127.0.0.1:7897',
      ALL_PROXY: 'http://127.0.0.1:7897',
      no_proxy: 'localhost',
      PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V12_APPROVED: 'receipt',
    });
    expect(Object.getPrototypeOf(directHostEnv)).toBe(null);
    expect(Object.isFrozen(directHostEnv)).toBe(true);
    expect(directHostEnv).toMatchObject({
      Path: 'C:\\Windows',
      PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V12_APPROVED: 'receipt',
      PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V12_DIRECT_HOST_REENTRY: '1',
    });
    expect(
      Reflect.ownKeys(directHostEnv).filter((key) =>
        ['http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'].includes(String(key).toLowerCase()),
      ),
    ).toEqual([]);

    let listenerProbeCalls = 0;
    const report = await runPhase697ArchitectureRecoveryProxyPreflight(
      { env: directHostEnv, signal: new AbortController().signal },
      {
        probeLoopbackListener: async () => {
          listenerProbeCalls += 1;
          return true;
        },
      },
    );
    expect(report).toMatchObject({
      ok: true,
      code: 'direct_ready',
      mode: 'direct',
      configuredProxyVariables: 0,
      listenerProbeCalls: 0,
      providerCalls: 0,
    });
    expect(listenerProbeCalls).toBe(0);
  });

  test('V2 nullable reasoning crosses the Task9 candidate and durable runner success path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-sr5-v12-'));
    roots.push(root);
    await mkdir(join(root, '.tmp'), { recursive: true });
    const runId = crypto.randomUUID();
    const admission = createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest();
    const reservation = await reservePhase698RetrieverSchemaRecoverySr5LiveAttempt({
      root,
      runId,
      createdAt: new Date().toISOString(),
      admissionAuthority: 'synthetic_test_live',
      reservationCapability: admission.reservationCapability,
    });
    const base = createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest();
    let candidateCalls = 0;
    const harness = {
      ...base,
      async invokeCall(input: Parameters<typeof base.invokeCall>[0]) {
        if (input.identity.phase === 'rewrite_candidate_model' && candidateCalls++ === 0) {
          return qualifyPhase698Task9RewriteV11CompatibilityForTest({
            testCase: rewriteCase,
            fetch: async () =>
              new Response(
                JSON.stringify({
                  choices: [
                    {
                      message: {
                        content: JSON.stringify({
                          rewrittenQuery: `${rewriteCase.requiredTerms.join(' ')} ${rewriteCase.retrievalAnchor} ${rewriteCase.originalQuery}`,
                        }),
                        reasoning_content: null,
                      },
                    },
                  ],
                  usage: { prompt_tokens: 20, completion_tokens: 5 },
                  provider_secret: SENTINEL,
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
              ),
          });
        }
        return base.invokeCall(input);
      },
    } as const;

    const report = await runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest({
      runId,
      repositoryRoot: root,
      admissionAuthority: 'synthetic_test_live',
      admissionCapability: admission.capability,
      harness,
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    expect(report.callEntries[1]).toMatchObject({
      disposition: 'succeeded',
      failureReason: null,
      wire: { attempts: 1, dispatches: 1, responses: 1, verifiedUsage: 1 },
    });
    await reservation.publishArtifact(report);
    expect(await Bun.file(join(root, artifactRelativePath(runId))).text()).not.toContain(SENTINEL);
    expect(await validatePhase698RetrieverSchemaRecoverySr5LiveBundle({ root })).toMatchObject({
      ok: true,
      runId,
    });
  });

  test.each(diagnosticCases)('$name survives runner and durable evidence', async (item) => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-sr5-v12-'));
    roots.push(root);
    await mkdir(join(root, '.tmp'), { recursive: true });
    const runId = crypto.randomUUID();
    const admission = createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest();
    const reservation = await reservePhase698RetrieverSchemaRecoverySr5LiveAttempt({
      root,
      runId,
      createdAt: new Date().toISOString(),
      admissionAuthority: 'synthetic_test_live',
      reservationCapability: admission.reservationCapability,
    });
    const base = createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest();
    let candidateCalls = 0;
    const harness = {
      ...base,
      async invokeCall(input: Parameters<typeof base.invokeCall>[0]) {
        if (input.identity.phase === 'rewrite_candidate_model') {
          candidateCalls += 1;
          if (candidateCalls === 1) {
            const error = await qualifyPhase698Task9RewriteDiagnosticForTest({
              testCase: rewriteCase,
              fetch: async () =>
                new Response(JSON.stringify(item.payload()), {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                }),
            });
            throw error;
          }
        }
        return base.invokeCall(input);
      },
    } as const;

    const report = await runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest({
      runId,
      repositoryRoot: root,
      admissionAuthority: 'synthetic_test_live',
      admissionCapability: admission.capability,
      harness,
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    const entry = report.callEntries[1]!;
    expect(entry).toMatchObject({
      disposition: 'failed',
      failureReason:
        item.category === 'response_audit'
          ? 'response_invalid'
          : item.category === 'usage_validation'
            ? 'usage_invalid'
            : 'schema_invalid',
      adapterFailureCategory: item.category,
      structuredOutputStage: item.stage,
      wire: { attempts: 1, dispatches: 1, responses: 1, verifiedUsage: 0 },
    });
    expect(report.execution.externalProviderCalls).toBe(0);
    expect(report.execution.credentialReads).toBe(0);
    expect(report.callEntries.slice(2).every((call) => call.wire.attempts === 0)).toBe(true);

    await reservation.publishArtifact(report);
    const journal = (await Bun.file(join(root, journalRelativePath(runId))).text())
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const candidateId = String(entry.callId);
    const candidateEvents = journal.filter(
      (record) =>
        (record.identity as Record<string, unknown> | undefined)?.callId === candidateId ||
        (record.entry as Record<string, unknown> | undefined)?.callId === candidateId,
    );
    expect(candidateEvents.map((record) => record.event)).toEqual([
      'call_reserved',
      'wire_stage',
      'wire_stage',
      'call_terminal',
    ]);
    expect(
      candidateEvents
        .filter((record) => record.event === 'wire_stage')
        .map((record) => (record as { stage: string }).stage),
    ).toEqual(['dispatch_started', 'response_received']);
    expect(JSON.stringify(report)).not.toContain(SENTINEL);
    expect(JSON.stringify(journal)).not.toContain(SENTINEL);
    expect(await Bun.file(join(root, artifactRelativePath(runId))).text()).not.toContain(SENTINEL);
    expect(await validatePhase698RetrieverSchemaRecoverySr5LiveBundle({ root })).toMatchObject({
      ok: true,
      runId,
    });
  });
});
