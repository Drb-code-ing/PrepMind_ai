import type { AgentExecutionContextV1, VerifiedEvidenceBundleV1 } from './realtime-chat.ts';

const formalVerifiedEvidenceBindings = new WeakMap<
  VerifiedEvidenceBundleV1,
  AgentExecutionContextV1
>();

export function registerFormalVerifiedEvidenceBundleV1(
  bundle: VerifiedEvidenceBundleV1,
  context: AgentExecutionContextV1,
): void {
  formalVerifiedEvidenceBindings.set(bundle, context);
}

export function isFormalVerifiedEvidenceBundleV1(
  bundle: unknown,
): bundle is VerifiedEvidenceBundleV1 {
  return (
    bundle !== null &&
    typeof bundle === 'object' &&
    formalVerifiedEvidenceBindings.has(bundle as VerifiedEvidenceBundleV1)
  );
}

export function isFormalVerifiedEvidenceBundleBoundToContextV1(
  bundle: unknown,
  context: unknown,
): bundle is VerifiedEvidenceBundleV1 {
  return (
    bundle !== null &&
    typeof bundle === 'object' &&
    context !== null &&
    typeof context === 'object' &&
    formalVerifiedEvidenceBindings.get(bundle as VerifiedEvidenceBundleV1) === context
  );
}
