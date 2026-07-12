# Phase 6.9.3 Conversation Memory 验收记录

## 1. 结论

Phase 6.9.3 已完成。短期记忆与上下文装配链路已经从数据库 contract、权威状态、滚动摘要、并发 CAS，一直贯通到 Web Chat、Dexie 恢复、Docker Mock 和受控 Live 小样本。

本次验收证明：

- PostgreSQL 是 `ConversationSummary` / `ConversationState` 权威源，Redis 与 Dexie 只承担受限缓存和恢复职责；
- 滚动摘要能在固定触发条件下生成、复用，并在并发或失败时不错误推进水位；
- Web 会按优先级装配 base、当前问题、Agent/state、OCR、近期消息、RAG 与 summary，低优先级层不能挤掉当前用户指令；
- DeepSeek Live 摘要经过 strict schema 校验，最终 Chat 能利用摘要保留“二次函数判别式”和正确值 `1`；
- 摘要正文只保存在 PostgreSQL 权威 `ConversationSummary.summary` 字段并按 ownership 读取；Trace、headers、日志、数据库 metadata、验收记录和浏览器存储/UI 都不复制摘要正文、完整 prompt、API key 或 base URL；
- 验收结束后已恢复 Mock，并清理合成账号、会话、摘要、状态、Redis cache 和浏览器站点数据。

这不是“所有长对话都已经证明质量稳定”。Mock 证明工程 contract，受控 Live 只证明本次固定小样本的真实摘要与回答体验。更广泛的真实模型质量仍由后续 paired eval 和 Phase 6.9 总验收决定。

## 2. Git 与运行环境

| 项目 | 结果 |
| --- | --- |
| 验收日期 | 2026-07-12 |
| 功能分支 | `codex/phase-6-9-3-5-live-acceptance` |
| main / origin/main 基线 | `aa5d6688b6d72d60efeb0b6350b5312a3ea047b3` |
| 阶段实现提交 | 提交后使用 `git log -- docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md` 定位唯一收口提交 |
| Docker Desktop | 4.81.0 |
| 学习端 / API / Admin | `127.0.0.1:3000` / `:3001` / `:3100` |
| PostgreSQL / Redis / MinIO | `:5433` / `:6379` / `:9000-9001` |

文件名沿用 2026-07-11 制定并固定在执行计划中的交付路径，实际 Docker/Live 验收发生在 2026-07-12。

Docker 全栈恢复后，`postgres`、`redis`、`minio`、`server`、`worker`、`web`、`admin` 均运行，worker 为 `healthy`。Docker Desktop 4.81.0 在多服务并行 BuildKit session 中出现 `x-docker-expose-session-sharedkey` 非打印字符错误；本次只在本机临时使用 `COMPOSE_BAKE=false` 并顺序构建镜像，没有把该环境绕行固化进 Compose、Dockerfile 或生产配置，只在 `docs/dev-start.md` 记录可撤销的排障步骤。

2026-07-11 执行的 `docker compose down` 删除了容器，但没有删除 `docker_pgdata`，因此 PostgreSQL 数据仍在。原 MinIO 没有命名卷，旧对象不能承诺恢复；本次给 MinIO 增加逻辑卷 `miniodata:/data`，Compose project 名为 `docker` 时运行时名称是 `docker_miniodata`，之后普通容器重建不会再连带丢失对象。Compose 自动读取被 git 忽略的根 `.env` 做变量替换，但 server 只 allowlist 模型、双开关、provider key 与摘要预算，并显式锁定 `NODE_ENV=production`；不会把根文件里的 RAG 模式或其他无关凭据整体注入容器。仓库只提交变量引用，不提交值。

## 3. Mock 工程验收

### 3.1 API 级长会话

固定合成会话结果：

| 检查项 | 结果 |
| --- | --- |
| 12 条完整 USER/ASSISTANT 消息 | `generated` |
| summary version / watermark | `1 / 11` |
| 第二次 prepare | `reused`，仍为 version 1 |
| 跨用户 conversationId | `404` |
| 并发 prepare | 一方推进 version 2 / watermark 23，另一方 `stale_snapshot` |
| credential marker | 未进入摘要结果 |

消息 `order` 从 0 开始，因此 12 条完整消息的 watermark 是 11，16 条完整消息的 watermark 是 15；这表示目标范围全部覆盖，不是漏掉最后一条。

`conversation-summary-policy.spec.ts` 同时覆盖 70% token pressure 触发、user-only tail 不推进、已覆盖原文不重复制造 pressure；service/e2e 测试覆盖 provider 失败不写库、输出凭据拒绝、source hash 变化、first-create/update CAS 和 ownership。

### 3.2 可见浏览器 Mock

Docker 学习端完成 headed 可见验收：

- `generated/version=1` 后刷新得到 `reused/version=1`；
- Agent Trace 显示 summary 已使用以及分层 token metadata；
- Dexie v9 `conversationStates` 只有 `id`、`userId`、`conversationId`、`activeGoal`、`activeQuestionId`、`stateVersion`、`expiresAt`、`updatedAt`；
- 不保存 summary、tool、proposal、prompt、token 或 OCR 题面；
- console/page error 为 0，无横向溢出，Chat 流式 UI 正常；
- UI 与 Trace 没有显示摘要正文。

## 4. 受控 Live 验收

### 4.1 受控配置

Live 只在本次小样本期间同时开启双开关。Chat 的本地输入估算预留/最大输出为 `2500/1200`；摘要的最大调用次数、本地输入估算预留/最大输出为 `1 / 1600 / 400`。provider 配置来自本地 ignored env；验收过程没有输出 key 或 base URL。

| 字段 | 结果 |
| --- | --- |
| provider | `deepseek` |
| model | `deepseek-v4-flash` |
| summary promptVersion | `conversation-summary-v1` |
| trigger | `message_count`，16 条未覆盖消息 |
| summary status / version / watermark | `generated / 1 / 15` |
| summary provider-reported input / output usage | `2246 / 154` |
| summary 请求耗时 | `2383 ms` |
| 再次 prepare | `reused / version 1 / watermark 15`，2 条未覆盖消息 |

这里的 `1600` 是调用前用 `字符数 / 4 + 固定开销` 计算的不可变本地预留，不是 provider tokenizer 的硬输入上限。DeepSeek 返回的 provider-reported prompt usage 为 2246，说明估算与 provider tokenizer 存在偏差；service 仍会拒绝非整数、负数或超过 12,000 的异常 usage，并记录返回值供观测。文档不能把估算预留、provider-reported usage 和供应商账单混为一谈；更精确的 provider tokenizer/成本校准属于后续运行时优化。

### 4.2 Live 失败定位与修复

普通 DeepSeek Chat 已可用，但首次真实摘要返回固定 `PROVIDER_ERROR`。证据显示失败只发生在 `generateObject`：AI SDK 对该 OpenAI-compatible 模型默认选择 tool/function calling，而该模型的结构化输出需要 JSON response mode。

修复遵循 TDD：先在 provider adapter 测试中要求 `mode: 'json'` 并观察 13 pass / 1 fail，再把 `mode: 'json'` 作为共享 executor 的固定内部参数传给 `generateObject`。最小修复后定向测试 14/14，随后真实 AI SDK mocked-fetch 测试进一步验证 `response_format=json_object`、无 tools、schema instruction 与非法 object 拒绝；最终 `@repo/ai` 71/71 和 typecheck 通过。Zod strict schema、预算、超时、live 双开关和错误脱敏边界均未放宽。

### 4.3 可见浏览器 Live

同一可见 Chrome 中完成真实 Chat；access token 在 server 重建后恰好过期时，Next Chat 在 provider 调用前返回 401，因此该次失败没有产生模型费用。重新通过可见登录页登录后只重试一次，最终 assistant 气泡满足：

- 能识别目标题型是“二次函数判别式的计算”；
- 判别式正确值是 `1`；
- 提到 `49` 但没有把它当作正确值；
- 没有复述 credential marker；
- 没有 console/page error、失败提示或横向溢出。

最新 Live Trace 为 `completed`、`degraded=false`，provider/model 为 `deepseek/deepseek-v4-flash`。Trace 输入摘要显示：

```text
summary=true
layerTokens=m:299,a:0,s:0,o:0,r:1894,k:0,y:50
```

这里的字母是安全观测缩写：mandatory、agent guidance、state guidance、active study/OCR、recent messages、knowledge/RAG、summary。Trace 的 Chat 输入/输出数字仍是预算估算，不替代 provider 账单；provider-reported summary usage 以上表中的数据库 metadata 为准。

截图证据保存在本机临时目录，不提交到仓库：

- `prepmind-phase-6-9-3-5-live-summary-success.png`
- `prepmind-phase-6-9-3-5-live-trace-success.png`

Chat 与 Trace 标签页在验收结束时保持打开，便于共同观察；测试 profile 的站点持久化数据已清理。

## 5. 清理与默认安全状态

验收结束后使用 base Compose 重建 server/web，并确认 `/api/dev/ai-mode` 返回 `activeMode=mock`。没有把 Live override 或 key 写入仓库。

清理前先只读枚举并核对目标，确认恰好是 7 个合成 User 和 4 个 Conversation；随后才执行删除。清理只匹配以下严格合成前缀且要求 `@example.com`，没有 reset 数据库：

- `phase6935-api-owner-*`
- `phase6935-api-other-*`
- `phase6935-browser-mock-*`
- `phase6935-live-*`

结果：删除 7 个已枚举合成 User 和 4 个已枚举 Conversation；随后用这 4 个精确 conversation id 复核，User 前缀计数与 Conversation、ChatMessage、ConversationSummary、ConversationState 计数依次为 `0,0,0,0,0`。Redis 清理前扫描到 1 个本次目标 conversation-state key，删除后 `prepmind:conversation-state:*` 为 0；Mock/Live 两个隔离 Chrome profile 的 `127.0.0.1:3000` storage 已清空。所有 Docker 服务继续运行，worker 仍为 healthy。这些是现场验收记录而不是提交进仓库的密钥/数据库 dump；复验时应重新执行同样的先枚举、后删除、精确 id 计数流程。

## 6. 自动化质量门禁

| 命令 | 结果 |
| --- | --- |
| `bun --cwd packages/types typecheck` | 通过 |
| `bun --cwd packages/database test` | 7/7 |
| `bun --cwd packages/ai test` | 71/71 |
| `bun --cwd packages/ai typecheck` | 通过 |
| `bun --cwd packages/fsrs test` | 通过 |
| `bun --filter @repo/server lint` | 通过 |
| `bun --filter @repo/server build` | 通过 |
| `bun --filter @repo/server test` | 76 suites passed，693 tests passed，2 suites/2 tests skipped |
| `bun --filter @repo/server test:e2e` | 17 suites / 58 tests passed |
| `bun --filter @repo/web lint` | 通过 |
| `bun --filter @repo/web test` | 352/352 |
| `bun --filter @repo/web build` | 通过 |

Node 对部分未声明 `type: module` 的 package 仍打印既有 `MODULE_TYPELESS_PACKAGE_JSON` performance warning；本 slice 没有把该已知警告扩展为无关重构。

## 7. 边界与后续任务

- Summary 只解决当前会话旧消息压缩，不是稳定长期记忆，也不自动进入 `UserMemory`；
- Dexie 只恢复 sanitized active state，不能作为 summary 权威源；
- Redis 失败只影响缓存，不允许覆盖 PostgreSQL；
- summary 只在确有 recent history 被裁时注入，不能覆盖当前用户指令；
- 本次 Live 是一个固定小样本，不证明所有学科、语言、超长对话和 provider 都达标；
- Phase 6.9.4 将推进 Router/Verifier “确定性高置信路径 + 低置信真实模型”的 paired eval；不达质量、安全、延迟和成本门槛就保留 deterministic 路径；
- 详细面试学习博客按既定规范留到 Phase 6.9.7，在完整 Router/Verifier/Memory/Orchestrator 替换结论后统一编写。

## 8. 回顾时可以问

- “Phase 6.9.3 为什么把 PostgreSQL、Redis、Dexie 分成三个不同职责？”
- “滚动摘要为什么需要水位、source hash 和 CAS，模型调用为什么不能放在事务里？”
- “12 条消息触发和 70% token pressure 分别解决什么问题？”
- “为什么 summary 生成成功，不代表它每次都应该注入 prompt？”
- “DeepSeek Live 摘要为什么普通 Chat 能用、`generateObject` 却失败，最终怎么修的？”
- “Agent Trace 的 `layerTokens=m/a/s/o/r/k/y` 分别是什么，为什么不记录正文？”
- “本次 Mock、Live、Docker 和可见浏览器分别证明了什么，又没有证明什么？”
- “验收时怎样保证没有泄露 key，也没有误删原有用户数据？”
