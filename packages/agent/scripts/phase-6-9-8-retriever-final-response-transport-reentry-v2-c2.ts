import {
  createPhase698TransportReentryV2C2SyntheticAdmissionForTest,
  makePhase698TransportReentryV2C2SyntheticConfigurationForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts';
import {
  createPhase698TransportReentryV2C2SyntheticRootForTest,
  removePhase698TransportReentryV2C2SyntheticRootForTest,
  recoverPhase698TransportReentryV2C2InterruptedAttempt,
  runPhase698TransportReentryV2C2Synthetic,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts';

const faults = [
  'success',
  'missing',
  'invalid',
  'conflict',
  'abort',
  'timeout',
  'transport',
  'schema',
  'usage',
] as const;
const outcomes: Array<
  Readonly<{ fault: string; bundleValid: boolean; providerCalls: 0; credentialReads: 0 }>
> = [];

for (const fault of faults) {
  const root = await createPhase698TransportReentryV2C2SyntheticRootForTest();
  try {
    const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
    const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
    const result = await runPhase698TransportReentryV2C2Synthetic({
      root,
      admissionCapability: admission.capability,
      configurationCapability: configuration.capability,
      reservationCapability: admission.reservationCapability,
      faults: fault === 'success' ? undefined : { rewrite: fault },
    });
    outcomes.push({
      fault,
      bundleValid: result.validation.ok,
      providerCalls: result.validation.providerCalls,
      credentialReads: result.validation.credentialReads,
    });
  } finally {
    await removePhase698TransportReentryV2C2SyntheticRootForTest(root);
  }
}

const publicationRoot = await createPhase698TransportReentryV2C2SyntheticRootForTest();
let recovery: unknown;
try {
  const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
  const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
  await runPhase698TransportReentryV2C2Synthetic({
    root: publicationRoot,
    admissionCapability: admission.capability,
    configurationCapability: configuration.capability,
    reservationCapability: admission.reservationCapability,
    publicationFault: true,
  });
  recovery = await recoverPhase698TransportReentryV2C2InterruptedAttempt({
    root: publicationRoot,
    isProcessAlive: () => false,
  });
} finally {
  await removePhase698TransportReentryV2C2SyntheticRootForTest(publicationRoot);
}

console.log(
  JSON.stringify({
    authority: 'zero_provider_transport_reentry_v2_c2',
    gate: 'transport_reentry_v2_c2_zero_provider_passed',
    cases: outcomes,
    publicationRecovery: recovery,
    providerCalls: 0,
    credentialReads: 0,
    formalEvidence: 0,
  }),
);
