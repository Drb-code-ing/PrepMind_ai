# Phase 6.9.5 V13 Closure and V14 Plan

Date: 2026-07-20

## V13 terminal

The unique V13 branch command was started after all static/image/default-off
checks. Bun 1.3.14 then terminated with its own segmentation-fault report after
about 3.5 seconds. The only persisted V13 public artifact is the reservation
hash; the private root contains only the owner-lock leaf. There is no execution
manifest, checkpoint, failure record, synthetic account, trace, browser profile
or provider attempt.

The Docker server is healthy and `mock/default-off`: live calls and both model
gates are false, the DeepSeek environment field is empty, and the V13 browser
profile is absent. V13 has no recovery-admissible `operation_failed` terminal,
so recovery must not be invoked. Its reservation is retained as immutable
evidence and its product command must never be retried.

## V14 plan

V14 duplicates the isolated acceptance control plane under fresh roots and
proves that a complete V14 ledger leaves V11, V12 and V13 roots byte-identical.
The shared runner explicitly recognizes V14 and enforces its diagnostic
checkpoint sequence. The actual one-shot host process uses a same-directory
CommonJS bundle built by Bun and executed by Node, avoiding the observed Bun
process crash without changing the agent contract.

At this document revision V14 has not run Docker, browser, API, provider or a
product command; normal gates remain false. The next step is final static/image
verification followed by the one V14 branch execution described in the paired
design document.

## Review prompts

- Why is V13 not eligible for recovery even though it has a reservation?
- Why does the Node bundle remain in the same scripts directory?
- Which immutable sentinels demonstrate that the new lineage cannot rewrite
  prior failed or recovered evidence?
