const knowledgeAgentModule = await import('../src/api/knowledge-agent.ts');

if (!knowledgeAgentModule.knowledgeAgentSuggestionResponseSchema) {
  throw new Error('knowledge agent runtime export is missing');
}
