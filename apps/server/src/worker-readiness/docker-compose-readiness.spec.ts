import fs from 'node:fs';
import path from 'node:path';

describe('Docker Compose worker readiness healthcheck', () => {
  it('keeps the server Dockerfile aligned with the Bun workspace and build output', () => {
    const dockerfile = readRepoFile('docker/Dockerfile.server');

    expect(dockerfile).toContain('COPY bun.lock package.json');
    expect(dockerfile).not.toContain('pnpm-lock.yaml');
    expect(dockerfile).not.toContain('pnpm-workspace.yaml');
    expect(dockerfile).toContain('bun install --frozen-lockfile');
    expect(dockerfile).toContain('bun --filter @repo/server build');
    expect(dockerfile).toContain('CMD ["node", "dist/src/main.js"]');
  });

  it('configures the worker service to run the readiness CLI', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const workerService = extractYamlSection(compose, '  worker:', 2);

    expect(workerService).toContain('healthcheck:');
    expect(workerService).toContain('node dist/scripts/worker-readiness.js');
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
