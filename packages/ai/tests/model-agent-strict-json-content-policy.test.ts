import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import { requireModelAgentStrictJsonContent } from '../src/model-agent-structured-output-policy.ts';
import { requiresModelAgentStrictJsonContent } from '../src/model-agent-structured-output-policy.ts';

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
});
