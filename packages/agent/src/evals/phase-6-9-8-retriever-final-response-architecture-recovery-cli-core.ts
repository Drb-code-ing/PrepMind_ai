import type {
  Phase698ArchitectureRecoveryCrashSealResult,
  validatePhase698ArchitectureRecoveryBundle,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-durability.ts';

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-r3-cli-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_VALIDATE_ARG =
  'VALIDATE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R3_BUNDLE_ZERO_PROVIDER' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_SEAL_ARG =
  'I_SEAL_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R3_CRASH_ONLY_ONCE' as const;

type ValidationResult = Awaited<ReturnType<typeof validatePhase698ArchitectureRecoveryBundle>>;

export type Phase698ArchitectureRecoveryCliCoreInput = Readonly<{
  args: readonly string[];
  root: string;
}>;

export type Phase698ArchitectureRecoveryCliCorePorts = Readonly<{
  validate(input: { root: string }): Promise<ValidationResult>;
  seal(input: { root: string }): Promise<Phase698ArchitectureRecoveryCrashSealResult>;
  write(line: string): void;
}>;

/**
 * Zero-provider maintenance entry point. The grammar intentionally has no run, Live, retry,
 * replay, resume, or backfill operation.
 */
export async function executePhase698ArchitectureRecoveryCliCore(
  rawInput: Phase698ArchitectureRecoveryCliCoreInput,
  rawPorts: Phase698ArchitectureRecoveryCliCorePorts,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  if (!input || !ports) return 1;

  if (hasExactArgument(input.args, PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_VALIDATE_ARG)) {
    try {
      const result = await ports.validate({ root: input.root });
      const ok = readBoolean(result, 'ok') === true;
      if (
        !safeWrite(
          ports.write,
          JSON.stringify({
            version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_CLI_VERSION,
            operation: 'validate',
            ok,
            providerCalls: 0,
            qualityAuthority: readQualityAuthority(result),
            code: ok ? 'bundle_valid' : 'bundle_invalid',
          }),
        )
      ) {
        return 1;
      }
      return ok ? 0 : 1;
    } catch {
      return blocked(ports.write, 'validate_failed');
    }
  }

  if (hasExactArgument(input.args, PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_SEAL_ARG)) {
    try {
      const result = await ports.seal({ root: input.root });
      const ok = readBoolean(result, 'ok') === true;
      const disposition = ok ? readSealDisposition(result) : null;
      const code = ok ? disposition : (readSafeCode(result, 'code') ?? 'seal_rejected');
      if (
        !safeWrite(
          ports.write,
          JSON.stringify({
            version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_CLI_VERSION,
            operation: 'crash_only_seal',
            ok,
            providerCalls: 0,
            qualityAuthority: 'none',
            code,
          }),
        )
      ) {
        return 1;
      }
      return ok ? 0 : 1;
    } catch {
      return blocked(ports.write, 'crash_only_seal_failed');
    }
  }

  return blocked(ports.write, 'cli_argument_invalid');
}

function blocked(write: (line: string) => void, code: string) {
  safeWrite(
    write,
    JSON.stringify({
      version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R3_CLI_VERSION,
      ok: false,
      providerCalls: 0,
      qualityAuthority: 'none',
      code,
    }),
  );
  return 1 as const;
}

function readInput(value: unknown): Phase698ArchitectureRecoveryCliCoreInput | null {
  const fields = readExactOwnData(value, ['args', 'root']);
  if (
    !fields ||
    !Array.isArray(fields.args) ||
    fields.args.some((entry) => typeof entry !== 'string') ||
    typeof fields.root !== 'string' ||
    fields.root.length === 0 ||
    fields.root.length > 4096
  ) {
    return null;
  }
  return Object.freeze({
    args: Object.freeze(fields.args.map((entry) => String(entry))),
    root: fields.root,
  });
}

function readPorts(value: unknown): Phase698ArchitectureRecoveryCliCorePorts | null {
  const fields = readExactOwnData(value, ['seal', 'validate', 'write']);
  if (!fields || Object.values(fields).some((entry) => typeof entry !== 'function')) return null;
  return Object.freeze(fields as unknown as Phase698ArchitectureRecoveryCliCorePorts);
}

function readExactOwnData(value: unknown, expectedKeys: readonly string[]) {
  try {
    if (!isRecord(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const fields = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      fields[key] = descriptor.value;
    }
    return fields;
  } catch {
    return null;
  }
}

function readBoolean(value: unknown, key: string) {
  const field = readOwnData(value, key);
  return typeof field === 'boolean' ? field : null;
}

function readQualityAuthority(value: unknown) {
  const field = readOwnData(value, 'qualityAuthority');
  return field === 'retriever_final_response_architecture_recovery_semantic_gate' ? field : 'none';
}

function readSealDisposition(value: unknown) {
  const field = readOwnData(value, 'disposition');
  return field === 'crash_only_sealed' || field === 'terminal_publication_recovered'
    ? field
    : 'seal_result_invalid';
}

function readSafeCode(value: unknown, key: string) {
  const field = readOwnData(value, key);
  return typeof field === 'string' && /^[a-z0-9_]{1,96}$/u.test(field) ? field : null;
}

function readOwnData(value: unknown, key: string) {
  try {
    if (!isRecord(value)) return undefined;
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function hasExactArgument(args: readonly string[], expected: string) {
  try {
    return args.length === 1 && args[0] === expected;
  } catch {
    return false;
  }
}

function safeWrite(write: (line: string) => void, line: string) {
  if (line.length >= 1024) return false;
  try {
    write(line);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
