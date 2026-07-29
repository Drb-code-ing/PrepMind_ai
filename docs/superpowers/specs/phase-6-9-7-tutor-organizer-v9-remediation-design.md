# Phase 6.9.7 Tutor / WrongQuestionOrganizer V9 本地合法 Option 选择设计

日期：2026-07-29

状态：R0 zero-provider 复盘与设计、R1 option authority/selection contract、R2 Provider-like robustness、
R3 runner/lineage/durability 与 R4 reviewed Mock/full checkpoint 已完成。R4 仍为 zero-provider，正式 V9
artifact=0；下一原子任务仅 R5 新的精确一次性 branch controlled-Live 授权门。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起始提交：`6f37b34aa54642da43171e6e2e1a854cbd304d4b`

R1 实现起点：`780c5037435ea62b43417a8a5cae9577fe4c7abc`

历史 authority：

- `docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v8-controlled-live-failure.md`
- `.tmp/phase-6-9-7-tutor-organizer-v8-branch-live-7ff09c36-50f2-445a-b309-dc9500e5e13c.json`
- `.tmp/phase-6-9-7-tutor-organizer-v8-controlled-live.marker`
- `.tmp/phase-6-9-7-tutor-organizer-v8-controlled-live-7ff09c36-50f2-445a-b309-dc9500e5e13c.journal.jsonl`

本文件不授权读取 credential、调用 Provider、执行任何 V8/V9 Mock/Live/seal/recovery、启动产品
Docker/API/browser、修改业务数据或合并 main。

## 1. 决策摘要

V8 R5 的四条真实 response 都完成 JSON parse、fixed-shape schema 与 usage validation，说明 V7 的静态
shape 缺口已经修复。第二条 Organizer 随后在本地 dynamic shortlist authority 失败，固定分类为
`fallback_schema_invalid / dynamic_contract`，bounded reason 为 `dynamic_authority`。脱敏 evidence 没有
保存具体 ordinal 或内部 reason，因此不能确认失败究竟来自 fingerprint、question coverage、subject、
deck action、deck/topic index 还是 cross-subject 关系。

可以确认的结构性问题是：V8 仍要求模型独立返回并组合四项 authority-bearing 数据：

```text
shortlistFingerprint + subjectIndex + deckAction + targetIndex
```

每一项静态类型都合法，组合后仍可能不属于当前题目的本地合法决策。继续扩写 prompt 不能消除这种
组合空间。V9 改为由本地先枚举完整合法决策，模型只返回：

```text
questionIndex + optionIndex
```

模型仍负责在多个合法 subject/deck/topic 方案之间做语义选择；本地代码只限制权限空间，不替代模型的
语义判断。

## 2. 当前源码边界

| 层                                               | 当前职责                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `wrong-question-organizer-v5-shortlist.ts`       | 构造 owner-scoped shortlist、subject/topic/deck ordinal 与 fingerprint  |
| `wrong-question-organizer-v8-model-contract.ts`  | 校验 fixed shape，再解释 subject/action/target 的动态组合               |
| `wrong-question-organizer-v8-runtime-adapter.ts` | 截获 V6 runtime，执行 V8 schema/validator，并把结果映射回 V6            |
| `wrong-question-organizer-v6-model-candidate.ts` | post-provider stale fence、完整 V6 validator、本地 merger 与 confidence |
| Organizer server snapshot/service/command        | READ ONLY snapshot、事务外双 fence、Serializable + advisory lock 最终写 |

V8 dynamic validator 的失败集合包含 fingerprint、完整覆盖、重复/越界 question、subject authority、eligible
action、deck/topic range 与 cross-subject。V9 不改写或放宽这些历史检查；它在新的独立 contract 中把可被
模型选择的空间提前收敛为本地已验证 option。

## 3. V9 模型输出合同

V9 Organizer 模型只能返回原生 JSON：

```json
{
  "decisions": [
    {
      "questionIndex": 0,
      "optionIndex": 1
    }
  ]
}
```

固定规则：

- 顶层只允许 `decisions`；
- 每项只允许 `questionIndex` 与 `optionIndex`；
- 两者都是 JSON 安全整数，不接受字符串、浮点、`null`、coercion 或默认值；
- 必须完整覆盖本次所有 projected question，每题恰好一次；
- 禁止 fingerprint、subject/deck/topic 字段、label、ID、confidence、reason、evidence、answer、route、tool、
  permission 或 write command；
- 禁止 Markdown、prose、wrapper、snake_case 与额外字段。

V9 **不要求模型回显** shortlist 或 option-set fingerprint。Fingerprint echo 不是认证机制，且本身属于 V8
动态失败集合。同步单次 runtime 已在本地闭包中绑定当前 option authority；response 只能按该闭包解释。
本地 validator 使用捕获的 authority 注入既有 shortlist fingerprint，再调用完整 V6 validator/merger。

## 4. 本地 Option Authority

R1 新增独立 `WrongQuestionOrganizerV9OptionAuthority`，只从已通过
`validateWrongQuestionOrganizerV5Shortlist` 的 authority 派生。它至少包含：

- 独立 version、rules version 与冻结 rules SHA；
- `sourceShortlistFingerprint` 与仅本地保存的 `optionSetFingerprint`；
- `provenance=local_deterministic`；
- 每题稳定的 `questionIndex`；
- 每题 `options[]`，内部 option 保存完整 `resolvedSubject + subjectDecision + deckDecision`；
- prompt-safe projection 只暴露 option ordinal、bounded subject/action/target label/source，不暴露真实 ID、
  owner、locked-name 写权限、confidence 或 command。

合法 option 生成规则：

1. structured subject 只能使用本地 subject；非 structured subject 只遍历该题已暴露的
   `subjectCandidates`；
2. `reuse_existing` 只枚举 resolved subject 相同的现有 deck；
3. `create_topic` 只枚举该题 resolved subject 相同的 topic candidate；
4. canonical topic 已对应现有 deck 时不生成 create option；locked-name collision 同样不生成；
5. option 按 `questionIndex -> subject ordinal -> action rank -> target ordinal` 确定性排序并重新编号；
6. canonical 相同映射只保留一个，任意重复、空映射、hostile getter/proxy 或非 plain data 都 fail-closed；
7. 每题最多 24 个 option、全请求最多 144 个 option；实际 projection 还必须满足 Organizer
   `3500` input-token 上限；
8. bounded allocator 先保留每个 `(question, subject, eligible action)` bucket 的一个 option，再按稳定顺序
   补齐；若 mandatory coverage 已越过 hard/token cap，则在 Provider 前 zero-call 回退，禁止悄悄删除整类
   语义选择。

`optionSetFingerprint` 由 rules identity、原 shortlist fingerprint、排序后的完整本地 option 映射和公开
projection 共同计算。它用于本地 drift、Trace/source manifest 与测试，不进入模型输出，也不把真实 ID
写入 prompt/evidence。

### 4.1 Zero-option 与构建失败终态

R1 必须把“没有合法 option”与“authority 输入无效”分开，不能继续依赖含糊的空数组：

| 场景                                                                                        | attempted / disposition / reason                                                     | 本地返回与公开状态                                                                                                                        |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| V5 shortlist 本身无法派生                                                                   | 保留历史 `false / fallback_invalid_input / <V5 reason>`                              | 只有此时允许既有 `EMPTY_RESULT`：`binding=null`、`suggestions=[]`；这不是 V9 no-option                                                    |
| shortlist 有效，但任一 projected question 的合法 option 为 0                                | 固定 `false / not_eligible / candidate_option_authority_empty`                       | 必须保留既有 `buildLocalResult()` 的 binding 与逐题 `selection.source=deterministic` suggestions；usage=`0/0`，无 candidate runtime Trace |
| mandatory bucket coverage 无法同时满足 `24/question`、`144/request` 或 input-token hard cap | 固定 `false / fallback_budget_exceeded / candidate_option_authority_budget_exceeded` | 保留同一 deterministic local result，不允许删 bucket 后继续调用；公开为 local degraded fallback                                           |
| option authority 的 version/rules/plain-data/fingerprint 构建失败                           | 固定 `false / fallback_invalid_input / candidate_option_authority_invalid`           | shortlist 已成功时保留 deterministic local result；不得伪装成 no-option                                                                   |

`not_eligible` 路径在产品 API 继续投影为
`source=local_deterministic / disposition=not_eligible / degraded=false`；只要本地 organize command 正常完成，
HTTP 仍返回既有成功 envelope。上述四类在 Provider 前结束，不创建 executor、reservation、dispatch 或模型
Trace。任何一题无 option 都使整个 request 回退，禁止 partial batch、默认 option 或把其它题的 option 复制
过来。

### 4.2 Prompt-safe label 与字段边界

V9 不新造一套宽松的 label sanitizer，而是复用现有 Organizer 完整字段安全链：

1. source 先经过 plain-data clone 与 strict schema；深度 `8`、数组 `256`、对象 key `512`、总节点
   `4096`，accessor、Proxy、symbol key、cycle、非 plain prototype 或超限结构 fail-closed；
2. V9 只接受通过 `validateWrongQuestionOrganizerV5Shortlist` 的 V5 authority。V5 对允许的 source
   字段在任何裁剪前以最多 `16384` UTF-16 code unit 完整扫描；超过上限固定为 `field_too_large` 并整份
   拒绝，不做受限截断。问题侧允许
   `subject/category/errorType/questionText/analysis/knowledgePoints/status/updatedAt`，deck 侧允许完整
   `subject/name/keywords/updatedAt`；其中 model-facing 文本拒绝 malformed UTF-16、C0/DEL control、Unicode
   `Cf`、credential、instruction override、system prompt exfiltration 与 tool/write instruction，
   `status/updatedAt` 不进入 prompt；`answer/userNote` 不属于 V5 source schema，若出现会作为未知额外字段
   strict fail-closed 为 `invalid_input`，不会扩展 V5 schema 或改变历史 fingerprint/SHA；
3. 完整扫描通过后才允许 NFKC、trim、lowercase、空白归一化和邮箱 redaction；
4. V9 公开 projection 使用按层级固定的 key allowlist。Option 只能含 `optionIndex`、固定 enum
   `subjectLabel/actionLabel/sourceLabel` 与可选 `targetLabel`；任意额外 key，包括 credential/token/cookie/
   authorization/secret 类 key，都不是可忽略 metadata，而是整份 fail-closed；
5. `subjectLabel/actionLabel/sourceLabel` 只能来自本地固定 enum；`targetLabel` 只能来自已经完整扫描的 deck
   name 或 topic candidate。所有公开 label 最多 `80` 个 Unicode scalar，必须先完整扫描再裁剪；禁止先裁剪
   再扫描尾部；
6. V5 authority 的 category、error type 与每个 knowledge point 最多 `96` scalar，question/analysis excerpt
   各最多 `320` scalar，knowledge point 最多 `12` 个；deck keyword 不进入 V9 projection。V5 不接受的
   `answer/userNote`、真实 ID、owner hash、fingerprint 映射、locked-name authority、
   confidence/reason、credential、Trace、permission 与 command 永不进入 projection。

最终 projection 在估算、hash 和 runtime 调用前再次 strict parse、递归 key allowlist 检查并 deep-freeze。
R2 必须用尾部 credential、Unicode/Cf/control、恶意额外 key 与 hostile descriptor 反例证明这些规则不是
只检查被展示的前缀。

## 5. Selection Validator 与 V6 Merger

V9 selection validator 按以下顺序执行：

1. 验证 option authority 自身 version/rules/fingerprint/深冻结 plain-data 合同；
2. 验证 decision 数量、question 完整覆盖、唯一性与范围；
3. 对每题只在该题 `options[optionIndex]` 中取值；越界立即拒绝，不猜测、不 clamp、不 repair；
4. 使用本地 option 重建完整 V6 `subjectDecision/deckDecision`，shortlist fingerprint 只取本地 authority；
5. 再次运行既有 `validateWrongQuestionOrganizerV6ModelDecision`；
6. 继续运行既有 `mergeWrongQuestionOrganizerV6ModelDecision`，由本地重建真实 question/deck ID、名称、
   confidence、reason/description 与 binding。

因此合法 option 不可能形成 cross-subject、ineligible action 或不存在的 deck/topic 组合。模型如果返回未知
`optionIndex`，只会成为新的 bounded selection failure，不会获得任何映射或写权限。

## 6. 快照、并发与写权限不变

V9 不改变产品已有三阶段 authority：

1. 最多 12 题在 owner-scoped `REPEATABLE READ + READ ONLY` 事务中形成 immutable snapshot；
2. Provider 前与 candidate 后在事务外重新派生并比较 snapshot/shortlist/option-set authority；
3. model-free command 进入 owner advisory lock 保护的 `Serializable` 写事务后执行最终 fence；
4. rename/move/remove/organize 继续共用 owner lock，P2034/serialization 只允许 bounded whole-transaction
   retry；Provider 永不 retry；
5. abort 在 snapshot、Provider、post-fence 与 command admission 边界传播，事务开始后只完成最小本地收口；
6. single/batch 每个 HTTP request 仍最多一次 Organizer Provider dispatch；候选丢失、timeout、Trace admission
   失败或任一 fence 漂移都使用确定性 fallback，不补发任务；
7. 用户 rename/move/remove 与 `force` authority、locked deck、真实 ID、FSRS/WrongQuestion 事实、Trace admission
   和写命令始终由 server 控制。

Option enumeration 在 Provider 前由同一 frozen snapshot 派生；post-provider 与最终 command fence 不只比较
模型选择，而是重新验证 owner snapshot。这样 option 索引不会成为绕过 TOCTOU/ABA 的捷径。

### 6.1 同步请求与 durable runner 的任务丢失语义

产品 Organizer 仍是同步 HTTP request-scope candidate，不写入 `BackgroundJob` 或 Outbox，也不宣称跨进程
Provider exactly-once。进程在 Provider dispatch 后退出时，连接可能中断且没有可保证的 HTTP terminal；
服务端不会后台补发。若数据库 command 已提交但 response 丢失，PostgreSQL facts、owner lock 与三阶段 fence
仍是业务 authority；客户端的后续请求是新请求，不得被描述成旧 Provider task 的 resume/replay。

正式 V9 eval runner 则必须 durable 地解释每个固定分母 entry：

- `lane_reserved` 必须在 executor 前 fsync；正常路径随后记录 wire stage，并且恰好一个
  `runtime_terminal`；
- reserved lane 在进程故障后缺 terminal，只能由 zero-provider recovery seal 成
  `executionOutcome=attempted_orphaned / failureCategory=orphaned /
candidateDisposition=fallback_runtime_error`，并保留已持久化 wire stage 推导的四类计数；
- 未 reserved 的 entry 按 journal 事实分别为 `not_started_case_guard`、
  `not_started_quality_breaker` 或 `not_started_orphaned`，不得复制 sibling failure；
- transport、HTTP、abort、schema、usage 或 dynamic selection failure只要已经 reserved，就必须写显式
  runtime terminal、真实 `lastCompletedStage` 与固定 failure category；不得静默消失成 no-option，亦不得伪造
  option diagnostic；
- report 固定公开 `reservedEntries/terminalEntries/orphanedEntries/notStartedEntries`、dispatched/completed
  pair、breaker state/trigger，以及由 stage 重算的 executor/dispatch/response/verified-usage 计数；固定 48
  分母与 incomplete aggregate=`null` 不变。

## 7. Bounded Diagnostic

V9 使用新的独立 diagnostic identity，只允许固定 reason 与计数/type-shape hash：

- `top_level_shape`
- `top_level_keys`
- `decisions_type`
- `decisions_count`
- `decision_shape`
- `decision_keys`
- `question_index`
- `option_index`
- `selection_coverage`
- `selection_authority`
- `option_authority`
- `unknown`

只保存固定 shape/count/type bucket、`shapeFingerprint` 与 `rawDataRetained=false`。禁止保存原始 optionIndex、
未知 key 原文、prompt、response、Zod path/value、error/body/header、credential、URL、题目正文、label 或真实
ID。诊断失败本身必须退化为 `unknown`，不得影响主 failure 的安全收口。

## 8. 不变的质量、预算与评测

- V2 dataset/expected/baseline bytes 与既有 semantic authority 不改；
- 72 cases、24 guard、48 runtime、24 pair、32 Organizer decisions 不改；
- 24/24 guard 必须实际证明 Provider 前 zero-call；
- Tutor candidate/prompt/timeout/预算完全不改；
- Tutor `1/1200/300`，Organizer `1/3500/800`，总 Live cap `0.55 CNY`；
- pair 串行、pair 内最多双 lane、single dispatch、no retry/resume/replay/backfill；
- 首个 runtime contract failure 收口当前 pair 后打开 breaker，固定 48 分母不缩小；
- 任一 runtime/wire/usage/latency 不完整时 semantic/P95/token/CNY 全 `null`；
- model-owned Organizer subject/deck/topic axes 从本地 option 映射后评分，不能把本地合法性当成模型语义正确；
- Mock 满分仍固定 `mock_quality_not_evidence`，不能拼接 V8 的三条 success。

### 8.1 确定性 input-token estimator

V9 冻结 `phase-6.9.7-v9-candidate-input-estimator-v1`，复用当前共享算法而不是声称使用 DeepSeek
tokenizer：

```text
estimate = 64 + ceil(utf8Bytes(parts.join("\n")) / 3)
```

`utf8Bytes` 按当前手写 UTF-16 遍历实现计算：ASCII=`1`、`<=0x7ff`=`2`、合法 surrogate pair=`4`、其它
code unit=`3`；估算器本身不做 Unicode normalization。V9 的 parts 必须固定为
`[V9_SYSTEM_PROMPT, canonical JSON prompt projection, V9_SCHEMA_DESCRIPTOR]`，projection 使用固定字段构造顺序
与稳定 option 排序后 `JSON.stringify`，三段之间只插入单个 LF。`estimate > 3500` 才拒绝，`=3500`
允许进入 reservation；reservation 仍为 `1/3500/800`。

candidate 与 runtime adapter 必须调用同一 helper、同一 parts builder 并要求 estimate 完全相等，不能保留
V8 当前一处包含 schema descriptor、另一处只重算 system+user 的组成差异。R1 导出 estimator version、helper
source SHA 与 prompt/policy/option rules SHA，R3 再把这些 identity 绑定进 source manifest。Identity 或重算值
不一致固定为 `fallback_invalid_input / candidate_option_authority_invalid`；只有一致重算后超过 cap 或 mandatory
coverage 无法装入预算，才是
`fallback_budget_exceeded / candidate_option_authority_budget_exceeded`。ASCII、CJK、emoji、combining mark、
边界 `3499/3500/3501` 与跨 Bun/Node 相同输入必须形成固定 fixture。

该 estimate 只是调用前的确定性保守预算，不替代 Provider verified `prompt_tokens`。Provider usage 仍需为正
安全整数并位于正式 cap 内；未知、超限或与完整 runtime contract 不一致时 fail-closed，不能用 estimate
伪造 verified usage、P95 或费用。

### 8.2 R2 robustness 收敛结果

R2 的独立 fixture identity 为
`phase-6.9.7-tutor-organizer-v9-r2-provider-shapes-v1`，冻结 SHA 为
`sha256:0870799257dcd2b88841b286b9cc64e6410702fe2bcbe86c6e153d8af88a4200`。Fixture 和 synthetic
responder 均不读取 V2 expected/oracle，也不调用生产 builder/validator 生成答案；synthetic direct adapter
只解析实际 bounded prompt。

Provider-like fault matrix 发现并关闭三项实现偏差：

1. V9 collector schema 必须以精确 in-process identity 标记 strict JSON content，禁止 Markdown fence、prose
   或 BOM 被兼容解析器剥壳后进入 V9 schema；
2. JSON parse 已完成但 Zod 在 `provider_type_validation` 失败时，公开 disposition 必须为
   `fallback_schema_invalid`，不能误归类为 runtime failure；
3. runtime 结果 sanitation 必须使用无副作用 canonical schema，不能复用 observer schema 对 transport/
   parse failure 的 `undefined` 伪造 `top_level_shape` diagnostic。

以上收敛不改变 V9 decision shape、R1 prompt/estimator/option-rules SHA、V2 dataset、V6 merger、预算、
timeout、产品 wiring 或 V1--V8 artifact。`NaN/Infinity/unsafe integer` 不能由合法 JSON 表达，因此只在本地
schema/diagnostic 边界测试；Provider-like fixture 不伪造非法 JSON 数字。

### 8.3 R3 runner / lineage / durability 收敛结果

R3 已建立独立 V9 report/runner/CLI/approval/marker/journal/evidence/recovery/validator。Runner 固定
`72/24/48/24/32`、guard-first、pair 串行、pair 内双 lane、single dispatch/no retry、首 runtime contract
failure breaker 与 incomplete aggregate 全 `null`；R4 已接入 reviewed Mock factory，Live factory 继续硬
拒绝到 R5。

Source manifest 已冻结并绑定：

- source manifest：
  `sha256:dfb13b9dc97b0bb2c2d80920bdbb1147467a40a53eab24098d7d376788976651`；
- selection contract：
  `sha256:85fdf2cde033e90922d62956b921b64816eaf3a41060f40d0a39cc183ff89050`；
- runner runtime：
  `sha256:861121455a8365662186e0a821e88ed002095da403af8061a3bb8bea651226d3`；
- V7 wire alias：
  `sha256:6ff323dfa548d4ca73ba5e8bb1ed7fa0d72be2de9ee3fe57b1080c0f98991f17`；
- bounded diagnostic：
  `sha256:8d66f5a198060b44579c80e823d686814fa5fff6a582faa78cab2059f7ebba7f`；
- eval policy：
  `sha256:ab8ed3539f4868d773930777c89cfc66138e44c3899c6f7ae7d6e8697386d74a`；
- semantic authority：
  `sha256:1982561f3e01b4bd1f15f525866df2d34e124c18cd7fb20917c4e004c264f951`。

实际 input estimator SHA 已进入 source manifest，并与 frozen estimator SHA 一起在 module load 时校验；
prompt/option-rules 保持同样的 actual/frozen drift guard。V9 transport 仍显式继承 V7 8-stage wire，不伪造
新的 AI export。

R3 的 zero-provider fault matrix 覆盖 guard failure、transport/HTTP/schema/usage、selection/option
authority、first/middle/last breaker、fixed denominator、single dispatch/no retry、sibling abort 本地归属与
aggregate 全 `null`。该矩阵只验证 runner/wire/durability；后续 R4 已把 reviewed Mock 穿过正式 V6
Tutor、V9 Organizer candidate 与 V6 merger。

`lane_reserved` 必须 append + fsync 后才能进入 executor。First-party Live provenance 如果没有完整 durable
lifecycle，会在 guard/executor 前以 `PHASE_6_9_7_V9_DURABLE_LIVE_LIFECYCLE_REQUIRED` 拒绝；crash-only
recovery 仍只 seal 持久化事实，不创建 executor、不读取 credential、不 resume/replay。正式 V9
marker/journal/evidence/recovery artifact 为 0。

### 8.4 R4 reviewed Mock / full checkpoint 收敛结果

R4 新增 V9 evaluation runtime、reviewed Mock factory 与公开 package export。Tutor 复用未修改的 V7/V6
正式 candidate；Organizer 运行 V9 option selection、V6 validator/merger 与第一方 direct adapter，只有
`fetch` delegate 为 synthetic。Responder 只解析实际 bounded prompt，禁止读取 expected/oracle 或用生产
validator生成答案。Factory identity 为
`sha256:e0918cbfa23ee4463c569f49db69b026d97f47597ab7cf9621579bf10465bf08`。

Fresh baseline 保持 `12/48` 与 semantic
`0.6629642857142858/0.278125/0.4705446428571429`。Reviewed Mock run
`f039a7d2-c3b2-4286-9630-fee49d365a33` 达到 `24/24` guard zero-call、`48/48` strict runtime、wire
`48/48/48/48` 与 semantic `1/1/1`；synthetic usage/cost 为 `17732/504`、`0.05622 CNY`，gate 固定
`mock_quality_not_evidence`。全量静态/PostgreSQL/Compose/历史 validator 与两路独立终审通过；Mock evidence
已精确删除，正式 V9 artifact 继续为 0。这不是 Live、真实 Provider 或产品 authority。

## 9. 独立 V9 Lineage

V1--V8 的 dataset binding、prompt/policy SHA、runner、approval、marker、journal、evidence、recovery、validator
与 physical bytes 全部不可修改。V9 在后续 R-task 新增独立：

- runner/runtime/report/source-manifest identity；
- approval env 与精确 confirmation；
- marker/journal/evidence/recovery prefix；
- bundle validator 与 V1--V8 双向 lineage rejection；
- option policy/prompt/diagnostic/held-out fixture SHA。

Transport 不变时可以像 V8 一样显式复用 V7 冻结的 8-stage wire capability，但不得伪造新的 AI wire
export。正式 V9 artifact 在 R5 精确授权前必须保持 0。

## 10. 原子路线

1. **R0**：V8 zero-provider 复盘、本地 option authority、bounded diagnostic、独立 V9 lineage 与路线。
   （本 checkpoint 完成）
2. **R1**：TDD 实现 option builder/projection、exact selection contract/prompt、validator、V6 adapter 与
   diagnostic；zero-provider。（已完成）
3. **R2**：独立 Provider-like/held-out/metamorphic/schema-negative/anti-overfit/no-leak 与 option reorder/
   cap/stale/abort/concurrency fault matrix；zero-provider。（已完成）
4. **R3**：独立 V9 report/runner/CLI/approval/marker/journal/evidence/recovery/validator，固定分母、breaker 与
   V1--V8 双向 lineage；zero-provider。（已完成）
5. **R4**：reviewed Mock、fresh baseline、全量 Agent/AI/Types/Server/Web、Organizer PostgreSQL 并发、
   Compose default-off、历史 validators、artifact=0、Reader Testing 与双路终审；zero-provider。
   （已完成；Mock gate=`mock_quality_not_evidence`）
6. **R5**：只有 R4 clean/pushed 且用户在运行当时重新接受 DeepSeek 数据边界并精确授权唯一 V9 branch
   controlled-Live，才允许执行一次；任一终态只 seal，不重跑。（当前下一原子任务，未授权）
7. **R6**：只有 R5 全门通过才允许产品 Docker/API/可见浏览器、Trace、default-off 与精确清理。
8. **R7**：只有 R6 通过且独立复审无问题才允许 `--no-ff` 合并 main、main default-off 回放和推送。

每个 R-task 单独提交并推送当前功能分支；不创建 worktree 或子分支。R0--R4 均不读取 credential、调用
Provider、启动产品 Docker/API/browser 或修改业务数据。

R1/R2/R3/R4 验收分别见
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r1-option-authority.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r2-provider-robustness.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r3-runner-lineage-durability.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r4-static-mock.md`；当前只允许在取得新精确授权后继续
R5。

## 11. 禁止事项

- 不推断 V8 `dynamic_authority` 的具体 ordinal 或外部根因；
- 不重跑、seal、recover、删除、覆盖、改写或拼接 V1--V8 artifact；
- 不让模型回显 fingerprint、自由组合 subject/action/target 或输出真实 ID/label/confidence/command；
- 不用 clamp、默认 option、partial batch、重试或 deterministic oracle 修复模型 selection；
- 不让 Mock responder读取 expected/oracle 或调用 production validator 生成答案；
- 不放宽 owner、snapshot、stale、locked-name、Trace、budget、timeout、quality、permission 或 write authority；
- 不把 zero-provider R0、后续 Mock 或合法 option builder 写成真实模型/产品可用；
- 不在 R5 前读取 credential、写 approval、创建正式 artifact 或调用 Provider；
- 不在 R6 前启动产品验收，不在 R7 前合并 main；
- 不开始 Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾。

## 12. 回顾时可以问

- “V8 fixed-shape 已通过，为什么仍会在 dynamic authority 失败？”
- “为什么 fingerprint echo 不是认证，V9 又如何绑定 response 与 owner snapshot？”
- “本地 option builder 如何保证每个 option 都是完整合法决策，而不是另一种自由组合？”
- “模型只返回 optionIndex 后，为什么仍然保留真实的语义选择职责？”
- “option cap 与 token budget 如何避免静默删除整个 subject/action bucket？”
- “V9 如何继续复用 V6 validator/merger 和三阶段 stale fence？”
- “为什么 V9 必须使用独立 lineage，而不能修改或补跑 V8？”
