import { z } from 'zod';

import {
  consumePhase698Sr5NextAuthorizationCapability,
  type Phase698Sr5NextAuthorizationCapability,
  type Phase698Sr5NextAuthorizationRecord,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-authorization-contract.ts';
import {
  consumePhase698Sr5NextLineageTagCapability,
  type Phase698Sr5NextLineageTagBinding,
  type Phase698Sr5NextLineageTagCapability,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-tag-contract.ts';

export const PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-next-lineage-runner-preflight-v1' as const;
export const PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_AUTHORITY =
  'zero_provider_retriever_final_response_schema_recovery_sr5_next_lineage_runner_preflight' as const;
export const PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_GATE =
  'sr5_next_lineage_runner_preflight_ready_zero_provider' as const;

const PROXY_ATTESTATION_SCHEMA = z
  .object({
    ok: z.literal(true),
    code: z.enum(['direct_ready', 'loopback_proxy_ready']),
    providerCalls: z.literal(0),
    listenerProbeCalls: z.union([z.literal(0), z.literal(1)]),
  })
  .strict()
  .superRefine((value, context) => {
    const expected = value.code === 'direct_ready' ? 0 : 1;
    if (value.listenerProbeCalls !== expected) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'proxy_probe_count_invalid' });
    }
  });

export type Phase698Sr5NextRunnerPreflightCapability = Readonly<{
  version: typeof PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_VERSION;
}>;
export type Phase698Sr5NextRunnerPreflightRecord = Readonly<{
  version: typeof PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_VERSION;
  authority: typeof PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_AUTHORITY;
  gate: typeof PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_GATE;
  qualityAuthority: 'none';
  mode: 'zero_provider_runner_preflight';
  source: Phase698Sr5NextAuthorizationRecord['source'];
  dataBoundary: Phase698Sr5NextAuthorizationRecord['dataBoundary'];
  authorization: Phase698Sr5NextAuthorizationRecord['authorization'];
  proxy: Readonly<{
    code: 'direct_ready' | 'loopback_proxy_ready';
    listenerProbeCalls: 0 | 1;
    providerCalls: 0;
  }>;
  annotatedTagVerified: true;
  authorizationVerified: true;
  runnerInvocationAllowed: false;
  providerDispatchAllowed: false;
  credentialReads: 0;
  providerCalls: 0;
  formalEvidence: 0;
  businessWrites: 0;
}>;

type ComposeInput = Readonly<{
  tagCapability: Phase698Sr5NextLineageTagCapability;
  authorizationCapability: Phase698Sr5NextAuthorizationCapability;
  proxyAttestation: unknown;
  signal: AbortSignal;
}>;

const issuedCapabilities = new WeakMap<object, Phase698Sr5NextRunnerPreflightRecord>();
const consumedCapabilities = new WeakSet<object>();

export function composePhase698Sr5NextRunnerPreflightZeroProvider(
  input: ComposeInput,
): ReturnType<typeof compose> {
  return compose(input, 'git_verified');
}

export function composePhase698Sr5NextRunnerPreflightForTest(
  input: ComposeInput,
): ReturnType<typeof compose> {
  return compose(input, 'synthetic_test');
}

export function consumePhase698Sr5NextRunnerPreflightCapability(
  capability: unknown,
): Phase698Sr5NextRunnerPreflightRecord {
  if (!isObject(capability) || consumedCapabilities.has(capability)) throw capabilityInvalid();
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Reflect.getOwnPropertyDescriptor(capability, 'version');
  } catch {
    throw capabilityInvalid();
  }
  const record = issuedCapabilities.get(capability);
  if (
    !descriptor ||
    !('value' in descriptor) ||
    descriptor.value !== PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_VERSION ||
    !record
  ) {
    throw capabilityInvalid();
  }
  consumedCapabilities.add(capability);
  return record;
}

export function parsePhase698Sr5NextRunnerPreflightArgs(
  args: readonly string[],
): Readonly<{ kind: 'help' | 'inspect_zero_provider' }> | Readonly<{ kind: 'rejected' }> {
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) return { kind: 'help' };
  if (args.length === 1 && args[0] === '--inspect-zero-provider') {
    return { kind: 'inspect_zero_provider' };
  }
  return { kind: 'rejected' };
}

function compose(
  rawInput: ComposeInput,
  tagAuthority: 'git_verified' | 'synthetic_test',
):
  | Readonly<{
      ok: true;
      record: Phase698Sr5NextRunnerPreflightRecord;
      capability: Phase698Sr5NextRunnerPreflightCapability;
    }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'input_invalid'
        | 'aborted'
        | 'tag_capability_invalid'
        | 'authorization_capability_invalid'
        | 'source_authorization_mismatch'
        | 'proxy_attestation_invalid';
    }> {
  const input = normalizeInput(rawInput);
  if (input === null) return invalid('input_invalid');
  if (input.signal.aborted) return invalid('aborted');

  let tag: Phase698Sr5NextLineageTagBinding;
  try {
    tag = consumePhase698Sr5NextLineageTagCapability(input.tagCapability, tagAuthority);
  } catch {
    return invalid('tag_capability_invalid');
  }
  if (input.signal.aborted) return invalid('aborted');

  let authorization: Phase698Sr5NextAuthorizationRecord;
  try {
    authorization = consumePhase698Sr5NextAuthorizationCapability(input.authorizationCapability);
  } catch {
    return invalid('authorization_capability_invalid');
  }
  if (!sameSource(tag, authorization)) return invalid('source_authorization_mismatch');
  if (input.signal.aborted) return invalid('aborted');

  const proxy = PROXY_ATTESTATION_SCHEMA.safeParse(input.proxyAttestation);
  if (!proxy.success) return invalid('proxy_attestation_invalid');
  if (input.signal.aborted) return invalid('aborted');

  const record = deepFreeze({
    version: PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_VERSION,
    authority: PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_AUTHORITY,
    gate: PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_GATE,
    qualityAuthority: 'none' as const,
    mode: 'zero_provider_runner_preflight' as const,
    source: authorization.source,
    dataBoundary: authorization.dataBoundary,
    authorization: authorization.authorization,
    proxy: {
      code: proxy.data.code,
      listenerProbeCalls: proxy.data.listenerProbeCalls,
      providerCalls: 0 as const,
    },
    annotatedTagVerified: true as const,
    authorizationVerified: true as const,
    runnerInvocationAllowed: false as const,
    providerDispatchAllowed: false as const,
    credentialReads: 0 as const,
    providerCalls: 0 as const,
    formalEvidence: 0 as const,
    businessWrites: 0 as const,
  });
  const capability = Object.freeze({ version: PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_VERSION });
  issuedCapabilities.set(capability, record);
  return Object.freeze({ ok: true as const, record, capability });
}

function normalizeInput(value: unknown): ComposeInput | null {
  try {
    if (!isObject(value) || Array.isArray(value)) return null;
    const tagCapability = Reflect.getOwnPropertyDescriptor(value, 'tagCapability');
    const authorizationCapability = Reflect.getOwnPropertyDescriptor(
      value,
      'authorizationCapability',
    );
    const proxyAttestation = Reflect.getOwnPropertyDescriptor(value, 'proxyAttestation');
    const signal = Reflect.getOwnPropertyDescriptor(value, 'signal');
    if (
      !tagCapability ||
      !('value' in tagCapability) ||
      !authorizationCapability ||
      !('value' in authorizationCapability) ||
      !proxyAttestation ||
      !('value' in proxyAttestation) ||
      !signal ||
      !('value' in signal) ||
      !isAbortSignal(signal.value)
    ) {
      return null;
    }
    return Object.freeze({
      tagCapability: tagCapability.value as Phase698Sr5NextLineageTagCapability,
      authorizationCapability:
        authorizationCapability.value as Phase698Sr5NextAuthorizationCapability,
      proxyAttestation: proxyAttestation.value as unknown,
      signal: signal.value,
    });
  } catch {
    return null;
  }
}

function sameSource(
  tag: Phase698Sr5NextLineageTagBinding,
  authorization: Phase698Sr5NextAuthorizationRecord,
): boolean {
  return (
    tag.branch === authorization.source.branch &&
    tag.sourceCommit === authorization.source.sourceCommit &&
    tag.sourceBundleSha256 === authorization.source.sourceBundleSha256 &&
    tag.sourceManifestSha256 === authorization.source.sourceManifestSha256 &&
    tag.approvedTag === authorization.source.approvedTag &&
    tag.approvedTagObjectId === authorization.source.approvedTagObjectId
  );
}

function invalid<T extends string>(reasonCode: T) {
  return Object.freeze({ ok: false as const, reasonCode });
}

function capabilityInvalid(): Error {
  return new Error('PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_CAPABILITY_INVALID');
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.getOwnPropertyDescriptor(value, 'aborted') === 'undefined' &&
    typeof (value as AbortSignal).aborted === 'boolean'
  );
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
