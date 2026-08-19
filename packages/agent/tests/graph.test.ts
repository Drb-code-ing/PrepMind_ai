import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  createAgentGraph,
  createGraph,
  evaluateCriticRubric,
  routeAgentRequest,
  runAgentRuntime,
  shouldRunMemoryAgent,
} from '../src/index';

describe('@repo/agent public exports', () => {
  it('uses explicit file imports for Node ESM runtime compatibility', () => {
    const sourceFiles = listSourceFiles(join(import.meta.dir, '../src'));

    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      const relativeImports = source.matchAll(/(?:from|export \*) ['"](\.{1,2}\/[^'"]+)['"]/g);

      for (const match of relativeImports) {
        expect(match[1], file).toMatch(/\.ts$/);
      }
    }
  });

  it('exports graph and runtime entrypoints', () => {
    expect(typeof createGraph).toBe('function');
    expect(typeof createAgentGraph).toBe('function');
    expect(typeof runAgentRuntime).toBe('function');
    expect(typeof routeAgentRequest).toBe('function');
    expect(typeof shouldRunMemoryAgent).toBe('function');
    expect(typeof evaluateCriticRubric).toBe('function');
  });

  it('creates a graph descriptor without executing business agents', () => {
    const graph = createAgentGraph();

    expect(graph.name).toBe('phase-6-agent-runtime');
    expect(graph.executionAuthority).toBe('catalog_only');
    expect(graph.productRuntimeAuthority).toBe('web_and_server_composition_layers');
    expect(graph.nodes).toContain('RouterAgent');
    expect(graph.nodes).toContain('FinalResponseAgent');
    expect(graph.nodes).toContain('KnowledgeOrganizerAgent');
    expect(graph.thresholdNodes).toContain('KnowledgeOrganizerAgent');
    expect(graph.plannedNodes).toEqual(['ToolUsingOrchestrator']);
    expect(graph.nodes).not.toContain('ToolUsingOrchestrator' as never);
    expect(graph.edges).toContainEqual({
      from: 'RetrieverAgent',
      to: 'KnowledgeVerifierAgent',
      contract: 'retrieval_to_evidence_verification',
    });
    expect(graph.edges).toContainEqual({
      from: 'ReviewAgent',
      to: 'PlannerAgent',
      contract: 'review_result_to_study_plan',
    });
    expect(graph.catalog).toContainEqual({
      name: 'MemoryAgent',
      composition: 'server_user_confirmed_command',
      modelMode: 'deterministic',
      domainWrite: 'user_confirmed',
    });
    expect(graph.catalog.filter((entry) => entry.domainWrite !== 'none')).toEqual([
      expect.objectContaining({
        name: 'WrongQuestionOrganizerAgent',
        domainWrite: 'command_guarded',
      }),
      expect.objectContaining({
        name: 'MemoryAgent',
        domainWrite: 'user_confirmed',
      }),
    ]);
  });
});

function listSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}
