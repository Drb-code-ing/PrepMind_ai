import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prismaClientDefault = require.resolve('@prisma/client/default.js');
const prismaClientDir = dirname(prismaClientDefault);
const packageNodeModulesDir = resolve(prismaClientDir, '..', '..');
const sourceClientDir = join(packageNodeModulesDir, '.prisma', 'client');
const packageClientDir = join(prismaClientDir, '.prisma', 'client');

copyGeneratedClient(sourceClientDir, packageClientDir);

function copyGeneratedClient(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Generated Prisma Client not found at ${source}`);
  }

  rmSync(destination, { force: true, recursive: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}
