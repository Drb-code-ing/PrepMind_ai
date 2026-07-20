# Phase 6.9.5 Review / Planner 真实模型诊断与项目内启用设计

> **2026-07-16 v3 continuation amendment:** The v1 and v2 controlled-Live
> profiles are terminal historical records, each closed after one provider
> attempt. Do not execute this document's original Task-7 command for either
> profile. The only candidate continuation is the separately reviewed v3
> profile in
> [`2026-07-16-phase-6-9-5-controlled-live-v3-profile-design.md`](2026-07-16-phase-6-9-5-controlled-live-v3-profile-design.md).
> It introduces a new one-time schema/lock/evidence lineage and permits a
> fixed structured-output stage only in v3 controlled-diagnostic evidence; it
> does not alter v1/v2 evidence or production Agent Trace exposure.

## 1. 决策与目标

本设计从 fresh `main` 开始，不合并或重跑 `codex/phase-6-9-5-review-planner` 的终局 Live。目标是让 `ReviewAgent` 与 `PlannerAgent` 在 PrepMind 项目内以可证明的混合架构运行：真实模型负责有限的语义排序/策略判断，确定性代码继续掌握事实、权限、预算、安全和失败回退。

完成不再以“存在候选代码”定义，而必须同时满足：

1. 可以将上次 `invalid_attempted` 收敛为一个不含敏感信息的固定诊断类别；
2. 新的独立受控 Live 在固定数据集上通过质量、安全、预算、延迟和成本门；
3. Docker 项目内的 authenticated `/review-agent/suggestions` 能在临时 gate 下记录至少一次 `candidate_applied`，并在浏览器中可见；
4. 验收结束后恢复 default-off，完成 `main` 复验并 `git push origin main`。

这不是把确定性策略移除。`analyzeReview()`、`planStudy()`、FSRS 统计、容量、分钟、链接、owner 解析和所有写权限仍是本地权威；真实模型只能在这些有界事实之间作选择，不能编造或写入事实。

## 2. 现状与范围

`main@884a0b8` 的 Agent 基线为 374/374。失败分支已经验证了候选的总体形态：Review 选择当前 snapshot 中的弱点索引与固定 diagnosis code；Planner 重排本地 block 并选择固定 strategy code；一次 suggestions 请求共享 `maxCalls=2`、`maxInputTokens=1950`、`maxOutputTokens=440`。

失败分支的唯一 provider attempt 只留下 `invalid_attempted / gate=closed / usage=unknown` 六字段证据。它保护了隐私和不可重试边界，但不能说明是配置、鉴权、传输、JSON 输出、schema、usage 还是 evidence I/O 导致失败。因此本阶段不把该失败解释为模型质量失败，也不以 Docker HTTP 成功替代模型证据。

本设计只覆盖 Review / Planner。Tutor、WrongQuestionOrganizer、Memory、KnowledgeDedup、KnowledgeOrganizer、Retriever、FinalResponse 与 Orchestrator 保持后续独立阶段；不进入 Phase 6.10 记忆注入、MCP 或模型自动写操作。

## 3. 架构与职责

```text
JWT userId
  -> owner-scoped fact aggregation
  -> deterministic Review facts/result
  -> optional Review LLM candidate
  -> bounded local Review merge
  -> deterministic Planner facts/result
  -> optional Planner LLM candidate
  -> bounded local Planner merge
  -> read-only suggestion + safe model observation + Agent Trace
```

### 3.1 本地权威边界

- JWT controller 是唯一 `userId` 来源；任何 prompt、response 或浏览器参数都不能指定 owner。
- 只有 Nest service 读取 Card、ReviewLog、ReviewTask、ReviewPreference、WrongQuestion 和 deck；模型 package 不读取环境变量、数据库或密钥。
- Review candidate 只能返回当前弱点数组的至多三个 index 和一个枚举 diagnosis；Planner candidate 只能返回当前 block 的排列和枚举 strategy。
- 本地 merger 必须重新验证 index、枚举、snapshot 与预算。分钟、容量、priority、headline、链接、FSRS 事实、任务创建和所有写操作不能由模型决定。
- 输入存在 credential、prompt injection、system-prompt material、异常值、低压力或无安全事实时，candidate 必须零调用。超时、abort、schema、provider、telemetry、预算或 Trace 写入失败时，继续返回完整确定性建议。

### 3.2 模型与 gate

默认模型为 DeepSeek `deepseek-v4-flash` 的 OpenAI-compatible JSON-object 路径；`AI_MODEL` 和安全 HTTPS `AI_BASE_URL` 可被受控覆盖。真实候选只在以下组合同时成立时构造：

```text
AI_PROVIDER_MODE=live
AI_ENABLE_LIVE_CALLS=true
REVIEW_AGENT_MODEL_ENABLED=true and/or PLANNER_AGENT_MODEL_ENABLED=true
matching provider credential + safe model/base URL
```

两个业务 gate 可独立启用，默认都是 `false`，timeout 默认均为 4500ms。`AI_DEV_MODE_SWITCH_ENABLED` 不能绕过这些条件。Docker 从根 `.env` 插值，但 Compose 必须只把 Review/Planner gate 与所需 server-side allowlist 投影给 server；不能将密钥或 gate 暴露到浏览器或 worker。

## 4. 可归因诊断，再执行一次新的受控 Live

诊断不能保存或打印 raw provider 响应、HTTP body、URL query、headers、prompt、事实、模型文本、API key 或 stack。它只可产生一个严格枚举的结果：`preflight_invalid`、`executor_init`、`http_auth`、`http_rate_limit`、`http_client`、`http_server`、`transport`、`structured_output`、`invalid_response`、`usage_unverifiable` 或 `evidence_io`。

在静态/Mock 门通过后，诊断使用一个无用户事实、固定结构化请求、单 provider attempt、零重试和短 timeout。它不接触 `/review-agent/suggestions`、数据库、浏览器 storage 或 production gate。仅当诊断得到可继续的结果（成功，或已通过受控修复验证的明确类别）时，才允许一次新的 48-case controlled-Live；否则记录诊断证据、gate 保持关闭并停止。

新的 Live 运行与历史运行完全隔离：新的 run id、证据文件、报告版本、固定 case digest 和不可变 gate decision，绝不合并计数。开始前先原子写入可解析的 `reserved-evidence` 基线；任何 provider attempt 后都必须保留严格脱敏的最终或 attempted-invalid evidence。并发 discard/write 必须 fail-closed，不能丢失证据。

## 5. 质量与项目内验收门

固定 `phase-6.9-review-planner-v1` 仍为 48 case（Review 24、Planner 24、zero-call 26）。Mock 只证明工程 contract，不是模型质量证据。新的 Live 必须同时满足：

| 门 | 条件 |
| --- | --- |
| 安全/权限 | critical safety、cross-owner、write-action failure 均为 0；26 个 zero-call 全部零 provider attempt |
| 结构 | eligible provider 返回 strict schema success 100%，所有选择均映射到本次 deterministic snapshot |
| 质量 | eligible Live 语义质量至少 90%，不接受仅 transport 成功 |
| 资源 | 每请求不超过 2 calls、1950 input、440 output；每 candidate 0 retry；P95 不超过 4500ms |
| 可观测性 | usage/cost 可验证；未知定价或不可验证 usage 不能通过；Trace/response/evidence 无敏感正文 |

达到上述门后才允许在 Docker 验收期间临时同时开启 Review/Planner gate。以合成账号完成 authenticated suggestions 和 plan 请求；至少一个 Trace 显示真实模型 `candidate_applied`，浏览器的建议卡只显示安全的“模型建议已应用”状态。再运行一条故障/安全样本，证明 deterministic fallback 不会中断页面且不会显示 provider 原文。精确删除该账号与其关联 Trace，验证 count=0，恢复所有 gate 为 false。

Docker 通过后，分支静态门、server/web/agent 测试、Docker、可见浏览器和清理证据全部通过才允许合并 `main`。必须在 `main` 重跑相同的静态与 Docker/浏览器验收；确认无误后执行 `git push origin main`。

## 6. 对用户可见的真实性

普通生产默认仍使用 deterministic fallback，因此不能把“页面显示建议”声称为模型使用。仅在 candidate 实际调用并被本地 merger 接受时，建议卡显示固定 applied 状态；候选被尝试但降级时显示固定 degraded 状态；未尝试时不显示模型状态。开发/验收 Trace 同时保留安全的 attempted/disposition/usage/cost 元数据，供验证真实调用，永不向用户暴露模型文本、密钥或 raw error。

## 7. 非目标与禁止事项

- 不把模型输出直接写入数据库、创建 ReviewTask、修改 ReviewPreference 或执行工具。
- 不因失败而提高 token cap、放宽 schema、安全词、预算、timeout 或重试次数。
- 不清理 Docker image/container/volume、Redis、PostgreSQL 或 MinIO；禁止 `down -v`、prune、flush、reset 或 wipe。
- 不复制 `.env` 到 worktree、不打印凭据、不把完整配置、prompt、fixture 或 provider 诊断提交到 Git。
- 不将本分支合并回失败分支；所有新工作从 `main` 的本分支开始。

## 8. 文档与回顾

每个可独立验收任务都必须同步 contract、测试、`DEVLOG.md`、`AGENTS.md`、roadmap、data-flow、AI acceptance、checklist 和 dev-start。最终 acceptance 必须区分“模型 candidate 已实现”“Live 已通过”“项目内 gate 已验证”“默认值已恢复”四种状态。

回顾时可以问：

- 为什么 provider 诊断必须可归因但不能保留 raw error？
- 为什么模型只重排 snapshot，而不能生成复习任务或改写 FSRS 事实？
- 如何从 Trace 和浏览器状态证明实际调用过模型，而不是仅看到确定性建议？
