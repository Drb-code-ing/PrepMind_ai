# Phase 6.9.5 V18 Product-Acceptance Design

## Trigger

V17 stopped before valid confirmation parsing because Bun's package-script
separator was forwarded by the Node wrapper. The strict parser was correct and
no product resource was created, but the issued V17 command is historical and
must not be rerun.

## V18 boundary

V18 is an isolated product-acceptance lineage. It owns its confirmation,
schemas, ledger, recovery, execution, public-evidence and browser-profile
namespaces. It retains the V17 repository-root CWD check, exact allowlisted
entries/source roots, resolver restrictions, read-only Bun V10-authority
bridge, DeepSeek URL/model receipt checks, default-off validation, attempt
binding, recovery boundary and all V10/V11--V17 sentinels.

The sole behavioral change is in the V18 Node wrapper: after selecting an
allowlisted entry, it drops exactly one leading `--` from forwarded package
arguments. It does not normalize any other token or loosen the strict
confirmation/environment parser.

## Safety and promotion

V18 begins default-off. Offline checks must not create runtime roots or call
Docker, browser, API or provider. Any V18 product command is one-shot and only
an explicit branch `passed` result can authorize main replay, merge and push.
Failure remains terminal; recovery requires its separately defined preflight
and separate authorization.
