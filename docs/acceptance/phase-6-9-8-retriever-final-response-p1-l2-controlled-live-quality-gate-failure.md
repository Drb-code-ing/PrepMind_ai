# Phase 6.9.8 Retriever / FinalResponse P1 L2 controlled-Live 质量门失败验收

## 1. 结论

Phase 6.9.8 Retriever / FinalResponse P1 L2 的唯一 controlled-Live 名额已经消费，并由正常 runtime publication
完成 durable seal。正式终态为：

- runId：`ff035203-500f-4744-b33c-3c375ae4c785`；
- lineage：`phase-6.9.8-retriever-final-response-p1-l2-v1`；
- gate：`p1_l2_quality_gate_failed / passed=false`；
- CLI code：`p1_quality_gate_failed`；
- authority：`controlled_live_retriever_final_response_p1_l2`；
- semanticGate / qualityAuthority：`none / none`；
- validator：`ok=true / bundle_valid`；
- journal：`41` 条，最终事件 `evidence_published`；
- recovery claim：`null`。

这不是 P1 语义质量通过。它只证明唯一 L2 按冻结 source、固定分母、串行调度、首错 breaker、真实 DeepSeek
adapter accounting 与 durability 合同执行，并在 `rewrite_03` 的本地 `schema` 边界失败后安全停止。它不能证明
Retriever / FinalResponse 完整真实语义质量、P95/SLA、Qwen embedding 行为、Provider/network 根因、产品
`/api/chat`、Docker/API/browser、Trace、BackgroundJob、Outbox、业务写入或 `main` 产品 authority。

本次 run 不得 retry、resume、replay、backfill、补跑、重新 seal/recovery；不得删除、格式化、移动或改写
marker/journal/report/root artifact，也不得用 curl、单 case、产品 API 或其它追加 Provider 探测补证。

## 2. Admission、source gate 修复与一次性授权

真正进入 Provider 边界的唯一 run 固定在：

- branch：`drb/phase-6-9-8-p1-l2-controlled-live`；
- `HEAD == upstream == origin branch == approved tag commit`：
  `fa50292509d7c3e2e4ad017e7e730fd434a29cde`；
- canonical tag：`phase-6.9.8-retriever-final-response-p1-l2-approved`；
- manifest SHA：`f117f6257b2d412912d0a50b322c23d74ca194ea37667a614c45549bb1ccb189`；
- policy SHA：`edaa07d1071a93336b40d68948011a21a3e96938ca7d7b862991bb2bc37537f3`；
- baseline SHA：`2c539b55be531a91a016655b8318454292b6ac286cd826d9c6e39796b5f611df`；
- S2 factory SHA：`sha256:8ad0a12ae7bd6365873631cb4908b41888617b9599fdd6865cf7e45c788f0e7d`；
- final_11 compatibility SHA：`b492487db888a2e2d89810faac8cc7b0e50c36b464fb6eb6cfa9a4bc4680a532`。

此前第一次 CLI 入口在 source gate 返回 `source_admission_invalid`。只读诊断确认 clean
`git status --porcelain` 的合法空字符串被错误当作失败。该入口发生在 credential、marker、journal、report、artifact
和 Provider 之前，因此没有消费一次性运行名额，也没有形成一次 Live attempt。修复提交 `146d2107` 加入显式
null/empty 区分与回归测试；历史诊断 tag
`phase-6.9.8-retriever-final-response-p1-l2-source-admission-preflight-failed` 继续指向
`0d255bbad4b739fe4495b8e98a825d695d44f9a8`，canonical tag 则绑定修复与文档 parity 后的 `fa502925`。

在上述 source 上，fresh DeepSeek/Qwen data-boundary acceptance 与 exact one-shot authorization 通过 gate 后，CLI 才
选择性读取根 `.env` 的模块自有 credential 并创建正式 marker。输出、journal、report 与 artifact 均不保留 raw
credential、prompt、Provider response、回答正文或 raw error。本次没有开启产品 gate，也没有启动
Docker/API/browser 或写入产品数据。

## 3. 固定分母与实际执行

固定分母保持 `8 guards + 6 rewrite + 6 FinalResponse = 20 entries / 12 candidate invocations`，没有因失败缩小：

| 项目                               | 固定分母 |                                       实际终态 |
| ---------------------------------- | -------: | ---------------------------------------------: |
| Guard                              |        8 |               `8/8` pass，全部 Provider 零调用 |
| Candidate / Provider calls         |       12 | `2 attempted / 10 not_started_quality_breaker` |
| Rewrite runtime / strict           |        6 |                                        `2 / 1` |
| FinalResponse runtime / strict     |        6 |                                        `0 / 0` |
| 全部 lane terminal                 |       12 |                                           `12` |
| Qwen embedding policy calls        |        0 |                                            `0` |
| Retry / replay / resume / backfill |        0 |                                `0 / 0 / 0 / 0` |
| BackgroundJob / Outbox             |        0 |                                        `0 / 0` |

实际前缀：

1. `rewrite_01`：`succeeded`，runtime/strict/wire/verified usage 均为 `true`，DeepSeek usage `178/26`，按冻结
   `3/6 CNY per million input/output tokens` 重算该 lane verified cost=`0.00069 CNY`；
2. `rewrite_03`：`attempted_failed / schema`，runtime/wire/verified usage 为 `true`，strict=`false`，usage
   `165/14`，lane verified cost=`null`，并打开 breaker；
3. `rewrite_05/09/12/15` 与 `final_01/07/09/11/13/15`：全部
   `not_started_quality_breaker`，没有 dispatch、response、usage 或 candidate invocation。

整轮 `candidateInvocations=2`、`providerCalls=2`、`credentialReads=2`、`qwenEmbeddingCalls=0`、usage=`343/40`、
`maxConcurrency=1`、breaker reason=`schema`。已发生前缀没有超过 call/token/cost ceiling，但完整 gate 要求
`12` 次 candidate/Provider 调用和非空 aggregate verified cost；本次未满足完整分母，不能写成“预算验证通过”。

`rewrite_03` 虽有 verified usage，但没有形成可接受的 lane verified cost。Runner 只有在每个已尝试 lane 都有
verified cost 时才发布 aggregate，因此整轮 `verifiedCostCny=null`。不能把 `rewrite_01` 的 `0.00069 CNY` 写成整轮
费用，也不能根据 `343/40` 自行反推账单。

## 4. 唯一失败边界

正式证据只给出 `rewrite_03 / schema / runtime_untrusted` 这一有界分类：Provider 调用已经发生并观察到 usage，但本地
strict rewrite contract 没有成立。Evidence 不保存 Provider 原文、具体字段名、Zod path、raw response 或 raw error，
因此不能进一步声称模型返回了哪一种 JSON、哪个字段错误，或把失败归因于 DNS、TLS、proxy、账号、余额、模型权限、
服务端、transport 或产品语义。

第一个 rewrite lane 成功也不足以形成 Provider health 或 P1 semantic authority；后续 10 条 lane 没有执行，所有
rewrite/FinalResponse semantic aggregate 与延迟 authority 均不可用。六条语义样本即使完整也不产生 P95/SLA；本次
更不能根据两条前缀样本生成任何 P95。

## 5. Durability 与 strict validator

本次由正常 runtime publication 收口，不是 crash-only recovery：

- marker：`.tmp/phase-6-9-8-retriever-final-response-p1-l2.marker`；
- journal：`.tmp/phase-6-9-8-retriever-final-response-p1-l2-ff035203-500f-4744-b33c-3c375ae4c785.journal.jsonl`；
- report：`.tmp/phase-6-9-8-retriever-final-response-p1-l2-ff035203-500f-4744-b33c-3c375ae4c785.report.json`；
- root hard-link artifact：`phase-6-9-8-retriever-final-response-p1-l2-ff035203-500f-4744-b33c-3c375ae4c785.json`；
- marker SHA：`00d2b56608e6dcaa024a45bc9fc848afc37471c64236d6d8abc07451363602b8`；
- journal physical SHA：`066d910958f8bebc238dade8b59f3a8de9c0414f81f6b6507b76d3adcc2ce091`；
- report logical SHA：`640b1518bae5e55cef6265177b51a89e0d9041a8862bc425e029700c0f0955f6`；
- report physical SHA：`84eddcf6987aa6079432c28072215704ebc0b328178be565475c1e768980d7f9`；
- root artifact physical SHA：`9b79c4902ff53ada7b144b0c120908cd2945de347dfd3c73c2d47bbbc3aef58b`；
- terminal sequence/hash：`38 / c0e7d8d3176f30d798b0760a8b088cc25b9e96bae5f4ffecb0c8ec3097fc4d7d`；
- sequence `39`：`publication_started`；
- sequence `40`：`evidence_published`；
- recovery claim SHA：`null`；
- formal evidence counts：artifact/journal/marker/recovery=`1/1/1/0`；
- artifact：`hardLink=true / publicationMode=runtime / rawDataRetained=false`。

只读复核命令：

```powershell
bun run --cwd packages/agent eval:phase-6-9-8:p1:l2:validate
```

该命令返回 `ok=true / code=bundle_valid / gate=p1_l2_quality_gate_failed`，只重放并重算已封存 bundle，不读取
credential、不调用 Provider。Artifact 已发布，禁止再次执行 Live 或 recovery/seal 命令。

## 6. 工程回归

本次 source-gate 修复后的 focused P1 L2 为 `14/14`（47 assertions）。封存后又在当前分支执行一次完整、零
Provider 工程回归：

```text
Agent full  1437 pass / 0 fail / 24317 expect() calls / 180 files
typecheck   pass
lint        pass
diff check  pass
```

这组回归验证代码与证据读取边界，不提升失败 Live 的 semantic authority，也不代表 Docker/API/browser 产品验收。

## 7. 影响与下一停止门

- P1 L2 runner/durability 与一次性 evidence publication 合同成立，但真实语义质量门失败；
- P1 semantic authority 仍未建立，`qualityAuthority=none`；
- 产品 `/api/chat`、Docker/API/可见浏览器、Trace、业务写入、SLA 与后续 Phase 继续阻断；
- canonical approved tag、marker、journal、report 与 root artifact 保持不可变；
- 本次 evidence/documentation 提交晚于 approved source `fa502925`，不能反写或移动 approved tag；
- 证据与文档已在 `1f3c0d9b` 提交，并以 `f4fac048` 合并推送到 `main`；合并后二次 zero-provider parity 已通过，详见
  `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-main-parity-zero-provider.md`；
- 如继续修复，只能从最新 `main` 新开独立 zero-provider schema recovery/diagnostic 任务，不能把它称为本次 L2 retry。

回顾时可以问：

- 为什么 `bundle_valid` 与 `p1_l2_quality_gate_failed` 可以同时成立？
- 为什么 `rewrite_03` 有 usage 仍不能形成整轮 verified cost？
- 为什么 schema 分类不能直接解释成 Provider 返回了某个错误字段？
- 为什么 breaker 后仍要保留 10 条 not-started terminal？
- 为什么本次不能启动 Docker/API/browser 产品验收？
- 下一步为什么必须是新的 zero-provider recovery lineage，而不是再发一个单 case 请求？
