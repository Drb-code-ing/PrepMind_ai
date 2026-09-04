# 03: Turn-backed `/api/chat` bridge

**What to build:** The product chat submission path admits a ChatTurn before asynchronous processing, while preserving a bounded compatibility window for the existing synchronous route and avoiding duplicate message writes.

**Blocked by:** 01 — Authenticated ChatTurn enqueue endpoint; 02 — Web ChatTurn enqueue adapter.

**Status:** ready-for-agent

- [ ] Define the turn-backed request/response hand-off and feature gate.
- [ ] Ensure a single client request id spans retries and owner/session changes fail closed.
- [ ] Keep anonymous/mock behavior and explicit fallback semantics intact.
- [ ] Add server/Web integration coverage without calling a Provider.
