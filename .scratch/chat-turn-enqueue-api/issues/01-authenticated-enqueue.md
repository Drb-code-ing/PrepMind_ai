# 01: Authenticated ChatTurn enqueue endpoint

**What to build:** An authenticated client can submit bounded turn facts to `POST /chat-turns` and receive a `202 Accepted` safe projection of the queued ChatTurn and BackgroundJob. Retries with the same owner and request facts are idempotent; conflicts and foreign-owner ids fail closed.

**Blocked by:** None (can start immediately).

**Status:** implemented

- [x] Add strict shared request and response schemas for the endpoint.
- [x] Add the JWT-protected controller route and safe response mapping without exposing Outbox payload or message content.
- [x] Cover valid, malformed, idempotent, conflict, owner-bound, and accepted-status behavior at the public seams.
- [x] Update Swagger and acceptance documentation; run focused tests, build, lint, formatting, and diff checks.

## Comments

- 2026-09-04: Created from the ChatTurn Enqueue API spec. Existing `ChatTurnEnqueueService` is the sole write boundary.
- 2026-09-04: Implemented the authenticated `POST /chat-turns` seam with strict shared Zod parsing, owner-bound delegation, safe
  `202` projection, and Swagger response/request contract. Controller + Swagger focused `13/13`, ChatTurn focused `52/52`, types `44/44`,
  server build and target ESLint/Prettier passed. Full server Jest remains `237 passed / 2 failed / 3 skipped` because of two pre-existing
  environment/tooling failures documented in `docs/acceptance/phase-6-chat-turn-enqueue-api.md`. No credentials, Provider, Docker or business
  data were touched.
