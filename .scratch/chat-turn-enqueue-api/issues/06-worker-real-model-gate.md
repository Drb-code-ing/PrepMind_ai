# 06: Real-model Chat Worker gate

**What to build:** The Chat Response Worker can use the approved real model only when global and component gates, allowlist, budget, timeout, and data-boundary checks pass; otherwise it remains on the explicit deterministic fallback.

**Blocked by:** 05 — ChatRunBudget and Trace reconciliation.

**Status:** ready-for-agent

- [ ] Add an independent Worker model runtime and usage/cost projection.
- [ ] Keep default mock/off and fail closed on missing or invalid authorization.
- [ ] Run one separately authorized controlled-Live/product smoke with a visible browser where applicable.
- [ ] Publish sanitized evidence and update the Agent audit matrix.
