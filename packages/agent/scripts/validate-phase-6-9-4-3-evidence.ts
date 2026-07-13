import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parsePhase6943Output,
  type Phase6943Output,
} from '../src/evals/phase-6-9-router-verifier-paired-contract.ts';
import {
  buildPhase6943LiveEvidencePath,
  containsForbiddenCanary,
  resolveInsideRoot,
} from './phase-6-9-4-3-paired-cli.ts';

type EvidenceProfile = 'mock' | 'live';
type EvidenceValidationResult =
  | {
      ok: true;
      profile: EvidenceProfile;
      runStatus: 'complete' | 'incomplete' | 'invalid';
    }
  | {
      ok: false;
      errorCode:
        | 'invalid_arguments'
        | 'unsafe_path'
        | 'read_failed'
        | 'invalid_json'
        | 'unsafe_evidence'
        | 'profile_mismatch'
        | 'assertion_failed';
    };

export function parseEvidenceValidatorArgs(
  argv: readonly string[],
):
  | { ok: true; profile: EvidenceProfile; file: string }
  | { ok: false; errorCode: 'invalid_arguments' | 'unsafe_path' } {
  if (
    argv.length !== 4 ||
    argv[0] !== '--profile' ||
    argv[2] !== '--file'
  ) {
    return { ok: false, errorCode: 'invalid_arguments' };
  }
  const profile = argv[1];
  const file = argv[3];
  if ((profile !== 'mock' && profile !== 'live') || !file) {
    return { ok: false, errorCode: 'invalid_arguments' };
  }

  const normalized = file.replace(/\\/g, '/');
  if (
    file !== normalized ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    return { ok: false, errorCode: 'unsafe_path' };
  }

  const mockPath = 'docs/acceptance/evidence/phase-6-9-4-3/mock.json';
  const livePath =
    /^docs\/acceptance\/evidence\/phase-6-9-4-3\/live-\d{8}T\d{9}Z-[a-f0-9]{12}\.json$/;
  if (
    (profile === 'mock' && normalized !== mockPath) ||
    (profile === 'live' && !livePath.test(normalized))
  ) {
    return { ok: false, errorCode: 'unsafe_path' };
  }
  return { ok: true, profile, file: normalized };
}

export function validatePhase6943Evidence(input: {
  profile: EvidenceProfile;
  file: string;
  raw: string;
}): EvidenceValidationResult {
  const safePath = parseEvidenceValidatorArgs([
    '--profile',
    input.profile,
    '--file',
    input.file,
  ]);
  if (!safePath.ok) return { ok: false, errorCode: 'unsafe_path' };
  if (input.raw.includes('\uFFFD') || containsForbiddenCanary(input.raw)) {
    return { ok: false, errorCode: 'unsafe_evidence' };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(input.raw);
  } catch {
    return { ok: false, errorCode: 'invalid_json' };
  }
  const parsed = parsePhase6943Output(decoded);
  if (!parsed.ok) return { ok: false, errorCode: 'assertion_failed' };
  const output: Phase6943Output = parsed.output;

  if (input.profile === 'mock') {
    if (
      output.kind !== 'report' ||
      output.runKind !== 'mock' ||
      output.runStatus !== 'complete' ||
      output.qualityEvidence ||
      !sameCounters(output.lanes.mock.counters, [100, 100, 28, 0, 28, 72]) ||
      output.decisions.some(
        (decision) =>
          decision.enabled || decision.reason !== 'paired_candidate_not_run',
      )
    ) {
      return { ok: false, errorCode: 'profile_mismatch' };
    }
    return { ok: true, profile: 'mock', runStatus: 'complete' };
  }

  if (output.kind === 'invalid_run') {
    return output.runKind === 'live' &&
      output.runStatus === 'invalid' &&
      output.errorCode !== 'live_config_invalid'
      ? { ok: true, profile: 'live', runStatus: 'invalid' }
      : { ok: false, errorCode: 'profile_mismatch' };
  }
  if (output.runKind !== 'live') {
    return { ok: false, errorCode: 'profile_mismatch' };
  }
  if (
    input.file !==
      buildPhase6943LiveEvidencePath(output.startedAt, output.runIdHash)
  ) {
    return { ok: false, errorCode: 'profile_mismatch' };
  }

  if (output.runStatus === 'incomplete') {
    const allEntriesPresent =
      output.lanes.deterministic.entries.length === 100 &&
      output.lanes.mock.entries.length === 100 &&
      output.lanes.live.entries.length === 100;
    const hasPartialCoverage =
      output.lanes.live.status === 'partial' &&
      output.lanes.live.metricsStatus === 'partial' &&
      output.lanes.live.coverage.observedCount < 100 &&
      output.lanes.live.coverage.notRunCount > 0 &&
      output.lanes.live.counters.providerAttempts > 0;
    return allEntriesPresent &&
      hasPartialCoverage &&
      output.decisions.every((decision) => !decision.enabled)
      ? { ok: true, profile: 'live', runStatus: 'incomplete' }
      : { ok: false, errorCode: 'assertion_failed' };
  }

  return sameCounters(output.lanes.live.counters, [100, 100, 28, 28, 28, 72]) &&
    output.lanes.deterministic.entries.length === 100 &&
    output.lanes.mock.entries.length === 100 &&
    output.lanes.live.entries.length === 100 &&
    output.usage.providerReported &&
    output.usage.inputTokens > 0 &&
    output.usage.outputTokens > 0 &&
    output.estimatedCostUsd > 0 &&
    output.pricingSnapshot.inputPriceBasis === 'non_cached_highest_applicable' &&
    output.pricingSnapshot.effectiveMaxCostUsd ===
      Math.min(output.pricingSnapshot.cliMaxCostUsd, 0.1)
    ? { ok: true, profile: 'live', runStatus: 'complete' }
    : { ok: false, errorCode: 'assertion_failed' };
}

function sameCounters(
  counters: {
    caseEntries: number;
    adapterExecutions: number;
    runtimeInvocations: number;
    providerAttempts: number;
    strictSuccesses: number;
    zeroCallCases: number;
  },
  expected: readonly [number, number, number, number, number, number],
) {
  return [
    counters.caseEntries,
    counters.adapterExecutions,
    counters.runtimeInvocations,
    counters.providerAttempts,
    counters.strictSuccesses,
    counters.zeroCallCases,
  ].every((value, index) => value === expected[index]);
}

async function main() {
  const args = parseEvidenceValidatorArgs(process.argv.slice(2));
  if (!args.ok) {
    process.stdout.write(`${JSON.stringify(args)}\n`);
    process.exitCode = 3;
    return;
  }

  let raw: string;
  try {
    const repositoryRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../..',
    );
    const absolute = resolveInsideRoot(repositoryRoot, args.file);
    raw = await readFile(absolute, 'utf8');
  } catch {
    const failure = { ok: false as const, errorCode: 'read_failed' as const };
    process.stdout.write(`${JSON.stringify(failure)}\n`);
    process.exitCode = 3;
    return;
  }

  const result = validatePhase6943Evidence({
    profile: args.profile,
    file: args.file,
    raw,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 3;
}

if (import.meta.main) await main();
