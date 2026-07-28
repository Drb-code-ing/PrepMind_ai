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
  PHASE_6_9_7_V8_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V8_JOURNAL_RECORD_SCHEMA,
  PHASE_6_9_7_V8_MARKER_PATH,
  PHASE_6_9_7_V8_MARKER_SCHEMA,
  PHASE_6_9_7_V8_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_V8_RECOVERY_CLAIM_VERSION,
  buildPhase697V8JournalRecord,
  parseAndValidatePhase697V8Journal,
  phase697V8EvidencePath,
  phase697V8JournalPath,
  phase697V8RecoveryClaimPath,
  sha256Phase697V8Bytes,
  stablePhase697V8JsonStringify,
  type Phase697V8EvidenceEnvelope,
  type Phase697V8JournalPayload,
  type Phase697V8JournalRecord,
  type Phase697V8Marker,
  type Phase697V8RecoveryClaimRecord,
  type Phase697V8ValidatedJournal,
} from '../src/evals/phase-6-9-tutor-wrong-question-v8-durability-contract.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';

export type Phase697V8DurabilityFsOverrides = Readonly<
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

export type Phase697V8JournalWriter = Readonly<{
  path: string;
  append(payload: Phase697V8JournalPayload): Promise<Phase697V8JournalRecord>;
  snapshot(): Promise<Readonly<{ tailSha256: string; lastSequence: number }>>;
  close(): Promise<void>;
}>;

export type Phase697V8RecoveryClaim = Readonly<{
  path: string;
  runId: string;
  ownerToken: string;
  assertOwned(): Promise<boolean>;
  reserveAppender(): Promise<boolean>;
  release(): Promise<void>;
}>;

export type Phase697V8RecoveryClaimResult =
  | Readonly<{ ok: true; claim: Phase697V8RecoveryClaim }>
  | Readonly<{
      ok: false;
      code: 'live_attempt_in_progress' | 'recovery_claim_io_failed' | 'recovery_claim_path_invalid';
    }>;

export type Phase697V8MarkerReservationResult =
  | Readonly<{
      ok: true;
      marker: Phase697V8Marker;
      markerSha256: string;
      markerPath: string;
    }>
  | Readonly<{
      ok: false;
      code: 'live_already_attempted' | 'marker_io_failed' | 'marker_path_invalid';
    }>;

export async function reservePhase697V8Marker(input: {
  root: string;
  marker: Readonly<Phase697V8Marker>;
  overrides?: Phase697V8DurabilityFsOverrides;
}): Promise<Phase697V8MarkerReservationResult> {
  const fs = resolveFs(input.overrides);
  const markerPath = resolve(input.root, PHASE_6_9_7_V8_MARKER_PATH);
  if (!(await ensurePlainDirectory(dirname(markerPath), fs))) {
    return { ok: false, code: 'marker_path_invalid' };
  }
  const bytes = `${stablePhase697V8JsonStringify(input.marker)}\n`;
  let handle: FileHandle | null = null;
  try {
    handle = await fs.open(markerPath, 'wx', 0o600);
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    return {
      ok: true,
      marker: PHASE_6_9_7_V8_MARKER_SCHEMA.parse(input.marker),
      markerSha256: sha256Phase697V8Bytes(bytes),
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

export async function createPhase697V8Journal(input: {
  root: string;
  marker: Readonly<Phase697V8Marker>;
  markerSha256: string;
  overrides?: Phase697V8DurabilityFsOverrides;
}): Promise<
  | Readonly<{ ok: true; writer: Phase697V8JournalWriter; journalPath: string }>
  | Readonly<{
      ok: false;
      code: 'journal_already_exists' | 'journal_io_failed' | 'journal_path_invalid';
    }>
> {
  const fs = resolveFs(input.overrides);
  const journalPath = resolve(input.root, phase697V8JournalPath(input.marker.runId));
  if (!(await ensurePlainDirectory(dirname(journalPath), fs))) {
    return { ok: false, code: 'journal_path_invalid' };
  }
  let handle: FileHandle | null = null;
  try {
    handle = await fs.open(journalPath, 'ax', 0o600);
    const initial = buildPhase697V8JournalRecord({
      runId: input.marker.runId,
      sequence: 0,
      previousRecordSha256: null,
      payload: {
        kind: 'journal_initialized',
        markerSha256: input.markerSha256,
        runScope: input.marker.runScope,
        mode: 'live',
        sourceManifestSha256: input.marker.sourceManifestSha256,
        evalPolicySha256: input.marker.evalPolicySha256,
        wireDiagnosticsVersion: 'phase-6.9.7-v7-wire-diagnostics-v1',
      },
    });
    assertSafeJournalRecord(initial);
    await handle.writeFile(`${stablePhase697V8JsonStringify(initial)}\n`, 'utf8');
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
    return { ok: false, code: 'journal_io_failed' };
  }
}

export async function acquirePhase697V8RecoveryClaim(input: {
  root: string;
  marker: Readonly<Phase697V8Marker>;
  markerSha256: string;
  journalTailSha256: string | null;
  overrides?: Phase697V8DurabilityFsOverrides;
}): Promise<Phase697V8RecoveryClaimResult> {
  const fs = resolveFs(input.overrides);
  if (isProcessAlive(input.marker.ownerProcessId, input.overrides?.processAlive)) {
    return { ok: false, code: 'live_attempt_in_progress' };
  }
  const claimPath = resolve(input.root, phase697V8RecoveryClaimPath(input.marker.runId));
  if (!(await ensurePlainDirectory(dirname(claimPath), fs))) {
    return { ok: false, code: 'recovery_claim_path_invalid' };
  }
  const ownerToken = (input.overrides?.claimToken ?? randomUUID)();
  const record = PHASE_6_9_7_V8_RECOVERY_CLAIM_SCHEMA.safeParse({
    claimVersion: PHASE_6_9_7_V8_RECOVERY_CLAIM_VERSION,
    runnerVersion: input.marker.runnerVersion,
    runId: input.marker.runId,
    ownerProcessId: process.pid,
    ownerToken,
    markerSha256: input.markerSha256,
    journalTailSha256: input.journalTailSha256,
    state: 'orphan_seal_claimed',
  });
  if (!record.success) return { ok: false, code: 'recovery_claim_path_invalid' };
  const bytes = `${stablePhase697V8JsonStringify(record.data)}\n`;
  const firstCreate = await createRecoveryClaimFile({ path: claimPath, bytes, fs });
  if (firstCreate === 'created') {
    const claim = await createRecoveryClaimLease({
      path: claimPath,
      runId: input.marker.runId,
      ownerToken,
      bytes,
      fs,
    });
    return claim ? { ok: true, claim } : { ok: false, code: 'recovery_claim_io_failed' };
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
  const claim = await createRecoveryClaimLease({
    path: claimPath,
    runId: input.marker.runId,
    ownerToken,
    bytes,
    fs,
  });
  return claim ? { ok: true, claim } : { ok: false, code: 'recovery_claim_io_failed' };
}

export async function openPhase697V8JournalAppender(input: {
  root: string;
  journal: Readonly<Phase697V8ValidatedJournal>;
  claim: Phase697V8RecoveryClaim;
  overrides?: Phase697V8DurabilityFsOverrides;
}): Promise<
  | Readonly<{ ok: true; writer: Phase697V8JournalWriter }>
  | Readonly<{
      ok: false;
      code:
        'journal_io_failed' | 'journal_path_invalid' | 'journal_tail_drift' | 'recovery_claim_lost';
    }>
> {
  const fs = resolveFs(input.overrides);
  const path = resolve(input.root, phase697V8JournalPath(input.journal.runId));
  if (input.claim.runId !== input.journal.runId || !(await input.claim.reserveAppender())) {
    return { ok: false, code: 'recovery_claim_lost' };
  }
  const preflight = await verifyJournalTail(path, input.journal, fs);
  if (preflight !== 'match') return journalTailFailure(preflight);
  let handle: FileHandle | null = null;
  try {
    const stat = await fs.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { ok: false, code: 'journal_path_invalid' };
    }
    handle = await fs.open(path, 'a', 0o600);
    const [handleStat, pathStat] = await Promise.all([handle.stat(), fs.lstat(path)]);
    if (
      !pathStat.isFile() ||
      pathStat.isSymbolicLink() ||
      handleStat.dev !== pathStat.dev ||
      handleStat.ino !== pathStat.ino
    ) {
      await handle.close().catch(() => undefined);
      return { ok: false, code: 'journal_path_invalid' };
    }
    const openedTail = await verifyJournalTail(path, input.journal, fs);
    if (openedTail !== 'match') {
      await handle.close().catch(() => undefined);
      return journalTailFailure(openedTail);
    }
    return {
      ok: true,
      writer: createJournalWriter({
        path,
        handle,
        runId: input.journal.runId,
        sequence: input.journal.lastSequence,
        tailSha256: input.journal.tailSha256,
        beforeAppend: async (expected) => {
          if (!(await input.claim.assertOwned())) {
            throw new Error('PHASE_6_9_7_V8_RECOVERY_CLAIM_LOST');
          }
          const currentTail = await verifyJournalTail(path, expected, fs);
          if (currentTail !== 'match') {
            throw new Error('PHASE_6_9_7_V8_JOURNAL_TAIL_DRIFT');
          }
        },
      }),
    };
  } catch {
    await handle?.close().catch(() => undefined);
    return { ok: false, code: 'journal_io_failed' };
  }
}

export async function readPhase697V8Marker(input: {
  root: string;
  overrides?: Phase697V8DurabilityFsOverrides;
}): Promise<
  | Readonly<{
      ok: true;
      marker: Phase697V8Marker;
      markerSha256: string;
      markerPath: string;
    }>
  | Readonly<{
      ok: false;
      code:
        'marker_missing' | 'marker_read_failed' | 'marker_contract_invalid' | 'marker_path_invalid';
    }>
> {
  const fs = resolveFs(input.overrides);
  const markerPath = resolve(input.root, PHASE_6_9_7_V8_MARKER_PATH);
  try {
    const stat = await fs.lstat(markerPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { ok: false, code: 'marker_path_invalid' };
    }
    const bytes = await fs.readFile(markerPath, 'utf8');
    if (!bytes.endsWith('\n')) return { ok: false, code: 'marker_contract_invalid' };
    const marker = PHASE_6_9_7_V8_MARKER_SCHEMA.safeParse(JSON.parse(bytes) as unknown);
    return marker.success
      ? { ok: true, marker: marker.data, markerSha256: sha256Phase697V8Bytes(bytes), markerPath }
      : { ok: false, code: 'marker_contract_invalid' };
  } catch (error) {
    return isMissingError(error)
      ? { ok: false, code: 'marker_missing' }
      : { ok: false, code: 'marker_read_failed' };
  }
}

export async function readPhase697V8Journal(input: {
  root: string;
  runId: string;
  overrides?: Phase697V8DurabilityFsOverrides;
}): Promise<
  | Readonly<{ ok: true; journal: Phase697V8ValidatedJournal; journalPath: string }>
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
  const journalPath = resolve(input.root, phase697V8JournalPath(input.runId));
  try {
    const stat = await fs.lstat(journalPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { ok: false, code: 'journal_path_invalid' };
    }
    const text = await fs.readFile(journalPath, 'utf8');
    const journal = parseAndValidatePhase697V8Journal(text);
    return journal
      ? { ok: true, journal, journalPath }
      : { ok: false, code: 'journal_contract_invalid' };
  } catch (error) {
    return isMissingError(error)
      ? { ok: false, code: 'journal_missing' }
      : { ok: false, code: 'journal_read_failed' };
  }
}

export async function publishPhase697V8Evidence(input: {
  root: string;
  evidencePath: string;
  envelope: Readonly<Phase697V8EvidenceEnvelope>;
  overrides?: Phase697V8DurabilityFsOverrides;
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
  const validated = PHASE_6_9_7_V8_EVIDENCE_ENVELOPE_SCHEMA.safeParse(input.envelope);
  if (!validated.success || hasSensitivePhase697Evidence(validated.data)) {
    return { ok: false, code: 'evidence_contract_invalid' };
  }
  const fs = resolveFs(input.overrides);
  const expectedPath = phase697V8EvidencePath({
    runScope: validated.data.runScope,
    mode: validated.data.mode,
    runId: validated.data.runId,
  });
  if (input.evidencePath.replaceAll('\\', '/') !== expectedPath) {
    return { ok: false, code: 'evidence_path_invalid' };
  }
  const absolutePath = resolve(input.root, expectedPath);
  if (!(await ensurePlainDirectory(dirname(absolutePath), fs))) {
    return { ok: false, code: 'evidence_path_invalid' };
  }
  const bytes = `${JSON.stringify(validated.data, null, 2)}\n`;
  const evidenceSha256 = sha256Phase697V8Bytes(bytes);
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

export async function readPhase697V8EvidenceBytes(input: {
  path: string;
  overrides?: Phase697V8DurabilityFsOverrides;
}): Promise<
  | Readonly<{
      ok: true;
      bytes: string;
      evidenceSha256: string;
      envelope: Phase697V8EvidenceEnvelope;
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
    const parsed = PHASE_6_9_7_V8_EVIDENCE_ENVELOPE_SCHEMA.safeParse(JSON.parse(bytes) as unknown);
    return parsed.success && !hasSensitivePhase697Evidence(parsed.data)
      ? { ok: true, bytes, evidenceSha256: sha256Phase697V8Bytes(bytes), envelope: parsed.data }
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
  beforeAppend?: (
    expected: Readonly<{ tailSha256: string; lastSequence: number }>,
  ) => Promise<void>;
}): Phase697V8JournalWriter {
  let sequence = input.sequence;
  let tailSha256 = input.tailSha256;
  let accepting = true;
  let closed = false;
  let failed = false;
  let queue: Promise<void> = Promise.resolve();
  const append = (payload: Phase697V8JournalPayload): Promise<Phase697V8JournalRecord> => {
    if (!accepting || closed) {
      return Promise.reject(new Error('PHASE_6_9_7_V8_JOURNAL_UNAVAILABLE'));
    }
    let result: Phase697V8JournalRecord | null = null;
    const operation = queue.then(async () => {
      if (failed) throw new Error('PHASE_6_9_7_V8_JOURNAL_UNAVAILABLE');
      await input.beforeAppend?.({ tailSha256, lastSequence: sequence });
      result = buildPhase697V8JournalRecord({
        runId: input.runId,
        sequence: sequence + 1,
        previousRecordSha256: tailSha256,
        payload,
      });
      assertSafeJournalRecord(result);
      try {
        await input.handle.writeFile(`${stablePhase697V8JsonStringify(result)}\n`, 'utf8');
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
      if (failed) throw new Error('PHASE_6_9_7_V8_JOURNAL_FAILED');
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

function assertSafeJournalRecord(record: Phase697V8JournalRecord): void {
  if (
    !PHASE_6_9_7_V8_JOURNAL_RECORD_SCHEMA.safeParse(record).success ||
    hasSensitivePhase697Evidence(record)
  ) {
    throw new Error('PHASE_6_9_7_V8_JOURNAL_CONTRACT_INVALID');
  }
}

type ResolvedFs = ReturnType<typeof resolveFs>;

async function createRecoveryClaimFile(input: {
  path: string;
  bytes: string;
  fs: ResolvedFs;
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
  fs: ResolvedFs;
}): Promise<
  | Readonly<{ ok: true; bytes: string; record: Phase697V8RecoveryClaimRecord }>
  | Readonly<{ ok: false; code: 'path_invalid' | 'io_failed' }>
> {
  try {
    const stat = await input.fs.lstat(input.path);
    if (!stat.isFile() || stat.isSymbolicLink()) return { ok: false, code: 'path_invalid' };
    const bytes = await input.fs.readFile(input.path, 'utf8');
    if (!bytes.endsWith('\n')) return { ok: false, code: 'path_invalid' };
    const parsed = PHASE_6_9_7_V8_RECOVERY_CLAIM_SCHEMA.safeParse(JSON.parse(bytes) as unknown);
    return parsed.success && parsed.data.runId === input.expectedRunId
      ? { ok: true, bytes, record: parsed.data }
      : { ok: false, code: 'path_invalid' };
  } catch {
    return { ok: false, code: 'io_failed' };
  }
}

async function createRecoveryClaimLease(input: {
  path: string;
  runId: string;
  ownerToken: string;
  bytes: string;
  fs: ResolvedFs;
}): Promise<Phase697V8RecoveryClaim | null> {
  const fileIdentity = await readFileIdentity(input.path, input.fs);
  if (fileIdentity === null) return null;
  let released = false;
  let appenderReserved = false;
  const assertOwned = async () => {
    if (released) return false;
    const current = await readRecoveryClaimFile({
      path: input.path,
      expectedRunId: input.runId,
      fs: input.fs,
    });
    const currentIdentity = await readFileIdentity(input.path, input.fs);
    return (
      current.ok &&
      current.bytes === input.bytes &&
      currentIdentity !== null &&
      currentIdentity === fileIdentity
    );
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
      if (released || !(await assertOwned())) {
        throw new Error('PHASE_6_9_7_V8_RECOVERY_CLAIM_LOST');
      }
      const releasePath = `${input.path}.release-${input.ownerToken}`;
      try {
        await input.fs.rename(input.path, releasePath);
      } catch {
        throw new Error('PHASE_6_9_7_V8_RECOVERY_CLAIM_LOST');
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
        // Preserve a displaced stale file without touching a newer owner.
      }
      throw new Error('PHASE_6_9_7_V8_RECOVERY_CLAIM_LOST');
    },
  });
}

async function readFileIdentity(path: string, fs: ResolvedFs): Promise<string | null> {
  try {
    const stat = await fs.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    return JSON.stringify([
      stat.dev,
      stat.ino,
      stat.birthtimeMs,
      stat.ctimeMs,
      stat.mtimeMs,
      stat.size,
    ]);
  } catch {
    return null;
  }
}

async function verifyJournalTail(
  path: string,
  expected: Readonly<{ tailSha256: string; lastSequence: number }>,
  fs: ResolvedFs,
): Promise<'match' | 'drift' | 'path_invalid' | 'io_failed'> {
  try {
    const stat = await fs.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) return 'path_invalid';
    const text = await fs.readFile(path, 'utf8');
    const journal = parseAndValidatePhase697V8Journal(text);
    if (journal === null) return 'drift';
    return journal.tailSha256 === expected.tailSha256 &&
      journal.lastSequence === expected.lastSequence
      ? 'match'
      : 'drift';
  } catch (error) {
    return isMissingError(error) ? 'path_invalid' : 'io_failed';
  }
}

function journalTailFailure(
  failure: Exclude<Awaited<ReturnType<typeof verifyJournalTail>>, 'match'>,
): Readonly<{
  ok: false;
  code: 'journal_io_failed' | 'journal_path_invalid' | 'journal_tail_drift';
}> {
  if (failure === 'path_invalid') return { ok: false, code: 'journal_path_invalid' };
  if (failure === 'io_failed') return { ok: false, code: 'journal_io_failed' };
  return { ok: false, code: 'journal_tail_drift' };
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

async function ensurePlainDirectory(path: string, fs: ResolvedFs): Promise<boolean> {
  try {
    await fs.mkdir(path, { recursive: true });
    const stat = await fs.lstat(path);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function resolveFs(overrides: Phase697V8DurabilityFsOverrides | undefined) {
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
