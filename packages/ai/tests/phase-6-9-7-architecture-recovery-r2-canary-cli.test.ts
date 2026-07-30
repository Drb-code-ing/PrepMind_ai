import { describe, expect, test } from 'bun:test';

import { runPhase697ArchitectureRecoveryR2CanaryCli } from '../src/index.ts';

const FORBIDDEN =
  /r2-synthetic-key|api\.deepseek\.com|authorization|systemPrompt|userPrompt|raw-provider|credential/u;

describe('Phase 6.9.7 Architecture Recovery R2 canary CLI', () => {
  test('runs only the in-memory synthetic mock and emits a strict safe report', async () => {
    const output: string[] = [];
    const exitCode = await runPhase697ArchitectureRecoveryR2CanaryCli(['mock'], {
      write: (line) => output.push(line),
    });

    expect(exitCode).toBe(0);
    expect(output).toHaveLength(1);
    const value = JSON.parse(output[0]) as Record<string, unknown>;
    expect(value).toMatchObject({
      version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-cli-v1',
      ok: true,
      mode: 'mock',
      report: {
        authority: 'synthetic_test',
        outcome: 'complete',
        responseObserved: true,
      },
    });
    expect(output[0]).not.toMatch(FORBIDDEN);
  });

  test('runs the fixed zero-network fault matrix without creating Live authority', async () => {
    const output: string[] = [];
    const exitCode = await runPhase697ArchitectureRecoveryR2CanaryCli(['fault-matrix'], {
      write: (line) => output.push(line),
    });

    expect(exitCode).toBe(0);
    expect(output).toHaveLength(1);
    const value = JSON.parse(output[0]) as {
      ok: boolean;
      mode: string;
      total: number;
      passed: number;
      authority: string;
      scenarios: readonly Record<string, unknown>[];
    };
    expect(value).toMatchObject({
      ok: true,
      mode: 'fault-matrix',
      authority: 'synthetic_test',
    });
    expect(value.total).toBeGreaterThanOrEqual(16);
    expect(value.passed).toBe(value.total);
    expect(value.scenarios).toHaveLength(value.total);
    expect(new Set(value.scenarios.map((item) => item.id)).size).toBe(value.total);
    expect(output[0]).not.toMatch(FORBIDDEN);
  });

  test('rejects Live, output paths, missing, repeated, and unknown arguments without running a canary', async () => {
    const cases: readonly string[][] = [
      [],
      ['live'],
      ['--mode', 'live'],
      ['mock', 'mock'],
      ['mock', '--out', '.tmp/forbidden.json'],
      ['--help'],
      ['unknown'],
    ];
    for (const args of cases) {
      const output: string[] = [];
      const exitCode = await runPhase697ArchitectureRecoveryR2CanaryCli(args, {
        write: (line) => output.push(line),
      });
      expect(exitCode, args.join(' ')).toBe(1);
      expect(output, args.join(' ')).toHaveLength(1);
      expect(JSON.parse(output[0]), args.join(' ')).toEqual({
        version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-cli-v1',
        ok: false,
        code: 'r2_cli_argument_invalid',
      });
      expect(output[0], args.join(' ')).not.toMatch(FORBIDDEN);
    }
  });

  test('contains a hostile output port without rejecting or leaking its error', async () => {
    const raw = 'r2-hostile-output-port';
    await expect(
      runPhase697ArchitectureRecoveryR2CanaryCli(['mock'], {
        write() {
          throw new Error(raw);
        },
      }),
    ).resolves.toBe(1);
  });
});
