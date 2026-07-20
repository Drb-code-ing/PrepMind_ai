import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';

import {
  createDefaultReviewPlannerV8ProductAcceptanceComposition,
  cleanupDefaultReviewPlannerProductAcceptanceBrowser,
  restoreDefaultReviewPlannerProductAcceptanceServer,
  runDefaultReviewPlannerProductAcceptanceHostPreflight,
} from './review-planner-v8-product-acceptance-composition';
import type { ReviewPlannerV8ProductAcceptanceRunnerDependencies } from './review-planner-v8-product-acceptance-runner';
import {
  assertReviewPlannerV16DefaultOffEnvironment,
  finalizeReviewPlannerV16ProductAcceptanceRecovery,
  readReviewPlannerV16ProductAcceptanceLedger,
  readReviewPlannerV16ProductAcceptanceExecutionManifest,
  type ReviewPlannerV16ProductAcceptanceExecutionManifest,
  type ReviewPlannerV16ProductAcceptanceLedger,
} from './review-planner-v16-product-acceptance-ledger';
import type { ReviewPlannerV16ReadyPreflight } from './review-planner-v16-product-acceptance-composition';
import {
  acquireReviewPlannerV16ProductAcceptanceOwner,
  type ReviewPlannerV16ProductAcceptanceRecoveryJournal,
} from './review-planner-v16-product-acceptance-recovery';

type RuntimeResources = Readonly<{
  accountIdSha256: Readonly<{ review: string; planner: string }>;
  capabilities: Readonly<{ review: string; planner: string }>;
  dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies;
}>;

export type ReviewPlannerV16ProductAcceptanceHost = Readonly<{
  preflight(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
  }): Promise<Readonly<{ status: 'blocked' }> | ReviewPlannerV16ReadyPreflight>;
  revalidate(
    preflight: ReviewPlannerV16ReadyPreflight,
  ): Promise<Readonly<{ status: 'blocked' }> | ReviewPlannerV16ReadyPreflight>;
  prepareExecution(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
    preflight: ReviewPlannerV16ReadyPreflight;
    ledger: ReviewPlannerV16ProductAcceptanceLedger;
    journal: ReviewPlannerV16ProductAcceptanceRecoveryJournal;
    executionManifest: ReviewPlannerV16ProductAcceptanceExecutionManifest;
  }): Promise<RuntimeResources>;
  dispose(): Promise<void>;
}>;

export type ReviewPlannerV16ProductAcceptanceRecoveryHost = Readonly<{
  preflight(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
  }): Promise<Readonly<{ status: 'blocked' | 'ready' }>>;
  recover(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
  }): Promise<Readonly<{ status: 'blocked' | 'recovered' }>>;
}>;

/**
 * Owns the real, V16-scoped host lifecycle. It deliberately reuses only the
 * existing V8 host mechanics (Docker activation, API/browser operations,
 * trace reads and exact cleanup); V16 owns all ledgers, confirmation and
 * recovery namespaces.
 */
export function createDefaultReviewPlannerV16ProductAcceptanceHost(
  repoRoot: string,
): ReviewPlannerV16ProductAcceptanceHost {
  const root = resolve(repoRoot);
  const hostDatabaseUrlSha256 = sha256(readRootDatabaseUrl(root));
  let latest:
    | Awaited<
        ReturnType<typeof runDefaultReviewPlannerProductAcceptanceHostPreflight>
      >
    | undefined;
  let executionManifest:
    | ReviewPlannerV16ProductAcceptanceExecutionManifest
    | undefined;
  const legacy = createDefaultReviewPlannerV8ProductAcceptanceComposition(
    root,
    {
      preflightFactory: async (input) => {
        const result =
          await runDefaultReviewPlannerProductAcceptanceHostPreflight(input, {
            branchAcceptanceComplete: async (candidateRoot) => {
              const branch = await readReviewPlannerV16ProductAcceptanceLedger({
                repoRoot: candidateRoot,
                environment: 'branch',
              });
              return branch.status === 'complete';
            },
            assertDefaultOffEnvironment:
              assertReviewPlannerV16DefaultOffEnvironment,
          });
        latest = result;
        return result;
      },
      resourcesFactory: () => {
        if (!executionManifest) {
          throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
        }
        return resourcesFromExecutionManifest(executionManifest);
      },
      runnerCleanupScopeFactory: () => {
        if (!executionManifest) {
          throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
        }
        return Object.freeze({
          executablePath: executionManifest.resources.browser.executablePath,
          allowedProfilePaths: Object.freeze([
            executionManifest.resources.browser.profilePath,
          ]),
        });
      },
      defaultOffEnvironmentValidator:
        assertReviewPlannerV16DefaultOffEnvironment,
    },
  );

  const getReadyPreflight = async (input: {
    environment: 'branch' | 'main';
    repoRoot: string;
  }): Promise<
    Readonly<{ status: 'blocked' }> | ReviewPlannerV16ReadyPreflight
  > => {
    if (
      resolve(input.repoRoot) !== root ||
      !isReviewPlannerV16DatabaseFingerprintStable(
        hostDatabaseUrlSha256,
        sha256(readRootDatabaseUrl(root)),
      )
    ) {
      return Object.freeze({ status: 'blocked' as const });
    }
    const result = await legacy.ports.preflight(input);
    if (
      result.status !== 'ready' ||
      !isReviewPlannerV16DatabaseFingerprintStable(
        hostDatabaseUrlSha256,
        sha256(readRootDatabaseUrl(root)),
      )
    ) {
      return Object.freeze({ status: 'blocked' as const });
    }
    return Object.freeze({
      status: 'ready' as const,
      environment: result.environment,
      repoRoot: result.repoRoot,
      commitSha: result.commitSha,
      pairedEvidenceSha256: result.pairedEvidenceSha256,
      databaseUrlSha256: hostDatabaseUrlSha256,
    });
  };

  return Object.freeze({
    preflight: getReadyPreflight,
    async revalidate(preflight) {
      const refreshed = await getReadyPreflight({
        environment: preflight.environment,
        repoRoot: preflight.repoRoot,
      });
      if (
        refreshed.status !== 'ready' ||
        refreshed.commitSha !== preflight.commitSha ||
        refreshed.pairedEvidenceSha256 !== preflight.pairedEvidenceSha256 ||
        refreshed.databaseUrlSha256 !== preflight.databaseUrlSha256
      ) {
        return Object.freeze({ status: 'blocked' as const });
      }
      return refreshed;
    },
    async prepareExecution(input) {
      const currentDatabaseUrlSha256 = sha256(readRootDatabaseUrl(root));
      if (
        resolve(input.repoRoot) !== root ||
        latest?.status !== 'ready' ||
        latest.environment !== input.environment ||
        latest.repoRoot !== input.repoRoot ||
        latest.commitSha !== input.preflight.commitSha ||
        latest.pairedEvidenceSha256 !== input.preflight.pairedEvidenceSha256 ||
        !isReviewPlannerV16DatabaseFingerprintStable(
          hostDatabaseUrlSha256,
          currentDatabaseUrlSha256,
        ) ||
        input.preflight.databaseUrlSha256 !== hostDatabaseUrlSha256 ||
        input.executionManifest.databaseUrlSha256 !==
          input.preflight.databaseUrlSha256 ||
        input.executionManifest.environment !== input.environment ||
        input.executionManifest.attemptSha256 !== input.ledger.attemptSha256()
      ) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
      }
      executionManifest = input.executionManifest;
      const resources = legacy.ports.generateResources(latest);
      const earlyCleanup = legacy.ports.createRunnerDependencies({
        preflight: latest,
        resources,
        accounts: {} as never,
        fixtureReceipt: {} as never,
      });
      try {
        const review = await legacy.ports.registerAccount({
          component: 'review',
          email: resources.syntheticEmails.review,
          password: resources.passwords.review,
        });
        const planner = await legacy.ports.registerAccount({
          component: 'planner',
          email: resources.syntheticEmails.planner,
          password: resources.passwords.planner,
        });
        const accounts = Object.freeze({ review, planner });
        const fixtureReceipt = await legacy.ports.createFixtures({
          accounts,
          fixtureIds: resources.fixtureIds,
        });
        return Object.freeze({
          accountIdSha256: fixtureReceipt.accountIdSha256,
          capabilities: resources.capabilities,
          dependencies: legacy.ports.createRunnerDependencies({
            preflight: latest,
            resources,
            accounts,
            fixtureReceipt,
          }),
        });
      } catch (error) {
        await earlyCleanup.cleanup().catch(() => undefined);
        throw error;
      }
    },
    dispose: legacy.dispose,
  });
}

function resourcesFromExecutionManifest(
  manifest: ReviewPlannerV16ProductAcceptanceExecutionManifest,
) {
  const fixtureIds = (['review', 'planner'] as const).flatMap((component) =>
    Array.from(
      { length: 8 },
      (_, index) => `${manifest.resources.fixtureId[component]}-${index + 1}`,
    ),
  );
  return Object.freeze({
    syntheticEmails: Object.freeze({
      review: `${manifest.resources.accountId.review}@example.invalid`,
      planner: `${manifest.resources.accountId.planner}@example.invalid`,
      probe: `v16-synthetic-probe-${manifest.attemptSha256.slice(0, 16)}@example.invalid`,
    }),
    fixtureIds: Object.freeze(fixtureIds),
    browserProfilePath: manifest.resources.browser.profilePath,
    passwords: Object.freeze({
      review: randomBytes(24).toString('base64url'),
      planner: randomBytes(24).toString('base64url'),
    }),
    capabilities: Object.freeze({
      review: randomBytes(32).toString('hex'),
      planner: randomBytes(32).toString('hex'),
    }),
  });
}

type ReviewPlannerV16RecoveryHostOptions = Readonly<{
  platform?: string;
  readLedger?: typeof readReviewPlannerV16ProductAcceptanceLedger;
  readExecutionManifest?: typeof readReviewPlannerV16ProductAcceptanceExecutionManifest;
  acquireOwner?: typeof acquireReviewPlannerV16ProductAcceptanceOwner;
  finalize?: typeof finalizeReviewPlannerV16ProductAcceptanceRecovery;
  restoreDefaultOff?: (repoRoot: string) => Promise<void>;
  cleanupExact?: (
    manifest: ReviewPlannerV16ProductAcceptanceExecutionManifest,
    databaseUrl: string,
  ) => Promise<void>;
  readDatabaseUrl?: (repoRoot: string) => string;
}>;

export function createDefaultReviewPlannerV16ProductAcceptanceRecoveryHost(
  repoRoot: string,
  options: ReviewPlannerV16RecoveryHostOptions = {},
): ReviewPlannerV16ProductAcceptanceRecoveryHost {
  const root = resolve(repoRoot);
  const readLedger =
    options.readLedger ?? readReviewPlannerV16ProductAcceptanceLedger;
  const readExecutionManifest =
    options.readExecutionManifest ??
    readReviewPlannerV16ProductAcceptanceExecutionManifest;
  const acquireOwner =
    options.acquireOwner ?? acquireReviewPlannerV16ProductAcceptanceOwner;
  const finalize =
    options.finalize ?? finalizeReviewPlannerV16ProductAcceptanceRecovery;
  const restoreDefaultOff =
    options.restoreDefaultOff ??
    ((candidateRoot: string) =>
      restoreDefaultReviewPlannerProductAcceptanceServer(
        candidateRoot,
        assertReviewPlannerV16DefaultOffEnvironment,
      ));
  const readDatabaseUrl = options.readDatabaseUrl ?? readRootDatabaseUrl;
  const cleanupExact =
    options.cleanupExact ??
    ((
      manifest: ReviewPlannerV16ProductAcceptanceExecutionManifest,
      databaseUrl: string,
    ) => cleanupV16ExecutionResources(root, manifest, databaseUrl));
  let selected: ReviewPlannerV16ProductAcceptanceExecutionManifest | undefined;
  let selectedEnvironment: 'branch' | 'main' | undefined;

  return Object.freeze({
    async preflight(input) {
      try {
        if (
          resolve(input.repoRoot) !== root ||
          (options.platform ?? process.platform) !== 'win32'
        ) {
          throw new Error();
        }
        const ledger = await readLedger({
          repoRoot: root,
          environment: input.environment,
        });
        if (ledger.status !== 'operation_failed') throw new Error();
        const manifest = await readExecutionManifest({
          repoRoot: root,
          environment: input.environment,
        });
        if (
          manifest.environment !== input.environment ||
          manifest.databaseUrlSha256 !== sha256(readDatabaseUrl(root))
        ) {
          throw new Error();
        }
        selected = manifest;
        selectedEnvironment = input.environment;
        return Object.freeze({ status: 'ready' as const });
      } catch {
        selected = undefined;
        selectedEnvironment = undefined;
        return Object.freeze({ status: 'blocked' as const });
      }
    },
    async recover(input) {
      if (
        resolve(input.repoRoot) !== root ||
        selectedEnvironment !== input.environment ||
        !selected
      ) {
        return Object.freeze({ status: 'blocked' as const });
      }
      const ownership = await acquireOwner({
        repoRoot: root,
        environment: input.environment,
        role: 'recovery',
      });
      if (ownership.status !== 'acquired') {
        return Object.freeze({ status: 'blocked' as const });
      }
      try {
        const [ledger, manifest] = await Promise.all([
          readLedger({ repoRoot: root, environment: input.environment }),
          readExecutionManifest({
            repoRoot: root,
            environment: input.environment,
          }),
        ]);
        const databaseUrl = readDatabaseUrl(root);
        if (
          ledger.status !== 'operation_failed' ||
          manifest.environment !== input.environment ||
          manifest.attemptSha256 !== selected.attemptSha256 ||
          manifest.databaseUrlSha256 !== selected.databaseUrlSha256 ||
          manifest.databaseUrlSha256 !== sha256(databaseUrl)
        ) {
          return Object.freeze({ status: 'blocked' as const });
        }
        await restoreDefaultOff(root);
        await cleanupExact(manifest, databaseUrl);
        await finalize({
          repoRoot: root,
          environment: input.environment,
          owner: ownership.owner,
        });
        selected = undefined;
        selectedEnvironment = undefined;
        return Object.freeze({ status: 'recovered' as const });
      } catch {
        return Object.freeze({ status: 'blocked' as const });
      } finally {
        ownership.owner.close();
      }
    },
  });
}

async function cleanupV16ExecutionResources(
  repoRoot: string,
  manifest: ReviewPlannerV16ProductAcceptanceExecutionManifest,
  databaseUrl: string,
) {
  const profilePath = resolve(repoRoot, manifest.resources.browser.profilePath);
  await cleanupDefaultReviewPlannerProductAcceptanceBrowser({
    repoRoot,
    executablePath: manifest.resources.browser.executablePath,
    profilePath,
  });
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  const emails = (['review', 'planner'] as const).map(
    (component) => `${manifest.resources.accountId[component]}@example.invalid`,
  );
  const fixtureIds = (['review', 'planner'] as const).map(
    (component) => `${manifest.resources.fixtureId[component]}-3`,
  );
  try {
    const accounts = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    await prisma.$transaction(async (tx) => {
      if (accounts.length > 0) {
        await tx.agentTraceRun.deleteMany({
          where: { userId: { in: accounts.map((account) => account.id) } },
        });
      }
      await tx.user.deleteMany({ where: { email: { in: emails } } });
    });
    const [remainingUsers, remainingFixtures] = await Promise.all([
      prisma.user.count({ where: { email: { in: emails } } }),
      prisma.wrongQuestion.count({ where: { id: { in: fixtureIds } } }),
    ]);
    if (
      remainingUsers !== 0 ||
      remainingFixtures !== 0 ||
      existsSync(profilePath)
    ) {
      throw new Error('V16_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
    }
  } finally {
    await prisma.$disconnect();
  }
}

function readRootDatabaseUrl(repoRoot: string) {
  const contents = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    if (line.slice(0, separator).trim() !== 'DATABASE_URL') continue;
    const value = line.slice(separator + 1).trim();
    if (value) return value.replace(/^['"]|['"]$/g, '');
  }
  throw new Error('V16_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function isReviewPlannerV16DatabaseFingerprintStable(
  hostDatabaseUrlSha256: string,
  currentDatabaseUrlSha256: string,
) {
  return (
    /^[a-f0-9]{64}$/.test(hostDatabaseUrlSha256) &&
    hostDatabaseUrlSha256 === currentDatabaseUrlSha256
  );
}
