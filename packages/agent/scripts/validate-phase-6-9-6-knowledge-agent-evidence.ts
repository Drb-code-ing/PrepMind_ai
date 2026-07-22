import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasSensitiveEvidence } from './phase-6-9-6-knowledge-agent-cli.ts';
import { PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA } from '../src/evals/phase-6-9-knowledge-agent-paired-contract.ts';
import { PHASE_6_9_KNOWLEDGE_PROMPT_VERSION } from '../src/evals/phase-6-9-knowledge-agent-paired-contract.ts';

export type Phase696EvidenceValidation =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code:
        | 'sensitive_evidence'
        | 'report_contract_invalid'
        | 'evidence_read_failed'
        | 'evidence_filename_invalid'
        | 'run_identity_invalid'
        | 'usage_or_pricing_invalid';
    }>;

export function validatePhase696KnowledgeAgentEvidenceValue(
  value: unknown,
): Phase696EvidenceValidation {
  if (hasSensitiveEvidence(value)) return { ok: false, code: 'sensitive_evidence' };
  const parsed = PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA.safeParse(value);
  if (!parsed.success) return { ok: false, code: 'report_contract_invalid' };
  if (
    parsed.data.mode !== 'deterministic' &&
    (parsed.data.usage.verifiedCases !== 48 ||
      !parsed.data.usage.pricingKnown ||
      parsed.data.usage.pricingProfile === null ||
      parsed.data.usage.totalCostCny === null ||
      parsed.data.usage.totalCostCny <= 0)
  ) {
    return { ok: false, code: 'usage_or_pricing_invalid' };
  }
  return { ok: true };
}

export function validatePhase696KnowledgeAgentEvidenceBundle(
  values: readonly unknown[],
): Phase696EvidenceValidation {
  if (values.length === 0) return { ok: false, code: 'evidence_read_failed' };
  const reports = [];
  for (const value of values) {
    const validation = validatePhase696KnowledgeAgentEvidenceValue(value);
    if (!validation.ok) return validation;
    reports.push(PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA.parse(value));
  }
  const runIds = new Set<string>();
  const scopeByRunId = new Map<string, 'branch' | 'main'>();
  for (const report of reports) {
    const previousScope = scopeByRunId.get(report.runId);
    if (runIds.has(report.runId) || (previousScope && previousScope !== report.runScope)) {
      return { ok: false, code: 'run_identity_invalid' };
    }
    runIds.add(report.runId);
    scopeByRunId.set(report.runId, report.runScope);
  }
  return { ok: true };
}

export function validatePhase696KnowledgeAgentEvidenceRecord(input: {
  path: string;
  value: unknown;
}): Phase696EvidenceValidation {
  const validation = validatePhase696KnowledgeAgentEvidenceValue(input.value);
  if (!validation.ok) return validation;
  const report = PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA.parse(input.value);
  const v2 = report.promptVersion === PHASE_6_9_KNOWLEDGE_PROMPT_VERSION;
  const expectedName =
    report.mode === 'mock'
      ? `phase-6-9-6-knowledge-agent-${report.runScope}-mock${v2 ? '-v2' : ''}.json`
      : `phase-6-9-6-knowledge-agent-${report.runScope}-${report.mode}${v2 ? '-v2' : ''}-${report.runId}.json`;
  return basename(input.path) === expectedName
    ? { ok: true }
    : { ok: false, code: 'evidence_filename_invalid' };
}

export async function validatePhase696KnowledgeAgentEvidenceFile(input: {
  path: string;
}): Promise<Phase696EvidenceValidation> {
  try {
    const contents = await readFile(input.path, 'utf8');
    const value: unknown = JSON.parse(contents);
    return validatePhase696KnowledgeAgentEvidenceRecord({ path: input.path, value });
  } catch {
    return { ok: false, code: 'evidence_read_failed' };
  }
}

if (import.meta.main) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const directory = resolve(root, '.tmp');
  let result: Phase696EvidenceValidation;
  let evidenceCount = 0;
  try {
    const names = (await readdir(directory)).filter((name) =>
      /^phase-6-9-6-knowledge-agent-(branch|main)-(mock(?:-v2)?|live(?:-v2)?-[0-9a-f-]{36})\.json$/.test(
        name,
      ),
    );
    const records = await Promise.all(
      names.map(async (name): Promise<unknown> => {
        const value: unknown = JSON.parse(await readFile(resolve(directory, name), 'utf8'));
        return { name, value };
      }),
    );
    evidenceCount = records.length;
    const normalized = records as readonly Readonly<{ name: string; value: unknown }>[];
    const invalidRecord = normalized
      .map((record) =>
        validatePhase696KnowledgeAgentEvidenceRecord({
          path: resolve(directory, record.name),
          value: record.value,
        }),
      )
      .find((validation) => !validation.ok);
    result =
      invalidRecord ??
      validatePhase696KnowledgeAgentEvidenceBundle(normalized.map((record) => record.value));
  } catch {
    result = { ok: false, code: 'evidence_read_failed' };
  }
  process.stdout.write(`${JSON.stringify({ ...result, evidenceCount })}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
