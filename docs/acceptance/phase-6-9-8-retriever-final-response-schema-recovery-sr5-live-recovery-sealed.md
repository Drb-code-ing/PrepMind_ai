# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR5 Live recovery seal

## 1. 结论

2026-08-12，用户重新接受绑定 v2 source/tag 的 DeepSeek 与 Qwen 数据边界，并授权执行唯一一次 SR5
controlled-Live。该名额已被 run `9eb57600-97e2-4513-8654-8686b38e856e` 消费。

运行没有到达任何 Provider dispatch。正式入口在 source、proxy、credential 和 reservation 前门通过后，于 runner
开始前异常退出；随后只执行 crash-only recovery，并形成不可变终态：

- authority：`controlled_live_retriever_final_response_schema_recovery_sr5`；
- gate：`schema_recovery_sr5_branch_quality_gate_failed / passed=false`；
- qualityAuthority：`none`；
- completion/publication：`recovery / recovery`；
- credential reads：`3`；
- transport invocations / external Provider calls：`0 / 0`；
- DeepSeek / Qwen calls：`0 / 0`；
- BackgroundJob / Outbox / business writes：`0 / 0 / 0`；
- validator：`ok=true`，journal `49` 条，最终事件 `evidence_published`。

这不是 DeepSeek、Qwen、代理、账号、余额、模型权限、schema 或语义质量失败证据。它只证明当前 production
composition 在 reservation 后、runtime 前存在自拒绝缺陷，并且 durability/recovery 合同成功将不完整运行封存。
本 run 禁止 retry、resume、replay、backfill、再次 seal/recovery、curl、单 case或产品 API 追加 Provider 探测。

## 2. Source 与授权绑定

唯一运行绑定以下不可变 source：

- branch：`drb/phase-6-9-8-sr5-proxy-port-recovery`；
- source/main commit：`55b4ed2aedf9e19c01614a1fa921558c80090884`；
- annotated tag：`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v2-approved`；
- tag object：`47a9438fe78a8c023e6be51204f4898ddaab9ef0`；
- peeled commit：`55b4ed2aedf9e19c01614a1fa921558c80090884`；
- source manifest：`sha256:61afe007f588c62833a10d6c66934bcd90bd3061f4005d1b66e943088afa2829`；
- source bundle：`sha256:9cae94273d3630cc5d85d18fb8cbf6cfd46160870b8c973fd3ea6e1e76cbe6d5`；
- Live manifest：`372abb4656885536a080cccc98226d41bce083a0fafc6ab54b104eed81df67a4`；
- Live policy：`e979f30c6979e1e4ff17a439f77820ff4ded5882189d58ba753fa02b9e6f74b1`。

运行前确认工作树 clean，当前分支、upstream、远程功能分支、`main`、`origin/main` 和 tag peeled commit
全部指向同一提交。proxy preflight 通过；随后 CLI 只在授权子进程内选择性读取三项模块 credential。credential、
prompt、Provider 原文和 raw error 均未进入安全输出或正式证据。

## 3. 唯一运行与封存过程

正式入口的安全聚合输出为：

```text
ok=false
code=live_runtime_or_evidence_io
providerCalls=0
credentialReads=3
businessWrites=0
formalEvidence=1
reservationConsumed=true
reservationRunId=9eb57600-97e2-4513-8654-8686b38e856e
crashOnlySealRequired=true
```

第一次调用 recovery package script 时误把脚本已内置的 recover 参数再次作为附加 argv 传入，入口在 argv
前门以 `cli_argument_invalid` 拒绝，且 `providerCalls=0 / credentialReads=0 / formalEvidence=0`；它没有读取、修改或
封存运行证据。随后使用正确的无附加参数 recovery script 完成同一个 crash-only seal。这不是第二次 Live，也不是
retry/resume/replay。

正式封存结果：

- marker SHA：`2f9066a3b717691eeb224376e6f8f1a11dcdd15e4cc78280e4a322b82b42f9be`；
- recovery claim SHA：`cde052edc1b2ef91c88ca0b816aee76f811717f7fa23a8861e9a8827ddb4d5a1`；
- terminal sequence/hash：`47 / 9ef60541797777ae905abab2bf286b4f64f87f5a802b22659f9e66cb05afea6f`；
- report logical SHA：`5912a56336e2ac24e73a361c6452dcb473c53d8c7fbff36065848aaf22fe087d`；
- physical artifact SHA：`a4ccb5063608d2f81cb0c7b9092b4e3610c7ea3bfee817daaec4b5a9c88bb98b`；
- publication：sequence `48=publication_started`，`49=evidence_published`。

只读 validator 命令：

```powershell
bun --filter @repo/agent eval:phase-6-9-8:schema-recovery:sr5:live:validate
```

validator 返回 `ok=true`。这表示 marker、hash-chain journal、recovery claim、report 和 hard-link publication 的
结构与哈希一致，不表示质量门通过。

## 4. 已定位根因

正式 journal 在 sequence `1=attempt_reserved` 后没有任何 guard、call 或 wire runtime 事件。recovery 才从 sequence
`2=recovery_claimed` 开始，为固定分母生成 `recovery_interrupted` 终态。因此异常边界严格位于 reservation 与第一个
guard 之间。

源码调用链给出可复现根因：

1. admission 在 formal namespace 为空时签发两项 opaque capability；
2. `reserve()` 消费 reservation capability，并创建本轮正式 marker；
3. runner 随后消费 admission capability；
4. `consumePhase698RetrieverSchemaRecoverySr5LiveAdmissionCapability()` 再调用
   `assertLiveSourceStillMatches()`；
5. 该函数复用完整的 `inspectPhase698RetrieverSchemaRecoverySr5LiveSourceAdmission()`；
6. 完整检查仍要求 `formalEvidencePaths.length === 0`，于是把本 run 刚创建的 marker 当作 source drift 拒绝。

因此缺陷是 reservation 后 source revalidation 没有区分“当前已绑定 run 的合法 marker”和“预先存在或外部创建的
formal evidence”。现有 zero-provider 测试分别覆盖 admission、reservation、runner 和 synthetic durability，却没有
覆盖 production 顺序 `admit -> reserve creates marker -> consume admission -> first guard`，所以未在 Live 前暴露。

## 5. 固定分母与不可用指标

recovery 保留固定 `8 guards + 6 rewrite pairs + 6 FinalResponse` 和 `24` Provider slots，但没有把未执行项伪装为成功：

| 项目 | 封存值 |
| --- | --- |
| guards | `0` pass，`8` zero-call，全部 `recovery_interrupted` |
| Provider | DeepSeek `0/12`，Qwen `0/12` |
| rewrite strict | `0/6` |
| FinalResponse strict | `0/6` |
| semantic / P95 | 全部 `null` |
| verified usage / cost | 全部 `null` |
| concurrency / retry | `1 / false` |

`schema_recovery_sr5_branch_quality_gate_failed` 是完整分母在 recovery 模式下的 fail-closed 结果，不能写成模型质量
测评失败。因为没有任何 Provider dispatch，也不能形成 transport health、semantic、P95、SLA 或账单 authority。

## 6. 产品与后续边界

本轮没有启动 Docker、API、worker、web 或浏览器，没有创建产品账号、Trace、ChatMessage、BackgroundJob、Outbox、
PostgreSQL/Redis/MinIO 业务数据，也没有清空或重建任何 Docker 资源。因此不能宣称 `/api/chat`、Retriever rewrite、
FinalResponse、Trace、usage/cost、权限隔离或前端体验可用。

原计划的 SR6 产品验收仍被阻断。下一步只能从最新 `main` 新开独立 zero-provider architecture recovery：

1. 冻结 reservation 后 source revalidation 的 run-bound contract；
2. 增加 production-shaped 顺序回归，证明合法 self-marker 可继续、陌生/额外 marker 仍 fail-closed；
3. 保持本 run 的 tag、marker、journal、claim、report 和 artifact 不可变；
4. 不把修复称为本次 run 的 retry，也不再为当前 lineage 请求授权；
5. 新 recovery 是否需要新的 controlled-Live，必须在新 source、独立 lineage、独立 tag、完整 zero-provider 验收后另行决策。

只有未来独立语义门真实通过，才可另行制定 Phase 6.9.8 专属 SR6 Docker/API/Trace/可见浏览器验收合同。

回顾时可以问：

- 为什么 validator `ok=true` 与 quality gate failure 可以同时成立？
- 为什么 `credentialReads=3` 但 Provider calls 仍为 0？
- reservation 后的 self-marker 为什么不能继续使用 admission 前的 namespace=0 规则？
- 如何允许当前 run marker，同时拒绝陌生 marker、多个 marker 和 source/tag drift？
- 为什么本次结果不能归因 DeepSeek、Qwen、代理或账号？
- 为什么不能直接进入 Docker/API/可见浏览器产品验收？
