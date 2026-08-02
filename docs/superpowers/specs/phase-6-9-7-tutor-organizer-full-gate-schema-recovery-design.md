# Phase 6.9.7 Tutor / Organizer Full-gate Schema Recovery 设计

日期：2026-08-02

状态：SR0--SR4 zero-provider 设计、TDD、robustness、独立 runner/durability 与 reviewed Mock/static 已完成；下一任务仅 SR5 fresh admission，正式 Live 与产品接线仍未实现

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起始提交：`fa29deef9382acb7e7f177f251d76d6f52b0544a`

R0 authority：`zero_provider_full_gate_schema_recovery_design`

SR1 checkpoint authority：`zero_provider_full_gate_schema_recovery_tdd`

SR2 checkpoint authority：`zero_provider_full_gate_schema_recovery_robustness`

SR3 checkpoint authority：`zero_provider_full_gate_schema_recovery_runner_durability`

未来独立 lineage：`phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1`

## 1. 决策摘要

唯一 Full-gate L3 run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 已永久保持
`full_gate_quality_gate_failed / qualityAuthority=none`。本设计不重跑或改写 L3，只依据 sealed
report/journal、当前 Tutor V6 contract、第一方 direct adapter、F2 runner 与 S3 reviewed Mock 做只读取证。

当前可以确认：

- `tutor-v2-runtime-11` 已经过
  `provider_dispatch_started -> provider_response_received -> response_audit_passed -> content_parsed`；
- 该 lane 没有进入 `schema_validated / usage_validated / response_returned`；
- L3 report 只保存 `attempted_failed / schema / wire 1/1/1/0`，没有 schema field、value、Zod path 或
  Provider 原文；
- 现有第一方 adapter 在 `JSON.parse()` 后直接调用 request schema `safeParse()`，失败统一投影为
  `provider_type_validation`；
- 当前 Tutor V6 模型输出已经很小：strict `{ intentIndex: integer 0..4 }`，depth、教学策略、答案结构与
  `answer_direct` 权限仍由本地 authority/merger 掌握；
- S3 正常 responder 直接生成 canonical Tutor decision，现有 fault matrix 没有形成覆盖常见 Tutor
  Provider shape 漂移和所有 24 个 Tutor runtime 的独立、分层诊断证据。

因此，现有证据只能定位到“JSON content 已解析、strict schema 未通过”，不能断言具体是额外字段、缺字段、
字符串数字、越界 index、顶层形状、Provider 版本、prompt、账号或服务端的唯一问题。

Schema Recovery 不继续复制理想 Mock，也不靠放宽本地权限修复。新方案把 Provider JSON 与本地权威决策拆成
两层：

1. **Provider envelope** 是不可信输入，只负责提供一个候选 ordinal；
2. **selection projection** 只读取 canonical `intentIndex`，丢弃无权威的扩展字段；
3. **strict projected decision** 重新构造并校验精确 `{ intentIndex }`；
4. **local authority/merger** 继续决定 eligible intent、preferred depth、教学策略和所有产品行为；
5. **bounded diagnostic** 只保存固定枚举、计数桶和结构指纹，不保存模型文本或用户内容。

这不是把任意模型输出当成功。缺失、别名、字符串、浮点、`null`、越界、重复 key、多个对象、wrapper、
Markdown、prose、BOM、trailing data、结构超限和 authority drift 仍 fail-closed，并且不 coercion、clamp、
default、retry、resume、replay 或 backfill。

## 2. L3 不可变事实

| 项目                                            | Sealed L3 事实                             |
| ----------------------------------------------- | ------------------------------------------ |
| Run                                             | `2b0ac3a0-631f-4c7f-9781-ce0cda94149a`     |
| Gate / authority                                | `full_gate_quality_gate_failed / none`     |
| Guard                                           | `24/24`                                    |
| Reserved / terminal / orphan / not-started      | `22 / 22 / 0 / 26`                         |
| Executor / dispatch / response / verified usage | `22 / 22 / 22 / 21`                        |
| Strict success                                  | `21/48`                                    |
| Failure lane                                    | `tutor-v2-runtime-11`                      |
| Failure boundary                                | `content_parsed` 后、`schema_validated` 前 |
| Formal semantic / anchor / P95 / token / CNY    | 全 `null`                                  |
| Journal / publication                           | `296 / evidence_published`                 |
| Validator / recovery claim                      | `ok=true / 0`                              |
| Product / main / later phases                   | 阻断                                       |

L3 marker、journal、artifact、approved tag、source SHA 与 validator 都不属于 Schema Recovery 的写入范围。新代码和
新测试不得 import L3 artifact 作为答案表，也不得从其 partial success 重建 full-gate pass。

## 3. 当前调用链与结构性缺口

### 3.1 当前 Tutor 调用链

```text
F2 full-gate runner
  -> full-gate live harness.runTutor
  -> runTutorV6ModelCandidate
  -> projectTutorV6ModelInput
  -> TUTOR_V6_MODEL_DECISION_SCHEMA
  -> ModelAgentRuntime.invokeStructured
  -> first-party-deepseek-v4-pro-direct-v1
       -> response audit
       -> JSON.parse(content)
       -> request.schema.safeParse(parsedContent)
       -> usage validation
  -> validateTutorV6ModelDecision
  -> mergeTutorV6ModelDecision
  -> full-gate semantic observation
```

现有 `TUTOR_V6_MODEL_DECISION_SCHEMA` 只允许：

```json
{
  "intentIndex": 0
}
```

`intentIndex` 只选择当前本地 authority 已暴露的 eligible intent。preferred depth、是否提问、是否给出最终答案、
answer structure、prompt addition、debug、route、真实题目事实和权限均不由模型返回。

### 3.2 当前缺口

1. DeepSeek `response_format=json_object` 只保证 JSON object，不保证完全匹配本地 Zod strict shape；
2. adapter 把所有 `safeParse` 失败压缩为同一个 `provider_type_validation`，runner 再压缩为 `schema`；
3. report/journal 没有 schema stage、reason、类型桶或结构指纹，无法区分 syntax、shape、selection 与 local
   authority；
4. S3 的 canonical responder 能证明理想合同可运行，但不能代表 Provider 常见的额外解释字段、类型漂移、
   wrapper 或重复 key；
5. 当前失败发生在 usage validation 前，因此不能把 response 已收到解释为 verified usage 或可计费 aggregate；
6. 在没有新诊断的情况下反复调整 prompt 或重跑完整门，只会继续消费一次性调用而不提高可定位性。

## 4. 两层 Schema 合同

“两层”指两类信任域：不可信的 Provider envelope，与可信的本地 projected decision/authority。中间的
selection projection 是单向信任转换，不是第三个模型权限层；完整处理流水线仍按 envelope、projection、strict
projected decision、local authority/merger 四步记录。

### 4.1 Provider Envelope

新 lineage 的 Tutor Provider content 必须是单个、原生 JSON object。adapter 在 `JSON.parse` 前先做有界语法与
结构检查：

- 最大字节、深度、节点和 key 数固定；
- 禁止 Markdown fence、prose、BOM、trailing data、多个顶层值；
- 任意 object 内重复 key 都拒绝，避免 `JSON.parse` last-key-wins 形成歧义；
- JSON number 必须能表示为安全有限值；
- 解析器不执行 accessor/getter，不接受非 plain prototype；synthetic hostile object 同样 fail-closed。

Provider envelope 只要求存在一个 canonical own-data `intentIndex`。额外字段不获得任何 authority：完成有界
shape audit 后直接丢弃，不进入 candidate、Trace、journal、report、产品 prompt 或日志。

### 4.2 Selection Projection

projection 只允许把下列值提升为候选 decision：

- key 必须精确为 ASCII `intentIndex`，不接受 `intent_index`、`intent`、大小写别名或嵌套路径；
- value 必须是 JSON number、safe integer、`0..4`；
- 不接受字符串数字、boolean、`null`、浮点、`NaN`、`Infinity`、负数或越界值；
- 不做 coercion、trim、round、clamp、default、alias merge 或从文本抽取数字；
- selection 缺失或存在歧义时整条 lane 失败，不回退到另一模型选择，也不重试 Provider。

projection 成功后只构造新的 plain object：

```json
{
  "intentIndex": 0
}
```

该对象再通过新的 strict projected-decision schema。允许 envelope 扩展字段不等于允许它们进入权威 schema；
`strictRuntimeSuccess` 表示 projected decision、local authority、usage、wire 和 semantic 全部成功。

### 4.3 Local Authority 不变

selection projection 后仍必须：

1. 重新验证 V5 local signal authority 与 V6 preferred-depth authority；
2. 证明 `intentIndex` 存在于当前 frozen choices；
3. 使用本地 choice 重建 intent 与 preferred depth；
4. 由 `mergeTutorV6ModelDecision` 等价的新 lineage merger 重建完整 TutorStrategy；
5. 拒绝 `answer_direct`、越权 intent、authority binding drift 与 merge invariant 失败；
6. 保持 `1/1200/300`、3500ms hard timeout、no tools、no retry 与本地安全 guard。

模型仍有真实语义职责：它在本地合法的 eligible intents 之间选择最符合用户表达的一项；本地 projection 只
限制语法和权限空间，不读取 expected/oracle，也不替模型决定正确答案。

## 5. Bounded Schema Diagnostic

新 diagnostic identity：`phase-6.9.7-tutor-schema-diagnostic-v1`。

每条 Tutor lane 最多保存：

```text
diagnosticVersion
stage
reasonCode
projectionDisposition
topLevelType
intentIndexType
extraFieldCountBucket
shapeFingerprint
rawDataRetained=false
```

固定 stage：

- `response_content`
- `json_syntax`
- `provider_envelope`
- `selection_projection`
- `projected_schema`
- `local_authority`
- `local_merger`
- `usage`
- `applied`

固定 reason：

- `malformed_json`
- `multiple_top_level_values`
- `duplicate_key`
- `structure_limit`
- `top_level_not_object`
- `intent_index_missing`
- `intent_index_type`
- `intent_index_non_integer`
- `intent_index_out_of_range`
- `selection_ambiguous`
- `projected_schema_invalid`
- `local_authority_invalid`
- `local_merger_invalid`
- `usage_invalid`
- `extension_fields_discarded`
- `unknown`

类型与计数只允许固定桶，例如 `object/array/string/number/boolean/null/unknown` 和
`0/1/2_4/5_plus`。`shapeFingerprint` 只对上述枚举化摘要计算 SHA-256，不对 raw content、用户文本、答案、
prompt 或未知 key 名计算哈希，避免低熵内容被离线猜测。

禁止保存：

- Provider completion、prompt、题目/答案/active context；
- Zod issue message、原始 path/value、未知 key 名；
- URL、header、cookie、credential、raw error、stack；
- expected/oracle、真实 ID、owner、Trace payload 或写命令；
- raw content SHA、可逆编码或截断原文。

diagnostic 自身发生异常时固定退化为 `unknown / rawDataRetained=false`，不得改变主 lane 的 fail-closed
terminal。

## 6. Journal、Report 与 Validator

旧 F2/L3 journal/report/validator 不修改。Schema Recovery 使用独立 marker、journal、artifact、approval、
confirmation、source manifest 与 validator。

新 journal 在原 8-stage wire 之外记录有界 schema stage terminal：

```text
schema_stage_started
schema_stage_succeeded
schema_stage_failed
```

每条记录只包含 lane identity、stage、固定 reason、diagnostic version、枚举化摘要 hash 与既有 hash-chain
字段。Validator 必须重算并强制：

- stage 单调、每 lane 恰好一个 terminal；
- `schema_stage_failed` 后不得出现 schema/usage/response success；
- `usage_invalid` 只有在 projected schema 与 local authority 已成功后成立；
- `verifiedUsageObserved=1` 必须有 `usage` success；
- response=1 必须先 dispatch=1，dispatch=1 必须先 durable reservation；
- schema/usage/local authority failure 收口当前 pair 后打开 breaker；
- 后续 lane 只能是 `not_started_quality_breaker`，不能复制 sibling failure；
- incomplete denominator 时 semantic、anchor、P95、token、CNY 全 `null`；
- diagnostic 只允许固定 enum/hash/bucket，任意 free text、URL、raw response 或 unknown field 都拒绝；
- V1--V9、R3、Canary、small-sample、L2、旧 full-gate 与 Schema Recovery lineage 双向拒绝。

## 7. Zero-provider Robustness Matrix

SR1/SR2 至少覆盖：

1. canonical `{intentIndex:0}`；
2. key order/whitespace/escaped JSON 的等价输入；
3. 额外 scalar/object/array 字段被完整丢弃且不影响 projected decision；
4. missing、alias、string、boolean、null、fraction、negative、overflow、out-of-range；
5. top-level array/null/string、double-encoded JSON、wrapper、prose、fence、BOM、trailing data；
6. duplicate `intentIndex`、duplicate nested key、deep/wide/node/byte limit；
7. Unicode/emoji/NFC/NFD/U+2028/U+2029 只出现在无权威扩展字段时不会泄漏或改变 selection；
8. hostile getter/proxy/symbol/cycle/non-plain prototype 在本地 synthetic boundary fail-closed；
9. pre/in-flight/post abort、hard timeout、transport/HTTP/response audit/usage failure；
10. all 24 Tutor runtime cases 与特定 `tutor-v2-runtime-11` 的 Provider-like variants；
11. held-out/metamorphic latest/context reorder 与 eligible intent reorder，actual 不读取 expected/oracle；
12. no retry、single dispatch、pair sibling bounded close、fixed denominator 与 aggregate null；
13. prompt/schema/projection/diagnostic/adapter/merger/source SHA 与历史 evidence parity；
14. `globalThis.fetch=0`、credential read=0、formal artifact=0。

Mock responder 只能读取实际 bounded system/user prompt 和本地公开 ordinal choices。不得 import dataset expected、
scorer、production validator 或 option builder 来生成答案；expected 只允许进入 runner 后置 scorer。

## 8. 不变的质量、预算与权限

- 72 entries、24 guards、24 pairs、48 runtime lanes、32 Organizer decisions 不变；
- Tutor/Organizer/Combined semantic、L2 anchor、四项 24-sample P95 阈值不降低；
- Tutor `1/1200/300`，Organizer `1/3500/800`，总 cap `48 calls / 0.55 CNY` 不增加；
- guard-first、pair 串行、pair 内双 lane、single dispatch、no retry 不变；
- Organizer V9 option authority、owner snapshot、三阶段 stale/write fence、locked-name 与 command 权限不变；
- Tutor 的 depth、answer structure、final answer 权限和产品 facts 继续由本地 authority；
- Mock 满分只能是 `schema_recovery_mock_quality_not_evidence / qualityAuthority=none`；
- 只有完整新 lineage `deepseek_network` quality pass 才可能形成新 full-gate semantic authority；
- full-gate pass 仍不等于产品 API/浏览器、Trace、业务写入、SLA 或 main authority。

允许 extension fields 被丢弃后继续成功时，report 必须单独统计 canonical 与
`extension_fields_discarded` 数量，不能隐藏 Provider contract drift。该计数是观测指标，不把扩展字段提升为
模型权限，也不把它们写入产品或 evidence。

## 9. 独立 Lineage 与 Source Admission

未来 Schema Recovery source manifest 至少绑定：

- frozen dataset/manifest/baseline/eval policy 与 L2 anchor；
- Tutor provider-envelope parser、selection projection、strict projected schema；
- bounded diagnostic mapper/version/SHA；
- Tutor prompt、local signal authority、preferred depth authority 与 merger；
- Organizer V9 prompt/schema/option authority/merger；
- first-party adapter version、wire alias、runner、report、journal 与 validator；
- reviewed fixture/factory identity 与 anti-oracle scan；
- approved source commit/tag 和完整 local/upstream/remote parity。

旧 L3 approved tag `phase-6-9-7-tutor-organizer-full-gate-s3-approved` 固定不动，不能作为新 lineage 的
approved tag。新 lineage 必须使用新的 source tag、approval env、exact confirmation、credential mapping、marker、
journal、artifact 与 recovery prefix。

任何未来 Provider 调用前仍必须重新满足：

1. SR1--SR4 每项独立提交并推送；
2. tracked clean，HEAD/upstream/remote/new approved tag parity；
3. 历史 sealed validator/SHA parity；
4. 新正式 marker/journal/artifact/recovery claim 为 0；
5. fresh zero-provider proxy preflight ready；
6. 用户重新接受当次运行时 DeepSeek 数据保留/训练边界；
7. 用户给出新 lineage 的 exact authorization；
8. 专用 credential 只在上述门之后映射到唯一独立进程。

本设计不提供未来 confirmation 文本，防止 SR0 文档被误当成预授权。

SR2 已按本设计完成独立 fixture SHA `43248bfa...0d41e`、prompt-only anti-oracle responder、24 个 Tutor
runtime（含 runtime 11）、18 个 Provider shape、5 个 held-out、Unicode/structure limits、fault/abort 与 F2
sibling/breaker。该 checkpoint 全程 zero-provider，只建立 robustness authority；不建立 semantic、P95、
durability、Provider 或产品 authority。

SR3 随后以独立 `schema-recovery-v1` lineage 落成 report/runner/source/CLI/marker/journal/artifact/validator 与
crash-only recovery；source manifest SHA 为 `1a811394...adfbb`。新 journal 将 bounded schema
started/succeeded/failed 与既有 wire 分离持久化，strict validator 重算固定 `72/24/48/24/32`、schema/wire/
usage/metric/breaker 与 publication；crash-only recovery 只解释 durable prefix。SR3 focused `23/23`、兼容
`105/105`、Agent `1167/1167`、AI `325/325` 通过，正式 SR5 files/tag 为 0。该 checkpoint authority 仅
`zero_provider_full_gate_schema_recovery_runner_durability / qualityAuthority=none`。

SR4 随后使用独立 reviewed Mock factory（SHA `8f18c1c2...3d44`）真实穿过 recovery Tutor、Organizer V9、
第一方 synthetic adapter、本地 authority/merger 与 SR3 runner；固定结果为 runtime `48/48/0/0`、wire
`48/48/48/48`、schema `42 canonical + 6 extension discarded`、semantic `1/0.996875/0.9984375`、L2 anchor
`1`、usage `17732/654` 与 `0.05712 CNY`。Gate 固定
`schema_recovery_mock_quality_not_evidence / qualityAuthority=none`，不能形成 Provider 或产品 authority。

## 10. 原子路线

| 阶段 | 内容                                                                 | 当前状态              |
| ---- | -------------------------------------------------------------------- | --------------------- |
| SR0  | L3 只读复盘、两层 schema、bounded diagnostic、独立 lineage 与路线    | 已完成，zero-provider |
| SR1  | TDD 实现 envelope/parser、selection projection、strict schema/merger | 已完成，zero-provider |
| SR2  | Provider-like/held-out/metamorphic/no-leak/fault matrix              | 已完成，zero-provider |
| SR3  | 新 report/runner/CLI/journal/artifact/validator/crash-only seal      | 已完成，zero-provider |
| SR4  | Reviewed Mock、全量 static/history parity、Reader Testing            | 已完成，zero-provider |
| SR5  | Fresh admission 后唯一新 lineage controlled-Live                     | 下一任务，阻断        |
| SR6  | 仅 SR5 pass 后的 Docker/API/可见浏览器/Trace/精确清理                | 阻断                  |
| SR7  | 仅 SR6 pass 后的 main 合并、远程推送与 default-off 回放              | 阻断                  |

每个阶段单独提交并推送当前 Phase 6.9.7 功能分支；不创建 worktree 或子分支。SR0--SR4 均不得读取
credential、调用 Provider、执行正式 Live、启动产品 Docker/API/browser 或修改业务数据。

## 11. SR0 禁止事项

- 不猜测 L3 具体失败字段、Provider 原文或外部唯一根因；
- 不修改、删除、移动、重建、seal 或 recover L3 marker/journal/artifact/tag；
- 不运行 `full-gate:live`、production CLI、curl、单 case 或任何 Provider 探测；
- 不把 extension discard 设计成字符串 coercion、默认 ordinal、clamp 或答案表；
- 不让模型返回 depth、answer structure、route、tool、permission、真实 ID 或写命令；
- 不让 diagnostic 保存 raw output、Zod value/path、unknown key 名、prompt、credential 或用户正文；
- 不修改 frozen dataset、baseline、threshold、budget、timeout、owner/stale/write authority；
- 不把 SR0、未来 SR1--SR4 或 Mock 写成真实模型/产品可用；
- 不执行产品 Docker/API/browser、main、Phase 6.9.8/6.10/8/9 或博客收尾。

## 12. 回顾时可以问

- 为什么 L3 能定位到 `content_parsed -> schema_validated` 之间，却不能定位具体字段？
- 为什么当前 `{intentIndex}` 已很小，仍会受到 `json_object` 与 strict Zod 边界差异影响？
- 两层 schema 如何允许丢弃无权威扩展字段，却不放宽模型的业务权限？
- 为什么字符串数字、alias、clamp 和 default 仍必须拒绝？
- 为什么 diagnostic 只 hash 枚举化 shape，而不 hash raw completion？
- 为什么 S3 canonical responder 通过不能替代 Tutor Provider-like shape matrix？
- 为什么新修复必须使用独立 lineage，不能修改或重跑 L3？
- 为什么未来新 full-gate pass 之后仍需独立产品和 main 验收？
