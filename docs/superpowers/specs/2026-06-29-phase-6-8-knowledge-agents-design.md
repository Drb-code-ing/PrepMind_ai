# Phase 6.8 Knowledge Agents Design

## 背景

Phase 6.7 已经完成 RouterAgent、TutorAgent、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent 和 Agent Trace。资料管理方向还只停留在预留说明：`KnowledgeDedupAgent / KnowledgeOrganizerAgent` 用于判断上传资料是否重复、更新版或互补资料，并给出资料整理建议。

当前 RAG 资料库已经具备上传、替换、处理、检索和 Chat 引用能力，也已经有 `contentHash` 精确去重和并发一致性兜底。Phase 6.8 不重复做底层上传去重，而是在此基础上补齐“资料管理 Agent”轻量闭环，让用户能看懂资料之间的关系和整理方向。

## 目标

实现轻量版 `KnowledgeDedupAgent / KnowledgeOrganizerAgent`：

- `KnowledgeDedupAgent` 判断当前用户资料之间的关系：完全重复、疑似新版、疑似同主题互补、资料不足。
- `KnowledgeOrganizerAgent` 根据资料名、类型、状态、chunk 摘要和已有资料集合，给出分类、标签、资料集合建议。
- NestJS 提供只读建议 API，所有查询按当前 `userId` 隔离。
- `/knowledge` 页面展示“资料管理建议”，帮助用户理解哪些资料可以替换、保留或归类。
- 全链路不调用真实模型，不读取 API key，不自动删除、覆盖、合并或重命名资料。

## 非目标

Phase 6.8 不做这些事：

- 不新增资料集合、标签、分类的持久化表。
- 不自动合并资料，不自动删除重复资料。
- 不在上传接口同步调用语义 dedup，上传仍只做 `contentHash` 精确去重。
- 不引入 BullMQ；异步重算、批量整理、后台扫描留给 Phase 7。
- 不把资料整理建议写入 Dexie `mutationQueue`。
- 不把 `KnowledgeOrganizerAgent` 的结果自动注入 Chat prompt。

## 推荐方案

采用“只读建议 API + 确定性 policy + 前端展示”的方案。

备选方案一是把 dedup/organizer 写进上传流程，但这会拖慢上传，也会让上传接口承担语义判断和 UI 建议职责。备选方案二是先上数据库持久化资料集合，但 Phase 7 之前缺少后台重算和事件总线，容易产生 stale suggestion。当前推荐方案更轻：先把 Agent 能力跑通、可测试、可展示，后续再把用户确认后的分类写入正式资料组织层。

## Agent 设计

### KnowledgeDedupAgent

输入：

- 当前目标资料，可为空；为空时分析最近一批资料。
- 当前用户资料列表：`id`、`name`、`type`、`size`、`status`、`sourceType`、`contentHash`、`chunkCount`、`processedAt`、`createdAt`、`updatedAt`。
- 可选 chunk 摘要：每份资料取前几个 chunk 的短文本摘要，不读取完整 chunks。

输出：

- `summary`：本次资料关系判断摘要。
- `items`：关系建议列表。
- 每个建议包含：
  - `kind`: `exact_duplicate | possible_revision | complementary | insufficient_signal`
  - `severity`: `info | warning`
  - `documentIds`
  - `title`
  - `reason`
  - `recommendation`: `use_existing | replace_old | keep_both | review_manually`
  - `confidence`
  - `signals`

确定性规则：

- `contentHash` 相同：`exact_duplicate`，推荐 `use_existing`。实际上传接口已拦截，这里主要用于解释已有数据或异常历史。
- 文件名归一化后高度相似、类型相同、`contentHash` 不同、更新时间有先后：`possible_revision`，推荐 `review_manually` 或 `replace_old`。
- 主题关键词重合但文件名不高度相似：`complementary`，推荐 `keep_both`。
- 资料太少、未处理、chunk 摘要不足：`insufficient_signal`，推荐 `review_manually`。

### KnowledgeOrganizerAgent

输入：

- 当前用户资料列表。
- 每份资料的文件名、类型、状态、chunkCount、短 chunk 摘要。
- 可选 dedup suggestions，用于避免对疑似重复资料给出过度分类。

输出：

- `collections`：资料集合建议。
- `tags`：资料标签建议。
- `summary`：整体整理建议。
- 每个 collection 包含：
  - `name`
  - `description`
  - `documentIds`
  - `reason`
  - `confidence`
  - `signals`

确定性规则：

- 主题识别优先来自文件名，其次来自 chunk 摘要。
- 学科/主题关键词第一版使用小词表：数学、英语、政治、计算机、专业课、其它。
- 资料类型关键词第一版使用小词表：讲义、笔记、真题、错题、练习、参考资料。
- DONE 资料可信度高于 PENDING / FAILED / PROCESSING。
- 同主题多份资料建议归为一个 collection；单份资料只给 tags，不强行创建 collection。

## API 设计

新增共享 contract：

- `packages/types/src/api/knowledge-agent.ts`
- package export：`@repo/types/api/knowledge-agent`

新增 NestJS 模块：

- `apps/server/src/knowledge-agent/knowledge-agent.module.ts`
- `apps/server/src/knowledge-agent/knowledge-agent.controller.ts`
- `apps/server/src/knowledge-agent/knowledge-agent.service.ts`
- 单元测试：`apps/server/src/knowledge-agent/knowledge-agent.service.spec.ts`

API：

```text
GET /knowledge-agent/suggestions?documentId=&limit=
```

约定：

- 必须经过 `JwtAuthGuard`。
- `documentId` 可选；传入时重点分析该资料与其它资料关系。
- `limit` 默认 20，最大 50。
- 只读，不写 Document / Chunk，不写新表，不进入 Dexie。
- 返回：

```ts
{
  generatedAt: string;
  dedup: KnowledgeDedupResult;
  organizer: KnowledgeOrganizerResult;
}
```

## 前端设计

在 `/knowledge` 页面新增“资料管理建议”区域：

- 放在资料状态摘要下方、资料列表上方。
- 未登录或 API 失败时不阻塞资料列表。
- 没有足够信号时展示轻提示：继续上传或处理资料后会有更有用的整理建议。
- 有建议时展示：
  - 疑似重复 / 新版 / 互补资料建议。
  - 推荐资料集合和标签。
  - 每条建议只展示原因和建议动作，不提供自动执行按钮。

新增前端 API/hook：

- `apps/web/src/lib/knowledge-agent-api.ts`
- `apps/web/src/hooks/use-knowledge-agent-suggestions.ts`

前端不写 Dexie，不做乐观更新。

## 数据流

```text
用户打开 /knowledge
  -> useKnowledgeAgentSuggestions()
  -> GET /knowledge-agent/suggestions
  -> KnowledgeAgentService 读取当前用户 Document 和少量 Chunk 摘要
  -> @repo/agent analyzeKnowledgeDedup()
  -> @repo/agent organizeKnowledgeDocuments()
  -> 返回只读建议
  -> /knowledge 展示资料管理建议
```

## 安全与一致性边界

- Service 层所有 Document / Chunk 查询必须带当前 `userId`。
- 只读取 chunk 短摘要，不返回完整 chunk 内容到前端建议区。
- 不保存 prompt、chunk 全文或 API key。
- 不修改资料状态，不删除对象存储，不清 chunks。
- 不把建议作为事实来源；用户最终整理权保留。
- API 失败只影响建议卡片，不影响上传、处理、替换、检索。

## 测试策略

按 TDD 实现：

1. `@repo/agent` policy tests：
   - exact duplicate by `contentHash`
   - possible revision by normalized filename + type + different hash
   - complementary by overlapping topic keywords
   - organizer groups documents by subject/topic
   - insufficient signal fallback
2. `@repo/types` schema tests：
   - request query defaults
   - response schema accepts deterministic outputs
3. NestJS service tests：
   - only current user documents are read
   - optional `documentId` scopes the target
   - chunks are summarized and capped
   - service does not call create/update/delete on Prisma models
4. Web tests：
   - API client builds query params
   - display helper renders empty, warning and collection states

## 文档更新

实现完成后更新：

- `AGENTS.md`
- `docs/roadmap.md`
- `docs/data-flow.md`
- 可选新增 dev blog，记录 Phase 6.8 如何把资料管理 Agent 补齐。

## 验收

最小验收命令：

```powershell
bun --filter @repo/agent test
bun --cwd packages/types typecheck
bun --filter @repo/server test
bun --filter @repo/web test
```

收尾验收再根据实际改动补充：

```powershell
bun --filter @repo/server build
bun --filter @repo/web build
```

不跑 `server lint` 作为默认收尾命令，避免它执行 `--fix` 产生无关工作区变更。
