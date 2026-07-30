import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION,
  runPhase697ArchitectureRecoveryProxyPreflight,
  type Phase697ArchitectureRecoveryProxyPreflightProbeInput,
} from '../src/phase-6-9-7-architecture-recovery-proxy-preflight.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CLI_VERSION,
  runPhase697ArchitectureRecoveryProxyPreflightCli,
} from '../src/phase-6-9-7-architecture-recovery-proxy-preflight-cli.ts';

const SENTINEL_PROXY = 'http://sentinel-proxy-value.invalid:8123';
const SENTINEL_ERROR = 'proxy preflight raw error must not escape';
const LOOPBACK_PROXY = 'http://127.0.0.1:7897';

describe('Phase 6.9.7 Architecture Recovery proxy preflight', () => {
  test('freezes a bounded zero-Provider contract', () => {
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-proxy-preflight-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CLI_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-proxy-preflight-cli-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS).toBe(250);
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES).toContain(
      'loopback_proxy_unavailable',
    );
    expect(Object.isFrozen(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES)).toBe(true);
  });

  test('allows a direct environment without probing or reading unrelated secrets', async () => {
    let probes = 0;
    const report = await run({ UNRELATED_SECRET: SENTINEL_PROXY }, async () => {
      probes += 1;
      return true;
    });

    expect(report).toEqual({
      version: 'phase-6.9.7-architecture-recovery-proxy-preflight-v1',
      ok: true,
      code: 'direct_ready',
      mode: 'direct',
      configuredProxyVariables: 0,
      listener: 'not_required',
      listenerProbeCalls: 0,
      providerCalls: 0,
    });
    expect(probes).toBe(0);
    expect(Object.isFrozen(report)).toBe(true);
    expect(JSON.stringify(report)).not.toContain(SENTINEL_PROXY);
  });

  test('accepts one coherent loopback proxy only after one bounded listener probe', async () => {
    const observed: Phase697ArchitectureRecoveryProxyPreflightProbeInput[] = [];
    const report = await run(currentProxyEnvironment(), async (input) => {
      observed.push(input);
      return true;
    });

    expect(report).toMatchObject({
      ok: true,
      code: 'loopback_proxy_ready',
      mode: 'loopback_proxy',
      configuredProxyVariables: 4,
      listener: 'listening',
      listenerProbeCalls: 1,
      providerCalls: 0,
    });
    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({ host: '127.0.0.1', port: 7897, timeoutMs: 250 });
  });

  test('blocks the observed loopback proxy before Provider work when no listener exists', async () => {
    const report = await run(currentProxyEnvironment(), async () => false);

    expect(report).toMatchObject({
      ok: false,
      code: 'loopback_proxy_unavailable',
      mode: 'loopback_proxy',
      configuredProxyVariables: 4,
      listener: 'unavailable',
      listenerProbeCalls: 1,
      providerCalls: 0,
    });
  });

  test('accepts an explicit IPv6 loopback proxy without exposing its URL', async () => {
    let observed: Phase697ArchitectureRecoveryProxyPreflightProbeInput | null = null;
    const report = await run({ HTTPS_PROXY: 'http://[::1]:7897' }, async (input) => {
      observed = input;
      return true;
    });

    expect(report.code).toBe('loopback_proxy_ready');
    expect(observed).toMatchObject({ host: '::1', port: 7897 });
    expect(JSON.stringify(report)).not.toContain('::1');
  });

  test('rejects NO_PROXY rather than guessing target bypass semantics', async () => {
    for (const key of ['NO_PROXY', 'no_proxy']) {
      let probes = 0;
      const report = await run({ [key]: 'api.deepseek.com' }, async () => {
        probes += 1;
        return true;
      });
      expect(report.code, key).toBe('no_proxy_unsupported');
      expect(report.providerCalls, key).toBe(0);
      expect(probes, key).toBe(0);
    }
  });

  test('rejects conflicting uppercase and lowercase proxy authority', async () => {
    const report = await run(
      { HTTPS_PROXY: LOOPBACK_PROXY, https_proxy: 'http://127.0.0.1:7898' },
      async () => true,
    );

    expect(report).toMatchObject({
      ok: false,
      code: 'proxy_config_conflict',
      configuredProxyVariables: 2,
      listenerProbeCalls: 0,
      providerCalls: 0,
    });
  });

  test('rejects malformed, credential-bearing, unsupported, and ambiguous proxy URLs', async () => {
    const cases: ReadonlyArray<readonly [string, string, string]> = [
      ['missing scheme', '127.0.0.1:7897', 'proxy_url_invalid'],
      ['HTTPS proxy scheme', 'https://127.0.0.1:7897', 'proxy_scheme_unsupported'],
      ['credentials', 'http://user:password@127.0.0.1:7897', 'proxy_credentials_forbidden'],
      ['public host', SENTINEL_PROXY, 'proxy_host_unsupported'],
      ['private host', 'http://192.168.1.10:7897', 'proxy_host_unsupported'],
      ['localhost hostname', 'http://localhost:7897', 'proxy_host_unsupported'],
      ['missing port', 'http://127.0.0.1', 'proxy_port_invalid'],
      ['path', 'http://127.0.0.1:7897/proxy', 'proxy_url_invalid'],
      ['query', 'http://127.0.0.1:7897/?key=sentinel', 'proxy_url_invalid'],
      ['fragment', 'http://127.0.0.1:7897/#sentinel', 'proxy_url_invalid'],
      ['outer whitespace', ` ${LOOPBACK_PROXY}`, 'proxy_environment_invalid'],
    ];

    for (const [label, proxy, code] of cases) {
      let probes = 0;
      const report = await run({ HTTPS_PROXY: proxy }, async () => {
        probes += 1;
        return true;
      });
      expect(report.code, label).toBe(code);
      expect(report.providerCalls, label).toBe(0);
      expect(probes, label).toBe(0);
      const safe = JSON.stringify(report);
      expect(safe, label).not.toContain(proxy);
      expect(safe, label).not.toContain('password');
      expect(safe, label).not.toContain('sentinel-proxy-value');
    }
  });

  test('never invokes environment getters and safely rejects hostile descriptor traps', async () => {
    let getterReads = 0;
    const accessorEnvironment: Record<string, unknown> = {};
    Object.defineProperty(accessorEnvironment, 'HTTPS_PROXY', {
      enumerable: true,
      get() {
        getterReads += 1;
        return SENTINEL_PROXY;
      },
    });
    const accessorReport = await run(accessorEnvironment, async () => true);
    expect(accessorReport.code).toBe('proxy_environment_invalid');
    expect(getterReads).toBe(0);

    let trapCalls = 0;
    const hostileEnvironment = new Proxy(Object.create(null) as Record<string, unknown>, {
      getOwnPropertyDescriptor() {
        trapCalls += 1;
        throw new Error(SENTINEL_ERROR);
      },
    });
    const hostileReport = await run(hostileEnvironment, async () => true);
    expect(hostileReport.code).toBe('proxy_environment_invalid');
    expect(trapCalls).toBeGreaterThan(0);
    expect(JSON.stringify(hostileReport)).not.toContain(SENTINEL_ERROR);
  });

  test('collapses listener probe failures and raw errors into one bounded code', async () => {
    const report = await run({ HTTPS_PROXY: LOOPBACK_PROXY }, async () => {
      throw new Error(SENTINEL_ERROR);
    });

    expect(report).toMatchObject({
      ok: false,
      code: 'listener_probe_failed',
      listener: 'probe_failed',
      listenerProbeCalls: 1,
      providerCalls: 0,
    });
    expect(JSON.stringify(report)).not.toContain(SENTINEL_ERROR);
  });

  test('enforces the 250ms watchdog when a listener probe never settles', async () => {
    const report = await Promise.race([
      run({ HTTPS_PROXY: LOOPBACK_PROXY }, () => new Promise<boolean>(() => undefined)),
      rejectAfter(750),
    ]);

    expect(report).toMatchObject({
      ok: false,
      code: 'loopback_proxy_unavailable',
      listener: 'unavailable',
      listenerProbeCalls: 1,
      providerCalls: 0,
    });
  });

  test('does not wait for the watchdog when a hanging listener probe is aborted', async () => {
    const controller = new AbortController();
    const pending = runPhase697ArchitectureRecoveryProxyPreflight(
      { env: { HTTPS_PROXY: LOOPBACK_PROXY }, signal: controller.signal },
      {
        probeLoopbackListener: () => new Promise<boolean>(() => undefined),
      },
    );
    queueMicrotask(() => controller.abort());
    const report = await Promise.race([pending, rejectAfter(750)]);

    expect(report).toMatchObject({
      ok: false,
      code: 'aborted',
      listener: 'aborted',
      listenerProbeCalls: 1,
      providerCalls: 0,
    });
  });

  test('honors abort before and during the local probe without Provider work', async () => {
    const before = new AbortController();
    before.abort();
    let beforeProbes = 0;
    const beforeReport = await runPhase697ArchitectureRecoveryProxyPreflight(
      { env: currentProxyEnvironment(), signal: before.signal },
      {
        async probeLoopbackListener() {
          beforeProbes += 1;
          return true;
        },
      },
    );
    expect(beforeReport).toMatchObject({
      code: 'aborted',
      listenerProbeCalls: 0,
      providerCalls: 0,
    });
    expect(beforeProbes).toBe(0);

    const during = new AbortController();
    const duringReport = await runPhase697ArchitectureRecoveryProxyPreflight(
      { env: currentProxyEnvironment(), signal: during.signal },
      {
        async probeLoopbackListener() {
          during.abort();
          return false;
        },
      },
    );
    expect(duringReport).toMatchObject({
      code: 'aborted',
      listener: 'aborted',
      listenerProbeCalls: 1,
      providerCalls: 0,
    });
  });

  test('keeps the CLI argument-free and emits only the bounded report', async () => {
    const lines: string[] = [];
    let probes = 0;
    const exitCode = await runPhase697ArchitectureRecoveryProxyPreflightCli(
      {
        args: [],
        env: currentProxyEnvironment(),
        signal: new AbortController().signal,
      },
      {
        async probeLoopbackListener() {
          probes += 1;
          return false;
        },
        write(line) {
          lines.push(line);
        },
      },
    );
    expect(exitCode).toBe(1);
    expect(probes).toBe(1);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      cliVersion: 'phase-6.9.7-architecture-recovery-proxy-preflight-cli-v1',
      ok: false,
      code: 'loopback_proxy_unavailable',
      providerCalls: 0,
    });
    expect(lines[0]).not.toContain(LOOPBACK_PROXY);

    const rejectedLines: string[] = [];
    const rejected = await runPhase697ArchitectureRecoveryProxyPreflightCli(
      {
        args: ['live'],
        env: {},
        signal: new AbortController().signal,
      },
      {
        async probeLoopbackListener() {
          throw new Error('must_not_probe');
        },
        write(line) {
          rejectedLines.push(line);
        },
      },
    );
    expect(rejected).toBe(1);
    expect(JSON.parse(rejectedLines[0] ?? '{}')).toEqual({
      version: 'phase-6.9.7-architecture-recovery-proxy-preflight-cli-v1',
      ok: false,
      code: 'proxy_preflight_cli_argument_invalid',
      providerCalls: 0,
    });
  });
});

async function run(
  env: Record<string, unknown>,
  probeLoopbackListener: (
    input: Phase697ArchitectureRecoveryProxyPreflightProbeInput,
  ) => Promise<boolean>,
) {
  return runPhase697ArchitectureRecoveryProxyPreflight(
    { env, signal: new AbortController().signal },
    { probeLoopbackListener },
  );
}

function currentProxyEnvironment(): Record<string, unknown> {
  return {
    HTTP_PROXY: LOOPBACK_PROXY,
    HTTPS_PROXY: LOOPBACK_PROXY,
    http_proxy: LOOPBACK_PROXY,
    https_proxy: LOOPBACK_PROXY,
  };
}

function rejectAfter(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    const timeout = setTimeout(() => reject(new Error('proxy_preflight_timeout')), timeoutMs);
    timeout.unref?.();
  });
}
