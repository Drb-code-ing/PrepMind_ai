/**
 * Detached SR5 runnable-bundle anchor. This tiny file is intentionally outside
 * the bundle it authenticates, so the authority implementation itself can be
 * hashed without a self-reference. The approved commit/tag and remote parity
 * bind this anchor file; production admission recomputes the referenced bundle.
 */
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_DETACHED_SOURCE_MANIFEST_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-sr5-detached-source-manifest-v1' as const;

export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_BUNDLE_SHA256 =
  '61e6bb60fa2c5aa2a74d511b4ba8fbaf86ed186d8993afb9e5ddb844bb05d08c' as const;
