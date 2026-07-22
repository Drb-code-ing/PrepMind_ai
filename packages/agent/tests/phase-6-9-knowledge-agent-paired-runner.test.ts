import { describe, expect, test } from 'bun:test';

import {
  createKnowledgeAgentLiveHarness,
  createKnowledgeAgentMockHarness,
  runKnowledgeAgentPairedEval,
} from '../src/evals/run-phase-6-9-knowledge-agent-paired.ts';
import {
  phase69KnowledgeDedupCases,
  phase69KnowledgeOrganizerCases,
} from '../src/evals/phase-6-9-knowledge-agent-cases.ts';

describe('phase 6.9.6 knowledge paired runner', () => {
  test('runs both runtime agents concurrently for every pairedRunIndex', async () => {
    const base = createKnowledgeAgentMockHarness();
    let active = 0;
    let maximumActive = 0;
    const withDelay = async <T>(operation: () => Promise<T>) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      try {
        return await operation();
      } finally {
        active -= 1;
      }
    };

    const report = await runKnowledgeAgentPairedEval({
      ...base,
      runDedup: (entry) => withDelay(() => base.runDedup(entry)),
      runOrganizer: (entry) => withDelay(() => base.runOrganizer(entry)),
    });

    expect(maximumActive).toBeGreaterThanOrEqual(2);
    expect(report.latency.endpointSamplesMs).toHaveLength(24);
    expect(report.caseEntries.filter((entry) => entry.zeroCallVerified)).toHaveLength(24);
    expect(report.caseEntries.reduce((sum, entry) => sum + entry.runtimeInvocations, 0)).toBe(48);
    for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
      const pair = report.caseEntries.filter(
        (entry) => entry.pairedRunIndex === pairedRunIndex,
      );
      expect(pair.map((entry) => entry.agent).sort()).toEqual(['dedup', 'organizer']);
    }
  });

  test('keeps invalid runtime outcomes in the 48-case denominator', async () => {
    const base = createKnowledgeAgentMockHarness();
    let replaced = false;
    const report = await runKnowledgeAgentPairedEval({
      ...base,
      async runDedup(entry) {
        const result = await base.runDedup(entry);
        if (!replaced) {
          replaced = true;
          return { ...result, canonicalSchemaSuccess: false, actualRelation: null };
        }
        return result;
      },
    });

    expect(report.metrics.scoredRuntimeCases).toBe(48);
    expect(report.metrics.invalidRuntimeCases).toBe(1);
    expect(report.safety.canonicalSchemaSuccesses).toBe(47);
    expect(report.gate).toBe('quality_gate_failed');
  });

  test('drives the real candidate contracts with a no-network Live executor', async () => {
    const dedupCases = phase69KnowledgeDedupCases.filter(
      (entry) => entry.expectedRuntimeInvocations === 1,
    );
    const organizerCases = phase69KnowledgeOrganizerCases.filter(
      (entry) => entry.expectedRuntimeInvocations === 1,
    );
    let dedupIndex = 0;
    let organizerIndex = 0;
    const dedupProjections: Array<{
      documents: Array<{ relativeTime: 'older' | 'same_time' | 'newer' }>;
    }> = [];
    const executor = async (request: { systemPrompt: string; userPrompt: string }) => {
      if (request.systemPrompt.startsWith('Classify')) {
        const entry = dedupCases[dedupIndex++]!;
        dedupProjections.push(JSON.parse(request.userPrompt));
        return {
          object: {
            decisions: [
              {
                pairIndex: 0,
                relation: entry.expected.relation,
                confidence: 'high',
                evidenceCodes: evidenceCodes(entry.expected.relation),
              },
            ],
          },
          usage: { inputTokens: 420, outputTokens: 90 },
        };
      }
      const entry = organizerCases[organizerIndex++]!;
      const documentCount = entry.input.documents.length;
      return {
        object: {
          tags: entry.input.documents.map((_, documentIndex) => ({
            documentIndex,
            subject: entry.expected.subject,
            resourceType: entry.expected.resourceType,
            topicLabels: [...entry.expected.topicLabels],
          })),
          collections:
            documentCount >= 2
              ? [
                  {
                    memberIndexes: [0, 1],
                    name: '合成专题集合',
                    theme: 'topic',
                  },
                ]
              : [],
        },
        usage: { inputTokens: 460, outputTokens: 120 },
      };
    };

    const report = await runKnowledgeAgentPairedEval(
      createKnowledgeAgentLiveHarness({
        executor,
        runScope: 'branch',
      }),
    );

    expect(dedupIndex).toBe(24);
    expect(organizerIndex).toBe(24);
    expect(report.safety.canonicalSchemaSuccesses).toBe(48);
    expect(report.metrics.semanticScore).toBe(1);
    expect(report.gate).toBe('quality_gate_passed');
    expect(dedupProjections[0]?.documents.map((document) => document.relativeTime)).toEqual([
      'same_time',
      'same_time',
    ]);
    expect(dedupProjections[6]?.documents.map((document) => document.relativeTime)).toEqual([
      'older',
      'newer',
    ]);
  });

  test('derives zero-call results from guard execution instead of echoing expected reasons', async () => {
    const harness = createKnowledgeAgentMockHarness();
    const exactHash = phase69KnowledgeDedupCases.find(
      (entry) => entry.id === 'dedup-exact-hash-01',
    );
    if (!exactHash || exactHash.expectedRuntimeInvocations !== 0) {
      throw new Error('missing exact-hash fixture');
    }

    const result = await harness.runZeroCall({
      ...exactHash,
      zeroCallReason: 'agent_gate_disabled',
    });

    expect(result).toMatchObject({
      runtimeInvocations: 0,
      observedReason: 'exact_hash_sufficient',
      exactHashPreserved: true,
    });
  });
});

function evidenceCodes(
  relation: 'semantic_duplicate' | 'possible_revision' | 'complementary' | 'unrelated',
) {
  switch (relation) {
    case 'semantic_duplicate':
      return ['semantic_overlap', 'same_scope'];
    case 'possible_revision':
      return ['semantic_overlap', 'version_signal'];
    case 'complementary':
      return ['different_purpose', 'complementary_coverage'];
    case 'unrelated':
      return ['different_purpose'];
  }
}
