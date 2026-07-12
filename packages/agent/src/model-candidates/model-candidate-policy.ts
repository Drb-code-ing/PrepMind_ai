import {
  isModelAgentRunBudget,
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
  type ModelAgentRunBudget,
  type ModelAgentTrace,
  type ModelAgentUsage,
} from '@repo/ai';

export const MODEL_CANDIDATE_DISPOSITIONS = [
  'not_eligible',
  'safety_blocked',
  'candidate_applied',
  'fallback_invalid_input',
  'fallback_schema_invalid',
  'fallback_budget_exceeded',
  'fallback_timeout',
  'fallback_aborted',
  'fallback_runtime_error',
] as const;

export type ModelCandidateDisposition = (typeof MODEL_CANDIDATE_DISPOSITIONS)[number];

export type HardBlockCode =
  | 'credential_material'
  | 'instruction_override'
  | 'system_prompt_exfiltration';

type ObservationBase<
  Disposition extends ModelCandidateDisposition,
  ReasonCode extends string,
> = {
  disposition: Disposition;
  budget: ModelAgentRunBudget;
  usage: ModelAgentUsage;
  reasonCodes: readonly [Disposition, ...ReasonCode[]];
};

type ObservationByDisposition<ReasonCode extends string> = {
  [Disposition in ModelCandidateDisposition]: ObservationBase<Disposition, ReasonCode> &
    (
      | {
          attempted: false;
          trace?: never;
          traceUnavailable?: never;
          usageUnavailable?: never;
        }
      | {
          attempted: true;
          trace: ModelAgentTrace;
          traceUnavailable?: never;
          usageUnavailable?: never;
        }
      | {
          attempted: true;
          trace?: never;
          traceUnavailable: true;
          usageUnavailable: true;
        }
    );
}[ModelCandidateDisposition];

export type ModelCandidateObservation<ReasonCode extends string> =
  ObservationByDisposition<ReasonCode>;

export type ModelCandidateEnvelope<Result, ReasonCode extends string> = {
  result: Result;
  observation: ModelCandidateObservation<ReasonCode>;
};

export type PrepareCandidateTextResult =
  | { ok: true; text: string }
  | {
      ok: false;
      disposition: 'fallback_invalid_input' | 'safety_blocked';
      hardBlockCode?: HardBlockCode;
    };

const EMAIL_UNICODE_ATOM_PATTERN = /^[\p{L}\p{N}\p{M}]$/u;
const EMAIL_LOCAL_SYMBOLS = "!#$%&'*+-/=?^_`{|}~";

const HARD_BLOCK_PATTERNS: readonly [HardBlockCode, RegExp][] = [
  [
    'instruction_override',
    /(?:(?:^|[^a-z0-9_])ignore\s+(?:all\s+)?(?:previous|above|rules?)(?![a-z0-9_])|忽略(?:以上|之前|规则))/iu,
  ],
  [
    'credential_material',
    /authorization\s*:\s*bearer|cookie\s*[:=]|(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password)\s*[:=]|(?:密码|密钥|访问令牌|客户端密钥)\s*[:=]|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:^|[^a-z0-9_-])(?:sk-[a-z0-9_-]{16,}|aiza[a-z0-9_-]{24,})(?![a-z0-9_-])/iu,
  ],
  [
    'system_prompt_exfiltration',
    /(?:^|[^a-z0-9_])system\s+prompt(?![a-z0-9_])|系统提示词/iu,
  ],
];

export function normalizeCandidateText(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

export function detectHardBlockedCandidateMaterial(value: string): HardBlockCode | null {
  const normalized = normalizeCandidateScanText(value);
  for (const [code, pattern] of HARD_BLOCK_PATTERNS) {
    if (pattern.test(normalized)) return code;
    if (
      code === 'credential_material' &&
      containsOrderedSignalsWithin(
        normalized,
        [
          ['输出', '打印', '显示', '返回', '泄露'],
          ['密码', '密钥', '访问令牌', '客户端密钥'],
        ],
        40,
      )
    ) {
      return code;
    }
  }
  return null;
}

export function prepareCandidateText(input: {
  value: unknown;
  maxRawBytes: number;
  maxChars: number;
}): PrepareCandidateTextResult {
  if (
    typeof input.value !== 'string' ||
    !Number.isSafeInteger(input.maxRawBytes) ||
    input.maxRawBytes <= 0 ||
    !Number.isSafeInteger(input.maxChars) ||
    input.maxChars <= 0 ||
    utf8Bytes(input.value) > input.maxRawBytes
  ) {
    return { ok: false, disposition: 'fallback_invalid_input' };
  }

  const rawBlock = detectHardBlockedCandidateMaterial(input.value);
  if (rawBlock) {
    return { ok: false, disposition: 'safety_blocked', hardBlockCode: rawBlock };
  }

  const normalized = redactEmailAddresses(normalizeCandidateText(input.value));
  const normalizedBlock = detectHardBlockedCandidateMaterial(normalized);
  if (normalizedBlock) {
    return { ok: false, disposition: 'safety_blocked', hardBlockCode: normalizedBlock };
  }

  return { ok: true, text: Array.from(normalized).slice(0, input.maxChars).join('') };
}

export function containsOrderedSignalsWithin(
  value: string,
  groups: readonly (readonly string[])[],
  maxGap: number,
): boolean {
  if (!Number.isSafeInteger(maxGap) || maxGap < 0 || groups.length === 0) return false;

  const source = Array.from(normalizeCandidateText(value));
  let reachableEnds = new Array<boolean>(source.length + 1).fill(false);

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const candidates = (groups[groupIndex] ?? []).map((term) =>
      Array.from(normalizeCandidateText(term)),
    );
    const reachableEndPrefix = buildReachableEndPrefix(reachableEnds);
    const nextReachableEnds = new Array<boolean>(source.length + 1).fill(false);
    let hasReachableMatch = false;

    for (let start = 0; start < source.length; start += 1) {
      if (
        groupIndex > 0 &&
        !hasReachableEndWithin(reachableEndPrefix, start, maxGap)
      ) {
        continue;
      }
      for (const term of candidates) {
        if (term.length === 0) continue;
        if (!matchesCodePointsAt(source, term, start)) continue;
        nextReachableEnds[start + term.length] = true;
        hasReachableMatch = true;
      }
    }

    if (!hasReachableMatch) return false;
    reachableEnds = nextReachableEnds;
  }

  return true;
}

export function estimateCandidateInputTokens(parts: readonly string[]): number {
  return 64 + Math.ceil(utf8Bytes(parts.join('\n')) / 3);
}

export function canReserveCandidateBudget(
  budget: unknown,
  reservation: { inputTokens: number; outputTokens: number },
): { ok: true } | { ok: false; code: ModelAgentErrorCode } {
  if (!isModelAgentRunBudget(budget)) return { ok: false, code: 'INVALID_REQUEST' };

  const result = reserveModelAgentBudget(budget, reservation);
  if (result.ok) return { ok: true };

  return {
    ok: false,
    code: result.code === 'INVALID_MODEL_AGENT_BUDGET' ? 'INVALID_REQUEST' : result.code,
  };
}

export function mapModelAgentErrorDisposition(
  code: ModelAgentErrorCode,
): ModelCandidateDisposition {
  switch (code) {
    case 'INVALID_REQUEST':
      return 'fallback_invalid_input';
    case 'CALL_BUDGET_EXCEEDED':
    case 'INPUT_BUDGET_EXCEEDED':
    case 'OUTPUT_BUDGET_EXCEEDED':
      return 'fallback_budget_exceeded';
    case 'SCHEMA_INVALID':
      return 'fallback_schema_invalid';
    case 'TIMEOUT':
      return 'fallback_timeout';
    case 'ABORTED':
      return 'fallback_aborted';
    case 'LIVE_CALLS_DISABLED':
    case 'EXECUTOR_UNAVAILABLE':
    case 'INVALID_RUNTIME_CONFIG':
    case 'PROVIDER_ERROR':
      return 'fallback_runtime_error';
  }
}

export function canonicalCandidateReasonCodes<
  Disposition extends ModelCandidateDisposition,
  ReasonCode extends string,
>(
  disposition: Disposition,
  codes: readonly ReasonCode[],
): readonly [Disposition, ...ReasonCode[]] {
  const canonicalDisposition: string = disposition;
  const details = new Set<ReasonCode>();
  for (const code of codes) {
    if (code !== canonicalDisposition) details.add(code);
  }
  return [disposition, ...Array.from(details)];
}

export function safeCandidateBudgetSnapshot(value: unknown): ModelAgentRunBudget {
  return isModelAgentRunBudget(value)
    ? { ...value }
    : {
        maxCalls: 1,
        usedCalls: 0,
        maxInputTokens: 1,
        usedInputTokens: 0,
        maxOutputTokens: 1,
        usedOutputTokens: 0,
      };
}

export const ZERO_CANDIDATE_USAGE: ModelAgentUsage = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
});

function utf8Bytes(value: string): number {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (
      codeUnit >= 0xd800 &&
      codeUnit <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

export function normalizeCandidateScanText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\p{Cf}/gu, '')
    .trim()
    .replace(/\s+/gu, ' ');
}

function redactEmailAddresses(value: string): string {
  const characters = Array.from(value);
  const output: string[] = [];
  let tokenStart = 0;
  let atIndex = -1;
  let atCount = 0;
  let scanningDomain = false;

  for (let index = 0; index <= characters.length; index += 1) {
    const character = characters[index];

    if (scanningDomain) {
      if (character === '@') {
        atCount += 1;
        continue;
      }
      if (character !== undefined && isEmailDomainCharacter(character)) continue;

      appendRedactedEmailToken(characters, tokenStart, index, atIndex, atCount, output);
      tokenStart = index;
      atIndex = -1;
      atCount = 0;
      scanningDomain = false;
      if (character === undefined) break;
    }

    if (character === '@') {
      atIndex = index;
      atCount = 1;
      scanningDomain = true;
      continue;
    }
    if (character !== undefined && isEmailLocalCharacter(character)) continue;

    appendRedactedEmailToken(characters, tokenStart, index, atIndex, atCount, output);
    if (character !== undefined) output.push(character);
    tokenStart = index + 1;
    atIndex = -1;
    atCount = 0;
    scanningDomain = false;
  }

  return output.join('');
}

function appendRedactedEmailToken(
  characters: readonly string[],
  start: number,
  end: number,
  atIndex: number,
  atCount: number,
  output: string[],
): void {
  if (start === end) return;

  let candidateEnd = end;
  while (candidateEnd > atIndex + 1 && characters[candidateEnd - 1] === '.') {
    candidateEnd -= 1;
  }

  if (
    atCount === 1 &&
    isValidEmailLocal(characters, start, atIndex) &&
    isValidEmailDomain(characters, atIndex + 1, candidateEnd)
  ) {
    output.push('[redacted_email]');
    if (candidateEnd < end) output.push(characters.slice(candidateEnd, end).join(''));
    return;
  }

  output.push(characters.slice(start, end).join(''));
}

function isEmailLocalCharacter(character: string): boolean {
  return (
    character === '.' ||
    EMAIL_LOCAL_SYMBOLS.includes(character) ||
    isEmailUnicodeAtom(character)
  );
}

function isEmailDomainCharacter(character: string): boolean {
  return character === '.' || character === '-' || isEmailUnicodeAtom(character);
}

function isValidEmailLocal(
  characters: readonly string[],
  start: number,
  end: number,
): boolean {
  if (start >= end || characters[start] === '.' || characters[end - 1] === '.') return false;

  let previousWasDot = false;
  for (let index = start; index < end; index += 1) {
    const character = characters[index];
    if (character === '.') {
      if (previousWasDot) return false;
      previousWasDot = true;
      continue;
    }
    if (
      character === undefined ||
      (!isEmailUnicodeAtom(character) && !EMAIL_LOCAL_SYMBOLS.includes(character))
    ) {
      return false;
    }
    previousWasDot = false;
  }

  return true;
}

function isValidEmailDomain(
  characters: readonly string[],
  start: number,
  end: number,
): boolean {
  if (start >= end) return false;

  let labelStart = start;
  let labelCount = 0;
  for (let index = start; index <= end; index += 1) {
    if (index < end && characters[index] !== '.') continue;
    const isFinalLabel = index === end;
    if (!isValidEmailDomainLabel(characters, labelStart, index, isFinalLabel)) return false;
    labelCount += 1;
    labelStart = index + 1;
  }

  return labelCount >= 2;
}

function isValidEmailDomainLabel(
  characters: readonly string[],
  start: number,
  end: number,
  isFinalLabel: boolean,
): boolean {
  if (
    start >= end ||
    characters[start] === '-' ||
    characters[end - 1] === '-'
  ) {
    return false;
  }

  if (isFinalLabel && isPunycodeLabel(characters, start, end)) return true;
  if (isFinalLabel && end - start < 2) return false;

  for (let index = start; index < end; index += 1) {
    const character = characters[index];
    if (character === undefined) return false;
    if (isEmailUnicodeAtom(character)) continue;
    if (!isFinalLabel && character === '-') continue;
    return false;
  }

  return true;
}

function isPunycodeLabel(
  characters: readonly string[],
  start: number,
  end: number,
): boolean {
  if (
    end - start < 5 ||
    characters[start] !== 'x' ||
    characters[start + 1] !== 'n' ||
    characters[start + 2] !== '-' ||
    characters[start + 3] !== '-'
  ) {
    return false;
  }

  for (let index = start + 4; index < end; index += 1) {
    const character = characters[index];
    if (character === undefined || !/[a-z0-9-]/.test(character)) return false;
  }
  return true;
}

function isEmailUnicodeAtom(character: string): boolean {
  return EMAIL_UNICODE_ATOM_PATTERN.test(character);
}

function buildReachableEndPrefix(reachableEnds: readonly boolean[]): number[] {
  const prefix = new Array<number>(reachableEnds.length + 1).fill(0);
  for (let end = 0; end < reachableEnds.length; end += 1) {
    prefix[end + 1] = (prefix[end] ?? 0) + (reachableEnds[end] ? 1 : 0);
  }
  return prefix;
}

function hasReachableEndWithin(
  reachableEndPrefix: readonly number[],
  start: number,
  maxGap: number,
): boolean {
  const lowerEnd = Math.max(0, start - maxGap);
  return (
    (reachableEndPrefix[start + 1] ?? 0) - (reachableEndPrefix[lowerEnd] ?? 0) > 0
  );
}

function matchesCodePointsAt(
  source: readonly string[],
  term: readonly string[],
  start: number,
): boolean {
  if (start + term.length > source.length) return false;
  for (let offset = 0; offset < term.length; offset += 1) {
    if (source[start + offset] !== term[offset]) return false;
  }
  return true;
}
