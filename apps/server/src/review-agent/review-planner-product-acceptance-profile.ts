export type ReviewPlannerProductAcceptanceEnvironment = 'branch' | 'main';
export type ReviewPlannerProductAcceptanceKind = 'product' | 'recovery';

type ReviewPlannerProductAcceptanceSchemas = Readonly<{
  manifest: string;
  slotResult: string;
  ownerIsolation: string;
  cleanup: string;
  success: string;
  recoveryManifest: string;
  recoveryMode: string;
  recoveryCleanup: string;
  recoveryTerminal: string;
  defaultOff: string;
  evidence: string;
}>;

export type ReviewPlannerProductAcceptanceSchemaKey =
  keyof ReviewPlannerProductAcceptanceSchemas;

export type ReviewPlannerProductAcceptanceProfile = Readonly<{
  lineage: 'v8' | 'v10';
  errorPrefix: 'V8_PRODUCT_ACCEPTANCE' | 'V10_PRODUCT_ACCEPTANCE';
  productConfirmation: string;
  recoveryConfirmation: string;
  schemas: ReviewPlannerProductAcceptanceSchemas;
  publicLedgerPath(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): string;
  recoveryPath(environment: ReviewPlannerProductAcceptanceEnvironment): string;
  browserProfilePath(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): string;
  publicLedgerSegments(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): readonly string[];
  recoverySegments(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): readonly string[];
}>;

function createReviewPlannerProductAcceptanceProfile(
  lineage: 'v8' | 'v10',
): ReviewPlannerProductAcceptanceProfile {
  const namespace = `phase-6-9-5-${lineage}-product-acceptance`;
  const schemaNamespace = `phase-6.9.5-${lineage}-product-acceptance`;
  const errorPrefix =
    lineage === 'v8' ? 'V8_PRODUCT_ACCEPTANCE' : 'V10_PRODUCT_ACCEPTANCE';
  return Object.freeze<ReviewPlannerProductAcceptanceProfile>({
    lineage,
    errorPrefix,
    productConfirmation: `--confirm-${lineage}-review-planner-product-acceptance`,
    recoveryConfirmation: `--confirm-${lineage}-review-planner-product-acceptance-recovery-only`,
    schemas: Object.freeze({
      manifest: `${schemaNamespace}-manifest-v1`,
      slotResult: `${schemaNamespace}-slot-result-v1`,
      ownerIsolation: `${schemaNamespace}-owner-isolation-v1`,
      cleanup: `${schemaNamespace}-cleanup-v1`,
      success: `${schemaNamespace}-success-v1`,
      recoveryManifest: `${schemaNamespace}-recovery-v1`,
      recoveryMode: `${schemaNamespace}-mode-v1`,
      recoveryCleanup: `${schemaNamespace}-recovery-cleanup-v1`,
      recoveryTerminal: `${schemaNamespace}-recovery-terminal-v1`,
      defaultOff: `${schemaNamespace}-default-off-v2`,
      evidence: `phase-6.9.5-review-planner-${lineage}-product-acceptance-v1`,
    }),
    publicLedgerPath: (
      environment: ReviewPlannerProductAcceptanceEnvironment,
    ) => `docs/acceptance/evidence/${namespace}/${environment}`,
    recoveryPath: (environment: ReviewPlannerProductAcceptanceEnvironment) =>
      `.tmp/${namespace}/${environment}`,
    browserProfilePath: (
      environment: ReviewPlannerProductAcceptanceEnvironment,
    ) => `.tmp/${namespace}/${environment}/profile-${lineage}`,
    publicLedgerSegments: (
      environment: ReviewPlannerProductAcceptanceEnvironment,
    ) =>
      Object.freeze(['docs', 'acceptance', 'evidence', namespace, environment]),
    recoverySegments: (
      environment: ReviewPlannerProductAcceptanceEnvironment,
    ) => Object.freeze(['.tmp', namespace, environment]),
  });
}

export const REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE =
  createReviewPlannerProductAcceptanceProfile('v8');

export const REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE =
  createReviewPlannerProductAcceptanceProfile('v10');

export function normalizeReviewPlannerProductAcceptanceSchemaRecord(
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const record = { ...(value as Record<string, unknown>) };
    if (record.schemaVersion !== profile.schemas[key]) return null;
    return {
      ...record,
      schemaVersion: REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas[key],
    };
  } catch {
    return null;
  }
}

export function withReviewPlannerProductAcceptanceSchemaIdentity(
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
  value: Record<string, unknown>,
) {
  return { ...value, schemaVersion: profile.schemas[key] };
}

export function parseReviewPlannerProductAcceptanceArguments(
  profile: ReviewPlannerProductAcceptanceProfile,
  argv: readonly string[],
  kind: ReviewPlannerProductAcceptanceKind,
): Readonly<{ environment: ReviewPlannerProductAcceptanceEnvironment }> {
  const confirmation =
    kind === 'product'
      ? profile.productConfirmation
      : profile.recoveryConfirmation;
  if (
    argv.length !== 2 ||
    argv[0] !== confirmation ||
    (argv[1] !== '--environment=branch' && argv[1] !== '--environment=main')
  ) {
    throw new Error(`${profile.errorPrefix}_CONFIRMATION_REQUIRED`);
  }
  return Object.freeze({
    environment: argv[1] === '--environment=branch' ? 'branch' : 'main',
  });
}
