import fs from 'node:fs';
import path from 'node:path';

describe('Phase 6.9.7 Docker runtime boundaries', () => {
  it('keeps every model capability disabled in the tracked Docker environment example', () => {
    const example = readRepoFile('docker/.env.example');
    const lines = new Set(example.split(/\r?\n/));

    for (const line of [
      'AI_PROVIDER_MODE=mock',
      'AI_ENABLE_LIVE_CALLS=false',
      'ROUTER_MODEL_ENABLED=false',
      'KNOWLEDGE_VERIFIER_MODEL_ENABLED=false',
      'TUTOR_AGENT_MODEL_ENABLED=false',
      'TUTOR_AGENT_MODEL_TIMEOUT_MS=3000',
      'TUTOR_AGENT_DEEPSEEK_API_KEY=',
      'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED=false',
      'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS=5000',
      'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY=',
      'REVIEW_AGENT_MODEL_ENABLED=false',
      'PLANNER_AGENT_MODEL_ENABLED=false',
      'KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=false',
      'KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=false',
    ]) {
      expect(lines).toContain(line);
    }
  });

  it('projects Tutor only to Web and Organizer only to the API server', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const server = extractService(compose, 'server');
    const web = extractService(compose, 'web');

    expect(server).toContain('SERVER_ROLE: api');
    expect(server).toContain(
      'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: ${WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED:-false}',
    );
    expect(server).toContain(
      'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: ${WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS:-5000}',
    );
    expect(server).toContain(
      'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: ${WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY:-}',
    );
    expect(server).not.toContain('TUTOR_AGENT_');

    expect(web).toContain(
      'TUTOR_AGENT_MODEL_ENABLED: ${TUTOR_AGENT_MODEL_ENABLED:-false}',
    );
    expect(web).toContain(
      'TUTOR_AGENT_MODEL_TIMEOUT_MS: ${TUTOR_AGENT_MODEL_TIMEOUT_MS:-3000}',
    );
    expect(web).toContain(
      'TUTOR_AGENT_DEEPSEEK_API_KEY: ${TUTOR_AGENT_DEEPSEEK_API_KEY:-}',
    );
    expect(web).not.toContain('WRONG_QUESTION_ORGANIZER_AGENT_');
  });

  it('does not project either component capability to worker or admin', () => {
    const compose = readRepoFile('docker/docker-compose.dev.yml');
    const worker = extractService(compose, 'worker');
    const admin = extractService(compose, 'admin');

    expect(worker).toContain('SERVER_ROLE: worker');
    expect(worker).not.toContain('TUTOR_AGENT_');
    expect(worker).not.toContain('WRONG_QUESTION_ORGANIZER_AGENT_');

    expect(admin).not.toContain('env_file:');
    expect(admin).not.toContain('TUTOR_AGENT_');
    expect(admin).not.toContain('WRONG_QUESTION_ORGANIZER_AGENT_');
    expect(admin).not.toContain('DEEPSEEK_API_KEY');
    expect(admin).not.toContain('OPENAI_API_KEY');
  });
});

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, '../../../..', relativePath), {
    encoding: 'utf8',
  });
}

function extractService(source: string, serviceName: string) {
  const header = `  ${serviceName}:`;
  const start = source.indexOf(header);
  if (start < 0) throw new Error(`Missing Compose service ${serviceName}`);

  const rest = source.slice(start + header.length);
  const nextService = rest.search(/\n {2}[^\s].*:/);
  return nextService >= 0 ? rest.slice(0, nextService) : rest;
}
