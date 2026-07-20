# Phase 6.9.5 V20 Product-Acceptance Design

## Trigger

V19 isolated the Node host preflight and proved it ready, but its product
execute path still closed before owner with no roots. V19 cannot be rerun.

## V20 boundary

V20 owns an independent confirmation, profile, schemas, public/recovery/
execution/browser roots, owner, ledger, host, CLI, diagnostics and Bun
authority helper. It retains strict parsing, the single-separator wrapper
normalization, repository-root CWD, read-only V10 authority and every older
lineage sentinel.

## Execute-path preflight

V20 adds `preflightOnly` to the product execute function. The mode constructs
the exact default ports and runs ordinary product parsing and preflight, then
replaces only `acquireOwner` with an in-memory `owner_active` result. It cannot
reach reservation, journal, Docker, browser, API, provider or synthetic
resources. The preflight CLI reports `ready` only for this exact owner block.

## Promotion

V20 begins default-off. Product and recovery have not run. Only after the
read-only execute-path preflight returns ready and separate product authority
is confirmed may the one-shot V20 branch product command be run. Only branch
`passed` authorizes main replay, merge and push.
