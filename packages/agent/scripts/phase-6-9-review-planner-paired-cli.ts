import { lstat, mkdir as makeDirectory, writeFile } from 'node:fs/promises';
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
    isSymbolicLink(): boolean;
  } | null>;
  writeFile(path: string, contents: string, options?: unknown): Promise<void>;
  mkdir?(path: string): Promise<void>;
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
  try {
    const output = await fs.lstat(outputPath);
    if (output !== null) {
      return { ok: false, code: ReviewPlannerDiagnosticCode.EvidenceIo };
    }
    const parent = await fs.lstat(REPOSITORY_TMP_DIRECTORY);
    if (parent?.isSymbolicLink()) {
      return { ok: false, code: ReviewPlannerDiagnosticCode.EvidenceIo };
    }
    if (parent === null) {
      if (!fs.mkdir) return { ok: false, code: ReviewPlannerDiagnosticCode.EvidenceIo };
      await fs.mkdir(REPOSITORY_TMP_DIRECTORY);
      const createdParent = await fs.lstat(REPOSITORY_TMP_DIRECTORY);
      if (createdParent === null || createdParent.isSymbolicLink()) {
        return { ok: false, code: ReviewPlannerDiagnosticCode.EvidenceIo };
      }
    }
    const report = await runPhase695ReviewPlannerPaired({ mode: 'mock' });
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    return { ok: true, outputPath: parsed.outputPath };
  } catch {
    return { ok: false, code: ReviewPlannerDiagnosticCode.EvidenceIo };
  }
}

const nodeFs: Phase695CliFs = {
  async lstat(path) {
    try {
      const stats = await lstat(path);
      return {
        isFile: () => stats.isFile(),
        isSymbolicLink: () => stats.isSymbolicLink(),
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },
  writeFile,
  async mkdir(path) {
    await makeDirectory(path);
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
