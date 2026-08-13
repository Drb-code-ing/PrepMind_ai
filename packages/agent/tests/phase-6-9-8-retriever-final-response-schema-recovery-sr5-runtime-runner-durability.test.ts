import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import {
  bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider,
  createPhase698Sr5RuntimeSourceBindingInputForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runtime-source-binding-contract.ts';
import {
  createPhase698Sr5RuntimeRunnerSyntheticRootForTest,
  createPhase698Sr5RuntimeRunnerSyntheticSourceCapabilityForTest,
  parsePhase698Sr5RuntimeRunnerArgs,
  removePhase698Sr5RuntimeRunnerSyntheticRootForTest,
  reservePhase698Sr5RuntimeRunnerAttemptForTest,
  sealPhase698Sr5RuntimeRunnerInterruptedAttemptForTest,
  validatePhase698Sr5RuntimeRunnerBundleZeroProvider,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runtime-runner-durability.ts';

function binding() {
  const result = bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider(
    createPhase698Sr5RuntimeSourceBindingInputForTest(),
  );
  if (!result.ok) throw new Error('binding failed');
  return result;
}

function capability() {
  return createPhase698Sr5RuntimeRunnerSyntheticSourceCapabilityForTest(binding().record);
}

describe('Phase 6.9.8 SR5 D4 runtime runner durability', () => {
  test('persists a runtime-source-bound zero-provider fixed-denominator bundle', async () => {
    const root = await createPhase698Sr5RuntimeRunnerSyntheticRootForTest();
    try {
      const reservation = await reservePhase698Sr5RuntimeRunnerAttemptForTest({
        root,
        sourceBindingCapability: capability(),
      });
      const result = await reservation.runSyntheticZeroProvider();
      expect(result.report).toMatchObject({
        guards: { planned: 8, completed: 8 },
        lanes: { planned: 12, reserved: 12, dispatches: 0, responses: 0, notStarted: 12 },
        runnerInvocationAllowed: false,
        providerDispatchAllowed: false,
        providerCalls: 0,
      });
      expect(await validatePhase698Sr5RuntimeRunnerBundleZeroProvider(root)).toMatchObject({
        ok: true,
        journalRecords: 5,
        providerCalls: 0,
        credentialReads: 0,
        formalEvidence: 0,
      });
    } finally {
      await removePhase698Sr5RuntimeRunnerSyntheticRootForTest(root);
    }
  });

  test('consumes source binding and reservation once', async () => {
    const root = await createPhase698Sr5RuntimeRunnerSyntheticRootForTest();
    try {
      const issued = capability();
      const reservation = await reservePhase698Sr5RuntimeRunnerAttemptForTest({
        root,
        sourceBindingCapability: issued,
      });
      await expect(
        reservePhase698Sr5RuntimeRunnerAttemptForTest({
          root,
          sourceBindingCapability: issued,
        }),
      ).rejects.toThrow('SYNTHETIC_SOURCE_CAPABILITY_INVALID');
      await reservation.runSyntheticZeroProvider();
      await expect(reservation.runSyntheticZeroProvider()).rejects.toThrow(
        'RUNNER_DURABILITY_INVALID',
      );
    } finally {
      await removePhase698Sr5RuntimeRunnerSyntheticRootForTest(root);
    }
  });

  test('rejects journal and artifact tampering without repair', async () => {
    const root = await createPhase698Sr5RuntimeRunnerSyntheticRootForTest();
    try {
      const reservation = await reservePhase698Sr5RuntimeRunnerAttemptForTest({
        root,
        sourceBindingCapability: capability(),
      });
      await reservation.runSyntheticZeroProvider();
      const artifact = join(root, `phase-6-9-8-sr5-runtime-runner-${reservation.runId}.json`);
      await Bun.write(artifact, `${await Bun.file(artifact).text()}tampered`);
      expect(await validatePhase698Sr5RuntimeRunnerBundleZeroProvider(root)).toMatchObject({
        ok: false,
      });
      expect(await Bun.file(artifact).text()).toContain('tampered');
    } finally {
      await removePhase698Sr5RuntimeRunnerSyntheticRootForTest(root);
    }
  });

  test('crash-only seals the reserved prefix without dispatch or replay', async () => {
    const root = await createPhase698Sr5RuntimeRunnerSyntheticRootForTest();
    try {
      await reservePhase698Sr5RuntimeRunnerAttemptForTest({
        root,
        sourceBindingCapability: capability(),
      });
      expect(
        await sealPhase698Sr5RuntimeRunnerInterruptedAttemptForTest({
          root,
          isProcessAlive: () => false,
        }),
      ).toEqual({ ok: true, disposition: 'crash_only_sealed' });
      expect(await validatePhase698Sr5RuntimeRunnerBundleZeroProvider(root)).toMatchObject({
        ok: true,
        journalRecords: 4,
        providerCalls: 0,
      });
      expect(
        await sealPhase698Sr5RuntimeRunnerInterruptedAttemptForTest({
          root,
          isProcessAlive: () => false,
        }),
      ).toEqual({ ok: false, code: 'already_published' });
    } finally {
      await removePhase698Sr5RuntimeRunnerSyntheticRootForTest(root);
    }
  });

  test('refuses crash seal while the recorded owner is alive', async () => {
    const root = await createPhase698Sr5RuntimeRunnerSyntheticRootForTest();
    try {
      await reservePhase698Sr5RuntimeRunnerAttemptForTest({
        root,
        sourceBindingCapability: capability(),
      });
      expect(
        await sealPhase698Sr5RuntimeRunnerInterruptedAttemptForTest({
          root,
          isProcessAlive: () => true,
        }),
      ).toEqual({ ok: false, code: 'process_active_or_marker_invalid' });
    } finally {
      await removePhase698Sr5RuntimeRunnerSyntheticRootForTest(root);
    }
  });

  test('rejects recovery claim tampering without rewriting it', async () => {
    const root = await createPhase698Sr5RuntimeRunnerSyntheticRootForTest();
    try {
      const reservation = await reservePhase698Sr5RuntimeRunnerAttemptForTest({
        root,
        sourceBindingCapability: capability(),
      });
      await sealPhase698Sr5RuntimeRunnerInterruptedAttemptForTest({
        root,
        isProcessAlive: () => false,
      });
      const claimPath = join(
        root,
        `.tmp/phase-6-9-8-sr5-runtime-runner-${reservation.runId}.recovery.json`,
      );
      await Bun.write(claimPath, `${await Bun.file(claimPath).text()}tampered`);
      expect(await validatePhase698Sr5RuntimeRunnerBundleZeroProvider(root)).toMatchObject({
        ok: false,
      });
      expect(await Bun.file(claimPath).text()).toContain('tampered');
    } finally {
      await removePhase698Sr5RuntimeRunnerSyntheticRootForTest(root);
    }
  });

  test('has no live or authorization-shaped argv', () => {
    expect(parsePhase698Sr5RuntimeRunnerArgs([]).kind).toBe('help');
    expect(parsePhase698Sr5RuntimeRunnerArgs(['--help']).kind).toBe('help');
    for (const args of [['live'], ['--run'], ['I_AUTHORIZE_PHASE_6_9_8_SR5']]) {
      expect(parsePhase698Sr5RuntimeRunnerArgs(args).kind).toBe('rejected');
    }
  });
});
