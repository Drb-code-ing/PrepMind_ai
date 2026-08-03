# Phase 6.9.7 Tutor / WrongQuestionOrganizer V6 R5 Controlled-Live 失败封存

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

运行前提交：`ce551cfa3e86010922dab62e269f405a7caec80f`

唯一 run：`b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8`

终态：`quality_gate_failed`

## 1. 结论

用户已接受运行当时 DeepSeek 账号的数据保留/训练边界，并明确授权唯一一次
**Phase 6.9.7 Tutor/Organizer V6 branch controlled-Live**。本次运行已执行、完成 durability seal，并由
V6 bundle validator 验证通过；一次性名额已经消费，禁止 retry、resume、replay、backfill、删除、覆盖或
改写 marker、journal 与 evidence。

24 条 guard 全部在 Provider 前验证为零调用。第一对 runtime 同时派发两个 lane 后，Tutor 在约 21ms
内得到 `provider_runtime / unknown`，Organizer sibling 随即被 abort；runner 完成当前 pair 后打开
`quality_gate_impossible` breaker，后续 46 个 runtime 没有启动。最终只有 2 次 Provider invocation，
`0/48` strict runtime，正式 semantic、P95、token 与 CNY aggregate 全部为 `null`。

因此 V6 R5 失败封存，R6 产品 Docker/API/可见浏览器、R7/main、Task 13、Phase 6.9.8、Phase 6.10、
Phase 8/9 与博客收尾不得开始。V6 R4 Mock 满分与本次局部调用不得拼接成质量通过或产品可用。

## 2. 授权与执行边界

执行前重新确认：

- 当前分支为 `codex/phase-6-9-7-tutor-wrong-question-agents`，运行前 HEAD 为 `ce551cfa...`；
- worktree clean，现有 `origin/codex/phase-6-9-7-tutor-wrong-question-agents` remote-tracking ref 与
  运行前 HEAD 相同；本地分支未配置 upstream，因此不把 `@{upstream}` 失败包装成已配置 tracking；
- V6 Live marker、journal、evidence 与 recovery claim 均为 0；
- V1--V5 evidence validators 全部 `ok=true`，历史 SHA 不变；
- 没有启动产品 Docker service、API 或浏览器，也没有创建 synthetic 用户或修改业务数据。

凭据只在同一个授权 Bun 进程内把根 `.env` 的现有底层 secret 映射为：

- `TUTOR_AGENT_DEEPSEEK_API_KEY`；
- `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`。

key 没有打印、写盘、进入命令参数、evidence、journal、文档或 Git。运行只向 CLI 传入最小环境：

- `PHASE_6_9_7_V6_CONTROLLED_LIVE_APPROVED=true`；
- `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`；
- Tutor/Organizer 两个独立 gate=true；
- 精确 `https://api.deepseek.com/v1`；
- Tutor/Organizer timeout `3500/5000ms`；
- 其它 Agent gate 不启用。

executor 固定 `deepseek-v4-pro`、`deepseek_v4_pro_nonthinking_json`、SDK retry 0；Tutor 与 Organizer
继续使用各自 `1/1200/300`、`1/3500/800` 预算。执行顺序保持：配置解析 -> marker reservation -> journal
初始化并 fsync -> 24 guard -> sequential pairs（pair 内最多双 lane）-> report/evidence seal -> bundle
validator。

## 3. 固定结果

| 项目 | 结果 |
| --- | --- |
| cases / guard / runtime | `72 / 24 / 48` |
| paired requests / Organizer decisions | `24 / 32` |
| verified guard zero-call | `24/24` |
| dispatched / completed pairs | `1 / 1` |
| max concurrent pairs / lane operations | `1 / 2` |
| Provider invocations | `2` |
| strict runtime | `0/48` |
| breaker | `quality_gate_impossible` |
| trigger | `tutor-v2-runtime-01 / tutor / pairedRunIndex=0` |
| critical / permission / mutation / broader fallback | `0 / 0 / 0 / 0` |
| Provider failures | `1` |
| semantic / P95 / token / total CNY | 全部 `null` |
| report gate | `quality_gate_failed` |

### 3.1 Tutor terminal

`tutor-v2-runtime-01`：

- `runtimeInvocations=1`；
- `executionOutcome=executed_failure`；
- `candidateDisposition=fallback_runtime_error`；
- `failureCategory=provider_runtime`；
- `providerFailureCategory=unknown`；
- `structuredOutputStage=null`；
- executor/runtime/orchestration duration 为 `21.2116 / 22 / 25.7264ms`；
- 三个 deadline 均未越界；
- `usageDisposition=unknown_after_attempt`，usage=`null`；
- dispatch 与 runtime terminal 均已持久化。

### 3.2 Organizer sibling terminal

`organizer-v2-runtime-01`：

- `runtimeInvocations=1`；
- `executionOutcome=attempted_aborted`；
- `candidateDisposition=fallback_aborted`；
- `failureCategory=post_dispatch_abort`；
- runtime/orchestration duration 为 `19 / 22.9068ms`；
- `usageDisposition=unknown_after_attempt`，usage=`null`；
- dispatch 与 runtime terminal 均已持久化。

余下 Tutor/Organizer runtime 保留在固定 48 分母中，并以 `not_started_quality_breaker` 表达；没有补跑、
重试或从 Mock/历史版本补齐。

## 4. 为什么正式聚合必须为 null

V6 质量合同要求 `48/48` strict runtime、两个 lane 各完整 24 个 latency 样本、完整 provider-reported
usage、model-owned Tutor `21/24` 与 Organizer 三轴各 `28/32`。本次首对即发生 attempted failure/abort，
因此：

- semantic report `complete=false`，三个 semantic score 都为 `null`；
- latency report `complete=false`，Tutor/Organizer/paired/Tutor-orchestration P95 都为 `null`；
- usage `complete=false`，input/output tokens 与 estimated cost 都为 `null`；
- model-owned gate 不通过，不能把未执行项或 R4 Mock 值计为正确；
- 2 次 invocation 只证明尝试边界，不能推导供应商账单、零成本或有效 token subtotal。

## 5. 失败根因的证据边界

当前能够确认：

1. Tutor 失败发生在 hard timeout 之前，不是 `3500ms` timeout，也没有 structured-output stage；
2. runtime 收到了受信 provider failure 投影中的 `unknown`，随后按合同 fail-closed；
3. Organizer 是 sibling abort，不应复制 Tutor 的 provider failure category；
4. journal 已记录两个 `dispatch_started`、两个 terminal、breaker、run completed 与 evidence sealed；
5. report/evidence 按安全设计不保留 provider 原始异常、响应正文、HTTP header、prompt 或 model output。

`unknown` 只能说明异常没有被当前固定 classifier 识别为 structured-output、invalid-response 或带安全 HTTP
status 的官方 SDK error。DeepSeek non-thinking middleware 的 request/response safety 拒绝、网络层 generic
error、Provider/SDK generic error 等路径都可能被收敛为同一 `unknown`。约 21ms 不能安全区分这些可能性，
因此本记录不把原因武断指定为 credential、HTTP 状态、网络、模型、endpoint、请求形状或 Provider 响应。

这不是“脚本没跑”：marker、双 lane dispatch、2 次 invocation、terminal、breaker 和 seal 都已产生；但
同样不能把 `deepseek_network` provenance 解释为已证明 Provider 接收并成功处理请求。任何绕开 runner 的
额外探测都会构成新的 Provider 调用和事实上的重试，故本阶段禁止执行。

## 6. Durability 与证据完整性

本地 `.tmp/` 由 `.gitignore` 忽略，artifact 不纳入 Git；文件在本机原路径保留，不清空：

- evidence：`.tmp/phase-6-9-7-tutor-organizer-v6-branch-live-b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8.json`；
- marker：`.tmp/phase-6-9-7-tutor-organizer-v6-controlled-live.marker`；
- journal：`.tmp/phase-6-9-7-tutor-organizer-v6-controlled-live-b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8.journal.jsonl`。

| Artifact | SHA-256 |
| --- | --- |
| evidence physical bytes | `beb9d460dcbe10419af06aab130c04d0410debd2123732523fb4a09ff21ea5e9` |
| marker physical bytes | `cbddba87ec6e491f4e5a5d55c886150eb557e510ff09bd60acfa2ede7c99f988` |
| journal physical bytes | `be91b0c41d9a538c4be651de52621329751852478261f230fed5e06e758c2a2f` |
| report | `e0b0b61b7e74b8a4b181334659290ded1f9f034210e382a6471087b0a5de6581` |
| sealed pre-evidence journal tail | `e93d5101e3c02e8d5d182461488f2a2effe2cb515375add95c60a6f22293f032` |

Journal 共 33 条记录（sequence `0..32`）；envelope 固定 `journalSequence=31`，最后一条 sequence 32 为
`evidence_sealed`，其 `evidenceSha256` 与 physical evidence SHA 一致。Journal physical SHA 与 embedded
tail record hash 是两个不同概念，不能互换。

marker 的 `state=attempt_reserved` 是一次性 reservation schema 的固定值，不是可变终态字段；真正终态由
envelope `disposition=completed_run`、journal `evidence_sealed` 与 bundle validator 共同证明。未发现
recovery claim。

独立 bundle 复核结果：

```json
{"ok":true}
```

## 7. 允许与禁止的后续动作

允许：

- 提交本次 R5 失败验收与当前状态文档，并推送当前功能分支；
- 继续只读复核已封存的脱敏 evidence、journal 与源码 classifier；
- 保持 tracked defaults、产品 gates 与 Live gate 关闭；
- 保留 Docker 容器、镜像、volume、PostgreSQL、Redis 与 MinIO 数据，不执行破坏性清理。

禁止：

- 再次执行 V6 Live、seal 已完成 run、修改 marker、删除/覆盖 evidence 或用 recovery 做 replay；
- 通过手工 curl、单 case、另一个 CLI 或产品 API 探测同一 Provider 路径；
- 启动 V6 R6 产品 Docker/API/可见浏览器验收；
- 合并 main、开始 Task 13、Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾；
- 把 V6 R4 Mock `1/1/1`、本次 24/24 guard 或 2 次 invocation 拼接成 Agent 已可用。

如果后续仍要推进 Tutor/Organizer 真实模型质量，必须先由新的独立任务做零 Provider 复盘和版本化设计，
明确新的 runner/approval/artifact identity 与授权边界；本 R5 记录本身不授权 V7 或任何新网络调用。

## 8. 回顾时可以问

- “为什么 21ms 的 `provider_runtime/unknown` 不能直接解释为 API key 或 Provider HTTP 错误？”
- “为什么 Organizer sibling abort 不能继承 Tutor 的 failure category？”
- “为什么 24/24 guard 通过但 strict runtime 仍是 0/48？”
- “为什么 evidence validator 通过只证明证据完整，不证明质量门通过？”
- “为什么 marker 仍是 `attempt_reserved`，run 却已经是不可重跑的 sealed terminal？”
- “为什么不能用 R4 Mock 满分或额外 curl 补全这次 Live？”
