export enum ReviewPlannerDiagnosticCode {
  PreflightInvalid = 'preflight_invalid',
  ExecutorInit = 'executor_init',
  HttpAuth = 'http_auth',
  HttpRateLimit = 'http_rate_limit',
  HttpClient = 'http_client',
  HttpServer = 'http_server',
  Transport = 'transport',
  StructuredOutput = 'structured_output',
  InvalidResponse = 'invalid_response',
  UsageUnverifiable = 'usage_unverifiable',
  EvidenceIo = 'evidence_io',
}
