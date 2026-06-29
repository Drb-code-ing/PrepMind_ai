# Phase 6.8：把 KnowledgeDedupAgent / KnowledgeOrganizerAgent 补成可用闭环

Phase 6.8 做的是一个很容易被低估的能力：资料管理建议。

在 PrepMind 里，RAG 知识库已经能上传、处理、检索资料，也能在 Chat 里引用资料。但真实使用时，用户的资料库不会一直很干净：同一份讲义可能会传两遍，老师可能发了新版 PDF，自己也可能同时上传“导数讲义”和“导数练习题”。如果系统只把这些资料平铺出来，RAG 能用，但资料管理体验会越来越乱。

所以这一阶段补了两个轻量 Agent：

- `KnowledgeDedupAgent`：判断资料之间是完全重复、疑似新版，还是同主题互补。
- `KnowledgeOrganizerAgent`：根据资料名、状态和少量 chunk 摘要，给出集合和标签建议。

这两个 Agent 的重点不是“自动替用户整理资料”，而是“把资料之间的关系解释清楚，让用户自己决定”。

## 问题从哪里来

Phase 5.6 其实已经有 `contentHash` 精确去重：同一个用户上传完全相同的文件时，服务端会返回已有 `Document`，避免重复创建资料卡片。

但 `contentHash` 只能解决“字节级完全一样”的问题。下面这些情况它解决不了：

1. 同一份讲义的 v1 和 v2：文件内容不同，所以 hash 不同，但它们大概率是同一份资料的更新版。
2. 同一主题的讲义和练习：文件名、内容都不同，但应该提示用户“这两份资料互补，可以都保留”。
3. 未处理资料或 chunk 太少：系统其实没有足够依据判断，不能硬给建议。
4. 资料列表分页：用户指定分析某个 `documentId` 时，如果这个资料不在最近 N 条里，建议会漏掉目标资料。

这就是 Phase 6.8 的切入点：不是重做上传去重，而是在 RAG 已有数据之上，加一层只读的资料关系判断。

## 为什么不用真实模型

这次没有让 Agent 调 OpenAI、DeepSeek 或 Gemini，而是继续沿用 Phase 6 的确定性 policy 风格。

原因很现实：

- 资料管理建议要稳定，测试里同一组输入应该得到同一组输出。
- 第一版判断主要依赖文件名、类型、状态、`contentHash`、chunk 数量和少量摘要，规则已经够用。
- 自动调用模型会引入成本、延迟和不稳定输出，还会让“上传资料”这种基础操作变重。
- 当前功能只是建议，不是最终事实来源，不值得为了第一版引入复杂异步任务和持久化建议表。

所以架构选择是：

```text
/knowledge 页面
  -> GET /knowledge-agent/suggestions
  -> KnowledgeAgentService 读取当前用户 Document + 少量 Chunk 摘要
  -> @repo/agent analyzeKnowledgeDedup()
  -> @repo/agent organizeKnowledgeDocuments()
  -> 返回只读建议
  -> 前端展示，不自动执行
```

这个设计的好处是边界非常清楚：Agent 只分析，不写库；服务端只聚合当前用户数据，不创建新事实；前端只展示建议，不提供“一键自动合并”这种危险动作。

## 共享 contract 先落地

这类功能最怕前后端口径不一致，所以先在 `@repo/types` 里定义 `knowledge-agent` contract。前端、后端、测试都使用同一份 Zod schema。

简化后的响应结构类似这样：

```ts
export const knowledgeAgentSuggestionResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  dedup: knowledgeDedupResultSchema,
  organizer: knowledgeOrganizerResultSchema,
});
```

其中 `dedup.items` 只允许这些类型：

```ts
export const knowledgeDedupSuggestionKindSchema = z.enum([
  'exact_duplicate',
  'possible_revision',
  'complementary',
  'insufficient_signal',
]);
```

对应建议动作也被限制在固定枚举里：

```ts
export const knowledgeDedupRecommendationSchema = z.enum([
  'use_existing',
  'replace_old',
  'keep_both',
  'review_manually',
]);
```

这样做的价值是：前端不会收到一个自由发挥的字符串，也不会因为后端改了文案就破坏 UI 逻辑。面试里可以把它说成“用 schema 把 Agent 输出收敛成稳定 API contract”。

## KnowledgeDedupAgent 怎么判断

Dedup 的逻辑不是简单找文件名相同，而是分层判断。

第一层是精确重复：同一个用户下，如果两份资料 `contentHash` 一样，就是 `exact_duplicate`。正常上传链路已经会拦截这种情况，但这里保留判断，是为了兼容历史数据和异常导入场景。

第二层是疑似新版：文件名归一化后高度相似，文件类型一致，且 `contentHash` 不同，就认为可能是 `possible_revision`。这里没有直接用更新时间判断新旧，因为第一版更关注“是否像同一份资料的不同版本”，最终仍交给用户人工核对。

第三层是互补资料：主题关键词有重合，但文件名不像同一份资料的版本关系，就认为是 `complementary`。比如“考研数学 极限讲义”和“考研数学 极限练习题”更适合提示“可以都保留”。

如果这些规则都没有命中，例如资料数量太少，或者文件名和摘要没有形成可解释的 hash、版本、主题重合信号，就输出 `insufficient_signal`，避免硬猜。

一个关键点是：规则要能解释。用户看到的不是“AI 觉得重复”，而是“文件名高度相似，但内容 hash 不同，建议人工核对是否是新版”。

## KnowledgeOrganizerAgent 怎么组织

Organizer 的第一版只做轻量标签和集合建议，不新增数据库表。

它会从文件名和少量 chunk 摘要里识别：

- 学科：数学、英语、政治、计算机、专业课、其它。
- 资料类型：讲义、笔记、真题、错题、练习。

如果至少两份资料共享一个明确学科，就给 collection 建议；如果只有一份资料，就只给 tag，不强行创建集合。

这个细节很重要。很多系统会为了显得“智能”，对任何输入都输出一堆分类，结果用户看起来反而不信任。这里宁愿少说，也不在信号不足时装作确定。

## 服务端 API 的边界

新增的 API 是：

```text
GET /knowledge-agent/suggestions?documentId=&limit=
```

它经过 `JwtAuthGuard`，所有查询都按当前 `userId` 隔离。Service 层只读取数据，不写任何资料事实表：

- 不写 `Document`。
- 不写 `Chunk`。
- 不新增集合表或标签表。
- 不删除 MinIO 对象。
- 不自动合并或替换资料。

实现时还修了一个容易漏掉的问题：如果请求带了 `documentId`，不能只查最近 `limit` 条资料，否则目标资料可能因为不够新而被漏掉。

正确做法是先验证目标资料属于当前用户，再读取最近资料，并在目标不在列表里时补进去：

```ts
if (query.documentId) {
  await this.assertOwnedDocument(userId, query.documentId);
}

const documents = await prisma.document.findMany({
  where: { userId },
  orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  take: query.limit,
  select,
});

const scopedDocuments = await this.includeTargetDocumentIfMissing(
  userId,
  query.documentId,
  documents,
  select,
);
```

这个问题很适合面试展开：它不是算法问题，而是“用户显式指定目标时，分页窗口不能让目标丢失”的产品一致性问题。

## 前端怎么展示

`/knowledge` 页面新增了“资料管理建议”面板，放在状态摘要和资料列表之间。

前端只负责展示四类状态：

- loading：建议加载中。
- error：建议失败，但不影响资料列表。
- empty：资料不足或没有有效信号。
- suggestions：展示重复/新版/互补建议、集合建议和标签。

上传、替换、处理、删除资料后，除了失效原本的 document/query cache，也要失效 knowledge agent suggestions。否则用户刚处理完资料，建议面板还停留在旧结果。

这类失效逻辑可以简单理解成：

```ts
await queryClient.invalidateQueries({
  queryKey: knowledgeAgentQueryKeys.all,
});
```

这一点最后也被单独补了测试，防止后续只刷新资料列表、忘记刷新建议面板。

## 这次找出并修掉的问题

实现和复审过程中，重点修了几类问题：

1. `documentId` 不能接受空字符串。  
   查询参数来自 URL，如果不做 trim/min 校验，空字符串可能进入 Service 层，造成无意义 targeted 查询。现在 schema 会把它挡住。

2. targeted document 可能不在 recent limit 内。  
   如果用户明确传了 `documentId`，Service 必须先验证归属并补入目标资料，不能只依赖最近 N 条。

3. 版本判断不能把年份误判成 v1/v2。  
   文件名归一化时要谨慎处理版本号，避免“2026 真题”这种年份被当成版本标记。

4. 标签不能给一个不可靠的 unknown fallback。  
   没有足够主题信号时，不强行贴标签；空建议比错误建议更可信。

5. package export 要可运行验证。  
   `@repo/agent/knowledge-dedup` 和 `@repo/agent/knowledge-organizer` 需要 subpath export，并用测试确保运行时 import 不炸。

6. 前端建议缓存要在资料变化后失效。  
   上传、替换、处理、删除都会改变建议输入，所以必须一起 invalidate。

7. tag chip 要能换行。  
   中文标签、长文件名或长分类词在移动端可能撑破容器，所以补了 `max-w-full` 和换行处理。

这些问题看起来都不大，但它们体现的是工程质量：Agent 功能不只是“能返回点东西”，还要处理权限、分页、缓存、移动端布局和可测试性。

## 面试时可以怎么讲

这段项目经历可以这样组织：

> 我们做多 Agent 不是把所有地方都接大模型，而是按职责拆分。比如资料管理里，我把 KnowledgeDedupAgent 和 KnowledgeOrganizerAgent 设计成 deterministic policy，它们不直接调用真实模型，只读取当前用户的资料元数据和少量 chunk 摘要，输出重复、新版、互补、集合和标签建议。服务端用 Zod contract 约束输出，NestJS API 做用户隔离和只读聚合，前端在知识库页面展示建议，并在上传、替换、处理、删除后做缓存失效。整个链路不自动删除、不自动合并、不写分类事实，用户保留最终整理权。

如果面试官继续追问“为什么不用大模型”，可以回答：

> 第一版信号主要来自文件名、contentHash、资料状态和 chunk 摘要，规则足够稳定；用确定性 policy 可以做到可测试、低成本、低延迟，也不会污染上传链路。后续如果进入 Phase 7，有 BullMQ 和事件总线后，可以考虑把更复杂的语义聚类放到后台任务里，但仍然应该保留用户确认边界。

如果面试官追问“怎么保证数据安全”，可以回答：

> API 必须登录，Service 层所有 Document 和 Chunk 查询都带 userId。`documentId` targeted 查询会先验证归属。建议生成只读取裁剪后的 chunk 摘要，不返回完整 chunk，也不保存 prompt、回答或 API key。建议 API 不进入 Dexie mutationQueue，因为它是在线只读能力，失败只影响建议面板，不影响资料上传和检索主链路。

## 总结

Phase 6.8 的价值不在于“加了两个 Agent 名字”，而在于把资料管理这个真实问题拆成了一个可控闭环：

- 上传链路继续负责确定性的文件管理和 `contentHash` 精确去重。
- KnowledgeDedupAgent 负责解释资料之间的重复、新版和互补关系。
- KnowledgeOrganizerAgent 负责轻量集合与标签建议。
- Server API 负责用户隔离、只读聚合和 contract 校验。
- 前端负责低风险展示，不替用户做不可逆操作。

这就是比较健康的多 Agent 落地方式：每个 Agent 有明确职责，有输入输出 contract，有测试，有失败边界，也不会为了“智能”牺牲系统可控性。
