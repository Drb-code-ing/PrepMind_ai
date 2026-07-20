export type ReviewPlannerProductAcceptanceHostEnvironment = 'branch' | 'main';

export type ReviewPlannerProductAcceptanceHostRuntime = Readonly<{
  preflight(input: {
    environment: ReviewPlannerProductAcceptanceHostEnvironment;
    repoRoot: string;
  }): Promise<Readonly<{ status: 'blocked' | 'ready' }>>;
  recover(input: {
    environment: ReviewPlannerProductAcceptanceHostEnvironment;
    repoRoot: string;
  }): Promise<Readonly<{ status: 'blocked' | 'recovered' }>>;
}>;

export function createDefaultReviewPlannerProductAcceptanceHostRuntime(
  boundary: Partial<{
    preflight(input: {
      environment: ReviewPlannerProductAcceptanceHostEnvironment;
      repoRoot: string;
    }): Promise<Readonly<{ status: 'blocked' | 'ready' }>>;
    restoreDefaultOff(input: {
      environment: ReviewPlannerProductAcceptanceHostEnvironment;
      repoRoot: string;
    }): Promise<void>;
    cleanupExact(input: {
      environment: ReviewPlannerProductAcceptanceHostEnvironment;
      repoRoot: string;
    }): Promise<void>;
  }> = {},
): ReviewPlannerProductAcceptanceHostRuntime {
  return Object.freeze({
    preflight: (input) =>
      boundary.preflight?.(input) ??
      Promise.resolve(Object.freeze({ status: 'blocked' as const })),
    async recover(input) {
      const readiness = await (boundary.preflight?.(input) ??
        Promise.resolve(Object.freeze({ status: 'blocked' as const })));
      if (
        readiness.status !== 'ready' ||
        !boundary.restoreDefaultOff ||
        !boundary.cleanupExact
      ) {
        return Object.freeze({ status: 'blocked' as const });
      }
      await boundary.restoreDefaultOff(input);
      await boundary.cleanupExact(input);
      return Object.freeze({ status: 'recovered' as const });
    },
  });
}
