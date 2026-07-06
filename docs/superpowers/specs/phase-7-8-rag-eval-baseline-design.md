# Phase 7.8 RAG Eval Baseline Design

## 背景

PrepMind 的知识库链路已经完成上传、解析、分块、embedding 入库、pgvector 相似度检索、Chat RAG 引用、SafetyGuard 和 Qwen 真实 embedding 接入。现在的问题从“能不能跑通”变成“检索质量是否稳定、优化是否真的有效”。

当前 `/knowledge/search` 使用 query embedding 和 chunk embedding 的 pgvector cosine distance 做召回：

```text
score = 1 - cosine_distance
```

这能覆盖语义相似问题，但对精确术语、章节号、公式符号、专有名词、无关问题和恶意资料过滤的效果，需要可重复的评估基线。否则后续加入 Hybrid Retrieval、Reranker 或 Query Rewrite 时，只能靠人工感觉判断有没有变好。

## 目标

- 新增一套固定 RAG Eval 基线，用于评估当前检索链路的召回质量。
- 覆盖精确术语、语义改写、无关查询、跨语言查询和 SafetyGuard 场景。
- 输出稳定指标：`recall@k`、`top1Accuracy`、`safetyPassRate`、`noHitPassRate`。
- 先不改变线上 `/knowledge/search` 行为，不改 Chat prompt，不改前端。
- 支持低成本本地测试：默认使用可控 fake embedding 或确定性 evaluator，不要求每次 CI 调真实 Qwen。
- 文档明确边界：fake eval 验工程回归，真实 Qwen smoke 验语义质量。

## 非目标

- 本阶段不实现 Hybrid Retrieval。
- 本阶段不接入 reranker 模型。
- 本阶段不改 `/api/chat` 的 RAG prompt、引用格式或模型输出。
- 本阶段不新增前端页面。
- 本阶段不把 eval 结果写入数据库。
- 本阶段不要求 CI 使用真实 Qwen API key。

## 方案选择

### 方案 A：先做离线 RAG Eval 基线（推荐）

新增固定 eval cases 和 runner，对检索候选结果做指标计算。第一版可以直接测试 evaluator 逻辑，也可以在 e2e 中复用现有知识库处理流程。

优点是风险低、可回归、后续 Hybrid 前后能量化对比。缺点是第一步不会直接提升线上检索效果。

### 方案 B：直接做 Hybrid Retrieval

在 `/knowledge/search` 中增加关键词检索和分数融合。优点是用户马上能看到功能变化；缺点是没有基线，优化效果难以证明，容易把新排序问题混入线上链路。

### 方案 C：只做真实 Qwen 手工 smoke

上传几份资料，用真实 Qwen embedding 检索并人工查看命中。优点是贴近真实体验；缺点是不可稳定回归，也不适合作为单元或 CI 测试。

本阶段采用方案 A。

## 架构设计

新增一个轻量 eval 单元，优先放在后端知识库模块附近，避免过早抽成独立 package。

```text
apps/server/src/knowledge-documents/evals/
  rag-eval.types.ts
  rag-eval-cases.ts
  rag-eval-runner.ts
  rag-eval-runner.spec.ts
```

职责划分：

- `rag-eval.types.ts`：定义 eval case、检索 hit、单 case 结果和汇总指标。
- `rag-eval-cases.ts`：保存固定测试集，不包含真实用户资料和密钥。
- `rag-eval-runner.ts`：只负责指标计算，不直接调用数据库或外部模型。
- 后续 Hybrid 阶段可以复用同一 runner，对比 baseline 和 hybrid 两套检索结果。

第一版 runner 接收已经得到的 hits，而不是自己访问 `/knowledge/search`。这样可以把“指标计算”与“检索实现”解耦，单元测试稳定、便宜、快速。

## Eval Case 设计

每个 case 描述一个检索意图：

```ts
type RagEvalCase = {
  id: string;
  name: string;
  query: string;
  expectedDocumentIds?: string[];
  expectedChunkIds?: string[];
  expectedContentIncludes?: string[];
  forbiddenContentIncludes?: string[];
  minTopScore?: number;
  shouldHaveHit: boolean;
  safetyExpectation?: 'safe-only' | 'allows-suspicious' | 'no-high-risk';
};
```

示例覆盖：

- 精确术语：`blue lantern theorem` 必须命中包含该短语的 chunk。
- 语义改写：`复习压力和每日卡片上限怎么安排` 应该命中 scheduling pressure / daily card limits。
- 无关查询：资料里没有的问题应该允许 no-hit。
- 安全场景：高风险 prompt injection chunk 不应作为可注入证据通过。
- 跨语言场景：中文问题可命中英文学习资料。

## 指标设计

单 case 输出：

```ts
type RagEvalCaseResult = {
  caseId: string;
  passed: boolean;
  hitCount: number;
  topHitMatched: boolean;
  expectedHitFound: boolean;
  forbiddenHitFound: boolean;
  safetyPassed: boolean;
  reasons: string[];
};
```

汇总输出：

```ts
type RagEvalSummary = {
  total: number;
  passed: number;
  failed: number;
  recallAtK: number;
  top1Accuracy: number;
  safetyPassRate: number;
  noHitPassRate: number;
  results: RagEvalCaseResult[];
};
```

指标含义：

- `recallAtK`：应该命中的 case 中，前 K 个 hits 是否至少包含一个期望结果。
- `top1Accuracy`：应该命中的 case 中，第一条是否就是期望结果。
- `safetyPassRate`：有安全预期的 case 是否满足风险边界。
- `noHitPassRate`：不应该命中的 case 是否没有返回不合理命中。

## 测试策略

第一步只做 runner 单元测试，遵循 TDD：

- 无 hits 且 `shouldHaveHit=true` 时失败。
- top1 命中期望 chunk 时 `top1Accuracy=1`。
- 期望内容出现在非第一条但仍在 topK 内时 `recallAtK=1`、`top1Accuracy=0`。
- 返回 forbidden 内容时失败。
- 安全预期为 `no-high-risk` 时，命中 high-risk chunk 判失败。
- `shouldHaveHit=false` 且没有 hits 时 no-hit 通过。

后续可加 e2e smoke：

- 使用 fake embedding 验证上传、处理、检索、eval 串联。
- 使用 Qwen embedding 做手工或本地 smoke，不进入默认 CI。

## 文档更新

实现完成后更新：

- `AGENTS.md`：Phase 表新增 Phase 7.8.1 RAG Eval Baseline。
- `DEVLOG.md`：记录本阶段目标、实现、验证命令和边界。
- `docs/ai-behavior-acceptance.md`：补充 RAG Eval 与真实 embedding 验收边界。
- 后续完成 Hybrid 后再写博客，主题建议为 `docs/blogs/rag-eval-and-hybrid-retrieval.md`。

## 验收标准

- 新增 eval runner 和固定 cases。
- 单元测试覆盖命中、未命中、top1、recall、forbidden、安全边界。
- 默认测试不需要真实 API key。
- 不改变 `/knowledge/search` 线上响应结构。
- 不保存 prompt、完整回答、API key、真实用户资料或真实 RAG chunk 到 eval 文件。
- 通过以下命令：

```powershell
bun --filter @repo/server test -- rag-eval
bun --filter @repo/server build
git diff --check
```

## 后续阶段

Phase 7.8.2 再实现 Hybrid Retrieval：

```text
vector search topK
keyword/full-text search topK
merge + dedupe
weighted score
eval baseline vs hybrid comparison
```

这样可以用 Phase 7.8.1 的指标证明 Hybrid 是否真的改善了精确术语、专有名词和语义改写场景。
