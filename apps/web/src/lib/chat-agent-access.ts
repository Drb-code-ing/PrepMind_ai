import 'server-only';

import {
  createAgentAuthReceiptV1,
  createAgentExecutionContextV1,
  type AgentExecutionContextV1,
} from '@repo/agent/realtime-chat';
import { authUserSchema, type AuthUser } from '@repo/types/api/auth';

type ChatMode = 'mock' | 'live';

type CanonicalChatAccessFailureReason =
  'login_required' | 'invalid_session' | 'request_aborted' | 'principal_binding_invalid';

type CanonicalChatAccessFailure = Readonly<{
  ok: false;
  status: 401 | 499 | 500;
  error: string;
  reasonCode: CanonicalChatAccessFailureReason;
}>;

export type CanonicalChatAgentAccess = Readonly<{
  kind: 'canonical-chat-agent-access-v1';
  executionContext: AgentExecutionContextV1;
}>;

type BearerTokenCapability = Readonly<{
  kind: 'chat-bearer-token-capability-v1';
}>;

type CanonicalChatAccessBinding = Readonly<{
  request: Request;
  executionContext: AgentExecutionContextV1;
  bearerToken: BearerTokenCapability | null;
}>;

type ResolveCanonicalChatAgentAccessInput = Readonly<{
  mode: ChatMode;
  accessToken: string | null;
  request: Request;
  runId: string;
  requestId: string;
  deadlineAt: string;
  signal: AbortSignal;
}>;

type ResolveCanonicalChatAgentAccessDependencies = Readonly<{
  authenticate: (input: Readonly<{ accessToken: string; signal: AbortSignal }>) => Promise<unknown>;
}>;

const bearerTokenValues = new WeakMap<BearerTokenCapability, string>();
const canonicalAccessBindings = new WeakMap<CanonicalChatAgentAccess, CanonicalChatAccessBinding>();

const LOGIN_REQUIRED_FAILURE = Object.freeze({
  ok: false as const,
  status: 401 as const,
  error: 'Live AI chat requires login.',
  reasonCode: 'login_required' as const,
});
const INVALID_SESSION_FAILURE = Object.freeze({
  ok: false as const,
  status: 401 as const,
  error: 'Chat requires a valid login session.',
  reasonCode: 'invalid_session' as const,
});
const REQUEST_ABORTED_FAILURE = Object.freeze({
  ok: false as const,
  status: 499 as const,
  error: 'Chat request was aborted.',
  reasonCode: 'request_aborted' as const,
});
const PRINCIPAL_BINDING_FAILURE = Object.freeze({
  ok: false as const,
  status: 500 as const,
  error: 'Chat authorization context is unavailable.',
  reasonCode: 'principal_binding_invalid' as const,
});

export async function resolveCanonicalChatAgentAccess(
  input: ResolveCanonicalChatAgentAccessInput,
  dependencies: ResolveCanonicalChatAgentAccessDependencies,
): Promise<Readonly<{ ok: true; access: CanonicalChatAgentAccess }> | CanonicalChatAccessFailure> {
  if (input.signal.aborted) return REQUEST_ABORTED_FAILURE;

  if (!input.accessToken) {
    if (input.mode === 'live') return LOGIN_REQUIRED_FAILURE;
    const context = createAgentExecutionContextV1(
      {
        runId: input.runId,
        requestId: input.requestId,
        principal: { kind: 'anonymous' },
        deadlineAt: input.deadlineAt,
      },
      { signal: input.signal },
    );
    if (!context.ok) return PRINCIPAL_BINDING_FAILURE;
    return bindCanonicalAccess(input.request, context.value, null);
  }

  let authResponse: AuthUser;
  try {
    const response = await dependencies.authenticate(
      Object.freeze({ accessToken: input.accessToken, signal: input.signal }),
    );
    if (input.signal.aborted) return REQUEST_ABORTED_FAILURE;
    const parsed = authUserSchema.safeParse(response);
    if (!parsed.success) return INVALID_SESSION_FAILURE;
    authResponse = Object.freeze(parsed.data);
  } catch {
    return input.signal.aborted ? REQUEST_ABORTED_FAILURE : INVALID_SESSION_FAILURE;
  }

  const bearerToken = Object.freeze({
    kind: 'chat-bearer-token-capability-v1' as const,
  });
  bearerTokenValues.set(bearerToken, input.accessToken);

  const receipt = createAgentAuthReceiptV1(
    {
      ownerId: authResponse.id,
      authority: 'server_jwt',
    },
    {
      authResponse,
      request: input.request,
      bearerToken,
    },
  );
  if (!receipt.ok) return INVALID_SESSION_FAILURE;

  const context = createAgentExecutionContextV1(
    {
      runId: input.runId,
      requestId: input.requestId,
      principal: {
        kind: 'authenticated',
        ownerId: authResponse.id,
        authority: 'server_jwt',
      },
      deadlineAt: input.deadlineAt,
    },
    {
      signal: input.signal,
      authReceipt: receipt.value,
      authResponse,
      request: input.request,
      bearerToken,
    },
  );
  if (!context.ok) return INVALID_SESSION_FAILURE;

  return bindCanonicalAccess(input.request, context.value, bearerToken);
}

export function readCanonicalChatBearerToken(input: {
  access: CanonicalChatAgentAccess;
  request: Request;
  executionContext: AgentExecutionContextV1;
}): Readonly<{ ok: true; accessToken: string | null }> | CanonicalChatAccessFailure {
  const binding = canonicalAccessBindings.get(input.access);
  if (
    binding === undefined ||
    binding.request !== input.request ||
    binding.executionContext !== input.executionContext ||
    input.access.executionContext !== input.executionContext
  ) {
    return PRINCIPAL_BINDING_FAILURE;
  }

  if (input.executionContext.principal.kind === 'anonymous') {
    return binding.bearerToken === null
      ? { ok: true, accessToken: null }
      : PRINCIPAL_BINDING_FAILURE;
  }

  if (binding.bearerToken === null) return PRINCIPAL_BINDING_FAILURE;
  const accessToken = bearerTokenValues.get(binding.bearerToken);
  if (!accessToken) return PRINCIPAL_BINDING_FAILURE;
  return { ok: true, accessToken };
}

function bindCanonicalAccess(
  request: Request,
  executionContext: AgentExecutionContextV1,
  bearerToken: BearerTokenCapability | null,
): Readonly<{ ok: true; access: CanonicalChatAgentAccess }> {
  const access = Object.freeze({
    kind: 'canonical-chat-agent-access-v1' as const,
    executionContext,
  });
  canonicalAccessBindings.set(access, Object.freeze({ request, executionContext, bearerToken }));
  return Object.freeze({ ok: true as const, access });
}
