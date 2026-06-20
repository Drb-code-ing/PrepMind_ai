export type AgentGraphDescriptor = {
  name: 'phase-6-agent-runtime';
  nodes: string[];
  realtimeNodes: string[];
  thresholdNodes: string[];
};

export function createAgentGraph(): AgentGraphDescriptor {
  return {
    name: 'phase-6-agent-runtime',
    nodes: [
      'RouterAgent',
      'TutorAgent',
      'RetrieverAgent',
      'KnowledgeVerifierAgent',
      'FinalResponseAgent',
      'WrongQuestionOrganizerAgent',
      'ReviewAgent',
      'PlannerAgent',
      'MemoryAgent',
      'KnowledgeDedupAgent',
    ],
    realtimeNodes: [
      'RouterAgent',
      'TutorAgent',
      'RetrieverAgent',
      'KnowledgeVerifierAgent',
      'FinalResponseAgent',
    ],
    thresholdNodes: [
      'WrongQuestionOrganizerAgent',
      'ReviewAgent',
      'PlannerAgent',
      'MemoryAgent',
      'KnowledgeDedupAgent',
    ],
  };
}

export const createGraph = createAgentGraph;
