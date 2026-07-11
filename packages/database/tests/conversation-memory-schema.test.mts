import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL(
    '../prisma/migrations/20260711120000_conversation_memory/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

function prismaBlock(source: string, kind: 'enum' | 'model', name: string) {
  const match = source.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?^\\}`, 'm'));
  assert.ok(match, `missing Prisma ${kind} ${name}`);
  return match[0];
}

function sqlStatement(source: string, marker: string) {
  const markerPattern = marker
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  const match = new RegExp(markerPattern).exec(source);
  assert.ok(match, `missing SQL marker: ${marker}`);
  const start = match.index;
  const end = source.indexOf(';', start);
  assert.notEqual(end, -1, `unterminated SQL statement: ${marker}`);
  return source.slice(start, end + 1);
}

function normalized(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function validateConversationMemory(sourceSchema: string, sourceMigration: string) {
  const conversation = prismaBlock(sourceSchema, 'model', 'Conversation');
  const summary = prismaBlock(sourceSchema, 'model', 'ConversationSummary');
  const state = prismaBlock(sourceSchema, 'model', 'ConversationState');

  assert.match(conversation, /@@unique\(\[id, userId\]\)/);
  assert.match(
    normalized(summary),
    /conversation Conversation @relation\(fields: \[conversationId, userId\], references: \[id, userId\], onDelete: Cascade\)/,
  );
  assert.match(summary, /@@unique\(\[conversationId, userId\]\)/);
  assert.match(
    normalized(state),
    /conversation Conversation @relation\(fields: \[conversationId, userId\], references: \[id, userId\], onDelete: Cascade\)/,
  );
  assert.match(state, /@@unique\(\[conversationId, userId\]\)/);
  assert.match(summary, /sourceHash\s+String\s+@db\.VarChar\(71\)/);
  assert.match(state, /pendingActionProposal\s+Json\?/);
  assert.match(state, /lastToolNames\s+String\[\]\s+@default\(\[\]\)/);

  const summaryTable = normalized(
    sqlStatement(sourceMigration, 'CREATE TABLE "ConversationSummary"'),
  );
  assert.match(summaryTable, /"conversationId" TEXT NOT NULL/);
  assert.match(summaryTable, /"userId" TEXT NOT NULL/);
  assert.match(summaryTable, /"summary" TEXT NOT NULL/);
  assert.match(summaryTable, /"sourceHash" VARCHAR\(71\) NOT NULL/);
  assert.match(summaryTable, /"modelProvider" VARCHAR\(80\) NOT NULL/);
  assert.match(summaryTable, /"modelName" VARCHAR\(120\) NOT NULL/);
  assert.match(summaryTable, /"promptVersion" VARCHAR\(80\) NOT NULL/);

  const stateTable = normalized(sqlStatement(sourceMigration, 'CREATE TABLE "ConversationState"'));
  assert.match(stateTable, /"conversationId" TEXT NOT NULL/);
  assert.match(stateTable, /"userId" TEXT NOT NULL/);
  assert.match(stateTable, /"activeGoal" VARCHAR\(300\)/);
  assert.match(stateTable, /"activeQuestionId" VARCHAR\(100\)/);
  assert.match(stateTable, /"pendingActionProposal" JSONB/);
  assert.match(stateTable, /"lastToolNames" TEXT\[\] DEFAULT ARRAY\[\]::TEXT\[\]/);

  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'CREATE UNIQUE INDEX "Conversation_id_userId_key"',
      ),
    ),
    'CREATE UNIQUE INDEX "Conversation_id_userId_key" ON "Conversation"("id", "userId");',
  );

  const summaryCheck = normalized(
    sqlStatement(
      sourceMigration,
      'ALTER TABLE "ConversationSummary"\n  ADD CONSTRAINT "ConversationSummary_watermark_check"',
    ),
  );
  assert.match(summaryCheck, /"coveredThroughOrder" >= 0/);
  assert.match(summaryCheck, /"sourceMessageCount" BETWEEN 1 AND 1000000/);
  assert.match(summaryCheck, /"summaryVersion" > 0/);
  assert.match(summaryCheck, /"inputTokenCount" BETWEEN 0 AND 12000/);
  assert.match(summaryCheck, /"outputTokenCount" BETWEEN 0 AND 12000/);
  assert.match(summaryCheck, /"sourceHash" ~ '\^sha256:\[0-9a-f\]\{64\}\$'/);
  assert.match(summaryCheck, /char_length\("summary"\) BETWEEN 1 AND 4000/);

  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'ALTER TABLE "ConversationState"\n  ADD CONSTRAINT "ConversationState_version_check"',
      ),
    ),
    'ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_version_check" CHECK ("stateVersion" BETWEEN 1 AND 2147483647), ADD CONSTRAINT "ConversationState_expiry_check" CHECK ("expiresAt" > "updatedAt");',
  );

  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_conversationId_userId_fkey"',
      ),
    ),
    'ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "Conversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;',
  );
  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_conversationId_userId_fkey"',
      ),
    ),
    'ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "Conversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;',
  );

  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'CREATE INDEX "ConversationSummary_userId_conversationId_idx"',
      ),
    ),
    'CREATE INDEX "ConversationSummary_userId_conversationId_idx" ON "ConversationSummary"("userId", "conversationId");',
  );
  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'CREATE UNIQUE INDEX "ConversationSummary_conversationId_userId_key"',
      ),
    ),
    'CREATE UNIQUE INDEX "ConversationSummary_conversationId_userId_key" ON "ConversationSummary"("conversationId", "userId");',
  );
  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'CREATE UNIQUE INDEX "ConversationSummary_conversationId_key"',
      ),
    ),
    'CREATE UNIQUE INDEX "ConversationSummary_conversationId_key" ON "ConversationSummary"("conversationId");',
  );
  assert.equal(
    normalized(
      sqlStatement(sourceMigration, 'CREATE INDEX "ConversationState_userId_updatedAt_idx"'),
    ),
    'CREATE INDEX "ConversationState_userId_updatedAt_idx" ON "ConversationState"("userId", "updatedAt");',
  );
  assert.equal(
    normalized(
      sqlStatement(sourceMigration, 'CREATE INDEX "ConversationState_expiresAt_idx"'),
    ),
    'CREATE INDEX "ConversationState_expiresAt_idx" ON "ConversationState"("expiresAt");',
  );
  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'CREATE UNIQUE INDEX "ConversationState_conversationId_userId_key"',
      ),
    ),
    'CREATE UNIQUE INDEX "ConversationState_conversationId_userId_key" ON "ConversationState"("conversationId", "userId");',
  );
  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'CREATE UNIQUE INDEX "ConversationState_conversationId_key"',
      ),
    ),
    'CREATE UNIQUE INDEX "ConversationState_conversationId_key" ON "ConversationState"("conversationId");',
  );

  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_userId_fkey"',
      ),
    ),
    'ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
  );
  assert.equal(
    normalized(
      sqlStatement(
        sourceMigration,
        'ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_userId_fkey"',
      ),
    ),
    'ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
  );
}

test('defines tenant-owned conversation memory schema and exact SQL constraints', () => {
  assert.match(prismaBlock(schema, 'enum', 'ConversationSummaryMode'), /MOCK\s+LIVE/);
  validateConversationMemory(schema, migration);
});

test('schema validator accepts CRLF migration input', () => {
  validateConversationMemory(schema, migration.replace(/\r?\n/g, '\r\n'));
});

test('schema validator rejects removal of the parent composite unique', () => {
  const conversation = prismaBlock(schema, 'model', 'Conversation');
  const mutated = schema.replace(
    conversation,
    conversation.replace(/^\s*@@unique\(\[id, userId\]\)\r?$/m, ''),
  );
  assert.throws(() => validateConversationMemory(mutated, migration));
});

test('schema validator rejects removal of the parent composite unique index', () => {
  const statement = sqlStatement(
    migration,
    'CREATE UNIQUE INDEX "Conversation_id_userId_key"',
  );
  const mutated = migration.replace(statement, '');
  assert.throws(() => validateConversationMemory(schema, mutated));
});

test('schema validator rejects a vacuous summary CHECK', () => {
  const statement = sqlStatement(
    migration,
    'ALTER TABLE "ConversationSummary"\n  ADD CONSTRAINT "ConversationSummary_watermark_check"',
  );
  const mutated = migration.replace(
    statement,
    'ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_watermark_check" CHECK (TRUE);',
  );
  assert.throws(() => validateConversationMemory(schema, mutated));
});

test('schema validator rejects restrictive child deletion', () => {
  const mutated = migration.replace(
    'REFERENCES "Conversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;',
    'REFERENCES "Conversation"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;',
  );
  assert.throws(() => validateConversationMemory(schema, mutated));
});

test('schema validator rejects a broken composite conversation FK', () => {
  const mutated = migration.replace(
    'FOREIGN KEY ("conversationId", "userId") REFERENCES "Conversation"("id", "userId")',
    'FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")',
  );
  assert.throws(() => validateConversationMemory(schema, mutated));
});
