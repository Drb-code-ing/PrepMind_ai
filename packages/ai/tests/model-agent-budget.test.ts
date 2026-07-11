import { describe, expect, it } from 'bun:test';

import { createModelAgentBudget, reserveModelAgentBudget } from '../src/model-agent-budget';

describe('model agent run budget', () => {
  it('reserves calls and cumulative tokens immutably', () => {
    const initial = createModelAgentBudget({
      maxCalls: 2,
      maxInputTokens: 1000,
      maxOutputTokens: 400,
    });
    const first = reserveModelAgentBudget(initial, {
      inputTokens: 300,
      outputTokens: 120,
    });

    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('expected reservation');
    expect(first.budget).toEqual({
      maxCalls: 2,
      usedCalls: 1,
      maxInputTokens: 1000,
      usedInputTokens: 300,
      maxOutputTokens: 400,
      usedOutputTokens: 120,
    });
    expect(initial.usedCalls).toBe(0);
    expect(initial.usedInputTokens).toBe(0);
    expect(initial.usedOutputTokens).toBe(0);
  });

  it.each([
    { maxCalls: 0, maxInputTokens: 1000, maxOutputTokens: 400 },
    { maxCalls: 2, maxInputTokens: Number.NaN, maxOutputTokens: 400 },
    { maxCalls: 2, maxInputTokens: 1000, maxOutputTokens: -1 },
    { maxCalls: 1.5, maxInputTokens: 1000, maxOutputTokens: 400 },
    { maxCalls: Number.MAX_VALUE, maxInputTokens: 1000, maxOutputTokens: 400 },
    { maxCalls: 2, maxInputTokens: Number.MAX_SAFE_INTEGER + 1, maxOutputTokens: 400 },
  ])('rejects invalid limits fail-closed', (limits) => {
    expect(() => createModelAgentBudget(limits)).toThrow('INVALID_MODEL_AGENT_BUDGET');
  });

  it('rejects call, input, and output exhaustion independently', () => {
    const initial = createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 100,
      maxOutputTokens: 50,
    });
    const first = reserveModelAgentBudget(initial, {
      inputTokens: 60,
      outputTokens: 30,
    });
    if (!first.ok) throw new Error(first.code);

    expect(
      reserveModelAgentBudget(first.budget, {
        inputTokens: 1,
        outputTokens: 1,
      }),
    ).toEqual({ ok: false, code: 'CALL_BUDGET_EXCEEDED' });
    expect(
      reserveModelAgentBudget(initial, {
        inputTokens: 101,
        outputTokens: 1,
      }),
    ).toEqual({ ok: false, code: 'INPUT_BUDGET_EXCEEDED' });
    expect(
      reserveModelAgentBudget(initial, {
        inputTokens: 1,
        outputTokens: 51,
      }),
    ).toEqual({ ok: false, code: 'OUTPUT_BUDGET_EXCEEDED' });
  });

  it.each([
    { inputTokens: Number.NaN, outputTokens: 10 },
    { inputTokens: Number.POSITIVE_INFINITY, outputTokens: 10 },
    { inputTokens: -1, outputTokens: 10 },
    { inputTokens: 1.5, outputTokens: 10 },
    { inputTokens: 10, outputTokens: -1 },
    { inputTokens: Number.MAX_VALUE, outputTokens: 10 },
  ])('rejects invalid reservations fail-closed', (reservation) => {
    const budget = createModelAgentBudget({
      maxCalls: 2,
      maxInputTokens: 100,
      maxOutputTokens: 50,
    });

    expect(reserveModelAgentBudget(budget, reservation)).toEqual({
      ok: false,
      code: 'INVALID_MODEL_AGENT_BUDGET',
    });
  });

  it('rejects unsafe accumulated values before arithmetic can stop progressing', () => {
    expect(
      reserveModelAgentBudget(
        {
          maxCalls: Number.MAX_VALUE,
          usedCalls: Number.MAX_VALUE,
          maxInputTokens: 100,
          usedInputTokens: 0,
          maxOutputTokens: 50,
          usedOutputTokens: 0,
        },
        { inputTokens: 1, outputTokens: 1 },
      ),
    ).toEqual({ ok: false, code: 'INVALID_MODEL_AGENT_BUDGET' });
  });

  it('rejects non-object budgets without throwing', () => {
    expect(
      reserveModelAgentBudget(null as unknown as Parameters<typeof reserveModelAgentBudget>[0], {
        inputTokens: 1,
        outputTokens: 1,
      }),
    ).toEqual({ ok: false, code: 'INVALID_MODEL_AGENT_BUDGET' });
  });
});
