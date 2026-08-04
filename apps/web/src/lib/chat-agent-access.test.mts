import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

import type { AuthUser } from '@repo/types/api/auth';

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'server-only') {
        return { url: 'data:text/javascript,export default undefined', shortCircuit: true };
      }
      try {
        return await nextResolve(specifier, context);
      } catch (error) {
        if (/^\\.\\.?\\//u.test(specifier) && !/\\.[cm]?[jt]sx?$/u.test(specifier)) {
          return nextResolve(\`\${specifier}.ts\`, context);
        }
        throw error;
      }
    }
  `)}`,
  import.meta.url,
);

const { readCanonicalChatBearerToken, resolveCanonicalChatAgentAccess } =
  await import('./chat-agent-access.ts');

const DEADLINE_AT = '2026-08-04T12:00:00.000Z';

test('no-token Mock creates an anonymous context without calling auth', async () => {
  const request = makeRequest('anonymous');
  const controller = new AbortController();
  let authCalls = 0;

  const result = await resolveCanonicalChatAgentAccess(
    accessInput({
      mode: 'mock',
      accessToken: null,
      request,
      signal: controller.signal,
    }),
    {
      authenticate: async () => {
        authCalls += 1;
        return authUser('unexpected-owner');
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(authCalls, 0);
  if (!result.ok) return;
  assert.deepEqual(result.access.executionContext.principal, { kind: 'anonymous' });
  assert.equal(result.access.executionContext.signal, controller.signal);
  assert.equal(Object.isFrozen(result.access), true);
  assert.equal(Object.isFrozen(result.access.executionContext), true);
  assert.equal(Object.isFrozen(result.access.executionContext.principal), true);
  assert.throws(() => {
    (result.access.executionContext as unknown as Record<string, unknown>).principal = {
      kind: 'authenticated',
      ownerId: 'forged_owner',
    };
  }, TypeError);
  assert.deepEqual(
    readCanonicalChatBearerToken({
      access: result.access,
      request,
      executionContext: result.access.executionContext,
    }),
    { ok: true, accessToken: null },
  );
});

test('no-token Live is rejected before auth or any Agent runtime can be created', async () => {
  let authCalls = 0;
  const result = await resolveCanonicalChatAgentAccess(
    accessInput({ mode: 'live', accessToken: null }),
    {
      authenticate: async () => {
        authCalls += 1;
        return authUser('unexpected-owner');
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: 'Live AI chat requires login.',
    reasonCode: 'login_required',
  });
  assert.equal(authCalls, 0);
});

test('any non-empty Mock token is authenticated once and owner comes only from AuthUser.id', async () => {
  const request = makeRequest('mock-authenticated');
  const token = 'token_claims_some_other_identity';
  const controller = new AbortController();
  let authCalls = 0;
  const result = await resolveCanonicalChatAgentAccess(
    accessInput({ mode: 'mock', accessToken: token, request, signal: controller.signal }),
    {
      authenticate: async (input) => {
        authCalls += 1;
        assert.equal(input.accessToken, token);
        assert.equal(input.signal, controller.signal);
        return authUser('owner_from_server');
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(authCalls, 1);
  if (!result.ok) return;
  assert.deepEqual(result.access.executionContext.principal, {
    kind: 'authenticated',
    ownerId: 'owner_from_server',
    authority: 'server_jwt',
  });
  assert.deepEqual(
    readCanonicalChatBearerToken({
      access: result.access,
      request,
      executionContext: result.access.executionContext,
    }),
    { ok: true, accessToken: token },
  );
  assert.doesNotMatch(JSON.stringify(result.access), new RegExp(token, 'u'));
});

test('invalid, expired, and malformed auth results fail closed with a fixed 401', async () => {
  for (const authenticate of [
    async () => {
      throw new Error('expired token raw provider detail');
    },
    async () => null,
    async () => ({ id: 'owner_only' }),
    async () =>
      Object.create(null, {
        id: {
          get() {
            throw new Error('hostile getter secret');
          },
        },
      }),
  ]) {
    const result = await resolveCanonicalChatAgentAccess(
      accessInput({ mode: 'mock', accessToken: 'present_bad_token' }),
      { authenticate },
    );
    assert.deepEqual(result, {
      ok: false,
      status: 401,
      error: 'Chat requires a valid login session.',
      reasonCode: 'invalid_session',
    });
    assert.doesNotMatch(
      JSON.stringify(result),
      /expired|provider|getter|secret|present_bad_token/u,
    );
  }
});

test('access, request, and execution-context references cannot be cloned or crossed', async () => {
  const requestA = makeRequest('owner-a');
  const requestB = makeRequest('owner-b');
  const [resultA, resultB] = await Promise.all([
    resolveCanonicalChatAgentAccess(
      accessInput({ mode: 'mock', accessToken: 'token_a', request: requestA, runId: 'run_a' }),
      { authenticate: async () => authUser('owner_a') },
    ),
    resolveCanonicalChatAgentAccess(
      accessInput({ mode: 'mock', accessToken: 'token_b', request: requestB, runId: 'run_b' }),
      { authenticate: async () => authUser('owner_b') },
    ),
  ]);
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  if (!resultA.ok || !resultB.ok) return;

  for (const crossed of [
    {
      access: resultA.access,
      request: requestB,
      executionContext: resultA.access.executionContext,
    },
    {
      access: resultA.access,
      request: requestA,
      executionContext: resultB.access.executionContext,
    },
    {
      access: { ...resultA.access },
      request: requestA,
      executionContext: resultA.access.executionContext,
    },
    {
      access: resultA.access,
      request: requestA,
      executionContext: { ...resultA.access.executionContext },
    },
  ]) {
    assert.deepEqual(readCanonicalChatBearerToken(crossed), {
      ok: false,
      status: 500,
      error: 'Chat authorization context is unavailable.',
      reasonCode: 'principal_binding_invalid',
    });
  }

  assert.deepEqual(
    readCanonicalChatBearerToken({
      access: resultA.access,
      request: requestA,
      executionContext: resultA.access.executionContext,
    }),
    { ok: true, accessToken: 'token_a' },
  );
  assert.deepEqual(
    readCanonicalChatBearerToken({
      access: resultB.access,
      request: requestB,
      executionContext: resultB.access.executionContext,
    }),
    { ok: true, accessToken: 'token_b' },
  );
});

test('two owners resolving in reverse order keep isolated principal and token bindings', async () => {
  const pending = new Map<string, (user: AuthUser) => void>();
  const authenticate = (input: { accessToken: string }) =>
    new Promise<AuthUser>((resolve) => pending.set(input.accessToken, resolve));
  const requestA = makeRequest('concurrent-a');
  const requestB = makeRequest('concurrent-b');
  const promiseA = resolveCanonicalChatAgentAccess(
    accessInput({
      mode: 'mock',
      accessToken: 'concurrent_token_a',
      request: requestA,
      runId: 'run_a',
    }),
    { authenticate },
  );
  const promiseB = resolveCanonicalChatAgentAccess(
    accessInput({
      mode: 'mock',
      accessToken: 'concurrent_token_b',
      request: requestB,
      runId: 'run_b',
    }),
    { authenticate },
  );

  pending.get('concurrent_token_b')?.(authUser('owner_b'));
  const resultB = await promiseB;
  pending.get('concurrent_token_a')?.(authUser('owner_a'));
  const resultA = await promiseA;
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  if (!resultA.ok || !resultB.ok) return;

  assert.equal(resultA.access.executionContext.principal.kind, 'authenticated');
  assert.equal(resultB.access.executionContext.principal.kind, 'authenticated');
  if (
    resultA.access.executionContext.principal.kind !== 'authenticated' ||
    resultB.access.executionContext.principal.kind !== 'authenticated'
  ) {
    return;
  }
  assert.equal(resultA.access.executionContext.principal.ownerId, 'owner_a');
  assert.equal(resultB.access.executionContext.principal.ownerId, 'owner_b');
  const tokenA = readCanonicalChatBearerToken({
    access: resultA.access,
    request: requestA,
    executionContext: resultA.access.executionContext,
  });
  const tokenB = readCanonicalChatBearerToken({
    access: resultB.access,
    request: requestB,
    executionContext: resultB.access.executionContext,
  });
  assert.equal(tokenA.ok, true);
  assert.equal(tokenB.ok, true);
  if (!tokenA.ok || !tokenB.ok) return;
  assert.equal(tokenA.accessToken, 'concurrent_token_a');
  assert.equal(tokenB.accessToken, 'concurrent_token_b');
});

test('pre-abort and auth-time abort return a fixed terminal without retaining raw errors', async () => {
  const preAborted = new AbortController();
  preAborted.abort();
  let preAbortAuthCalls = 0;
  const beforeAuth = await resolveCanonicalChatAgentAccess(
    accessInput({ mode: 'mock', accessToken: 'pre_abort_token', signal: preAborted.signal }),
    {
      authenticate: async () => {
        preAbortAuthCalls += 1;
        return authUser('unexpected_owner');
      },
    },
  );
  assert.equal(preAbortAuthCalls, 0);
  assert.deepEqual(beforeAuth, abortedResult());

  const duringAuth = new AbortController();
  const afterDispatch = await resolveCanonicalChatAgentAccess(
    accessInput({ mode: 'mock', accessToken: 'auth_abort_token', signal: duringAuth.signal }),
    {
      authenticate: async () => {
        duringAuth.abort();
        throw new Error('raw abort transport detail');
      },
    },
  );
  assert.deepEqual(afterDispatch, abortedResult());
  assert.doesNotMatch(JSON.stringify(afterDispatch), /token|transport|raw/u);
});

function accessInput(
  overrides: Partial<{
    mode: 'mock' | 'live';
    accessToken: string | null;
    request: Request;
    runId: string;
    requestId: string;
    deadlineAt: string;
    signal: AbortSignal;
  }> = {},
) {
  return {
    mode: 'mock' as const,
    accessToken: null,
    request: makeRequest('default'),
    runId: 'run_default',
    requestId: 'request_default',
    deadlineAt: DEADLINE_AT,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function makeRequest(label: string) {
  return new Request(`http://localhost/api/chat?case=${label}`);
}

function authUser(id: string): AuthUser {
  return {
    id,
    email: `${id}@example.com`,
    phone: null,
    name: id,
    avatarUrl: null,
    role: 'STUDENT',
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}

function abortedResult() {
  return {
    ok: false,
    status: 499,
    error: 'Chat request was aborted.',
    reasonCode: 'request_aborted',
  } as const;
}
