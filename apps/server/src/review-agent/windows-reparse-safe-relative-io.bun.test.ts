import { mkdir, mkdtemp, readdir, rename, rm, symlink } from 'node:fs/promises';
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

  it('does not create an external residue when docs is swapped for a junction before the relative open', async () => {
    await rename(join(root, 'docs'), join(root, 'docs-detached'));
    await symlink(outside, join(root, 'docs'), 'junction');

    await expect(
      openWindowsNoReparseChildDirectory(root, 'docs'),
    ).rejects.toThrow('WINDOWS_REPARSE_POINT_BLOCKED');
    await expect(readdir(outside)).resolves.toEqual([]);
  });
});
