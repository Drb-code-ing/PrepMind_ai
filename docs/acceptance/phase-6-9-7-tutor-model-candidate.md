# Phase 6.9.7 Task 3 — Tutor governed model candidate

日期：2026-07-23

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：Task 3 package 级实现与静态/Mock 验收完成；尚未接入 Web Chat production composition

## 1. 为什么需要这一任务

原 Tutor policy 对“直接给答案、给提示、检查步骤、解释概念、完整讲解”这类明确请求响应稳定且无需模型，但对“我还是没懂”“这里呢”“我算到这一步了”等隐含或依赖上下文的表达只能落入固定规则。Task 3 的目标不是让模型回答题目，而是让它在受限范围内判断“这次应该怎么教”，同时保留本地对 route、上下文、最终答案权限、prompt、预算和失败回退的权威。

## 2. 完成内容

### 2.1 单一 Tutor 信号来源与 eligibility

- `detectTutorSignals()` 与 `buildTutorStrategy()` 复用同一组强教学信号，不在 candidate 内复制第二套明确意图分类器；
- final route 不是 `tutor`、空输入、请求已 abort、预算不足、完整字段/metadata 不安全或 hostile accessor 时，在 runtime 前零调用；
- 明确的 `answer_direct / socratic_hint / step_check / concept_bridge / explain_solution` 单一强信号继续 deterministic zero-call；
- 只有隐含学习请求、上下文指代、多个真正冲突的教学信号，或带有效 active context 的 `general_follow_up` 才允许一次候选调用；
- “解释这里的概念”不会因为同时命中字面量“解释”而被误判成冲突；`answer_direct` 无论是否混有其他措辞都不能进入模型选择集合。

### 2.2 受治理 runtime 边界

- 新增 `ModelAgentTask='tutor_strategy'`，并通过 `@repo/ai` 的共享 `ModelAgentRuntime` 执行 strict structured output；
- 单请求上限固定为 `1 call / 1200 input / 300 output`；candidate 先做不可变 admission preview，runtime 再对原 caller snapshot 做唯一一次权威 reservation，成功预算不会重复计数；
- runtime 结果必须通过 `sanitizeModelCandidateRuntimeResult()`、Tutor strict Zod schema、intent/evidence 动态关联校验和本地 depth compatibility；
- pre-abort 与 runtime 期间 abort 都回退原 deterministic strategy；timeout、schema、usage、budget、runtime throw 或不可验证 telemetry 同样不影响既有 Chat 能力；
- observation 只保留固定 disposition/reason、已验证 usage、budget snapshot 与安全 trace，不携带用户文本、active context、prompt、provider 原文或 credential。

### 2.3 本地权威 merger

- 模型只能返回五类非 direct intent、三档 depth、medium/high confidence 与固定 evidence code；
- 本地重新计算 `shouldAskGuidingQuestion`、`shouldGiveFinalAnswer`、`shouldUseActiveStudyContext`、有序 `answerStructure`、固定 `promptAddition` 与 debug metadata；
- `socratic_hint` 永远不含 `final_answer`；模型输出和公共 merger 都不能把显式 `answer_direct` 改成模型策略；
- 模型自由文本不进入最终 prompt，route、RAG/approval 权限、最终 Chat streaming 和任何数据库写入均不属于本 candidate。

## 3. 验证证据

| 验证项 | 结果 |
| --- | --- |
| RED | candidate 模块缺失时 `0 pass / 1 fail / 1 module-not-found error` |
| Tutor focused | `16/16`，`169 expect()` |
| 冻结 eligibility cases | 12 条 zero-call 全为 0 次；24 条 runtime 全为 1 次并命中 canonical local strategy |
| Agent full | `518/518`，`5306 expect()` |
| AI full | `193/193`，`1018 expect()` |
| Agent / AI typecheck | exit 0 |
| Agent / AI lint | exit 0 |
| 独立复审 | 两路最终均无 Critical/Important |

重点回归覆盖：五类明确指令、非 Tutor route、空输入、完整冻结数据集、credential/instruction metadata、hostile top-level/safety accessor、pre/post runtime abort、预算预检、strict schema、错误 evidence、非法 depth、timeout、畸形 usage、runtime throw、Node ESM production export 与共享 runtime task 注册。

## 4. 本任务没有完成什么

- 没有读取根 `.env`、API key 或 provider credential；
- 没有创建 Live executor、调用真实 provider、启动 Docker/浏览器或创建/修改业务数据；
- 没有新增 Tutor production gate、timeout/config/价格、Chat orchestration、Trace 持久化或 response header；这些属于 Task 5；
- 没有实现 WrongQuestionOrganizer candidate；它是下一任务 Task 4；
- 没有证明 Live 语义质量、产品可用性或 Phase 6.9.7/Phase 6 全部完成。

## 5. 下一步与回顾问题

下一任务是 Task 4：实现 WrongQuestionOrganizer candidate 与本地 merger，继续只使用 Mock/注入式无网络 executor。它必须保持已有 item、精确 deck、高置信结构字段、安全失败、owner 不合格、abort 和预算不足 provider 前零调用；模型只能引用本地 question/deck ordinal，本地继续重建真实 ID、名称、reason、confidence 和写权限。

回顾时可以问：

- 为什么 TutorAgent 的 candidate 不生成最终答案？
- 为什么明确教学指令继续 zero-call，隐含/上下文意图才使用模型？
- 为什么 candidate 层先预检预算，而共享 runtime 仍要做唯一权威 reservation？
- 为什么 `answer_direct` 既不在 schema 中，merger 又要再次拒绝？
- 为什么 Task 3 完成仍不代表项目里的 Chat 已启用 Tutor 真实模型？

## 6. 后续状态同步（不改写 Task 3 验收）

Task 4 已完成 WrongQuestionOrganizer package candidate 与本地权威 merger，证据见 `docs/acceptance/phase-6-9-7-wrong-question-organizer-model-candidate.md`。Task 5 又完成 Tutor Web server-only default-off composition、Chat 编排与安全 Trace，证据见 `docs/acceptance/phase-6-9-7-tutor-web-runtime.md`；该后续状态不改写本页 Task 3 的 package 验收。Tutor controlled-Live 与 Organizer NestJS composition/真实 provider 验收仍未完成；当前下一任务是 Task 6。
