# 04: Browser replay and disconnect recovery

**What to build:** The browser consumes bounded stream events, resumes from a cursor after disconnect, and falls back to the owner-bound status endpoint when Redis transport is unavailable or the cursor expires.

**Blocked by:** 03 — Turn-backed `/api/chat` bridge.

**Status:** ready-for-agent

- [ ] Add a typed replay client and reconnect state machine.
- [ ] Render queued/active/terminal states without treating `202` as completion.
- [ ] Cover cursor expiry, unavailable transport, duplicate terminal events, and identity changes.
- [ ] Run headed browser acceptance and retain sanitized evidence.
