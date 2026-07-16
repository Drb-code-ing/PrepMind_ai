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

import { openWindowsNoReparseChildDirectory } from './windows-reparse-safe-relative-io';

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
