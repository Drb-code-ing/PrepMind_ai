# Phase 5.6 知识库页面体验设计

## 目标

Phase 5.6 把已经完成的 RAG 后端能力做成用户可感知的前端页面，让用户能上传资料、查看处理状态、手动处理文档、删除资料，并用一个轻量检索测试区验证资料是否能被 Chat RAG 命中。

本阶段只做 `/knowledge` 前端体验和前端 API 封装，不改 RAG 后端模型，不接 LangGraph，不实现 `KnowledgeVerifierAgent`，也不自动把 OCR、错题或聊天内容沉淀进知识库。

## 产品定位

`/knowledge` 是“学习资料工作台”，不是完整知识管理系统。

它需要解决三个问题：

1. 用户知道自己上传了哪些资料。
2. 用户知道资料是否已经处理完成，失败时能看到原因并重试。
3. 用户能用检索测试确认资料能否被 RAG 找到，从而理解 Chat 后续引用资料的来源。

页面需要保持 PrepMind 当前移动端优先、轻量卡片、柔和漫画感的风格，不能做成传统后台表格。

## 范围

### 本阶段实现

- 新增 `/knowledge` 页面。
- 在侧边栏新增“知识库”入口。
- 新增前端 `knowledgeApi`：
  - 上传文档。
  - 获取文档列表。
  - 获取单个文档详情。
  - 处理 / 重新处理文档。
  - 删除文档。
  - 检索测试。
- 新增 TanStack Query hooks：
  - 文档列表 query。
  - 文档详情 query。
  - 上传 mutation。
  - 处理 mutation。
  - 删除 mutation。
  - 检索 mutation。
- 页面支持 PDF / DOCX / Markdown / TXT 上传。
- 页面展示文档状态、类型、大小、chunk 数、创建时间、处理时间和失败原因。
- 页面提供内联确认删除，不使用浏览器原生 `confirm`。
- 操作成功或失败提供轻量反馈。
- 检索测试区展示命中的文档名、片段序号、相似度和片段摘要。

### 本阶段不实现

- 不做资料内容全文预览。
- 不做 chunk 全量浏览、编辑或删除。
- 不做笔记编辑器。
- 不做文件夹、标签、收藏、分享等知识管理功能。
- 不做资料可信度评估；该能力留给 Phase 6 `KnowledgeVerifierAgent`。
- 不做后台队列 UI；当前处理仍由用户手动触发 `POST /knowledge/documents/:id/process`。

## 页面结构

页面路径：

```text
/knowledge
```

首屏结构：

```text
Header
  - 返回 Chat
  - 标题：知识库
  - 副标题：上传资料，让 AI 回答有据可查

Summary Card
  - 总资料数
  - 已处理数
  - 处理中数
  - 失败数

Upload Card
  - 文件选择
  - 支持格式提示
  - 上传按钮 / 上传中状态

Document List
  - 文档卡片列表
  - 状态 badge
  - 处理 / 重新处理按钮
  - 删除入口
  - 失败原因

Search Test Card
  - 输入问题
  - topK / minScore 使用默认值
  - 搜索按钮
  - 命中片段列表
```

布局约束：

- 移动端优先，最大内容宽度保持 `sm:max-w-3xl`。
- 触摸目标不小于 44px。
- 状态、按钮和反馈用图标 + 简短文本表达。
- 不使用大面积表格。
- 不新增复杂动画，只保留当前 `pm-enter`、`pm-mascot-float` 等轻动效。

## 数据流

文档管理数据流：

```text
用户选择文件
  -> knowledgeApi.uploadDocument(accessToken, file)
  -> POST /knowledge/documents multipart/form-data
  -> 创建 Document(PENDING)
  -> invalidate knowledge document list

用户点击处理
  -> knowledgeApi.processDocument(accessToken, id, { force })
  -> POST /knowledge/documents/:id/process
  -> Document 状态进入 PROCESSING
  -> 完成后 DONE 或 FAILED
  -> invalidate list/detail/search

用户删除文档
  -> 页面内确认
  -> DELETE /knowledge/documents/:id
  -> invalidate list/detail/search
```

检索测试数据流：

```text
用户输入 query
  -> knowledgeApi.search(accessToken, { query, topK: 5, minScore: 0.7 })
  -> POST /knowledge/search
  -> 展示 hits
  -> 无命中展示轻量空状态
```

## 状态设计

文档状态展示：

- `PENDING`：待处理。主操作是“开始处理”。
- `PROCESSING`：处理中。按钮禁用，展示加载图标。
- `DONE`：已可用于 Chat RAG。展示 chunk 数和处理时间，允许“重新处理”。
- `FAILED`：处理失败。展示错误原因，允许“重新处理”。

页面状态：

- 列表加载中：展示 skeleton 风格的轻量卡片或 loading 行。
- 列表为空：引导上传第一份资料。
- 上传中：禁用上传按钮，展示“上传中...”。
- 处理失败：保留文档卡片，并展示后端 `errorMessage`。
- 删除确认：卡片内展开“确认删除 / 取消”，避免原生弹窗。
- 检索无命中：提示“没有命中资料，Chat 仍会普通回答”。

## 前端 API 设计

新增：

```text
apps/web/src/lib/knowledge-api.ts
apps/web/src/lib/knowledge-api.test.mts
apps/web/src/hooks/use-knowledge.ts
apps/web/src/app/(main)/knowledge/page.tsx
```

`knowledge-api.ts` 负责：

- 使用 shared Zod schema 校验响应。
- multipart 上传文档。
- JSON 请求列表、详情、处理、删除和检索。
- 把 API envelope 异常交给现有 `ApiClientError`。

`use-knowledge.ts` 负责：

- 从 `useUserStore` 读取 `accessToken` 和 `sessionHydrated`。
- 统一 query keys。
- mutation 成功后 invalidate 文档列表和搜索相关 query。
- mutation 不进入 Dexie `mutationQueue`，因为知识库资料管理不是离线优先链路。

## 与 Chat RAG 的关系

Phase 5.6 不改变 `/api/chat` 的 RAG 注入逻辑。

用户在 `/knowledge` 页面处理完成的资料，后续会被 Chat RAG 通过 `/knowledge/search` 命中。检索测试区只是让用户和开发者能在进入 Chat 前确认资料检索是否可用。

关键边界保持不变：

- 没有资料时 Chat 继续普通回答。
- 无命中时 Chat 继续普通回答。
- 检索失败时 Chat 继续普通回答。
- 上传资料可能有误，资料可信度评估留给 Phase 6。

## 测试策略

### API 单元测试

`knowledge-api.test.mts` 覆盖：

- 上传文档使用 multipart/form-data，不手动设置 JSON content-type。
- 列表请求拼接 `status`、`sourceType`、`limit`、`cursor`。
- 详情、处理、删除和检索请求路径正确。
- 请求携带 bearer token。
- 响应使用 shared schema 校验。

### View Helper 测试

如页面状态逻辑变复杂，新增 `knowledge-view.ts` 和测试覆盖：

- 文件大小格式化。
- 状态 badge 文案。
- 状态操作按钮文案。
- 检索命中摘要。

### 页面验证

自动化验证：

- `bun --filter @repo/web test`
- `bun --filter @repo/web lint`
- `bun --filter @repo/web build`
- `bun --filter @repo/server test -- knowledge-search.service.spec.ts`
- `bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts`

浏览器验收：

1. 打开 `/knowledge`。
2. 上传 TXT 或 Markdown 文档。
3. 文档进入 `PENDING`。
4. 点击处理，处理完成后进入 `DONE` 并展示 chunk 数。
5. 用检索测试区输入相关问题，能看到命中文档片段。
6. 删除文档，列表更新。
7. 切换到 Chat，普通对话仍可使用。

## 验收标准

1. 用户能从侧边栏进入 `/knowledge`。
2. 用户能上传支持格式文档。
3. 用户能看到文档状态、失败原因和 chunk 数。
4. 用户能手动处理、重新处理和删除文档。
5. 删除操作使用页面内确认，不使用浏览器原生弹窗。
6. 用户能在页面内测试知识库检索命中。
7. 所有知识库请求按当前用户 token 鉴权。
8. 页面保持当前 PrepMind 视觉系统，不出现传统后台表格风格。
9. 不影响 Chat、OCR、错题本、复习和统计主链路。
