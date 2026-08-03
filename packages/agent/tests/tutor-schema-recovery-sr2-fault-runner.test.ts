import { describe, expect, test } from 'bun:test';

import type { ModelAgentRequest, ModelAgentRuntime } from '@repo/ai';

import { runPhase697TutorOrganizerFullGate } from '../src/evals/run-phase-6-9-tutor-organizer-full-gate.ts';
import { runTutorSchemaRecoveryModelCandidate } from '../src/model-candidates/tutor-schema-recovery-model-candidate.ts';
import {
  F2_RUN_ID,
  F2_SAFE,
  createF2MemoryLifecycle,
  createF2Source,
  createF2SuccessHarness,
} from './phase-6-9-tutor-organizer-full-gate-f2-helpers.ts';
import { PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FAULT_CASES } from './fixtures/phase-6-9-tutor-schema-recovery-sr2-robustness-v1.ts';
import {
  createSr2CandidateInput,
  createSr2ProviderResponse,
  createSr2TrackedRuntime,
} from './tutor-schema-recovery-sr2-helpers.ts';

const TEXT = '我写完这一行了，但不确定推导是否接得上。';
const CONTEXT = '合成代数题：正在检查方程变形与等价关系。';

describe('Phase 6.9.7 Tutor Schema Recovery SR2 faults and pair runner', () => {
  test('preserves transport, HTTP, response-audit, and usage categories with one dispatch and no retry', async () => {
    for (const fault of PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FAULT_CASES) {
      const tracked = createSr2TrackedRuntime({
        fetch: async () => {
          switch (fault.id) {
            case 'transport':
              throw new Error('synthetic transport');
            case 'http-rate-limit':
              return new Response('', { status: 429 });
            case 'response-audit':
              return createSr2ProviderResponse('{"intentIndex":0}', { reasoningContent: '' });
            case 'usage-missing':
              return createSr2ProviderResponse('{"intentIndex":0}', { includeUsage: false });
          }
        },
      });
      const result = await runTutorSchemaRecoveryModelCandidate(
        createSr2CandidateInput(TEXT, CONTEXT, tracked.runtime),
      );

      expect(tracked.fetchCalls(), fault.id).toBe(1);
      expect(tracked.runtimeRequests, fault.id).toHaveLength(1);
      expect(result.observation.disposition, fault.id).toBe('fallback_runtime_error');
      expect(tracked.wireSnapshot()?.failureCategory, fault.id).toBe(fault.wireCategory);
      expect(result.observation.trace?.providerFailureCategory, fault.id).toBe(
        fault.publicCategory,
      );
      expect(JSON.stringify(result), fault.id).not.toContain('synthetic transport');
    }
  });

  test('keeps pre-dispatch, in-flight, and post-runtime aborts fail-closed', async () => {
    const budgetTracked = createSr2TrackedRuntime({
      fetch: async () => {
        throw new Error('budget-exhausted fetch must not run');
      },
    });
    const budgetResult = await runTutorSchemaRecoveryModelCandidate(
      createSr2CandidateInput(TEXT, CONTEXT, budgetTracked.runtime, {
        budget: Object.freeze({
          maxCalls: 1,
          usedCalls: 1,
          maxInputTokens: 1_200,
          usedInputTokens: 1,
          maxOutputTokens: 300,
          usedOutputTokens: 1,
        }),
      }),
    );
    expect(budgetTracked.fetchCalls()).toBe(0);
    expect(budgetResult.observation.disposition).toBe('fallback_budget_exceeded');

    const pre = new AbortController();
    pre.abort('sr2-pre-dispatch');
    const preTracked = createSr2TrackedRuntime({
      fetch: async () => {
        throw new Error('pre-dispatch fetch must not run');
      },
    });
    const preResult = await runTutorSchemaRecoveryModelCandidate(
      createSr2CandidateInput(TEXT, CONTEXT, preTracked.runtime, { signal: pre.signal }),
    );
    expect(preTracked.fetchCalls()).toBe(0);
    expect(preResult.observation.disposition).toBe('fallback_aborted');

    const inFlight = new AbortController();
    const inFlightTracked = createSr2TrackedRuntime({
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('synthetic abort', 'AbortError')),
            { once: true },
          );
          queueMicrotask(() => inFlight.abort('sr2-in-flight'));
        }),
    });
    const inFlightResult = await runTutorSchemaRecoveryModelCandidate(
      createSr2CandidateInput(TEXT, CONTEXT, inFlightTracked.runtime, {
        signal: inFlight.signal,
      }),
    );
    expect(inFlightTracked.fetchCalls()).toBe(1);
    expect(inFlightResult.observation.disposition).toBe('fallback_aborted');

    const postRuntime = new AbortController();
    const postTracked = createSr2TrackedRuntime({
      fetch: async () => createSr2ProviderResponse('{"intentIndex":0}'),
    });
    const postRuntimeWrapper: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        const result = await postTracked.runtime.invokeStructured(request);
        postRuntime.abort('sr2-post-runtime');
        return result;
      },
    };
    const postResult = await runTutorSchemaRecoveryModelCandidate(
      createSr2CandidateInput(TEXT, CONTEXT, postRuntimeWrapper, {
        signal: postRuntime.signal,
      }),
    );
    expect(postTracked.fetchCalls()).toBe(1);
    expect(postResult.observation.disposition).toBe('fallback_aborted');
  });

  test('closes the admitted pair, preserves its sibling, and opens the breaker on SR2 schema failure', async () => {
    const memory = createF2MemoryLifecycle();
    const source = createF2Source();
    const base = createF2SuccessHarness();
    let tutorDispatches = 0;
    const harness = Object.freeze({
      ...base,
      async runTutor(
        entry: Parameters<typeof base.runTutor>[0],
        signal: AbortSignal,
        capability: Parameters<typeof base.runTutor>[2],
      ) {
        if (entry.id !== 'tutor-v2-runtime-01') return base.runTutor(entry, signal, capability);
        const tracked = createSr2TrackedRuntime({
          capability,
          fetch: async () => createSr2ProviderResponse('{"intentIndex":0,"intentIndex":1}'),
        });
        const candidate = await runTutorSchemaRecoveryModelCandidate(
          createSr2CandidateInput(
            entry.input.latestUserText,
            entry.input.activeStudyContext,
            tracked.runtime,
            { signal },
          ),
        );
        tutorDispatches += tracked.fetchCalls();
        expect(candidate.observation.disposition).toBe('fallback_runtime_error');
        expect(candidate.schemaDiagnostic?.reasonCode).toBe('duplicate_key');
        return Object.freeze({
          disposition: 'attempted_failed' as const,
          failureCategory: 'schema' as const,
          strictRuntimeSuccess: false,
          durationMs: null,
          orchestrationDurationMs: null,
          usage: null,
          semantic: null,
          safety: F2_SAFE,
        });
      },
    });
    const report = await runPhase697TutorOrganizerFullGate({
      runId: F2_RUN_ID,
      runScope: 'branch',
      approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
      sourceHashes: source.sourceHashes,
      harness,
      lifecycle: memory.lifecycle,
      signal: new AbortController().signal,
    });

    expect(tutorDispatches).toBe(1);
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 46,
    });
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01'),
    ).toMatchObject({
      disposition: 'attempted_failed',
      failureCategory: 'schema',
    });
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'organizer-v2-runtime-01'),
    ).toMatchObject({ disposition: 'succeeded', strictRuntimeSuccess: true });
    expect(
      report.caseEntries.filter((entry) => entry.disposition === 'not_started_quality_breaker'),
    ).toHaveLength(46);
    expect(report.breaker).toEqual({ opened: true, reason: 'schema' });
  });
});
