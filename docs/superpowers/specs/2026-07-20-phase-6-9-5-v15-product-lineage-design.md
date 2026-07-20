# Phase 6.9.5 V15 Product-Acceptance Design

## Trigger and immutable history

V14 consumed its unique branch command at the `default_off` preflight. It
created no owner, ledger, Docker mutation, browser, API, provider or synthetic
resource, and its public, recovery and execution roots remain absent. V14 is
therefore not retryable and has no recovery path.

The preflight comparison was correctly checking a normal Compose server that is
`mock/default-off`, but it incorrectly required the Chat model field to be
`deepseek-v4-pro`. Normal Compose Chat uses `deepseek-v4-flash` while every
Review/Planner live gate and credential is off. The repair accepts exactly
`deepseek-v4-flash` or `deepseek-v4-pro` for that one default-off field; every
other controlled field remains exact and a duplicate controlled Docker
environment key now fails closed.

## V15 boundary

V15 is a new isolated lineage. It has its own confirmation tokens, schemas,
public/recovery/execution roots, owner lock and browser profile. It uses the
same narrow Node TypeScript runner boundary as V14: two explicit V15 entry
names, the approved scripts/review-agent roots, and only the database and
diagnostics workspace bridges. V15 runtime code neither reads nor writes V11,
V12, V13 or V14 roots; native sentinels prove their bytes remain unchanged.

The reused V8 host mechanism emits its own strict default-off receipt. V15
first parses that V8 receipt, then writes a V15-schema projection with every
safe field preserved. The post-activation restore contract is code-defined as
`deepseek-v4-pro`, so the durable V15 model field is provenance, not a raw
environment claim. Ordinary preflight may accept Flash or Pro only while every
live control remains off.

The model remains read-only and bounded. Local code owns user facts, FSRS,
minutes, links, permission, schema validation, budget, timeout, Trace and all
writes. The candidate can only select supplied Review focus indexes or Planner
block order. Both product gates default to `false`.

## Reservation safety

The branch command makes one durable reservation before creating runtime
resources. If manifest or diagnostics setup fails in this pre-start window,
V15 may roll the reservation back only after proving there are no checkpoints,
slots, default-off receipt, failure/success record, synthetic resource or
non-V15 leaf, and that the attempt binding and optional static manifest agree.
Any validation or I/O failure keeps the lineage fail-closed as `failed`; it is
never projected as a reusable default-off result.

## Acceptance sequence

After fresh static checks, independent reviews and a Docker default-off
preflight, the already-authorized branch command may run exactly once. Failure
stops the lineage. Only a branch `passed` result permits main merge and a main
replay; only after that replay passes may main be pushed. Headed browser
evidence remains open for user inspection, while the post-run server must be
restored to mock/default-off and synthetic resources precisely cleaned.
