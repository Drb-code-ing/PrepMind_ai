# Phase 6.9 Agent Paired Evaluation Report

> 用途：比较同一脱敏数据集上的 deterministic baseline 与 Mock / Live candidate。
> 禁止记录完整 prompt、完整模型输出、API key、cookie、token 或真实用户数据。

## 运行信息

- 日期：填写实际运行日期
- 数据集版本：填写固定数据集版本
- Git SHA：填写被测提交
- Agent：`router / verifier / memory / orchestrator`
- Baseline 模式：`deterministic`
- Candidate 模式：`mock / live`
- Provider / model：填写供应商和模型；Mock 填 `mock`
- Prompt version：填写稳定版本号
- 输入 / 输出 token 上限：填写本次预算

## 指标

| 指标 | Baseline | Candidate | 门槛 | 结论 |
| --- | ---: | ---: | ---: | --- |
| 质量分 | 填写 | 填写 | 按 Agent 设计 | 填写 |
| Critical failures | 填写 | 填写 | `0` | 填写 |
| p95 额外延迟 | `0` | 填写 | 按 Agent 设计 | 填写 |
| 输入 token | `0` | 填写 | 预算内 | 填写 |
| 输出 token | `0` | 填写 | 预算内 | 填写 |
| 估算成本 | `0` | 填写 | 预算内 | 填写 |

## 失败样本摘要

只记录 `caseId`、结构化 expected/actual、错误码和脱敏原因。不得粘贴完整输入或完整输出。

| Case ID | Baseline | Candidate | Critical | 脱敏原因 |
| --- | --- | --- | --- | --- |
| 填写稳定 case id | 填写结构化结果 | 填写结构化结果 | `yes / no` | 填写 |

## 启用决策

- Enabled：`yes / no`
- Reason：`quality_gate_passed / invalid_metrics / insufficient_quality_gain / critical_failure / latency_budget_exceeded / cost_budget_exceeded`
- Fallback：填写模型不可用、超时或 schema invalid 时的确定性降级路径
- 审阅人：填写实际审阅人

## 清理

- [ ] 已恢复 Mock
- [ ] 未提交 API key 或 provider 原始响应
- [ ] 已清理临时账号、测试会话、候选记忆和情景记忆
- [ ] 报告只包含合成或脱敏 case
