const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /DEEPSEEK_API_KEY\s*=\s*\S+/gi,
  /OPENAI_API_KEY\s*=\s*\S+/gi,
  /Cookie:\s*[^,\n]+/gi,
];

export function sanitizeJobError(error: unknown, fallback = '后台任务执行失败') {
  const raw = error instanceof Error ? error.message : String(error || fallback);
  const redacted = SECRET_PATTERNS.reduce(
    (value, pattern) => value.replace(pattern, '[redacted]'),
    raw,
  );

  return redacted.slice(0, 500) || fallback;
}
