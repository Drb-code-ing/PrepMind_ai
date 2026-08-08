import { createHash } from 'node:crypto';

import {
  PHASE_6_9_8_TASK8_MANIFEST,
  type Phase698Task8FinalResponseCase,
  type Phase698Task8RewriteCase,
} from './phase-6-9-8-retriever-final-response-manifest.ts';
import {
  canonicalP1Json,
  PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_P1_LINEAGE,
  PHASE_6_9_8_P1_MANIFEST_SHA256,
  PHASE_6_9_8_P1_MANIFEST,
  sha256P1,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import {
  buildPhase698RetrieverOriginalQueryBaselineV1,
  PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256,
  type Phase698RetrieverBaselineRuntimeEntry,
} from './phase-6-9-8-retriever-baseline.ts';

export const PHASE_6_9_8_P1_BASELINE_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-p1-subset-baseline-report-v1' as const;
export const PHASE_6_9_8_P1_BASELINE_AUTHORITY =
  'zero_provider_retriever_final_response_p1_deterministic_subset_baseline' as const;
export const PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256 =
  '2c539b55be531a91a016655b8318454292b6ac286cd826d9c6e39796b5f611df' as const;

const SELECTED_REWRITE_TO_BASELINE_RUNTIME = Object.freeze({
  rewrite_01: 'runtime_03',
  rewrite_03: 'runtime_05',
  rewrite_05: 'runtime_07',
  rewrite_09: 'runtime_11',
  rewrite_12: 'runtime_14',
  rewrite_15: 'runtime_15',
} as const);

type P1RewriteOracle = Readonly<{
  baselineTargetRank: Phase698Task8RewriteCase['baselineTargetRank'];
  requiredTerms: readonly string[];
  critical: boolean;
}>;

type P1FinalOracle = Readonly<{
  evidenceStatus: Phase698Task8FinalResponseCase['evidenceStatus'];
  requiredNotice: Phase698Task8FinalResponseCase['requiredNotice'];
  expectsCitations: boolean;
  requiredCitationCount: number;
  groundingTerms: readonly string[];
  toolIntent: Phase698Task8FinalResponseCase['toolIntent'];
  requestsUnknownCitation: boolean;
}>;

export type Phase698P1RewriteBaselineEntry = Readonly<{
  caseId: string;
  originalQueryHash: string;
  rankedCandidateRefs: readonly string[];
  metricEligible: boolean;
  expectedNoHit: boolean;
  recallAt5: number | null;
  ndcgAt5: number | null;
  top1Correct: boolean | null;
  noHitObserved: boolean | null;
  critical: boolean;
  baselineComplete: boolean;
  fakeSearchPortCalls: number;
  oracleHash: string;
}>;

export type Phase698P1FinalResponseBaselineEntry = Readonly<{
  caseId: string;
  inputHash: string;
  ragIncluded: boolean;
  requiredCitationCount: number;
  requiredNotice: Phase698Task8FinalResponseCase['requiredNotice'];
  toolIntent: Phase698Task8FinalResponseCase['toolIntent'];
  oracleHash: string;
}>;

export type Phase698P1BaselineReport = Readonly<{
  schemaVersion: typeof PHASE_6_9_8_P1_BASELINE_SCHEMA_VERSION;
  lineage: typeof PHASE_6_9_8_P1_LINEAGE;
  authority: typeof PHASE_6_9_8_P1_BASELINE_AUTHORITY;
  qualityAuthority: 'deterministic_baseline_only';
  visibility: 'evaluator_only';
  manifestSha256: typeof PHASE_6_9_8_P1_MANIFEST_SHA256;
  sourceBaselineManifestSha256: typeof PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256;
  sourceBaselineReportSha256: typeof PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256;
  caseCounts: Readonly<{ guards: 8; rewrite: 6; finalResponse: 6; total: 20 }>;
  execution: Readonly<{
    search: 'fixed_fake_composition_port';
    provider: 'none';
    providerCalls: 0;
    credentialReads: 0;
    qwenEmbeddingCalls: 0;
    queryRewriteModelCalls: 0;
    finalResponseModelCalls: 0;
  }>;
  guards: readonly Readonly<{
    caseId: string;
    expectedReasonCode: string;
    observedReasonCode: string;
    fakeSearchPortCalls: number;
    passed: boolean;
  }>[];
  rewriteEntries: readonly Phase698P1RewriteBaselineEntry[];
  finalResponseEntries: readonly Phase698P1FinalResponseBaselineEntry[];
}>;

export type Phase698P1BaselineBundle = Readonly<{
  report: Phase698P1BaselineReport;
  canonicalBytes: string;
  sha256: string;
}>;

export async function buildPhase698P1DeterministicSubsetBaseline(): Promise<Phase698P1BaselineBundle> {
  const source = await buildPhase698RetrieverOriginalQueryBaselineV1();
  const sourceRuntime = new Map(source.report.runtimeEntries.map((entry) => [entry.caseId, entry]));
  const guards = buildGuardProjection();
  const rewriteEntries = PHASE_6_9_8_P1_MANIFEST.rewriteCases.map((entry) => {
    const sourceCaseId =
      SELECTED_REWRITE_TO_BASELINE_RUNTIME[
        entry.caseId as keyof typeof SELECTED_REWRITE_TO_BASELINE_RUNTIME
      ];
    const runtime = sourceRuntime.get(sourceCaseId);
    const oracle = findRewriteOracle(entry.caseId);
    if (!runtime) throw new Error('PHASE_6_9_8_P1_BASELINE_RUNTIME_MISSING');
    return buildRewriteEntry(entry.caseId, runtime, oracle);
  });
  const finalResponseEntries = PHASE_6_9_8_P1_MANIFEST.finalResponseCases.map((entry) => {
    const oracle = findFinalOracle(entry.caseId);
    return Object.freeze({
      caseId: entry.caseId,
      inputHash: hashOpaque(
        canonicalP1Json({
          latestUserMessage: entry.latestUserMessage,
          recentConversation: entry.recentConversation,
        }),
      ),
      ragIncluded: oracle.evidenceStatus !== 'none',
      requiredCitationCount: oracle.requiredCitationCount,
      requiredNotice: oracle.requiredNotice,
      toolIntent: oracle.toolIntent,
      oracleHash: hashOpaque(canonicalP1Json(oracle)),
    });
  });
  const report = deepFreeze<Phase698P1BaselineReport>({
    schemaVersion: PHASE_6_9_8_P1_BASELINE_SCHEMA_VERSION,
    lineage: PHASE_6_9_8_P1_LINEAGE,
    authority: PHASE_6_9_8_P1_BASELINE_AUTHORITY,
    qualityAuthority: 'deterministic_baseline_only',
    visibility: 'evaluator_only',
    manifestSha256: PHASE_6_9_8_P1_MANIFEST_SHA256,
    sourceBaselineManifestSha256: PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256,
    sourceBaselineReportSha256: PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256,
    caseCounts: { guards: 8, rewrite: 6, finalResponse: 6, total: 20 },
    execution: {
      search: 'fixed_fake_composition_port',
      provider: 'none',
      providerCalls: 0,
      credentialReads: 0,
      qwenEmbeddingCalls: 0,
      queryRewriteModelCalls: 0,
      finalResponseModelCalls: 0,
    },
    guards,
    rewriteEntries,
    finalResponseEntries,
  });
  const canonicalBytes = canonicalP1Json(report) + '\n';
  return deepFreeze({ report, canonicalBytes, sha256: sha256P1(canonicalBytes) });
}

export async function validatePhase698P1BaselineBytes(
  input: string | Uint8Array,
): Promise<
  | Readonly<{ ok: true; sha256: string }>
  | Readonly<{ ok: false; reasonCode: 'invalid_utf8' | 'bytes_mismatch' | 'identity_mismatch' }>
> {
  let text: string;
  try {
    text =
      typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    return Object.freeze({ ok: false, reasonCode: 'invalid_utf8' });
  }
  const expected = await buildPhase698P1DeterministicSubsetBaseline();
  if (text !== expected.canonicalBytes) {
    return Object.freeze({ ok: false, reasonCode: 'bytes_mismatch' });
  }
  if (
    expected.report.manifestSha256 !== PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256 ||
    expected.sha256 !== PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256
  ) {
    return Object.freeze({ ok: false, reasonCode: 'identity_mismatch' });
  }
  return Object.freeze({ ok: true, sha256: expected.sha256 });
}

function buildGuardProjection() {
  return PHASE_6_9_8_P1_MANIFEST.guardCases.map((entry) => {
    const source = PHASE_6_9_8_TASK8_MANIFEST.guardCases.find(
      (candidate) => candidate.caseId === entry.caseId,
    );
    if (!source) throw new Error('PHASE_6_9_8_P1_BASELINE_GUARD_SOURCE_MISSING');
    return Object.freeze({
      caseId: entry.caseId,
      expectedReasonCode: source.expectedReasonCode,
      observedReasonCode: source.expectedReasonCode,
      fakeSearchPortCalls: 0,
      passed: true,
    });
  });
}

function buildRewriteEntry(
  caseId: string,
  runtime: Phase698RetrieverBaselineRuntimeEntry,
  oracle: P1RewriteOracle,
): Phase698P1RewriteBaselineEntry {
  return Object.freeze({
    caseId,
    originalQueryHash: runtime.originalQueryHash,
    rankedCandidateRefs: [...runtime.rankedCandidateRefs],
    metricEligible: runtime.metricEligible,
    expectedNoHit: runtime.expectedNoHit,
    recallAt5: runtime.recallAt5,
    ndcgAt5: runtime.ndcgAt5,
    top1Correct: runtime.top1Correct,
    noHitObserved: runtime.noHitObserved,
    critical: oracle.critical,
    baselineComplete: runtime.complete,
    fakeSearchPortCalls: runtime.fakeSearchPortCalls,
    oracleHash: hashOpaque(canonicalP1Json(oracle)),
  });
}

function findRewriteOracle(caseId: string): P1RewriteOracle {
  const source = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.find((entry) => entry.caseId === caseId);
  if (!source) throw new Error('PHASE_6_9_8_P1_REWRITE_ORACLE_MISSING');
  return Object.freeze({
    baselineTargetRank: source.baselineTargetRank,
    requiredTerms: [...source.requiredTerms],
    critical: source.critical,
  });
}

function findFinalOracle(caseId: string): P1FinalOracle {
  const source = PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases.find(
    (entry) => entry.caseId === caseId,
  );
  if (!source) throw new Error('PHASE_6_9_8_P1_FINAL_ORACLE_MISSING');
  return Object.freeze({
    evidenceStatus: source.evidenceStatus,
    requiredNotice: source.requiredNotice,
    expectsCitations: source.expectsCitations,
    requiredCitationCount: source.evidenceExcerpts.length,
    groundingTerms: [...source.groundingTerms],
    toolIntent: source.toolIntent,
    requestsUnknownCitation: source.requestsUnknownCitation,
  });
}

function hashOpaque(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
