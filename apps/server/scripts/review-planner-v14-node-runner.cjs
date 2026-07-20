const { readFileSync, realpathSync } = require('node:fs');
const Module = require('node:module');
const { extname, isAbsolute, relative, resolve, sep } = require('node:path');

const entries = new Map([
  [
    'review-planner-v14-product-acceptance.ts',
    resolve(__dirname, 'review-planner-v14-product-acceptance.ts'),
  ],
  [
    'review-planner-v14-product-acceptance-recovery.ts',
    resolve(__dirname, 'review-planner-v14-product-acceptance-recovery.ts'),
  ],
]);

function failClosed() {
  process.stdout.write(
    `${JSON.stringify({
      stage: 'preflight',
      status: 'blocked',
      code: 'default_off',
    })}\n`,
  );
  process.exitCode = 1;
}

function isWithinApprovedRoot(filename, approvedRoots) {
  const canonicalFilename = realpathSync(filename);
  return approvedRoots.some((root) => {
    const difference = relative(root, canonicalFilename);
    return (
      difference === '' ||
      (!difference.startsWith(`..${sep}`) && difference !== '..' && !isAbsolute(difference))
    );
  });
}

function run() {
  try {
    const entry = entries.get(process.argv[2]);
    if (!entry) {
      failClosed();
      return;
    }

    const ts = require('typescript');
    const approvedRoots = [
      realpathSync(__dirname),
      realpathSync(resolve(__dirname, '../src/review-agent')),
    ];
    const approvedFiles = new Set([
      realpathSync(resolve(__dirname, '../../../packages/database/src/index.ts')),
      realpathSync(
        resolve(__dirname, '../../../packages/agent/src/review-planner-diagnostics.ts'),
      ),
    ]);
    const assertApprovedTypeScriptFile = (filename) => {
      if (
        extname(filename) !== '.ts' ||
        (!isWithinApprovedRoot(filename, approvedRoots) &&
          !approvedFiles.has(realpathSync(filename)))
      ) {
        throw new Error('V14_NODE_RUNNER_TYPESCRIPT_PATH_BLOCKED');
      }
    };
    const resolveFilename = Module._resolveFilename;
    Module._resolveFilename = function resolveTypeScriptRelativeImport(
      request,
      parent,
      isMain,
      options,
    ) {
      try {
        return resolveFilename.call(this, request, parent, isMain, options);
      } catch (error) {
        if (
          !error ||
          error.code !== 'MODULE_NOT_FOUND' ||
          !request.startsWith('.') ||
          extname(request) !== ''
        ) {
          throw error;
        }
        const filename = resolveFilename.call(
          this,
          `${request}.ts`,
          parent,
          isMain,
          options,
        );
        assertApprovedTypeScriptFile(filename);
        return filename;
      }
    };
    require.extensions['.ts'] = (loadedModule, filename) => {
      assertApprovedTypeScriptFile(filename);
      const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          moduleResolution: ts.ModuleResolutionKind.Node10,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
        },
        fileName: filename,
      });
      loadedModule._compile(output.outputText, filename);
    };
    process.argv = [process.argv[0], entry, ...process.argv.slice(3)];
    require(entry);
  } catch {
    failClosed();
  }
}

run();
