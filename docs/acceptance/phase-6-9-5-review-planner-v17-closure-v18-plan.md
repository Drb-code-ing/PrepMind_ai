# Phase 6.9.5 Review / Planner V17 Closure and V18 Plan

Date: 2026-07-20

V17's single package command stopped before the effective confirmation parser.
`bun --filter` preserved the conventional leading `--`, while V17's strict
CLI correctly accepts exactly the confirmation and the environment arguments.
The runner forwarded the separator as a third argument, so the CLI returned
the fixed `default_off` result before preflight. No V17 owner, ledger, Docker
mutation, browser, API, provider, synthetic account, public root, recovery
root or execution root was created.

V17 remains an immutable, non-retryable and non-recoverable historical
lineage. A root-absent stop does not permit silently changing or rerunning an
already issued product command.

V18 is the independent replacement lineage. It has distinct confirmation,
schema identities, public/recovery/execution/browser roots, owner/ledger
namespace and Bun authority helper. Its Node wrapper removes at most one
leading separator immediately after the allowlisted entry name, then forwards
all remaining arguments unchanged to the same strict two-argument parser.
Unexpected arguments, a second separator, wrong entries and malformed values
continue to fail closed before composition.

V10 remains the sole semantic-quality authority. The V18 product and recovery
commands, Docker, browser, API and provider have not run. Both Review/Planner
gates remain `false`. Only a future explicitly authorized V18 branch command
that returns `passed` may proceed to main replay, merge and push.
