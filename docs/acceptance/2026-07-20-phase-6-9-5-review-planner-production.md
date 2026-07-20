# Phase 6.9.5 Review / Planner 生产验收收口

日期：2026-07-20

## 结论

Phase 6.9.5 的 `ReviewAgent` / `PlannerAgent` 真实模型只读建议路径已完成分支受控生产验收。该结论同时保留两类彼此不能替代的证据：

- V10 是唯一语义质量 authority：48/48 strict/quality、critical=0、P95=1465ms、usage=5764/232、CNY=0.018684/1.00。
- V22 branch product 曾在 `review_api_trace_canonicalize` 终止，随后唯一 recovery 已封存为 `recovered`；它不是质量失败，也不能重跑或改写。
- 在修复仅限 Trace 计时耦合的回归后，用户授权进行了一次独立、受控的真实产品验收：Docker API 和可见 `/plan` 页面都得到 `candidate_applied`，且随后恢复为默认关闭。

分支验收完成后，必须先提交并复验该分支，再以 `--no-ff` 合并到 `main`；只有确认 `HEAD` 属于 `main` 后，才可进行默认关闭 replay、静态复验与证据复核并推送。完成这一顺序后才可将 Phase 6.9.5 标记为最终完成。无论哪一种完成状态，都不表示整个 Phase 6.9、可执行 LangGraph、Memory、Dedup/Organizer、FinalResponse 或 Tool-Using Orchestrator 已完成；这些仍按 Agent 架构路线继续推进。

## V22 历史与修复边界

V22 的唯一产品命令在 API observation 与持久化 Trace 已生成后，因 adapter 要求 API 的 aggregate `durationMs` 与 Trace candidate-step `durationMs` 精确相等而安全终止。该比较混淆了两个独立计时边界，终态保留为 `operation_failed`，其一次 recovery 保留为 `recovered`。

修复只删除这项精确 duration 相等判断。以下约束没有放宽，并由回归测试保留：

- provider、model、candidate disposition/provenance 必须一致；
- Trace 仍须为正安全整数 duration，且 step topology 严格一致；
- input/output usage 仍须双向精确一致；
- owner scope、只读 merger、本地 facts/FSRS/分钟数/链接权威、预算和 default-off 不变。

因此 V22 仍仅是不可重跑的 `operation_failed -> recovered` 历史，最终产品证明不声称来自 V22 的重试。

## 独立受控真实模型验收

在 Docker `server` 容器内仅临时启用 `REVIEW_AGENT_MODEL_ENABLED`、`PLANNER_AGENT_MODEL_ENABLED` 和 live call gate，使用 `deepseek-v4-pro`。该窗口只用于当前账户的只读建议路径；模型仍只能在本地 snapshot 给出的 `focusIndexes` / `blockOrder` 中选择，本地 merger 重建最终事实与结果。

| 场景 | Review | Planner | Trace |
| --- | --- | --- | --- |
| 认证 API | `candidate_applied`, 945ms, 225/7 tokens | `candidate_applied`, 732ms, 222/8 tokens | `mode=live`, `model=deepseek-v4-pro`, `status=completed` |
| 可见 Docker 浏览器 `/plan` | `candidate_applied`, 1329ms, 225/7 tokens | `candidate_applied`, 839ms, 222/8 tokens | 页面实际渲染“Agent 学习建议” |

浏览器保留在已渲染的 `/plan` 页面，未作为验收清理的一部分关闭。

## 收口与清理

- Docker `server` 已恢复为 `REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=false`、`AI_ENABLE_LIVE_CALLS=false`，健康检查正常。
- 合成账户 `phase695-v23-live@example.invalid` 及其 `AgentTraceRun` 已精确删除，复核结果为 `users:0,traces:0`。
- 没有执行 Docker prune、`down -v`、数据库重置、Redis flush 或删除 volume。

## 可复核问题

- 为什么 V22 的 `recovered` 不等价于真实模型质量或产品通过？
- 为什么 aggregate API timing 与 candidate-step Trace timing 不能做精确相等判断？
- 即使验收已通过，为什么 Review/Planner 业务 gate 仍默认关闭？
- 为什么模型只能挑选索引/排序，而不能写入复习事实或创建任务？
