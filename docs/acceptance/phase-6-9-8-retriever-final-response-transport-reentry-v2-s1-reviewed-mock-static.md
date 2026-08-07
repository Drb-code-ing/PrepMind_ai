# Phase 6.9.8 Transport Re-entry V2 S1 Reviewed Mock / Static 验收

> 日期：2026-08-07
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> lineage：`phase-6.9.8-retriever-final-response-transport-reentry-v2`
> authority：`zero_provider_transport_reentry_v2_s1`
> gate：`transport_reentry_v2_s1_mock_quality_not_evidence`
> qualityAuthority：`none`

## 1. 任务范围

S1 是 C2 之后的 zero-provider reviewed Mock/static checkpoint。它把三个受限的第一方 adapter 形状通过同一个
C2 synthetic-port seam，验证 `rewrite -> qwen -> final_response` 的三槽调度、usage/wire 账本、首错 breaker、
abort/no-retry 与 package/source 边界。

这里的“第一方 adapter”只表示 adapter contract、slot/provider/model 映射和审计形状；实际 responder 是有界的
synthetic function，不是 DeepSeek/Qwen 请求。S1 不读取仓库根 `.env`、不读取真实 credential、不访问网络、不调用
Provider，不创建正式 marker/journal/report/artifact/recovery claim，不写 Trace、BackgroundJob、Outbox 或业务表，
不启动 Docker/API/browser，也不合并 `main`。

旧 T3、R5、Task 9C 和 V2 D0/C1/C2 的 sealed bytes、marker、journal、artifact、SHA、授权与一次性名额保持只读。
S1 不是 retry、resume、replay、backfill、seal 或 recovery。

## 2. 实现落点与边界

### 2.1 独立身份和 source admission

- 新增 S1 version/source version、authority、gate、factory version、固定 run id 和三 adapter descriptor。
- S1 source admission 绑定 branch、HEAD、upstream、origin remote、approved source commit、clean tree、formal
  artifact count 和 source bundle SHA；任一 parity/lineage/file fence 失败都返回
  `source_admission_invalid`。
- synthetic test admission 使用全零 commit 和全零 bundle SHA，仅用于 zero-provider fixture；它不能伪装成
  `git_verified` source。
- admission capability 由 module-private `WeakMap` 签发、`WeakSet` 单次消费；伪造、跨 authority、复用均拒绝。

### 2.2 Reviewed Mock adapter

三个 adapter 均通过 `runPhase698TransportReentryV2C2Synthetic()` 的同一个 C2 runner：

| slot             | adapter                                         | provider/model metadata      | synthetic usage         |
| ---------------- | ----------------------------------------------- | ---------------------------- | ----------------------- |
| `rewrite`        | `deepseek_rewrite_first_party_synthetic`        | DeepSeek / `deepseek-v4-pro` | `96 + 24 = 120` tokens  |
| `qwen`           | `qwen_embedding_first_party_synthetic`          | Qwen / `text-embedding-v4`   | `128 + 0 = 128` tokens  |
| `final_response` | `deepseek_final_response_first_party_synthetic` | DeepSeek / `deepseek-v4-pro` | `256 + 96 = 352` tokens |

每个 audit 只保留 slot、adapterId、provider、modelRef、固定 mode/shape、dispatch/response/verifiedUsage 计数和
`rawDataRetained=false/oracleRead=false`。不保留输入正文、模型原文、prompt、credential 或 raw error。

### 2.3 Runner、fault 和持久化边界

- 三槽顺序固定；success 路径为 `3/3/3/3`（reservation/dispatch/return/verified result）和
  `3/3/3/3`（provider execution/dispatch/response/verified usage）。synthetic port calls 为 `3`，但正式
  `providerCalls=0`。
- 总 token accounting 为 input/output/total=`480/120/600`。`syntheticEstimateCny=0.024096` 是固定的三槽最坏
  cap 估算，不是 Provider 计费；`verifiedProviderCostCny=null`。
- fault matrix 只在隔离临时目录执行：`timeout`、`transport`、`schema`、`usage` 首错均打开 breaker，后缀不 dispatch；
  `abort_before_qwen` 在 qwen 前收口，只有 rewrite audit 留存。所有 case 的 bundle validator 均为 `true`，均无
  Provider call。
- S1 复用 C2 的 reservation、hash-chain journal、hard-link artifact、strict validator 和 crash-only recovery
  contract，但正式仓库 evidence 计数保持 `0`；临时目录在每个 case 后精确清理。

## 3. 验收命令与结果

```text
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1.test.ts \
  packages/agent/tests/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.test.ts
  21 pass / 0 fail / 133 expect()

bun --filter @repo/agent typecheck
  passed

bun --filter @repo/agent lint
  passed

bunx prettier --check <S1/C2 changed files>
  passed

git diff --check
  passed

bun --filter @repo/agent test
  1393 pass / 0 fail / 24008 expect() / 173 files
```

S1 package CLI 在工作区尚未提交时按设计得到 `sourceAdmission={ok:false, reasonCode=source_admission_invalid}`，
因为 dirty-tree 必须 fail-closed；它仍完成 zero-provider reviewed Mock 输出并保持所有正式计数为零。提交并推送后，
必须在 clean source 上再次运行同一 CLI，确认 branch/HEAD/upstream/origin parity 后才算完成 source admission 回放。

### 3.1 Reviewed Mock checkpoint

```text
authority = zero_provider_transport_reentry_v2_s1
gate = transport_reentry_v2_s1_mock_quality_not_evidence
qualityAuthority = none
providerCalls = 0
credentialReads = 0
formalEvidence = 0
wire = 3/3/3/3 + 3/3/3/3
usage = 480 input / 120 output / 600 total
verifiedProviderCostCny = null
syntheticEstimateCny = 0.024096
```

固定 identity：

```text
factorySha256 = sha256:c50b257dd79cd0f9a36f6f93a375ac19deda8b1e9d15ef9cc0d845ad5f64cc20
reportSha256  = 8538b13ca16e8c011f00fcec815ca10de60638cd3ddc7e543edeb2d49b96c068
runId         = 00000000-0000-4000-8000-000000000101
```

## 4. 复审记录

主代理对 source admission、capability 单次消费、C2 seam、ports 类型、wire 字面量、credential/provider 禁止
依赖和 package export 做了静态复核，并在修正类型边界后重跑了上述验证。

本轮按计划尝试启动三路只读子代理（contract、security、operations），但服务端连续返回 `429 Too Many Requests`
并超过重试上限，未产生有效审查结果。因此本验收**不声称**子代理独立复审通过；429 只是工具可用性事实，不能被
写成代码质量结论。

## 5. Authority 与下一停止门

S1 gate 只证明 synthetic adapter contract、runner durability、wire/usage accounting 和 zero-provider 安全边界
自洽。它不证明：

- DeepSeek/Qwen transport health、真实模型输出或语义质量；
- Retriever/FinalResponse 的 P95、SLA、verified Provider cost 或大样本质量；
- `/api/chat`、Docker/API/browser、Trace、BackgroundJob、Outbox、业务数据或 `main` 可用；
- Phase 6.9.8 Task 10/11、Phase 6.10、Phase 8/9 或博客收尾已完成。

S1 完成后停止在唯一 V2 L1 授权门。只有用户同时重新接受当次 DeepSeek/Qwen 数据边界并给出以下两条 exact
authorization，才可讨论一次最多三槽的 controlled canary：

```text
I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_DEEPSEEK_AND_QWEN_DATA_BOUNDARY
I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_CONTROLLED_CANARY_ONCE
```

普通“继续”“好的”不替代上述授权。L1 即使 transport 全部成功，也只形成 transport evidence authority，不能
直接进入产品验收或 `main`。

## 6. 回顾问题

1. 为什么 synthetic port call 必须与正式 Provider call 分开计数？
2. 为什么 dirty-tree source admission 必须在 CLI 中 fail-closed？
3. 为什么 reviewed Mock 的 `qualityAuthority` 仍是 `none`？
4. 为什么三个 adapter 全部成功仍不能证明 `/api/chat` 的真实回答质量？
5. 子代理返回 429 时，文档为什么必须区分“未完成复审”和“复审失败”？
