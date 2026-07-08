import fs from 'node:fs';
import path from 'node:path';

describe('Docker Compose worker readiness healthcheck', () => {
  it('keeps Docker build context small and free of local-only artifacts', () => {
    const dockerignore = readRepoFile('.dockerignore');

    expect(dockerignore).toContain('node_modules');
    expect(dockerignore).toContain('.git');
    expect(dockerignore).toContain('.worktrees');
    expect(dockerignore).toContain('.env');
    expect(dockerignore).toContain('apps/server/dist');
    expect(dockerignore).toContain('apps/web/.next');
  });

  it('keeps the local PostgreSQL host port aligned with development docs', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const postgresService = extractYamlSection(compose, '  postgres:', 2);

    expect(postgresService).toContain('${POSTGRES_PORT:-5433}:5432');
  });

  it('keeps the server Dockerfile aligned with the Bun workspace and build output', () => {
    const dockerfile = readRepoFile('docker/Dockerfile.server');

    expect(dockerfile).toContain('COPY bun.lock package.json');
    expect(dockerfile).toContain('COPY apps/web/package.json ./apps/web/');
    expect(dockerfile).toContain(
      'COPY packages/agent/package.json ./packages/agent/',
    );
    expect(dockerfile).toContain(
      'COPY packages/ai/package.json ./packages/ai/',
    );
    expect(dockerfile).toContain(
      'COPY packages/database/package.json ./packages/database/',
    );
    expect(dockerfile).toContain(
      'COPY packages/fsrs/package.json ./packages/fsrs/',
    );
    expect(dockerfile).toContain(
      'COPY packages/mcp/package.json ./packages/mcp/',
    );
    expect(dockerfile).toContain(
      'COPY packages/rag/package.json ./packages/rag/',
    );
    expect(dockerfile).toContain(
      'COPY packages/types/package.json ./packages/types/',
    );
    expect(dockerfile).toContain(
      'COPY packages/ui/package.json ./packages/ui/',
    );
    expect(dockerfile).not.toContain('pnpm-lock.yaml');
    expect(dockerfile).not.toContain('pnpm-workspace.yaml');
    expect(dockerfile).toContain('bun install --frozen-lockfile');
    expect(dockerfile).toContain('COPY --from=deps /app/apps ./apps');
    expect(dockerfile).toContain('COPY --from=deps /app/packages ./packages');
    expect(dockerfile).toContain('bun --cwd packages/database prisma:generate');
    expect(dockerfile).toContain('bun --filter @repo/server build');
    expect(dockerfile).toContain(
      'COPY --from=builder /app/node_modules ./node_modules',
    );
    expect(dockerfile).toContain(
      'COPY --from=builder /app/apps/server/dist ./apps/server/dist',
    );
    expect(dockerfile).toContain(
      'COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules',
    );
    expect(dockerfile).toContain(
      'COPY --from=builder /app/packages ./packages',
    );
    expect(dockerfile).toContain('CMD ["bun", "apps/server/dist/src/main.js"]');
  });

  it('keeps the server production script aligned with the Nest build output', () => {
    const packageJson = JSON.parse(
      readRepoFile('apps/server/package.json'),
    ) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['start:prod']).toBe('bun dist/src/main.js');
  });

  it('keeps the web Dockerfile aligned with the Bun workspace and Next standalone output', () => {
    const dockerfile = readRepoFile('docker/Dockerfile.web');

    expect(dockerfile).toContain('FROM oven/bun:1.3.14-alpine AS base');
    expect(dockerfile).toContain('COPY bun.lock package.json');
    expect(dockerfile).toContain('COPY apps/web/package.json ./apps/web/');
    expect(dockerfile).toContain(
      'COPY packages/agent/package.json ./packages/agent/',
    );
    expect(dockerfile).toContain(
      'COPY packages/types/package.json ./packages/types/',
    );
    expect(dockerfile).not.toContain('pnpm-lock.yaml');
    expect(dockerfile).not.toContain('pnpm-workspace.yaml');
    expect(dockerfile).toContain('bun install --frozen-lockfile');
    expect(dockerfile).toContain('bun --filter @repo/web build');
    expect(dockerfile).toContain('COPY --from=builder /app/apps/web/.next/standalone ./');
    expect(dockerfile).toContain('CMD ["bun", "apps/web/server.js"]');
  });

  it('configures Next to emit standalone assets for the web Docker image', () => {
    const nextConfig = readRepoFile('apps/web/next.config.ts');

    expect(nextConfig).toContain("output: 'standalone'");
  });

  it('configures the worker service to run the readiness CLI', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const serverService = extractYamlSection(compose, '  server:', 2);
    const workerService = extractYamlSection(compose, '  worker:', 2);

    expect(serverService).toContain('JWT_SECRET:');
    expect(serverService).toContain(
      'CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000,http://127.0.0.1:3000}',
    );
    expect(workerService).toContain('JWT_SECRET:');
    expect(workerService).toContain('healthcheck:');
    expect(workerService).toContain(
      'bun apps/server/dist/scripts/worker-readiness.js',
    );
    expect(workerService).toContain('WORKER_READINESS_CLI_TIMEOUT_MS');
    expect(workerService).toContain('interval:');
    expect(workerService).toContain('timeout:');
    expect(workerService).toContain('retries:');
    expect(workerService).toContain('start_period:');
  });
});

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, '../../../..', relativePath), {
    encoding: 'utf8',
  });
}

function extractYamlSection(source: string, header: string, indent: number) {
  const start = source.indexOf(header);
  if (start < 0) {
    throw new Error(`Missing YAML section ${header.trim()}`);
  }

  const rest = source.slice(start + header.length);
  const nextSiblingPattern = new RegExp(`\\n {${indent}}[^\\s].*:`);
  const nextSibling = rest.search(nextSiblingPattern);
  return nextSibling >= 0 ? rest.slice(0, nextSibling) : rest;
}
