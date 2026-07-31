import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_RELATIVE_PATH,
  validatePhase697SmallSampleBaselineFile,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-baseline.ts';

export type Phase697SmallSampleBaselineWriteResult = Readonly<{
  disposition: 'created' | 'same_bytes';
  relativePath: typeof PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_RELATIVE_PATH;
  reportLogicalSha256: string;
  physicalFileSha256: string;
}>;

type Phase697SmallSampleBaselineStat = Readonly<{
  dev: number | bigint;
  ino: number | bigint;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}>;

export type Phase697SmallSampleBaselineHandle = Readonly<{
  stat(): Promise<Phase697SmallSampleBaselineStat>;
  readFile(): Promise<Uint8Array>;
  writeFile(contents: string): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}>;

export type Phase697SmallSampleBaselineFileSystem = Readonly<{
  realpath(path: string): Promise<string>;
  mkdir(path: string): Promise<void>;
  lstat(path: string): Promise<Phase697SmallSampleBaselineStat>;
  openExclusive(path: string): Promise<Phase697SmallSampleBaselineHandle>;
  openReadOnly(path: string): Promise<Phase697SmallSampleBaselineHandle>;
}>;

export async function writePhase697SmallSampleBaseline(
  root: string,
  options: Readonly<{ fs?: Phase697SmallSampleBaselineFileSystem }> = {},
): Promise<Phase697SmallSampleBaselineWriteResult> {
  const fs = options.fs ?? nodeFs;
  const canonicalRoot = await fs.realpath(resolve(root));
  const absolutePath = resolve(canonicalRoot, PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_RELATIVE_PATH);
  assertContained(canonicalRoot, absolutePath);
  const parent = dirname(absolutePath);
  await fs.mkdir(parent);
  await assertValidParent(canonicalRoot, parent, fs);

  let handle: Phase697SmallSampleBaselineHandle;
  try {
    handle = await fs.openExclusive(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    return readExistingBaseline(canonicalRoot, parent, absolutePath, fs);
  }

  try {
    await assertOpenedFileIdentity(canonicalRoot, parent, absolutePath, handle, fs);
    const validation = validatePhase697SmallSampleBaselineFile(
      PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES,
    );
    if (!validation.ok) {
      throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_INTERNAL_VALIDATION_FAILED');
    }
    await handle.writeFile(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES);
    await handle.sync();
    await assertOpenedFileIdentity(canonicalRoot, parent, absolutePath, handle, fs);
    return freezeResult('created', validation);
  } finally {
    await handle.close();
  }
}

async function readExistingBaseline(
  canonicalRoot: string,
  parent: string,
  absolutePath: string,
  fs: Phase697SmallSampleBaselineFileSystem,
): Promise<Phase697SmallSampleBaselineWriteResult> {
  let handle: Phase697SmallSampleBaselineHandle;
  try {
    handle = await fs.openReadOnly(absolutePath);
  } catch {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_EXISTING_PATH_INVALID');
  }
  try {
    await assertOpenedFileIdentity(canonicalRoot, parent, absolutePath, handle, fs);
    const validation = validatePhase697SmallSampleBaselineFile(await handle.readFile());
    if (!validation.ok) {
      throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_CONFLICT');
    }
    await assertOpenedFileIdentity(canonicalRoot, parent, absolutePath, handle, fs);
    return freezeResult('same_bytes', validation);
  } finally {
    await handle.close();
  }
}

function freezeResult(
  disposition: Phase697SmallSampleBaselineWriteResult['disposition'],
  validation: Readonly<{
    ok: true;
    reportLogicalSha256: string;
    physicalFileSha256: string;
  }>,
): Phase697SmallSampleBaselineWriteResult {
  return Object.freeze({
    disposition,
    relativePath: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_RELATIVE_PATH,
    reportLogicalSha256: validation.reportLogicalSha256,
    physicalFileSha256: validation.physicalFileSha256,
  });
}

async function assertValidParent(
  canonicalRoot: string,
  parent: string,
  fs: Phase697SmallSampleBaselineFileSystem,
) {
  const [parentStat, parentRealpath] = await Promise.all([fs.lstat(parent), fs.realpath(parent)]);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_PARENT_INVALID');
  }
  assertContained(canonicalRoot, parentRealpath);
  if (parentRealpath !== parent) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_PARENT_OUTSIDE_ROOT');
  }
}

async function assertOpenedFileIdentity(
  canonicalRoot: string,
  parent: string,
  absolutePath: string,
  handle: Phase697SmallSampleBaselineHandle,
  fs: Phase697SmallSampleBaselineFileSystem,
) {
  const [parentStat, parentRealpath, handleStat, pathStat, pathRealpath] = await Promise.all([
    fs.lstat(parent),
    fs.realpath(parent),
    handle.stat(),
    fs.lstat(absolutePath),
    fs.realpath(absolutePath),
  ]);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || parentRealpath !== parent) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_PARENT_CHANGED');
  }
  assertContained(canonicalRoot, parentRealpath);
  assertContained(canonicalRoot, pathRealpath);
  if (
    dirname(pathRealpath) !== parent ||
    !handleStat.isFile() ||
    handleStat.isSymbolicLink() ||
    !pathStat.isFile() ||
    pathStat.isSymbolicLink() ||
    handleStat.dev !== pathStat.dev ||
    handleStat.ino !== pathStat.ino
  ) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_PATH_IDENTITY_CHANGED');
  }
}

function assertContained(root: string, target: string) {
  const delta = relative(root, target);
  if (delta === '' || delta.startsWith('..') || resolve(root, delta) !== target) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_PATH_INVALID');
  }
}

const nodeFs: Phase697SmallSampleBaselineFileSystem = {
  realpath,
  async mkdir(path) {
    await mkdir(path, { recursive: true });
  },
  lstat,
  async openExclusive(path) {
    return wrapNodeHandle(await open(path, 'wx', 0o600));
  },
  async openReadOnly(path) {
    return wrapNodeHandle(await open(path, 'r'));
  },
};

function wrapNodeHandle(
  handle: Awaited<ReturnType<typeof open>>,
): Phase697SmallSampleBaselineHandle {
  return {
    stat: () => handle.stat(),
    readFile: () => handle.readFile(),
    async writeFile(contents) {
      await handle.writeFile(contents, 'utf8');
    },
    async sync() {
      await handle.sync();
    },
    async close() {
      await handle.close();
    },
  };
}

if (import.meta.main) {
  if (process.argv.length !== 2) {
    process.stderr.write('phase_6_9_7_small_sample_baseline_invalid_arguments\n');
    process.exitCode = 2;
  } else {
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    writePhase697SmallSampleBaseline(repositoryRoot)
      .then((result) => {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      })
      .catch(() => {
        process.stderr.write('phase_6_9_7_small_sample_baseline_failed\n');
        process.exitCode = 1;
      });
  }
}
