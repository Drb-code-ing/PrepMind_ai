import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const serverRoot = path.resolve(__dirname, '..');
const buildConfigPath = path.join(serverRoot, 'tsconfig.build.json');
const distPath = path.join(serverRoot, 'dist');

function listJavaScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

function getRuntimeModuleSpecifier(node: ts.Node): string | undefined {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }

  if (
    ts.isCallExpression(node) &&
    ((ts.isIdentifier(node.expression) && node.expression.text === 'require') ||
      node.expression.kind === ts.SyntaxKind.ImportKeyword) &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }

  return undefined;
}

function findRelativeTypeScriptSpecifiers(filePath: string): string[] {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.JS,
  );
  const matches: string[] = [];

  function visit(node: ts.Node): void {
    const specifier = getRuntimeModuleSpecifier(node);

    if (
      specifier &&
      /^\.\.?(?:\/|\\)/.test(specifier) &&
      /\.tsx?$/i.test(specifier)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      const relativeFile = path
        .relative(serverRoot, filePath)
        .split(path.sep)
        .join('/');
      matches.push(`${relativeFile}:${line + 1}:${specifier}`);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}

describe('Server TypeScript build configuration', () => {
  it('detects relative TypeScript specifiers in runtime module loads', () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'prepmind-server-build-'),
    );
    const emittedFile = path.join(temporaryDirectory, 'fixture.js');

    try {
      fs.writeFileSync(
        emittedFile,
        [
          "import './side-effect.ts';",
          "export { value } from '../value.tsx';",
          "const required = require('./required.ts');",
          "const loaded = import('../loaded.tsx');",
        ].join('\n'),
      );

      const specifiers = findRelativeTypeScriptSpecifiers(emittedFile).map(
        (match) => match.slice(match.lastIndexOf(':') + 1),
      );

      expect(specifiers).toEqual([
        './side-effect.ts',
        '../value.tsx',
        './required.ts',
        '../loaded.tsx',
      ]);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('enables extension rewriting without disabling emit in the effective config', () => {
    const configFile = ts.readConfigFile(buildConfigPath, (fileName) =>
      ts.sys.readFile(fileName),
    );

    expect(configFile.error).toBeUndefined();

    const effectiveConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      serverRoot,
      undefined,
      buildConfigPath,
    );

    expect(effectiveConfig.errors).toEqual([]);
    expect(effectiveConfig.options).toMatchObject({
      allowImportingTsExtensions: true,
      rewriteRelativeImportExtensions: true,
    });
    expect(effectiveConfig.options.noEmit).not.toBe(true);
  });

  it('emits JavaScript without relative TypeScript runtime specifiers', () => {
    execFileSync(
      process.platform === 'win32' ? 'bun.exe' : 'bun',
      ['run', 'build'],
      {
        cwd: serverRoot,
        stdio: 'pipe',
      },
    );

    const javaScriptFiles = listJavaScriptFiles(distPath);
    const invalidSpecifiers = javaScriptFiles.flatMap(
      findRelativeTypeScriptSpecifiers,
    );

    expect(javaScriptFiles.length).toBeGreaterThan(0);
    expect(invalidSpecifiers).toEqual([]);
  }, 120_000);
});
