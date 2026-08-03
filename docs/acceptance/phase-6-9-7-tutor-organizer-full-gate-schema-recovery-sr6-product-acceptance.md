# Phase 6.9.7 Tutor / Organizer Full-gate Schema Recovery SR6 产品验收

日期：2026-08-03

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

分支基线：`3b30d07a75120c481e28c94509cdcc8237e464ef`

结论：SR6 已在分支完成 zero-provider 的 Docker/API/可见浏览器产品验收。Tutor `/api/chat` 已使用
Schema Recovery candidate composition，WrongQuestionOrganizer single/batch 已使用 V9 本地合法 option authority；
成功路径均得到 `candidate_applied`，forced failure 均保留可用的本地降级，owner、locked-name、Trace admission
与写权限隔离通过。合成数据和浏览器状态已精确清理，Agent/replay gate 恢复默认关闭，最终源码构建的 server /
web 容器健康。本轮没有调用 DeepSeek、Qwen、OpenAI 或其它模型 Provider，`providerCalls=0`。

SR6 不新增或替代 SR5 的真实模型语义 authority。它只证明当前分支在受限 deterministic Mock replay 下的产品
composition、权限、Trace、降级、UI 与清理；不证明真实模型产品回答质量、端到端 SLA、生产部署或 main
authority。SR7/main、Phase 6.9.8/6.10/8/9 与博客收尾继续阻断。

## 1. 为什么需要 SR6

唯一 SR5 controlled-Live run `63f8a76b-1c2a-403d-b774-0235caae04cb` 已证明固定 72-case / 24-pair
评测中的 Schema Recovery strict schema、语义、P95、usage、预算与安全门通过，但 SR5 没有启动产品 Docker、
Nest API、Next Web 或浏览器，也没有创建账号、OCR 上下文、错题、专题或 Agent Trace。因此 SR5 pass 不能自动
证明以下产品接线成立：

- Tutor Chat 是否真正切换到 Schema Recovery candidate，同时保留 Router/RAG/流式回答和安全降级；
- Organizer single/batch 是否真正切换到 V9 ordinal-only candidate，同时保留 owner snapshot、stale fence、
  locked-name 与本地写命令权威；
- Mock usage 是否会被误记为 DeepSeek 费用或伪装成 `production_live`；
- candidate、Trace 或最终写入失败时，产品是否仍能返回本地可用结果；
- default-off、越权、可见页面与合成数据精确清理是否在真实 Docker 路径成立。

SR6 只补齐这些产品工程证据，不重跑已消费的 SR5 Provider 路径。

## 2. `SR5 sealed replay` 的准确含义

SR6 admission 固定绑定 SR5 physical artifact SHA-256：
`87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be`。这里的
`sr5_sealed_replay` 表示“只有绑定该已封存 authority SHA 的受限产品 Mock 路径才可启用”，不是读取或逐字重放
SR5 的 Provider response、模型原文、Trace 或业务写入。

实际 replay 过程为：

```text
当前产品 bounded prompt
  -> 校验 Tutor V6 / Organizer V9 prompt schema
  -> 从当前本地已授权 eligible intent / option 中确定性选择第一项
  -> mock ModelAgentRuntime 生成本轮独立 usage + Trace
  -> Schema Recovery / V9 validator + 本地 authority/merger
  -> 产品 response / Trace / 本地授权写命令
```

因此：

- SR5 SHA 只承担 admission identity，不代表 SR6 重放了 SR5 模型答案；
- deterministic Mock output 来自当前 bounded prompt，不读取 expected/oracle 或 SR5 Provider bytes；
- replay Trace 必须是 `mode=mock / provider=mock`、固定 replay model、成功状态、正整数 usage、合法 task/
  output cap、无 provider/schema error，不能冒充 `production_live`；
- Tutor replay 的价格为 `pricingKnown=false / cost=null`；Organizer replay admission 固定
  `pricing=not_applicable / cost=0`，两者都不能计入真实模型费用；
- `both` 模式的总上限是 2 次、每个 component 各 1 次；single-component 上限是 1 次。

Replay resolver 还要求 `AI_PROVIDER_MODE=mock`、全部 Agent/Live gate 关闭、全部 Provider credential 为空、
`RAG_EMBEDDING_PROVIDER=fake` 且 server role 为 API；任一 authority SHA、component、behavior、request cap、
gate、credential 或 RAG 边界不匹配均 fail-closed。生产 Compose 默认仍是 replay disabled。

## 3. 产品代码接线与修复

### 3.1 Tutor

- Web server-only Tutor composition 从 legacy candidate 切换到 `runTutorSchemaRecoveryModelCandidate()`；
- 当前 V6 local signal、preferred depth、`answer_direct` 权限和最终 TutorStrategy/prompt 仍由本地代码权威控制；
- replay 与 production Live 使用不同 `runtimeAuthority`，只有 `production_live` 才允许创建真实 executor；
- replay Trace 虽记录正整数 Mock usage，但 Chat observation 不估算或持久化真实模型费用；
- forced failure 返回 deterministic Tutor strategy，最终 Chat 仍正常完成；Trace best-effort 失败也不阻断回答。

### 3.2 WrongQuestionOrganizer

- Nest single/batch composition 从旧 candidate 切换到 Organizer V9 ordinal-only candidate；
- 模型/Mock 只选择本地预枚举的 `questionIndex + optionIndex`，owner、真实 ID、subject/topic/deck authority、
  locked name、snapshot/stale fence、Trace admission 和写命令继续由本地掌握；
- model-influenced write 只有在 strict candidate + usage/Trace authority admission 通过后才可执行；
- forced failure、安全拒绝、stale 或 Trace admission 失败都回到 `local_deterministic`，不会丢失请求；
- single/batch 各请求最多一次 candidate 调用，batch 本轮 `3/3` 完成且锁定专题名未改变。

### 3.3 Trace、请求上限与环境边界

- SR6 replay Trace 使用固定 SHA-bound model identity，Mock usage 不计费，也不满足
  `production_live / deepseek / deepseek-v4-pro` admission；
- `both` 的 `totalMaxRequests` 已收敛为 2（Tutor 1 + Organizer 1），修复了宽泛 `number` 类型导致 Docker
  server/web build 失败的问题；
- Web Trace 测试不再假设 Mock duration 恒为 `0ms`，改为校验 runtime 实际记录的非负耗时；
- Server env schema 补齐 Router、Verifier、Tutor、Review/Planner、Knowledge、Organizer 全部 gate 与
  DeepSeek/Tutor/Knowledge/Organizer/OpenAI/Qwen/DashScope credential 的 zero-provider 拒绝矩阵；
- 当前外部 HTTP/API 没有任意 Trace 注入入口。`runIdHash` 在 replay predicate 中目前只校验
  `sha256:<64 hex>` 格式、未与当前 runId 做密码学绑定；在当前内部生成边界下不是阻断。未来若开放 Trace
  ingestion，必须增加 expected runIdHash 对照或 HMAC/authority token。

## 4. 静态与构建证据

| 门禁                                                  | 结果                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| SR6 replay 定向                                       | `4/4`                                                                 |
| Tutor/Web 定向                                        | `10/10`                                                               |
| Web 全量                                              | `444/444`                                                             |
| Server env 边界                                       | `87/87`                                                               |
| Agent typecheck                                       | 通过                                                                  |
| Server build                                          | 通过                                                                  |
| Docker server image（最终源码，`COMPOSE_BAKE=false`） | exit `0`                                                              |
| Docker web image（最终源码，`COMPOSE_BAKE=false`）    | exit `0`                                                              |
| SR5 strict validator                                  | `ok=true / providerCalls=0 / journalRecords=628 / evidence_published` |

代码/权限、zero-provider 环境、Tutor diff 与 Trace authority 四路只读复审均为 `APPROVED`，没有阻断问题。
两次较早的 Docker 构建不能作为最终证据：第一次命中 Docker Desktop Bake shared-key gRPC 错误；第二次使用
修复前源码并因旧 `totalMaxRequests: number` 类型失败。最终分别构建 server/web 并核对退出码后，才以
`--no-build --no-deps --force-recreate server web` 重建容器；没有用旧镜像的健康状态冒充最终源码验收。

## 5. Docker/API 产品验收

| 场景                     | 结果                                           | 可证边界                                                                                     |
| ------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Tutor `/api/chat`        | `candidate_applied`                            | 真实登录、真实 OCR structured context、Schema Recovery candidate、Chat 完成、Mock Trace 入库 |
| Organizer single         | `hybrid_model / candidate_applied`             | V9 ordinal selection、本地命令、owner/write fence 与 Trace admission 完整通过                |
| Organizer batch          | `hybrid_model / candidate_applied`，`3/3`      | 一个 request-level candidate 覆盖三道题，locked deck name 保持不变                           |
| 跨账号访问               | 统一 `404`                                     | 无 Trace、无 deck/item 或其它业务写入                                                        |
| Tutor forced failure     | Chat 保持成功                                  | deterministic Tutor strategy 安全降级，不伪造 Provider usage/费用                            |
| Organizer forced failure | `local_deterministic / fallback_runtime_error` | 本地组织结果仍可用，不执行 model-influenced command                                          |
| default-off              | replay 与全部 Agent gate 关闭                  | 不创建 replay runtime，不调用 Provider                                                       |

本轮成功 Trace 只保存 route、stage、safe summary、Mock model identity、usage 与耗时，不保存完整 prompt、完整
回答、OCR 原文、Provider response、credential 或真实模型费用。Tutor 与 Organizer 的 Mock Trace 均不能被 Agent
Trace 成本看板识别为真实 DeepSeek billing。

## 6. 可见浏览器证据

可见浏览器实际完成 `/chat`、`/error-book` 与 `/agent-trace` 验收；浏览器阶段没有新增 Provider 调用。窗口在
清理后保留于 `/login`，没有自动关闭，便于人工复核。

| 截图                                                                      | SHA-256                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `.playwright-mcp/prepmind-sr6-browser-evidence/tutor-success.png`         | `215b7d67679adc354ed0653e3a5051fe03da1dfe653de47da8dd80de26e399dc` |
| `.playwright-mcp/prepmind-sr6-browser-evidence/organizer-error-book.png`  | `668f96215861c4bf7982b24b3d7aa70704bccb6c91d7dc174dd3d15527172956` |
| `.playwright-mcp/prepmind-sr6-browser-evidence/organizer-agent-trace.png` | `bc564931a6447cd8962fffc39679104239c521e52b2a28ab1f964b4efac4e79f` |

## 7. 精确清理与最终运行态

本轮精确删除 3 个合成账号、6 道错题、2 个学科分组、2 个专题、5 个专题关联项、8 条 Agent Trace / 31 个
Trace step、8 条 ChatMessage 和 16 个 refresh token；绑定的 OCR 上下文和账号级关联数据随对应 owner 精确
收口。上述合成对象清理后 residue 均为 0。没有执行数据库 reset、`docker compose down -v`、Docker prune、
Redis `FLUSH*` 或 MinIO wipe；Redis 与既有 MinIO 非 SR6 对象保留。

浏览器 cookie、localStorage、sessionStorage、IndexedDB、Cache Storage 和 service worker 均为 0。敏感验收脚本/
state 文件在文档与最终验证完成后精确删除，只保留三张无 credential 截图。

最终源码容器回放：

- server：`healthy`，`GET /health` 返回 `status=ok / service=prepmind-server`；
- web：`running`，`GET /login` 返回 HTTP `200`；
- worker：`healthy`，仍为 `SERVER_ROLE=worker / KNOWLEDGE_PROCESSING_MODE=queue`；
- server/web：`AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、SR6 replay=false/request cap=0；
- Router、Verifier、Tutor、Review/Planner、Knowledge、Organizer gate 全部为 false；
- server/worker 的 RAG 为 `qwen / text-embedding-v4 / 1536`，仅确认 Qwen credential 存在，不输出值；
- server 的 DeepSeek/Knowledge/Organizer/OpenAI credential 均不存在；worker 的 DeepSeek/OpenAI credential 不存在；
- web 的通用 Chat DeepSeek credential 只确认存在，Tutor 专用/OpenAI credential 不存在；由于 mode=mock、
  live=false 且 Router/Verifier/Tutor gate=false，它没有被本轮调用。

## 8. Authority 与停止门

| 结论                                                       | Authority                                             |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| SR5 固定 full-gate 真实模型 schema/语义/P95/usage/预算质量 | `schema_recovery_full_gate_semantic_gate`，保持不可变 |
| SR6 分支产品 composition/权限/Trace/降级/UI/清理           | zero-provider product acceptance，只覆盖本验收范围    |
| 真实模型产品回答质量、HTTP/页面 SLA、生产部署              | 未形成                                                |
| main                                                       | 未合并、未验收                                        |

SR5 marker、628 条 journal、artifact、approved tag、旧 L3 与 SR4 Mock-only authority 均未修改；SR5 strict
validator 当前仍返回 `ok=true`，physical artifact SHA 仍为
`87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be`。禁止重跑 SR5、追加 Provider
探测或把 SR6 Mock replay 当成第二份语义证据。

当前唯一下一原子任务是 SR7：提交并推送本 SR6 功能分支后，按规范合并 main、推送远程 main，并只执行
default-off static/Docker/API/可见浏览器与历史 evidence 只读回放。SR7 不重跑 SR5、不再次启用 SR6 replay，
也不推进 Phase 6.9.8/6.10/8/9 或博客收尾。

回顾时可以问：

- “为什么 SR5 的真实模型语义通过仍不能直接证明产品接线可用？”
- “`SR5 sealed replay` 为什么只是 SHA-bound deterministic Mock admission，而不是重放 Provider response？”
- “为什么 replay Trace 有正整数 usage，却不能计入 DeepSeek 费用？”
- “Tutor Schema Recovery 与 Organizer V9 分别把哪些权力留在本地？”
- “forced failure 为什么必须保留 Chat/Organizer 的本地可用结果？”
- “为什么 SR6 完成后仍必须单独做 SR7 main default-off 回放？”
