# Phase 6.9.8 Retriever / FinalResponse Transport Evidence Recovery 实施计划

> 设计来源：[Transport Evidence Recovery 设计](../specs/phase-6-9-8-retriever-final-response-transport-evidence-recovery-design.md)
> 当前状态：T1/T2/T3-A 与 T3-C zero-provider guard 已完成；T3-B controlled canary 已按一次性授权执行并以配置失败 durable seal；Transport Re-entry V2 D0 zero-provider design 已完成，没有新增 Provider 请求，qualityAuthority 仍为 `none`
> 当前分支：`drb/phase-6-9-8-retriever-final-response-contract`
> 当前 authority：`zero_provider_transport_evidence_t3_configuration_guard / qualityAuthority=none`（T3 失败已不可变封存）

## 1. 为什么另立 lineage

R5 已失败封存，不能 retry/resume/replay。当前需要回答的是“现有第一方 adapter 能否把 dispatch 前后边界安全
分类”，而不是重新测一次 Agent 语义。新 lineage 只做 transport/evidence contract，不改变 R5、Task 9C 或产品
authority。

## 2. 任务拆分

### T0：决策、manifest 与 contract 冻结（已完成）

- 固定 lineage、三 family、阶段序列、boundary、reason bucket、30-case 分母和 no-raw 数据模型；
- 记录采用 Transport Evidence Recovery、拒绝 R5 retry/产品绕过/单纯 health canary 的理由；
- 只更新设计/计划和当前状态索引，不读 credential，不创建正式 evidence。

### T1：Zero-provider strict contract + TDD（已完成）

责任范围：`packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-*`（新文件）及其
focused tests；旧 R5 文件只读复用，不改写。

- 新建 lineage-owned diagnostic schema、stage/boundary/reason parser；
- 新建三 family 私有 capability seam，复用现有 validator 的 fail-closed 形态；
- 注入式 delegate 只能返回 synthetic bounded signals；global fetch、credential 和 Provider 必须为 0；
- focused tests 覆盖 exact own keys、deep freeze、unknown-field drop、raw retention 和 capability forgery。

T1 结果：新增 lineage-owned strict diagnostic parser 与三条 family 私有 single-consume WeakMap/WeakSet seam；
focused `8/8`（51 assertions）、Agent full `1337/1337`、typecheck/lint 通过。Provider/credential/formal evidence 为
`0/0/0`，旧 R5/Task 9C SHA parity 保持不变。完整 T1 验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t1-zero-provider-tdd.md`。

### T2：Robustness + durability static checkpoint（已完成）

- 固定 24 个 family/boundary cases + 6 个 abort/capability/publication cases；
- 30 个 runner/robustness cases 固定不变；另用 classifier fixture 覆盖
  DNS/TLS/proxy/connection/abort/timeout、envelope/schema/stream/usage 子类；
- 验证 `providerWire/runnerWire` 单调性、stage prefix、未知 bucket 保留、breaker 与 sibling 收口；
- 验证 crash-only prefix、exclusive marker、hash-chain journal、hard-link artifact 和 strict validator 只在
  synthetic root 工作，正式 evidence 仍为 0；
- 运行一次独立 reader/secret/link 检查，不能把结果写成 Provider health 或 semantic quality。

T2 结果：30/30 matrix、15/15 classifier、focused `11/11`（39 assertions）、Agent full `1348/1348`（23746
expect()，168 files）、typecheck/lint/Prettier/diff check 全通过。Provider、credential、global fetch、正式 evidence、
产品写入均为 0；synthetic temp-root marker/journal/report/artifact 在测试后精确清理。新增 terminal-prefix、partial
prefix、existing-artifact publication recovery、multiple-marker 与 Windows fsync compatibility 验证。完整验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t2-zero-provider-robustness-durability.md`。

### T3-A：Zero-provider admission + runner（已完成）

- 固定 source schema：branch、HEAD、upstream、origin、approved ref 必须 parity，working tree clean，formal artifact
  count 必须为 0，并绑定 T2 gate 与 source bundle SHA；
- 增加 admission/reservation 两个 module-owned、single-consume opaque capability，fresh proxy nonce receipt，以及
  只读取固定 own-data descriptor 的 DeepSeek/Qwen data-boundary 与 exact authorization reader；
- 增加固定三槽位 zero-provider runner：`rewrite -> qwen -> final_response`，最多 3 slots、预算上限 `0.024096 CNY`
  （`0.005 + 0.004096 + 0.015`，每个 slot 各一次；不复用 Task 9 的 32-call Qwen cap），
  首错 breaker、abort/timeout/budget 与固定未启动 suffix accounting；不接收 credential、fetch、executor 或 persistence port；
- CLI core gate 顺序固定为 `argv -> source -> T2 -> proxy -> data boundary -> authorization -> runner`，proxy watchdog 为
  `1000ms`，任何失败都在后续 mutation/provider port 前停止。

T3-A 结果：focused `12/12`（49 assertions）、Agent full `1360/1360`（23805 expect()，169 files）、typecheck/lint/
Prettier/`git diff --check` 通过；Provider、credential、global fetch、正式 evidence、业务/Trace 写入均为 0。authority
固定为 `zero_provider_transport_evidence_t3_admission / qualityAuthority=none`，gate 为
`transport_evidence_t3_admission_ready`。完整验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-zero-provider-admission.md`。

### T3-B：transport controlled canary（已执行，失败封存）

在 T3-A 通过后，用户重新接受 DeepSeek/Qwen 数据边界并给出 exact authorization。唯一 run
`075e2d5f-682b-426d-847e-f5a6ce5b97c6` 在 source commit
`2423baf3768c245d2e4d6ea0038c6fb1bf8f9bc7` 上通过 source/T2/proxy/boundary/approval，并创建 durable reservation；
随后在 late-bound credential gate 以 `configuration_invalid` 失败。首个 slot 尚未启动，breaker 将三个 slot 都收为
`not_started_quality_breaker`，`providerCalls=0`、`credentialReads=0`。进程退出后已按 crash-only 规则发布固定失败报告，
validator `ok=true`，journal `7` 条，report logical SHA=`8d529bb7...4875d1`，physical artifact SHA=
`50beb053...7ee9c`。这不是 Provider transport/semantic 失败，也不能归因具体 DNS、TLS、代理、账号、余额、权限或服务端。

本次一次性名额已消费，禁止 retry/resume/replay/backfill、seal/recovery 或追加 Provider 探测。后续补充了生产脚本的显式
根 `.env` 加载与独立 crash-only seal CLI（提交 `3d903055`），但不得用于重跑本 run。完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-controlled-canary-failure.md`。

### T3-C：CLI configuration composition guard（已完成，zero-provider）

新增 `phase-6-9-8-retriever-final-response-transport-evidence-t3-configuration.test.ts`，静态验证 controlled package
script 从 package cwd 显式解析仓库根 `.env`，并验证 crash-only seal CLI 不携带 credential、fetch 或 Provider port。该
guard 不读取真实 `.env` 内容、不启动 controlled script、不创建正式 evidence；focused `2/2`（10 assertions）、
typecheck/lint/`git diff --check` 通过。authority 固定为
`zero_provider_transport_evidence_t3_configuration_guard / qualityAuthority=none`。完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-configuration-zero-provider.md`。

### T3-D：Transport Re-entry V2 D0（已完成，zero-provider）

旧 T3 一次性名额已消费，不能由显式 `.env` 修复或 T3-C guard 恢复。新的
`phase-6.9.8-retriever-final-response-transport-reentry-v2` lineage 已冻结独立 confirmation、evidence prefix、
root launcher → dedicated projection 边界、credential-before-marker configuration preflight、三槽预算/timeout、
首错 breaker 与后续 C1/C2/S1/L1/P1 顺序。D0 不读取真实 `.env`、credential，不调用 Provider，不创建正式 evidence；
authority=`zero_provider_transport_reentry_v2_design / qualityAuthority=none`。完整记录见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-transport-reentry-v2-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-transport-reentry-v2.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-d0-zero-provider-design.md`。

## 3. 文件与权限边界

| 责任                         | 允许                                                            | 禁止                                                  |
| ---------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| 新 Transport Evidence module | 生成 bounded diagnostic、验证 stage/wire、发布 synthetic report | 读取 credential、调用 global fetch、写业务表          |
| 旧 R5 module                 | 只读复用 schema/validator 事实                                  | 改写 R5 artifact、tag、journal、marker                |
| runner/CLI                   | T3-A 只接 `args + AbortSignal`；T3-B 仅在授权后 late-bind credential | 接受 scorer/prompt/oracle，或绕过 source/data-boundary gate |
| 产品 `/api/chat`             | 本阶段不变，gate 继续 default-off                               | 接入 T3 或创建 BackgroundJob/Outbox/Trace             |

## 4. 安全与可观测性约束

- 记录固定 enum/bucket、opaque `callId`、phase/family、wire、stage prefix 和 `rawDataRetained=false`；
- 不记录 raw response、raw error、URL、prompt/query/chunk/answer、unknown key、Zod path/value、token、cookie 或 key；
- `unknown` 不得被映射为 DNS/TLS/proxy/账号/余额/权限/服务端；
- capability 必须 module-owned、single-use、绑定 call/phase/family/lineage，跨边界一律 fail-closed；
- 任何 reservation/publication/validation 异常都不能假报 `providerCalls=0`；T1/T2/T3-A 只在 synthetic scope 验证，
  不创建正式 marker/journal/artifact/reservation。

## 5. 验收命令

T1/T2/T3-A 使用以下 zero-provider 命令；已封存的 T3 只允许运行只读 validator：

```text
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-contract.test.ts
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.test.ts
bun --filter @repo/agent test
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
bun --filter @repo/agent eval:phase-6-9-8:transport-evidence:t3:validate
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-t3-configuration.test.ts
```

受控脚本现在显式从 `@repo/agent` 包目录加载仓库根 `.env`：

```text
bun --env-file=.env --filter @repo/agent eval:phase-6-9-8:transport-evidence:t3:controlled
```

该命令只适用于未来另立 lineage 且重新授权的 canary；本 T3 名额已消费，严禁执行。crash-only seal 入口为
`eval:phase-6-9-8:transport-evidence:t3:seal`，只能封存尚未发布的配置/进程中断前缀，不得用于恢复或重放已发布 run。

## 6. 交付与文档同步

- T0：本设计与计划单独提交；
- T1：实现与 focused tests 单独提交；
- T2：robustness/static checkpoint 单独提交并推送当前功能分支（已完成）；
- T3-A：zero-provider admission/runner、focused tests 与本验收记录单独提交并推送当前功能分支（已完成）；
- T3-B：唯一 controlled canary、crash-only seal、失败验收记录与环境加载修复分别提交并推送当前功能分支；
- T3-C：configuration composition zero-provider guard 与验收记录单独提交并推送当前功能分支；
- T3-D：Transport Re-entry V2 D0 设计、计划与 zero-provider 验收记录单独提交并推送当前功能分支；
- 每次提交后推送当前功能分支并核对 `HEAD == upstream == origin`；
- T1/T2/T3-A/T3-B/T3-C 完成后同步 AGENTS、DEVLOG、README、roadmap、acceptance checklist、dev-start、data-flow、AI behavior
  acceptance 与本设计/计划；
- 不合并 main，不移动 approved tag，除非后续阶段明确形成新的质量 authority 并完成分支/产品/main 验收。

## 7. 停止条件

任一 gate 失败，停止在当前 T 任务并记录 bounded diagnostic；本次 T3-B 已在 credential configuration gate 停止并
durable seal。它只形成 transport/evidence authority；Retriever/FinalResponse semantic、产品 Docker/API/browser、
Trace、SLA 和 main 仍需单独授权与验收，且不得把本次失败改写为 Provider 根因。V2 D0 只形成新的 zero-provider
设计 authority；下一步仅允许 C1 zero-provider implementation，没有新的 exact authorization 前不得执行 V2 L1。

## 8. Reader Testing 问题

- 读者能否区分“dispatch 阶段”与“具体网络根因”？
- 读者能否看出 R5 artifact 不会被新 lineage 改写？
- 读者能否知道 T1/T2/T3-A 完成不等于 Provider 健康或 Agent 质量通过？
- 读者能否根据本计划知道下一次需要什么授权、预算和证据？
