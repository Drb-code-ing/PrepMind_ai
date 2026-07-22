# AI 行为验收规范

本文记录 PrepMind AI 的 Chat / RAG / Agent 行为验收边界，避免把 mock 链路测试误当成真实模型体验验收。

## Phase 6.9.5 Review / Planner 当前边界

Review/Planner 的 V10 controlled-Live 仍是唯一语义质量 authority。V22 的 `operation_failed -> recovered` 以及 V11--V21 的既有 terminal 都是不可重跑、不可复用、不可拼接的历史；V22 的终止是 API aggregate timing 与 Trace candidate-step timing 的错误精确比较，不是语义质量或计费失败。

修复后，用户授权下的独立 DeepSeek V4 Pro Docker API 与可见 `/plan` 分支验收均得到 `candidate_applied`，Trace 为 `live / deepseek-v4-pro / completed`；模型仍只能从本地 snapshot 选择 `focusIndexes` / `blockOrder`，本地保留 owner、facts、FSRS、写权限和最终只读 merger。main `3aff6cc` 的无真实模型 default-off replay 已通过，两个业务 gate 与 live-call gate 保持 `false`，合成账户/Trace 已清理；不得执行任一历史 V19/V20/V21/V22 accept 或 recover 命令。

## 1. Mock 与 Live 的分工

- Mock 验收用于验证工程链路：请求参数、路由、headers、prompt 拼接、token 预算、RAG 降级、消息同步和 UI 渲染。
- Live 验收用于验证真实体验：回答质量、Tutor 讲题风格、RAG 引用是否自然、Agent prompt 是否真的影响输出。
- 普通 CRUD、鉴权、FSRS、统计、资料上传和解析不要求 live 验收。
- Chat RAG、TutorAgent、KnowledgeVerifierAgent、RouterAgent prompt 行为改动必须做小样本 live smoke；其他真实模型 Agent 也必须按其触发方式验证实际语义输出。
- Phase 6.9 的独立 Agent 模型路径还必须做 paired eval；同一脱敏 case 同时运行 deterministic baseline 与 candidate，不能用不同题目比较。最终范围覆盖 11 个逻辑节点加 Tool-Using Orchestrator，不得只评 Router/Verifier/Memory/Orchestrator 就声称全部 Agent 通过。

## 2. Live 验收成本边界

最终 Chat 真实模型只能在同时开启以下变量时调用：

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_MODEL='deepseek-v4-flash'
$env:AI_MAX_INPUT_TOKENS='2500'
$env:AI_MAX_OUTPUT_TOKENS='1200'
```

- 开发默认必须回到 `AI_PROVIDER_MODE=mock`。
- Agent 模型还必须额外满足对应组件的独立 gate、server-only provider 配置、timeout、请求预算和 eligibility；全局双开关是必要条件，不是充分条件。Phase 6.9.4.4 的 Router/Verifier gate 默认均为 `false`，只在 controlled acceptance 中显式开启。
- live smoke 每轮控制在 3 到 5 个固定用例。
- `AI_MAX_OUTPUT_TOKENS=500` 只适合极短 smoke，不适合 Tutor 讲题或 RAG 答案质量验收。
- live 验收结束后要切回 mock，避免用户继续操作时产生额外费用。

开发环境可以用 `/agent-trace` 的 `AI 模式` 开关在 mock / live 之间切换，但它只是调试便利，不放宽成本与鉴权边界：

```powershell
$env:AI_PROVIDER_MODE='mock'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_DEV_MODE_SWITCH_ENABLED='true'
```

- 开关默认只在非 production 且 `AI_DEV_MODE_SWITCH_ENABLED=true` 时可见；Docker Compose dev 的 Next standalone 容器可额外设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 显示该本地诊断开关，生产部署不得开启。
- Live 选项只有在 `AI_ENABLE_LIVE_CALLS=true` 且存在 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 时可用。
- 即使通过开关切到 live，`/api/chat` 仍要求有效 access token，并会调用 `/auth/me` 校验。
- 验收记录仍以 `/api/chat` 响应头 `x-prepmind-ai-mode=mock|live` 为准。

## 3. RAG 验收边界

- `RAG_EMBEDDING_PROVIDER=fake` 只能证明上传、处理、分块、入库、检索 API 和前端页面链路可用。
- fake embedding 不能证明语义检索效果；即使资料含有关键词，也可能无法稳定命中。
- RAG 语义效果验收必须使用真实 embedding，或使用专门设计的可控测试向量。
- 没有资料、没有命中或检索失败时，Chat 必须继续普通回答。
- `KNOWLEDGE_PROCESSING_MODE=queue` 的 smoke 只证明 BullMQ、Redis、worker、`BackgroundJob`、文档状态流和 chunk 入库可靠，不证明真实模型回答质量。
- queue 模式不改变 `/api/chat` 的 live 边界；Chat 真实模型仍必须同时满足 `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`、有效 API key 和登录态校验。

## 4. Chat 空回复兜底

真实模型或流式 SDK 偶发无有效 assistant 内容时，兜底提示不是根治方案，而是稳定性保护：

- 如果流式结束后最后一条仍是 user，前端不得把该会话快照同步为成功对话。
- 如果流式结束后 assistant 内容为空白，前端不得同步该空回复。
- 同步前必须等待短稳定窗口，避免前端节流合并最后 token 时把半截 assistant 内容落库。
- 页面隐藏或关闭时不得把流式中的半截消息写入 Dexie。
- 后端 `/chat-messages/sync` 必须拒绝非空但没有非空 assistant 收尾的快照。
- UI 显示 `本次回答没有成功生成，请重试`，并记录 debug 信息。
- 正常生成 assistant 内容后，兜底错误应自动清除。

## 5. Phase 6.3 验收清单

KnowledgeVerifierAgent 落地后必须覆盖：

- 无 RAG 命中：普通 Chat 正常回答。
- 正确资料命中：回答自然引用资料。
- 可疑资料命中：回答不盲从资料，并温和提示用户核对资料片段。
- Tutor + RAG 混合：Tutor 讲题策略仍生效，Verifier 不破坏讲题体验。
- mock 单测和 live 小样本 smoke 都通过。

## 6. Phase 6.4 验收清单

WrongQuestionOrganizerAgent 落地后必须覆盖：

- 保存错题成功后，整理流程失败不得影响错题保存。
- `/error-book` 首页优先展示学科卡片，学科内展示专题 deck，专题内展示错题列表。
- 专题重命名有即时反馈，并设置 `nameLocked`，后续整理不覆盖用户命名。
- 错题详情、备注、掌握状态、删除确认和加入复习仍可用。
- 更新或删除错题后，organizer 查询缓存需要失效刷新，学科和专题统计不能 stale。
- Organizer 当前 deterministic baseline 不调用 live 模型、不读取 API key、不进入 Dexie `mutationQueue`；后续混合模型路径必须保持 JWT/ownership、本地 schema、用户锁定名称和写入权限边界。
- 用户隔离必须通过 e2e 覆盖，不能跨用户读取学科、专题或错题关联。

## 7. Phase 6.7 Agent Trace / Eval 验收清单（已完成）

Agent Trace 与固定评测集已落地，并必须持续覆盖：

- fixed eval set 必须覆盖 12 个受治理组件：RouterAgent、TutorAgent、RetrieverAgent、KnowledgeVerifierAgent、FinalResponseAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、KnowledgeDedupAgent、KnowledgeOrganizerAgent 与 Tool-Using Orchestrator。现有 deterministic policy 保持回归；模型化/混合组件另有 Mock 与 controlled-Live 证据；Retriever/FinalResponse/Orchestrator 还必须验证正式 node/graph contract。
- Mock 验收只证明 trace capture、headers、API、UI 和估算成本链路可用；如果改动 prompt 或 live 输出体验，仍需要按本文规则做小样本 live smoke。
- `/api/chat` 只有在存在 access token 时 best-effort 写入 `/agent-traces`；trace 写入失败不得打断流式回答，只能通过 `x-prepmind-agent-trace-recorded=false` 或日志暴露。
- Trace 只能保存脱敏元数据：route、confidence、step summary、token 估算、verifier 状态、模型名、模式和估算成本；不得保存完整 prompt、完整回答、完整 RAG chunk、access token、refresh token 或 API key。
- 前端 payload builder 和后端 service 都必须裁剪并脱敏 `DEEPSEEK_API_KEY`、`OPENAI_API_KEY`、`Authorization: Bearer ...`、`Cookie: ...` 等敏感片段。
- `/agent-trace` 的成本看板只展示基于 token 估算和本地价格表的 USD 估算成本，不代表供应商真实账单，也不应用作财务对账。`deepseek-v4-flash` 使用受控 Live 评测已记录的非缓存价格快照；未知模型继续显示“未配置单价”。价格变化必须更新集中价格表、成本计算测试和本段说明。Trace 创建时写入按当时表计算出的估算值，历史 `pricingKnown=false` 记录不回填，避免用新价格伪造历史成本。
- `/agent-traces` 是在线账号级观测 API，不进入 Dexie `mutationQueue`；离线或弱网导致 trace 丢失是可接受降级。

## 7.1 Phase 6.9 Agent 模型路径评测

Phase 6.9.1 的 `phase-6.9-seed-v1` 只建立评测 contract 和 deterministic baseline，不调用
真实模型。Router、Verifier、Memory 各有 8 个可执行 case；Orchestrator 尚未实现，因此 8 个
case 只保存 expectation，不能写成“Orchestrator 已通过”。这是历史 seed 范围，不代表最终 12 个组件的架构治理和验收范围。

Phase 6.9.2 的 `ModelAgentRuntime` 只验证共享结构化调用 contract。验收使用 Mock responder 与
注入的 fake executor，覆盖 Zod parse、预算、live guard、timeout、abort、usage 归一化和脱敏错误；
不需要 API key，也不得发出真实模型请求。只有后续某个 Agent 接入 candidate 模型路径时，才按
同一脱敏 case 执行受控 Live paired eval。`/api/chat` streaming 仍使用既有 provider 链路。

Phase 6.9.3.3 已把 `conversation_summary` 接入 Nest prepare；该 slice 只跑 Mock/fake executor：Mock 证明触发、schema、安全降级与 CAS 工程边界，不证明真实摘要质量。Live 摘要已由 6.9.3.5 按双开关、固定脱敏长会话、单次预算、恢复 Mock 和清理要求完成。

Phase 6.9.3.4 已把 prepare 结果送入 Web 分层 context assembler，并完成本地 headed Mock 工程验收。首轮无 conversationId 时跳过 prepare，sync 后第二轮才进入；live auth 必须在 prepare 前拒绝无效会话。prepare degraded 不阻断 Mock，assembler 不能让 optional agent/state/OCR/RAG/summary 挤掉 base/latest user，RAG drop 必须同步清引用，summary 只在历史被裁时使用。响应 header、Trace 与 Dexie 只允许 bounded status/version/count/state metadata，不允许 summary、prompt、chunk、tool、proposal 或 token 正文。本地可见浏览器已观察到 `generated/version=1 -> 刷新后 reused/version=1`、Dexie 白名单与刷新后继续 sync，且 console/page error 为 0。

Phase 6.9.3.5 已完成 Docker Mock 与受控 Live。Live 固定样本必须继续同时满足：双开关、真实登录、summary schema valid、credential rejection、一次摘要预算、最终回答保留目标/纠正、Trace/日志无正文。OpenAI-compatible structured output 对 DeepSeek 使用 JSON mode，但不能绕过 Zod schema、预算、timeout 或错误脱敏。本次 `deepseek-v4-flash` 的 `conversation-summary-v1` 得到 version 1/watermark 15，provider-reported summary usage 为 2246/154；调用前 1600 是字符估算预留，不是硬 tokenizer 上限。最终 Chat 识别二次函数判别式与正确值 1。Chat Trace 的输入/输出数字是估算，不可写成 provider 实际账单。完整证据见 `docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md`；验收结束后必须恢复 Mock，并验证合成账号、会话、summary/state/cache 与浏览器 storage 均已清理。

Phase 6.9.4.1 已固定 `phase-6.9-router-verifier-v1`。Router 60 条必须保持 36 high-confidence / 16 ambiguous / 8 safety boundary；Verifier 40 条必须保持 12 trusted / 8 insufficient / 8 complex conflict / 4 uncertain-or-stale / 8 prompt injection。当前 deterministic baseline 为 74/100、critical=2，只用于 paired comparison，不是启用结论。后续 candidate 必须复用同一 dataset version：Router 歧义 macro-F1 相对 52.47% 至少提升 10 个百分点且高置信准确率相对 86.11% 下降不超过 2 个百分点；Verifier 复杂冲突 recall 相对 0% 至少提升 15 个百分点；两者 critical 必须为 0。prompt injection/safety boundary case 均为 candidate ineligible，不得发送给模型；完整证据见 `docs/acceptance/phase-6-9-4-1-router-verifier-baseline.md`。

Phase 6.9.4.2 已固定 Router / Verifier candidate 的持续验收规则。本段是该 candidate 行为 contract 的唯一 canonical source；`docs/acceptance-checklist.md` 只提供执行入口，`docs/acceptance/phase-6-9-4-2-router-verifier-mock-candidate.md` 只记录本次实现与验收证据。

- candidate eligibility 与 safety gate 必须在 runtime 前执行；ineligible、Router safety boundary、Verifier prompt injection/high-risk/`safeForPrompt=false` case 的 runtime invoke 必须为 0；
- ineligible 的 Router 必须保留 strict schema 已验证并重建的 deterministic route、confidence、reason 与本地权限位，剥离原始对象额外字段；Verifier 必须保留已验证 deterministic status/限制性语义（`trusted` 可保持），但 reason、notice、debug、promptAddition 必须由本地 deterministic policy 固定模板安全重建，不传播 raw deterministic 正文；两者都禁止产生 model candidate provenance 或声称 candidate 曾运行；
- Router safety 命中固定返回本地 safe chat，`requiresRag` 与 `requiresHumanApproval` 只能由本地 canonical route map 决定，不能接受 provider 权限声明；
- Verifier 对任一高风险证据整批阻断，失败不得把 deterministic `conflict/suspicious/insufficient` 放宽，deterministic `trusted` 在失败时必须收紧为 `suspicious`；
- candidate output 与 runtime envelope/Trace 必须使用 strict schema；Verifier 必须使用按 status 判别、literal `evidenceCodes`、禁止重复/矛盾/额外字段的 discriminated union；
- hostile getter/Proxy/AbortSignal accessor、非法或 stale telemetry、runtime 原地预算污染必须被 containment；调用方与 preview budget 使用隔离 snapshot，不得被 runtime 修改；
- 工程输入估算只用于调用前预留，不能把更大的真实 provider input usage 误判为越界；output 仍受 request cap 约束；telemetry unavailable 时必须保留 `traceUnavailable/usageUnavailable` 并按 preview budget 记账，避免重试超卖；
- Mock/fake executor 只证明 eligibility、schema、budget、timeout、abort、fallback 与脱敏 Trace 工程 contract，不证明语义质量；只有复用同一 case 的 controlled-Live paired eval 才能验证真实质量净收益；
- 完整工程证据见 `docs/acceptance/phase-6-9-4-2-router-verifier-mock-candidate.md`。该阶段完成时为 `Enabled=no`、`Reason=paired_candidate_not_run`；其后由 Phase 6.9.4.3 执行同 case controlled-Live。

Phase 6.9.4.3 已固定 Router / Verifier paired eval 的持续验收规则与本次结论：

- deterministic、Mock、Live 必须复用 `phase-6.9-router-verifier-v1` 和 digest `sha256:b21def37330d2da109901ff9e927a612dc62cdecf1cb9383c3b8bea08c7bb019`；禁止修改 expected、挑选有利 case 或拼接多次 run；
- 100 条 case 中只有 Router ambiguous 16 条与 Verifier semantic 12 条可进入 candidate；56 条 deterministic ineligible 与 16 条 safety blocked 必须在 provider 前零调用；中途失败后的 eligible `notRun` 不能冒充 design-time zero-call；
- controlled-Live 必须显式双开关、固定 provider/model、串行、单 case 10 秒、无自动重试，并在运行前用 pricing snapshot 验证 96,000 input + 11,200 output 的 worst-case 成本不超过 USD 0.10；Router/Verifier candidate 单次 output 上限均为 400；
- 已越过 provider boundary 的 complete / incomplete / attempted-invalid evidence 必须全部保留；Live 文件名必须由报告正文 `startedAt` 与 `runIdHash` 唯一推导，目标存在时 no-overwrite fail-closed；
- API key 只允许由 composition root 注入单次命令进程；evidence/Trace/stdout/文档不得包含完整 prompt、query、chunk、provider output、raw error、key、authorization、cookie、base URL 或 stack；
- `qualityEvidence=true` 只表示真实 Live lane，不等于质量通过。只要 run incomplete、usage 不可验证、critical/质量/延迟/成本任一门槛失败，Router 与 Verifier 必须独立保持 disabled，production 继续 deterministic；
- 2026-07-14 headroom 后的 canonical Attempt D 在第 16 个 Router eligible case 得到 `PROVIDER_ERROR / structured_output` 后停止：`observed/notRun=52/48`、`providerAttempts/strictSuccesses=16/15`、固定失败 case 为 `router_ambiguous_mixed_chat_16`，Router/Verifier 均为 `enabled=false / usage_unverifiable`。此前 Attempt A/B/C 原样保留，A 的 18ms evidence identity 缺陷已修复但 artifact 仍非 canonical；
- 历史两条 Router strict success 的 provider-reported output usage 为 `61/120` 与 `108/120`。`structured_output` 分类排除了 auth/rate-limit/HTTP/transport 类故障，而 90% 上限占用支持 output headroom 不稳定的高置信假设；由于 raw output 按安全合同丢弃，它不精确断言截断、JSON parse 或 schema validation 中的哪一种；
- 2026-07-14 structured-output headroom 修复已按 TDD 完成：Router/Verifier 单次 output 统一为 400，local/provider global output cap 为 11,200，最高单次 reservation schema 上界为 5,200；旧定价 worst-case 为 USD 0.017418937304。该修复不改 dataset/prompt/schema/calls/timeout/retry/production route，也不改写 Attempt A/B/C；
- Attempt D 的 15 条 strict success output 为 59~341，最后失败 entry usage 不可验证；该证据证明 400-token headroom 有效改善成功深度，但不证明继续提高 cap 能消除残余失败。它随后触发的零网络 prompt/schema/provider compatibility 韧性设计与实现现已完成，但仍没有 complete Live 质量证据，Phase 6.9.4.3 验收未完成并禁止进入 enablement；
- JSON-mode resolution 零网络 checkpoint 已完成，但不改变上述 Live 结论。新的 controlled-Live 固定标准 `https://api.deepseek.com`、`response_format=json_object`，不发送 tools/tool_choice/json_schema；Provider 只保证合法 JSON，canonical Zod 仍是结构、长度、关联约束与安全语义的最终权威；
- Attempt E 是上述 checkpoint 后唯一一次 strict-tool controlled-Live：`providerAttempts/strictSuccesses=1/0`，首个失败 `router_ambiguous_notes_tutor_01 / http_client`，`observed/notRun=37/63`，usage 0/0。Chat Completion 文档列出该模型，Tool Calls 指南另行描述通用 strict Beta contract，本地 fake-fetch wire 符合公开基础约束；但模型级 feature/provider compatibility 仍未证实，`http_client` 只排除 401/403/429，仍混合 400/402/422 等 4xx，不能猜成 schema、余额或版本问题，也不能把 USD 0 当作供应商账单结论；
- Provider schema 只能从 identity-only registry 取回已编译 profile；兼容投影只删除/等价转换 Provider 不稳定关键字，canonical Zod 仍是长度、status/evidence 关联、去重与 refinement 的最终权威。未注册、未支持或 hostile property/getter/proxy 输入必须在 Provider 前 fail-closed；
- Live 受控 preflight 必须先完成 canonical schema 校验、安全 start timestamp 和 dependencies/executor 本地初始化，再允许 UUID、evidence reservation/fs、runner 或 Provider attempt。schema 只有明确 `true` 才继续，本地初始化抛错也必须以 `live_config_invalid` 零副作用结束。新 Live 报告必须使用 `phase-6.9.4.3-runner-v3` + `deepseek_json_object_v1` + `phase-6.9.4.3-json-mode-v1`；历史 runner v1/v2 只读兼容，Mock 禁止携带 Live transport 字段；
- 持续边界仍为 100/28/72、Router 800/400、Verifier 1600/400、global 28 calls / 96,000 provider input / 11,200 provider output、单 case 10 秒、`maxRetries=0`；
- fresh 零网络 gates 为 AI 151 passed、Agent 345 passed、typecheck/lint exit 0，deterministic 74/100 critical=2；Mock complete 的 `caseEntries/runtimeInvocations/providerAttempts/strictSuccesses/zeroCallCases = 100/28/0/28/72`；zero-call Live config exit 3 且没有新增 evidence。这些只证明工程 contract；Router / Verifier 仍 `enabled=false`，production 继续 deterministic；
- 唯一一次 JSON-mode controlled-Live 已完成：28/28 strict success、72/72 zero-call、Verifier gate 通过；Router additional P95 4264ms 超过延迟门槛，因此 Router 进入 terminal deterministic fallback。Phase 6.9.4.3 不标记为全部通过，不再重跑或新增 transport；Verifier 结果留作后续集成依据；
- 完整证据与 pricing/cost/decision 解释见 `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`。

以上是 Phase 6.9.4.3 的历史评测与当时生产结论，必须原样保留，但不得解释为永久禁止 Router 模型。后续 Phase 6.9.4.4 已完成高置信/安全 zero-call、歧义 Router 真实模型、semantic-needed Verifier 与 deterministic fallback 的混合生产路径及 controlled-Live、Docker、可见浏览器和 main 复验；验收后恢复默认关闭。

Phase 6.9.4.4 的生产验收 contract 为：

- Router 对安全边界与高置信请求保持 deterministic zero-call，只对歧义、多意图或上下文指代调用真实模型；Verifier 只对已通过本地 safety projector 且确需语义判断的 RAG 证据调用模型；
- `ROUTER_MODEL_ENABLED` 与 `KNOWLEDGE_VERIFIER_MODEL_ENABLED` 是独立 rollback gate，默认均为 `false`；timeout 分别固定为 5 秒与 4 秒；
- 同一 Chat request 的 Agent runtime 共享 `maxCalls=2`、`maxInputTokens=2400`、`maxOutputTokens=800` 不可变预算，任何 Agent 不得绕过或各自重置预算；
- provider 使用 JSON-object mode；它只保证合法 JSON，canonical Zod 继续校验结构、长度、关联约束与安全语义；
- prompt injection、high-risk、`safeForPrompt=false` 或 credential material 必须在 provider 前零调用；provider failure、timeout、schema invalid、budget exhaustion 或 abort 只能回退到不宽于 deterministic policy 的限制性结果；
- Trace / response headers 只允许固定 status、reason code、attempted/degraded、timeout、usage/cost provenance 等有界元数据，不得包含完整 prompt、query、chunk、provider output、raw error、credential、authorization、cookie、base URL 或 stack；
- Task 8 只完成 Docker runtime 接线和文档，不是 enablement 证据。Task 9 必须完成分支 gates、Mock、controlled-Live、Docker、可见浏览器验收、精确清理与 evidence/current-doc 提交，并到此结束；main 复验属于独立的 Task 10，不是 Task 9 的一部分。在 Task 9/10 对应门禁完成前，两个 gate 保持默认关闭。

权威架构路线见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`。本 contract 只覆盖 Router/Verifier 子阶段，不得据此声称 Memory、Orchestrator、全部 Agent 或 Phase 6 已完成。

后续所有模型化/混合 Agent 均按本节规则验收；只有 11 个逻辑节点加 Tool-Using Orchestrator 的模型路径、通信、权限和可执行 LangGraph 全部通过后，才进入 Phase 6.10 分层记忆。

回顾时可以问：“为什么 `json_object` 仍不能取代 canonical Zod？”“为什么 runner/prompt/entry identity 必须绑定？”“什么证据才足以把 Router / Verifier 从 `enabled=false` 改为可启用？”

下一会话可以复制：“请继续 Phase 6.9.4.4 Task 9：在当前分支完成完整 gates、Mock、controlled-Live、Docker、可见浏览器验收、精确清理合成数据，并提交 evidence/current docs；不要开始 Task 10，不要提前进入记忆系统。”

后续 Agent 模型路径必须遵循：

- 使用同一版本的合成或脱敏数据集比较 baseline 和 candidate；
- Mock 验结构化输出、schema invalid、timeout、预算和降级，不证明语义质量；
- Live 验质量净收益，同时记录 provider/model、promptVersion、token、p95 延迟和估算成本；
- Critical failure 必须为 0；安全失败不能被 aggregate pass rate 抵消；
- 所有模型化/混合 Agent 都使用职责匹配的质量、安全、权限、延迟、成本和 fallback 门槛；Review、Planner、KnowledgeDedup、KnowledgeOrganizer 与 Router 不能被遗漏；
- 必须模型化的 Agent 未达到门槛时保持生产 gate 关闭并继续优化；混合 Agent 未达到门槛时保持安全 fallback，不把失败静默解释为永久纯 deterministic；
- 报告复用 `docs/acceptance/phase-6-9-agent-eval-template.md`，不得保存完整 prompt、完整输出、
  API key 或真实用户数据；
- Live 验收结束后恢复 Mock 并清理临时账号和测试数据。

最终评测集由对应 Agent 实施阶段逐步扩充，不把 Phase 6.9.1 的 32 个 seed cases 或 Router/Verifier 的 100-case 专项集冒充其余 Agent 的最终质量结论。

## 7.2 Phase 6.9.5 Review / Planner 真实模型只读建议

ReviewAgent 与 PlannerAgent 的模型路径采用受限混合架构，不是让模型接管学习业务：

- 输入只能是当前 JWT owner 的确定性快照；模型包不读取数据库、环境变量或凭据。
- Review candidate 最多选择三个现有弱点索引和一个固定 diagnosis；Planner candidate 只能重排现有计划块并选择固定 strategy。结果必须由本地数组和 schema 重新构建。
- 分钟数、容量、FSRS、deadline、链接、任务写入以及所有权限判断始终由本地服务决定。两个 suggestions API 保持只读。
- credential、instruction override、system-prompt material、空/低压力快照、pre-abort、预算不足与不安全输入必须在 runtime 前 zero-call。timeout、abort、provider/schema/telemetry 失败只能返回确定性 fallback。
- 每个 suggestions 请求共享不可变 `2 calls / 1950 input / 440 output` budget；Review 与 Planner 默认 timeout 都是 `4500ms`，不得重试。
- `REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 是仅 server 的独立 rollback gate，默认都为 `false`。Web 可以保留 Chat、Router、Verifier 所需的 server-side provider allowlist，但不得接收 Review/Planner gate 或 timeout。
- response/Trace/UI 只能传递版本化 `modelObservations` 和固定 applied/degraded 状态，不能传递 prompt、学习事实、provider output、raw error、base URL 或 credential。两个 candidate 都未尝试时 UI 不显示模型状态；任一 attempted fallback 时只能显示“模型建议已降级”。

本阶段先通过 48-case Mock contract：24 Review、24 Planner，其中 26 条为 provider 前 zero-call。Mock 的 `mock_quality_not_evidence` 是固定结论；即使 strict schema 和 rubric 均通过，也不构成 Live 质量或生产启用结论。

每个获批 controlled-Live profile 必须是 server-only、单诊断/单 run、零 retry、原子脱敏 evidence。任一 `diagnostic_blocked`、`invalid_attempted`、质量/安全/权限/延迟/usage/cost 门失败都会保持两个 gate 关闭；不得用 Docker HTTP 成功、浏览器文案或历史证据替代本次语义评测。新 profile 只能在新的零网络根因设计与复审后创建，且不得覆盖、复用或拼接既有 evidence、once marker 或计数。当前 v1--v4 皆为 `invalid_attempted / structured_output`（v3/v4 私有 evidence 记录 `structuredOutputStage=provider_json_parse`），v5 则为 `invalid_attempted / closed / providerAttemptCount=1 / usageKnown=false / structured_output`；五个 profile 都不可重跑。V6 Task 1--6 已完成 default-off 的离线 transport/resolver/factory/evidence/CLI/Mock/复审：只允许精确 DeepSeek V4 Pro `/v1` JSON request 写入 `thinking:{type:'disabled'}`，并在本地拒绝 tool/schema drift 与任何暴露 reasoning 的 response。hardening 后 focused V6 suite 为 61/61、native evidence 为 15/15；一次 Mock proof 为 48 cases / 26 zero-call / 22 runtime / 48 strict / 0 critical / `mock_quality_not_evidence`，临时 `.tmp` 已删除。用户授权后 V6 唯一 canary 已封存为 `state=finalized / status=invalid_attempted / gate=closed / providerAttemptCount=1 / usageKnown=false / diagnosticCode=usage_unverifiable`；这不是 zero-call、零成本、供应商账单或模型质量结论，且 V6 不得重跑。最多 1 canary + 22 paired case（23 次），worst-case reservation CNY `0.18726`、hard cap CNY `1.00` 仍不是实际费用。两个业务 gate 继续默认 `false`；V6 的 48-case、Docker、浏览器、main 合并和推送均不得进入。若要继续，必须先有新的零网络根因设计与复审，并由用户决定是否批准一个全新的隔离 profile。证据见 `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`，不声明真实模型通过。

V7 usage-parity profile 已完成 Task 1--7 离线工程，并于 2026-07-18 在用户授权下执行唯一 controlled-Live。运行前 provider/model/base identity/nonthinking mode/4500ms、CNY 1.00 hard cap 与 V1--V6 18-entry tree hash 全部匹配，Review/Planner 产品 gate 始终为 `false`。运行终态是 `finalized / invalid_attempted / closed / providerAttemptCount=23 / usageKnown=false / evidence_io`；V7 once marker 已消费，无 success seal，JSON 不含 aggregate token/cost 或 quality counters。公开 reader 也固定返回不含 token/cost 的 `evidence_io`。因此 23 attempts 不能被解释为 22 个 paired case 通过、质量通过、零成本或账单事实。两条独立只读追踪只能将边界收窄为：全部 23 个允许的 provider attempts 被安全计数后，paired-result/orchestration failure 或 evidence finalization/history I/O failure 被折叠为 `evidence_io`；现有有损脱敏 evidence 无法进一步区分。V7 不可重跑或改写，不进入 Docker/浏览器/main/push；产品路径仍 deterministic，新 lineage 必须先设计无内容、固定枚举的 stage diagnostics。

V8 stage-diagnostics completion contract 与离线实现已完成，唯一 controlled-Live 也已执行并关闭。它使用全新 profile/eval gate/confirmation/evidence/success seal，V1--V7 immutable snapshot 与固定零字节 stage markers。唯一 run 的 CLI stdout 为 `23 / invalid_response`，durable prefix 只到 `.stage-080-paired-returned`；落盘 231-byte 文件仍是 provisional `attempted / 0 / transport`，public reader 为 `0 / evidence_io / lastStage=.stage-080-paired-returned`。CLI 计数没有形成 durable terminal，落盘/public 的 0 也不是 zero-call 或零成本。由于没有 `.stage-090` 或 success seal，Review-only/Planner-only 产品验收、main replay 与推送不得进入；两个产品 gate 继续为 `false`，V8 不可重跑。

V9 是在不改写 V1--V8 的前提下建立的独立 gate-diagnostics lineage。唯一 Live 已完成 `23` provider attempts、`22` paired admissions、`26` verified zero-call 和 `48` strict successes；P95 `1396ms`、positive usage `7943/510` 与 CNY `0.026889/1.00` 通过，但 quality `30/48`、semantic `4/22`、critical `2` 使 durable reader 固定为 `finalized / invalid_attempted / closed / quality_gate_failed`。V9 once/evidence 已消费且不可重跑、覆盖或删除，无 success seal。`REVIEW_AGENT_MODEL_ENABLED` / `PLANNER_AGENT_MODEL_ENABLED` 保持缺省关闭，产品仍 deterministic。V9 product authority 只接受 `finalized / complete / closed / passed`、23 provider attempts、22 paired admissions 和合法 evidence SHA，并要求完整 V9 leaf 全部以 ordinary `H` 被 Git 精确跟踪且读取前后 repository snapshot 稳定；当前失败在 ledger、Prisma、Docker、浏览器前阻断，不回退 V8 reader 或 `git show`。完整证据见 `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`。

V10 是独立的最小修复 lineage，不重跑或改写 V1--V9：生产有效模型输出收窄为 Review `focusIndexes` 与 Planner `blockOrder`，安全扫描仍覆盖完整 snapshot，本地继续重建 facts、策略、FSRS、分钟数、链接和写权限。唯一 Live 已完成：CLI exit `0`，public reader 五次 fresh read 为 `complete / passed`，V10 v3 aggregate 为 `23/22`、`48/48` strict/quality、critical `0`、P95 `1465ms`、usage `5764/232`、CNY `0.018684/1.00`，全部 schema/quality/P95/usage/attempt/admission/cost gates 通过；V1--V9 manifest 仍为 `36` entries / `61a6e4a956784a59a8b8639d4c94d6fd870bce5dd8549a026abf02a0e7cb769d`。V10 evidence/success seal immutable，safe writer/reader 只接受严格 lane aggregate，拒绝 prompt、snapshot、model output、raw error、URL、credential、cookie、stack 与 per-case timing/usage。根 `.env` 未改，V8/V9 eval 与 Review/Planner 产品 gates 继续 default-off；下一步是分支 Docker/headed-browser 验收，不是 Phase completion。完整结果见 `docs/acceptance/phase-6-9-5-review-planner-v10-offline-checkpoint.md`。

V12 不改变 V10 authority 或 V11 terminal identity：它只把后续 branch acceptance 的安全运行边界与此前不可复用 lineage 分离。离线证据仅证明 default-off、owner/attempt/recovery contract 和真实 host 的控制流边界；它不证明真实模型质量、产品 API、Docker 容器、headed browser 或 cleanup 实际执行。完整离线记录见 `docs/acceptance/phase-6-9-5-review-planner-v12-offline-checkpoint.md`。

补充约束：`zero-call` 不是报告中的静态计数。每条 zero-call case 必须实际进入相应 candidate 入口，经过安全扫描、资格、预算或 abort gate，并由 runtime call counter 得到 `0` 才能写入 `zeroCallVerified=true`。任何意外 runtime 调用都必须令生产决策成为 `zero_call_boundary_failed`。Live success 还必须有 provider-reported 的正安全整数 input/output usage；缺失、非法或 `0/0` usage 是 `PROVIDER_ERROR / invalid_response`，保留预留预算并降级，不得标作 candidate applied、known pricing 或 zero cost。Review/Planner Trace 只有在成功 Trace 的 usage 可验证且集中价格表完整时才写入估算成本；这仍不是供应商账单。

## Phase 6.9.6 Knowledge Agent 验收合同与分支结果

当前 candidate、API/UI、strict paired runner 与 API-only Docker 配置已经实现；唯一 V2 controlled-Live、R7 Docker/API 与可见浏览器分支验收也已通过且不可重跑。本节记录持续有效的合同和已完成证据，不构成新的 Live 授权。完整数值与 schema 以 `docs/superpowers/specs/2026-07-21-phase-6-9-6-knowledge-agents-design.md` 为准。

- deterministic、Mock 与 controlled-Live 必须复用 `phase-6.9-knowledge-agents-v1` 的 72 个 case ID：Dedup 40 条、Organizer 32 条；24 条 zero-call 必须实际穿过 candidate guard 且 runtime counter 为 0，48 条 runtime case 必须通过 strict schema；
- exact `contentHash`、ownership、document status、时间、真实 document ID、recommendation、写权限和最终 merger 始终由本地代码决定；模型不得把语义相似伪装成 exact duplicate，也不得生成删除、替换、合并、改名或分类操作；
- embedding shortlist 只能使用 canonical owner 的 `DONE`、安全、已有 Qwen 1536 Chunk embedding；每份资料最多稳定采样 6 个 chunk、最多 12 个 pair、阈值 `0.78`，向量和 chunk 正文不得进入 API、Trace 或前端；
- Document/chunk/score 必须来自同一 `REPEATABLE READ` owner snapshot；provider 前重验 owner、updatedAt、hash、status 与 chunk identity，漂移以 `snapshot_stale` 零调用。文件名和每段摘要必须先完整经过 `knowledge-model-projection-v1` 的 strict 类型/hostile accessor、credential、instruction override 与持久化 safety 双重检查，再裁剪和分配 ordinal；任一字段不安全即排除整份资料；
- Dedup/Organizer 分别使用 server-only 独立 gate，默认 `false`；真实调用还需全局 Live 双开关、API-only `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY`、精确 DeepSeek HTTPS base URL、已知 pricing、不可变预算和 eligibility。该凭据不得借用 Chat 或 Review/Planner 产品凭据，worker/web/admin 不接收 Knowledge credential/gate/timeout。两个候选共享 `2 calls / 6000 input / 1200 output`，各自 timeout 4500ms、SDK retry 0，单请求硬 cap `0.03 CNY`；
- controlled-Live 必须满足 critical/越权/越界索引/写操作为 0、Dedup macro-F1 >= 0.85、revision recall >= 0.85、Organizer subject top-1 >= 0.88、tag micro-F1 >= 0.80、collection pairwise-F1 >= 0.80、语义加权分比 baseline 至少提升 10 个百分点、单 Agent P95 <= 4500ms、并行 endpoint P95 <= 5200ms、总费用 <= 1.00 CNY；
- semantic score 固定为 `0.35*Dedup macro-F1 + 0.15*revision recall + 0.20*subject top-1 + 0.15*tag micro-F1 + 0.15*collection pairwise-F1`，只在同一 48 个 runtime case 上比较，非法/失败按错误预测计分；提升是绝对差 `>=0.10`。24+24 runtime case 按 `pairedRunIndex=0..23` 组成 24 次并行请求；P95 用 nearest-rank 的第 23 个观测值，包含 attempted success/fallback/error/timeout，不含 zero-call，branch/main 不拼接；
- usage 必须是 provider-reported 正安全整数并与 reservation/runtime/Trace 一致。缺失、非法、`0/0`、unknown pricing、timeout、abort、schema invalid 或 Trace unavailable 都只能回退到 `local_deterministic`，不能伪造 hybrid success 或零成本成功；
- Docker 验收分别覆盖 Dedup-only、Organizer-only、双开关和恢复 default-off；可见 `/knowledge` 覆盖 hybrid/local/degraded、空态、失败态和移动端。建议始终只读，模型失败不得影响上传、处理、替换、检索或 RAG Chat；
- 验收后精确清理 synthetic user/document/chunk/object/job/trace/browser storage，并证明 logger/telemetry/stdout/evidence/临时文件不含 prompt、文件名/摘要正文、provider body/header、credential 或 raw error；外部 provider retention 必须先文档化，不能伪称已清理 provider 日志。随后恢复 Mock/live=false/两个 Knowledge gate=false。禁止 Docker prune、`down -v`、volume reset、Redis flush 或 MinIO wipe；main 合并后必须回放并确认远程 SHA parity。

2026-07-22 分支结果：唯一 V2 run `10ae2f36-69f6-422c-a99f-6bf6b3aeb226` 完成 72 cases、`24/24` verified zero-call、`48/48` runtime，semantic `0.9875`、费用 `0.117498 CNY`，最终 `quality_gate_passed`。R7 run `38748577-f250-4a7a-ab17-8fd14a63b2a3` 分别验证 Dedup-only、Organizer-only、双开关、强制 provider 失败与 default-off；四次实际语义结果为 `candidate_applied`，总 usage `3770/446`、费用 `0.013986 CNY`，exact hash/credential/injection/unsafe/cross-owner 均为 provider 前零调用。API/Trace parity、worker isolation、只读 fingerprint 与精确清理通过。V1 质量失败与 R1--R6 产品失败仍是不可改写历史，R7 不覆盖它们。

可见浏览器 run `012bc3ce-486e-4dce-be32-d29c246f47cd` 完成真实 Docker 注册、TXT 上传、处理、列表、Qwen 混合检索和 default-off 本地 badge；semantic/degraded/error 使用绑定 R7 authority 的 strict response-shape 回放，因此本阶段新增 Live 调用为 0。1440/510/390px 均无横向溢出，页面没有自动整理动作。分支清理后 synthetic User/Document/Chunk/Object/Job/Trace/Session 与浏览器 storage 均为 0，API 恢复 mock/live=false/gate=false/false/credential absent，Docker 卷保留。两个独立复审无 Critical/Important。main `f31335c6` 又完成 focused、真实 Docker API、桌面/移动端可见 default-off 回放和零残留清理；没有重跑 V2 Live 或 R7，远程 parity 已确认，Phase 6.9.6 已完成。

## 8. Reflexion / Critic 验收要求

当改动 RouterAgent、TutorAgent prompt、RAG prompt、KnowledgeVerifierAgent 或 `/api/chat` 输出行为时，除了 mock 单测和必要的 live smoke，还要记录 critic/rubric 结论。

Critic 不替代人工判断，也不负责生产环境自动重试；它先作为验收层，稳定发现明显错误：RAG 有命中但没有“参考资料”、可疑、冲突或不足资料没有“核对/谨慎”提示、提示式讲题直接给最终答案、建议型 route 谎称已经创建/保存/安排了数据。

本地固定规则通过 `bun --filter @repo/agent test -- critic-rubric` 验证；当前 Bun 过滤会运行 `@repo/agent` 测试套件，并确保 critic-rubric 用例包含在内。真实模型验收记录使用 `docs/acceptance/phase-6-reflexion-smoke-template.md`。

## 9. Phase 7.1 后台队列验收清单（已完成）

知识库文档处理接入 BullMQ 后必须持续覆盖：

- `KNOWLEDGE_PROCESSING_MODE=inline` 仍为默认 fallback，不投递 BullMQ，可同步完成文档处理；当前 NestJS 仍会初始化 BullMQ 模块，本地开发建议继续启动 redis。
- `KNOWLEDGE_PROCESSING_MODE=queue` 会创建 `BackgroundJob`，投递 BullMQ，并由 `SERVER_ROLE=worker | both` 且注册了 worker processor 的进程处理。
- `GET /background-jobs` 与 `GET /background-jobs/:id` 必须经过认证，按当前账号隔离，只返回脱敏任务元数据。
- `PROCESSING` 中的资料禁止替换；worker 遇到 `status + storageKey + contentHash` 快照变化时必须跳过旧结果，不写 stale chunks。
- `/knowledge` 页面需要展示后台处理状态，只在处理活跃时轮询；静态 `PENDING` 不应造成无限请求。
- 队列 smoke 通过不代表 live Chat 通过；如果同时改动 Chat prompt、RAG 引用或 Tutor 输出，仍要做 3 到 5 个 live 小样本验收。

## 10. Phase 7.2 RAG SafetyGuard 规划验收要求

RAG SafetyGuard 规划见 `docs/superpowers/plans/2026-06-30-phase-7-rag-safety-guard.md`。实现时必须持续覆盖：

- 用户上传资料是低信任证据，不是系统、开发者或工具调用指令。
- 高风险 prompt injection chunk 不进入 Chat prompt。
- 中风险 chunk 只能作为可疑原文引用，不能执行其中命令。
- 正常学习资料检索和引用不能因为安全过滤整体回退。
- inline 与 queue 处理都必须写入一致的 chunk safety metadata。
- `KnowledgeVerifierAgent` 需要把 prompt injection 风险转成保守 guidance。
- Trace 和 BackgroundJob 仍只能保存脱敏元数据，不保存完整恶意 chunk。
- mock 单测覆盖固定攻击样本；如果改动最终 Chat 输出，还要做 3 到 5 个 live 小样本验收，确认模型没有服从恶意资料。

### Phase 7.2 RAG SafetyGuard implemented acceptance checklist

- 详细实现计划见 `docs/superpowers/plans/2026-06-30-phase-7-rag-safety-guard.md`，面试复盘博客见 `docs/blogs/phase-7-rag-safety-guard.md`。
- User-uploaded documents are treated as low-trust evidence, not as system, developer, or tool-call instructions.
- High-risk prompt injection chunks are classified during document processing and persisted in `Chunk.metadata.safety`.
- `/knowledge/search` returns safety metadata for retrieved chunks so downstream Chat and UI layers do not need to re-guess risk.
- High-risk chunks are excluded before Chat prompt assembly and before citation rendering.
- Medium-risk chunks can still appear only as quoted, untrusted source text and must not be obeyed as instructions.
- Safe study chunks can backfill prompt slots after unsafe chunks are filtered, so normal RAG does not regress just because one retrieved chunk is blocked.
- `KnowledgeVerifierAgent` treats high-risk or `safeForPrompt=false` evidence as suspicious and emits conservative prompt guidance.
- `/knowledge` search results surface compact safety signals without blocking upload, processing, search, or deletion workflows.
- Inline and queue processing paths must continue to write consistent safety metadata.
- Agent Trace and BackgroundJob records remain metadata-only and must not store complete malicious chunks, full prompts, API keys, tokens, or cookies.
- Mock tests cover fixed prompt-injection samples. Live smoke is still required when final Chat output behavior changes, because deterministic filtering does not prove real-model refusal quality.

### Phase 7.2 live/browser smoke record - 2026-06-30

- Environment: local dev server, Docker PostgreSQL / Redis / MinIO running, `RAG_EMBEDDING_PROVIDER=fake`, `/agent-trace` dev AI mode switch used for temporary live mode.
- Live switch check: `/agent-trace` showed `当前：Live` before smoke and was switched back to `当前：Mock` after smoke.
- Basic live Chat smoke: `/api/chat` returned `x-prepmind-ai-mode=live`, route `chat`, trace recorded, and the UI rendered a non-empty assistant answer.
- Knowledge UI safety smoke: a temporary TXT containing prompt-injection text was uploaded, processed, searched, and `/knowledge` displayed the compact `疑似指令注入` badge. The temporary document was deleted after verification.
- Forced-hit RAG SafetyGuard smoke: a temporary TXT was crafted to produce a high-similarity fake-embedding hit; live Chat returned route `rag_answer`, verifier status `suspicious`, verifier chunks `1`, trace recorded, and the assistant answer did not leak system prompt content.
- Final UI evidence included the RAG SafetyGuard notice: one high-risk chunk was blocked and treated as untrusted source text.
- Cleanup: temporary knowledge documents and local temporary TXT files were removed; dev AI mode was returned to mock.

## 11. Phase 7.3 Event Observability 验收清单（已完成）

Phase 7.3 不改动 Chat prompt、RAG citation、Tutor 输出或真实模型调用链路，因此不要求 live 模型 smoke；验收重点是后台任务观测、事件失败隔离和前端轮询边界。

- `InProcessEventBus.publish()` 必须隔离单个 handler 异常，后续 handler 仍能收到事件，并返回 `{ delivered, failed }`。
- EventBus handler 失败只能记录脱敏 warning，允许包含事件类型、delivered / failed 计数，不得打印完整 event payload、用户 id、资料 id、job id、prompt、chunk、API key、token 或 cookie。
- `GET /background-jobs/summary` 必须经过 `JwtAuthGuard`，按当前账号隔离；`activeCount` 使用账号级真实 active count，不能只依赖最近 50 条窗口。
- summary API 的最近失败、跳过和成功摘要用于 UI 提醒，不得自动重试、删除、合并、替换或修改资料。
- `/knowledge` 页面可以展示后台任务摘要，但只在存在处理中文档、本地刚触发处理或 summary 仍有 active job 时轮询；静态 `PENDING` 或健康 recent jobs 不应造成无限请求。
- BackgroundJob / EventBus 仍属于工程可观测链路，不进入 Dexie `mutationQueue`，也不改变 Chat live / mock 开关语义。
- Mock / 单元 / build 验证足以覆盖本阶段；只有后续改动最终 Chat 输出体验、RAG prompt 或真实模型策略时，才需要重新执行 live 小样本验收。

## 12. Phase 7.4 Swagger / OpenAPI 验收清单（已完成）

Phase 7.4 adds Swagger / OpenAPI debug docs。本阶段不改 Chat prompt、RAG prompt、模型路由、流式输出、Tutor 策略或 KnowledgeVerifierAgent guidance，因此不需要 live 模型 smoke；验收重点是 API 文档入口、OpenAPI JSON、认证边界和敏感内容控制。

- `/api-docs` 和 `/api-docs-json` 默认在非 production 开启，便于本地调试、接口发现和面试展示。
- production 默认关闭 Swagger；`SWAGGER_ENABLED=true` 只适合受控环境、内网或临时诊断。
- Swagger 接入不得放宽 `JwtAuthGuard`，受保护接口仍按现有 access token、cookie 和 userId 隔离规则执行。
- `@repo/types` Zod schemas remain source of truth；Swagger 是调试/展示层，不反向驱动前端 contract，也不替代共享 schema 的 runtime validation。
- OpenAPI 文档必须说明全局 response envelope：成功响应为 `{ success, data, requestId }`，错误响应为 `{ success, error, requestId }`。
- OpenAPI JSON 不得包含 API key、Authorization / Cookie 示例、refresh token、完整 prompt、完整回答、完整 RAG chunk、后台任务原始 payload 或真实用户内容示例。
- Mock / 单元 / build / OpenAPI JSON 生成检查足以覆盖本阶段；只有后续同时改动最终 Chat 输出体验、RAG prompt 或真实模型策略时，才需要重新执行 live 小样本验收。

## 13. Phase 7.8.1 RAG Eval Baseline

RAG Eval 用于衡量检索质量，不替代真实 Chat 体验验收。

- 默认单元测试只验证 eval runner 和固定 case 的工程回归，不需要真实 API key。
- `RAG_EMBEDDING_PROVIDER=fake` 可以验证上传、处理、检索和指标计算链路，但不能证明真实语义质量。
- 使用 Qwen / OpenAI 等真实 embedding 的 smoke 才能说明语义召回在真实模型下可用。
- 修改 `/knowledge/search` 排序、Hybrid Retrieval、reranker、Query Rewrite 或 Chat RAG prompt 后，需要用同一套 eval case 对比前后指标。
- Eval 文件不得包含真实用户资料、API key、access token、完整 prompt、完整模型回答或真实私有 RAG chunk。

## 14. Phase 7.8.2 Hybrid Retrieval

Hybrid Retrieval 改动的是 `/knowledge/search` 的候选召回和排序，不直接改变最终 Chat prompt 或模型输出。

- `/knowledge/search` 同时召回 pgvector vector candidates 和 PostgreSQL full-text keyword candidates。
- 服务层按 `chunkId` 去重融合，最终 `score` 仍保持在 `0..1`，响应 contract 不变。
- `metadata.retrieval` 只保存 `mode`、`vectorScore` 和 `keywordScore`，不得保存 query、prompt、API key、access token 或完整私有上下文。
- 第一版不新增 GIN index、不接外部搜索引擎、不接 reranker；中文分词和大规模性能优化留到后续阶段。
- 本阶段不要求 live Chat smoke；但建议本地用真实 Qwen embedding 对 `/knowledge/search` 做精确术语与语义问题 smoke。

## 15. Phase 7.8.3 RAG Eval Smoke

RAG Eval Smoke 用于验证真实 API 级检索链路，不替代 live Chat 输出体验验收。

- `bun --filter @repo/server smoke:rag-eval` 会串联注册临时账号、上传合成 TXT、处理文档、轮询状态、调用 `/knowledge/search` 和 `runRagEval()`。
- smoke 需要本地 API、PostgreSQL、MinIO、Redis 和可用 embedding provider 已启动；如果使用真实 Qwen / OpenAI embedding，它能证明真实模型下的检索链路可用。
- smoke 默认不进入 CI，因为真实 embedding provider 依赖密钥、网络和供应商稳定性。
- smoke 不调用 `/api/chat`，所以它不证明最终回答风格、引用自然度或 Tutor 讲题效果；改 Chat prompt / RAG prompt / Tutor 输出时仍要做 live 小样本验收。
- smoke 报告只能输出状态、指标、命中数、top score、文档名和失败原因；不得输出 API key、access token、cookie、embedding 向量、完整 hit content、完整 prompt 或完整模型回答。
- smoke 使用合成测试资料，不使用真实用户笔记；临时文档应 best-effort 删除，临时用户保留是当前缺少用户删除 API 的已知边界。

## 16. Phase 7.8.4 RAG Eval Hardening

Phase 7.8.4 是 RAG Eval Smoke 的收尾增强，不改变检索排序或 Chat 输出。

- smoke 必需 case id 必须经过 `selectRagEvalSmokeCases()` 校验；如果 `exact-blue-lantern`、`semantic-review-pressure` 或 `cross-language-weak-points` 缺失，脚本必须在上传资料前失败，不能误报 PASS。
- `RAG_EVAL_SMOKE_KEEP_DATA=true | 1 | yes` 只用于本地调试和前端页面复查；默认仍 best-effort 删除临时 smoke 文档。
- keep-data 模式保留的是合成测试资料，不应上传真实用户笔记、API key、token 或私有资料。
- keep-data 不进入默认 CI，也不改变 live Chat 成本边界。
- 本阶段仍不调用 `/api/chat`；如果后续改动 Chat RAG prompt、Tutor 输出或引用格式，仍需要单独做 live 小样本验收。

## 17. Phase 7.9.1 Durable Outbox

Phase 7.9.1 是后台工程可靠性地基，不改变 Chat、RAG prompt、模型路由、Tutor 输出、KnowledgeVerifierAgent guidance 或前端页面行为，因此不要求 live 模型 smoke。验收重点是持久化事件状态机、并发 claim 边界、错误脱敏和不越界保存敏感内容。

- `OutboxEvent` 只能保存内部事件 metadata、幂等键、payload hash、attempts、锁定信息、下次运行时间、安全 payload 和脱敏错误摘要；payload 与 `lastError` 不得包含 API key、access token、refresh token、cookie、完整 prompt、完整模型回答、完整 RAG chunk 或真实用户私有正文。
- `enqueue()` 支持 `idempotencyKey`，唯一键冲突时返回已有事件，避免重复创建同一语义事件。
- `claimPending()` 必须只 claim `PENDING + nextRunAt <= now` 或锁超时的 `PROCESSING` 事件，并在 `updateMany` 时重新校验条件；并发 worker 抢锁失败时不得把事件返回给 loser。
- claim 成功时递增 `attempts`，写入 `lockedBy` 和 `lockedAt`；`markSucceeded()` 只能完成当前 worker 锁定中的事件。
- `markFailedOrRetry()` 在 attempts 未耗尽时回到 `PENDING` 并设置指数退避 `nextRunAt`；达到 `maxAttempts` 后进入 `DEAD`。
- `lastError` 必须复用 `sanitizeJobError()` 或同等脱敏逻辑，不得把 token、cookie、API key、完整 prompt、完整 RAG chunk、完整模型回答、真实用户私有正文或长错误正文落库。
- Phase 7.9.1 不替换 BullMQ、`BackgroundJob` 或 in-process `EventBus`，也不自动迁移现有事件发布点；后续 dispatcher / metrics 接入需要单独验收。
- Mock / 单元 / build 验证足以覆盖本阶段；只有后续把 outbox 事件接入 Chat/RAG 输出链路、改变 prompt 或改变真实模型调用策略时，才需要重新执行 live 小样本验收。

## 18. Phase 7.9.2 Outbox Dispatcher

Phase 7.9.2 是后台可靠事件消费闭环，不改变 Chat、RAG prompt、模型路由、Tutor 输出、KnowledgeVerifierAgent guidance 或前端页面行为，因此不要求 live 模型 smoke。

- Dispatcher 只能执行显式注册 handler，不能根据 payload 动态执行任意函数。
- Unknown event type 必须进入 retry / dead-letter 流程，不能静默丢弃。
- `knowledge.document.processing.requested` handler 第一版只做 payload 校验，不重投 BullMQ、不改 `Document`、不改 `BackgroundJob`、不写用户内容。
- requested outbox payload 只能包含 `userId`、`documentId`、`backgroundJobId` 和 `force`。
- outbox enqueue 失败不得打断知识库 queue 主链路。
- 本阶段不新增自动 scheduler loop、不公开 HTTP API、不新增前端页面、不接 Prometheus / Grafana。

## 19. Phase 7.9.3 Outbox Dispatcher Runner

Phase 7.9.3 只改变后台 outbox 消费方式，不改变 Chat、RAG prompt、模型路由、Tutor 输出、KnowledgeVerifierAgent guidance 或前端页面行为，因此不要求 live 模型 smoke。

- runner 只在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时运行。
- production 默认关闭，避免部署后未经确认消费历史事件。
- runner 只调用显式 dispatcher，不读取 payload、不绕过 handler registry。
- dispatcher tick 失败只能记录脱敏 warning，不得打断 worker 进程。
- 本阶段不新增 HTTP API、不新增前端页面、不接 Prometheus / Grafana、不新增 BullMQ repeatable job。

## 20. Phase 7.9.4 Outbox Summary / Metrics

Phase 7.9.4 只增加后台 outbox 只读观测 summary，不改变 Chat、RAG prompt、模型路由、Tutor 输出、KnowledgeVerifierAgent guidance 或前端页面行为，因此不要求 live 模型 smoke。

- outbox summary 只能返回状态计数、backlog、最老 pending 年龄和最近错误摘要。
- recent error 摘要不得返回 payload、完整 `lastError`、`aggregateId`、prompt、chunk、API key、access token、cookie 或用户内容。
- `DEAD` outbox event 可以让 worker observability status 进入 `degraded`；pending / processing backlog 只能作为独立信号展示。
- 本阶段不新增独立 outbox HTTP API、不新增前端页面、不新增 admin action、不接 Prometheus / Grafana。
- 只有后续把 outbox 观测结果接入 Chat/RAG 输出链路、改变 prompt 或改变真实模型调用策略时，才需要重新执行 live 小样本验收。

## 21. Phase 7.10 Outbox Ops

Phase 7.10 只新增后端 outbox 诊断与 requeue 能力，不改变 Chat、RAG prompt、模型路由、Tutor 输出、KnowledgeVerifierAgent guidance、前端页面或真实模型调用链路，因此不要求 live 模型 smoke。

- 验收重点是 API 鉴权、`OUTBOX_OPS_ENABLED` feature gate、脱敏响应、cursor 分页和 `FAILED / DEAD -> PENDING` 状态流转。
- `OUTBOX_OPS_ENABLED=false` 时接口必须在认证前隐藏为 404，避免生产默认暴露诊断面。
- 列表和详情不得返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie 或供应商 key。
- `lastErrorPreview` 必须复用脱敏逻辑并截断，覆盖 Bearer token、`access_token`、`refresh_token`、`api_key`、`x-api-key`、`Set-Cookie`、`sk-...` 和常见供应商 API key 形态。
- requeue 只能通过 compare-and-swap 把 `FAILED / DEAD` 事件重置为 `PENDING`；不得直接执行 handler，不得修改 payload，不得支持删除、强制成功、跳过或直接 dispatch。
- 本阶段的 e2e / 单元 / build 验证足以覆盖；只有后续把 Outbox Ops 接入前端操作台、生产 admin 权限或 Chat/RAG 输出链路时，才需要新增对应 UI / 权限 / live 验收。

## 22. Phase 7.11 Worker Readiness

Phase 7.11 只新增 worker readiness HTTP 入口和 CLI，不改变 Chat、RAG prompt、模型路由、Tutor 输出、KnowledgeVerifierAgent guidance、前端页面或真实模型调用链路，因此不要求 live 模型 smoke。

- `/health` 只用于 API liveness；`/worker-observability/summary` 用于开发者排障；`/worker-readiness` 和 `bun --filter @repo/server readiness:worker` 用于机器友好的部署前 readiness。
- `WORKER_READINESS_ENABLED=false` 时 HTTP 入口必须在认证前隐藏为 404，避免生产默认暴露诊断面。
- Readiness 只能返回 Redis、BullMQ queue、worker heartbeat 和 outbox 的安全摘要，不得返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie 或连接串。
- CLI 必须使用最小只读 module，不得导入完整 `AppModule`，不得启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher。
- CLI 必须有有界 timeout；ready 退出码为 `0`，degraded / not ready 退出码为 `1`，脚本异常、配置错误或超时退出码为 `2`。
- CLI 输出必须使用受控安全文案，不得打印依赖库原始错误正文、Redis URL、DATABASE_URL、token、cookie、payload、prompt 或 chunk。
- 本阶段的 contract / env / service / controller / CLI 单元测试、server build、eslint 和手动 CLI smoke 足以覆盖；只有后续把 readiness 结果接入前端 UI、容器编排策略或 Chat/RAG 输出链路时，才需要新增对应 UI / 部署 / live 验收。

## 23. Phase 7.12 Docker Worker Healthcheck

Phase 7.12 只把已有 worker readiness CLI 接入本地 Docker Compose `worker` service healthcheck，不改变 Chat、RAG prompt、模型路由、Tutor 输出、KnowledgeVerifierAgent guidance、前端页面或真实模型调用链路，因此不要求 live 模型 smoke。

- Docker healthcheck 在容器内运行 `bun apps/server/dist/scripts/worker-readiness.js`，不是本机 Bun workspace script。
- 本机开发仍使用 `bun --filter @repo/server readiness:worker`。
- healthcheck 只能作为容器级 readiness 信号，不得消费 BullMQ、不 dispatch outbox、不 requeue、不修改业务数据。
- 验收重点是 compose 配置合法、worker service healthcheck 存在、命令指向构建产物、timeout / retries / start period 合理。
- 本阶段的 compose config、单元测试、build、eslint 和 `git diff --check` 足以覆盖；只有后续把该信号接入真实生产编排平台或前端 UI 时，才需要新增对应部署或 UI 验收。
