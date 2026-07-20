import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Review/Planner V17 Node runner repository root boundary', () => {
  it('runs a valid confirmed injected preflight from apps/server with the repository root as its CWD', () => {
    const repositoryRoot = resolve(__dirname, '../../../..');
    const appsServerRoot = resolve(__dirname, '../..');
    const runner = JSON.stringify(
      resolve(__dirname, '../../scripts/review-planner-v17-node-runner.cjs'),
    );
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        [
          "const Module = require('node:module');",
          'const load = Module._load;',
          'Module._load = function(request, parent, isMain) {',
          "  if (request === '../src/review-agent/review-planner-v17-product-acceptance-cli') {",
          '    return {',
          "      executeReviewPlannerV17ProductAcceptanceProductCli: async () => ({ status: 'passed' }),",
          '      serializeReviewPlannerV17ProductAcceptanceCliSummary: (value) => JSON.stringify({ ...value, observedCwd: process.cwd() }),',
          '    };',
          '  }',
          '  return load.call(this, request, parent, isMain);',
          '};',
          "process.argv = ['node', 'runner', 'review-planner-v17-product-acceptance.ts', '--confirm-v17-review-planner-product-acceptance', '--environment=branch'];",
          `require(${runner});`,
        ].join('\n'),
      ],
      {
        cwd: appsServerRoot,
        encoding: 'utf8',
        windowsHide: true,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      status: 'passed',
      observedCwd: repositoryRoot,
    });
  });
});
