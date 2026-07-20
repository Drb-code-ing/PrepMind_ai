import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('Review/Planner V16 Node runner', () => {
  const defaultOff = JSON.stringify({
    stage: 'preflight',
    status: 'blocked',
    code: 'default_off',
  });

  function expectFailClosed(result: SpawnSyncReturns<string>) {
    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe(defaultOff);
    expect(result.stderr).toBe('');
  }

  it('fails closed for an ordinary unknown entry before loading TypeScript', () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve(__dirname, '../../scripts/review-planner-v16-node-runner.cjs'),
        'not-an-entry.ts',
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    );

    expectFailClosed(result);
  });

  it('fails closed for an inherited entry key before loading TypeScript', () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve(__dirname, '../../scripts/review-planner-v16-node-runner.cjs'),
        'toString',
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    );

    expectFailClosed(result);
  });

  it('serializes a TypeScript bootstrap failure as the fixed default-off result', () => {
    const runner = JSON.stringify(
      resolve(__dirname, '../../scripts/review-planner-v16-node-runner.cjs'),
    );
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        [
          "const Module = require('node:module');",
          'const resolveFilename = Module._resolveFilename;',
          'Module._resolveFilename = function(request, parent, isMain, options) {',
          "  if (request === 'typescript') throw new Error('injected');",
          '  return resolveFilename.call(this, request, parent, isMain, options);',
          '};',
          "process.argv = ['node', 'runner', 'review-planner-v16-product-acceptance.ts'];",
          `require(${runner});`,
        ].join('\n'),
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    );

    expectFailClosed(result);
  });

  it('blocks a redirected TypeScript dependency outside the approved roots', () => {
    const runner = JSON.stringify(
      resolve(__dirname, '../../scripts/review-planner-v16-node-runner.cjs'),
    );
    const unapprovedTypeScript = JSON.stringify(
      resolve(__dirname, '../../../../packages/agent/src/index.ts'),
    );
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        [
          "const Module = require('node:module');",
          'const resolveFilename = Module._resolveFilename;',
          'Module._resolveFilename = function(request, parent, isMain, options) {',
          "  if (request === '../src/review-agent/review-planner-v16-product-acceptance-cli') return " +
            unapprovedTypeScript +
            ';',
          '  return resolveFilename.call(this, request, parent, isMain, options);',
          '};',
          "process.argv = ['node', 'runner', 'review-planner-v16-product-acceptance.ts'];",
          `require(${runner});`,
        ].join('\n'),
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    );

    expectFailClosed(result);
  });

  it('blocks a resolved outside JavaScript dependency before it executes', () => {
    const fixtureDirectory = mkdtempSync(
      join(tmpdir(), 'review-planner-v16-node-runner-'),
    );
    const unapprovedJavaScript = join(fixtureDirectory, 'unapproved.js');
    writeFileSync(
      unapprovedJavaScript,
      "process.stdout.write('UNAPPROVED_JAVASCRIPT_EXECUTED\\n');\n",
    );

    try {
      const runner = JSON.stringify(
        resolve(__dirname, '../../scripts/review-planner-v16-node-runner.cjs'),
      );
      const result = spawnSync(
        process.execPath,
        [
          '-e',
          [
            "const Module = require('node:module');",
            `const unapprovedJavaScript = ${JSON.stringify(unapprovedJavaScript)};`,
            'const resolveFilename = Module._resolveFilename;',
            'Module._resolveFilename = function(request, parent, isMain, options) {',
            "  if (request === '../src/review-agent/review-planner-v16-product-acceptance-cli') return unapprovedJavaScript;",
            '  return resolveFilename.call(this, request, parent, isMain, options);',
            '};',
            "process.argv = ['node', 'runner', 'review-planner-v16-product-acceptance.ts'];",
            `require(${runner});`,
          ].join('\n'),
        ],
        {
          encoding: 'utf8',
          windowsHide: true,
        },
      );

      expectFailClosed(result);
    } finally {
      rmSync(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it('admits the exact database bridge before the product CLI fails closed', () => {
    const runner = JSON.stringify(
      resolve(__dirname, '../../scripts/review-planner-v16-node-runner.cjs'),
    );
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        [
          "const Module = require('node:module');",
          'const load = Module._load;',
          'Module._load = function(request, parent, isMain) {',
          "  if (request === '@prisma/client') process.stdout.write('PRISMA_LOADED\\n');",
          '  const value = load.call(this, request, parent, isMain);',
          "  if (request === '@repo/agent/review-planner-diagnostics') process.stdout.write('DIAGNOSTICS_LOADED\\n');",
          '  return value;',
          '};',
          "process.argv = ['node', 'runner', 'review-planner-v16-product-acceptance.ts', '--invalid', '--environment=branch'];",
          `require(${runner});`,
        ].join('\n'),
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('PRISMA_LOADED\n');
    expect(result.stdout).toContain('DIAGNOSTICS_LOADED\n');
    expect(result.stdout.trim().endsWith('"code":"default_off"}')).toBe(true);
    expect(result.stderr).toBe('');
  });
});
