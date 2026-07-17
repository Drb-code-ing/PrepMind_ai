import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as windowsReparseSafeIo from './windows-reparse-safe-relative-io';

const { openWindowsNoReparseChildDirectory } = windowsReparseSafeIo;
type DurableFaultStage = 'write' | 'flush' | 'close';
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
      directory.replaceDurableFile(
        'terminal.json.tmp',
        'terminal.json',
        'new',
      );
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
