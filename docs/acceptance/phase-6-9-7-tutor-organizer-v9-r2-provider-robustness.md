# Phase 6.9.7 Tutor / WrongQuestionOrganizer V9 R2 Provider-like Robustness 验收

日期：2026-07-29

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

实现起点：`577210ede1e9d50287e0ff757ce1404e8419fa4c`

## 1. 结论

V9 R2 已完成，结论严格限定为 **zero-provider robustness checkpoint**。

R1 已把 WrongQuestionOrganizer 的模型权限收敛为从本地合法 option 中选择
`questionIndex + optionIndex`；R2 验证这个边界在更接近 Provider 的输出形态、Unicode/canonical
变化、cap/token 临界值、敌意对象、取消、stale 与最终写权限并发下仍然 fail-closed。结果证明：

- canonical 原生 JSON、合法 whitespace 与 decision reorder 可以得到相同的本地结果；
- wrapper、prose、Markdown fence、BOM、snake_case、字段缺失/增加与 numeric type drift 均不会被
  coercion、repair 或默认选择；
- question/deck/keyword/knowledge-point reorder 不改变 shortlist/option-set fingerprint 或最终本地
  binding；NFKC duplicate 与 locked-name create collision 继续由本地 authority 消解；
- 每题 24、请求 144、mandatory action bucket 与 3500 input-token 上限均按冻结规则 fail-closed；
- owner、真实 question/deck ID、fingerprint、status、timestamp、locked name、confidence、write command
  不进入 bounded prompt；
- pre/in-flight/post abort、pre/post stale 与 rename/locked-name drift 均保持单 dispatch、无 retry、无写入；
- getter、Proxy、symbol、cycle、deep/wide/node-overflow、递归敏感 key、尾部 credential 与 Unicode
  control/Cf 均安全拒绝，bounded diagnostic 不保留 raw data。

R2 还通过测试发现并修复三个真实 contract 缺口：V9 diagnostic schema 未要求 strict JSON content、
`provider_type_validation` 被错误投影为 runtime fallback，以及失败 sanitizer 对 parse failure 产生带副作用的
伪诊断。修复后 transport failure、static schema failure 与 selection/dynamic failure 重新保持分层。

该结论不等于 reviewed Mock、controlled-Live、Docker/API/可见浏览器或产品可用性验收。下一原子任务仅
V9 R3 runner/lineage/durability；R4--R7、main、Phase 6.9.8 与后续阶段继续按门禁阻断。

## 2. 独立 fixture 与 anti-overfit

新增 fixture：

`packages/agent/tests/fixtures/phase-6-9-tutor-wrong-question-v9-r2-provider-shapes-v1.ts`

- version：`phase-6.9.7-tutor-organizer-v9-r2-provider-shapes-v1`；
- frozen SHA：`sha256:0870799257dcd2b88841b286b9cc64e6410702fe2bcbe86c6e153d8af88a4200`；
- 独立手写 held-out questions、decks、canonical selection 与 Provider-like negative cases；
- fixture 只导入 `node:crypto`，不导入 V2 dataset expected/oracle、生产 candidate/validator/merger、
  option builder 或 reviewed Mock responder；
- 测试扫描 fixture 和 synthetic responder 源码，防止用 expected/oracle 或生产答案生成函数反向构造
  response。

Synthetic direct-adapter 路径仍完整经过：

```text
first-party DeepSeek V4 Pro direct adapter
  -> ModelAgentRuntime
  -> V9 candidate / strict schema
  -> V9 local option selection validator
  -> V6 local merger
```

只有 fetch delegate 是进程内 synthetic responder，provenance 固定为 `synthetic_test`。Responder 只解析
实际 bounded user prompt，不读取 expected/oracle，不调用生产 builder/validator；本任务没有网络访问或
Provider 调用。

## 3. Provider content、schema 与诊断修复

### 3.1 原生 JSON identity

V9 diagnostic collector 的精确 schema identity 现在通过
`requireModelAgentStrictJsonContent()` 标记。第一方 direct adapter 因此要求 Provider message content 自身就是
完整 JSON：Markdown fence、prose prefix 与 BOM 在 `provider_json_parse` 阶段拒绝，不会被底层兼容解析器
剥壳后误收。

该标记只作用于 V9 collector schema 的进程内对象身份，不修改公开 Zod shape、prompt/rules SHA 或 V1--V8
schema identity，也不会进入 request、Trace 或 evidence。

### 3.2 Static type failure disposition

Direct adapter 完成 JSON parse 后，如果 canonical schema 在 `provider_type_validation` 失败，V9 candidate
现在固定返回 `fallback_schema_invalid`，并保留 attempted、budget、usage、Trace 与 bounded diagnostic。
它不再被通用 `PROVIDER_ERROR` 映射误归类为 `fallback_runtime_error`，也不会伪装成 Provider 前 zero-call。

### 3.3 无副作用 failure sanitation

Runtime request 继续使用带 observer 的 diagnostic collector schema；`invokeV6Structured` 对 runtime result 的
本地 sanitation 改用无副作用 canonical V9 decision schema。这样 transport/JSON parse failure 不会因为
sanitizer 再次解析 `undefined` 而伪造 `top_level_shape` diagnostic；只有真实到达 static type boundary 的值
才产生 static diagnostic，selection/dynamic failure 则由本地 validator 显式记录。

## 4. 覆盖矩阵

### 4.1 Provider-like shape

- 顶层 wrapper：`data`、`output`、array、null、double-encoded JSON、extra key；
- content：Markdown fence、prose prefix、BOM 与合法 whitespace；
- decisions：null/string/empty/over-limit、first/middle/last null decision；
- decision：extra/missing key、snake_case、string/fraction/negative/null index；
- 本地数值入口：`NaN`、`+Infinity`、`-Infinity` 与超过 `Number.MAX_SAFE_INTEGER`；这些值不能由合法
  JSON 表达，但本地 schema/diagnostic 边界仍显式拒绝；
- selection：partial/extra/duplicate question、question/option out-of-range；
- canonical success：decision reorder 与 JSON whitespace 不改变最终 suggestions。

### 4.2 Option authority 与 estimator

- question、deck、keyword、knowledge-point reorder；
- NFKC canonical duplicate、folded deck IDs 与 locked-name collision；
- 每题 24、请求 144、`reuse_existing/create_topic` mandatory bucket；
- 有效 shortlist 但无合法 option 与 mandatory bucket 因 token 超限的不同终态；
- ASCII、CJK、emoji、combining mark、孤立 surrogate，以及 `3499/3500/3501` 精确 estimator；
- candidate/adapter 的 system prompt、user prompt、schema identity、estimate 与 max output 任一漂移均在
  underlying runtime 前拒绝。

### 4.3 安全、取消、stale 与最终写权限

- 尾部 credential、Unicode `Cf`/control、递归 unknown sensitive key；
- owner domain、snapshot/shortlist/option fingerprint、真实 ID、status/timestamp、locked-name/write key 的
  prompt no-leak；
- getter、Proxy、symbol、cycle、deep、wide、node-overflow 与 hostile shortlist root；
- pre-abort/pre-stale Provider zero-call；in-flight/post-runtime abort 单次 dispatch、无 retry；
- post-runtime deck rename、locked-name/option drift 回退本地 deterministic suggestion；
- Server 既有真实 PostgreSQL 回归继续覆盖 owner snapshot、最终事务 fence，以及 rename/move/remove/
  locked-name 并发权限；R2 没有修改 Server 写链。

## 5. 验证证据

R2 focused 与 R1 candidate companion：

```text
wrong-question-organizer-v9-model-candidate.test.ts
wrong-question-organizer-v9-r2-provider-shapes.test.ts
wrong-question-organizer-v9-r2-metamorphic.test.ts
wrong-question-organizer-v9-r2-security-faults.test.ts
24 pass / 0 fail / 407 assertions
```

全量与静态门：

- Agent：`938/938`，`14255` assertions；
- AI：`226/226`，`1459` assertions；
- Agent/AI typecheck、lint：通过；
- Server 最终写权限相关 PostgreSQL 回归：3 suites / 34 tests，全通过；
- 受影响 TypeScript/Markdown Prettier 与 `git diff --check`：通过。

历史不可变证据按原 canonical 路径只读复验：

- Phase 6.9.4.3 Mock：`ok=true / mock / complete`；
- Phase 6.9.4.3 Attempts B--E：`ok=true / live / incomplete`；
- Phase 6.9.4.3 canonical JSON-mode Live：`ok=true / live / complete`；
- Phase 6.9.4.3 Attempt A：继续按已封存历史预期为 `profile_mismatch`，未放宽 validator；
- Phase 6.9.6：`ok=true / evidenceCount=4`；
- Phase 6.9.7 V1--V8：各 `ok=true / filesChecked=1`；
- `.tmp` 下 V9 marker/journal/evidence/recovery claim：0。

CodeGraph 初始化后因另一个 writer 长期持锁关闭 auto-sync；本轮不重复争锁，所有代码、测试和文档结论
最终以 FastCtx 当前磁盘文件与实际命令结果为准。

## 6. 明确未发生与下一步

本任务未读取根 `.env`/credential，未调用 Provider，未执行正式 Mock/Live，未创建 V9 marker/journal/
evidence/recovery claim，未启动 Docker/API/浏览器，未接产品 gate/composition，未修改 PostgreSQL/Redis/
MinIO 或业务数据，未执行 seal/recovery，未修改 V1--V8 artifact/SHA，也未合并 main。

下一原子任务仅 V9 R3：建立独立 report/runner/CLI/approval/marker/hash-chain journal/hard-link evidence/
crash-only recovery/validator，固定 `72/24/48/24/32` 分母、guard-first、pair/lane/breaker、single dispatch/
no retry，并完成 V1--V8 双向 lineage 隔离。R3 仍为 zero-provider，不执行正式 Mock/Live，不读取
credential，不启动产品 Docker/API/browser。

回顾时可以问：

- 为什么 `json_object` 仍不能替代 exact native JSON content 与本地 Zod schema？
- 为什么 `provider_type_validation` 必须归类为 schema fallback，而不能混入 runtime failure？
- 为什么 failure sanitizer 不能复用带 observer side effect 的 schema？
- 为什么模型只选本地 option 后，仍需 question/option reorder 与 stale/rename fault matrix？
- 为什么 `NaN/Infinity` 需要本地 schema 测试，却不应该伪造成 Provider JSON fixture？
- synthetic direct adapter 能证明哪些 wire/contract 边界，为什么不能证明真实模型质量？
- R3 为什么必须建立独立 durable lineage，而不能直接执行一次 V9 Live？
