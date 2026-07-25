# Phase 6.9.7 Tutor / WrongQuestionOrganizer V3 R1 安全诊断与零网络兼容验收

日期：2026-07-24

状态：R1 已完成；本轮严格停止在 R2 前。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

实现起点：`06b14cf868ab21cf484eedbcfea9177a2770ef55`

提交主题：`feat(agent): add phase 6.9.7 v3 failure evidence`

设计 authority：
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v3-remediation-design.md`

执行计划：
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v3-remediation.md`

## 1. 结论

R1 已完成 V3 安全诊断投影与 zero-network compatibility harness：Provider failure 只以固定安全
枚举进入 V3 runtime evidence；`runtimeInvocations` 由实际 delegate boundary recorder 记录，不再由
outer catch 猜测；配置、factory、请求整形、DeepSeek V4 Pro non-thinking response audit、schema 与
abort/timeout 均能在 sentinel/fake-fetch 环境中回归。

R1 不包含 scheduler breaker、固定 48 runtime 分母 report、双 lane run ledger、CLI、marker、
journal、evidence publisher、真实 Provider 或产品验收。V1/V2 两条失败 authority 保持不可变；
Phase 6.9.7 仍未完成，也不能据此声称 Tutor/Organizer 已生产可用。

## 2. 范围与非目标

本轮完成：

- 独立 V3 identity 与兼容边界；
- 受信 Provider category/structured-output stage 的有界投影；
- 单调执行阶段、execution outcome、usage disposition 与严格组合；
- delegate-boundary `0/1` invocation recorder；
- outer harness dispatch 前后故障的本地归因；
- V1/V2 absent-field 兼容；
- zero-network adapter compatibility matrix。

本轮明确未做：

- 不读取根 `.env`、真实 credential 或供应商账号设置；
- 不调用 DeepSeek 或其它 Provider；
- 不创建 V3 Live CLI、授权变量入口、marker、journal 或 evidence；
- 不启动 Docker service、API、headed browser 或创建业务数据；
- 不修改 dataset/SHA/baseline/threshold/model/price/budget/timeout/retry/权限/写入边界；
- 不删除、重跑、覆盖、重建或重新解释 V1/V2；
- 不开始 R2、R3、R4、Task 13/main、Phase 6.10 或博客收尾。

## 3. V3 identity 与 prompt 不变性

| 维度                             | R1 固定值                                                                 |
| -------------------------------- | ------------------------------------------------------------------------- |
| runner identity                  | `phase-6.9.7-tutor-organizer-runner-v3`                                   |
| Tutor prompt identity            | `tutor-model-candidate-v3`                                                |
| Organizer prompt identity        | `wrong-question-organizer-model-candidate-v3`                             |
| runtime evidence                 | `phase-6.9.7-v3-runtime-evidence-v1`                                      |
| Tutor prompt content SHA-256     | `sha256:91be509194de33c8d99d7a09fa6ef387c6f31aa06d19d8fd970800731047fc6a` |
| Organizer prompt content SHA-256 | `sha256:2947cea2a7bc5d64c9daf29d8b371e9825bc0423d707ff173a2c5057ee9fdffd` |

两个 v3 prompt identity 只隔离未来 lineage，内容继续来自 V2 深冻结单一 policy；不同 frozen case
得到同一 system prompt，prompt 不包含 case ID 或 expected answer。R1 没有改变 Tutor/Organizer
schema/projection、语义 policy、本地 merger 或安全权限。

## 4. 安全诊断合同

### 4.1 Provider 投影

V3 只接受 `@repo/ai` 的八类固定 Provider category：

`http_auth | http_rate_limit | http_client | http_server | transport | structured_output |
invalid_response | unknown`

只有 `structured_output` 可以附带固定 stage：

`provider_json_parse | provider_type_validation | provider_object_missing`

投影只读取 plain own-value property，并验证 `status=failed + errorCode=PROVIDER_ERROR`；hostile
prototype/getter、未知枚举或冲突组合 fail-closed。ordinary candidate sanitizer 保留这个固定
`structuredOutputStage`，但 raw error/message/cause/stack、响应正文、prompt、credential、URL/header
与真实 ID 均不会进入 V3 evidence。

### 4.2 单调执行证据

`lastCompletedStage` 只能按以下顺序单调推进：

`config_validated -> executor_ready -> request_validated -> delegate_started -> delegate_returned ->
response_audit_passed -> structured_object_captured -> dynamic_contract_passed ->
local_merger_passed -> applied`

invocation recorder 只在进入 delegate 时从 `0` 变为 `1`。`runtimeInvocations=0` 不得到达
`delegate_started` 或后续阶段；`runtimeInvocations=1` 不得停留在 delegate 前。canonical 阶段只在
前一层真实完成后推进，不会因为诊断字段而越级。

### 4.3 Execution 与 usage

V3 contract 固定区分：

- `executed_success / executed_failure`；
- `attempted_aborted / attempted_orphaned`；
- `not_started_case_guard / not_started_quality_breaker / not_started_parent_abort /
not_started_orphaned`；
- `harness_internal_error`。

usage 只允许 `verified / unknown_after_attempt / absent_not_attempted`。outer safe wrapper 在 delegate
前抛错时保存 `runtimeInvocations=0 + absent_not_attempted`，在 delegate 后抛错时保存
`runtimeInvocations=1 + unknown_after_attempt`；两者都使用本地 `harness_internal_error`，Provider
category/stage 为 `null`。因此本地 harness failure 不会伪装成 Provider failure，也不会把未知费用
写成零；供应商账单仍是费用 authority。

## 5. Zero-network compatibility matrix

| 边界           | R1 证据                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| config         | query-bearing/不精确 base URL 在 provider factory 前拒绝；component sentinel 不输出     |
| factory        | provider 初始化异常在 generation/fetch 前收口，raw canary 不进入安全结果                |
| request        | exact completions URL、POST、signal、`response_format=json_object`、`thinking=disabled` |
| capability     | request 不含 tools/functions/json_schema，`maxRetries=0`                                |
| response audit | reasoning content/非法 non-thinking response 被本地不透明错误收口，不保留正文           |
| schema         | synthetic structured object 分别验证 schema success/failure 与阶段边界                  |
| abort/timeout  | 本地 pending promise 观察同一 signal、timeout 与无 raw abort canary 泄漏                |
| network        | 只调用注入的 local fixture/fake fetch；没有外部 DNS/TLS/Provider 请求                   |

该 matrix 证明本地构造、分类与 signal contract，不证明真实 credential、Provider endpoint/model
compatibility、数据保留或计费结果。

## 6. V1/V2 历史完整性

V1/V2 report 的以下 V3 字段必须完全 absent，而不是 `null` 或自动默认：

`runtimeEvidenceVersion / providerFailureCategory / structuredOutputStage / lastCompletedStage /
executionOutcome / usageDisposition`

历史 SHA-256 复核：

| lineage | evidence                                                           | marker                                                             |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| V1      | `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` | `7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb` |
| V2      | `0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77` | `ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504` |

两个历史 validator 均返回 `{"ok":true,"filesChecked":1}`。V3 Live marker/journal/evidence
artifact 数量为 `0`。

## 7. 验证记录

| 门禁                          | 结果                         |
| ----------------------------- | ---------------------------- |
| R1 focused tests              | `52 passed / 182 expect()`   |
| Agent full                    | `596 passed / 6387 expect()` |
| AI full                       | `199 passed / 1054 expect()` |
| Agent typecheck / lint        | exit `0`                     |
| AI typecheck / lint           | exit `0`                     |
| V1 evidence validator         | `ok=true, filesChecked=1`    |
| V2 evidence validator         | `ok=true, filesChecked=1`    |
| Prettier / `git diff --check` | pass                         |

历史 validator 使用各自专用脚本与冻结 evidence 路径；无参数调用不是验收命令，也不能把缺少输入
产生的 `evidence_read_failed` 解释成产品失败。

## 8. 复审与停止条件

contract/security 与 docs/history 两路只读终审均无未关闭 Critical/Important。主代理拥有全部编辑、
决策与最终验证；复审未修改仓库。

交付约束是一个 R-task 对应一个源码/文档提交：R1 的实现、测试与本文由本文所在的单一提交
`feat(agent): add phase 6.9.7 v3 failure evidence` 一并交付，不拆分第二提交。完成该提交并确认工作区
clean 后，该检查点当时下一步只能开始 R2：实现 strict-gate breaker、双 lane ledger 与固定 48
runtime 分母。后续 R2 已完成，当前下一步仅 R3；证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r2-breaker-lane-ledger.md`。R4 static/Mock
checkpoint 完成并取得新的精确授权前，不得调用 Provider。
