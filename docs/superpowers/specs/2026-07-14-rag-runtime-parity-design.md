# RAG Runtime Parity：Bun 与 Docker 千问 embedding 一致性设计

## 状态

- 日期：2026-07-14
- 范围：Docker server/worker 与 Bun 本地后端的 RAG embedding 配置、启动校验和真实混合检索验收
- 后续任务：本设计完成后，另开分支实施 Phase 6.9.4.4 Router/Verifier 真实模型接入
- 不在本设计范围：修改检索排序算法、引入 reranker、迁移现有 PostgreSQL/Redis/MinIO 数据

## 背景与问题

Bun 本地后端当前从本地环境读取千问 `text-embedding-v4`、1536 维配置，检索链路是“query embedding + pgvector 向量候选 + PostgreSQL full-text 关键词候选”的混合召回。Docker compose 的 server 和 worker 没有显式透传 RAG provider、模型、base URL 或千问密钥，因此 Nest 配置 schema 会使用 `openai / text-embedding-3-small` 默认值。结果是 Docker 可能在首次处理或检索时才尝试 OpenAI，或者在缺少 OpenAI key 时延迟失败；worker readiness 仍可能显示健康。

这会造成三类问题：本地 Bun 与 Docker 的运行语义不同；queue worker 与 API 的 embedding 配置可能漂移；错误不会在启动阶段暴露，无法快速判断是哪一种 provider 在工作。

## 目标与不变量

1. Bun、Docker server、Docker worker 使用同一组 provider、model、base URL、dimensions、batch 和分块配置。
2. 当前项目默认真实 RAG provider 为 Qwen `text-embedding-v4` / 1536 维；Docker 不得静默回退 OpenAI。
3. provider 配置不完整时 fail-closed：服务在启动配置校验阶段失败，不等到首次上传或检索才失败。
4. server 与 worker 不读取整个根 `.env`，只透传 RAG 所需 allowlist，避免扩大密钥暴露范围。
5. 不清理或重建现有 Docker volume、PostgreSQL、Redis、MinIO 数据。
6. 真实验收不输出 API key、完整 `docker compose config`、原始 provider URL 或用户正文。

## 方案比较

### 方案 A：显式 allowlist + provider-aware fail-closed（采用）

Compose 的 server/worker 显式透传同一组 RAG 配置；配置 schema 根据 provider 校验 key、base URL 和 model；生产模式不允许依赖 provider 默认值。qwen 只能使用 Qwen key，不能因为存在 OpenAI key 而切换 provider。这样配置漂移和错误会在容器启动时暴露，且秘密范围最小。

### 方案 B：只修改 Compose 透传

改动较小，但配置缺失仍可能落到 schema 默认值，错误会延迟到首次 embedding 请求；不满足“禁止静默退回”的目标。

### 方案 C：server/worker 全量加载根 `.env`

可以减少 allowlist 维护，但会把 Chat、JWT、MinIO 和其他无关凭据暴露到不需要它们的进程，且 Bun 与 Docker 仍可能因 dotenv 搜索路径不同而漂移。因此不采用。

## 配置契约

server 与 worker 共同透传：

- `RAG_EMBEDDING_PROVIDER`
- `RAG_EMBEDDING_MODEL`
- `RAG_EMBEDDING_BASE_URL`
- `RAG_EMBEDDING_DIMENSIONS`
- `RAG_EMBEDDING_BATCH_SIZE`
- `QWEN_API_KEY`（唯一规范密钥名）
- `RAG_CHUNK_TARGET_TOKENS`
- `RAG_CHUNK_OVERLAP_TOKENS`
- `RAG_CHUNK_MAX_TOKENS`
- `RAG_MAX_CHUNKS_PER_DOCUMENT`
- `EMBEDDING_REQUEST_TIMEOUT_MS`

provider 规则：

- `qwen`：必须有显式 model、合法的无凭据 HTTPS base URL、`QWEN_API_KEY`；不读取 OpenAI key 作为替代。
- `openai`：必须有显式 model 和 `OPENAI_API_KEY`；仅用于明确选择 OpenAI 的环境。
- `fake`：继续只允许非 production 的本地测试。
- production 不允许依赖 `RAG_EMBEDDING_PROVIDER` 和 model 的隐式默认值。

Compose 不使用 `${VAR:?}` 作为整个文件的硬插值，以免用户只启动 postgres/redis/minio 时被 RAG 密钥阻断；server/worker 启动时由 schema 执行 provider-aware 校验。对于 qwen 的 key/base URL 缺失，server 或 worker 自身 fail-closed。

## 数据流与安全边界

```text
根 .env / apps/server/.env
        │（只取 RAG allowlist）
        ├── Bun server
        ├── Docker server ── query embedding ──┐
        └── Docker worker ── document embedding ┘
                                             │
                        vector candidates + keyword candidates
                                             │
                                      hybrid merge
```

EmbeddingService 保持单一 provider 选择逻辑；不新增“调用失败后换 provider”的 fallback。关键词候选仍与 query embedding 并行参与融合，但当前 API 语义仍先生成 query embedding，因此 provider 不可用时不会伪装成纯关键词模式成功。

启动日志或 readiness 仅可报告 `provider/model/dimensions` 等非敏感摘要，不报告 key、完整 base URL、prompt、chunk 或用户内容。

`EMBEDDING_REQUEST_TIMEOUT_MS` 必须真正传给 OpenAI-compatible client 的 request timeout，超时后返回现有安全错误，不改变 provider。

## 实施与测试边界

### 单元与配置测试

- production 缺 provider、qwen 缺 key/base URL/model、fake production 均启动失败。
- qwen 配置即使存在 OpenAI key，也只能选择 qwen。
- server/worker Compose 配置包含同一组 RAG allowlist，且不包含完整 `.env`。
- timeout 值传入 embedding client。

### Docker 真实验收

1. 使用根 `.env` 的真实 qwen 配置，命令和报告脱敏。
2. 显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`，启动 postgres、redis、minio、server、worker；不清理 volume。
3. 校验 server 与 worker 的非敏感 provider/model/dimensions 一致，并确认 worker healthy。
4. 注册临时账号、上传合成 TXT、触发 process，轮询到文档与 BackgroundJob 成功，证明 worker 完成 embedding。
5. 调用 `/knowledge/search`，证明 server query embedding 可用。
6. 断言精确唯一词查询命中且 `keywordScore > 0`；断言无词面重叠的语义查询命中且 `vectorScore > 0`；断言模式为 hybrid 且 chunkId 无重复。
7. 清理本轮临时账号、文档和任务，不删除基础设施数据。
8. 在不调用 provider 的情况下做缺 key、缺 base URL、缺 provider 的负向启动检查。

## 失败处理与回滚

- 配置校验失败：容器退出并给出不含密钥的字段级错误；不尝试其他 provider。
- provider 超时或结构化响应错误：保留现有 `KNOWLEDGE_EMBEDDING_FAILED` 错误语义，不切换 provider。
- Docker 验收失败：保留容器日志和脱敏证据，停止本轮临时服务即可；不执行 volume 删除、数据库 reset 或全量 compose down -v。
- 回滚仅回滚本分支代码和 Compose allowlist，不回滚用户已有数据。

## 验收证据与文档同步

实现分支必须同步更新 `AGENTS.md`、`docs/dev-start.md`、`docs/acceptance-checklist.md`、`docs/data-flow.md` 和相关 README，删除“默认 OpenAI”及“bge-m3”与实际运行配置不一致的表述。新增验收记录必须包含 provider/model/dimensions 摘要、queue worker 成功、keyword/vector 双路命中、负向启动校验和清理范围，但不得包含任何密钥或用户正文。

完成标准：单测、typecheck、lint 通过；Docker server/worker 配置一致；真实 queue + hybrid smoke 通过；负向启动检查全部 fail-closed；文档、分支提交、main 复验和远程推送完成。
