# Phase 6.9.5 V13 Product-Acceptance Design

## Trigger and goal

V12 consumed its only branch product command on 2026-07-20. The API returned a
valid candidate observation and persisted exactly one trace, but the acceptance
adapter compared the candidate observation duration with the aggregate Trace
run duration. The aggregate includes deterministic Review/Planner steps, so
the strict comparison failed at `review_api_trace_canonicalize`. V12 then
completed its one permitted recovery and is immutable `recovered` history.

V13 is a new one-shot lineage for validating the already-authorized,
owner-scoped, read-only ReviewAgent and PlannerAgent model candidates. It must
not reinterpret, reset, retry, delete, or write to V12.

## Root-cause correction

`fetchTraceDetail()` now projects the duration of the single
`candidate_applied` trace step. It still validates the full Trace run's
provider/model/usage/steps, but correlates the API observation with the same
candidate-step metric. A regression uses the production DTO shape where the
candidate takes `123ms` while the complete orchestration takes `130ms`; the
adapter must return `123ms`.

## Isolation and authority

- V13 owns its own confirmation literals, schemas, public ledger, private
  recovery root, execution-manifest root, browser profile and owner lock.
- The V13 native durable-ledger test places immutable sentinels in both V11
  and V12 public/recovery roots and proves a full V13 terminal never changes
  their bytes.
- The normal Docker server remains `mock/default-off`; both business gates
  remain false except for the bounded V13 host activation window.
- Candidate output remains limited to local snapshot indexes/order. Facts,
  FSRS, duration calculations, links, permissions, writes, schemas, budget,
  timeout, Trace sanitization and cleanup stay locally authoritative.
- The reused V8 runner explicitly recognizes V13 only as a diagnostics
  profile and maps it to its existing neutral execution mechanics. V13's
  checkpoint whitelist is therefore enforced; an unrecognized profile fails
  before Docker, browser, API or provider work.

## Runtime protocol

1. Run static and Docker-image gates while all normal gates remain off.
2. Execute exactly one V13 branch product command. Failure seals V13; only its
   separately authorized, preflight-admitted recovery may run once.
3. A branch `passed` result requires four slots, candidate Trace correlation,
   visible headed-browser evidence, default-off receipts, owner isolation and
   exact synthetic cleanup.
4. Only a branch `passed` permits merge to `main`, one main replay, fresh
   main verification and remote push. A recovered or failed V13 terminal
   permanently ends V13.

## Evidence boundary

V12 failure/recovery evidence is retained under its V12 roots. V13 evidence,
if any, is recorded only under `phase-6-9-5-v13-product-acceptance`; this
design document is offline engineering evidence, not Docker/browser/provider
success evidence.
