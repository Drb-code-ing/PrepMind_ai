# Phase 6.9.7 Tutor / WrongQuestionOrganizer V2 Controlled-Live 失败封存

日期：2026-07-24

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

执行起点：`8a3073f0c00c8385e80a9d5547e85fa34b8d84ae`

状态：唯一 V2 branch controlled-Live 已执行并以 `quality_gate_failed` 封存。V2 一次性授权和
marker 已消费，不得删除 marker、覆盖 evidence、重跑 V2 或把本次失败改写为产品可用。R8
Docker/API/headed-browser 产品验收没有启动，Phase 6.9.7 仍未完成。

## 1. 授权与不可变身份

用户授权原文：

> 我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7 Tutor/Organizer V2 branch controlled-Live。

本次只允许一个 branch scope 的 72-case V2 run；无论成功、网络失败还是质量失败，marker 与
evidence 都必须封存。固定身份如下：

- runner：`phase-6.9.7-tutor-organizer-runner-v2`；
- dataset：`phase-6.9-tutor-wrong-question-v1`；
- dataset SHA-256：`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`；
- Tutor prompt：`tutor-model-candidate-v2`；
- Organizer prompt：`wrong-question-organizer-model-candidate-v2`；
- schema：`tutor-model-decision-v1` / `wrong-question-organizer-model-decision-v1`；
- model：`deepseek-v4-pro` non-thinking JSON；
- executor provenance：`deepseek_network`。

## 2. Zero-network preflight

Live 前完成并通过：

- 当前分支正确，HEAD 为 `8a3073f0`，Git 工作区干净；
- V1 evidence / marker SHA-256 仍分别为
  `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
  `7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`；
- V2 marker/evidence 均不存在；
- V1 validator `ok=true/filesChecked=1`；
- V2 marker/evidence 并发与故障 hardening suite `8/8`、`48 expect()`；
- tracked Tutor/Organizer gates 为 `false`，component credential 默认空；
- 根 `.env` 只检测凭据是否存在，不输出值；同一底层 secret 只在本次子进程中映射为两个
  component-specific 变量，根 `.env` 未修改；
- 其它 Router、Verifier、Review、Planner、Knowledge Agent gate 在 Live 子进程中显式为
  `false`；未启动、停止、重建或清理 Docker 服务。

## 3. 唯一 V2 Live 结果

- run ID：`67ce18dd-e2ed-4a05-8507-2a98898b8ede`；
- evidence：
  `.tmp/phase-6-9-7-tutor-organizer-v2-branch-live-67ce18dd-e2ed-4a05-8507-2a98898b8ede.json`；
- evidence SHA-256：`0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77`；
- marker：`.tmp/phase-6-9-7-tutor-organizer-v2-controlled-live.marker`；
- marker SHA-256：`ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504`；
- V2 validator：`ok=true/filesChecked=1`；
- marker `state=attempt_reserved` 只证明一次性名额已消费，不证明质量通过。

| 固定门 | 要求 | 实际 | 结论 |
| --- | --- | --- | --- |
| cases | `72` | `72` | 通过 |
| verified zero-call | `24/24` | `24/24` | 通过 |
| strict runtime | `48/48` | `0/48` | 失败 |
| Tutor semantic | `>= 0.85` | `0` | 失败 |
| Tutor 相对 baseline 提升 | `>= 0.15` | `-0.4418666667` | 失败 |
| Organizer semantic | `>= 0.85` | `0` | 失败 |
| Organizer 相对 baseline 提升 | `>= 0.15` | `-0.278125` | 失败 |
| critical failures | `0` | `1` | 失败 |
| permission / mutation / broader fallback | 全部 `0` | 全部 `0` | 通过 |
| Tutor P95 | `<= 2500ms` | `3ms` | 数值通过，但 runtime 全失败，不能解释为成功延迟 |
| Organizer P95 | `<= 4500ms` | `3ms` | 数值通过，但 runtime 全失败，不能解释为成功延迟 |
| paired candidate P95 | `<= 4500ms` | `4.2626ms` | 数值通过，但 runtime 全失败 |
| Tutor orchestration P95 | `<= 6500ms` | `3.9499ms` | 数值通过，但 runtime 全失败 |
| verified usage | `48` | `0` | 失败 |
| known pricing / CNY | 必须可验证 | `false` / `null` | 失败 |
| 最终 gate | `quality_gate_passed` | `quality_gate_failed` | 失败 |

48 个 runtime 中 Tutor / Organizer 各 24 个，全部为：

- `runtimeInvocations=1`；
- `rawSchemaValid=false`；
- `candidateDisposition=fallback_runtime_error`；
- `canonicalValidationStage=null`；
- `canonicalFailureReason=null`；
- `usage=null`。

唯一 critical case 是 `organizer-runtime-23`；它仍走本地 fallback，没有权限、业务 mutation 或
比 deterministic 更宽的写入。全部 24 个 guard case 仍在 Provider 前完成真实 zero-call。

## 4. 可以确认与不能推断的失败边界

可以确认：

1. V2 CLI、runner identity、filename、敏感字段和不可变 evidence 合同有效，V2 validator 通过；
2. 两条 executor 都进入了各自 24 次 runtime 调用，但没有形成任何可验证 usage；
3. 48 个失败都发生在结构化对象形成前，canonical validator / local merger 没有开始；
4. deterministic fallback、权限与 mutation 安全边界保持成立；
5. 固定质量门失败，因此不能进入产品验收或宣称 Tutor/Organizer 真实模型路径可用。

不能确认：

- Provider 是否实际接收、保留或计费了请求；供应商账单仍是费用 authority；
- 具体失败是 credential、代理/TLS/网络、endpoint/model compatibility、请求适配还是其它运行时原因；
- prompt 或 canonical policy 的真实语义质量。

证据按安全设计不保存 API key、原始异常、Provider response、完整 prompt 或模型原文；V2 的
bounded `stage/reason` 只覆盖已经形成结构化对象后的 canonical 阶段。因此本次不能用毫秒级失败
或 `fallback_runtime_error` 武断指定单一根因，也不能以一次额外调用“诊断”后重跑 V2。

## 5. 并发、任务丢失与路由边界

R6 已在 Live 前固定下列生产边界，本次失败不改变这些结论：

- marker 使用 `wx`，并发竞争只有一个 winner；普通 marker、目录和 I/O 故障分开处理；
- evidence 使用随机唯一 temp + hard-link final，final 发布后 cleanup failure 不误报丢失；
- marker 后崩溃、网络失败或质量失败都永久消费该 lineage，禁止自动 retry/replay；
- Chat abort signal 贯穿 Tutor orchestration 与最终流；
- Organizer abort 不写 Trace/command，command/Trace 双失败保留 `command_pending`；
- 同题 normal/force、single/batch 最终收敛为唯一 owner-scoped 组织关系，未写题可由 batch 补偿；
- Organizer 仍是同步 API，不宣称跨多实例 Provider exactly-once。

这些边界能避免重复发布、丢失已提交状态和跨路由重复写，但不能把失败的 Provider 调用变成成功
质量证据。

## 6. 停止、回滚与下一步

- 不重跑 V2，不删除/改写 V1 或 V2 marker/evidence；
- 不启动 R8 Docker/API/headed-browser，不创建 synthetic 产品账号/错题/Trace；
- tracked defaults 保持 mock/live=false、Tutor/Organizer gate=false、component key 为空；
- 本次进程级 Live 变量随进程退出，不写入 Git 或 `.env`；
- Docker 容器、镜像、卷、PostgreSQL、Redis 与 MinIO 均未停止、重建或清理；
- Phase 6.9.7 仍未完成，Task 13/main 合并、main 回放、远程推送与 Phase 6.10 均不得开始。

下一步只能先做零 Provider 的 V2 失败复盘，并以新的 V3 identity 设计安全的传输失败分类、
环境/请求兼容性 preflight 与新的 one-shot 授权边界；不得修改 V1/V2 history，也不得把新设计
解释为已获得下一次 Provider 授权。

回顾时可以问：

- 为什么 `deepseek_network` 只表示真实 executor 路径，不等于 Provider 已返回 usage？
- 为什么 3ms P95 在 `0/48` runtime 下不是性能通过证据？
- 为什么结构化对象形成前的失败必须保持 `stage/reason=null`？
- 为什么 marker 后网络失败也不能删除 marker 重跑？
- 为什么并发/幂等/补偿通过仍不能替代真实模型质量门？
- V3 怎样在不保存原始异常和密钥的前提下增加可诊断性？
