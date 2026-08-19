# PrepMind AI — 仓库协作指南

## 2026-08-19 Phase 6.9.8 真实模型运行时状态

产品 `/api/chat` 已在 Docker 中实际使用 DeepSeek 返回 `200`，并记录 `mode=live`、`traceRecorded=true`。本地 Compose
允许组件专用 DeepSeek key 缺省时回退到根 `DEEPSEEK_API_KEY`，显式组件 key 仍优先；所有模型 gate 继续默认关闭。
实现以 `--no-ff` 合并并推送为 `main=b6df0150`，合并后 Live smoke 再次通过。随后 server/web 已恢复
`mock + live=false + all current Agent gates=false`，测试账号 `DELETE 1` 且残留为 0，Docker 数据未清理。
该结果证明产品运行时可用，不建立完整语义基准、billing、SLA 或新的 quality authority。记录见
`docs/acceptance/phase-6-9-8-real-model-runtime-usability.md`。

## 2026-08-19 SR6 状态

Phase 6.9.8 SR6 Docker/API/Trace/可见浏览器默认关闭功能验收已完成，且合并后 `main=d7a62094` 已复验。Docker 数据未清理；若长期卷缺少已提交迁移，使用
容器内 `bunx prisma migrate deploy --schema prisma/schema.prisma` 补齐，不得 reset。验收保持
`semantic=not_established`、`qualityAuthority=none`。记录见
`docs/acceptance/phase-6-9-8-sr6-docker-api-trace-visible-browser.md`。

## 当前状态：Phase 6.9.8 Retriever/FinalResponse partial closure（zero-provider，2026-08-18）

用户明确降低当前质量门后，本任务不再复制 V13 Provider runner，而是对 immutable V12 controlled-Live evidence 做只读、
追溯式 partial closure。独立 CLI 先后两次运行 V12 strict validator，中间固定校验 run
`49429392-857d-4635-80cc-0bca317cf9ff`、report logical SHA `86f4e84e...23654`、artifact physical SHA
`817bc897...9be81`、controlled-Live authority 与精确计数。V12 marker/journal/report/artifact/tag/authorization 全部保持只读。

闭环结果为 `partial_completion_closed / retriever_final_response_v12_retrospective_transport_completion_authority`：planned/
started/succeeded/response/usage/deferred/failed=`24/5/4/5/4/19/1`，guards=`8/8/0`。本次 closure 自身
Provider/credential/formal evidence/business/V12 mutation writes=`0/0/0/0/0`；`qualityAuthority=none`、semantic
`not_established`、完整 token/cost 为 `null`。它是基于历史 V12 的降级验收，不是新 Live，不形成 semantic、billing、产品、
SLA 或 SR6 authority。Phase 6.9.8 在该降低门槛下工程收口；下一任务为独立 SR6 Docker/API/Trace/可见浏览器功能验收。

实现：`packages/agent/src/evals/phase-6-9-8-retriever-final-response-partial-quality-closure.ts`；入口：
`bun run eval:phase-6-9-8:partial-quality:close`；验收：
`docs/acceptance/phase-6-9-8-retriever-final-response-partial-quality-closure-zero-provider.md`。focused gate+closure 为
`6/6`（`25 expect()`），V10/V11/V12 compatibility + partial 为 `38/38`（`410 expect()`），Agent full 为
`1699/1699`（`25988 expect()`，`210 files`）；typecheck/lint/Prettier/diff check 与 V12 sealed validator 均通过。

## 当前状态：Phase 6.9.8 Retriever/FinalResponse partial quality gate（zero-provider，2026-08-18）

为降低“首个真实 Provider 合同失败就无法继续判断”的阻塞，本任务新增独立
`phase-6.9.8-retriever-final-response-partial-quality-gate-v1` 投影。它只读取既有 V12
report，统计已启动、已成功、已观察 response、已验证 usage、失败和 quality-breaker 延后槽位，并以
`baseReportSha256` 绑定原报告；`rawDataRetained=false`。V12 report/schema/journal/artifact/tag 不变、不可重写。

partial gate 只有在 runtime、8/8 guard、8/8 zero-call、安全失败为 0、存在 bounded transport progress 且所有失败都有
bounded reason 时才满足算法条件；projector 自身始终保持 `authority=none`。生产追溯式 authority 只能由上述 closure 对 exact
V12 sealed artifact 完成前后双重验证后授予。它永远不会授予 semantic quality、billing、产品可用或 SLA
authority；`semantic.status=not_established`，budget 三项固定为 `null`。普通 reviewed Mock/zero-provider 输入只能得到
`partial_gate_failed / synthetic_authority`，手工 live-shaped 对象不构成生产 provenance。

实现：`packages/agent/src/evals/phase-6-9-8-retriever-final-response-partial-quality-gate.ts`；测试：
`packages/agent/tests/phase-6-9-8-retriever-final-response-partial-quality-gate.test.ts`；验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-partial-quality-gate-zero-provider.md`。

## 当前状态：Phase 6.9.8 SR5 V12 local-rejection postmortem（zero-provider，2026-08-17）

本任务从已推送 `main=93250de20660a6022808b134ea6b431adf8a5059` 新开普通分支
`drb/phase-6-9-8-sr5-v12-local-rejection-postmortem`，不使用 worktree。Task9 不再把 response-observed 后的全部
`baseInvalid` 压成一个不可区分的布尔值，而是按固定 first-failure priority 投影七类 bounded boundary：
`invocation_mismatch -> adapter_state_mismatch -> adapter_wire_mismatch -> provenance_mismatch -> attempted_mismatch ->
trace_mismatch -> candidate_not_applied`。原 `failureReason` 与 adapter diagnostic 保持兼容。

只有 `candidate_not_applied` 才可携带既有 `rewriteCandidateDiagnostic` sidecar；该 strict schema 只含 stage/reason enum、
shape bucket/fingerprint 与 `rawDataRetained=false`，不保存 query、Provider content、字段名或值。三条生产形状 synthetic
回归已分别证明 `rewrite_safety_invalid / rewrite_unchanged / protected_terms_drift` 能穿过 candidate、Task9 runner、hash-chain
journal、report、hard-link artifact 与 strict validator；raw sentinel 未落盘。成功、not-started、非 rewrite lane 及其他 boundary
均不能携带该 sidecar，历史 V12 无新字段的 evidence 仍可验证。

新增 focused `13/13`（`45 expect()`）；V10 DQ1/DQ2 + V11/V12 compatibility + postmortem 为 `36/36`
（`402 expect()`）；Agent full `1693/1693`（`25960 expect()`，`208 files`），typecheck/lint/Prettier/diff check 通过。
V12 sealed bundle 只读 validator 仍为 `ok=true / journal=67 / evidence_published`，report logical/physical SHA 保持
`86f4e84e...3654 / 817bc897...e81`。

本任务 Provider/credential/formal evidence/business writes=`0/0/0/0`，未读根 `.env`，未启动 Docker/API/browser，未写
Trace/BackgroundJob/Outbox，`qualityAuthority=none`。它只能改善未来失败的诊断精度，不能反推 V12 的具体失败项，也不形成
新模型质量、SR6、产品或 SLA authority。V12 run/tag/evidence/authorization 仍禁止重跑、恢复、移动或改写；下一真实质量门
必须另建 source lineage、annotated tag、数据边界与 exact authorization。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-local-rejection-postmortem-zero-provider.md`。

## 当前状态：Phase 6.9.8 SR5 V12 controlled-Live 已失败封存（2026-08-17）

唯一 V12 run `49429392-857d-4635-80cc-0bca317cf9ff` 已在 clean/tag-verified source
`550bc864b983992b77cd73157e5513515177dff4` 上正常 runtime seal。approved tag object=
`62d5d2d607b5827d679e4c4351603fd2bd2608ec`，source bundle=`sha256:d1ff73db...d381`；direct-host/source admission 与
`8/8` zero-call guards 通过。credential reads=`3`，external Provider calls=`5`（DeepSeek `2`、Qwen `3`），business
writes=`0`，未使用 BackgroundJob/Outbox。

`rewrite_01` 三槽全部成功；`rewrite_02` original Qwen retrieval 也成功。随后 DeepSeek candidate 已 dispatch 并收到 HTTP
response，但以 `runtime_contract_invalid / adapterFailureCategory=unknown / structuredOutputStage=null / wire=1/1/1/0`
终止，quality breaker 将其余 `19` 槽固定为 `not_started_quality_breaker`。该证据只能确认 response 已观察、Task9 typed result/
usage 尚未验证；现有 `baseInvalid` 还合并 candidate 未应用、provenance/attempted/trace、V7 state/counter 与 invocation mismatch。
若属于 candidate 未应用，其下又有完整字段安全扫描、rewrite unchanged 或 protected-terms drift。V12 sealed 投影未保留具体
bounded reason，因此不能从证据中选择其中一项，也不能归因 schema、网络、usage validation 或 Provider 原文。

终态为 `schema_recovery_sr5_branch_quality_gate_failed / qualityAuthority=none`，正式 aggregate usage/cost 与未完成质量指标均为
`null`。Validator=`ok=true`；journal=`67` 且以 `evidence_published` 收口；report logical SHA=
`86f4e84e...3654`，physical artifact SHA=`817bc897...e81`，recovery claim=`null`。本次唯一授权已消费，禁止
retry/resume/replay/backfill、再次 seal/recover、移动 tag、删除/改写 evidence、curl、单 case或产品 API 追加 Provider 探测。

本轮未启动 Docker/API/browser，未写 Trace/BackgroundJob/Outbox 或业务数据，不形成 SR6/product/SLA authority。下一任务只能
从最新 `main` 新开独立 zero-provider postmortem，先拆分 Task9 `baseInvalid`，再给 candidate-local rejection 增加有界诊断并
通过 synthetic/held-out 回归；不得
反推或补写 Provider 原文。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-controlled-live-quality-failure-sealed.md`。

## 当前状态：Phase 6.9.8 SR5 V12 direct-host recovery（zero-provider，已合并，2026-08-17）

V11 唯一入口因 Git Bash login profile 注入失效的 `127.0.0.1:7897` proxy 而在 Provider/credential/evidence 前停止；
V11 tag、授权和零证据终态保持不可复用。功能分支
`drb/phase-6-9-8-sr5-v12-direct-host-recovery` 已提交为 `4dec1299`，并以 `--no-ff` 合并为 `d763f32f`；文档 closeout
提交 `2351a221` 随后合并为 `bbe58918`。当前 `main == origin/main`，最终不可变 commit 由后续 V12 annotated tag 绑定。
功能分支从当时已推送 `main=4b7c663b` 建立独立 V12 source、tag、授权与 evidence
namespace，V10/V11 validator/runtime 文件均保持独立只读。

V12 production launcher 不再只让 preflight 看一份伪直连环境，而是先启动同一 CLI 的受控子进程：子进程环境保留系统变量和
V12 授权变量，但大小写不敏感地移除 `HTTP(S)_PROXY/ALL_PROXY/NO_PROXY`。因此共享 proxy preflight 与后续真实 Provider
transport 使用同一份 direct-host 环境，不修改父 shell 或 `process.env`，也不会出现“preflight 直连、fetch 仍走失效代理”的
分裂状态。子进程仍按 authorization -> source -> proxy -> credential -> reservation -> Provider 的既有顺序执行。

当前 focused V10/V11/V12 `19/19`（`340 expect()`），最终 V12 focused `9/9`（`70 expect()`）；Agent full
`1680/1680`（merged-main `25912 expect()`，`207 files`）、AI full `346/346`（`2667 expect()`，`28 files`），Agent/AI typecheck/lint
通过。Provider/credential/formal evidence/business writes=`0/0/0/0`，未读根 `.env`，未调用 DeepSeek/Qwen，未创建 V12
marker/journal/report/artifact，未启动或清理 Docker/API/browser，`qualityAuthority=none`。

功能提交、推送、`main` 合并推送及 merged-main parity 均已完成；merged-main focused/full/static 回归保持通过。当前仍未创建
V12 annotated tag、未接受 V12 数据边界、未取得 V12 exact authorization、未执行 controlled-Live。下一步只是在最终 clean/pushed
`main` 创建并验证独立 V12 tag，随后才能使用 fresh V12 两行授权执行唯一入口。SR6 Docker/API/Trace/可见浏览器产品验收继续阻断。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-direct-host-recovery-zero-provider.md`。

## 当前状态：Phase 6.9.8 SR5 V11 controlled-Live 在 proxy preflight 停止（2026-08-17）

`main == origin/main == c077d6546709c6af2e796ec861e8376355437466` 时创建并推送 annotated tag
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v11-approved`；tag object=`20e2abfcedd5cbb759694f59cce92cae4ef9fc80`，
peeled commit 与当时 `main` 相同。用户随后接受 V11 DeepSeek/Qwen 数据边界并授权唯一入口。

正式 CLI 在 authorization gate 后、source admission 与 credential projection 前被 production proxy preflight 阻断：Git Bash
环境包含 `http_proxy/https_proxy=http://127.0.0.1:7897`，但端口无监听，bounded 结果为
`loopback_proxy_unavailable / configuredProxyVariables=4 / listenerProbeCalls=1 / providerCalls=0`。终态
credential/provider/formal evidence/business writes=`0/0/0/0`；没有 marker、journal、report、artifact 或 runId，未读取根
`.env`，未调用 DeepSeek/Qwen，也未启动、停止或清理 Docker/API/browser。

同仓库随后在 FastCtx `login_shell=false` 的 no-profile host 中运行共享 zero-provider proxy diagnostic，得到
`direct_ready / configuredProxyVariables=0 / listenerProbeCalls=0 / providerCalls=0`。因此根因已确定为 login-shell profile
注入失效 loopback proxy，不是仓库、Provider 或 Docker。未来入口应固定使用受验收的 no-profile/direct host，不能在已启动
Live 命令内部临时清空 proxy 变量。

本次唯一授权入口已使用，禁止在同一授权下重跑、改为直连、replay/backfill、curl 或单 case Provider 探测。下一任务只能从
最新 `main` 新开普通分支，建立不复用 V11 tag/授权的新 source lineage，并把 no-profile/direct host 固化为前置验收，再取得
fresh 数据边界与 exact authorization。SR6 继续阻断；详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-diagnostic-recovery-zero-provider.md`。

## 当前状态：Phase 6.9.8 SR5 V11 diagnostic recovery（zero-provider，已完成，2026-08-17）

功能分支 `drb/phase-6-9-8-sr5-v11-recovery` 已从 `main=610598c4` 新开并以 `--no-ff` 合并为 `main=7cf12916`；
随后格式化与文档收口在 `drb/phase-6-9-8-sr5-v11-closeout` 完成。V11 将证据、source lineage、tag、授权确认与
V10 完全隔离；V10 sealed marker/journal/report/artifact 只读且不可复用。新增 DeepSeek direct adapter V2 兼容合同：
非思考模式仅允许 `reasoning_content: null`，非空推理内容仍 fail-closed；DQ1/DQ2 的五类 bounded diagnostic 已实际穿过
V11 runner 并写入 journal/report/artifact 回归。当前仍为 zero-provider：未读根 `.env`/credential，未调用 DeepSeek/Qwen，
未创建正式 Live evidence/business writes，未启动 Docker/API/browser，`qualityAuthority=none`。focused V11 bridge `8/8`
（`68 expect()`）和既有 SR5 live `28/28` 已通过；V10 原 validator/runtime identity 已恢复，V11 CLI 与 package subpaths 已隔离；
Agent full `1671/1671`（`25804 expect()`，`206 files`）、AI full `346/346`（`2667 expect()`，`28 files`）、
typecheck/lint 已通过；格式化修复后目标文件以 CRLF-aware Prettier 与 diff check 通过。功能提交 `1773625a` 已推送，merge
提交为 `7cf12916`；merged-main 全量回归已完成，Agent/AI 结果保持上述通过数。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-diagnostic-recovery-zero-provider.md`。

V11 只解锁后续独立 source/tag parity 与 fresh data-boundary/authorization 决策，不构成真实模型质量、产品、SR6 或 SLA
authority。下一步仍必须在最新 `main` 上另立 V11 annotated tag，重新接受 DeepSeek/Qwen 数据边界并获得唯一授权；在此之前
不得读取根 `.env` 或调用 Provider。不得 retry/replay/recover/seal V10 run `da94b83b-3638-4e23-aefc-9e3423bf4c77`，
不得删除或改写其证据。

## 当前状态：Phase 6.9.8 SR5 v10 diagnostic qualification DQ2（zero-provider，2026-08-17）

DQ2 在 DQ1 生产形状 seam 上新增 `27` 个独立 held-out Provider shape：object/envelope missing=`5`、content JSON
parse=`5`、rewrite type/schema=`6`、non-thinking response audit=`4`、usage validation=`7`。每例都实际穿过第一方 DeepSeek
direct adapter、ModelAgentRuntime、Retriever query-rewrite candidate、V7 diagnostic 与 Task9 RuntimeError；固定为一次 fetch、
wire=`1/1/0`，并确认 payload 中逐 case raw sentinel/`provider_secret` 不进入 Error 或 diagnostic。

DQ2 不改生产实现，只新增 zero-provider test matrix。authority=`zero_provider_sr5_v10_diagnostic_qualification_dq2`，gate=
`schema_adapter_diagnostic_robustness_not_evidence`，`qualityAuthority=none`。DQ2 focused `1/1`（`190 expect()`），DQ1+DQ2
`2/2`（`210 expect()`），Agent full `1663/1663`（`25706 expect()`，`205 files`），typecheck/lint/CRLF-aware
Prettier/diff check 通过。Provider/credential/formal evidence/business writes=`0/0/0/0`；未读取根 `.env`，未启动
Docker/API/browser，未修改 v10 sealed bundle。

DQ2 只证明新诊断在 held-out shape 上稳定，不反推 v10 根因，也不是 Live、模型质量、产品、SR6 或 SLA authority。本任务不
创建 tag、不接受授权、不执行 Live。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v10-diagnostic-qualification-dq2-zero-provider.md`。

功能提交 `9209a8e7` 已推送，并以 `--no-ff` 合并并推送为 `2c3bcd17`。合并后 DQ1+DQ2 `2/2`、Agent full
`1663/1663`、typecheck/lint、CRLF-aware Prettier 与 diff check 均通过。

## 当前状态：Phase 6.9.8 SR5 v10 diagnostic qualification DQ1（zero-provider，2026-08-17）

DQ1 将五类 synthetic Provider response 注入第一方 DeepSeek direct adapter，并实际穿过 `ModelAgentRuntime -> Retriever
query-rewrite candidate -> V7 diagnostic snapshot -> Task9 RuntimeError projection`。JSON parse、object missing、type
validation、response audit 与 usage validation 均保留各自 bounded category/stage；wire 固定为 dispatch/response/verified
usage=`1/1/0`，Provider payload 中的敏感哨兵不进入 error 或 diagnostic。生产 `createPhase698Task9LiveHarness` 仍使用不可注入的
真实 adapter，synthetic fetch 只暴露给 test-only qualification helper。

authority=`zero_provider_sr5_v10_diagnostic_qualification`，gate=
`schema_adapter_diagnostic_qualification_not_evidence`，`qualityAuthority=none`。DQ1 focused `39/39`，Agent full
`1662/1662`（`25516 expect()`，`204 files`），typecheck/lint/Prettier/diff check 通过。Provider/credential/formal
evidence/business writes=`0/0/0/0`；未读取根 `.env`，未启动 Docker/API/browser，未修改 v10 sealed bundle。

DQ1 不能反推 v10 的具体 Provider shape，也不是新的 Live、模型质量、SR6、产品或 SLA authority。本任务不创建 tag、不接受
授权、不执行 Live。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v10-diagnostic-qualification-dq1-zero-provider.md`。

功能提交 `243a4b97` 已推送，并以 `--no-ff` 合并并推送为 `dde5c24a`。合并后 DQ1 focused `39/39`、Agent
full `1662/1662`、typecheck/lint、CRLF-aware code Prettier 与 diff check 均通过。

## 当前状态：Phase 6.9.8 SR5 v10 schema/adapter postmortem（zero-provider，2026-08-14）

v10 sealed evidence 只能证明 DeepSeek candidate 的类型化调用以 `schema_invalid` 终止；旧 `runRewriteModel` 将
Provider JSON parse、object missing、type validation、response audit、usage 与本地合同失败压成同一 reason，Task9/SR5
又只在 `invokeCall` 成功返回后记 outer `response_received`。因此历史 wire=`1/1/0/0` 不能证明 HTTP response 未到达，
也不能从封存证据确定具体 Provider shape 根因。

当前普通分支 `drb/phase-6-9-8-sr5-v10-schema-adapter-postmortem` 已以 bounded enum/stage 修复诊断投影：未来失败可保留
`adapterFailureCategory/structuredOutputStage`，内层已观察 response 时会先追加 durability wire stage 再写 terminal；
Provider 原文、字段和值仍不保存。focused `38/38`（`128 expect()`），Agent full `1661/1661`（`25496 expect()`，
`203 files`），typecheck/lint/Prettier/diff check 通过。

本任务 Provider/credential/formal evidence/business writes=`0/0/0/0`，未读取根 `.env`，未启动 Docker/API/browser，
未修改 v10 sealed bundle；`qualityAuthority=none`。功能提交 `6a11b37a` 已以 `--no-ff` 合并并推送，合并提交为
`1289d059`；合并后 focused/full zero-provider parity 均通过。新的 lineage/tag/Live 必须另行决策和授权。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v10-schema-adapter-postmortem-zero-provider.md`。

## 当前状态：Phase 6.9.8 SR5 v10 controlled-Live 已失败封存（2026-08-14）

唯一 v10 run `da94b83b-3638-4e23-aefc-9e3423bf4c77` 已在 clean/tag-verified source
`fb0e9534db020b169f0bd629b62648191c92961a` 上正常 durable seal。宿主 proxy 为 `direct_ready`；credential reads=`3`，
transport/external Provider calls=`2/2`，business writes=`0`。Qwen `text-embedding-v4` 的 `rewrite_01` original retrieval
成功，wire=`1/1/1/1`、usage=`123/0`、verified cost=`0.0000615 CNY`；DeepSeek `deepseek-v4-pro` candidate 在 dispatch
后以 bounded `schema_invalid` 终止，wire=`1/1/0/0`，verified usage/cost=`null`。随后 quality breaker 将其余 `22`
Provider slots 固定为 `not_started_quality_breaker`。

终态为 `schema_recovery_sr5_branch_quality_gate_failed / qualityAuthority=none`，正式 rewrite/final semantic 与 aggregate
budget 均为 `null`，不能把 Qwen 单槽成功拼接成 Retriever/FinalResponse 语义通过。Journal=`54` 且以
`evidence_published` 收口；validator=`ok=true`；report logical SHA=`bbd3f59e...2db6`，physical artifact SHA=
`c0714172...ce39`。没有 recovery claim，禁止 retry/resume/replay/backfill、recover/seal、删除/改写 evidence、curl、
单 case或产品 API 追加 Provider 探测。

本轮未启动 Docker/API/browser，未写 Trace、BackgroundJob、Outbox 或业务数据，不形成 SR6/product/main/SLA authority。
下一任务只能从最新 `main` 新开 zero-provider postmortem，定位 DeepSeek candidate schema boundary 与 adapter accounting，
不得反向推断或补写 Provider 原文。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v10-controlled-live-quality-failure-sealed.md`。

## 当前状态：Phase 6.9.8 SR5 v10 host-preflight contract（2026-08-14）

v10 功能提交 `8c5a2e60` 已以 `--no-ff` 合并并推送为 `main == origin/main == 95ea523a`。当前
approved tag/数据边界/授权/evidence namespace 独立升级为 `live-v10`，v9 tag、授权和零证据终态不可复用。Live CLI
version 升为 v2；共享 proxy preflight 结果先经过 strict schema，失败只投影固定 `code/mode/configuredProxyVariables/
listener/listenerProbeCalls/providerCalls`，不保存 proxy URL/value、credential 或 raw error；malformed/extra field 继续
收口为固定 `proxy_preflight_not_ready`。ready attestation 还必须满足 direct 或 listening-loopback 的内部一致性。

v10 同时证明 unversioned v2 与 v9 durability namespace 均不阻断新 lineage，而任意 v10 leftover 仍在 reservation 前
fail-closed。runtime source manifest=`sha256:6723dc13e6abd7ca018169a73dfd6ef49a0073860051c3c2914515770818fb80`；
SR5 focused `128/128`（`282 expect()`），Agent full `1658/1658`（`25478 expect()`，`203 files`），typecheck/lint/
Prettier/diff check 通过。

合并后 focused `128/128`、Agent full `1658/1658`、typecheck/lint、profile-free `direct_ready` 与 v10 namespace=0
再次通过。全程未读根 `.env`/credential、未调用 Provider、未创建正式 evidence 或业务写入，未启动/清理 Docker、
数据库、Redis、MinIO、API 或浏览器，`qualityAuthority=none`。下一步只能在最终 parity commit 上执行独立 v10 annotated
tag 创建/推送与最终只读 verifier，再请求 fresh V10 数据边界与授权。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v10-host-preflight-contract-zero-provider.md`。

## 当前状态：Phase 6.9.8 SR5 v9 proxy-preflight 根因已 zero-provider 定位（2026-08-14）

v9 `proxy_preflight_not_ready` 的根因不是 production port 丢失，也不是 DeepSeek/Qwen。相同仓库和共享诊断 CLI 在
PowerShell 与 Git Bash `--noprofile --norc` 中均返回 `direct_ready / configuredProxyVariables=0 / providerCalls=0`；
本次 controlled-Live 使用的 Git Bash login shell 则由 profile 注入 `HTTPS_PROXY/https_proxy/HTTP_PROXY/http_proxy`
四项，脱敏端点均为 `http://127.0.0.1:7897`，当时端口未监听，因此共享 preflight 正确返回
`loopback_proxy_unavailable / listenerProbeCalls=1 / providerCalls=0`。Live CLI 再将其收口为固定
`proxy_preflight_not_ready`。

本诊断没有读取根 `.env`/credential、没有调用 Provider、没有创建或改写 evidence，也没有启动/清理 Docker、数据库、
Redis、MinIO、API 或浏览器。不得通过清空 proxy、绕过 preflight 或重跑 v9 授权来修复；未来入口必须使用明确的 native/
no-profile host environment，并在新的 source/lineage/tag/authorization 决策中保留 bounded preflight diagnostic。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v9-proxy-preflight-zero-provider-diagnosis.md`。

## 当前状态：Phase 6.9.8 SR5 v9 controlled-Live 在 proxy preflight 前门停止（2026-08-14）

`main == origin/main == 3ad7d7ce06c5b4a79132c1411522bf396e6f8987`；本地/远程 annotated tag
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v9-approved` 的 tag object 均为
`b0abb9a5eea8d674e98c2fdc33f18eb1c95dc1ff`，peeled commit 均为当前 `main`。最终只读 Git verifier 为
`ok=true / sr5_final_git_source_verified_zero_provider`，source manifest/source bundle 分别为
`sha256:35890f5d...eb45 / sha256:47e424c4...01ec`。

用户随后接受 v9 DeepSeek/Qwen 数据边界并授权唯一入口。正式 CLI 在 source/tag/authorization admission 后、credential
projection 与 reservation 前返回 `proxy_preflight_not_ready`；终态计数为 `providerCalls=0 / credentialReads=0 /
formalEvidence=0 / businessWrites=0`。没有 v9 marker、journal、report、artifact、recovery claim 或 dispatch lock，因而没有
可执行或需要执行的 seal/recover；本次授权入口不得直接重跑、replay、backfill，也不得用 curl、单 case或产品 API 追加
Provider 探测。该结果不能归因 DeepSeek/Qwen、账号、余额、模型权限、schema 或语义质量，也不形成 Docker/API/browser、
Trace、SLA 或产品 authority。

下一任务只能从最新 `main` 新开普通分支，对 production proxy preflight 做 zero-provider、无 credential 的独立诊断；历史 v2
evidence、v5-v9 tags 与本次零证据终态保持不变。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-v9-proxy-preflight-failure.md`。

## 当前状态：Phase 6.9.8 SR5 D4 runtime runner/durability（2026-08-13）

普通分支 `drb/phase-6-9-8-sr5-runtime-runner-durability` 正在完成 v4-native zero-provider runner/durability：D3
动态 source binding capability 只能消费一次；synthetic run 固定 `8/8` guards、`12/12` reserved lanes，
dispatch/response/verified usage=`0/0/0`。marker、5 条 canonical hash-chain journal、strict report 与 hard-link artifact
均可重算，crash-only seal 不重放 lane，活动 owner、第二次运行/恢复与篡改均 fail-closed。D3 不签发执行 capability，
D4 只暴露 test-only synthetic capability。focused D3+D4 为 `26/26`（`47 expect()`）；Agent full 使用
`--timeout 30000` 为 `1634/1634`（`25433 expect()`，`202 files`）。默认 5 秒全量首次回放只有 8 个历史 fsync-heavy
测试超时，相关 6 文件以同一 30 秒阈值独立回放 `48/48` 后，最终全量延长阈值回放零失败。

本任务未读取 `.env`/credential、未调用 DeepSeek/Qwen、未创建正式 evidence、未启动 Docker/API/browser，未写
Trace/BackgroundJob/Outbox 或业务数据，`qualityAuthority=none`。最终 Git verifier、v4 tag/remote parity、fresh
authorization 与 controlled-Live 仍是独立后续停止门；旧 v1/v2/v3 tag、授权及 sealed evidence 禁止复用或改写。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runtime-runner-durability-zero-provider.md`。

## 当前状态：Phase 6.9.8 SR5 run-bound source revalidation recovery（2026-08-12）

普通分支 `drb/phase-6-9-8-sr5-run-bound-source-revalidation` 已完成 zero-provider architecture recovery：reservation 与
admission capability 共享一次性 runId binding；reservation 后只允许本 run marker/journal；marker、严格 journal schema、
hash chain、source binding 与文件身份均在首 guard 前校验。8 个 guard 后、首个 Provider adapter 前再签发并消费一次性
dispatch capability/permit；任何额外 evidence、marker/journal 篡改、目录替换或 late mutation 都在 `invokeCall=0`、
`wire.dispatches=0` 前 fail-closed。dispatch lease 只协调遵守合同的进程，不宣称阻止同用户恶意本地进程；Node/Windows
缺少 portable `openat`/descriptor-relative enumeration，路径、目录流和已打开句柄身份校验用于缩小而非消灭该平台竞态。

focused Live `25/25`（80 assertions），SR5 六文件组合 `50/50`（162 assertions），Agent full `1538/1538`
（25245 expect()，196 files），typecheck/lint/diff check 通过。全程 Provider/credential/正式 evidence/business writes=`0`，
未读取根 `.env`，未启动 Docker/API/browser，未写
Trace/BackgroundJob/Outbox。旧 run `9eb57600-97e2-4513-8654-8686b38e856e` 与 v2 tag 仍永久封存且禁止重跑；本 recovery
不创建新 tag、不接受授权、不执行 Live。未来真实运行必须另立 lineage/source/tag 决策；SR6 产品验收继续阻断。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-run-bound-revalidation-zero-provider.md`。

## 当前状态：Phase 6.9.8 SR5 Live 已 recovery seal（2026-08-12）

绑定 v2 source/tag 的唯一 controlled-Live run `9eb57600-97e2-4513-8654-8686b38e856e` 已消费并由
crash-only recovery durable seal。终态为
`schema_recovery_sr5_branch_quality_gate_failed / qualityAuthority=none / completionMode=recovery`；credential reads=`3`，
transport invocations / DeepSeek / Qwen / external Provider calls 均为 `0`，business writes=`0`。strict validator 为
`ok=true`，journal `49` 条并以 `evidence_published` 收口；report logical SHA=
`5912a56336e2ac24e73a361c6452dcb473c53d8c7fbff36065848aaf22fe087d`，physical artifact SHA=
`a4ccb5063608d2f81cb0c7b9092b4e3610c7ea3bfee817daaec4b5a9c88bb98b`。

根因已经由正式 journal 与源码调用链定位：admission 在 namespace=0 时签发 capability，reservation 随后创建本 run
marker；runner 消费 admission capability 时又复用完整的 namespace=0 source check，把自己刚创建的 marker 当作 source
drift 拒绝。journal 在 `attempt_reserved` 后没有任何 guard/call/wire 事件，recovery 才生成固定分母终态，因此这不是
DeepSeek/Qwen、proxy、账号、schema 或语义质量失败证据。唯一名额已消费，禁止 retry/resume/replay/backfill、再次
seal/recovery、curl、单 case或产品 API 追加 Provider 探测；marker/journal/claim/report/artifact 均不可删除、移动、格式化或改写。

本轮未启动 Docker/API/browser，未创建 Trace、BackgroundJob、Outbox 或业务数据，不能宣称产品可用。SR6 产品验收继续
阻断；下一任务只能从最新 `main` 新开独立 zero-provider architecture recovery，冻结 reservation 后 run-bound source
revalidation，并补 production-shaped `admit -> reserve self-marker -> consume -> first guard` 回归。完整证据见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-recovery-sealed.md`。

## 历史 checkpoint：Phase 6.9.8 SR5 production proxy port recovery（2026-08-11）

本节“当前/下一步”只记录 2026-08-11 checkpoint；v2 tag 与唯一 Live 此后已执行并封存，禁止按本节旧操作步骤重跑。

上一轮唯一 SR5 入口在 proxy 前门 fail-closed：`proxy_preflight_not_ready`，但独立 preflight 为
`loopback_proxy_ready`。只读调用链确认根因是 `createPorts` 无条件丢弃 production `runProxyPreflight` override，
并安装 `PROXY_PREFLIGHT_PORT_NOT_BOUND` 抛错桩；不是代理、Bun dotenv、cwd、账号或 Provider 根因。

当时普通 git 分支 `drb/phase-6-9-8-sr5-proxy-port-recovery` 已修复为
`overrides?.runProxyPreflight ?? default fail-closed stub`，并新增 ready/not-ready 双向 zero-provider 回归。
当时 source contract 预留的 immutable tag identity 为
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v2-approved`，保留已推送的 `live-v1` tag 不动；source
manifest=`sha256:61afe007...fa2829`，Live manifest=`372abb46...df67a4`。focused SR5 Live 为 `16/16`（63 assertions），
SR5 + Task 9B boundary 为 `54/54`（191 assertions），Agent full 为 `1529/1529`（25224 expect()，196 files），
typecheck/lint/diff check 通过；`providerCalls=0`、`credentialReads=0`、`formalEvidence=0`、`businessWrites=0`。
完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-proxy-port-recovery-zero-provider.md`。

源码改变后，历史 SR5 tag 与旧授权不可复用；当时 proxy fail-closed 没有消费一次性名额，formal namespace 仍为 `0`。
随后 v2 tag 已创建、唯一 Live 已执行并封存；本段历史顺序不可再次执行。不得 retry/replay/curl/单 case/追加 Provider
探测，也不得清空或重建 Docker、PostgreSQL、Redis、MinIO。

controlled-Live 语义门通过后，才在独立 SR6 授权下进行 Docker/API/Trace/可见浏览器产品验收；截至当前尚未完成该产品验收，
不能把 zero-provider 或 transport 结果宣称为产品可用。

## 历史 checkpoint：Phase 6.9.8 SR5 Live tag compatibility（2026-08-10）

SR5 Live 首次入口尝试在 proxy 前门 fail-closed：`proxy_preflight_not_ready`，
`providerCalls=0 / credentialReads=0 / formalEvidence=0 / businessWrites=0`，没有创建任何正式 marker/journal/report/artifact，
也没有修改 Docker、PostgreSQL、Redis、MinIO。proxy accessor 修复已完成；当前进一步修复 source admission 对不可变历史 tag 的绑定冲突，
并补齐授权 accessor 与 `.tmp` symlink/junction 的 fail-closed fence。

本分支新增独立 Live lineage
`phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v1`：固定 `8 guards + 6 rewrite pairs + 6
FinalResponse`，DeepSeek `12` + Qwen embedding `12`（共 `24` Provider slots），最大并发 `1`、pair-serial、single
dispatch，预算 `37,600/8,800/0.176 CNY`，禁止 retry/resume/replay/backfill。入口脚本使用 `bun --no-env-file`；
只有 exact argv、当次数据边界与 exact authorization、当前正式 namespace=0、source/tag parity、proxy preflight 全部通过
后才会选择性读取根 `.env` 的三个 SR5 credential alias。credential、prompt、Provider 原文不进入 report/journal/artifact。

历史 approved tag `phase-6-9-8-retriever-final-response-schema-recovery-sr5-approved` 仍固定指向修复前 `ca9a9eb0`，
不可移动、覆盖或复用。Live 新 tag 合同为
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v1-approved`；Live source schema/ref/tree bundle 独立于
历史 admission manifest。当前 focused SR5 contract/source/Live zero-provider 回归为 `26/26`（102 assertions），Agent full
为 `1527/1527`（25213 expect()，196 files），Agent typecheck/lint 与源文件 Prettier/diff check 通过；这仍不是 controlled-Live、真实模型质量、产品/API/browser、Trace、P95/SLA 或
`main` authority。当前功能分支尚未合并；完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-tag-compatibility-zero-provider.md`。

必须先提交并推送功能分支、合并并推送 `main`、完成合并后二次 zero-provider 回归，再在最终 parity commit 创建并推送新的
annotated tag、核对 tag object/peeled commit，重新接受该 tag/source 的 DeepSeek/Qwen 数据边界并给出新的两行 exact
authorization；随后才可执行唯一一次 controlled-Live。
本轮源码变更前收到的授权不适用于新 bundle，也没有被消费。在新授权前禁止 retry/replay/curl/单 case/追加 Provider 探测；
成功只形成分支 semantic authority，失败则 durable seal 后停止。不得清空或重建 Docker、PostgreSQL、Redis、MinIO。

### 历史 SR5 runner/durability checkpoint（已完成）

以下段落保留历史 `main` checkpoint 的 zero-provider 事实；不应与当前 Live implementation 或未来 controlled-Live 混称。
历史功能提交 `d077bf9d` 已以 merge `b2b5b9c9` 进入 `main`；authority=
`zero_provider_retriever_final_response_schema_recovery_sr5_runner_durability`、gate=
`schema_recovery_mock_quality_not_evidence`、`qualityAuthority=none`。固定 `8/6/6`、`12` synthetic invocations，focused
`25/25`（82 assertions），providerCalls/credentialReads/formalEvidence/businessWrites 均为 `0`。验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability-zero-provider.md`。

### 历史 SR4 reviewed Mock checkpoint（已完成）

独立 lineage 仍为 `phase-6.9.8-retriever-final-response-schema-recovery-v1`；SR4 authority=
`zero_provider_retriever_final_response_schema_recovery_sr4_reviewed_mock`、gate=
`schema_recovery_mock_quality_not_evidence`、`qualityAuthority=none`。SR4 固定 `8 guards + 6 rewrite candidates + 6
FinalResponse candidates = 20 report entries / 12 candidate invocations`，最大并发 `1`、每 lane 单次 dispatch、首错
breaker；factory SHA=`sha256:7bc32c8ed68c3c8d76c9c983b40e771f24c0181cda7976cbc97ab1fb4c26d157`，上游 SR3 manifest/policy/report
SHA=`d14c0845...da1bede / 6c1f1b03...1cebf8 / 73f06485...951ef8`。

SR4 reviewed Mock 真实穿过 `Retriever original -> query-rewrite candidate -> bounded raw-content policy parser ->
synthetic Qwen search port -> verified-evidence projector -> FinalResponse stream -> local merger -> SR3 runner`；extension
字段只形成有界诊断并丢弃，不保存 raw content/hash。默认结果为 guards `8/8`、reservations/dispatches/responses/
verifiedUsage/succeeded/failed/notStarted=`12/12/12/12/12/0/0`，schema=`4 canonical + 2 extension discarded + 0 rejected`，
FinalResponse strict=`6`，节点计数 Retriever original/candidate/projector/FinalResponse/merger=`18/6/6/6/6`，synthetic Qwen
port=`18`，正式 evidence=`0`。

SR4 focused `11/11`（99 assertions）、SR1+SR2+SR3+Task9B+SR4 组合 `74/74`（734 assertions，15 files）、Agent full
`1488/1488`（25020 expect()，190 files）、AI full `345/345`（2662 expect()，28 files）、Types `42/42 + tsc`、Web
`487/487`、Server build、Agent/AI typecheck/lint 均通过；historical SR3 validator/SHA parity 由组合回放覆盖。全程
`providerCalls=0 / credentialReads=0 / businessWrites=0 / formalEvidence=0`，未读取根 `.env`、
未调用 DeepSeek/Qwen、未启动 Docker/API/browser、未写 Trace/BackgroundJob/Outbox 或业务数据。SR4 只解锁 fresh SR5
admission，不形成真实模型质量、产品、`main`、P95/SLA 或博客 authority。

完整 SR4 验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock-static.md`；SR3/SR2/SR1 及设计入口见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr3-zero-provider-runner-durability.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr2-zero-provider-robustness.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr1-zero-provider-tdd.md`、
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-schema-recovery-design.md` 与
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-schema-recovery.md`。

### 历史 SR2 回执（保留，不是当前分支）

SR2 功能分支 `drb/phase-6-9-8-retriever-final-response-schema-recovery-sr2` 已以 `2df35873` 合并到普通 `main`，合并提交为 `17ce07ba`，并已推送使 `main == origin/main == 17ce07ba386f3a54eb4fdfffdf050b561c319754`；不使用 worktree。独立 lineage 仍为
`phase-6.9.8-retriever-final-response-schema-recovery-v1`；SR2 authority=
`zero_provider_retriever_final_response_schema_recovery_robustness / qualityAuthority=none`。

SR2 在 SR1 parser/candidate seam 之上冻结了独立 Provider-like fixture/responder：`5` 个 held-out、`24` 个 shape
（`5` accepted、`19` rejected）、`7` 个 fault、`4` 个 metamorphic case，fixture SHA=
`sha256:59010e16fd665df6d497517276dbeacb3f5973036a07e8cf00010569da171505`。合成 runtime 使用
`reviewed_mock / mock / mock`，真实穿过 raw-content policy/parser、canonical projection、local authority 与 sanitizer，
但不构造第一方 adapter；diagnostic 仍只在 candidate outcome sidecar，Retriever node/API boundary 丢弃。
focused `12/12`（329 assertions），SR1+SR2/node/query-rewrite 组合 `43/43`（743 assertions）；Agent full
`1462/1462`（24841 expect()，184 files）、AI full `345/345`（2662 expect()，28 files）、typecheck/lint 与
`git diff --check` 通过；受 Windows CRLF 工作树影响，SR2-owned TS/JSON 已用 `--end-of-line=crlf` 的 Prettier
回放通过，未对历史 Markdown 做全仓库换行重排。

本 SR2 全程 zero-provider：不读取根 `.env`/credential，不调用 DeepSeek/Qwen，不创建正式 marker/journal/report/
artifact/recovery claim，不启动或清理 Docker、PostgreSQL、Redis、MinIO、API、browser，不写 Trace、BackgroundJob、
Outbox 或业务数据。SR2 只解锁从当前已推送 `main` 新开的 SR3 普通 git 分支，用于独立 runner/source admission/durability；不形成
真实模型质量、产品或博客 authority。未来任何 controlled-Live 都必须重新接受当次 DeepSeek/Qwen 数据边界并给出
绑定新 source 的 exact authorization。

完整 SR2 验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr2-zero-provider-robustness.md`；SR1、设计/计划入口见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr1-zero-provider-tdd.md`、
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-schema-recovery-design.md` 与
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-schema-recovery.md`。

## 历史 checkpoint：Phase 6.9.8 P1 L2 已失败封存；禁止重跑（2026-08-09）

唯一 P1 L2 controlled-Live run `ff035203-500f-4744-b33c-3c375ae4c785` 已在 approved source/tag
`fa50292509d7c3e2e4ad017e7e730fd434a29cde` 上由正常 runtime 路径 durable seal。8/8 guards 保持 zero-call；
`rewrite_01` strict 成功，`rewrite_03` 在真实 DeepSeek 调用后以 bounded `schema` failure 打开 breaker，后续 10 条 lane
均为 `not_started_quality_breaker`。终态为 `p1_l2_quality_gate_failed / qualityAuthority=none / semanticGate=none`；
Provider/credential/Qwen calls=`2/2/0`，usage=`343/40`，aggregate verified cost=`null`。

Journal 共 `41` 条并以 `evidence_published` 收口；validator=`ok=true / bundle_valid`，recovery claim=`null`，report/root
artifact SHA 分别为 `84eddcf6...d7f9 / 9b79c490...f58b`。唯一名额已消费，禁止 retry/resume/replay/backfill、
recovery/seal、curl、单 case或追加 Provider 探测；不得删除、格式化或改写 marker/journal/report/root artifact。该结果
不能归因具体 Provider/网络根因，也不形成 P1 semantic、产品 Docker/API/browser、Trace、SLA、业务写入或 `main`
产品 authority。

完整证据见
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-controlled-live-quality-gate-failure.md`；Live 前实现与 source-gate
修复历史见 `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-implementation-zero-provider.md`。证据/文档已在
`1f3c0d9b` 提交、通过 `--no-ff` 生成生产/证据 merge `f4fac048`，文档 parity 再以 `613cc772` 合并；最终
`main == origin/main` 上完成二次零 Provider 验收；
main parity 记录见 `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-main-parity-zero-provider.md`。P1 L2 已完成
源码/证据合并、远程推送与合并后二次 zero-provider 回归；不得把它称为仍待完成的 Live。其后 SR0 已作为历史设计
checkpoint 合并；当时实现状态以该 checkpoint 的 SR2 回执和 SR2 acceptance 为准，当前状态以本文件顶部 SR4 回执为准；SR0/SR1 设计、计划和验收分别见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-schema-recovery-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-schema-recovery.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr0-zero-provider-design.md`。Docker 容器、镜像、
卷、数据库、Redis、MinIO 保持原状，不使用 worktree。

## 历史 checkpoint：Phase 6.9.8 P1 L2 admission contract（2026-08-08）

此前 `drb/phase-6-9-8-l2-admission-contract` 已完成独立 L2 zero-provider admission contract，并合并到 `main`。该历史
checkpoint 的 `mode=zero_provider_admission`、`providerDispatchAllowed=false`、`providerCalls=0`、`credentialReads=0`、
`formalEvidence=0` 事实保持不变；它不代表本次 controlled-Live 已执行。完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-admission-zero-provider.md`。

## 历史完成：Phase 6.9.8 P1 S2 reviewed Mock/static（2026-08-08）

S2 在从已推送 `main / origin/main = 0c2faf1d` 派生的普通分支
`drb/phase-6-9-8-p1-s2-reviewed-mock` 上完成。它把 G2 runner 接到实际 Retriever original/query-rewrite、synthetic
Qwen search port、verified-evidence projector、FinalResponse stream、strict validator 与 local merger；固定 `8` 条
zero-call guard、`6` rewrite + `6` FinalResponse lane、`12` candidate invocation、最大并发 `1`。

S2 authority=`zero_provider_retriever_final_response_p1_s2_reviewed_mock`、gate=`p1_mock_quality_not_evidence`、
`qualityAuthority=none`。正常 checkpoint 为 `8/8` guard、`16/16` strict/wire/synthetic usage、semantic `1/1/1`；
`providerCalls=0`、`credentialReads=0`、synthetic Qwen port `17`、正式 marker/journal/artifact/recovery claim 与
approved tag 均为 `0`。synthetic usage 明确为 `usageAuthority=synthetic_estimate`，`verifiedProviderUsageSamples=0`、
`verifiedProviderCostCny=null`，不代表供应商计量或账单。factory SHA=`sha256:8ad0a12ae7bd6365873631cb4908b41888617b9599fdd6865cf7e45c788f0e7d`，
report SHA=`cfb48cb8108768ace9b8e5c5714344f2be74e16300d6997a5e874085275b9db5`。完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock-static.md`。

已通过 S2 focused `4/4`（73 assertions）、G1+G2 focused `10/10`（50 assertions）、Agent full `1423/1423`
（24241 expect()，177 files）、typecheck、lint、Prettier 与 `git diff --check`。本阶段未读取根 `.env`，不启动
Docker/API/browser，不写 Trace、BackgroundJob、Outbox 或业务数据。final_11 的 required-citation compatibility 只
是经过冻结 hash/contract 验证的 S2 diagnostic，不改写 G1/G2 authority。

当时的下一原子任务是完成本分支文档与源码 parity 后推送、合并 `main` 并在 `main` 二次回归；该历史动作已由当前收口完成。
之后如需 L2 semantic canary，
必须重新接受当次 DeepSeek/Qwen 数据边界并给出新的 exact authorization。不得重跑已封存的 L1/T3/R5/Task 9C/SR5 evidence，
不使用 worktree，Docker 容器、镜像和卷保持原状。

## 历史封存：Phase 6.9.8 Transport Re-entry V2 L1 controlled-Live（2026-08-08）

唯一 run `ce0c3257-a5d9-4389-90ec-814d5e9cde34` 已在推送提交
`ee3dbf91c863a3a5cd95c810a9c0cec0b26f64c6` 上通过 clean/source parity、fresh `direct_ready` proxy、当次
DeepSeek/Qwen 数据边界与 exact authorization，并按 `rewrite -> qwen -> final_response` 完成三次真实 Provider call。
终态为 `transport_reentry_v2_l1_controlled_canary_passed`、`authority=controlled_live_transport_reentry_v2`、
`qualityAuthority=none`；usage `145/28/173`、费用 `0.000573 CNY`、journal `16` 条、validator `ok=true`、
root artifact SHA=`472c727db12a0115a918440795ff72b59df980521867841d778373c91484718a`。

该结果只形成 transport diagnostic authority：不证明 Retriever/FinalResponse 语义、P95/SLA、产品 `/api/chat`、
Docker/API/browser、Trace、BackgroundJob/Outbox、业务写入或 `main` authority。L1 marker/证据已 durable，唯一名额已
消费，禁止 retry/resume/replay/backfill、recovery/seal 或追加 Provider 探测。完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-controlled-live-sealed.md`。

此前 root `.env` 的 `unknown_key` 是本次修复前的 configuration-only 历史诊断；selective root profile 与 zero-provider
实现验收仍保留在 `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-root-env-diagnosis-zero-provider.md`
与 `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-implementation-zero-provider.md`，不改写其
当时的 `providerCalls=0` 事实。P1 设计随后在从最新 `main` 派生的普通分支上冻结，G1/G2/S2 已分别完成；该历史段落中
“下一任务为 S2”仅描述当时的 checkpoint，当前状态以本文件顶部为准。设计、计划和验收见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-g1-contract-baseline-scorer.md`。

## 历史 checkpoint：Phase 6.9.8 Transport Re-entry V2 S1 已完成（2026-08-07）

旧 T3 一次性名额已消费且不可重跑。新的独立 lineage
`phase-6.9.8-retriever-final-response-transport-reentry-v2` 已以
`zero_provider_transport_reentry_v2_s1 / qualityAuthority=none` 完成 D0、C1、C2 与 S1：root launcher 只在 exact
data-boundary + authorization 后读取根 `.env` 的 `DEEPSEEK_API_KEY`/`QWEN_API_KEY`，并投影为 runtime core 的
module-owned dedicated capability；C2 再将三个 projection 收口为单次 opaque configuration capability，并完成
exclusive marker、reservation-before-dispatch、固定三槽 runner、hash-chain journal、hard-link artifact、strict
validator 与 crash-only recovery。exact argv/source/T2+T3-C/proxy/data-boundary/authorization 全部先于 credential
composition，configuration failure 在 marker 前收口，不消费 V2 一次性 marker；S1 再以三个 bounded synthetic
first-party adapter 复用 C2 runner 完成 reviewed Mock/static。

S1 固定 `rewrite -> qwen -> final_response`、最多 `3` synthetic calls、总 cap `0.024096 CNY`、首错 breaker 与 no-retry；
即使 transport 全部成功也不形成 semantic/product/main authority。C1/C2/S1 使用 synthetic fixture 完成 bounded root-env
parser、gate ordering、module-owned single-use capability、fault matrix 与 crash-only durability；真实 `.env`、
credential、Provider、正式 marker/journal/artifact/recovery claim、Docker/API/browser 与业务写入仍为 `0`。该段只保留
S1 的历史 authority；当前 L1 implementation 状态与下一步以本文件顶部为准。设计、计划与验收见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-transport-reentry-v2-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-transport-reentry-v2.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-d0-zero-provider-design.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1-zero-provider-launcher-projection.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-zero-provider-runner-durability.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock-static.md`。

S1 提交后的 clean-source 回放曾因把 `.tmp` 全部历史文件误计为当前 formal evidence 而返回
`source_admission_invalid`；修复后只统计占用当前 V2 marker/journal/recovery/report/root artifact 路径的任意目录项，
历史 lineage/普通日志不再阻断，缺失 `.tmp` 视为空，其他读取错误 fail-closed。最终 focused（S1+C2）`22/22`
（136 assertions）、Agent full `1394/1394`（24011 expect()，173 files）、typecheck/lint/Prettier/diff check 与
clean branch/HEAD/upstream/origin CLI 回放通过；该修复不改变 zero-provider authority 或 L1 停止门。

## 历史封存：Phase 6.9.8 Transport Evidence Recovery T3 controlled canary（2026-08-07）

唯一 T3 run `075e2d5f-682b-426d-847e-f5a6ce5b97c6` 已在 source commit
`2423baf3768c245d2e4d6ea0038c6fb1bf8f9bc7` 上通过 source/T2/direct-proxy/data-boundary/authorization gate，并在
late-bound credential gate 以 `configuration_invalid` 停止。固定顺序为
`DeepSeek rewrite -> Qwen embedding -> DeepSeek FinalResponse stream`，计划 `3`、启动 `0`、完成 `0`，breaker
reason=`configuration`，三个 suffix lane 为 `not_started_quality_breaker`；`providerCalls=0`、`credentialReads=0`、
verified usage/cost/semantic/P95 全为 `null`。

进程退出后已按 crash-only 规则 durable seal：authority=`controlled_live_transport_evidence_t3`、
`qualityAuthority=none`、journal `7` 条、最终事件 `evidence_published`、validator `ok=true`，report logical SHA=
`8d529bb7...4875d1`、physical artifact SHA=`50beb053...7ee9c`。该终态只证明 CLI/configuration gate 失败，不能
归因 DNS、TLS、代理、账号、余额、模型权限或服务端，也不能证明真实 Retriever/FinalResponse 语义或产品可用。

T3 一次性名额已消费，禁止 retry/resume/replay/backfill、seal/recovery、curl、单 case 或追加 Provider 探测；不得
删除或改写 `.tmp` marker/journal/report 与根 hard-link artifact。补充提交 `3d903055` 已让受控 package script 显式
加载仓库根 `.env`，并提供独立 crash-only seal CLI，但不得用于重跑本 run。完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-controlled-canary-failure.md`。

T3 不解锁 Phase 6.9.8 Task 10/11、产品 Docker/API/browser、Trace、`main`、SLA、Phase 6.10 或博客收尾；当前只
允许只读 validator、zero-provider 回归和文档同步。

T3-C configuration composition guard 已完成：focused `2/2`（10 assertions）验证 controlled package script 的根 `.env`
相对路径与 crash-only seal CLI 的无 credential/Provider 端口边界；authority=`zero_provider_transport_evidence_t3_configuration_guard /
qualityAuthority=none`。该 guard 不读取实际 `.env`，不执行 Live，不恢复 T3 名额。详见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-configuration-zero-provider.md`。

## R5 sealed result（2026-08-06）

Phase 6.9.8 Retriever / FinalResponse Architecture Recovery R5 的唯一 controlled-Live run
`34eb99be-bdeb-41e5-85cf-3c651ecefc68` 已正常 durable seal，但 gate 为
`architecture_recovery_quality_gate_failed / qualityAuthority=none`。16 guards 全通过；第二个 rewrite pair 的
DeepSeek 在 `provider_dispatch / unknown` 失败，external Provider calls `4`（Qwen `3`、DeepSeek `1`），breaker 后
`59` slots 未启动；rewrite strict `1/16`、FinalResponse `0/16`，semantic/P95/verified aggregate 全为 `null`。
Journal `237`、validator `ok=true / bundle_valid`、artifact SHA=`423e3f2e...43b1e5`，一次性名额已消费。该 bounded
diagnostic 不归因 DNS/TLS/代理/账号/余额/权限/服务端根因，不形成产品、Docker/API/browser、Trace 或 main authority；
R6 与后续阶段保持阻断。不得 retry/resume/replay/backfill、seal/recovery、curl、单 case 或追加 Provider 探测。

## 当前任务：Transport Evidence Recovery T2 已完成（2026-08-06）

R5 失败后不直接重试。T0 已冻结独立 lineage
`phase-6.9.8-retriever-final-response-transport-evidence-v1`；T1/T2 已完成 zero-provider strict diagnostic parser、
三条 family 私有 single-consume WeakMap/WeakSet seam、30-case matrix、15 个 classifier fixture 与 synthetic
durability。T2 同时验证了唯一 marker、严格 journal state machine、partial/terminal prefix recovery、幂等 report snapshot、
existing-artifact publication recovery、multiple-marker rejection、Windows/Bun fsync compatibility、hard-link artifact
与 strict validator。focused `11/11`（39 assertions）、Agent full `1348/1348`（23746 expect()，168 files）、
typecheck/lint/Prettier/diff check 通过；R5 的历史 `provider_dispatch / unknown` 继续保持不可判别，不被反向归因。
T0/T1/T2 均未读取 credential、未调用 Provider；T2 只在系统临时目录创建并清理 synthetic bundle，正式 evidence=0，
authority 固定为 `zero_provider_transport_evidence_t2 / qualityAuthority=none`，不解锁 R6/R7/main。当前不存在已授权
的 T3 Live；如需评估最多 3-slot transport canary，必须重新接受当次 DeepSeek/Qwen 数据边界并给出全新 exact
authorization。
详见 `docs/superpowers/specs/phase-6-9-8-retriever-final-response-transport-evidence-recovery-design.md` 与
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-transport-evidence-recovery.md`，T0/T1 验收分别见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t0-zero-provider-design.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t1-zero-provider-tdd.md`；T2 验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t2-zero-provider-robustness-durability.md`。

## R5 Live 前工作边界（历史 checkpoint，2026-08-06）

Phase 6.9.8 Retriever / FinalResponse Architecture Recovery R5 已完成实现、独立复审和 zero-provider 回归，当前分支
`drb/phase-6-9-8-retriever-final-response-contract` 当时只允许在 clean-source admission 后执行用户已授权的唯一一次
controlled-Live。固定分母是 `16 guards + 16 rewrite pairs + 16 FinalResponse = 64 slots`；DeepSeek rewrite、Qwen
original/candidate retrieval 与 DeepSeek FinalResponse 均走真实第一方 adapter。三项 R5 credential 只在授权 CLI
子进程 late-bind，主代理不得读取或回显；产品 gate、Docker、数据库、Redis、MinIO、BackgroundJob、Outbox 与浏览器
数据不因 R5 改变。focused `18/18`、CLI `6/6`、Agent `1329/1329`，typecheck/lint/Prettier 均通过；该 Live 前
Provider、credential、approved tag、marker、journal、artifact 与业务写入为 0。完整边界和收口规则见
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r5-controlled-live.md`。

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手。Phase 7 核心工程化已完成；Phase 7.8.5 RAG runtime parity 已完成真实 Docker 验收。当前 Phase 6.9.7 TutorAgent / WrongQuestionOrganizerAgent 的 V1--V9 controlled-Live 均已以 `quality_gate_failed` 独立封存且不得重跑。V9 R0--R4 已完成本地合法 option authority、exact `questionIndex + optionIndex` contract、V6 validator/merger 复用、三阶段 stale/write authority、独立 runner/lineage/durability 与 reviewed Mock；R4 Mock 为 `24/24` guard、`48/48` strict、wire `48/48/48/48`、semantic `1/1/1`，但只具有 `mock_quality_not_evidence` authority。唯一 V9 R5 run `c530ca02-3ece-4f11-898c-5695c8252bd5` 保持 `24/24` guard zero-call；首个 pair 两条 lane 各完成一次 durable dispatch，但 Tutor 在 Provider response 前成为 `executed_failure / fallback_runtime_error / provider_runtime / transport`，Organizer sibling 以 `attempted_aborted / fallback_aborted / post_dispatch_abort` 收口。Runner 打开 `quality_gate_impossible` breaker，后续 46 runtime 未启动；最终 runtime accounting 为 reserved `2`、terminal `2`、orphan `0`、not started `46`，wire `2/2/0/0`、strict `0/48`，正式 semantic/P95/token/CNY 全 `null`。Marker/journal/evidence 已 durable seal，bundle validator `ok=true / filesChecked=1`，无 recovery claim。该证据只能证明进入 dispatch 后在 response 前 transport/abort 终止，不能归因 DNS、TLS、代理、账号、余额、模型权限或服务端，也不能证明真实 Tutor/Organizer 语义或产品可用。一次性名额已消费，禁止 retry/resume/replay/backfill、seal/recovery、删除或改写 artifact，以及 curl、单 case、产品 API 等追加 Provider 探测。R6 产品 Docker/API/可见浏览器、R7/main、Phase 6.9.8、Phase 6.10、Phase 8/9 与博客收尾均被阻断。用户随后作出独立产品路线决策：停止 V10/V11 式整套重试，进入 Phase 6.9.7 Architecture Recovery。R1 已新增不改写 sealed V1 adapter 的 transport diagnostic wrapper，以固定 `aborted/timeout/dns/tls/proxy/connection_refused/connection_reset/network_unreachable/unknown` subtype 在内存中细分 delegate throw；公共 provider category、V1--V9 report/schema/validator/artifact 均保持不变。R2 已完成独立、封闭的 zero-network Provider health canary request/report/artifact contract、单调用/no-retry runner、安全 CLI 与 `21/21` synthetic fault matrix；外部无法注入 fetch/transport/credential，结果 authority 固定为 `synthetic_test`。R3 evidence-root 围栏已在 `9c297da3` 修复并推送；随后唯一 controlled-Live run `253a5df5-c443-4950-b517-849efb941728` 已消费新授权并由正常 runtime 路径 durable seal。终态为 `transport_failed / connection_refused / dispatched_no_response`，wire `1/1/0/0`，最后完成阶段 `provider_dispatch_started`，usage/token/CNY 全 `null`。Marker、7 条 hash-chain journal 与 artifact 已到 `evidence_published`，无 recovery claim；artifact SHA 为 `56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4`。Authority 仅 `controlled_live / diagnostic_only / qualityAuthority=none`，不能证明 Provider health、Tutor/Organizer 语义或产品可用。Zero-network 复盘发现当前进程 proxy 指向无监听 loopback `127.0.0.1:7897`，与 subtype 高度一致但未被 sealed evidence 证实为唯一根因。R3 禁止 retry/resume/replay/backfill、Live/seal、删除/改写 artifact 或追加 Provider 探测；R4、小样本、48-case/产品/main 与后续阶段继续阻断。后续 zero-provider proxy preflight 与 Provider Canary V2 D0/C1/C2/S1/L1 均已完成；唯一 L1 run `dc09214c...` 已以 strict response + verified usage 成功封存，但 `qualityAuthority=none`，P1/G1/G2/S2 已 zero-provider 完成；唯一 L2 8-pair run 已 durable seal 并通过 `small_sample_semantic_gate`；禁止重跑 L1/L2 或直接进入 48-case/产品/main。R3 失败验收仍见 `docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r3-controlled-live-failure.md`，V2 C2/S1 见 `docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-one-shot-durability.md`。

Architecture Recovery 独立 zero-provider proxy preflight 已完成：纯 contract 只允许 direct 或所有已配置 proxy 变量一致指向显式 loopback HTTP URL；`NO_PROXY` 非空、authority 冲突、credential URL、非 loopback/非 HTTP/非法端口与 hostile env 均 fail-closed。CLI 只快照八个固定 proxy key，listener probe 为 loopback-only、250ms、无 payload，核心 watchdog 不信任依赖自行守时；输出不含 URL/raw error/credential，`providerCalls=0`。实际结果为 `loopback_proxy_unavailable / configured=4 / probe=1 / providerCalls=0`。这不证明 Provider/network health，不升级 R3 根因，也不授权 R3 重跑、R4、产品或后续阶段。详见 `docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-proxy-preflight.md`。

宿主 Clash Verge core 恢复后，同一安全 preflight 已重新得到 `loopback_proxy_ready / configured=4 / probe=1 / providerCalls=0`；未清空/绕过 proxy、读取 credential、调用 Provider 或创建 marker/artifact。该 ready 只证明当前本地 listener 前置条件。新的独立 `Provider Canary V2` 使用 D0/C1/C2/S1/L1/P1 与全新 namespace/approval/credential/confirmation/evidence，禁止复用 R3/R4 identity。D0/C1/C2/S1/L1 均已完成；唯一 L1 run `dc09214c-0300-4153-8273-e548ac768d20` 为 `complete / strict_response_with_verified_usage`，wire `1/1/1/1`、usage `49/5`、费用 `0.00017700 CNY`，journal `12` 条并以 `evidence_published` 收口，validator `ok=true`，artifact SHA `98368de...a7e4`。该 authority 仍为 `diagnostic_only / qualityAuthority=none`；L1 不得重跑；其后 P1、G1、G2、S2 与唯一 L2 均已按独立边界完成。C1、C2/S1 与 L1 验收分别见 `docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c1-zero-network-contract.md`、`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-one-shot-durability.md`、`docs/acceptance/phase-6-9-7-architecture-recovery-provider-canary-v2-l1-success-diagnostic-only.md`。

P1 已冻结独立 `phase-6.9.7-tutor-organizer-small-sample-v1`：4+4 critical guards、8 个固定 runtime pairs（16 lanes / 12 Organizer decisions）、manifest SHA `ae667f1c...edf61` 与 deterministic baseline payload SHA `d36d0789...d9f4e`。G1 已 zero-provider 落成 manifest/baseline/strict report/scorer/gate，baseline logical report / physical file / eval policy SHA 为 `ad3aa54d...d002 / e8bcbcb5...658b / 1cab7786...399a`；focused `20/20`、Agent full `995/995` 通过。质量门要求 guard `8/8` zero-call、runtime/wire/verified usage `16/16/16/16`、Tutor/Organizer/Combined semantic 各 `>=0.85`、两 lane 相对 subset baseline 各提升 `>=0.15`，且 critical/permission/mutation/broader fallback 为 0。8-sample 不产生 P95 authority，只记录 `3500/5000ms` hard timeout 与 median/max；L2 总 cap `16 calls / 0.176 CNY`。P1/G1/G2 未读 credential、未调用 Provider/正式 Mock/Docker；S2 zero-provider reviewed Mock/static 随后完成，且唯一 L2 已在独立 admission 后封存。详见 `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g1-contract-baseline.md`。

G2 已 zero-provider 完成固定 production CLI、source/approval/dedicated credential gate、guard-first/pair-serial 双 lane runner、external-abort 分类、exclusive marker、dispatch-before-call fsynced hash-chain journal、hard-link artifact、strict recomputing validator 与 crash-only seal。Public CLI 只接收 `args + AbortSignal`；G2 当时要求由未来 L2 admission 创建/绑定 approved tag，因此在 credential/marker 前保持关闭。Recovery 只为当前开放/待锚定 pair 补零-wire reservation 并立即 `attempted_aborted`，其余 pair 为 `not_started_quality_breaker`，不调用 Provider，且不是 resume/replay。G2 focused `32/32`、G1+G2 `52/52`、Agent full `1027/1027`；G2 当时正式 marker/journal/artifact/recovery claim 为 0。其后 S2 与独立 L2 admission 已完成；详见 `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g2-runner-durability.md`。

Phase 6.9.5 的 ReviewAgent / PlannerAgent 已最终完成：V10 controlled-Live 仍是唯一语义质量 authority；V12、V21 和 V22 的 `operation_failed -> recovered` 以及 V13--V20 的安全终态均保留为不可重跑、不可改写的历史。V22 的 Trace 计时耦合修复后，在用户授权下完成了一次独立的 DeepSeek V4 Pro Docker API 与可见 `/plan` 浏览器验收，Review/Planner 都返回 `candidate_applied`；随后已在 main merge commit `3aff6cc` 完成静态、Docker、可见浏览器 default-off 回放。合成账户/Trace 已精确清理，三个模型开关恢复 `false`。该路径只覆盖受限只读 Review/Planner，不代表其余 Agent、可执行 LangGraph 或 Phase 6.9 全部完成。详见 `docs/acceptance/2026-07-20-phase-6-9-5-review-planner-production.md`。

S2 reviewed Mock identity 为 `sha256:8fa86be5416815006b92761fb7b06c1a347fc37e55255a7eee49a417b19b7e6a`；正常路径得到 `8/8` guard、`16/16` runtime/wire/verified usage、semantic `1/1/1` 与 `mock_quality_not_evidence`，focused `35/35`、G1+G2+S2 `87/87`、Agent `1062/1062`、AI `323/323`、Types `42/42 + tsc`、Web `439/439` 通过。Actual 从 model-owned decision 与本地 authority/merger 重建，expected 只进入后置 scorer；25 类 fault、axes drift、locked-name/no-write、父取消和 `3500/5000ms` hard timeout 均 fail-closed。V1--V9/R3/L1 validator 与 SHA parity 保持，正式 L2 marker/journal/artifact/recovery claim 为 0。S2 未读 credential、未调用 Provider、未创建 approved tag、未启动 Docker/API/browser、未合并 main；未来独立 L2 admission 只能针对已推送且 parity 的 commit 创建/绑定 tag，并仍需 fresh 数据边界接受和 exact authorization。详见 `docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-s2-reviewed-mock-static.md`。

唯一 L2 run `6918df4f-a4ae-4de0-aa21-c7614ed5861d` 已在 source commit/tag `4c608445...c22af1c4`、fresh 数据边界接受与 exact authorization 下 durable seal：guard `8/8`，runtime `16/16/0/0`，wire `16/16/16/16`，Tutor/Organizer/Combined semantic `0.9141666666666668 / 1 / 0.9570833333333334`，usage `7032/244`，费用 `0.02256 CNY`，安全失败全 `0`。Gate 为 `small_sample_quality_gate_passed`，authority 为 `small_sample_semantic_gate`；journal `180` 条并以 `evidence_published` 收口，artifact SHA `a1b51f...eb0d`，recovery claim 为 0。8-pair 仍不产生 P95/SLA/产品 authority。L2 不得重跑或追加 Provider 探测。其后 P2 已 zero-provider 冻结全新 72-entry/24-pair/48-runtime full-gate：manifest/baseline authority/eval policy SHA 为 `e68e6e27...12c78 / 2ab1030f...a5f2 / 11371d16...f503`，恢复 24-sample P95、`48 calls / 0.55 CNY` cap、L2 anchor subset、pair-serial/双 lane 与 crash-only durability；P2 未调用 Provider，当时只解锁 F1 full contract/baseline。详见 `docs/acceptance/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`。

Full-gate F1 已在 `zero_provider_full_contract_baseline` authority 下完成：独立 lineage `phase-6.9.7-tutor-organizer-full-gate-v1` 已落成 exact `72 entries / 24 guards / 24 pairs / 48 runtime lanes / 32 decisions` manifest、未修饰 deterministic baseline、安全 baseline writer、strict report/scorer/gate、L2 anchor subset、四项 24-sample nearest-rank P95、预算/安全/不完整聚合与历史 lineage 双向拒绝。Manifest/source baseline/baseline authority/logical report/physical file/eval policy SHA 分别为 `e68e6e27...12c78 / 0ce7c3ca...116ca / 2ab1030f...a5f2 / 16c574b1...2c9 / 16aa1773...6f73 / 11371d16...f503`。Mock/synthetic 固定为 `full_gate_mock_quality_not_evidence / qualityAuthority=none`；只有完整 `deepseek_network` gate pass 才能形成 `full_gate_semantic_gate`。F1 focused `14/14`、Agent full `1076/1076`、typecheck/lint 通过，正式 full-gate marker/journal/artifact/recovery claim 仍为 0；未读 credential、未调用 Provider、未创建 approved tag、未启动 Docker/API/browser、未合并 main。其后 F2 已以 `zero_provider_full_runner_durability_evidence` authority 完成固定 production CLI、source admission、24-guard/24-pair runner、独立 lane 预算/abort/timeout、exclusive marker、fsynced hash-chain journal、hard-link artifact、strict validator 与 crash-only seal；focused `32/32`、Agent full `1108/1108`、typecheck/lint 通过，正式 approved tag/marker/journal/artifact/recovery claim 保持 0。详见 `docs/acceptance/phase-6-9-7-tutor-organizer-f1-full-contract-baseline.md` 与 `docs/acceptance/phase-6-9-7-tutor-organizer-f2-runner-durability-evidence.md`。

Full-gate S3 已完成 zero-provider reviewed Mock/static：factory SHA 为 `sha256:53bcf0d...da55`，48 条 runtime 真实穿过 Tutor V6、Organizer V9、第一方 adapter synthetic fetch、strict validator、本地 merger 与 F2 runner；结果为 guard `24/24`、strict/wire/verified usage `48/48/48/48`、Tutor/Organizer/Combined semantic `1 / 0.9968750000000001 / 0.9984375000000001`、L2 anchor `1/1/1`，安全失败全 0。Gate 固定 `full_gate_mock_quality_not_evidence / qualityAuthority=none`；global fetch/credential/Provider 为 0，正式 approved tag/marker/journal/artifact/recovery claim 为 0。S3 focused `14/14`、Agent `1122/1122`、AI `323/323`、Types `42/42 + tsc`、Web `439/439`、Server build/lint 与非数据库 226 suites/2153 tests 通过；Types lint 因既有包内 eslint/PATH 问题未通过，Server 数据库 suites 因 PostgreSQL `127.0.0.1:5433` 未启动未通过。`@repo/ai` shared runtime barrel 已移除四个 executable CLI re-export，CLI 文件/scripts 保留并由 tests 直接导入，避免 CommonJS/Nest/Jest 解析 `import.meta`。其后 approved tag 已固定并推送到 source commit `3c5cc6c...`；唯一 L3 run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 已正常 runtime publication，但因 `tutor-v2-runtime-11` 在 response/content parse 后发生 `schema` failure 而打开 breaker。终态为 guard `24/24`、runtime `22/22/0/26`、wire `22/22/22/21`、strict `21/48`、`full_gate_quality_gate_failed / qualityAuthority=none`，semantic/P95/token/CNY 全 `null`；journal `296` 条并以 `evidence_published` 收口，validator `ok=true`，recovery claim 为 0。L3 不得重跑、seal、recovery 或追加 Provider 探测；产品 Docker/API/browser、main、Phase 6.9.8 与后续阶段继续阻断。详见 `docs/acceptance/phase-6-9-7-tutor-organizer-s3-reviewed-mock-static.md` 与 `docs/acceptance/phase-6-9-7-tutor-organizer-l3-controlled-live-quality-gate-failure.md`。

Full-gate Schema Recovery SR0--SR3 已在 L3 后以 zero-provider 完成设计冻结、TDD、robustness 与独立
runner/durability checkpoint，authority 分别仅为 `zero_provider_full_gate_schema_recovery_design`、
`zero_provider_full_gate_schema_recovery_tdd`、`zero_provider_full_gate_schema_recovery_robustness` 与
`zero_provider_full_gate_schema_recovery_runner_durability`。只读取证确认
L3 失败位于 `content_parsed` 后、`schema_validated` 前，sealed evidence 不能恢复具体字段或模型原文。新独立 lineage
`phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1` 使用 Provider envelope -> canonical integer
`intentIndex` selection projection -> strict projected decision -> local authority/merger；无权威 extension fields
只形成固定 stage/reason/type/count/shape diagnostic 后丢弃，missing/alias/type/range/duplicate/wrapper 仍
fail-closed，禁止 coercion/default/clamp/retry。Diagnostic 固定 `rawDataRetained=false`，不保存 raw/hash、Zod
path/value、unknown key 名、prompt、credential、用户正文或 oracle。SR1 已新增 exact-schema parser capability、
有界 native JSON parser、strict projection、candidate seam 与测试，冻结 contract SHA
`e2453faeb077faa76ab018a038790cd5a7e73f617be800c0958c098361511579`；最多一次 runtime 调用，继续复用 V6
local signal/preferred depth/answer authority 与 merger。SR2 fixture SHA 为 `43248bfa...0d41e`；prompt-only
responder 不读取 expected/oracle，覆盖全部 24 个 Tutor runtime（含 runtime 11）、18 个 Provider shape、5 个
held-out、Unicode/structure limits、transport/HTTP/audit/usage、budget/abort 与 F2 sibling/breaker。SR3 随后建立
独立 `schema-recovery-v1` report/runner/source/CLI、fsynced schema-stage hash-chain journal、hard-link artifact、
strict validator 与 crash-only recovery；source manifest SHA `1a811394...adfbb`。SR3 focused `23/23`、兼容
`105/105`、Agent `1167/1167`、AI `325/325`、typecheck/lint/Prettier 与旧 L3 validator 均通过。SR1--SR3 均未读取
credential、调用 Provider、执行正式 Mock/Live/Docker/API/browser、创建正式 SR5 tag/marker/journal/artifact 或
修改业务数据。SR4 reviewed Mock/static 随后已完成：独立 factory SHA `8f18c1c2...3d44`，固定
`72/24/48/24/32`，runtime `48/48/0/0`、wire `48/48/48/48`、schema `42 canonical + 6 extension
discarded`、semantic `1/0.996875/0.9984375`、L2 anchor `1`、usage `17732/654` 与 `0.05712 CNY`。Gate
固定 `schema_recovery_mock_quality_not_evidence / qualityAuthority=none`；global fetch、credential、Provider、
正式 SR5 files/tag 与业务写入当时均为 0。以下 SR5 controlled-Live 记录属于 Phase 6.9.7 Full-gate Schema Recovery 历史 lineage，不是当前 Phase 6.9.8 Retriever/FinalResponse SR5 admission。
其后唯一 SR5 controlled-Live run
`63f8a76b-1c2a-403d-b774-0235caae04cb` 已在 approved source/tag `67661f5f...d4441` 上 durable seal：guards
`24/24` zero-call，runtime `48/48/0/0`，wire/strict/usage `48/48/48/48`，schema canonical `48/48`，
Tutor/Organizer/Combined semantic `0.9736111111/0.9515968407/0.9626039759`，paired P95 `2240ms`，usage
`20966/789`，费用 `0.067632 CNY`。最终 `schema_recovery_quality_gate_passed /
schema_recovery_full_gate_semantic_gate`；journal `628`、`evidence_published`、validator `ok=true`、recovery
claim=0。SR5 一次性名额已消费且禁止重跑；它只形成分支评测语义 authority，不形成产品、Docker/API/browser、
Trace、业务写入、SLA 或 main authority。旧 L3 tag/marker/journal/artifact/validator 与 SR4 Mock-only authority
保持不可变。其后 SR6 已在 `providerCalls=0` 边界完成分支产品验收：Tutor `/api/chat` 已切换 Schema Recovery
candidate，Organizer single/batch 已切换 V9 ordinal-only candidate；success/forced failure、Trace/Mock 计费、
owner/locked-name/write isolation、可见浏览器、合成数据精确清理与最终源码 default-off Docker 回放通过。
`sr5_sealed_replay` 只绑定 SR5 artifact SHA，并依据当前 bounded prompt 生成 deterministic Mock output；不读取或
逐字重放 SR5 Provider response/Trace，不提升 SR5 semantic authority。SR7 随后完成 main 合并、远程发布与
default-off Docker/API/可见浏览器/Trace 回放；补齐 Router 的“这一步/这步”关键词后，精确 step-check 句稳定
得到 `route=tutor / step_check`，Tutor candidate 为 `attempted=false / 0 token / LIVE_CALLS_DISABLED /
pricing=unknown`，Trace 为 Mock、成本 0；Organizer 保持 `local_deterministic / gate_disabled` 且不创建 Trace。
两个 main 合成账号及关联数据、tracked Outbox 与浏览器业务数据已精确清理，窗口保留在 `/login`，所有 Agent/
replay/Live gate 继续关闭。Phase 6.9.7 已完成。Phase 6.9.8 Task 0 随后以
`zero_provider_retriever_final_response_design` 完成 Retriever/FinalResponse authority、通信、权限、stream、Trace、
预算与 48-case 质量门冻结。Task 1 又以 `zero_provider_retriever_final_response_shared_contract` 落地 strict principal/
envelope/Retriever/Bundle/FinalResponse schema、hostile-input-safe parser、deep-freeze、owner receipt binding、本地
evidence model projection、stream terminal/citation ledger 与 package export。Task 2 再以
`zero_provider_retriever_final_response_chat_access` 将 `/auth/me` 的 strict `AuthUser.id` 固定为 Chat 唯一
canonical owner，删除 `web-chat-user`，用 WeakMap bearer capability 和 auth response/request/execution context
三引用绑定隔离 token；anonymous Mock、invalid/expired token、跨 owner 并发与 abort 均 fail-closed，Conversation、
RAG 与 owner Trace 复用同一认证 capability。Task 3 又以
`zero_provider_retriever_original_query_deterministic_baseline` 完成正式 Retriever node、WeakMap exact-scope
composition port、canonical bearer `/knowledge/search` adapter 与 16 guard + 16 original-query runtime baseline；
manifest/report SHA 为 `8a1788aa...654d / a1478f22...6442`，Recall@5/nDCG@5/Top1/no-hit/critical recall 为
`1 / 0.813219437888 / 0.571428571429 / 1 / 1`，Qwen/rewrite/FinalResponse/Provider calls 全为 0。Task 4 再以
`zero_provider_verified_evidence_projector` 落成本地 evidence projector：正式 Retriever result、bundle、citation、
FinalResponse request/model projection 均绑定同一个 exact execution context；SafetyGuard 与 Verifier 只允许维持或
收紧证据，blocked/unknown/injection/credential/high-risk/control/cross-owner body 在 bundle 前删除；最多 4 条、
每条 700 UTF-16，citation identity 与 ordinal label 由本地稳定生成。`ragIncluded=false` 时 bundle、allowlist、
citation 与 Markdown 整层清零，Trace 只含固定状态/reason/计数。Task 5 再以
`zero_provider_retriever_query_rewrite_candidate` 完成 default-off DeepSeek V4 Pro non-thinking strict
`{ rewrittenQuery }` candidate、eligibility-before-credential、逐段安全扫描、本地实体/公式/数字/约束 validator、
独立 `1/1200/160` 预算、4000ms/no-retry runtime、Web-only component key 与 Retriever node query 接口；模型不能
修改 owner、`topK/minScore` 或 filter。Reviewed Mock 固定 `qualityAuthority=none`，不构成 rewrite uplift 或 Live
质量证据。Task 6 再以 `zero_provider_final_response_stream_contract` 完成正式 FinalResponseAgent、DeepSeek V4 Pro
non-thinking streaming adapter、strict server-ledger stream/citation terminal、独立 `1/2500/1200` 预算、20000ms/
no-retry、Web-only default-off config/runtime 与 Compose allowlist。Citation/tool/verified usage/cost 继续由本地
authority 生成；客户端断连只记录 delivery failure，不改写已封存的本地 completed terminal，也不声称网络
exactly-once。Task 7 随后以 `zero_provider_chat_composition_terminal_trace` 完成实时 Chat composition 与 terminal
Trace：`/api/chat` 已按 canonical auth -> Router/Tutor -> Retriever/query rewrite -> Verifier -> 本地 evidence
projector -> FinalResponse stream -> terminal Trace 串联正式节点；realtime Trace 使用 minimal start、prepare 与
CAS finalize，stream/parent abort 会清理底层 reader，Retriever transport/schema failure 安全降级为 no-RAG，
principal binding 与 abort 分别保持 403/499。两个模型 gate 仍 default-off，同步流不创建
`BackgroundJob`/`Outbox`。Task 7 未调用 Provider，`qualityAuthority=none`；数据库 E2E 因本地 Redis/PostgreSQL
未运行而标记 `environment_blocked`，未执行 Docker/API/browser、controlled-Live 或 main。Task 8 随后以
`zero_provider_retriever_final_response_reviewed_mock_static` 完成固定 `16 guard + 16 rewrite + 16 FinalResponse`
reviewed Mock/static checkpoint：guard/rewrite/FinalResponse 均 `16/16`，rewrite original/candidate Recall@5 为
`0.875/1`、nDCG@5 为 `0.56923614767/1`，FinalResponse grounded/citation precision/recall/critical notice 均为 `1`，
synthetic DeepSeek 估算 `0.027366 CNY`。Gate 固定 `mock_quality_not_evidence / qualityAuthority=none`；Provider、
credential、Qwen 与正式 marker/journal/evidence/recovery 均为 0，P95/verified aggregate cost 为 `null`。Task 9A
随后以 `zero_provider_qwen_embedding_transport_price_contract` 冻结阿里云百炼北京区
`text-embedding-v4 / 1536 / 0.5 CNY per 1M input tokens`、业务空间/legacy endpoint profile、strict
`prompt_tokens == total_tokens` 与 32 次单文本最坏 `262144 tokens / 0.131072 CNY` cap，并新增 direct
single-call/no-retry/AbortSignal/strict vector+usage+CNY transport。Injected fetch 永久为 `synthetic_test`；Task 9A
未读 credential、未调用 Provider、未创建正式 evidence，`qualityAuthority=none`。Task 9B 随后以
`zero_provider_retriever_final_response_runner_durability` 完成独立 64-call report/gate、16-guard-first、16 个
original-Qwen/rewrite-DeepSeek/candidate-Qwen 串行 pair、16 个 FinalResponse、双 Provider 独立 usage/CNY/null
aggregate、source admission、双 opaque capability、exclusive marker、dispatch-before-call hash-chain journal、
hard-link artifact、strict validator、crash-only seal 与未来 9C CLI。Reviewed Mock 为 guard `16/16`、Qwen/DeepSeek
wire+usage 各 `32/32/32/32`、rewrite original/candidate nDCG@5 `0.56923614767/1`、FinalResponse/safety 全门通过，
但 gate 固定 `task9b_mock_quality_not_evidence / qualityAuthority=none`；Provider/credential/Qwen external calls 与
approved tag/正式 evidence 均为 0。唯一 Task 9C controlled-Live 随后已在 approved source `66a009dd...` 上执行并
由正常 runtime durable seal：run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2` 为 guard `16/16` zero-call、实际
Provider calls `5/64`；Qwen wire/usage `3/3/3/3`、DeepSeek `2/2/1/1`。`rewrite_01` 完整成功，
`rewrite_02` 的 DeepSeek rewrite 在 dispatch 后以 `schema_invalid / wire 1/1/0/0` 失败，breaker 将剩余 59 次
调用收为 `not_started_quality_breaker`。最终 rewrite/FinalResponse strict `1/16 / 0/16`，semantic/P95/token/CNY
aggregate 全 `null`，gate 为 `task9_quality_gate_failed / qualityAuthority=none`。Journal `134` 条并以
`evidence_published` 收口，validator `ok=true`，recovery claim=`null`。该 sealed evidence 只能证明本地 strict
rewrite schema/contract 未满足，不能归因具体 Provider payload、transport、账号或服务端，也不形成产品/main
authority。Task 9C 一次性名额已消费，禁止 retry/resume/replay/backfill、seal/recovery 或追加 Provider 探测；
Task 10/11 与产品/main 继续阻断。独立 Architecture Recovery R0 随后已以
`zero_provider_retriever_final_response_architecture_recovery_design / qualityAuthority=none` 完成设计冻结：新 lineage
同时覆盖 DeepSeek rewrite、Qwen retrieval 与 DeepSeek FinalResponse stream，分离 `providerWire` / `runnerWire`，
diagnostic 只允许固定 stage/reason/type/count bucket 与 `rawDataRetained=false`，明确禁止 raw、unknown key 与
raw-derived hash。R1 又以
`zero_provider_retriever_final_response_architecture_recovery_tdd / qualityAuthority=none` 落成 strict diagnostic、
module-owned opaque rewrite session 与第一方 V7 wire snapshot 只读投影：Provider observation 不再接受调用方状态，
forged/reused/active capability 均 fail-closed；focused `11/11`、AI compatibility `25/25`、Agent full `1289/1289`
通过。R2 随后以
`zero_provider_retriever_final_response_architecture_recovery_robustness / qualityAuthority=none` 新增
`qwen_retrieval` 与 `final_response_stream` 两个第一方 wire family 及 recovery session；Qwen 将 transport/HTTP/
envelope/embedding/usage 分域，FinalResponse 将 transport/HTTP/stream/terminal/false-tool/usage 分域，首个畸形
stream event 固定为 `response_observed + stream_event_invalid`。两个 family 均以 module-owned WeakMap/WeakSet
capability、single claim、严格 stage sequence 与 terminal snapshot 隔离，forged/reused/active/cross-family
fail-closed；focused compatibility `58/58`、AI full `345/345`、Agent full `1301/1301` 通过。R3 随后以
`zero_provider_retriever_final_response_architecture_recovery_runner_durability_admission / qualityAuthority=none`
完成固定 16-guard/64-call report/runner、`providerWire/runnerWire` 双层 accounting、source admission、exclusive
marker、reservation-before-dispatch、fsynced hash-chain journal、hard-link artifact、strict validator、crash-only seal
与 zero-provider maintenance CLI。独立复审后，Rewrite/Qwen/FinalResponse observation 改为三个模块私有 WeakMap
签发并绑定 `callId + phase + family`；共享模块不再导出 callable issuer，forged/active/reused/cross-call/
cross-family/out-of-order 全部 fail-closed。R0--R3 focused `39/39`、Agent full `1318/1318`、AI full
`345/345`、typecheck/lint 通过。R4 随后把 Task 8 production node/ledger 与 prompt-only reviewed Mock 接入 R3
runner，得到 guards `16/16` zero-call、双 wire `64/64/64/64`、diagnostic `64 applied`、rewrite/FinalResponse
`16/16`；gate 固定 `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`。R0--R4 均未读
credential、调用 Provider、创建正式 tag/marker/journal/artifact/recovery claim 或执行产品验收；R5 唯一 controlled-Live 已失败封存（run 34eb99be...），R6 产品/main 与后续阶段继续阻断；不得重跑或追加 Provider 探测。
Phase 6.9.9/6.9.10/6.10/8/9 与博客收尾继续阻断。详见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-full-gate-schema-recovery.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r0-zero-provider-design.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r1-zero-provider-tdd.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r2-zero-provider-robustness.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r3-runner-durability.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r4-reviewed-mock-static.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r5-controlled-live-quality-gate-pass.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr6-product-acceptance.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr7-main-acceptance.md`；Phase 6.9.8 Task 0 见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-agents-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-agents.md` 与
`docs/acceptance/phase-6-9-8-task-0-retriever-final-response-contract.md`、
`docs/acceptance/phase-6-9-8-task-1-shared-communication-contracts.md` 与
`docs/acceptance/phase-6-9-8-task-2-canonical-principal-chat-access.md` 与
`docs/acceptance/phase-6-9-8-task-3-retriever-node-deterministic-baseline.md` 与
`docs/acceptance/phase-6-9-8-task-4-verified-evidence-projector.md` 与
`docs/acceptance/phase-6-9-8-task-5-retriever-query-rewrite-candidate.md` 与
`docs/acceptance/phase-6-9-8-task-6-final-response-stream-contract.md` 与
`docs/acceptance/phase-6-9-8-task-7-chat-composition-terminal-trace.md` 与
`docs/acceptance/phase-6-9-8-task-8-retriever-final-response-reviewed-mock-static.md` 与
`docs/acceptance/phase-6-9-8-task-9a-qwen-embedding-transport-price-contract.md` 与
`docs/acceptance/phase-6-9-8-task-9b-runner-durability-admission.md` 与
`docs/acceptance/phase-6-9-8-task-9c-controlled-live-quality-gate-failure.md`；Architecture Recovery R0--R4 见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-architecture-recovery-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-architecture-recovery.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r0-zero-provider-design.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r1-zero-provider-tdd.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r2-zero-provider-robustness.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md`。

## 项目快照

| 阶段                                         | 状态       | 重点                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0                                      | 已完成     | Monorepo、Prisma 初稿、Docker 基础设施                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 1                                      | 已完成     | 前端 MVP、AI 聊天、OCR、错题本、今日任务、Dexie 本地持久化                                                                                                                                                                                                                                                                                                                                              |
| Phase 2.1                                    | 已完成     | NestJS 后端基础、PostgreSQL、Auth/User API                                                                                                                                                                                                                                                                                                                                                              |
| Phase 2.2                                    | 已完成     | 前端 Auth 接入后端，登录态由后端 session 权威控制                                                                                                                                                                                                                                                                                                                                                       |
| Phase 2.3                                    | 已完成     | WrongQuestion / ChatMessage / OCRRecord API、MinIO 图片链路、Dexie mutationQueue                                                                                                                                                                                                                                                                                                                        |
| Phase 2.5                                    | 已完成     | Chat-first 产品壳层、注册登录页、个人中心、今日任务、错题本和聊天体验打磨                                                                                                                                                                                                                                                                                                                               |
| Phase 3                                      | 已完成     | OCR structured output、AI 讲题 prompt、多题保存、tool action proposal 边界                                                                                                                                                                                                                                                                                                                              |
| Phase 4.1                                    | 已完成     | WrongQuestion-first FSRS 复习闭环、Review API、今日复习卡                                                                                                                                                                                                                                                                                                                                               |
| Phase 4.2                                    | 已完成     | 学习统计页、Review stats/logs API、复习趋势与最近记录                                                                                                                                                                                                                                                                                                                                                   |
| Phase 4.3                                    | 已完成     | ReviewTask 持久化任务流、今日任务迁移、评分完成、跳过和恢复                                                                                                                                                                                                                                                                                                                                             |
| Phase 4.4                                    | 已完成     | 离线评分队列、服务端幂等评分、今日复习待同步状态和 in-app 提醒摘要                                                                                                                                                                                                                                                                                                                                      |
| Phase 4.5.1                                  | 已完成     | 复习计划预览、`/review-tasks/plan`、`/plan` 页面、`/stats` ECharts 图表                                                                                                                                                                                                                                                                                                                                 |
| Phase 4.5.2                                  | 已完成     | `ReviewPreference`、加权压力模型、7 / 14 天计划窗口、今日容量摘要                                                                                                                                                                                                                                                                                                                                       |
| Phase 5.0                                    | 已完成     | RAG 知识库设计、可降级 Chat 边界、Phase 5.1 实施计划                                                                                                                                                                                                                                                                                                                                                    |
| Phase 5.1                                    | 已完成     | RAG 数据模型、`vector(1536)` 索引预留、knowledge API contract                                                                                                                                                                                                                                                                                                                                           |
| Phase 5.2                                    | 已完成     | 文档上传、列表、详情、删除与状态 API                                                                                                                                                                                                                                                                                                                                                                    |
| Phase 5.3                                    | 已完成     | 文档解析、分块、embedding 入库、`POST /knowledge/documents/:id/process`                                                                                                                                                                                                                                                                                                                                 |
| Phase 5.4                                    | 已完成     | 检索 API、`POST /knowledge/search`、query embedding + pgvector 相似度搜索                                                                                                                                                                                                                                                                                                                               |
| Phase 5.5                                    | 已完成     | Chat RAG 增强、知识库上下文注入、Markdown citations                                                                                                                                                                                                                                                                                                                                                     |
| Phase 5.6                                    | 已完成     | `/knowledge` 学习资料工作台、上传/处理/替换/删除/检索测试前端闭环                                                                                                                                                                                                                                                                                                                                       |
| Phase 6.0                                    | 已完成     | Agent Runtime 地基、共享 Agent contract、RouterAgent、阈值 guard、recorder、graph descriptor                                                                                                                                                                                                                                                                                                            |
| Phase 6.1                                    | 已完成     | RouterAgent 接入 `/api/chat`、Agent route headers、route-aware prompt、mock route 展示                                                                                                                                                                                                                                                                                                                  |
| Phase 6.2                                    | 已完成     | TutorAgent 策略层、讲题意图分类、策略 prompt、mock strategy metadata                                                                                                                                                                                                                                                                                                                                    |
| Phase 6.3                                    | 已完成     | KnowledgeVerifierAgent、RAG 资料可信度评估、资料核对提示、verifier headers                                                                                                                                                                                                                                                                                                                              |
| Phase 6.4                                    | 已完成     | WrongQuestionOrganizerAgent、错题学科卡片、专题 deck、错题组织层 API                                                                                                                                                                                                                                                                                                                                    |
| Phase 6.5                                    | 已完成     | ReviewAgent / PlannerAgent、复习分析、学习计划建议、只读 suggestions API                                                                                                                                                                                                                                                                                                                                |
| Phase 6.6                                    | 已完成     | MemoryAgent、长期记忆候选、人审确认、停用/恢复/删除管理                                                                                                                                                                                                                                                                                                                                                 |
| Phase 6.7                                    | 已完成     | Agent Trace UI、估算成本看板、固定 deterministic eval set                                                                                                                                                                                                                                                                                                                                               |
| Phase 6.8                                    | 已完成     | KnowledgeDedupAgent / KnowledgeOrganizerAgent、资料重复/新版/互补判断、只读 suggestions API、`/knowledge` 建议面板                                                                                                                                                                                                                                                                                      |
| Phase 6.9.1                                  | 已完成     | Agent eval contract、32 个 seed cases、deterministic baseline、paired eval 报告模板                                                                                                                                                                                                                                                                                                                     |
| Phase 6.9.2                                  | 已完成     | 共享 `ModelAgentRuntime`、结构化 Mock/Live contract、不可变预算、超时取消、脱敏 Trace                                                                                                                                                                                                                                                                                                                   |
| Phase 6.9.3.1                                | 已完成     | ConversationSummary / ConversationState strict contract 与 PostgreSQL/Prisma 地基                                                                                                                                                                                                                                                                                                                       |
| Phase 6.9.3.2                                | 已完成     | ConversationState 权威读写、Redis 降级缓存、prepare API 与 Chat history state 恢复                                                                                                                                                                                                                                                                                                                      |
| Phase 6.9.3.3                                | 已完成     | 12 条/70% 滚动摘要、凭据防护、ModelAgentRuntime composition、source hash 与 CAS                                                                                                                                                                                                                                                                                                                         |
| Phase 6.9.3.4                                | 已完成     | Web prepare 编排、分层 context assembler、Dexie v9 sanitized state 恢复与安全观测                                                                                                                                                                                                                                                                                                                       |
| Phase 6.9.3.5                                | 已完成     | Docker Mock/Live 真实验收、DeepSeek JSON structured output、Trace 分层 token、清理与阶段证据                                                                                                                                                                                                                                                                                                            |
| Phase 6.9.4.1                                | 已完成     | Router 60 / Verifier 40 扩展评测集、专项 metrics、deterministic baseline 与安全 CLI                                                                                                                                                                                                                                                                                                                     |
| Phase 6.9.4.2                                | 已完成     | Router / Verifier Mock candidate、零调用安全门、strict schema、不可变预算与安全降级                                                                                                                                                                                                                                                                                                                     |
| Phase 6.9.4.3                                | 验收未完成 | JSON-mode 完整 Live 已完成；28/28、72/72 通过但 Router P95 延迟失败，当时结论为 terminal deterministic fallback                                                                                                                                                                                                                                                                                         |
| Phase 6.9.4.4                                | 已完成     | Router/Verifier 混合生产接入；Task 10 已合并 main 并完成静态、Docker、真实模型、可见浏览器、Trace 价格与精确清理复验                                                                                                                                                                                                                                                                                    |
| Phase 6.9.5                                  | 已完成     | Review/Planner 受限真实模型只读路径已完成 V10 语义质量、独立真实模型、main Docker/可见浏览器 default-off 回放与两轮精确清理                                                                                                                                                                                                                                                                             |
| Phase 6.9.6.1                                | 已完成     | 72-case Knowledge 数据集、固定指标、deterministic baseline `12/48`、semantic `0.2322452551`；该检查点当时未实现 candidate                                                                                                                                                                                                                                                                               |
| Phase 6.9.6 Task 2                           | 已完成     | Dedup/Organizer strict schema、动态关联校验、`knowledge-model-projection-v1`、完整字段先扫描与 ordinal-only 深冻结投影；该任务当时未接 runtime                                                                                                                                                                                                                                                          |
| Phase 6.9.6 Task 3                           | 已完成     | Dedup 受治理 candidate、本地权威 merger、exact-hash provider 前 0-call、语义关系只读裁决与全失败 deterministic fallback；仅无网络 executor                                                                                                                                                                                                                                                              |
| Phase 6.9.6 Task 4                           | 已完成     | Organizer 受治理 candidate、本地权威 merger、标签/集合限制、post-schema 安全拒绝与全失败 deterministic fallback；仅无网络 executor                                                                                                                                                                                                                                                                      |
| Phase 6.9.6 Task 5                           | 已完成     | owner-scoped `REPEATABLE READ` + `READ ONLY` 不可变快照、域分离 HMAC owner、完整 fingerprint 与 provider 前 stale fence；Task 5 范围不含 shortlist/runtime                                                                                                                                                                                                                                              |
| Phase 6.9.6 Task 6                           | 已完成     | owner-scoped Qwen pgvector shortlist、每资料 6 个稳定采样 Chunk、top-3 mean、最多 12 pair、provenance/safety/漂移 fail-closed；Task 6 范围不含 provider/gate                                                                                                                                                                                                                                            |
| Phase 6.9.6 Task 7                           | 已完成     | 两个 default-off server gate、DeepSeek V4 Pro non-thinking runtime、精确价格/cap、冻结 2-call 共享预算；尚未编排到 API                                                                                                                                                                                                                                                                                  |
| Phase 6.9.6 Task 8                           | 已完成     | 独立 gate 并行 dispatch、二次 stale fence、strict runtime metadata、parent+2-step Trace 与 HTTP abort 传播；未做 UI/eval/Live                                                                                                                                                                                                                                                                           |
| Phase 6.9.6 Task 9                           | 已完成     | `/knowledge` 只读来源状态：语义建议、本地规则、降级回退；移动端换行与无 mutation/retry 泄露测试                                                                                                                                                                                                                                                                                                         |
| Phase 6.9.6 Task 10                          | 已完成     | 72-case Mock/Live paired runner、24 条 guard 实际 zero-call、strict evidence/usage/CNY validator 与一次性 Live 授权门；尚未调用 provider                                                                                                                                                                                                                                                                |
| Phase 6.9.6 Task 11                          | 已完成     | API-only Knowledge Docker gate/timeout/独立 credential、worker 零 executor 与完整运维/回滚文档；尚未启动容器或调用 provider                                                                                                                                                                                                                                                                             |
| Phase 6.9.6 Task 12                          | 已完成     | 分支 focused/full/static、72-case deterministic/Mock、strict evidence validator 与 checkpoint 文档；尚未调用 provider 或执行产品 Docker/浏览器验收                                                                                                                                                                                                                                                      |
| Phase 6.9.6 V2 Live                          | 已完成     | 唯一 V2 run `10ae2f36...` 为 72-case、24/24 zero-call、48/48 runtime、semantic `0.9875`、`quality_gate_passed`；不得重跑                                                                                                                                                                                                                                                                                |
| Phase 6.9.6 Task 13                          | 已完成     | 唯一 V2 Live、R7 Docker/API 与可见 `/knowledge` 分支验收保持不可变；main `f31335c6` 已完成 focused、Docker/API、可见浏览器 default-off 回放、精确清理与远程推送                                                                                                                                                                                                                                         |
| Phase 6.9.7 Task 0                           | 已完成     | Tutor/WrongQuestionOrganizer 专项设计、72-case/预算/权限/写隔离门槛已冻结；Task 0 后另有 13 个原子执行/验收任务，尚未实现 candidate 或调用 provider                                                                                                                                                                                                                                                     |
| Phase 6.9.7 Task 1                           | 已完成     | 72-case/32-decision dataset、专项指标与未修饰 deterministic baseline 已冻结；`6/48` 完整命中、Tutor `0.4418666667`、Organizer `0.278125`、critical/provider/cost `0`                                                                                                                                                                                                                                    |
| Phase 6.9.7 Task 2                           | 已完成     | Tutor/Organizer strict 输出、动态 ordinal/subject 关联、完整字段安全扫描、ordinal-only 深冻结投影与共享 descriptor clone hardening；尚未接 runtime/provider                                                                                                                                                                                                                                             |
| Phase 6.9.7 Task 3                           | 已完成     | Tutor 受治理 candidate、五类明确指令 zero-call、冻结 12+24 eligibility、`1/1200/300` 预算、strict runtime 与本地权威 merger；尚未接产品/provider                                                                                                                                                                                                                                                        |
| Phase 6.9.7 Task 4                           | 已完成     | WrongQuestionOrganizer 受治理 candidate、最多 12 题/20 deck、`1/3500/800`、ordinal-only strict runtime 与本地权威 merger；尚未接产品/provider                                                                                                                                                                                                                                                           |
| Phase 6.9.7 Task 5                           | 已完成     | Tutor Web server-only default-off runtime、final-route Chat 编排、独立 `1/1200/300` 预算、安全 header/Trace 与 web-only Docker allowlist；尚未 controlled-Live                                                                                                                                                                                                                                          |
| Phase 6.9.7 Task 6                           | 已完成     | Organizer `REPEATABLE READ + READ ONLY` owner snapshot、事务外双 fence、advisory-lock 第三 fence、model-free command、用户 authority 与并发 E2E；无 provider                                                                                                                                                                                                                                            |
| Phase 6.9.7 Task 7                           | 已完成     | Organizer server-only default-off DeepSeek runtime、single/batch 单次 dispatch、独立 `1/3500/800` 预算、两阶段 Trace 与 HTTP abort；无 provider/controlled-Live                                                                                                                                                                                                                                         |
| Phase 6.9.7 Task 8                           | 已完成     | Organizer strict request-level runtime、single/batch Zod fail-closed 与 `/error-book` 语义/本地/安全回退来源状态；无 provider/controlled-Live                                                                                                                                                                                                                                                           |
| Phase 6.9.7 Task 9                           | 已完成     | 72-case strict paired runner、24/24 guard zero-call、48/48 Mock runtime、一次性 CLI、executor provenance 与 evidence validator；无 provider/controlled-Live                                                                                                                                                                                                                                             |
| Phase 6.9.7 Task 10                          | 已完成     | Tutor→web、Organizer→server 的 Docker allowlist、tracked default-off example、worker/admin 隔离与运维回滚；无 provider/Docker service/API/浏览器                                                                                                                                                                                                                                                        |
| Phase 6.9.7 Task 11                          | 已完成     | 分支 focused/full/static、deterministic baseline、fresh strict Mock、Organizer PostgreSQL E2E、Compose quiet config 与双路终审；无 provider/Live/产品 Docker/浏览器                                                                                                                                                                                                                                     |
| Phase 6.9.7 Task 12 V1 Live                  | 失败封存   | 唯一 run `39a62241...` 为 24/24 zero-call、27/48 strict runtime；Tutor/Organizer semantic `0.3485119048/0.7`，最终 `quality_gate_failed`；不得重跑，未进入产品 Docker/API/浏览器                                                                                                                                                                                                                        |
| Phase 6.9.7 V2 R0                            | 已完成     | 零网络复盘 V1，冻结 prompt/validator 单一规则源、有界阶段诊断、anti-overfit、独立 runner/marker/evidence 与 R1--R11 原子计划；未改源码、读取密钥或调用 provider                                                                                                                                                                                                                                         |
| Phase 6.9.7 V2 R1                            | 已完成     | versioned bounded diagnostics、Tutor/Organizer 分域 reason、V1 字段 absent 兼容与 runner/prompt identity 绑定；当前 runner 仍只生成 V1，未调用 provider/Docker                                                                                                                                                                                                                                          |
| Phase 6.9.7 V2 R2                            | 已完成     | Tutor 五类 intent 深冻结单一 policy、validator/prompt/merger 共用、v2 prompt identity 与逐 intent depth fail-closed；未发布 V2 runner/evidence                                                                                                                                                                                                                                                          |
| Phase 6.9.7 V2 R3                            | 已完成     | Organizer subject/deck/evidence/confidence/taxonomy/topic 规则收敛为深冻结单一 policy；v2 identity 已接 Server/Trace，公共 runner 仍为 V1                                                                                                                                                                                                                                                               |
| Phase 6.9.7 V2 R4                            | 已完成     | 独立 held-out/metamorphic fixtures、实际 candidate prompt 泄漏扫描、authority 变化/fail-closed；dataset/SHA/V1 evidence 不变                                                                                                                                                                                                                                                                            |
| Phase 6.9.7 V2 R5                            | 已完成     | 独立 runner-v2、双向隔离 CLI/validator/授权/marker/evidence prefix、exclusive-create 与 V1 历史兼容                                                                                                                                                                                                                                                                                                     |
| Phase 6.9.7 V2 R6                            | 已完成     | 分支 static/Mock、marker/evidence 并发故障恢复、Chat/Organizer 取消与失败终态、同题跨路由 PostgreSQL 收敛；R7 前置已关闭                                                                                                                                                                                                                                                                                |
| Phase 6.9.7 V2 R7                            | 失败封存   | 唯一 run `67ce18dd...` 为 24/24 zero-call、0/48 strict runtime、Tutor/Organizer semantic `0/0`、verified usage `0`，最终 `quality_gate_failed`；不得重跑，未进入 R8 产品验收                                                                                                                                                                                                                            |
| Phase 6.9.7 V3 R0                            | 已完成     | 零 Provider 复盘确认 runtime 已有安全 failure taxonomy 但 paired evidence 丢失，冻结首个 runtime contract failure 即熔断、固定分母、双 lane 隔离、journal/crash seal、独立 V3 lineage 与 R1--R9 原子计划；未改源码或调用 Provider                                                                                                                                                                       |
| Phase 6.9.7 V3 R1                            | 已完成     | 固定 Provider category/stage 与十阶段执行证据、真实 0/1 invocation recorder、outer-harness local failure、V1/V2 absent-field 兼容及 config/factory/request/response/schema/abort 零网络 harness；当时下一步为 R2，后续已完成                                                                                                                                                                            |
| Phase 6.9.7 V3 R2                            | 已完成     | 24 guard 先行、固定 72/24/48 分母、首个 runtime contract failure 熔断、单 dispatch ledger、双 lane abort/预算/故障归属隔离、sibling orphan 有界收口及 usage/P95/费用不完整 fail-closed；后续 R3 已完成                                                                                                                                                                                                  |
| Phase 6.9.7 V3 R3                            | 已完成     | 独立 V3 CLI/授权/marker、dispatch-before-call hash-chain journal、活 owner 防误封、单胜者 recovery claim、零网络 orphan seal、hard-link evidence 与三版 validator 隔离；后续 R4 已完成                                                                                                                                                                                                                  |
| Phase 6.9.7 V3 R4                            | 已完成     | fresh Mock `24/24` zero-call、`48/48` strict runtime、semantic `1/1`；首失败 breaker 仅 2 lane 调用并保持固定 48 分母；全量静态、PostgreSQL E2E、历史 SHA/validator 与两路复审通过；当时等待新的 V3 Live 精确授权                                                                                                                                                                                       |
| Phase 6.9.7 V3 R5                            | 失败封存   | 唯一 run `ff2e1a54...` 为 `24/24` zero-call、`27/48` strict runtime；Organizer `subject_authority_violation` 触发 breaker，Tutor/Organizer semantic `0.5280555556/0.4376201923`，最终 `quality_gate_failed`；不得重跑或进入 R6--R9                                                                                                                                                                      |
| Phase 6.9.7 V4 R0                            | 已完成     | 零 Provider 复盘区分 executed semantic mismatch、dynamic contract failure 与 breaker 未执行项；冻结 V4 diagnostics、Tutor/Organizer 同源语义 policy、anti-overfit、独立 lineage 与 R1--R9 计划；未改源码或调用 Provider                                                                                                                                                                                 |
| Phase 6.9.7 V4 R1                            | 已完成     | 独立 V4 case/report bounded diagnostics、四类执行终态、七类 contract stage、Tutor/Organizer 固定轴、Organizer 单一 validator reason 链、merger result 复用与 V1/V2/V3 absent/strict/SHA 兼容；全程 zero-network；后续 R2 已完成                                                                                                                                                                         |
| Phase 6.9.7 V4 R2                            | 已完成     | Tutor `step > explain > concept > hint > general` 深冻结 policy；V4 formatter/validator/depth/merger 与本地 strategy invariants 同源，active context 不得降级具体 intent；deterministic baseline 与 V2/V3 prompt SHA 保持不变；后续 R3 已完成                                                                                                                                                           |
| Phase 6.9.7 V4 R3                            | 已完成     | Organizer subject/deck/topic/evidence/confidence 共用深冻结 V4 决策矩阵；merger 不补 evidence、不纠正越权 subject、不清洗非法 topic；owner/ordinal/locked-name/stale-fence/预算/abort/no-retry 不变；后续 R4 已完成                                                                                                                                                                                     |
| Phase 6.9.7 V4 R4                            | 已完成     | 独立 held-out/metamorphic/schema-negative robustness、实际 prompt 防泄漏、authority/reorder/abort/预算/写隔离，以及 V4 marker/journal/recovery/evidence lineage 已完成；Live CLI 在 R6 前硬拒绝                                                                                                                                                                                                         |
| Phase 6.9.7 V4 R5                            | 已完成     | fresh Mock `24/24` zero-call、`48/48` strict runtime、semantic `1/1/1`；全量静态、PostgreSQL E2E、Compose default-off、历史 SHA/validator、零残留与两路终审通过；该检查点当时停在 R6 新精确 Live 授权门前                                                                                                                                                                                               |
| Phase 6.9.7 V4 R6                            | 失败封存   | 唯一 run `0fb47591...` 为 `24/24` zero-call、`10/48` strict runtime；Tutor `invalid_evidence_association` 触发 breaker、Organizer sibling abort，后续 36 runtime 未启动；`quality_gate_failed`，不得重跑或进入 R7--R9                                                                                                                                                                                   |
| Phase 6.9.7 V5 R0                            | 已完成     | 零 Provider 差分取证确认 V1 Tutor fixture 存在跨题/跨语言 context 与错误 language tag；合法/非法 evidence 在产品 candidate 与 bounded diagnostic 结论一致，排除 adapter 单独误判；冻结独立 V2 dataset、双语 Tutor、Organizer ordinal shortlist 与 V5 R1--R8 计划                                                                                                                                        |
| Phase 6.9.7 V5 R1                            | 已完成     | 独立 V2 dataset `42803d45...`、fail-fast coherence、prompt-safe projection、policy `b3913403...` 与 baseline `0ce7c3ca...` 已冻结；`12/48` complete、semantic `0.6629642857/0.278125/0.4705446429`，全程 zero-provider；后续 R2/R3 已完成                                                                                                                                                               |
| Phase 6.9.7 V5 R2                            | 已完成     | Tutor local authority rules `a1e9a3b...`、prompt policy `7c7442ff...`、32 条 held-out `d08e8ed5...` 已冻结；24/24 V2 runtime intent 命中，模型仅选 intent/depth/confidence；未接 product/provider/gate；后续 R3 已完成                                                                                                                                                                                  |
| Phase 6.9.7 V5 R3                            | 已完成     | Organizer shortlist rules `9747383...`、prompt `915084a8...`、24 条 held-out `49336b12...` 已冻结；32 个 V2 decision、reorder/分页/去重/ABA/stale/cross-subject 通过；模型只选 subject/deck/topic ordinal，未接 product/provider/gate/runner                                                                                                                                                            |
| Phase 6.9.7 V5 R4                            | 已完成     | 原生 V5 72/24/48/24/32 runner、CLI/marker/hash-chain journal/hard-link evidence/validator、双 lane/首错 breaker、unknown usage null aggregate、orphan/recovery/ABA 与历史双向隔离已完成；synthetic Live 固定失败                                                                                                                                                                                        |
| Phase 6.9.7 V5 R5                            | 已完成     | reviewed Mock factory；fresh baseline `12/48`、Mock `24/24` zero-call 与 `48/48` strict runtime、semantic `1/1/1`；受影响静态、PostgreSQL `12/12`、Compose default-off、历史 SHA/validator、V5 artifact=0 与双终审通过；该条为 R6 前 zero-provider checkpoint                                                                                                                                           |
| Phase 6.9.7 V5 R6                            | 失败封存   | 唯一 run `aa637d3a...` 为 `deepseek_network`、`24/24` guard zero-call、12 次调用、`11/48` strict runtime；第 6 对 Tutor `3021ms > 3000ms` timeout 后熔断，后续 36 runtime 未启动；正式聚合均 `null`，不得重跑或进入 R7/main/Phase 6.10                                                                                                                                                                  |
| Phase 6.9.7 V6 R0                            | 已完成     | 零 Provider 复盘冻结 Tutor `3500ms` hard timeout/`2500ms` P95 分离、Organizer `5000/4500ms` 不变、Tutor preferred-depth 与 Organizer confidence 本地 authority、model-owned axes、独立 V6 lineage 与 R1--R7 计划；无 source/runtime/Provider/Docker                                                                                                                                                     |
| Phase 6.9.7 V6 R1                            | 已完成     | 独立 dataset/eval/deadline、固定 24-sample P95 与 complete-only null aggregate、Tutor depth/Organizer confidence local authority、model-owned `21/24` 与三轴 `28/32` 已冻结；无 candidate/composition/runner/Mock/Live/Provider/Docker                                                                                                                                                                  |
| Phase 6.9.7 V6 R2                            | 已完成     | Tutor intent-only 与 Organizer ordinal-only bounded candidate、实际 owner shortlist 双 stale fence、本地 depth/confidence/真实 ID/locked-name authority、独立 robustness/prompt-leakage 与公共 merger 二次校验；无 runner/Mock/Live/Provider/Docker                                                                                                                                                     |
| Phase 6.9.7 V6 R3                            | 已完成     | 独立 runner/CLI/approval、固定分母/双 lane/breaker/deadline、marker/hash-chain journal/hard-link evidence/recovery、complete-only 聚合与 V1--V5 双向 lineage；无正式 Mock/Live artifact/Provider/产品接线                                                                                                                                                                                               |
| Phase 6.9.7 V6 R4                            | 已完成     | reviewed Mock factory；fresh baseline `12/48`、Mock `24/24` zero-call 与 `48/48` strict runtime、semantic/model-owned `1/1/1`；全量静态、PostgreSQL `12/12`、Compose default-off、历史 validator 与 V6 Live artifact=0 通过；无 Provider/产品验收                                                                                                                                                       |
| Phase 6.9.7 V6 R5                            | 失败封存   | 唯一 run `b18a0a13...` 为 `24/24` guard zero-call、2 次 Provider invocation、`0/48` strict runtime；首个 Tutor `provider_runtime / unknown`，Organizer sibling aborted，正式聚合全 `null`；证据已 seal，不得重跑或进入 R6/R7/main                                                                                                                                                                       |
| Phase 6.9.7 V7 R0                            | 已完成     | 零 Provider 复盘冻结第一方 V4 Pro direct adapter、8-stage wire evidence、executor/dispatch/response/usage 独立计数、failure taxonomy 与 R1--R6 路线；未改源码、读取 credential、调用 Provider 或启动产品 Docker/API/browser                                                                                                                                                                             |
| Phase 6.9.7 V7 R1                            | 已完成     | 第一方 `deepseek-v4-pro` direct adapter、固定 non-thinking JSON request、8-stage 单调 wire capability、四类计数与穷尽 failure 投影；V6 Tutor/Organizer schema/prompt SHA 兼容，全程 zero-provider，未创建 runner/artifact 或接产品                                                                                                                                                                      |
| Phase 6.9.7 V7 R2                            | 已完成     | 独立 V7 report/runner/CLI/approval、固定分母/guard-first/双 lane/breaker、marker/hash-chain journal/hard-link evidence/recovery、四类 wire 计数重算与 V1--V6 双向 lineage；未执行正式 Mock/Live、Provider、Docker/API/browser 或创建 V7 artifact                                                                                                                                                        |
| Phase 6.9.7 V7 R3                            | 已完成     | 真实 V6 candidate/prompt/schema/merger + direct adapter 的 fault matrix；Mock `24/24` guard、`48/48` strict、semantic/model-owned `1/1/1`、wire `48/48/48/48`；全量门通过，无 Provider/产品验收                                                                                                                                                                                                         |
| Phase 6.9.7 V7 R4                            | 失败封存   | 唯一 run `81529c2c...` 为 `24/24` guard、`1/48` strict；Tutor 8-stage success，Organizer `provider_type_validation` 后熔断，wire `2/2/2/1`，正式聚合全 `null`；不得重跑或进入 R5/R6/main                                                                                                                                                                                                                |
| Phase 6.9.7 V8 R0                            | 已完成     | 零 Provider 复盘冻结 fixed-shape Organizer ordinal contract、脱敏字段级 diagnostic、Provider-like schema-negative/anti-overfit matrix、独立 V8 identity 与 R1--R7 路线；未实现源码、runner、Mock/Live 或产品接线                                                                                                                                                                                        |
| Phase 6.9.7 V8 R1                            | 已完成     | 固定四字段 Organizer schema/prompt/dynamic validator、V6 merger runtime adapter 与 bounded no-raw diagnostic 已实现；保留预算/usage/Trace/stale/local authority，focused/static/历史 evidence validators 通过，全程 zero-provider                                                                                                                                                                       |
| Phase 6.9.7 V8 R2                            | 已完成     | 独立 held-out/Provider-like/metamorphic fixture、原生 JSON schema identity policy、首/中/尾 malformed decision、动态 authority/stale/no-leak/anti-overfit 已通过 synthetic direct adapter；V7 兼容与历史 validator 不变，全程 zero-provider                                                                                                                                                             |
| Phase 6.9.7 V8 R3                            | 已完成     | 独立 runner/report/CLI/artifact lineage、V1--V7 双向隔离、V7 8-stage wire 复用、bounded diagnostic 强制、breaker-aware recovery 与正式 artifact=0；全程 zero-provider，下一步仅 R4 Mock/full checkpoint                                                                                                                                                                                                 |
| Phase 6.9.7 V8 R4                            | 已完成     | reviewed Mock/full checkpoint：`24/24` guard、`48/48` strict、semantic/model-owned `1/1/1`、wire `48/48/48/48`；全量门、精确清理与 artifact=0 通过；无 Provider/产品验收                                                                                                                                                                                                                                |
| Phase 6.9.7 V8 R5                            | 失败封存   | 唯一 run `7ff09c36...` 为 `24/24` guard、wire `4/4/4/4`、`3/48` strict；第二条 Organizer fixed-shape 通过后命中 `dynamic_authority`，正式聚合全 `null`；不得重跑，R6/R7/main 被阻断                                                                                                                                                                                                                     |
| Phase 6.9.7 V9 R0                            | 已完成     | zero-provider 复盘冻结本地合法 option authority、模型 exact `questionIndex + optionIndex`、本地 fingerprint/V6 merger、bounded diagnostic、独立 V9 lineage 与 R1--R7 路线；未实现源码/Provider/Mock/Live/产品接线                                                                                                                                                                                       |
| Phase 6.9.7 V9 R1                            | 已完成     | 本地合法 option builder/projection、exact selection contract/prompt、V6 adapter/merger 与 bounded no-raw diagnostic 已实现；focused/full/static/历史 validators 与双路复审通过，全程 zero-provider                                                                                                                                                                                                      |
| Phase 6.9.7 V9 R2                            | 已完成     | 独立 Provider-like/held-out/metamorphic/security/stale/abort/write-authority robustness；strict JSON、schema disposition 与无副作用 sanitizer 修复；focused/full/static/历史 validators 通过，全程 zero-provider                                                                                                                                                                                        |
| Phase 6.9.7 V9 R3                            | 已完成     | 独立 runner/lineage/durability、固定分母、8-stage wire/runtime accounting、durable lane reservation、hash-chain journal/hard-link evidence/crash-only recovery 与 synthetic fault matrix；正式 V9 artifact=0，全程 zero-provider                                                                                                                                                                        |
| Phase 6.9.7 V9 R4                            | 已完成     | reviewed Mock 穿过正式 V6 Tutor、V9 Organizer option selection、V6 validator/merger 与 direct adapter；`24/24` guard、`48/48` strict、semantic `1/1/1`、wire `48/48/48/48`；全量门、精确清理与 artifact=0 通过，无 Provider/产品验收                                                                                                                                                                    |
| Phase 6.9.7 V9 R5                            | 失败封存   | 唯一 run `c530ca02...` 为 `24/24` guard、wire `2/2/0/0`、`0/48` strict；Tutor 在 response 前 `provider_runtime / transport`，Organizer sibling `post_dispatch_abort`；正式聚合全 `null`，artifact 已 seal，不得重跑或进入 R6/R7/main                                                                                                                                                                    |
| Phase 6.9.7 Recovery R1                      | 已完成     | 独立 transport diagnostic adapter 包装 sealed V1；固定九类 subtype、own-data/四层 cause/无 getter/raw error 边界与 synthetic RED/GREEN 已完成；不改 V1--V9 artifact/report/validator，未接 canary/产品或调用 Provider                                                                                                                                                                                   |
| Phase 6.9.7 Recovery R2                      | 已完成     | 独立 fact-free canary request/report/artifact contract、封闭 synthetic runner、安全 CLI、每次 `1/512/16` 与 `0.002 CNY` cap、`21/21` fault matrix；无 fetch/transport 注入口、无 credential/Provider/正式 artifact，`synthetic_test` 不证明 Provider 健康                                                                                                                                               |
| Phase 6.9.7 Recovery R3                      | 失败封存   | 唯一 run `253a5df5...` 已正常 seal；`transport_failed / connection_refused`、wire `1/1/0/0`、无 Response/usage/CNY，artifact SHA `56fb5b1d...e6c4`、无 recovery claim；不得重跑，R4 被阻断，下一步仅 zero-provider proxy/preflight 复盘                                                                                                                                                                 |
| Phase 6.9.7 Proxy Preflight                  | 已完成     | 独立 zero-provider proxy authority/listener 门；direct 或一致 loopback HTTP proxy + 250ms listener 才 ready，实际为 `loopback_proxy_unavailable / 4 / 1 / 0`；不证明 Provider health，不解除任何 Live/产品阻断                                                                                                                                                                                          |
| Phase 6.9.7 Canary V2 D0                     | 已完成     | Proxy listener 恢复后 preflight 为 `loopback_proxy_ready / 4 / 1 / 0`；冻结独立 Provider Canary V2 re-entry 设计、执行顺序、专用身份与 L1 精确授权门；全程 zero-provider，当时下一任务为 C1                                                                                                                                                                                                             |
| Phase 6.9.7 Canary V2 C1                     | 已完成     | 独立 V2 zero-network request/attestation/budget/report、opaque single-consume capability、15-case closed fault matrix 与安全 CLI；所有 downstream/wire 为 0；该 checkpoint 当时下一任务仅 C2                                                                                                                                                                                                            |
| Phase 6.9.7 Canary V2 C2                     | 已完成     | 独立 source/one-shot CLI、固定 production composition、exclusive marker、hash-chain journal、hard-link artifact/validator、crash-only single-winner seal 与 R3 双向隔离；全程 zero-provider                                                                                                                                                                                                             |
| Phase 6.9.7 Canary V2 S1                     | 已完成     | C2 `32/32`、Recovery `91/91`、AI `323/323`、静态门、R3 validator/SHA、正式 V2 artifact=0 与独立终审通过；该 checkpoint 当时停在 L1 授权门                                                                                                                                                                                                                                                               |
| Phase 6.9.7 Canary V2 L1                     | 已完成     | 唯一 run `dc09214c...` 为 `complete / strict_response_with_verified_usage`，wire `1/1/1/1`、usage `49/5`、费用 `0.00017700 CNY`、artifact `98368de...a7e4`；`qualityAuthority=none`，不得重跑                                                                                                                                                                                                           |
| Phase 6.9.7 Canary V2 P1                     | 已完成     | 独立 small-sample manifest `ae667f...edf61`、baseline payload `d36d07...d9f4e`、8 guards + 8 pairs、质量/预算/lineage/授权边界已冻结；全程 zero-provider                                                                                                                                                                                                                                                |
| Phase 6.9.7 Small Gate G1                    | 已完成     | manifest/baseline/strict report/scorer/gate、oracle 隔离、三层 baseline SHA、focused `20/20` 与 Agent `995/995` 已 zero-provider 完成；未调用 Provider/Mock/Docker                                                                                                                                                                                                                                      |
| Phase 6.9.7 Small Gate G2                    | 已完成     | one-shot runner、固定 production CLI、source/authority、marker/hash-chain journal/hard-link artifact/validator、crash-only seal 与 32-case fault matrix；正式 artifact=0，zero-provider                                                                                                                                                                                                                 |
| Phase 6.9.7 Small Gate S2                    | 已完成     | reviewed Mock/static：`8/8` guard、`16/16` strict/wire/usage、semantic `1/1/1`；仅 `mock_quality_not_evidence`，正式 L2 文件为 0                                                                                                                                                                                                                                                                        |
| Phase 6.9.7 Small Gate L2                    | 已完成     | 唯一 run `6918df4f...`：`8/8` guard、`16/16` strict/wire/usage、semantic `0.9141666667/1/0.9570833333`、`0.02256 CNY`；`small_sample_semantic_gate`，不得重跑，当时只解锁 P2 zero-provider 设计                                                                                                                                                                                                         |
| Phase 6.9.7 Full Gate P2                     | 已完成     | zero-provider 冻结 `72/24/48/24/32` full gate、manifest `e68e6e27...`、baseline `2ab1030f...`、policy `11371d16...`、24-sample P95、`48 calls / 0.55 CNY` 与新 durability lineage；当时只解锁 F1 contract/baseline                                                                                                                                                                                      |
| Phase 6.9.7 Full Gate F1                     | 已完成     | exact manifest/baseline/strict report/scorer/gate、安全 writer、anchor/P95/null aggregate 与 lineage rejection 已 zero-provider 落地；logical/physical SHA `16c574b1... / 16aa1773...`；当时只解锁 F2 runner/durability                                                                                                                                                                                 |
| Phase 6.9.7 Full Gate F2                     | 已完成     | 固定 production CLI/source admission、`24` guards + `24` serial pairs/`48` lanes、独立 budget/abort/timeout、exclusive marker、fsynced hash-chain journal、hard-link artifact、strict validator 与 crash-only seal；authority 仅 `zero_provider_full_runner_durability_evidence`，正式文件为 0                                                                                                          |
| Phase 6.9.7 Full Gate S3                     | 已完成     | reviewed Mock 穿过正式双 candidate、第一方 adapter、本地 merger 与 F2 runner；`24/24` guard、`48/48` strict/wire/usage、semantic `1/0.996875/0.9984375`；仅 `full_gate_mock_quality_not_evidence`，正式 tag/bundle 为 0                                                                                                                                                                                 |
| Phase 6.9.7 Full Gate L3                     | 失败封存   | 唯一 run `2b0ac3a0...`：guard `24/24`、runtime `22/22/0/26`、wire `22/22/22/21`、strict `21/48`；Tutor runtime 11 schema failure 后 breaker，semantic/P95/token/CNY 全 `null`；journal `296`、validator `ok=true`、recovery claim=0，不得重跑或进入产品验收                                                                                                                                             |
| Phase 6.9.7 Schema Recovery SR0              | 已完成     | 只读取证 L3 schema boundary；冻结两层 selection projection、bounded no-raw diagnostic、独立 schema-recovery-v1 lineage 与 SR1--SR7 路线；未改源码或调用 Provider；该 checkpoint 当时只解锁 SR1 zero-provider TDD                                                                                                                                                                                        |
| Phase 6.9.7 Schema Recovery SR1              | 已完成     | exact-schema raw parser、有界 native JSON envelope、canonical `intentIndex` projection、strict decision、bounded no-raw diagnostic 与 V6 local authority/merger seam 已 TDD 落地；contract SHA `e2453fae...11579`，该 checkpoint 当时只解锁 SR2 zero-provider robustness                                                                                                                                |
| Phase 6.9.7 Schema Recovery SR2              | 已完成     | fixture SHA `43248bfa...0d41e`；24 Tutor runtime、18 Provider shape、5 held-out、anti-oracle/no-leak、fault/abort 与 F2 sibling/breaker 已 zero-provider 通过；不形成 semantic/产品 authority，该 checkpoint 当时只解锁 SR3                                                                                                                                                                             |
| Phase 6.9.7 Schema Recovery SR3              | 已完成     | 独立 report/runner/source/CLI/schema-stage journal/artifact/validator/crash-only recovery；manifest `1a811394...adfbb`，focused `23/23`、Agent `1167/1167`；正式 SR5 files/tag 为 0，该 checkpoint 当时只解锁 SR4                                                                                                                                                                                       |
| Phase 6.9.7 Schema Recovery SR4              | 已完成     | reviewed Mock 穿过 recovery Tutor、Organizer V9、第一方 synthetic adapter、本地 authority/merger 与 SR3 runner；`48/48` strict/wire/usage、schema `42+6`、semantic `1/0.996875/0.9984375`；仅 Mock authority，该 checkpoint 当时只解锁 SR5 fresh admission                                                                                                                                              |
| Phase 6.9.7 Schema Recovery SR5              | 已完成     | 唯一 run `63f8a76b...04cb`：guard `24/24`、strict/wire/usage `48/48/48/48`、semantic `0.9736111111/0.9515968407/0.9626039759`、paired P95 `2240ms`、`0.067632 CNY`；`schema_recovery_full_gate_semantic_gate` 已封存且不得重跑；该 checkpoint 当时只解锁 SR6，后续状态见 SR6 行                                                                                                                         |
| Phase 6.9.7 Schema Recovery SR6              | 已完成     | `providerCalls=0`；Tutor Schema Recovery + Organizer V9 产品 composition、single/batch、forced failure、Trace/Mock 计费、owner/locked-name/write isolation、headed browser、精确清理与最终源码 default-off Docker 回放通过；只形成 zero-provider 产品 authority，当前只解锁 SR7/main                                                                                                                    |
| Phase 6.9.7 Schema Recovery SR7              | 已完成     | SR6/main 合并与远程发布、default-off Docker/API/可见浏览器/Trace/精确清理通过；精确 step-check 路由修复后为 `tutor/step_check`、candidate zero-call/0-token/`LIVE_CALLS_DISABLED`；Phase 6.9.7 正式收口，下一阶段仅 Phase 6.9.8                                                                                                                                                                         |
| Phase 6.9.8 Task 0                           | 已完成     | Retriever/FinalResponse authority、canonical principal/envelope、evidence projection、stream/Trace/abort/预算、48-case/P95/CNY 门与 Task 1--11 顺序已 zero-provider 冻结；未实现 runtime，只解锁 Task 1 shared contracts                                                                                                                                                                                |
| Phase 6.9.8 Task 1                           | 已完成     | Shared strict Zod contracts、auth receipt owner/request/bearer 绑定、hostile-input-safe parser、deep-freeze、local evidence model projection、stream terminal/citation ledger 与 root/subpath export；zero-provider，只解锁 Task 2 canonical principal / Chat access                                                                                                                                    |
| Phase 6.9.8 Task 2                           | 已完成     | `/auth/me` canonical owner、WeakMap bearer capability、三引用 receipt binding、authenticated-only Conversation/RAG/Trace、anonymous Mock 与 abort/concurrency/no-leak 边界；zero-provider，只解锁 Task 3 Retriever node/baseline                                                                                                                                                                        |
| Phase 6.9.8 Task 3                           | 已完成     | 正式 Retriever node、WeakMap exact-scope search port、canonical bearer `/knowledge/search` adapter、固定 `8/0.72/DONE` policy 与 16+16 original-query baseline；Recall@5/nDCG@5 `1/0.813219437888`，Provider calls=0，只解锁 Task 4 evidence projector                                                                                                                                                  |
| Phase 6.9.8 Task 4                           | 已完成     | exact-context-bound evidence projector、SafetyGuard/Verifier 保守收紧、4×700 UTF-16 bundle、稳定本地 citation/Markdown adapter、RAG 整层丢弃与脱敏 Trace；zero-provider，只解锁 Task 5 query rewrite candidate                                                                                                                                                                                          |
| Phase 6.9.8 Task 5                           | 已完成     | default-off V4 Pro non-thinking query rewrite candidate、逐段安全/本地 authority、独立 `1/1200/160` 预算、4000ms/no-retry、Web-only key/Compose；reviewed Mock 非质量证据，Provider=0，尚未接 Chat，只解锁 Task 6 FinalResponse                                                                                                                                                                         |
| Phase 6.9.8 Task 6                           | 已完成     | 正式 FinalResponse node、V4 Pro non-thinking stream adapter、local citation/terminal ledger、独立 `1/2500/1200` 预算、20000ms/no-retry、Web-only default-off config/Compose；Provider=0，尚未接 Chat，只解锁 Task 7 composition/Trace                                                                                                                                                                   |
| Phase 6.9.8 Task 7                           | 已完成     | `/api/chat` 正式 composition、minimal/prepare/CAS-finalize realtime Trace、abort reader cleanup、no-RAG 安全降级与 403/499 边界；同步流无 BackgroundJob/Outbox，Provider=0、qualityAuthority=none，只解锁 Task 8，数据库 E2E environment_blocked                                                                                                                                                        |
| Phase 6.9.8 Task 8                           | 已完成     | 固定 48-case manifest/policy、prompt-only reviewed Mock、production candidate/node/ledger、strict report/scorer/canonical bytes；三组均 `16/16`，仅 `mock_quality_not_evidence`，Provider/credential/Qwen/formal evidence=0；当时停在 Task 9 fresh authorization 门前                                                                                                                                   |
| Phase 6.9.8 Task 9A                          | 已完成     | Qwen 北京区官方 price/endpoint/usage contract、1536 维 strict direct transport、single-call/no-retry/AbortSignal、injected fault matrix 与 `262144 tokens / 0.131072 CNY` cap；Provider/credential/formal evidence=0，只解锁 Task 9B runner/durability                                                                                                                                                  |
| Phase 6.9.8 Task 9B                          | 已完成     | 16 guard + 64-call fixed schedule、Qwen/DeepSeek 独立 usage/CNY、source admission/双 capability、breaker、exclusive marker、hash-chain journal、hard-link artifact、strict validator、crash-only seal 与 9C CLI；Reviewed Mock 仅 `qualityAuthority=none`，Provider/credential/formal evidence=0                                                                                                        |
| Phase 6.9.8 Task 9C                          | 失败封存   | 唯一 run `28b5f92f...`：guard `16/16`、Provider `5/64`；Qwen `3/3/3/3`、DeepSeek `2/2/1/1`，第二条 rewrite `schema_invalid / 1/1/0/0` 后 59 次 not-started；journal `134`、validator `ok=true`，`qualityAuthority=none`，不得重跑，Task 10/11 阻断                                                                                                                                                      |
| Phase 6.9.8 Recovery R0                      | 已完成     | 独立三链路 bounded-diagnostic 设计：分离 Provider/runner wire，固定 stage/reason/bucket、`rawDataRetained=false` 与 no raw/hash，新 lineage R1--R7、source admission、durability/fault matrix 已冻结；zero-provider、`qualityAuthority=none`                                                                                                                                                            |
| Phase 6.9.8 Recovery R1                      | 已完成     | strict diagnostic、opaque rewrite session、第一方 V7 wire snapshot 只读投影与 synthetic adapter TDD；focused `11/11`、AI `25/25`、Agent `1289/1289`，Provider/credential/formal evidence=0；仅 `qualityAuthority=none`                                                                                                                                                                                  |
| Phase 6.9.8 Recovery R2                      | 已完成     | Qwen/FinalResponse 双第一方 wire family、opaque single-use session、Provider/stream/terminal/embedding/usage robustness；focused `58/58`、AI `345/345`、Agent `1301/1301`；zero-provider、`qualityAuthority=none`                                                                                                                                                                                       |
| Phase 6.9.8 Recovery R3                      | 已完成     | 16-guard/64-call runner、双 wire、source admission、三个模块私有 observation authority、marker/journal/hard-link artifact、strict validator/crash-only seal/CLI；focused `39/39`、Agent `1318/1318`、AI `345/345`；formal evidence=0，当时仅解锁 R4，后续已完成                                                                                                                                         |
| Phase 6.9.8 Recovery R4                      | 已完成     | zero-provider reviewed Mock/static：guards `16/16` zero-call、双 wire `64/64/64/64`、diagnostic `64 applied`、rewrite/FinalResponse `16/16`；gate `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`，Provider/credential/formal evidence=0；该 checkpoint 当时仅解锁 R5，后续 R5 已失败封存                                                                                     |
| Phase 6.9.8 Recovery R5                      | 失败封存   | 唯一 run `34eb99be...`：guards `16/16` zero-call，external calls `4`（Qwen `3`、DeepSeek `1`）；第二个 rewrite pair 的 DeepSeek `provider_dispatch / unknown` 后 breaker，剩余 `59` slots not-started；rewrite strict `1/16`、FinalResponse `0/16`，semantic/P95/verified aggregate 全 `null`；journal `237`、validator `ok=true`、artifact `423e3f2e...43b1e5`，不得重跑，R6 阻断                      |
| Phase 6.9.8 Transport Evidence T2            | 已完成     | 新 lineage 的 30-case zero-provider contract、固定 stage/boundary/reason、no-raw 数据模型、三 family 私有 capability、15 classifier fixture 与 synthetic durability 已通过；T2 authority 仅 `zero_provider_transport_evidence_t2 / qualityAuthority=none`，后续 T3 另行授权，不解锁 R6/R7/main                                                                                                          |
| Phase 6.9.8 Transport Evidence T3-A          | 已完成     | zero-provider source admission、T2 gate binding、branch/source parity、clean tree/formal artifact fence、双 opaque single-consume capability、fresh proxy nonce、三槽位 runner（`rewrite -> qwen -> final_response`）、`0.024096 CNY` budget、首错 breaker 与 CLI gate 已完成；focused `12/12`、Agent `1360/1360`，authority 为 `zero_provider_transport_evidence_t3_admission / qualityAuthority=none` |
| Phase 6.9.8 Transport Evidence T3 controlled | 失败封存   | 唯一 run `075e2d5f...` 在 late-bound credential gate 以 `configuration_invalid` 停止；planned/started/completed=`3/0/0`、Provider/credential=`0/0`、breaker reason=`configuration`、journal `7`、validator `ok=true`，authority=`controlled_live_transport_evidence_t3 / qualityAuthority=none`；一次性名额已消费，不得重跑或追加探测，不解锁产品/main                                                  |
| Phase 6.9.8 Transport Evidence T3-C          | 已完成     | zero-provider configuration composition guard：静态验证 package cwd -> 根 `.env` 路径与 crash-only seal CLI 无 credential/Provider port；focused `2/2`、10 assertions、typecheck/lint 通过，authority=`zero_provider_transport_evidence_t3_configuration_guard / qualityAuthority=none`                                                                                                                 |
| Phase 6.9.8 Transport Re-entry V2 L1         | 已完成     | 唯一 run `ce0c3257...` 三槽真实 transport canary durable seal；Provider `3`、usage `145/28/173`、费用 `0.000573 CNY`、validator `ok=true`，仅 transport diagnostic authority，不能解锁语义或产品                                                                                                                                                                                                        |
| Phase 6.9.8 P1 G1/G2/S2                      | 已完成     | 独立 zero-provider manifest/scorer、one-shot durability 与 reviewed Mock 已完成；S2 `8/8` guard、`16/16` strict/wire/synthetic usage、semantic `1/1/1`，gate=`p1_mock_quality_not_evidence`，qualityAuthority=`none`                                                                                                                                                                                    |
| Phase 6.9.8 P1 L2 controlled-Live            | 失败封存   | 唯一 run `ff035203...`：8/8 guards zero-call，Provider/credential/Qwen `2/2/0`，`rewrite_03/schema` 后 10 条未启动，usage `343/40`、aggregate cost `null`、journal `41`、validator `ok=true`；不得重跑，semantic/product/main 继续阻断                                                                                                                                                                  |
| Phase 7.0                                    | 已完成     | `BackgroundJob` 控制面、账号级后台任务读 API、脱敏任务元数据                                                                                                                                                                                                                                                                                                                                            |
| Phase 7.1                                    | 已完成     | BullMQ 知识库处理队列、inline / queue 双模式、worker role、`/knowledge` 后台处理状态                                                                                                                                                                                                                                                                                                                    |
| Phase 7.2                                    | 已完成     | RAG SafetyGuard、chunk 级 prompt injection 风险 metadata、Chat prompt 前过滤、Verifier / UI 安全提示                                                                                                                                                                                                                                                                                                    |
| Phase 7.3                                    | 已完成     | in-process EventBus 失败隔离、后台任务 summary API、`/knowledge` 后台任务摘要与轮询兜底                                                                                                                                                                                                                                                                                                                 |
| Phase 7.4                                    | 已完成     | Swagger / OpenAPI debug docs、`/api-docs`、`/api-docs-json`、全局 response envelope 说明                                                                                                                                                                                                                                                                                                                |
| Phase 7.5                                    | 已完成     | Swagger 中文说明、核心写接口 request body 示例、multipart 上传文档说明                                                                                                                                                                                                                                                                                                                                  |
| Phase 7.6                                    | 已完成     | API / worker 进程启动拆分、`SERVER_ROLE=worker` application context、Docker worker profile                                                                                                                                                                                                                                                                                                              |
| Phase 7.7                                    | 已完成     | Worker Observability、Redis heartbeat、队列 backlog / worker 在线状态、`/knowledge` 健康状态条                                                                                                                                                                                                                                                                                                          |
| Phase 7.8.1                                  | 已完成     | RAG Eval Baseline、固定检索评估集、recall@k / top1 / safety / no-hit 指标                                                                                                                                                                                                                                                                                                                               |
| Phase 7.8.2                                  | 已完成     | Hybrid Retrieval、向量候选 + PostgreSQL full-text keyword 候选、去重融合排序                                                                                                                                                                                                                                                                                                                            |
| Phase 7.8.3                                  | 已完成     | RAG Eval Smoke、本地 API 级上传/处理/检索/eval 串联验收脚本                                                                                                                                                                                                                                                                                                                                             |
| Phase 7.8.4                                  | 已完成     | RAG Eval Smoke 收尾增强、case 防误报 guard、`RAG_EVAL_SMOKE_KEEP_DATA`、面试博客                                                                                                                                                                                                                                                                                                                        |
| Phase 7.8.5                                  | 已完成     | RAG runtime parity、Qwen `text-embedding-v4` / 1536、provider-aware fail-closed、queue/hybrid smoke 3/3 真实验收                                                                                                                                                                                                                                                                                        |
| Phase 7.9.1                                  | 已完成     | Durable Outbox 地基、`OutboxEvent`、claim / retry / dead-letter 状态机                                                                                                                                                                                                                                                                                                                                  |
| Phase 7.9.2                                  | 已完成     | Outbox Dispatcher 最小闭环、handler registry、知识库 requested 事件入库                                                                                                                                                                                                                                                                                                                                 |
| Phase 7.9.3                                  | 已完成     | Outbox Dispatcher worker-only 受控运行、生产默认关闭、防重入 tick                                                                                                                                                                                                                                                                                                                                       |
| Phase 7.9.4                                  | 已完成     | Outbox Summary / Metrics、worker observability 安全只读指标                                                                                                                                                                                                                                                                                                                                             |
| Phase 7.10                                   | 已完成     | Outbox Ops 后端闭环、脱敏列表/详情、`FAILED / DEAD -> PENDING` 安全 requeue                                                                                                                                                                                                                                                                                                                             |
| Phase 7.11                                   | 已完成     | Worker Readiness、`/worker-readiness`、部署前 CLI readiness 命令                                                                                                                                                                                                                                                                                                                                        |
| Phase 7.12                                   | 已完成     | Docker worker healthcheck、容器级 readiness 状态接入                                                                                                                                                                                                                                                                                                                                                    |
| Phase 7.13                                   | 已完成     | Docker Web 镜像、Next standalone、全栈 Compose 启动与浏览器验收                                                                                                                                                                                                                                                                                                                                         |
| Phase 7.14.1                                 | 已完成     | Operator 权限与操作审计设计文档                                                                                                                                                                                                                                                                                                                                                                         |
| Phase 7.14.2                                 | 已完成     | OperatorGuard、系统级诊断入口 admin-only 访问控制                                                                                                                                                                                                                                                                                                                                                       |
| Phase 7.14.3                                 | 已完成     | `OperatorAuditLog`、审计 service、脱敏 metadata 与来源 hash                                                                                                                                                                                                                                                                                                                                             |
| Phase 7.14.4                                 | 已完成     | Outbox requeue 成功/失败审计接入                                                                                                                                                                                                                                                                                                                                                                        |
| Phase 7.14.5                                 | 已完成     | `GET /operator-audit-logs`、admin-only 脱敏审计查询 API                                                                                                                                                                                                                                                                                                                                                 |
| Phase 7.14.6                                 | 已完成     | `/operator-audit` 管理员审计台、ADMIN 侧边栏入口、脱敏列表筛选                                                                                                                                                                                                                                                                                                                                          |
| Phase 7.15                                   | 已完成     | 管理员审计台真实运行验收、Docker dev 诊断开关、`127.0.0.1` hydration 修复                                                                                                                                                                                                                                                                                                                               |
| Phase 7.16                                   | 已完成     | 独立桌面端 Admin Console、Outbox Ops 操作页、审计/Worker 页面、学习端后台入口                                                                                                                                                                                                                                                                                                                           |
| Phase 7.17                                   | 已完成     | Docker Admin Console service、`3100` 独立容器、全栈 Compose 验收                                                                                                                                                                                                                                                                                                                                        |
| Phase 7.17.1                                 | 已完成     | 管理员后台返回学习端 host 对齐、loopback 登录态排障记录                                                                                                                                                                                                                                                                                                                                                 |
| Phase 7.18                                   | 已完成     | Admin Outbox Ops 产品化、事件详情分区、requeue 后续验证                                                                                                                                                                                                                                                                                                                                                 |
| Phase 7.19                                   | 已完成     | Admin Console 控制台数据化、真实运维总览、后台管理复盘博客                                                                                                                                                                                                                                                                                                                                              |
| Phase 7.20                                   | 已完成     | Operator Audit 详情闭环、审计详情双栏、脱敏详情 API                                                                                                                                                                                                                                                                                                                                                     |
| Phase 7.21                                   | 已完成     | Admin Ops 交互收口、自定义筛选控件、Outbox requeue 原因必填                                                                                                                                                                                                                                                                                                                                             |
| Phase 7.22                                   | 已完成     | Docker Admin Ops 真实验收、普通用户 403 拦截、测试数据清理、后台 favicon 收口                                                                                                                                                                                                                                                                                                                           |
| Phase 7.23.1                                 | 已完成     | Operator Audit 180 天保留周期、异步 ZIP 证据包、事务型 Outbox 与 fail-closed 下载审计设计                                                                                                                                                                                                                                                                                                               |
| Phase 7.23.2                                 | 已完成     | strict 导出 contract、Prisma export/maintenance 模型、ACCOUNT/SYSTEM job 与生产关闭配置                                                                                                                                                                                                                                                                                                                 |
| Phase 7.23.3                                 | 已完成     | Serializable 导出申请事务、strict audit、Outbox-only BullMQ 投递                                                                                                                                                                                                                                                                                                                                        |
| Phase 7.23.4                                 | 已完成     | 单并发 ZIP Worker、formula-safe CSV、REPEATABLE READ 快照、lease/CAS fencing、attempt-fenced MinIO                                                                                                                                                                                                                                                                                                      |
| Phase 7.23.5                                 | 已完成     | 小时级保留维护、24h 逻辑过期、180 天 active-export 水位、stale repair、crash janitor、三队列 readiness                                                                                                                                                                                                                                                                                                  |
| Phase 7.23.6                                 | 已完成     | 系统级 ADMIN 查询/详情、稳定游标、fail-closed 审计 ZIP 下载                                                                                                                                                                                                                                                                                                                                             |
| Phase 7.23.7                                 | 已完成     | `/audit` 审计记录/证据包 tabs、申请/查询/详情/下载 Admin UI                                                                                                                                                                                                                                                                                                                                             |
| Phase 7.23.8                                 | 已完成     | Docker API/Worker 拆分验收、下载/过期/清理 smoke、面试博客                                                                                                                                                                                                                                                                                                                                              |

## 技术栈

| 层级              | 技术                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Frontend          | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, Zustand, Dexie, PWA |
| Backend           | NestJS 11, Prisma, PostgreSQL, Redis, BullMQ                                                 |
| AI                | Vercel AI SDK, OpenAI, DeepSeek, Gemini                                                      |
| Agent / RAG / MCP | LangGraph, Qwen `text-embedding-v4` / 1536, pgvector + PostgreSQL full-text, MCP JSON-RPC    |
| Infra             | Docker, MinIO, Sentry, OpenTelemetry, Prometheus, Grafana                                    |

Agent 目标框架使用 LangGraph，不使用 AutoGen；当前仓库只有 graph descriptor 与分散的 policy/service orchestration，尚未完成可执行 `StateGraph`。
Phase 6 是多 Agent 协作亮点阶段：当前已完成 Agent Runtime 地基、RouterAgent 到 Chat 的轻量接入、TutorAgent 策略层、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、Agent Trace 可观测闭环，以及 KnowledgeDedupAgent / KnowledgeOrganizerAgent 资料管理建议。Router / Verifier 已完成模型/规则混合的生产验收，但默认 gate 已恢复关闭；`KnowledgeDedupAgent` 与 `KnowledgeOrganizerAgent` 已完成受治理 candidate、本地权威 merger、owner snapshot/双 stale fence、owner-scoped pgvector semantic shortlist、default-off DeepSeek runtime composition、API 并行 dispatch/runtime metadata/安全 Trace、`/knowledge` local/hybrid/degraded 只读来源状态，以及 72-case strict Mock paired runner/evidence validator。唯一 V1 controlled-Live 已以 `quality_gate_failed` 封存；唯一 V2 controlled-Live run `10ae2f36-69f6-422c-a99f-6bf6b3aeb226` 已以 `quality_gate_passed` 封存。Docker/API 产品 R1--R6 的失败终态均保留；R6 的 `no_semantic_pair` 已定位为 Prisma 把 `ntile(6)` 绑定为 PostgreSQL `bigint`，source 捕获 `P2010/42883` 后安全返回空 shortlist。`::integer` 修复已通过 RED/GREEN、相关静态门和真实 PostgreSQL `2 selected chunks / 1 high pair / 0.957065639321` 诊断；随后 R7 Docker/API 与可见浏览器分支验收通过，默认 gate 在验收后恢复关闭。main `f31335c6` 又完成 focused、Docker/API、桌面/移动端可见浏览器 default-off 回放与零残留清理，Phase 6.9.6 已完成。`TutorAgent` 与 `WrongQuestionOrganizerAgent` 的 package candidate/merger 均已完成；Tutor 已在 Task 5 接入 Web server-only default-off composition、Chat 编排和安全 Trace；Task 12 V1 controlled-Live 已执行但质量失败。WrongQuestionOrganizer 已在 Task 7 接入 server-only default-off DeepSeek runtime、single/batch 单次 dispatch、两阶段 Trace 与 HTTP abort，并在 Task 8 增加 strict request-level runtime 和 `/error-book` 语义/本地/安全回退来源状态，最终写入仍穿过 Task 6 的 owner snapshot、三阶段 stale fence 与 model-free command。两条 gate 的 tracked defaults 仍关闭；唯一 Phase 6.9.7 V1 controlled-Live 已执行但因 strict runtime 与语义质量门失败而封存，未进入 Docker/API/浏览器，不能据此宣称产品可用；`MemoryAgent` 仍是确定性 policy。Review / Planner 已具备受限只读模型 candidate；V1--V9 是只读历史，V9 的 `quality_gate_failed`、`23` provider attempts、`22` paired admissions、quality `30/48`、semantic `4/22` 与 critical `2` 继续作为当时失败证据保留。后续 V10 语义质量 authority、独立 DeepSeek V4 Pro Docker API/可见浏览器验收与 main default-off replay 已证明 candidate 可用；当前默认仍返回确定性建议，是 gate 关闭后的安全回滚状态，不等于模型路径不可用。Tutor 负责讲题意图和 prompt 策略，Verifier 只在 RAG 命中后评估资料可信度，WrongQuestionOrganizer 只给错题学科组与专题 deck 建议，Review / Planner 只基于当前用户错题、复习日志、复习计划和偏好生成只读学习建议，Memory 只生成长期记忆候选并等待用户确认，KnowledgeDedup / KnowledgeOrganizer 只基于当前用户资料元数据和少量 chunk 摘要给出重复、新版、互补、集合与标签建议。最终流式输出仍由 `/api/chat` 的既有 mock/live 链路负责；错题组织由 NestJS organizer API 写入独立组织层；复习计划建议由 `/review-agent/suggestions` 读取并展示，不创建未来 `ReviewTask`；长期记忆由 `/memory-agent` 与 `/user-memories` API 管理，不自动注入每次 Chat；资料管理建议由 `/knowledge-agent/suggestions` 读取并在 `/knowledge` 展示，不自动合并、删除、替换、重命名或分类资料。facts、FSRS、分钟数、链接、写库与权限始终由本地权威代码决定。Agent Trace 由 `/agent-traces` 在线账号级 API 持久化脱敏后的路由、步骤、token 和估算成本元数据，`/agent-trace` 提供调试台；它不保存完整 prompt、完整回答、完整 RAG chunk 或 API key，成本看板只展示估算值，不替代模型供应商账单。

2026-07-23 Phase 6.9.7 Task 9 已完成：同一 72-case runner 实际验证 `24/24` guard zero-call 与 `48/48` strict Mock runtime，Tutor/Organizer semantic 均为 `1`；Mock 的 `quality_gate_failed` 是 Live-only authority 设计。终审把不包含真实 Router/API/最终流式回答的 `chatProduct*` 更名为 `tutorOrchestration*`；公共 Live CLI 不接受 executor 注入，production gate 只接受 `executorProvenance=deepseek_network`，`mock_synthetic` / `synthetic_test` 永远不能打开生产门。没有读取 key、调用 provider、创建 Live marker/evidence 或执行 Docker/浏览器；两个 gate 仍默认关闭。权威证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-paired-eval.md`；Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

2026-07-28 Phase 6.9.7 V6 R5 已失败封存：用户接受当时 DeepSeek 数据边界并精确授权唯一 branch run `b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8`。`24/24` guard zero-call 通过；首对 Tutor 在 executor `21.2116ms` 内成为 `provider_runtime / unknown`，Organizer sibling `post_dispatch_abort`，后续 46 runtime 被 breaker 阻止。最终 2 次 Provider invocation、`0/48` strict runtime，semantic/P95/token/CNY 全 `null`，gate `quality_gate_failed`。Evidence/marker/journal SHA 已记录，journal 最后一条为 `evidence_sealed`，bundle validator `ok=true`，无 recovery claim。`unknown` 不能据此唯一归因 credential、网络、模型、endpoint、SDK 或 Provider response。V6 不得重跑、额外探测、进入 R6/R7/main 或后续阶段。权威证据见 `docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v6-controlled-live-failure.md`。

2026-07-28 Phase 6.9.7 V7 R0 已完成：只读取证确认 V6 的 runner `dispatch_started` 与 candidate executor invocation 都早于可证明的 HTTP response，当前 AI SDK adapter 又会把 V4 Pro middleware generic request/response 拒绝及其它未识别异常收敛为 `unknown`，因此 V6 的 2 次 invocation 不能证明 HTTP 请求已发出或 DeepSeek 已接收。V7 不改 V2 dataset、V6 prompt/candidate/local authority，冻结第一方 V4 Pro direct adapter、`executor_entered -> request_validated -> provider_dispatch_started -> provider_response_received -> response_audit_passed -> content_parsed -> schema_validated -> usage_validated`、四类独立计数、安全 failure taxonomy 与 R1--R6 路线。R0 未改源码、读取 `.env`/credential、调用 Provider、启动 Docker/API/browser 或创建 artifact；该 checkpoint 当时的下一原子任务仅 R1，后续 R1 已完成。设计见 `docs/superpowers/specs/phase-6-9-7-tutor-organizer-v7-remediation-design.md`。

2026-07-28 Phase 6.9.7 V7 R1 已完成：`@repo/ai` 新增 `first-party-deepseek-v4-pro-direct-v1` 与 `phase-6.9.7-v7-wire-diagnostics-v1`。Adapter 固定 `https://api.deepseek.com/v1/chat/completions`、`deepseek-v4-pro`、non-thinking、JSON-object、`stream=false`、no tools/retry；默认 delegate 才能标记 `first_party_deepseek_v4_pro_direct`，注入 delegate 永久标记 `synthetic_test`。WeakMap opaque capability 只能 claim 一次，串行 reducer 保证 stage 单调、first-terminal-wins 与 late drain；executor/dispatch/response/verified usage 四类计数分别由已提交 stage 重算。私有 taxonomy 穷尽投影到既有公共 failure contract，raw error/body/header/prompt/key 不进入 handoff。Provider dispatch hook 失败保持 delegate 0-call，V6 Tutor/Organizer strict schema 与两份 prompt SHA 兼容。Focused `66/66`、Agent `830/830`、AI `224/224`、typecheck/lint/Prettier/diff 与独立安全复审通过。全程未读取 `.env`/credential、调用 Provider、启动 Docker/API/browser、创建 V7 runner/CLI/env/marker/journal/evidence 或接产品 composition；该 checkpoint 当时的下一原子任务仅 R2，后续 R2 已完成。验收见 `docs/acceptance/phase-6-9-7-tutor-organizer-v7-r1-zero-provider-adapter.md`。

2026-07-28 Phase 6.9.7 V7 R2 已完成：新增独立 V7 report/paired runner、CLI/approval、一次性 marker、dispatch-before-call hash-chain journal、hard-link evidence、crash-only recovery claim 与 strict validator。Runner 固定 `72/24/48/24/32` 分母、guard-first、pair 串行、pair 内最多双 lane、single dispatch/no retry 与首个 runtime contract failure breaker；成功 lane 必须具有完整 8-stage wire 前缀、verified usage 和四类 `1/1/1/1` 计数，任一 runtime 不完整时正式 semantic/P95/token/CNY 全 `null`。V1--V6 lineage 双向拒绝、旧 artifact token 递归注入、provenance/aggregate 篡改、unknown/cross-lane dispatch key、stale claim rename 后崩溃和跨仓库 evidence 根路径均已覆盖。Focused `22/22`（`184` assertions）、Agent `852/852`（`11041` assertions）、typecheck/lint、历史 validators 与 V6 physical SHA 复核通过。全程未读取 `.env`/credential、调用 Provider、启动 Docker/API/browser、执行正式 V7 Mock/Live 或创建仓库 V7 artifact；当时默认 Mock factory 为 `mock_harness_unavailable`，下一原子任务是 R3，后续已完成。已知边界保持：只有文件 fsync、无父目录 fsync；单机 PID/file fencing 不是跨主机 lease，不证明断电后的目录项持久性或 Provider exactly-once。验收见 `docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r2-runner-lineage.md`。

2026-07-28 Phase 6.9.7 V7 R3 已完成：新增 reviewed V7 Mock factory 与完整 zero-network fault matrix。48 条 runtime 全部从冻结 V2 dataset 派生，穿过真实 V6 Tutor/Organizer candidate、projection、prompt、strict schema、本地 merger 与 R1 第一方 direct adapter；只有 fetch delegate 为进程内 synthetic responder，且 responder 只读实际 bounded prompt、不读取 expected/oracle。Fresh baseline 保持 `12/48` 与 `0.6629642857/0.278125/0.4705446429`；Mock run `e09baa4a...` 为 `24/24` guard、`48/48` strict、semantic/model-owned `1/1/1`、wire `48/48/48/48`，gate `mock_quality_not_evidence`。Focused `28/28`（`1028` assertions）、Agent `856/856`（`11881` assertions）、AI `224/224`、Types `42/42 + tsc`、Server `2154 passed / 30 skipped`、Web `439/439`、PostgreSQL `12/12`、Compose default-off、V1--V6 validators/SHA、V7 artifact=0，以及独立 contract/security/wire 与 docs/history/operations 两路终审通过。未读取根 `.env`、调用 Provider、启动产品 Docker/API/browser 或创建 V7 Live artifact；该 R3 checkpoint 当时下一步仅 R4 精确授权门，后续 R4 已失败封存。验收见 `docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r3-static-mock.md`。

2026-07-28 Phase 6.9.7 V7 R4 已失败封存：用户重新接受运行时 DeepSeek 数据边界并精确授权唯一 branch run `81529c2c-79f5-4c21-9cee-e536a2fe78e3`。零网络 preflight 确认 clean/pushed `df5ed8c7`、V7 artifact=0、V1--V6 validators/SHA 与 V7 focused `26/26` 通过。唯一 Live 为 `24/24` guard zero-call；首对 Tutor 完成 8-stage wire、`candidate_applied`、usage `532/8`、`0.001644 CNY`，Organizer 已收到 response 并完成 JSON parse，但在 `provider_type_validation` 失败，后续 46 runtime 被 breaker 阻止。最终 wire `2/2/2/1`、`1/48` strict，正式 semantic/P95/token/CNY 全 `null`，gate `quality_gate_failed`。Evidence/marker/journal SHA 已记录，最后一条 journal 为 `evidence_sealed`，validator `ok=true / filesChecked=1`，无 recovery claim。V7 不得重跑、额外 Provider 探测或进入 R5/R6/main；下一步只能是新 lineage 的 zero-provider 复盘/设计。权威证据见 `docs/acceptance/phase-6-9-7-tutor-organizer-v7-controlled-live-failure.md`。

2026-07-28 Phase 6.9.7 V8 R0 已完成：只读对照 V7 sealed evidence、V6 Organizer static schema/dynamic validator/local merger、V7 direct adapter 与 reviewed Mock，确认失败位于 JSON parse 后的 static Zod shape，无法从脱敏证据恢复具体字段。V8 冻结始终包含 `questionIndex/subjectIndex/deckAction/targetIndex` 的 fixed-shape ordinal-only contract、只保存固定 reason/count/type-shape hash 的 bounded diagnostic、Provider-like schema-negative/metamorphic/held-out/anti-overfit matrix、独立 V8 identity 与 R1--R7 路线。V1--V7 artifact/SHA、V2 dataset、V6 local authority/merger、预算/timeout/quality/P95/no-retry 均不变。R0 未实现源码、runner、Mock/Live 或产品 wiring，未读取 credential、调用 Provider、启动 Docker/API/browser、修改业务数据或合并 main；该 R0 checkpoint 当时下一任务仅 V8 R1 zero-provider TDD，后续 R1 已完成。验收见 `docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r0-zero-provider-postmortem.md`。

2026-07-28 Phase 6.9.7 V8 R1 已完成：新增 `@repo/agent/wrong-question-organizer-v8`，将模型输出固定为 `shortlistFingerprint + decisions[{questionIndex,subjectIndex,deckAction,targetIndex}]`，contract SHA 为 `b21a6dd357ecc19e87869541c7ae6cb52adff130ce32173fd8422ad2f6506545`，prompt SHA 为 `9b85b0a9a310f128d35250e83b3927df8de87f159dac8aac8f412d1189ca6af9`。静态 schema 不 coercion/repair；动态 validator 只把暴露 ordinal 映射到 V6 validated decision，随后复用原 V6 merger。Runtime adapter 保留原 `1/3500/800` 预算、usage/Trace/abort 和调用前后实际 shortlist fence；fingerprint、subject/deck/topic、真实 ID、locked name、confidence 与 write authority 仍由本地掌握。诊断只保留固定 reason、计数、类型/shape hash 和 `rawDataRetained=false`，不保存原始值、未知字段名、prompt/output/error/credential；hostile getter/proxy 与 malformed runtime 均 fail-closed。Focused `20/20`（`560` assertions）、Agent/AI typecheck/lint、Prettier、6.9.4.3/6.9.6 与 V1--V7 sealed evidence validators 通过。全程未读取 credential、调用 Provider、执行正式 Mock/Live、启动 Docker/API/browser、创建 V8 artifact、修改业务数据或合并 main；下一原子任务仅 V8 R2 zero-provider robustness/anti-overfit。验收见 `docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r1-fixed-shape-diagnostic.md`。

2026-07-28 Phase 6.9.7 V8 R2 已完成：新增独立 Provider-like fixture `phase-6.9.7-tutor-organizer-v8-r2-provider-shapes-v1`，SHA 为 `sha256:f0a93a83000cb1f3515057482eca7ebbbb0ce0ef441cfd1cb7075073e000793f`；fixture 不导入 V2 expected/oracle、production candidate/validator/merger 或 reviewed Mock responder。V8 schema identity 现在要求 Provider content 为完整原生 JSON，Markdown fence/prose/BOM/trailing comma/single quote 在 schema 前拒绝；未标记的 V7/历史 schema 保留 exact fence 兼容。Synthetic fetch 穿过真实第一方 direct adapter、ModelAgentRuntime、V8 candidate 与 V6 local merger，覆盖 canonical/Unicode/reorder、wrapper/旧 V6 Shape/snake_case/type drift、static malformed decision 首/中/尾、dynamic subject/deck/topic authority、双 stale fence、真实 ID/locked name/confidence 本地重建及 cycle/Proxy/wide no-leak。Focused `24/24`（`680` assertions）、Agent `878/878`（`12579` assertions）、AI `226/226`（`1459` assertions）、typecheck/lint/Prettier、6.9.4.3/6.9.6 与 V1--V7 sealed validators、独立复审均通过。全程未读取 credential、调用 Provider、执行正式 Mock/Live、启动 Docker/API/browser、创建 V8 artifact、修改业务数据或合并 main；下一原子任务仅 V8 R3 zero-provider runner/lineage/durability。验收见 `docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r2-provider-robustness.md`。

2026-07-28 Phase 6.9.7 V8 R3 已完成：新增独立 V8 report/runner/CLI/approval、一次性 marker、dispatch-before-call hash-chain journal、hard-link evidence、crash-only recovery 与 strict validator。Runner 固定 `72/24/48/24/32`、guard-first、pair 串行、single dispatch/no retry、首 runtime contract failure breaker 与 incomplete aggregate 全 `null`；V8 只独立版本化 report/runtime/artifact lineage，底层显式复用 V7 8-stage wire protocol。Source manifest 绑定 V6 dataset/semantic authority、V8 prompt/fixed-shape/diagnostic SHA 与 wire version。Organizer static `provider_type_validation` 或 dynamic contract failure 必须携带 bounded no-raw diagnostic；guard/not-started/纯 transport failure 不伪造字段原因。Durability 修复使已有完成态 journal 按 `guard_failed` / `quality_gate_impossible` 重建 `not_started_case_guard` / `not_started_quality_breaker`，未完成 crash 才标记 orphan。R3 focused `24/24`（`215` assertions）、V8 focused `46/46`（`888` assertions）、Agent `902/902`（`12822` assertions）、AI `226/226`（`1459` assertions）、typecheck/lint/Prettier、V1--V7 sealed validators、artifact=0 与独立复审通过。未读取 `.env`/credential、调用 Provider、执行正式 Mock/Live、启动 Docker/API/browser、修改业务数据或合并 main；该 checkpoint 当时下一原子任务仅 R4，后续 R4 已完成。验收见 `docs/acceptance/phase-6-9-7-tutor-organizer-v8-r3-runner-lineage-durability.md`。

2026-07-28 Phase 6.9.7 V8 R4 已完成：新增 reviewed V8 Mock factory/export，默认 Mock CLI 穿过正式 V6 Tutor candidate 与 V8 fixed-shape Organizer candidate、动态 authority、V6 merger、第一方 direct adapter；只有 fetch delegate 为进程内 synthetic responder，且 responder 不读取 expected/oracle、真实 ID 或写 command。Fresh baseline 保持 `12/48` 与 semantic `0.6629642857/0.278125/0.4705446429`；Mock run `c8635a6a...` 为 `24/24` guard、`48/48` strict、semantic/model-owned `1/1/1`、wire `48/48/48/48`、gate `mock_quality_not_evidence`。V6 nested/extra/missing/type/null 与动态 authority drift fault matrix、Agent `907/907`、AI `226/226`、Types `42/42 + typecheck`、Server `2154 passed / 30 skipped`、Web `439/439`、PostgreSQL `12/12`、Compose default-off、V1--V7 validators、Mock 精确清理和 V8 Live artifact=0 通过。全程未读取 credential、调用 Provider 或启动产品 Docker/API/browser；该条为 R5 前 zero-provider checkpoint。验收见 `docs/acceptance/phase-6-9-7-tutor-organizer-v8-r4-static-mock.md`。

2026-07-29 Phase 6.9.7 V8 R5 已失败封存：用户接受本次运行时 DeepSeek 数据边界并授权唯一 branch run `7ff09c36-50f2-445a-b309-dc9500e5e13c`。Preflight 在 clean/pushed `b487ffe8` 上完成 V8 artifact=0、V1--V7 validators、Agent `907/907` 与 Agent/AI typecheck/lint；根 key 只在授权子进程内映射为两个 component credential，未写入 `.env` 或 artifact。唯一 run 为 `24/24` guard zero-call、2 对 dispatched/completed、wire `4/4/4/4`、`3/48` strict。两个 Tutor 与第一条 Organizer 成功；第二条 Organizer 已通过完整 8-stage wire、fixed-shape schema 与 usage，但本地 dynamic shortlist authority 返回 `fallback_schema_invalid / dynamic_contract`，bounded reason 为 `dynamic_authority`。后续 44 runtime 未启动，正式 semantic/P95/token/CNY 全 `null`，gate `quality_gate_failed`。Evidence/marker/journal 已 seal，validator `ok=true/filesChecked=1`，无 recovery claim；不得重跑、seal/recovery 或追加 Provider 探测。R6/R7/main 被阻断，下一步只能建立新的独立 zero-provider R0。验收见 `docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v8-controlled-live-failure.md`。

2026-07-29 Phase 6.9.7 V9 R0 已完成：只读对照 V8 sealed acceptance、V5 owner shortlist、V6 validator/merger、V8 fixed-shape contract/adapter 与 Server snapshot/command 权限链，确认 V8 static shape 已修复，结构性缺口是模型仍需自由组合 `subjectIndex + deckAction + targetIndex`；脱敏证据不能恢复具体失败 ordinal。V9 冻结本地合法 option authority，模型 exact output 只允许 `decisions[{questionIndex,optionIndex}]` 且不回显 fingerprint；本地 option 映射注入 shortlist fingerprint 后仍走完整 V6 validator/merger、事务外双 fence 与 owner-lock `Serializable` 最终 fence。Option 采用 canonical 去重、稳定排序、每题 24/请求 144 与 3500 input-token fail-closed；未知 index 不 clamp/repair。V1--V8 artifact/SHA、V2 dataset、预算/timeout/quality/no-retry 不变，V9 使用独立 lineage 与 R1--R7 路线。R0 未修改 Agent/AI/Server/Web 源码，未读取 credential、调用 Provider、执行 Mock/Live、启动 Docker/API/browser、修改业务数据或合并 main；该 checkpoint 当时下一任务仅 V9 R1 zero-provider TDD，后续 R1 已完成。验收见 `docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v9-r0-zero-provider-postmortem.md`。

2026-07-29 Phase 6.9.7 V9 R1 已完成：新增 `@repo/agent/wrong-question-organizer-v9`，从 validated V5 authority 为每题枚举同 subject 的完整 `resolvedSubject + subjectDecision + deckDecision` option，排除 canonical duplicate 与 locked-name create collision，并以 mandatory bucket、`24/question`、`144/request` 和 3500 input-token hard cap fail-closed。模型 strict contract 只允许 `decisions[{questionIndex,optionIndex}]`；本地映射后注入 shortlist fingerprint，再执行完整 V6 validator/merger，真实 ID、locked name、confidence、write authority 与 stale fence 不下放。Prompt/estimator/option-rules SHA 分别为 `ef2ff007...e5586c`、`06caeb2d...dbada`、`1013c439...eec`。Bounded diagnostic 不保存原始 index、模型 output、prompt、ID 或错误正文。Focused `11/11`（`124` assertions）、Agent `918/918`（`13885` assertions）、Agent/AI typecheck/lint、Prettier、历史 validators 与双路终审通过。未读取 credential、调用 Provider、执行正式 Mock/Live、创建 V9 artifact、启动 Docker/API/browser、修改业务数据或合并 main；该 checkpoint 当时下一任务仅 V9 R2，后续已完成。验收见 `docs/acceptance/phase-6-9-7-tutor-organizer-v9-r1-option-authority.md`。

2026-07-29 Phase 6.9.7 V9 R2 已完成：冻结独立 Provider-like fixture `phase-6.9.7-tutor-organizer-v9-r2-provider-shapes-v1` / SHA `0870799257...a4200`；synthetic responder 只解析实际 bounded prompt，不读 V2 expected/oracle 或生产 builder/validator。覆盖 wrapper/prose/fence/BOM/type drift、question/option reorder、NFKC duplicate/locked-name、24/144/3500 cap、ASCII/CJK/emoji/combining、本地 `NaN/Infinity/unsafe integer` schema、credential/Cf/control、getter/Proxy/symbol/cycle/deep/wide/node overflow、pre/in-flight/post abort、pre/post stale 与 Server 最终写权限并发。测试发现并修复 V9 strict JSON schema identity 缺失、`provider_type_validation` 错归 runtime fallback、failure sanitizer 对 parse failure 伪造 diagnostic 三项问题；V1--V8 artifact/SHA、V2 dataset、R1 prompt/estimator/option-rules SHA、预算与产品接线不变。Focused `24/24`（`407` assertions）、Agent `938/938`（`14255` assertions）、AI `226/226`（`1459` assertions）、Server 写权限 3 suites/34 tests、typecheck/lint/Prettier/diff、6.9.4.3/6.9.6/V1--V8 validators 与 V9 artifact=0 通过。未读取 credential、调用 Provider、执行正式 Mock/Live、创建 V9 artifact、启动 Docker/API/browser、修改业务数据或合并 main；该 checkpoint 当时下一任务仅 V9 R3 zero-provider runner/lineage/durability，后续已完成。验收见 `docs/acceptance/phase-6-9-7-tutor-organizer-v9-r2-provider-robustness.md`。

2026-07-29 Phase 6.9.7 V9 R3 已完成：新增独立 V9 report/runner/CLI/approval/marker/journal/evidence/recovery/validator，固定 `72/24/48/24/32`、guard-first、pair 串行/双 lane、single dispatch/no retry、首 runtime contract failure breaker、8-stage wire 与 reserved/terminal/orphan/not-started accounting；强制 `terminal + orphaned = reserved`、`reserved + notStarted = 48`，recovery orphan 不与 durable terminal 重叠。`lane_reserved` 必须在 executor 前 durable；first-party Live 缺完整 lifecycle 会在 guard/executor 前拒绝。Source manifest 绑定 actual/frozen prompt、estimator、option rules 及 selection/runtime/wire alias/diagnostic/eval/semantic SHA；V1--V8 双向 lineage 拒绝。Synthetic runner/wire fault matrix 覆盖 guard、transport/HTTP/schema/usage、selection/option authority、first/middle/last breaker、sibling abort 与 incomplete aggregate 全 `null`；该矩阵不是 R4 reviewed candidate Mock。Focused `29/29`（`393` assertions）、Agent `967/967`（`14667` assertions）、AI `226/226`（`1459` assertions）、typecheck/lint/Prettier/diff、Phase 6.9.6 与 V1--V8 validators、正式 V9 artifact=0 通过。未读取 credential、调用 Provider、执行正式 Mock/Live、启动 Docker/API/browser、接产品 wiring、修改业务数据或合并 main；该 checkpoint 当时下一任务仅 V9 R4，后续 R4 已完成。验收见 `docs/acceptance/phase-6-9-7-tutor-organizer-v9-r3-runner-lineage-durability.md`。

2026-07-29 Phase 6.9.7 V9 R4 已完成：新增 V9 evaluation runtime、reviewed Mock factory 与 package export；CLI `mock` 默认接入，`live` 继续硬拒绝到 R5。Tutor 复用正式 V6 candidate；Organizer 穿过 V9 option authority/selection、V6 validator/merger 与第一方 direct adapter，只有 fetch delegate 为 synthetic，responder 只读实际 bounded prompt。Fresh baseline `12/48`、semantic `0.6629642857142858/0.278125/0.4705446428571429`；Mock run `f039a7d2-c3b2-4286-9630-fee49d365a33` 为 `24/24` guard、`48/48` strict、wire `48/48/48/48`、semantic `1/1/1`、synthetic usage `17732/504`、estimated `0.05622 CNY`，gate `mock_quality_not_evidence`。R4/V9/Agent/AI/Types/Server/Web、PostgreSQL `12/12`、Compose default-off、历史 validators、残留 0 与两路终审通过；Mock evidence 已精确删除，正式 V9 artifact=0。未读取 credential、调用 Provider、执行 Live、启动产品 Docker/API/browser、修改业务数据或合并 main；该 checkpoint 当时下一任务仅 R5，后续已失败封存。验收见 `docs/acceptance/phase-6-9-7-tutor-organizer-v9-r4-static-mock.md`。

2026-07-30 Phase 6.9.7 V9 R5 已失败封存：在 clean/pushed `ce308da643bfb0b9c150f0612f0c5aa926442687`、local/tracking/remote parity、历史 validators 与 V9 artifact=0 前门通过后，用户重新接受 DeepSeek 当前账号数据边界并授权唯一 branch controlled-Live。Run `c530ca02-3ece-4f11-898c-5695c8252bd5` 为 `24/24` guard zero-call；pair 0 两条 lane 各进入一次 durable dispatch，但 Tutor 在 response 前成为 `provider_runtime / transport`，Organizer sibling 以 `post_dispatch_abort` 收口。最终 pair `1/1`、reserved/terminal/orphan/not-started `2/2/0/46`、wire `2/2/0/0`、strict `0/48`，正式 semantic/P95/token/CNY 全 `null`，gate `quality_gate_failed`。Marker/journal/evidence 已 seal，validator `ok=true/filesChecked=1`，无 recovery claim。不能进一步归因 DNS/TLS/代理、账号、余额、模型权限或服务端；禁止重跑、追加 Provider 探测、seal/recovery 或改写 artifact。R6/R7/main 与后续阶段被阻断。验收见 `docs/acceptance/2026-07-30-phase-6-9-7-tutor-organizer-v9-controlled-live-failure.md`。

2026-07-27 Phase 6.9.7 V6 R4 已完成：默认 Mock CLI 已接 reviewed factory，真实经过 V6 Tutor/Organizer candidate、strict validator、本地 authority merger 与正式 runner。Fresh baseline 保持 `12/48`、semantic `0.6629642857/0.278125/0.4705446429`；fresh Mock run `88d72b3c-b1b9-4b4d-bb56-903b04b437b0` 为 `24/24` zero-call、`48/48` strict runtime、semantic/model-owned `1/1/1`，report gate 固定 `mock_quality_not_evidence`。受影响 focused `36/36`、Agent `828/828`、AI `199/199`、Types `42/42`、Server Docker boundary `3/3`、Web `439/439`、PostgreSQL `12/12`、Compose default-off 与 V1--V5 validators 均通过；Mock evidence 已按精确路径删除，V6 Live marker/journal/evidence/recovery claim 均为 0。全程未调用 Provider 或启动产品 Docker/API/browser；Mock token/P95/0 CNY 只证明本机工程合同，不是 Provider 或产品证据。R3 的无父目录 fsync、claim tail 延后复核、缺 stale-rename 后二次崩溃专测三项边界仍保留。该条是 R5 前历史 checkpoint；后续唯一 R5 已失败封存。

2026-07-27 Phase 6.9.7 V6 R3 已完成：新增独立 V6 report/case/evidence contract、paired runner、CLI/approval、一次性 marker、dispatch-before-call hash-chain journal、hard-link evidence、recovery claim 与 validator。固定 `72/24/48/24/32` 分母、24 guard 先行、pair 串行/双 lane、首 runtime contract failure breaker、deadline overshoot、sibling abort/orphan、usage unknown 与 incomplete aggregate 全 `null` 已冻结；synthetic Live 强制失败，只有未来 `deepseek_network` 才可能成为质量 authority。V1--V5 runner/prompt/projection/policy/artifact/recovery lineage 已完整双向拒绝。focused `32/32`（225 assertions）、Agent full `824/824`（10727 assertions）、typecheck/lint/Prettier 与三路只读复审通过。全程未读取 credential、调用 Provider、启动 Docker/API/browser 或创建仓库真实 V6 artifact；正式 Mock factory 当时留到 R4，后续已完成。已知边界是无父目录 fsync、claim tail 校验延后到 appender/seal、缺 stale-rename 后二次崩溃专测，后续 R4 仍如实保留。

2026-07-27 Phase 6.9.7 V6 R2 已完成：新增 `@repo/agent/tutor-v6` 与 `@repo/agent/wrong-question-organizer-v6`。Tutor 模型只选择本地 eligible intent ordinal，本地重建 preferred depth 与全部教学策略；Organizer 复用 V5 owner shortlist，只把 fingerprint 和 subject/deck/topic ordinal 交给模型，并在调用前后重新派生实际 shortlist 防 stale/ABA，最终真实 ID、locked name、confidence 与写权限保持本地。公共 Organizer merger 会把 validated-shaped 输入还原为 raw ordinal decision 并重新走完整 validator，hostile accessor、重复 ordinal、跨 subject、locked-name collision 与 prompt/oracle 泄漏均 fail-closed。focused `24/24`（989 assertions）、Agent full `792/792`（10458 assertions）、typecheck/lint 与两路只读复审通过。全程未读取 credential、调用 Provider、启动 Docker/API/browser 或创建 Live artifact；该检查点当时下一步为 V6 R3，后续 R3 已完成。

2026-07-23 Phase 6.9.7 Task 10 已完成：tracked `docker/.env.example` 固定 mock/live=false、全部 Agent gate=false、Tutor/Organizer 3000/5000ms 与空 component credential；Compose 只把 Tutor 三项投影给 `web`、Organizer 三项投影给 `server`，`worker/admin` 均不接收。Admin 的整份根 `.env` service 注入已移除，只保留显式 URL。resolved synthetic Compose fixture 证明 generic/cross-component key 不会穿透目标边界；worker module 仍强制关闭 Organizer。新 boundary RED/GREEN `3/3`、Compose readiness 合跑 `24/24`、Server config/Compose `29/29`、Tutor config `5/5`、tracked `config --quiet` 与 Server/Web build 通过。没有读取根 `.env`/key、调用 provider、启动 Docker service、执行 API/浏览器或创建业务数据；两个 gate 仍默认关闭。权威证据见 `docs/acceptance/phase-6-9-7-runtime-boundaries.md`，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

2026-07-23 Phase 6.9.7 Task 11 已完成：同一 `3e85fcc4` 起点完成 focused `97/97`、Agent `543/543`、AI `194/194`、Types `42/42 + tsc`、Server `2152 passed / 30 skipped`、Web `438/438`、Organizer PostgreSQL E2E `10/10`、Compose quiet config 与相关 lint/build。未修饰 baseline 保持 `6/48`、Tutor/Organizer semantic `0.4418666667/0.278125`；fresh Mock run `0c33c01f-802a-4f53-a6e6-538b7af9abc7` 为 `24/24` verified zero-call、`48/48` runtime、semantic `1/1`，但 `quality_gate_failed` 仍是 Live-only authority 的预期结果。Mock 临时证据已按精确路径删除，测试账号残留为 0；没有读取 credential、调用 provider、创建 Live marker/evidence、启动产品 Docker/API 或浏览器。权威证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-agents.md`；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要，两个生产 gate 继续默认关闭。

2026-07-24 Phase 6.9.7 Task 12 V1 已失败封存：零网络 preflight 先修复 Router/Verifier 真实 gate 名称漏检并提交 `5f2cfcdc`；唯一 run `39a62241-0f51-45be-a423-0d13b0b60ae4` 使用 `deepseek_network` 完成 72 cases，得到 `24/24` zero-call、`27/48` strict runtime。Tutor semantic `0.3485119048`、提升 `-0.0933547619`，Organizer semantic `0.7000000000`、提升 `0.4218750000`；安全、延迟、48 个 verified usage 与 `0.086418 CNY` 费用门通过，但两个 semantic 和 strict runtime 门未全部通过，最终 `quality_gate_failed`。evidence/marker SHA 与 validator 已记录在 `docs/acceptance/phase-6-9-7-tutor-wrong-question-controlled-live.md`。V1 不得重跑；按合同未启动 Docker/API/浏览器或 synthetic 产品数据，tracked defaults 仍关闭。Phase 6.9.7 未完成，不得直接进入 Task 13/main 合并或 Phase 6.10。

2026-07-24 Phase 6.9.7 V2 R0 零网络设计已冻结：V1 的 48 个 runtime 均 `rawSchemaValid=true`，但 Tutor 只有 9/24、Organizer 只有 18/24 `candidate_applied`；21 个失败都位于 raw schema 之后，但由于不保存 provider 原文，不能再武断归因。V2 保持 dataset/SHA/baseline/threshold/model/price/budget/timeout/权限/分母不变，通过共享深冻结 policy 让 prompt 与 canonical validator 使用同一规则源，并新增只含固定枚举的 `raw_schema / dynamic_contract / local_merger / applied` 诊断。V2 使用独立 runner/prompt/授权变量/marker/evidence，增加 held-out/metamorphic 防答案表测试；R1--R5 纯离线，R6 只允许既有本地 PostgreSQL/静态 Compose 门且仍保持外部 provider 零调用；R6 checkpoint 后必须停止并取得新的精确授权。权威设计见 `docs/superpowers/specs/phase-6-9-7-tutor-organizer-v2-remediation-design.md`，计划见 `docs/superpowers/plans/phase-6-9-7-tutor-organizer-v2-remediation.md`。R0 未改源代码、读取 credential、调用 provider 或启动 Docker/API/浏览器；该 checkpoint 当时的下一任务是 R1，后续已完成。

2026-07-24 Phase 6.9.7 V2 R1 bounded diagnostics 已完成：新增 `raw_schema / dynamic_contract / local_merger / applied` 四阶段和 nullable bounded reason adapter；Tutor/Organizer 的 dynamic reason 分域校验，未知或混合额外 reason fail-closed，structured object 形成前的 transport/runtime failure 与 zero-call 均保持双 `null`。V1 entry 的两个新字段必须完全 absent；runner-v1/v2 与各自 prompt identity 严格绑定。focused `19/19`、Agent full `548/548`（`5643` assertions）、typecheck/lint、V1 bundle validator 与两路独立复审通过；V1 evidence/marker SHA-256 仍为 `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` / `7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。公共 runner/CLI 仍只生成 V1，V1 evidence validator 明确拒绝 V2 report；本任务没有读取 credential、调用 provider、发布 V2 evidence 或启动 Docker/API/浏览器。该 checkpoint 当时下一任务是 R2，后续已完成。

2026-07-24 Phase 6.9.7 V2 R2 Tutor prompt/contract 单一规则源已完成：五类
intent 的 primary/allowed evidence、compatible depth 与通用选择语义已收敛到一个深冻结
readonly policy；contract validator、稳定 prompt formatter 与 local merger 共用同一
authority。depth 仍由 local merger 最终 fail-closed，保留 R1
`local_merger / incompatible_depth` 诊断语义；`answer_direct`、schema/projection、
dataset/SHA、质量门和预算均不变。Tutor candidate/Web config 的 prompt identity 已升为
`tutor-model-candidate-v2`，但 active public paired runner/CLI 仍只生成 V1，R5 前不存在
V2 marker/evidence 入口。Tutor/package focused `25/25`（`375` assertions）、Phase 6.9.7
兼容 `33/33`（`656` assertions）、Web config `5/5`、Agent full `552/552`（`5827`
assertions）、Web full `438/438`、Agent/AI typecheck/lint 与 Web lint 通过。两路复审无未关闭
Critical/Important；一条 depth 意见经核对冻结设计后撤回为测试覆盖建议，已补齐
逐 intent merger 矩阵。V1 evidence/marker SHA-256 仍为
`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。本任务未读取
credential、调用 provider、启动 Docker/API/browser 或修改业务数据；该 checkpoint 当时的
下一任务是 R3 Organizer prompt/contract precision，后续已完成。

2026-07-24 Phase 6.9.7 V2 R3 Organizer prompt/contract precision 已完成：known/unknown
subject authority、`keep_local + structured_subject`、same-subject `reuse_existing +
existing_deck_overlap`、`create_topic` evidence、`high + insufficient_signal` 禁止、六类
subject taxonomy、medium/high confidence 与单一 source-grounded topic 规则已收敛为一个深冻结
readonly association policy；contract validator 与稳定 prompt formatter 共用同一 authority。
`wrong-question-organizer-model-candidate-v2` identity 已由 candidate、Server config、Agent Trace
和 future V2 report identity 共用，但 active public runner/CLI 仍只生成 V1，R5 前不存在 V2
marker/evidence 入口。schema/projection v1、ordinal、owner snapshot、locked-name、写隔离和本地
merger 均未改变，也未新增 accepted-label 答案表。

R3/Phase 6.9.7 focused `40/40`（`582` assertions）、Agent full `554/554`（`6071`
assertions）、Server Organizer `30/30`、Agent/AI typecheck/lint、Server lint/build 与
`git diff --check` 通过；两路独立复审无未关闭 Critical/Important。V1 evidence/marker
SHA-256 仍为 `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。本任务没有读取
credential、调用 provider、创建 V2 evidence、启动 Docker/API/browser 或修改业务数据；
该 checkpoint 当时下一任务是 R4，后续已完成。

2026-07-24 Phase 6.9.7 V2 R4 held-out/metamorphic anti-overfit 已完成：新增独立深冻结
`phase-6.9.7-tutor-organizer-v2-robustness-v1` fixture，不进入冻结 72-case dataset、Live
分母或费用。Tutor 覆盖中英文同义改写、混合语言、context reorder、无关安全句、context
authority 变化与注入/凭据 zero-call；Organizer 覆盖六类 held-out subject、known/unknown
authority、same/cross-subject deck、deck/question ordinal reorder、evidence 顺序/重复、越界
ordinal、locked-name 和 authority drift fail-closed。实际 Tutor/Organizer candidate request 的
prompt leakage scanner 对 frozen case ID、dataset identity、oracle key、完整 expected object 与
canonical/accepted topic labels 命中为 0，并通过故意污染反例证明 scanner 有效。focused
`16/16`（`212` assertions）、Agent full `570/570`（`6283` assertions）、typecheck/lint、
新增 TypeScript 文件的 Prettier check 与 V1 validator 通过；dataset SHA 与 V1 evidence/marker SHA 不变，V2 marker/evidence
不存在。代码/安全与文档/历史边界两路独立复审均 `APPROVED`，无未关闭
Critical/Important。公共 runner/CLI 当时仍为 V1；本任务没有读取 credential、调用 provider、
启动 Docker/API/browser 或修改业务数据，该 checkpoint 当时下一任务是 R5，后续已完成。

2026-07-24 Phase 6.9.7 V2 R5 独立 runner/CLI/validator/evidence 已完成：legacy V1
runner/CLI/validator、确认词、授权变量、marker/evidence filename 保持兼容；新增显式 runner-v2、
V2 CLI/validator entry 与 package scripts。V2 的 approval env、确认词、marker 和 evidence prefix
均与 V1 双向隔离，marker 使用 `wx`，evidence 使用临时文件 + hard-link exclusive-create；旧 V1
marker 不阻塞 V2，V1/V2 validator 分别拒绝对方 report/filename。V2 report 绑定两个 v2 prompt
identity，并要求 72 个 entry 显式携带 bounded diagnostics；V1 entry 继续要求字段 absent。
`synthetic_test` 只能通过工程 schema，production gate 仍只接受 `deepseek_network`。

R5 isolation `5/5`（`40` assertions）、相关 focused `37/37`（`371` assertions）、Agent full
`575/575`（`6323` assertions）、typecheck/lint 通过。fresh V2 Mock run
`d4fc9a3a-5825-47f2-a4d2-d0148c7ccaf4` 为 `24/24` zero-call、`48/48` strict runtime、
semantic `1/1`、P95 `246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`，
按 Live-only authority 保持 `quality_gate_failed`；V2 validator `ok=true/filesChecked=1`，V1
validator 正确拒绝。Mock evidence 已精确删除，V2 Live marker/evidence 不存在；V1
evidence/marker SHA 不变。两路独立代码/安全复审 `APPROVED`，无阻断项。本任务未读取
credential、调用 provider、启动 Docker/API/browser 或修改业务数据，下一任务 R6。

2026-07-24 Phase 6.9.7 V2 R6 static/Mock checkpoint 已完成：V2 marker 的真实并发 `wx`
竞争只允许一个执行者，既有普通 marker、目录与普通存储故障被正确区分；evidence temp 改用
随机唯一 ID，旧 orphan 不阻断，hard-link final 成功即为发布 authority，unlink cleanup failure
不再误报 evidence 丢失。Chat request signal 贯穿 Tutor orchestration 与最终
`streamText.abortSignal`；Organizer provider await 中 abort 不写 Trace/command，command commit
失败以同 runId 写 failed 终态。真实 PostgreSQL E2E 证明同题 normal/force 与 single/batch 并发
最终只保留一个 owner-scoped deck/item，后续读取路由可见；未写题仍由 `deckItems: none` batch
补偿。Organizer 是同步 API，本 checkpoint 不宣称跨多实例 provider exactly-once。

V2 focused `57/57`；Agent/AI/Types/Server/Web 为 `578/194/42/2154/439`，Server `227`
suites passed / `30` skipped，Organizer PostgreSQL E2E `12/12`，typecheck/lint/build、Compose
quiet、changed TypeScript Prettier 与 diff 门通过。baseline 保持 `6/48`、Tutor/Organizer semantic
`0.44186666666666674/0.278125`。fresh V2 Mock run
`593ee863-3743-4957-96e1-cb90e852a795` 为 `24/24` zero-call、`48/48` runtime、semantic
`1/1`、P95 `246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`，按
Live-only authority 仍为 `quality_gate_failed`；V2 validator 通过、V1 validator 正确拒绝，临时
evidence 已精确删除。V1 evidence/marker SHA 不变，V2 Live marker/evidence 为 0，tracked
gates=false、component credential 为空、测试账号残留为 0。没有读取真实 credential、调用
provider 或执行产品 Docker/API/browser。contract/security/concurrency/routing 与
operations/acceptance/history 两路终审均 `APPROVED`，无未关闭 Critical/Important。权威记录见
`docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-r6-static-mock.md`；下一步必须停在 R7
新的 `Phase 6.9.7 Tutor/Organizer V2 branch controlled-Live` 精确授权门前。

2026-07-24 Phase 6.9.7 V2 R7 唯一 controlled-Live 已失败封存：用户重新接受 DeepSeek
数据保留/训练边界并授权一次 branch run 后，零网络 preflight 在 clean `8a3073f0` 上确认 V1
SHA 不变、V2 marker/evidence 为 0、V1 validator 与 V2 CLI hardening `8/8` 通过。唯一 run
`67ce18dd-e2ed-4a05-8507-2a98898b8ede` 固定 runner-v2、dataset SHA、两个 v2 prompt 与
`deepseek_network` provenance；`24/24` guard zero-call 通过，但 Tutor/Organizer 各 24 个 runtime
全部为 `fallback_runtime_error`，最终 `0/48` strict runtime、semantic `0/0`、verified usage
`0`、pricing/cost 不可验证，并有 `1` 个 critical case，故 `quality_gate_failed`。48 个失败都在
结构化对象形成前，bounded stage/reason 按合同为 `null/null`；证据不保存原始异常，不能武断
归因于 credential、网络、模型、endpoint 或 prompt。V2 evidence/marker SHA-256 分别为
`0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77` /
`ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504`，V2 validator 通过。
一次性名额已经消费，V2 不得重跑；R8 Docker/API/browser、Task 13/main 合并与 Phase 6.10
均不得开始。该终态当时要求先做零 Provider V3 复盘；后续 R0 设计已完成，见下一条，且仍不
授权新 Provider 调用。权威记录见
`docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-controlled-live-failure.md`。

2026-07-24 Phase 6.9.7 V3 R0 零 Provider 设计已冻结：源码取证确认 `@repo/ai` 已把受信
Provider failure 压缩为固定 category/stage 并写入 runtime Trace，但 Tutor/Organizer paired
runner 的 eval result 与 case builder 没有投影这些字段，外层 safe wrapper 又把失败统一为
`fallback_runtime_error`；当前 24 个 pair 还会在首个失败后继续派发。V3 复用现有安全 taxonomy，
新增有界执行阶段、真实 dispatch/usage outcome、24 guard 先行、单 pair 最多双并发和 run-level
quality breaker：由于质量门固定要求 `48/48` strict runtime，首个 runtime contract failure 后本轮已不可能
通过，收口当前 pair 后停止后续派发；未执行 case 仍留在 48 分母，且不得复制另一 lane 的故障
类别、重试、补跑或伪造零费用。V3 使用独立 runner/prompt/授权/marker/journal/evidence，崩溃后
只允许零网络 seal，不 resume/replay。R0 只修改文档，没有读取 `.env`/credential、调用 Provider、
创建 V3 Live artifact、启动 Docker 或修改业务数据。权威设计见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v3-remediation-design.md`，原子计划见
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v3-remediation.md`，验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r0-zero-provider-design.md`。后续 R1 已完成，见下一条。

2026-07-24 Phase 6.9.7 V3 R1 安全诊断与零网络 compatibility 已完成：新增独立
runner/prompt/runtime-evidence identity，V3 prompt identity 绑定既有 V2 深冻结 policy bytes；受信
runtime Trace 的八类 Provider category 与三个 structured-output stage 现在可以进入内部 V3
投影，`lastCompletedStage / executionOutcome / usageDisposition` 只接受固定枚举和一致组合。实际
invocation 由 recorder 在 delegate boundary 记录；safe wrapper 的外层失败按真实 `0/1` 写为本地
`harness_internal_error`，不再猜测为一次 Provider 调用，也不伪装 Provider category。V1/V2 report
继续要求全部 V3 字段 absent。synthetic compatibility matrix 覆盖 config、factory、request
shaping、DeepSeek non-thinking response audit、schema、abort/timeout，全程没有真实网络。
focused `52/52`、Agent `596/596`、AI `199/199`、V1/V2 validator、四个历史 SHA 与 V3 Live
artifact=0 检查通过；没有读取 `.env`/credential、调用 Provider、启动 Docker/API/browser 或创建
Live marker/journal/evidence。验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r1-diagnostics-compatibility.md`。该检查点当时下一步仅
R2；后续 R2 已完成，见下一条。

2026-07-25 Phase 6.9.7 V3 R2 strict-gate breaker 与双 lane ledger 已完成：新增独立 V3 paired
scheduler/report，先完整执行 24 条 guard；任一 guard 失败时 48 条 runtime 实际零调用。runtime
按 pair 顺序推进，同 pair 的 Tutor/Organizer 使用独立 AbortController、预算与故障归属；首个
runtime contract failure 收口当前 pair 后停止后续派发，未执行 case 继续以
`not_started_quality_breaker` 保留在固定 48 分母。`(runId,agent,pairedRunIndex)` ledger 阻止本进程
重复 dispatch，sibling 忽略 abort 时最多等待 1000ms 后以 orphaned/unknown usage 收口，不复制
另一 lane 的 Provider category。semantic-only mismatch 不提前熔断；usage/schema/abort/harness
failure、P95/usage/价格不完整和预算串用均 fail-closed。R2 focused `29/29`、Agent `608/608`、AI
`199/199`、typecheck/lint、V1/V2 validator、四个历史 SHA 与 V3 Live artifact=0 检查通过；未读取
`.env`/credential、调用 Provider、启动 Docker/API/browser 或创建 Live artifact。权威验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r2-breaker-lane-ledger.md`。该检查点当时下一步仅 R3
独立 CLI/journal/crash-only seal/evidence；后续 R3 已完成。

2026-07-25 Phase 6.9.7 V3 R3 crash-safe evidence 已完成：新增独立 V3 confirmation、授权变量、
CLI/validator/marker/journal/evidence identity。marker 以 `wx` 预留后，journal 初始记录先 fsync；每次
`dispatch_started` 也必须 fsync 后才允许 executor 调用。append-only JSONL 以 sequence + SHA-256
hash-chain 记录 guard、dispatch、runtime terminal、pair、breaker、run completion 与 seal；崩溃后
zero-network sealer 只依据持久化事实生成固定 72-entry failure evidence，不读取 credential、不创建
executor，也不 resume/replay/retry。sealer 对活跃 marker owner 返回 `live_attempt_in_progress`；死 owner
通过 token 化 recovery claim 原子接管，同 claim 只允许一个 appender；旧 appender 与 stale release 在
takeover 后均被 fence，不会触碰新 owner claim。evidence 使用 temp `wx` + fsync + hard-link final，
same bytes 幂等，不同字节冲突 fail-closed。V3 focused `50/50`（`360` assertions）、Agent
`629/629`（`6710` assertions）、AI `199/199`
（`1054` assertions）、Agent/AI typecheck/lint、V1/V2 validator 与四个历史 SHA 均通过；V3 Live
marker/journal/evidence/recovery claim 为 0。没有读取根 `.env`/credential、调用 Provider、启动
Docker/API/browser 或创建真实 V3 Live artifact。权威验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r3-crash-safe-evidence.md`。该检查点当时下一步仅 R4；后续 R4 已完成，唯一 V3 R5 又以 `quality_gate_failed` 封存。

2026-07-20 当前状态：Phase 6.9.5 已完成。default-off 时产品返回确定性建议；受控 DeepSeek V4 Pro API 与可见 `/plan` 已证明真实模型 candidate 可用，main replay 进一步证明 default-off 回滚、本地只读权限和事实权威未变。

2026-07-22 Phase 6.9.6 已完成。选定方案复用当前用户已经持久化的 Qwen `text-embedding-v4` / 1536 安全 Chunk embedding 形成最多 12 个语义候选，再由 DeepSeek V4 Pro 只裁决本地 ordinal 和受限关系；exact hash 保持 provider 前零调用。全阶段只返回建议，不写 Document / Chunk / 分类表，不自动删除、替换、合并、改名或分类。13 个 TDD 任务、V2 remediation、唯一 V2 controlled-Live、R7 Docker/API、可见浏览器、分支精确清理、`--no-ff` main 合并、main default-off 静态/Docker/API/浏览器回放与远程推送均已完成。worker/web/admin 不接收 Knowledge credential/gate/timeout，Review/Planner 产品验收也拒绝 Knowledge 能力同时开启。V1 controlled-Live 失败证据、R1--R6 产品失败和后续成功 evidence 各自保持不可变；两个生产 gate 已恢复关闭。Phase 6.9.7 已开始，不进入 Phase 6.10 分层记忆。权威设计见 `docs/superpowers/specs/2026-07-21-phase-6-9-6-knowledge-agents-design.md`，执行计划见 `docs/superpowers/plans/2026-07-21-phase-6-9-6-knowledge-agents.md`。

2026-07-23 Phase 6.9.7 Task 0 已冻结：Tutor 的明确教学指令继续 deterministic zero-call，隐含/上下文/冲突意图才允许受限 DeepSeek V4 Pro candidate；WrongQuestionOrganizer 的已有 item、固定 `>=0.72` 高置信结构字段和不安全输入 zero-call，低置信错题最多 12 条共享一次模型调用。模型只返回受限 enum/ordinal/topic label；TutorStrategy、真实 ID、JWT/owner、用户锁定名称、两阶段 Trace admission 和组织层写 command 由本地权威。固定 dataset 为 72 cases（两个 lane 各 12 zero-call + 24 runtime），production gate 默认关闭；Tutor/Organizer 使用两条 component-specific key 入口，timeout 为 `3000/5000ms`，worker role 强制关闭 Organizer runtime。Task 0 未实现 candidate、未读取 key、未调用 provider；baseline 数值必须由 Task 1 实际运行后写入 acceptance。权威设计见 `docs/superpowers/specs/phase-6-9-7-tutor-wrong-question-agents-design.md`，计划见 `docs/superpowers/plans/phase-6-9-7-tutor-wrong-question-agents.md`。

2026-07-23 Phase 6.9.7 Task 1 已完成：dataset `phase-6.9-tutor-wrong-question-v1` / SHA-256 `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e` 固定为 72 cases、48 runtime、24 paired indexes 与 32 Organizer decision units。当前未修饰 policy 为 `6/48` 完整命中、critical `0`；Tutor intent/depth/context/pedagogy 为 `0.1973333333/0.7916666667/1/0.25`，semantic `0.4418666667`；Organizer subject/action/reuse/topic/evidence 为 `0.25/0.8125/0/0/0`，semantic `0.278125`；combined `0.3599958333`。provider/token/cost 均为 0。该 baseline 没有穿过未来 candidate guard，不能代替 Task 9 的 `24/24` zero-call 验收。权威证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-baseline.md`；后续 Task 2--8 已完成，Task 9 后续已完成，Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

2026-07-23 Phase 6.9.7 Task 2 已完成：Tutor strict schema 只允许五类教学 intent，明确排除 `answer_direct`；Organizer 必须完整覆盖投影 question，只能返回固定 subject/action/confidence/evidence 与安全 topic label，重复/越界 ordinal、跨 subject deck、部分 batch 与本地 subject 权威冲突均 fail-closed。两条 projection 使用有界 descriptor clone、完整字段先扫描、safety metadata、裁剪/token 重验/deep freeze；Organizer 公开值只含 `q0..q11` / `d0..d19`，完整 answer/userNote、owner/UUID 与写能力不进入模型。共享 hardening 同时修复 Knowledge projection 的超大稀疏数组预解析、空 summary 与末尾高位 surrogate 边界。Task 2 `19/19`、共享 safety `25/25`、Agent full `502/502`、typecheck/lint 通过，两路独立复审无 Critical/Important；没有读取 key、创建 executor、调用 provider、启动 Docker/浏览器或修改业务数据。权威证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-contracts.md`；后续 Task 3--8 已完成，Task 9 后续已完成，Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

2026-07-23 Phase 6.9.7 Task 3 已完成：Tutor candidate 复用本地 signal detector，五类明确教学指令、非 Tutor route、空/不安全/abort/预算失败保持 runtime 前零调用；隐含、上下文、冲突与有 active context 的 `general_follow_up` 最多调用一次 `tutor_strategy`。预算固定 `1/1200/300`；共享 runtime、strict schema、evidence/usage/depth admission 通过后，本地重建 booleans、answer structure、prompt/debug 与 context 使用，模型无法选择或改写 `answer_direct`。focused `16/16`（含冻结 12+24 eligibility）、Agent `518/518`、AI `193/193`、typecheck/lint 与两路复审通过。只使用 Mock/注入式无网络 runtime，没有读取 key、调用 provider、启动 Docker/浏览器或创建业务数据；该检查点当时尚未接入 Web product composition，后续 Task 5--8 已完成。证据见 `docs/acceptance/phase-6-9-7-tutor-model-candidate.md`；Task 9 后续已完成，Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

2026-07-23 Phase 6.9.7 Task 4 已完成：WrongQuestionOrganizer candidate 支持最多 12 道错题、20 个已有专题和一次 `1/3500/800` 调用；已有 item、精确专题、高置信结构字段、owner/stale/abort/预算/安全失败保持 runtime 前零调用。模型只返回受限 ordinal/enum/安全 topic label，本地重建真实 ID、原 subject、locked deck 名称、reason/description、数值 confidence、signals 与全部写权限；partial/重复/越界/跨 subject/写命令/非法 usage/runtime failure 整批 deterministic fallback。focused + companion `24/24`，冻结 24 条 runtime fixture 均恰好调用一次；Agent `529/529`、AI `194/194`、typecheck/lint、ESM export、diff 与两路复审通过。只使用 Mock/注入式无网络 runtime，没有读取 key、调用 provider、启动 Docker/浏览器或修改业务数据；后续 Task 5--8 已完成，Task 9 后续已完成，Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

2026-07-23 Phase 6.9.7 Task 5 已完成：Tutor package candidate 已接入 Web server-only default-off composition。配置固定 `deepseek-v4-pro`、精确 `https://api.deepseek.com/v1`、non-thinking JSON、3000ms、无 tools/retry，只读取 `TUTOR_AGENT_DEEPSEEK_API_KEY`；gate/global Live/URL/key/timeout/价格/依赖任一无效都不创建 Live executor。Route 在 live access 与 conversation-context prepare 后只注册 Tutor factory；final canonical route 非 Tutor 时不创建 Tutor bundle/runtime、不读取 component credential，Live executor/runtime 仅在 candidate 真正调用时以单请求 Promise memo 惰性构造。明确教学指令、不安全输入、abort 与配置/预算失败保持 provider 零调用。独立 `1/1200/300` 预算与 `0.006 CNY` cap 不污染 Router -> Verifier 共享预算，任何失败保留原 Tutor route 和 deterministic strategy。安全 header/Trace 只含固定 disposition/reason、正 usage、pricing/CNY，Tutor CNY 不混入顶层 USD；Compose 只向 `web` 注入 Tutor gate/timeout/key。focused `27/27`、Web `432/432`、Agent `529/529`、AI `194/194`、Web lint/build、Compose tracked-example quiet parse、diff 与两路复审通过。没有读取根 `.env`、调用 provider、启动 Docker/浏览器或创建业务数据；gate 仍默认关闭，尚未 controlled-Live。证据见 `docs/acceptance/phase-6-9-7-tutor-web-runtime.md`。后续 Task 6--8 已完成，Task 9 后续已完成，Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

2026-07-23 Phase 6.9.7 Task 6 已完成：WrongQuestionOrganizer 在单个 bounded `REPEATABLE READ + READ ONLY` 事务中读取最多 12 个目标，使用 JWT secret 派生的域分离 HMAC 绑定 owner，并以深冻结 fingerprint 覆盖错题、现有 item、最多 20 个 group/deck、名称、`nameLocked`、时间与关键词；missing/cross-owner 统一 404。产品执行 snapshot -> 事务外 pre-fence -> decision -> post-fence -> 深冻结 model-free command -> owner advisory-lock `Serializable` 写事务内第三 fence；stale/用户 authority 不写，force relation 保持唯一，rename/move/remove 共用 owner lock，P2034/40001 只 bounded retry 本地事务。精确同名旧 deck 全量复用，canonical 100 条窗口溢出时 fail-closed。focused `23/23`、Server `2122 passed / 30 skipped`、真实 PostgreSQL E2E `9/9`、Database `7/7`、lint/build/diff 通过。Task 6 当时没有 runtime/Trace/provider；后续 Task 7 已接入 default-off runtime、两阶段 Trace 与 HTTP abort。证据见 `docs/acceptance/phase-6-9-7-wrong-question-organizer-owner-command.md`。

2026-07-23 Phase 6.9.7 Task 7 已完成：WrongQuestionOrganizer NestJS composition 使用独立 default-off gate 与 `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`，固定 DeepSeek V4 Pro non-thinking JSON、5000ms、`1/3500/800`、`0.016 CNY` cap、no tools/retry；只有 `SERVER_ROLE=api|both`、全局 Live 双开关、精确 HTTPS URL、独立 key 与已知价格同时成立才创建 executor，worker 强制关闭。single 最多一次 candidate；batch 最多挑选 12 个低置信安全目标共享一次 candidate，其余按本地 command 分批处理。candidate 后重新验证 owner snapshot；模型结果只有在同一稳定 runId 的 `command_pending` admission Trace 原子落库后才能进入 Task 6 的 model-free command，final Trace 失败只保留 pending，不回滚已授权写入。HTTP abort 贯穿 snapshot/candidate/command preflight，事务开始后只完成最小本地写入。focused 单测 `126/126`、真实 PostgreSQL AgentTrace/Organizer E2E `16/16`、Server full `226/226 suites / 2146 passed / 30 skipped`、Agent `529/529`、AI `194/194`、typecheck/lint/build/diff 与两路独立复审通过；未读取根 `.env`/key、未调用 provider、未执行 controlled-Live、Docker 产品或可见浏览器验收，生产 gate 仍默认关闭。权威证据见 `docs/acceptance/phase-6-9-7-wrong-question-organizer-runtime.md`。后续 Task 8 已完成，Task 9 后续已完成，Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

2026-07-23 Phase 6.9.7 Task 8 已完成：WrongQuestionOrganizer single/batch response 现在只在顶层返回 strict request-level runtime：`source / disposition / degraded / 可选 traceId`。只有已持久化 Trace 的 `candidate_applied` 才能返回 `hybrid_model`；正常 gate-off/high-confidence 为本地非降级，schema/usage/budget/timeout/abort/stale/Trace/runtime 失败为本地降级。batch item 不携带 runtime，本地 remainder 不覆盖 candidate scope 的来源/降级结论；Web API 在 envelope 解包后仍执行 Zod strict parse，未知或敏感字段 fail-closed。`/error-book` 只在用户主动批量整理成功后显示“语义整理 / 本地规则 / 安全回退”，degraded 优先，390/510/1440px 静态布局可安全换行，不提供模型重试或自动 mutation。Types `42/42`、Web `438/438`、Server `2149 passed / 30 skipped` 及 focused/typecheck/lint/build/diff 门通过；未读取 key、调用 provider 或执行 controlled-Live/Docker/可见浏览器，两个 gate 仍默认关闭。证据见 `docs/acceptance/phase-6-9-7-wrong-question-organizer-api-source.md`；Task 9 后续已完成，Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

2026-07-23 Phase 6.9.7 Task 9 已完成：72-case strict paired report 固定 24 条 guard zero-call、48 条 runtime、24 个 paired index 与 32 个 Organizer decision units；失败不删分母。两次 Mock 均为 `24/24` verified zero-call、`48/48` strict runtime，Tutor/Organizer semantic `1/1`，P95 `246/328/328/276ms`，synthetic usage `21948/5647`、estimated `0.099726 CNY`；`executorProvenance=mock_synthetic`，所以 `quality_gate_failed` 是 Live-only authority 设计。公共 Live CLI 不接受注入 executor；测试专用 `synthetic_test` provenance 永远不能通过 production gate，只有真实 CLI 自建 executor 才是 `deepseek_network`。旧 `chatProduct*` 已更名为 `tutorOrchestration*`，明确不包含真实 Router、HTTP、RAG 或最终流式模型。focused `14/14`、Agent `543/543`、AI `194/194`、typecheck/lint、两次 Mock CLI、bundle validator 与 diff 门通过。没有读取 key、调用 provider、创建 Live marker/evidence 或执行 Docker/浏览器；两个 gate 仍默认关闭。证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-paired-eval.md`；Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

Phase 6.9.6.1 已固定 `phase-6.9-knowledge-agents-v1`：Dedup 40 条、Organizer 32 条，其中 24 条 zero-call contract 与 48 条 runtime quality case 按 `pairedRunIndex=0..23` 配对。未经修饰的 deterministic baseline 为 `12/48` 完整命中、critical `0`、Dedup macro-F1 `0.3343653251`、revision recall `0`、Organizer subject/tag/collection `0.25/0/0.4347826087`、weighted semantic `0.2322452551`，provider/token/cost 均为 0。该检查点当时尚未穿过 candidate guard；后续 Task 10 已让 24 条 zero-call 实际经过 guard 并由独立 runtime counter 证明 0 调用，不能用后续结果改写 baseline 报告。证据见 `docs/acceptance/phase-6-9-6-1-knowledge-agent-baseline.md`。

Phase 6.9.6 Task 2 已建立模型边界但没有调用模型：Dedup 只能输出 0..11 的四类关系、medium/high confidence 和固定 evidence code；Organizer 只能输出 0..19 的学科/资料类型、受限 topic label 与有序唯一集合成员。动态 validator 继续拒绝重复/越界索引和错误 evidence 关联。`knowledge-model-projection-v1` 先以普通自有数据 descriptor clone 隔离 hostile getter/proxy，再扫描完整 filename 与每段 summary 的 UTF-16、控制字符、credential、instruction/system prompt 与 safety metadata；只有全部字段扫描完成后才裁剪、分配 `d0...` ordinal 并深冻结，输出不含 document ID。unsafe non-target 会整份排除并重建 pair，unsafe target 固定 `target_projection_blocked`。focused tests `10/10`、Agent typecheck/lint exit 0，两轮独立复审无 Critical/Important；没有读取 key、调用 provider、启动 Docker/浏览器或创建业务数据。下一任务是 Task 3 Dedup candidate 与本地权威 merger；24 条 zero-call 仍未完成 runtime counter 验证。

Phase 6.9.6 Task 3 已完成 Dedup 受治理 candidate 与本地权威 merger：exact-hash pair 即使误入 shortlist 也在 runtime 前剔除，保留本地 `exact_duplicate / use_existing`，无剩余语义 pair 时 counting runtime 为 0。模型只可裁决 semantic duplicate、revision、complementary、unrelated；semantic duplicate/revision 固定人工复核，revision 缺少本地版本/时间证据时降级并标记 `insufficient_version_evidence`，complementary 只建议 `keep_both`。真实 ID、标题、原因、严重度、置信度、recommendation、signals 和权限全部由本地重建，最多 5 条；timeout、abort、budget、schema、invalid usage 与 runtime throw 均回退 deterministic。公开 projection 不暴露 ordinal→ID map；内部 map 只供本地 merger。focused `22/22`、AI `191/191`、Types `39/39` 与相关 typecheck/lint/diff 门通过，规格/质量复审无 Critical/Important。仅使用 Mock/注入式无网络 executor，没有读取 key、调用 provider、启动 Docker/浏览器或创建业务数据；整套 24/24 zero-call、Organizer candidate、shortlist、paired eval 与生产接入仍未完成。下一任务是 Task 4 Organizer candidate 与本地权威 merger。

Phase 6.9.6 Task 4 已完成 Organizer 受治理 candidate 与本地权威 merger：至少 1 份资料通过完整字段与 safety metadata 投影后才有资格调用 runtime；模型只返回 ordinal document index、固定 subject/resource type、最多 2 个 topic label，以及最多 5 个集合和每组 2..8 个有序唯一成员。本地按内部 ordinal map 重建真实 ID、中文标签、reason、description、confidence、signals 和全部权限，最终标签最多 3 个。schema 后仍拒绝 URL、Markdown、HTML、instruction、credential 与控制字符，任一非法字段整批回退；unsafe projection、abort、预算、timeout、invalid usage、schema 或 runtime 异常均返回 deterministic Organizer。focused `12/12`、AI `192/192`、Agent/AI typecheck/lint 与 diff 门通过，规格/质量复审无 Critical/Important。仅使用 Mock/注入式无网络 executor，没有读取 key、调用 provider、启动 Docker/浏览器或创建业务数据；owner snapshot、stale fence、shortlist、server gates、Trace/API/UI、paired eval 和生产验收仍未完成。下一任务是 Task 5 单一不可变 owner snapshot 与 provider 前 stale revalidation。

Phase 6.9.6 Task 5 已完成单一 owner snapshot 与 provider-preflight stale fence：Knowledge API 在同一个 bounded PostgreSQL `REPEATABLE READ` interactive transaction 内先执行 `SET TRANSACTION READ ONLY`，按 canonical owner 查询最多 20 份资料，并在该上限内补入 targeted document；缺失/跨 owner 目标仍返回同一 404。事务输出 `knowledge-owner-snapshot-v1` 深冻结快照，raw user ID 不进入快照，owner 采用 JWT secret 派生的域分离 HMAC；fingerprint 覆盖 target binding、所有 prompt/policy/merger 相关 Document 字段、所选 chunk 全文 hash、identity/order、canonical safety fingerprint 及算法版本。事务结束后短查询重跑同一选取并重建完整 fingerprint，任一 document/chunk/safety/selection 漂移或查询异常都 fail-closed 到 deterministic 本地建议；模型接入点保留在 fence 之后，当前仍没有 provider 调用。focused `13/13` 与 Server build 通过；没有读取 key、启动 Docker/浏览器或创建/修改业务数据。下一任务是 Task 6 owner-scoped pgvector semantic shortlist。

Phase 6.9.6 Task 6 已完成 owner-scoped pgvector semantic shortlist：只使用当前 owner 的 `DONE` Document 和显式 `riskLevel=low + safeForPrompt=true` Chunk，并要求持久化 provenance 精确等于 Qwen `text-embedding-v4` / 1536；旧 Chunk 缺少可信 provenance 时不进入 shortlist，重新处理后会写入 provider/model/dimensions。每份资料按 `index/id` 以 `ntile(6)` 稳定采样最多 6 个 Chunk，文档 pair 取最高 3 个跨文档 cosine 的均值，阈值 `>=0.78`、high band `>=0.9`、稳定排序后最多 12 对；exact non-empty hash 在向量计算前排除，target 模式只保留含 target 的 pair。两侧 Chunk/Document 均绑定 canonical owner，SQL 只使用 Prisma tagged 参数，不返回向量、正文、文件名、metadata 或 raw owner；畸形、重复、越界或漂移结果整批 fail-closed。shortlist、selected Chunk 全文 hash/safety 与 pair score/band 均进入 snapshot fingerprint，provider 前重建可发现选择或语义分数漂移。focused `44/44`、Server lint/build 与 diff 门通过，两轮复审无 Critical/Important；没有读取 key、调用 provider、启动 Docker/浏览器或修改业务数据。该检查点当时的下一任务是 Task 7 default-off gates、DeepSeek runtime、价格表与不可变共享预算；后续 Phase 6.9.6 已完成。

Phase 6.9.6 Task 7 已完成 production composition 地基但尚未接入产品编排：新增 `KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED` / `KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED` 两个独立 default-off server gate 与 4500ms timeout；真实 executor 只有在 `AI_PROVIDER_MODE=live`、global live gate、对应组件 gate、精确 DeepSeek HTTPS base URL、有效 credential 与已知价格同时成立时才创建，worker role 强制双 gate 关闭。模型固定 `deepseek-v4-pro`、`knowledge-agents-v1` 与 `deepseek_v4_pro_nonthinking_json`，复用共享 executor 的 `maxRetries=0`、no-tools 与 abort deadline。单请求先从冻结 `2 calls / 6000 input / 1200 output` budget 同时证明 Dedup `3000/500` 和 Organizer `3000/700` reservation，理论最坏费用 `0.0252 CNY`，超过 `0.03 CNY`、未知/被篡改价格、缺 key、异常 getter/proxy 或 usage 不可验证均 fail-closed。focused `90/90`、Server lint/build 与 diff 门通过；规格 PASS，质量 Important 修复后 APPROVED。没有读取 `.env`/API key、调用 provider、启动 Docker/浏览器或修改业务数据；runtime bundle 当前尚未注入 Service dispatch，因此产品仍返回 deterministic 建议。下一任务是 Task 8 并行编排两个 candidate，并增加安全 API metadata 与 Trace。

Phase 6.9.6 Task 8 已把两个受治理 candidate 接入 `GET /knowledge-agent/suggestions`：只启动对应独立 gate 已启用的 candidate，Dedup `3000/500` 与 Organizer `3000/700` 两份冻结 reservation 在 Promise 前一次性证明，eligible 路径通过 `Promise.all` 并行。provider 前和候选完成后都重验 owner snapshot，第二次 fence 漂移会丢弃模型值。strict runtime metadata 只有在 usage/Trace/价格均可验证且 Trace 已持久化时才允许 `hybrid_model / candidate_applied`；Trace unavailable、abort、schema、预算、usage、runtime 或 stale 均回到本地只读建议。Trace 使用一个 parent 和两个 candidate step，step 带固定 agent/version/disposition/reason/latency/usage/CNY provenance；现有顶层费用字段保持 USD 语义，不把 V4 Pro CNY 冒充为 USD。HTTP `aborted` 传播同一 AbortSignal 并在 finally 清理 listener。Knowledge focused `47/47`、Types `39/39`、Server lint/build、Types typecheck 与 diff 门通过，两轮复审无 Critical/Important。没有读取 `.env`/API key、调用 provider、启动 Docker/浏览器或修改 Knowledge 业务数据；双 gate 仍默认关闭。下一任务是 Task 9 `/knowledge` 展示 local/hybrid/degraded 只读状态。

Phase 6.9.6 Task 9 已在 `/knowledge` 建立只读来源可见性：任一 candidate 降级时优先显示“本地规则建议/已安全回退”，否则只要有已持久化的 `hybrid_model / candidate_applied` 就显示“语义建议”，双 gate 默认关闭或未命中时显示“本地规则建议”。来源 badge 与说明位于现有建议上方，即使建议数组为空但 API response 存在也保留；loading、request error、empty、上传、处理、替换、删除和检索路径不变。UI 不展示 token、成本、Trace ID、provider error、document UUID，不提供重试语义或自动整理动作；`flex-wrap + min-w-0 + break-words` 保证移动端换行。Web `413/413`、lint、production build 与 focused strict API/view/page tests 通过，两轮复审在补齐 mixed degraded precedence 和未知 runtime 字段拒绝后 PASS。没有读取 `.env`/API key、调用 provider、启动 Docker/浏览器或修改业务数据；双 gate 仍默认关闭。下一任务是 Task 10 paired runner、CLI 与 evidence validator。

Phase 6.9.6 Task 10 已建立同一 72-case 的 strict Mock/Live paired runner：24 条 zero-call 不再回显 expected reason，候选级样本实际穿过 exact-hash、projection safety、abort 与 budget guard，并以独立 executor counter 证明 0 调用；server-preflight 样本以独立条件结果再与 frozen reason 对照。48 条 runtime case 组成 24 次 Dedup/Organizer `Promise.all`，任何 schema/usage/质量失败继续留在分母。报告重算版本、case identity、指标、并行 endpoint latency、exact-hash、安全计数、正 usage、逐 case/总 CNY 价格与 gate；Mock 即使满分也不能打开生产 gate。CLI 只有 fresh `PHASE_6_9_6_CONTROLLED_LIVE_APPROVED=true` 加完整 live 配置才可进入 Live，并用一次性 marker 与 Windows hard-link 发布不可变 evidence；stdout 只保留聚合信息，目录 validator 绑定 filename 与 mode/scope/runId，并拒绝敏感 key、重复/cross-scope runId、未知 usage/price 与成本篡改。Mock 为 `24/24 zero-call + 48/48 strict runtime`，生产 gate 按设计为 `quality_gate_failed`；focused `16/16`、Agent typecheck/lint、Mock CLI/validator 与两轮只读复审通过。没有读取 `.env`/API key、调用真实 provider、启动 Docker/浏览器或修改业务数据；双 gate 仍默认关闭。Task 11 已完成，当前下一任务是 Task 12 分支静态/Mock 验收。

Phase 6.9.6 Task 11 已补齐 API-only Docker 与运维边界：Compose 仅向 `server` 投影 `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY`、两个独立 default-off gate 和两个 4500ms timeout，worker/web/admin 均不接收；worker role 即使被注入伪造 live/gate/key 也强制使用 Mock 且不创建 executor。Knowledge composition 只读取独立凭据，不借用通用 Chat 或 Review/Planner 产品凭据；Review/Planner 产品 acceptance 同时拒绝 Knowledge key/gate，避免跨能力串用。文档固定完整 Live conjunction、`2 calls / 6000 input / 1200 output`、`0.03 CNY` request cap、合成资料限定、provider retention 前置、default-off 恢复和禁止破坏性 Docker 清理。focused config tests 与 Compose `config --quiet` 通过后才提交；本任务未启动容器、浏览器或 provider。下一任务是 Task 12 分支静态/Mock 验收与 evidence checkpoint，随后必须停下重新申请 controlled-Live 授权。

Phase 6.9.6 Task 12 已完成分支静态/Mock checkpoint：Knowledge focused 为 Agent `114/114`、Types `1/1`、Server `50/50`、Web `7/7`；分支全量为 Agent `465/465`、Types `39/39`、Server `2110 passed / 30 skipped`、Web `413/413`，相关 typecheck/lint/build 与 `git diff --check` 均通过。frozen baseline 保持 `12/48`、semantic `0.2322452551`；Mock 为 `24/24` verified zero-call、`48/48` canonical schema、semantic `1`、P95 `286/348/348ms`、usage `14472/4185`、estimated `0.068526 CNY`。Mock 的 `quality_gate_failed` 是 Live-only production gate 设计，不是 Mock contract 失败。Windows evidence 字节通过 `.gitattributes` 固定，V9 LF-only 断言与 V17--V22 history-coupled bridge tests 已作 hermetic 测试修复，生产 authority 仍 fail-closed。没有调用真实 provider 或进行 Docker API/可见浏览器产品验收；只恢复既有 PostgreSQL service 完成全量 integration gate，没有创建业务对象或 Trace。双 Knowledge gate 当时仍为 `false`，Phase 6.9.6 尚未完成，下一步必须先取得一次新的 controlled-Live 明确授权。该句只保留 Task 12 checkpoint 的历史边界；后续唯一 V2 Live、R7 与浏览器结果见下文当前状态。证据见 `docs/acceptance/2026-07-21-phase-6-9-6-knowledge-agents.md`。

2026-07-22 唯一 V1 controlled-Live 已以 `quality_gate_failed` 封存，run ID 为 `35cef6a3-97ee-4cb3-accb-ff8fa6bd59cd`；V1 evidence 与 marker 不得重跑、删除、覆盖或改写。随后 V2 R1--R3 只修复 Dedup/Organizer 语义 contract 与有界 evidence 诊断，并使用独立授权变量、文件名和一次性 marker。

2026-07-22 V2 R4 静态/Mock checkpoint 已完成：run `05516dae-e8d3-42df-ba6b-3ffd41e99db6` 覆盖 72 cases，`24/24` zero-call、`48/48` runtime，Dedup macro-F1/revision recall 与 Organizer subject/tag/collection 五项指标均为 `1`；P95 为 `286/348/348ms`，usage `14472/4185`，Mock estimated cost `0.068526 CNY`，validator 为 `ok=true / evidenceCount=3`。Mock 的 `quality_gate_failed` 是当时的 Live-only 门设计。该段保留 R4 当时尚无 V2 Live 的历史边界；后续唯一 V2 Live 已通过，见当前 Phase 6.9.6 Task 13 状态，不得用后续结果改写 R4 evidence。

2026-07-22 用户已接受 DeepSeek 当前账号的数据保留/训练边界并授权唯一一次 V2 branch controlled-Live。授权后的零调用 preflight 发现 standalone eval CLI 仍读取通用 `DEEPSEEK_API_KEY`，与 Task 11 的独立 Knowledge credential 边界冲突；现已改为只接受 `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY`，generic-only 配置会在 marker/executor 前返回 `live_configuration_invalid`。RED/GREEN focused 为 `7 pass / 2 fail -> 9/9`，Agent 全量 `469/469`、typecheck/lint/diff 均通过。该句记录运行前 checkpoint；其后唯一 V2 marker/evidence 已按授权创建并封存，根 `.env` 未改写。该修复不改变 dataset、prompt、schema、价格、预算、timeout、质量门或一次性授权语义。

2026-07-22 Task 13 分支产品验收当前事实：唯一 V2 run `10ae2f36-69f6-422c-a99f-6bf6b3aeb226` 为 `quality_gate_passed`；独立 R7 run `38748577-f250-4a7a-ab17-8fd14a63b2a3` 在 `1ce77ff` 镜像上完成 Dedup-only、Organizer-only、双开关和强制失败/default-off，四次真实候选均为 `candidate_applied`，总 usage `3770/446`、费用 `0.013986 CNY`。exact hash、credential、prompt injection、unsafe metadata 与跨 owner target 均为 provider 前零调用；API/Trace parity、worker isolation、只读 fingerprint 与精确清理通过。可见浏览器 run `012bc3ce-486e-4dce-be32-d29c246f47cd` 完成真实上传、处理、列表、Qwen 混合检索和 1440/510/390px 的 local/semantic/degraded/error 状态，浏览器阶段新增模型调用为 0。合成 User/Document/Chunk/Object/Job/Trace/Session/browser storage 均为 0，卷保留，API 恢复 `mock / live=false / false/false / credential absent`。两轮独立复审无 Critical/Important；下一步仅为分支提交、main default-off 回放和推送，禁止重跑 V2 或 R7。

2026-07-15 的后续权威路线覆盖 12 个受治理组件：11 个当前逻辑节点 `RouterAgent`、`TutorAgent`、`RetrieverAgent`、`KnowledgeVerifierAgent`、`FinalResponseAgent`、`WrongQuestionOrganizerAgent`、`ReviewAgent`、`PlannerAgent`、`MemoryAgent`、`KnowledgeDedupAgent`、`KnowledgeOrganizerAgent`，以及待实现的 `Tool-Using Orchestrator`。当前 `createAgentGraph()` 仍只是 descriptor；Retriever/FinalResponse 主要隐含在 RAG/Chat 链路，Orchestrator 尚未实现。目标路径为：Router、Tutor、Verifier、WrongQuestionOrganizer、Retriever 使用模型/规则混合；Review、Planner、KnowledgeDedup、KnowledgeOrganizer、FinalResponse、Memory 候选提取与 Orchestrator 必须有真实模型参与。权限、安全、事实计算、schema、预算、人审和写库保持本地权威。必须先完成全部 Agent 架构，再进入 Phase 6.10 记忆注入与 Episodic Memory。完整设计见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`。

Phase 6.9.1 已建立统一评测 contract 和 `phase-6.9-seed-v1`：Router、Verifier、Memory 各 8 个可执行 deterministic case，Orchestrator 8 个 expectation-only case。当前 baseline 为 21/24，通过率 87.5%，并发现 MemoryAgent 会把含示例 API key 的“以后请记住”误提取为偏好候选这一 critical failure。该阶段不调用真实模型、不修饰 baseline 结果；这是早期四类 seed 的历史范围，不代表最终治理范围。后续所有模型化/混合 Agent 都必须有职责匹配的 baseline、Mock、controlled-Live、降级、权限、延迟和成本证据。

Phase 6.9.2 已在 `@repo/ai` 建立共享 `ModelAgentRuntime`：Mock 与 Live 共用 Zod schema、请求/结果、不可变 run budget 和安全 Trace contract；调用前按请求最大输出量预留预算，避免并发重入超卖。`@repo/ai` 不读取环境变量，API key 与 base URL 只由 composition root 传入 OpenAI-compatible executor closure；runtime 结果和 Trace 不返回完整 prompt、完整模型输出、provider 原始错误、API key、base URL 或 stack。调用方仍需先权威解析 live 双开关，runtime 再检查 `liveCallsEnabled`。

Phase 6.9.3.3 已把滚动摘要接入 `POST /conversation-context/prepare`：达到 12 条未覆盖消息或 summary + 未覆盖窗口达到 `maxInputTokens` 70% 时触发；水位只停在最新完整 assistant 消息，user-only tail 永不覆盖。摘要源仅允许 USER/ASSISTANT，provider 前会脱敏 bearer/cookie、裸 provider key、client secret/password 与 PEM 私钥，credential-like 输出与越界 usage 均不持久化。模型调用严格位于事务外；事务内以 Serializable snapshot 复核目标范围 source hash，并以 `summaryVersion + coveredThroughOrder` CAS 推进单行摘要。

Phase 6.9.3.4 已把 Web request 的 `conversationId`、authenticated prepare、分层 assembler 与 Dexie v9 恢复接入 `/api/chat`。首轮没有 conversationId 时跳过 prepare，服务端 sync 返回 id 后第二轮才调用；live auth 始终先于 prepare。prepare 仅在 token + id 同时存在时执行，默认 10 秒且限定 1~15 秒，向下传播 request abort，网络/timeout/5xx/schema 失败只返回固定 degraded 元数据且不阻断 Mock Chat。assembler 固定保留 base/latest user，独立装配 agent guidance、untrusted state guidance、OCR、完整 recent turns、safe RAG 与 summary；agent/state 合计最多 10% 且分别观测，optional layer 不会制造 413，RAG 整层 drop 时同步清空引用，summary 只在确有 history dropped 时考虑。headers 与 Trace 只含状态、版本、固定 drop code 和 token 计数，不含 summary/prompt/chunk 正文。PostgreSQL 仍是 state/summary 权威源，Redis 是服务端 cache，Dexie v9 只保存当前用户可恢复的 sanitized `activeGoal/activeQuestionId`、版本与有效期；写入按用户串行、版本单调、过期/跨用户/登出 fail-safe，不保存 summary、tool、proposal、prompt 或 token，也不凭 question id 伪造 OCR。

Phase 6.9.3.5 已完成 Docker Mock 与受控 Live 收口。Mock API/浏览器覆盖 12 条触发、复用、多用户、CAS/stale、Dexie 白名单和 Trace；Live 使用 `deepseek-v4-flash` 生成 `conversation-summary-v1`，summary version/watermark 为 `1/15`，provider-reported summary usage 为 `2246/154`，最终 Chat 保留二次函数判别式目标与正确值 `1`。DeepSeek structured output 通过共享 executor 固定 `mode: 'json'`，仍由 Zod strict schema、预算、超时与双开关约束。Trace 只新增 `layerTokens=m/a/s/o/r/k/y` 计数。验收后恢复 Mock，严格清理 7 个合成账号、4 个会话、级联 summary/state/cache 与测试浏览器 storage；详细证据见 `docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md`。下一任务是 Phase 6.9.4 Router/Verifier 混合路径。

Phase 6.9.4.1 已固定 `phase-6.9-router-verifier-v1`：Router 60 条覆盖 36 个高置信、16 个歧义、8 个安全边界 case；Verifier 40 条覆盖 trusted/insufficient/complex conflict/stale/prompt injection。deterministic baseline 为 74/100、critical failure 2；Router overall 75%、歧义 macro-F1 52.47%、高置信 86.11%、权限边界 80%，Verifier overall 72.5%、复杂冲突 recall 0%、注入放行 0。该结果不修饰、不启用模型路径；该阶段随后进入 Phase 6.9.4.2 Mock candidate contract。证据见 `docs/acceptance/phase-6-9-4-1-router-verifier-baseline.md`。

Phase 6.9.4.2 已实现 Router / Verifier Mock candidate contract，但尚未接入生产 Chat，也未调用真实模型。Router ineligible 与 safety case 均为零 runtime invoke，safety 固定回到本地 safe chat，权限只由 canonical route map 重建；Verifier 对 prompt injection、high-risk 或 `safeForPrompt=false` 证据整批零调用阻断，使用 literal `evidenceCodes` 的 strict discriminated union、稳定 chunk 排序，并在失败时保留限制性 deterministic 状态、把 trusted 收紧为 suspicious。schema、budget、timeout、abort 和 runtime contract 失败均安全降级；hostile getter/proxy/signal、runtime 预算污染和 telemetry unavailable 按 fail-closed 处理，provider-reported input usage 不会被工程估算误当作硬上限。预算使用隔离 snapshot，telemetry 不可验证时按 preview budget 记账以阻止重试超卖。Envelope/Trace 不含 prompt、query/chunk、provider output/raw error 或 credential 正文。该阶段完成时为 `Enabled=no`、`Reason=paired_candidate_not_run`；Mock 只证明工程 contract，不证明语义质量。证据见 `docs/acceptance/phase-6-9-4-2-router-verifier-mock-candidate.md`；其后由 Phase 6.9.4.3 执行 same-case deterministic / Mock / controlled-Live paired eval。

Phase 6.9.4.3 的同 case paired eval 工程、Mock 验收、共享 provider diagnostics、400-token headroom、五次不可拼接 Live 证据、strict-tool 历史实验、JSON-mode resolution 零网络 checkpoint 与唯一一次完整 JSON-mode controlled-Live 均已完成，但阶段验收仍未完成。历史 Attempt D/E 不可与新 run 拼接；新 run 为 `28/28 strict success`、`72/72 zero-call`，Verifier `quality_gate_passed`，Router `latency_budget_exceeded`（additional P95 `4264ms`），因此 Router terminal fallback 为 deterministic。

当前零网络 checkpoint 将新的 controlled-Live 收敛到标准 DeepSeek JSON Output：精确 `https://api.deepseek.com`、`response_format: { type: 'json_object' }`，不发送 tools/tool_choice/json_schema。Provider 只保证合法 JSON，canonical Zod 仍是结构、长度、关联约束与安全语义的最终权威。新 evidence 固定 runner-v3 + `deepseek_json_object_v1` + `phase-6.9.4.3-json-mode-v1`，并强制 runner、顶层 promptVersion 与所有 candidate entry promptVersion 一致；历史 runner v1/v2 只读兼容，Mock 禁止携带 Live transport 字段。预算、10 秒超时、`maxRetries=0`、zero-call gate、usage/cost provenance 和最早 Live preflight 顺序保持不变。

Fresh gates 为 AI 151 passed、Agent 345 passed、typecheck/lint exit 0；deterministic baseline 仍为 74/100、critical=2；fresh Mock 为 complete，`caseEntries/runtimeInvocations/providerAttempts/strictSuccesses/zeroCallCases = 100/28/0/28/72`；唯一 JSON-mode Live 为 complete、`28/28/72`，Router 因 additional P95 `4264ms` 关闭，Verifier paired decision 通过。这是 Phase 6.9.4.3 当时的生产结论与历史证据，不改写也不再拼接；它不再表示永久禁止 Router 模型。后续 Phase 6.9.4.4 已完成高置信/安全 zero-call、歧义 Router 真实模型、semantic-needed Verifier 与 deterministic fallback 的生产接入并恢复默认关闭。证据见 `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`。

Phase 6.9.4.4 Task 8 已补齐 Docker Web runtime 配置与运维文档：Router 对安全边界和高置信请求保持 deterministic zero-call，只对歧义、多意图或上下文指代请求调用真实模型；Verifier 只对已通过本地安全门、确需语义判断的 RAG 证据调用模型。两者 gate 可独立回滚，默认均为 `false`；Router / Verifier timeout 分别为 5 秒 / 4 秒，共享单请求预算固定 `maxCalls=2`、`maxInputTokens=2400`、`maxOutputTokens=800`。Provider 使用 JSON-object mode，但 canonical Zod 仍负责结构与安全语义；prompt injection、high-risk、credential material 在 provider 前零调用。失败、timeout、schema invalid 或预算耗尽只回退到限制性 deterministic 结果；Trace / headers 只暴露固定状态、reason code、usage 与降级元数据，不含 prompt、query、chunk、provider output、credential 或 raw error。Task 9 完成 controlled-Live、Docker、可见浏览器验收前，两条 gate 必须保持默认关闭。权威路线见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`；这只完成 Router/Verifier 子阶段配置，不代表 Memory、Orchestrator、全部 Agent 或 Phase 6 已完成。

Phase 6.9.4.4 已完成。Task 9 的 Harness Router/Verifier 5/5 均为 `candidate_applied`；可见 Docker 浏览器保留两次 `study_plan` Router 约 5 秒 timeout 的限制性 fallback，同时以不同类别 contextual-reference 样本取得 `candidate_applied / tutor / 3262ms / 289+177 tokens`。Task 10 已在 `main` merge commit `b58e8d5` 复验：Router contextual reference 为 `candidate_applied / 4048ms / 295+240 tokens`，Verifier conflict 为 `candidate_applied / 2618ms / 536+186 tokens`，injection 在 provider 前 `safety_blocked / 0-call`；新的 `deepseek-v4-flash` Trace 显示 `pricingKnown=true` 和 `0.000389 USD` token 估算。Server 737 passed / 2 skipped、Web 407/407、lint/build/typecheck 与 Compose 均通过；Docker 已恢复 Mock/default-off，各轮 synthetic PostgreSQL/Redis/浏览器数据均清理为 0。成功与 timeout 必须并列保留。Admin 本轮未改源码；其镜像重建受 Prisma 官方二进制外部网络失败阻断，现有容器仍 200。证据见 `docs/acceptance/2026-07-14-phase-6-9-4-4-router-verifier-production.md`。

Phase 6.9.5 已完成 ReviewAgent / PlannerAgent 的受限只读候选、owner-scoped server composition、独立预算/超时/安全降级、固定 Mock、受控诊断、Docker 环境边界和前端安全状态的工程准备。本地 merger 始终重建用户 facts、FSRS、分钟数、链接和全部写权限；模型只能选择 snapshot 中的弱点索引、计划 block 排序和策略枚举。v1--v4 都在各自一次 provider attempt 后以 `invalid_attempted / structured_output` 关闭，v3/v4 仅在独立 evidence 中记录 `structuredOutputStage=provider_json_parse`；v5 使用与生产候选一致的 `deepseek-v4-pro` JSON-object executor，同样在唯一 canary 后关闭为 `invalid_attempted / closed / providerAttemptCount=1 / usageKnown=false / structured_output`。V6 唯一获批 canary 已封存为 `state=finalized / status=invalid_attempted / gate=closed / providerAttemptCount=1 / usageKnown=false / diagnosticCode=usage_unverifiable`。这六条计数不可合并、不得重跑，且不构成 quality pass、zero-call、零成本或生产可用性证明。V6 的 48-case/Docker/浏览器/main 复验与推送均未执行；独立 V7 的终态见下一段，不能把它写成 V6 retry。`REVIEW_AGENT_MODEL_ENABLED=false` 与 `PLANNER_AGENT_MODEL_ENABLED=false` 继续是默认生产状态，项目仍返回确定性只读建议。证据见 `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`。

2026-07-17 的离线可信度补强把评测数据集升级为 `phase-6.9-review-planner-v2`：26 条 zero-call 必须实际穿过 candidate 安全、资格、预算或 abort guard，runtime counter 为 0 才能标记 `zeroCallVerified=true`；22 条 runtime fixture 覆盖不同诊断、索引、策略和排序。live provider 只有同时返回正安全整数 input/output usage 才可成功；缺失、非法或 `0/0` usage 固定 fail-closed 为 `PROVIDER_ERROR / invalid_response`，保留预留预算并回退。Review/Planner Trace 仅在成功、usage 可验证、定价表完整时写已知估算成本，未知情况不得显示零成本成功。该补强不改写 v1--v5 evidence/marker；V6 transport 的 reasoning detail 也永不从 aggregate output token 中扣除。两个业务 gate 继续默认 `false`。

2026-07-17 的 DeepSeek V4 Pro v5 CLI 已执行其唯一一次 provider canary，证据封存为 `invalid_attempted / closed / 1 / false / structured_output`；因此 v5 48-case、Docker、浏览器、main 合并和推送均未执行，v5 marker 不得重跑。V6 是独立的 non-thinking lineage：Task 1--6 完成后已在用户明确授权下执行其唯一 canary，evidence/marker 已封存为 `invalid_attempted / closed / 1 / false / usage_unverifiable`。V1--V5 hash 已复核且没有改写；V6 也不得重跑，两个业务 gate 保持 `false`，且不得以 V5、Qwen、Mock 或 Docker 成功替代自己的质量结论。

2026-07-18 已在用户授权下执行唯一 V7 controlled-Live。运行前 preflight 与 `deepseek-v4-pro / deepseek-v1 / nonthinking JSON / 4500ms`、CNY 1.00 hard cap、V1--V6 `18 entries / 9f8cc9a7d5ba83d630fa5806f19aaa74066352de92bb04631813c17feaa230ba` 全部匹配，两个产品 gate 固定为 `false`。终态为 `finalized / invalid_attempted / closed / providerAttemptCount=23 / usageKnown=false / evidence_io`；once marker 已消费，目录无 success seal、JSON 无 token/cost。最窄可证边界是：全部 23 个允许的 provider attempts 被安全计数后，paired-result/orchestration failure 或 evidence finalization/history I/O failure 被折叠为 `evidence_io`；现有脱敏终态无法再唯一定位。V7 不可重跑，不得进入 Docker/浏览器/main/push，不得声称 provider 质量通过、零成本或 Review/Planner 真实模型可用。

2026-07-18 已冻结独立 V8 completion 设计：使用零字节、固定枚举、append-only、exclusive-create stage markers，V1--V7 immutable snapshot、全新 confirmation/eval gate/evidence/success seal 和原有 48/26/22 质量预算；V8 不修改或复用 V7。只有 V8 committed Live success 后才允许按 Review-only -> default-off -> Planner-only -> default-off 顺序重建 Nest `server`，完成 authenticated API、`/plan`、`/today`、Trace、owner isolation 与只读事实验收。已消费的 V8 paired lineage 不在 main 重跑；main 只复验 committed evidence、静态门与受预算约束的产品路径。完整设计见 `docs/superpowers/specs/phase-6-9-5-v8-stage-diagnostics-completion-design.md`。

2026-07-18 V8 离线工程已收口到 `faa97a8`：durable stage/evidence、DeepSeek V4 Pro non-thinking factory/CLI、server-only product admission、branch/main durable slot/usage ledger、recovery-only 路径和真实 Docker/API/Prisma/可见 Chrome composition 均已按 TDD 实现。最终离线门为 Server `1265 passed / 30 skipped`、Review E2E `3/3`、Web `409/409`，Windows I/O/V8 evidence/product ledger native、Agent/AI/types、Server/Web lint/build、Compose `config --quiet` 与 `git diff --check` 全部 exit 0；contract/security 与 acceptance/operations 最终复审无未关闭 Critical/Important。

随后执行的唯一 V8 controlled-Live 已关闭：CLI safe stdout 为 `invalid_attempted / closed / 23 / false / invalid_response`；durable prefix 到 `.stage-080-paired-returned`，没有 `.stage-090-report-validated` 或 success seal。落盘 231-byte 文件仍是 provisional `state=attempted / 0 / false / transport`，public reader 进一步投影为 `invalid_attempted / closed / 0 / false / evidence_io / lastStage=.stage-080-paired-returned`。因此只有 CLI stdout 支撑 23 次计数，落盘文件不提供 durable provider/quality/usage/cost 结论；两个 0 都不得解释为 zero-call。V1--V7 仍为 20 entries / tree hash `6078891e6c962bc5c8e57471017d7f64e210c5f4ffd867c96136e33983ac2bd6`。V8 不可重跑，两个产品 gate 仍为 `false`，不得进入 branch/main 产品验收。

2026-07-19 的 V9 Task 1--5 离线收口没有重跑或改写 V1--V8。V9 新增独立 aggregate gate diagnostics、durable evidence、一次性 CLI 和 product authority。随后唯一 V9 controlled-Live 在根 `.env` 显式注入后运行：预检前一次 `preflight_invalid` 为零调用、零 reservation、零 once、零 evidence；实际运行创建 V9 once/evidence，完成 `23` provider attempts、`22` paired admissions、`26` verified zero-call、`48` strict successes，却以 `quality_gate_failed` 封存。quality 为 `30/48`，semantic 为 `4/22`，critical 为 `2`；P95 `1396ms`、usage `7943/510`、CNY `0.026889/1.00` 及其余 gates 均通过。V9 不可重跑；没有 success seal，独立 V9 eval gate 与两条 Review/Planner 产品 gate 仍缺省关闭，产品继续 deterministic。

2026-07-19 的 V10 是对 V9 质量 contract 的最小修复：模型只返回产品实际合并的 `focusIndexes`（Review）或 `blockOrder`（Planner），本地仍拥有 owner、facts、FSRS、分钟数、链接、写权限和最终只读结果。唯一 controlled-Live 已以 exit `0` 完成；public reader 五次 fresh read 均为 `complete / passed`，安全 aggregate 为 V10 v3、`48/48` strict/quality、critical `0`、P95 `1465ms`、usage `5764/232`、CNY `0.018684/1.00`，schema/quality/P95/usage/attempt/admission/cost 全通过。V1--V9 manifest 仍为 `36` entries / `61a6e4a956784a59a8b8639d4c94d6fd870bce5dd8549a026abf02a0e7cb769d`。证据和 success seal 已生成且 immutable，绝不重跑、删除、覆盖、重建或拼接；writer/reader 只发布 strict safe lane aggregate，拒绝 prompt、snapshot、model output、raw error、URL、credential、cookie、stack 及 per-case timing/usage。根 `.env` 仅由命令注入且未改写；V8/V9 eval 和两条产品 gate 已恢复 mock/default-off。下一步才是分支 Docker/headed-browser 产品验收，产品 gate 必须逐组件临时开启后恢复 `false`；不得据此宣告 Phase 完成、合并或 push。详情见 `docs/acceptance/phase-6-9-5-review-planner-v10-offline-checkpoint.md`。

V9 product authority 只接受 `finalized / complete / closed / passed`、`providerCount=23`、`pairedAdmissionCount=22` 与 lowercase 64-hex evidence SHA-256；还要求完整 V9 leaf 集合全部以 ordinary `H` 被 Git 精确跟踪，并在 authority 读取前后保持 leaf、commit、branch、clean 状态一致。pending、`evidence_io`、未知 profile、非法 hash、assume-unchanged、skip-worktree、缺失/额外 leaf 或漂移都在 ledger、Prisma、Docker、浏览器之前 fail-closed；没有 legacy V8 reader 或 `git show` 回退。

离线证据为：V9 focused `136/136`；Server `1381 passed / 30 skipped`；Review E2E `3/3`；Web `409/409`；AI `190/190`；Agent `406/406`；shared types typecheck exit 0；Review/Planner Windows native 按各自正确 cwd 合计 `133/133`（V5/V6 的 cwd 约束属于命令入口契约，不是代码失败）；product acceptance `131/131`；lint/build/Compose/diff 均 exit 0；contract/security 复审 PASS 且无未关闭 Critical/Important。这些只证明 V9 离线工程边界，不是 Live、provider quality、Docker 产品验收或 Phase 6.9.5 完成证据。

2026-07-20 的 V12 已消费唯一 branch product：API observation 与一条 Trace 均已出现，但 acceptance adapter 将 aggregate orchestration duration 与 candidate-step duration 做严格相等比较，安全终止于 `review_api_trace_canonicalize`。V12 recovery 随后一次成功并封存为 `recovered`；不得重跑、重置、删除或改写其证据。根因不是 pricing 或模型语义，而是 Trace DTO 投影；已用 `candidate=123ms / aggregate=130ms` 的 production DTO regression 修复。V13 的唯一 command 随后被 Bun 1.3.14 segmentation fault 在 reservation 后中断；无 execution manifest/checkpoint/failure terminal，默认 server 已验证回到 mock/default-off，V13 不可重试且不满足 recovery preflight。V14 不读取或写入 V11/V12/V13 roots，拥有独立 profile、ledger、recovery、execution、browser、host、CLI 和 diagnostics；native sentinel 同时证明 prior roots 不变。V14 Docker/浏览器/API/provider 尚未执行，两个业务 gate 继续 `false`。

2026-07-15 已修复在线 Agent Trace 成本表与默认 Live 模型脱节：`deepseek-v4-flash` 采用受控 Live 评测已记录的非缓存 USD 价格快照，新的 Trace 会写入非零估算与 `pricingKnown=true`；未知模型仍 fail-safe 显示“未配置单价”，旧 Trace 不回填，避免伪造历史成本。成本仅为 token 估算，不替代供应商账单；价格变更必须连同集中表、测试和 `docs/ai-behavior-acceptance.md` 一起提交。

回顾 Phase 6.9.6 Knowledge Agents 时可以问：“为什么 Knowledge R7 成功仍不能覆盖 R1--R6 的失败 lineage？”或“为什么可见浏览器的 semantic/degraded 状态绑定 Knowledge R7 response authority 回放，而不再调用一次真实模型？”

## 常用命令

本仓库使用 Bun workspace。Windows 本机开发优先使用 Bun，Docker PostgreSQL 固定宿主机端口 `5433`。

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:RAG_EMBEDDING_PROVIDER='fake'
# 可选：启用 BullMQ 队列处理知识库文档
# $env:REDIS_URL='redis://127.0.0.1:6379'
# $env:KNOWLEDGE_PROCESSING_MODE='queue'
# $env:SERVER_ROLE='both' # 本地一体化；拆分验证时 server 用 api，worker 进程用 worker
bun --filter @repo/server start:dev
bun --filter @repo/web dev
bun run dev:admin # 或 bun --filter @repo/admin dev，打开 http://127.0.0.1:3100
```

常用验证：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --filter @repo/server smoke:rag-eval # 需本地 API 与真实或可用 embedding provider 已启动
bun --filter @repo/server readiness:worker # 需本地 PostgreSQL / Redis 可连接，用于部署前 worker readiness 检查
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

Docker 全栈本地验收：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

RAG queue / Docker 验收必须在宿主环境显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`；真实 embedding 使用 `RAG_EMBEDDING_PROVIDER=qwen`、`RAG_EMBEDDING_MODEL=text-embedding-v4`、`RAG_EMBEDDING_DIMENSIONS=1536`、无凭据的 HTTPS `RAG_EMBEDDING_BASE_URL` 与规范 `QWEN_API_KEY`。Compose CLI 必须显式使用 `--env-file .env` 做 `${...}` 插值；这不是 service `env_file`，server/worker 仍只收到 Compose `environment` 明列的 allowlist。静态校验只运行 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet`，不输出可能含凭据的完整解析配置。

若 Docker Desktop 多服务 Bake 会话报 gRPC shared-key 非打印字符错误，只在当前 PowerShell 会话设置 `$env:COMPOSE_BAKE='false'`，分别 `build server` / `build worker`，再对精确服务列表执行 `up -d --no-build`。不要通过清理 build cache、container 或 volume 排障，禁止 `down -v`；完整命令见 `docs/dev-start.md`。

访问入口：

```text
学习端：http://127.0.0.1:3000
管理员后台：http://127.0.0.1:3100
API：http://127.0.0.1:3001
```

后端 e2e 需要 Docker PostgreSQL 正在运行。详细启动说明见 `docs/dev-start.md`。
按功能做阶段验收、Docker 全栈验收、mock/live AI 验收和收尾提交时，优先看 `docs/acceptance-checklist.md`。

## 环境变量

- 根目录 `.env`：后端和 Prisma 使用，至少包含 `DATABASE_URL`、`JWT_SECRET`。
- `apps/server/.env`：server/e2e 在服务目录运行时读取，保持和根 `.env` 一致。
- `apps/web/.env.local`：Next.js API Route 使用；开发默认 `AI_PROVIDER_MODE=mock`，即使存在 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 也不会调用真实模型。
- 知识库处理默认 `KNOWLEDGE_PROCESSING_MODE=inline`，业务处理不投递 BullMQ；需要验证 BullMQ 时必须显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`、`REDIS_URL=redis://127.0.0.1:6379`，不得依赖隐式默认。`SERVER_ROLE=api` 只启动 HTTP API 且不注册 worker processor；`SERVER_ROLE=worker` 只创建 Nest application context、不监听 HTTP 端口并注册 worker processor；`SERVER_ROLE=both` 用于本地一体化开发，HTTP 与 worker 同进程。当前 NestJS 仍会初始化 BullMQ 模块，本地开发建议继续启动 redis。Phase 7.7 起 worker / both 角色会通过 BullMQ Redis 连接写入短 TTL heartbeat，默认 `WORKER_HEARTBEAT_INTERVAL_MS=15000`、`WORKER_HEARTBEAT_TTL_SECONDS=45`，用于 `/worker-observability/summary` 和 `/knowledge` 健康状态条判断 worker 最近是否在线。`WORKER_OBSERVABILITY_ENABLED` 默认非 production 开启、production 关闭；production 仅适合受控内网或临时诊断显式开启。
- RAG 真实 embedding 的当前标准路径是 Qwen `text-embedding-v4`，固定 1536 维。production 必须显式提供 provider 和 model；Qwen 还必须提供不含 username/password/query/hash 的 HTTPS base URL 与规范 `QWEN_API_KEY`。provider、model、base URL 或匹配凭据缺失时 fail-closed，不在 Qwen/OpenAI/fake 之间自动 fallback。`Qwen_API_KEY` / `DASHSCOPE_API_KEY` 只作为宿主兼容输入，Docker server/worker 内部统一规范化为 `QWEN_API_KEY`；两者使用同一组 RAG runtime allowlist。`fake` 仅允许非 production 本地开发和自动测试。
- Phase 7.9.3 起 `OutboxDispatcherRunnerService` 会在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时按固定间隔调用 `OutboxDispatcherService.dispatchBatch()`；非 production 默认开启，production 默认关闭，生产环境需要显式设置 `OUTBOX_DISPATCHER_ENABLED=true`。可用 `OUTBOX_DISPATCHER_INTERVAL_MS`、`OUTBOX_DISPATCHER_BATCH_SIZE` 和 `OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS` 控制 tick 间隔、批大小和锁超时。runner 不读取 outbox payload、不绕过 handler registry、不新增 HTTP API 或前端 UI。
- Phase 7.10 起 `OUTBOX_OPS_ENABLED` 控制后端 Outbox Ops 诊断入口；默认非 production 开启、production 关闭。`GET /outbox-events`、`GET /outbox-events/:id` 与 `POST /outbox-events/:id/requeue` 经过 feature gate 和 `JwtAuthGuard`，feature gate 排在认证前，关闭时隐藏为 404。接口只返回脱敏状态、attempts、时间戳、payloadHash、错误码和脱敏错误预览，不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。requeue 只允许 `FAILED / DEAD -> PENDING`，不直接执行 handler，不支持删除、强制成功、跳过、payload 编辑或直接 dispatch。
- Phase 7.14.5 起 `OPERATOR_AUDIT_ENABLED` 控制 Operator Audit 查询入口；默认非 production 开启、production 关闭。`GET /operator-audit-logs` 和 Phase 7.20 新增的 `GET /operator-audit-logs/:id` 都经过 feature gate、`JwtAuthGuard` 和 `OperatorGuard`，关闭时在认证前隐藏为 404。接口只返回脱敏审计列表 / 详情，不返回 `metadata`、outbox payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie、原始 IP 或原始 User-Agent。Phase 7.14.6 起前端新增 `/operator-audit` 管理员审计台；管理员会在侧边栏看到“审计”入口，普通用户不显示入口且页面不会主动请求审计 API，真正安全边界仍以后端 guard 为准。
- Phase 7.23.2 起新增审计导出配置地基，但 `OPERATOR_AUDIT_EXPORT_ENABLED` 与 `OPERATOR_AUDIT_MAINTENANCE_ENABLED` 在所有环境都默认 `false`。已固定 180 天审计保留、24 小时导出 TTL、31 天范围、50,000 条记录、64 MiB archive、每管理员 2 个 active / 每小时 10 次、全局 10 个 active、单并发、600 秒 BullMQ lock、300 秒 lease、3600 秒 stale、24 小时投递恢复窗口和 120 秒查询 timeout；worker / both 角色只有在 export、maintenance 与 Outbox Dispatcher 三个 gate 都显式开启时才注册 export processor。processor 本地 concurrency 固定为 1，bootstrap 先设置 BullMQ queue global concurrency=1 再启动 paused Worker，配置拒绝大于 1。production 只要显式开启 `OPERATOR_AUDIT_ENABLED`、`OUTBOX_OPS_ENABLED` 或 `OPERATOR_AUDIT_EXPORT_ENABLED` 任一审计读取/写入/导出路径，就必须提供 trim 后至少 32 字符的 `OPERATOR_AUDIT_FINGERPRINT_SECRET`；非 production 使用至少 32 字符的明确本地 fallback 且禁止记录该值。Phase 7.23.3 起 IP / User-Agent 来源指纹使用该 secret 计算 `hmac-sha256:<64 hex>`，不得记录 secret 或原始来源值；Phase 7.23.5 起 ZIP processor 与保留维护均已实现且 gates 仍默认关闭，Phase 7.23.6 ~ 7.23.8 已补齐查询、下载、Admin UI 与真实 Docker 验收。
- Phase 7.15 起本地 Docker dev compose 会显式开启 `OUTBOX_OPS_ENABLED`、`OPERATOR_AUDIT_ENABLED`、`WORKER_READINESS_ENABLED` 和 `WORKER_OBSERVABILITY_ENABLED`，因为 server 镜像运行态是 `NODE_ENV=production`，不能依赖非 production 默认值来打开诊断入口。Phase 7.23.2 因此只在 `docker/docker-compose.dev.yml` 的 server service 增加可由宿主环境覆盖的 `OPERATOR_AUDIT_FINGERPRINT_SECRET=${OPERATOR_AUDIT_FINGERPRINT_SECRET:-local-dev-audit-fingerprint-change-me}`，避免本地 dev 栈因新生产校验无法启动；该 fallback 不写入 `Dockerfile.server` 的 `ARG / ENV`。真实 production 必须独立提供至少 32 字符的 secret，严禁复用此 local fallback。Next dev 配置允许 `127.0.0.1` 作为 dev origin，避免按本地文档访问 `127.0.0.1:3000` 时只看到 SSR 页面但 React 表单事件未 hydration。真实验收已覆盖管理员 / 普通用户前后端权限、`/operator-audit` 页面、审计 API 和 Outbox requeue 审计写入。
- Phase 7.11 起 `WORKER_READINESS_ENABLED` 控制 worker readiness 诊断入口；默认非 production 开启、production 关闭。`GET /worker-readiness` 经过 feature gate 和 `JwtAuthGuard`，关闭时在认证前隐藏为 404。该接口面向机器和部署检查，只返回安全的 Redis / BullMQ queue / worker heartbeat / outbox readiness 摘要，不返回 payload、prompt、chunk、API key、token、cookie 或用户正文。CLI 命令为 `bun --filter @repo/server readiness:worker`，使用最小只读 Nest module，不导入 `AppModule`，不启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher；异常或超时退出码为 2，not ready / degraded 退出码为 1，ready 退出码为 0。
- Phase 7.12 起 Docker Compose `worker` service 接入容器级 healthcheck，容器内使用 runner 构建产物命令 `bun apps/server/dist/scripts/worker-readiness.js`，不依赖本机 Bun workspace CLI。server 镜像会保留根 `node_modules`、`apps/server/node_modules` 和 `packages`，保证 Bun workspace 依赖与 `@repo/*` 包在容器运行时可解析。`WORKER_READINESS_CLI_TIMEOUT_MS` 默认 `5000`，healthcheck 默认 `interval=30s`、`timeout=10s`、`retries=3`、`start_period=30s`。本地可用 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker ps` 查看 `healthy / unhealthy`。
- Phase 7.13 起 `docker/Dockerfile.web` 已迁移到 Bun workspace + Next standalone 输出，`apps/web/next.config.ts` 使用 `output: 'standalone'` 和 monorepo tracing root。Phase 7.17 起 Docker Compose 全栈验收命令为 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin`；本地浏览器访问学习端 `http://127.0.0.1:3000`，管理员后台 `http://127.0.0.1:3100`，API `http://127.0.0.1:3001`。Compose server 默认允许 `http://localhost:3000`、`http://127.0.0.1:3000`、`http://localhost:3100` 和 `http://127.0.0.1:3100`，web 镜像默认 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001` 且 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100`，避免 Docker 本机验收时 localhost / 127.0.0.1 cookie 与 CORS 混用。Compose dev 栈会设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 和 `AI_DEV_MODE_SWITCH_ENABLED=true`，让 standalone 容器内的 `/agent-trace` 仍可展示 Mock / Live 开关；生产部署不要设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true`。
- Swagger / OpenAPI 调试文档默认只在非 production 开启，入口为 `/api-docs` 和 `/api-docs-json`；production 默认关闭，`SWAGGER_ENABLED=true` 只适合受控环境、内网或临时诊断，且不放宽任何 `JwtAuthGuard`。Phase 7.5 起核心写接口补充中文说明和安全 request body 示例，便于本地调试与面试讲解。
- 真实模型验收必须同时设置 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`；默认 live 模型为 `deepseek-v4-flash`，并建议保留 `AI_MAX_INPUT_TOKENS=2500`、`AI_MAX_OUTPUT_TOKENS=1200` 预算上限。
- Phase 6.9.7 Task 5 起 Tutor 模型候选还有独立 `TUTOR_AGENT_MODEL_ENABLED` gate、固定 3000ms timeout 与 `TUTOR_AGENT_DEEPSEEK_API_KEY`；三者只进入 Next `web` server runtime，默认 `false`/空。只有全局 Live 双开关、精确 `https://api.deepseek.com/v1`、已知价格和完整 eligibility 同时成立才创建 V4 Pro non-thinking executor；不借用通用或其它 Agent key。Tutor 单请求预算为 `1/1200/300`、硬 cap `0.006 CNY`，与 Router -> Verifier 共享预算隔离。Task 12 V1 已调用真实模型但语义质量门失败，未取得产品 Docker/API/浏览器可用性结论；V2 R2/R3 已分别收口 Tutor 与 Organizer 的 prompt/contract 单一规则源和 v2 identity，R4 已增加独立 anti-overfit/authority/leakage 测试，R5 已建立独立 V2 runner/CLI/validator/one-shot evidence 入口，R6 已补齐一次性 evidence/marker、Chat abort 与 Organizer 并发/失败/补偿边界。R2--R6 没有新增 provider 调用或改变产品可用性结论，产品 gate 继续默认关闭。
- V6 R4 已提供 package 级无网络 candidate、独立 runner/CLI/lineage/durability contract 与 reviewed Mock checkpoint；唯一 V6 R5 Live 随后已失败封存。它没有改写上述 V1--V4 产品 composition、gate、timeout、Trace 或 Docker allowlist，也没有把 V6 `3500ms` policy 接入产品 executor。禁止再次执行 V6 Live CLI、手工创建/删除 artifact 或用额外 Provider 探测补跑；产品仍没有 V6 可用性结论。
- V7 R0--R3 已完成 transport remediation、第一方 DeepSeek V4 Pro direct adapter、固定 wire diagnostics、独立 runner/CLI/lineage/durability、fault matrix 与 reviewed static/Mock。唯一 V7 R4 Live 已以 `quality_gate_failed` seal；marker/evidence/journal 必须保留，不得再次运行 `v7:live`、执行 seal/recovery、手工修改 artifact、把 approval env 写入 `.env`，或用 curl/单 case/产品 API 追加 Provider 探测。V8 R0--R4 已完成 fixed-shape/diagnostic、Provider-like robustness/anti-overfit、runner/lineage/durability 与 reviewed Mock/full checkpoint；唯一 V8 R5 Live 随后以 `dynamic_authority` 失败封存。V9 R0--R4 已完成本地 option authority、Provider-like/security/stale/abort/write-authority robustness、独立 runner/lineage/durability 与 reviewed Mock/full checkpoint；唯一 V9 R5 在首个 pair 的 Provider response 前以 Tutor `transport` / Organizer sibling `post_dispatch_abort` 结束，wire `2/2/0/0`、strict `0/48`、正式聚合全 `null`。V7--V9 artifact 均不得删除、改写、重跑、seal/recovery 或追加 Provider 探测；V9 R6/R7/main 与产品验收被阻断。
- Architecture Recovery proxy preflight 命令为 `bun --filter @repo/ai diagnose:phase-6-9-7:recovery:proxy-preflight`。它不接受参数、不读取 `.env`/credential、不调用 Provider，只读取进程内八个固定 proxy key 并最多执行一次 250ms loopback TCP probe；exit `1` 表示环境前置条件未通过，不是测试失败。禁止用它自动清空/绕过 proxy，listener ready 也不等于 Provider health 或 Live 授权。
- 本地开发可额外设置 `AI_DEV_MODE_SWITCH_ENABLED=true`，在 `/agent-trace` 调试台切换 mock / live；该开关默认仅非 production 可见。Docker Compose dev 的 Next standalone 容器因运行时 `NODE_ENV=production`，需要同时设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 才显示；该本地诊断开关不能用于生产，也不能绕过 `AI_ENABLE_LIVE_CALLS`、API key 或 live Chat 登录校验。
- AI 行为验收规范见 `docs/ai-behavior-acceptance.md`；mock 验工程链路，live 小样本验真实输出体验，fake embedding 不证明 RAG 语义命中质量。

推荐数据库连接：

```text
DATABASE_URL=postgresql://prepmind:devpass@127.0.0.1:5433/prepmind
```

env 文件均被 git 忽略，不提交密钥。

- Phase 7.23.6 起 `GET /operator-audit-exports` 与 `GET /operator-audit-exports/:id` 提供系统级 ADMIN 可见的证据包列表/详情，不按当前管理员过滤 requester；列表按 `createdAt desc, id desc` 使用复合稳定游标，并以每响应一次 `clock_timestamp()` 判断 `canDownload`。显式 mapper 与 shared strict response schema 保证 `objectKey`、`requestHash`、`processingToken`、`leaseExpiresAt`、payload、metadata、secret、token、cookie 等内部字段不会进入 DTO。`POST /operator-audit-exports/:id/download` 不使用 presigned URL；服务端生成安全文件名，返回 `application/zip`、`Cache-Control: no-store, private`、`Content-Disposition`、`Content-Length` 与 `X-Content-SHA256`，`StreamableFile` 是全局 JSON envelope 的明确例外。下载顺序固定为读取 export/数据库时间、打开 MinIO 流、核对 DB archiveSize 为正数且不超过配置上限并与 MinIO stat size 完全一致、strict 写入 `AUDIT_EXPORT_DOWNLOAD`、再返回流；size 不匹配或 strict 审计失败都会销毁已打开流，confirmed missing 才以 CAS 把 READY 标为 `FAILED/EXPORT_FILE_MISSING`。strict audit 失败、size mismatch 与 missing CAS 持久化失败只记录不含 raw error/objectKey/size 的固定 warning。成功下载审计只表示服务端已授权并准备流，不保证浏览器已经持久化全部字节。production gates 继续默认关闭。
- Phase 7.23.7 起 Admin Console `/audit` 使用可键盘操作的“审计记录 / 证据包”tabs，共享 action/status/target/actor 筛选作为申请默认条件。网络/5xx 仅在表单与继承筛选未变化时复用 `clientRequestId`；列表只在 QUEUED/PROCESSING 时轮询，READY 且 `canDownload` 才提供 authenticated Blob 下载与 hash 复制。临时 object URL 始终回收；1440×900 与 1024×768 的模拟验收及 Phase 7.23.8 Docker 真实后端/浏览器全链路均已通过。

## 模块边界

```text
web -> server（HTTP 调用，不直接 import）
server -> database, ai, fsrs, rag, agent, mcp, types
agent -> ai, fsrs, rag, mcp, types
rag -> database, ai, types
fsrs -> types
ai -> types
mcp -> ai, fsrs, rag, types
```

- `packages/` 禁止依赖 `apps/`。
- 同层 packages 禁止循环依赖。
- `@repo/types` 是前后端 API contract 的优先位置，使用 Zod 表达 schema；Swagger / OpenAPI 是 NestJS 调试和展示层，不反向驱动前端 contract。

## 代码约定

- TypeScript strict。
- Prettier：2 空格、单引号、分号、100 字符宽。
- 文件名 kebab-case，类名 PascalCase，变量 camelCase。
- 导入顺序：外部库 -> `@repo/*` -> 相对路径。
- NestJS 遵循 Controller -> Service -> Repository。
- 高频 SQL 查询必须建索引。
- 移动端优先，触摸目标不小于 44x44px。
- PWA 页面要考虑离线静态访问和主屏幕添加体验。

## 当前数据流

- 登录态权威来源：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie。
- Refresh token 已启用 rotation 与 reuse detection；Auth 主链路不依赖 Redis。
- WrongQuestion / ChatMessage / OCRRecord 已迁移到 PostgreSQL，按当前 `userId` 隔离。
- WrongQuestionOrganizer：`WrongQuestionSubjectGroup` / `WrongQuestionDeck` / `WrongQuestionDeckItem` 是错题组织层，按当前 `userId` 隔离；一个错题同一时间只属于当前用户一个 organizer deck，不替代 WrongQuestion / Card / ReviewLog / ReviewTask 事实来源。Task 6 起 organize path 使用 owner-scoped immutable snapshot、事务外双 stale fence、owner advisory-lock 第三 fence 与 model-free command；Task 7 已接入 server-only default-off runtime、single/batch 单次 dispatch、两阶段 Trace 与 HTTP abort；Task 8 已增加 request-level strict runtime 和 `/error-book` 语义/本地/安全回退来源状态。Task 12 V1 与 V2 R7 两条唯一 Live 均未通过质量门；V2 R0--R6 已完成离线 design/diagnostics、单一规则源、anti-overfit、独立 runner/evidence，以及同题 normal/force、single/batch、provider abort、command failed Trace 和未写题 batch 补偿边界，但 V2 R7 的 24 个 Organizer runtime 全在结构化对象前失败，仍无通过的质量 authority 或产品验收。V3 R0 已冻结 failure taxonomy、breaker、固定分母、双 lane 与 crash-only seal；V3 R1 已实现安全 failure/stage 投影、真实 invocation recorder 和零网络 adapter compatibility；V3 R2 已实现 guard-first、首错熔断、固定分母、双 lane 独立 abort/预算/故障归属、单 dispatch ledger 和不完整 usage/P95/费用 fail-closed；V3 R3 已补独立 CLI、dispatch-before-call durable journal、活 owner 防误封、可恢复单胜者 claim、crash-only seal 与不可覆盖 evidence。R4 static/Mock checkpoint 已完成；唯一 V3 R5 在 `organizer-runtime-14` 的 `subject_authority_violation` 后熔断并以 `quality_gate_failed` 封存，未形成产品质量 authority。Organizer 仍是同步 API，不声明跨实例 provider exactly-once；gate 关闭时 decision 继续 deterministic。
- Review：`/reviews` 已支持错题加入复习、学习统计和最近复习日志；`/review-tasks` 已支持今日复习任务、评分完成、跳过、恢复和未来复习计划预览；Card / ReviewLog / ReviewTask / ReviewPreference 以 PostgreSQL 为权威来源。
- `/review-preferences` 读写当前用户账号级复习计划偏好，包括每日分钟、每日卡片上限、提醒时间、提醒开关和计划窗口。
- `/review-tasks/plan` 是只读预览接口，基于 `Card.nextReview`、`Card.difficulty`、`Card.stability` 和 `ReviewPreference` 计算加权压力，不创建未来 `ReviewTask`。
- `/plan` 展示未来 7 / 14 天复习压力、容量状态、原因标签和偏好设置；`/stats` 使用客户端 ECharts 展示趋势、评分分布和卡片状态，避免 SSR hydration 风险。
- ReviewAgent / PlannerAgent：`GET /review-agent/suggestions` 基于当前用户 Card、ReviewLog、ReviewTask 计划、ReviewPreference 和错题组织数据生成只读建议；该接口不创建 `ReviewTask(source=PLANNER)`，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck 数据，不进入 Dexie `mutationQueue`。
- MemoryAgent：`UserMemoryCandidate` / `UserMemory` 以 PostgreSQL 为权威来源；`POST /memory-agent/candidates/generate` 基于当前用户聊天偏好信号、错题薄弱点、复习日志和偏好生成去重候选，候选必须由用户在 `/profile` 确认后才成为 `ACTIVE` 记忆；`GET /user-memories`、`PATCH /user-memories/:id`、`DELETE /user-memories/:id` 支持查看、停用、恢复和删除。当前实现不调用真实模型、不写 Chat / Review / WrongQuestion 事实表、不进入 Dexie `mutationQueue`，也不把记忆自动注入 `/api/chat`；Phase 6.9.9 只增加受控真实模型候选提取，记忆注入与 Episodic Memory 延后至全部 Agent 完成后的 Phase 6.10。
- Agent Trace：`AgentTraceRun` / `AgentTraceStep` 以 PostgreSQL 为权威来源；`/api/chat` 只有在 access token 已通过 `/auth/me` 并绑定 authenticated canonical principal 后才 best-effort 写入脱敏 trace，写入失败只影响 `x-prepmind-agent-trace-recorded=false`，不打断流式回答；`/agent-traces` 是在线账号级 API，不进入 Dexie `mutationQueue`，不保存完整 prompt、完整回答、完整 RAG chunk、ownerId 或 API key；`/agent-trace` 的成本看板只展示 token 与价格表推导出的估算成本。
- BackgroundJob：`BackgroundJob` 以 PostgreSQL 为权威来源；Phase 7.23.2 增加 `ACCOUNT / SYSTEM` scope 与数据库 CHECK，ACCOUNT 必须有 `userId` 并继续随用户级联删除，SYSTEM 必须 `userId=null` 并独立存活。`BackgroundJobsService` 的 create/find/count/update/list/summary，以及知识库 `DocumentProcessingJobService` 直接执行的 active count、create、active find 与 enqueue-failure update，全部显式限定 `scope=ACCOUNT`；required `userId: string` 签名与账号 DTO 不变，因此账号/知识库路径都不能误读或改写 SYSTEM job。`GET /background-jobs`、`GET /background-jobs/summary` 与 `GET /background-jobs/:id` 仍是经过 `JwtAuthGuard` 的账号级只读 API。
- Durable Outbox：`OutboxEvent` 以 PostgreSQL 为权威来源，用于持久化内部事件的脱敏 metadata、payload hash、幂等键、attempts、锁定信息和重试时间；`OutboxService` 提供 enqueue、claim、success、retry 和 dead-letter 状态机。Phase 7.9.1 只落地 outbox 地基，不替换 BullMQ、`BackgroundJob` 或 in-process `EventBus`，也不自动迁移现有事件发布点；payload 和 lastError 只能保存安全元数据或脱敏错误摘要，不得保存 API key、access token、refresh token、cookie、完整 prompt、完整 RAG chunk、完整模型回答或真实用户私有正文。
- Outbox Dispatcher：`OutboxDispatcherService` 负责 claim `OutboxEvent` 并分发到显式注册的 handler，成功后标记 `SUCCEEDED`，失败后复用 retry / dead-letter 状态机。既有 `knowledge.document.processing.requested` handler 仍只校验安全 metadata，不重投 BullMQ；Phase 7.23.3 新增 `operator.audit.export.requested` handler，严格校验仅含 `exportId/backgroundJobId` 的 payload 与 linked SYSTEM facts，并成为审计导出唯一 PostgreSQL -> Redis/BullMQ bridge。FAILED/EXPIRED export 终态 no-op，PROCESSING/READY + ACTIVE/SUCCEEDED 视为已交付，只有 QUEUED export + QUEUED SYSTEM job 可以检查既有 Bull job 后投递；其余状态组合按 invalid payload 进入 retry/dead-letter。`DocumentProcessingJobService` 原有 queue-first + best-effort observer 语义不变。
- Outbox Dispatcher Runner：`OutboxDispatcherRunnerService` 是 Outbox Dispatcher 的受控运行入口，只在 worker / both 角色且开关开启时运行；单进程内上一轮 tick 未完成时会跳过下一轮，tick 异常只记录脱敏 warning，不打断 worker 进程。production 默认关闭，避免部署后未经确认消费历史 outbox 事件。
- Outbox Summary / Metrics：`OutboxMetricsService` 读取系统级 `OutboxEvent` 状态计数、backlog、最老 pending 年龄和最近错误摘要，并接入 `GET /worker-observability/summary`；该 summary 只读且不返回 payload、完整 `lastError`、`aggregateId`、prompt、chunk、API key、token、cookie 或用户内容。`DEAD` outbox event 会让 worker observability status 进入 `degraded`，pending / processing backlog 会作为独立信号展示。
- Outbox Ops：`GET /outbox-events`、`GET /outbox-events/:id` 和 `POST /outbox-events/:id/requeue` 是受 `OUTBOX_OPS_ENABLED` 与 `JwtAuthGuard` 保护的后端诊断入口，用于本地开发和受控排障。列表与详情只暴露脱敏 DTO；详情中的 `lastErrorPreview` 复用扩展后的 `sanitizeJobError()` 并截断，不泄露常见 API key、access token、refresh token、cookie、`sk-...` key 或供应商 key。分页按 `updatedAt desc, id desc` 使用复合 cursor，避免只按 id 翻页导致漏数据。requeue 使用 `updateMany` 条件更新实现 compare-and-swap，只把 `FAILED / DEAD` 事件重置为 `PENDING`，清理锁与 processedAt，重置 attempts 和 nextRunAt，但不修改 payload、不立即执行 handler。
- Operator Audit：`OperatorAuditLog` 以 PostgreSQL 为权威来源，用于记录 operator/admin 诊断写操作的安全审计元数据。Phase 7.14.3 新增 `OUTBOX_REQUEUE` action、`OperatorAuditService` 和脱敏写入能力；Phase 7.14.4 已把 `POST /outbox-events/:id/requeue` 接入成功/失败审计；Phase 7.14.5 新增 `GET /operator-audit-logs` admin-only 脱敏查询 API；Phase 7.14.6 新增 `/operator-audit` 管理员审计台；Phase 7.20 新增脱敏详情。Phase 7.23.3 将 IP / User-Agent 指纹升级为配置 secret 驱动的 HMAC，并新增可接收 transaction/root Prisma client 的 `recordSuccessStrict()`：导出申请审计写失败会使整个申请事务回滚；现有 `recordSuccess/recordFailure` 仍捕获写入失败，因此 Outbox requeue audit 继续 best-effort。审计记录与查询仍不保存/返回 payload、metadata、原始 IP/User-Agent、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- Operator Audit Export：Phase 7.23.2 新增 strict Zod contract、`OperatorAuditExport` 和 singleton `OperatorAuditMaintenanceState`；Phase 7.23.3 新增 `POST /operator-audit-exports`。guard 顺序固定为 audit gate -> export gate -> JWT -> operator，export gate 关闭时认证前 404；shared Zod 失败在 controller 转为安全领域 400 `OPERATOR_AUDIT_EXPORT_INVALID_REQUEST`，strict request audit 失败回滚并返回安全 503 `OPERATOR_AUDIT_EXPORT_AUDIT_FAILED`。申请 service 使用数据库 advisory retention/quota locks 与 database clock，在 Serializable 事务内先处理 actor + clientRequestId 幂等，再校验 31 天/180 天/未来窗口和配额，依次写 Export、`scope=SYSTEM/userId=null` BackgroundJob、只含两个安全 id 的 OutboxEvent、strict `AUDIT_EXPORT_REQUEST`。由于首条 advisory lock 等待会固定 Serializable snapshot，整个无事务外副作用的 interactive transaction 只对 P2034/raw 40001/明确 export 幂等复合 P2002 做最多 5 次 bounded retry；normalized input 与预生成 UUID 跨 attempts 复用，每次 attempt 都重新开 Serializable 事务并重新取锁/DB clock。PostgreSQL commit 是 202 成功边界，API request path 不调用 `queue.add`；safe DTO 仍不返回 `objectKey`、`requestHash`、`processingToken`、payload 或 metadata。Phase 7.23.4 processor 只有在 `worker/both` 与 export/Dispatcher/maintenance 三 gate 全开时注册，本地与 Bull global concurrency 都固定为 1。双表状态仓库使用 database clock、processing token、续租和 CAS 同步迁移 Export 与 linked SYSTEM BackgroundJob；live lease、失败状态 CAS 数据库不确定和 READY reconciliation 不确定都通过 BullMQ `moveToDelayed + DelayedError` 延迟且不消耗失败 attempt。`markReady` commit-ACK ambiguity 下，只有 `READY + SUCCEEDED + 同 objectKey` 视为已提交；明确未选择才删除 attempt，不确定时保留。归档在只读 REPEATABLE READ 事务内按 `(createdAt,id)` 流式分页，生成 UTF-8 BOM/CRLF、固定 13 列且防公式注入的脱敏 CSV 与 manifest v1。Phase 7.23.5 将明文根目录收口到有容量上限的 `/tmp/prepmind-audit-exports`，未选 orphan 由维护与 48h lifecycle 回收。Phase 7.23.6 已完成 list/detail/download 与 fail-closed 下载审计，Phase 7.23.7 已完成证据包 Admin UI，Phase 7.23.8 已完成 Docker 真实下载/过期/清理闭环；production gates 保持关闭。
- Operator Audit Maintenance：Phase 7.23.5 新增每小时 strict `{schemaVersion:1}` BullMQ scheduler 与单并发 processor，仅在 `worker|both` 且 maintenance gate 显式开启时注册。processor 本地 `concurrency=1` 约束单进程消费，应用 bootstrap 同时把 maintenance queue 的 BullMQ global concurrency 固定为 1，约束跨 worker replica 的系统级并发；真实 Redis 双 Worker/双 job 阻塞测试证明第二个 job 保持 waiting、最大 active 为 1。每次运行先用 database clock 写 singleton `RUNNING`，再执行 24h READY 逻辑过期后的 MinIO selected object/prefix 清理与 CAS、FAILED/EXPIRED orphan 清理、DEAD 满 24h 的 `DELIVERY_ABANDONED` 双表终止、lease 过期且 Bull job 非 active 的 stale repair、180 天审计与终态 export metadata 分批删除，最后写 `SUCCEEDED/FAILED` 脱敏状态；不创建账号 BackgroundJob 或 OperatorAuditLog。审计每批最多 1,000、单次最多 20 批，每批新短事务重新取得 retention advisory lock、DB clock 与 `min(now-180d, oldest QUEUED/PROCESSING.startAt)` active-export 水位；真实 PostgreSQL 交错测试证明申请校验持锁后不会在 commit watermark 前被维护删除。PROCESSING orphan 清理始终保留当前 token 的 exact attempt key 与权威 objectKey，并在 list 后删除前重新读取 DB token/lease/status 与 Bull state；stale repair 的最终 CAS 同时限定 token、startedAt 与 lease cutoff。crash janitor 只删除严格目录 grammar、DB lease/token 已安全失效且 Bull job 非 active 的目录，绝不只按年龄删除。Readiness/Observability/CLI/Admin Worker 页保留 knowledge `checks.queue` 并新增 export queue、maintenance queue 与两小时 maintenance freshness；任一队列独立失败只产生安全信号，不泄露 Redis 连接信息。Local Compose 通过 `minio-init` 导入 `operator-audit-exports/` 2 天 expiration/noncurrent、1 天 incomplete multipart 和 delete-marker 规则，并用 192 MiB、0700 tmpfs 承载明文，为严格 `free > 2 * 64 MiB` preflight 留出余量；production versioned bucket 仍必须独立验 delete-marker 配置。
- Admin Console：Phase 7.16 新增独立桌面端 `apps/admin` / `@repo/admin`，默认端口 `3100`，本地命令为 `bun run dev:admin` 或 `bun --filter @repo/admin dev`；Phase 7.17 新增 Docker `admin` service，可通过 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin` 启动完整栈。第一版包含控制台、`/outbox`、`/audit` 和 `/worker` 页面，复用既有 admin-only API，不新增后端权限模型；Phase 7.19 起控制台读取真实 Worker / Outbox / Audit 摘要；Phase 7.20 起 `/audit` 支持列表 + 脱敏详情双栏；Phase 7.21 起 `/outbox` 与 `/audit` 使用后台自定义筛选控件替代原生 select，保留 label / combobox / listbox / option / keyboard 语义，Outbox requeue 前端要求填写 reason 并显式确认，切换事件或筛选条件时清空 reason，成功后继续刷新 outbox、audit 和 worker readiness。学习端保留移动端 `/operator-audit`，ADMIN 用户在移动端和桌面端侧边栏都会显示“后台管理”入口，默认跳到 `http://127.0.0.1:3100`，普通用户不可见；后台应用当前仍是桌面优先布局。后台前端只负责体验和引导，真正安全边界仍是后端 `JwtAuthGuard + OperatorGuard`。
- API / worker 进程边界：`SERVER_ROLE=api` 使用 Nest HTTP app，提供 REST API、`/health`、Swagger 和业务入口，但不消费 BullMQ；`SERVER_ROLE=worker` 使用 `NestFactory.createApplicationContext()`，只初始化模块和 BullMQ processor，不监听 HTTP 端口、不提供 `/health`；`SERVER_ROLE=both` 保留本地兼容模式。worker-only 的健康判断依赖进程存活、日志、BullMQ 和 BackgroundJob 状态。
- Worker Observability：`GET /worker-observability/summary` 经过 `JwtAuthGuard` 且受 `WORKER_OBSERVABILITY_ENABLED` 控制，默认只在非 production 开启；production 默认隐藏该接口，避免普通登录用户看到系统级队列和 worker 拓扑信号。该接口组合系统级 BullMQ `knowledge-document-processing` queue counts、Redis worker heartbeat 和账号级 `BackgroundJob` summary，输出 `healthy / degraded / attention / idle` 信号；queue counts 是系统级队列状态，BackgroundJob summary 是当前账号最近任务状态，两者语义不同但互补。heartbeat 只保存不含 hostname / pid 的 opaque worker id、role、队列名和 startedAt / lastSeenAt，不保存文件内容、prompt、RAG chunk、API key、token 或用户输入。`/knowledge` 页面在有资料或处理轮询时展示紧凑健康状态条；该能力只读，不进入 Dexie `mutationQueue`。
- Worker Readiness：`GET /worker-readiness` 和 `bun --filter @repo/server readiness:worker` 用于回答“当前 worker 链路能不能接生产流量 / 能不能作为部署 readiness 通过”。它和 `/health`、`/worker-observability/summary` 分工不同：`/health` 是 API 进程 liveness；`/worker-observability/summary` 是给开发者看的详细观测面；readiness 是机器友好的部署前结论。readiness 组合 Redis / BullMQ queue counts、worker heartbeat 和 outbox summary，输出 `ready / degraded / not_ready`。CLI 使用最小只读 module，不导入 `AppModule`，避免启动普通应用副作用；输出只包含安全摘要与 issues，不打印原始依赖错误、连接串、payload、prompt、chunk、API key、token 或 cookie。
- OpenAPI 调试文档：Phase 7.4 新增 Swagger / OpenAPI debug docs，`/api-docs` 和 `/api-docs-json` 默认在非 production 开启；production 默认关闭，显式 `SWAGGER_ENABLED=true` 只用于受控环境、内网或临时诊断。Phase 7.5 为注册、登录、知识库上传/替换/处理/检索、复习评分和 Agent Trace 写入补充中文描述与安全 request body 示例。Swagger 只描述和展示 REST API，不改变认证、鉴权或业务 contract；受保护接口仍必须经过 `JwtAuthGuard`。全局响应 envelope 语义为成功响应 `{ success, data, requestId }`，错误响应 `{ success, error, requestId }`；字段约束仍以 `@repo/types` Zod schema 为准。
- KnowledgeDedupAgent / KnowledgeOrganizerAgent：`GET /knowledge-agent/suggestions` 经过 `JwtAuthGuard`，按当前 `userId` 读取 `Document` 与每份资料最多少量 `Chunk` 摘要，生成重复资料、疑似新版、互补资料、集合和标签建议；Phase 6.9.6 已完成两个受治理 candidate、本地 merger、owner snapshot/双 stale fence、owner-scoped pgvector shortlist、default-off DeepSeek runtime composition、独立 gate 并行 API dispatch、安全 runtime metadata、parent+2-step Trace，以及 `/knowledge` 语义/本地/降级只读来源状态。gate 默认关闭时仍返回 deterministic 在线只读建议；strict paired Mock、唯一 V2 controlled-Live `quality_gate_passed`、R7 Docker/API 与可见浏览器分支验收均已完成。R1--R6 仍是只读失败历史；R7 证明修复后 Dedup/Organizer 可真实 `candidate_applied`，浏览器回放不形成第二份语义 authority。全阶段仍不写 Document / Chunk / 分类表，不自动合并、删除、替换、重命名或分类资料，不进入 Dexie `mutationQueue`；main `f31335c6` 的 default-off 回放与远程推送也已完成，生产 gate 继续默认关闭。
- RAG 文档 API：`/knowledge/documents` 已支持上传、列表、详情、删除和 `PUT /knowledge/documents/:id/file` 替换上传，`POST /knowledge/documents/:id/process` 已支持处理上传文档。
- RAG 文档去重与替换：普通上传会按当前用户 `contentHash` 返回已有同内容资料；替换上传会保留同一 `Document.id`、重置为 `PENDING`，并拒绝替换为其它资料卡片已有的相同内容。替换事务使用 `status + updatedAt + storageKey + contentHash` 做 compare-and-swap，成功后才删除旧 chunks；`PROCESSING` 中的资料禁止替换；并发处理或并发替换导致快照变化时返回 `KNOWLEDGE_DOCUMENT_PROCESSING`，只清理本次新上传对象，不删除旧对象。
- RAG 处理链路：支持 TXT / Markdown / DOCX / PDF 基础文本解析，使用 `@repo/rag` 段落感知分块；每个 chunk 入库前会写入 deterministic `metadata.safety`，用于标记 prompt injection、泄露密钥、隐藏行为、工具/数据写入等风险。当前真实 embedding 标准路径为 Qwen `text-embedding-v4` / 1536；production 配置 provider-aware fail-closed，不做 provider fallback，`fake` 仅用于非 production 测试。
- RAG 处理模式：`POST /knowledge/documents/:id/process` 默认 inline 同步执行，设置 `KNOWLEDGE_PROCESSING_MODE=queue` 后会创建 `BackgroundJob` 并投递 BullMQ，worker 继续复用同一套 document snapshot 校验和 chunk 写入流程；Redis 是 queue 处理链路的必需依赖，本地开发仍建议随 postgres / minio 一起启动。
- RAG 持久化：`Document` / `Chunk` 以 PostgreSQL + pgvector 为权威来源，`Chunk.embedding` 固定为 `vector(1536)` 并通过 raw SQL 持久化；写入前校验 document/user ownership。处理链路在 claim、清 chunk、写 chunk、标记 DONE / FAILED 时持续校验 `status=PROCESSING + storageKey + contentHash` 快照，chunk 替换事务使用 `SELECT ... FOR UPDATE` 锁定当前 Document 行，避免旧处理流污染新上传资料。
- RAG 状态边界：`Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`，空文本、零 chunk、解析/embedding 失败进入 `FAILED`；forced reprocess 会在同一 processing 快照下先清旧 chunks，避免 stale retrieval。
- RAG 检索 API：`POST /knowledge/search` 已升级为 Hybrid Retrieval：先生成 query embedding，再召回 pgvector cosine vector candidates 和 PostgreSQL full-text keyword candidates，按 `chunkId` 去重后做 hybrid rank 并输出 `0..1` final score；仍只检索当前用户 `DONE` 文档 chunks，并在命中结果中返回 chunk metadata、safety metadata 和轻量 `metadata.retrieval.{vectorScore,keywordScore}` 调试信息。当前无 reranker，不引入外部搜索引擎。
- RAG Eval：Phase 7.8.1 新增固定检索评估集和纯函数 runner，用于在 Hybrid Retrieval / reranker / Query Rewrite 前后对比 `recall@k`、`top1Accuracy`、`safetyPassRate` 和 `noHitPassRate`；默认测试不调用真实模型、不写数据库、不保存真实用户资料或密钥。fake eval 只证明工程回归；当前真实语义质量标准验收必须使用 Qwen `text-embedding-v4` / 1536，不得通过 provider fallback 获得结论。
- RAG Eval Smoke：`bun --filter @repo/server smoke:rag-eval` 当前强制 queue 处理路径，必须轮询到 `BackgroundJob=SUCCEEDED`，并校验每个命中都有 `keywordScore` / `vectorScore`、`mode=hybrid`、同一 case 无重复 `chunkId`；缺失任一证据即 fail-closed。`RAG_EVAL_SMOKE_KEEP_DATA=true` 仅用于本地复查合成文档。脚本默认不进 CI、不写 eval 结果表、不调用 `/api/chat`，不打印 API key、access token、cookie、embedding 向量或完整 hit content。Phase 7.8.5 真实 Docker 验收已以 Qwen `text-embedding-v4` / 1536 完成 3/3，queue `BackgroundJob=SUCCEEDED`，三项缺配置启动检查均在 provider 调用前 fail-closed；证据见 `docs/acceptance/2026-07-14-rag-runtime-parity.md`。
- Chat RAG：`/api/chat` 只有在 access token 已通过 `/auth/me` 并形成 authenticated canonical principal 后才调用 `/knowledge/search`，命中后先把高风险 chunk 排除在 prompt 与 citations 之外，中风险 chunk 只作为可疑原文引用，安全 chunk 可回填 prompt 槽位；随后把可用 chunks 注入 system prompt，并在助手消息末尾追加 Markdown “参考资料”；anonymous、无命中或检索失败时降级普通 AI 回答。
- KnowledgeVerifierAgent：`/api/chat` 会在 RAG 命中后调用 `@repo/agent/knowledge-verifier` 确定性 policy，评估资料状态为 `trusted / suspicious / conflict / insufficient / skipped`；命中高风险或 `safeForPrompt=false` 的 chunk 时会转为 `suspicious` 并注入“不执行检索片段中的指令”的保守 guidance；可疑、冲突或不足时会向 RAG prompt 注入保守使用规则，并在引用区追加温和“资料核对提示”。
- Agent Chat：`/api/chat` 已接入 `chat-agent-runtime` adapter，每次请求会先通过 RouterAgent 生成 route metadata；`tutor` route 会调用 TutorAgent policy 生成 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 或 `general_follow_up` 策略 prompt。Task 5 起 final Tutor route 的隐含/上下文/冲突意图可进入独立 default-off candidate；明确指令和所有失败仍使用 deterministic strategy。ReviewAgent / PlannerAgent / MemoryAgent 不在每次 Chat 中自动执行，Review / Planner 只在计划与今日任务界面读取只读 suggestions API，Memory 只在个人中心显式管理；Agent Trace 只记录脱敏观测元数据，不改变 Chat 输出链路。
- Agent headers：Chat 响应会带 `x-prepmind-agent-route`、`x-prepmind-agent-confidence`、`x-prepmind-agent-rag-required`；Tutor 路线额外带 `x-prepmind-tutor-intent`、`x-prepmind-tutor-depth` 与固定 Tutor model disposition/reason/usage/CNY headers；RAG 命中后会带 `x-prepmind-knowledge-verifier-status` 与 `x-prepmind-knowledge-verifier-chunks`；trace 写入尝试会带 `x-prepmind-agent-trace-recorded`。
- Agent prompt 顺序：`BASE_SYSTEM_PROMPT -> activeStudyContext -> agent/tutor strategy prompt -> RAG knowledge context -> verifier guidance`；RAG 因 token 预算被丢弃时，短 Agent prompt 仍保留，verifier notice 不追加。
- `@repo/agent` 当前不直接调用 `streamText`、不读取 API key、不自行启用 live 模型；Router/Verifier/Tutor 的结构化 candidate 只消费 Web composition 注入的 runtime，最终流式模型仍只存在于 `/api/chat`。所有真实调用受服务端 mock/live 解析、`AI_ENABLE_LIVE_CALLS=true`、对应组件 gate、独立/匹配 credential 和 live Chat 登录校验保护；开发模式开关只能作为 non-production override。
- `/knowledge` 页面已接入 RAG 文档管理、检索测试、资料管理建议、后台处理状态、后台任务摘要、Worker Observability 健康状态条和 SafetyGuard 信号：支持资料上传、列表、处理、替换上传、删除内联确认、状态摘要、手动检索预览，以及只读展示重复/新版/互补资料、集合和标签建议；检索结果会对疑似指令注入或需谨慎引用的 chunk 展示小型安全标记；文档处于 `PROCESSING`、本地触发处理或账号级 summary 仍有 active job 时会短轮询刷新，并展示最近后台 job 状态、后台任务摘要和 worker 在线/队列积压提示，静态 `PENDING` 不无限轮询；资料上传、替换、处理或删除后会失效刷新 knowledge agent suggestions；资料卡片操作使用右上角三点菜单，点击页面其它区域可收起菜单，`DONE` 资料不再展示主按钮式重新处理；该页面为在线能力，不进入 Dexie `mutationQueue`。
- `/error-book` 已升级为学科优先入口：错题首页展示学科卡片，学科内展示专题 deck，专题内展示错题列表；专题支持重命名，详情弹层、备注、掌握状态、删除确认和加入复习保持原有 CRUD 能力。
- Organizer API：`GET /wrong-question-groups`、`GET /wrong-question-groups/:subjectGroupId/decks`、`GET /wrong-question-decks/:deckId/questions`、`POST /wrong-question-organizer/organize/:wrongQuestionId`、`POST /wrong-question-organizer/organize-batch`、`PATCH /wrong-question-decks/:deckId`、`POST /wrong-question-decks/:deckId/items`、`DELETE /wrong-question-decks/:deckId/items/:wrongQuestionId`。
- Organizer API 是在线组织能力，不进入 Dexie `mutationQueue`；创建错题后的自动整理为非阻塞流程，整理失败不影响错题保存。用户 rename/move/remove 与 Organizer command 共用 owner advisory lock，旧 decision 不能覆盖用户 authority。
- ReviewTask 评分支持 `clientMutationId` 幂等；重复提交同一评分命令不会重复写入 `ReviewLog`。
- Dexie 继续作为本地快速恢复、离线兜底、乐观更新和旧图片预览层。
- WrongQuestion / OCRRecord / ReviewTask rating 写失败进入 Dexie `mutationQueue`，在 session 恢复、online、focus 时自动补偿同步。
- 今日任务页会展示本地待同步评分；离线评分不本地推进 FSRS、ReviewLog 或统计，仍以服务端同步成功为准。
- ChatMessage 不进入通用 mutation queue，继续使用 `/chat-messages/sync` 的会话快照幂等同步。
- Chat live 流式结束后会等待短稳定窗口并校验 assistant 内容；若最后仍是 user 或 assistant 为空，不写 Dexie、不同步服务端，并提示“本次回答没有成功生成，请重试”。
- `/chat-messages/sync` 后端会拒绝不完整会话快照，非空快照必须以非空 `ASSISTANT` 消息收尾，防止前端兜底失效时污染 PostgreSQL。
- 新 OCR 图片通过 `/uploads/images` 上传到 MinIO；`/ocr-records` 与 `/wrong-questions` 不接收 `data:` base64 图片。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理 AI 服务；`/api/chat` 默认使用本地 mock 流式响应，只有显式 live 双开关开启后才调用外部模型，live 默认模型为 `deepseek-v4-flash`。
- `/api/chat` 已加入上下文窗口、active OCR 题目上下文预算和输出 token 上限；有效 OCR 题目会生成 `activeStudyContext` 供后续追问承接。
- Chat / OCR 流式输出使用渐进 Markdown 渲染；展示格式化不回写 OCR 原始内容和 `activeStudyContext`。
- 今日任务轻手账与学习偏好仍是 userId scoped localStorage 数据，不进入 mutation queue，也暂不注入 prompt。
- 今日复习卡来自 `/review-tasks/today`，不存入 localStorage；轻手账 checklist 仍保存在 localStorage。

详细数据流见 `docs/data-flow.md`。

## 当前注意事项

- Docker PostgreSQL 使用 `5433 -> 5432` 映射，避免与 Windows 本地 PostgreSQL 冲突。
- Docker 默认保留：未经用户明确授权，禁止执行 `docker system prune`、`docker compose down -v`、volume 删除、数据库 reset、Redis `FLUSHDB` / `FLUSHALL` 或 MinIO wipe；不删除容器、镜像、volume、PostgreSQL、Redis 或 MinIO 数据。验收只精确清理本次合成账号/记录、合成对象和隔离浏览器 storage。
- 启动项目做真实浏览器验收时，默认使用 headed 浏览器并把窗口保持可见，让用户可以同步观察；headless 只作为自动化补充，不能替代明确要求的可见验收。
- 开发环境 CORS 允许 `localhost`、`127.0.0.1` 和私有局域网地址动态端口。
- PostgreSQL 需要 pgvector：`CREATE EXTENSION IF NOT EXISTS vector;`。
- `packages/fsrs` 保持纯算法包，不依赖数据库。
- Phase 7 核心工程化里程碑已推进至 Phase 7.23.8：审计证据包 contract、可靠投递、Worker、维护、查询/下载 API、Admin UI 和该链路 Docker 真实验收已完成；Phase 7.8.5 RAG runtime parity 补强也已完成真实 Docker 验收。Compose 的 server 默认是纯 `api`，独立 worker 独占 Dispatcher/export/maintenance processor；worker 以 `1001:1001` 运行并挂载 `201326592,mode=0700,uid=1001,gid=1001` tmpfs，避免重复消费和 crash janitor 权限错误。
- Phase 7.23.8 的为什么 / 怎么做：202 只证明 PostgreSQL 申请 facts 已提交，不能证明 Outbox、BullMQ、MinIO、ZIP 字节、下载审计和维护删除协作正确；因此新增需要 ADMIN/STUDENT token 的确定性 smoke，真实验证 403 权限矩阵、READY ZIP/headers/SHA、精确归档内容、REQUEST/DOWNLOAD audit、到期 410 和对象删除，并默认精确清理合成数据。Local Compose 的 `minio-init` 导入 2 天 lifecycle 作为异常兜底；24 小时逻辑失效和小时物理清理由应用负责。
- Phase 7.23 的安全边界不变：production gates 默认关闭，不使用 presigned URL，不把 objectKey、payload、metadata、token 或原始来源暴露给客户端；SHA-256 只证明完整性，不是数字签名或不可抵赖；HMAC 来源指纹仍是可关联数据，不是匿名数据；证据包是工程上一致的观察结果，不是法律级数据库快照。
- Phase 7.23.4 的为什么 / 怎么做：BullMQ lock 只能约束 Redis delivery，不能阻止失去 lock/lease 的旧进程继续执行 PostgreSQL 或 MinIO 副作用；因此 Worker 对 Export 与 linked SYSTEM BackgroundJob 使用同一事务的 token CAS，上传对象也把 token 编入 attempt key，最终只由数据库当前 token 选择 object key。审计查询在只读 REPEATABLE READ 快照内先 count 再按复合 keyset 流式导出；CSV 先脱敏、在清理控制字符前检测公式前缀，再由成熟 CSV/ZIP 库完成 quoting 与归档。live lease 使用 `DelayedError` 延迟而不消耗失败 attempt，本地明文与未被选择的 attempt object 都在 best-effort cleanup 中收口。
- 回顾时可以问：“processing token 如何阻止失去 lease 的旧 Worker 覆盖新证据包？”
- Phase 7.23.3 的为什么 / 怎么做：若 API 同时 commit PostgreSQL 再直接 enqueue Redis，任一侧失败都会留下不可恢复的双写窗口；因此申请只在一个 Serializable 事务内写四份 PostgreSQL facts，Outbox Dispatcher 再以确定性 Bull job id 跨到 Redis。request audit fail-closed/strict，Outbox requeue audit 仍 best-effort。真实 PostgreSQL e2e 使用 blocker transaction 和 `pg_locks/pg_stat_activity` 条件轮询，覆盖同 hash 去重、不同请求双成功、只剩一个 active slot 时恰好一成一拒；三场景均实际捕获 Prisma P2034 且 bounded retry 后 facts/配额正确，无任意长 sleep。
- 回顾时可以问：“事务型 Outbox 如何消除 PostgreSQL 成功但 Redis enqueue 失败的双写窗口？”、“为什么 Serializable + advisory lock 仍需要 bounded whole-transaction retry？”、“为什么申请审计必须 strict，而 Outbox requeue audit 仍保持 best-effort？”、“领域 400/503 如何避免 Zod issues 或原始数据库错误泄露？”
- 从 Phase 7.6 起，新建 docs / blogs / plans / specs 文件名优先使用语义化名称，不再加日期前缀；历史带日期文件暂不批量重命名，避免破坏已有引用。
- 向量索引用 raw SQL 创建，Prisma 不直接支持向量索引。

## 下一步

后续最优先：

1. Phase 6.9.4.4 已在 main 完成：Mock、controlled-Live、Docker、Router/Verifier 可见浏览器、注入零调用、Trace 价格、RAG internal parity 与精确清理均有 evidence；生产 gate 已恢复默认关闭。
2. Phase 6.9.5 Review/Planner 的 V1--V9 保持只读历史；该阶段 V9 唯一 Live 的 `quality_gate_failed` 不再是产品阻断，因为独立 V10 质量 authority、分支验收和 main default-off replay 已完成。V22 的 `operation_failed -> recovered` 与其余历史仍不可重跑或改写。
3. Phase 6.9.6 的唯一 V2 Live、R7 产品 acceptance、可见 `/knowledge`、精确清理、main default-off 回放与远程推送已经完成。Phase 6.9.7 Task 0--11 已完成；V1--V9 Live 均已分别以 `quality_gate_failed` 封存且不得重跑。Architecture Recovery R3、Provider Canary V2 L1、Small-sample L2 与 Full-gate L3 均保持各自 sealed 终态且不得重跑。Schema Recovery SR0--SR4 完成独立修复与 Mock-only checkpoint；唯一 SR5 run `63f8a76b...04cb` 已以 `schema_recovery_quality_gate_passed / schema_recovery_full_gate_semantic_gate` durable seal，strict/wire/usage `48/48/48/48`、semantic `0.9736111111/0.9515968407/0.9626039759`，不得重跑。SR6 已在 `providerCalls=0` 边界完成 Tutor/Organizer 分支产品验收；SR7 又完成 main 合并/推送、default-off Docker/API/可见浏览器/Trace/精确清理与 step-check 路由修复。二者均不提升 SR5 semantic authority。Phase 6.9.7 已完成；Phase 6.9.8 Task 0--9B 均已完成。唯一 Task 9C run `28b5f92f...2ff2` 已以 `task9_quality_gate_failed / qualityAuthority=none` durable seal，一次性名额已消费且禁止重跑、seal 或追加 Provider 探测。Architecture Recovery R0--R4 随后完成 design、rewrite TDD、Qwen/FinalResponse robustness、runner/durability/admission 与 reviewed Mock/static；唯一 R5 run `34eb99be...fc68` 在第二个 rewrite pair 的 DeepSeek `provider_dispatch / unknown` 后以 `architecture_recovery_quality_gate_failed / qualityAuthority=none` durable seal。External calls `4`，rewrite strict `1/16`、FinalResponse `0/16`，正式 semantic/P95/verified aggregate 全为 `null`；journal `237`、validator `ok=true`。R5 一次性名额已消费，禁止 retry/resume/replay/backfill、seal/recovery 或追加 Provider 探测；R6/R7、产品 Docker/API/browser、main、记忆注入与后续阶段继续阻断。随后 Transport Evidence Recovery T0/T1/T2 已在独立 lineage 完成设计、strict contract/TDD、30-case/15-classifier robustness 与 synthetic durability；T2 authority 仅为 `zero_provider_transport_evidence_t2 / qualityAuthority=none`，未调用 Provider、未创建正式 evidence。T3 controlled canary 已按一次性授权执行并以 configuration failure durable seal；T3-C configuration guard 随后完成 zero-provider 静态验证。不得重跑 T3、追加 Provider 探测或把 T2/T3-C 当作 Provider、语义或产品通过。
4. Phase 6.9.8 Schema Recovery SR0--SR4、SR5 runner/durability、Live tag compatibility 与 proxy port recovery 已完成 zero-provider 收口。绑定 v2 source/tag 的唯一 SR5 Live run `9eb57600...856e` 已消费，并由 crash-only recovery 封存为 `schema_recovery_sr5_branch_quality_gate_failed / qualityAuthority=none`；运行在 reservation 后、首个 guard 前把本 run self-marker 误判为 source drift，DeepSeek/Qwen/external Provider calls 均为 `0`。禁止重跑、再次 recovery 或追加 Provider 探测。下一任务是从最新 `main` 新开独立 zero-provider run-bound source revalidation recovery；SR6 Docker/API/Trace/可见浏览器产品验收继续阻断。
5. 全部 Agent 架构完成后进入 Phase 6.10 分层记忆，再进入 Phase 8 性能/PWA 与 Phase 9 MCP Tool 体系。
6. 未来分别编写《多 Agent 架构》和《记忆系统》两篇面试学习博客，具体题目与结构由用户届时确认。
7. V1--V9 marker/evidence 均不可删除、改写或重跑；V3--V9 journal 继续保留。禁止把不同版本、Mock 或部分成功拼接成通过。V5--V9 路线与历史证据继续由原文档维护。
8. V7 R0--R4 设计、计划与验收见 `docs/superpowers/specs/phase-6-9-7-tutor-organizer-v7-remediation-design.md`、`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v7-remediation.md`、`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r0-zero-provider-postmortem.md`、`docs/acceptance/phase-6-9-7-tutor-organizer-v7-r1-zero-provider-adapter.md`、`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r2-runner-lineage.md`、`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r3-static-mock.md` 与 `docs/acceptance/phase-6-9-7-tutor-organizer-v7-controlled-live-failure.md`。V7 已消费并失败封存，R5--R6 与任何追加 Provider 调用均不得开始。
9. V8 R0--R5 设计、计划与验收见 `docs/superpowers/specs/phase-6-9-7-tutor-organizer-v8-remediation-design.md`、`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v8-remediation.md`、R0--R3 acceptance、`docs/acceptance/phase-6-9-7-tutor-organizer-v8-r4-static-mock.md` 与 `docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v8-controlled-live-failure.md`。唯一 R5 Live 已失败封存，禁止重跑或进入 R6/R7/main；该终态当时只允许建立新的独立 zero-provider R0，后续 V9 R0 已完成。
10. V9 R0--R5 设计、计划与验收见 `docs/superpowers/specs/phase-6-9-7-tutor-organizer-v9-remediation-design.md`、`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v9-remediation.md`、R0--R4 acceptance 与 `docs/acceptance/2026-07-30-phase-6-9-7-tutor-organizer-v9-controlled-live-failure.md`。唯一 R5 Live 已失败封存；禁止重跑、追加 Provider 探测或进入 R6/R7/main。
11. Phase 6.9.8 Architecture Recovery R4/R5 验收分别见 `docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md` 与 `docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r5-controlled-live.md`。R4 仅为 zero-provider Mock authority；R5 唯一 Live 已失败封存且不得重跑。Transport Evidence Recovery T0/T1/T2 设计、计划与验收见 `docs/superpowers/specs/phase-6-9-8-retriever-final-response-transport-evidence-recovery-design.md`、`docs/superpowers/plans/phase-6-9-8-retriever-final-response-transport-evidence-recovery.md`、`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t0-zero-provider-design.md`、`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t1-zero-provider-tdd.md` 与 `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t2-zero-provider-robustness-durability.md`、`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-controlled-canary-failure.md` 与 `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-configuration-zero-provider.md`；T3 controlled 已执行一次并失败封存；T3-C configuration guard 已完成。不得重跑或追加 Provider 探测；若未来另立真实模型 lineage，仍需新的数据边界接受、独立授权、产品验收与 main 收口。

## Current next-lineage checkpoint (2026-08-12)

`drb/phase-6-9-8-sr5-next-lineage-admission` adds only independent SR5 D0/C1 zero-provider Git/source admission. The planned `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v3-approved` tag does not exist; no Live authorization, credential, Provider, or product acceptance is in scope. Old v2 run/tag/evidence remain immutable. Closeout order is feature push, `--no-ff` merge and push `main`, then merged-main zero-provider parity.

C2 runs on `drb/phase-6-9-8-sr5-next-lineage-tag-contract`: it adds a post-tag verifier for annotated kind, local/origin raw tag parity, peeled/target commit, canonical message, dynamic source bundle, sealed v2 identity, and empty v3 evidence namespace. The v3 tag is created only after merge/push of final `main`; do not add a later parity commit that moves `main` beyond the tag. C2 remains zero-provider and defines no Live authorization.

D1 runs on `drb/phase-6-9-8-sr5-next-lineage-authorization-contract`. It freezes v3-bound DeepSeek/Qwen boundary and exact authorization vocabulary as a zero-provider API only; authorization-shaped argv is rejected and no user acceptance is consumed. Because D1 is newer than the immutable v3 source, any future executable Live source must receive a later monotonic approved tag after D1/runner merge; never move or overwrite v3.

D2 runs on `drb/phase-6-9-8-sr5-next-lineage-runner-preflight`. It composes C2 tag parity, D1 source-bound authorization, and strict zero-call proxy attestation into a single-use preflight-only capability. It keeps runner invocation and Provider dispatch disabled and defines no credential, reservation, marker, journal, evidence, or historical Live-runner path.

D3 runs on `drb/phase-6-9-8-sr5-next-lineage-runtime-source-binding`. It resolves the final-source fixed-point problem by keeping future commit/bundle/tag-object values out of tracked constants. A future Git verifier supplies a dynamic v4 receipt after final runner merge/tag; D3 validates parity and binds authorization fields but issues no Git authority or executable capability. D1/D2 remain immutable v3 historical checkpoints.

## Current checkpoint: Phase 6.9.8 SR5 D5 final Git verifier (2026-08-13)

The ordinary branch `drb/phase-6-9-8-sr5-final-git-verifier` adds a read-only post-tag verifier for the future v4 annotated tag.
It dynamically derives the D3 source receipt from clean `main`/upstream/origin parity, annotated local/remote tag identity,
source-object bundle, sealed v2 predecessor, and an empty current-lineage evidence namespace. D5 never creates or pushes a tag,
reads `.env`, requests authorization, calls Providers, invokes D4, or writes formal/business data. Its single-use module-private
capability is Git/source-only: `gitAuthorityIssued=true`, while runner/provider dispatch and all counters remain zero. The v4 tag,
fresh DeepSeek/Qwen boundary acceptance, authorization, and controlled-Live remain future tasks. Acceptance:
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-final-git-verifier-zero-provider.md`.
Feature commit `7a2dfced` was merged with `--no-ff` as `31b17fe9` and pushed; merged-main D5+D3+D4 validation passed `48/48`.

## Current checkpoint: Phase 6.9.8 SR5 v4 post-tag test recovery (2026-08-13)

The immutable v4 annotated tag points to `5d1d2997`, with tag object `6523ae12` and source bundle
`sha256:e702a81a...084e2a`. D5 real read-only Git verification succeeded, but the tagged-source focused replay
passed only `21/22`: one test incorrectly required the real checkout to remain forever pre-tag. v4 is therefore
sealed as Git-valid but test-parity-ineligible and must not receive authorization or controlled-Live execution.
Recovery branch `drb/phase-6-9-8-sr5-final-tag-test-recovery` moves the final contract and exact confirmation
vocabulary to v5 and replaces the repository-lifecycle assertion with an isolated temporary-root fail-closed test.
Focused D5+D3+D4 now passes `48/48`; no `.env`, credential, Provider, Docker, evidence, or business write is used.
Do not move/delete v4. Merge/push recovery and revalidate `main` before creating the one final v5 tag.
Recovery feature `f80854bf` is merged/pushed as `96caa882`; merged-main focused D5+D3+D4 passed `48/48`.

## Current checkpoint: SR5 v9 evidence namespace recovery (2026-08-14)

The v8 entrypoint reached source admission and failed closed because the active evidence regex still matched the sealed unversioned v2 marker/report namespace. The v9 recovery versions marker, journal, report, recovery claim, and dispatch-lock paths under `...sr5-live-v9`; v2 and v5-v8 artifacts/tags remain immutable. v9 was merged and pushed as `3ad7d7ce`, the local/remote annotated tag passed parity, and the final read-only verifier returned `ok=true`. The freshly authorized v9 entrypoint then stopped at `proxy_preflight_not_ready` before credential projection or reservation: Provider/credential/formal-evidence/business-write counts are all `0`, and no v9 durability file exists. Do not rerun this authorization; the next task is an independent zero-provider proxy-preflight diagnosis from current `main`.
