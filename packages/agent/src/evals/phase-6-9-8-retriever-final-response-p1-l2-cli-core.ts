import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  PHASE_6_9_8_P1_L2_AUTHORIZATION_CONFIRMATION,
  PHASE_6_9_8_P1_L2_BUDGET,
  PHASE_6_9_8_P1_L2_DATA_BOUNDARY_CONFIRMATION,
  PHASE_6_9_8_P1_L2_LINEAGE,
  type Phase698P1L2AdmissionInput,
  type Phase698P1L2BudgetInput,
  type Phase698P1L2DataBoundaryReceipt,
  type Phase698P1L2ExactAuthorization,
  type Phase698P1L2SourceSnapshot,
} from './phase-6-9-8-retriever-final-response-p1-l2-admission.ts';

export const PHASE_6_9_8_P1_L2_CLI_COMMAND = Object.freeze({
  live: 'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_L2_CONTROLLED_LIVE_ONCE',
  validate: 'VALIDATE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_L2_BUNDLE',
  recover: 'RECOVER_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_L2_CRASH_ONLY_ONCE',
});

export type Phase698P1L2CredentialProjection = Readonly<{
  deepseekApiKey: string;
  qwenApiKey: string;
  credentialReads: 2;
}>;

export type Phase698P1L2SafeCliResult = Readonly<{
  ok: boolean;
  code: string;
  runId?: string;
  providerCalls?: number;
  credentialReads?: number;
  verifiedCostCny?: number | null;
  gate?: string;
}>;

export async function readPhase698P1L2RootCredentialProjection(repositoryRoot: string): Promise<
  | Readonly<{ ok: true; credentials: Phase698P1L2CredentialProjection }>
  | Readonly<{
      ok: false;
      code: 'credential_configuration_invalid' | 'credential_missing' | 'alias_conflict';
    }>
> {
  let text: string;
  try {
    text = await readFile(resolve(repositoryRoot, '.env'), 'utf8');
  } catch {
    return { ok: false, code: 'credential_configuration_invalid' };
  }
  const values = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match) continue;
    const key = match[1];
    if (!['DEEPSEEK_API_KEY', 'QWEN_API_KEY', 'Qwen_API_KEY', 'DASHSCOPE_API_KEY'].includes(key))
      continue;
    const value = unquote(match[2]);
    if (!validCredential(value)) return { ok: false, code: 'credential_configuration_invalid' };
    if (values.has(key) && values.get(key) !== value) return { ok: false, code: 'alias_conflict' };
    values.set(key, value);
  }
  const deepseekApiKey = values.get('DEEPSEEK_API_KEY');
  const qwenValues = ['QWEN_API_KEY', 'Qwen_API_KEY', 'DASHSCOPE_API_KEY']
    .map((key) => values.get(key))
    .filter((value): value is string => value !== undefined);
  if (!deepseekApiKey || qwenValues.length === 0) return { ok: false, code: 'credential_missing' };
  if (new Set(qwenValues).size !== 1) return { ok: false, code: 'alias_conflict' };
  return {
    ok: true,
    credentials: Object.freeze({
      deepseekApiKey,
      qwenApiKey: qwenValues[0],
      credentialReads: 2 as const,
    }),
  };
}

export function createPhase698P1L2DataBoundaryReceipt(
  confirmation: string,
): Phase698P1L2DataBoundaryReceipt {
  if (confirmation !== PHASE_6_9_8_P1_L2_DATA_BOUNDARY_CONFIRMATION)
    throw new Error('PHASE_6_9_8_P1_L2_DATA_BOUNDARY_INVALID');
  return Object.freeze({
    accepted: true,
    confirmation,
    providers: ['deepseek', 'qwen'] as const,
    scope: 'current_account' as const,
  });
}

export function createPhase698P1L2ExactAuthorization(input: {
  confirmation: string;
  source: Phase698P1L2SourceSnapshot;
}): Phase698P1L2ExactAuthorization {
  if (input.confirmation !== PHASE_6_9_8_P1_L2_AUTHORIZATION_CONFIRMATION)
    throw new Error('PHASE_6_9_8_P1_L2_AUTHORIZATION_INVALID');
  return Object.freeze({
    confirmation: input.confirmation,
    lineage: PHASE_6_9_8_P1_L2_LINEAGE,
    sourceBranch: input.source.branch,
    sourceCommit: input.source.head,
  });
}

export function createPhase698P1L2BudgetInput(): Phase698P1L2BudgetInput {
  return Object.freeze({
    maxCandidateInvocations: PHASE_6_9_8_P1_L2_BUDGET.maxCandidateInvocations,
    maxInputTokens: PHASE_6_9_8_P1_L2_BUDGET.maxInputTokens,
    maxOutputTokens: PHASE_6_9_8_P1_L2_BUDGET.maxOutputTokens,
    maxCostMicrosCny: PHASE_6_9_8_P1_L2_BUDGET.maxCostMicrosCny,
    priceProfileSha256: PHASE_6_9_8_P1_L2_BUDGET.priceProfileSha256,
  });
}

export function createPhase698P1L2AdmissionInput(input: {
  source: Phase698P1L2SourceSnapshot;
  dataBoundaryConfirmation: string;
  authorizationConfirmation: string;
}): Phase698P1L2AdmissionInput {
  const dataBoundary = createPhase698P1L2DataBoundaryReceipt(input.dataBoundaryConfirmation);
  const authorization = createPhase698P1L2ExactAuthorization({
    confirmation: input.authorizationConfirmation,
    source: input.source,
  });
  return Object.freeze({
    source: input.source,
    dataBoundary,
    authorization,
    budget: createPhase698P1L2BudgetInput(),
  });
}

export function safePhase698P1L2CliResult(input: Phase698P1L2SafeCliResult): string {
  return JSON.stringify({
    ok: input.ok,
    code: input.code,
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.providerCalls === undefined ? {} : { providerCalls: input.providerCalls }),
    ...(input.credentialReads === undefined ? {} : { credentialReads: input.credentialReads }),
    ...(input.verifiedCostCny === undefined ? {} : { verifiedCostCny: input.verifiedCostCny }),
    ...(input.gate ? { gate: input.gate } : {}),
  });
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    return trimmed.slice(1, -1);
  return trimmed;
}
function validCredential(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 512 &&
    value === value.trim() &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}
