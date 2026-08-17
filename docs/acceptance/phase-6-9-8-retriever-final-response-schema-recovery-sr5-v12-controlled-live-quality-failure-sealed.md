# Phase 6.9.8 SR5 V12 controlled-Live 质量失败封存

日期：2026-08-17  
Run：`49429392-857d-4635-80cc-0bca317cf9ff`  
终态：`schema_recovery_sr5_branch_quality_gate_failed`  
质量权威：`qualityAuthority=none`

## Source 与授权

- branch/head/upstream/origin：`main == 550bc864b983992b77cd73157e5513515177dff4`
- approved tag：`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v12-approved`
- tag object：`62d5d2d607b5827d679e4c4351603fd2bd2608ec`
- source manifest：`sha256:a5f0b336430fdce056f26db3a5c8d929fd723a386b1b51ded7f4f90e71d2031f`
- source bundle：`sha256:d1ff73db69e41e743330c3b1fe7f22a1401a808bc421e05bda915e0bac91d381`
- 用户已接受 V12 DeepSeek/Qwen 当前账号数据边界，并给出绑定 V12 source 的唯一 exact authorization。

入口在 fresh exact argv、authorization、source/tag parity、direct-host proxy preflight、credential projection 和 reservation
之后运行。V11 tag、授权与零证据终态未复用。

## 执行结果

- `8/8` guard 通过且保持 zero-call，guard safety failure=`0`。
- credential reads=`3`；transport/external Provider calls=`5/5`；DeepSeek/Qwen calls=`2/3`。
- maximum concurrency=`1`；retry/resume/replay/backfill/backgroundJob/outbox 全为 `false`；business writes=`0`。
- `rewrite_01`：original Qwen retrieval 成功（`123/0` tokens，`0.0000615 CNY`）；DeepSeek candidate 成功
  （`178/23` tokens，`0.000672 CNY`）；candidate Qwen retrieval 成功（`136/0` tokens，`0.000068 CNY`）。
- `rewrite_02`：original Qwen retrieval 成功（`108/0` tokens，`0.000054 CNY`）；DeepSeek candidate 失败；其 candidate
  retrieval 及后续 `19` 个 Provider 槽均为 `not_started_quality_breaker`。
- 失败槽没有 verified usage/cost，因此正式 aggregate input/output/cost 均为 `null`；不得用成功槽手工拼接正式账单权威。

## 失败边界

`rewrite_02.rewrite_candidate_model` 的 durable wire 为 attempts/dispatches/responses/verifiedUsage=`1/1/1/0`，终态为：

```text
failureReason=runtime_contract_invalid
adapterFailureCategory=unknown
structuredOutputStage=null
```

这证明 HTTP response 已到达，不是 proxy、连接失败、HTTP 无响应或 pre-response schema stage。随后
`projectPhase698Task9RewriteFailureForTest` 的 `baseInvalid` 将多种 Task9 合同失败在 adapter category=`null` 时统一投影为
`runtime_contract_invalid/unknown`，包括：candidate 未应用、provenance/attempted/trace mismatch、V7 state/counter mismatch、
invocation mismatch。若属于 candidate 未应用，其内部还可能是完整字段安全扫描、rewrite unchanged 或 protected-terms drift。

V12 report/journal 未保留上述具体 bounded reason。封存证据能确认的边界仅为“response 已观察，Task9 typed result/usage 尚未
验证”；不能从中选择某个 `baseInvalid` 条件，不能称为 DeepSeek schema、usage validation 或网络失败，也不能宣称具体模型输出内容。

## Evidence 完整性

- completion/publication mode=`runtime/runtime`，publication strategy=`exclusive_temp_hard_link`。
- journal records=`67`，terminal sequence=`65`，最终事件=`evidence_published`。
- validator：`ok=true`。
- marker SHA=`e2932e63161eb228db189f5536543d39f81ba7049d03c4962a06c2f6b9b0e6db`。
- terminal record hash=`1e21194e10ecf11f1eb16292fd2c3ee1926744aea4a3561abd651165f5c69458`。
- report logical SHA=`86f4e84e1859d9c77fc3a050095f5123f16cee9a61da60cc19d79b55e2323654`。
- physical artifact SHA=`817bc89708813982fdfc258126607f2930f42a6aae0fef81584c35548dd9be81`。
- recovery claim=`null`；不需要也不允许再次 seal/recover。

## 边界与下一步

唯一 V12 authorization 已消费。禁止 retry/resume/replay/backfill、移动 tag、删除/移动/格式化/改写 marker、journal、report，
以及 curl、单 case、产品 API 或其他入口的追加 Provider 探测。本轮没有启动 Docker/API/browser，没有写 Trace、BackgroundJob、
Outbox 或业务数据，不形成 Retriever/FinalResponse semantic、SR6、产品可用、P95/SLA 或 `main` 产品 authority。

下一任务只能从最新 `main` 新开普通分支进行 zero-provider postmortem：先将 `baseInvalid` 拆成 candidate-not-applied、trace、V7
state/wire 与 invocation 等固定 enum，再为 candidate-local rejection 增加不含 Provider 原文的 bounded reason；补
synthetic/held-out/metamorphic 回归，并保持 V12 evidence 只读。源码变化后如需新的真实质量门，必须建立新 lineage、
annotated tag、数据边界与 exact authorization，不能复用 V12。

回顾时可以问：为什么 `response_received` 不能等同于 candidate applied？为什么 adapter category 为 `null` 时不能直接归因 schema？
下一版怎样在不保存模型原文的情况下先定位 `baseInvalid`，再区分 safety、unchanged 与 protected-term drift？
