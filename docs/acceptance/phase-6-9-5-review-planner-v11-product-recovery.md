# Phase 6.9.5 V11 Product-Recovery Terminal

Date: 2026-07-20

## Result

V11 consumed its only branch product command and is permanently
`operation_failed / recovery-only`; it is not a Phase 6.9.5 success and must
never be reset, retried, or used for a main replay.

The strict public terminal records `review / api / review_api_activate` with
`providerCallState=not_started`. Therefore this V11 run did not reach a
provider request; it provides neither a quality result nor a cost claim.

## Recovery

The first recovery invocation stopped in preflight because the earliest valid
failure state has an attempt binding and execution manifest but no checkpoint.
Commit `cfd15b1` fixes only that recoverability gap: all three attempt-bound
artifacts must match, an actually absent checkpoint is admitted, and malformed
or unknown checkpoint state remains fail-closed. The second, effective
recovery command returned `recovered` and wrote the fixed initial checkpoint
plus strict failure projection.

Post-recovery inspection confirmed server health, `mock/default-off`, both
Review/Planner gates `false`, product capability `false`, and an empty server
DeepSeek key. Runtime evidence roots intentionally remain as immutable V11
recovery evidence; synthetic account/browser cleanup is recorded by the strict
terminal. No Docker volume, cache, database reset, or broad cleanup was used.

## Next Boundary

A future product attempt must use a new isolated lineage. It must not reuse
V11 evidence, confirmation, roots, browser profile, or once marker.
