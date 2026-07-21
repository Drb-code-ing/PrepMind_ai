import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA,
  computeKnowledgeGate,
} from '../src/evals/phase-6-9-knowledge-agent-paired-contract.ts';
import {
  createKnowledgeAgentMockHarness,
  runKnowledgeAgentPairedEval,
} from '../src/evals/run-phase-6-9-knowledge-agent-paired.ts';

describe('phase 6.9.6 knowledge paired report contract', () => {
  test('requires exact counts, versions, provenance, and run identity', async () => {
    const report = await runKnowledgeAgentPairedEval(createKnowledgeAgentMockHarness());
    const parsed = PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA.parse(report);

    expect(parsed.counts).toEqual({
      cases: 72,
      zeroCall: 24,
      runtime: 48,
      pairedRequests: 24,
    });
    expect(parsed.datasetVersion).toBe('phase-6.9-knowledge-agents-v1');
    expect(parsed.promptVersion).toBe('knowledge-agents-v1');
    expect(parsed.projectionVersion).toBe('knowledge-model-projection-v1');
    expect(parsed.shortlistVersion).toBe('knowledge-semantic-shortlist-v1');
    expect(parsed.runScope).toBe('branch');
    expect(parsed.runId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('rejects duplicate, missing, extra, or mismatched paired cases', async () => {
    const report = await runKnowledgeAgentPairedEval(createKnowledgeAgentMockHarness());
    const duplicate = report.caseEntries.map((entry, index) =>
      index === 1 ? { ...entry, caseId: report.caseEntries[0]!.caseId } : entry,
    );
    expect(() =>
      PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA.parse({
        ...report,
        caseEntries: duplicate,
      }),
    ).toThrow();
    expect(() =>
      PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA.parse({
        ...report,
        prompt: 'must-not-persist',
      }),
    ).toThrow();

    const paired = report.caseEntries.filter((entry) => entry.pairedRunIndex === 0);
    expect(paired.map((entry) => entry.agent).sort()).toEqual(['dedup', 'organizer']);
  });

  test('recomputes all fixed production gates and never enables Mock as Live', async () => {
    const report = await runKnowledgeAgentPairedEval(createKnowledgeAgentMockHarness());

    expect(report.metrics.semanticScore).toBe(1);
    expect(report.metrics.absoluteImprovement).toBeGreaterThanOrEqual(0.1);
    expect(report.safety.zeroCallVerified).toBe(24);
    expect(report.safety.canonicalSchemaSuccesses).toBe(48);
    expect(report.gate).toBe('quality_gate_failed');
    expect(computeKnowledgeGate(report)).toBe('quality_gate_failed');
  });

  test('rejects endpoint latency samples below either concurrent agent sample', async () => {
    const report = await runKnowledgeAgentPairedEval(createKnowledgeAgentMockHarness());
    expect(() =>
      PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA.parse({
        ...report,
        latency: {
          ...report.latency,
          endpointSamplesMs: Array.from({ length: 24 }, () => 0),
          endpointP95Ms: 0,
        },
      }),
    ).toThrow();
  });
});
