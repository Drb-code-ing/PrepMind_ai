import { describe, expect, it } from 'bun:test';

import {
  PHASE_6_9_KNOWLEDGE_AGENT_CASES,
  PHASE_6_9_KNOWLEDGE_AGENT_DATASET_VERSION,
  phase69KnowledgeDedupCases,
  phase69KnowledgeOrganizerCases,
} from '../src/evals/phase-6-9-knowledge-agent-cases.ts';

describe('Phase 6.9.6 Knowledge Agent eval cases', () => {
  it('freezes the dataset version and exact case quotas', () => {
    expect(PHASE_6_9_KNOWLEDGE_AGENT_DATASET_VERSION).toBe(
      'phase-6.9-knowledge-agents-v1',
    );
    expect(PHASE_6_9_KNOWLEDGE_AGENT_CASES).toHaveLength(72);
    expect(phase69KnowledgeDedupCases).toHaveLength(40);
    expect(phase69KnowledgeOrganizerCases).toHaveLength(32);
    expect(
      phase69KnowledgeDedupCases.filter(
        (testCase) => testCase.expectedRuntimeInvocations === 0,
      ),
    ).toHaveLength(16);
    expect(
      phase69KnowledgeOrganizerCases.filter(
        (testCase) => testCase.expectedRuntimeInvocations === 0,
      ),
    ).toHaveLength(8);
  });

  it('pairs the 48 runtime cases into 24 parallel requests', () => {
    const runtimeCases = PHASE_6_9_KNOWLEDGE_AGENT_CASES.filter(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    expect(runtimeCases).toHaveLength(48);

    for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
      const pair = runtimeCases.filter(
        (testCase) => testCase.pairedRunIndex === pairedRunIndex,
      );
      expect(pair.map((testCase) => testCase.agent).sort()).toEqual([
        'dedup',
        'organizer',
      ]);
    }
  });

  it('uses stable unique ids and complete responsibility coverage', () => {
    const ids = PHASE_6_9_KNOWLEDGE_AGENT_CASES.map((testCase) => testCase.id);
    expect(new Set(ids).size).toBe(72);
    expect(ids.every((id) => /^(dedup|organizer)-[a-z0-9-]{3,80}$/.test(id))).toBe(
      true,
    );

    expect(countSubsets(phase69KnowledgeDedupCases)).toEqual({
      exact_hash: 2,
      guard_zero_call: 14,
      semantic_duplicate: 6,
      possible_revision: 6,
      complementary: 6,
      unrelated: 6,
    });
    expect(countSubsets(phase69KnowledgeOrganizerCases)).toEqual({
      guard_zero_call: 8,
      semantic_organization: 24,
    });
    expect(
      new Set(
        phase69KnowledgeOrganizerCases
          .filter((testCase) => testCase.expectedRuntimeInvocations === 1)
          .map((testCase) => testCase.expected.subject),
      ),
    ).toEqual(new Set(['math', 'english', 'politics', 'computer', 'major', 'other']));
    expect(
      new Set(
        phase69KnowledgeOrganizerCases
          .filter((testCase) => testCase.expectedRuntimeInvocations === 1)
          .map((testCase) => testCase.expected.resourceType),
      ),
    ).toEqual(
      new Set([
        'lecture',
        'notes',
        'past_exam',
        'mistakes',
        'practice',
        'reference',
        'other',
      ]),
    );
    expect(
      phase69KnowledgeOrganizerCases.filter(
        (testCase) =>
          testCase.expectedRuntimeInvocations === 1 &&
          testCase.expected.coverage.singleDocument,
      ),
    ).toHaveLength(6);
    expect(
      phase69KnowledgeOrganizerCases.filter(
        (testCase) =>
          testCase.expectedRuntimeInvocations === 1 &&
          testCase.expected.coverage.invalidLabelChallenge,
      ),
    ).toHaveLength(1);
    const invalidLabelChallenge = phase69KnowledgeOrganizerCases.find(
      (testCase) =>
        testCase.expectedRuntimeInvocations === 1 &&
        testCase.expected.coverage.invalidLabelChallenge,
    );
    expect(invalidLabelChallenge?.input.documents[0]?.name).toContain('：');
    expect(invalidLabelChallenge?.expected.topicLabels).toEqual(['教育理论专题']);
    expect(invalidLabelChallenge?.expected.topicLabels[0]).toMatch(
      /^[\p{L}\p{N} ·()（）_-]+$/u,
    );
  });

  it('keeps zero-call cases ineligible and runtime cases eligible', () => {
    for (const testCase of PHASE_6_9_KNOWLEDGE_AGENT_CASES) {
      expect(testCase.candidateEligible).toBe(
        testCase.expectedRuntimeInvocations === 1,
      );
      if (testCase.criticalSafetyCase) {
        expect(testCase.expectedRuntimeInvocations).toBe(0);
      }
    }
  });

  it('deep-freezes fixtures and excludes credentials and real-user material', () => {
    expect(Object.isFrozen(PHASE_6_9_KNOWLEDGE_AGENT_CASES)).toBe(true);
    for (const testCase of PHASE_6_9_KNOWLEDGE_AGENT_CASES) {
      expect(Object.isFrozen(testCase)).toBe(true);
      expect(Object.isFrozen(testCase.tags)).toBe(true);
      expect(Object.isFrozen(testCase.input)).toBe(true);
      expect(Object.isFrozen(testCase.input.documents)).toBe(true);
      expect(Object.isFrozen(testCase.securityContext)).toBe(true);
      expect(testCase.input.documents.every((document) => Object.isFrozen(document))).toBe(
        true,
      );
    }
    const ownerMismatch = phase69KnowledgeDedupCases.find(
      (testCase) => testCase.id === 'dedup-target-owner-mismatch',
    );
    expect(ownerMismatch?.securityContext).toEqual({
      requestOwnerRef: 'owner-a',
      targetOwnerRef: 'owner-b',
    });
    expect(ownerMismatch?.input.targetDocumentId).not.toBe(
      ownerMismatch?.input.documents[0]?.id,
    );

    const serialized = JSON.stringify(PHASE_6_9_KNOWLEDGE_AGENT_CASES);
    for (const forbidden of [
      /authorization\s*:\s*bearer/i,
      /cookie\s*:/i,
      /(?:sk|ds|AIza)[-_A-Za-z0-9]{16,}/,
      /(?:api[_-]?key|client[_-]?secret|password)\s*[:=]/i,
      /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    ]) {
      expect(serialized).not.toMatch(forbidden);
    }
  });
});

function countSubsets(values: readonly { subset: string }[]) {
  return Object.fromEntries(
    values.reduce((counts, value) => {
      counts.set(value.subset, (counts.get(value.subset) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
  );
}
