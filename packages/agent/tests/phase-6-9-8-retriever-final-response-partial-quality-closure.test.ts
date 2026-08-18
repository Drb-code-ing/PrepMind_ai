import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARGUMENT,
  PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_RUN_ID,
  runPhase698RetrieverPartialQualityClosure,
  serializePhase698RetrieverPartialClosureSummary,
} from '../src/evals/phase-6-9-8-retriever-final-response-partial-quality-closure.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_RELATIVE_PATH,
  artifactRelativePath,
  journalRelativePath,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-durability.ts';

const repositoryRoot = resolve(import.meta.dir, '../../..');

describe('Phase 6.9.8 partial quality closure', () => {
  test('closes from the immutable V12 bundle without Provider or write authority', async () => {
    const formalPaths = [
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_RELATIVE_PATH,
      journalRelativePath(PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_RUN_ID),
      artifactRelativePath(PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_RUN_ID),
    ].map((path) => resolve(repositoryRoot, path));
    const formalBytesBefore = await Promise.all(formalPaths.map((path) => readFile(path)));
    const result = await runPhase698RetrieverPartialQualityClosure({
      argv: [PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARGUMENT],
      repositoryRoot,
    });

    expect(result.status).toBe('partial_completion_closed');
    if (result.status !== 'partial_completion_closed') throw new Error('closure blocked');
    expect(result).toMatchObject({
      gate: 'closed',
      authority: 'retriever_final_response_v12_retrospective_transport_completion_authority',
      qualityAuthority: 'none',
      providerCalls: 0,
      credentialReads: 0,
      formalEvidenceWrites: 0,
      businessWrites: 0,
      v12MutationWrites: 0,
    });
    expect(result.partialReport.calls).toEqual({
      planned: 24,
      started: 5,
      succeeded: 4,
      responsesObserved: 5,
      usageVerified: 4,
      deferred: 19,
      failed: 1,
    });
    expect(result.partialReport.semantic).toMatchObject({
      status: 'not_established',
      qualityAuthority: 'none',
    });
    expect(result.partialReport.budget).toEqual({
      inputTokens: null,
      outputTokens: null,
      verifiedCostCny: null,
    });
    expect(result.partialReport.rawDataRetained).toBe(false);
    expect(JSON.parse(serializePhase698RetrieverPartialClosureSummary(result))).toEqual(result);
    expect(await Promise.all(formalPaths.map((path) => readFile(path)))).toEqual(formalBytesBefore);
  });

  test.each([[], ['wrong'], [PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARGUMENT, 'extra']])(
    'blocks invalid argv before repository inspection',
    async (argv) => {
      expect(
        await runPhase698RetrieverPartialQualityClosure({
          argv,
          repositoryRoot: join(repositoryRoot, 'missing-root'),
        }),
      ).toMatchObject({ status: 'blocked', reasonCode: 'partial_closure_invalid' });
    },
  );

  test('blocks a root without the immutable V12 bundle', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-partial-closure-'));
    try {
      expect(
        await runPhase698RetrieverPartialQualityClosure({
          argv: [PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARGUMENT],
          repositoryRoot: root,
        }),
      ).toMatchObject({ status: 'blocked', authority: 'none' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
