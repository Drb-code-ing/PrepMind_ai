import fs from 'node:fs';
import path from 'node:path';

describe('Docker Compose worker readiness healthcheck', () => {
  it('configures the worker service to run the readiness CLI', () => {
    const compose = fs.readFileSync(
      path.resolve(__dirname, '../../../../docker/docker-compose.dev.yml'),
      'utf8',
    );
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
