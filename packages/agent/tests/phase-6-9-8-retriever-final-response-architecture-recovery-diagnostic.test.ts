import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
  parsePhase698ArchitectureRecoveryDiagnostic,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';

const CANONICAL_FAILURE = Object.freeze({
  diagnosticVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
  callPhase: 'rewrite_candidate_model' as const,
  stage: 'provider_envelope' as const,
  reasonCode: 'provider_envelope_invalid' as const,
  providerBoundary: 'response_observed' as const,
  topLevelTypeBucket: 'object' as const,
  fieldCountBucket: '2_4' as const,
  terminalCountBucket: 'not_applicable' as const,
  rawDataRetained: false as const,
});

describe('Phase 6.9.8 Architecture Recovery bounded diagnostic contract', () => {
  test('accepts only the exact deep-frozen bounded diagnostic shape', () => {
    const parsed = parsePhase698ArchitectureRecoveryDiagnostic(CANONICAL_FAILURE);

    expect(parsed).toEqual(CANONICAL_FAILURE);
    expect(Object.isFrozen(parsed)).toBe(true);

    expect(
      parsePhase698ArchitectureRecoveryDiagnostic({
        ...CANONICAL_FAILURE,
        callPhase: 'final_response_model',
        stage: 'terminal_ledger',
        reasonCode: 'terminal_duplicate',
        terminalCountBucket: '2_plus',
      }),
    ).not.toBeNull();
  });

  test('rejects unknown fields, raw-derived hashes, free text, and invalid success semantics', () => {
    const hostileValues = [
      { ...CANONICAL_FAILURE, raw: 'provider body' },
      { ...CANONICAL_FAILURE, error: 'raw transport error' },
      { ...CANONICAL_FAILURE, unknownKey: 'rewrittenQuery' },
      { ...CANONICAL_FAILURE, shapeFingerprint: `sha256:${'a'.repeat(64)}` },
      { ...CANONICAL_FAILURE, rawDataRetained: true },
      { ...CANONICAL_FAILURE, reasonCode: 'free_text_reason' },
      { ...CANONICAL_FAILURE, stage: 'applied', reasonCode: 'unknown' },
      { ...CANONICAL_FAILURE, stage: 'provider_envelope', reasonCode: 'applied' },
      { ...CANONICAL_FAILURE, terminalCountBucket: '1' },
      {
        ...CANONICAL_FAILURE,
        callPhase: 'final_response_model',
        stage: 'terminal_ledger',
        reasonCode: 'terminal_duplicate',
        terminalCountBucket: '2_4',
      },
      {
        ...CANONICAL_FAILURE,
        callPhase: 'final_response_model',
        stage: 'terminal_ledger',
        reasonCode: 'terminal_duplicate',
        terminalCountBucket: '5_plus',
      },
      {
        ...CANONICAL_FAILURE,
        callPhase: 'final_response_model',
        stage: 'terminal_ledger',
        reasonCode: 'terminal_duplicate',
        terminalCountBucket: 'not_observed',
      },
    ];

    for (const value of hostileValues) {
      expect(parsePhase698ArchitectureRecoveryDiagnostic(value)).toBeNull();
    }
  });

  test('rejects accessor, Proxy, symbol, and non-plain inputs without evaluating raw values', () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, 'diagnosticVersion', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('raw diagnostic getter');
      },
    });
    const proxy = new Proxy(CANONICAL_FAILURE, {
      ownKeys() {
        throw new Error('raw proxy trap');
      },
    });
    const symbol = { ...CANONICAL_FAILURE, [Symbol('raw')]: true };
    const nonPlain = Object.assign(new Date(0), CANONICAL_FAILURE);

    expect(parsePhase698ArchitectureRecoveryDiagnostic(accessor)).toBeNull();
    expect(getterCalls).toBe(0);
    expect(parsePhase698ArchitectureRecoveryDiagnostic(proxy)).toBeNull();
    expect(parsePhase698ArchitectureRecoveryDiagnostic(symbol)).toBeNull();
    expect(parsePhase698ArchitectureRecoveryDiagnostic(nonPlain)).toBeNull();
  });
});
