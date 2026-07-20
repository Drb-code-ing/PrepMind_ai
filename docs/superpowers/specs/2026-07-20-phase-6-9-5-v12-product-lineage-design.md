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
- The public failure terminal, private attempt binding, latest recovery
  checkpoint and execution manifest must all agree on the same attempt. A
  `recovered` terminal is written exactly once only after default-off restore
  and exact cleanup succeed; it blocks all subsequent recovery or product
  execution in this lineage.
- The execution manifest persists only a SHA-256 fingerprint of `DATABASE_URL`,
  never the URL. The fingerprint is captured before constructing the reusable
  V8 host, so it identifies the same Prisma/Docker configuration that can
  create fixtures. Product execution revalidates it after taking the owner lock
  and before reservation/resources; recovery checks it again before any restore
  or database write.

## Architecture

V12 owns new public, recovery, execution and browser namespaces plus a new
confirmation. It has independent profile, diagnostics, ledger, owner/recovery,
execution adapter, CLI and thin composition modules. The established V8 runner
may execute its four deterministic slots only through a V12 adapter and V12
diagnostics port. No V12 module writes V11 paths.

The recovery reader admits only a coherent state: public reservation/manifest,
private attempt binding/execution manifest, failure attempt hash and latest
checkpoint must agree. Failure-plus-success, failure-plus-recovery mismatch,
unknown leaves, malformed records and a changed database fingerprint are all
fail-closed. Recovery obtains its own owner lock, rereads this state under that
lock, restores mock/default-off, performs exact synthetic cleanup, then writes
the attempt-bound `recovered` terminal atomically. This carries forward the
V11 recovery correction without changing V11 history.

The default V12 composition is a real host composition, not a fake facade.
Read-only preflight occurs before reservation; after acquiring the product
owner it repeats the repository, paired-evidence, default-off and database
fingerprint checks to close the preflight-to-live TOCTOU window. After
reservation it persists a
private execution manifest with non-secret synthetic resource selectors, opens
the V12 journal, creates the two synthetic accounts and fixtures, then reuses
the lineage-neutral V8 Docker/API/browser/Trace/default-off/cleanup mechanics.
`review_api_setup / not_started` makes a setup failure recoverable without
claiming that a provider request began. The private selectors let recovery
restore mock/default-off and delete only the matching V12 resources. If an
activation fails after the Docker server has changed but before its live
container ID is recorded, restore uses the observed current container as its
source and still recreates default-off. Headed browser evidence remains visible
for at least 30 seconds before its exact-profile cleanup begins.

## Acceptance

Before runtime: V12 Mock/fake tests, V11 byte/root immutability regression,
native durable tests, server build/lint, Agent/AI/Web static gates and Compose
config must pass. The one branch command may run only after those gates.

On branch success: verify four unique traces, strict slot results, bounded
usage/cost, owner isolation, immutable facts, headed browser evidence,
default-off restoration and exact synthetic cleanup. Only then perform the one
main replay, merge and push. Any V12 recovery terminal stops this lineage; no
product retry is permitted.
