const CREDENTIAL_PATTERNS = [
  /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----[\s\S]*?(?:-----END(?: [A-Z0-9]+)? PRIVATE KEY-----|$)/gi,
  /Authorization\s*:\s*Bearer\s+[^\s,;]+/gi,
  /Cookie\s*:\s*[^\r\n]+/gi,
  /(?:DEEPSEEK_API_KEY|OPENAI_API_KEY)\s*=\s*[^\s,;]+/gi,
  /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password)\s*[:=]\s*[^\s,;]+/gi,
  /\bsk-[A-Za-z0-9._-]+/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
];

export function redactSummaryCredentials(value: string) {
  return CREDENTIAL_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, '[REDACTED]'),
    value,
  );
}

export function assertSafeSummaryOutput(value: string) {
  if (redactSummaryCredentials(value) !== value) {
    throw new Error('CONVERSATION_SUMMARY_CREDENTIAL_OUTPUT_REJECTED');
  }
}
