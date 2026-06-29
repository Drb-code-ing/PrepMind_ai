import { apiClient } from '@/lib/api-client';
import { buildDevAiModeStatus, isDevAiModeSwitchEnabled, setDevAiMode } from '@/lib/dev-ai-mode';
import { validateDevAiModeMutationRequest } from '@/lib/dev-ai-mode-request-policy';

async function verifyAccessToken(accessToken: string) {
  try {
    await apiClient.get<unknown>('/auth/me', { accessToken });
    return true;
  } catch {
    return false;
  }
}

export function GET() {
  if (!isDevAiModeSwitchEnabled()) {
    return Response.json({ error: 'Dev AI mode switch is disabled.' }, { status: 404 });
  }

  return Response.json(buildDevAiModeStatus());
}

export async function PUT(req: Request) {
  if (!isDevAiModeSwitchEnabled()) {
    return Response.json({ error: 'Dev AI mode switch is disabled.' }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const requestBody =
    body && typeof body === 'object'
      ? (body as { accessToken?: unknown; mode?: unknown })
      : {};
  const accessToken =
    typeof requestBody.accessToken === 'string' ? requestBody.accessToken : null;
  const policy = await validateDevAiModeMutationRequest({
    request: req,
    accessToken,
    validateAccessToken: verifyAccessToken,
  });

  if (!policy.ok) {
    return Response.json({ error: policy.error }, { status: policy.status });
  }

  const mode = requestBody.mode;
  const result = setDevAiMode(mode);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(buildDevAiModeStatus());
}
