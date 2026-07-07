const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /DEEPSEEK_API_KEY\s*=\s*\S+/gi,
  /OPENAI_API_KEY\s*=\s*\S+/gi,
  /Cookie:\s*[^,\n]+/gi,
];

export function sanitizeJobError(
  error: unknown,
  fallback = 'Background job failed',
) {
  const raw = toErrorMessage(error, fallback);
  const redacted = SECRET_PATTERNS.reduce(
    (value, pattern) => value.replace(pattern, '[redacted]'),
    raw,
  );

  return redacted.slice(0, 500) || fallback;
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error || fallback;
  if (error === null || error === undefined) return fallback;

  try {
    return JSON.stringify(error) ?? fallback;
  } catch {
    return fallback;
  }
}
