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
    expect(graph.nodes).toContain('RouterAgent');
    expect(graph.nodes).toContain('FinalResponseAgent');
    expect(graph.nodes).toContain('KnowledgeOrganizerAgent');
    expect(graph.thresholdNodes).toContain('KnowledgeOrganizerAgent');
  });
});

function listSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}
