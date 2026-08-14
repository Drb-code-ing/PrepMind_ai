# Phase 6.9.8 SR5 v9 proxy-preflight zero-provider diagnosis

Date: 2026-08-14

Branch: `drb/phase-6-9-8-sr5-v9-proxy-preflight-diagnosis`

Authority: `zero_provider_sr5_v9_proxy_preflight_diagnosis`

Quality authority: `none`

## Question

The v9 controlled-Live entrypoint stopped at `proxy_preflight_not_ready` before credentials or reservation. This task determines whether the failure came from the production port composition, shared proxy parser, listener state, or the host process environment. It does not rerun Live and does not call a Provider.

## Structural evidence

CodeGraph traced the production path as:

```text
SR5 live CLI
  -> PRODUCTION_PORTS.runProxyPreflight
  -> snapshot eight allowlisted proxy variables
  -> runPhase697ArchitectureRecoveryProxyPreflight
  -> optional single loopback listener probe
  -> SR5 parseProxy / fixed failure code
```

The production wrapper supplies the real preflight override; the core fail-closed stub is not selected. The shared preflight only accepts either no configured proxy (`direct_ready`) or one canonical loopback proxy whose listener responds (`loopback_proxy_ready`). It never reads `.env`, credentials, prompts, or business data and has no Provider/fetch port.

## Reproduction matrix

| Host process                  | Proxy variables | Result                       | Listener probes | Provider calls |
| ----------------------------- | --------------: | ---------------------------- | --------------: | -------------: |
| PowerShell                    |               0 | `direct_ready`               |               0 |              0 |
| Git Bash `--noprofile --norc` |               0 | `direct_ready`               |               0 |              0 |
| Git Bash login shell          |               4 | `loopback_proxy_unavailable` |               1 |              0 |

The login shell contained `HTTPS_PROXY`, `https_proxy`, `HTTP_PROXY`, and `http_proxy`. Safe URL parsing showed all four used HTTP, loopback host `127.0.0.1`, port `7897`, and no embedded authentication. The local listener did not accept the bounded probe. No proxy value or credential was persisted in evidence.

## Root cause

The v9 command was launched through a Git Bash login shell. Its profile injected loopback proxy variables that were absent from the native PowerShell process and from profile-free Git Bash. Because the configured listener was unavailable, the shared preflight correctly failed closed. The SR5 CLI intentionally maps any non-ready bounded result to `proxy_preflight_not_ready`, which explains why the first terminal output did not expose the narrower `loopback_proxy_unavailable` code.

This is a host-launch environment mismatch, not a DeepSeek/Qwen, account, balance, model permission, schema, Retriever, FinalResponse, Docker, or product result. No production source defect was found in the shared preflight composition.

## Boundaries and next decision

This task read no root `.env` or credential, made no Provider request, created no formal evidence, and did not start, clear, or mutate Docker, PostgreSQL, Redis, MinIO, API, browser, Trace, BackgroundJob, Outbox, or business data. The v9 tag and all sealed historical evidence remain immutable.

Do not clear proxy state inside production code, weaken the listener check, or reuse the v9 authorization. A future controlled-Live requires a new source/lineage decision that binds the approved native/no-profile launch environment and carries a bounded preflight reason through the CLI before the usual merge, tag-parity, data-boundary, and fresh-authorization gates. SR6 product acceptance remains blocked.
