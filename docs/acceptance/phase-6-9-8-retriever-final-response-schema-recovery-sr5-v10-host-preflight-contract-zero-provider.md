# Phase 6.9.8 SR5 v10 host-preflight contract

Date: 2026-08-14

Branch: `drb/phase-6-9-8-sr5-v10-host-preflight-contract`

Authority: `zero_provider_sr5_v10_host_preflight_contract`

Quality authority: `none`

## Purpose

The v9 entrypoint correctly failed closed because its Git Bash login host injected an unavailable loopback proxy, but the CLI exposed only `proxy_preflight_not_ready`. v10 creates a new immutable source/authorization/evidence boundary and retains the security stop while making the reason reviewable without leaking proxy values.

## Contract changes

- The approved tag becomes `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v10-approved`.
- Data-boundary acceptance and authorization strings are exact v10 receipts; v9 receipts are rejected.
- Marker, journal, report, temporary report, recovery claim, artifact, and dispatch lock use the isolated `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v10` namespace.
- CLI version is v2. It validates the complete shared preflight result with a strict schema before credential projection.
- A valid failure projects only `code`, `mode`, `configuredProxyVariables`, `listener`, `listenerProbeCalls`, and fixed `providerCalls=0`.
- A malformed or extra-field result emits only the generic fail-closed code and never reflects a URL, value, credential, or raw error.
- A ready result must be internally consistent: direct uses zero configured proxies/no listener probe; loopback uses at least one configured proxy, a listening listener, and exactly one probe.

Historical unversioned v2 and v9 durability files are excluded from the v10 current namespace without deletion or mutation. Any v10 leftover still blocks reservation. The runtime source manifest is `sha256:6723dc13e6abd7ca018169a73dfd6ef49a0073860051c3c2914515770818fb80`.

## Verification

- SR5 contract/source/Live/runtime/final-verifier focused: `128/128` (`282 expect()`), eight files;
- Agent full: `1658/1658` (`25478 expect()`, `203 files`);
- Agent typecheck and lint: exit `0`;
- owned source/tests Prettier and `git diff --check`: exit `0`.

Tests cover the bounded `loopback_proxy_unavailable` projection, malformed result non-reflection, ready loopback composition, accessor-backed environment snapshots, legacy v2/v9 namespace isolation, current v10 leftover rejection, source/run binding, tamper, crash-only recovery, and final Git verifier boundaries.

## Non-authority and next gates

This task does not read the root `.env` or credentials, call DeepSeek/Qwen, create formal evidence, write business data, or start/clear Docker, PostgreSQL, Redis, MinIO, API, browser, Trace, BackgroundJob, or Outbox. It does not create a tag and does not authorize Live or SR6 product acceptance.

Next, commit and push the feature, merge it to latest `main` with `--no-ff`, push `main`, and repeat zero-provider verification. A separate Git operation may then create/push the v10 annotated tag and run the final read-only Git verifier. Fresh V10 data-boundary acceptance and exact authorization may only be requested after all those gates pass.

## Merged-main parity

Feature commit `8c5a2e60` was pushed and merged with `--no-ff`; `main == origin/main == 95ea523abaa27b56cb2942ce50eb515eaff20c52`. On merged `main`, the eight-suite focused run passed `128/128` (`282 expect()`), Agent full passed `1658/1658` (`25478 expect()`, `203 files`), and typecheck/lint passed. Profile-free Git Bash returned `direct_ready`, `configuredProxyVariables=0`, `listenerProbeCalls=0`, and `providerCalls=0`; the current v10 evidence namespace remained empty.

No tag or authorization was created by this parity step. The next operation is only the immutable v10 annotated tag, remote parity inspection, and final read-only Git verifier.

Those Git gates subsequently passed and the unique controlled-Live was executed. Its sealed result is recorded in `phase-6-9-8-retriever-final-response-schema-recovery-sr5-v10-controlled-live-quality-failure-sealed.md`; this zero-provider document retains its original non-Live authority.
