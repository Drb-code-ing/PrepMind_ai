const memoryAgentModule = await import('../src/api/memory-agent.ts');

if (typeof memoryAgentModule.userMemorySchema?.parse !== 'function') {
  throw new Error('userMemorySchema should be available at runtime');
}

if (typeof memoryAgentModule.memoryCandidateSchema?.parse !== 'function') {
  throw new Error('memoryCandidateSchema should be available at runtime');
}
