import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_7_FULL_GATE_EVAL_POLICY } from '../src/evals/phase-6-9-tutor-organizer-full-gate-contract.ts';
import {
  type Phase697FullGateHarness,
  type Phase697FullGateLifecycle,
  runPhase697TutorOrganizerFullGate,
} from '../src/evals/run-phase-6-9-tutor-organizer-full-gate.ts';
import {
  F2_RUN_ID,
  F2_SAFE,
  createF2MemoryLifecycle,
  createF2Source,
  createF2SuccessHarness,
} from './phase-6-9-tutor-organizer-full-gate-f2-helpers.ts';

describe('Phase 6.9.7 full-gate F2 runner', () => {
  test('runs all guards first, serializes pairs, and admits both lanes inside one pair', async () => {
    const memory = createF2MemoryLifecycle();
    const starts: string[] = [];
    let pairZeroStarted = 0;
    let releasePairZero!: () => void;
    const pairZeroBarrier = new Promise<void>((resolve) => {
      releasePairZero = resolve;
    });
    const harness = createF2SuccessHarness({
      async onRuntimeStart(entry) {
        starts.push(entry.id);
        if (entry.pairedRunIndex !== 0) return;
        pairZeroStarted += 1;
        if (pairZeroStarted === 2) releasePairZero();
        await pairZeroBarrier;
      },
    });

    const report = await run(harness, memory.lifecycle);

    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 48,
      terminalEntries: 48,
      orphanedEntries: 0,
      notStartedEntries: 0,
    });
    expect(report.wire).toMatchObject({
      executorEntered: 48,
      providerDispatchStarted: 48,
      providerResponseReceived: 48,
      verifiedUsageObserved: 48,
    });
    expect(starts.slice(0, 2)).toEqual(['tutor-v2-runtime-01', 'organizer-v2-runtime-01']);
    expect(starts).toHaveLength(48);
    expect(memory.trace.filter((event) => event.startsWith('guard:'))).toHaveLength(24);
    expect(memory.trace.findIndex((event) => event.startsWith('reserve:'))).toBeGreaterThan(
      memory.trace.findLastIndex((event) => event.startsWith('guard:')),
    );
    expect(memory.trace.indexOf('pair:0')).toBeLessThan(
      memory.trace.indexOf('reserve:tutor-v2-runtime-08'),
    );
    expect(memory.trace.indexOf('terminal:tutor-v2-runtime-01')).toBeLessThan(
      memory.trace.indexOf('pair:0'),
    );
    expect(memory.trace.indexOf('terminal:organizer-v2-runtime-01')).toBeLessThan(
      memory.trace.indexOf('pair:0'),
    );
  });

  test('keeps executing after semantic mismatch and fails only the final quality gate', async () => {
    const memory = createF2MemoryLifecycle();
    const harness = createF2SuccessHarness({
      mutateRuntimeResult(entry, result) {
        if (entry.agent !== 'tutor' || result.semantic?.agent !== 'tutor') return result;
        const observation = result.semantic.observation;
        return Object.freeze({
          ...result,
          semantic: {
            agent: 'tutor' as const,
            observation: {
              ...observation,
              actualIntent:
                observation.expectedIntent === 'socratic_hint'
                  ? ('concept_bridge' as const)
                  : ('socratic_hint' as const),
              actualDepth: observation.expectedDepth === 'deep' ? 'brief' : 'deep',
              actualContextUse: !observation.expectedContextUse,
              actualGuidingQuestion: !observation.expectedGuidingQuestion,
              actualFinalAnswer: !observation.expectedFinalAnswer,
              actualAnswerStructure: [],
            },
          },
        });
      },
    });

    const report = await run(harness, memory.lifecycle);

    expect(report.runtimeAccounting.reservedEntries).toBe(48);
    expect(report.runtimeAccounting.notStartedEntries).toBe(0);
    expect(report.metrics.complete).toBe(true);
    expect(report.metrics.tutorSemanticScore).toBeLessThan(0.85);
    expect(report.breaker.opened).toBe(false);
    expect(report.gate).toBe('full_gate_quality_gate_failed');
  });

  test('closes after the first contract failure while preserving the successful sibling terminal', async () => {
    const memory = createF2MemoryLifecycle();
    const harness = createF2SuccessHarness({
      mutateRuntimeResult(entry, result) {
        if (entry.id !== 'tutor-v2-runtime-01') return result;
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

    const report = await run(harness, memory.lifecycle);

    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 46,
    });
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01'),
    ).toMatchObject({ disposition: 'attempted_failed', failureCategory: 'schema' });
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'organizer-v2-runtime-01'),
    ).toMatchObject({ disposition: 'succeeded', strictRuntimeSuccess: true });
    expect(
      report.caseEntries.filter((entry) => entry.disposition === 'not_started_quality_breaker'),
    ).toHaveLength(46);
    expect(report.breaker).toMatchObject({ opened: true, reason: 'schema' });
  });

  test('preserves transport, HTTP, schema, and usage failure categories with null aggregates', async () => {
    for (const failureCategory of ['transport', 'http', 'schema', 'usage'] as const) {
      const memory = createF2MemoryLifecycle();
      const base = createF2SuccessHarness();
      const harness: Phase697FullGateHarness = Object.freeze({
        ...base,
        async runTutor(entry, signal, capability) {
          if (entry.id !== 'tutor-v2-runtime-01') {
            return base.runTutor(entry, signal, capability);
          }
          return Object.freeze({
            disposition: 'attempted_failed' as const,
            failureCategory,
            strictRuntimeSuccess: false,
            durationMs: null,
            orchestrationDurationMs: null,
            usage: null,
            semantic: null,
            safety: F2_SAFE,
          });
        },
      });

      const report = await run(harness, memory.lifecycle);
      const failed = report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01');

      expect(failed).toMatchObject({
        disposition: 'attempted_failed',
        failureCategory,
        wire: {
          executorEntered: 0,
          providerDispatchStarted: 0,
          providerResponseReceived: 0,
          verifiedUsageObserved: 0,
        },
      });
      expect(
        report.caseEntries.find((entry) => entry.caseId === 'organizer-v2-runtime-01'),
      ).toMatchObject({ disposition: 'succeeded', strictRuntimeSuccess: true });
      expect(report.runtimeAccounting).toEqual({
        reservedEntries: 2,
        terminalEntries: 2,
        orphanedEntries: 0,
        notStartedEntries: 46,
      });
      expect(report.breaker).toEqual({ opened: true, reason: failureCategory });
      expect(report.metrics).toMatchObject({
        complete: false,
        tutorSemanticScore: null,
        organizerSemanticScore: null,
        combinedSemanticScore: null,
      });
      expect(report.latency).toMatchObject({
        complete: false,
        tutorCandidateP95Ms: null,
        organizerCandidateP95Ms: null,
        pairedCandidateP95Ms: null,
        tutorOrchestrationP95Ms: null,
      });
      expect(report.usage).toMatchObject({
        complete: false,
        inputTokens: null,
        outputTokens: null,
        estimatedCostCny: null,
      });
    }
  });

  test('turns a failed guard into a zero-runtime fixed-denominator report', async () => {
    const memory = createF2MemoryLifecycle();
    let runtimeCalls = 0;
    const base = createF2SuccessHarness();
    const harness: Phase697FullGateHarness = Object.freeze({
      ...base,
      async runGuard(entry) {
        if (entry.id !== 'tutor-v2-zero-route-not-tutor') return base.runGuard(entry);
        return Object.freeze({
          runtimeInvocations: 1,
          zeroCallVerified: false,
          safety: F2_SAFE,
        });
      },
      async runTutor(entry, signal, capability) {
        runtimeCalls += 1;
        return base.runTutor(entry, signal, capability);
      },
      async runOrganizer(entry, signal, capability) {
        runtimeCalls += 1;
        return base.runOrganizer(entry, signal, capability);
      },
    });

    const report = await run(harness, memory.lifecycle);

    expect(runtimeCalls).toBe(0);
    expect(report.safety.guardVerifiedZeroCalls).toBe(23);
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 0,
      terminalEntries: 0,
      orphanedEntries: 0,
      notStartedEntries: 48,
    });
    expect(report.breaker).toMatchObject({ opened: true, reason: 'guard' });
  });

  test('uses the exact Tutor hard timeout and keeps the Organizer sibling result', async () => {
    const memory = createF2MemoryLifecycle();
    const base = createF2SuccessHarness();
    let tutorSignal: AbortSignal | null = null;
    const harness: Phase697FullGateHarness = Object.freeze({
      ...base,
      runTutor(_entry, signal) {
        tutorSignal = signal;
        return new Promise(() => undefined);
      },
    });
    const startedAt = performance.now();

    const report = await run(harness, memory.lifecycle);
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.tutorHardTimeoutMs - 100,
    );
    expect(elapsed).toBeLessThan(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.tutorHardTimeoutMs + 1_000,
    );
    expect(tutorSignal?.aborted).toBe(true);
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01'),
    ).toMatchObject({ disposition: 'attempted_failed', failureCategory: 'timeout' });
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'organizer-v2-runtime-01'),
    ).toMatchObject({ disposition: 'succeeded', strictRuntimeSuccess: true });
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 46,
    });
  });

  test('does not retry a lane terminal when durable append reports failure', async () => {
    const memory = createF2MemoryLifecycle();
    let failingTerminalCalls = 0;
    const lifecycle: Phase697FullGateLifecycle = Object.freeze({
      ...memory.lifecycle,
      async appendLaneTerminal(identity, entry) {
        if (identity.caseId === 'tutor-v2-runtime-01') {
          failingTerminalCalls += 1;
          throw new Error('synthetic terminal append failure');
        }
        await memory.lifecycle.appendLaneTerminal(identity, entry);
      },
    });

    await expect(run(createF2SuccessHarness(), lifecycle)).rejects.toThrow();
    expect(failingTerminalCalls).toBe(1);
  });

  test('keeps an already-aborted request out of every runtime lane', async () => {
    const memory = createF2MemoryLifecycle();
    const controller = new AbortController();
    controller.abort();

    const report = await run(createF2SuccessHarness(), memory.lifecycle, controller.signal);

    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 0,
      terminalEntries: 0,
      orphanedEntries: 0,
      notStartedEntries: 48,
    });
    expect(
      report.caseEntries.filter((entry) => entry.disposition === 'not_started_external_abort'),
    ).toHaveLength(48);
    expect(memory.trace.some((event) => event.startsWith('reserve:'))).toBe(false);
  });

  test('closes an admitted pair on parent abort and leaves later pairs not started', async () => {
    const memory = createF2MemoryLifecycle();
    const controller = new AbortController();
    let started = 0;
    let releasePair!: () => void;
    const pairBarrier = new Promise<void>((resolve) => {
      releasePair = resolve;
    });
    const harness = createF2SuccessHarness({
      async onRuntimeStart(entry) {
        if (entry.pairedRunIndex !== 0) return;
        started += 1;
        if (started === 2) {
          controller.abort();
          releasePair();
        }
        await pairBarrier;
      },
    });

    const report = await run(harness, memory.lifecycle, controller.signal);

    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 46,
    });
    expect(
      report.caseEntries.filter((entry) => entry.disposition === 'attempted_aborted'),
    ).toHaveLength(2);
    expect(
      report.caseEntries.filter((entry) => entry.disposition === 'not_started_external_abort'),
    ).toHaveLength(46);
    expect(report.breaker).toEqual({ opened: true, reason: 'external_abort' });
  });
});

function run(
  harness: Phase697FullGateHarness,
  lifecycle: Phase697FullGateLifecycle,
  signal = new AbortController().signal,
) {
  const source = createF2Source();
  return runPhase697TutorOrganizerFullGate({
    runId: F2_RUN_ID,
    runScope: 'branch',
    approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
    sourceHashes: source.sourceHashes,
    harness,
    lifecycle,
    signal,
  });
}
