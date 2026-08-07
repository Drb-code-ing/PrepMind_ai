import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  createPhase698TransportReentryV2C2SyntheticAdmissionForTest,
  makePhase698TransportReentryV2C2SyntheticConfigurationForTest,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_VERSION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_PATHS,
  preparePhase698TransportReentryV2C2Configuration,
  validatePhase698TransportReentryV2C2SourceForTest,
  phase698TransportReentryV2C2WritableRelativePath,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts';
import {
  createPhase698TransportReentryV2C2SyntheticRootForTest,
  removePhase698TransportReentryV2C2SyntheticRootForTest,
  recoverPhase698TransportReentryV2C2InterruptedAttempt,
  reservePhase698TransportReentryV2C2Attempt,
  runPhase698TransportReentryV2C2Synthetic,
  validatePhase698TransportReentryV2C2Bundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts';

const PACKAGE_DIR = resolve(import.meta.dir, '..');
const REPOSITORY_ROOT = resolve(PACKAGE_DIR, '../..');

async function withRoot<T>(task: (root: string) => Promise<T>) {
  const root = await createPhase698TransportReentryV2C2SyntheticRootForTest();
  try {
    return await task(root);
  } finally {
    await removePhase698TransportReentryV2C2SyntheticRootForTest(root);
  }
}

async function runAll(root: string, options: Record<string, unknown> = {}) {
  const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
  const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
  return runPhase698TransportReentryV2C2Synthetic({
    root,
    admissionCapability: admission.capability,
    configurationCapability: configuration.capability,
    reservationCapability: admission.reservationCapability,
    ...options,
  } as never);
}

describe('Phase 6.9.8 Transport Re-entry V2 C2 admission and isolation', () => {
  test('uses a new source version and rejects parity/lineage drift', () => {
    const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
    expect(admission.source.version).toBe(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_VERSION);
    expect(validatePhase698TransportReentryV2C2SourceForTest(admission.source)).toBe(true);
    expect(
      validatePhase698TransportReentryV2C2SourceForTest({
        ...admission.source,
        lineage: 'phase-6.9.8-old-lineage',
      }),
    ).toBe(false);
    expect(
      validatePhase698TransportReentryV2C2SourceForTest({
        ...admission.source,
        remoteCommit: '1'.repeat(40),
      }),
    ).toBe(false);
    expect(phase698TransportReentryV2C2WritableRelativePath('../escape')).toBe(false);
    expect(phase698TransportReentryV2C2WritableRelativePath('old-t3.marker.json')).toBe(false);
  });

  test('keeps every git source-admission path present in the repository', () => {
    expect(
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_PATHS.every((path) =>
        existsSync(resolve(REPOSITORY_ROOT, path)),
      ),
    ).toBe(true);
  });

  test('binds admission and reservation capabilities to one synthetic authority', async () => {
    await withRoot(async (root) => {
      const first = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
      const reservation = await reservePhase698TransportReentryV2C2Attempt({
        root,
        configurationCapability: configuration.capability,
        reservationCapability: first.reservationCapability,
      });
      expect(reservation.runId).toMatch(/[0-9a-f-]{36}/u);
      await expect(
        reservePhase698TransportReentryV2C2Attempt({
          root,
          configurationCapability:
            makePhase698TransportReentryV2C2SyntheticConfigurationForTest().capability,
          reservationCapability: first.reservationCapability,
        }),
      ).rejects.toThrow('C2_RESERVATION_CAPABILITY_INVALID');
      const forged = {
        ...createPhase698TransportReentryV2C2SyntheticAdmissionForTest().capability,
      };
      await expect(
        runPhase698TransportReentryV2C2Synthetic({
          root,
          admissionCapability: forged,
          configurationCapability:
            makePhase698TransportReentryV2C2SyntheticConfigurationForTest().capability,
          reservationCapability:
            createPhase698TransportReentryV2C2SyntheticAdmissionForTest().reservationCapability,
        }),
      ).rejects.toThrow('C2_ADMISSION_CAPABILITY_INVALID');
    });
  });

  test('rejects an invalid C1 projection before marker creation', async () => {
    await withRoot(async (root) => {
      const invalidProjection = preparePhase698TransportReentryV2C2Configuration({
        lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
      });
      expect(invalidProjection).toEqual({ ok: false, reasonCode: 'configuration_invalid' });
      const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      await expect(
        reservePhase698TransportReentryV2C2Attempt({
          root,
          configurationCapability: {},
          reservationCapability: admission.reservationCapability,
        }),
      ).rejects.toThrow('C2_CONFIGURATION_CAPABILITY_INVALID');
      expect(await readdir(root)).toEqual([]);
      expect((await validatePhase698TransportReentryV2C2Bundle({ root })).formalEvidence).toBe(0);
    });
  });

  test('rejects a second reservation through the exclusive marker fence', async () => {
    await withRoot(async (root) => {
      const first = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      const firstConfiguration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
      await reservePhase698TransportReentryV2C2Attempt({
        root,
        configurationCapability: firstConfiguration.capability,
        reservationCapability: first.reservationCapability,
      });
      const second = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      const secondConfiguration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
      await expect(
        reservePhase698TransportReentryV2C2Attempt({
          root,
          configurationCapability: secondConfiguration.capability,
          reservationCapability: second.reservationCapability,
        }),
      ).rejects.toThrow('C2_FORMAL_FILES_ALREADY_EXIST');
    });
  });

  test('rejects a foreign/old marker before selecting an arbitrary attempt', async () => {
    await withRoot(async (root) => {
      await Bun.write(
        resolve(
          root,
          '.tmp/phase-6-9-8-retriever-final-response-transport-evidence-t3-foreign.marker.json',
        ),
        '{}',
      );
      const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
      await expect(
        reservePhase698TransportReentryV2C2Attempt({
          root,
          configurationCapability: configuration.capability,
          reservationCapability: admission.reservationCapability,
        }),
      ).rejects.toThrow('C2_FORMAL_FILES_ALREADY_EXIST');
    });
  });
});

describe('Phase 6.9.8 Transport Re-entry V2 C2 synthetic runner', () => {
  test('runs all three slots once with strict wire/usage accounting and hard-link publication', async () => {
    await withRoot(async (root) => {
      const result = await runAll(root);
      expect(result.ok).toBe(true);
      expect(result.validation).toMatchObject({
        ok: true,
        providerCalls: 0,
        credentialReads: 0,
        formalEvidence: 0,
        finalJournalEvent: 'evidence_published',
      });
      expect(result.report.slots.every((slot) => slot.disposition === 'completed')).toBe(true);
      expect(result.report.verifiedUsageSlots).toBe(3);
      expect(result.report.syntheticPortCalls).toBe(3);
      const rootEntries = await readdir(root);
      expect(
        rootEntries.some(
          (name) => name.includes('transport-reentry-v2-') && name.endsWith('.json'),
        ),
      ).toBe(true);
      const artifact = rootEntries.find((name) => name.endsWith('.json'))!;
      const artifactBytes = await readFile(resolve(root, artifact), 'utf8');
      expect(artifactBytes).not.toContain('apiKey');
      expect(artifactBytes).not.toContain('DEEPSEEK_API_KEY');
      expect(artifactBytes).not.toContain('QWEN_API_KEY');
      expect(artifactBytes).not.toContain('synthetic-secret');
    });
  });

  test('covers the bounded first-failure fault matrix without retry or Provider calls', async () => {
    const faults = [
      'missing',
      'invalid',
      'conflict',
      'abort',
      'timeout',
      'transport',
      'schema',
      'usage',
    ] as const;
    for (const fault of faults) {
      await withRoot(async (root) => {
        const result = await runAll(root, { faults: { rewrite: fault } });
        expect(result.validation.ok).toBe(true);
        expect(result.validation.providerCalls).toBe(0);
        expect(result.report.passed).toBe(false);
        expect(result.report.slots[0]!.failureCode).toBe(fault === 'abort' ? 'abort' : fault);
        expect(
          result.report.slots
            .slice(1)
            .every((slot) =>
              fault === 'abort'
                ? slot.disposition === 'not_started_external_abort'
                : slot.disposition === 'not_started_quality_breaker',
            ),
        ).toBe(true);
      });
    }
  });

  test('keeps publication failure bounded and recovers the same terminal', async () => {
    await withRoot(async (root) => {
      const result = await runAll(root, { publicationFault: true });
      expect(result.ok).toBe(false);
      expect(result.recoveryRequired).toBe(true);
      expect(result.validation.ok).toBe(false);
      const recovery = await recoverPhase698TransportReentryV2C2InterruptedAttempt({
        root,
        isProcessAlive: () => false,
      });
      expect(recovery.ok).toBe(true);
      expect(recovery.ok && recovery.disposition).toBe('terminal_publication_recovered');
      expect((await validatePhase698TransportReentryV2C2Bundle({ root })).ok).toBe(true);
    });
  });
});

describe('Phase 6.9.8 Transport Re-entry V2 C2 durability and crash-only seal', () => {
  test('seals a reserved-only prefix and refuses an active owner', async () => {
    await withRoot(async (root) => {
      const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
      await reservePhase698TransportReentryV2C2Attempt({
        root,
        configurationCapability: configuration.capability,
        reservationCapability: admission.reservationCapability,
      });
      const active = await recoverPhase698TransportReentryV2C2InterruptedAttempt({
        root,
        isProcessAlive: () => true,
      });
      expect(active).toEqual({ ok: false, code: 'process_active' });
      const sealed = await recoverPhase698TransportReentryV2C2InterruptedAttempt({
        root,
        isProcessAlive: () => false,
      });
      expect(sealed.ok).toBe(true);
      expect(sealed.ok && sealed.disposition).toBe('crash_only_sealed');
      expect((await validatePhase698TransportReentryV2C2Bundle({ root })).ok).toBe(true);
    });
  });

  test('recovers a dispatch-before-call prefix without duplicating terminal records', async () => {
    await withRoot(async (root) => {
      const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
      const reservation = await reservePhase698TransportReentryV2C2Attempt({
        root,
        configurationCapability: configuration.capability,
        reservationCapability: admission.reservationCapability,
      });
      await reservation.appendSlotDispatchStarted('rewrite');
      const recovered = await recoverPhase698TransportReentryV2C2InterruptedAttempt({
        root,
        isProcessAlive: () => false,
      });
      expect(recovered.ok).toBe(true);
      const journal = await readFile(
        resolve(
          root,
          '.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.journal.jsonl',
        ),
        'utf8',
      );
      expect(journal.match(/"event":"slot_terminal"/gu)?.length).toBe(3);
      expect((await validatePhase698TransportReentryV2C2Bundle({ root })).ok).toBe(true);
    });
  });

  test('rejects a tampered hash-chain tail', async () => {
    await withRoot(async (root) => {
      await runAll(root);
      const journalPath = resolve(
        root,
        '.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.journal.jsonl',
      );
      const journal = await readFile(journalPath, 'utf8');
      await writeFile(
        journalPath,
        `${journal.trimEnd()}\n${journal.trimEnd().split('\n').at(-1)}\n`,
      );
      expect((await validatePhase698TransportReentryV2C2Bundle({ root })).ok).toBe(false);
    });
  });

  test('rejects an unexpected formal root file', async () => {
    await withRoot(async (root) => {
      await runAll(root);
      await Bun.write(resolve(root, 'unexpected-formal-evidence.json'), '{}');
      expect((await validatePhase698TransportReentryV2C2Bundle({ root })).ok).toBe(false);
    });
  });

  test('rejects an unexpected formal root directory', async () => {
    await withRoot(async (root) => {
      await runAll(root);
      await Bun.write(resolve(root, 'unexpected-formal-directory/marker.json'), '{}');
      expect((await validatePhase698TransportReentryV2C2Bundle({ root })).ok).toBe(false);
    });
  });

  test('keeps the package entry and runner free of credential/provider ports', async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(PACKAGE_DIR, 'package.json'), 'utf8'),
    ) as {
      scripts?: Record<string, unknown>;
      exports?: Record<string, unknown>;
    };
    expect(packageJson.scripts?.['eval:phase-6-9-8:transport-reentry:v2:c2']).toBe(
      'bun scripts/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts',
    );
    expect(packageJson.exports?.['./transport-reentry-v2-c2']).toBe(
      './src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts',
    );
    const source = await readFile(
      resolve(
        PACKAGE_DIR,
        'src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts',
      ),
      'utf8',
    );
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('DEEPSEEK_API_KEY');
    expect(source).not.toContain('QWEN_API_KEY');
    expect(source).not.toContain('fetch(');
  });
});
