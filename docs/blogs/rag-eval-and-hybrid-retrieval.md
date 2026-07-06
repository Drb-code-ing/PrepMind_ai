# RAG Eval、Hybrid Retrieval 和真实检索验收：我是怎么把“能跑”变成“可信”的

## 这篇文章解决什么问题

做 RAG 很容易出现一个误区：接口能返回结果，页面能展示引用，就说“RAG 完成了”。但真正面试或者上线时，面试官追问一句：“你怎么证明它真的检索到了正确资料？”这个时候只说“我手动试过”就有点虚。

PrepMind 的 RAG 链路一开始也经历了这个阶段：上传、解析、分块、embedding、写 chunk、pgvector 检索、Chat 注入上下文都跑通了。但跑通不等于可信。后来我把验收分成三层：

- 第一层：固定 RAG Eval Baseline，先有一套稳定指标。
- 第二层：Hybrid Retrieval，让向量召回和关键词召回互补。
- 第三层：真实 API Smoke，用真实服务跑上传、处理、检索和 eval 汇总。

这套东西的价值是：以后改 embedding 模型、改排序、加 reranker、加 query rewrite，都不是靠感觉判断，而是有一条可复用的验收线。

## 为什么 fake embedding 不能证明 RAG 完成

本地开发和 CI 里我们经常用 fake embedding。它的好处很明显：

- 不花钱。
- 不需要 API key。
- 不依赖外部模型网络。
- 可以稳定验证工程链路。

但 fake embedding 只能回答“链路有没有断”，不能回答“语义检索好不好”。

比如用户问：

```text
复习压力和每日卡片上限应该怎么安排？
```

真实 embedding 可能把它和英文资料里的 `scheduling pressure`、`daily card limits` 联系起来；fake embedding 就不一定。fake 的向量通常是 deterministic 或伪造的，它不理解语义，只适合证明：

- 文档能不能处理成 chunk。
- embedding 字段能不能写入 pgvector。
- `/knowledge/search` 能不能返回结构正确的 hits。
- 前端能不能展示检索结果。

所以我在项目里明确写了边界：**fake embedding 证明工程回归，不证明真实语义质量**。

## 第一层：固定 RAG Eval Baseline

第一步不是马上优化检索，而是先建一套固定评估集。否则你改完 hybrid retrieval，只能说“感觉更好了”，但没法量化。

我们新增了 `ragEvalCases` 和 `runRagEval()`。runner 不直接访问数据库、不调模型、不发 HTTP，它只吃已经返回的 hits，然后算指标。

简化后的输入大概是这样：

```ts
const summary = runRagEval({
  cases: [
    {
      id: 'exact-blue-lantern',
      query: 'blue lantern theorem 是什么？',
      topK: 5,
      shouldHaveHit: true,
      expectedContentIncludes: ['blue lantern theorem'],
      safetyExpectation: 'no-high-risk',
    },
  ],
  hitsByCaseId: {
    'exact-blue-lantern': [
      {
        chunkId: 'chunk_1',
        documentId: 'doc_1',
        documentName: 'demo.txt',
        content: 'The unique retrieval answer is: blue lantern theorem.',
        score: 0.91,
        metadata: {
          safety: { riskLevel: 'low', safeForPrompt: true },
        },
      },
    ],
  },
});
```

它输出的指标包括：

- `recall@k`：前 K 条里有没有命中应该命中的资料。
- `top1Accuracy`：第一条是不是就是正确资料。
- `safetyPassRate`：有没有把高风险 chunk 当成安全证据。
- `noHitPassRate`：无关问题有没有被错误强行命中。

这里的关键设计是：eval runner 是纯函数。这样它跑得快、测得稳，也不会把真实用户资料、API key 或 prompt 存进评估文件。

## 第二层：Hybrid Retrieval

纯向量检索适合语义相近的问题，但对精确术语、专有名词、编号、公式符号不一定稳。比如 `blue lantern theorem` 这种词，如果 embedding 模型觉得它没语义背景，向量分数可能不够高。

所以 Phase 7.8.2 做了第一版 Hybrid Retrieval：

1. 先用 query embedding 召回 pgvector candidates。
2. 再用 PostgreSQL `websearch_to_tsquery('simple', query)` 召回 keyword candidates。
3. 按 `chunkId` 去重。
4. 把 `vectorScore` 和 `keywordScore` 融合成最终 `score`。
5. 响应结构保持不变，只在 `metadata.retrieval` 里加一点调试信息。

这一步的好处是互补：

- 向量召回负责“意思像不像”。
- 关键词召回负责“字面有没有精确出现”。

第一版没有急着上 Elasticsearch、Meilisearch、reranker 或中文分词索引，因为当前目标是补强小规模学习资料场景。工程上先把问题切小，后续再逐步升级。

## 第三层：真实 API Smoke

固定 eval runner 还是离线的，它只能评估你喂进去的 hits。于是 Phase 7.8.3 又补了一条真实 API smoke：

```powershell
bun --filter @repo/server smoke:rag-eval
```

这条脚本会做完整链路：

1. 注册临时账号。
2. 上传合成 TXT 学习资料。
3. 调 `/knowledge/documents/:id/process` 处理资料。
4. 轮询资料状态直到 `DONE`。
5. 对固定 case 调 `/knowledge/search`。
6. 把真实 hits 喂给 `runRagEval()`。
7. 打印报告。
8. 默认 best-effort 删除临时文档。

报告大概长这样：

```text
PrepMind RAG Eval Smoke

Status: PASS
Metrics
- Passed: 3/3
- Recall@K: 100.0%
- Top1 Accuracy: 100.0%

Case Hits
- exact-blue-lantern: hits=1 topScore=0.506920 topDocument=...
```

这里有一个很重要的安全边界：报告不打印 API key、access token、cookie、embedding 向量，也不打印完整 hit content。因为 smoke 是给开发和验收看的，不应该变成泄密日志。

## Phase 7.8.4 又补了什么

Phase 7.8.3 完成后，最终 review 提了一个很实际的小风险：如果未来有人把 `ragEvalCases` 里的 id 改了，smoke 脚本可能选不到 case，甚至少跑几个 case 还误报 PASS。

所以 Phase 7.8.4 做了两个小增强。

第一，抽出 `selectRagEvalSmokeCases()`：

```ts
export const RAG_EVAL_SMOKE_CASE_IDS = [
  'exact-blue-lantern',
  'semantic-review-pressure',
  'cross-language-weak-points',
] as const;

export function selectRagEvalSmokeCases(cases: RagEvalCase[]) {
  const casesById = new Map(cases.map((testCase) => [testCase.id, testCase]));
  const selected = RAG_EVAL_SMOKE_CASE_IDS.map((caseId) =>
    casesById.get(caseId),
  );
  const missingIds = RAG_EVAL_SMOKE_CASE_IDS.filter(
    (_caseId, index) => !selected[index],
  );

  if (missingIds.length > 0) {
    throw new Error(
      `RAG eval smoke cases are missing required ids: ${missingIds.join(', ')}`,
    );
  }

  return selected;
}
```

这样只要必需 case 缺失，脚本会在上传资料前失败，不会制造无意义数据，也不会误报。

第二，加了本地调试开关：

```powershell
$env:RAG_EVAL_SMOKE_KEEP_DATA='true'
bun --filter @repo/server smoke:rag-eval
Remove-Item Env:RAG_EVAL_SMOKE_KEEP_DATA
```

默认脚本还是会删除临时文档。但你想打开 `/knowledge` 页面检查资料、chunk 和检索效果时，可以临时保留合成测试文档。这个开关只适合本地调试，不应该放进 CI。

## 为什么 smoke 不等于 Chat live 验收

RAG Eval Smoke 验的是“检索链路”：

- 资料能不能上传。
- 文档能不能处理。
- embedding 能不能生成。
- chunk 能不能写入数据库。
- `/knowledge/search` 能不能命中。
- eval 指标是否通过。

它不验证最终模型回答质量。

最终 Chat 还多了很多变量：

- Chat prompt 怎么拼。
- RAG context 怎么注入。
- KnowledgeVerifierAgent 怎么加保守提示。
- 模型是否自然引用资料。
- TutorAgent 的讲题风格是否还生效。
- 流式输出是否完整。

所以项目里明确区分：

- 改 `/knowledge/search`：跑 RAG eval 和 API smoke。
- 改 Chat prompt / Tutor 输出 / RAG 引用格式：跑 live Chat 小样本。
- 改普通 CRUD / 后台任务 / Swagger：不用 live 模型。

这个边界很重要。否则要么过度测试，浪费钱；要么测试错层，给自己一种假的安全感。

## 这套方案面试怎么讲

如果面试官问“你的 RAG 是怎么做质量保障的”，可以这样讲：

第一，我没有只靠手测。我把 RAG 验收分层了：

- 工程链路层：fake embedding，验证上传、解析、分块、入库、检索 API。
- 指标层：固定 eval cases，用 `recall@k`、`top1Accuracy`、`safetyPassRate`、`noHitPassRate` 看检索质量。
- 真实链路层：本地 API smoke，用真实服务和真实 embedding provider 跑上传到检索的闭环。
- 最终体验层：改 Chat 输出时，再做 live Chat 小样本。

第二，我做了 Hybrid Retrieval，不只依赖向量：

- 向量检索解决语义相似。
- 关键词检索补精确术语和专有名词。
- 两路候选按 `chunkId` 去重融合，响应 contract 不变。

第三，我注意了安全和成本：

- smoke 不进默认 CI，不强依赖真实 API key。
- 日志不打印 token、key、向量和完整私有内容。
- eval 文件不保存真实用户资料。
- prompt injection 的风险由 SafetyGuard 和 verifier 边界继续兜住。

这样讲会比“我接了 pgvector”更像一个完整工程方案。

## 可以继续优化什么

后续还能继续做几件事：

- 加 reranker，对 top candidates 做二次排序。
- 加 query rewrite，让用户口语问题更容易命中资料。
- 给 PostgreSQL full-text 加合适索引，优化规模变大后的性能。
- 做中文分词或外部搜索引擎，增强中文关键词召回。
- 把 eval 结果持久化，形成长期趋势对比。
- 给不同 embedding 模型跑同一套 smoke，对比真实语义召回质量。

但这些都应该在现有 baseline 之上做。先有尺子，再谈优化，这就是这几轮 Phase 7.8 的核心思路。
