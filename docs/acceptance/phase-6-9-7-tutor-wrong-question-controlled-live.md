# Phase 6.9.7 Task 12 — Tutor / WrongQuestionOrganizer Controlled-Live 与产品验收

日期：2026-07-24

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：用户已在 Task 11 之后明确接受 DeepSeek 当前账号的数据保留/训练边界，并授权一次 branch controlled-Live；唯一 Live 尚未执行。零网络 preflight 发现并修复 Router/Verifier gate 名称不一致，未创建 marker/evidence、未读取 credential、未调用 provider、未启动产品 Docker/API/浏览器。

## 1. 本次授权范围

用户授权原文：

> 我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7 Tutor/Organizer branch controlled-Live。

授权只覆盖 Task 12 的固定顺序：零网络 preflight、唯一 72-case Live、质量门通过后的 Docker/API 与 headed 可见浏览器验收、精确合成数据清理和 default-off 恢复。无论 Live 成功或失败，marker/evidence 都必须保留且不得重跑、覆盖、删除或拼接。

## 2. 为什么在唯一 Live 前增加 hardening

Task 9 CLI 试图要求其它已模型化 Agent gate 全部关闭，但 Router/Verifier 使用了不存在的 `ROUTER_AGENT_MODEL_ENABLED` / `KNOWLEDGE_VERIFIER_AGENT_MODEL_ENABLED`；产品实际 gate 是 `ROUTER_MODEL_ENABLED` / `KNOWLEDGE_VERIFIER_MODEL_ENABLED`。旧实现因此不能证明这两个真实产品 gate 已关闭。

该缺口发生在 marker 预留之前，不能用“本次环境碰巧是 false”替代代码修复。唯一 Live 必须运行在已提交、可复验、fail-closed 的正确 preflight 上。

## 3. RED / GREEN 与最终边界

- RED：新增六个其它生产 Agent gate 的参数化测试后，`ROUTER_MODEL_ENABLED=true` 未被识别，synthetic harness 进入 Live 并返回报告；focused 为 `6 pass / 1 fail`，证明缺口真实存在。
- GREEN：CLI 改用 `ROUTER_MODEL_ENABLED` 与 `KNOWLEDGE_VERIFIER_MODEL_ENABLED`；六个其它 gate 任一为 `true` 都返回 `live_configuration_invalid`，executor invocation 为 0，repo 外临时 marker/evidence 由测试 finally 精确清理。
- 覆盖的其它生产 gate：Router、KnowledgeVerifier、Review、Planner、KnowledgeDedup、KnowledgeOrganizer；本阶段目标 Tutor/Organizer 两个 gate 必须为 `true`。
- `REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED` 等独立历史验收入口不属于生产模型 gate；实际 Task 12 进程仍会显式保持其为 `false`，且不会启动任何其它验收 runner。

## 4. 验证结果

| 验证项 | 结果 |
| --- | --- |
| CLI focused RED | `6 pass / 1 fail`，正确暴露真实 gate 漏检 |
| CLI focused GREEN | `7/7`，`41 expect()` |
| Agent full | `543/543`，`5598 expect()` |
| Agent typecheck | exit `0` |
| Agent lint | exit `0` |
| `git diff --check` | exit `0` |
| 独立 gate 名称复核 | 八个生产模型 gate 完整；无旧名称残留 |

本轮测试只使用 repo 外临时目录与 synthetic executor，没有触碰仓库唯一 Live marker/evidence。

## 5. 下一步与停止条件

本 preflight hardening 提交后，必须先确认分支/提交/工作区 clean、唯一 marker/evidence 不存在、tracked defaults 与运行时其它 gate 关闭，再从进程级变量注入两条 component credential 并执行唯一 72-case Live。只有 `quality_gate_passed` 才进入 Docker/API 与 headed 浏览器；否则封存终态并停止产品验收。

回顾时可以问：

- 为什么环境里实际是 `false` 也不能忽略错误 gate 名称？
- 为什么 gate 校验必须发生在 marker 与 executor 之前？
- 为什么 RED 使用 repo 外 synthetic marker 不会消费真正的一次性授权？
- 为什么 Live 质量失败后不能继续做产品 Docker 验收？
