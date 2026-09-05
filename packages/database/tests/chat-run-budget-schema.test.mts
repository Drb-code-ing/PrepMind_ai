import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../prisma/migrations/20260905100000_chat_run_budget/migration.sql', import.meta.url),
  'utf8',
);

function prismaBlock(source: string, kind: 'enum' | 'model', name: string) {
  const match = source.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?^\\}`, 'm'));
  assert.ok(match, `missing Prisma ${kind} ${name}`);
  return match[0];
}

test('defines owner-bound budget schema and lifecycle migration', () => {
  const budget = prismaBlock(schema, 'model', 'ChatRunBudget');
  const reservation = prismaBlock(schema, 'model', 'ChatRunBudgetReservation');
  const event = prismaBlock(schema, 'model', 'ChatRunBudgetEvent');

  assert.match(budget, /@@unique\(\[turnId, userId\]\)/);
  assert.match(
    budget,
    /turn\s+ChatTurn\s+@relation\(fields: \[turnId, userId\], references: \[id, userId\], onDelete: Cascade\)/,
  );
  assert.match(reservation, /status\s+ChatRunBudgetReservationStatus\s+@default\(RESERVED\)/);
  assert.match(
    reservation,
    /ledger\s+ChatRunBudget\s+@relation\(fields: \[ledgerId, userId\], references: \[id, userId\], onDelete: Cascade\)/,
  );
  assert.match(event, /reservationId\s+String\?/);
  assert.match(
    event,
    /reservation\s+ChatRunBudgetReservation\?\s+@relation\(fields: \[reservationId, userId\], references: \[id, userId\], onDelete: Cascade\)/,
  );

  assert.match(migration, /CREATE TYPE "ChatRunBudgetStage" AS ENUM/);
  assert.match(migration, /ChatRunBudget_non_negative_check/);
  assert.match(migration, /ChatRunBudgetReservation_lifecycle_check/);
  assert.match(migration, /ChatRunBudgetEvent_contract_check/);
  assert.match(
    migration,
    /FOREIGN KEY \("turnId", "userId"\) REFERENCES "ChatTurn"\("id", "userId"\) ON DELETE CASCADE/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("ledgerId", "userId"\) REFERENCES "ChatRunBudget"\("id", "userId"\) ON DELETE CASCADE/,
  );
});

test('budget migration remains readable with CRLF input', () => {
  assert.match(migration.replace(/\r?\n/g, '\r\n'), /ChatRunBudgetReservation_lifecycle_check/);
});
