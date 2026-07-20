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

export type ReviewPlannerV11ProductAcceptanceProfile = Readonly<{
  lineage: 'v11';
  errorPrefix: 'V11_PRODUCT_ACCEPTANCE';
  productConfirmation: '--confirm-v11-review-planner-product-acceptance';
  recoveryConfirmation: '--confirm-v11-review-planner-product-acceptance-recovery-only';
  schemas: Readonly<{
    failure: 'phase-6.9.5-v11-product-acceptance-failure-v1';
    checkpoint: 'phase-6.9.5-v11-product-acceptance-checkpoint-v1';
    manifest: 'phase-6.9.5-v11-product-acceptance-manifest-v1';
    executionManifest: 'phase-6.9.5-v11-product-acceptance-execution-manifest-v1';
    slotResult: 'phase-6.9.5-v11-product-acceptance-slot-result-v1';
    defaultOff: 'phase-6.9.5-v11-product-acceptance-default-off-v1';
    ownerIsolation: 'phase-6.9.5-v11-product-acceptance-owner-isolation-v1';
    cleanup: 'phase-6.9.5-v11-product-acceptance-cleanup-v1';
    acceptance: 'phase-6.9.5-v11-product-acceptance-aggregate-v1';
    success: 'phase-6.9.5-v11-product-acceptance-success-v1';
  }>;
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
  executionManifestPath(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): string;
  executionManifestSegments(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): readonly string[];
}>;

export type ReviewPlannerV12ProductAcceptanceProfile = Readonly<{
  lineage: 'v12';
  errorPrefix: 'V12_PRODUCT_ACCEPTANCE';
  productConfirmation: '--confirm-v12-review-planner-product-acceptance';
  recoveryConfirmation: '--confirm-v12-review-planner-product-acceptance-recovery-only';
  schemas: Readonly<{
    failure: 'phase-6.9.5-v12-product-acceptance-failure-v1';
    checkpoint: 'phase-6.9.5-v12-product-acceptance-checkpoint-v1';
    manifest: 'phase-6.9.5-v12-product-acceptance-manifest-v1';
    executionManifest: 'phase-6.9.5-v12-product-acceptance-execution-manifest-v1';
    slotResult: 'phase-6.9.5-v12-product-acceptance-slot-result-v1';
    defaultOff: 'phase-6.9.5-v12-product-acceptance-default-off-v1';
    ownerIsolation: 'phase-6.9.5-v12-product-acceptance-owner-isolation-v1';
    cleanup: 'phase-6.9.5-v12-product-acceptance-cleanup-v1';
    acceptance: 'phase-6.9.5-v12-product-acceptance-aggregate-v1';
    success: 'phase-6.9.5-v12-product-acceptance-success-v1';
    recovery: 'phase-6.9.5-v12-product-acceptance-recovery-v1';
  }>;
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
  executionManifestPath(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): string;
  executionManifestSegments(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): readonly string[];
}>;

export type ReviewPlannerV13ProductAcceptanceProfile = Readonly<{
  lineage: 'v13';
  errorPrefix: 'V13_PRODUCT_ACCEPTANCE';
  productConfirmation: '--confirm-v13-review-planner-product-acceptance';
  recoveryConfirmation: '--confirm-v13-review-planner-product-acceptance-recovery-only';
  schemas: Readonly<{
    failure: 'phase-6.9.5-v13-product-acceptance-failure-v1';
    checkpoint: 'phase-6.9.5-v13-product-acceptance-checkpoint-v1';
    manifest: 'phase-6.9.5-v13-product-acceptance-manifest-v1';
    executionManifest: 'phase-6.9.5-v13-product-acceptance-execution-manifest-v1';
    slotResult: 'phase-6.9.5-v13-product-acceptance-slot-result-v1';
    defaultOff: 'phase-6.9.5-v13-product-acceptance-default-off-v1';
    ownerIsolation: 'phase-6.9.5-v13-product-acceptance-owner-isolation-v1';
    cleanup: 'phase-6.9.5-v13-product-acceptance-cleanup-v1';
    acceptance: 'phase-6.9.5-v13-product-acceptance-aggregate-v1';
    success: 'phase-6.9.5-v13-product-acceptance-success-v1';
    recovery: 'phase-6.9.5-v13-product-acceptance-recovery-v1';
  }>;
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
  executionManifestPath(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): string;
  executionManifestSegments(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): readonly string[];
}>;

export type ReviewPlannerV14ProductAcceptanceProfile = Readonly<{
  lineage: 'v14';
  errorPrefix: 'V14_PRODUCT_ACCEPTANCE';
  productConfirmation: '--confirm-v14-review-planner-product-acceptance';
  recoveryConfirmation: '--confirm-v14-review-planner-product-acceptance-recovery-only';
  schemas: Readonly<{
    failure: 'phase-6.9.5-v14-product-acceptance-failure-v1';
    checkpoint: 'phase-6.9.5-v14-product-acceptance-checkpoint-v1';
    manifest: 'phase-6.9.5-v14-product-acceptance-manifest-v1';
    executionManifest: 'phase-6.9.5-v14-product-acceptance-execution-manifest-v1';
    slotResult: 'phase-6.9.5-v14-product-acceptance-slot-result-v1';
    defaultOff: 'phase-6.9.5-v14-product-acceptance-default-off-v1';
    ownerIsolation: 'phase-6.9.5-v14-product-acceptance-owner-isolation-v1';
    cleanup: 'phase-6.9.5-v14-product-acceptance-cleanup-v1';
    acceptance: 'phase-6.9.5-v14-product-acceptance-aggregate-v1';
    success: 'phase-6.9.5-v14-product-acceptance-success-v1';
    recovery: 'phase-6.9.5-v14-product-acceptance-recovery-v1';
  }>;
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
  executionManifestPath(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): string;
  executionManifestSegments(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): readonly string[];
}>;

export type ReviewPlannerV15ProductAcceptanceProfile = Readonly<{
  lineage: 'v15';
  errorPrefix: 'V15_PRODUCT_ACCEPTANCE';
  productConfirmation: '--confirm-v15-review-planner-product-acceptance';
  recoveryConfirmation: '--confirm-v15-review-planner-product-acceptance-recovery-only';
  schemas: Readonly<{
    failure: 'phase-6.9.5-v15-product-acceptance-failure-v1';
    checkpoint: 'phase-6.9.5-v15-product-acceptance-checkpoint-v1';
    manifest: 'phase-6.9.5-v15-product-acceptance-manifest-v1';
    executionManifest: 'phase-6.9.5-v15-product-acceptance-execution-manifest-v1';
    slotResult: 'phase-6.9.5-v15-product-acceptance-slot-result-v1';
    defaultOff: 'phase-6.9.5-v15-product-acceptance-default-off-v1';
    ownerIsolation: 'phase-6.9.5-v15-product-acceptance-owner-isolation-v1';
    cleanup: 'phase-6.9.5-v15-product-acceptance-cleanup-v1';
    acceptance: 'phase-6.9.5-v15-product-acceptance-aggregate-v1';
    success: 'phase-6.9.5-v15-product-acceptance-success-v1';
    recovery: 'phase-6.9.5-v15-product-acceptance-recovery-v1';
  }>;
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
  executionManifestPath(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): string;
  executionManifestSegments(
    environment: ReviewPlannerProductAcceptanceEnvironment,
  ): readonly string[];
}>;

export type ReviewPlannerV16ProductAcceptanceProfile = Readonly<
  Omit<
    ReviewPlannerV15ProductAcceptanceProfile,
    | 'lineage'
    | 'errorPrefix'
    | 'productConfirmation'
    | 'recoveryConfirmation'
    | 'schemas'
  > & {
    lineage: 'v16';
    errorPrefix: 'V16_PRODUCT_ACCEPTANCE';
    productConfirmation: '--confirm-v16-review-planner-product-acceptance';
    recoveryConfirmation: '--confirm-v16-review-planner-product-acceptance-recovery-only';
    schemas: Readonly<{
      failure: 'phase-6.9.5-v16-product-acceptance-failure-v1';
      checkpoint: 'phase-6.9.5-v16-product-acceptance-checkpoint-v1';
      manifest: 'phase-6.9.5-v16-product-acceptance-manifest-v1';
      executionManifest: 'phase-6.9.5-v16-product-acceptance-execution-manifest-v1';
      slotResult: 'phase-6.9.5-v16-product-acceptance-slot-result-v1';
      defaultOff: 'phase-6.9.5-v16-product-acceptance-default-off-v1';
      ownerIsolation: 'phase-6.9.5-v16-product-acceptance-owner-isolation-v1';
      cleanup: 'phase-6.9.5-v16-product-acceptance-cleanup-v1';
      acceptance: 'phase-6.9.5-v16-product-acceptance-aggregate-v1';
      success: 'phase-6.9.5-v16-product-acceptance-success-v1';
      recovery: 'phase-6.9.5-v16-product-acceptance-recovery-v1';
    }>;
  }
>;

export type ReviewPlannerV17ProductAcceptanceProfile = Readonly<
  Omit<
    ReviewPlannerV16ProductAcceptanceProfile,
    | 'lineage'
    | 'errorPrefix'
    | 'productConfirmation'
    | 'recoveryConfirmation'
    | 'schemas'
  > & {
    lineage: 'v17';
    errorPrefix: 'V17_PRODUCT_ACCEPTANCE';
    productConfirmation: '--confirm-v17-review-planner-product-acceptance';
    recoveryConfirmation: '--confirm-v17-review-planner-product-acceptance-recovery-only';
    schemas: Readonly<{
      failure: 'phase-6.9.5-v17-product-acceptance-failure-v1';
      checkpoint: 'phase-6.9.5-v17-product-acceptance-checkpoint-v1';
      manifest: 'phase-6.9.5-v17-product-acceptance-manifest-v1';
      executionManifest: 'phase-6.9.5-v17-product-acceptance-execution-manifest-v1';
      slotResult: 'phase-6.9.5-v17-product-acceptance-slot-result-v1';
      defaultOff: 'phase-6.9.5-v17-product-acceptance-default-off-v1';
      ownerIsolation: 'phase-6.9.5-v17-product-acceptance-owner-isolation-v1';
      cleanup: 'phase-6.9.5-v17-product-acceptance-cleanup-v1';
      acceptance: 'phase-6.9.5-v17-product-acceptance-aggregate-v1';
      success: 'phase-6.9.5-v17-product-acceptance-success-v1';
      recovery: 'phase-6.9.5-v17-product-acceptance-recovery-v1';
    }>;
  }
>;

export type ReviewPlannerV18ProductAcceptanceProfile = Readonly<
  Omit<
    ReviewPlannerV17ProductAcceptanceProfile,
    | 'lineage'
    | 'errorPrefix'
    | 'productConfirmation'
    | 'recoveryConfirmation'
    | 'schemas'
  > & {
    lineage: 'v18';
    errorPrefix: 'V18_PRODUCT_ACCEPTANCE';
    productConfirmation: '--confirm-v18-review-planner-product-acceptance';
    recoveryConfirmation: '--confirm-v18-review-planner-product-acceptance-recovery-only';
    schemas: Readonly<{
      failure: 'phase-6.9.5-v18-product-acceptance-failure-v1';
      checkpoint: 'phase-6.9.5-v18-product-acceptance-checkpoint-v1';
      manifest: 'phase-6.9.5-v18-product-acceptance-manifest-v1';
      executionManifest: 'phase-6.9.5-v18-product-acceptance-execution-manifest-v1';
      slotResult: 'phase-6.9.5-v18-product-acceptance-slot-result-v1';
      defaultOff: 'phase-6.9.5-v18-product-acceptance-default-off-v1';
      ownerIsolation: 'phase-6.9.5-v18-product-acceptance-owner-isolation-v1';
      cleanup: 'phase-6.9.5-v18-product-acceptance-cleanup-v1';
      acceptance: 'phase-6.9.5-v18-product-acceptance-aggregate-v1';
      success: 'phase-6.9.5-v18-product-acceptance-success-v1';
      recovery: 'phase-6.9.5-v18-product-acceptance-recovery-v1';
    }>;
  }
>;

export type ReviewPlannerV19ProductAcceptanceProfile = Readonly<
  Omit<
    ReviewPlannerV18ProductAcceptanceProfile,
    | 'lineage'
    | 'errorPrefix'
    | 'productConfirmation'
    | 'recoveryConfirmation'
    | 'schemas'
  > & {
    lineage: 'v19';
    errorPrefix: 'V19_PRODUCT_ACCEPTANCE';
    productConfirmation: '--confirm-v19-review-planner-product-acceptance';
    recoveryConfirmation: '--confirm-v19-review-planner-product-acceptance-recovery-only';
    schemas: Readonly<{
      failure: 'phase-6.9.5-v19-product-acceptance-failure-v1';
      checkpoint: 'phase-6.9.5-v19-product-acceptance-checkpoint-v1';
      manifest: 'phase-6.9.5-v19-product-acceptance-manifest-v1';
      executionManifest: 'phase-6.9.5-v19-product-acceptance-execution-manifest-v1';
      slotResult: 'phase-6.9.5-v19-product-acceptance-slot-result-v1';
      defaultOff: 'phase-6.9.5-v19-product-acceptance-default-off-v1';
      ownerIsolation: 'phase-6.9.5-v19-product-acceptance-owner-isolation-v1';
      cleanup: 'phase-6.9.5-v19-product-acceptance-cleanup-v1';
      acceptance: 'phase-6.9.5-v19-product-acceptance-aggregate-v1';
      success: 'phase-6.9.5-v19-product-acceptance-success-v1';
      recovery: 'phase-6.9.5-v19-product-acceptance-recovery-v1';
    }>;
  }
>;

export type ReviewPlannerV20ProductAcceptanceProfile = Readonly<
  Omit<
    ReviewPlannerV19ProductAcceptanceProfile,
    | 'lineage'
    | 'errorPrefix'
    | 'productConfirmation'
    | 'recoveryConfirmation'
    | 'schemas'
  > & {
    lineage: 'v20';
    errorPrefix: 'V20_PRODUCT_ACCEPTANCE';
    productConfirmation: '--confirm-v20-review-planner-product-acceptance';
    recoveryConfirmation: '--confirm-v20-review-planner-product-acceptance-recovery-only';
    schemas: Readonly<{
      failure: 'phase-6.9.5-v20-product-acceptance-failure-v1';
      checkpoint: 'phase-6.9.5-v20-product-acceptance-checkpoint-v1';
      manifest: 'phase-6.9.5-v20-product-acceptance-manifest-v1';
      executionManifest: 'phase-6.9.5-v20-product-acceptance-execution-manifest-v1';
      slotResult: 'phase-6.9.5-v20-product-acceptance-slot-result-v1';
      defaultOff: 'phase-6.9.5-v20-product-acceptance-default-off-v1';
      ownerIsolation: 'phase-6.9.5-v20-product-acceptance-owner-isolation-v1';
      cleanup: 'phase-6.9.5-v20-product-acceptance-cleanup-v1';
      acceptance: 'phase-6.9.5-v20-product-acceptance-aggregate-v1';
      success: 'phase-6.9.5-v20-product-acceptance-success-v1';
      recovery: 'phase-6.9.5-v20-product-acceptance-recovery-v1';
    }>;
  }
>;

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

export const REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV11ProductAcceptanceProfile>({
    lineage: 'v11',
    errorPrefix: 'V11_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v11-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v11-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v11-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v11-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v11-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v11-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v11-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v11-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v11-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v11-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v11-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v11-product-acceptance-success-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v11-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v11-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v11-product-acceptance/${environment}/profile-v11`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v11-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v11-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v11-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v11-product-acceptance-execution',
        environment,
      ]),
  });

export const REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV12ProductAcceptanceProfile>({
    lineage: 'v12',
    errorPrefix: 'V12_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v12-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v12-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v12-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v12-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v12-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v12-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v12-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v12-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v12-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v12-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v12-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v12-product-acceptance-success-v1',
      recovery: 'phase-6.9.5-v12-product-acceptance-recovery-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v12-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v12-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v12-product-acceptance/${environment}/profile-v12`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v12-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v12-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v12-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v12-product-acceptance-execution',
        environment,
      ]),
  });

export const REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV13ProductAcceptanceProfile>({
    lineage: 'v13',
    errorPrefix: 'V13_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v13-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v13-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v13-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v13-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v13-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v13-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v13-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v13-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v13-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v13-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v13-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v13-product-acceptance-success-v1',
      recovery: 'phase-6.9.5-v13-product-acceptance-recovery-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v13-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v13-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v13-product-acceptance/${environment}/profile-v13`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v13-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v13-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v13-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v13-product-acceptance-execution',
        environment,
      ]),
  });

export const REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV14ProductAcceptanceProfile>({
    lineage: 'v14',
    errorPrefix: 'V14_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v14-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v14-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v14-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v14-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v14-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v14-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v14-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v14-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v14-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v14-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v14-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v14-product-acceptance-success-v1',
      recovery: 'phase-6.9.5-v14-product-acceptance-recovery-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v14-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v14-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v14-product-acceptance/${environment}/profile-v14`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v14-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v14-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v14-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v14-product-acceptance-execution',
        environment,
      ]),
  });

export const REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV15ProductAcceptanceProfile>({
    lineage: 'v15',
    errorPrefix: 'V15_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v15-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v15-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v15-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v15-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v15-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v15-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v15-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v15-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v15-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v15-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v15-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v15-product-acceptance-success-v1',
      recovery: 'phase-6.9.5-v15-product-acceptance-recovery-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v15-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v15-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v15-product-acceptance/${environment}/profile-v15`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v15-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v15-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v15-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v15-product-acceptance-execution',
        environment,
      ]),
  });

export const REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV16ProductAcceptanceProfile>({
    lineage: 'v16',
    errorPrefix: 'V16_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v16-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v16-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v16-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v16-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v16-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v16-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v16-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v16-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v16-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v16-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v16-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v16-product-acceptance-success-v1',
      recovery: 'phase-6.9.5-v16-product-acceptance-recovery-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v16-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v16-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v16-product-acceptance/${environment}/profile-v16`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v16-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v16-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v16-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v16-product-acceptance-execution',
        environment,
      ]),
  });

export const REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV17ProductAcceptanceProfile>({
    lineage: 'v17',
    errorPrefix: 'V17_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v17-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v17-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v17-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v17-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v17-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v17-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v17-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v17-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v17-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v17-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v17-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v17-product-acceptance-success-v1',
      recovery: 'phase-6.9.5-v17-product-acceptance-recovery-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v17-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v17-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v17-product-acceptance/${environment}/profile-v17`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v17-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v17-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v17-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v17-product-acceptance-execution',
        environment,
      ]),
  });

export const REVIEW_PLANNER_V18_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV18ProductAcceptanceProfile>({
    lineage: 'v18',
    errorPrefix: 'V18_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v18-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v18-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v18-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v18-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v18-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v18-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v18-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v18-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v18-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v18-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v18-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v18-product-acceptance-success-v1',
      recovery: 'phase-6.9.5-v18-product-acceptance-recovery-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v18-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v18-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v18-product-acceptance/${environment}/profile-v18`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v18-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v18-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v18-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v18-product-acceptance-execution',
        environment,
      ]),
  });

export const REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV19ProductAcceptanceProfile>({
    lineage: 'v19',
    errorPrefix: 'V19_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v19-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v19-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v19-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v19-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v19-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v19-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v19-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v19-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v19-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v19-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v19-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v19-product-acceptance-success-v1',
      recovery: 'phase-6.9.5-v19-product-acceptance-recovery-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v19-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v19-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v19-product-acceptance/${environment}/profile-v19`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v19-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v19-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v19-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v19-product-acceptance-execution',
        environment,
      ]),
  });

export const REVIEW_PLANNER_V20_PRODUCT_ACCEPTANCE_PROFILE =
  Object.freeze<ReviewPlannerV20ProductAcceptanceProfile>({
    lineage: 'v20',
    errorPrefix: 'V20_PRODUCT_ACCEPTANCE',
    productConfirmation: '--confirm-v20-review-planner-product-acceptance',
    recoveryConfirmation:
      '--confirm-v20-review-planner-product-acceptance-recovery-only',
    schemas: Object.freeze({
      failure: 'phase-6.9.5-v20-product-acceptance-failure-v1',
      checkpoint: 'phase-6.9.5-v20-product-acceptance-checkpoint-v1',
      manifest: 'phase-6.9.5-v20-product-acceptance-manifest-v1',
      executionManifest:
        'phase-6.9.5-v20-product-acceptance-execution-manifest-v1',
      slotResult: 'phase-6.9.5-v20-product-acceptance-slot-result-v1',
      defaultOff: 'phase-6.9.5-v20-product-acceptance-default-off-v1',
      ownerIsolation: 'phase-6.9.5-v20-product-acceptance-owner-isolation-v1',
      cleanup: 'phase-6.9.5-v20-product-acceptance-cleanup-v1',
      acceptance: 'phase-6.9.5-v20-product-acceptance-aggregate-v1',
      success: 'phase-6.9.5-v20-product-acceptance-success-v1',
      recovery: 'phase-6.9.5-v20-product-acceptance-recovery-v1',
    }),
    publicLedgerPath: (environment) =>
      `docs/acceptance/evidence/phase-6-9-5-v20-product-acceptance/${environment}`,
    recoveryPath: (environment) =>
      `.tmp/phase-6-9-5-v20-product-acceptance/${environment}`,
    browserProfilePath: (environment) =>
      `.tmp/phase-6-9-5-v20-product-acceptance/${environment}/profile-v20`,
    publicLedgerSegments: (environment) =>
      Object.freeze([
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v20-product-acceptance',
        environment,
      ]),
    recoverySegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v20-product-acceptance',
        environment,
      ]),
    executionManifestPath: (environment) =>
      `.tmp/phase-6-9-5-v20-product-acceptance-execution/${environment}`,
    executionManifestSegments: (environment) =>
      Object.freeze([
        '.tmp',
        'phase-6-9-5-v20-product-acceptance-execution',
        environment,
      ]),
  });

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
  profile:
    | ReviewPlannerProductAcceptanceProfile
    | ReviewPlannerV11ProductAcceptanceProfile
    | ReviewPlannerV12ProductAcceptanceProfile
    | ReviewPlannerV13ProductAcceptanceProfile
    | ReviewPlannerV14ProductAcceptanceProfile
    | ReviewPlannerV15ProductAcceptanceProfile
    | ReviewPlannerV16ProductAcceptanceProfile
    | ReviewPlannerV17ProductAcceptanceProfile
    | ReviewPlannerV18ProductAcceptanceProfile
    | ReviewPlannerV19ProductAcceptanceProfile
    | ReviewPlannerV20ProductAcceptanceProfile,
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
