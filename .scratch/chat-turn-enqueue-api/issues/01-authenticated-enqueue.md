# 01: Authenticated ChatTurn enqueue endpoint

**What to build:** An authenticated client can submit bounded turn facts to `POST /chat-turns` and receive a `202 Accepted` safe projection of the queued ChatTurn and BackgroundJob. Retries with the same owner and request facts are idempotent; conflicts and foreign-owner ids fail closed.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Add strict shared request and response schemas for the endpoint.
- [ ] Add the JWT-protected controller route and safe response mapping without exposing Outbox payload or message content.
- [ ] Cover valid, malformed, idempotent, conflict, owner-bound, and accepted-status behavior at the public seams.
- [ ] Update Swagger and acceptance documentation; run focused tests, build, lint, formatting, and diff checks.

## Comments

- 2026-09-04: Created from the ChatTurn Enqueue API spec. Existing `ChatTurnEnqueueService` is the sole write boundary.
