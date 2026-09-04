# 02: Web ChatTurn enqueue adapter

**What to build:** The Web client can convert its authenticated, persisted conversation messages into the `POST /chat-turns` contract and validate the safe `202` response, while retaining the current snapshot sync path as an explicit compatibility fallback.

**Blocked by:** 01 — Authenticated ChatTurn enqueue endpoint.

**Status:** completed; feature branch pushed, merged into `main`, and verified again on merged `main`

- [x] Add a typed Web API adapter and strict safe-response validation, including HTTP `202` enforcement.
- [x] Derive a stable client request id and input hash without sending message content in the enqueue request.
- [x] Preserve owner/session switching, explicit snapshot-sync fallback, abort, and offline retry boundaries.
- [x] Add Web unit tests and document the compatibility behavior.

## Implementation receipt

- `buildChatTurnEnqueueRequest` canonicalizes owner-bound persisted messages, applies count/id/content/timestamp bounds, and computes Web Crypto SHA-256 identities. The returned request contains only `conversationId`, `clientRequestId`, `inputHash`, `inputMessageIds`, and `budgetPolicyVersion`.
- `prepareChatTurnSubmission` returns `snapshot-sync` while a server conversation is unavailable or messages are not yet confirmed persisted. It does not silently fall back after a failed enqueue.
- `createChatTurnApi(...).enqueue` reuses the shared strict request/response schemas and requires `202`. Network/408/425/429/5xx failures are retryable with the same stable request; abort, owner/session, schema, auth, and conflict failures are terminal.
- The existing `/api/chat` and `/chat-messages/sync` product behavior is unchanged. Product cutover belongs to ticket 03.
- Evidence: focused adapter/API client `9/9`, full Web `499/499`, full Web ESLint, Web production build/TypeScript, targeted Prettier, and `git diff --check` pass on the feature branch. Two independent read-only re-reviews report no blocker/P1/P2. No Provider, Docker, API server, browser, or business-data run was needed for this adapter-only ticket.
