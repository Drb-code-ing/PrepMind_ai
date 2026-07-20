# Phase 6.9.5 V16 Closure and V17 Plan

Date: 2026-07-20

V16's unique branch command stopped at preflight with no V16 roots or runtime
resources, so it is non-retryable and not recovery-admissible. Its actual
default-off host was valid. The Node entry started with `cwd=apps/server`, but
the V10 evidence authority intentionally resolves from `process.cwd()`, so the
authority read failed safely before any product action.

V17 is an independent lineage. Its exact Node runner changes CWD to the
verified repository root before loading an allowlisted entry, while retaining
the existing path/bridge restrictions. It preserves V16 default-off,
receipt and recovery boundaries. After final Docker default-off confirmation,
run once:

```powershell
bun --filter @repo/server accept:review-planner:v17:product -- --confirm-v17-review-planner-product-acceptance --environment=branch
```

Only a `passed` branch result permits main replay, merge and push.
