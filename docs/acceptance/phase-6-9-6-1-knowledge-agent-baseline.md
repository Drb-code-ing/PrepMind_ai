# Phase 6.9.6.1 Knowledge Agent Deterministic Baseline

## 目的

本报告固定 `KnowledgeDedupAgent` 与 `KnowledgeOrganizerAgent` 在真实模型候选接入前的确定性能力。后续 Mock 与 controlled-Live 必须继续使用同一个 `phase-6.9-knowledge-agents-v1` 数据集和相同 runtime case ID，不能通过删除失败样本、修改 expected 或改写 baseline 提高结果。

这不是模型质量验收，也不表示生产模型路径已启用。当前两个 Agent 仍只运行原有 deterministic policy；本阶段没有模型 candidate、embedding shortlist 或生产 gate 实现。

## 运行信息

- 日期：2026-07-21
- 分支：`codex/phase-6-9-6-knowledge-agents`
- 分支基线：`f5845b0`（Phase 6.9.6 实施计划检查点）
- 数据集：`phase-6.9-knowledge-agents-v1`
- 模式：`deterministic`
- 命令：`bun --filter @repo/agent eval:phase-6-9-6:baseline`
- focused test：`bun test packages/agent/tests/phase-6-9-knowledge-agent-cases.test.ts packages/agent/tests/phase-6-9-knowledge-agent-metrics.test.ts packages/agent/tests/phase-6-9-knowledge-agent-baseline.test.ts`
- 静态门：`bun --filter @repo/agent typecheck`、`bun --filter @repo/agent lint`
- 网络、数据库、Docker、浏览器、API key、Mock/Live provider：均未使用

## 数据集合同

| Agent | 总数 | zero-call contract | runtime quality | runtime 配对 |
| --- | ---: | ---: | ---: | ---: |
| KnowledgeDedupAgent | 40 | 16 | 24 | `pairedRunIndex=0..23` |
| KnowledgeOrganizerAgent | 32 | 8 | 24 | `pairedRunIndex=0..23` |
| 合计 | 72 | 24 | 48 | 24 个并行请求对 |

Dedup runtime 各有 6 条 `semantic_duplicate`、`possible_revision`、`complementary`、`unrelated`。Organizer runtime 覆盖 `math / english / politics / computer / major / other`，覆盖 `lecture / notes / past_exam / mistakes / practice / reference / other` 七类资源、6 条单文档、主题标签和集合 pair；其中一条输入保留不允许出现在最终标签中的全角冒号，expected 固定为本地字符集允许的安全标签，用于证明后续 candidate 不能照抄非法标签。全部 fixture 为合成、深冻结、稳定 ASCII case ID；不包含真实用户资料、完整 chunk、向量、邮箱、凭据或 provider 内容。

24 条 zero-call case 在本检查点只冻结了 case ID、guard reason、资格和期望调用次数。candidate/guard 尚未实现，因此不能写成“24/24 已实际零调用”；它们必须在 Phase 6.9.6.2 Mock candidate 中真正穿过 gate、safety、budget、abort、owner 与 projection guard，并以 runtime counter `0` 证明。

## 未修饰的 baseline

| 指标 | Deterministic baseline |
| --- | ---: |
| Runtime cases | 48 |
| 完整 case pass / fail | 12 / 36 |
| Critical failures | 0 |
| Dedup semantic relation macro-F1 | 0.3343653251 |
| Revision recall | 0 |
| Unrelated false-positive rate | 0 |
| Organizer subject top-1 accuracy | 0.25 |
| Organizer topic tag micro-F1 | 0 |
| Organizer collection pairwise-F1 | 0.4347826087 |
| Weighted semantic score | 0.2322452551 |
| Missing/invalid runtime predictions | 18 |
| Provider invocations | 0 |
| Input / output tokens | 0 / 0 |
| Estimated cost | 0 CNY |

固定公式为：

```text
0.35 * Dedup macro-F1
+ 0.15 * revision recall
+ 0.20 * Organizer subject top-1
+ 0.15 * topic tag micro-F1
+ 0.15 * collection pairwise-F1
= 0.2322452551
```

`missing/invalid=18` 在本 baseline 中主要表示 Organizer 对词表之外的主题没有给出 subject 预测，不是 provider schema failure。指标实现仍把缺失、非法或 attempted fallback 留在分母；后续 candidate 不得通过过滤失败 case 抬高分数。

## 能力差距

- Dedup 能稳定识别现有词表覆盖的互补资料和明显无关资料，但换名后的语义重复会被判断为互补或无关，`possible_revision` recall 为 0。
- Organizer 只在名称/摘要显式命中固定学科词时给出 subject，subject top-1 只有 25%；当前 policy 不生成真正的 topic label，因此 tag micro-F1 为 0。
- Organizer 对命中固定学科词的多份资料可以形成集合，pairwise-F1 为 `0.4347826087`；词表外的专业课与其它主题没有可用集合关系。
- unrelated false-positive rate 为 0 是保守性的正面边界，但不能抵消重复、新版和组织语义能力不足。

这些失败正是引入“owner-scoped Qwen embedding shortlist + 受限 DeepSeek V4 Pro 裁决”的原因。后续模型 semantic score 必须在同一 48 条 runtime case 上绝对提升至少 0.10，同时保持安全、权限和只读边界不下降。

## 指标与延迟合同

- `computeKnowledgeSemanticScore()` 固定五项权重并拒绝 NaN、Infinity 或 `0..1` 之外的值。
- Dedup macro-F1 固定四类关系；revision recall 与 unrelated false-positive rate 使用自己的完整 expected 分母。
- Organizer tag 和 collection 使用带 case ID 的 micro/pair set，避免跨 case 的同名标签或 document ID 串联。
- P95 使用 24 个非负有限观测的 nearest-rank，第 `ceil(0.95 * 24)=23` 个值；本 deterministic baseline 为保持可复现没有把本机纯函数耗时冒充模型 additional latency。
- schema invalid、缺失输出、fallback 与错误预测都保留在语义指标分母。

## 启用结论

- Enabled：`no`
- Reason：`mock_candidate_not_implemented`
- 当前产品：继续返回 deterministic Knowledge 建议
- 两个 Knowledge model gate：尚未实现，设计默认值仍为 `false`
- 下一任务：Phase 6.9.6.2 strict candidate schema 与 `knowledge-model-projection-v1`

## 安全与清理

- 没有读取 `.env` 或任何 API key，没有调用 embedding、Chat、Mock 或 Live provider。
- 没有启动或修改 Docker、PostgreSQL、Redis、MinIO、浏览器或后台进程。
- 没有创建用户、Document、Chunk、BackgroundJob、Trace、对象或浏览器 storage，因此没有业务数据清理项。
- CLI 仅输出合成 case ID、结构化 code、计数和指标；公开证据不保存 fixture 正文。
- 未执行 Docker prune、`down -v`、volume/database reset、Redis flush 或 MinIO wipe。

## 回顾时可以问

- “为什么 72 条 case 中只有 48 条进入 semantic score？”
- “为什么 zero-call case 现在只能叫 contract，不能叫 24/24 已验证？”
- “0.2322452551 的 deterministic semantic score 暴露了哪些具体短板？”
- “为什么 revision recall 为 0，而 unrelated false-positive rate 仍为 0？”
- “为什么 baseline 不记录本机纯函数 P95，却先固定 nearest-rank 算法？”
- “后续模型为什么必须使用同一 case ID 和分母？”
