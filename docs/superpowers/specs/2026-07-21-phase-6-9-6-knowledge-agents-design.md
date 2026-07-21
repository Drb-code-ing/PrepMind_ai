# Phase 6.9.6 Knowledge Agents Semantic Path Design

日期：2026-07-21
状态：设计检查点，等待书面规范审阅
上游权威：`docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`

## 1. 目标与价值

Phase 6.8 已经提供两个可用但完全确定性的资料管理 Agent：

- `KnowledgeDedupAgent` 是资料关系判断员，负责解释完全重复、语义重复、疑似新版和互补资料；
- `KnowledgeOrganizerAgent` 是资料整理顾问，负责提出学科、主题、标签和资料集合建议。

当前实现主要依赖 `contentHash`、归一化文件名和固定关键词。它能识别“高数讲义-v1 / v2”，却难以判断“线性代数核心公式”与“线代期末速查表”究竟是语义重复、不同版本还是互补资料；Organizer 也无法稳定理解词表以外的专业课主题。

本阶段把两者升级为受治理的真实语义 Agent：精确事实和权限仍由本地代码决定，Qwen embedding 负责缩小候选范围，DeepSeek V4 Pro 负责有限语义判断，用户保留最终整理权。

## 2. 当前事实与缺口

当前链路为：

```text
GET /knowledge-agent/suggestions
  -> JwtAuthGuard
  -> KnowledgeAgentService 按 canonical userId 读取最多 20 份资料
  -> 每份资料最多读取 3 个 chunk、每段截取 180 字符
  -> analyzeKnowledgeDedup()
  -> organizeKnowledgeDocuments()
  -> /knowledge 展示只读建议
```

必须保留的能力：

- 相同 `contentHash` 的完全重复判断；
- owner-scoped Document / Chunk 查询；
- API 与前端只读，不写 Document、Chunk、分类表或 Dexie mutationQueue；
- 建议失败不阻断上传、处理、替换、检索或 RAG Chat；
- 每类最多返回少量可解释建议。

必须修复的缺口：

- 疑似新版只看文件名，没有真正比较内容语义和时间证据；
- 互补关系与 Organizer 依赖小型硬编码词表；
- 大部分输入字段未参与判断，`replace_old` 也没有安全的事实依据；
- 没有 embedding 候选、模型 candidate、版本化 evidence code、usage、成本或降级状态；
- 没有职责匹配的 deterministic / Mock / controlled-Live paired eval。

## 3. 方案比较与决定

### 方案 A：全部资料直接交给大模型

实现最短，但 20 份资料会迅速扩大 prompt，难以证明跨用户隔离、延迟和成本上限，也容易让模型在没有候选约束时虚构文档关系。拒绝。

### 方案 B：新增 Document 级 embedding 与持久化重算任务

长期查询效率较高，但会引入 Prisma schema、迁移、历史回填、处理状态和 worker 重算一致性。本阶段的目标是补齐只读 Agent，而不是新增资料事实层。延后到真实流量证明必要时再单独设计。

### 方案 C：复用现有 chunk embedding 召回，再由模型裁决

采用此方案。资料处理时已使用 Qwen `text-embedding-v4` / 1536 写入 owner-scoped Chunk embedding。本阶段只读取这些既有向量，先形成少量文档对，再把经过安全投影的名称和短摘要交给 DeepSeek V4 Pro。它避免新的 embedding 写路径，也让模型只能判断本地候选，不能遍历或发明资料。

## 4. 职责与权限边界

### 4.1 KnowledgeDedupAgent

可以：

- 用 `contentHash` 零调用确认完全重复；
- 对 embedding 召回的有限文档对判断 `semantic_duplicate`、`possible_revision`、`complementary` 或 `unrelated`；
- 返回文档关系、固定 evidence code、置信等级和只读建议。

不可以：

- 删除、替换、合并、隐藏或重命名资料；
- 把“语义相似”冒充“hash 完全相同”；
- 仅凭模型判断哪个版本更新；新版关系必须同时具备本地时间/版本信号；
- 返回候选范围之外的文档或把 `review_manually` 升级为自动执行。

### 4.2 KnowledgeOrganizerAgent

可以：

- 对安全、已处理的当前用户资料提出学科、资源类型、主题标签和集合建议；
- 在严格长度、字符、数量和成员索引约束内生成新主题标签或集合名；
- 结合 Dedup 的只读关系，避免把明显重复资料当成两个独立主题扩张。

不可以：

- 创建持久化标签/集合、移动资料或覆盖用户名称；
- 把模型标签当成资料事实或自动注入 Chat；
- 使用其他用户的名称、摘要、向量或已有集合；
- 生成指令性名称、凭据、URL、Markdown/HTML 或自由格式操作。

## 5. 数据流与组件

```text
authenticated GET /knowledge-agent/suggestions
  -> canonical userId + query limit/target validation
  -> owner-scoped Document snapshot
  -> exact hash/local deterministic facts
  -> owner-scoped safe Chunk embedding pair shortlist
  -> candidate eligibility + safety projection
  -> KnowledgeDedup model candidate? ----\
  -> KnowledgeOrganizer model candidate? -- parallel shared request budget
  -> local strict validation and merger
  -> versioned read-only response + safe Agent Trace
  -> /knowledge suggestion panel
```

新增组件边界：

- `KnowledgeSemanticCandidateSource`：只从当前用户、`DONE`、具有 embedding 且安全的 chunk 中形成候选；测试使用 fake source；
- `KnowledgeDedupModelCandidate`：只裁决本地编号的候选 pair；
- `KnowledgeOrganizerModelCandidate`：只对本地编号的文档提出受限标签和集合；
- `KnowledgeAgentMerger`：重新映射真实 document ID，保留 exact hash、本地时间、状态和所有 recommendation 权威；
- server composition root：解析 gate、模型、executor、预算、timeout、pricing 与 Trace，不把环境变量读取放进 `@repo/agent`。

本阶段不实现 LangGraph `StateGraph`；两个节点继续保持可独立测试的显式业务链，Phase 6.9.10 再纳入可执行 graph family。

## 6. Embedding 候选规则

- 数据来源固定为处理阶段已生成的 Qwen `text-embedding-v4` / 1536 Chunk embedding；建议请求不产生新的 embedding 写入或外部 embedding 调用。
- 查询始终绑定 canonical `userId` 与本次最多 20 个 document ID；SQL 不接受客户端 userId。
- 每份资料最多使用 6 个按 chunk index 稳定采样且 `metadata.safety` 可用于语义处理的 chunk；不把向量或 chunk 正文返回给前端或 Trace。
- 文档对得分使用最高 3 个跨文档 chunk cosine similarity 的平均值；候选阈值固定为 `0.78`，每次最多 12 对，并按分数、document ID 稳定排序。
- 相同 hash 的 pair 不进入模型；任一资料非 `DONE`、没有安全 embedding、越权或目标资料不存在时不进入语义候选。
- 阈值和采样算法使用版本 `knowledge-semantic-shortlist-v1`。后续调整必须新建版本并重跑同一评测集，不能静默改变历史 evidence。

### 6.1 Owner snapshot 与 stale fencing

- Document、候选 Chunk identity、safety metadata 和 pgvector score 必须在同一个 PostgreSQL `REPEATABLE READ` 只读事务中按 canonical `userId` 获取；模型调用绝不放在数据库事务内。
- 事务输出深冻结的 `knowledge-owner-snapshot-v1`，其 fingerprint 覆盖 canonical owner hash、document ID、`updatedAt`、`contentHash`、`status`、所选 chunk ID/index/content hash/safety version 与 shortlist version；fingerprint 和 ordinal map 不返回客户端。
- 两个 candidate 共享同一 immutable snapshot。在 provider invocation 前，server 使用短只读查询重新校验每个 document 的 owner、`updatedAt`、`contentHash`、`status` 与选中 chunk identity；任一删除、替换、重新处理、owner/status/version 变化都以 `snapshot_stale` provider 前零调用回退。
- 可选 `documentId` 的归属校验必须并入同一 snapshot，不再以“先 assert、再独立 findMany”作为模型安全边界。跨用户、消失目标或 targeted document 未进入最终 snapshot 都不得形成 prompt。

## 7. 模型输入、输出与本地合并

### 7.1 共同输入投影

模型只看到 `d0`、`d1` 这类本地 ordinal、规范化文件名、类型、受限时间关系、最多两段已脱敏短摘要和 embedding evidence band。它看不到：

- canonical userId、真实 UUID、storageKey、MinIO 路径；
- embedding 数值、完整 chunk、完整 prompt 或其他用户资料；
- API key、cookie、token、base URL、provider raw error；
- 删除、替换、写库或工具执行能力。

所有可变字符串必须在 ordinal map 和 prompt 组装之前通过版本化 `knowledge-model-projection-v1`，顺序固定为：

1. strict schema 校验原始类型、UTF-8 字节/字符上限和普通自有属性，拒绝 hostile getter/proxy；
2. 对规范化文件名以及每一段候选摘要分别调用共享 candidate text guard，检测 credential、Bearer/cookie、private key、client secret/password、system prompt、instruction override、tool/data-write 指令与控制字符；
3. 同时要求 chunk 的持久化 `metadata.safety` 为可用于模型的明确安全状态；metadata 缺失、未知或与重新扫描结果冲突时取更严格结论；
4. 任一字段失败即排除整份 document，不允许只删除命中片段后继续调用；若它是 targeted document，或排除后不再满足 Agent eligibility，则以固定 reason provider 前零调用；
5. 通过后才进行长度裁剪、ordinal 分配和深冻结。禁止先裁剪再扫描，避免凭据/注入只存在于被截断部分时漏检。

exact hash 可以继续对被语义安全门排除的资料生成本地关系，因为它不向 provider 暴露名称或正文。测试必须逐字段证明 filename、每一段 summary、safety metadata 和 hostile accessor 都在首次 runtime invocation 之前完成扫描。

### 7.2 Dedup candidate schema

```ts
{
  decisions: Array<{
    pairIndex: number; // 仅能引用 0..11 的本地候选
    relation: 'semantic_duplicate' | 'possible_revision' | 'complementary' | 'unrelated';
    confidence: 'medium' | 'high';
    evidenceCodes: Array<
      | 'semantic_overlap'
      | 'same_scope'
      | 'version_signal'
      | 'newer_timestamp'
      | 'different_purpose'
      | 'complementary_coverage'
      | 'insufficient_version_evidence'
    >;
  }>;
}
```

本地 merger 规则：

- `exact_duplicate` 永远由 hash 生成，模型无权覆盖；
- `semantic_duplicate` 只映射为 `review_manually`，不能映射为自动删除或 `use_existing`；
- `possible_revision` 必须同时有本地版本/时间信号，否则降为 `review_manually` 的语义相似提示；
- `complementary` 映射为 `keep_both`；
- `unrelated` 不生成产品建议；
- 重复 pair、越界索引、关联约束不满足或未知 evidence code 使整次 candidate fail-closed，不做部分采纳。

### 7.3 Organizer candidate schema

```ts
{
  tags: Array<{
    documentIndex: number;
    subject: 'math' | 'english' | 'politics' | 'computer' | 'major' | 'other';
    resourceType: 'lecture' | 'notes' | 'past_exam' | 'mistakes' | 'practice' | 'reference' | 'other';
    topicLabels: string[]; // 最多 2 个
  }>;
  collections: Array<{
    memberIndexes: number[]; // 2..8 个，唯一且有序
    name: string;
    theme: 'subject' | 'exam' | 'topic' | 'project';
  }>;
}
```

本地代码限制每份资料最多 3 个最终标签、每次最多 5 个集合。自由标签长度为 2..12，集合名长度为 2..20，只允许 Unicode 字母、数字、空格、`·`、括号、下划线和连字符；凭据、指令覆盖、URL、HTML/Markdown、控制字符与重复成员全部拒绝。description、reason、confidence、signals 和真实 document ID 由本地模板重建。

## 8. Eligibility、zero-call 与降级

必须在 provider 前零调用：

- 全局 live gate 或对应 Agent gate 关闭；
- 请求已 abort、预算不能预留、executor/telemetry 不可验证；
- 越权目标、空资料、全部未处理、没有安全摘要/embedding；
- exact-hash 已足够回答且没有额外 semantic pair；
- prompt injection、credential material、系统指令覆盖或 hostile accessor；
- Dedup 没有达到阈值的 semantic pair；Organizer 没有至少 1 份安全可投影资料。

降级固定为：

- Dedup 只保留 exact hash 与现有本地高置信建议；
- Organizer 返回现有词表 policy 的标签/集合或 insufficient signal；
- timeout、schema invalid、provider failure、usage invalid、budget exhausted、abort 或 Trace unavailable 均不能扩大建议或权限；
- API 仍返回成功的只读本地结果，并以固定 disposition 标记 degraded；不得伪造 `candidate_applied`、0 成本成功或模型关系。

## 9. Runtime、开关与预算

新增 server-only 独立回滚开关，默认均为 `false`：

```text
KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=false
KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=false
KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS=4500
KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS=4500
```

真实调用还必须同时满足 `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`、有效 provider credential、已知 pricing profile 和本次 owner-scoped eligibility。Web/worker 不接收这四个 server gate。

生产候选固定使用 DeepSeek `deepseek-v4-pro` 的 non-thinking JSON-object transport、canonical Zod 二次校验和 SDK `maxRetries=0`。若后续改模型，必须新建 prompt/evidence 版本并重跑 paired eval。

单请求共享不可变预算：

| 项目 | Dedup | Organizer | 请求总上限 |
| --- | ---: | ---: | ---: |
| provider calls | 1 | 1 | 2 |
| input tokens | 3000 | 3000 | 6000 |
| output tokens | 500 | 700 | 1200 |
| timeout | 4500 ms | 4500 ms | 并行额外 P95 <= 5200 ms |

两次 candidate 在安全投影完成后并行执行，但共享同一冻结 budget snapshot。任一调用不能消费另一调用已预留的额度。按已冻结的 DeepSeek V4 Pro 非缓存价格 `3 CNY / 1M input`、`6 CNY / 1M output`，单请求理论硬上限为 `0.0252 CNY`，生产 cap 固定为 `0.03 CNY`；未知或过期 pricing profile 关闭模型 candidate。

provider usage 必须是正安全整数，并与 reservation、runtime result 和 Trace 一致。`0/0`、缺失、非法、超预算或 Trace 不可验证都按失败回退，不显示零成本成功。

## 10. 评测合同与量化门槛

数据集固定为 `phase-6.9-knowledge-agents-v1`，不使用真实用户资料、凭据或完整 chunk：

| Agent | case 数 | zero-call | runtime | 覆盖 |
| --- | ---: | ---: | ---: | --- |
| Dedup | 40 | 16 | 24 | exact hash、语义重复、新旧版、互补、无关、注入、越权、缺 embedding |
| Organizer | 32 | 8 | 24 | 学科、专业课、资源类型、主题标签、集合、单资料、注入、非法标签 |
| 合计 | 72 | 24 | 48 | deterministic / Mock / Live 使用相同 case ID |

24 个 Dedup runtime case 与 24 个 Organizer runtime case 使用固定 `pairedRunIndex=0..23` 组成 24 次并行请求，因此单 Agent 和 endpoint 延迟都能在同一 Live run 中复现。zero-call case 不进入语义质量或延迟样本，只单独验证安全门。

指标定义固定为：

```text
semanticScore =
  0.35 * dedupSemanticMacroF1
  + 0.15 * revisionRecall
  + 0.20 * organizerSubjectTop1
  + 0.15 * organizerTagMicroF1
  + 0.15 * organizerCollectionPairwiseF1
```

所有指标取值为 `0..1`。deterministic baseline 与 model candidate 都只在同一 48 个 runtime case 上计算；schema invalid、attempted fallback、缺失或非法输出在对应 case 上按错误预测计分，不得从分母删除。提升 10 个百分点表示 `modelSemanticScore - deterministicSemanticScore >= 0.10` 的绝对差值，不是相对百分比。

P95 使用 nearest-rank：对 24 个观测值升序排序，取 `ceil(0.95 * 24)` 即第 23 个值。单 Agent additional latency 从完成本地 projection/budget reservation 到 candidate terminal；endpoint additional latency 从两个并行 candidate dispatch 到两者都 terminal。所有 attempted success、fallback、provider error 和 timeout 都进入样本，zero-call 不进入；timeout 以实际观测时长计且仍必须受 4500ms abort 上限约束。branch 与 main 分别出报告，不能拼接样本或以 Mock latency 替代 Live。

启用生产 gate 前必须同时满足：

- 24/24 zero-call 实际穿过 eligibility/safety/budget/abort guard，runtime invocation 为 0；
- 48/48 runtime case structured output 与 canonical schema success；
- critical safety、跨用户读取、越界 document index、未确认写操作和实际 Document/Chunk/分类 mutation 均为 0；
- exact-hash precision/recall 为 100%，且模型不能修改 exact 结论；
- Dedup semantic relation macro-F1 >= 0.85，revision recall >= 0.85，无关资料 false-positive rate <= 0.10；
- Organizer subject top-1 accuracy >= 0.88，topic tag micro-F1 >= 0.80，collection pairwise-F1 >= 0.80；
- 按上述固定公式计算的模型 semantic score 至少比 deterministic baseline 提升 10 个百分点，且不降低安全/权限指标；
- 单 Agent additional P95 <= 4500 ms，并行 endpoint additional P95 <= 5200 ms；
- provider/model/promptVersion/datasetVersion/usage provenance 全部可追踪，controlled-Live 总费用 <= 1.00 CNY；
- 模型失败后的产品结果不比 deterministic fallback 更宽松。

任一门槛失败时两个生产 gate 保持关闭。由于这两个 Agent 被产品路线定义为必须有真实模型参与，失败后的动作是修复 prompt、candidate 或预算并建立新版本，不是把最终架构永久退回纯规则。

## 11. API、Trace 与前端表现

`GET /knowledge-agent/suggestions` 保持认证、只读和向后兼容，新增每个 Agent 的安全 runtime metadata：

- `source`: `local_deterministic | hybrid_model`；
- `disposition`、`reasonCode`、`attempted`、`degraded`；
- 安全 usage summary 与 `traceId`，不返回 prompt、摘要正文、向量、provider output 或 raw error。

Agent Trace 使用一个 Knowledge suggestion parent run 和两个 candidate step。每个真实 provider call 只记账一次；若未来共享一次模型调用，两个 Agent 必须通过同一 `usageRef` 引用，不能重复累计成本。

`/knowledge` 继续只展示建议，不新增“自动整理”按钮。hybrid 成功时显示简短的“语义建议”来源；default-off 或降级时显示“本地规则建议”，模型不可用不影响上传、处理、检索和资料列表。浏览器验收必须覆盖两种来源、空态、失败态和移动端，不为验收新增无产品价值页面。

## 12. 实施检查点

1. **6.9.6.1 设计与基线合同**：本设计、72-case dataset contract、指标计算和 deterministic baseline。
2. **6.9.6.2 Mock candidate**：strict schema、ordinal projection、safety/zero-call、budget/abort/usage 与本地 merger。
3. **6.9.6.3 Embedding shortlist**：owner-scoped pgvector 候选、稳定采样/排序、fake source 和 service contract。
4. **6.9.6.4 Production composition**：独立 default-off gate、DeepSeek executor、并行共享预算、API metadata 与 Trace。
5. **6.9.6.5 产品集成**：`/knowledge` hybrid/degraded 状态、无写操作回归、Docker 配置和运维文档。
6. **6.9.6.6 验收收口**：Mock、唯一受控 Live、Docker API、可见浏览器、精确清理、main replay、推送与 SHA parity。

每个检查点继续拆成一个关注点一个提交。新任务从已推送 main 开普通 `codex/` 分支，不从功能分支再开分支，不使用 worktree，除非后续出现必须隔离的明确理由。

## 13. 验收与清理

阶段完成必须具备：

- Agent/types/server/web 的 focused tests、typecheck、lint、build；
- 72-case deterministic baseline、Mock 和同 case controlled-Live 报告；
- Qwen embedding shortlist 的 owner isolation、稳定排序、无向量泄漏和 provider parity；
- Docker 真实 API 分别启用 Dedup-only、Organizer-only 与双开关；
- 可见 `/knowledge` 浏览器验证 hybrid success、default-off fallback、上传/处理/检索不受影响；
- Trace usage/cost/disposition 与 API 双向一致，但不做 aggregate API duration 与 candidate step duration 的精确相等耦合；
- 合成账户、文档、chunk、对象、BackgroundJob、Trace、浏览器 storage 精确清理为 0；
- controlled-Live 只使用合成资料。SDK/Nest logger、HTTP debug、error telemetry、CLI stdout 和 evidence writer 都不得记录 projected prompt、文件名/摘要正文、provider response/body/header、credential 或 raw error；临时 prompt/evidence 文件数量必须为 0，公开 evidence 只保存 aggregate、hash、usage、费用和固定状态码；
- 外部 provider 是否保留请求不受本仓库清理控制。生产 gate 只有在 provider 数据保留/训练策略和账号设置被文档化并获项目接受时才能启用；无法确认时保持 default-off。不得在 evidence 中声称已删除 provider 侧日志；
- 恢复 `AI_PROVIDER_MODE=mock`、live=false、两个 Knowledge gate=false，不执行 Docker prune、`down -v`、volume reset、Redis flush 或 MinIO wipe；
- 分支验收后 `--no-ff` 合并 main，在 main 重跑关键静态、Docker、可见浏览器 default-off 与必要的受控 Live authority 回放，推送并确认 `origin/main...HEAD = 0 0`。

本设计和后续实现都不能改写 Phase 6.9.5 的 V10/V22 历史，也不能提前宣布 Phase 6.9、分层记忆或多 Agent 博客完成。

## 14. 文档交付

随实现逐步同步：

- `AGENTS.md`：当前状态、边界、gate、证据、下一任务与可复制追问；
- `README.md`：用户可见的 Knowledge 语义建议与运行边界；
- `docs/roadmap.md`：6.9.6 检查点、提交和证据；
- `docs/data-flow.md`：embedding shortlist、candidate、merger、Trace 与 read-only 数据流；
- `docs/ai-behavior-acceptance.md` / `docs/acceptance-checklist.md`：72-case、Live、Docker、浏览器、回滚和清理；
- `docs/dev-start.md`：实现后才加入实际可用的 gate、timeout 和 Docker 配置；
- `DEVLOG.md`：目标、原因、结果、边界、验收与回顾问题。

## 15. 回顾时可以问

- “KnowledgeDedupAgent 和 KnowledgeOrganizerAgent 分别解决什么问题？”
- “为什么 exact hash 必须零调用，而语义关系需要 embedding + 大模型？”
- “为什么复用 Chunk embedding，而不立刻新增 Document embedding 表？”
- “模型为什么只能返回 ordinal 和受限关系，不能直接返回删除/替换操作？”
- “两个 candidate 并行时如何共享预算并避免重复记账？”
- “为什么 default-off 回放和精确清理仍是完成标准的一部分？”
