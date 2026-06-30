import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(currentDir, '../../../apps/server');

describe('@repo/rag package entry', () => {
  it('can be loaded by the server runtime through the workspace package entry', () => {
    const result = Bun.spawnSync(['node', '-e', "require('@repo/rag')"], {
      cwd: serverDir,
      stderr: 'pipe',
      stdout: 'pipe',
    });

    expect(result.exitCode).toBe(0);
  });

  it('exports the RAG safety classifier through the server runtime entry', () => {
    const result = Bun.spawnSync(
      [
        'node',
        '-e',
        "const rag = require('@repo/rag'); if (typeof rag.classifyRagChunkSafety !== 'function') process.exit(2);",
      ],
      {
        cwd: serverDir,
        stderr: 'pipe',
        stdout: 'pipe',
      },
    );

    expect(result.exitCode).toBe(0);
  });
});
