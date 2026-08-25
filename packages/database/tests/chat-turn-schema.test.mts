import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL(
    '../prisma/migrations/20260825090000_chat_turn_state_machine/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

function prismaBlock(source: string, kind: 'enum' | 'model', name: string) {
  const match = source.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?^\\}`, 'm'));
  assert.ok(match, `missing Prisma ${kind} ${name}`);
  return match[0];
}

function normalized(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

test('defines owner-scoped ChatTurn lifecycle and migration constraints', () => {
  const status = prismaBlock(schema, 'enum', 'ChatTurnStatus');
  const errorCode = prismaBlock(schema, 'enum', 'ChatTurnErrorCode');
  const turn = prismaBlock(schema, 'model', 'ChatTurn');

  assert.match(status, /QUEUED\s+ACTIVE\s+SUCCEEDED\s+FAILED\s+CANCELLED/);
  assert.match(errorCode, /CANCELLED_BY_USER[\s\S]*INTERNAL_FAILURE/);
  assert.match(
    normalized(turn),
    /conversation Conversation @relation\(fields: \[conversationId, userId\], references: \[id, userId\], onDelete: Cascade\)/,
  );
  assert.match(
    normalized(turn),
    /responseMessage ChatMessage\? @relation\(fields: \[responseMessageId, userId\], references: \[id, userId\], onDelete: Restrict\)/,
  );
  assert.match(turn, /@@unique\(\[userId, clientRequestId\]\)/);
  assert.match(turn, /@@unique\(\[responseMessageId, userId\]\)/);
  assert.match(turn, /@@index\(\[userId, status, createdAt\]\)/);

  assert.match(migration, /CREATE TYPE "ChatTurnStatus" AS ENUM/);
  assert.match(migration, /CREATE TYPE "ChatTurnErrorCode" AS ENUM/);
  assert.match(migration, /"inputHash" ~ '\^sha256:\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /"status" = 'SUCCEEDED'[\s\S]*"responseMessageId" IS NOT NULL/);
  assert.match(migration, /"status" = 'FAILED'[\s\S]*"errorCode" IS NOT NULL/);
  assert.match(migration, /"status" = 'CANCELLED'[\s\S]*"finishedAt" IS NOT NULL/);
  assert.match(
    migration,
    /FOREIGN KEY \("conversationId", "userId"\) REFERENCES "Conversation"\("id", "userId"\) ON DELETE CASCADE/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("responseMessageId", "userId"\) REFERENCES "ChatMessage"\("id", "userId"\) ON DELETE RESTRICT/,
  );
});

test('schema contract remains valid when migration text uses CRLF', () => {
  assert.match(migration.replace(/\r?\n/g, '\r\n'), /ChatTurn_lifecycle_check/);
});
