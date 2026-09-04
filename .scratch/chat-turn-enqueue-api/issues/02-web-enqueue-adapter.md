# 02: Web ChatTurn enqueue adapter

**What to build:** The Web client can convert its authenticated, persisted conversation messages into the `POST /chat-turns` contract and validate the safe `202` response, while retaining the current snapshot sync path as an explicit compatibility fallback.

**Blocked by:** 01 — Authenticated ChatTurn enqueue endpoint.

**Status:** ready-for-agent

- [ ] Add a typed Web API adapter and response validation.
- [ ] Derive a stable client request id and input hash without sending unbounded content in the enqueue request.
- [ ] Preserve owner/session switching and offline retry boundaries.
- [ ] Add Web unit tests and document the compatibility behavior.
