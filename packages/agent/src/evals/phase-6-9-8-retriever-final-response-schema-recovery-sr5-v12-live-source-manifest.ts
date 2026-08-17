import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
  canonicalPhase698RetrieverSchemaRecoverySr5Json,
  sha256Phase698RetrieverSchemaRecoverySr5,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-contract.ts';

/**
 * The historical SR5 admission manifest is already a documented checkpoint.
 * Live execution therefore binds an independent Git-object bundle instead of
 * mutating the historical source-path list and its SHA.
 *
 * Whole package trees deliberately cover the production adapter, proxy
 * preflight, shared contracts and their transitive runtime dependencies.  The
 * root package manifest and Bun lockfile bind workspace resolution as blobs.
 */
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-source-manifest-v4' as const;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_OBJECTS = Object.freeze([
  Object.freeze({ path: 'package.json', objectKind: 'blob' as const }),
  Object.freeze({ path: 'bun.lock', objectKind: 'blob' as const }),
  Object.freeze({ path: 'packages/agent', objectKind: 'tree' as const }),
  Object.freeze({ path: 'packages/ai', objectKind: 'tree' as const }),
  Object.freeze({ path: 'packages/types', objectKind: 'tree' as const }),
] as const);

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST = deepFreeze({
  version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_VERSION,
  approvedBranch: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH,
  approvedSourceRef: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
  historicalAdmissionManifestSha256:
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
  sourceObjects: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_OBJECTS,
});

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256 =
  `sha256:${sha256Phase698RetrieverSchemaRecoverySr5(
    canonicalPhase698RetrieverSchemaRecoverySr5Json(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST,
    ),
  )}` as const;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_VERSION),
    sourceCommit: z.string().regex(/^[0-9a-f]{40}$/u),
    sourceManifestSha256: z.literal(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
    ),
    sourceBundleSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
  })
  .strict();

export type Phase698RetrieverSchemaRecoverySr5LiveSourceBinding = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA
>;

export function createPhase698RetrieverSchemaRecoverySr5LiveSourceBinding(
  sourceCommit: string,
  sourceBundleSha256: string,
): Phase698RetrieverSchemaRecoverySr5LiveSourceBinding {
  return deepFreeze(
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA.parse({
      version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_VERSION,
      sourceCommit,
      sourceManifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
      sourceBundleSha256,
    }),
  );
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
