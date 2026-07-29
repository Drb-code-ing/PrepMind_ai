# Phase 6.9.7 Tutor / WrongQuestionOrganizer V9 Controlled-Live 失败封存

日期：2026-07-30

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

运行 ID：`c530ca02-3ece-4f11-898c-5695c8252bd5`

终态：`quality_gate_failed`

## 1. 结论

用户在本次运行前已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权唯一一次 **Phase 6.9.7
Tutor/Organizer V9 branch controlled-Live**。该授权已经消费，marker、journal 与 evidence 已由正常运行路径
durable seal；V9 bundle validator 返回 `ok=true / filesChecked=1`，不存在 recovery claim。

本次运行不是质量通过。24 条 guard 全部保持 Provider zero-call；第一个 runtime pair 的两条 lane 都完成了
一次真实 dispatch，但没有收到任何 Provider response。Tutor 固定分类为
`executed_failure / fallback_runtime_error / provider_runtime / transport`；同 pair Organizer 已 dispatch，随后
按 sibling failure 收口为 `attempted_aborted / fallback_aborted / post_dispatch_abort`。Runner 打开
`quality_gate_impossible` breaker，后续 46 条 runtime 未启动；最终 wire 为 `2/2/0/0`，strict runtime 为
`0/48`，正式 semantic、P95、token 与 CNY aggregate 全部为 `null`。

V9 不得 retry、resume、replay、backfill、额外 Provider/curl/单 case/产品 API 探测，也不得再次执行
`v9:live`、运行 seal/recovery、删除、覆盖、改写或拼接本次 artifact。R6 产品 Docker/API/可见浏览器、
R7/main、Phase 6.9.8、Phase 6.10、Phase 8/9 与博客收尾均被阻断。

## 2. 授权与运行前门

正式运行前完成以下检查：

- branch、local HEAD、tracking ref 与 GitHub remote 均为
  `ce308da643bfb0b9c150f0612f0c5aa926442687`；
- 工作树 clean，V9 marker/journal/evidence/recovery artifact 数量为 `0`；
- Phase 6.9.6 validator 为 `ok=true / evidenceCount=4`；
- Phase 6.9.7 V1--V8 八份 canonical sealed evidence validator 均为
  `ok=true / filesChecked=1`；
- V9 focused 为 `12/12`，V9 full 为 `68/68`（`2516` assertions），Agent full 为
  `975/975`（`16318` assertions），AI full 为 `226/226`（`1459` assertions）；Agent/AI
  typecheck 与 lint、Prettier、`git diff --check` 均通过；
- R5 Live factory/CLI 与测试补强经独立复审为 `APPROVED`，无 Critical/Important/Minor。

正式命令只在一个隔离 Bun 子进程中自动加载根 `.env`，把 `DEEPSEEK_API_KEY` 仅映射为 Tutor 与
WrongQuestionOrganizer 两个 component credential，并显式构造固定 Live allowlist：

- provider/model：DeepSeek / `deepseek-v4-pro`；
- endpoint：`https://api.deepseek.com/v1`；
- non-thinking、JSON object、no tools、no retry；
- Tutor：`1/1200/300`、`3500ms`；
- Organizer：`1/3500/800`、`5000ms`；
- 其它 Agent gate 未注入；总 Live cap 继续为 `0.55 CNY`。

密钥值没有写入命令、stdout、evidence、journal 或文档，根 `.env` 没有修改。没有启动产品 Docker、API、
浏览器或业务写链路，也没有删除、重建、prune 或清理任何 Docker 容器、镜像或卷。

## 3. 固定结果

| 项目                                         | 结果                                     |
| -------------------------------------------- | ---------------------------------------- |
| cases / guard / runtime / pairs / decisions  | `72 / 24 / 48 / 24 / 32`                 |
| guard                                        | `24/24` verified zero-call               |
| dispatched / completed pairs                 | `1 / 1`                                  |
| runtime reserved / terminal / orphaned       | `2 / 2 / 0`                              |
| runtime not started                          | `46`                                     |
| executor / dispatch / response / usage       | `2 / 2 / 0 / 0`                          |
| strict runtime                               | `0/48`                                   |
| breaker                                      | `quality_gate_impossible`                |
| trigger                                      | `tutor-v2-runtime-01` / Tutor / pair `0` |
| critical / provider / permission             | `0 / 1 / 0`                              |
| mutation / broader fallback                  | `0 / 0`                                  |
| Tutor / Organizer / combined semantic        | `null / null / null`                     |
| Tutor / Organizer / pair / orchestration P95 | `null / null / null / null`              |
| verified input / output / estimated CNY      | `null / null / null`                     |
| final gate                                   | `quality_gate_failed`                    |

这里的 `providerDispatches=2` 证明两条 lane 各越过一次 durable dispatch 边界，不等于收到两条响应、产生
两次可计费 usage 或完成两条模型决策。`providerResponses=0`、`verifiedUsages=0` 时，费用只能是 `null`，不能
写成 `0 CNY`。

## 4. 第一个 Pair 的两条 Lane

### 4.1 Tutor

- case：`tutor-v2-runtime-01`；
- execution：`executed_failure`；
- candidate：`fallback_runtime_error`；
- failure：`provider_runtime`；provider failure：`transport`；
- wire：`executor_entered -> request_validated -> provider_dispatch_started`；
- wire counters：`1/1/0/0`；
- usage：`unknown_after_attempt / null`；
- 没有 schema stage、model-owned decision 或 bounded schema diagnostic。

该有界证据只确认第一方 fetch 在 response 前以 transport failure 结束，不能进一步断言是 DNS、TLS、代理、
账号、余额、模型权限或 Provider 服务端故障。一次性运行结束后禁止用额外网络探测补充未持久化的外部根因。

### 4.2 WrongQuestionOrganizer

- case：`organizer-v2-runtime-01`；
- execution：`attempted_aborted`；
- candidate：`fallback_aborted`；
- failure：`post_dispatch_abort`；
- wire：`executor_entered -> request_validated -> provider_dispatch_started`；
- wire counters：`1/1/0/0`；
- usage：`unknown_after_attempt / null`；
- 没有复制 Tutor 的 `transport` provider category，也没有伪造 V9 option diagnostic。

这证明 pair 内 sibling abort 归属按 lane 隔离。它不证明 Organizer 自己发生独立 transport failure，也不证明
V9 option selection、V6 validator/merger 或本地 dynamic authority 在真实 response 上成功或失败。

## 5. 为什么正式聚合全部为 Null

V9 冻结 48 条 runtime 固定分母。首个 runtime contract failure 收口当前 pair 后打开 breaker，后续 46 条
保持 `not_started_quality_breaker`，不能缩小分母、补跑或把 R4 Mock 结果拼入 Live。只要 runtime/wire/usage/
latency 任一不完整，semantic、四项 P95、token 与费用 aggregate 就必须全部为 `null`。

因此本次 `0/48` strict 不是“只测了两条所以按两条算”，而是按完整 48 条分母得出的正式失败终态。R4 Mock
的 `48/48` 与 semantic `1/1/1` 继续只属于 `mock_quality_not_evidence`，不能覆盖本次 Live。

## 6. Durability 与不可变证据

| Artifact | 路径 / SHA-256                                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| marker   | `.tmp/phase-6-9-7-tutor-organizer-v9-controlled-live.marker` / `8eda89cffda6436c778e0068016870886a5b9dce18c346842be33753974c123b`                                             |
| journal  | `.tmp/phase-6-9-7-tutor-organizer-v9-controlled-live-c530ca02-3ece-4f11-898c-5695c8252bd5.journal.jsonl` / `8fccbc26160c568e46061843491f8009d7bb054666a98f8900a43009382be376` |
| evidence | `.tmp/phase-6-9-7-tutor-organizer-v9-branch-live-c530ca02-3ece-4f11-898c-5695c8252bd5.json` / `6b296660e1467fbb96ffda359a9a0cd6ff6a02bc60ed48e4d69ae03dbc5ce9ac`              |

Evidence durability 绑定 marker SHA、seal 前 journal sequence `37` 与 tail SHA
`fc7edf6ac39639d1340db54f1c9e8c232be26302989938e944554b978f654db9`。物理 journal 最后一条是
sequence `38` 的 `evidence_sealed(completed_run)`，绑定上述 evidence SHA；这就是 journal 文件物理 SHA 与
evidence 内 seal 前 tail SHA 不同的原因。

V9 bundle validator 返回：

```json
{ "ok": true, "filesChecked": 1 }
```

不存在 recovery claim，正常完成路径不需要也不允许再次运行 seal/recovery。

## 7. 当前工程边界

V9 R0--R4 的本地合法 option authority、exact `{questionIndex,optionIndex}` contract、V6 validator/merger、
三阶段 stale/write fence、runner、wire 与 durability 工程能力继续成立；R5 也证明了正式 first-party adapter
能够进入 durable dispatch 边界。由于没有任何 Provider response，本次没有验证真实模型能否完成 Tutor
intent selection 或 Organizer option selection，更没有验证产品 Chat、single/batch Organizer、Trace、写命令、
Docker API 或可见页面。

允许的后续工作仅限读取、校验、文档化和独立审查本次已封存事实；不得通过新 V10、重置 marker 或换脚本
绕过本次终态。若未来要改变产品路线，必须作为新的用户决策与独立阶段重新规划，不能声称 V9 已通过。

## 8. 回顾时可以问

- “为什么 `2/2/0/0` 说明 dispatch 发生了，却不能证明模型响应或费用？”
- “Tutor transport failure 为什么会让 Organizer 记录本地 sibling abort，而不是复制 transport？”
- “为什么一次 transport failure 会使 48 条 semantic/P95/token/CNY 全为 null？”
- “V9 R4 Mock 满分与 R5 Live 失败分别证明了什么，不能证明什么？”
- “marker、journal、evidence 与 seal 前 journal tail 四个 SHA 分别保护什么？”
