import { preparePhase698TransportReentryV2C1Projection } from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts';
import { makePhase698TransportReentryV2SyntheticPreflightInput } from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';

const result = preparePhase698TransportReentryV2C1Projection(
  makePhase698TransportReentryV2SyntheticPreflightInput(),
  {
    DEEPSEEK_API_KEY: 'synthetic-deepseek-key',
    QWEN_API_KEY: 'synthetic-qwen-key',
  },
);

if (!result.ok) {
  console.log(JSON.stringify(result));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      authority: 'zero_provider_transport_reentry_v2_c1',
      gate: 'transport_reentry_v2_c1_ready',
      providerCalls: result.providerCalls,
      credentialReads: result.credentialReads,
      formalEvidence: result.formalEvidence,
      capabilityFamilies: [
        result.projection.rewrite.family,
        result.projection.qwen.family,
        result.projection.final_response.family,
      ],
    }),
  );
}
