const traceModule = await import('../src/api/agent-trace.ts');

if (typeof traceModule.agentTraceRunSchema?.parse !== 'function') {
  throw new Error('agentTraceRunSchema should be available at runtime');
}

if (typeof traceModule.agentTraceCreateRequestSchema?.parse !== 'function') {
  throw new Error('agentTraceCreateRequestSchema should be available at runtime');
}
