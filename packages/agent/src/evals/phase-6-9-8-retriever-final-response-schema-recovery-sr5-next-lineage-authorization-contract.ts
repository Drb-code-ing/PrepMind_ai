import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_8_SR5_NEXT_LINEAGE,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-admission.ts';

export const PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-next-lineage-authorization-v1' as const;
export const PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_AUTHORITY =
  'zero_provider_retriever_final_response_schema_recovery_sr5_next_lineage_authorization' as const;
export const PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_GATE =
  'sr5_next_lineage_authorization_contract_zero_provider' as const;
export const PHASE_6_9_8_SR5_NEXT_APPROVED_TAG =
  'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v3-approved' as const;
export const PHASE_6_9_8_SR5_NEXT_APPROVED_SOURCE_REF =
  `refs/tags/${PHASE_6_9_8_SR5_NEXT_APPROVED_TAG}` as const;
export const PHASE_6_9_8_SR5_NEXT_DATA_BOUNDARY_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V3_DATA_BOUNDARY_ACCEPTED' as const;
export const PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V3_APPROVED' as const;
export const PHASE_6_9_8_SR5_NEXT_DATA_BOUNDARY_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V3_DEEPSEEK_AND_QWEN_DATA_BOUNDARY' as const;
export const PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V3_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_8_SR5_NEXT_SOURCE_COMMIT =
  '69fb2c97946f5a8f9468064a7d12406b6584af6b' as const;
export const PHASE_6_9_8_SR5_NEXT_SOURCE_BUNDLE_SHA256 =
  'sha256:b4bd64db17c1281441ac72f1a78c06c22fdf84aeb372fa6173b790a36e3611ca' as const;
export const PHASE_6_9_8_SR5_NEXT_TAG_OBJECT_ID =
  'b450e8759ef252a83195f5e4763c198e0c82ac99' as const;

export const PHASE_6_9_8_SR5_NEXT_DATA_BOUNDARY_SCHEMA = z
  .object({
    accepted: z.literal(true),
    confirmation: z.literal(PHASE_6_9_8_SR5_NEXT_DATA_BOUNDARY_CONFIRMATION),
    providers: z.tuple([z.literal('deepseek'), z.literal('qwen')]),
    scope: z.literal('current_account'),
  })
  .strict();
export const PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_SCHEMA = z
  .object({
    confirmation: z.literal(PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CONFIRMATION),
    lineage: z.literal(PHASE_6_9_8_SR5_NEXT_LINEAGE),
    sourceBranch: z.literal('main'),
    sourceCommit: z.literal(PHASE_6_9_8_SR5_NEXT_SOURCE_COMMIT),
    sourceBundleSha256: z.literal(PHASE_6_9_8_SR5_NEXT_SOURCE_BUNDLE_SHA256),
    approvedTag: z.literal(PHASE_6_9_8_SR5_NEXT_APPROVED_TAG),
    approvedTagObjectId: z.literal(PHASE_6_9_8_SR5_NEXT_TAG_OBJECT_ID),
    invocation: z.literal('once'),
  })
  .strict();

export type Phase698Sr5NextDataBoundary = z.infer<typeof PHASE_6_9_8_SR5_NEXT_DATA_BOUNDARY_SCHEMA>;
export type Phase698Sr5NextAuthorization = z.infer<
  typeof PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_SCHEMA
>;
export type Phase698Sr5NextAuthorizationCapability = Readonly<{
  version: typeof PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_VERSION;
}>;
export type Phase698Sr5NextAuthorizationRecord = Readonly<{
  version: typeof PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_VERSION;
  lineage: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE;
  authority: typeof PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_AUTHORITY;
  gate: typeof PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_GATE;
  qualityAuthority: 'none';
  mode: 'zero_provider_authorization_contract';
  source: Readonly<{
    branch: 'main';
    sourceCommit: string;
    sourceBundleSha256: string;
    sourceManifestSha256: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256;
    approvedTag: typeof PHASE_6_9_8_SR5_NEXT_APPROVED_TAG;
    approvedTagObjectId: string;
  }>;
  dataBoundary: Readonly<{
    accepted: true;
    providers: readonly ['deepseek', 'qwen'];
    scope: 'current_account';
    confirmationSha256: string;
  }>;
  authorization: Readonly<{
    sourceCommit: string;
    sourceBundleSha256: string;
    approvedTagObjectId: string;
    confirmationSha256: string;
    invocation: 'once';
  }>;
  providerDispatchAllowed: false;
  credentialReads: 0;
  providerCalls: 0;
  formalEvidence: 0;
  businessWrites: 0;
}>;

export type Phase698Sr5NextAuthorizationInput = Readonly<{
  source: Readonly<{
    branch: 'main';
    sourceCommit: string;
    sourceBundleSha256: string;
    sourceManifestSha256: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256;
    approvedTag: typeof PHASE_6_9_8_SR5_NEXT_APPROVED_TAG;
    approvedTagObjectId: string;
  }>;
  dataBoundary: unknown;
  authorization: unknown;
}>;

const issuedCapabilities = new WeakMap<object, Phase698Sr5NextAuthorizationRecord>();
const consumedCapabilities = new WeakSet<object>();

export function createPhase698Sr5NextAuthorizationInputForTest(): Phase698Sr5NextAuthorizationInput {
  return Object.freeze({
    source: {
      branch: 'main' as const,
      sourceCommit: PHASE_6_9_8_SR5_NEXT_SOURCE_COMMIT,
      sourceBundleSha256: PHASE_6_9_8_SR5_NEXT_SOURCE_BUNDLE_SHA256,
      sourceManifestSha256: PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256,
      approvedTag: PHASE_6_9_8_SR5_NEXT_APPROVED_TAG,
      approvedTagObjectId: PHASE_6_9_8_SR5_NEXT_TAG_OBJECT_ID,
    },
    dataBoundary: {
      accepted: true,
      confirmation: PHASE_6_9_8_SR5_NEXT_DATA_BOUNDARY_CONFIRMATION,
      providers: ['deepseek', 'qwen'],
      scope: 'current_account',
    },
    authorization: {
      confirmation: PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CONFIRMATION,
      lineage: PHASE_6_9_8_SR5_NEXT_LINEAGE,
      sourceBranch: 'main',
      sourceCommit: PHASE_6_9_8_SR5_NEXT_SOURCE_COMMIT,
      sourceBundleSha256: PHASE_6_9_8_SR5_NEXT_SOURCE_BUNDLE_SHA256,
      approvedTag: PHASE_6_9_8_SR5_NEXT_APPROVED_TAG,
      approvedTagObjectId: PHASE_6_9_8_SR5_NEXT_TAG_OBJECT_ID,
      invocation: 'once',
    },
  });
}

export function admitPhase698Sr5NextAuthorizationZeroProvider(
  input: Phase698Sr5NextAuthorizationInput,
):
  | Readonly<{
      ok: true;
      record: Phase698Sr5NextAuthorizationRecord;
      capability: Phase698Sr5NextAuthorizationCapability;
    }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'data_boundary_invalid'
        | 'authorization_invalid'
        | 'source_invalid'
        | 'source_authorization_mismatch';
    }> {
  let dataBoundary: Phase698Sr5NextDataBoundary;
  let authorization: Phase698Sr5NextAuthorization;
  try {
    const source = input?.source;
    if (
      source?.branch !== 'main' ||
      source.sourceCommit !== PHASE_6_9_8_SR5_NEXT_SOURCE_COMMIT ||
      source.sourceBundleSha256 !== PHASE_6_9_8_SR5_NEXT_SOURCE_BUNDLE_SHA256 ||
      source.sourceManifestSha256 !== PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256 ||
      source.approvedTag !== PHASE_6_9_8_SR5_NEXT_APPROVED_TAG ||
      source.approvedTagObjectId !== PHASE_6_9_8_SR5_NEXT_TAG_OBJECT_ID
    ) {
      return Object.freeze({ ok: false as const, reasonCode: 'source_invalid' as const });
    }
    const boundary = PHASE_6_9_8_SR5_NEXT_DATA_BOUNDARY_SCHEMA.safeParse(input.dataBoundary);
    if (!boundary.success) {
      return Object.freeze({ ok: false as const, reasonCode: 'data_boundary_invalid' as const });
    }
    const parsedAuthorization = PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_SCHEMA.safeParse(
      input.authorization,
    );
    if (!parsedAuthorization.success) {
      return Object.freeze({ ok: false as const, reasonCode: 'authorization_invalid' as const });
    }
    dataBoundary = boundary.data;
    authorization = parsedAuthorization.data;
    if (
      authorization.sourceCommit !== source.sourceCommit ||
      authorization.sourceBundleSha256 !== source.sourceBundleSha256 ||
      authorization.approvedTagObjectId !== source.approvedTagObjectId
    ) {
      return Object.freeze({
        ok: false as const,
        reasonCode: 'source_authorization_mismatch' as const,
      });
    }
    const record = deepFreeze({
      version: PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_VERSION,
      lineage: PHASE_6_9_8_SR5_NEXT_LINEAGE,
      authority: PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_AUTHORITY,
      gate: PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_GATE,
      qualityAuthority: 'none' as const,
      mode: 'zero_provider_authorization_contract' as const,
      source: deepFreeze({ ...source }),
      dataBoundary: deepFreeze({
        accepted: true as const,
        providers: ['deepseek', 'qwen'] as const,
        scope: 'current_account' as const,
        confirmationSha256: digest(dataBoundary.confirmation),
      }),
      authorization: deepFreeze({
        sourceCommit: authorization.sourceCommit,
        sourceBundleSha256: authorization.sourceBundleSha256,
        approvedTagObjectId: authorization.approvedTagObjectId,
        confirmationSha256: digest(authorization.confirmation),
        invocation: 'once' as const,
      }),
      providerDispatchAllowed: false as const,
      credentialReads: 0 as const,
      providerCalls: 0 as const,
      formalEvidence: 0 as const,
      businessWrites: 0 as const,
    });
    const capability = Object.freeze({
      version: PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_VERSION,
    });
    issuedCapabilities.set(capability, record);
    return Object.freeze({ ok: true as const, record, capability });
  } catch {
    return Object.freeze({ ok: false as const, reasonCode: 'source_invalid' as const });
  }
}

export function consumePhase698Sr5NextAuthorizationCapability(
  capability: unknown,
): Phase698Sr5NextAuthorizationRecord {
  if (!isObject(capability) || consumedCapabilities.has(capability)) {
    throw new Error('PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CAPABILITY_INVALID');
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Reflect.getOwnPropertyDescriptor(capability, 'version');
  } catch {
    throw new Error('PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CAPABILITY_INVALID');
  }
  const record = issuedCapabilities.get(capability);
  if (
    !descriptor ||
    !('value' in descriptor) ||
    descriptor.value !== PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_VERSION ||
    !record
  ) {
    throw new Error('PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CAPABILITY_INVALID');
  }
  consumedCapabilities.add(capability);
  return record;
}

export function parsePhase698Sr5NextAuthorizationArgs(
  args: readonly string[],
): Readonly<{ kind: 'help' }> | Readonly<{ kind: 'rejected' }> {
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) return { kind: 'help' };
  return { kind: 'rejected' };
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}
