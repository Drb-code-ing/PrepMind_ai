# Phase 6.9.7 Tutor / WrongQuestionOrganizer V3 Remediation Design

日期：2026-07-24

状态：R0--R4 已完成。V1/V2/V3 三条唯一 controlled-Live 均已失败封存且不得重跑。唯一 V3 R5
run `ff2e1a54...` 在第 14 对 Organizer `subject_authority_violation` 后熔断，最终 `27/48` strict
runtime、Tutor/Organizer semantic `0.5280555556/0.4376201923`、`quality_gate_failed`；
marker/journal/evidence 已 durable seal。V3 产品路径与 R6--R9 永久不适用；后续已另立 V4 R0
zero-provider remediation，V4 通过前 Task 13/main 与 Phase 6.10 不得开始。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

V2 失败 authority：
`docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-controlled-live-failure.md`

实施计划：
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v3-remediation.md`

## 1. 决策摘要

V2 唯一 Live 不是语义失败，而是 48 个 runtime 全部在结构化对象形成前回退。现有
`@repo/ai` 已把受信 Provider 异常压缩为固定枚举并写入安全 Trace，但 Tutor/Organizer paired
runner 在构造 case evidence 时丢弃了这些字段；宽泛 catch 又把不同失败统一改写成
`fallback_runtime_error`。同时 runner 在 24 个 paired index 上继续推进，导致首个同类故障后仍
可能调用余下 runtime。

V3 采用以下方案：

1. 复用 `@repo/ai` 的固定 Provider failure taxonomy，不保存原始异常、响应或自由文本；
2. 增加从配置、executor、请求整形、delegate、响应审计到 structured object 的有界阶段；
3. 把实际 dispatch、usage 可知性、未执行原因与 canonical stage 分开记录；
4. 先完成 24 条真实 guard zero-call，再按 pair 顺序执行 runtime，单 pair 最多双并发；
5. 任一 runtime 不满足 strict success 时，固定 `48/48` 门已不可能通过，立即打开 run-level
   quality breaker，收口当前 pair 后不再派发；
6. Tutor/Organizer 保持独立 lane、credential、预算、AbortController 与故障归属，run breaker
   只停止后续派发，不把一条 lane 的故障类别复制给另一条 lane；
7. marker、append-only journal、case ledger 与 hard-link evidence 组成一次性证据链；崩溃后只
   允许零网络 seal，不恢复或重放 Provider 调用；
8. 使用独立 runner/prompt/授权/marker/journal/evidence identity，V1/V2 字节保持不变；
9. 先做完整零网络 static/Mock checkpoint 并停止，只有新的精确用户授权才能执行一次 V3
   branch controlled-Live；
10. 只有 V3 全部门通过，才进入新的 V3 产品 Docker/API/headed-browser 路径。

V3 的目标是一次性补齐“能定位、会熔断、不丢状态、不误归因”的工程边界，而不是通过增加重试
把偶发成功拼成质量证据。

## 2. V1/V2 不可变事实

| 维度               | V1                                      | V2                                      |
| ------------------ | --------------------------------------- | --------------------------------------- |
| run ID             | `39a62241-0f51-45be-a423-0d13b0b60ae4`  | `67ce18dd-e2ed-4a05-8507-2a98898b8ede`  |
| runner             | `phase-6.9.7-tutor-organizer-runner-v1` | `phase-6.9.7-tutor-organizer-runner-v2` |
| zero-call          | `24/24`                                 | `24/24`                                 |
| strict runtime     | `27/48`                                 | `0/48`                                  |
| Tutor semantic     | `0.3485119048`                          | `0`                                     |
| Organizer semantic | `0.7000000000`                          | `0`                                     |
| verified usage     | `48`                                    | `0`                                     |
| final gate         | `quality_gate_failed`                   | `quality_gate_failed`                   |

V1 evidence/marker SHA-256：

- evidence：`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5`；
- marker：`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。

V2 evidence/marker SHA-256：

- evidence：`0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77`；
- marker：`ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504`。

四个文件不得删除、改名、覆盖、重建、拼接、重新发布或解释为另一版本的 authority。V3
validator 必须拒绝 V1/V2，V1/V2 validator 也必须拒绝 V3。

## 3. 已证实事实与未知边界

### 3.1 当前可以确认

- V2 CLI、runner/filename identity、marker/evidence exclusive-create 与 validator 生效；
- 24 条 guard case 都在 Provider 前保持 zero-call；
- Tutor 与 Organizer 各进入 24 次 runtime，全部没有形成 structured object；
- canonical validator 与 local merger 没有开始；
- deterministic fallback、owner、权限和 mutation 边界没有扩大；
- V2 report 没有可验证 usage，P95 的毫秒级数值不能解释为成功性能；
- `@repo/ai` 已具备安全的 Provider failure category 与 structured-output stage；
- paired runner 的 eval result/case-entry 构造没有投影上述 Trace 字段，宽泛 catch 进一步丢失归因。

### 3.2 当前不能确认

- V2 的真实 credential 是否正确注入；
- Provider 是否收到、保留或计费请求；
- 失败具体位于 executor factory、请求整形、代理/TLS/DNS、HTTP auth/rate-limit、model/endpoint
  compatibility、response audit、structured output 或其它边界；
- V2 prompt 在真实模型上的语义质量；
- 毫秒级失败是否代表“没有出网”或“没有费用”。

V3 R0 不读取 `.env`、不调用 Provider，因此只能设计如何获得安全证据，不能宣称已经修复上述
未知项。

## 4. 范围与非目标

### 4.1 本设计覆盖

- Provider failure category 从 runtime Trace 到 paired case/evidence 的无损安全投影；
- 配置、executor、请求、delegate、响应审计、structured output 与 canonical/local merger 分层；
- 零网络 config/request/response/abort compatibility harness；
- 固定分母下的 strict gate breaker、双 lane 隔离、dispatch ledger 与 usage 可知性；
- marker、journal、崩溃 seal、hard-link evidence 与 cross-version validator；
- static/Mock、一次 V3 controlled-Live、产品验收、main 回放的停止条件。

### 4.2 本设计不覆盖

- 不改变冻结 72-case dataset、SHA、expected、baseline、threshold 或分母；
- 不改变 Tutor/Organizer 的语义 policy、schema、projection、本地 merger 或 accepted labels；
- 不把 case ID、oracle、expected output 或答案表写入 prompt；
- 不改变 DeepSeek V4 Pro non-thinking JSON、价格、单 case budget、timeout、`maxRetries=0`；
- 不让 Tutor 选择 `answer_direct` 或拥有最终 Chat 回答；
- 不让 Organizer 接触 userId、真实 ID、JWT、工具或数据库命令；
- 不改变 owner snapshot、三阶段 stale fence、Trace admission、用户 locked-name 与本地写 authority；
- 不新增自动 retry、补跑、provider exactly-once 或 durable background job 声明；
- 不开始 R8 产品验收、Task 13/main、Phase 6.9.8、Phase 6.10 或博客收尾。

## 5. V3 identity 与版本隔离

| 维度                      | V3 冻结值                                                                   |
| ------------------------- | --------------------------------------------------------------------------- |
| dataset                   | `phase-6.9-tutor-wrong-question-v1`                                         |
| dataset SHA               | `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`          |
| runner                    | `phase-6.9.7-tutor-organizer-runner-v3`                                     |
| Tutor prompt identity     | `tutor-model-candidate-v3`                                                  |
| Organizer prompt identity | `wrong-question-organizer-model-candidate-v3`                               |
| schema/projection         | 继续使用各自 v1                                                             |
| model/mode                | `deepseek-v4-pro` / non-thinking JSON object                                |
| approval env              | `PHASE_6_9_7_V3_CONTROLLED_LIVE_APPROVED`                                   |
| confirmation              | `I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V3_CONTROLLED_LIVE_ONCE`              |
| marker                    | `.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live.marker`                |
| journal                   | `.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live-<runId>.journal.jsonl` |
| evidence                  | `.tmp/phase-6-9-7-tutor-organizer-v3-<scope>-<mode>-<runId>.json`           |

两个 v3 prompt identity 只隔离新 lineage；实际语义 policy 必须继续来自 V2 的深冻结单一规则源。
R1 已记录稳定 prompt content hash：Tutor 为
`sha256:91be509194de33c8d99d7a09fa6ef387c6f31aa06d19d8fd970800731047fc6a`，Organizer 为
`sha256:2947cea2a7bc5d64c9daf29d8b371e9825bc0423d707ff173a2c5057ee9fdffd`，并证明没有新增
case-specific 文本。若实现中必须改变
schema/projection、模型、价格、预算、timeout 或质量门，必须停止并修订本设计，不能静默借用 V3
identity。

V3 report 新字段对 V1/V2 必须完全 absent，而不是 `null` 或自动补默认。每个 checkpoint 都复核
V1/V2 四个 SHA。

## 6. 有界故障与执行证据合同

### 6.1 复用 Provider failure taxonomy

V3 直接复用 `MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES`：

- `http_auth`；
- `http_rate_limit`；
- `http_client`；
- `http_server`；
- `transport`；
- `structured_output`；
- `invalid_response`；
- `unknown`。

`structured_output` 可附带现有固定 stage：

- `provider_json_parse`；
- `provider_type_validation`；
- `provider_object_missing`。

只有受信 AI SDK/一方 adapter boundary 产生的 runtime Trace 才能设置 Provider category。外层
harness catch 不得伪装成 `unknown` Provider failure，而应记录本地执行失败；不允许从 message、
status text、stack 或自由字符串重新猜测 category。

### 6.2 最后完成阶段

V3 runtime entry 新增 nullable `lastCompletedStage`，只允许：

`config_validated | executor_ready | request_validated | delegate_started | delegate_returned |
response_audit_passed | structured_object_captured | dynamic_contract_passed |
local_merger_passed | applied`

规则：

- zero-call 与真正未派发 runtime 为 `null`；
- 每层只在该层完整成功后推进，失败时保留上一层；
- `delegate_started` 只证明调用进入 delegate，不证明 Provider 收到请求；
- `delegate_returned` 只证明 delegate 返回，不证明 response audit、usage 或 schema 通过；
- `structured_object_captured` 后才允许 existing canonical stage/reason 非空；
- `applied` 必须与 `candidate_applied`、canonical `applied/null` 和 strict success 一致。

### 6.3 Runtime execution outcome

V3 runtime entry 新增固定 `executionOutcome`：

- `executed_success`；
- `executed_failure`；
- `attempted_aborted`；
- `attempted_orphaned`；
- `not_started_case_guard`；
- `not_started_quality_breaker`；
- `not_started_parent_abort`；
- `not_started_orphaned`；
- `harness_internal_error`。

并新增 `usageDisposition`：

- `verified`：正安全整数 usage 与价格均可验证；
- `unknown_after_attempt`：dispatch 已开始，但 usage 缺失或进程/请求未安全收口；
- `absent_not_attempted`：ledger 证明 executor 从未开始。

一致性要求：

| outcome                      | runtimeInvocations | usage disposition            | Provider category   |
| ---------------------------- | ------------------ | ---------------------------- | ------------------- |
| `executed_success`           | `1`                | `verified`                   | `null`              |
| `executed_failure`           | `1`                | 通常 `unknown_after_attempt` | 仅受信 Trace 可非空 |
| `attempted_aborted/orphaned` | `1`                | `unknown_after_attempt`      | 不推断              |
| `not_started_case_guard`     | `0`                | `absent_not_attempted`       | `null`              |
| `not_started_*`              | `0`                | `absent_not_attempted`       | `null`              |
| `harness_internal_error`     | ledger 决定 `0/1`  | 与是否已 dispatch 一致       | `null`              |

现有 safe wrapper 不得再无条件写 `runtimeInvocations=1`。实际 counter 与 journal ledger 才是
authority。只要调用可能已经越过 delegate，就不得声称 zero usage、未计费或未到 Provider；供应商
账单继续是费用 authority。

### 6.4 报告聚合

V3 report 固定保留：

- planned cases `72`、zero-call `24`、runtime `48`、paired indexes `24`；
- 每个 Provider category、structured stage、execution outcome 的计数；
- `executorStartedCases`、`usageVerifiedCases`、`usageUnknownCases`、`notStartedCases`；
- Tutor/Organizer 各自 breaker/ledger/budget/abort 摘要；
- `latencySampleComplete` 与各 lane 实际样本数。

未执行 runtime 仍占 48 固定分母并使 strict success 为 false。P95 只能从真实完成样本计算；样本
不完整时可以保留 diagnostic 数值，但 `latencySampleComplete=false`，质量门必须失败，不能再次把
提前失败的低毫秒数解释为性能通过。

### 6.5 禁止落盘内容

V3 case、journal、marker、evidence、stdout 和文档不得保存：

- API key、Authorization、cookie、token、base URL query、完整 header；
- raw exception、message、cause、stack、HTTP/provider body；
- prompt、system/user message、题目、答案、active context、topic 原文；
- raw model output、完整 response、真实 user/question/deck ID 或 ordinal 映射；
- 自由文本 failure reason。

只保存版本、hash、case ID、固定 enum、计数、时长、正 usage 与价格结果。

## 7. 零网络 compatibility preflight

R1--R4 只允许 synthetic/sentinel 输入，不读取根 `.env` 或真实 credential：

1. **config matrix**：sentinel key 验证 live/global gate/component gate、精确 URL、model、mode、
   timeout、价格与 component-specific credential；不输出 sentinel；
2. **executor factory**：注入 fake provider/fetch，证明 factory 收到预期 base URL、model 与 JSON
   mode，generic/cross-component key 不能替代；
3. **request shaping**：本地 recorder delegate 验证 exact completions URL、POST、
   `response_format=json_object`、`thinking=disabled`、无 tools/functions/json_schema；
4. **response audit**：synthetic fixture 覆盖 malformed JSON、empty/invalid response、401/403、429、
   4xx、5xx、no-status transport、usage 缺失/非法、reasoning content 与 structured failures；
5. **schema boundary**：fake structured executor 分别返回合法/非法 object，验证
   `structured_object_captured` 与 canonical stage 的分界；
6. **abort/timeout**：fake pending promise 验证 signal、timeout、listener cleanup 和零 retry；
7. **no-network sentinel**：测试若触及真实 `globalThis.fetch` 立即失败，stdout/fixture 扫描不含
   secret-like、prompt 或 raw response material。

该 harness 只能证明本地构造和分类合同，不能证明真实 credential、DNS/TLS、Provider endpoint、
model compatibility 或账单。

### 7.1 R1 实现 checkpoint

R1 已把上述兼容合同落为零网络源码与测试：

- V3 runtime evidence 使用独立 `phase-6.9.7-v3-runtime-evidence-v1`，只接受八类 Provider
  category、三个 structured-output stage、十个单调完成阶段及固定 execution/usage outcome；
- `runtimeInvocations` 由 delegate boundary recorder 从 `0` 单次推进为 `1`，outer safe wrapper
  不再在 catch 中猜测；dispatch 前后的 harness failure 分别保留 `absent_not_attempted` 与
  `unknown_after_attempt`，且 Provider category 必须为 `null`；
- ordinary candidate sanitizer 仅保留受信固定 `structuredOutputStage`，raw error、response、prompt、
  credential、URL/header 与自由文本均不进入投影；
- V1/V2 report schema 继续拒绝 V3 字段，历史 bundle validator 与四个 SHA 保持不变；
- compatibility matrix 使用 sentinel component key、注入 provider/fetch 与本地 pending promise，
  覆盖 config、factory、exact request shaping、V4 Pro non-thinking response audit、schema、abort/timeout；
  没有外部 Provider、Docker/API/browser 或业务数据操作；
- V3 Live marker/journal/evidence artifact 数量保持 `0`。

R1 没有实现 scheduler breaker、双 lane run ledger、固定分母 report、durable journal 或 CLI；这些只
能在 R2/R3 继续实现。验收证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r1-diagnostics-compatibility.md`。

## 8. 调度、熔断与固定分母

### 8.1 执行顺序

V3 run 固定顺序：

1. 零网络身份、历史 SHA、tracked defaults、config 与 publisher preflight；
2. `wx` 预留 marker，创建并 fsync 初始 journal；
3. 执行 24 条 guard case；任一 guard 失败则 runtime 调用总数必须为 0；
4. 按 `pairedRunIndex=0..23` 顺序推进；每 pair 的 Tutor/Organizer 最多同时各一个调用；
5. 每次 dispatch 前以 `(runId, agent, pairedRunIndex)` 检查 lane ledger，重复 key fail-closed；
6. 当前 pair 两个结果都收口后，才允许下一 pair；
7. 形成完整 72-entry report，验证并 hard-link 发布 evidence。

最大网络并发为 2，不并发多个 pair。Tutor 与 Organizer 不共享 call/token budget；每 case 仍分别是
`1/1200/300` 与 `1/3500/800`，不存在失败 lane 借用另一 lane 预算。

### 8.2 Quality breaker

固定门要求 `48/48 strict runtime`。因此任一 runtime 进入 fallback、usage 不可验证、schema/merger
失败、abort、timeout 或 harness failure 后，本轮已经数学上不可能通过；V3 不需要等待“三次同类
失败”才熔断。

R2 必须实现一个不读取 semantic expected 的显式 `runtimeContractSuccess(entry)` predicate；只有同时
满足以下条件才返回 true：runtime entry、真实 `runtimeInvocations=1`、
`rawSchemaValid=true`、`candidateDisposition=candidate_applied`、
`canonicalSchemaSuccess=true`、canonical diagnostic 为 `applied/null`、latency 存在、
`usageDisposition=verified` 且 usage/price 可验证、四类 safety failure 均为 false。
`runtimeContractFailure` 定义为 runtime entry 且上述 predicate 为 false；breaker 只消费这个
predicate，不读取 intent/subject/topic 等 semantic expected 或 semantic score；
`executionOutcome=executed_success` 必须由 predicate=true 派生，不能反过来参与 predicate 形成循环。

规则：

- 首个 runtime contract failure 打开 `quality_gate_impossible` run breaker；
- 如果同 pair 另一 lane 仍在执行，立即传播 run abort，但等待它有界收口；
- 已开始的 sibling 记录自己的真实结果或 `attempted_aborted`，不得复制首个 failure category；
- 后续 pair 全部写 `not_started_quality_breaker`、`runtimeInvocations=0`、category/stage/usage=null；
- 不自动 retry、不重跑失败 case、不跳过原 case 后补其它 case；
- report 仍有 48 个 runtime entry，strict/semantic/usage/latency completeness 门失败；
- 若 48 个 runtime 都 strict success，才完整计算 semantic、P95、usage、价格与最终 gate。

`candidate_applied` 但与 fixture expected 不一致属于语义评分问题，不是 runtime contract failure，
不会提前打开 breaker；它必须继续完成全部 runtime 后按冻结 semantic metric 统一判定。breaker 只在
`48/48 strict runtime` 已经不可达时早停，不能用局部语义猜测提前结束质量评测。

这既避免 V2 式 48-call failure storm，也不通过删分母美化结果。

### 8.3 Lane 与路由隔离

- Tutor lane 只绑定 Web/Tutor executor、credential、budget、timeout、abort 与 case ledger；
- Organizer lane 只绑定 Server/Organizer executor、credential、budget、timeout、abort 与 case ledger；
- paired eval 不冒充真实 `/api/chat`、最终流式回答、Organizer single/batch 产品调用；
- run breaker 可以停止全局后续派发，但不能把 Tutor 的 auth/transport 分类记到 Organizer，反之亦然；
- 未执行 lane 的 provider category 必须为 `null`；
- 产品 `web/chat` 与 `server/single|batch` 不共享 eval breaker/ledger；未来产品验收使用独立 lineage；
- Organizer 本地 command、owner lock、stale fence 与补偿逻辑不由 eval breaker 修改。

### 8.4 R2 实施状态（2026-07-25）

R2 已新增独立 V3 scheduler、case/report schema 与双 lane dispatch ledger。24 条 guard 全部先行；
runtime 只按单 pair 双并发推进，首个 `runtimeContractSuccess=false` 后只 abort 当前 sibling，后续
pair 保留为 `not_started_quality_breaker`。Tutor/Organizer 使用独立 AbortController，忽略 abort
的 sibling 由调度层有界收口为 orphaned/unknown usage，不复制触发 lane 的 Provider category。

V3 report 始终保留 72 case、24 guard、48 runtime 与 24 paired index；strict、semantic、usage、
P95、预算、ledger 和 outcome/category/stage counters 均由 strict schema 重算。首/中/末失败、两种
lane 完成顺序、abort/orphan race、guard failure、duplicate key、跨 lane usage cap、semantic-only
mismatch 与 no-leak 回归已通过。V1/V2 validator 与四个历史 SHA 不变；R2 checkpoint 当时 V3 Live artifact 为 0。
验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r2-breaker-lane-ledger.md`。

## 9. Marker、journal、崩溃恢复与 evidence

### 9.1 单胜者与 durable journal

- marker 使用 `wx`，并发进程只有一个 winner；
- marker 仅保存 schema/runner/runId/scope/mode/`attempt_reserved` 等固定字段；
- marker 成功后、任何 executor 创建前，必须以 `wx` 创建 journal 并 fsync 初始记录；
- journal 为 append-only JSONL，记录 hash chain、sequence、case dispatch/terminal、breaker 与 seal
  状态；每条只有固定 enum/hash/计数，不保存内容；
- `dispatch_started` 必须先 durable，再调用 executor；因此崩溃时宁可保守标记 usage unknown；
- journal/marker 的目录、普通文件、symlink/reparse、权限与 I/O 异常分开 fail-closed。

### 9.2 崩溃后只 seal，不 resume

新增零网络 orphan sealer：

- 只在 marker 存在、final evidence 不存在时读取并验证 journal；
- 不读取 credential、不创建 executor、不接受 Live approval、不调用 Provider；
- 已 terminal case 保持原结果；`dispatch_started` 未 terminal 的 case 记
  `attempted_orphaned + unknown_after_attempt`；
- 从未 dispatch 的 case 记 `not_started_orphaned + absent_not_attempted`；
- 生成固定 72-entry `quality_gate_failed` evidence；
- marker 永久保留，sealer 不恢复、不重放、不补跑；
- journal 缺失时，因合同禁止 journal 初始化前 dispatch，可封存为本地 evidence 初始化失败；
- final evidence 已存在时只验证同 hash，任何不同字节或路径冲突 fail-closed。

### 9.3 Evidence 发布

- report 先过 V3 strict schema、identity、分母、ledger、stage/category/outcome/usage 组合与敏感字段扫描；
- 随机唯一 temp 使用 `wx` 写入并 fsync；
- hard-link 到固定 final path，final `EEXIST` 只允许 same-byte hash 的幂等读取，不允许覆盖；
- hard-link 成功后 final 是 authority，temp cleanup failure 只留下可精确回收 orphan；
- marker、journal、evidence 三者 runId/runner/hash chain 必须一致；
- publisher failure 保留 marker/journal，退出非零，后续只能走零网络 sealer。

本地机制只能保证 run-level 单胜者与不重放，不能声明 Provider exactly-once。delegate 已开始但进程
崩溃时，是否被 Provider 接收/计费仍未知。

### 9.4 R3 实施状态（2026-07-25）

R3 已新增独立 V3 CLI、confirmation、approval env、marker、journal、evidence prefix 与 validator。
marker 使用 `wx` 并记录 owner PID；marker 后、executor 创建前先 fsync journal 初始化，每条
`dispatch_started` 也必须先 fsync。append-only JSONL 通过 sequence、previous-record SHA 与
record SHA 组成 hash chain，并以严格状态机约束 guard、dispatch、runtime/pair terminal、breaker、
run completion 与 seal。

marker owner 存活时 sealer 拒绝误封；死亡 owner 由 token recovery claim 单胜者接管，同 claim
只能 reserve 一个 appender。takeover 后旧 appender 每次 append 前被 fence；在单主机 PID
liveness 合同下，旧 release 在任何 rename 前先验证 canonical token，不会触碰新 owner claim。
journal writer close 会 drain 已接受 append。该 claim 不作为跨主机分布式 lease。

零网络 sealer 对 dispatch 无 terminal 的 lane 生成
`attempted_orphaned + unknown_after_attempt`，对从未 dispatch 的 lane 生成
`not_started_orphaned + absent_not_attempted`，保留全部固定分母且不 resume/replay/retry。evidence
通过随机 temp `wx` + fsync + hard-link final 发布；same bytes 幂等，不同 bytes、非普通文件、
symlink、错误路径与 hash mismatch 均 fail-closed。该本地合同覆盖进程崩溃与受测 I/O 故障，不
声明突然断电后的目录元数据持久性或 Provider exactly-once。

durability `21/21` tests、`228 expect()`，V3 focused `50/50`、Agent `629/629`、AI `199/199`、V1/V2 validator 与四个
历史 SHA 通过；V3 Live marker/journal/evidence/recovery claim 为 0。没有读取 credential、调用
Provider、启动 Docker/API/browser 或修改业务数据。验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r3-crash-safe-evidence.md`。

## 10. RED/GREEN 与故障注入矩阵

实现至少覆盖：

1. 八类 Provider category、三类 structured stage 与未知/不受信依赖；
2. runtime Trace -> candidate -> eval result -> case evidence 不丢 category/stage；
3. 外层 catch 不伪装 Provider failure；
4. V1/V2 新字段 absent，三版 validator/filename 双向拒绝；
5. config/factory/request/response/schema/abort 全部 zero-network synthetic harness；
6. 24 guard 任一失败后 runtime executor 0-call；
7. 首个 runtime contract failure 后不派发下一 pair，剩余 case 固定进入分母；
8. sibling abort 记录自己的 outcome，不继承另一 lane category；
9. 重复 dispatch key 单胜者，预算冻结，无 retry；
10. incomplete latency/usage 不通过质量门，不能产生虚假低 P95 success；
11. marker `wx` 并发单胜者、journal sequence/hash-chain、crash before/after dispatch；
12. orphan sealer 不读 key、不调用 executor、不重放；
13. hard-link success + unlink failure、orphan temp、target `EEXIST`、hash mismatch 与普通 I/O；
14. stdout/evidence/journal 敏感字段扫描；
15. Tutor/Organizer lane、credential、budget、abort 与 route scope 隔离。

## 11. V3 static/Mock checkpoint

R4 必须在同一 clean HEAD 完成：

- V3 focused contract/adapter/runner/CLI/validator/publisher/recovery suites；
- Agent/AI/Types/Server/Web 受影响 full gates、typecheck/lint/build；
- Organizer PostgreSQL E2E 与 Compose quiet boundary；
- 冻结 deterministic baseline；
- fresh V3 Mock：24/24 zero-call、48/48 strict runtime、semantic 1/1；
- breaker/failure Mock：最多当前 pair 的实际调用，剩余 case 0-call 且固定分母；
- V1/V2 四个 SHA 不变；V3 Live marker/journal/evidence 不存在；
- tracked mock/live=false、Tutor/Organizer gate=false、component credential empty；
- 无 synthetic 账号/题目/Trace/browser storage 残留；
- contract/security/concurrency 与 operations/acceptance 两路独立只读复审。

Mock 即使满分也必须是 `quality_gate_failed`，因为 `mock_synthetic` / `synthetic_test` 不是语义
authority。checkpoint 通过后必须停止并请求新的精确 V3 branch controlled-Live 授权。

R4 已按此合同完成：fresh V3 Mock 为 `24/24` zero-call、`48/48` strict runtime、Tutor/Organizer
semantic `1/1`；首对 strict failure 的 breaker report 只启动 Tutor/Organizer 各一次并保持余下
46 个 runtime 0-call、固定分母 48。权威证据见
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-r4-static-mock.md`。

## 12. 唯一 V3 controlled-Live

当时授权必须同时重新确认 DeepSeek 账号的数据保留/训练边界，并明确写出
“Phase 6.9.7 Tutor/Organizer V3 branch controlled-Live once”。旧 V1/V2 授权不能复用。

执行前仍需零网络 preflight；真实 credential 只在授权后的子进程中映射为两个 component-specific
变量，不修改根 `.env`，不输出值。其它 Agent gate 显式关闭，不启动产品 Docker。

质量门完全不变：

- `24/24` verified zero-call；
- `48/48` strict runtime；
- critical / permission / mutation / broader fallback 全部 `0`；
- Tutor/Organizer semantic 均 `>=0.85`；
- 两 lane 相对冻结 baseline 提升均 `>=0.15`；
- Tutor/Organizer/paired candidate P95 `<=2500/4500/4500ms`；
- Tutor orchestration P95 `<=6500ms`；
- 48 个 usage、价格、逐 case/aggregate CNY 与 cap 全部可验证；
- `executorProvenance=deepseek_network`；
- marker/journal/evidence/ledger/validator 全部完整。

任一门失败都封存一次性 V3 lineage，不重跑、不进入产品验收。breaker 早停是失败证据，不是可
补跑的“部分测试”。

实际 R5 已命中该失败分支：唯一 run `ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc` 保持
`24/24` guard zero-call；第 14 对 Organizer 的结构化对象在本地动态合同命中
`subject_authority_violation`，breaker 打开。最终 `27/48` strict runtime、28 个 verified usage、
20 个 runtime 未启动，Tutor/Organizer semantic `0.5280555556/0.4376201923`；P95、pricing 与总
CNY 因分母不完整保持 `null`，gate 为 `quality_gate_failed`。权威证据见
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-controlled-live-failure.md`。

## 13. 通过后的产品路径

**实际状态：不得开始。** 只有 V3 `quality_gate_passed` 才创建新的 V3 产品 lineage；实际 R5 已
失败封存：

1. Tutor-only Docker Chat：implicit/context/conflict applied、explicit zero-call、forced failure；
2. Organizer-only API：single/batch、existing/high-confidence zero-call、owner/locked-name、Trace、
   usage/price 与组织层唯一写入；
3. headed `/chat` 与 `/error-book`，覆盖 1440/510/390px，窗口保持可见；
4. 精确清理本轮 synthetic user/question/group/deck/item/Trace/session/browser storage；
5. 恢复 mock/live=false、两个 gate=false、component credential absent；
6. 保留容器、镜像、PostgreSQL、Redis、MinIO 与所有 volumes；
7. 分支终审后才允许 Task 13 `--no-ff` 合并 main；
8. main 不重跑 V1/V2/V3 Live，只做 committed authority、静态/Mock 与 default-off 产品回放；
9. main acceptance 提交后推送并核对远程 SHA parity。

V2 R8 作为“因 V2 失败而未启动”的历史步骤永久不适用；未来产品验收属于 V3 通过后的新路径，
不能回填成 V2 成功。V3 R6--R9 也因 R5 失败而不适用，不能回填成 V3 成功。

## 14. 回顾问题

- 为什么 `deepseek_network` 不等于 Provider 已接收请求或返回 usage？
- 为什么现有 runtime 有 failure category，V2 evidence 仍只看到 `fallback_runtime_error`？
- 为什么 V3 不采用三次重试，而是在首个 runtime contract failure 后停止？
- 为什么未执行 case 必须保留在 48 分母，不能删除或补跑？
- 为什么 sibling abort 不能继承触发 breaker 的另一 lane 故障类别？
- `delegate_started`、Provider 已接收和 Provider 已计费为什么是三个不同命题？
- 为什么崩溃后只允许 seal，不允许 resume/replay？
- journal 如何区分“从未调用”和“可能已调用但 usage 未知”？
- 为什么 incomplete P95 即使数值很低也不能通过性能门？
- 为什么 V3 static/Mock checkpoint 仍不能证明产品真实可用？
