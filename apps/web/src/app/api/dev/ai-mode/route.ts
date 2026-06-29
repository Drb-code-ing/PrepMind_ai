import { buildDevAiModeStatus, isDevAiModeSwitchEnabled, setDevAiMode } from '@/lib/dev-ai-mode';

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

  const mode = body && typeof body === 'object' ? (body as { mode?: unknown }).mode : undefined;
  const result = setDevAiMode(mode);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(buildDevAiModeStatus());
}
