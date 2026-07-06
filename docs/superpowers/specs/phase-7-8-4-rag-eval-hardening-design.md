# Phase 7.8.4 RAG Eval Hardening Design

## 背景

Phase 7.8.3 已经新增本地 API 级 `smoke:rag-eval`，可以串联注册、上传、处理、检索和 eval 汇总。最终 review 里剩下两个小风险：如果固定 smoke case id 未来被改名或删除，脚本可能只跑到部分 case 甚至空 case；另外调试前端页面时，有时需要保留 smoke 资料，而当前脚本总是 best-effort 删除临时文档。

这一步做小收尾，不进入 durable outbox / metrics 大阶段。

## 目标

- 防止 `ragEvalCases` 变更导致 smoke case 漏选后误报 PASS。
- 新增 `RAG_EVAL_SMOKE_KEEP_DATA=true`，允许本地调试时保留 smoke 文档。
- 把 smoke case 选择和 keep-data 解析抽成纯函数并加单元测试。
- 写一篇面试学习博客，讲清 RAG 从 fake embedding 到真实 API smoke 的验收分层。
- 更新阶段文档，明确 Phase 7.8.4 是 RAG Eval 收尾增强。

## 非目标

- 不改 `/knowledge/search` 排序算法。
- 不改 Chat RAG prompt 或 `/api/chat`。
- 不新增数据库 eval run 表。
- 不把真实 embedding smoke 放进默认 CI。
- 不实现临时用户清理，因为当前没有用户删除 API。

## 方案选择

### 方案 A：抽纯函数 + 脚本最小改动（推荐）

新增 `rag-eval-smoke-config.ts`，负责选择固定 smoke cases、校验数量和解析 `RAG_EVAL_SMOKE_KEEP_DATA`。脚本只调用这些 helper。

优点是可单测、改动小、风险低；缺点是没有把整个脚本变成可注入 e2e harness。

### 方案 B：把 smoke 脚本重构成完整可测试 orchestrator

把 HTTP client、配置、case 选择、cleanup 全部模块化。优点是测试覆盖更完整；缺点是 Phase 7.8.4 作为小收尾会变大，容易引入无关重构。

### 方案 C：只在文档里提醒人工检查

实现成本最低，但不能防止未来误报 PASS。

本阶段采用方案 A。

## 架构设计

新增文件：

```text
apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.ts
apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.spec.ts
docs/blogs/rag-eval-and-hybrid-retrieval.md
```

修改文件：

```text
apps/server/scripts/rag-eval-smoke.ts
AGENTS.md
DEVLOG.md
docs/ai-behavior-acceptance.md
```

`rag-eval-smoke-config.ts` 提供：

- `RAG_EVAL_SMOKE_CASE_IDS`
- `selectRagEvalSmokeCases(cases)`
- `shouldKeepRagEvalSmokeData(env)`

`selectRagEvalSmokeCases()` 必须保证每个必需 case 都存在；缺少任一 case 时抛出明确错误，避免空跑或少跑。

`shouldKeepRagEvalSmokeData()` 只把 `true` / `1` / `yes` 视为开启，其它值都视为关闭。

## Smoke 行为变更

- 默认行为不变：跑完后删除临时文档。
- 设置 `RAG_EVAL_SMOKE_KEEP_DATA=true` 后，脚本不删除临时文档，并在 stderr 输出一行 warning，提醒这是为了本地复查。
- 即使保留文档，也不打印 token、cookie、API key、embedding 向量或完整 hit content。
- 如果 case 配置缺失，脚本在注册和上传前失败，避免制造无用测试数据。

## 博客大纲

博客文件名使用语义化名称：`docs/blogs/rag-eval-and-hybrid-retrieval.md`。

内容重点：

- 为什么 fake embedding 只能验工程链路。
- 为什么真实 RAG 需要 baseline、hybrid retrieval 和 API smoke 三层。
- `recall@k`、`top1Accuracy`、`safetyPassRate`、`noHitPassRate` 分别回答什么问题。
- Hybrid Retrieval 怎么把向量召回和关键词召回合并。
- 为什么 smoke 不等于 Chat live 验收。
- 面试时怎么讲边界：不泄密、不保存真实资料、不进默认 CI。

## 验收标准

- `bun --filter @repo/server test -- rag-eval-smoke-config` 通过。
- `bun --filter @repo/server test -- rag-eval-report rag-eval-runner` 继续通过。
- `bun --filter @repo/server build` 通过。
- `git diff --check` 通过。
- 本地服务可用时，`bun --filter @repo/server smoke:rag-eval` 继续 PASS。
- 可选手动验证 `RAG_EVAL_SMOKE_KEEP_DATA=true` 时脚本不会删除 smoke 文档。
