import { describe, expect, it } from 'bun:test';

import {
  createAgentGraph,
  createGraph,
  routeAgentRequest,
  runAgentRuntime,
  shouldRunMemoryAgent,
} from '../src/index';

describe('@repo/agent public exports', () => {
  it('exports graph and runtime entrypoints', () => {
    expect(typeof createGraph).toBe('function');
    expect(typeof createAgentGraph).toBe('function');
    expect(typeof runAgentRuntime).toBe('function');
    expect(typeof routeAgentRequest).toBe('function');
    expect(typeof shouldRunMemoryAgent).toBe('function');
  });

  it('creates a graph descriptor without executing business agents', () => {
    const graph = createAgentGraph();

    expect(graph.name).toBe('phase-6-agent-runtime');
    expect(graph.nodes).toContain('RouterAgent');
    expect(graph.nodes).toContain('FinalResponseAgent');
  });
});
