import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  createVerifiedEvidenceBundleV1,
  isAgentExecutionContextV1,
  type AgentExecutionContextV1,
  type EvidenceCandidateV1,
  type EvidenceReasonCode,
  type VerifiedEvidenceBundleV1,
  type VerifiedEvidenceEntryV1,
} from '../contracts/realtime-chat.ts';
import {
  isFormalVerifiedEvidenceBundleBoundToContextV1,
  registerFormalVerifiedEvidenceBundleV1,
} from '../contracts/verified-evidence-authority.ts';
import {
  clonePlainEvidenceData,
  deepFreezeModelValue,
  scanCompleteModelField,
} from '../model-candidates/model-projection-safety.ts';
import { isRetrieverResultBoundToExecutionContextV1 } from './retriever.ts';

export const EVIDENCE_PROJECTOR_VERSION = 'evidence-projector-v1' as const;
export const EVIDENCE_PROJECTOR_TRACE_SUMMARY_VERSION =
  'evidence-projector-trace-summary-v1' as const;
export const EVIDENCE_PROJECTOR_POLICY_V1 = deepFreezeModelValue({
  maxEntries: 4,
  maxExcerptUtf16CodeUnits: 700,
});

const VERIFIER_ASSESSMENT_SCHEMA = z
  .object({
    status: z.enum(['trusted', 'suspicious', 'conflict', 'insufficient', 'skipped']),
    availability: z.enum(['available', 'unavailable']),
  })
  .strict();

const CONTEXT_BUDGET_SCHEMA = z.object({ ragIncluded: z.boolean() }).strict();

const HARD_BLOCK_SAFETY_CODES = new Set<EvidenceCandidateV1['safety']['codes'][number]>([
  'prompt_injection',
  'credential_material',
  'high_risk',
  'control_character',
  'unknown_safety',
]);

export type EvidenceVerifierAssessmentV1 = z.infer<typeof VERIFIER_ASSESSMENT_SCHEMA>;

export type VerifiedEvidenceCitationProjectionV1 = Readonly<{
  allowedCitationIds: readonly string[];
  citations: readonly Readonly<{ citationId: string; sourceLabel: string }>[];
  markdown: string;
}>;

export type EvidenceProjectorTraceSummaryV1 = Readonly<{
  schemaVersion: typeof EVIDENCE_PROJECTOR_TRACE_SUMMARY_VERSION;
  projectorVersion: typeof EVIDENCE_PROJECTOR_VERSION;
  runId: string;
  requestId: string;
  disposition: 'projected' | 'context_budget_omitted';
  bundleId: string | null;
  status: VerifiedEvidenceBundleV1['status'] | 'omitted';
  reasonCodes: readonly EvidenceReasonCode[];
  candidateCount: number;
  removedCount: number;
  projectedCount: number;
  citationCount: number;
  providerCalls: 0;
}>;

export type EvidenceProjectorExecutionV1 =
  | Readonly<{
      ok: true;
      disposition: 'projected';
      bundle: VerifiedEvidenceBundleV1;
      citationProjection: VerifiedEvidenceCitationProjectionV1;
      traceSummary: EvidenceProjectorTraceSummaryV1;
    }>
  | Readonly<{
      ok: true;
      disposition: 'context_budget_omitted';
      bundle: null;
      citationProjection: VerifiedEvidenceCitationProjectionV1;
      traceSummary: EvidenceProjectorTraceSummaryV1;
    }>
  | Readonly<{
      ok: false;
      reasonCode: 'invalid_input' | 'principal_binding_invalid' | 'aborted';
    }>;

type ProjectorInputSnapshot = Readonly<{
  context: unknown;
  retrieverResult: unknown;
  verifier: unknown;
  contextBudget: unknown;
}>;

const EMPTY_CITATION_PROJECTION = deepFreezeModelValue<VerifiedEvidenceCitationProjectionV1>({
  allowedCitationIds: [],
  citations: [],
  markdown: '',
});

export function projectVerifiedEvidenceBundleV1(input: unknown): EvidenceProjectorExecutionV1 {
  const snapshot = snapshotProjectorInput(input);
  if (snapshot === null) return projectorFailure('invalid_input');
  if (
    !isAgentExecutionContextV1(snapshot.context) ||
    snapshot.context.principal.kind !== 'authenticated' ||
    !isRetrieverResultBoundToExecutionContextV1(snapshot.retrieverResult, snapshot.context)
  ) {
    return projectorFailure('principal_binding_invalid');
  }

  const context = snapshot.context;
  const retrieverResult = snapshot.retrieverResult;
  const verifier = parsePlainValue(VERIFIER_ASSESSMENT_SCHEMA, snapshot.verifier);
  const contextBudget = parsePlainValue(CONTEXT_BUDGET_SCHEMA, snapshot.contextBudget);
  if (verifier === null || contextBudget === null) return projectorFailure('invalid_input');
  if (readAborted(context) !== false) return projectorFailure('aborted');

  if (!contextBudget.ragIncluded) {
    const reasonCodes = Object.freeze(['context_budget_omitted'] as const);
    return deepFreezeModelValue({
      ok: true as const,
      disposition: 'context_budget_omitted' as const,
      bundle: null,
      citationProjection: EMPTY_CITATION_PROJECTION,
      traceSummary: buildTraceSummary({
        context,
        disposition: 'context_budget_omitted',
        bundleId: null,
        status: 'omitted',
        reasonCodes,
        candidateCount: retrieverResult.evidenceCandidates.length,
        removedCount: 0,
        projectedCount: 0,
        citationCount: 0,
      }),
    });
  }

  const eligibleCandidates = retrieverResult.evidenceCandidates
    .filter(isProjectionEligibleCandidate)
    .sort(compareEvidenceCandidates);
  const removedCount = retrieverResult.evidenceCandidates.length - eligibleCandidates.length;
  const status = resolveBundleStatus({
    retrieverStatus: retrieverResult.status,
    candidateCount: retrieverResult.evidenceCandidates.length,
    eligibleCandidates,
    verifier,
  });
  const projectedCandidates =
    status === 'insufficient' || status === 'skipped'
      ? []
      : eligibleCandidates.slice(0, EVIDENCE_PROJECTOR_POLICY_V1.maxEntries);
  const entries = projectedCandidates.map((candidate, index) =>
    buildVerifiedEntry(candidate, index, status),
  );
  const reasonCodes = buildReasonCodes(status, verifier.availability, removedCount);
  const userNotice = buildUserNotice(status, verifier.availability, removedCount);
  const bundleId = deriveBundleId(context.runId, status, reasonCodes, entries);
  const created = createVerifiedEvidenceBundleV1({
    schemaVersion: 'verified-evidence-bundle-v1',
    bundleId,
    runId: context.runId,
    status,
    reasonCodes,
    entries,
    ...(userNotice === undefined ? {} : { userNotice }),
  });
  if (!created.ok) return projectorFailure('invalid_input');
  registerFormalVerifiedEvidenceBundleV1(created.value, context);

  const citationProjection = projectVerifiedEvidenceCitationsV1(created.value, context, true);
  if (!citationProjection.ok) return projectorFailure('invalid_input');
  return deepFreezeModelValue({
    ok: true as const,
    disposition: 'projected' as const,
    bundle: created.value,
    citationProjection: citationProjection.value,
    traceSummary: buildTraceSummary({
      context,
      disposition: 'projected',
      bundleId,
      status,
      reasonCodes,
      candidateCount: retrieverResult.evidenceCandidates.length,
      removedCount,
      projectedCount: entries.length,
      citationCount: citationProjection.value.citations.length,
    }),
  });
}

export function projectVerifiedEvidenceCitationsV1(
  bundle: unknown,
  context: unknown,
  ragIncluded: unknown,
):
  | Readonly<{ ok: true; value: VerifiedEvidenceCitationProjectionV1 }>
  | Readonly<{ ok: false; reasonCode: 'bundle_not_locally_projected' | 'schema_invalid' }> {
  if (typeof ragIncluded !== 'boolean') {
    return Object.freeze({ ok: false, reasonCode: 'schema_invalid' });
  }
  if (
    bundle === null ||
    typeof bundle !== 'object' ||
    !isAgentExecutionContextV1(context) ||
    !isFormalVerifiedEvidenceBundleBoundToContextV1(bundle, context)
  ) {
    return Object.freeze({ ok: false, reasonCode: 'bundle_not_locally_projected' });
  }
  if (!ragIncluded) return Object.freeze({ ok: true, value: EMPTY_CITATION_PROJECTION });

  const localBundle = bundle;
  const citations = localBundle.entries.map((entry) =>
    Object.freeze({ citationId: entry.citationId, sourceLabel: entry.sourceLabel }),
  );
  const projection = deepFreezeModelValue<VerifiedEvidenceCitationProjectionV1>({
    allowedCitationIds: citations.map((citation) => citation.citationId),
    citations,
    markdown: buildCitationMarkdown(citations, localBundle.userNotice),
  });
  return Object.freeze({ ok: true, value: projection });
}

function resolveBundleStatus(input: {
  retrieverStatus: 'completed' | 'degraded' | 'skipped' | 'failed';
  candidateCount: number;
  eligibleCandidates: readonly EvidenceCandidateV1[];
  verifier: EvidenceVerifierAssessmentV1;
}): VerifiedEvidenceBundleV1['status'] {
  if (input.retrieverStatus === 'skipped') return 'skipped';
  if (input.retrieverStatus !== 'completed') return 'insufficient';
  if (input.eligibleCandidates.length === 0) {
    return input.candidateCount === 0 && input.verifier.status === 'skipped'
      ? 'skipped'
      : 'insufficient';
  }
  if (input.verifier.status === 'insufficient') return 'insufficient';
  if (input.verifier.status === 'skipped') return 'insufficient';
  if (
    input.verifier.status === 'trusted' &&
    (input.verifier.availability === 'unavailable' ||
      input.eligibleCandidates.some((candidate) => candidate.safety.status === 'caution'))
  ) {
    return 'suspicious';
  }
  return input.verifier.status;
}

function isProjectionEligibleCandidate(candidate: EvidenceCandidateV1): boolean {
  if (candidate.safety.ownerScope !== 'matched') return false;
  if (candidate.safety.status !== 'safe' && candidate.safety.status !== 'caution') return false;
  if (candidate.safety.codes.some((code) => HARD_BLOCK_SAFETY_CODES.has(code))) return false;
  return scanCompleteModelField(candidate.excerpt, {
    maxUtf16CodeUnits: EVIDENCE_PROJECTOR_POLICY_V1.maxExcerptUtf16CodeUnits,
    rejectToolOrWriteInstruction: true,
  }).ok;
}

function buildVerifiedEntry(
  candidate: EvidenceCandidateV1,
  index: number,
  status: VerifiedEvidenceBundleV1['status'],
): VerifiedEvidenceEntryV1 {
  const excerpt = truncateUtf16(
    candidate.excerpt,
    EVIDENCE_PROJECTOR_POLICY_V1.maxExcerptUtf16CodeUnits,
  );
  const trusted = status === 'trusted' && candidate.safety.status === 'safe';
  const safetyCodes: VerifiedEvidenceEntryV1['safetyCodes'] = trusted
    ? ['verified_safe']
    : candidate.safety.status === 'safe'
      ? ['verified_safe', 'verifier_caution']
      : ['verifier_caution'];
  return deepFreezeModelValue({
    citationId: candidate.citationId,
    sourceRef: candidate.sourceRef,
    documentId: candidate.documentId,
    chunkId: candidate.chunkId,
    sourceLabel: `资料 ${index + 1}`,
    excerpt: excerpt.value,
    trustLabel: trusted ? ('trusted' as const) : ('caution' as const),
    safetyCodes,
    truncated: candidate.truncated || excerpt.truncated,
  });
}

function buildReasonCodes(
  status: VerifiedEvidenceBundleV1['status'],
  availability: EvidenceVerifierAssessmentV1['availability'],
  removedCount: number,
): readonly EvidenceReasonCode[] {
  const primary: Record<VerifiedEvidenceBundleV1['status'], EvidenceReasonCode> = {
    trusted: 'evidence_verified',
    suspicious: 'evidence_suspicious',
    conflict: 'evidence_conflict',
    insufficient: 'evidence_insufficient',
    skipped: 'evidence_skipped',
  };
  return Object.freeze([
    primary[status],
    ...(availability === 'unavailable' ? (['verifier_unavailable'] as const) : []),
    ...(removedCount > 0 ? (['unsafe_evidence_removed'] as const) : []),
  ]);
}

function buildUserNotice(
  status: VerifiedEvidenceBundleV1['status'],
  availability: EvidenceVerifierAssessmentV1['availability'],
  removedCount: number,
): string | undefined {
  const parts: string[] = [];
  if (status === 'suspicious') {
    parts.push('检索资料可能不可靠，本次仅作为谨慎参考。');
  } else if (status === 'conflict') {
    parts.push('检索资料之间存在冲突，请结合题目条件核对后再采用结论。');
  } else if (status === 'insufficient') {
    parts.push('检索资料不足以支持结论，本次回答将主要依据题目条件与通用知识。');
  }
  if (availability === 'unavailable') {
    parts.push('资料核验暂不可用，证据状态已按保守边界收紧。');
  }
  if (removedCount > 0) parts.push('部分不安全资料已被移除。');
  return parts.length === 0 ? undefined : parts.join(' ');
}

function deriveBundleId(
  runId: string,
  status: VerifiedEvidenceBundleV1['status'],
  reasonCodes: readonly EvidenceReasonCode[],
  entries: readonly VerifiedEvidenceEntryV1[],
): string {
  const identity = JSON.stringify({
    runId,
    status,
    reasonCodes,
    citations: entries.map((entry) => entry.citationId),
  });
  return 'bundle_' + createHash('sha256').update(identity, 'utf8').digest('hex').slice(0, 32);
}

function compareEvidenceCandidates(left: EvidenceCandidateV1, right: EvidenceCandidateV1): number {
  return (
    right.score - left.score ||
    right.keywordScore - left.keywordScore ||
    right.vectorScore - left.vectorScore ||
    compareText(left.documentId, right.documentId) ||
    compareText(left.chunkId, right.chunkId)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function buildCitationMarkdown(
  citations: readonly Readonly<{ citationId: string; sourceLabel: string }>[],
  userNotice: string | undefined,
): string {
  if (citations.length === 0) return '';
  const list = citations
    .map((citation, index) => `${index + 1}. ${citation.sourceLabel}`)
    .join('\n');
  const notice = userNotice === undefined ? '' : `\n\n### 资料核对提示\n\n${userNotice}`;
  return `---\n\n### 参考资料\n\n${list}${notice}`;
}

function buildTraceSummary(input: {
  context: AgentExecutionContextV1;
  disposition: EvidenceProjectorTraceSummaryV1['disposition'];
  bundleId: string | null;
  status: EvidenceProjectorTraceSummaryV1['status'];
  reasonCodes: readonly EvidenceReasonCode[];
  candidateCount: number;
  removedCount: number;
  projectedCount: number;
  citationCount: number;
}): EvidenceProjectorTraceSummaryV1 {
  return deepFreezeModelValue({
    schemaVersion: EVIDENCE_PROJECTOR_TRACE_SUMMARY_VERSION,
    projectorVersion: EVIDENCE_PROJECTOR_VERSION,
    runId: input.context.runId,
    requestId: input.context.requestId,
    disposition: input.disposition,
    bundleId: input.bundleId,
    status: input.status,
    reasonCodes: [...input.reasonCodes],
    candidateCount: input.candidateCount,
    removedCount: input.removedCount,
    projectedCount: input.projectedCount,
    citationCount: input.citationCount,
    providerCalls: 0 as const,
  });
}

function snapshotProjectorInput(input: unknown): ProjectorInputSnapshot | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
  try {
    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const expected = ['context', 'retrieverResult', 'verifier', 'contextBudget'] as const;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expected.length ||
      keys.some(
        (key) => typeof key !== 'string' || !expected.includes(key as (typeof expected)[number]),
      )
    ) {
      return null;
    }
    const values: Record<(typeof expected)[number], unknown> = {
      context: undefined,
      retrieverResult: undefined,
      verifier: undefined,
      contextBudget: undefined,
    };
    for (const key of expected) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !('value' in descriptor)) return null;
      values[key] = descriptor.value;
    }
    return Object.freeze(values);
  } catch {
    return null;
  }
}

function parsePlainValue<T>(schema: z.ZodType<T>, input: unknown): T | null {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok) return null;
  const parsed = schema.safeParse(cloned.value);
  return parsed.success ? deepFreezeModelValue(parsed.data) : null;
}

function readAborted(context: AgentExecutionContextV1): boolean | null {
  try {
    return typeof context.signal.aborted === 'boolean' ? context.signal.aborted : null;
  } catch {
    return null;
  }
}

function truncateUtf16(
  value: string,
  maxUtf16CodeUnits: number,
): Readonly<{ value: string; truncated: boolean }> {
  if (value.length <= maxUtf16CodeUnits) {
    return Object.freeze({ value, truncated: false });
  }
  let output = '';
  for (const character of value) {
    if (output.length + character.length > maxUtf16CodeUnits) break;
    output += character;
  }
  return Object.freeze({ value: output.trim(), truncated: true });
}

function projectorFailure(
  reasonCode: Extract<EvidenceProjectorExecutionV1, { ok: false }>['reasonCode'],
): Extract<EvidenceProjectorExecutionV1, { ok: false }> {
  return Object.freeze({ ok: false, reasonCode });
}
