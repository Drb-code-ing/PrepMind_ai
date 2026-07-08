type ValidateAccessToken = (accessToken: string) => Promise<boolean>;

type DevAiModeMutationPolicyResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
    };

export async function validateDevAiModeMutationRequest(input: {
  request: Request;
  accessToken?: string | null;
  validateAccessToken: ValidateAccessToken;
}): Promise<DevAiModeMutationPolicyResult> {
  if (!isLocalDevRequest(input.request)) {
    return {
      ok: false,
      status: 403,
      error: 'Dev AI mode switch only accepts localhost requests.',
    };
  }

  const accessToken = input.accessToken?.trim();
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      error: '需要登录后切换 AI 模式。',
    };
  }

  const tokenValid = await input.validateAccessToken(accessToken);
  if (!tokenValid) {
    return {
      ok: false,
      status: 401,
      error: '登录状态已失效，请重新登录后切换 AI 模式。',
    };
  }

  return { ok: true };
}

function isLocalDevRequest(request: Request) {
  if (!isLocalRequestUrlHost(new URL(request.url).host)) return false;

  const requestHost = request.headers.get('host');
  if (requestHost && !isLocalHost(requestHost)) return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return isLocalHost(new URL(origin).host);
  } catch {
    return false;
  }
}

function isLocalRequestUrlHost(hostWithPort: string) {
  const parsed = parseHost(hostWithPort);
  if (!parsed) return false;

  return parsed.hostname === '0.0.0.0' || isLocalHost(hostWithPort);
}

function isLocalHost(hostWithPort: string) {
  const parsed = parseHost(hostWithPort);
  if (!parsed) return false;

  return (
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1'
  );
}

function parseHost(hostWithPort: string) {
  const trimmed = hostWithPort.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.startsWith('[')) {
    const closingBracketIndex = trimmed.indexOf(']');
    if (closingBracketIndex <= 1) return null;

    const hostname = trimmed.slice(1, closingBracketIndex);
    const rest = trimmed.slice(closingBracketIndex + 1);
    if (!rest) return { hostname };
    if (!rest.startsWith(':')) return null;

    return isValidPort(rest.slice(1)) ? { hostname } : null;
  }

  if (trimmed === '::1') return { hostname: '::1' };

  const parts = trimmed.split(':');
  if (parts.length === 1) return { hostname: parts[0] };
  if (parts.length !== 2 || !parts[0]) return null;

  return isValidPort(parts[1]) ? { hostname: parts[0] } : null;
}

function isValidPort(value: string) {
  if (!/^\d+$/.test(value)) return false;

  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}
