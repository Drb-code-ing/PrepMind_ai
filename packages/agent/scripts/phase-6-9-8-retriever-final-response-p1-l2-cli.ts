import { randomUUID } from 'node:crypto';
import { kill } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  admitPhase698P1L2ZeroProvider,
  issuePhase698P1L2AdmissionCapability,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-admission.ts';
import {
  readPhase698P1L2RootCredentialProjection,
  createPhase698P1L2AdmissionInput,
  safePhase698P1L2CliResult,
  PHASE_6_9_8_P1_L2_CLI_COMMAND,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-cli-core.ts';
import { buildPhase698P1DeterministicSubsetBaseline } from '../src/evals/phase-6-9-8-retriever-final-response-p1-baseline.ts';
import { createPhase698P1L2LiveHarness } from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-live.ts';
import { inspectPhase698P1L2Source } from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-source-admission.ts';
import {
  recoverPhase698P1L2InterruptedAttempt,
  validatePhase698P1L2Bundle,
  reservePhase698P1L2Attempt,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-durability.ts';
import { sourceFromPhase698P1L2Admission } from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-contract.ts';
import { runPhase698P1L2 } from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-runner.ts';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const args = process.argv.slice(2);

if (import.meta.main) {
  const result = await main(args);
  process.stdout.write(`${safePhase698P1L2CliResult(result)}\n`);
  process.exitCode = result.ok ? 0 : 2;
}

async function main(argv: readonly string[]) {
  const command = argv[0];
  if (command === PHASE_6_9_8_P1_L2_CLI_COMMAND.validate) {
    const validation = await validatePhase698P1L2Bundle({ root });
    return {
      ok: validation.ok,
      code: validation.ok ? 'bundle_valid' : 'bundle_invalid',
      runId: validation.runId ?? undefined,
      providerCalls: validation.providerCalls,
      credentialReads: validation.credentialReads,
      gate: validation.gate ?? undefined,
    };
  }
  if (command === PHASE_6_9_8_P1_L2_CLI_COMMAND.recover) {
    const recovery = await recoverPhase698P1L2InterruptedAttempt({ root, isProcessAlive });
    return recovery.ok
      ? { ok: true, code: recovery.disposition, runId: recovery.runId }
      : { ok: false, code: recovery.code };
  }
  if (command !== PHASE_6_9_8_P1_L2_CLI_COMMAND.live)
    return { ok: false, code: 'authorization_required' };

  const sourceResult = inspectPhase698P1L2Source(root);
  if (!sourceResult.ok) return { ok: false, code: 'source_admission_invalid' };
  const input = createPhase698P1L2AdmissionInput({
    source: sourceResult.source,
    dataBoundaryConfirmation:
      'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_L2_DEEPSEEK_AND_QWEN_DATA_BOUNDARY',
    authorizationConfirmation: command,
  });
  const admitted = admitPhase698P1L2ZeroProvider(input);
  if (!admitted.ok) return { ok: false, code: admitted.code };
  const credentialResult = await readPhase698P1L2RootCredentialProjection(root);
  if (!credentialResult.ok) return { ok: false, code: credentialResult.code };
  const sourceAfterCredential = inspectPhase698P1L2Source(root);
  if (!sourceAfterCredential.ok || !sameSource(sourceResult.source, sourceAfterCredential.source))
    return { ok: false, code: 'source_admission_invalid' };
  const baseline = await buildPhase698P1DeterministicSubsetBaseline();
  const runId = randomUUID();
  const reservation = await reservePhase698P1L2Attempt({
    root,
    runId,
    source: sourceFromPhase698P1L2Admission(admitted.admission),
  });
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    const run = await runPhase698P1L2({
      runId: reservation.runId,
      admissionCapability: issuePhase698P1L2AdmissionCapability(input),
      baselineBundle: baseline,
      harness: createPhase698P1L2LiveHarness({
        runId,
        credentials: { deepseekApiKey: credentialResult.credentials.deepseekApiKey },
      }),
      credentialReads: credentialResult.credentials.credentialReads,
      lifecycle: reservation.lifecycle,
      signal: abortController.signal,
    });
    const published = await reservation.publishArtifact(run.report);
    const validation = await validatePhase698P1L2Bundle({ root });
    return {
      ok: validation.ok && published.evidenceSha256.length === 64,
      code: run.gate.passed ? 'p1_semantic_gate_passed' : 'p1_quality_gate_failed',
      runId,
      providerCalls: run.report.execution.providerCalls,
      credentialReads: run.report.execution.credentialReads,
      verifiedCostCny: run.report.execution.verifiedCostCny,
      gate: run.gate.status,
    };
  } catch {
    // The owner is still alive in this process. Crash-only recovery must run
    // from the separate RECOVER command after this process exits.
    return { ok: false, code: 'controlled_live_interrupted_unsealed', runId };
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}

function isProcessAlive(pid: number): boolean {
  if (pid === process.pid) return true;
  try {
    kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sameSource(
  left: Parameters<typeof createPhase698P1L2AdmissionInput>[0]['source'],
  right: Parameters<typeof createPhase698P1L2AdmissionInput>[0]['source'],
): boolean {
  return (
    left.branch === right.branch &&
    left.head === right.head &&
    left.upstream === right.upstream &&
    left.origin === right.origin &&
    left.clean === right.clean &&
    left.approvedTag.name === right.approvedTag.name &&
    left.approvedTag.commit === right.approvedTag.commit &&
    left.manifestSha256 === right.manifestSha256 &&
    left.policySha256 === right.policySha256 &&
    left.baselineSha256 === right.baselineSha256 &&
    left.s2FactorySha256 === right.s2FactorySha256 &&
    left.final11CompatibilitySha256 === right.final11CompatibilitySha256 &&
    left.formalEvidencePaths.length === 0 &&
    right.formalEvidencePaths.length === 0 &&
    left.oldLineagePaths.length === 0 &&
    right.oldLineagePaths.length === 0
  );
}
