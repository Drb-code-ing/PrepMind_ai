import { lstat, mkdir as makeDirectory, open as openFile, realpath, } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ReviewPlannerDiagnosticCode } from '../src/evals/phase-6-9-review-planner-contract.ts';
import { runPhase695ReviewPlannerPaired } from '../src/evals/run-phase-6-9-review-planner-paired.ts';

const OUTPUT_PATH_PATTERN = /^\.tmp\/[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.json$/;
const REPOSITORY_TMP_DIRECTORY = fileURLToPath(new URL('../../../.tmp', import.meta.url));

export type Phase695CliParseResult =
  | Readonly<{ ok: true; outputPath: string }>
  | Readonly<{ ok: false; code: ReviewPlannerDiagnosticCode }>;

export type Phase695CliFs = Readonly<{
  lstat(path: string): Promise<{
    isFile(): boolean;
    isDirectory?(): boolean;
    isSymbolicLink(): boolean;
  } | null>;
  mkdir?(path: string): Promise<void>;
  realpath?(path: string): Promise<string>;
  openExclusive?(path: string): Promise<Phase695EvidenceHandle>;
}>;

export type Phase695EvidenceHandle = Readonly<{
  realpath(): Promise<string>;
  write(contents: string): Promise<void>;
  close(): Promise<void>;
}>;

export function parsePhase695ReviewPlannerCli(argv: readonly string[]): Phase695CliParseResult {
  if (argv.length !== 4 || argv[0] !== '--mode' || argv[1] !== 'mock' || argv[2] !== '--out') {
    return { ok: false, code: ReviewPlannerDiagnosticCode.EvidenceIo };
  }
  const outputPath = argv[3];
  if (typeof outputPath !== 'string' || !OUTPUT_PATH_PATTERN.test(outputPath)) {
    return { ok: false, code: ReviewPlannerDiagnosticCode.EvidenceIo };
  }
  return { ok: true, outputPath };
}

export function resolvePhase695EvidencePath(outputPath: string): string {
  return fileURLToPath(new URL(`../../../${outputPath}`, import.meta.url));
}

export async function executePhase695ReviewPlannerCli(input: Readonly<{
  argv: readonly string[];
  fs?: Phase695CliFs;
}>): Promise<Readonly<{ ok: true; outputPath: string }> | Readonly<{
  ok: false;
  code: ReviewPlannerDiagnosticCode;
}>> {
  const parsed = parsePhase695ReviewPlannerCli(input.argv);
  if (!parsed.ok) return parsed;
  const fs = input.fs ?? nodeFs;
  const outputPath = resolvePhase695EvidencePath(parsed.outputPath);
  let handle: Phase695EvidenceHandle | null = null;
  try {
    const output = await fs.lstat(outputPath);
    if (output !== null) {
      return { ok: false, code: ReviewPlannerDiagnosticCode.EvidenceIo };
    }
    let parent = await fs.lstat(REPOSITORY_TMP_DIRECTORY);
    if (parent === null) {
      if (!fs.mkdir) return failure();
      await fs.mkdir(REPOSITORY_TMP_DIRECTORY);
      parent = await fs.lstat(REPOSITORY_TMP_DIRECTORY);
    }
    if (parent === null || parent.isSymbolicLink() || parent.isDirectory?.() !== true ||
      !fs.realpath || !fs.openExclusive) {
      return failure();
    }
    const parentRealpath = await fs.realpath(REPOSITORY_TMP_DIRECTORY);
    handle = await fs.openExclusive(outputPath);
    const report = await runPhase695ReviewPlannerPaired({ mode: 'mock' });
    const openedFileRealpath = await handle.realpath();
    if (dirname(openedFileRealpath) !== parentRealpath) return failure();
    // The exclusive handle prevents later parent-component reparsing from redirecting this write.
    // Same-OS races beyond this handle/realpath boundary remain a trusted-workspace limitation.
    await handle.write(`${JSON.stringify(report, null, 2)}\n`);
    await handle.close();
    handle = null;
    return { ok: true, outputPath: parsed.outputPath };
  } catch {
    return failure();
  } finally {
    if (handle) await closeQuietly(handle);
  }
}

function failure(): Readonly<{ ok: false; code: ReviewPlannerDiagnosticCode }> {
  return { ok: false, code: ReviewPlannerDiagnosticCode.EvidenceIo };
}

async function closeQuietly(handle: Phase695EvidenceHandle): Promise<void> {
  try {
    await handle.close();
  } catch {
    // Evidence failures are intentionally collapsed to the fixed diagnostic code.
  }
}

const nodeFs: Phase695CliFs = {
  async lstat(path) {
    try {
      const stats = await lstat(path);
      return {
        isFile: () => stats.isFile(),
        isDirectory: () => stats.isDirectory(),
        isSymbolicLink: () => stats.isSymbolicLink(),
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },
  async mkdir(path) {
    await makeDirectory(path);
  },
  realpath,
  async openExclusive(path) {
    const handle = await openFile(path, 'wx');
    return {
      async realpath() {
        return realpath(path);
      },
      async write(contents) {
        await handle.writeFile(contents, 'utf8');
      },
      async close() {
        await handle.close();
      },
    };
  },
};

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    (error as { code?: unknown }).code === 'ENOENT';
}

if (import.meta.main) {
  const result = await executePhase695ReviewPlannerCli({ argv: process.argv.slice(2) });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
