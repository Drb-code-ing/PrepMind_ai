import { AGENT_NODE_NAMES, type AgentNodeName } from '../contracts/realtime-chat.ts';
export type AgentProductComposition =
  'web_chat_route' | 'server_endpoint' | 'server_user_confirmed_command';
export type AgentModelMode =
  'deterministic' | 'hybrid_optional_model' | 'model_required_when_enabled';
export type AgentDomainWritePermission = 'none' | 'user_confirmed' | 'command_guarded';

export type AgentCatalogEntry = Readonly<{
  name: AgentNodeName;
  composition: AgentProductComposition;
  modelMode: AgentModelMode;
  domainWrite: AgentDomainWritePermission;
}>;

export type AgentGraphEdge = Readonly<{
  from: AgentNodeName;
  to: AgentNodeName;
  contract:
    | 'route_to_tutor_strategy'
    | 'route_to_retrieval_request'
    | 'retrieval_to_evidence_verification'
    | 'verified_evidence_to_final_response'
    | 'tutor_guidance_to_final_response'
    | 'review_result_to_study_plan';
}>;

export type AgentGraphDescriptor = Readonly<{
  name: 'phase-6-agent-runtime';
  executionAuthority: 'catalog_only';
  productRuntimeAuthority: 'web_and_server_composition_layers';
  nodes: readonly AgentNodeName[];
  realtimeNodes: readonly AgentNodeName[];
  thresholdNodes: readonly AgentNodeName[];
  plannedNodes: readonly ['ToolUsingOrchestrator'];
  catalog: readonly AgentCatalogEntry[];
  edges: readonly AgentGraphEdge[];
}>;

const catalog = [
  entry('RouterAgent', 'web_chat_route', 'hybrid_optional_model', 'none'),
  entry('TutorAgent', 'web_chat_route', 'hybrid_optional_model', 'none'),
  entry('RetrieverAgent', 'web_chat_route', 'hybrid_optional_model', 'none'),
  entry('KnowledgeVerifierAgent', 'web_chat_route', 'hybrid_optional_model', 'none'),
  entry('FinalResponseAgent', 'web_chat_route', 'model_required_when_enabled', 'none'),
  entry(
    'WrongQuestionOrganizerAgent',
    'server_user_confirmed_command',
    'hybrid_optional_model',
    'command_guarded',
  ),
  entry('ReviewAgent', 'server_endpoint', 'hybrid_optional_model', 'none'),
  entry('PlannerAgent', 'server_endpoint', 'hybrid_optional_model', 'none'),
  entry('MemoryAgent', 'server_user_confirmed_command', 'deterministic', 'user_confirmed'),
  entry('KnowledgeDedupAgent', 'server_endpoint', 'hybrid_optional_model', 'none'),
  entry('KnowledgeOrganizerAgent', 'server_endpoint', 'hybrid_optional_model', 'none'),
] as const satisfies readonly AgentCatalogEntry[];

const edges = [
  edge('RouterAgent', 'TutorAgent', 'route_to_tutor_strategy'),
  edge('RouterAgent', 'RetrieverAgent', 'route_to_retrieval_request'),
  edge('RetrieverAgent', 'KnowledgeVerifierAgent', 'retrieval_to_evidence_verification'),
  edge('KnowledgeVerifierAgent', 'FinalResponseAgent', 'verified_evidence_to_final_response'),
  edge('TutorAgent', 'FinalResponseAgent', 'tutor_guidance_to_final_response'),
  edge('ReviewAgent', 'PlannerAgent', 'review_result_to_study_plan'),
] as const satisfies readonly AgentGraphEdge[];

export function createAgentGraph(): AgentGraphDescriptor {
  return {
    name: 'phase-6-agent-runtime',
    executionAuthority: 'catalog_only',
    productRuntimeAuthority: 'web_and_server_composition_layers',
    nodes: AGENT_NODE_NAMES,
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
    plannedNodes: ['ToolUsingOrchestrator'],
    catalog,
    edges,
  };
}

function entry(
  name: AgentNodeName,
  composition: AgentProductComposition,
  modelMode: AgentModelMode,
  domainWrite: AgentDomainWritePermission,
): AgentCatalogEntry {
  return Object.freeze({ name, composition, modelMode, domainWrite });
}

function edge(
  from: AgentNodeName,
  to: AgentNodeName,
  contract: AgentGraphEdge['contract'],
): AgentGraphEdge {
  return Object.freeze({ from, to, contract });
}

export const createGraph = createAgentGraph;
