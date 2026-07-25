import { prepareCandidateText } from './model-candidate-policy.ts';

export type ModelProjectionSafetyReasonCode =
  | 'invalid_input'
  | 'field_too_large'
  | 'credential_material'
  | 'instruction_override'
  | 'system_prompt_exfiltration'
  | 'control_character';

export type CompleteModelFieldScanResult =
  | { ok: true; value: string }
  | { ok: false; reasonCode: ModelProjectionSafetyReasonCode };

export function scanCompleteModelField(
  value: string,
  options: {
    maxUtf16CodeUnits: number;
    rejectToolOrWriteInstruction?: boolean;
  },
): CompleteModelFieldScanResult {
  if (
    !Number.isSafeInteger(options.maxUtf16CodeUnits) ||
    options.maxUtf16CodeUnits <= 0 ||
    value.length > options.maxUtf16CodeUnits
  ) {
    return { ok: false, reasonCode: 'field_too_large' };
  }
  if (!hasWellFormedUtf16(value)) {
    return { ok: false, reasonCode: 'invalid_input' };
  }
  if (containsForbiddenControlCharacter(value)) {
    return { ok: false, reasonCode: 'control_character' };
  }
  if (options.rejectToolOrWriteInstruction && containsToolOrWriteInstruction(value)) {
    return { ok: false, reasonCode: 'instruction_override' };
  }

  const guarded = prepareCandidateText({
    value,
    maxRawBytes: options.maxUtf16CodeUnits * 4,
    maxChars: Math.max(1, Array.from(value).length),
  });
  if (!guarded.ok) {
    return {
      ok: false,
      reasonCode:
        guarded.disposition === 'fallback_invalid_input'
          ? 'invalid_input'
          : (guarded.hardBlockCode ?? 'instruction_override'),
    };
  }
  return { ok: true, value: guarded.text };
}

const MAX_CLONE_DEPTH = 8;
const MAX_CLONE_ARRAY_LENGTH = 256;
const MAX_CLONE_OBJECT_KEYS = 512;
const MAX_CLONE_NODES = 4_096;
const EVIDENCE_MAX_CLONE_DEPTH = 12;
const EVIDENCE_MAX_CLONE_NODES = 32_768;

type CloneLimits = Readonly<{
  maxDepth: number;
  maxArrayLength: number;
  maxObjectKeys: number;
}>;

const MODEL_CLONE_LIMITS: CloneLimits = Object.freeze({
  maxDepth: MAX_CLONE_DEPTH,
  maxArrayLength: MAX_CLONE_ARRAY_LENGTH,
  maxObjectKeys: MAX_CLONE_OBJECT_KEYS,
});

const EVIDENCE_CLONE_LIMITS: CloneLimits = Object.freeze({
  maxDepth: EVIDENCE_MAX_CLONE_DEPTH,
  maxArrayLength: MAX_CLONE_ARRAY_LENGTH,
  maxObjectKeys: MAX_CLONE_OBJECT_KEYS,
});

export function clonePlainModelData(input: unknown): { ok: true; value: unknown } | { ok: false } {
  return clonePlainModelDataWithBudget(
    input,
    0,
    { remainingNodes: MAX_CLONE_NODES },
    MODEL_CLONE_LIMITS,
  );
}

export function clonePlainEvidenceData(
  input: unknown,
): { ok: true; value: unknown } | { ok: false } {
  return clonePlainModelDataWithBudget(
    input,
    0,
    { remainingNodes: EVIDENCE_MAX_CLONE_NODES },
    EVIDENCE_CLONE_LIMITS,
  );
}

function clonePlainModelDataWithBudget(
  input: unknown,
  depth: number,
  budget: { remainingNodes: number },
  limits: CloneLimits,
): { ok: true; value: unknown } | { ok: false } {
  budget.remainingNodes -= 1;
  if (budget.remainingNodes < 0 || depth > limits.maxDepth) return { ok: false };
  if (
    input === null ||
    typeof input === 'string' ||
    typeof input === 'number' ||
    typeof input === 'boolean'
  ) {
    return { ok: true, value: input };
  }
  if (typeof input !== 'object') return { ok: false };

  try {
    const keys = Reflect.ownKeys(input);
    if (keys.length > limits.maxObjectKeys) return { ok: false };
    if (Array.isArray(input)) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(input, 'length');
      if (
        lengthDescriptor === undefined ||
        !('value' in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        lengthDescriptor.value > limits.maxArrayLength
      ) {
        return { ok: false };
      }
      const length = lengthDescriptor.value as number;
      const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
      if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) {
        return { ok: false };
      }

      const output: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
        if (descriptor === undefined || !('value' in descriptor)) return { ok: false };
        const cloned = clonePlainModelDataWithBudget(descriptor.value, depth + 1, budget, limits);
        if (!cloned.ok) return cloned;
        output.push(cloned.value);
      }
      return { ok: true, value: output };
    }

    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return { ok: false };

    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== 'string') return { ok: false };
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !('value' in descriptor)) return { ok: false };
      const cloned = clonePlainModelDataWithBudget(descriptor.value, depth + 1, budget, limits);
      if (!cloned.ok) return cloned;
      Object.defineProperty(output, key, {
        value: cloned.value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return { ok: true, value: output };
  } catch {
    return { ok: false };
  }
}

export function truncateUnicodeScalars(value: string, maxScalars: number): string {
  return Array.from(value).slice(0, maxScalars).join('');
}

export function deepFreezeModelValue<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreezeModelValue(child);
  return value;
}

function containsForbiddenControlCharacter(value: string): boolean {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|\p{Cf}/u.test(value);
}

function hasWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const following = value.charCodeAt(index + 1);
      if (following < 0xdc00 || following > 0xdfff) return false;
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) return false;
  }
  return true;
}

function containsToolOrWriteInstruction(value: string): boolean {
  return /(?:\b(?:use|call|invoke|execute)\s+(?:the\s+)?(?:tool|api)\b|\b(?:delete|replace|rename|merge|persist|write)\s+(?:this|these|all|the\s+)?(?:questions?|decks?|documents?|files?|records?|data)\b|(?:调用|使用).{0,12}(?:工具|接口)|(?:删除|替换|重命名|合并|写入|持久化).{0,12}(?:错题|专题|资料|文档|文件|记录|数据))/iu.test(
    value,
  );
}
