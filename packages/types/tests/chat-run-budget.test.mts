import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  chatRunBudgetLedgerEventSchema,
  chatRunBudgetLedgerSchema,
  chatRunBudgetPolicySchema,
  chatRunBudgetReservationRequestSchema,
  chatRunBudgetReservationSchema,
} from '../src/api/chat-run-budget.ts';

const policy = chatRunBudgetPolicySchema.parse({
  policyVersion: 'chat-v1',
  maxCalls: 5,
  maxInputTokens: 10_000,
  maxOutputTokens: 2_800,
  maxCostMicros: 100_000,
});

assert.equal(policy.maxCalls, 5);
assert.throws(() => chatRunBudgetPolicySchema.parse({ ...policy, maxCalls: 65 }));

const reservation = chatRunBudgetReservationRequestSchema.parse({
  ownerId: 'user_1',
  turnId: 'turn_1',
  ledgerId: 'budget_1',
  reservationId: 'reservation_1',
  stage: 'FINAL_RESPONSE',
  inputTokens: 2_500,
  outputTokens: 1_200,
  costMicros: 12_000,
});
assert.equal(reservation.stage, 'FINAL_RESPONSE');
assert.throws(() => chatRunBudgetReservationRequestSchema.parse({ ...reservation, unknown: true }));

const ledger = chatRunBudgetLedgerSchema.parse({
  id: 'budget_1',
  ownerId: 'user_1',
  turnId: 'turn_1',
  policy,
  usedCalls: 1,
  usedInputTokens: 300,
  usedOutputTokens: 120,
  usedCostMicros: 1_000,
  heldCalls: 1,
  heldInputTokens: 2_500,
  heldOutputTokens: 1_200,
  heldCostMicros: 12_000,
  cancelledAt: null,
  createdAt: '2026-09-05T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:01.000Z',
});
assert.equal(ledger.heldCalls, 1);

const event = chatRunBudgetLedgerEventSchema.parse({
  id: 'event_1',
  ownerId: 'user_1',
  turnId: 'turn_1',
  ledgerId: 'budget_1',
  reservationId: 'reservation_1',
  stage: 'FINAL_RESPONSE',
  type: 'RESERVED',
  usage: null,
  createdAt: '2026-09-05T00:00:00.000Z',
});
assert.equal(event.type, 'RESERVED');

test('budget facts reject unsafe numeric values and raw payloads', () => {
  for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(
      chatRunBudgetLedgerSchema.safeParse({ ...ledger, usedCostMicros: value }).success,
      false,
    );
  }
  for (const rawField of ['prompt', 'providerResponse', 'apiKey']) {
    assert.equal(
      chatRunBudgetLedgerEventSchema.safeParse({ ...event, [rawField]: 'raw' }).success,
      false,
    );
  }
  assert.equal(
    chatRunBudgetLedgerSchema.safeParse({
      ...ledger,
      usedCalls: policy.maxCalls,
      heldCalls: 1,
    }).success,
    false,
  );
});

test('reservation lifecycle cannot refund a dispatched attempt as unused', () => {
  const reserved = {
    id: 'reservation_1',
    ownerId: 'user_1',
    turnId: 'turn_1',
    ledgerId: 'budget_1',
    stage: 'FINAL_RESPONSE',
    status: 'RESERVED',
    inputTokens: 2_500,
    outputTokens: 1_200,
    costMicros: 12_000,
    usageInputTokens: 0,
    usageOutputTokens: 0,
    usageCostMicros: 0,
    createdAt: '2026-09-05T00:00:00.000Z',
    dispatchedAt: null,
    settledAt: null,
    releasedAt: null,
  };
  assert.equal(chatRunBudgetReservationSchema.safeParse(reserved).success, true);
  assert.equal(
    chatRunBudgetReservationSchema.safeParse({
      ...reserved,
      status: 'RELEASED',
      dispatchedAt: '2026-09-05T00:00:01.000Z',
      releasedAt: '2026-09-05T00:00:02.000Z',
    }).success,
    false,
  );
  assert.equal(
    chatRunBudgetReservationSchema.safeParse({ ...reserved, status: 'SETTLED' }).success,
    false,
  );
  assert.equal(
    chatRunBudgetReservationSchema.safeParse({
      ...reserved,
      status: 'RELEASED',
      settledAt: '2026-09-05T00:00:02.000Z',
      releasedAt: '2026-09-05T00:00:03.000Z',
    }).success,
    false,
  );
  const settled = {
    ...reserved,
    status: 'SETTLED',
    dispatchedAt: '2026-09-05T00:00:01.000Z',
    settledAt: '2026-09-05T00:00:02.000Z',
    usageInputTokens: 2_400,
    usageOutputTokens: 1_100,
    usageCostMicros: 11_000,
  };
  assert.equal(chatRunBudgetReservationSchema.safeParse(settled).success, true);
  assert.equal(
    chatRunBudgetReservationSchema.safeParse({ ...settled, settledAt: '2026-09-05T00:00:00.500Z' })
      .success,
    false,
  );
  assert.equal(
    chatRunBudgetReservationSchema.safeParse({ ...settled, usageCostMicros: 12_001 }).success,
    false,
  );
});

test('events distinguish usage settlement from reservation and run cancellation', () => {
  assert.equal(
    chatRunBudgetLedgerEventSchema.safeParse({ ...event, type: 'SETTLED' }).success,
    false,
  );
  assert.equal(
    chatRunBudgetLedgerEventSchema.safeParse({ ...event, type: 'CANCELLED' }).success,
    false,
  );
  assert.equal(
    chatRunBudgetLedgerEventSchema.safeParse({
      ...event,
      type: 'CANCELLED',
      reservationId: null,
      stage: null,
    }).success,
    true,
  );
});
