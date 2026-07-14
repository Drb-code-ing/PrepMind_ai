import { describe, expect, it } from 'bun:test';
import { zodSchema } from 'ai';
import { z } from 'zod';

import {
  compileDeepSeekStrictToolSchemaProfiles,
  MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED,
} from '../src/model-agent-structured-schema';

const routerSchema = z
  .object({
    route: z.enum(['chat', 'tutor']),
    confidence: z.number().min(0).max(1),
    reasonCode: z.enum([
      'ambiguous_intent_resolved',
      'insufficient_context',
    ]),
  })
  .strict();

const verifierSchema = z
  .discriminatedUnion('status', [
    z
      .object({
        status: z.literal('trusted'),
        evidenceCodes: z.tuple([z.literal('consistent_support')]),
      })
      .strict(),
    z
      .object({
        status: z.literal('conflict'),
        evidenceCodes: z
          .array(z.enum(['numeric_conflict', 'version_conflict']))
          .min(1)
          .max(2),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (
      value.status === 'conflict' &&
      new Set(value.evidenceCodes).size !== value.evidenceCodes.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'duplicate evidence',
      });
    }
  });

describe('DeepSeek strict-tool schema profiles', () => {
  it('projects literals and one-item tuples into the documented strict subset', () => {
    const originalVerifierJson = JSON.stringify(
      zodSchema(verifierSchema).jsonSchema,
    );
    const registry = compileDeepSeekStrictToolSchemaProfiles([
      { name: 'router_candidate_v1', schema: routerSchema },
      {
        name: 'knowledge_verifier_candidate_v1',
        schema: verifierSchema,
      },
    ]);

    const router = registry.resolve(routerSchema);
    const verifier = registry.resolve(verifierSchema);
    const routerJson = JSON.stringify(router?.providerSchema.jsonSchema);
    const verifierJson = JSON.stringify(verifier?.providerSchema.jsonSchema);

    expect(router).not.toBeNull();
    expect(verifier).not.toBeNull();
    expect(router?.providerSchema.jsonSchema).not.toHaveProperty('$schema');
    expect(routerJson).toContain('"minimum":0');
    expect(routerJson).toContain('"maximum":1');
    expect(verifierJson).not.toContain('"$schema"');
    expect(verifierJson).not.toContain('"const"');
    expect(verifierJson).not.toContain('"items":[');
    expect(verifierJson).not.toContain('"minItems"');
    expect(verifierJson).not.toContain('"maxItems"');
    expect(verifierJson).toContain('"enum":["consistent_support"]');
    expect(verifierJson).toContain('"anyOf"');
    expect(JSON.stringify(zodSchema(verifierSchema).jsonSchema)).toBe(
      originalVerifierJson,
    );
  });

  it('keeps canonical Zod validation authoritative after projection', async () => {
    const registry = compileDeepSeekStrictToolSchemaProfiles([
      {
        name: 'knowledge_verifier_candidate_v1',
        schema: verifierSchema,
      },
    ]);
    const validate = registry.resolve(verifierSchema)?.providerSchema.validate;

    expect(validate).toBeFunction();
    expect(
      await validate?.({
        status: 'conflict',
        evidenceCodes: ['numeric_conflict', 'numeric_conflict'],
      }),
    ).toMatchObject({ success: false });
    expect(
      await validate?.({
        status: 'trusted',
        evidenceCodes: ['consistent_support'],
      }),
    ).toEqual({
      success: true,
      value: {
        status: 'trusted',
        evidenceCodes: ['consistent_support'],
      },
    });
    expect(
      await validate?.({
        status: 'trusted',
        evidenceCodes: ['numeric_conflict'],
      }),
    ).toMatchObject({ success: false });
    expect(
      await validate?.({
        status: 'trusted',
        evidenceCodes: ['consistent_support'],
        extra: true,
      }),
    ).toMatchObject({ success: false });
    expect(
      await validate?.({
        status: 'unknown',
        evidenceCodes: ['consistent_support'],
      }),
    ).toMatchObject({ success: false });
  });

  it('returns immutable compiled profiles and resolves only canonical identities', () => {
    const registry = compileDeepSeekStrictToolSchemaProfiles([
      { name: 'router_candidate_v1', schema: routerSchema },
    ]);
    const compiled = registry.resolve(routerSchema);
    const structurallyEqualSchema = z
      .object({
        route: z.enum(['chat', 'tutor']),
        confidence: z.number().min(0).max(1),
        reasonCode: z.enum([
          'ambiguous_intent_resolved',
          'insufficient_context',
        ]),
      })
      .strict();

    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(compiled)).toBe(true);
    expect(Object.isFrozen(compiled?.providerSchema)).toBe(true);
    expect(isDeepFrozen(compiled?.providerSchema.jsonSchema)).toBe(true);
    expect(registry.resolve(structurallyEqualSchema)).toBeNull();
  });

  it.each([
    {
      name: 'empty registry',
      profiles: [],
    },
    {
      name: 'unsafe profile name',
      profiles: [{ name: 'Bad-Name', schema: routerSchema }],
    },
    {
      name: 'duplicate name',
      profiles: [
        { name: 'same', schema: routerSchema },
        { name: 'same', schema: verifierSchema },
      ],
    },
    {
      name: 'duplicate schema identity',
      profiles: [
        { name: 'one', schema: routerSchema },
        { name: 'two', schema: routerSchema },
      ],
    },
    {
      name: 'too many profiles',
      profiles: Array.from({ length: 17 }, (_, index) => ({
        name: `schema_${index}`,
        schema: z.object({ value: z.literal(index) }).strict(),
      })),
    },
  ])('rejects malformed registry: $name', ({ profiles }) => {
    expect(() =>
      compileDeepSeekStrictToolSchemaProfiles(profiles),
    ).toThrow(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  });

  it.each([
    {
      name: 'optional object property',
      schema: z.object({ value: z.string().optional() }).strict(),
    },
    {
      name: 'passthrough object',
      schema: z.object({ value: z.string() }).passthrough(),
    },
    {
      name: 'multi-item tuple',
      schema: z.tuple([z.string(), z.number()]),
    },
    {
      name: 'unsupported string constraint',
      schema: z.object({ value: z.string().min(1) }).strict(),
    },
    {
      name: 'unconstrained any schema',
      schema: z.any(),
    },
  ])('rejects unsupported Provider schema shape: $name', ({ schema }) => {
    expect(() =>
      compileDeepSeekStrictToolSchemaProfiles([
        { name: 'unsupported_schema', schema },
      ]),
    ).toThrow(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  });

  it('contains hostile profile access behind one fixed error', () => {
    const canary = 'RAW_SCHEMA_PROFILE_CANARY';
    const hostile = Object.defineProperty({}, 'name', {
      get() {
        throw new Error(canary);
      },
    });

    let error: unknown;
    try {
      compileDeepSeekStrictToolSchemaProfiles([hostile] as never);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED,
    );
    expect(JSON.stringify(error)).not.toContain(canary);
    expect((error as Error).stack).not.toContain(canary);
  });

  it('contains hostile proxy traps behind one fixed error', () => {
    const canary = 'RAW_SCHEMA_PROXY_CANARY';
    const hostile = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error(canary);
        },
      },
    );

    expect(() =>
      compileDeepSeekStrictToolSchemaProfiles([hostile] as never),
    ).toThrow(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
    try {
      compileDeepSeekStrictToolSchemaProfiles([hostile] as never);
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(canary);
      expect((error as Error).stack).not.toContain(canary);
    }
  });
});

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(isDeepFrozen);
}
