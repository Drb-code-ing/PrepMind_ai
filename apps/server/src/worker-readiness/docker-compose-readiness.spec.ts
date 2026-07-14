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

  it('loads the root env file for repository Docker commands', () => {
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['docker:up']).toBe(
      'docker compose --env-file .env -f docker/docker-compose.dev.yml up -d',
    );
    expect(packageJson.scripts['docker:down']).toBe(
      'docker compose --env-file .env -f docker/docker-compose.dev.yml down',
    );
    expect(packageJson.scripts['docker:up:worker']).toBe(
      'docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d',
    );
  });

  it('keeps the local PostgreSQL host port aligned with development docs', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const postgresService = extractYamlSection(compose, '  postgres:', 2);

    expect(postgresService).toContain('${POSTGRES_PORT:-5433}:5432');
  });

  it('persists local MinIO objects across normal Compose down and up cycles', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const minioService = extractYamlSection(compose, '  minio:', 2);

    expect(minioService).toContain('volumes:');
    expect(minioService).toContain('- miniodata:/data');
    expect(compose).toContain('  miniodata:');
  });

  it('keeps the server Dockerfile aligned with the Bun workspace and build output', () => {
    const dockerfile = readRepoFile('docker/Dockerfile.server');

    expect(dockerfile).toContain('COPY bun.lock package.json');
    expect(dockerfile).toContain('COPY apps/admin/package.json ./apps/admin/');
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
      'adduser --system --uid 1001 --ingroup nodejs nestjs',
    );
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
    expect(dockerfile).toContain('COPY apps/admin/package.json ./apps/admin/');
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
    expect(dockerfile).toContain(
      'ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001',
    );
    expect(dockerfile).toContain(
      'ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL',
    );
    expect(dockerfile).toContain('bun --filter @repo/web build');
    expect(dockerfile).toContain(
      'COPY --from=builder /app/apps/web/.next/standalone ./',
    );
    expect(dockerfile).toContain('CMD ["bun", "apps/web/server.js"]');
  });

  it('configures Next to emit standalone assets for the web Docker image', () => {
    const nextConfig = readRepoFile('apps/web/next.config.ts');

    expect(nextConfig).toContain("output: 'standalone'");
    expect(nextConfig).toContain("allowedDevOrigins: ['127.0.0.1']");
  });

  it('configures the worker service to run the readiness CLI', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const serverService = extractYamlSection(compose, '  server:', 2);
    const workerService = extractYamlSection(compose, '  worker:', 2);

    expect(serverService).toContain('JWT_SECRET:');
    expect(serverService).toContain(
      'CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100}',
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

  it('bootstraps the audit export lifecycle and bounds plaintext worker temp storage', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const lifecycle = JSON.parse(
      readRepoFile('docker/minio/operator-audit-export-lifecycle.json'),
    ) as { Rules: Array<Record<string, unknown>> };
    const init = extractYamlSection(compose, '  minio-init:', 2);
    const server = extractYamlSection(compose, '  server:', 2);
    const worker = extractYamlSection(compose, '  worker:', 2);
    expect(lifecycle.Rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Filter: { Prefix: 'operator-audit-exports/' },
          Expiration: { Days: 2 },
          NoncurrentVersionExpiration: { NoncurrentDays: 2 },
          AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
        }),
        expect.objectContaining({
          Expiration: { ExpiredObjectDeleteMarker: true },
        }),
      ]),
    );
    expect(init).toContain('minio/mc');
    expect(init).toContain('- /bin/sh');
    expect(init).toContain('- -c');
    expect(init).toContain('- |');
    expect(init).not.toContain('command: >-');
    expect(init).toContain('mc alias set local');
    expect(init).toContain('until mc alias set local');
    expect(init).toContain('attempt=$$((attempt + 1))');
    expect(init).toContain('[ "$$attempt" -ge 30 ] && exit 1');
    expect(init).toContain('mc ready local');
    expect(init).toContain('mc mb --ignore-existing local/prepmind-dev');
    expect(init).toContain('mc ilm import local/prepmind-dev');
    expect(init).toContain('/config/operator-audit-export-lifecycle.json:ro');
    expect(server).toContain('minio-init:');
    expect(server).toContain('condition: service_completed_successfully');
    const defaultArchiveBytes = 67_108_864;
    const tmpfsMatch = worker.match(
      /\/tmp\/prepmind-audit-exports:size=(\d+),mode=0700/,
    );
    expect(tmpfsMatch).not.toBeNull();
    const tmpfsCapacity = Number(tmpfsMatch?.[1]);
    expect(tmpfsCapacity).toBeGreaterThan(2 * defaultArchiveBytes);
  });

  it('keeps local Docker server diagnostics explicitly enabled despite production runtime', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const dockerfile = readRepoFile('docker/Dockerfile.server');
    const serverService = extractYamlSection(compose, '  server:', 2);

    expect(serverService).toContain(
      'OUTBOX_OPS_ENABLED: ${OUTBOX_OPS_ENABLED:-true}',
    );
    expect(serverService).toContain(
      'OPERATOR_AUDIT_ENABLED: ${OPERATOR_AUDIT_ENABLED:-true}',
    );
    expect(serverService).toContain(
      'OPERATOR_AUDIT_FINGERPRINT_SECRET: ${OPERATOR_AUDIT_FINGERPRINT_SECRET:-local-dev-audit-fingerprint-change-me}',
    );
    expect(serverService).toContain(
      'WORKER_READINESS_ENABLED: ${WORKER_READINESS_ENABLED:-true}',
    );
    expect(serverService).toContain(
      'WORKER_OBSERVABILITY_ENABLED: ${WORKER_OBSERVABILITY_ENABLED:-true}',
    );
    const localFallback = 'local-dev-audit-fingerprint-change-me';
    for (const productionDockerArtifact of [
      dockerfile,
      readRepoFile('docker/Dockerfile.admin'),
      readRepoFile('docker/Dockerfile.web'),
      readRepoFile('docker/.env.example'),
    ]) {
      expect(productionDockerArtifact).not.toContain(localFallback);
    }
    expect(dockerfile).not.toContain('ARG OPERATOR_AUDIT_FINGERPRINT_SECRET');
    expect(dockerfile).not.toContain('ENV OPERATOR_AUDIT_FINGERPRINT_SECRET');
  });

  it('keeps conversation summary model calls safely Mock by default in Docker', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const serverService = extractYamlSection(compose, '  server:', 2);

    expect(serverService).toContain(
      'AI_PROVIDER_MODE: ${AI_PROVIDER_MODE:-mock}',
    );
    expect(serverService).toContain(
      'AI_ENABLE_LIVE_CALLS: ${AI_ENABLE_LIVE_CALLS:-false}',
    );
    expect(serverService).not.toContain('env_file:');
    expect(serverService).toContain('NODE_ENV: production');
    expect(serverService).toContain('AI_MODEL: ${AI_MODEL:-deepseek-v4-flash}');
    expect(serverService).toContain(
      'AI_BASE_URL: ${AI_BASE_URL:-https://api.deepseek.com/v1}',
    );
    expect(serverService).toContain('DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}');
    expect(serverService).toContain('OPENAI_API_KEY: ${OPENAI_API_KEY:-}');
    expect(serverService).toContain(
      'CONVERSATION_SUMMARY_MAX_CALLS: ${CONVERSATION_SUMMARY_MAX_CALLS:-1}',
    );
    expect(serverService).toContain(
      'CONVERSATION_SUMMARY_MAX_INPUT_TOKENS: ${CONVERSATION_SUMMARY_MAX_INPUT_TOKENS:-1600}',
    );
    expect(serverService).toContain(
      'CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS: ${CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS:-400}',
    );
    expect(serverService).toContain(
      'CONVERSATION_SUMMARY_TIMEOUT_MS: ${CONVERSATION_SUMMARY_TIMEOUT_MS:-8000}',
    );
  });

  it('keeps Docker API and worker on the same explicit Qwen RAG contract', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const server = extractYamlSection(compose, '  server:', 2);
    const worker = extractYamlSection(compose, '  worker:', 2);
    const entries = [
      'RAG_EMBEDDING_PROVIDER: ${RAG_EMBEDDING_PROVIDER:-qwen}',
      'RAG_EMBEDDING_MODEL: ${RAG_EMBEDDING_MODEL:-text-embedding-v4}',
      'RAG_EMBEDDING_BASE_URL: ${RAG_EMBEDDING_BASE_URL:-}',
      'RAG_EMBEDDING_DIMENSIONS: ${RAG_EMBEDDING_DIMENSIONS:-1536}',
      'RAG_EMBEDDING_BATCH_SIZE: ${RAG_EMBEDDING_BATCH_SIZE:-32}',
      'QWEN_API_KEY: ${QWEN_API_KEY:-${Qwen_API_KEY:-${DASHSCOPE_API_KEY:-}}}',
      'RAG_CHUNK_TARGET_TOKENS: ${RAG_CHUNK_TARGET_TOKENS:-650}',
      'RAG_CHUNK_OVERLAP_TOKENS: ${RAG_CHUNK_OVERLAP_TOKENS:-80}',
      'RAG_CHUNK_MAX_TOKENS: ${RAG_CHUNK_MAX_TOKENS:-900}',
      'RAG_MAX_CHUNKS_PER_DOCUMENT: ${RAG_MAX_CHUNKS_PER_DOCUMENT:-500}',
      'EMBEDDING_REQUEST_TIMEOUT_MS: ${EMBEDDING_REQUEST_TIMEOUT_MS:-30000}',
    ];

    for (const entry of entries) {
      expect(server).toContain(entry);
      expect(worker).toContain(entry);
    }
    expect(server).not.toContain('env_file:');
    expect(worker).not.toContain('env_file:');
    expect(server).toContain('NODE_ENV: production');
    expect(worker).toContain('NODE_ENV: production');
  });

  it('keeps audit export processing on the dedicated local Docker worker', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const serverService = extractYamlSection(compose, '  server:', 2);
    const workerService = extractYamlSection(compose, '  worker:', 2);

    expect(serverService).toContain('SERVER_ROLE: api');
    expect(serverService).not.toContain('SERVER_ROLE: ${SERVER_ROLE');
    expect(serverService).toContain(
      'OPERATOR_AUDIT_EXPORT_ENABLED: ${OPERATOR_AUDIT_EXPORT_ENABLED:-true}',
    );
    expect(serverService).not.toContain('OUTBOX_DISPATCHER_ENABLED:');
    expect(serverService).not.toContain('OPERATOR_AUDIT_MAINTENANCE_ENABLED:');

    expect(workerService).toContain('SERVER_ROLE: worker');
    expect(workerService).toContain(
      'OUTBOX_DISPATCHER_ENABLED: ${OUTBOX_DISPATCHER_ENABLED:-true}',
    );
    expect(workerService).toContain(
      'OPERATOR_AUDIT_EXPORT_ENABLED: ${OPERATOR_AUDIT_EXPORT_ENABLED:-true}',
    );
    expect(workerService).toContain(
      'OPERATOR_AUDIT_MAINTENANCE_ENABLED: ${OPERATOR_AUDIT_MAINTENANCE_ENABLED:-true}',
    );
    expect(workerService).toContain(
      'OPERATOR_AUDIT_FINGERPRINT_SECRET: ${OPERATOR_AUDIT_FINGERPRINT_SECRET:-local-dev-audit-fingerprint-change-me}',
    );
    expect(workerService).toContain(
      '/tmp/prepmind-audit-exports:size=201326592,mode=0700,uid=1001,gid=1001',
    );
    expect(compose).toContain('  minio-init:');
  });

  it('keeps the web service wired for local dev AI mode switching', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const webService = extractYamlSection(compose, '  web:', 2);

    expect(webService).toContain('env_file:');
    expect(webService).toContain('- ../.env');
    expect(webService).toContain(
      'PREPMIND_INTERNAL_API_BASE_URL: http://server:3001',
    );
    expect(webService).toContain('PREPMIND_LOCAL_DEV_TOOLS_ENABLED:');
    expect(webService).not.toContain('AI_DEV_MODE_SWITCH_ENABLED: ${');
    expect(webService).not.toContain('AI_PROVIDER_MODE: ${');
    expect(webService).not.toContain('AI_ENABLE_LIVE_CALLS: ${');
    expect(webService).not.toContain('AI_BASE_URL: ${');
    expect(webService).not.toContain('AI_MODEL: ${');
    expect(webService).not.toContain('DEEPSEEK_API_KEY: ${');
    expect(webService).not.toContain('OPENAI_API_KEY: ${');
  });

  it('keeps the admin Dockerfile aligned with the Bun workspace and Next standalone output', () => {
    const dockerfile = readRepoFile('docker/Dockerfile.admin');

    expect(dockerfile).toContain('FROM oven/bun:1.3.14-alpine AS base');
    expect(dockerfile).toContain('COPY apps/admin/package.json ./apps/admin/');
    expect(dockerfile).toContain(
      'COPY packages/types/package.json ./packages/types/',
    );
    expect(dockerfile).toContain('bun install --frozen-lockfile');
    expect(dockerfile).toContain(
      'ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001',
    );
    expect(dockerfile).toContain(
      'ENV PREPMIND_INTERNAL_API_BASE_URL=$PREPMIND_INTERNAL_API_BASE_URL',
    );
    expect(dockerfile).toContain('bun --filter @repo/admin build');
    expect(dockerfile).toContain(
      'COPY --from=builder /app/apps/admin/.next/standalone ./',
    );
    expect(dockerfile).toContain(
      'COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static',
    );
    expect(dockerfile).toContain('EXPOSE 3100');
    expect(dockerfile).toContain('ENV PORT=3100');
    expect(dockerfile).toContain('CMD ["bun", "apps/admin/server.js"]');
  });

  it('wires the admin Docker service and learning app admin console URL', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const adminService = extractYamlSection(compose, '  admin:', 2);
    const webService = extractYamlSection(compose, '  web:', 2);

    expect(adminService).toContain('dockerfile: docker/Dockerfile.admin');
    expect(adminService).toContain('"3100:3100"');
    expect(adminService).toContain('depends_on:');
    expect(adminService).toContain('- server');
    expect(adminService).toContain(
      'NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_ADMIN_API_BASE_URL:-http://127.0.0.1:3001}',
    );
    expect(adminService).toContain(
      'PREPMIND_INTERNAL_API_BASE_URL: http://server:3001',
    );
    expect(webService).toContain(
      'NEXT_PUBLIC_ADMIN_CONSOLE_URL: ${NEXT_PUBLIC_ADMIN_CONSOLE_URL:-http://127.0.0.1:3100}',
    );
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
