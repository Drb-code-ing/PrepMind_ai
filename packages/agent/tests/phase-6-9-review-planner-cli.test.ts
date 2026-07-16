import { describe, expect, test } from 'bun:test';

import {
  executePhase695ReviewPlannerCli,
  parsePhase695ReviewPlannerCli,
  resolvePhase695EvidencePath,
} from '../scripts/phase-6-9-review-planner-paired-cli.ts';

describe('phase 6.9 review planner Mock-only CLI', () => {
  test('accepts exactly one unused direct .tmp output path and cannot select Live mode', () => {
    expect(parsePhase695ReviewPlannerCli(['--mode', 'mock', '--out', '.tmp/review-planner.json'])).toEqual({
      ok: true,
      outputPath: '.tmp/review-planner.json',
    });
    expect(parsePhase695ReviewPlannerCli(['--mode', 'live', '--out', '.tmp/review-planner.json']).ok).toBe(false);
    expect(parsePhase695ReviewPlannerCli(['--mode', 'mock', '--out', '.tmp/nested/review-planner.json']).ok).toBe(false);
  });

  test('resolves the accepted .tmp leaf from the repository root, not Bun workspace cwd', () => {
    const resolved = resolvePhase695EvidencePath('.tmp/review-planner.json');

    expect(resolved.replaceAll('\\', '/')).toMatch(/\/\.tmp\/review-planner\.json$/);
    expect(resolved.replaceAll('\\', '/')).not.toContain('/packages/agent/.tmp/');
  });

  test('rejects a pre-existing output path before writing Mock evidence', async () => {
    let wrote = false;
    const result = await executePhase695ReviewPlannerCli({
      argv: ['--mode', 'mock', '--out', '.tmp/existing.json'],
      fs: {
        async lstat(path) {
          return path.replaceAll('\\', '/').endsWith('/.tmp/existing.json')
            ? { isFile: () => true, isSymbolicLink: () => false }
            : null;
        },
        async writeFile() {
          wrote = true;
        },
      },
    });

    expect(result).toEqual({ ok: false, code: 'evidence_io' });
    expect(wrote).toBe(false);
  });

  test('rejects a symlinked .tmp directory before creating evidence', async () => {
    const result = await executePhase695ReviewPlannerCli({
      argv: ['--mode', 'mock', '--out', '.tmp/review-planner.json'],
      fs: {
        async lstat(path) {
          if (path.replaceAll('\\', '/').endsWith('/.tmp')) {
            return { isFile: () => false, isSymbolicLink: () => true };
          }
          return null;
        },
        async writeFile() {
          throw new Error('must not write through symlink');
        },
      },
    });

    expect(result).toEqual({ ok: false, code: 'evidence_io' });
  });

  test('creates an absent repository .tmp directory before writing its one evidence file', async () => {
    let directoryExists = false;
    let wrote = false;
    const result = await executePhase695ReviewPlannerCli({
      argv: ['--mode', 'mock', '--out', '.tmp/review-planner.json'],
      fs: {
        async lstat(path) {
          const normalized = path.replaceAll('\\', '/');
          if (normalized.endsWith('/.tmp')) {
            return directoryExists ? { isFile: () => false, isSymbolicLink: () => false } : null;
          }
          return null;
        },
        async mkdir() {
          directoryExists = true;
        },
        async writeFile() {
          wrote = true;
        },
      },
    });

    expect(result).toEqual({ ok: true, outputPath: '.tmp/review-planner.json' });
    expect(directoryExists).toBe(true);
    expect(wrote).toBe(true);
  });
});
