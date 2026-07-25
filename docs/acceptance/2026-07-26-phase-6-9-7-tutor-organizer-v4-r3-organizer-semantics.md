# Phase 6.9.7 Tutor / WrongQuestionOrganizer V4 R3 Organizer 语义验收

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：R3 已完成；该检查点当时下一步为 R4，后续 R4/R5 已完成；当前停在 R6 新精确 Live
授权门前。

## 1. 为什么需要本轮

V3 Live 的 Organizer 在第 14 对命中 `subject_authority_violation`，已执行样本还暴露 topic 与
required evidence 命中不足。R1 虽把 validator reason 细分为固定链路，但 prompt、动态校验与 merger
仍需要共享同一份可执行语义矩阵；否则继续只改 prompt 会让模型要求、产品接受条件和测试再次漂移。

R3 只收敛模型可作出的组织决策，不扩大权限。Owner、真实 ID、用户锁定名称、错题事实、deck 写入、
stale 判断与最终 command 继续由本地代码掌握。

## 2. 本轮实现

### 2.1 单一深冻结 policy

`packages/agent/src/policies/wrong-question-organizer-policy.ts` 统一定义：

- known subject 只能 `keep_local`，且必须包含 `structured_subject`；
- unknown subject 必须从 bounded taxonomy 选择，禁止 `keep_local`；
- `reuse_existing` 只能引用同学科 deck ordinal，并要求 `existing_deck_overlap`；
- `create_topic` 必须生成安全、精确、由题意支持的单一 topic；
- 具体题意要求 `semantic_topic`，明确 `errorType` 要求 `error_pattern`；
- `insufficient_signal` 仅允许 medium，且不能与正向 evidence 混用；
- high confidence 只能由结构化 category/knowledge point、明确错误模式或同学科 overlap 支撑。

Formatter、dynamic validator 与 merger 共用这份 policy。Merger 只应用已通过校验的 ordinal decision，
不会补 evidence、替换越权 subject 或清洗非法 topic，从而使坏模型输出显式 fail-closed。

### 2.2 权限、并发与失败边界

- 模型只能看到有界 projection，并返回 question/deck ordinal；不能获得 owner、真实 ID、JWT、用户
  锁定名称、数据库命令或工具权限；
- owner-scoped snapshot、前后 stale fence、advisory-lock 内第三次 revalidation 与本地
  model-free command 保持不变；
- 每个 single/batch request 仍最多一次 Provider 调用，Organizer 独立 `1/3500/800` 预算；
- HTTP abort、timeout、usage 校验、Trace admission 与 no-retry/fallback 规则没有放宽；
- 旧 deterministic Organizer 没有被当作模型 merger authority。

### 2.3 历史隔离

产品默认 candidate 已更新为 `wrong-question-organizer-model-candidate-v4`。公共 V1/V2/V3 paired
harness 显式调用只读 Organizer V2 candidate，避免 V4 prompt 或 validator 改写历史 evidence。已验证：

- V2 formatter SHA 为
  `sha256:e1489fb8b41d635471243b863ea59cd89db08ea5a52e4919ae7e265c5174c257`；
- V3 Organizer prompt content SHA 为
  `sha256:2947cea2a7bc5d64c9daf29d8b371e9825bc0423d707ff173a2c5057ee9fdffd`；
- 冻结 72-case dataset、SHA、baseline `6/48` 与原 semantic 指标不变；
- V1/V2/V3 report schema、validator、marker/journal/evidence 没有重建、重跑或改写。

## 3. 验证证据

| 验证项                            | 结果                         |
| --------------------------------- | ---------------------------- |
| Organizer R3 focused              | `45 passed / 571 expect()`   |
| Agent 全量                        | `656 passed / 6896 expect()` |
| Server Organizer focused          | `50 passed / 8 suites`       |
| Agent TypeScript                  | `tsc --noEmit` 通过          |
| Server production build           | `nest build` 通过            |
| 权限/并发/历史隔离两路只读复审    | 无 Critical / Important      |
| Provider / Docker / API / browser | 未执行                       |

Server 全仓 test-source `tsc --noEmit` 仍会命中仓库既存测试类型问题；本轮以受影响 Server 测试和 production
build 为回归 authority，不把既存问题包装成 R3 回归或在本提交顺带修复。

## 4. 本轮明确没有做什么

- 未读取 `.env` 或任何 component credential；
- 未调用 DeepSeek 或其他 Provider；
- 未创建 V4 runner、CLI、approval、marker、journal、evidence 或 Live artifact；
- 未启动 Docker、API 或浏览器；
- 未修改 PostgreSQL、Redis、MinIO、Docker volume 或业务数据；
- 未执行 R4 robustness/lineage、R5 static/Mock checkpoint 或 R6 controlled-Live；
- 未合并 main 或推送远程。

## 5. 下一步与停止条件

该检查点当时下一步仅执行 R4：建立与冻结 72-case dataset 隔离的 held-out/metamorphic/schema-negative fixtures，
验证 prompt 泄漏、authority drift、reorder、abort、预算与写隔离，并创建完全独立的 V4
runner/approval/marker/journal/evidence/validator lineage。R4 已按该边界保持 zero-network 完成，证据见
`2026-07-26-phase-6-9-7-tutor-organizer-v4-r4-robustness-lineage.md`。后续 R5 static/Mock checkpoint 与
独立终审也已完成，见 `2026-07-26-phase-6-9-7-tutor-organizer-v4-r5-static-mock.md`；当前已停在 R6
精确一次性 V4 Live 授权门前。

R5 static/Mock checkpoint 已全部通过并停止；用户此前的“继续/所有权限”不替代新的、精确的一次
V4 branch controlled-Live 授权。Phase 6.9.7、产品 Docker/API/浏览器验收、Task 13/main 与 Phase
6.10 仍未完成。
