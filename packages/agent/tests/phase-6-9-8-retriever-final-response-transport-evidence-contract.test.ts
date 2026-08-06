import { describe, expect, test } from 'bun:test';

import {
  parsePhase698TransportEvidenceDiagnostic,
  phase698TransportEvidenceStagesBefore,
  phase698TransportEvidenceWireForBoundary,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_VERSION,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES,
  type Phase698TransportEvidenceDiagnostic,
  type Phase698TransportEvidenceFamily,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';
import {
  createPhase698TransportEvidenceFinalResponseCapability,
  readPhase698TransportEvidenceFinalResponseObservation,
  recordPhase698TransportEvidenceFinalResponseObservation,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-final-response.ts';
import {
  createPhase698TransportEvidenceQwenCapability,
  readPhase698TransportEvidenceQwenObservation,
  recordPhase698TransportEvidenceQwenObservation,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-qwen.ts';
import {
  createPhase698TransportEvidenceRewriteCapability,
  readPhase698TransportEvidenceRewriteObservation,
  recordPhase698TransportEvidenceRewriteObservation,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-rewrite.ts';

describe('Phase 6.9.8 Transport Evidence Recovery T1 strict contract', () => {
  test('accepts a canonical applied snapshot and deeply freezes every bounded field', () => {
    const parsed = parsePhase698TransportEvidenceDiagnostic(
      makeObservation('rewrite-01', 'rewrite', 'rewrite'),
    );

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(makeObservation('rewrite-01', 'rewrite', 'rewrite'));
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.runnerWire)).toBe(true);
    expect(Object.isFrozen(parsed?.providerWire)).toBe(true);
    expect(Object.isFrozen(parsed?.diagnosticStages)).toBe(true);
    expect(parsed?.rawDataRetained).toBe(false);
  });

  test('keeps the exact five-stage sequence and known boundary wire in lockstep', () => {
    expect(phase698TransportEvidenceStagesBefore('response_observed')).toEqual([
      'preflight',
      'dispatch_started',
    ]);
    expect(phase698TransportEvidenceWireForBoundary('dispatched_no_response')).toEqual({
      runnerWire: { reservations: 1, dispatches: 1, harnessReturns: 0, verifiedResults: 0 },
      providerWire: { executions: 1, dispatches: 1, responses: 0, verifiedUsage: 0 },
    });

    for (const boundary of [
      'not_dispatched',
      'dispatched_no_response',
      'response_observed',
      'response_and_usage_observed',
    ] as const) {
      const observation = makeObservation('wire-' + boundary, 'qwen', 'qwen', {
        stage:
          boundary === 'not_dispatched'
            ? 'preflight'
            : boundary === 'dispatched_no_response'
              ? 'dispatch_started'
              : boundary === 'response_observed'
                ? 'response_observed'
                : 'usage_observed',
        reasonCode: boundary === 'response_and_usage_observed' ? 'usage_invalid' : 'unknown',
        diagnosticStages:
          boundary === 'not_dispatched'
            ? []
            : boundary === 'dispatched_no_response'
              ? ['preflight']
              : boundary === 'response_observed'
                ? ['preflight', 'dispatch_started']
                : ['preflight', 'dispatch_started', 'response_observed'],
        providerBoundary: boundary,
        ...phase698TransportEvidenceWireForBoundary(boundary),
      });
      expect(parsePhase698TransportEvidenceDiagnostic(observation)).not.toBeNull();
    }
  });

  test('rejects raw, unknown, accessor, proxy, family, stage, reason, and wire drift', () => {
    const canonical = makeObservation('rewrite-02', 'rewrite', 'rewrite');
    const hostileValues: unknown[] = [
      { ...canonical, raw: 'provider response' },
      { ...canonical, prompt: 'private prompt' },
      { ...canonical, credential: 'secret' },
      { ...canonical, unknownKey: 'rewrittenQuery' },
      { ...canonical, rawDataRetained: true },
      { ...canonical, family: 'qwen' },
      { ...canonical, phase: 'qwen' },
      { ...canonical, reasonCode: 'proxy', stage: 'terminal' },
      {
        ...canonical,
        stage: 'response_observed',
        reasonCode: 'envelope_invalid',
        diagnosticStages: ['dispatch_started'],
      },
      {
        ...canonical,
        stage: 'response_observed',
        reasonCode: 'envelope_invalid',
        providerBoundary: 'dispatched_no_response',
        runnerWire: { reservations: 1, dispatches: 1, harnessReturns: 0, verifiedResults: 0 },
        providerWire: { executions: 1, dispatches: 1, responses: 0, verifiedUsage: 0 },
        diagnosticStages: ['preflight', 'dispatch_started'],
      },
      {
        ...canonical,
        providerWire: { executions: 1, dispatches: 0, responses: 1, verifiedUsage: 0 },
      },
      {
        ...canonical,
        diagnosticStages: [...PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES, 'terminal'],
      },
    ];

    let getterCalls = 0;
    hostileValues.push(
      Object.defineProperty({}, 'rawDataRetained', {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error('raw getter must not run');
        },
      }),
    );
    hostileValues.push(
      new Proxy(canonical, {
        ownKeys() {
          throw new Error('raw proxy must not run');
        },
      }),
    );

    for (const value of hostileValues) {
      expect(parsePhase698TransportEvidenceDiagnostic(value)).toBeNull();
    }
    expect(getterCalls).toBe(0);
  });

  test('keeps unknown as an honest terminal instead of guessing a network root cause', () => {
    const unknown = makeObservation('unknown-01', 'final_response', 'final_response', {
      stage: 'terminal',
      reasonCode: 'unknown',
      providerBoundary: 'unknown',
      diagnosticStages: ['preflight', 'dispatch_started', 'response_observed', 'usage_observed'],
      runnerWire: { reservations: 1, dispatches: 1, harnessReturns: 1, verifiedResults: 0 },
      providerWire: { executions: 1, dispatches: 1, responses: 1, verifiedUsage: 0 },
    });
    expect(parsePhase698TransportEvidenceDiagnostic(unknown)?.reasonCode).toBe('unknown');
    expect(parsePhase698TransportEvidenceDiagnostic(unknown)?.providerBoundary).toBe('unknown');
  });

  test('keeps each family capability in a private single-consume WeakMap boundary', () => {
    const rewrite = createPhase698TransportEvidenceRewriteCapability('rewrite-03');
    const qwen = createPhase698TransportEvidenceQwenCapability('qwen-03');
    const finalResponse = createPhase698TransportEvidenceFinalResponseCapability('final-03');

    expect(Object.isFrozen(rewrite)).toBe(true);
    expect(readPhase698TransportEvidenceRewriteObservation(rewrite)).toBeNull();
    expect(readPhase698TransportEvidenceQwenObservation(qwen)).toBeNull();
    expect(readPhase698TransportEvidenceFinalResponseObservation(finalResponse)).toBeNull();

    const rewriteObservation = makeObservation('rewrite-03', 'rewrite', 'rewrite');
    expect(recordPhase698TransportEvidenceRewriteObservation(rewrite, rewriteObservation)).toEqual(
      rewriteObservation,
    );
    expect(
      recordPhase698TransportEvidenceRewriteObservation(rewrite, rewriteObservation),
    ).toBeNull();
    expect(readPhase698TransportEvidenceRewriteObservation(rewrite)).toEqual(rewriteObservation);

    const qwenObservation = makeObservation('qwen-03', 'qwen', 'qwen');
    const finalObservation = makeObservation('final-03', 'final_response', 'final_response');
    expect(recordPhase698TransportEvidenceQwenObservation(qwen, qwenObservation)).toEqual(
      qwenObservation,
    );
    expect(
      recordPhase698TransportEvidenceFinalResponseObservation(finalResponse, finalObservation),
    ).toEqual(finalObservation);

    const forged = {
      version: rewrite.version,
      lineage: rewrite.lineage,
      family: 'rewrite' as const,
      phase: 'rewrite' as const,
      callId: 'rewrite-03',
    };
    expect(
      recordPhase698TransportEvidenceRewriteObservation(forged, rewriteObservation),
    ).toBeNull();
    expect(recordPhase698TransportEvidenceQwenObservation(rewrite, qwenObservation)).toBeNull();
    expect(
      recordPhase698TransportEvidenceFinalResponseObservation(qwen, finalObservation),
    ).toBeNull();
  });

  test('rejects out-of-order snapshots without consuming a valid capability', () => {
    const capability = createPhase698TransportEvidenceRewriteCapability('rewrite-04');
    const outOfOrder = makeObservation('rewrite-04', 'rewrite', 'rewrite', {
      stage: 'response_observed',
      reasonCode: 'envelope_invalid',
      diagnosticStages: ['dispatch_started'],
      providerBoundary: 'response_observed',
      ...phase698TransportEvidenceWireForBoundary('response_observed'),
    });
    expect(recordPhase698TransportEvidenceRewriteObservation(capability, outOfOrder)).toBeNull();
    expect(readPhase698TransportEvidenceRewriteObservation(capability)).toBeNull();
    expect(
      recordPhase698TransportEvidenceRewriteObservation(
        capability,
        makeObservation('rewrite-04', 'rewrite', 'rewrite'),
      ),
    ).not.toBeNull();
  });

  test('does not expose transport-evidence issuers through the public agent barrel', async () => {
    const publicModule = await import('@repo/agent');
    for (const name of [
      'createPhase698TransportEvidenceRewriteCapability',
      'recordPhase698TransportEvidenceRewriteObservation',
      'createPhase698TransportEvidenceQwenCapability',
      'createPhase698TransportEvidenceFinalResponseCapability',
    ]) {
      expect(name in publicModule).toBe(false);
    }
  });

  test('rejects invalid call ids before any provider-shaped seam can be created', () => {
    expect(() => createPhase698TransportEvidenceRewriteCapability('')).toThrow(
      'PHASE_6_9_8_TRANSPORT_EVIDENCE_CALL_ID_INVALID',
    );
    expect(() => createPhase698TransportEvidenceQwenCapability('query/with/raw')).toThrow(
      'PHASE_6_9_8_TRANSPORT_EVIDENCE_CALL_ID_INVALID',
    );
  });
});

function makeObservation(
  callId: string,
  family: Phase698TransportEvidenceFamily,
  phase: Phase698TransportEvidenceFamily,
  overrides: Partial<Phase698TransportEvidenceDiagnostic> = {},
): Phase698TransportEvidenceDiagnostic {
  return {
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    callId,
    family,
    phase,
    stage: 'terminal',
    reasonCode: 'applied',
    providerBoundary: 'response_and_usage_observed',
    runnerWire: { reservations: 1, dispatches: 1, harnessReturns: 1, verifiedResults: 1 },
    providerWire: { executions: 1, dispatches: 1, responses: 1, verifiedUsage: 1 },
    diagnosticStages: [...PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES],
    rawDataRetained: false,
    ...overrides,
  };
}
