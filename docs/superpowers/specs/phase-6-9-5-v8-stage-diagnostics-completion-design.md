# Phase 6.9.5 V8 Stage Diagnostics 与阶段完成设计

> 状态：2026-07-18 已按用户对 Phase 6.9.5 后续工作的完整授权进入实施。本文只授权新的 V8 lineage；V1--V7 的 marker、evidence、confirmation 和计数继续只读且不可重跑、删除、重建或改写。

## 1. 目标与完成定义

V8 的目标不是再做一次不可解释的 Live，而是同时解决两件事：

1. 用无正文、固定枚举、只追加的 durable stage markers 消除 V7 将多个失败边界折叠成同一 `evidence_io` 的不可定位问题；
2. 在新的 one-shot lineage 中完成 ReviewAgent / PlannerAgent 的 48-case controlled-Live 质量门，随后完成 owner-scoped、只读、default-off 的 Docker/API/可见浏览器/Trace 产品验收。

Phase 6.9.5 只有在以下事实全部成立后才能标记完成：

- V8 controlled-Live 具有 committed success evidence，而不是只有 Mock、stdout、candidate JSON 或 provider attempt 计数；
- `48 cases / 26 verified zero-call / 22 runtime / 48 strict / 48 quality / 0 critical` 全部通过，semantic quality `>= 90%`，P95 `<= 4500ms`；
- provider attempts 恰好为 `23`，正安全 usage 不超过 `42_996 / 9_712`，observed cost 不超过 CNY `1.00`；
- Review-only 与 Planner-only 产品路径分别得到 `candidate_applied`，另一组件保持 deterministic，且 JWT owner、FSRS、分钟数、链接和写库权限仍由本地代码掌握；
- Docker API、`/plan`、`/today`、Agent Trace、default-off 回滚与精确合成数据清理均有证据；
- 分支和 main 各自完成规定复验，main 已推送远程，本地/远程 SHA 一致；
- 两个产品 gate 已恢复 `false`，所有临时 Live 进程和测试数据已清理，Docker 资源未被删除。

本设计不进入 Phase 6.10 记忆注入，不修改其他 Agent，不把 V8 评测 gate 投影到 Web、worker 或普通产品 API。

## 2. V7 可证根因边界

V7 最终只留下 `finalized / invalid_attempted / closed / 23 / false / evidence_io`。现有字节只能证明全部 23 个允许的 provider attempts 被安全计数，不能证明 paired report 已返回、质量已通过、usage/cost 已聚合或 success candidate 曾存在。

代码中以下边界都会收敛成同一个 `evidence_io`：

- CLI 顶层 orchestration catch；
- paired result 返回、schema/quality/cost 校验；
- CLI final history verification；
- finalizer 的 safe provisional、internal history、terminal replacement、post-terminal history、downgrade 与 success commit。

因此不得假设 V7 是某一个确定的 I/O 错误，也不得用 V7 再跑来试错。新 lineage 必须先增加不会保存 prompt、response、token、cost、raw error 或 credential 的 stage evidence。

## 3. 方案比较与选择

### 方案 A：append-only exclusive stage markers（采用）

每个阶段使用固定文件名、零字节内容、exclusive-create、no-reparse handle 与 Windows write-through durability barrier。native close-failure RED 证明不能直接写公开 marker 再要求其 handle close 返回值，因为 close 失败后同名字节可能已经存在。所有公开 stage marker 因此也使用方案 A2：private prepare leaf 先完成 write-through/flush/checked-close，再 HANDLE-relative exclusive rename 到固定 marker leaf；rename 成功才让 marker 对 reader 可见。prepare/reopen/rename 失败立即停止，公开前缀仍停在上一 stage；post-commit cleanup close 只报告 cleanup 状态，不撤销 marker。缺口、乱序、重复、prepare 遗留或未知 leaf 全部 fail-closed。

### 方案 A2：preclosed temp + HANDLE-relative rename publication（采用）

2026-07-18 的 native close-failure RED 证明：若直接把 final seal 写入公开 leaf，再把该 handle 的 close 结果作为 committed 条件，`NtFlushBuffersFile` 后 `CloseHandle=false` 时磁盘上可能已存在完整 seal，而跨进程 reader 无法从相同字节恢复历史 close 返回值；删除、覆盖、补偿 marker 或无限追加“最后一个证明文件”都不能可靠消除这个终局证明悖论。

因此 once marker、15 个 stage marker 与 success seal 都使用同一个两段式 commit primitive：先在已绑定 no-reparse evidence directory 下写入各自固定 private prepare leaf，完成 write-through、flush 和 checked close；随后从同一 directory HANDLE existing-only/no-reparse 重开 prepare leaf，复核 regular-file、精确内容/长度；seal 还要复核 strict schema 与全部 candidate/hash/nonce/manifest 绑定。最后以 `NtSetInformationFile`、`RootDirectory=boundDirectoryHandle`、`ReplaceIfExists=false` 原子 rename 到固定 public leaf。rename 成功是唯一 publication/commit 线性化点。rename handle 的后续 close 只属于资源清理；即使返回 `close_unverified` 也不能删除 public leaf、撤销 committed、重试 rename 或降级 evidence。prepare write/flush/首次 close、reopen 或 rename 任一步失败都停在 uncommitted，prepare leaf 即使遗留也只会令 reader 返回 `evidence_io`。

不得使用路径型 `MoveFileExW`，因为它会重新引入 ancestor/leaf reparse 解析竞态；不得在 rename 后追加新的 directory flush 成功门，否则 final leaf 已公开后又会产生同一终局悖论。native preflight/test 必须证明目标 Windows 文件系统与当前 HANDLE-relative `FILE_WRITE_THROUGH` rename contract 可用；不可用时 V8 在 provider 前 fail-closed。

本设计对“durable”的精确承诺限定为：本地固定 NTFS volume 上，进程在 commit rename 前后异常终止，父/后继进程仍能用 fresh no-reparse reader 区分 uncommitted prepare 与 committed public leaf。它不声称覆盖物理断电、磁盘控制器 volatile cache、远程盘、可移动盘、ReFS/FAT/exFAT 或虚拟文件系统。preflight 必须通过已绑定 volume HANDLE 查询并固定 `NTFS + local/fixed + non-remote`；无法证明时在 provider 前停止。native acceptance 必须用独立 Bun child 在 rename 前强制终止，证明只有 prepare/无 public leaf；再在 rename 成功后、cleanup 前强制终止，证明新进程能读取 public leaf。普通 happy-path 原子性测试不能替代这两条 process-crash 证据。

generic I/O API 只接收 `committedLeafName`，private prepare leaf 必须在内部唯一派生为 `${committedLeafName}.prepare`；拒绝已经以 `.prepare` 结尾、非 safe leaf、目标已存在或任何同名/覆盖情形。V8 evidence 层再把可用 committed leaf 严格限制为 once leaf、15 个 stage 枚举和 success leaf，调用方不能自由提供 prepare/public pair。

one-shot 语义分两层：只要任一 fixed prepare 或 public leaf 已创建，后续 reservation 一律 `already_consumed`，不得删除、复用或重跑；若失败发生在第一个 prepare leaf 成功创建之前，则磁盘上客观没有跨进程消费证明，当前 invocation 仍零重试、零 provider call，任何后续新 invocation 必须重新取得用户明确授权，不能被 CLI 自动恢复或解释为已消费。

### 方案 B：terminal JSON 增加 `diagnosticStage`（不采用）

改动较小，但 terminal write 失败时 stage 字段本身也无法持久化，不能解决 V7 的核心歧义。

### 方案 C：单个可替换 `stage.json`（不采用）

能记录多数阶段，但 replace 失败或旧值残留时仍有歧义，也扩大了可覆盖写面。

## 4. V8 冻结身份与预算

V8 使用全新且互不复用的身份：

```text
profile: phase-6.9.5-review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics
eval gate: REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED
confirmation: --confirm-controlled-live-v8-deepseek-v4-pro-stage-diagnostics
provider/model/base: deepseek / deepseek-v4-pro / https://api.deepseek.com/v1
structured mode: deepseek_v4_pro_nonthinking_json
timeout: 4500ms
dataset: phase-6.9-review-planner-v2
product gates during paired Live: false / false
max provider attempts: 23
max paired runtime attempts: 22
reserved usage: 42_996 input / 9_712 output
hard cap: CNY 1.00
SDK retries: 0
```

V8 evidence 目录、once marker、schema version、success seal 和 package script 全部独立。V8 historical snapshot 覆盖 V1--V7，并显式 pin V7 的 84-byte once marker 与 245-byte terminal JSON；V7 的两个 SHA-256 分别是：

```text
1920c68d8fd10d77af1cf63731e46ed8e9c02270093a024302b24eb97fa85bda
79c07fed05a011a6344e7df3aecd9c616824c6a7cd07873693f3ddfaab1a63ba
```

## 5. Stage marker contract

V8 只允许以下零字节 marker，文件名本身就是固定 enum；不得写 JSON、时间、路径、异常、case id 或任何动态内容：

```text
.stage-010-reserved
.stage-020-attempted
.stage-030-evaluator-ready
.stage-040-provider-history-verified
.stage-050-canary-started
.stage-060-canary-returned
.stage-070-paired-started
.stage-080-paired-returned
.stage-090-report-validated
.stage-100-finalization-started
.stage-110-safe-provisional-written
.stage-120-internal-history-verified
.stage-130-terminal-record-written
.stage-140-post-terminal-history-verified
.stage-150-success-commit-started
```

规则如下：

- marker 只能通过 `advanceReviewPlannerControlledLiveV8Stage(reservation, exactStage)` 进入 reservation 私有 `WeakMap` capability 后创建；公开 reservation 对象仍只暴露 `relativePath` 与 `markAttempted`，伪造、clone、错序或重复 stage 在任何写入前失败；
- marker 必须按前缀连续并通过方案 A2 exclusive commit、不可覆盖、不可重试；prepare/reopen/rename 任一 commit 前失败立即停止，不进入后续 provider 或文件操作；rename 后 cleanup close 不影响 committed marker，也不触发 delete/retry；
- V8 once marker、15 个 stage marker 与 success seal 使用方案 A2 commit primitive。safe provisional、complete candidate 与 terminal record 仍使用 checked-close replacement，并由其后一个 committed stage 证明；replacement 的 write/flush/close 失败立即停止且零重试。任何 commit 前失败零删除、零补偿、零重试；rename 后 cleanup close 不反向撤销 committed；
- `.stage-050-canary-started` 与 `.stage-070-paired-started` 在外部调用前创建，用于区分“尚未开始”和“调用中/调用后未返回”；
- `.stage-080-paired-returned` 只表示 Promise 已安全返回，不表示 report 合法；`.stage-090-report-validated` 才表示 schema、质量、延迟、usage、cost 和计数已形成可接受 complete summary；
- `.stage-100` 以后由 finalizer 私有 capability 创建；success seal 绑定安全 evidence leaf、candidate SHA-256、historical tree hash、V8 once-marker SHA-256、reservation nonce/commitment 和 `.stage-010` 至 `.stage-150` 的 canonical manifest hash；
- failure 允许 marker 是合法连续前缀；public reader 只返回固定 `lastStage` 枚举和安全终态，不返回 marker 路径、prompt、response、token、cost 或 raw error；
- success 必须具有完整 marker 序列、私有 success candidate、exclusive success seal、匹配的 manifest/candidate/once-marker/nonce commitment 和 fresh V1--V7 tree；public reader 每次都必须通过 existing-only、regular-file、no-reparse handle 重新读取 once marker，核对精确内容、SHA-256 和 seal 绑定。缺一项都只能读取为 `evidence_io`。

JSON replacement 与证明它的 committed publication 固定对应如下：

| JSON / artifact | 证明 publication | 缺失时 reader |
| --- | --- | --- |
| reserved baseline + once | `.stage-010-reserved` | `evidence_io` / uncommitted |
| attempted baseline | `.stage-020-attempted` | 只保留上一 committed prefix |
| safe provisional | `.stage-110-safe-provisional-written` | `evidence_io` |
| terminal failure 或 success candidate | `.stage-130-terminal-record-written` | `evidence_io` |
| post-terminal history 通过 | `.stage-140-post-terminal-history-verified` | success candidate 仍不公开 aggregate |
| success commit started | `.stage-150-success-commit-started` | success candidate 仍不公开 aggregate |
| strict success seal | public success leaf rename | 只有此项可公开 complete aggregate |

`.stage-130` 后的 history drift、unsealed candidate 或 prepare 遗留都不能靠覆盖/删除修复；无 strict public seal 时始终 `evidence_io`。

## 6. 编排与 finalizer 简化

V8 保留 V7 已验证的 typed non-thinking transport、counted executor、单例 canary/paired Promise、预算和 strict schema，不修改 V7 文件。新 CLI 的顺序固定为：

```text
exact confirmation
-> zero-network preflight
-> V1--V7 snapshot
-> reserve V8 + .stage-010
-> mark attempted + .stage-020
-> create evaluator + .stage-030
-> provider前 history verify + .stage-040
-> .stage-050 + canary + .stage-060
-> .stage-070 + paired + .stage-080
-> strict report validation + .stage-090
-> .stage-100 + controlled finalizer
-> safe provisional + .stage-110
-> internal history verify + .stage-120
-> terminal record + .stage-130
-> complete 路径 post-terminal verify + .stage-140
-> .stage-150
-> durable-close private seal prepare leaf
-> existing-only/no-reparse rebind + strict binding verify
-> HANDLE-relative exclusive rename to success leaf = committed
-> post-commit handle cleanup only
```

V8 删除 V7 `finish()` 中与 finalizer 重复的外层 final-history verify。安全性由 provider 前 verify、finalizer internal verify、post-terminal verify 和 public-reader fresh verify共同保证；减少一次重复的 20-entry filesystem traversal，避免把无意义的重复读失败降级成不可解释的 terminal failure。

失败 evidence 只允许：`state/status/gate/providerAttemptCount/usageKnown/diagnosticCode/schemaVersion`。`lastStage` 由 public reader 从合法 marker 前缀派生，不写入失败正文。complete candidate 才允许 aggregate usage/cost/quality counters，并且没有 success seal 时永不公开这些数值。

Complete candidate 使用 strict 白名单：`schemaVersion/state/status/gate/providerAttemptCount/usageKnown/aggregateInputTokens/aggregateOutputTokens/observedCostCny/priceProfileId/caseEntries/zeroCallCases/runtimeInvocations/strictSuccesses/qualityPasses/criticalFailures/successCommitmentSha256/stageManifestSha256`。Success seal 同样 strict，只允许 `schemaVersion/evidenceLeaf/candidateSha256/historicalTreeHash/stageManifestSha256/onceMarkerSha256/commitNonce`；`evidenceLeaf` 只能是当前 V8 目录下的安全 leaf name，不能是绝对或相对路径。除白名单 aggregate usage/cost 外，candidate/seal 均禁止 prompt、response、case 内容、用户 facts、provider 原始载荷、其他动态 telemetry、raw error/message/cause/stack、credential、URL、header、cookie、时间戳和动态路径。

## 7. TDD 与复审门

实施必须遵守 RED -> GREEN -> REFACTOR：

- 先新增 V8 profile/schema/marker/export 缺失测试并观察 RED；
- 对 15 个 stage 分别注入 false/throw，断言最后 marker、provider count、零重试和安全 public projection；
- native Windows tests 覆盖 duplicate marker、gap、乱序、reparse、concurrent reservation、candidate/terminal replacement 的 write/flush/close denied、history drift、unsealed candidate 和 manifest mismatch；once/stage/seal publication 分别覆盖 prepare write/flush/close、reopen、rename failure，以及 rename committed 后 cleanup close failure。commit 前失败不得出现对应 public leaf，post-commit cleanup failure 必须保留 public leaf并由 fresh reader按当前阶段安全投影；另以 child hard-exit 覆盖 rename 前/后两条 local fixed NTFS process-crash 证据；
- fake executor 覆盖 48/26/22/48/48/0、23 attempts、正 usage、CNY cap 与 complete seal；
- static tests 证明 V8 eval gate 不进入 Docker/Web/worker/server product config allowlist，两个产品 gate 默认 `false`；
- contract/security 与 acceptance/operations 两轮独立复审都必须无未关闭 Critical/Important。

只有上述离线门通过，才允许执行 V8 唯一 controlled-Live。

## 8. 产品验收设计

V8 complete 后，使用统一 synthetic 前缀 `phase695-v8-accept-<UTC>` 创建两个隔离账号：Review fixture 与 Planner fixture。验收脚本记录账号 id、创建的 Card/ReviewLog/ReviewTask/ReviewPreference/WrongQuestion/deck/Trace id，清理时按精确 id 删除并断言零残留。

证据目录固定为：

```text
docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch/acceptance.json
docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch/plan.png
docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch/today.png
docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/main/acceptance.json
docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/main/plan.png
docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/main/today.png
```

`acceptance.json` 只允许 schema version、environment、commit SHA、provider/model identity、两组件 disposition/provenance/duration/usage、Trace step/status/pricing 摘要、owner-isolation/facts-unchanged/gate-restored/cleanup 布尔值、request/usage/cost 合计、产品 `priceProfileId/inputRateCnyPerMillion/outputRateCnyPerMillion/snapshotDate/source/rounding`，以及 `pairedEvidenceSha256 / planScreenshotSha256 / todayScreenshotSha256` 三个明确 SHA；JSON 不自哈希。账号 id 只保存 SHA-256，禁止 email、JWT、refresh token、cookie、prompt、response、用户事实、原始 Trace、key、URL、header、raw error 或 stack。截图只使用合成账号且不得出现 token、cookie、key、浏览器开发者工具凭据或真实用户数据。

### Review-only

Server 环境固定为 `REVIEW_AGENT_MODEL_ENABLED=true`、`PLANNER_AGENT_MODEL_ENABLED=false`，只重建 `server`。一次 authenticated `GET /review-agent/suggestions` 必须满足：

- `review.attempted=true / candidate_applied / live_candidate / degraded=false / inputTokens>0 / outputTokens>0`；
- `planner.attempted=false / not_eligible / local_deterministic`；
- facts、分钟数、链接和数据库快照与调用前一致；
- Trace steps 固定为 `deterministic_review -> review_candidate -> deterministic_planner -> planner_candidate`，Review candidate disposition 为 `candidate_applied`，usage 为正，定价状态正确且无敏感正文。

随后以 headed 可见浏览器打开 `/plan`，保存截图并检查页面/console/network。完成后立即把两个 gate 恢复 `false`，重建并探测 `server`，确认 suggestions 回到 deterministic。

### Planner-only

Server 环境固定为 `REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=true`，同样只重建 `server`。API 断言与 Review-only 对称；随后 headed 打开 `/today`。完成后再次恢复 default-off 并重建 `server`。

两个账号还要互相执行一次 owner-isolation 负例，确保 token A 看不到 token B 的建议事实或 Trace。该负例必须在两个产品 gate 已恢复 `false`、default-off `server` 已重建后执行，不携带 acceptance capability，也不允许产生额外 Live attempt。Trace 是 best-effort 写入，因此必须实际轮询到对应记录，不能用 suggestions `200` 替代。

每轮产品验收由单一 acceptance runner 和 Nest `server` 共同实施跨 HTTP admission。runner 与 server 各自持有独立原子计数器且都从 `remainingRequests=2` 开始：runner 必须在任何 `await`、HTTP dispatch 或 Playwright `route.continue()` 之前同步完成不可回滚的 check-and-decrement，claim 失败立即 `route.abort()`/停止 dispatch 并断言零 provider；不得使用“先检查、后 await、再减一”的 check-then-act。`server` 只在独立、默认缺失的 acceptance gate 与随机 capability commitment 同时匹配时创建进程内原子计数器；每次请求必须携带对应的一次性 capability，且 service 必须在调用 `ModelAgentRuntime` 之前执行不可回滚的 compare-and-decrement claim。capability 缺失/错误、组件不匹配、counter 为零、并发竞争失败或 counter 状态不可验证时均在 provider 前 fail-closed；不得把该 gate/capability 投影到 Web、worker、日志、Trace、evidence、截图或仓库 env 文件。显式 API 请求在 runner/server 双重 claim 后消耗一次；headed 页面使用临时 browser-context header 携带 capability，同时 Playwright route 只允许恰好一个 `/review-agent/suggestions` network request，第二个请求在离开浏览器前被 abort 并令验收失败。页面首个响应完成后立即把两个 counter 归零、清除 capability、恢复 gate 并重建 `server`；Trace 前后差值还必须证明目标组件恰好产生 2 次 live candidate attempts。不得用页面刷新、focus/refetch、reconnect、重新挂载、query invalidation、脚本重试或第二浏览器上下文增加次数。

因此分支产品验收最多 4 次模型请求（Review API + `/plan`、Planner API + `/today`），main 复验再允许同样 4 次。两轮合计预留不超过 `15_600 / 3_520` tokens。产品验收冻结独立价格 profile `deepseek-v4-pro-cny-noncached-2026-07-18-v8-product-acceptance`：价格快照日期为 `2026-07-18`，来源为用户提供的 DeepSeek 官方价格截图；非缓存 input CNY `3 / 1M`、output CNY `6 / 1M`，不使用缓存折扣。费用按 provider-verified 整数 token 分别乘以精确有理数费率后求和，使用未舍入值比较 hard cap，写入 evidence 时按十进制 8 位 `ROUND_HALF_UP`；worst case 为 `15_600*3/1M + 3_520*6/1M = CNY 0.06792000`，hard cap 为 CNY `0.10000000`。超过 admission、usage 或 cap 立即关闭 gate。V4 Pro 不写入现有 USD Trace 价格表，因此 Trace 的正确状态是 `pricingKnown=false / costEstimate=0`；CNY cap 只在私有 acceptance 汇总中按 verified usage 计算，不代表供应商账单。

## 9. main 复验语义

已消费的 V8 paired lineage在 main 上绝不重跑。`--no-ff` 合并 main 后的复验由以下部分组成：

1. 重新读取 committed V8 evidence，核对 success seal、stage manifest、V1--V7 tree 和工作区/HEAD SHA；
2. 完整静态 test/lint/build/typecheck 与 Compose `config --quiet`；
3. Docker default-off smoke；
4. 以产品 acceptance hard cap 重放 Review-only 与 Planner-only 的 API/浏览器/Trace 路径；这不是 paired eval，也不能改写 V8 evidence；
5. 精确清理 main 复验合成数据，再恢复 default-off；
6. 推送 main 并比较本地 HEAD、`origin/main` 和 evidence SHA。

## 10. 进程、凭据与关机收口

关机前必须按顺序完成：

1. 清除当前 PowerShell/辅助进程里的 Live/eval/product gate 变量与 provider key；不打印 key；
2. 以 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、两个产品 gate `false` 重建 `server`，探测 suggestions 为 deterministic；
3. 关闭 headed 浏览器、Playwright、临时 Bun/API/Web/Admin 辅助进程；
4. 查询合成账号、业务记录、Trace、浏览器 storage 均为零残留；
5. 确认 Git 工作树干净、本地/远程 main SHA 一致；
6. 使用 `docker compose ... stop` 有序停止 Compose services，保留容器、镜像、network、PostgreSQL/MinIO volume 和 Redis/MinIO/PostgreSQL 数据；禁止 `down`、`down -v`、prune、volume 删除、reset、flush 或 wipe；
7. 记录最终进程/Compose 状态后再执行系统关机。

关机是终点动作，不得用关机掩盖未完成的 gate、数据清理、推送或复验。
