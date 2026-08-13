import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_8_SR5_NEXT_LINEAGE,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_OBJECTS,
  PHASE_6_9_8_SR5_SEALED_V2_RECEIPT,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-admission.ts';
import {
  canonicalPhase698RetrieverSchemaRecoverySr5Json,
  sha256Phase698RetrieverSchemaRecoverySr5,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';

const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SHA256 = z.string().regex(/^sha256:[0-9a-f]{64}$/u);

export const PHASE_6_9_8_SR5_RUNTIME_SOURCE_BINDING_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-runtime-source-binding-v1' as const;
export const PHASE_6_9_8_SR5_RUNTIME_SOURCE_BINDING_AUTHORITY =
  'zero_provider_retriever_final_response_schema_recovery_sr5_runtime_source_binding_contract' as const;
export const PHASE_6_9_8_SR5_RUNTIME_SOURCE_BINDING_GATE =
  'sr5_runtime_source_binding_contract_zero_provider' as const;
export const PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG =
  'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v7-approved' as const;
export const PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF =
  `refs/tags/${PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG}` as const;
export const PHASE_6_9_8_SR5_RUNTIME_DATA_BOUNDARY_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V7_DEEPSEEK_AND_QWEN_DATA_BOUNDARY' as const;
export const PHASE_6_9_8_SR5_RUNTIME_AUTHORIZATION_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V7_CONTROLLED_LIVE_ONCE' as const;

export const PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST = deepFreeze({
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-runtime-source-manifest-v1',
  lineage: PHASE_6_9_8_SR5_NEXT_LINEAGE,
  branch: 'main',
  approvedTag: PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG,
  sourceObjects: PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_OBJECTS,
  sealedPredecessor: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT,
});
export const PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST_SHA256 =
  `sha256:${sha256Phase698RetrieverSchemaRecoverySr5(
    canonicalPhase698RetrieverSchemaRecoverySr5Json(PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST),
  )}` as const;

export const PHASE_6_9_8_SR5_RUNTIME_SOURCE_RECEIPT_SCHEMA = z
  .object({
    branch: z.literal('main'),
    head: COMMIT,
    upstream: COMMIT,
    origin: COMMIT,
    clean: z.literal(true),
    sourceManifestSha256: z.literal(PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST_SHA256),
    sourceBundleSha256: SHA256,
    approvedTag: z.literal(PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG),
    approvedTagRef: z.literal(PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF),
    approvedTagKind: z.literal('tag'),
    approvedTagObjectId: COMMIT,
    originTagObjectId: COMMIT,
    peeledCommit: COMMIT,
    targetCommit: COMMIT,
    currentLineageEvidencePaths: z.array(z.string()).length(0),
  })
  .strict()
  .superRefine((source, context) => {
    if (
      source.head !== source.upstream ||
      source.head !== source.origin ||
      source.head !== source.peeledCommit ||
      source.head !== source.targetCommit ||
      source.approvedTagObjectId !== source.originTagObjectId
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_parity_invalid' });
    }
  });

const DATA_BOUNDARY_SCHEMA = z
  .object({
    accepted: z.literal(true),
    confirmation: z.literal(PHASE_6_9_8_SR5_RUNTIME_DATA_BOUNDARY_CONFIRMATION),
    providers: z.tuple([z.literal('deepseek'), z.literal('qwen')]),
    scope: z.literal('current_account'),
  })
  .strict();

const AUTHORIZATION_SCHEMA = z
  .object({
    confirmation: z.literal(PHASE_6_9_8_SR5_RUNTIME_AUTHORIZATION_CONFIRMATION),
    lineage: z.literal(PHASE_6_9_8_SR5_NEXT_LINEAGE),
    sourceBranch: z.literal('main'),
    sourceCommit: COMMIT,
    sourceManifestSha256: z.literal(PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST_SHA256),
    sourceBundleSha256: SHA256,
    approvedTag: z.literal(PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG),
    approvedTagObjectId: COMMIT,
    invocation: z.literal('once'),
  })
  .strict();

export type Phase698Sr5RuntimeSourceReceipt = z.infer<
  typeof PHASE_6_9_8_SR5_RUNTIME_SOURCE_RECEIPT_SCHEMA
>;
export type Phase698Sr5RuntimeSourceBindingRecord = Readonly<{
  version: typeof PHASE_6_9_8_SR5_RUNTIME_SOURCE_BINDING_VERSION;
  authority: typeof PHASE_6_9_8_SR5_RUNTIME_SOURCE_BINDING_AUTHORITY;
  gate: typeof PHASE_6_9_8_SR5_RUNTIME_SOURCE_BINDING_GATE;
  qualityAuthority: 'none';
  mode: 'zero_provider_runtime_source_binding_contract';
  source: Phase698Sr5RuntimeSourceReceipt;
  dataBoundaryConfirmationSha256: string;
  authorizationConfirmationSha256: string;
  invocation: 'once';
  gitAuthorityIssued: false;
  runnerInvocationAllowed: false;
  providerDispatchAllowed: false;
  credentialReads: 0;
  providerCalls: 0;
  formalEvidence: 0;
  businessWrites: 0;
}>;
export function bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider(
  input: Readonly<{
    sourceReceipt: unknown;
    dataBoundary: unknown;
    authorization: unknown;
  }>,
):
  | Readonly<{ ok: true; record: Phase698Sr5RuntimeSourceBindingRecord }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'source_receipt_invalid'
        | 'data_boundary_invalid'
        | 'authorization_invalid'
        | 'source_authorization_mismatch';
    }> {
  try {
    const source = PHASE_6_9_8_SR5_RUNTIME_SOURCE_RECEIPT_SCHEMA.safeParse(input.sourceReceipt);
    if (!source.success) return invalid('source_receipt_invalid');
    const boundary = DATA_BOUNDARY_SCHEMA.safeParse(input.dataBoundary);
    if (!boundary.success) return invalid('data_boundary_invalid');
    const authorization = AUTHORIZATION_SCHEMA.safeParse(input.authorization);
    if (!authorization.success) return invalid('authorization_invalid');
    if (
      authorization.data.sourceCommit !== source.data.head ||
      authorization.data.sourceManifestSha256 !== source.data.sourceManifestSha256 ||
      authorization.data.sourceBundleSha256 !== source.data.sourceBundleSha256 ||
      authorization.data.approvedTagObjectId !== source.data.approvedTagObjectId
    ) {
      return invalid('source_authorization_mismatch');
    }
    return Object.freeze({
      ok: true as const,
      record: deepFreeze({
        version: PHASE_6_9_8_SR5_RUNTIME_SOURCE_BINDING_VERSION,
        authority: PHASE_6_9_8_SR5_RUNTIME_SOURCE_BINDING_AUTHORITY,
        gate: PHASE_6_9_8_SR5_RUNTIME_SOURCE_BINDING_GATE,
        qualityAuthority: 'none' as const,
        mode: 'zero_provider_runtime_source_binding_contract' as const,
        source: source.data,
        dataBoundaryConfirmationSha256: digest(boundary.data.confirmation),
        authorizationConfirmationSha256: digest(authorization.data.confirmation),
        invocation: 'once' as const,
        gitAuthorityIssued: false as const,
        runnerInvocationAllowed: false as const,
        providerDispatchAllowed: false as const,
        credentialReads: 0 as const,
        providerCalls: 0 as const,
        formalEvidence: 0 as const,
        businessWrites: 0 as const,
      }),
    });
  } catch {
    return invalid('source_receipt_invalid');
  }
}

export function createPhase698Sr5RuntimeSourceBindingInputForTest(
  commit = 'a'.repeat(40),
  bundle = `sha256:${'b'.repeat(64)}`,
  tagObjectId = 'c'.repeat(40),
) {
  return deepFreeze({
    sourceReceipt: {
      branch: 'main' as const,
      head: commit,
      upstream: commit,
      origin: commit,
      clean: true as const,
      sourceManifestSha256: PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST_SHA256,
      sourceBundleSha256: bundle,
      approvedTag: PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG,
      approvedTagRef: PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF,
      approvedTagKind: 'tag' as const,
      approvedTagObjectId: tagObjectId,
      originTagObjectId: tagObjectId,
      peeledCommit: commit,
      targetCommit: commit,
      currentLineageEvidencePaths: [],
    },
    dataBoundary: {
      accepted: true,
      confirmation: PHASE_6_9_8_SR5_RUNTIME_DATA_BOUNDARY_CONFIRMATION,
      providers: ['deepseek', 'qwen'],
      scope: 'current_account',
    },
    authorization: {
      confirmation: PHASE_6_9_8_SR5_RUNTIME_AUTHORIZATION_CONFIRMATION,
      lineage: PHASE_6_9_8_SR5_NEXT_LINEAGE,
      sourceBranch: 'main',
      sourceCommit: commit,
      sourceManifestSha256: PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST_SHA256,
      sourceBundleSha256: bundle,
      approvedTag: PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG,
      approvedTagObjectId: tagObjectId,
      invocation: 'once',
    },
  });
}

export function parsePhase698Sr5RuntimeSourceBindingArgs(
  args: readonly string[],
): Readonly<{ kind: 'help' }> | Readonly<{ kind: 'rejected' }> {
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) return { kind: 'help' };
  return { kind: 'rejected' };
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function invalid<T extends string>(reasonCode: T) {
  return Object.freeze({ ok: false as const, reasonCode });
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}
