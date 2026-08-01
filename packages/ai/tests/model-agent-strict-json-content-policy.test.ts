import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  parseModelAgentJsonContentWithPolicy,
  requireModelAgentBoundedJsonContentParser,
  requireModelAgentStrictJsonContent,
  requiresModelAgentStrictJsonContent,
} from '../src/model-agent-structured-output-policy.ts';

describe('ModelAgent strict JSON content policy', () => {
  test('marks only the exact in-process schema identity without mutating it', () => {
    const strict = z.object({ value: z.number() }).strict();
    const ordinary = z.object({ value: z.number() }).strict();
    const keysBefore = Reflect.ownKeys(strict);

    expect(requireModelAgentStrictJsonContent(strict)).toBe(strict);
    expect(requiresModelAgentStrictJsonContent(strict)).toBe(true);
    expect(requiresModelAgentStrictJsonContent(ordinary)).toBe(false);
    expect(Reflect.ownKeys(strict)).toEqual(keysBefore);
  });

  test('fails non-schema identities closed without retaining hostile input', () => {
    expect(requiresModelAgentStrictJsonContent(null)).toBe(false);
    expect(requiresModelAgentStrictJsonContent('schema')).toBe(false);
    expect(
      requiresModelAgentStrictJsonContent(
        new Proxy(
          {},
          {
            getPrototypeOf() {
              throw new Error('strict-json-proxy-secret');
            },
          },
        ),
      ),
    ).toBe(false);
  });

  test('binds one bounded raw-content parser to the exact schema identity', () => {
    const schema = z.object({ intentIndex: z.number().int() }).strict();
    const sibling = z.object({ intentIndex: z.number().int() }).strict();
    const parser = (content: string) =>
      content === '{"intentIndex":0}'
        ? ({ ok: true, value: { intentIndex: 0 } } as const)
        : ({ ok: false, stage: 'provider_json_parse' } as const);
    const keysBefore = Reflect.ownKeys(schema);

    expect(requireModelAgentBoundedJsonContentParser(schema, parser)).toBe(schema);
    expect(requiresModelAgentStrictJsonContent(schema)).toBe(true);
    expect(Reflect.ownKeys(schema)).toEqual(keysBefore);
    expect(parseModelAgentJsonContentWithPolicy(schema, '{"intentIndex":0}')).toEqual({
      handled: true,
      result: { ok: true, value: { intentIndex: 0 } },
    });
    expect(parseModelAgentJsonContentWithPolicy(schema, 'not-json')).toEqual({
      handled: true,
      result: { ok: false, stage: 'provider_json_parse' },
    });
    expect(parseModelAgentJsonContentWithPolicy(sibling, '{"intentIndex":0}')).toEqual({
      handled: false,
    });
    expect(() => requireModelAgentBoundedJsonContentParser(schema, parser)).toThrow(
      'MODEL_AGENT_BOUNDED_JSON_PARSER_ALREADY_REGISTERED',
    );
  });

  test('fails hostile or malformed bounded parser results closed without raw retention', () => {
    const thrown = z.object({ intentIndex: z.number() }).strict();
    requireModelAgentBoundedJsonContentParser(thrown, () => {
      throw new Error('raw-provider-secret-must-not-escape');
    });
    expect(
      parseModelAgentJsonContentWithPolicy(thrown, 'raw-provider-secret-must-not-escape'),
    ).toEqual({
      handled: true,
      result: { ok: false, stage: 'provider_type_validation' },
    });

    const malformed = z.object({ intentIndex: z.number() }).strict();
    requireModelAgentBoundedJsonContentParser(
      malformed,
      () => ({ ok: true }) as unknown as { ok: true; value: unknown },
    );
    expect(parseModelAgentJsonContentWithPolicy(malformed, 'sentinel')).toEqual({
      handled: true,
      result: { ok: false, stage: 'provider_type_validation' },
    });
  });
});
