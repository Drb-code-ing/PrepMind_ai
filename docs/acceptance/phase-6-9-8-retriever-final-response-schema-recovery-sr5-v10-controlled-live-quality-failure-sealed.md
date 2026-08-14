# Phase 6.9.8 SR5 v10 controlled-Live quality failure

Date: 2026-08-14

Branch: `drb/phase-6-9-8-sr5-v10-live-sealed-failure`

Run: `da94b83b-3638-4e23-aefc-9e3423bf4c77`

Authority: `controlled_live_retriever_final_response_schema_recovery_sr5`

Quality authority: `none`

## Admission

The single run used clean `main == origin/main == fb0e9534db020b169f0bd629b62648191c92961a`. Local and remote annotated tag `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v10-approved` had object ID `fd7e392134613604d786cb51fa82f7c7fc957746` and peeled to the same commit. The final read-only Git verifier returned `ok=true`; source manifest was `sha256:6723dc13e6abd7ca018169a73dfd6ef49a0073860051c3c2914515770818fb80`, source bundle was `sha256:295ee62e4b322a98fbfe5697237cb42fd033c421ac36960ff1161c2f6a4e92eb`, and the v10 evidence namespace was empty.

The user accepted the exact v10 DeepSeek/Qwen data boundary and authorized the single controlled-Live. The same PowerShell host returned `direct_ready`, zero configured proxy variables, zero listener probes, and zero Provider calls immediately before the run.

## Execution

The run read three dedicated credential aliases after admission. Execution was pair-serial with maximum concurrency `1`, no retry/resume/replay/backfill, no BackgroundJob/Outbox, and no business writes.

| Slot                            | Provider/model             | Disposition              | Wire      | Verified usage | Verified cost   |
| ------------------------------- | -------------------------- | ------------------------ | --------- | -------------- | --------------- |
| `rewrite_01` original retrieval | Qwen `text-embedding-v4`   | succeeded                | `1/1/1/1` | `123/0`        | `0.0000615 CNY` |
| `rewrite_01` candidate model    | DeepSeek `deepseek-v4-pro` | failed: `schema_invalid` | `1/1/0/0` | `null`         | `null`          |

The DeepSeek lane reached `dispatch_started` and terminalized after `1224.829ms` with the bounded failure reason `schema_invalid`. It produced no verified response or usage record. The evidence intentionally contains no prompt, Provider raw content, raw error, credential, or URL, so this result must not be sharpened into a more specific root cause. The first failure opened the quality breaker; all remaining `22` Provider slots were recorded as `not_started_quality_breaker`.

Aggregate execution counters are credential reads=`3`, transport invocations=`2`, external Provider calls=`2`, DeepSeek calls=`1`, Qwen calls=`1`, and business writes=`0`. The fixed denominator remains 8 guards, 6 rewrite pairs, 6 FinalResponse cases, and 24 expected Provider calls.

## Gate and durability

The terminal gate is `schema_recovery_sr5_branch_quality_gate_failed`, `passed=false`, `qualityAuthority=none`. Rewrite strict/recall/NDCG/uplift/critical/intent, FinalResponse strict/grounding/citation/notice, Provider denominator, and budget accounting did not pass; semantic and aggregate verified cost fields are `null`. One successful Qwen slot cannot be combined with historical or Mock results to claim semantic authority.

The run published a normal sealed bundle:

- journal records: `54`;
- final journal event: `evidence_published`;
- validator: `ok=true`;
- report logical SHA-256: `bbd3f59eda804f93a9ed45cb69eb5eb26dacba11a6fa86e618be38af1dec2db6`;
- physical artifact SHA-256: `c0714172871a33d823e06c168f2aa10bb1695d773132b46481df39ef648ace39`;
- recovery claim: none.

Because publication completed normally, do not run crash recovery or seal again. The marker, journal, report, and artifact are immutable.

## Stop boundary

The v10 authorization is consumed. Do not retry, resume, replay, backfill, delete or rewrite evidence, call curl, run one isolated case, or use the product API to append Provider evidence. Docker, PostgreSQL, Redis, MinIO, API, visible browser, Trace, BackgroundJob, Outbox, and business data were not started, cleared, or modified by this task. The result grants no SR6, product, `main` product, SLA, or blog authority.

The next atomic task is a new ordinary branch from latest `main` for a zero-provider postmortem of the DeepSeek candidate schema/adapter boundary and wire accounting. It may use frozen fixtures, source inspection, and existing sealed bounded fields, but it must not reconstruct or invent Provider raw content and must not call either Provider.
