import {
  buildPhase698Task8ReviewedMockStaticV1,
  PHASE_6_9_8_TASK8_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_POLICY_SHA256,
  PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256,
} from '../src/index.ts';

const bundle = await buildPhase698Task8ReviewedMockStaticV1();

process.stdout.write(
  `${JSON.stringify({
    schemaVersion: bundle.report.schemaVersion,
    authority: bundle.report.authority,
    qualityAuthority: bundle.report.qualityAuthority,
    manifestSha256: PHASE_6_9_8_TASK8_MANIFEST_SHA256,
    policySha256: PHASE_6_9_8_TASK8_POLICY_SHA256,
    reviewedMockFactorySha256: PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256,
    reportSha256: bundle.sha256,
    caseCounts: bundle.report.caseCounts,
    guards: bundle.report.guards,
    rewrite: bundle.report.rewrite,
    finalResponse: bundle.report.finalResponse,
    safety: bundle.report.safety,
    cost: bundle.report.cost,
    formalLive: bundle.report.formalLive,
    gate: bundle.report.gate,
  })}\n`,
);
