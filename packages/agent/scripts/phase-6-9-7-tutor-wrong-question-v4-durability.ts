import { randomUUID } from 'node:crypto';
import {
  link as fsLink,
  lstat as fsLstat,
  mkdir as fsMkdir,
  open as fsOpen,
  readFile as fsReadFile,
  rename as fsRename,
  unlink as fsUnlink,
  type FileHandle,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V4_JOURNAL_RECORD_SCHEMA,
  PHASE_6_9_7_V4_MARKER_PATH,
  PHASE_6_9_7_V4_MARKER_SCHEMA,
  PHASE_6_9_7_V4_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_V4_RECOVERY_CLAIM_VERSION,
  buildPhase697V4JournalRecord,
  parseAndValidatePhase697V4Journal,
  phase697V4EvidencePath,
  phase697V4JournalPath,
  phase697V4RecoveryClaimPath,
  sha256Bytes,
  stableJsonStringify,
  type Phase697V4EvidenceEnvelope,
  type Phase697V4JournalPayload,
  type Phase697V4JournalRecord,
  type Phase697V4Marker,
  type Phase697V4RecoveryClaimRecord,
  type Phase697V4ValidatedJournal,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-durability-contract.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';

export type Phase697V4DurabilityFsOverrides = Readonly<
  Partial<{
    open: typeof fsOpen;
    mkdir: typeof fsMkdir;
    lstat: typeof fsLstat;
    link: typeof fsLink;
    rename: typeof fsRename;
    unlink: typeof fsUnlink;
    readFile: typeof fsReadFile;
    temporaryId: () => string;
    claimToken: () => string;
    processAlive: (processId: number) => boolean;
  }>
>;

export type Phase697V4JournalWriter = Readonly<{
  path: string;
  append(payload: Phase697V4JournalPayload): Promise<Phase697V4JournalRecord>;
  snapshot(): Promise<Readonly<{ tailSha256: string; lastSequence: number }>>;
  close(): Promise<void>;
}>;

export type Phase697V4RecoveryClaim = Readonly<{
  path: string;
  runId: string;
  ownerToken: string;
  assertOwned(): Promise<boolean>;
  reserveAppender(): Promise<boolean>;
  release(): Promise<void>;
}>;

export type Phase697V4RecoveryClaimResult =
  | Readonly<{ ok: true; claim: Phase697V4RecoveryClaim }>
  | Readonly<{
      ok: false;
      code: 'live_attempt_in_progress' | 'recovery_claim_io_failed' | 'recovery_claim_path_invalid';
    }>;

export type Phase697V4MarkerReservationResult =
  | Readonly<{
      ok: true;
      marker: Phase697V4Marker;
      markerSha256: string;
      markerPath: string;
    }>
  | Readonly<{
      ok: false;
      code: 'live_already_attempted' | 'marker_io_failed' | 'marker_path_invalid';
    }>;

export async function reservePhase697V4Marker(input: {
  root: string;
  marker: Readonly<Phase697V4Marker>;
  overrides?: Phase697V4DurabilityFsOverrides;
}): Promise<Phase697V4MarkerReservationResult> {
  const fs = resolveFs(input.overrides);
  const markerPath = resolve(input.root, PHASE_6_9_7_V4_MARKER_PATH);
  const parentReady = await ensurePlainDirectory(dirname(markerPath), fs);
  if (!parentReady) return { ok: false, code: 'marker_path_invalid' };
  const bytes = `${stableJsonStringify(input.marker)}\n`;
  let handle: FileHandle | null = null;
  try {
    handle = await fs.open(markerPath, 'wx', 0o600);
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    return {
      ok: true,
      marker: PHASE_6_9_7_V4_MARKER_SCHEMA.parse(input.marker),
      markerSha256: sha256Bytes(bytes),
      markerPath,
    };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (!isAlreadyExistsError(error)) return { ok: false, code: 'marker_io_failed' };
    try {
      const existing = await fs.lstat(markerPath);
      return existing.isFile() && !existing.isSymbolicLink()
        ? { ok: false, code: 'live_already_attempted' }
        : { ok: false, code: 'marker_path_invalid' };
    } catch {
      return { ok: false, code: 'marker_io_failed' };
    }
  }
}

export async function createPhase697V4Journal(input: {
  root: string;
  marker: Readonly<Phase697V4Marker>;
  markerSha256: string;
  overrides?: Phase697V4DurabilityFsOverrides;
}): Promise<
  | Readonly<{ ok: true; writer: Phase697V4JournalWriter; journalPath: string }>
  | Readonly<{
      ok: false;
      code: 'journal_already_exists' | 'journal_io_failed' | 'journal_path_invalid';
    }>
> {
  const fs = resolveFs(input.overrides);
  const relativePath = phase697V4JournalPath(input.marker.runId);
  const journalPath = resolve(input.root, relativePath);
  const parentReady = await ensurePlainDirectory(dirname(journalPath), fs);
  if (!parentReady) return { ok: false, code: 'journal_path_invalid' };
  let handle: FileHandle | null = null;
  try {
    handle = await fs.open(journalPath, 'ax', 0o600);
    const initial = buildPhase697V4JournalRecord({
      runId: input.marker.runId,
      sequence: 0,
      previousRecordSha256: null,
      payload: {
        kind: 'journal_initialized',
        markerSha256: input.markerSha256,
        runScope: input.marker.runScope,
        mode: 'live',
        datasetSha256: input.marker.datasetSha256,
      },
    });
    assertSafeJournalRecord(initial);
    await handle.writeFile(`${stableJsonStringify(initial)}\n`, 'utf8');
    await handle.sync();
    return {
      ok: true,
      writer: createJournalWriter({
        path: journalPath,
        handle,
        runId: input.marker.runId,
        sequence: 0,
        tailSha256: initial.recordSha256,
      }),
      journalPath,
    };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (isAlreadyExistsError(error)) {
      try {
        const existing = await fs.lstat(journalPath);
        return existing.isFile() && !existing.isSymbolicLink()
          ? { ok: false, code: 'journal_already_exists' }
          : { ok: false, code: 'journal_path_invalid' };
      } catch {
        return { ok: false, code: 'journal_io_failed' };
      }
    }
    return {
      ok: false,
      code: 'journal_io_failed',
    };
  }
}

export async function acquirePhase697V4RecoveryClaim(input: {
  root: string;
  marker: Readonly<Phase697V4Marker>;
  overrides?: Phase697V4DurabilityFsOverrides;
}): Promise<Phase697V4RecoveryClaimResult> {
  const fs = resolveFs(input.overrides);
  if (isProcessAlive(input.marker.ownerProcessId, input.overrides?.processAlive)) {
    return { ok: false, code: 'live_attempt_in_progress' };
  }
  const claimPath = resolve(input.root, phase697V4RecoveryClaimPath(input.marker.runId));
  const parentReady = await ensurePlainDirectory(dirname(claimPath), fs);
  if (!parentReady) return { ok: false, code: 'recovery_claim_path_invalid' };
  const ownerToken = (input.overrides?.claimToken ?? randomUUID)();
  const claimRecord = PHASE_6_9_7_V4_RECOVERY_CLAIM_SCHEMA.safeParse({
    claimVersion: PHASE_6_9_7_V4_RECOVERY_CLAIM_VERSION,
    runnerVersion: input.marker.runnerVersion,
    runId: input.marker.runId,
    ownerProcessId: process.pid,
    ownerToken,
    state: 'orphan_seal_claimed',
  });
  if (!claimRecord.success) return { ok: false, code: 'recovery_claim_path_invalid' };
  const bytes = `${stableJsonStringify(claimRecord.data)}\n`;
  const firstCreate = await createRecoveryClaimFile({ path: claimPath, bytes, fs });
  if (firstCreate === 'created') {
    return {
      ok: true,
      claim: createRecoveryClaimLease({
        path: claimPath,
        runId: input.marker.runId,
        ownerToken,
        bytes,
        fs,
      }),
    };
  }
  if (firstCreate === 'path_invalid') {
    return { ok: false, code: 'recovery_claim_path_invalid' };
  }
  if (firstCreate === 'io_failed') {
    return { ok: false, code: 'recovery_claim_io_failed' };
  }

  const existing = await readRecoveryClaimFile({
    path: claimPath,
    expectedRunId: input.marker.runId,
    fs,
  });
  if (!existing.ok) {
    return {
      ok: false,
      code:
        existing.code === 'path_invalid'
          ? 'recovery_claim_path_invalid'
          : 'recovery_claim_io_failed',
    };
  }
  if (isProcessAlive(existing.record.ownerProcessId, input.overrides?.processAlive)) {
    return { ok: false, code: 'live_attempt_in_progress' };
  }

  const staleId = (input.overrides?.temporaryId ?? randomUUID)();
  if (!/^[a-z0-9-]{1,96}$/i.test(staleId)) {
    return { ok: false, code: 'recovery_claim_path_invalid' };
  }
  const stalePath = `${claimPath}.stale-${process.pid}-${staleId}`;
  try {
    await fs.rename(claimPath, stalePath);
  } catch (error) {
    if (!isMissingError(error)) return { ok: false, code: 'recovery_claim_io_failed' };
  }
  const takeover = await createRecoveryClaimFile({ path: claimPath, bytes, fs });
  await fs.unlink(stalePath).catch(() => undefined);
  if (takeover === 'exists') return { ok: false, code: 'live_attempt_in_progress' };
  if (takeover === 'path_invalid') {
    return { ok: false, code: 'recovery_claim_path_invalid' };
  }
  if (takeover === 'io_failed') return { ok: false, code: 'recovery_claim_io_failed' };
  return {
    ok: true,
    claim: createRecoveryClaimLease({
      path: claimPath,
      runId: input.marker.runId,
      ownerToken,
      bytes,
      fs,
    }),
  };
}

export async function openPhase697V4JournalAppender(input: {
  root: string;
  journal: Readonly<Phase697V4ValidatedJournal>;
  claim: Phase697V4RecoveryClaim;
  overrides?: Phase697V4DurabilityFsOverrides;
}): Promise<
  | Readonly<{ ok: true; writer: Phase697V4JournalWriter }>
  | Readonly<{
      ok: false;
      code: 'journal_io_failed' | 'journal_path_invalid' | 'recovery_claim_lost';
    }>
> {
  const fs = resolveFs(input.overrides);
  const path = resolve(input.root, phase697V4JournalPath(input.journal.runId));
  if (input.claim.runId !== input.journal.runId || !(await input.claim.reserveAppender())) {
    return { ok: false, code: 'recovery_claim_lost' };
  }
  try {
    const stat = await fs.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { ok: false, code: 'journal_path_invalid' };
    }
    const handle = await fs.open(path, 'a', 0o600);
    return {
      ok: true,
      writer: createJournalWriter({
        path,
        handle,
        runId: input.journal.runId,
        sequence: input.journal.lastSequence,
        tailSha256: input.journal.tailSha256,
        beforeAppend: async () => {
          if (!(await input.claim.assertOwned())) {
            throw new Error('PHASE_6_9_7_V4_RECOVERY_CLAIM_LOST');
          }
        },
      }),
    };
  } catch {
    return { ok: false, code: 'journal_io_failed' };
  }
}

export async function readPhase697V4Marker(input: {
  root: string;
  overrides?: Phase697V4DurabilityFsOverrides;
}): Promise<
  | Readonly<{ ok: true; marker: Phase697V4Marker; markerSha256: string; markerPath: string }>
  | Readonly<{
      ok: false;
      code:
        | 'marker_missing'
        | 'marker_read_failed'
        | 'marker_contract_invalid'
        | 'marker_path_invalid';
    }>
> {
  const fs = resolveFs(input.overrides);
  const markerPath = resolve(input.root, PHASE_6_9_7_V4_MARKER_PATH);
  try {
    const stat = await fs.lstat(markerPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { ok: false, code: 'marker_path_invalid' };
    }
    const bytes = await fs.readFile(markerPath, 'utf8');
    if (!bytes.endsWith('\n')) return { ok: false, code: 'marker_contract_invalid' };
    const marker = PHASE_6_9_7_V4_MARKER_SCHEMA.safeParse(JSON.parse(bytes) as unknown);
    return marker.success
      ? { ok: true, marker: marker.data, markerSha256: sha256Bytes(bytes), markerPath }
      : { ok: false, code: 'marker_contract_invalid' };
  } catch (error) {
    return isMissingError(error)
      ? { ok: false, code: 'marker_missing' }
      : { ok: false, code: 'marker_read_failed' };
  }
}

export async function readPhase697V4Journal(input: {
  root: string;
  runId: string;
  overrides?: Phase697V4DurabilityFsOverrides;
}): Promise<
  | Readonly<{ ok: true; journal: Phase697V4ValidatedJournal; journalPath: string }>
  | Readonly<{
      ok: false;
      code:
        | 'journal_missing'
        | 'journal_read_failed'
        | 'journal_contract_invalid'
        | 'journal_path_invalid';
    }>
> {
  const fs = resolveFs(input.overrides);
  const journalPath = resolve(input.root, phase697V4JournalPath(input.runId));
  try {
    const stat = await fs.lstat(journalPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { ok: false, code: 'journal_path_invalid' };
    }
    const text = await fs.readFile(journalPath, 'utf8');
    const journal = parseAndValidatePhase697V4Journal(text);
    return journal
      ? { ok: true, journal, journalPath }
      : { ok: false, code: 'journal_contract_invalid' };
  } catch (error) {
    return isMissingError(error)
      ? { ok: false, code: 'journal_missing' }
      : { ok: false, code: 'journal_read_failed' };
  }
}

export async function publishPhase697V4Evidence(input: {
  root: string;
  evidencePath: string;
  envelope: Readonly<Phase697V4EvidenceEnvelope>;
  overrides?: Phase697V4DurabilityFsOverrides;
}): Promise<
  | Readonly<{ ok: true; evidenceSha256: string; disposition: 'published' | 'same_bytes' }>
  | Readonly<{
      ok: false;
      code:
        | 'evidence_contract_invalid'
        | 'evidence_path_invalid'
        | 'evidence_target_conflict'
        | 'evidence_io_failed';
    }>
> {
  const validated = PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA.safeParse(input.envelope);
  if (!validated.success || hasSensitivePhase697Evidence(validated.data)) {
    return { ok: false, code: 'evidence_contract_invalid' };
  }
  const fs = resolveFs(input.overrides);
  const expectedEvidencePath = phase697V4EvidencePath({
    runScope: validated.data.runScope,
    mode: validated.data.mode,
    runId: validated.data.runId,
  });
  if (input.evidencePath.replaceAll('\\', '/') !== expectedEvidencePath) {
    return { ok: false, code: 'evidence_path_invalid' };
  }
  const absolutePath = resolve(input.root, expectedEvidencePath);
  const parentReady = await ensurePlainDirectory(dirname(absolutePath), fs);
  if (!parentReady) return { ok: false, code: 'evidence_path_invalid' };
  const bytes = `${JSON.stringify(validated.data, null, 2)}\n`;
  const evidenceSha256 = sha256Bytes(bytes);
  const temporaryId = (input.overrides?.temporaryId ?? randomUUID)();
  if (!/^[a-z0-9-]{1,96}$/i.test(temporaryId)) {
    return { ok: false, code: 'evidence_path_invalid' };
  }
  const temporaryPath = `${absolutePath}.tmp-${process.pid}-${temporaryId}`;
  let handle: FileHandle | null = null;
  try {
    handle = await fs.open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
  } catch {
    await handle?.close().catch(() => undefined);
    return { ok: false, code: 'evidence_io_failed' };
  }
  try {
    await fs.link(temporaryPath, absolutePath);
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      await fs.unlink(temporaryPath).catch(() => undefined);
      return { ok: false, code: 'evidence_io_failed' };
    }
    try {
      const stat = await fs.lstat(absolutePath);
      const existing =
        stat.isFile() && !stat.isSymbolicLink() ? await fs.readFile(absolutePath, 'utf8') : null;
      await fs.unlink(temporaryPath).catch(() => undefined);
      return existing === bytes
        ? { ok: true, evidenceSha256, disposition: 'same_bytes' }
        : { ok: false, code: 'evidence_target_conflict' };
    } catch {
      await fs.unlink(temporaryPath).catch(() => undefined);
      return { ok: false, code: 'evidence_io_failed' };
    }
  }
  await fs.unlink(temporaryPath).catch(() => undefined);
  return { ok: true, evidenceSha256, disposition: 'published' };
}

export async function readPhase697V4EvidenceBytes(input: {
  path: string;
  overrides?: Phase697V4DurabilityFsOverrides;
}): Promise<
  | Readonly<{
      ok: true;
      bytes: string;
      evidenceSha256: string;
      envelope: Phase697V4EvidenceEnvelope;
    }>
  | Readonly<{
      ok: false;
      code: 'evidence_read_failed' | 'evidence_path_invalid' | 'evidence_contract_invalid';
    }>
> {
  const fs = resolveFs(input.overrides);
  try {
    const stat = await fs.lstat(input.path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { ok: false, code: 'evidence_path_invalid' };
    }
    const bytes = await fs.readFile(input.path, 'utf8');
    const parsed = PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA.safeParse(JSON.parse(bytes) as unknown);
    return parsed.success && !hasSensitivePhase697Evidence(parsed.data)
      ? { ok: true, bytes, evidenceSha256: sha256Bytes(bytes), envelope: parsed.data }
      : { ok: false, code: 'evidence_contract_invalid' };
  } catch {
    return { ok: false, code: 'evidence_read_failed' };
  }
}

function createJournalWriter(input: {
  path: string;
  handle: FileHandle;
  runId: string;
  sequence: number;
  tailSha256: string;
  beforeAppend?: () => Promise<void>;
}): Phase697V4JournalWriter {
  let sequence = input.sequence;
  let tailSha256 = input.tailSha256;
  let accepting = true;
  let closed = false;
  let failed = false;
  let queue: Promise<void> = Promise.resolve();

  const append = (payload: Phase697V4JournalPayload): Promise<Phase697V4JournalRecord> => {
    if (!accepting || closed) {
      return Promise.reject(new Error('PHASE_6_9_7_V4_JOURNAL_UNAVAILABLE'));
    }
    let result: Phase697V4JournalRecord | null = null;
    const operation = queue.then(async () => {
      if (failed) throw new Error('PHASE_6_9_7_V4_JOURNAL_UNAVAILABLE');
      await input.beforeAppend?.();
      result = buildPhase697V4JournalRecord({
        runId: input.runId,
        sequence: sequence + 1,
        previousRecordSha256: tailSha256,
        payload,
      });
      assertSafeJournalRecord(result);
      try {
        await input.handle.writeFile(`${stableJsonStringify(result)}\n`, 'utf8');
        await input.handle.sync();
      } catch (error) {
        failed = true;
        throw error;
      }
      sequence = result.sequence;
      tailSha256 = result.recordSha256;
    });
    queue = operation.catch(() => undefined);
    return operation.then(() => result!);
  };

  return Object.freeze({
    path: input.path,
    append,
    async snapshot() {
      await queue;
      if (failed) throw new Error('PHASE_6_9_7_V4_JOURNAL_FAILED');
      return Object.freeze({ tailSha256, lastSequence: sequence });
    },
    async close() {
      if (closed) return;
      accepting = false;
      await queue;
      await input.handle.close();
      closed = true;
    },
  });
}

function assertSafeJournalRecord(record: Phase697V4JournalRecord): void {
  if (
    !PHASE_6_9_7_V4_JOURNAL_RECORD_SCHEMA.safeParse(record).success ||
    hasSensitivePhase697Evidence(record)
  ) {
    throw new Error('PHASE_6_9_7_V4_JOURNAL_CONTRACT_INVALID');
  }
}

type Phase697V4ResolvedFs = ReturnType<typeof resolveFs>;

async function createRecoveryClaimFile(input: {
  path: string;
  bytes: string;
  fs: Phase697V4ResolvedFs;
}): Promise<'created' | 'exists' | 'path_invalid' | 'io_failed'> {
  let handle: FileHandle | null = null;
  try {
    handle = await input.fs.open(input.path, 'wx', 0o600);
    await handle.writeFile(input.bytes, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    return 'created';
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (!isAlreadyExistsError(error)) return 'io_failed';
    try {
      const stat = await input.fs.lstat(input.path);
      return stat.isFile() && !stat.isSymbolicLink() ? 'exists' : 'path_invalid';
    } catch {
      return 'io_failed';
    }
  }
}

async function readRecoveryClaimFile(input: {
  path: string;
  expectedRunId: string;
  fs: Phase697V4ResolvedFs;
}): Promise<
  | Readonly<{
      ok: true;
      bytes: string;
      record: Phase697V4RecoveryClaimRecord;
    }>
  | Readonly<{ ok: false; code: 'path_invalid' | 'io_failed' }>
> {
  try {
    const stat = await input.fs.lstat(input.path);
    if (!stat.isFile() || stat.isSymbolicLink()) return { ok: false, code: 'path_invalid' };
    const bytes = await input.fs.readFile(input.path, 'utf8');
    if (!bytes.endsWith('\n')) return { ok: false, code: 'path_invalid' };
    const parsed = PHASE_6_9_7_V4_RECOVERY_CLAIM_SCHEMA.safeParse(JSON.parse(bytes) as unknown);
    return parsed.success && parsed.data.runId === input.expectedRunId
      ? { ok: true, bytes, record: parsed.data }
      : { ok: false, code: 'path_invalid' };
  } catch {
    return { ok: false, code: 'io_failed' };
  }
}

function createRecoveryClaimLease(input: {
  path: string;
  runId: string;
  ownerToken: string;
  bytes: string;
  fs: Phase697V4ResolvedFs;
}): Phase697V4RecoveryClaim {
  let released = false;
  let appenderReserved = false;
  const assertOwned = async () => {
    if (released) return false;
    const current = await readRecoveryClaimFile({
      path: input.path,
      expectedRunId: input.runId,
      fs: input.fs,
    });
    return current.ok && current.bytes === input.bytes;
  };
  return Object.freeze({
    path: input.path,
    runId: input.runId,
    ownerToken: input.ownerToken,
    assertOwned,
    async reserveAppender() {
      if (appenderReserved) return false;
      appenderReserved = true;
      if (await assertOwned()) return true;
      appenderReserved = false;
      return false;
    },
    async release() {
      if (released) return;
      // A stale lease must not rename the canonical path after another owner
      // has taken over. In production a live owner cannot be taken over, but
      // this preflight also fences delayed cleanup and false-liveness races.
      if (!(await assertOwned())) {
        throw new Error('PHASE_6_9_7_V4_RECOVERY_CLAIM_LOST');
      }
      const releasePath = `${input.path}.release-${input.ownerToken}`;
      try {
        await input.fs.rename(input.path, releasePath);
      } catch {
        throw new Error('PHASE_6_9_7_V4_RECOVERY_CLAIM_LOST');
      }
      const moved = await readRecoveryClaimFile({
        path: releasePath,
        expectedRunId: input.runId,
        fs: input.fs,
      });
      if (moved.ok && moved.bytes === input.bytes) {
        released = true;
        await input.fs.unlink(releasePath).catch(() => undefined);
        return;
      }
      try {
        await input.fs.link(releasePath, input.path);
        await input.fs.unlink(releasePath).catch(() => undefined);
      } catch {
        // A newer owner may already hold the canonical path. Preserve the
        // displaced file as an orphan instead of deleting that newer claim.
      }
      throw new Error('PHASE_6_9_7_V4_RECOVERY_CLAIM_LOST');
    },
  });
}

function isProcessAlive(processId: number, override?: (processId: number) => boolean): boolean {
  try {
    if (override) return override(processId);
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return !(
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'ESRCH'
    );
  }
}

async function ensurePlainDirectory(
  path: string,
  fs: ReturnType<typeof resolveFs>,
): Promise<boolean> {
  try {
    await fs.mkdir(path, { recursive: true });
    const stat = await fs.lstat(path);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function resolveFs(overrides: Phase697V4DurabilityFsOverrides | undefined) {
  return {
    open: overrides?.open ?? fsOpen,
    mkdir: overrides?.mkdir ?? fsMkdir,
    lstat: overrides?.lstat ?? fsLstat,
    link: overrides?.link ?? fsLink,
    rename: overrides?.rename ?? fsRename,
    unlink: overrides?.unlink ?? fsUnlink,
    readFile: overrides?.readFile ?? fsReadFile,
  };
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'EEXIST'
  );
}

function isMissingError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT'
  );
}
