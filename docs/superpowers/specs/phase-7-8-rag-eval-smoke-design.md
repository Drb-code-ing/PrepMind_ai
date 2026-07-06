# Phase 7.8.3 RAG Eval Smoke Design

## 背景

Phase 7.8.1 已经有了固定 RAG Eval cases 和 `runRagEval()` 指标计算；Phase 7.8.2 已经把 `/knowledge/search` 升级为 hybrid retrieval。现在缺少的是一条“真实接口链路”的轻量验收：能不能用本地 API 创建账号、上传资料、触发处理、检索命中，再把真实返回的 hits 喂给 eval runner，得到一份能读懂的 smoke 报告。

这一步解决的问题不是“最终回答质量怎么样”，而是“真实 RAG 检索链路是否能跑通，且精确词与语义查询至少有可解释命中”。它是 fake 单测和 live Chat 验收中间的一层：比纯函数测试更接近生产链路，比真实模型对话便宜、稳定、可重复。

## 目标

- 新增一个本地 smoke 脚本，串起注册、上传、处理、轮询、检索和 eval 汇总。
- 复用现有 `runRagEval()`，避免再造一套指标。
- 新增一个可单测的报告器，把 summary 转成终端友好的文本。
- 默认不进入 CI，不要求每次提交都有真实 Qwen API key。
- 输出只包含必要状态、命中数、分数、指标和原因，不打印 API key、access token、embedding 向量或完整敏感内容。
- 为后续 reranker、query rewrite、embedding 模型切换提供同一条本地 smoke 入口。

## 非目标

- 不新增数据库里的 eval run 表。
- 不改 `/knowledge/search` 的线上响应结构。
- 不改 Chat RAG prompt，也不调用 `/api/chat`。
- 不新增前端页面。
- 不把真实模型 smoke 放进默认 CI。
- 不清理 smoke 创建的临时用户，因为当前没有用户删除 API；脚本可尽量删除临时文档。

## 方案选择

### 方案 A：本地 API smoke 脚本 + 可复用 reporter（推荐）

脚本通过 HTTP 调本地 NestJS API，完整走认证、multipart 上传、文档处理和检索链路。检索结果转换成 `RagEvalHit[]` 后交给 `runRagEval()`，最后由 reporter 输出文本报告。

优点是最贴近真实接口，边界清楚，默认不影响 CI；reporter 可以稳定单测。缺点是运行前需要本地 server、PostgreSQL、MinIO、Redis 以及 embedding provider 配置好。

### 方案 B：写 Nest e2e 测试

把 smoke 做进 e2e，启动应用并直接测 API。优点是自动化程度高；缺点是会引入真实 embedding key、对象存储和处理耗时问题，不适合默认测试，也容易让 CI 变慢和不稳定。

### 方案 C：只保留人工操作清单

写文档让人手动上传、处理、检索并观察页面。优点是实现成本低；缺点是不可重复、不可量化，不能沉淀为后续模型或检索策略切换的验收入口。

本阶段采用方案 A。

## 架构设计

新增文件：

```text
apps/server/src/knowledge-documents/evals/rag-eval-report.ts
apps/server/src/knowledge-documents/evals/rag-eval-report.spec.ts
apps/server/scripts/rag-eval-smoke.ts
```

职责划分：

- `rag-eval-report.ts`：纯函数，把 `RagEvalSummary` 和 smoke 元数据格式化为终端报告，不访问 HTTP、数据库或环境变量。
- `rag-eval-report.spec.ts`：覆盖通过、失败、原因展示和命中概览，保证报告稳定可读。
- `rag-eval-smoke.ts`：本地脚本，负责 HTTP 编排、临时文件构造、处理轮询、检索调用和错误退出码。

`apps/server/package.json` 新增脚本：

```json
"smoke:rag-eval": "ts-node -r tsconfig-paths/register scripts/rag-eval-smoke.ts"
```

## Smoke 数据流

1. 读取配置：
   - `RAG_EVAL_SMOKE_BASE_URL`，默认 `http://localhost:3001`
   - `RAG_EVAL_SMOKE_PASSWORD`，默认 `Password123!`
   - `RAG_EVAL_SMOKE_TIMEOUT_MS`，默认 `120000`
   - `RAG_EVAL_SMOKE_POLL_INTERVAL_MS`，默认 `1500`
2. 注册唯一测试账号，email 使用时间戳，避免和历史 smoke 冲突。
3. 构造一个临时 `.txt` 文件，内容包含：
   - 精确词：`blue lantern theorem`
   - 语义资料：`scheduling pressure`、`daily card limits`、`weak knowledge points`
   - 普通安全说明：不包含真实密钥或用户资料
4. `POST /knowledge/documents` 上传文件。
5. `POST /knowledge/documents/:id/process` 触发处理。
6. 轮询 `GET /knowledge/documents/:id`，直到 `DONE` 或 `FAILED`。
7. 对固定 smoke cases 调 `POST /knowledge/search`。
8. 把 hits 按 case id 汇总后调用 `runRagEval()`。
9. 打印报告。若文档处理失败、接口失败或 eval summary 有失败 case，脚本以非零退出码结束。
10. 最后尝试删除临时文档；删除失败只给 warning，不覆盖主结果。

## Eval Case 边界

脚本优先复用现有 `ragEvalCases` 中适合真实 smoke 的 case：

- `exact-blue-lantern`
- `semantic-review-pressure`
- `cross-language-weak-points`

安全注入相关 case 不放进默认 smoke，因为 smoke 文档不会写入恶意指令文本；SafetyGuard 的风险识别继续由既有单测和后续专门安全 smoke 覆盖。无关查询 case 在真实向量检索里容易受 `minScore` 和 hybrid keyword 权重影响，第一版 smoke 不把它作为失败门槛，避免把“检索引擎返回了低分候选”误判成链路失败。

## 错误处理

- HTTP 非 2xx 或 response envelope `success=false`：打印接口路径和错误摘要，不打印 token。
- 注册失败：直接退出，因为后续接口都需要 access token。
- 上传失败：直接退出，提示检查 MinIO 和上传大小限制。
- 处理超时：直接退出，提示检查 server 日志、embedding provider、MinIO 和数据库。
- 文档状态 `FAILED`：打印后端返回的错误摘要，不打印完整文件内容。
- 检索失败：记录对应 case 失败并退出非零。
- 清理失败：只输出 warning，避免掩盖主流程结果。

## 安全与隐私

- 不读取或打印 `Qwen_API_KEY`、`OPENAI_API_KEY`、`DEEPSEEK_API_KEY` 等密钥。
- 不打印 access token、refresh cookie 或完整请求头。
- 不打印 embedding 向量。
- 报告里只展示每个 case 的命中数量、top score、top document、指标和失败原因。
- smoke 文档是合成测试资料，不包含真实用户笔记。

## 验收标准

- `rag-eval-report` 有单元测试，且先红后绿。
- `bun --filter @repo/server test -- rag-eval-report` 通过。
- `bun --filter @repo/server test -- rag-eval-runner` 继续通过。
- `bun --filter @repo/server build` 通过。
- `git diff --check` 通过。
- 本地服务启动并配置真实 embedding 时，`bun --filter @repo/server smoke:rag-eval` 能跑完，并输出清晰的指标报告。

## 后续扩展

- Phase 7.8.4 可以补 `RAG_EVAL_SMOKE_KEEP_DATA=true`，便于保留文档给前端页面复查。
- 后续 reranker / query rewrite 上线前后复用同一脚本做对比。
- 未来如果要沉淀长期趋势，再单独设计 eval result 表和权限边界。
