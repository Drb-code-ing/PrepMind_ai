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
      'KnowledgeOrganizerAgent',
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
      'KnowledgeOrganizerAgent',
    ],
  };
}

export const createGraph = createAgentGraph;
