import { describe, expect, test } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { StructuredModelExecutor } from '@repo/ai';

import {
  containsSensitiveEvidenceKey,
  executePhase696KnowledgeAgentCli,
  parsePhase696KnowledgeAgentCli,
} from '../scripts/phase-6-9-6-knowledge-agent-cli.ts';
import {
  validatePhase696KnowledgeAgentEvidenceBundle,
  validatePhase696KnowledgeAgentEvidenceFile,
  validatePhase696KnowledgeAgentEvidenceValue,
} from '../scripts/validate-phase-6-9-6-knowledge-agent-evidence.ts';
import {
  createKnowledgeAgentMockHarness,
  runKnowledgeAgentPairedEval,
} from '../src/evals/run-phase-6-9-knowledge-agent-paired.ts';
import {
  phase69KnowledgeDedupCases,
  phase69KnowledgeOrganizerCases,
} from '../src/evals/phase-6-9-knowledge-agent-cases.ts';

describe('phase 6.9.6 knowledge paired CLI and evidence validator', () => {
  test('requires explicit controlled-Live authorization', () => {
    expect(
      parsePhase696KnowledgeAgentCli({ argv: ['live'], env: {} }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase696KnowledgeAgentCli({
        argv: ['live'],
        env: { PHASE_6_9_6_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase696KnowledgeAgentCli({
        argv: ['live'],
        env: { PHASE_6_9_6_V2_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toMatchObject({ ok: true, mode: 'live', runScope: 'branch' });
  });

  test('rejects sensitive evidence keys before persistence', () => {
    for (const key of [
      'prompt',
      'filename',
      'chunkText',
      'embedding',
      'providerResponse',
      'providerHeader',
      'credential',
      'apiKey',
      'rawError',
    ]) {
      expect(containsSensitiveEvidenceKey(key)).toBe(true);
    }
    expect(containsSensitiveEvidenceKey('datasetVersion')).toBe(false);
  });

  test('validates a complete Mock report and rejects sensitive or duplicate evidence', async () => {
    const report = await runKnowledgeAgentPairedEval(createKnowledgeAgentMockHarness());
    expect(validatePhase696KnowledgeAgentEvidenceValue(report)).toEqual({ ok: true });
    expect(
      validatePhase696KnowledgeAgentEvidenceValue({ ...report, prompt: 'forbidden' }),
    ).toEqual({ ok: false, code: 'sensitive_evidence' });
    const caseEntries = report.caseEntries.map((entry, index) =>
      index === 1 ? { ...entry, caseId: report.caseEntries[0]!.caseId } : entry,
    );
    expect(
      validatePhase696KnowledgeAgentEvidenceValue({ ...report, caseEntries }),
    ).toEqual({ ok: false, code: 'report_contract_invalid' });
  });

  test('rejects authorized Live with incomplete configuration before marker or executor use', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-6-invalid-live-'));
    let invocations = 0;
    try {
      const result = await executePhase696KnowledgeAgentCli({
        argv: ['live'],
        env: { PHASE_6_9_6_V2_CONTROLLED_LIVE_APPROVED: 'true' },
        repositoryRoot: root,
        liveExecutor: async () => {
          invocations += 1;
          throw new Error('must not invoke');
        },
      });
      expect(result).toEqual({ ok: false, code: 'live_configuration_invalid' });
      expect(invocations).toBe(0);
      await expect(
        access(resolve(root, '.tmp/phase-6-9-6-knowledge-agents-v2-controlled-live.marker')),
      ).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('requires the dedicated Knowledge credential instead of the generic DeepSeek key', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-6-generic-key-live-'));
    let invocations = 0;
    try {
      const result = await executePhase696KnowledgeAgentCli({
        argv: ['live'],
        env: {
          ...completeLiveEnv(),
          KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: '',
          DEEPSEEK_API_KEY: 'generic-key-must-not-authorize-knowledge',
        },
        repositoryRoot: root,
        liveExecutor: async () => {
          invocations += 1;
          throw new Error('must not invoke');
        },
      });
      expect(result).toEqual({ ok: false, code: 'live_configuration_invalid' });
      expect(invocations).toBe(0);
      await expect(
        access(resolve(root, '.tmp/phase-6-9-6-knowledge-agents-v2-controlled-live.marker')),
      ).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects duplicate run identity across branch and main evidence', async () => {
    const branch = await runKnowledgeAgentPairedEval(createKnowledgeAgentMockHarness());
    const main = { ...branch, runScope: 'main' as const };
    expect(validatePhase696KnowledgeAgentEvidenceBundle([branch, main])).toEqual({
      ok: false,
      code: 'run_identity_invalid',
    });
  });

  test('rejects tampered CNY formula and unknown usage or pricing', async () => {
    const report = await runKnowledgeAgentPairedEval(createKnowledgeAgentMockHarness());
    const firstRuntimeIndex = report.caseEntries.findIndex(
      (entry) => entry.executionKind === 'runtime',
    );
    const tamperedEntries = report.caseEntries.map((entry, index) =>
      index === firstRuntimeIndex && entry.usage
        ? {
            ...entry,
            usage: { ...entry.usage, estimatedCostCny: entry.usage.estimatedCostCny + 0.001 },
          }
        : entry,
    );
    expect(
      validatePhase696KnowledgeAgentEvidenceValue({ ...report, caseEntries: tamperedEntries }),
    ).toEqual({ ok: false, code: 'report_contract_invalid' });
    expect(
      validatePhase696KnowledgeAgentEvidenceValue({
        ...report,
        usage: { ...report.usage, verifiedCases: 47, pricingKnown: false },
      }),
    ).not.toEqual({ ok: true });
  });

  test('rejects evidence whose filename disagrees with report scope or mode', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-6-evidence-name-'));
    try {
      const report = await runKnowledgeAgentPairedEval(createKnowledgeAgentMockHarness());
      const path = resolve(root, 'phase-6-9-6-knowledge-agent-main-mock.json');
      await writeFile(path, `${JSON.stringify(report)}\n`, 'utf8');
      expect(await validatePhase696KnowledgeAgentEvidenceFile({ path })).toEqual({
        ok: false,
        code: 'evidence_filename_invalid',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('keeps Live stdout aggregate-only and blocks a second marker attempt', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-6-live-cli-'));
    let invocations = 0;
    const executor = createSyntheticLiveExecutor(() => {
      invocations += 1;
    });
    try {
      const legacyMarker = resolve(root, '.tmp/phase-6-9-6-controlled-live.marker');
      await mkdir(resolve(root, '.tmp'), { recursive: true });
      await writeFile(legacyMarker, 'immutable-v1-run\n', { encoding: 'utf8', flag: 'wx' });
      const first = await executePhase696KnowledgeAgentCli({
        argv: ['live'],
        env: completeLiveEnv(),
        repositoryRoot: root,
        liveExecutor: executor,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.code);
      expect(Object.keys(first).sort()).toEqual([
        'counts',
        'evidencePath',
        'gate',
        'latency',
        'metrics',
        'ok',
        'runId',
        'usage',
        'versions',
      ]);
      expect(invocations).toBe(48);
      expect(await readFile(legacyMarker, 'utf8')).toBe('immutable-v1-run\n');
      expect(first.evidencePath).toMatch(
        /^\.tmp\/phase-6-9-6-knowledge-agent-branch-live-v2-[0-9a-f-]{36}\.json$/,
      );
      const persisted = JSON.parse(
        await readFile(resolve(root, first.evidencePath), 'utf8'),
      ) as unknown;
      expect(validatePhase696KnowledgeAgentEvidenceValue(persisted)).toEqual({ ok: true });
      expect((await readdir(resolve(root, '.tmp'))).some((name) => name.includes('.tmp-'))).toBe(
        false,
      );

      const second = await executePhase696KnowledgeAgentCli({
        argv: ['live'],
        env: completeLiveEnv(),
        repositoryRoot: root,
        liveExecutor: executor,
      });
      expect(second).toEqual({ ok: false, code: 'live_already_attempted' });
      expect(invocations).toBe(48);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function completeLiveEnv(): Readonly<Record<string, string>> {
  return {
    PHASE_6_9_6_V2_CONTROLLED_LIVE_APPROVED: 'true',
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: 'true',
    KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: 'true',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: 'synthetic-test-key',
    KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: '4500',
    KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '4500',
  };
}

function createSyntheticLiveExecutor(onInvoke: () => void): StructuredModelExecutor {
  const dedupCases = phase69KnowledgeDedupCases.filter(
    (entry) => entry.expectedRuntimeInvocations === 1,
  );
  const organizerCases = phase69KnowledgeOrganizerCases.filter(
    (entry) => entry.expectedRuntimeInvocations === 1,
  );
  let dedupIndex = 0;
  let organizerIndex = 0;
  return async (request) => {
    onInvoke();
    if (request.systemPrompt.startsWith('Classify')) {
      const entry = dedupCases[dedupIndex++]!;
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
    return {
      object: {
        tags: entry.input.documents.map((_, documentIndex) => ({
          documentIndex,
          subject: entry.expected.subject,
          resourceType: entry.expected.resourceType,
          topicLabels: [...entry.expected.topicLabels],
        })),
        collections:
          entry.input.documents.length >= 2
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
}

function evidenceCodes(
  relation: 'semantic_duplicate' | 'possible_revision' | 'complementary' | 'unrelated',
) {
  switch (relation) {
    case 'semantic_duplicate':
      return ['semantic_overlap', 'same_scope'] as const;
    case 'possible_revision':
      return ['semantic_overlap', 'version_signal'] as const;
    case 'complementary':
      return ['different_purpose', 'complementary_coverage'] as const;
    case 'unrelated':
      return ['different_purpose'] as const;
  }
}
