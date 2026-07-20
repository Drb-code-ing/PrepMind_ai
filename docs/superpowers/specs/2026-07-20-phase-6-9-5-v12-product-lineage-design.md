# Phase 6.9.5 V12 Product-Acceptance Design

## Goal

Finish ReviewAgent / PlannerAgent production acceptance after V11 was safely
recovered before its first provider request. V12 is a new, one-shot product
lineage; it does not reinterpret or reset V11.

## Boundaries

- V11 evidence, confirmation literals, roots, browser profile and once marker
  are immutable. V12 never imports a V11 reserve/open/read API.
- V12 retains the existing model boundary: only Review/Planner candidate output
  is model-generated; facts, FSRS, links, permissions and all writes remain
  local and authoritative.
- The normal server remains mock/default-off. Only the V12 runner can activate
  one component at a time, with a bounded product capability, then restore and
  clean it.
- A safe V12 failure records only component, slot, fixed checkpoint and
  `not_started | indeterminate`; it never stores prompt, response, raw error,
  key, URL, user fact or per-request usage.

## Architecture

V12 owns new public, recovery, execution and browser namespaces plus a new
confirmation. It has independent profile, diagnostics, ledger, owner/recovery,
execution adapter, CLI and thin composition modules. The established V8 runner
may execute its four deterministic slots only through a V12 adapter and V12
diagnostics port. No V12 module writes V11 paths.

The recovery reader admits an earliest failure only when public reservation and
manifest, private attempt binding and private execution manifest all match and
the checkpoint is genuinely absent. Malformed, unknown or mismatched state is
still fail-closed. This carries forward the V11 recovery correction without
changing V11 history.

## Acceptance

Before runtime: V12 Mock/fake tests, V11 byte/root immutability regression,
native durable tests, server build/lint, Agent/AI/Web static gates and Compose
config must pass. The one branch command may run only after those gates.

On branch success: verify four unique traces, strict slot results, bounded
usage/cost, owner isolation, immutable facts, headed browser evidence,
default-off restoration and exact synthetic cleanup. Only then perform the one
main replay, merge and push. Any V12 recovery terminal stops this lineage; no
product retry is permitted.
