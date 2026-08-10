# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR0 设计

日期：2026-08-09

状态：SR4 zero-provider reviewed Mock/static、SR5 admission/runner/durability checkpoint 与 SR5 Live implementation
均已完成；唯一 controlled-Live 尚未执行。本文件保留 SR0 设计与历史 handoff，并区分实现态与真实质量 authority。

当前分支：`main`（merge=`1d0f798d`；实现提交 `14301d03`、文档提交 `d1f19c8a` 已推送；普通 git branch，不使用 worktree）。
`origin/main` 待本轮收口推送；approved tag 尚未创建。

SR5 zero-provider lineage：`phase-6.9.8-retriever-final-response-schema-recovery-sr5-v1`；Live implementation lineage：
`phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v1`；SR3/SR4 lineage
`phase-6.9.8-retriever-final-response-schema-recovery-v1` 仅作为上游 identity 保留。

SR0 authority：`zero_provider_retriever_final_response_schema_recovery_design`

qualityAuthority：`none`

## SR4 handoff（2026-08-09，reviewed Mock/static）

SR4 已在当前普通分支完成 reviewed Mock/static，authority=
`zero_provider_retriever_final_response_schema_recovery_sr4_reviewed_mock / qualityAuthority=none`，gate=
`schema_recovery_mock_quality_not_evidence`。它不是 SR5 controlled-Live，也不读取 credential、不调用 Provider、不写正式
evidence 或产品数据。

实现先由 prompt-only responder 从实际 bounded prompt 生成 canonical query，再在内存构造 raw JSON，交给
`parseModelAgentJsonContentWithPolicy` 做有界语法/投影；extension 只形成 bounded `extension_fields_discarded` 诊断并丢弃。
完整生产形状路径为 `Retriever original -> query-rewrite candidate -> synthetic Qwen search port -> evidence projector ->
FinalResponse stream -> local merger -> SR3 runner`，并固定 `8/6/6/12/20` 分母、最大并发 `1`、无 retry/replay。

固定结果：guards `8/8`，runtime `12/12/12/12`，schema `4 canonical + 2 extension discarded + 0 rejected`，FinalResponse
strict `6`，节点路径 `18/6/6/6/6`，synthetic Qwen port `18`，临时 evidence `1` 创建后 `0` 残留，formal namespace=`0`；
factory SHA=`sha256:7bc32c8ed68c3c8d76c9c983b40e771f24c0181cda7976cbc97ab1fb4c26d157`，SR3 upstream report SHA=
`73f0648549e02ec02de2907718d27b71fded2b76e91ac153e7df312a40951ef8`。

SR4 focused `11/11`（99 assertions）、组合 `74/74`（734 assertions）、Agent full `1488/1488`、AI full `345/345`、Types
`42/42 + tsc`、Web `487/487`、Server build 与 Agent/AI typecheck/lint 均通过；文档 parity 与 main 二次回归以 SR4 acceptance
为准。SR4 只解锁
fresh SR5 admission；任何真实 Live 必须重新接受当次 DeepSeek/Qwen 数据边界并给出绑定新 source 的 exact authorization。

## SR5 admission checkpoint（2026-08-10，zero-provider）

SR5 admission 已在普通分支
`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr5` 完成。合同固定 approved branch/annotated tag 名称与 tag
object id、Git blob source bundle、SR3/SR4 identity、DeepSeek/Qwen 当前账号 data-boundary receipt、source-bound exact
authorization、预算 `12 / 37,600 / 8,800 / 0.176 CNY`、最大并发 `1`、single dispatch 与 no
retry/resume/replay/backfill。source-bound API 将四类输入组合为 bound admission/reservation capability；record 只保留
boundary/authorization SHA。

当前 approved annotated tag 尚未创建，真实 source gate 仍关闭。SR5 admission focused `12/12`（50 assertions）、typecheck/lint 与
CLI help smoke 通过；providerCalls/credentialReads/formalEvidence/businessWrites 均为 `0`。本 checkpoint 不读取 `.env`、
不调用 Provider、不创建正式 evidence，也不构成 controlled-Live 或 semantic/product/main authority。验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-admission-zero-provider.md`。

## SR5 runner/durability checkpoint（2026-08-10，zero-provider）

runner 已将 admission 的 opaque reservation capability 接入固定 reviewed-Mock 执行器：`8` zero-call guards、`6` rewrite
与 `6` FinalResponse lanes，`20` report entries、`12` candidate invocations、最大并发 `1`、pair serial、single dispatch，
预算 `37,600/8,800/0.176 CNY`。首个 guard/lane 错误打开 breaker，后缀只写 `not_started_*`，不重试、不复制 sibling 结果。

durability 层新增独立 SR5-runner marker/journal/report/recovery/artifact namespace；marker 独占创建并绑定 runner
manifest/policy SHA，reservation 和每个阶段先 fsync，再写 hash-chain journal。report/artifact 以 hard link 发布，validator
重算 source、report、wire、预算、journal 与 inode；CRLF、foreign file、tamper、publication prefix、二次 seal 与 PID
reuse 均 fail-closed。crash-only recovery 只补可证明 prefix，不创建 executor、不重放 Provider call。

runner manifest SHA=`d50e27729d873833fc857efe648ba8a56fda19a4d70212a22aa01dbe02b53ea3`，policy SHA=
`ff05b647a4c00a3943c18c70d02650aad3d4b880209ac35f04e60d1d9e31f803`。focused `25/25`（82 assertions）、typecheck/lint、
CLI help/run smoke 通过；runtime `12/12/12/12` wire、`12/0/0` succeeded/failed/notStarted，
`providerCalls=0 / credentialReads=0 / businessWrites=0 / formalEvidence=0`。authority=
`zero_provider_retriever_final_response_schema_recovery_sr5_runner_durability`、gate=
`schema_recovery_mock_quality_not_evidence`、`qualityAuthority=none`。CLI 只开放 synthetic reviewed Mock、validate 与
crash-only recover，不开放 live/credential/replay/backfill；临时 evidence 创建后精确清理为 `0`。完整回执见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability-zero-provider.md`。

runner 已完成但尚未形成真实 semantic/product/main authority。下一步是提交、推送、从最新 main 合并后二次 zero-provider
回归并推送；之后仍需重新接受当次 DeepSeek/Qwen 数据边界与绑定新 source 的 exact authorization，才能规划唯一 controlled-Live。

## SR5 Live implementation checkpoint（2026-08-10，zero-provider）

Live implementation 在独立普通分支完成，未改写历史 admission manifest。它新增独立 Git-object source bundle（根
`package.json`、`bun.lock`、`packages/agent`、`packages/ai`、`packages/types`），source bundle SHA=
`sha256:4aa3c6e8b6f66ad0c74dcaab932cbfa9bb04202f3219e38005a2571ae60853ef`；Live manifest SHA=
`2eb786e19e3e6de2f26bcc9d4b4e1b1898ee1ee3eb87976090275f4468696608`，policy SHA=
`e979f30c6979e1e4ff17a439f77820ff4ded5882189d58ba753fa02b9e6f74b1`。

固定 `8 guards + 6 rewrite pairs + 6 FinalResponse`；DeepSeek `12`、Qwen embedding `12`，总 `24` slots，最大并发 `1`、
pair-serial、single dispatch，预算 `37,600/8,800/0.176 CNY`，无 retry/resume/replay/backfill。前门顺序为
`exact argv -> data-boundary/exact authorization -> namespace/source/tag -> proxy preflight -> selective root .env projection ->
single-use reservation -> marker/journal -> runtime -> validator`；入口显式 `bun --no-env-file`，credential 只在前门后读取。

focused Live `10/10`（36 assertions）、SR5 + Task 9B boundary 组合 `48/48`（164 assertions）、Agent typecheck/lint 与 diff check 通过；
`providerCalls=0 / credentialReads=0 / formalEvidence=0 / businessWrites=0`。当前是 zero-provider implementation checkpoint
（runtime authority 尚未产生，`qualityAuthority=none`），不是
controlled-Live 或 semantic/product/main authority。完整 implementation 验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-implementation-zero-provider.md`。

### 唯一 controlled-Live 停止门（未执行）

文档与 main/source parity 完成后，重新接受绑定最终 source 的 DeepSeek/Qwen 数据边界并取得两行 exact authorization，
再创建并推送 annotated tag `phase-6-9-8-retriever-final-response-schema-recovery-sr5-approved`，才可执行一次 RUN。成功才可能产生
`schema_recovery_sr5_branch_semantic_gate`；失败、schema、transport、usage、timeout、abort 或 I/O 都必须 durable seal，
且禁止 retry/replay/curl/单 case/追加 Provider 探测。无论结果均不自动解锁产品、Docker/API/browser、Trace、SLA 或博客。

## SR1 handoff（2026-08-09，独立实现 checkpoint）

SR1 已在从 `main@e5d575214dce636c89db69a26c934019da06a013` 新开的
`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr1` 上完成 zero-provider strict parser/projection TDD，
authority=`zero_provider_retriever_final_response_schema_recovery_tdd / qualityAuthority=none`。它新增 module-owned
bounded native parser、canonical projection、actual query-rewrite candidate seam 与 no-raw diagnostic collector；diagnostic
只存在于 candidate outcome 顶层 sidecar，Retriever node 只保留 observation，因而不进入产品 Chat、FinalResponse prompt、
账单或 Trace。SR1 focused `35/35`（430 assertions）及 full/typecheck/lint 结果记录在
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr1-zero-provider-tdd.md`。
本段不改写下文 SR0 的设计事实，只说明后续实现已完成；下一步仅解锁 SR2 zero-provider robustness。

## SR2 handoff（2026-08-09，robustness checkpoint）

SR2 已在 `drb/phase-6-9-8-retriever-final-response-schema-recovery-sr2` 完成 zero-provider Provider-like robustness。
独立 fixture/responder 覆盖 `5` held-out、`24` shape（5 accepted/19 rejected）、`7` fault、`4` metamorphic case，fixture
SHA=`sha256:59010e16fd665df6d497517276dbeacb3f5973036a07e8cf00010569da171505`。合成 runtime 固定
`reviewed_mock/mock/mock`，真实穿过 SR1 raw-content parser、canonical projection、local authority 与 sanitizer；不构造
第一方 adapter、不读取 `.env`、不调用 Provider。SR2 focused `12/12`（329 assertions），组合 `43/43`（743 assertions），
authority=`zero_provider_retriever_final_response_schema_recovery_robustness / qualityAuthority=none`。

SR2 只解锁 SR3 独立 runner/source admission/durability；不提高 P1 分母、预算或 timeout，不形成 semantic/product/main
authority。完整回执见 `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr2-zero-provider-robustness.md`。

## SR3 implementation checkpoint（2026-08-09，zero-provider）

SR3 已在独立普通分支落地固定 runner 与 durability boundary：`8` guards、`6` rewrite、`6` FinalResponse，按 pair
interleaved 顺序执行，最大并发 `1`，每 lane single dispatch，首错 breaker 保留 suffix denominator。预算上限为
input/output `37600/8800`、总成本 `0.176 CNY`；manifest SHA=
`d14c08455126fad492f9f01ed07a1a4fd911241c62384fbd07537e4ffda1bede`，policy SHA=
`6c1f1b0388b2b595f141061cb3d0d34607b6214a4772e7cb4a17309e431cebf8`。

source admission 提供 Git-verified 与 synthetic fixture 两个隔离 seam；capability 由 module-owned WeakMap/WeakSet
单次消费，reservation 时对 Git source 重新检查 branch/HEAD/upstream/origin/approved ref、clean tree、formal namespace
和 source bundle。marker 固定 zero-provider 计数；journal 在每个 durable prefix 后 fsync，validator 重算 report/hash-chain、
hard-link inode 与 artifact；crash-only recovery 只补 guard/lane/run/publication prefix，不重放调用、不创建 executor。
CLI 仅开放严格 run/validate/recover(seal) token，脚本默认使用临时 reviewed Mock，SIGINT/SIGTERM 转 AbortSignal。

SR3 focused `15/15`（49 assertions）、SR1+SR2+SR3+Task 9B 组合 `63/63`（635 assertions）、Agent full `1477/1477`、AI full `345/345`、Agent
typecheck/lint 已通过；`providerCalls=0 / credentialReads=0 / businessWrites=0 / formalEvidence=0`。authority=
`zero_provider_retriever_final_response_schema_recovery_runner_durability / qualityAuthority=none`，gate=
`schema_recovery_mock_quality_not_evidence`。SR3 只解锁 SR4 reviewed Mock/static，不产生 semantic/product/main/P95/SLA
authority；验收见 `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr3-zero-provider-runner-durability.md`。

## SR4 implementation checkpoint（2026-08-09，reviewed Mock/static）

SR4 在从已推送 `main@421015dbf472e008fad32200fa8a89e240818fcf` 新开的普通分支
`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr4` 上完成。它没有复用或改写任何 sealed Live 文件，也没有
读取 credential、调用 Provider 或创建正式 evidence。SR4 factory identity 为
`phase-6.9.8-retriever-final-response-schema-recovery-sr4-factory-v1`，SHA=
`sha256:7bc32c8ed68c3c8d76c9c983b40e771f24c0181cda7976cbc97ab1fb4c26d157`。

reviewed Mock 的 responder 只消费实际 bounded prompt；先生成 canonical query，再通过 raw-content policy parser 构造并
解析内存 JSON，最后把 canonical projection 交给真实 Retriever/FinalResponse production-shaped nodes。extension 只生成
固定 `extension_fields_discarded` sidecar 后丢弃，`rawDataRetained=false`；SR3 runner 负责 fixed denominator、wire、usage、
breaker 与 fault 分类。默认回放为 `8/8` guards、`12/12/12/12` reservations/dispatches/responses/verifiedUsage、
`12/0/0` succeeded/failed/notStarted、schema `4 canonical + 2 extension discarded + 0 rejected`、FinalResponse strict `6`，
节点路径 `18/6/6/6/6`，synthetic Qwen port `18`，临时 evidence `1 -> 0`。

SR4 focused `11/11`（99 assertions）及 CLI smoke 已通过；authority=
`zero_provider_retriever_final_response_schema_recovery_sr4_reviewed_mock / qualityAuthority=none`，gate=
`schema_recovery_mock_quality_not_evidence`。该阶段只解锁 fresh SR5 admission，不解锁 Provider、Docker/API/browser、产品、
Trace、P95/SLA 或 `main`；验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock-static.md`。

## 1. 决策摘要

Phase 6.9.8 P1 L2 的唯一 controlled-Live 已经封存为
`p1_l2_quality_gate_failed / qualityAuthority=none`。它给出了
`rewrite_03 / schema / runtime_untrusted` 的有界终态，但没有保存 Provider 原文、字段名、Zod path/value、
raw error 或 prompt，因此不能回答“模型具体返回了什么”，也不能把失败归因于网络、代理、账号、余额、权限或服务端。

本 SR0 不重跑、恢复、改写或解释 P1 L2；只冻结一个新的、可审计的 schema-recovery/diagnostic lineage，目标是让
下一阶段在 zero-provider 条件下区分“内容/语法/Provider envelope/投影/本地安全/usage”边界，同时保持业务权限
不扩大。它不是 L2 retry/recovery，也不是真实模型质量通过。

Retriever query-rewrite 的模型权限只有“提出一条候选检索问题”。新处理链固定为四步：

1. **Provider content boundary**：对瞬时字符串做类型、Unicode 与大小检查；JSON 语法与结构检查在下一步完成；
2. **Provider envelope**：从单个 native JSON object 中识别精确 canonical 字段；
3. **Canonical rewrite projection**：只构造新的 strict `{ rewrittenQuery }`，丢弃无权威扩展字段；
4. **Local safety/authority**：继续使用现有 trim、长度、控制字符、工具/写入指令、等价查询和 protected-term
   检查，再由本地决定是否应用。

FinalResponse 是 stream contract，不参与这次 rewrite parser 的权限扩张。未来 full denominator 仍必须让
FinalResponse 走原有 projector、citation ledger、stream terminal、usage 与本地 merger；schema recovery 只能改善
Retriever 的可定位性，不能单独解锁产品 `/api/chat`。

## 2. P1 L2 不可变事实

| 项目                         | 已封存事实                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| run                          | `ff035203-500f-4744-b33c-3c375ae4c785`                                                                 |
| source/tag                   | approved `fa502925...`                                                                                 |
| gate / authority             | `p1_l2_quality_gate_failed / qualityAuthority=none`                                                    |
| guard                        | `8/8`，Provider zero-call                                                                              |
| attempted lanes              | `rewrite_01` strict 成功；`rewrite_03` bounded `schema` 失败；其余 10 条 `not_started_quality_breaker` |
| Provider / credential / Qwen | `2 / 2 / 0`（均为历史封存计数）                                                                        |
| usage / aggregate cost       | `343/40` / `null`                                                                                      |
| journal / terminal           | `41 / evidence_published`                                                                              |
| validator / recovery claim   | `ok=true / bundle_valid` / `null`                                                                      |
| artifact                     | root SHA `9b79c490...3aef58b`                                                                          |

上述事实只从 sealed acceptance 读取。SR0 不读取 `.env`，不触碰这些 marker/journal/report/root artifact，不创建新
formal evidence，也不启动 Docker/API/browser、Trace、BackgroundJob、Outbox 或产品写入。

## 3. 当前链路与结构性缺口

```text
P1 L2 pair runner
  -> runRetrieverQueryRewriteModelCandidateV1
  -> ModelAgentRuntime.invokeStructured
  -> first-party DeepSeek structured adapter
       -> response audit
       -> completion content
       -> JSON parse / request.schema.safeParse
       -> usage validation
  -> generic runtime-result sanitizer
  -> trim + model projection safety
  -> unchanged/protected-term/local-authority checks
  -> P1 L2 lane mapping
```

当前 strict contract 是 `z.object({ rewrittenQuery: z.string().min(1).max(2000) }).strict()`。generic runtime trace
只提供 `provider_json_parse / provider_type_validation / provider_object_missing` 三类 structured-output stage；
candidate 在 runtime result 不可信、trace 不匹配、schema failure 或本地安全拒绝时统一回到原 query，P1 L2 又把未应用前缀压缩为
`schema` 或 `runtime_untrusted`。这保证了 fail-closed，却无法在 zero-provider fixture 中验证各类 Provider-like shape
是否被正确区分。

SR0 只记录缺口，不把其中任何一种 shape 宣称为 `rewrite_03` 的实际返回：

- adapter 的 JSON parse 与 strict schema 之间没有 Retriever 私有的有界 projection；
- extra field、alias、duplicate key、wrapper、trailing data、结构超限等形态没有统一 diagnostic contract；
- generic sanitizer 会清掉不可信 runtime 的详细阶段，P1 report 没有字段级但不泄漏内容的替代物；
- local safety/authority rejection 与 Provider schema rejection 在 P1 runner 中不可区分；
- recovery durability 的 PID reuse、信号中断和 publication/claim 崩溃窗口需要在新 lineage 独立验证。

## 4. 两层信任域与四步合同

### 4.1 Layer A：不可信 Provider content / envelope

Provider 内容只在内存中短暂存在。parser 必须绑定一个 module-owned、WeakMap 注册的 exact schema identity；不能由
调用者注入任意 parser、expected、oracle 或 dataset。固定有界限制：

```text
maxBytes = 8_192
maxDepth = 8
maxNodes = 128
maxKeys = 64
rewrittenQuery max UTF-16 code units = 2_000
```

超过任一限制立即 fail-closed；诊断只留下 enum/bucket。禁止保存原文、原文 hash、可逆编码、截断片段、错误栈或
第三方对象引用。

### 4.2 四个处理步骤

#### Step 1：`response_content`

- 只接受 adapter 已审计出的单一 completion string；缺失、非字符串、空引用、非法 UTF-16、字节超限分别落入
  固定 reason；
- parser 不读取 prompt、credential、用户正文或网络对象；synthetic hostile getter/Proxy/Symbol/cycle 也必须
  fail-closed；
- 此步骤不做 trim、数字抽取、Markdown 清理或自然语言容错。

#### Step 2：`json_syntax` + `provider_envelope`

- 只接受一个 native JSON value，顶层必须 object；拒绝 BOM、Markdown fence、prose、多个顶层值、trailing data、
  重复 key、非法控制字符和结构超限；
- 重复 key 必须在普通 `JSON.parse` 的 last-key-wins 之前被发现；
- 顶层 object 只能通过 data-property 读取，不能执行 getter/accessor；
- object 中的非 canonical extension 允许在有界审计后丢弃，但只记数桶，不把它们交给模型权限、Trace、journal、
  report 正文或产品 prompt；
- 任何 canonical/alias 歧义均拒绝，不靠“最后一个字段”解决。

#### Step 3：`rewrite_projection` + `projected_schema`

只识别 ASCII、大小写敏感、顶层 own-data key `rewrittenQuery`：

- 缺失、只出现 alias、alias 与 canonical 同时出现、重复 canonical key 均 fail-closed；
- value 必须是原生 string，拒绝 number、boolean、null、array、object、字符串数字、嵌套 wrapper；
- 重新构造全新的 plain object `{ rewrittenQuery: value }`，再通过 strict projected schema；不复用 Provider object 引用；
- 不 coercion、不 default、不 clamp、不 round、不从 Markdown/prose 抽取、不 retry；
- extension discard 成功时必须透明记录 `extension_fields_discarded` 计数，不能伪装成完全 canonical。

#### Step 4：`local_safety` + `local_authority` + `applied`

沿用并锁定现有 Retriever candidate 的本地检查：先执行既有 trim，再执行 UTF-16/Unicode/control-character、tool/write
instruction、credential/exfiltration、query unchanged 与 protected-term preservation 检查。任何失败都回退原 query，
并记录固定 bounded reason；模型不能改变 RAG policy、owner、topK、source/status filter、document ID、citation、route、
tool、write command、usage、budget 或 terminal。

成功也只代表本地允许应用“检索查询字符串”；它不代表检索命中、Qwen embedding、FinalResponse grounded/citation 或产品质量。

### 4.3 FinalResponse 保持不变

FinalResponse 继续使用现有 `FinalResponseRequestV1`、verified evidence bundle、citation ledger、stream terminal、owner
receipt、usage/cost 和 local merger。SR1--SR4 可以为其保留 fault fixtures，但不得把 rewrite diagnostic 字段注入
FinalResponse prompt、stream event 或业务 Trace。

## 5. Bounded diagnostic 合同

新版本身份：

```text
contractVersion:   phase-6.9.8-retriever-schema-recovery-contract-v1
diagnosticVersion: phase-6.9.8-retriever-schema-diagnostic-v1
```

每条 attempted rewrite lane 最多产生一个 immutable diagnostic；成功的 canonical lane 可以为 `null`，含 extension
时必须产生 `extensions_discarded` 诊断。固定 schema：

```json
{
  "diagnosticVersion": "phase-6.9.8-retriever-schema-diagnostic-v1",
  "stage": "rewrite_projection",
  "reasonCode": "extension_fields_discarded",
  "projectionDisposition": "extensions_discarded",
  "topLevelType": "object",
  "rewrittenQueryType": "string",
  "extraFieldCountBucket": "1",
  "shapeFingerprint": "sha256:<64 lowercase hex>",
  "rawDataRetained": false
}
```

固定 enum：

- stage：`response_content`、`json_syntax`、`provider_envelope`、`rewrite_projection`、`projected_schema`、
  `local_safety`、`local_authority`、`usage`、`applied`；
- reason：`content_missing`、`content_limit`、`malformed_json`、`multiple_top_level_values`、`duplicate_key`、
  `structure_limit`、`top_level_not_object`、`rewritten_query_missing`、`rewritten_query_alias_ambiguous`、
  `rewritten_query_type`、`projected_schema_invalid`、`extension_fields_discarded`、`rewrite_empty`、
  `rewrite_safety_invalid`、`rewrite_unchanged`、`protected_terms_drift`、`usage_invalid`、`unknown`；
- projection：`not_attempted`、`canonical`、`extensions_discarded`、`rejected`；
- type bucket：`missing`、`object`、`array`、`string`、`number`、`boolean`、`null`、`unknown`；
- extra field bucket：`0`、`1`、`2_4`、`5_plus`。

`shapeFingerprint` 只能对上述 enum/bucket 的固定顺序 canonical JSON 做 SHA-256。不得对 raw completion、unknown key
名、字段 value、Zod path、prompt、用户文本、答案、URL、header、cookie、credential、owner、run-specific secret、
stack 或 raw error 做 hash。诊断本身出错时退化为 `stage=unknown/reasonCode=unknown/rawDataRetained=false`，不能改变
主 lane 的安全终态。

## 6. Agent 权限与通信边界

| 参与者                           | 可读/可写                                                                                       | 明确禁止                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Rewrite model                    | bounded system/user prompt 中的 original query、recent turns、active context 与 protected terms | owner、route、RAG policy、topK、filters、document/citation、tool、write、答案、usage、diagnostic、expected/oracle |
| Recovery parser                  | 瞬时 completion string；只输出 canonical projection 或 bounded diagnostic                       | 持久化 raw、调用网络/工具、访问 credential、读取 expected/oracle、修改本地 authority                              |
| Local Retriever authority        | owner-bound context、safe request、eligible RAG policy、safety scan、应用/回退决定              | 让模型覆盖 owner、权限、搜索结果、账单或 terminal                                                                 |
| Qwen search / evidence projector | 只接收本地构造的 owner-bound query 与 policy；返回 strict evidence bundle                       | 接收 Provider extension、跨 owner 数据、模型自报 citation/权限                                                    |
| FinalResponse                    | 只消费 verified bundle 与 bounded request，产生 stream text/events                              | 伪造 citation、工具成功、写命令、owner、Trace terminal 或 usage                                                   |
| Runner/validator                 | 调度、预算、journal、artifact、recompute gate                                                   | retry/resume/replay/backfill、复制 sibling 结果、读 `.env` 早于 gate                                              |

通信只通过 versioned envelope、同一 `AgentExecutionContext`、opaque capability 和 owner receipt 绑定。模型输出不能成为
权限或通信 envelope 的 authority；extension diagnostic 不跨节点传播到产品 Chat。

## 7. 并发、丢失任务与路由停止门

Schema Recovery 继承 P1 L2 固定分母：`8 guards + 6 rewrite + 6 FinalResponse = 20 entries / 12 candidate
invocations`（这是未来 runner 的 planned cap，不是本次历史 Provider calls），最大并发 `1`，每 lane 最多一次 dispatch，
总 input/output cap `37_600 / 8_800`，总 cost cap `0.176 CNY`。

- guard-first；任一 guard 失败不创建 Provider adapter；
- pair 串行、pair 内双 lane；每次 dispatch 前 reservation + fsync，response 只能对应一个 reservation；
- 首个 contract/permission/safety/budget/transport/schema/usage/stale/abort failure 打开 breaker，suffix 只写
  `not_started_quality_breaker`，不 dispatch、不 retry；semantic mismatch 保留固定分母但不复制结果；
- abort/deadline 只关闭当前 pair，不能绕过 owner/stale/write fence；
- Router 只负责把请求送到 Retriever/FinalResponse，不能把 schema diagnostic 直接暴露给用户；`route`、RAG enable、
  answer mode 仍由本地 deterministic policy/authority；
- 本 SR0 不接 BackgroundJob/Outbox。未来异步化必须另立 task id、幂等键和 Outbox 原子投递设计。

## 8. Durability 与独立 namespace

SR0 只冻结命名，不创建文件。未来 SR3 使用全新路径，绝不复用 P1 L2：

```text
lineage = phase-6.9.8-retriever-final-response-schema-recovery-v1
marker  = .tmp/phase-6-9-8-retriever-final-response-schema-recovery-v1.marker
journal = .tmp/phase-6-9-8-retriever-final-response-schema-recovery-v1-{runId}.journal.jsonl
report  = .tmp/phase-6-9-8-retriever-final-response-schema-recovery-v1-{runId}.report.json
claim   = .tmp/phase-6-9-8-retriever-final-response-schema-recovery-v1-{runId}.recovery.claim
artifact= phase-6-9-8-retriever-final-response-schema-recovery-v1-{runId}.json
```

未来 SR3 必须复用已验证的 reservation-before-dispatch、fsynced hash-chain、hard-link publication、strict
recomputing validator 与 crash-only prefix recovery，但使用独立 schema/version/authority/source manifest。新增必测
边界：

1. creator PID reuse；若无法取得进程启动身份，必须 fail-closed；
2. SIGINT/SIGTERM 位于每个 durable prefix 的中断；信号处理器不得直接恢复或重放；
3. `recovery_claimed` claim 文件已写但 journal 未写、journal 已写但 claim 未写、duplicate/tampered/orphan claim；
4. terminal report、publication_started、同字节 existing artifact、异字节 artifact、foreign temp、symlink/non-file；
5. hard-link inode/字节一致性与二次 recovery 幂等；
6. 所有 recovery 结果强制 `providerCalls=0 / credentialReads=0 / retry=0 / replay=0 / businessWrites=0`。

SR0/SR1--SR4 不读取 `.env`、不创建 approved tag/marker/journal/report/artifact/recovery claim；P1 L2 sealed 文件保持只读。

## 9. Zero-provider 设计矩阵

SR1/SR2 必须使用本地 synthetic runtime/fetch seam 和 spy；测试只证明 synthetic 路径的 `globalThis.fetch` 不会被调用、
credential reader 为 0，不把该结果写成未来 Provider health。最小矩阵：

1. canonical `{"rewrittenQuery":"..."}`、key order/whitespace/escaped JSON 等价输入；
2. extension scalar/object/array、extension Unicode/emoji/NFC/NFD，确认只计数/丢弃、不泄漏；
3. missing、reserved alias、alias+canonical、string/number/boolean/null/array/object、empty/overlong；
4. top-level array/null/string、double-encoded、wrapper、fence、BOM、prose、trailing、duplicate key；
5. byte/depth/node/key limits、invalid UTF-16、control character、hostile getter/Proxy/Symbol/cycle/non-plain object；
6. unchanged query、protected-term drift、tool/write/credential/instruction override；
7. provider JSON parse/type/object-missing、transport/HTTP/usage/timeout/abort 的 bounded fallback；
8. held-out/metamorphic query/context reorder，candidate 不读取 expected/oracle；
9. one dispatch/no retry、pair sibling close、breaker 后固定 not-started denominator；
10. diagnostic deep-freeze、hash parity、no raw/key/path/prompt/credential scan；
11. future durability crash windows 与 foreign namespace；
12. formal artifact/marker/journal/claim=0，Docker/API/browser/Trace/Outbox/business writes=0。

## 10. 原子路线与停止门

| 阶段 | 交付                                                                           | authority / 解锁                                                            |
| ---- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| SR0  | 只读复盘、schema/diagnostic/durability 设计、文档同步                          | `zero_provider_retriever_final_response_schema_recovery_design`；只解锁 SR1 |
| SR1  | strict parser、canonical projection、diagnostic TDD、candidate seam            | zero-provider TDD；只解锁 SR2                                               |
| SR2  | 已完成 Provider-like/held-out/fault/Unicode/结构限制/anti-oracle；focused `12/12`、组合 `43/43` | `zero_provider_retriever_final_response_schema_recovery_robustness / qualityAuthority=none`；只解锁 SR3 |
| SR3  | 独立 runner/source admission/journal/artifact/validator/recovery               | zero-provider durability；只解锁 SR4                                        |
| SR4  | reviewed Mock/static，全量 parity 与 no-leak                                   | `schema_recovery_mock_quality_not_evidence`；只解锁 fresh SR5 admission     |
| SR5  | 新 source/tag、fresh data boundary、exact authorization 后唯一 controlled-Live | 仅完整 gate pass 才有分支 semantic authority；一次性、不可重跑              |
| SR6  | SR5 pass 后分支 Docker/API/可见浏览器/Trace/精确清理                           | product branch authority；不自动解锁 main                                   |
| SR7  | SR6 pass 后从最新 main 合并、推送、main 二次回放                               | main/default-off authority                                                  |

任何 Provider 调用前必须重新完成 SR1--SR4 独立提交/推送、source/upstream/origin/tag parity、历史 SHA/validator parity、
新 namespace formal files=0、fresh proxy preflight、当次 DeepSeek/Qwen 数据边界接受和新 exact authorization。SR0 文档
不提供未来 confirmation 文本，不构成预授权。

## 11. SR0 禁止事项

- 不重跑、recover、seal、replay、backfill 或修改 P1 L2 marker/journal/report/artifact/tag；
- 不读取根 `.env`、credential，不执行 `curl`、单 case 或任何 Provider/network 探测；
- 不把 `schema` 写成具体字段、Provider 根因、模型健康或账单事实；
- 不放宽为字符串数字、alias merge、default、clamp、round、自然语言抽取或答案表；
- 不让模型设置 owner、route、RAG policy、citation、tool、write、usage、budget、terminal 或 diagnostic；
- 不把 extension discard、Mock、L2 前缀、Transport canary 或历史 Phase 6.9.7 Schema Recovery authority 拼成新质量门；
- 不启动/清理 Docker、PostgreSQL、Redis、MinIO，不修改业务数据；
- 不进入产品 API/browser、Phase 6.10、Phase 8/9 或博客收尾。

## 12. 回顾时可以问

- P1 L2 的 `schema/runtime_untrusted` 为什么不能恢复 `rewrite_03` 的具体 JSON shape？
- 为什么 extension 可以被有界丢弃，却不能进入本地权限或 FinalResponse prompt？
- 为什么 duplicate key 必须在 `JSON.parse` 的 last-key-wins 之前拒绝？
- 为什么 canonical projection 要复制成新 plain object，而不是复用 Provider object？
- 为什么 query unchanged/protected-term drift 属于 local authority，不应伪装成 Provider schema failure？
- 为什么 SR3 要单独验证 PID reuse、signal prefix、claim/event 单边崩溃和 existing artifact 冲突？
- 为什么 SR4 Mock 通过仍不能解锁 Docker/API/browser，SR5 还需要新的数据边界和精确授权？
