const agentToolModule = await import('../src/api/agent-tool.ts');

if (typeof agentToolModule.agentToolResultSchema?.parse !== 'function') {
  throw new Error('agentToolResultSchema should be available at runtime');
}
