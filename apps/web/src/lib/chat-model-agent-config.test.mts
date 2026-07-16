import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import { register } from 'node:module';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'server-only') {
        return { url: 'data:text/javascript,export default undefined', shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `)}`,
  import.meta.url,
);

const { resolveChatModelAgentConfig } = await import('./chat-model-agent-config.ts');

const LIVE_DEEPSEEK_ENV = {
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  ROUTER_MODEL_ENABLED: 'true',
  KNOWLEDGE_VERIFIER_MODEL_ENABLED: 'true',
  DEEPSEEK_API_KEY: 'deepseek_test_canary',
  AI_BASE_URL: 'https://api.deepseek.com',
};

test('provider config resolution is explicitly server-only', async () => {
  const source = await readFile(new URL('./chat-model-agent-config.ts', import.meta.url), 'utf8');
  assert.equal(source.split(/\r?\n/u)[0], "import 'server-only';");
});

test('Docker Web resolved allowlist keeps the server-side live Router and Verifier route config', () => {
  const originalQwenApiKey = process.env.QWEN_API_KEY;
  process.env.QWEN_API_KEY = 'host_only_qwen_fixture_canary';
  let environments: ReturnType<typeof resolveWebEnvironmentFromSafeRootFixture>;
  try {
    environments = resolveWebEnvironmentFromSafeRootFixture();
  } finally {
    if (originalQwenApiKey === undefined) delete process.env.QWEN_API_KEY;
    else process.env.QWEN_API_KEY = originalQwenApiKey;
  }
  const env = environments.web;
  const config = resolveChatModelAgentConfig(env);

  assert.deepEqual(
    {
      mode: config.mode,
      liveCallsEnabled: config.liveCallsEnabled,
      routerEnabled: config.routerEnabled,
      verifierEnabled: config.verifierEnabled,
      configured: config.configured,
      provider: config.provider,
      credentialSource: config.credentialSource,
      model: config.model,
    },
    {
      mode: 'live',
      liveCallsEnabled: true,
      routerEnabled: true,
      verifierEnabled: true,
      configured: true,
      provider: 'deepseek',
      credentialSource: 'deepseek',
      model: 'deepseek-v4-flash',
    },
  );
  for (const forbiddenVariable of [
    'REVIEW_AGENT_MODEL_ENABLED',
    'PLANNER_AGENT_MODEL_ENABLED',
    'REVIEW_AGENT_MODEL_TIMEOUT_MS',
    'PLANNER_AGENT_MODEL_TIMEOUT_MS',
  ]) {
    assert.equal(Object.hasOwn(env, forbiddenVariable), false);
  }
  assert.equal(env.DEEPSEEK_API_KEY, 'safe_fixture_deepseek_key');
  assert.equal(env.OPENAI_API_KEY, '');
  assert.equal(environments.server.QWEN_API_KEY, '');
});

test('empty environment resolves to the exact safe disabled config', () => {
  assert.deepEqual(resolveChatModelAgentConfig({}), {
    mode: 'mock',
    liveCallsEnabled: false,
    routerEnabled: false,
    verifierEnabled: false,
    routerTimeoutMs: 5000,
    verifierTimeoutMs: 4000,
    provider: 'mock',
    model: 'mock-agent-candidate',
    credentialSource: 'none',
    configured: true,
    disabledReason: 'agent_gates_disabled',
  });
});

test('only exact true enables global and per-agent gates', () => {
  for (const value of ['TRUE', 'True', '1', ' true', 'true ']) {
    const globalDisabled = resolveChatModelAgentConfig({
      ...LIVE_DEEPSEEK_ENV,
      AI_ENABLE_LIVE_CALLS: value,
    });
    assert.equal(globalDisabled.liveCallsEnabled, false);
    assert.equal(globalDisabled.routerEnabled, false);
    assert.equal(globalDisabled.verifierEnabled, false);
    assert.equal(globalDisabled.disabledReason, 'global_live_disabled');

    const routerDisabled = resolveChatModelAgentConfig({
      ...LIVE_DEEPSEEK_ENV,
      ROUTER_MODEL_ENABLED: value,
    });
    assert.equal(routerDisabled.routerEnabled, false);
    assert.equal(routerDisabled.verifierEnabled, true);

    const verifierDisabled = resolveChatModelAgentConfig({
      ...LIVE_DEEPSEEK_ENV,
      KNOWLEDGE_VERIFIER_MODEL_ENABLED: value,
    });
    assert.equal(verifierDisabled.routerEnabled, true);
    assert.equal(verifierDisabled.verifierEnabled, false);
  }
});

test('requires live mode, the global guard, an agent gate, and valid provider config', () => {
  const mockMode = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    AI_PROVIDER_MODE: 'mock',
  });
  assert.equal(mockMode.mode, 'mock');
  assert.equal(mockMode.routerEnabled, false);
  assert.equal(mockMode.verifierEnabled, false);
  assert.equal(mockMode.disabledReason, 'mock_mode');

  const noAgentGates = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    ROUTER_MODEL_ENABLED: 'false',
    KNOWLEDGE_VERIFIER_MODEL_ENABLED: 'false',
  });
  assert.equal(noAgentGates.configured, true);
  assert.equal(noAgentGates.disabledReason, 'agent_gates_disabled');
});

test('classifies official DeepSeek and OpenAI endpoints with matching credentials', () => {
  const deepseek = resolveChatModelAgentConfig(LIVE_DEEPSEEK_ENV);
  assert.deepEqual(
    {
      provider: deepseek.provider,
      model: deepseek.model,
      credentialSource: deepseek.credentialSource,
      configured: deepseek.configured,
      routerEnabled: deepseek.routerEnabled,
      verifierEnabled: deepseek.verifierEnabled,
    },
    {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      credentialSource: 'deepseek',
      configured: true,
      routerEnabled: true,
      verifierEnabled: true,
    },
  );

  const openai = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: 'openai_test_canary',
    AI_BASE_URL: 'https://api.openai.com/v1',
  });
  assert.equal(openai.provider, 'openai');
  assert.equal(openai.model, 'gpt-4o-mini');
  assert.equal(openai.credentialSource, 'openai');
  assert.equal(openai.configured, true);
});

test('binds DeepSeek vendor-family hosts to the DeepSeek key even when both keys exist', () => {
  for (const AI_BASE_URL of [
    'https://deepseek.com',
    'https://api.deepseek.com',
    'https://proxy.deepseek.com/v1',
    'https://api.deepseek.com./v1',
    'https://api.deepseek.com%2e/v1',
  ]) {
    const config = resolveChatModelAgentConfig({
      ...LIVE_DEEPSEEK_ENV,
      AI_BASE_URL,
      DEEPSEEK_API_KEY: 'deepseek_matching_canary',
      OPENAI_API_KEY: 'openai_nonmatching_canary',
    });
    assert.equal(config.configured, true);
    assert.equal(config.provider, 'deepseek');
    assert.equal(config.credentialSource, 'deepseek');
    assert.equal(config.routerEnabled, true);
    assert.equal(config.verifierEnabled, true);
  }
});

test('binds OpenAI vendor-family hosts to the OpenAI key even when both keys exist', () => {
  for (const AI_BASE_URL of [
    'https://openai.com',
    'https://api.openai.com/v1',
    'https://platform.openai.com/v1',
    'https://platform.openai.com./v1',
  ]) {
    const config = resolveChatModelAgentConfig({
      ...LIVE_DEEPSEEK_ENV,
      AI_BASE_URL,
      DEEPSEEK_API_KEY: 'deepseek_nonmatching_canary',
      OPENAI_API_KEY: 'openai_matching_canary',
    });
    assert.equal(config.configured, true);
    assert.equal(config.provider, 'openai');
    assert.equal(config.credentialSource, 'openai');
    assert.equal(config.routerEnabled, true);
    assert.equal(config.verifierEnabled, true);
  }
});

test('rejects vendor-family hosts when only the wrong provider key exists', () => {
  for (const env of [
    {
      ...LIVE_DEEPSEEK_ENV,
      AI_BASE_URL: 'https://proxy.deepseek.com/v1',
      DEEPSEEK_API_KEY: '',
      OPENAI_API_KEY: 'openai_wrong_canary',
    },
    {
      ...LIVE_DEEPSEEK_ENV,
      AI_BASE_URL: 'https://platform.openai.com/v1',
      DEEPSEEK_API_KEY: 'deepseek_wrong_canary',
      OPENAI_API_KEY: '',
    },
    {
      ...LIVE_DEEPSEEK_ENV,
      AI_BASE_URL: 'https://api.deepseek.com./v1',
      DEEPSEEK_API_KEY: '',
      OPENAI_API_KEY: 'openai_wrong_root_dot_canary',
    },
    {
      ...LIVE_DEEPSEEK_ENV,
      AI_BASE_URL: 'https://api.deepseek.com%2e/v1',
      DEEPSEEK_API_KEY: '',
      OPENAI_API_KEY: 'openai_wrong_encoded_root_dot_canary',
    },
    {
      ...LIVE_DEEPSEEK_ENV,
      AI_BASE_URL: 'https://platform.openai.com./v1',
      DEEPSEEK_API_KEY: 'deepseek_wrong_root_dot_canary',
      OPENAI_API_KEY: '',
    },
  ]) {
    const config = resolveChatModelAgentConfig(env);
    assert.equal(config.configured, false);
    assert.equal(config.routerEnabled, false);
    assert.equal(config.verifierEnabled, false);
    assert.equal(config.disabledReason, 'invalid_provider_config');
  }
});

test('treats suffix-spoof hosts as custom hosts with the single-key rule', () => {
  const singleKey = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    AI_BASE_URL: 'https://evil-deepseek.com./v1',
  });
  assert.equal(singleKey.configured, true);
  assert.equal(singleKey.provider, 'deepseek');
  assert.equal(singleKey.credentialSource, 'deepseek');

  const bothKeys = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    AI_BASE_URL: 'https://evil-deepseek.com./v1',
    OPENAI_API_KEY: 'openai_custom_canary',
  });
  assert.equal(bothKeys.configured, false);
  assert.equal(bothKeys.disabledReason, 'invalid_provider_config');
});

test('rejects official host and credential mismatches', () => {
  for (const env of [
    { ...LIVE_DEEPSEEK_ENV, DEEPSEEK_API_KEY: '', OPENAI_API_KEY: 'openai_canary' },
    {
      ...LIVE_DEEPSEEK_ENV,
      DEEPSEEK_API_KEY: 'deepseek_canary',
      AI_BASE_URL: 'https://api.openai.com/v1',
    },
  ]) {
    const config = resolveChatModelAgentConfig(env);
    assert.equal(config.configured, false);
    assert.equal(config.routerEnabled, false);
    assert.equal(config.verifierEnabled, false);
    assert.equal(config.disabledReason, 'invalid_provider_config');
  }
});

test('rejects unsafe URLs and ambiguous custom-host credentials', () => {
  const invalidBaseURLs = [
    'http://api.deepseek.com',
    'https://user:password@api.deepseek.com',
    'https://api.deepseek.com/v1?credential=canary',
    'https://api.deepseek.com/v1#canary',
    'not a url',
  ];
  for (const AI_BASE_URL of invalidBaseURLs) {
    const config = resolveChatModelAgentConfig({ ...LIVE_DEEPSEEK_ENV, AI_BASE_URL });
    assert.equal(config.configured, false);
    assert.equal(config.disabledReason, 'invalid_provider_config');
  }

  const ambiguous = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    AI_BASE_URL: 'https://models.example.test/v1',
    OPENAI_API_KEY: 'openai_canary',
  });
  assert.equal(ambiguous.configured, false);
  assert.equal(ambiguous.disabledReason, 'invalid_provider_config');
});

test('classifies a safe custom host from its single credential source', () => {
  const deepseek = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    AI_BASE_URL: 'https://models.example.test/v1',
  });
  assert.equal(deepseek.provider, 'deepseek');
  assert.equal(deepseek.credentialSource, 'deepseek');
  assert.equal(deepseek.configured, true);

  const openai = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: 'openai_canary',
    AI_BASE_URL: 'https://models.example.test/v1',
  });
  assert.equal(openai.provider, 'openai');
  assert.equal(openai.credentialSource, 'openai');
  assert.equal(openai.configured, true);
});

test('uses timeout defaults and accepts only bounded safe integers', () => {
  const configured = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    ROUTER_MODEL_TIMEOUT_MS: '1000',
    KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS: '10000',
  });
  assert.equal(configured.routerTimeoutMs, 1000);
  assert.equal(configured.verifierTimeoutMs, 10000);

  for (const invalid of ['999', '10001', 'NaN', '1.5']) {
    const config = resolveChatModelAgentConfig({
      ...LIVE_DEEPSEEK_ENV,
      ROUTER_MODEL_TIMEOUT_MS: invalid,
    });
    assert.equal(config.configured, false);
    assert.equal(config.routerTimeoutMs, 5000);
    assert.equal(config.verifierTimeoutMs, 4000);
    assert.equal(config.disabledReason, 'invalid_provider_config');
  }
});

test('hostile environment access fails closed to a fixed safe config', () => {
  const canary = 'hostile_env_secret_canary';
  const env = new Proxy(
    {},
    {
      get() {
        throw new Error(canary);
      },
    },
  );

  const config = resolveChatModelAgentConfig(env);
  assert.equal(config.configured, false);
  assert.equal(config.disabledReason, 'invalid_provider_config');
  assert.equal(config.routerEnabled, false);
  assert.equal(config.verifierEnabled, false);
  assert.equal(JSON.stringify(config).includes(canary), false);
});

test('public config JSON never exposes credentials, URLs, raw errors, or secret fields', () => {
  const canary = 'public_config_secret_canary';
  const config = resolveChatModelAgentConfig({
    ...LIVE_DEEPSEEK_ENV,
    DEEPSEEK_API_KEY: canary,
    AI_BASE_URL: `https://${canary}.example.test/v1`,
    AI_MODEL: 'safe-model-v1',
  });
  const serialized = JSON.stringify(config);

  assert.equal(serialized.includes(canary), false);
  assert.equal('apiKey' in config, false);
  assert.equal('key' in config, false);
  assert.equal('baseURL' in config, false);
  assert.equal('baseUrl' in config, false);
  assert.deepEqual(Object.keys(config).sort(), [
    'configured',
    'credentialSource',
    'liveCallsEnabled',
    'mode',
    'model',
    'provider',
    'routerEnabled',
    'routerTimeoutMs',
    'verifierEnabled',
    'verifierTimeoutMs',
  ]);
});

function resolveWebEnvironmentFromSafeRootFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prepmind-web-compose-'));
  const dockerDirectory = path.join(root, 'docker');
  const composePath = path.join(dockerDirectory, 'docker-compose.dev.yml');
  const envPath = path.join(root, '.env');

  try {
    fs.mkdirSync(dockerDirectory, { recursive: true });
    fs.copyFileSync(
      new URL('../../../../docker/docker-compose.dev.yml', import.meta.url),
      composePath,
    );
    fs.writeFileSync(
      envPath,
      [
        'NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001',
        'AI_PROVIDER_MODE=live',
        'AI_ENABLE_LIVE_CALLS=true',
        'AI_MODEL=deepseek-v4-flash',
        'ROUTER_MODEL_ENABLED=true',
        'KNOWLEDGE_VERIFIER_MODEL_ENABLED=true',
        'DEEPSEEK_API_KEY=safe_fixture_deepseek_key',
        'OPENAI_API_KEY=',
        'AI_BASE_URL=https://api.deepseek.com/v1',
        'REVIEW_AGENT_MODEL_ENABLED=true',
        'PLANNER_AGENT_MODEL_ENABLED=true',
        'REVIEW_AGENT_MODEL_TIMEOUT_MS=4500',
        'PLANNER_AGENT_MODEL_TIMEOUT_MS=4500',
      ].join('\n'),
      'utf8',
    );
    const output = execFileSync(
      'docker',
      ['compose', '--env-file', envPath, '-f', composePath, 'config', '--format', 'json'],
      {
        cwd: root,
        env: composeFixtureEnvironment(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    const resolved = JSON.parse(output) as {
      services?: Record<string, { environment?: Record<string, string> }>;
    };
    return {
      web: resolved.services?.web?.environment ?? {},
      server: resolved.services?.server?.environment ?? {},
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function composeFixtureEnvironment() {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of COMPOSE_FIXTURE_OS_ENVIRONMENT_NAMES) {
    const value = process.env[name];
    if (value !== undefined) environment[name] = value;
  }
  return environment;
}

const COMPOSE_FIXTURE_OS_ENVIRONMENT_NAMES = [
  'ALLUSERSPROFILE', 'APPDATA', 'COMSPEC', 'ComSpec', 'CommonProgramFiles',
  'CommonProgramFiles(x86)', 'CommonProgramW6432', 'DOCKER_CONFIG', 'HOME',
  'HOMEDRIVE', 'HOMEPATH', 'LOCALAPPDATA', 'NUMBER_OF_PROCESSORS', 'OS',
  'Path', 'PATH', 'PATHEXT', 'PROCESSOR_ARCHITECTURE', 'PROCESSOR_ARCHITEW6432',
  'ProgramData', 'PROGRAMDATA', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432',
  'SystemDrive', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERDOMAIN', 'USERNAME',
  'USERPROFILE', 'WINDIR', 'XDG_CONFIG_HOME', 'XDG_RUNTIME_DIR',
] as const;
