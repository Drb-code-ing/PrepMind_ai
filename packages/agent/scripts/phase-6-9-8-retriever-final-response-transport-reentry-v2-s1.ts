import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectPhase698TransportReentryV2S1SourceAdmission } from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-contract.ts';
import {
  buildPhase698TransportReentryV2S1ReviewedMockCheckpoint,
  runPhase698TransportReentryV2S1FaultMatrixForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceAdmission = inspectPhase698TransportReentryV2S1SourceAdmission(repositoryRoot);
const checkpoint = await buildPhase698TransportReentryV2S1ReviewedMockCheckpoint();
const faultMatrix = await runPhase698TransportReentryV2S1FaultMatrixForTest();

console.log(
  JSON.stringify({
    authority: checkpoint.authority,
    gate: checkpoint.report.gate,
    sourceAdmission: sourceAdmission.ok
      ? {
          ok: true,
          authority: sourceAdmission.authority,
          commit: sourceAdmission.source.commit,
          workingTreeClean: sourceAdmission.source.workingTreeClean,
          formalArtifactCount: sourceAdmission.source.formalArtifactCount,
          sourceBundleSha256: sourceAdmission.source.sourceBundleSha256,
        }
      : sourceAdmission,
    factorySha256: checkpoint.factorySha256,
    reportSha256: checkpoint.reportSha256,
    adapters: checkpoint.report.adapters.map((adapter) => ({
      slot: adapter.slot,
      adapterId: adapter.adapterId,
      provider: adapter.provider,
      dispatches: adapter.dispatches,
      responses: adapter.responses,
      verifiedUsage: adapter.verifiedUsage,
      providerCalls: adapter.providerCalls,
      credentialReads: adapter.credentialReads,
    })),
    runner: checkpoint.report.runner,
    wire: checkpoint.report.wire,
    usage: checkpoint.report.usage,
    formalEvidence: checkpoint.report.formalEvidence,
    faultMatrix,
    providerCalls: checkpoint.providerCalls,
    credentialReads: checkpoint.credentialReads,
  }),
);

if (!sourceAdmission.ok || !checkpoint.report.gate.passed) process.exitCode = 1;
