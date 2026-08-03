import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { validatePhase697FullGateBundle } from '../src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_CLI_VERSION,
  PHASE_6_9_7_SCHEMA_RECOVERY_CRASH_SEAL_CONFIRMATION,
  PHASE_6_9_7_SCHEMA_RECOVERY_VALIDATE_CONFIRMATION,
  executePhase697SchemaRecoveryCliCore,
  type Phase697SchemaRecoveryCliCorePorts,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-cli-core.ts';
import { parsePhase697SchemaRecoveryReport } from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-contract.ts';
import { validatePhase697SchemaRecoveryBundle } from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SEALED_SR5_EVIDENCE_FILES = [
  'phase-6-9-7-tutor-organizer-schema-recovery-sr5-branch-controlled-live-63f8a76b-1c2a-403d-b774-0235caae04cb.json',
  'phase-6-9-7-tutor-organizer-schema-recovery-sr5-controlled-live-63f8a76b-1c2a-403d-b774-0235caae04cb.journal.jsonl',
  'phase-6-9-7-tutor-organizer-schema-recovery-sr5-controlled-live.marker',
] as const;

describe('Phase 6.9.7 Schema Recovery SR3 lineage and CLI security', () => {
  test('keeps SR5 authorization unavailable and blocks before every mutation port', async () => {
    const state = createPorts();
    const exit = await executePhase697SchemaRecoveryCliCore(
      {
        args: ['I_AUTHORIZE_PHASE_6_9_7_SCHEMA_RECOVERY_LIVE_ONCE'],
        root: REPOSITORY_ROOT,
        signal: new AbortController().signal,
      },
      state.ports,
    );

    expect(exit).toBe(1);
    expect(state.validateCalls).toBe(0);
    expect(state.sealCalls).toBe(0);
    expect(JSON.parse(state.lines[0]!)).toMatchObject({
      version: PHASE_6_9_7_SCHEMA_RECOVERY_CLI_VERSION,
      ok: false,
      evidenceSealed: false,
      qualityAuthority: 'none',
      providerCalls: 0,
      code: 'not_frozen_before_sr5',
    });
  });

  test('exposes only exact zero-provider validate and crash-only seal commands', async () => {
    const validation = createPorts();
    expect(
      await executePhase697SchemaRecoveryCliCore(
        {
          args: [PHASE_6_9_7_SCHEMA_RECOVERY_VALIDATE_CONFIRMATION],
          root: REPOSITORY_ROOT,
          signal: new AbortController().signal,
        },
        validation.ports,
      ),
    ).toBe(0);
    expect(validation.validateCalls).toBe(1);
    expect(validation.sealCalls).toBe(0);
    expect(JSON.parse(validation.lines[0]!)).toMatchObject({
      operation: 'validate',
      ok: true,
      providerCalls: 0,
    });

    const sealing = createPorts();
    expect(
      await executePhase697SchemaRecoveryCliCore(
        {
          args: [PHASE_6_9_7_SCHEMA_RECOVERY_CRASH_SEAL_CONFIRMATION],
          root: REPOSITORY_ROOT,
          signal: new AbortController().signal,
        },
        sealing.ports,
      ),
    ).toBe(0);
    expect(sealing.validateCalls).toBe(0);
    expect(sealing.sealCalls).toBe(1);
    expect(JSON.parse(sealing.lines[0]!)).toMatchObject({
      operation: 'crash_only_seal',
      ok: true,
      evidenceSealed: true,
      qualityAuthority: 'none',
      providerCalls: 0,
    });
  });

  test('fails closed for abort, accessor input, extra args, and writer failure', async () => {
    const aborted = createPorts();
    const controller = new AbortController();
    controller.abort();
    expect(
      await executePhase697SchemaRecoveryCliCore(
        {
          args: [PHASE_6_9_7_SCHEMA_RECOVERY_VALIDATE_CONFIRMATION],
          root: REPOSITORY_ROOT,
          signal: controller.signal,
        },
        aborted.ports,
      ),
    ).toBe(1);
    expect(aborted.validateCalls + aborted.sealCalls).toBe(0);

    let getterCalls = 0;
    const hostile = Object.create(null);
    Object.defineProperty(hostile, 'args', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('must not execute');
      },
    });
    Object.defineProperty(hostile, 'root', { enumerable: true, value: REPOSITORY_ROOT });
    Object.defineProperty(hostile, 'signal', {
      enumerable: true,
      value: new AbortController().signal,
    });
    expect(await executePhase697SchemaRecoveryCliCore(hostile, aborted.ports)).toBe(1);
    expect(getterCalls).toBe(0);

    expect(
      await executePhase697SchemaRecoveryCliCore(
        {
          args: [PHASE_6_9_7_SCHEMA_RECOVERY_VALIDATE_CONFIRMATION, 'extra'],
          root: REPOSITORY_ROOT,
          signal: new AbortController().signal,
        },
        aborted.ports,
      ),
    ).toBe(1);

    const writerFailure = createPorts(() => {
      throw new Error('writer unavailable');
    });
    expect(
      await executePhase697SchemaRecoveryCliCore(
        {
          args: [PHASE_6_9_7_SCHEMA_RECOVERY_VALIDATE_CONFIRMATION],
          root: REPOSITORY_ROOT,
          signal: new AbortController().signal,
        },
        writerFailure.ports,
      ),
    ).toBe(1);
  });

  test('rejects hostile port results without leaking or overriding fixed authority fields', async () => {
    const lines: string[] = [];
    const hostileValidation = Object.freeze({
      async validate() {
        return {
          ok: true,
          runId: '00000000-0000-4000-8000-000000000973',
          gate: 'schema_recovery_quality_gate_passed',
          qualityAuthority: 'schema_recovery_full_gate_semantic_gate',
          journalRecords: 12,
          finalJournalEvent: 'evidence_published',
          reportLogicalSha256: 'a'.repeat(64),
          physicalArtifactSha256: 'b'.repeat(64),
          providerCalls: 99,
          rawResponse: 'must-not-leak',
        };
      },
      async seal() {
        return { ok: false as const, code: 'attempt_missing_or_invalid' as const };
      },
      write(line: string) {
        lines.push(line);
      },
    }) as unknown as Phase697SchemaRecoveryCliCorePorts;
    expect(
      await executePhase697SchemaRecoveryCliCore(
        {
          args: [PHASE_6_9_7_SCHEMA_RECOVERY_VALIDATE_CONFIRMATION],
          root: REPOSITORY_ROOT,
          signal: new AbortController().signal,
        },
        hostileValidation,
      ),
    ).toBe(1);
    expect(lines.join('\n')).not.toContain('must-not-leak');
    expect(JSON.parse(lines[0]!)).toMatchObject({
      ok: false,
      providerCalls: 0,
      qualityAuthority: 'none',
      code: 'bundle_validation_failed',
    });

    lines.length = 0;
    const hostileSeal = Object.freeze({
      async validate() {
        return {
          ok: false,
          runId: null,
          gate: null,
          qualityAuthority: null,
          journalRecords: 0,
          finalJournalEvent: null,
          reportLogicalSha256: null,
          physicalArtifactSha256: null,
        };
      },
      async seal() {
        return {
          ok: true,
          runId: '00000000-0000-4000-8000-000000000973',
          disposition: 'crash_only_sealed',
          gate: 'schema_recovery_quality_gate_failed',
          evidenceSha256: 'b'.repeat(64),
          lineage: 'hostile-lineage',
          evidenceSealed: false,
          providerCalls: 99,
          rawError: 'must-not-leak',
        };
      },
      write(line: string) {
        lines.push(line);
      },
    }) as unknown as Phase697SchemaRecoveryCliCorePorts;
    expect(
      await executePhase697SchemaRecoveryCliCore(
        {
          args: [PHASE_6_9_7_SCHEMA_RECOVERY_CRASH_SEAL_CONFIRMATION],
          root: REPOSITORY_ROOT,
          signal: new AbortController().signal,
        },
        hostileSeal,
      ),
    ).toBe(1);
    expect(lines.join('\n')).not.toContain('must-not-leak');
    expect(JSON.parse(lines[0]!)).toMatchObject({
      ok: false,
      evidenceSealed: false,
      providerCalls: 0,
      qualityAuthority: 'none',
      code: 'crash_only_seal_failed',
    });
  });

  test('rejects hostile report accessors without invoking them', () => {
    let getterCalls = 0;
    const hostile = Object.create(null);
    Object.defineProperty(hostile, 'reportVersion', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('must not execute');
      },
    });
    expect(parsePhase697SchemaRecoveryReport(hostile)).toBeNull();
    expect(getterCalls).toBe(0);
  });

  test('keeps production CLI closed to env, credential, fetch, reservation, and Provider ports', async () => {
    const script = await readFile(
      join(
        REPOSITORY_ROOT,
        'packages/agent/scripts/phase-6-9-7-tutor-organizer-schema-recovery-cli.ts',
      ),
      'utf8',
    );
    expect(script).not.toMatch(
      /process\.env|readCredential|readApproval|reservePhase|createHarness|fetch\s*\(|https?:\/\//u,
    );
    expect(script).toContain('validatePhase697SchemaRecoveryBundle');
    expect(script).toContain('sealPhase697SchemaRecoveryInterruptedAttempt');

    const tmpEntries = await readdir(join(REPOSITORY_ROOT, '.tmp')).catch(() => [] as string[]);
    const formal = tmpEntries
      .filter((entry) => entry.includes('tutor-organizer-schema-recovery-sr5'))
      .sort();
    const validation = await validatePhase697SchemaRecoveryBundle({ root: REPOSITORY_ROOT });
    if (formal.length === 0) {
      expect(validation.ok).toBe(false);
    } else {
      expect(formal).toEqual([...SEALED_SR5_EVIDENCE_FILES].sort());
      expect(validation).toMatchObject({
        ok: true,
        runId: '63f8a76b-1c2a-403d-b774-0235caae04cb',
        journalRecords: 628,
        finalJournalEvent: 'evidence_published',
        physicalArtifactSha256: '87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be',
      });
    }
  });

  test('preserves the sealed L3 validator and physical artifact SHA', async () => {
    const historical = await validatePhase697FullGateBundle({ root: REPOSITORY_ROOT });
    expect(historical).toMatchObject({
      ok: true,
      runId: '2b0ac3a0-631f-4c7f-9781-ce0cda94149a',
      journalRecords: 296,
      finalJournalEvent: 'evidence_published',
      physicalArtifactSha256: 'e081939bb7f4b17235b1d9afb61d78031879bb80b9d64c952e4b86531cd7dbe5',
    });
  });
});

function createPorts(write?: (line: string) => void) {
  const state = {
    validateCalls: 0,
    sealCalls: 0,
    lines: [] as string[],
  };
  const ports: Phase697SchemaRecoveryCliCorePorts = Object.freeze({
    async validate() {
      state.validateCalls += 1;
      return Object.freeze({
        ok: true,
        runId: '00000000-0000-4000-8000-000000000973',
        gate: 'schema_recovery_quality_gate_failed',
        qualityAuthority: 'none',
        journalRecords: 1,
        finalJournalEvent: 'evidence_published',
        reportLogicalSha256: 'c'.repeat(64),
        physicalArtifactSha256: 'a'.repeat(64),
      });
    },
    async seal() {
      state.sealCalls += 1;
      return Object.freeze({
        ok: true as const,
        runId: '00000000-0000-4000-8000-000000000973',
        disposition: 'crash_only_sealed' as const,
        gate: 'schema_recovery_quality_gate_failed' as const,
        evidenceSha256: 'b'.repeat(64),
      });
    },
    write: write ?? ((line) => state.lines.push(line)),
  });
  return Object.assign(state, { ports });
}
