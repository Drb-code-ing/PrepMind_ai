# ChatTurn Enqueue API

## Problem Statement

可靠入队的 `ChatTurnEnqueueService` 已经能够在一个 Serializable 事务中创建 `ChatTurn`、`BackgroundJob` 和
`chat.response.requested` Outbox，但没有经过认证的 HTTP 写入口。Web 端因此不能以稳定的 turn id 启动后台回答，也无法把
后续 replay/status 合同接到用户操作上。

## Solution

新增认证的 `POST /chat-turns`。调用者只提交已经持久化、属于自己的会话消息 id 以及幂等/预算事实；服务端从 JWT
取得 owner，调用现有 enqueue 写边界，并返回不含输入正文、prompt、凭据或 Outbox payload 的安全投影。重复的同 owner
请求返回同一组 turn/job 事实，不产生第二份工作。

## User Stories

1. As an authenticated student, I want to enqueue a response for my conversation, so that processing can continue after the HTTP request ends.
2. As an authenticated student, I want the response to include a stable turn id, so that I can poll status or replay events after disconnecting.
3. As an authenticated student, I want a repeated request with the same client request id and facts to be idempotent, so that retries do not create duplicate model work.
4. As an authenticated student, I want a changed request under the same client request id to be rejected, so that an old retry cannot overwrite a new request.
5. As an authenticated student, I want another user's conversation or message ids to be rejected, so that ids cannot be used to probe or access data.
6. As an operator, I want the HTTP layer to reuse the existing transaction boundary, so that request code cannot create a turn without its background job and Outbox pair.
7. As a maintainer, I want a strict shared Zod contract, so that clients and Swagger agree on bounded fields and error behavior.
8. As a maintainer, I want the response to expose only bounded status metadata, so that internal payloads and user content are not leaked.
9. As a maintainer, I want malformed or oversized requests to fail before database work, so that abuse does not consume queue or database capacity.
10. As a maintainer, I want the endpoint to return `202 Accepted`, so that acceptance is not confused with model completion.

## Implementation Decisions

- The public seam is the authenticated `POST /chat-turns` controller. It receives `AuthenticatedUser` from `JwtAuthGuard` and never accepts a `userId` from the body.
- The request contract contains only `conversationId`, `clientRequestId`, `inputHash`, `inputMessageIds`, and `budgetPolicyVersion`. All identifiers are trimmed and bounded; message ids are unique and bounded; `inputHash` is a lowercase SHA-256 digest.
- The controller delegates to the existing `ChatTurnEnqueueService.enqueue` without adding a second transaction or queue call.
- The response contract contains `kind`, a safe queued turn projection, and a safe queued background-job projection. It does not return the Prisma Outbox row, payload, input message content, hashes beyond the required correlation fields, or credentials.
- Both new and idempotent replay responses use HTTP `202 Accepted`; domain conflicts and owner/foreign-key failures continue through the existing error envelope.
- The endpoint is a write admission boundary only. It does not call a Provider, BullMQ, Redis, SSE, or the model worker synchronously.
- The existing `/chat-messages/sync` snapshot route remains unchanged in this ticket. A later ticket will provide the Web adapter and decide the compatibility window before `/api/chat` is migrated.

## Testing Decisions

- Test the controller's public behavior: JWT metadata, strict request parsing, owner binding, delegation, safe projection, and `202` semantics.
- Test the shared Zod contract with independent valid/invalid examples, including unknown fields, duplicate ids, bounds, and hash format.
- Reuse the existing `ChatTurnEnqueueService` contract tests for transaction atomicity, idempotency, owner isolation, and serialization retry; do not duplicate database internals in the controller tests.
- Extend Swagger regression to assert the new tag/operation/body and accepted response description.

## Out of Scope

- Migrating `/api/chat` or the browser to turn-backed/SSE.
- Writing or deleting `ChatMessage` snapshots in this endpoint.
- Implementing Redis replay, lease recovery, ChatRunBudget ledger, Trace reconciliation, or a real-model Worker.
- Reading `.env`, calling DeepSeek/Qwen, changing gates, or creating product controlled-Live evidence.

## Further Notes

The endpoint establishes the first HTTP seam for the already implemented durable enqueue contract. A successful `202` proves admission
facts only; clients must use the status/replay endpoints to observe execution and terminal state.
