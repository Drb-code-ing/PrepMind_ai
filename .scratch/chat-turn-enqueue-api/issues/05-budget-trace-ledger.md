# 05: ChatRunBudget and Trace reconciliation

**What to build:** A turn-backed run receives one owner-bound budget ledger across Router, Tutor, Retriever, Verifier, FinalResponse, and Worker stages, with reservations, bounded usage/cost facts, cancellation, and Trace reconciliation.

**Blocked by:** 03 — Turn-backed `/api/chat` bridge; 04 — Browser replay and disconnect recovery.

**Status:** contract and Prisma structure frozen; runtime implementation next

- [x] Define the ledger facts and cross-node reservation contract in `@repo/types`.
- [x] Add owner-bound Prisma ledger/reservation/event models, indexes, foreign keys, and lifecycle CHECK constraints.
- [ ] Enforce limits before each model-capable stage and record bounded usage.
- [ ] Reconcile terminal state, stream events, and Trace without making Trace authoritative.
- [ ] Add concurrency and crash/recovery tests.
