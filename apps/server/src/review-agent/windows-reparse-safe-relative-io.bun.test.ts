import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  symlink,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as windowsReparseSafeIo from './windows-reparse-safe-relative-io';

const { openWindowsNoReparseChildDirectory } = windowsReparseSafeIo;
type DurableFaultStage =
  | 'write'
  | 'flush'
  | 'close'
  | 'prepare_create'
  | 'prepare_write'
  | 'prepare_flush'
  | 'prepare_close'
  | 'prepare_reopen'
  | 'rename'
  | 'post_commit_cleanup'
  | 'volume_non_ntfs'
  | 'volume_non_disk_device'
  | 'volume_remote_characteristic'
  | 'volume_removable_characteristic';
type DurableFaultInjector = (stage: DurableFaultStage) => boolean;
type DurableFaultTestFacade = Readonly<{
  directory: windowsReparseSafeIo.WindowsNoReparseChildDirectory;
  cleanupInjectedHandles(): void;
}>;

function requireDurableFaultTestFactory() {
  const factory = (
    windowsReparseSafeIo as typeof windowsReparseSafeIo & {
      openWindowsNoReparseChildDirectoryForTests?: (
        root: string,
        childName: string,
        injector: DurableFaultInjector,
      ) => Promise<DurableFaultTestFacade>;
    }
  ).openWindowsNoReparseChildDirectoryForTests;
  expect(typeof factory).toBe('function');
  return factory!;
}

async function runPublicationHardExitChild(
  root: string,
  exitPhase: 'rename' | 'post_commit_cleanup',
  committedLeafName: string,
) {
  const moduleUrl = pathToFileURL(
    resolve('apps/server/src/review-agent/windows-reparse-safe-relative-io.ts'),
  ).href;
  const script = `
const io = await import(process.env.TEST_MODULE_URL);
const facade = await io.openWindowsNoReparseChildDirectoryForTests(
  process.env.TEST_ROOT,
  'docs',
  (phase) => {
    if (phase === process.env.TEST_EXIT_PHASE) process.exit(71);
    return false;
  },
);
facade.directory.commitExclusiveDurableFileViaRename(
  process.env.TEST_COMMITTED_LEAF,
  'child-value',
);
process.exit(72);
`;
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TEST_MODULE_URL: moduleUrl,
      TEST_ROOT: root,
      TEST_EXIT_PHASE: exitPhase,
      TEST_COMMITTED_LEAF: committedLeafName,
    },
    encoding: 'utf8',
  });
  return { exitCode: child.status, stderr: child.stderr ?? '' };
}

const describeWindows = process.platform === 'win32' ? describe : describe.skip;

describeWindows('Windows no-reparse relative evidence I/O', () => {
  let root = '';
  let outside = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-native-root-'));
    outside = await mkdtemp(
      join(tmpdir(), 'prepmind-phase-695-native-outside-'),
    );
    await mkdir(join(root, 'docs'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it('exposes local fixed NTFS preflight and handle-relative durable publication', async () => {
    const directory = await openWindowsNoReparseChildDirectory(root, 'docs');
    try {
      expect(typeof directory.assertLocalFixedNtfsVolume).toBe('function');
      expect(typeof directory.commitExclusiveDurableFileViaRename).toBe(
        'function',
      );
      directory.assertLocalFixedNtfsVolume();
      expect(
        directory.commitExclusiveDurableFileViaRename('published', 'value'),
      ).toEqual({ committed: true, cleanupStatus: 'closed' });
      expect(directory.readRegularFile('published')).toEqual(
        Buffer.from('value'),
      );
    } finally {
      directory.close();
    }
  });

  it('rejects unsafe prepare derivation and an existing public target', async () => {
    const directory = await openWindowsNoReparseChildDirectory(root, 'docs');
    try {
      expect(() =>
        directory.commitExclusiveDurableFileViaRename('../unsafe', 'x'),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_INVALID_NAME');
      expect(() =>
        directory.commitExclusiveDurableFileViaRename('owned.prepare', 'x'),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_INVALID_NAME');
      expect(() =>
        directory.commitExclusiveDurableFileViaRename('owned.PREPARE', 'x'),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_INVALID_NAME');
      expect(() =>
        directory.commitExclusiveDurableFileViaRename('a'.repeat(240), 'x'),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_INVALID_NAME');

      directory.createExclusiveFile('already-public', 'old');
      expect(() =>
        directory.commitExclusiveDurableFileViaRename('already-public', 'new'),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_ALREADY_EXISTS');
      expect(directory.readRegularFile('already-public')).toEqual(
        Buffer.from('old'),
      );
      expect(() => directory.readRegularFile('already-public.prepare')).toThrow(
        'WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED',
      );
    } finally {
      directory.close();
    }
  });

  it.each([
    'volume_non_ntfs',
    'volume_non_disk_device',
    'volume_remote_characteristic',
    'volume_removable_characteristic',
  ] as const)(
    'fails the local fixed NTFS preflight for injected %s',
    async (phase) => {
      const facade = await requireDurableFaultTestFactory()(
        root,
        'docs',
        (observed) => observed === phase,
      );
      try {
        expect(() => facade.directory.assertLocalFixedNtfsVolume()).toThrow(
          'WINDOWS_REPARSE_SAFE_IO_LOCAL_FIXED_NTFS_REQUIRED',
        );
      } finally {
        facade.cleanupInjectedHandles();
        facade.directory.close();
      }
    },
  );

  it.each([
    'prepare_create',
    'prepare_write',
    'prepare_flush',
    'prepare_close',
    'prepare_reopen',
    'rename',
  ] as const)(
    'retains only the private prepare leaf without retry when %s fails',
    async (failedStage) => {
      const calls: DurableFaultStage[] = [];
      const facade = await requireDurableFaultTestFactory()(
        root,
        'docs',
        (stage) => {
          calls.push(stage);
          return stage === failedStage;
        },
      );
      const { directory } = facade;
      try {
        expect(
          directory.commitExclusiveDurableFileViaRename(
            `publication-${failedStage}`,
            'private-value',
          ),
        ).toEqual({ committed: false, stage: failedStage });
        expect(calls.filter((stage) => stage === failedStage)).toHaveLength(1);

        facade.cleanupInjectedHandles();
        expect(() =>
          directory.readRegularFile(`publication-${failedStage}`),
        ).toThrow('WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED');
        if (failedStage === 'prepare_create') {
          expect(() =>
            directory.readRegularFile(`publication-${failedStage}.prepare`),
          ).toThrow('WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED');
        } else {
          expect(
            directory.readRegularFile(`publication-${failedStage}.prepare`),
          ).toEqual(
            failedStage === 'prepare_write'
              ? Buffer.alloc(0)
              : Buffer.from('private-value'),
          );
        }
      } finally {
        facade.cleanupInjectedHandles();
        directory.close();
      }
    },
  );

  it('treats rename as committed when post-commit cleanup close is unverified', async () => {
    const calls: DurableFaultStage[] = [];
    const facade = await requireDurableFaultTestFactory()(
      root,
      'docs',
      (stage) => {
        calls.push(stage);
        return stage === 'post_commit_cleanup';
      },
    );
    try {
      expect(
        facade.directory.commitExclusiveDurableFileViaRename(
          'committed-close-unverified',
          'public-value',
        ),
      ).toEqual({ committed: true, cleanupStatus: 'close_unverified' });
      expect(
        calls.filter((stage) => stage === 'post_commit_cleanup'),
      ).toHaveLength(1);
      facade.cleanupInjectedHandles();
      expect(
        facade.directory.readRegularFile('committed-close-unverified'),
      ).toEqual(Buffer.from('public-value'));
      expect(() =>
        facade.directory.readRegularFile('committed-close-unverified.prepare'),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED');
    } finally {
      facade.cleanupInjectedHandles();
      facade.directory.close();
    }
  });

  it('leaves only the private prepare leaf when a child hard-exits before rename', async () => {
    const child = await runPublicationHardExitChild(
      root,
      'rename',
      'child-before-rename',
    );
    expect(child).toEqual({ exitCode: 71, stderr: '' });

    const freshDirectory = await openWindowsNoReparseChildDirectory(
      root,
      'docs',
    );
    try {
      expect(() =>
        freshDirectory.readRegularFile('child-before-rename'),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED');
      expect(
        freshDirectory.readRegularFile('child-before-rename.prepare'),
      ).toEqual(Buffer.from('child-value'));
    } finally {
      freshDirectory.close();
    }
  });

  it('lets a fresh reader observe publication after a child hard-exits post-rename', async () => {
    const child = await runPublicationHardExitChild(
      root,
      'post_commit_cleanup',
      'child-after-rename',
    );
    expect(child).toEqual({ exitCode: 71, stderr: '' });

    const freshDirectory = await openWindowsNoReparseChildDirectory(
      root,
      'docs',
    );
    try {
      expect(freshDirectory.readRegularFile('child-after-rename')).toEqual(
        Buffer.from('child-value'),
      );
      expect(() =>
        freshDirectory.readRegularFile('child-after-rename.prepare'),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED');
    } finally {
      freshDirectory.close();
    }
  });

  it('durably creates an exclusive zero-byte file and rejects duplicates', async () => {
    const directory = await openWindowsNoReparseChildDirectory(root, 'docs');
    try {
      expect(typeof directory.createExclusiveDurableFile).toBe('function');
      directory.createExclusiveDurableFile('stage-010', '');
      expect(directory.readRegularFile('stage-010')).toEqual(Buffer.alloc(0));
      expect(() =>
        directory.createExclusiveDurableFile('stage-010', ''),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_ALREADY_EXISTS');
    } finally {
      directory.close();
    }
  });

  it('durably replaces a file through an exclusive temporary leaf', async () => {
    const directory = await openWindowsNoReparseChildDirectory(root, 'docs');
    try {
      expect(typeof directory.replaceDurableFile).toBe('function');
      directory.createExclusiveFile('terminal.json', 'old');
      directory.replaceDurableFile('terminal.json.tmp', 'terminal.json', 'new');
      expect(directory.readRegularFile('terminal.json')).toEqual(
        Buffer.from('new'),
      );
    } finally {
      directory.close();
    }
  });

  it.each([
    {
      failedStage: 'write' as const,
      expectedError: 'WINDOWS_REPARSE_SAFE_IO_WRITE_FAILED',
      expectedCalls: ['write', 'close'] as const,
      artifactMustBeAbsent: true,
    },
    {
      failedStage: 'flush' as const,
      expectedError: 'WINDOWS_REPARSE_SAFE_IO_FLUSH_FAILED',
      expectedCalls: ['write', 'flush', 'close'] as const,
      artifactMustBeAbsent: true,
    },
    {
      failedStage: 'close' as const,
      expectedError: 'WINDOWS_REPARSE_SAFE_IO_CLOSE_FAILED',
      expectedCalls: ['write', 'flush', 'close'] as const,
      artifactMustBeAbsent: false,
    },
  ])(
    'fails closed without retry or error leakage when durable $failedStage is denied',
    async ({
      failedStage,
      expectedError,
      expectedCalls,
      artifactMustBeAbsent,
    }) => {
      const calls: DurableFaultStage[] = [];
      const facade = await requireDurableFaultTestFactory()(
        root,
        'docs',
        (stage) => {
          calls.push(stage);
          return stage === failedStage;
        },
      );
      const { directory } = facade;
      const leafName = `private-${failedStage}-stage`;
      const contents = `private-${failedStage}-contents`;
      let continued = false;
      let failure: unknown;
      try {
        directory.createExclusiveDurableFile(leafName, contents);
        continued = true;
      } catch (error) {
        failure = error;
      }
      try {
        expect(failure).toEqual(new Error(expectedError));
        expect((failure as Error).message).not.toContain(leafName);
        expect((failure as Error).message).not.toContain(contents);
        expect(calls).toEqual(expectedCalls);
        expect(calls.filter((stage) => stage === failedStage)).toHaveLength(1);
        expect(continued).toBe(false);
        if (artifactMustBeAbsent) {
          expect(() => directory.readRegularFile(leafName)).toThrow(
            'WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED',
          );
        }
      } finally {
        facade.cleanupInjectedHandles();
        directory.close();
      }
    },
  );

  it('does not let one directory fault capability pollute a concurrent directory', async () => {
    const failingFacade = await requireDurableFaultTestFactory()(
      root,
      'docs',
      (stage) => stage === 'write',
    );
    const failingDirectory = failingFacade.directory;
    const successfulDirectory = await openWindowsNoReparseChildDirectory(
      root,
      'docs',
    );
    try {
      const results = await Promise.allSettled([
        Promise.resolve().then(() =>
          failingDirectory.createExclusiveDurableFile('isolated-failure', 'x'),
        ),
        Promise.resolve().then(() =>
          successfulDirectory.createExclusiveDurableFile(
            'isolated-success',
            'x',
          ),
        ),
      ]);

      expect(results.map((result) => result.status)).toEqual([
        'rejected',
        'fulfilled',
      ]);
      expect(successfulDirectory.readRegularFile('isolated-success')).toEqual(
        Buffer.from('x'),
      );
    } finally {
      failingFacade.cleanupInjectedHandles();
      failingDirectory.close();
      successfulDirectory.close();
    }
  });

  it('cleans up a test-only simulated CloseHandle failure without closing twice', async () => {
    const calls: DurableFaultStage[] = [];
    const facade = await requireDurableFaultTestFactory()(
      root,
      'docs',
      (stage) => {
        calls.push(stage);
        return stage === 'close';
      },
    );
    let directoryClosed = false;
    try {
      expect(() =>
        facade.directory.createExclusiveDurableFile('close-failure', 'x'),
      ).toThrow('WINDOWS_REPARSE_SAFE_IO_CLOSE_FAILED');
      expect(calls).toEqual(['write', 'flush', 'close']);

      facade.cleanupInjectedHandles();
      facade.cleanupInjectedHandles();
      facade.directory.close();
      directoryClosed = true;

      await rm(join(root, 'docs'), { recursive: true });
      await expect(lstat(join(root, 'docs'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      if (!directoryClosed) {
        facade.cleanupInjectedHandles();
        facade.directory.close();
      }
    }
  });

  it('keeps durable creation on the bound directory after its path is replaced by a junction', async () => {
    const directory = await openWindowsNoReparseChildDirectory(root, 'docs');
    const detachedDocs = join(root, 'docs-detached');
    try {
      await rename(join(root, 'docs'), detachedDocs);
      await symlink(outside, join(root, 'docs'), 'junction');

      directory.createExclusiveDurableFile('stage-020', '');

      expect(directory.readRegularFile('stage-020')).toEqual(Buffer.alloc(0));
      await expect(readdir(outside)).resolves.toEqual([]);
    } finally {
      directory.close();
    }
  });

  it('publishes through the bound directory HANDLE after its path becomes a junction', async () => {
    const directory = await openWindowsNoReparseChildDirectory(root, 'docs');
    const detachedDocs = join(root, 'publication-docs-detached');
    try {
      await rename(join(root, 'docs'), detachedDocs);
      await symlink(outside, join(root, 'docs'), 'junction');

      expect(
        directory.commitExclusiveDurableFileViaRename(
          'bound-publication',
          'bound-value',
        ),
      ).toEqual({ committed: true, cleanupStatus: 'closed' });
      expect(directory.readRegularFile('bound-publication')).toEqual(
        Buffer.from('bound-value'),
      );
      await expect(readdir(outside)).resolves.toEqual([]);
    } finally {
      directory.close();
    }
  });

  it('blocks a root swapped for a junction before the first handle-relative child open without creating outside files', async () => {
    const detachedRoot = `${root}-detached`;
    try {
      await rename(root, detachedRoot);
      await symlink(outside, root, 'junction');

      await expect(
        openWindowsNoReparseChildDirectory(root, 'docs'),
      ).rejects.toThrow('WINDOWS_REPARSE_POINT_BLOCKED');
      await expect(readdir(outside)).resolves.toEqual([]);
    } finally {
      await rm(detachedRoot, { recursive: true, force: true });
    }
  });

  it.each(['first', 'second'] as const)(
    'blocks a swapped %s ancestor while binding the root one HANDLE at a time',
    async (swappedAncestor) => {
      const anchor = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-native-anchor-'),
      );
      const external = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-native-ancestor-outside-'),
      );
      const rootPath = join(anchor, 'first', 'second', 'project');
      const components = ['first', 'second', 'project'];
      const swappedPath = join(
        anchor,
        ...components.slice(0, components.indexOf(swappedAncestor) + 1),
      );

      try {
        await mkdir(join(rootPath, 'docs'), { recursive: true });
        await rename(swappedPath, `${swappedPath}-detached`);
        await symlink(external, swappedPath, 'junction');

        await expect(
          openWindowsNoReparseChildDirectory(rootPath, 'docs'),
        ).rejects.toThrow('WINDOWS_REPARSE_POINT_BLOCKED');
        await expect(readdir(external)).resolves.toEqual([]);
      } finally {
        await rm(anchor, { recursive: true, force: true });
        await rm(external, { recursive: true, force: true });
      }
    },
  );

  it.each(['first', 'second'] as const)(
    'does not recreate a missing %s ancestor while binding the root',
    async (missingAncestor) => {
      const anchor = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-native-missing-anchor-'),
      );
      const rootPath = join(anchor, 'first', 'second', 'project');
      const components = ['first', 'second', 'project'];
      const missingPath = join(
        anchor,
        ...components.slice(0, components.indexOf(missingAncestor) + 1),
      );
      const detachedPath = `${missingPath}-detached`;

      try {
        await mkdir(join(rootPath, 'docs'), { recursive: true });
        await rename(missingPath, detachedPath);

        await expect(
          openWindowsNoReparseChildDirectory(rootPath, 'docs'),
        ).rejects.toThrow('WINDOWS_REPARSE_SAFE_IO_RELATIVE_OPEN_FAILED');
        await expect(lstat(missingPath)).rejects.toMatchObject({
          code: 'ENOENT',
        });
      } finally {
        await rm(anchor, { recursive: true, force: true });
        await rm(detachedPath, { recursive: true, force: true });
      }
    },
  );
});
