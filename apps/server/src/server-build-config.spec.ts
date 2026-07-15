import fs from 'node:fs';
import path from 'node:path';

describe('Server TypeScript build configuration', () => {
  it('rewrites TypeScript extensions while emitting workspace package imports', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../tsconfig.build.json'),
        'utf8',
      ),
    ) as {
      compilerOptions?: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions).toMatchObject({
      allowImportingTsExtensions: true,
      rewriteRelativeImportExtensions: true,
    });
    expect(tsconfig.compilerOptions?.noEmit).not.toBe(true);
  });
});
