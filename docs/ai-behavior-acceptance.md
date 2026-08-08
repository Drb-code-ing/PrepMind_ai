# AI 行为验收规范

本文记录 PrepMind AI 的 Chat / RAG / Agent 行为验收边界，避免把 mock 链路测试误当成真实模型体验验收。

## Phase 6.9.8 P1 L2 controlled-Live 失败封存（当前，2026-08-09）

唯一 run `ff035203-500f-4744-b33c-3c375ae4c785` 已在 approved source/tag `fa502925...` 上由正常 runtime 路径
durable seal。8/8 guard 继续 zero-call；真实行为只执行 `rewrite_01` 与 `rewrite_03` 两条 DeepSeek lane，前者 strict
成功，后者以 bounded `schema` failure 打开 breaker，其余 10 条 lane 不启动。最终 gate=
`p1_l2_quality_gate_failed`、`qualityAuthority=none`、`semanticGate=none`。

实际 Provider/credential/Qwen calls=`2/2/0`，usage=`343/40`，aggregate verified cost=`null`；不能把成功 lane 的
`0.00069 CNY` 写成整轮费用。Journal `41` 条并以 `evidence_published` 收口，strict validator=`bundle_valid`，无
recovery claim。`schema` 只代表未满足本地 strict contract，不能推断具体 Provider JSON 字段、网络、账号、余额或模型权限
根因。该失败不证明 P1 semantic、`/api/chat`、Docker/API/browser、Trace、P95/SLA 或 `main` 产品可用；唯一名额已
消费，禁止重跑和追加探测。源码/文档已合并到 `main` merge `f4fac048` 并完成 `main == origin/main` 的零 Provider
回归；完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-controlled-live-quality-gate-failure.md`。
main parity 记录见 `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-main-parity-zero-provider.md`。

## Phase 6.9.8 Transport Re-entry V2 L1 controlled-Live sealed（2026-08-08）

L1 implementation 与唯一 controlled-Live 均已完成并封存。它把 root launcher、source/proxy/data-boundary/
authorization gate、bounded root `.env` projection、三槽真实 adapter seam、strict journal/hash-chain validator、
hard-link publication 与 crash-only recovery 固定为一条不可扩展的 transport canary 流。真正的 dedicated key handoff
只在 durable marker/reservation 后进入 adapter constructor；marker 前仅做 capability 的 lineage/family/call
shape 检查。固定顺序为 `rewrite -> qwen -> final_response`，最多 3 calls、总 cap `0.024096 CNY`，首错即停止后缀。

zero-provider 工程回归仍为 L1 focused `13/13`（44 assertions）、C1+C2+S1+L1 `47/47`（224 assertions）、Agent full
`1409/1409`（24069 assertions）；该回归是 Live 前 checkpoint。唯一 sealed run
`ce0c3257-a5d9-4389-90ec-814d5e9cde34` 的 `3/3` slots、`3` Provider calls、usage `145/28/173`、费用
`0.000573 CNY`、journal `16`、validator `ok=true` 只形成 `controlled_live_transport_reentry_v2` transport
diagnostic authority，`qualityAuthority=none`；不能写成“模型质量通过”或“产品可用”。

首次受控入口在共享 root `.env` composition 以 `credential_configuration_invalid / unknown_key` 停止：共享文件包含正常
项目配置，Qwen 使用宿主兼容 `Qwen_API_KEY`。该次没有 Provider call、marker/evidence 或产品写入；当前 production
profile 已改为只选择性提取 `DEEPSEEK_API_KEY` 与 `QWEN_API_KEY`/`Qwen_API_KEY`/`DASHSCOPE_API_KEY`，并归一化为
canonical `QWEN_API_KEY`，alias 冲突仍 fail-closed。这是 zero-provider compatibility recovery，不是模型质量或网络
健康证据。

sealed 验收记录：`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-controlled-live-sealed.md`。
Live 前 implementation 与 root-env 诊断仍分别见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-implementation-zero-provider.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-root-env-diagnosis-zero-provider.md`。
Root admission 诊断记录：
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-root-env-diagnosis-zero-provider.md`。

## Phase 6.9.8 P1/G1/G2/S2/L2 admission zero-provider gate（历史 checkpoint）

L1 的真实 transport success 已 durable seal，但 `qualityAuthority=none`；当前行为验收已完成 G1 合同、G2
one-shot runner/durability 和 S2 reviewed Mock/static，仍不把 L1 或 synthetic 结果当作回答质量或产品可用性证据。G2 固定先跑 `8` 条 zero-call
guard，再以最大并发 `1` 串行跑 `6` 条 query-rewrite 与 `6` 条 FinalResponse；每条 lane 最多一次 candidate invocation，
总上限 `12`。candidate 只接收 bounded projection，expected、baseline、case identity、citation、tool 与质量阈值只能由
后置 scorer/本地 authority 使用。

G2 authority=`zero_provider_retriever_final_response_p1_g2_runner_durability`、`qualityAuthority=none`。source admission、
single-use capability、exclusive marker、reservation-before-dispatch、fsynced hash-chain journal、hard-link artifact、
strict validator 与 crash-only prefix recovery 均已验证；semantic mismatch 保留固定分母继续，contract/permission/
safety/budget/transport/schema/usage/stale failure 才打开首错 breaker。focused `5/5`、Agent full `1419/1419`；
synthetic CLI `candidateInvocations=12`、`journalRecords=72`、`validator.ok=true`，但 `providerCalls=0 / credentialReads=0 /
formalEvidence=0`，未启动 Docker/API/browser、未写 Trace、BackgroundJob、Outbox 或业务数据。

S2 随后让同一 runner 真实穿过 Retriever original/query-rewrite、synthetic Qwen search port、verified-evidence projector、
FinalResponse stream、strict validator 和 local merger。固定 `8/8` guard、`16/16` strict/wire/synthetic usage、semantic
`1/1/1`，gate=`p1_mock_quality_not_evidence`、authority=`zero_provider_retriever_final_response_p1_s2_reviewed_mock`、
`qualityAuthority=none`；synthetic usage 的 `usageAuthority=synthetic_estimate` 仅是诊断估算，
`verifiedProviderUsageSamples=0`、`verifiedProviderCostCny=null`，不能写成 DeepSeek/Qwen 计量或账单。S2 focused `4/4`、
G1+G2 focused `10/10`、Agent full `1423/1423`，正式 marker/journal/artifact/recovery claim、credential、Provider 与
产品数据均为 `0`。final_11 compatibility 只在冻结 manifest/policy/baseline/input/oracle/projector descriptor 后提供
citation-recall diagnostic，不改变 G1/G2 或 S2 gate。

质量门仍固定为：Recall@5 `>=0.90`、nDCG@5 `>=0.85`、eligible subset uplift `>=0.08`、critical recall `=1`、intent
preservation `>=0.95`、grounded rubric `>=0.90`、citation precision `=1`、required citation recall `>=0.90`、critical
notice recall `=1`，unsafe rewrite/false tool success/false citation/safety failure 全为 `0`。六条语义 lane 只记录
 median/max，P95/SLA 固定为 `null`（`insufficient_sample_size_6`）。该段的分支文档 parity、推送、`main` 合并与合并后二次
回归是已完成的历史动作；当前 Agent full 为 `1437/1437`，controlled-Live 状态以本文顶部和新的验收记录为准。
完整设计、计划与验收见：

- `docs/superpowers/specs/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate-design.md`
- `docs/superpowers/plans/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md`
- `docs/acceptance/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md`
- `docs/acceptance/phase-6-9-8-retriever-final-response-p1-g1-contract-baseline-scorer.md`
- `docs/acceptance/phase-6-9-8-retriever-final-response-p1-g2-runner-durability.md`
- `docs/acceptance/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock-static.md`

L2 admission contract 已以独立 zero-provider 方式完成，但它不是语义质量或 Live authority。它严格绑定 future approved
branch/tag、S2 manifest/policy/baseline/factory identity、DeepSeek/Qwen data-boundary receipt、source-bound exact
authorization 和预算；输出 `providerDispatchAllowed=false`、`providerCalls=0`、`credentialReads=0`、
`formalEvidence=0`。该段只描述历史 parser contract；本次用户已在新 source 上重新接受边界并授权唯一 Live，实际消费仍受
approved tag/source gate 控制。验收记录：
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-admission-zero-provider.md`。

## Phase 6.9.8 Transport Re-entry V2 S1 历史边界

S1 是 C2 之后的 zero-provider reviewed Mock/static checkpoint。三个 bounded synthetic first-party adapter 通过同一
`rewrite -> qwen -> final_response` runner seam；success wire 为 runner `3/3/3/3` 与 adapter/provider
`3/3/3/3`，usage 为 `480/120/600`，synthetic port calls=`3`，正式 `providerCalls=0`、
`credentialReads=0`、formal evidence=`0`。timeout/transport/schema/usage 首错 breaker 与
`abort_before_qwen` fault matrix 均 fail-closed，不 retry、不补发 suffix。

S1 gate=`transport_reentry_v2_s1_mock_quality_not_evidence`，authority=
`zero_provider_transport_reentry_v2_s1 / qualityAuthority=none`。固定 factory/report SHA 为
`sha256:c50b257b...cc20 / 8538b13c...c068`。主代理完成 source/capability/credential/provider/package 静态复核；
三路只读子代理尝试均因服务端 `429 Too Many Requests` 超过重试上限，未形成独立复审证据，不能写成“子代理通过”。

S1 source admission 只统计当前 V2 marker/journal/recovery/report/root artifact 的路径占用；历史 T3/R5/Task 9C 文件和
普通日志不影响当前 lineage，匹配名称的文件、目录或 symlink 均阻断，非 `ENOENT` 读取错误 fail-closed。最终 clean
source 回放为 `git_verified / formalArtifactCount=0`；该回放仍是 zero-provider source authority，不是模型质量证据。

这只能证明 synthetic contract、wire/usage accounting、durability 和 no-raw 边界，不证明 DeepSeek/Qwen health、真实
模型语义、Retriever/FinalResponse P95/SLA、`/api/chat`、Docker/API/browser、Trace、BackgroundJob/Outbox、
业务数据或 `main`。S1 已由唯一 L1 sealed run 收口；当前转入上方 P1 zero-provider semantic-gate。

验收记录：`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock-static.md`。

## Phase 6.9.8 Transport Re-entry V2 C2 历史边界

V2 C2 已在 C1 projection contract 之上完成 zero-provider runner/durability：三个 dedicated capability 先收口为
single-use opaque configuration capability，随后以固定 `rewrite -> qwen -> final_response` 顺序运行 synthetic
三槽；exclusive marker、reservation-before-dispatch、fsynced hash-chain journal、hard-link artifact、strict
validator 与 crash-only recovery 全部由本地 contract 掌握。missing/invalid/conflict/abort/timeout/transport/schema/
usage 的首错会打开 breaker，publication interruption 只恢复同一 terminal，不重放 dispatch。

C2 focused `15/15`、Agent full `1387/1387`、typecheck/lint/Prettier 通过；真实 credential、Provider、正式 evidence、
Docker/API/browser、Trace 与业务写入均为 `0`。authority=`zero_provider_transport_reentry_v2_c2 /
qualityAuthority=none`。这只证明 synthetic 执行与 durability 边界，不证明 Provider health、真实模型语义、产品
`/api/chat`、P95/SLA 或 `main`；S1 与 L1 已完成，后续 P1/G1 也已完成，当前进入 G2。

验收记录：`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-zero-provider-runner-durability.md`。

## Phase 6.9.8 Transport Re-entry V2 C1 历史边界

旧 T3 controlled canary 已一次性失败封存，不能由配置 guard 修复后重跑。V2 C1 已实现 root launcher → bounded
parser → dedicated capability 的 zero-provider contract：exact gate 顺序先于 credential composition，runtime core
不读取 `process.env`，capability 由 module-owned WeakMap/WeakSet 绑定 lineage/family/call 并单次消费；没有读取真实
credential、调用 Provider 或执行产品 Chat。未来 L1 即使得到 strict response/verified usage，也只形成
transport/evidence authority，不能直接写成 Retriever/FinalResponse 语义通过、`/api/chat` 可用或 main 已完成。C1
已由上方 C2 回执收口；没有新的数据边界接受与 exact authorization 前不得执行 L1。

## Phase 6.9.8 Transport Evidence Recovery T3 历史封存边界

T3-A 是 zero-provider admission/runner checkpoint，不是模型质量或产品行为验收。它验证 source parity、T2 gate、
fresh proxy nonce、DeepSeek/Qwen 数据边界与 exact authorization 的 gate 顺序，以及
`rewrite -> qwen -> final_response` 三槽位、`0.024096 CNY` 总预算、首错 breaker 和固定未启动 suffix。focused
`12/12`、Agent full `1360/1360`（23805 assertions，169 files）通过。

随后唯一 T3 controlled canary `075e2d5f-682b-426d-847e-f5a6ce5b97c6` 在 durable reservation 后的 late-bound credential
gate 以 `configuration_invalid` 失败并 crash-only seal：planned/started/completed=`3/0/0`、Provider/credential=`0/0`、
journal `7`、validator `ok=true`，authority=`controlled_live_transport_evidence_t3 / qualityAuthority=none`。这只能说明
CLI/configuration composition 未满足，不能归因 DeepSeek/Qwen health、DNS/TLS/代理、账号/余额/权限/服务端，也不能
证明真实 rewrite/Retriever/FinalResponse 语义、P95/verified cost 或 `/api/chat` 可用。

T3 一次性名额已消费，禁止重跑、追加 Provider 探测、curl、单 case、seal/recovery 或把失败写成 semantic gate。提交
`3d903055` 已让 package controlled script 显式加载仓库根 `.env`，但只用于未来另立 lineage，不能改变本次 T3 终态；
继续使用 Mock/zero-provider 回归。

T3-C configuration guard 已以 zero-provider 静态测试固定该 env 入口与 crash-only seal CLI 边界（`2/2`），不形成任何
真实模型、语义或产品 authority。

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

## Phase 6.9.7 Tutor / WrongQuestionOrganizer 验收合同（Task 0--12 / V2--V9 R5 / Recovery R1--R3）

本节同时记录已完成的 Task 0--11 静态/Mock/本地写/evidence/部署边界/分支 checkpoint，以及 V1--V9
九条唯一 Live 的失败终态。Tutor 已完成 Web default-off composition；WrongQuestionOrganizer 已完成
owner snapshot、三阶段 stale fence、model-free 写 command、server-only default-off runtime、single/batch
单次 dispatch、两阶段 Trace、HTTP abort、strict request-level API runtime 与 `/error-book` 来源状态；这些
是 V1--V4 legacy 产品合同。V5 R0--R5 又建立 coherent V2 dataset、prompt-safe projection、冻结 eval
policy/baseline、两条 bounded candidate、原生 runner/lineage、reviewed Mock 与生产极端边界，但没有接
legacy 产品 composition。V6 R0--R4 随后以 zero-provider 方式完成 source contracts、intent-only Tutor
candidate、actual-shortlist ordinal-only Organizer candidate、双 stale fence、独立 robustness、runner/CLI/
lineage/durability 与 reviewed Mock checkpoint；唯一 V6 R5 为 `24/24` guard zero-call、2 次 Provider
invocation、`0/48` strict runtime，正式 aggregate 全 `null`。V7 R0--R3 再完成第一方 V4 Pro direct
adapter、8-stage wire diagnostics、独立 runner/CLI/lineage/durable evidence、crash-only recovery、完整
fault matrix 与 reviewed static/Mock checkpoint。唯一 V7 R4 为 `24/24` guard zero-call；首对 Tutor
完成 8-stage success，Organizer 在 `content_parsed` 后于 `provider_type_validation` 失败，最终 wire
`2/2/2/1`、strict `1/48`、正式 aggregate 全 `null`。V7 已失败封存且没有进入产品 wiring，因此仍不能
声称两个 Agent 已生产可用。V8 R0--R4 已完成 zero-provider 复盘、fixed-shape Organizer contract/
diagnostic、独立 Provider-like robustness、runner/lineage/durability，以及 reviewed Mock/full checkpoint；
唯一 R5 Live 已证明 fixed-shape schema 在 4 次真实 response 上成立，但第二条 Organizer 命中本地
`dynamic_authority`，最终 `3/48` strict、正式 aggregate 全 `null`。V8 已失败封存，仍不构成真实模型或
产品可用性结论。V9 R0--R4 已以 zero-provider 方式完成本地合法 option authority 的设计、实现与
robustness、独立 runner/lineage/durability 及 reviewed Mock/full checkpoint：模型只返回
`questionIndex + optionIndex`，fingerprint、
完整 V6 decision、真实 ID/confidence/write authority 与三阶段 stale fence 继续由本地掌握；R2 覆盖
Provider-like JSON shape、metamorphic reorder、cap/token、Unicode、hostile value、abort/stale 与最终写
权限边界，R3 再固定 72/24/48/24/32、guard-first、双 lane、wire/terminal accounting、breaker、
hash-chain journal、hard-link evidence 与 crash-only recovery。R4 reviewed Mock 穿过正式 V6 Tutor、V9
Organizer option selection、V6 validator/merger 与第一方 direct adapter，得到 `24/24` guard、`48/48`
strict、wire `48/48/48/48` 与 semantic `1/1/1`；gate 固定 `mock_quality_not_evidence`。唯一 V9 R5
controlled-Live 随后完成 `24/24` guard，但首个 pair 两条 lane 均在 Provider response 前终止：Tutor 为
`provider_runtime / transport`，Organizer sibling 为 `post_dispatch_abort`。最终 wire `2/2/0/0`、strict
`0/48`，正式 aggregate 全 `null`，以 `quality_gate_failed` seal。V9 仍未形成真实语义或产品可用性结论。

V9 失败后，用户决定停止继续复制版本化 Live runner，先定位 Provider 链路。Architecture Recovery R1
保持 sealed V1 direct adapter、公共 `providerFailureCategory=transport`、V1--V9 report/schema/validator/
artifact 不变，新增独立 `first-party-deepseek-v4-pro-transport-diagnostic-adapter-v1`。只有 future fetch
delegate throw 会在新 adapter 实例内存中映射为 frozen
`aborted/timeout/dns/tls/proxy/connection_refused/connection_reset/network_unreachable/unknown`；它不会进入
既有 Trace/evidence/API。分类器只读 own data `code/name` 与最多四层 cause，不执行 getter、`toString`，不读
或保存 message/stack/raw error/URL/header/body/prompt/key。

Architecture Recovery R2 已完成独立 zero-network health canary 合同：固定 fact-free prompt、exact
`{ ok: true }`、DeepSeek V4 Pro non-thinking JSON、no tools/stream/retry、每次 `1/512/16` 与
`0.00200000 CNY` cap。Runner 只接收 closed synthetic scenario enum、timeout 和 AbortSignal；外部增加
fetch、transport、credential、URL、Live mode 或 artifact path 均在 executor 前拒绝。初版审查发现任意
injected fetch 会破坏 zero-network 保证，最终实现已删除该注入口，20 个场景全部在模块内映射为
Response/fixed throw/abort wait。

R2 report 只保存 bounded outcome、R1 subtype、V7 wire counter、per-invocation reservation 与 synthetic
usage；取消/timeout 必须与 wire terminal 一致，迟到 abort 不能覆盖 succeeded terminal。CLI 只接受
`mock` / `fault-matrix`，21 个 fault case 覆盖九类 transport、HTTP、response/JSON/schema/usage、预算、
pre-abort 与 runner timeout。所有输出固定 `authority=synthetic_test`、artifact
`qualityAuthority=none`；R2 没有读取 credential、调用 Provider、写正式 artifact、接产品或修改 V9。
因此 synthetic success/usage/latency 不能证明 HTTP、DNS/TLS、代理、账号、余额、模型权限、服务端健康、
真实费用、Tutor/Organizer 语义或产品可用。

Architecture Recovery R3 已完成未来唯一真实 health canary 的独立工程边界。正式路径只接受 exact
confirmation，并同时要求专用 approval、专用 credential、固定 branch、tracked clean 与
`HEAD == tracking commit`；公开 CLI 固定内部 production ports，不能注入 fetch、transport、URL、model、
writer、retry、resume、replay 或 output path。Provider dispatch 前必须 exclusive-create 带 owner PID/token
的 marker，并 durable append 绑定 marker SHA 的 `attempt_reserved`。

R3 wire stage、terminal、publication 使用独立 hash-chain journal。Terminal 内嵌完整 bounded report；
artifact 固定 `authority=controlled_live / status=diagnostic_only / qualityAuthority=none`。Validator 重新关联
marker/report/evidence SHA、terminal outcome/report、completion/publication mode、recovery claim 与原始 journal
tail。`publication_started` 后任何 I/O failure 永久 fail-closed，不能再次发布。

Crash-only seal 只在 owner 已死亡时从 durable prefix 重建
`not_dispatched / dispatched_no_response / response_observed`，通过 exclusive 单胜者 claim 和 stale-claim
takeover 收口；它不读取 credential、不构造 transport、不 retry/resume/replay Provider。首次授权 CLI 在
Windows 默认 evidence root 尾分隔符的旧字符串围栏中于 reservation 前失败：Provider invocation/dispatch=0，
marker/journal/claim/artifact=0。修复以 `resolve + relative` 做词法 containment，并新增目录 URL 回归；R3 focused
`18/18`、R2 regression `14/14`、AI full `264/264` 均为 zero-provider 工程证据。

修复后的唯一 R3 controlled-Live run `253a5df5...` 随后正常 runtime seal：`transport_failed /
connection_refused`、`dispatched_no_response`、wire `1/1/0/0`，usage/token/CNY 全 `null`，7-record journal
已到 `evidence_published` 且无 recovery claim。本地 proxy 指向无监听 loopback `127.0.0.1:7897` 是高度相关
但未证实的条件，不能升级为 socket 唯一根因。R3 不得重跑；该 diagnostic failure 不能通过
Tutor/Organizer semantic 或产品 gate，R4 继续阻断。

Architecture Recovery proxy preflight 已作为独立未编号的 zero-provider 合同完成。它只读取 own-data proxy
snapshot；Windows/Bun composition root 也只把八个固定 proxy/`NO_PROXY` key 从平台 accessor 复制为普通
数据，不枚举整份环境、不读取 `.env` 或模型 credential。允许状态只有 proxy absent 的 `direct_ready`，或
所有已配置变量严格一致指向显式 loopback HTTP URL 且 250ms listener probe 成功的
`loopback_proxy_ready`。

非空 `NO_PROXY`、uppercase/lowercase authority 冲突、userinfo、非 HTTP、非 loopback、缺失/非法端口、
path/query/hash、控制字符、hostile getter/Proxy 均在 listener 前 fail-closed。Listener 只连接经验证的
`127.0.0.1` / `::1`，不发送 payload，连接后立即销毁；核心 runner 自己用 internal AbortController 和
watchdog 强制 250ms，因此永不 settle、throw、异常返回与 abort 都有 bounded terminal。Report 只保留固定
version/enum/boolean/counter，`providerCalls=0`，不保存 proxy URL、credential、raw error、socket peer 或
stack。

首次实际 CLI 为 `loopback_proxy_unavailable / configured=4 / probe=1 / providerCalls=0`；宿主 listener
恢复后，fresh CLI 为 `loopback_proxy_ready / configured=4 / probe=1 / providerCalls=0`。两次 authority
都只是本地 preflight diagnostic：不证明 HTTP、DNS、TLS、代理转发、DeepSeek、账号、余额、模型权限、
限流或服务端健康，也不把 R3 的 proxy 相关性升级为唯一根因。R3、原 R4、产品与后续阶段的阻断不变。

Provider Canary V2 D0 re-entry 设计已独立冻结。它不复用 R3/R4 identity，阶段使用
D0/C1/C2/S1/L1/P1；C2 production composition 强制
`exact args -> 8-key proxy preflight -> source parity -> dedicated credential -> V2 marker/reservation -> one
fact-free dispatch -> bounded terminal/publication`。Preflight failure 前 credential/source/marker/Provider 都必须
0-call；ready 只产生进程内 single-consume attestation，不保存 proxy URL/port 或网络健康结论。C1/C2/S1
全部保持 zero-provider；S1 已提交、推送和终审。用户随后重新接受运行时数据边界并给出 exact authorization，
唯一 L1 已执行并封存；即使 L1 complete，也只解锁新的小样本 semantic 设计。

Provider Canary V2 C1 已完成上述 zero-network admission contract。V2 request、proxy-attestation、budget、
report、fault-matrix 与 CLI 使用独立 identity；preflight success 只在模块私有 `WeakMap` 中为一个空对象绑定
进程内 capability，第一次调用同步消费，clone、伪造、replay 与并发其余消费者全部拒绝。Preflight
failure/abort 不铸造 capability。Report 固定
`authority=synthetic_test / qualityAuthority=none / providerHealth=unknown / zeroNetwork=true`，V7 wire 为
`not_started`，credential/source/marker/provider 与 executor/dispatch/response/usage counter 全为 0，实际
usage/费用为 `null`。CLI 只允许 `mock/fault-matrix`，15-case closed matrix 全部通过；有效 R2/R3 report 与
V2 report 已双向拒绝。该证据不证明 Provider 或 Agent 质量。

Provider Canary V2 C2/S1 已完成 one-shot/durability/evidence 工程合同。Public CLI 只接收
`args + AbortSignal`，固定 production ports，不允许调用者注入 root/env/fetch/URL/model/proxy/timeout/clock/
UUID/writer/output/retry；CLI core 与 testing seam 不从 package index 导出。Source gate 在 approval/credential
前固定验证 branch、tracked clean、HEAD/upstream/remote、正式 V2 artifact=0 与 R3 sealed parity。

Marker 以 exclusive-create 消费名额；`attempt_reserved`、8-stage wire、terminal、publication 使用 sequence +
hash-chain + fsync，dispatch stage 必须先 durable 才进入 delegate。Terminal/publication 各只有一个胜者；
`publication_started` 后失败永久 fail-closed。Crash-only seal 不 preflight、不读取 credential、不构造 transport
或调用 Provider；活 owner 拒绝，死 owner 由单胜者 claim 收口，已有 runtime terminal 只允许原样完成
publication。V2/R3 confirmation、filename、marker/schema 双向拒绝。

C2 focused `32/32`、Recovery `91/91`、AI full `323/323` 与静态门通过。唯一 L1 run
`dc09214c-0300-4153-8273-e548ac768d20` 随后得到 `complete / strict_response_with_verified_usage`，response/
strict 均为 `true`，wire `1/1/1/1`，usage `49/5`，费用 `0.00017700 CNY`。Journal `12` 条并以
`evidence_published` 收口；validator `ok=true / evidenceCount=1`，artifact SHA 为 `98368de...a7e4`，无
recovery claim，R3 validator/SHA 不变。

L1 只能证明这一次 fact-free 请求在当时 source/credential/network path 下得到 strict response、verified
usage 与可验证 evidence。`status=diagnostic_only / qualityAuthority=none`，因此不能证明 Provider 长期健康、
Tutor/Organizer semantic、RAG/写隔离或产品可用，也不能外推 P95、48-case 成本或 SLA。L1 名额已消费并禁止
重跑。其解锁的 P1/G1/G2/S2 已 zero-provider 完成；后续唯一 L2 已按独立 admission 完成并封存。

P1 使用独立 `phase-6.9.7-tutor-organizer-small-sample-v1`，不恢复 V1--V9/R3/R4/L1 identity。来源固定为
V2 dataset `42803d45...b437b`；manifest `ae667f1c...edf61` 选择 4+4 critical guards 与 runtime
`01/08/10/12/15/19/23/24`，共 8 pairs、16 lanes、12 Organizer decisions。覆盖 Tutor 全部 5 intents、
zh/en/mixed/conflicting-signals，以及 Organizer 6 subjects、create/reuse、single/batch、structured subject、
locked-name/no-write。

未修饰 deterministic subset baseline 为 Tutor/Organizer/Combined
`0.7070238095238095 / 0.2375 / 0.47226190476190477`，canonical payload SHA 为
`d36d0789...d9f4e`；Provider/token/cost 为 0。L2 quality gate 固定 guard `8/8` actual zero-call、runtime
strict/wire/verified usage `16/16/16/16`、三个 semantic 均 `>=0.85`、Tutor/Organizer 各提升
`>=0.15`、invalid/critical/permission/mutation/broader fallback 为 0，且 provenance 必须是
`deepseek_network`。任一 runtime/wire/duration/usage/pricing 不完整时 semantic/latency/token/CNY aggregate
全 `null`。

8-pair sample 不产生既有 24-value P95 authority；只允许 `3500/5000ms` hard timeout、sample median/max，P95
字段保持 `null / insufficient_sample_size_8`。L2 cap 固定 `16 calls / 37600 input / 8800 output /
0.176 CNY`，guard-first、pair-serial、pair 内 sibling lane 独立 abort/timeout/terminal，no retry/resume/replay/
backfill。P1/G1/G2/S2 当时未读取 credential 或调用 Provider；S2 本身不创建 approved tag。后续独立 L2
admission 已在 S2 commit 推送且 HEAD/upstream/remote parity 后创建/绑定 tag，并重新取得数据边界接受与
exact authorization。

G1 已把 manifest、deterministic baseline、strict report/scorer/gate 落成纯本地合同。Baseline
authority/logical report/physical file SHA 分别为
`d36d0789...d9f4e / ad3aa54d...d002 / e8bcbcb5...658b`。Report 从固定 24 entries 重算 aggregate，Mock
永远只能得到 `mock_quality_not_evidence`；在单元测试中构造一个
`executorProvenance=deepseek_network` 的 schema pass 也不构成真实 provenance。

G2 已实现不可注入 one-shot production CLI、source/authority、runner、durable journal/marker/artifact 与重算
validator。Public CLI 只接收 `args + AbortSignal`；G2 当时要求 source 绑定未来 L2 admission 创建/绑定的
approved tag，G2 与 S2 都未创建该 tag，因此在 credential/marker 前保持关闭。后续 admission 已独立创建并
绑定 approved tag。运行顺序固定为 preflight ->
source -> approval -> dedicated
credential -> marker -> 8 guards -> 8 pairs -> publication。Guard-first、pair-serial、pair 内双 lane、独立
budget/abort/timeout/terminal 与首 contract failure breaker 均由 runner 执行；semantic mismatch 不提前停止。

Crash-only seal 不运行 preflight、不读取 credential、不构造 transport、不调用 Provider。若第一条 lane 已
reservation 而 sibling 尚未 reservation，或 8 guards 已完成但首对 lane 尚未 reservation，recovery 只补当前
开放/待锚定 pair 的零-wire reservation 并立即 `attempted_aborted`，后续 pair 固定
`not_started_quality_breaker`。这不是 resume/replay/retry。父请求取消使用 `external_abort`，lane 内部取消才
使用 `abort`。G2 只形成 `zero_provider_runner_durability`。

S2 reviewed Mock 已真实穿过 Tutor V6、Organizer V9、第一方 direct adapter、strict validator、本地
authority/merger 与 G2 runner。Responder 不读取 expected/oracle；actual 从 model-owned decision 与本地
authority 重建并与 runtime axes 交叉核验。正常结果为 `8/8` guard、`16/16` strict/wire/verified usage、
semantic `1/1/1`，但 gate 永远是 `mock_quality_not_evidence`。Focused `35/35`、G1+G2+S2 `87/87`、
Agent `1062/1062`、AI `323/323`、Types `42/42 + tsc`、Web `439/439`；S2 收口时正式 L2 文件为 0。

P1/G1/G2/S2 都没有改最终 Chat 输出或形成真实 Provider quality authority，因此不需要、也不允许用一般
live smoke 规则追加 Provider 调用。唯一 L2 随后在 fresh 数据边界接受、exact confirmation、已推送 commit
parity 和独立 source/tag admission 下执行一次并 durable seal：run
`6918df4f-a4ae-4de0-aa21-c7614ed5861d`，guard `8/8`、strict/wire/verified usage
`16/16/16/16`，Tutor/Organizer/Combined semantic
`0.9141666666666668 / 1 / 0.9570833333333334`，improvement
`0.2071428571428573 / 0.7625`，usage `7032/244`、费用 `0.02256 CNY`，安全失败全 `0`。Gate 为
`small_sample_quality_gate_passed`，authority 为 `small_sample_semantic_gate`；journal `180` 条并以
`evidence_published` 收口，validator `ok=true`，artifact SHA `a1b51f...eb0d`，recovery claim 为 0。

该 authority 只覆盖固定 8-pair 小样本语义门。8 样本 P95 仍为
`null / insufficient_sample_size_8`，不能证明 SLA、48-case、产品 API/页面或生产就绪。L2 名额已消费，禁止
retry/resume/replay/backfill、追加 Provider 探测、seal/recovery 或改写 artifact。P2 随后已 zero-provider
冻结完整 `72/24/48/24/32` full gate、manifest `e68e6e27...12c78`、baseline authority
`2ab1030f...a5f2`、eval policy `11371d16...f503`、L2 anchor subset、24-sample P95 与
`48 calls / 0.55 CNY` cap。F1 又把 exact manifest、deterministic baseline、安全 writer、strict
report/scorer/gate、anchor/P95/null aggregate 与历史 lineage 双向拒绝落地；baseline logical/physical SHA 为
`16c574b1...2c9 / 16aa1773...6f73`，authority 仅 `zero_provider_full_contract_baseline`。F2 又把固定
production CLI/source admission、24-guard/24-pair runner、独立 budget/abort/timeout、exclusive marker、fsynced
hash-chain journal、hard-link artifact、strict validator 与 crash-only seal 落地；authority 仅
`zero_provider_full_runner_durability_evidence`。S3 又以 reviewed `mock_synthetic` composition 真实穿过两条
candidate、第一方 adapter、strict validator、本地 merger 与 F2 runner，得到 `24/24` guard、`48/48`
strict/wire/usage、Tutor/Organizer/Combined semantic `1/0.996875/0.9984375`、L2 anchor `1/1/1`；但 gate
固定 `full_gate_mock_quality_not_evidence / qualityAuthority=none`。其后唯一 L3 run
`2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 已在 `deepseek_network` provenance 下运行并正常封存：24 guards
保持 zero-call，22 条 runtime lane 收到 response，21 条完成 strict/verified usage；Tutor runtime 11 在
content parse 后发生 schema failure，breaker 阻止剩余 26 lane。完整 semantic、L2 anchor、P95、token 与
CNY aggregate 全 `null`，终态 `full_gate_quality_gate_failed / qualityAuthority=none`。L3 不得重跑，产品
Docker/API/browser、main 与后续阶段继续受门禁约束。

Full-gate Schema Recovery SR0--SR4 已冻结并验证 zero-provider 行为、durability 与 reviewed Mock 边界。Tutor Provider content 先作为不可信
envelope 接受有界 native JSON/duplicate/shape audit；exact schema identity 才获得 raw parser capability，selection projection 只读取 canonical own-data
`intentIndex` safe integer，并重新构造 strict projected decision。无权威 extension fields 只允许形成固定
type/count/shape diagnostic 后丢弃，不进入 candidate result、Trace、report、产品 prompt 或日志；missing、alias、
string/fraction/null/out-of-range、duplicate key、wrapper/fence/prose/BOM/trailing data 与结构超限继续
fail-closed，禁止 coercion/default/clamp/retry。随后仍须通过 local signal/preferred-depth authority 与本地 merger；
模型不能选择 depth、answer structure、`answer_direct`、route、tool、permission、真实 ID 或写命令。Diagnostic
固定 `rawDataRetained=false`，不保存 raw completion/hash、Zod path/value、unknown key 名、prompt、credential、
用户正文或 oracle。Schema Recovery candidate 最多一次 runtime dispatch、不 retry，并保持 V6 budget/abort/usage/
Trace fail-closed。SR1 contract SHA 为 `e2453fae...11579`。SR2 fixture SHA 为 `43248bfa...0d41e`，使用只读
实际 bounded prompt/eligible ordinals 的 anti-oracle responder，覆盖 24 个 Tutor runtime、18 个 Provider
shape、5 个 held-out、Unicode/limit、transport/HTTP/audit/usage、budget/abort 与 pair sibling/breaker。SR2
`24/24 candidate_applied` 只证明结构路径可用，不与 expected intent 比分，也不产生 semantic quality authority。
SR2 checkpoint authority 仅 `zero_provider_full_gate_schema_recovery_robustness`，不证明真实模型或产品可用。
SR3 又把固定 `72/24/48/24/32`、schema accounting、wire/usage/metric/breaker 重算放入独立 report/runner，
把 `schema_stage_started/succeeded/failed` 写入 fsynced hash-chain journal，并提供 hard-link artifact、strict
validator 与 crash-only recovery。Recovery 只解释 durable prefix；即使 wire 已到 verified usage，schema
terminal 未 durable 时也只能记录 `not_observed`，usage/semantic aggregate 保持 `null`。公共 CLI 仅开放
zero-provider validate/crash-only seal，没有 Live/credential/fetch port。SR3 authority 仅
`zero_provider_full_gate_schema_recovery_runner_durability / qualityAuthority=none`。SR4 reviewed Mock 真实穿过
recovery Tutor、Organizer V9、第一方 synthetic adapter、本地 authority/merger 与 SR3 runner，固定得到
runtime `48/48/0/0`、wire `48/48/48/48`、schema `42 canonical + 6 extension discarded`、Tutor/Organizer/
Combined semantic `1/0.996875/0.9984375`、L2 anchor `1`、usage `17732/654` 与 `0.05712 CNY`。该结果只具有
`schema_recovery_mock_quality_not_evidence / qualityAuthority=none`；不能证明 Provider、真实语义或产品可用。

唯一 SR5 controlled-Live run `63f8a76b-1c2a-403d-b774-0235caae04cb` 随后在独立 approved source/tag
`67661f5f...d4441` 上完成真实 `deepseek_network` full gate：guards `24/24` zero-call，runtime
`48/48/0/0`，wire/strict/verified usage `48/48/48/48`，schema canonical `48/48`，Tutor/Organizer/Combined
semantic `0.9736111111/0.9515968407/0.9626039759`，paired P95 `2240ms`，usage `20966/789`，费用
`0.067632 CNY`，安全与权限失败全 0。最终 gate/authority 为
`schema_recovery_quality_gate_passed / schema_recovery_full_gate_semantic_gate`；journal `628` 条并以
`evidence_published` 收口，validator `ok=true`，recovery claim=0。它证明固定评测集上的真实模型 schema 与语义
质量门通过，但不证明 Tutor Chat、Organizer single/batch、Trace、业务写入、Docker/API/browser、SLA、main 或
生产可用；旧 L3 failure 与 SR4 Mock-only authority 不被覆盖。SR5 不得重跑。该 checkpoint 当时只解锁 SR6
分支产品验收。

SR6 随后在 `providerCalls=0` 边界完成产品 composition 验收。新增
`phase-6.9.7-sr6-product-replay-v1` 只在绑定 SR5 artifact SHA `87dd826b...18be`、mode=mock、全部
Agent/Live gate 关闭、全部 Provider credential 为空、RAG=fake、API role 与 exact component/request cap 同时
成立时启用。`sr5_sealed_replay` 不是重放 SR5 Provider response/Trace：它解析当前 bounded Tutor V6 /
Organizer V9 prompt，并从当前本地合法 eligible option 中确定性选择第一项；不读取 expected/oracle 或 SR5
模型原文。Replay Trace 必须保持固定 mock identity、成功状态、正整数 usage 与合法 task/output cap；Tutor
pricing 为 unknown/null，Organizer 为 not-applicable/0，因此不能冒充 `production_live` 或计入 DeepSeek billing。

SR6 Docker/API 中，Tutor 登录态 + OCR context Chat 与 Organizer single/batch 均为 `candidate_applied`，batch
`3/3`、locked name 不变；跨账号统一 404 且无写入。Forced Tutor failure 保持 Chat 成功，Organizer 回到
`local_deterministic/fallback_runtime_error`。可见 `/chat`、`/error-book`、`/agent-trace`、精确数据/浏览器清理
与最终源码 default-off Docker 回放通过。该证据只证明 zero-provider 产品接线、权限、Trace、降级、UI 和清理，
不提升 SR5 semantic authority，不形成真实模型产品质量、SLA、生产部署或 main authority。该 checkpoint 当时只
解锁 SR7/main。

SR7 已完成 main 合并、远程发布与 default-off Docker/API/可见浏览器/Trace/清理。Organizer gate-off 必须返回
`local_deterministic / gate_disabled / degraded=false` 且不创建 Trace。精确 Tutor step-check 必须同时满足：
`route=tutor`、`intent=step_check`、candidate `attempted=false`、模型调用总数 0、input/output token `0/0`、
`LIVE_CALLS_DISABLED`、candidate pricing unknown；允许顶层本地 Mock Trace 记录 `cost=0` 和预算估算，但不得把
Mock token estimate 当成 Provider verified usage。SR7 没有重跑 SR5 或启用 SR6 replay，所有 Agent/Live gate
保持关闭。两个合成账号、tracked Outbox 与浏览器业务数据已精确清理。该证据只形成 zero-provider
main/default-off authority；Phase 6.9.7 至此完成，下一阶段仅 Phase 6.9.8 RetrieverAgent /
FinalResponseAgent 正式化与通信 contract。

SR7 证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr7-main-acceptance.md`。

- 固定 `phase-6.9-tutor-wrong-question-v1` 共 72 cases：Tutor/Organizer 各 12 zero-call + 24 runtime；24 zero-call 必须实际穿过 guard 且 runtime counter=0，48 runtime 按 24 paired indexes 全部保留在分母；
- Task 1 未修饰 baseline 已冻结：SHA-256 `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`，32 Organizer decision units，完整命中 `6/48`，Tutor/Organizer/combined semantic `0.4418666667/0.278125/0.3599958333`，critical/provider/token/cost 均为 0。该零调用只是 baseline 没有 runtime，不能替代未来 guard counter；
- Task 2 已固定 strict schema 与动态 validator：Tutor 模型没有 `answer_direct` 权限；Organizer 必须完整覆盖 `q0..q11`，只能引用 `d0..d19`，重复/越界/部分 batch、跨 subject deck、本地 subject 权威冲突和危险 topic label 全批拒绝。projection 使用有界 descriptor clone、完整字段先扫描、safety metadata、裁剪/token 重验/deep freeze，公开值不含真实 ID、完整 answer/userNote 或写能力；这仍不等于 candidate/runtime 已完成；
- Tutor 明确 direct/hint/step/concept/explain 指令、非 tutor route、不安全输入、abort/budget/gate-off 保持 zero-call；模型只处理隐含、上下文或冲突教学意图，不能输出 `answer_direct`，最终 TutorStrategy/prompt 由本地重建；V4 model precedence 固定为 `step_check > explain_solution > concept_bridge > socratic_hint > general_follow_up`，active context 不得把具体 intent 降级为 general；
- Organizer 已有 item、高置信结构字段、精确 deck、不安全/越权/stale/gate-off 路径 zero-call；single/batch 每 HTTP request 最多一次 provider 调用，batch 最多投影 12 个 eligible item；
- V1--V4 legacy Organizer 模型可返回 question/deck ordinal、固定 subject enum 或有界 topic label；当前 SR6 product composition 已切换到 V9 exact `questionIndex + optionIndex` ordinal-only candidate。JWT/owner、真实 ID、用户锁定名称、WrongQuestion/FSRS 事实、subject/topic/deck authority、Trace admission 与写 command 都是本地权威；
- Tutor/Organizer 独立 default-off product gate；当前 Tutor 使用 Schema Recovery candidate、Organizer 使用 V9 candidate，产品 timeout 仍为 `3000/5000ms`，P2/SR5 full-gate 评测 hard timeout 则冻结为 `3500/5000ms`，二者不得混称。两路生产 Live 固定 V4 Pro non-thinking JSON、no tools/retry，并分别只读取 `TUTOR_AGENT_DEEPSEEK_API_KEY` / `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`；generic/其它 Agent key 不得替代。Tutor/Organizer request cap 分别为 0.006/0.016 CNY；SR6 replay 则严格 zero-provider、每 component 1 次且不计真实费用；
- Compose 只把 Tutor gate/timeout/key 投影给 `web`，只把 WrongQuestionOrganizer gate/timeout/key 投影给 `server`；`worker/admin` 均不接收。四个应用 service 都不使用整份根 `.env` 的 service `env_file`，根 env 只参与显式插值；worker 另有模块层强制关闭。部署 allowlist 与应用 fail-closed 都必须通过，不能互相替代；
- quality gate 要求 24/24 zero-call、48/48 strict runtime、critical=0、两个 semantic score 均 >=0.85 且各自比 baseline 提升 >=0.15，Tutor/Organizer/paired-candidate P95 分别 <=2500/4500/4500ms，Tutor orchestration P95 <=6500ms；后者只含本地 Tutor strategy + candidate，不含真实 Router、HTTP、RAG 或最终流式 Chat，不能作为产品 P95。production gate 还必须要求 `executorProvenance=deepseek_network`；计时窗口和可复现公式见专项设计 §10.2，baseline 数值由 Task 1 acceptance 冻结；
- Tutor Trace 延续 best-effort，失败不得中断 Chat；Organizer model-influenced write 必须先持久化安全 Trace，否则丢弃 candidate 并使用 deterministic command；
- Live 只在分支静态/Mock checkpoint 后以新 identity 重新获得一次明确授权。V1--V9 均未通过且各自
  marker/evidence 已封存，因此没有验收 Docker Tutor Chat、Organizer single/batch、owner/locked-name/
  zero-call/forced-failure、可见 `/chat`/`/error-book` 或 synthetic 清理；进程级 Live 变量随进程退出，
  tracked defaults 保持 mock/gates=false，Docker 卷未改动。V1--V9 都不得重跑。

Task 5 当前证据：Tutor Web server-only composition 固定 V4 Pro non-thinking JSON、3000ms、独立 `1/1200/300` 预算与 `0.006 CNY` cap，只读取 `TUTOR_AGENT_DEEPSEEK_API_KEY`；Route 在 live access/context prepare 后注册惰性 factory，非 Tutor final route 不创建 Tutor bundle/runtime 或读取 component credential，Live executor/runtime 只在 final Tutor route 的 implicit/contextual/conflicting candidate 真正调用时构造一次。失败保留 deterministic strategy，Tutor budget 不污染 Router -> Verifier 共享预算，header/Trace 只含固定安全字段且 CNY 不混入顶层 USD。focused `27/27`、Web `432/432`、Agent `529/529`、AI `194/194`、Web lint/build 与 Compose tracked-example quiet parse 已通过。该证据只证明静态/Mock 产品 composition，不证明 controlled-Live、Docker API、可见浏览器或真实回答质量。

Task 6 当前证据：最多 12 个目标在同一 `REPEATABLE READ + READ ONLY` owner snapshot 中读取，raw userId 由域分离 HMAC 代替，完整 fingerprint 覆盖 target、错题字段、现有 item、group/deck identity、名称、`nameLocked`、版本与有界关键词。产品按 snapshot -> provider/decision 前 fence -> decision -> decision 后 fence -> 深冻结 model-free command -> owner advisory-lock `Serializable` 事务内第三 fence 的顺序写入；provider 不在任何事务或锁内。missing/cross-owner 统一 404，非 force 用户 authority 整批 fail-closed，force relation 唯一，rename/move/remove 共用 owner lock；精确同名旧 deck 全量复用，canonical 100 条窗口溢出时 stale。focused `23/23`、Server `2122 passed / 30 skipped`、真实 PostgreSQL E2E `9/9`、Database `7/7`、Server lint/build/diff 通过。该证据证明本地 owner/write fencing；后续 Task 7 才补齐 Organizer runtime、Trace 与 HTTP abort。

Task 7 当前证据：Organizer server-only composition 固定 DeepSeek V4 Pro non-thinking JSON、5000ms、独立 `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`、`1/3500/800` 与 `0.016 CNY` cap；global Live/gate/精确 URL/独立 key/known price 任一不满足都不创建 executor，worker 强制关闭。single 最多一次 candidate，batch 最多 12 个低置信安全目标共享一次 candidate，其余走本地 command；existing/high-confidence/unsafe/owner/stale/default-off/abort 在 provider 前 zero-call。模型结果必须先持久化同一 runId 的 `command_pending` Trace 才能影响 Task 6 command，final 同 runId 原子替换失败时保留 pending，跨 owner 不可替换。HTTP abort 传播到 snapshot/candidate/command preflight，listener 必须清理，事务开始后仅完成最小本地写入。focused `126/126`、真实 PostgreSQL AgentTrace/Organizer E2E `16/16`、Server full `226/226 suites / 2146 passed / 30 skipped`、Agent `529/529`、AI `194/194`、typecheck/lint/build/diff 与两路独立复审通过。该证据只证明静态/Mock/本地数据库 contract，不证明 controlled-Live、Docker API、可见浏览器或语义质量；两个生产 gate 继续默认关闭。

Task 8 当前证据：Organizer API runtime 是 request-level strict contract，只允许 `source=local_deterministic|hybrid_model`、固定 disposition、`degraded` 与可选 persisted `traceId`。`hybrid_model` 只能对应 `candidate_applied + degraded=false + traceId`；正常 gate-off/high-confidence zero-call 为本地非降级，schema/usage/budget/timeout/abort/stale/Trace/runtime 失败为本地降级。single 顶层携带 runtime；batch 只在 request 顶层携带一次，item 不重复泄露模型细节，deterministic remainder 不覆盖 candidate scope 的降级结论。Web API 在成功 envelope 解包后仍执行 strict parse，未知/sensitive 字段 fail-closed。`/error-book` 仅在用户主动 batch 成功后展示“语义整理 / 本地规则 / 安全回退”，degraded 优先；不显示 token、费用、provider error、prompt、Trace ID 或真实 ID 映射，也不提供模型重试或自动 mutation。Types `42/42`、Web `438/438`、Server `2149 passed / 30 skipped` 及 focused/typecheck/lint/build/390/510/1440 静态布局门通过。该证据不授权或证明 controlled-Live、Docker API、可见浏览器或真实语义质量；两个生产 gate 继续默认关闭。

Task 9 当前证据：72-case report 固定 `24` zero-call、`48` runtime、`24` paired indexes 与 `32` Organizer decision units。24 条 zero-call 实际穿过 candidate/preflight guard且独立 executor counter=0；48 runtime 按 pair 并行，任何 throw/schema/usage/质量失败仍留在分母。两次 Mock 均为 `24/24` verified zero-call、`48/48` strict runtime、Tutor/Organizer semantic `1/1`、P95 `246/328/328/276ms`、synthetic usage `21948/5647`、estimated `0.099726 CNY`；`executorProvenance=mock_synthetic`，所以 `quality_gate_failed` 只表示没有 Live authority。公共 Live CLI 不接受注入 executor；测试专用 synthetic executor 固定 `synthetic_test` 并永远不能通过 production gate，只有真实 CLI 自建 executor 才是 `deepseek_network`。focused `14/14`、Agent `543/543`、AI `194/194`、typecheck/lint、两次 Mock CLI、bundle validator 与 diff 门通过。没有读取 key、调用 provider、创建 Live marker/evidence 或执行 Docker/浏览器；两个生产 gate 继续默认关闭。完整证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-paired-eval.md`。

Task 10 当前证据：tracked Docker example 固定 mock/live=false、全部 Agent gate=false、Tutor/Organizer 3000/5000ms 与空 component credential；Compose 只在 `web/server` 分别投影 Tutor/Organizer，`worker/admin` 均不接收，Admin 的整份根 env 注入已移除。静态与 resolved Compose synthetic fixture 同时验证 generic/cross-component key 不会替代目标 credential，worker module 仍强制关闭。新 boundary RED `3/3`、GREEN `3/3`，与 readiness 合跑 `24/24`，Server config/Compose `29/29`、Tutor config `5/5`、tracked `config --quiet`、Server/Web build 均通过。该证据仍不证明 provider、Docker service/API、浏览器或真实语义质量；两个 gate 继续默认关闭。完整证据见 `docs/acceptance/phase-6-9-7-runtime-boundaries.md`。

Task 11 当前证据：focused `97/97`；全量 Agent `543/543`、AI `194/194`、Types `42/42 + tsc --noEmit`、Server `2152 passed / 30 skipped`、Web `438/438`，Organizer PostgreSQL E2E `10/10` 且测试账号残留 0，相关 lint/build、Compose quiet config 与 diff 门通过。未修饰 baseline 保持 `6/48` 与 provider/token/cost=0；fresh Mock run `0c33c01f-802a-4f53-a6e6-538b7af9abc7` 为 `24/24` verified zero-call、`48/48` runtime、Tutor/Organizer/combined semantic `1/1/1`，但 `mock_synthetic` provenance 使 Live-only gate 保持 `quality_gate_failed`。临时 Mock evidence 已精确删除；没有读取 credential、调用 provider、创建 Live marker/evidence 或启动产品 Docker/API/浏览器。两个 gate 继续默认关闭，Task 12 必须获得新的明确授权。完整证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-agents.md`。

Task 12 V1 当前证据：唯一 run `39a62241-0f51-45be-a423-0d13b0b60ae4` 使用 `deepseek_network`、固定 72-case dataset 与 SHA `7ac2f4b5...2207e`。结果为 `24/24` zero-call、`27/48` strict runtime；Tutor semantic `0.3485119048`、绝对提升 `-0.0933547619`，Organizer semantic `0.7000000000`、绝对提升 `0.4218750000`。critical/permission/mutation/broader fallback 均为 0，四个 P95 为 `1359/2640/2641.6812/1360.8845ms`；48 个 usage case 可验证，`21288/3759` tokens、`0.086418 CNY`。最终 `quality_gate_failed`；evidence/marker validator 与 SHA 已通过独立复核。V1 marker/evidence 不得重跑或改写，Docker/API/浏览器不得开始。下一步是零网络 V2 remediation，完整记录见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-controlled-live.md`。

V2 R7 当前证据：唯一 run `67ce18dd-e2ed-4a05-8507-2a98898b8ede` 使用 runner-v2、同一冻结 dataset/SHA、两个 v2 prompt 与 `deepseek_network` provenance。结果为 `24/24` verified zero-call、`0/48` strict runtime；Tutor/Organizer semantic `0/0`、绝对提升 `-0.4418666667/-0.278125`，critical `1`、permission/mutation/broader fallback `0/0/0`，verified usage `0`、pricing/cost 不可验证。48 个 runtime 全为 `fallback_runtime_error`，结构化对象未形成，canonical stage/reason 为 `null/null`；原始异常未保存，因此不能指定单一根因。V2 evidence/marker SHA 与专用 validator 已封存，V2 不得重跑，R8 Docker/API/browser 不得开始。该终态当时只允许零 Provider V3 复盘；后续 R0 设计已完成，见下一段。完整记录见 `docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-controlled-live-failure.md`。

V3 R0 当前证据：源码已经存在固定 Provider failure category/structured stage 并进入 runtime Trace，
但 V2 paired eval result/case builder 未投影这些字段，safe wrapper 又把不同失败统一为
`fallback_runtime_error`；scheduler 也会在首个 failure 后继续余下 pair。V3 设计要求 24 guard
先行、单 pair 最多双并发、首个 runtime contract failure 后打开 `quality_gate_impossible` 并停止后续
派发；未执行 runtime 继续进入 48 分母且 category=null，unknown usage 不冒充零费用。Tutor 与
Organizer 的 executor/credential/budget/abort/failure attribution 独立，崩溃后只能基于 bounded
journal 零网络 seal，不能 resume/replay。R0 未改源码、未读 credential、未调用 Provider；下一步
当时下一步仅 R1 zero-network implementation。完整设计见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v3-remediation-design.md`。

V3 R1 当前证据：新增独立 runner/prompt/runtime-evidence identity，两个 prompt content hash 分别为
`sha256:91be509194de33c8d99d7a09fa6ef387c6f31aa06d19d8fd970800731047fc6a` 与
`sha256:2947cea2a7bc5d64c9daf29d8b371e9825bc0423d707ff173a2c5057ee9fdffd`，继续绑定 V2
深冻结 policy。V3 投影只接受八类 Provider category、三个 structured-output stage、十个单调
`lastCompletedStage` 和固定 execution/usage outcome；delegate-boundary recorder 是
`runtimeInvocations=0|1` 的权威。outer harness 在 dispatch 前失败记录
`0 + absent_not_attempted`，dispatch 后失败记录 `1 + unknown_after_attempt`，统一使用本地
`harness_internal_error` 且不伪装 Provider category。V1/V2 report 的全部 V3 字段继续完全 absent。
新增 config/factory/request/non-thinking response audit/schema/abort synthetic compatibility matrix，
只使用 sentinel/fake fetch；未读取根 `.env`/credential、未调用 Provider、未启动 Docker/API/browser，
也未创建 V3 Live marker/journal/evidence。focused `52/52`、Agent `596/596`、AI `199/199` 与两版
历史 validator 已通过；V1/V2 四个历史 SHA 不变。完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r1-diagnostics-compatibility.md`。该检查点当时下一步仅
R2；后续 R2 已完成。

V3 R2 当前证据：独立 V3 paired scheduler 先完整执行 24 条 guard；guard 失败时 48 条 runtime
保留固定分母且实际零调用。runtime 按 24 个 pair 顺序派发，同 pair 的 Tutor/Organizer 共享质量
结论但不共享 AbortController、预算或故障类别；`(runId,agent,pairedRunIndex)` ledger 阻止重复
dispatch。首个 runtime contract failure 打开 `quality_gate_impossible`，只收口当前 pair 并停止
后续 pair；未执行 case 为 `not_started_quality_breaker`。sibling 忽略 abort 时在 1000ms 有界窗口后
记录为 orphaned/unknown usage，不复制另一 lane 的 Provider category。semantic-only mismatch 不提前
熔断；schema/usage/abort/harness failure、预算串用、P95/usage/价格不完整与 summary 篡改均
fail-closed。focused `29/29`、Agent `608/608`、AI `199/199`、两版 validator、四个历史 SHA 与
V3 Live artifact=0 检查通过；没有读取 credential、调用 Provider、启动 Docker/API/browser 或创建
Live artifact。完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r2-breaker-lane-ledger.md`。该检查点当时下一步仅 R3
独立 CLI/journal/crash-only seal/evidence；后续 R3 已完成。

V3 R3 当前证据：V3 CLI、确认词、授权变量、marker、journal、evidence prefix 与 validator 已与
V1/V2 双向隔离。marker `wx` 后、executor 创建前先 fsync journal 初始化；每个
`dispatch_started` 也必须先 fsync。append-only JSONL 以 sequence/previous SHA/record SHA 验证
guard、dispatch、runtime/pair terminal、breaker、run complete 与 seal 状态机。活 marker owner
不能被误封；死 owner 由 token recovery claim 单胜者接管，同 claim 只允许一个 appender，takeover
后旧 appender 被 fence；release 防护依赖单主机 PID liveness，不冒充跨主机或 false-liveness 下的
原子 lease。dispatch 无 terminal 保守封存为
`attempted_orphaned/unknown_after_attempt`，从未 dispatch 为
`not_started_orphaned/absent_not_attempted`，永不 resume/replay/retry。evidence 使用随机 temp
`wx` + fsync + hard-link final，same bytes 幂等，不同 bytes 拒绝覆盖。durability `21/21` tests、
`228 expect()`，V3 focused `50/50`、Agent `629/629`、AI `199/199`、V1/V2 validator 与四个历史 SHA 通过，V3 Live
artifact=0。没有读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据。证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r3-crash-safe-evidence.md`。该检查点当时下一步仅 R4；
后续 R4 已完成。

V3 R4 当前证据：fresh Mock run `116cc321-962f-426c-8a91-f05ab8debc93` 为 `24/24`
zero-call、`48/48` strict runtime、Tutor/Organizer/combined semantic `1/1/1`、P95
`246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`，V3 validator 通过；Mock
按 Live-only authority 仍为 `quality_gate_failed`，evidence 已精确删除。首对 strict failure 的
breaker report 只启动两个 lane，余下 46 runtime 为 0-call 且固定分母仍为 48。V3 focused
`50/50`、Agent `629/629`、AI `199/199`、Types `42/42`、Server `2154` tests、Web
`439/439`、Organizer PostgreSQL E2E `12/12`、Compose quiet 与相关 typecheck/lint/build 通过；
测试账号残留为 0。V1/V2 四 SHA 与 validator 不变，V3 Live artifact=0、tracked gates=false、
component credential empty。没有读取根 `.env`/key、调用 Provider、启动产品 API/browser 或开始
Task 13/main。证据见
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-r4-static-mock.md`。R4 当时必须停在新的 V3
branch controlled-Live 精确授权门；后续 R5 已完成并失败封存。

V3 R5 当前证据：唯一 run `ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc` 为 `24/24` guard
zero-call；Tutor/Organizer 各启动 14 个 runtime，28 个 usage 全部 verified。Organizer
`organizer-runtime-14` 的结构化对象在本地 `dynamic_contract` 命中
`subject_authority_violation`，首错 breaker 保留固定 48 分母并让剩余 20 个 runtime 不启动。
最终 strict runtime `27/48`，Tutor/Organizer/combined semantic
`0.5280555556/0.4376201923/0.4828378739`，P95/pricing/total CNY 因不完整而 fail-closed，gate 为
`quality_gate_failed`。没有 Provider failure category、critical、permission、mutation 或 broader
fallback；这证明安全降级和 durable evidence 生效，但不能证明产品模型路径可用。V3
marker/journal/evidence 已封存且 validator 通过，不得重跑或进入 R6--R9。证据见
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-controlled-live-failure.md`。

V4 R0 当前证据：Tutor 前 14 个已执行 runtime 全部 strict/usage verified，三个可见语义偏差为
两个 `socratic_hint -> general_follow_up` 和一个 `step_check -> general_follow_up`；报告中的 10 个
invalid case 是 breaker 后未执行项。Organizer 前 14 个 bounded decision 的 subject/action 相对
稳定，但 accepted topic 仅 `5/14`、required evidence 全满足 `10/14`，且 7 个使用
`insufficient_signal`。`organizer-runtime-14` 只可确认 raw schema 后在本地 subject authority
dynamic contract 失败；evidence 没有 raw model/provider output，因此不得推断模型原始字段、网络或
Provider 根因。

V4 冻结 Tutor primary-signal precedence、Organizer subject/deck/topic/evidence/confidence 矩阵、
prompt/validator/merger/fixture 单一规则源、V4-only bounded reason 与独立 held-out/metamorphic/
prompt-leakage。V1/V2/V3 历史、dataset/SHA/baseline/门槛/分母、权限、预算、no-retry 与 V3
breaker/durable seal 原则不变。R1--R5 只做 zero-network/static/Mock；R5 后必须重新取得精确 V4
Live 授权。完整设计与 R0 验收见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v4-remediation-design.md`、
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r0-zero-provider-postmortem.md`。

V4 R1 当前证据：独立 `phase-6.9.7-v4-bounded-diagnostics-v1` 把 case 互斥分类为
not-started、contract failure、semantic mismatch 或 semantic match。未执行项只允许
`case_guard / quality_breaker / parent_abort / orphaned`；合同失败必须记录
provider/schema/dynamic/merger/usage/latency/safety stage，不能冒充语义错误。Tutor 只记录
intent/depth/evidence/context/guiding/final-answer/structure 七个布尔轴与 nullable primary-evidence
suppression；Organizer 只记录 subject/deck/topic/evidence/confidence 五轴。

Organizer validator 使用唯一 `context/index -> subject -> deck -> topic -> evidence -> confidence`
顺序和固定 reason。Legacy API 只映射同一结果，产品 candidate 将成功 validation 直接交给 merger；
merger 仍只重建本地 ID/name/write authority，不补 evidence、不修正 subject、不清洗 topic。72-case
report 从 entry 重算 stage/axis/reason aggregate，拒绝重复、篡改、跨 agent 与 guard/runtime 错配；
V1/V2/V3 V4 字段 absent、双向 validator 严格隔离且 synthetic SHA 不变。Agent `635/635`、
typecheck/lint 通过；未读取 credential、调用 Provider、创建 V4 Live artifact 或启动产品验收。后续
R2 已完成，完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r1-bounded-diagnostics.md`。

V4 R2 当前证据：`tutor-model-candidate-v4` 使用深冻结 intent/evidence/depth/local-strategy policy。
prompt formatter、validator、evidence precedence resolver、depth compatibility、candidate merger 与
`buildTutorStrategyFromIntent` 的 context/guiding/final-answer/answer-structure 都从该 authority 派生。
`general_follow_up` 只能由 contextual/ambiguous 且无具体 primary signal 支撑；merger 拒绝将本地具体
intent 降级到更低 precedence。`answer_direct`、最终回答内容、route/tool/permission/write 仍不是模型
能力；中英文否定式 final-answer 表达不获取 direct-answer 权限。

V4 model precedence 不重排冻结 deterministic detector；历史 paired eval 显式使用 V2 policy，因此
baseline `6/48`、Tutor semantic `0.4418666667` 与 V3 Tutor prompt SHA 均不变。R2 未读取
credential、调用 Provider、创建 V4 runner/Live artifact、启动 Docker/API/browser 或修改业务数据。
该检查点当时下一步仅 R3 Organizer policy，后续已完成；完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r2-tutor-semantics.md`。

V4 R3 当前证据：`wrong-question-organizer-model-candidate-v4` 使用深冻结
subject/deck/topic/evidence/confidence policy。Known subject 强制 `keep_local + structured_subject`；
unknown subject 禁止 `keep_local`；reuse 只能引用同学科 ordinal deck 并要求 overlap evidence，create
必须生成安全精确 topic。`semantic_topic`、`error_pattern`、`insufficient_signal` 与 high-confidence
支撑边界由同一 policy 校验，merger 不修复非法输出。

owner、ordinal、locked-name、前后 stale fence、single call、独立预算、abort/no-retry 均未放宽。
历史 paired eval 显式使用 Organizer V2 candidate，V2 formatter SHA、V3 Organizer prompt SHA、冻结
dataset/baseline 与 V1/V2/V3 artifacts 保持不变。R3 未读取 credential、调用 Provider、创建 V4
runner/Live artifact、启动 Docker/API/browser 或修改业务数据。该检查点当时下一步仅 R4，后续已完成；完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r3-organizer-semantics.md`。

V4 R4 当前证据：独立 `phase-6.9.7-v4-independent-robustness-v1` fixture 不读取或复制冻结
72-case expected/accepted-label authority。Tutor 覆盖中英/混合改写、否定、干扰、active-context
reorder 与 primary-signal conflict；Organizer 覆盖 authority drift、question/deck reorder、locked name、
cross-subject/ordinal/topic/evidence/confidence/schema-negative。实际 V4 candidate prompt 已扫描 case ID、
expected、accepted-label 与 oracle 泄漏；两 lane abort/预算保持隔离，single-call/no-retry/write
authority 不变。

R4 新增独立 V4 runner/report/evidence envelope、CLI/validator，以及 marker/journal/recovery/evidence
durability。固定 72/24/48、guard-first、single dispatch、首错 breaker、dispatch-before-call fsync、
hash-chain、活 owner 拒绝恢复、recovery claim ABA fence、zero-network orphan seal、hard-link evidence
和 same-byte idempotency 均有回归；跨版本、乱序、篡改和 different-byte publish 均 fail-closed。V4
Live CLI 在 R6 前硬返回 `live_not_available_before_r6`。

V4 durability `6/6`（`41 expect()`）、R4/V3 focused `68/68`（`548 expect()`）、Agent full
`674/674`（`7094 expect()`）、typecheck/lint 通过；V1/V2/V3 validator 与七个历史 SHA 不变。
本轮未读取 credential、调用 Provider、启动 Docker/API/browser、创建 V4 Live artifact 或修改业务数据。
该检查点当时下一步仅 R5 static/Mock checkpoint 与独立终审，后续已完成；R5 当时仍须新的精确
一次性 V4 Live 授权，后续唯一 R6 已失败封存。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r4-robustness-lineage.md`。

V4 R5 当前证据：fresh Mock run `c1bdf998-6fae-4c32-a4e3-bd6bea053454` 为 `24/24` verified
zero-call、`48/48` strict runtime、Tutor/Organizer/combined semantic `1/1/1`，P95
`246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`；V4 validator 通过。
`mock_synthetic` 不能冒充 `deepseek_network`，所以 Live-only gate 按设计保持
`quality_gate_failed`。唯一 Mock evidence 已精确删除，V4 marker/journal/recovery/evidence 为 0。

V4/V3 focused `68/68`、Agent `674/674`、AI `199/199`、Types `42/42`、Server `2154 passed / 30
skipped`、Web `439/439`、Organizer PostgreSQL E2E `12/12`、Compose default-off 与相关
typecheck/lint/build 均通过；测试账号残留为 0，tracked gates=false、component credential example
empty，V1/V2/V3 validators 与七个历史 SHA 不变。未读取根 `.env`/credential、调用 Provider、启动
产品 Docker/API/browser 或修改业务数据。该条是 R5 当时停止在 R6 授权门前的 checkpoint；后续唯一
R6 已失败封存。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r5-static-mock.md`。

V4 R6 当前证据：唯一 run `0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` 为 `24/24` guard verified
zero-call、6 对 dispatched/completed、12 executor started、`10/48` strict runtime。第 6 对 Tutor 的
raw schema 有效，但在本地 `dynamic_contract` 命中 `invalid_evidence_association`；Organizer sibling
为 `attempted_aborted / unknown_after_attempt`，剩余 36 runtime 为
`not_started_quality_breaker`。Tutor/Organizer/combined semantic 为
`0.14410714285714285/0.10372596153846154/0.1239165521978022`；安全与 Provider failure counts 均为 0。

11 个 verified usage 合计 `9445/652` tokens，可核验部分费用 `0.032247 CNY`；另 1 个 usage unknown，
所以完整 pricing/total CNY 与 P95 必须保持 `null`。Evidence、58 条 hash-chain journal 与 marker
authority 已 durable seal，file/bundle validator 通过，V1/V2/V3 历史 validator/SHA 不变。R6 没有启动
产品 Docker/API/browser 或创建 synthetic 产品数据，tracked defaults 保持关闭。V4 不得重跑；R7--R9、
Task 13/main、Phase 6.10 与博客收尾不得开始。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-controlled-live-failure.md`。

V5 R0 当前证据：冻结 V1 `tutor-runtime-06` 的中文代数 latest text 与英文微积分 active context
跨题组合，language tag 还被按数组奇偶误标为 `en`。Exact input 的零网络差分回归为
`7 pass / 0 fail / 34 expect()`：合法 `submitted_step` 在产品 candidate 得到
`candidate_applied`；缺 primary 或使用错误 evidence 才由同一 candidate 返回
`fallback_schema_invalid / invalid_evidence_association`；canonical diagnostic 只是如实映射为
`dynamic_contract`。

V4 前 5 对的 bounded evidence 仍显示 3 个中文 hint 全部被判为 `general_follow_up`、两个英文 hint
均命中；Organizer canonical topic 只命中 `2/5`，并有一次 `major -> computer`。因此 V5 必须使用
新 dataset identity，同时修复双语 Tutor 选择和 Organizer topic/taxonomy。设计冻结为：Tutor 的
evidence/eligible-intent 由本地 projection 掌权，模型只返回 intent/depth/confidence；Organizer 由本地
生成 topic/deck shortlist，模型只选择 ordinal。两者仍无最终回答、route/tool/permission 或数据库写
权限。R1 只创建新 V2 dataset/coherence validator；当前无 V5 Live 授权。证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r0-zero-provider-root-cause.md`。

V5 R1 当前证据：独立 `phase-6.9-tutor-wrong-question-v2` dataset SHA 为
`42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b`，保持 V1
dataset/SHA 不变。新数据固定 72 cases、24 guard、48 runtime、24 paired requests，Tutor/Organizer
各 `12 guard + 24 runtime`，Organizer 共 32 decision units。Tutor runtime 显式绑定 language、
exercise family、latest text 与同题 active context，语言配额为 `12 zh / 10 en / 2 mixed`；Organizer
显式绑定 structured/taxonomy subject authority、三个稳定 topic candidates 与
single/same-subject/cross-subject batch relation。Coherence 在模块加载时对 paired index、语言/题族/
context、subject、topic ordinal 和 batch relation fail-fast。

Prompt-safe projection 不导出 expected/canonical/accepted oracle、selected topic ordinal、case/owner/
question/deck ID 或 V1 identity。冻结 policy `phase-6.9.7-v5-eval-policy-v1` SHA 为
`b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d`：两个 lane 与 combined
semantic 均须 `>=0.85`，Tutor/Organizer 各自 absolute improvement `>=0.15`，并要求
`24/24` guard、`48/48` strict runtime、安全/Provider/权限/mutation/broader fallback 全 0、完整
usage/P95/pricing 与 `0 < CNY <= 0.55`；缺失聚合只能为 `null` 并关闭质量门。

新 deterministic baseline SHA 为
`0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca`：complete
`12/48`、failed `36/48`，Tutor/Organizer/combined semantic 为
`0.6629642857142858/0.278125/0.4705446428571429`，Provider/input/output/cost 均为 0；重复运行结果
byte-equivalent。R1 当时未实现 V5 candidate/paired Mock/Live runner/network CLI，未读取 credential、
调用 Provider、启动 Docker/API/browser 或修改业务数据；后续 R2/R3 已完成。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r1-dataset-authority.md`。

V5 R2 当前证据：`tutor-local-signal-authority-v1` 只从 latest text 派生 primary/negated signals，
precedence 为 `step > explain > concept > hint > general`；active context 只能影响 availability/depth，
不能创建或提升具体 intent。Rules/prompt/held-out SHA 分别为 `a1e9a3b...f4892`、
`7c7442ff...c5f87`、`d08e8ed5...8ab55`。模型 strict schema 只允许
`intent/depth/confidence`，validator 以 local authority 校验 eligible intent/depth，具体 primary 不得降级
为 general；merger 在本地重建 TutorStrategy，answer/route/tool/permission/write 权限均未扩大。

32 条独立 held-out 固定 `13 zh / 12 en / 7 mixed`，覆盖否定、引用 distractor、冲突 precedence、
context 删除/空值/重排/噪声/单变量 mutation、schema/authority 伪造、zero-call、single-call/no-retry、
usage/abort、安全与实际 prompt leakage；冻结 V2 Tutor runtime detector 对照 `24/24`。R2 聚焦
`12/12`、Agent 全量 `702/702`，typecheck/lint/Prettier 与 V1--V4 四个历史 validator 通过，两路终审
无 Critical/Important。

R2 仍未接 product/provider/gate/paired runner，未读取 credential、调用 Provider、启动
Docker/API/browser 或修改业务数据；该检查点当时的下一步 R3 已完成。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r2-tutor-local-signal-authority.md`。

V5 R3 当前证据：`wrong-question-organizer-shortlist-v5` 在本地稳定排序/去重 question、deck、topic；
同 subject/规范化名称的 duplicate deck 以最低 ID 为解析 authority，完整 folded ID 仍进入 fingerprint。
Rules/prompt/held-out SHA 分别为 `9747383...1299d3`、`915084a8...ac69ab`、
`49336b12...ee097`。Fingerprint 绑定 owner/snapshot 与完整 question/deck/topic 序列；模型 strict
schema 只允许 subject/deck/topic ordinal 与 confidence，本地 validator/merger 保留真实 ID、locked
name、command binding 和全部写权限。

24 条独立 held-out 固定 `8 zh / 8 en / 8 mixed`，覆盖 32 个冻结 V2 Organizer decision、structured/
taxonomy subject、same/cross-subject batch、locked name、duplicate deck folding、reorder/分页/去重/ABA/
stale、strict schema、zero-call、single-call/no-retry、输入不变与实际 prompt leakage。R3 聚焦
`13/13`、Agent 全量 `715/715`，typecheck/lint/Prettier 与 V1--V4 四个历史 validator 通过。两路终审
无 Critical；预算复审项经 runtime 源码复核为 preview/actual reservation 的正确分层，并已加回归。

R3 仍未接 product/provider/gate/paired runner/Trace persistence，未读取 credential、调用 Provider、
启动 Docker/API/browser 或修改业务数据。该检查点当时的下一步 V5 R4 已完成。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r3-organizer-ordinal-shortlist.md`。

V5 R4 当前证据：原生 `phase-6.9.7-tutor-organizer-runner-v5` report/runner/CLI/marker/hash-chain
journal/hard-link evidence/validator 已完成。分母固定为 `72/24/48/24/32`；24 guard 先行，runtime
按单 pair 调度，pair 内最多双 lane，首个 contract failure 后熔断。Report 从 case entries 重算
identity、decision units、semantic、usage、safety、latency 与 gate；任何不完整 usage/latency/semantic
聚合都为 `null`。

Dispatch journal 在 lane/Provider 前 append+fsync。Marker/journal/evidence 失败消费一次性名额；活
owner 不得误封，dead owner 只允许单胜者 recovery，ABA/tail drift/重复 dispatch/post-seal/different
bytes 均 fail-closed。Recovery 只 seal orphan/unknown usage，不 resume/replay/retry。V5 与 V1--V4
validator 双向隔离；`synthetic_test` Live 固定失败，只有 `deepseek_network` provenance 才可能成为
质量 authority。

R4 focused `26/26`（145 assertions）、Agent full `741/741`（9128 assertions）、Agent
typecheck/lint、Web/Server lint、Prettier、diff check、四份历史 evidence SHA/validator 与两路只读终审
均通过。R4 未读取 `.env`/credential、调用 Provider、接 product composition/gate/Trace persistence、
启动 Docker/API/browser、修改业务数据或创建 V5 Live artifact。该检查点当时的下一步 V5 R5 已完成；
完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r4-runner-lineage.md`。

V5 R5 当前证据：正式源码新增 reviewed Mock factory 和公开入口；CLI Mock 真实经过两条 V5
candidate、validator 与 local merger，Live 无显式 factory 继续 fail-closed。Fresh baseline 为 `12/48`、
semantic `0.6629642857/0.278125/0.4705446429`；fresh Mock 为 `24/24` zero-call、`48/48` strict
runtime、semantic `1/1/1`，gate 为 `mock_quality_not_evidence`。48 次 invocation 是 synthetic Mock
计数，不是真实 Provider call。

V5 focused `62/62`（1570 assertions）、Agent `745/745`、AI `199/199`、Types `42/42`、Server boundary `3/3`、Web
`439/439`、Organizer PostgreSQL `12/12`、Compose default-off、V1--V4 SHA/validator、V5 artifact=0
与两路终审通过。本轮未读取 `.env`/credential、调用 Provider、接产品 gate、启动 Docker/API/browser
或修改业务数据。该段是 R5 当时的 zero-provider checkpoint；后续唯一 R6 结果见下段。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r5-static-mock.md`。

V5 R6 当前证据：唯一 run `aa637d3a-f7c4-4549-a724-9cdbefdd89c8` 使用 `deepseek_network`，
`24/24` guard verified zero-call，前 6 对启动 12 次 Provider 调用并得到 `11/48` strict
runtime。第 6 对 Tutor `tutor-v2-runtime-06` 在 `3021ms` 越过冻结的 `3000ms` timeout，记录
`runtime_timeout` 并触发 breaker；同对 Organizer strict success，后续 36 runtime 未启动。Safety、
permission、mutation、broader fallback 与 Provider failure 均为 0，最终 `quality_gate_failed`。

因为 runtime 分母不完整，Tutor/Organizer/combined semantic、四类 P95、aggregate input/output/CNY
均必须为 `null`。11 条 verified entry 的 `9761/902 tokens`、`0.034695 CNY` 与 Tutor `0.9`、
Organizer `0.7083333333` executed-subset axis mean 只用于诊断，不是正式质量/费用聚合。Evidence SHA 为
`84487b448acd7bd5e65cd523eb7556cd9b3175bc9ba44572e06a78157c45b70a`；marker、58 条 journal 与
evidence 已 seal，validator `ok=true`，无 recovery claim。R6 不得重跑，也不得进入 R7、产品
Docker/API/browser、Task 13/main、Phase 6.10、Phase 8/9 或博客收尾。完整证据见
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v5-controlled-live-failure.md`。

V6 R0--R5 当前边界：V5 evidence 只读复盘确认 `3000ms` 是 executor hard timeout，而非 Tutor
`2500ms` candidate P95。V6 eval policy 已冻结 hard timeout `3500ms`，但所有 P95、semantic、安全、
固定分母、usage/cost complete-only 与 no-retry 门均不降低。Organizer 继续 `5000/4500ms`；
nearest-rank P95 的四类 gate 均必须恰好 24 个样本并固定取升序第 23 个值。任一 lane 缺 terminal、
timeout、NaN 或越界时，四个 P95 同时为 `null`，不得删除慢样本后继续计算。

V6 的 AI ownership source contracts 也已冻结：Tutor 模型继续在本地 eligible intents 中做真实选择，preferred depth
与最终教学策略由本地 authority 重建；Organizer 模型继续选择 subject/deck/topic ordinal，confidence
由本地 evidence authority 重建。报告必须让 Tutor intent 在固定 24 case 上至少 exact-match
`21/24`，Organizer subject action/ordinal、deck action、target ordinal 在固定 32 decision units 上
分别至少 exact-match `28/32`；不能用本地派生字段掩盖模型质量。V2 dataset/expected 不修改，不根据
V5 前 11 条局部结果写 case 特例。

R2 已实现 package 级 bounded candidates。Tutor 只返回 eligible `intentIndex`，本地重建 preferred
depth 与完整教学策略；Organizer 只返回 actual shortlist fingerprint 与 subject/deck/topic ordinal，
runtime 前后重新派生 owner shortlist，stale/ABA/locked-name/ordinal 违规整批 fail-closed，本地重建
confidence、真实 ID、名称、说明与 command binding。公共 merger 会重新验证 raw ordinal decision，
hostile accessor 不被调用。focused `24/24`、Agent full `792/792`、typecheck/lint 与独立复审通过。

R3 已新增独立 V6 report/runner/CLI/approval/marker/hash-chain journal/hard-link evidence/recovery/
validator。固定 `72/24/48/24/32` 分母、guard-first、pair 串行/双 lane、首 runtime contract failure
breaker、deadline overshoot、usage unknown 与 incomplete aggregate 全 `null` 已冻结；synthetic Live
强制失败，V1--V5 lineage 双向隔离。R4 又发布 reviewed Mock factory，fresh baseline 保持 `12/48`，
fresh Mock 为 `24/24` zero-call、`48/48` strict runtime、semantic/model-owned `1/1/1`，report gate
固定 `mock_quality_not_evidence`。R4 当时 Mock evidence 已精确删除，V6 Live artifact 为 0；后续唯一 R5
已失败封存。

R4 没有产品 runtime factory/composition 或产品验收；`3500ms` 也尚未接入产品 executor。唯一 R5
branch controlled-Live run `b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8` 随后完成 `24/24` guard
zero-call，但首对 Tutor 为 `provider_runtime / unknown`、Organizer sibling aborted，最终 2 次 Provider
invocation、`0/48` strict runtime，正式 semantic/P95/token/CNY 全 `null`，gate
`quality_gate_failed`。Evidence/marker/journal 已 seal，validator `ok=true`，无 recovery claim；脱敏证据
不能唯一确定 credential/HTTP/网络/SDK/Provider 根因。V6 一次性授权已消费，不得重跑、额外探测或进入
R6/R7/main。R3 的无父目录 fsync、claim tail 延后复核、缺 stale-rename 后二次崩溃专测三项
durability 边界仍保留。完整证据见
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r0-zero-provider-design.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r1-source-contracts.md`、
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r2-bounded-candidates.md`、
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r3-runner-lineage.md` 与
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r4-static-mock.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v6-controlled-live-failure.md`。

V7 R0--R3 只解决 V6 暴露出的诊断盲区、durable evidence 与 zero-network compatibility 边界，不改变语义质量合同。V6 runner 的 `dispatch_started` 位于 harness
operation 前，candidate recorder 又位于 executor 边界；两者都不能证明 HTTP 已发出、DeepSeek 已接收
或 response 已返回。当前 AI SDK adapter 只识别官方 error markers，V4 Pro middleware generic request/
response 拒绝与其它未分类异常可能统一成为 `unknown`。R0 因此不猜 key/HTTP/网络/SDK/模型根因。

V7 R1/R2 已实现以下 transport 与 runner contract；R3 已用完整 fault matrix 和 reviewed Mock 验证：

- 第一方 `deepseek-v4-pro` direct adapter 固定 exact endpoint、non-thinking、JSON-object、no tools/retry；
- 每个 runtime 只允许单调
  `executor_entered -> request_validated -> provider_dispatch_started -> provider_response_received ->
response_audit_passed -> content_parsed -> schema_validated -> usage_validated` 前缀；
- executor invocation、provider dispatch、provider response、verified usage 必须分别由 journal/report 重算；
- dispatch event 在 fetch delegate 前 append + fsync，hook 失败必须保持 delegate 0-call；
- failure 只使用 request/transport/HTTP/audit/invalid-response/structured-output/usage/abort/timeout/
  harness/unknown 固定枚举，不保存 error/body/header/prompt/output/key；
- HTTP response 只证明客户端收到 response，dispatch 也不证明 Provider receipt、模型成功或账单；
- R3 使用真实 V6 schema/projection/prompt/strict schema/merger 和全部 48 runtime 做 zero-network fault
  matrix；预期 transport/HTTP/response/schema/usage faults 没有落入非预期 `unknown`，stage/counter 与
  no-leak 门通过；
- V7 R4 冻结的 Live 合同要求 `24/24` guard、`48/48` strict、原 V6 semantic/model-owned/P95/usage/CNY 全门通过，
  另要求 48 executor、48 dispatch、48 response、48 verified usage；任一 incomplete lane 时正式 aggregate
  全部为 `null`。

R2 已把上述能力接入独立 V7 report/runner/CLI/approval、一次性 marker、dispatch-before-call hash-chain
journal、hard-link evidence、crash-only recovery 与 strict validator：

- 固定 `72/24/48/24/32` 分母、guard-first、pair 串行、pair 内最多双 lane、single dispatch/no retry；
- 首个 runtime contract failure 收口当前 pair 并打开 `quality_gate_impossible`，后续 runtime 不启动但不从
  48 分母删除；
- 成功 lane 必须具有完整 8-stage 前缀、`usageDisposition=verified` 与四类 `1/1/1/1` wire counter；
- recovery 只 seal durable prefix，不创建 adapter、不读取 key、不 resume/replay/retry/backfill Provider；
- V1--V6 artifact identity、错误 provenance/aggregate、unknown/cross-lane dispatch key 与跨仓库 evidence
  根路径均 fail-closed；
- synthetic Live 永远不能打开生产门；R3 默认 Mock factory 的 provenance 固定为 `mock_synthetic` /
  `synthetic_test`，即使满分也只能得到 `mock_quality_not_evidence`。

R1 的 `first-party-deepseek-v4-pro-direct-v1` 固定 exact endpoint/model、non-thinking JSON-object、
`stream=false` 与 no tools/retry；默认 delegate 才有 production provenance，注入 delegate 永久为
`synthetic_test`。Opaque capability 只能 claim 一次；串行 reducer、first-terminal-wins、late
response/rejection/abort drain、异常 HTTP/status/body、failure projection、no-leak 和 V6 Tutor/Organizer
schema/prompt SHA compatibility 已通过 focused `66/66`、Agent `830/830`、AI `224/224` 与静态门。

R3 fresh baseline 保持 `12/48` 与 `0.6629642857/0.278125/0.4705446429`。Reviewed Mock run
`e09baa4a-6f48-41c3-bb48-607a72c300df` 为 `24/24` guard zero-call、`48/48` strict runtime、
semantic/model-owned `1/1/1`、executor/dispatch/response/verified usage `48/48/48/48`，gate
`mock_quality_not_evidence`。V7 focused `28/28`、Agent `856/856`、AI `224/224`、Types
`42/42 + tsc`、Server `2154 passed / 30 skipped`、Web `439/439`、PostgreSQL `12/12`、Compose
default-off、V1--V6 validators/SHA 与终审通过；Mock evidence 已精确删除。以上是 R3 当时的
zero-provider checkpoint，V7 Live artifact 当时为 0。R0--R3 均未读取 credential、调用 Provider、启动
产品 Docker/API/browser、执行 V7 Live 或接产品 composition。R2/R3 只有文件 fsync、没有父目录
fsync；单机 PID/file fencing 不是跨主机 lease，不证明突然断电后的目录项持久性或 Provider
exactly-once。

V7 R4 随后已在用户重新接受运行时 DeepSeek 数据边界并精确授权后执行唯一 controlled-Live。Run
`81529c2c-79f5-4c21-9cee-e536a2fe78e3` 为 `24/24` guard zero-call；首对 Tutor 完成完整 8-stage
wire 并成为 `candidate_applied`，Organizer 收到 response、通过 audit 且完成 `content_parsed`，但在
`provider_type_validation` 失败。Runner 打开 `quality_gate_impossible` breaker，后续 46 runtime 未
启动；最终 executor/dispatch/response/verified usage 为 `2/2/2/1`、strict runtime 为 `1/48`，正式
semantic/P95/token/CNY 全部 `null`，gate 为 `quality_gate_failed`。该脱敏证据只能定位到正式类型/
动态合同阶段，不能唯一归因 credential、网络、HTTP、endpoint、请求形状、模型或 Provider 内部行为。

V7 一次性名额已经消费，marker/journal/evidence 已 seal 且 bundle validator 为
`ok=true / filesChecked=1`；禁止 retry/resume/replay/backfill、seal/recovery、单 case/curl 或产品 API
探测。R5 产品验收、R6/Task 13/main、Phase 6.9.8、Phase 6.10、Phase 8/9 与博客收尾均被阻断；下一
原子任务只能建立新的独立 zero-provider 根因复盘与 remediation 设计。

V8 R0 已完成该复盘与设计。它没有从脱敏 V7 evidence 猜测具体字段，而是确认 Provider
`json_object` 不执行本地 Zod、V6 Organizer static schema 使用 nested conditional union、V7 ideal Mock
未覆盖 Provider shape drift。V8 冻结始终同形的
`questionIndex/subjectIndex/deckAction/targetIndex` decision、本地 dynamic authority、bounded
reason/count/type-shape diagnostic、Provider-like schema-negative/metamorphic/held-out/anti-overfit matrix
与独立 R1--R7 lineage。R0 没有实现源码、runner、Mock/Live 或产品 wiring。

V8 R1 已实现上述固定 Shape。模型只能返回 fingerprint 与四字段 decision；静态 schema 严格拒绝
coercion、wrapper、额外字段和旧 nested V6 shape，动态 validator 再按实际 shortlist 校验 question/
subject/deck/topic ordinal，合法值才转换为 V6 validated decision 并复用原 merger。Contract SHA 为
`b21a6dd357ecc19e87869541c7ae6cb52adff130ce32173fd8422ad2f6506545`，prompt SHA 为
`9b85b0a9a310f128d35250e83b3927df8de87f159dac8aac8f412d1189ca6af9`。Adapter 保留 V6
`1/3500/800` 预算、usage/Trace/abort 与双 stale fence；本地 fingerprint、真实 ID、locked name、
confidence 和写权限不变。Bounded diagnostic 只保存固定 reason、计数、类型/shape hash 与
`rawDataRetained=false`，不保存原始值、未知字段名、prompt/output/error/credential。R1 focused
`20/20`、Agent/AI typecheck/lint、Prettier 和历史 sealed evidence validators 已通过，全程 zero-provider。

V8 R2 已冻结独立 held-out/Provider-like/metamorphic fixture，SHA 为
`sha256:f0a93a83000cb1f3515057482eca7ebbbb0ce0ef441cfd1cb7075073e000793f`。Fixture 不读取
V2 expected/oracle，也不调用 production validator/candidate/merger 生成答案；进程内 synthetic fetch 穿过
真实第一方 direct adapter、ModelAgentRuntime、V8 candidate 与 V6 local merger。V8 schema identity 只接受
完整原生 JSON content，Markdown fence/prose/BOM/trailing comma/single quote 在 schema 前拒绝；V7/历史
schema 的 exact fence 兼容保持不变。矩阵覆盖 wrapper、旧 V6 Shape、snake_case/type drift、静态畸形
decision 首/中/尾、Unicode/reorder、动态 subject/deck/topic authority、pre/post stale fence、cycle/Proxy/wide
no-leak。Focused `24/24`、Agent `878/878`、AI `226/226` 与历史 validators/独立复审通过，全程
zero-provider。

V8 R3 已建立独立 runner/report/CLI/approval/marker/journal/evidence/recovery/validator identity，固定
`72/24/48/24/32`、guard-first、pair 串行、single dispatch/no retry 与 V1--V7 双向 lineage。V8 schema
remediation 不改变 transport，所以明确复用 V7 8-stage wire；source manifest 同时绑定该 wire version、V8
fixed-shape/prompt/diagnostic SHA 与 V6 dataset/semantic authority。Organizer static type failure 或 dynamic
authority failure 必须携带 bounded diagnostic；guard、未启动、纯 transport/abort failure 保持 `null`，不得
猜测字段原因。完成态 recovery 会按 journal breaker 重建 `not_started_case_guard` 或
`not_started_quality_breaker`，只有未完成 crash 才使用 orphan。R3 全程 zero-provider，正式 V8 artifact=0。

V8 R4 已把默认 Mock CLI 接到 reviewed factory。Tutor 复用未变化的 V7/V6 candidate；Organizer 穿过
V8 fixed-shape candidate、动态 authority、V6 merger 与第一方 direct adapter，只有 fetch delegate 为
进程内 synthetic responder。Responder 只读实际 bounded prompt，不读取 expected/oracle、真实 ID 或写
command。Fresh baseline 保持 `12/48`；reviewed Mock run `c8635a6a-0fbe-4d03-a7c9-9dd41c612d7c`
为 `24/24` guard、`48/48` strict、semantic/model-owned `1/1/1`、wire `48/48/48/48`，gate
`mock_quality_not_evidence`。V6 nested/extra/missing/type/null 与动态 authority drift 均 fail-closed，并只
留下 bounded no-raw diagnostic。全量静态、PostgreSQL `12/12`、Compose default-off、V1--V7
validators 与 artifact=0 通过；Mock evidence 已精确删除。未读取 credential、调用 Provider 或启动产品
Docker/API/browser。

V8 R5 唯一 run `7ff09c36-50f2-445a-b309-dc9500e5e13c` 已失败封存。它保持 `24/24` guard
zero-call，执行前两对共 4 个 runtime；两个 Tutor 与第一条 Organizer 为 `candidate_applied`。第二条
Organizer 已完成 `executor_entered -> request_validated -> provider_dispatch_started ->
provider_response_received -> response_audit_passed -> content_parsed -> schema_validated ->
usage_validated`，但在 V8 static schema 之后的本地 dynamic shortlist authority 成为
`fallback_schema_invalid / dynamic_contract`。Bounded diagnostic 只保存 `dynamic_authority`、shape hash 与
`rawDataRetained=false`，不能恢复具体 subject/deck/topic ordinal。

最终 wire 为 `4/4/4/4`、strict runtime `3/48`；后续 44 runtime 为
`not_started_quality_breaker`。Semantic/P95/aggregate token/CNY 全 `null`，safety/provider/permission/
mutation/broader fallback 均为 0，gate `quality_gate_failed`。Evidence/marker/journal 已 durable seal，bundle
validator `ok=true/filesChecked=1`，无 recovery claim。V8 不得重跑、seal/recovery 或追加 Provider 探测；
R6 产品 wiring 与 R7/main 已被阻断。

V9 R0 已完成新的独立 zero-provider 复盘与设计。V9 从 validated V5 shortlist 为每题枚举完整合法
decision option，模型 exact output 只允许 `decisions[{questionIndex,optionIndex}]`；模型不再回显
fingerprint，也不能自由组合 subject/action/target。Option authority 在本地保存 shortlist/option-set
fingerprint、完整 V6 subject/deck decision 与真实映射；selection 完整覆盖后，本地注入 fingerprint，再次
运行 V6 validator/merger 并重建真实 ID、locked name、confidence、reason 与 write binding。

Option 采用 canonical 去重、稳定排序、每题 24/请求 144 hard cap 与 Organizer 3500 input-token
fail-closed allocator；mandatory subject/action bucket 无法完整保留、任一 unknown index、partial/duplicate
question 或 option-set drift 都在 Provider 前或无写入路径失败，不 clamp/repair/default/retry。Owner-scoped
READ ONLY snapshot、事务外双 fence、owner-lock Serializable 最终 fence、Trace admission、预算与用户
authority 不变。R0 当时未实现源码或调用 Provider；后续 R1 已完成。

V9 的 zero-option 与预算终态也已冻结：有效 shortlist 但任一题没有合法 option 时，必须在 Provider 前以
`attempted=false / not_eligible / candidate_option_authority_empty` 返回完整 deterministic binding/suggestions、
`usage=0/0` 和无 runtime Trace；mandatory bucket 无法装入 cap/token 时则为
`fallback_budget_exceeded / candidate_option_authority_budget_exceeded`，不得删 bucket 后继续调用。Projection
只接受 validated V5 authority；V5 允许的 model-facing 文本会在裁剪前完整扫描，超过 `16384` UTF-16、
malformed Unicode、control/Cf、credential/instruction/tool/write 均整份拒绝，`status/updatedAt` 不进入
prompt。`answer/userNote` 不属于 V5 source schema，出现即作为未知额外字段 strict fail-closed 为
`invalid_input`，不会扩展历史 schema。公开 label 最多 `80` Unicode scalar，真实映射与权限字段不投影。

`3500` 上限使用冻结的确定性近似 `64 + ceil(utf8Bytes([system, canonical projection,
schema].join('\n')) / 3)`，不是 Provider tokenizer；candidate/adapter 必须共用 parts builder，Provider usage 仍
独立验证。产品路径保持同步 HTTP，不写 BackgroundJob/Outbox 或后台补发；未来 V9 runner 则必须把 reserved
lane、wire stage、terminal/orphan/not-started 与 executor/dispatch/response/usage 计数 durable 化，不能让
transport/abort/process crash 静默成为 no-option。

V9 R1 已实现 `@repo/agent/wrong-question-organizer-v9`。本地 option authority 只从 validated V5
shortlist 派生，按同 subject 枚举 `reuse_existing/create_topic`，排除 canonical duplicate 与 locked-name
create collision，并以 mandatory bucket、`24/question`、`144/request` 和 3500 input-token hard cap
fail-closed。模型 contract 只允许 exact `decisions[{questionIndex,optionIndex}]`；本地映射 selection 后注入
V5 shortlist fingerprint，再执行完整 V6 validator/merger。Prompt、estimator、option rules SHA 分别为
`ef2ff007cb55aedf5710c86a9a70e68368e24cc06afd8a09af84024f12e5586c`、
`06caeb2d5b957ce122ea11db417b65c90e852e029f1fb1e2484dbffa6fbdbada`、
`1013c43950c4b351e5ffa77286ec732ef522b38a4f294dd507ecac7a42c28eec`。R1 focused
`11/11`、Agent `918/918`、Agent/AI typecheck/lint、历史 evidence validators 与双路复审通过；全程
zero-provider，未执行正式 Mock/Live、创建 V9 artifact 或启动产品验收。该 checkpoint 当时下一原子任务
仅 R2；后续已完成。

V9 R2 冻结独立 Provider-like fixture
`phase-6.9.7-tutor-organizer-v9-r2-provider-shapes-v1`，SHA 为
`sha256:0870799257dcd2b88841b286b9cc64e6410702fe2bcbe86c6e153d8af88a4200`。Synthetic
responder 只解析实际 bounded prompt，不读 V2 expected/oracle，也不调用生产 builder/validator 生成答案；
路径实际穿过第一方 direct adapter、ModelAgentRuntime、V9 candidate/selection 与 V6 merger，provenance 固定
`synthetic_test`。

R2 覆盖 wrapper/prose/fence/BOM/type drift、question/option reorder、NFKC duplicate/locked-name、24/144/
3500 cap、ASCII/CJK/emoji/combining、`NaN/Infinity/unsafe integer` 本地 schema、credential/Cf/control、
getter/Proxy/symbol/cycle/deep/wide/node overflow、pre/in-flight/post abort 与 pre/post/final stale/write
authority。实现修复 V9 strict JSON schema identity、`provider_type_validation` 的 schema disposition，以及
failure sanitizer 对 parse failure 伪造 diagnostic 的副作用；transport failure、static schema failure 与
selection/dynamic failure 继续分层且 raw data 不保留。Focused `24/24`、Agent `938/938`、AI `226/226`、
Server 写权限 3 suites/34 tests、历史 validators 与 V9 artifact=0 通过。R2 全程 zero-provider；下一原子
任务当时仅 R3 runner/lineage/durability，后续已完成。

V9 R3 已建立独立 report/runner/CLI/approval/marker/journal/evidence/recovery/validator identity，固定
`72/24/48/24/32`、guard-first、pair 串行、pair 内双 lane、single dispatch/no retry、首 runtime contract
failure breaker 与 incomplete semantic/P95/token/CNY 全 `null`。V9 显式继承 V7 8-stage wire，并以独立
alias/source manifest 绑定 V2 dataset、V6 semantic authority、V9 prompt/estimator/option rules、selection、
diagnostic 和 runner runtime SHA，不伪造新的 AI wire export。V1--V8 双向 lineage rejection 保持成立。

每个 `lane_reserved` 必须 append + fsync 后才允许 executor；first-party Live provenance 缺少完整 durable
lifecycle 时会在 guard/executor 前拒绝。Reserved lane 正常路径必须恰好一个 runtime terminal；crash-only
recovery 只按 journal 把缺 terminal reservation seal 为 attempted orphan，不创建 executor或重放；未 reserved
case 按 guard/breaker/orphan 事实分类。Runtime accounting 显式记录 reserved/terminal/orphaned/not-started，
sibling abort 不复制另一 lane 的故障或 diagnostic。

R3 synthetic runner/wire fault matrix 覆盖 guard failure、transport/HTTP/schema/usage、selection/option
authority、first/middle/last breaker、固定分母、single dispatch/no retry、sibling abort 与 aggregate 全
`null`。它只验证 runner/wire/durability，不是 R4 reviewed candidate Mock。Focused `29/29`、Agent
`967/967`、AI `226/226`、typecheck/lint/Prettier/diff、Phase 6.9.6 与 V1--V8 validators 通过；正式 V9
marker/journal/evidence/recovery artifact 为 0。R3 全程 zero-provider；该 checkpoint 当时下一原子任务仅
R4，后续 R4 已完成。

V9 R4 已接入 reviewed Mock evaluation runtime/factory。Tutor 复用正式 V6 candidate；Organizer 穿过 V9
option authority/selection、V6 validator/merger 与第一方 direct adapter，只有 fetch delegate 为
synthetic；responder 只读实际 bounded prompt，不读取 expected/oracle。Fresh baseline 为 `12/48`，
Tutor/Organizer/combined semantic 为
`0.6629642857142858/0.278125/0.4705446428571429`。Mock run
`f039a7d2-c3b2-4286-9630-fee49d365a33` 为 `24/24` guard zero-call、`48/48` strict、wire
`48/48/48/48`、semantic `1/1/1`、synthetic usage `17732/504`、estimated `0.05622 CNY`，gate
`mock_quality_not_evidence`。全量静态、Organizer PostgreSQL `12/12`、Compose default-off、Phase 6.9.6
与 V1--V8 validators、残留 0 和两路终审通过；Mock evidence 已精确删除，正式 V9 artifact=0。R4 未
读取 credential、调用 Provider、执行 Live 或启动产品 Docker/API/browser；这是 R5 前历史 checkpoint。

V9 R5 唯一 controlled-Live run `c530ca02-3ece-4f11-898c-5695c8252bd5` 已失败封存。Guard 为
`24/24` verified zero-call；pair 0 两条 lane 各 reserved、terminal 和 dispatch 一次，但 Tutor 在 response
前成为 `provider_runtime / transport`，Organizer sibling 为 `post_dispatch_abort`。Runtime accounting
reserved/terminal/orphan/not-started 为 `2/2/0/46`，wire executor/dispatch/response/usage 为 `2/2/0/0`，
strict 为 `0/48`；semantic、四项 P95、token、CNY 全 `null`，最终 `quality_gate_failed`。Artifact 已
durable seal，validator `ok=true/filesChecked=1`，无 recovery claim。该证据不能区分 DNS/TLS/代理、账号、
余额、模型权限或服务端根因，也没有验证真实 Tutor/Organizer 语义；禁止重跑、额外 Provider 探测、
seal/recovery 或改写 artifact，R6/R7/main 与后续阶段继续阻断。

V7 完整设计见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v7-remediation-design.md`；R0--R3 checkpoint 见
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r0-zero-provider-postmortem.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-r1-zero-provider-adapter.md`、
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r2-runner-lineage.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v7-r3-static-mock.md`；R4 终态见
`docs/acceptance/phase-6-9-7-tutor-organizer-v7-controlled-live-failure.md`。V8 设计与 R0 证据见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v8-remediation-design.md` 与
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r0-zero-provider-postmortem.md`；R1 证据见
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r1-fixed-shape-diagnostic.md`；R2 证据见
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r2-provider-robustness.md`；R3 证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v8-r3-runner-lineage-durability.md`。
R4 证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-v8-r4-static-mock.md`；R5 终态见
`docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v8-controlled-live-failure.md`。
V9 R0 设计、计划与验收见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v9-remediation-design.md`、
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v9-remediation.md` 与
`docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v9-r0-zero-provider-postmortem.md`。
V9 R1 验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r1-option-authority.md`。
V9 R2 验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r2-provider-robustness.md`。
V9 R3 验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r3-runner-lineage-durability.md`。
V9 R4 验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r4-static-mock.md`。
V9 R5 终态见
`docs/acceptance/2026-07-30-phase-6-9-7-tutor-organizer-v9-controlled-live-failure.md`。

## Phase 6.9.8 RetrieverAgent / FinalResponseAgent 验收合同

Task 0 已以 `zero_provider_retriever_final_response_design` 冻结以下边界，但尚未实现 runtime：

- identity 只能由 Nest JWT 投影到 `AgentExecutionContextV1.principal`；request/model 不能提供 ownerId，无效 token
  返回 401，anonymous owner/live 路径在 Provider 构造前 zero-call；
- Retriever 复用当前 authenticated `/knowledge/search` 的 Qwen 1536 embedding + PostgreSQL vector/keyword hybrid
  search。query rewrite 只在复杂多轮 RAG query 上建议一个 bounded query，本地仍权威决定 owner/topK/minScore/
  filter 和 original/rewrite 选择；
- rewrite 配置固定为 default-off `RETRIEVER_QUERY_REWRITE_MODEL_ENABLED`、4000ms 与 Web-only
  `RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY`；FinalResponse 配置固定为 default-off
  `FINAL_RESPONSE_AGENT_MODEL_ENABLED`、20000ms 与 Web-only `FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY`；两者不得
  借用 generic/其它 Agent credential；
- deterministic SafetyGuard + Verifier 只能收紧 evidence。FinalResponse model 最多看到
  `citationId/sourceLabel/excerpt/trustLabel`，其中 sourceLabel 是非敏感 ordinal alias；模型不能看到用户文档标题、
  `documentId/chunkId/sourceRef/safetyCodes`。citation event、tool status、usage/cost 和 Trace terminal 由本地
  authority 生成；
- FinalResponse 首 token 前失败返回固定不可用响应；首 token 后失败必须标记 partial/incomplete，禁止 citation
  和工具成功。所有 transport no retry，parent abort 贯穿整条链路且服务端 terminal exactly-once；这不承诺网络
  恰好交付，客户端断连也不得自动重放；
- Trace 必须先 running、stream terminal 后 finalized；估算 token 与 verified usage 分开。Trace finalization 失败
  不撤回已发送正文，但该 run 不形成质量 authority；
- 同步 FinalResponse 不创建 BackgroundJob/Outbox；未来异步化必须同时设计
  `BackgroundJob + Durable Outbox + idempotency key`。

正式 `phase-6.9.8-retriever-final-response-v1` 固定 48 case：16 Retriever guard、16 rewrite paired runtime、16
FinalResponse runtime。正式门要求 owner/safety/false citation/false tool success critical failure=0，Recall@5
`>=0.90`、nDCG@5 `>=0.85`、eligible rewrite 相对 baseline `>=+0.08`、Final grounded rubric `>=0.90`、citation
precision `=1`、required citation recall `>=0.90`，并满足 rewrite/retrieval/TTFT/Final/Chat P95。DeepSeek 32-call
run cap 为 `0.32 CNY`；paired search 最多 32 次 Qwen embedding。Qwen 正式价格 profile 未冻结时 cost/总成本
aggregate 必须为 `null`，禁止进入 controlled-Live admission。

Task 1 已以 `zero_provider_retriever_final_response_shared_contract` 实现上述通信地基：所有新 DTO 先执行
hostile-accessor-safe bounded clone，再通过 strict Zod、固定 allowlist 与跨字段不变量，成功值 deep-freeze；
authenticated principal 必须绑定同一 opaque auth receipt/request/bearer reference，`AbortSignal` 仅作为不可枚举的
进程内控制对象。`skipped` envelope 不得携带任何 usageRef；同一 model call 只能有一个 direct attribution。
FinalResponse model projection 固定只含安全 evidence 四字段；stream ledger 同时校验单调 sequence、唯一 terminal、
exact `citationId -> sourceLabel` 本地映射和首 token 前后/abort 失败边界。

Task 1 的历史边界保持不变：当时仍未修改 apps/web 或 apps/server runtime，只解锁 Task 2 canonical principal /
Chat access。随后 Task 2 已删除 `web-chat-user` 并把 authenticated owner 绑定到一次 strict `/auth/me`；Task 3 已
落地正式 Retriever node、opaque authenticated search port 与 16+16 original-query baseline；Task 4 已落地
exact-context evidence projector、SafetyGuard/Verifier 保守收紧、本地 structured citation/Markdown adapter 与
RAG 整层丢弃。

Task 5 已以 `zero_provider_retriever_query_rewrite_candidate` 完成以下合同：

- 只有 authenticated、`requiresRag=true`、复杂多轮指代且具有 active/recent context 的安全请求才可越过
  eligibility；standalone/no-context、anonymous、non-RAG、不安全输入、abort/deadline、无效配置与超预算均在
  credential/runtime factory 前 zero-call；
- DeepSeek V4 Pro non-thinking 模型只返回 strict `{ rewrittenQuery }`，每次请求拥有独立
  `1 call / 1200 input / 160 output / 0.005 CNY` 预算，最多调用一次且无 retry；
- 本地 validator 必须保留实体、公式、数字、约束与上下文锚点；失败、schema/usage 不可信或候选不合格时使用
  original query。模型无权修改 owner、`topK=8`、`minScore=0.72`、source/status filter；
- 原 query、每条 recent turn、active question 与 active goal 分段完整扫描；observation 不含 query、turn、prompt、
  owner、credential、endpoint 或 raw error；
- 三项 default-off 配置与独立 key 只投影给 Next `web` server runtime。Task 5 未读根 `.env`/credential、未调用
  Qwen/DeepSeek/Provider、未启动产品 Docker/API/browser，也尚未接入 `/api/chat`；reviewed Mock
  `qualityAuthority=none`，不能证明 rewrite uplift、真实模型质量、产品可用性或 SLA。

Task 6 已以 `zero_provider_final_response_stream_contract` 完成以下合同：

- 正式 FinalResponseAgent 只接受 authenticated、同一 exact execution context 绑定且完整安全扫描通过的 request；
  config、abort/deadline、输入预算均在 executor 前 fail-closed；
- 独立 DeepSeek V4 Pro non-thinking adapter 固定 exact `/v1/chat/completions`、`stream=true`、verified usage、
  `max_tokens=1200`、no tools/reasoning/retry；Node 固定 `20000ms / 1 call / 2500 input / 1200 output /
0.015 CNY`；
- citation 只来自本地 allowlist；模型不得创建 citation 或 tool-success authority。首 token 前失败为固定诚实不可用，
  首 token 后失败只保留 partial text，不追加 citation/tool success；
- 本地 ledger 校验连续 sequence 与唯一 terminal。Citation/completed 先在本地封存再 best-effort 投递；客户端断连
  记录 `client_disconnected/deliveryFailed=true`，不把 completed 改写成 aborted，也不声称网络 exactly-once；
- Web server-only config/runtime 与 Compose 只向 `web` 投影独立 default-off gate/timeout/key。Task 6 未读根
  `.env`/credential、未调用 Provider、未接 `/api/chat`，未执行产品 Docker/API/browser、48-case、
  controlled-Live 或 main；`qualityAuthority=none`。

Task 7 已以 `zero_provider_chat_composition_terminal_trace` 完成以下合同：

- `/api/chat` 按 canonical auth -> minimal RUNNING Trace -> context -> Router/Tutor -> Retriever/query rewrite ->
  Verifier -> local evidence projector -> Trace prepare -> FinalResponse stream -> terminal finalize 串联；anonymous Mock
  在 Provider config 和全部 Agent runtime 前直接返回；
- realtime Trace start 只保存 run/modelCall/conversation/mode/time 与 pending/zero placeholder；prepare 只保存固定
  node/status/reason/count summary 和 digest；finalize 通过 CAS 保证单 terminal，并可在 prepare ACK 不确定时原子补写
  同一 preparation。Legacy overwrite、late prepare、conflicting retry 与 concurrent second finalize 均 fail-closed；
- Retriever transport/schema failure 安全降级为 no-RAG；`ragIncluded=false` 时 bundle、allowlist、citation 与
  Markdown 整层清零。Cross-scope principal binding 不被伪装成普通检索失败，返回 403；abort 返回 499；
- AI SDK text channel 只承载正文、本地 citation Markdown 与诚实失败提示。Sequence、citation lockstep、唯一
  terminal、terminal-last 由本地校验；`Response.body.cancel()` 和 parent request abort 都会取消同一 request scope
  与底层 reader，且不会后台 replay；
- 同步链路不创建 BackgroundJob/Outbox，两个模型 gate 继续 default-off，Provider calls=0；Task 7
  `qualityAuthority=none`，不证明真实模型质量、P95、SLA 或产品可用性；
- focused Web/Server/Types 与静态门已通过。数据库 E2E 已覆盖三阶段 lifecycle/concurrency，但因本地 Redis/
  PostgreSQL 未运行而 `environment_blocked`；未执行 Docker/API/browser、48-case、controlled-Live 或 main。

Task 8 已以 `zero_provider_retriever_final_response_reviewed_mock_static` 完成以下静态质量门：

- 固定独立 `16 guard + 16 rewrite + 16 FinalResponse` manifest/policy；prompt-only Mock responder 不导入 manifest、
  expected/oracle，只读取 production candidate/node 生成的 actual bounded prompt；
- guard `16/16` 且 zero-call `16/16`；rewrite strict/usage/runtime `16/16/16`，original/candidate Recall@5 为
  `0.875/1`、nDCG@5 为 `0.56923614767/1`，critical target recall 与 intent preservation 均为 `1`；
- FinalResponse actual 穿过 Retriever/evidence projector/strict request/production stream ledger；strict/terminal/usage
  `16/16/16`，grounded、citation precision/recall、critical notice 均为 `1`，false tool success/citation 为 0；
- report 不保存 prompt、回答、owner、chunk、credential 或 raw error；canonical bytes、manifest/policy/factory/report
  SHA 漂移 fail-closed；single-run capability 在执行前消费且无 retry/replay；
- gate 固定 `mock_quality_not_evidence / qualityAuthority=none`。Synthetic DeepSeek estimate 为
  `0.027366 CNY`，不是 verified bill；P95/Qwen verified/aggregate verified cost 为 `null`；
- Provider/credential/Qwen calls 与正式 marker/journal/evidence/recovery 均为 0；source admission contract 已实现但
  `sourceAdmissionExecuted=false`，未启动 Docker/API/browser 或形成产品/main authority。

Task 9A 已以 `zero_provider_qwen_embedding_transport_price_contract / qualityAuthority=none` 完成 Qwen
`text-embedding-v4` 独立 transport/price 合同：

- 固定北京区 official endpoint/profile、1536 维、`0.5 CNY / 1M input tokens` 与 32 次调用最坏
  `262144 tokens / 0.131072 CNY` cap；
- direct fetch、single-call/no-retry、AbortSignal、strict response/vector/index/usage validation，费用只由本地冻结价格
  与 verified `prompt_tokens == total_tokens` 重算；
- injected fetch 永久标记 `synthetic_test`。Task 9A 未读取 credential、未调用 Provider、未接产品 RAG、未创建
  approved tag/marker/journal/artifact/recovery，也不形成 Live/产品/main authority。

Task 9B 已以 `zero_provider_retriever_final_response_runner_durability / qualityAuthority=none` 完成正式评测地基：

- 固定 16 guard-first、16 个 original-Qwen/rewrite-DeepSeek/candidate-Qwen 串行 pair 与 16 个 FinalResponse；
  64-call 分母中 Qwen/DeepSeek 各 32；
- 双 Provider 分别记录 attempt/dispatch/response/verified usage/token/CNY，费用 cap 为
  `0.131072 / 0.32 / total 0.451072 CNY`；任一分母、price、usage 或 terminal 不完整时 aggregate=`null`；
- source parity、双 opaque single-use capability、exclusive marker、dispatch-before-call hash-chain journal、
  hard-link artifact、strict validator 与 crash-only seal 已完成；recovery 不读取 credential、不调用 Provider、不
  retry/resume/replay/backfill；
- Reviewed Mock 的 guard `16/16`、两 Provider wire+usage `32/32/32/32`、rewrite nDCG uplift
  `0.43076385233`、FinalResponse/safety 均通过，但 gate 固定
  `task9b_mock_quality_not_evidence / qualityAuthority=none`；Provider/credential/approved tag/正式 evidence 为 0。

唯一 Task 9C controlled-Live 已在 fresh DeepSeek/Qwen 数据边界接受与 exact authorization 下执行并失败封存：

- run `28b5f92f...` 为 guard `16/16` zero-call，实际 `5/64` Provider calls；Qwen `3/3/3/3`、DeepSeek
  `2/2/1/1`；
- `rewrite_01` 完整成功，`rewrite_02` DeepSeek rewrite 在 dispatch 后以本地
  `schema_invalid / wire 1/1/0/0` 失败，其余 59 次调用均未启动；
- rewrite/FinalResponse strict `1/16 / 0/16`，semantic/P95/token/CNY aggregate 全 `null`；
- gate `task9_quality_gate_failed / qualityAuthority=none`，journal `134`、validator `ok=true`、recovery
  claim=`null`；report/artifact SHA 为
  `c612d6f7164d5491e54422abb2e8504cbb707aeea3b641e8c57285d957b8b4a4 /
7d45329debde6def4c5bc8bbda28609b507a71766ae06e00806e44eaf7b3614c`；
- sealed evidence 不足以区分具体 Provider payload、candidate local rejection、Trace/usage/wire invariant 或 runner
  result schema 分支，因此不得声称具体字段、transport、账号或服务端根因；
- 一次性名额已消费，禁止 retry/resume/replay/backfill、seal/recovery 或追加 Provider 探测。产品/main 与后续
  阶段仍未完成，Task 10/11 继续阻断。

Architecture Recovery R0--R4 已完成 zero-provider AI 行为边界设计、rewrite TDD、Qwen/FinalResponse
robustness 与 runner/durability/admission：

- 不反向解释或改写 Task 9C；新 lineage 只服务未来独立恢复评测；
- 分别定义 rewrite、Qwen retrieval、FinalResponse stream 阶段机，避免一个 `schema_invalid` 覆盖 candidate、
  Trace、usage、wire、stream ledger 与 runner result；
- 第一方 Provider dispatch/response/usage 与 runner harness-return/result 分开记为 `providerWire/runnerWire`；
- diagnostic 只允许 fixed enum/bucket 与 `rawDataRetained=false`，禁止模型原文、prompt/query/chunk/answer、
  unknown key、credential/URL/raw error 与 raw-derived hash；
- 模型仍不能修改 owner、retrieval policy、citation allowlist、价格、预算、工具/写权限或 expected/oracle；
- R1 的 rewrite session 只能绑定一次性真实 V7 wire capability；Provider observation 只从 terminal frozen snapshot
  推导，caller-supplied response/usage、forged/reused/active capability 均不能提升 authority；
- R1 synthetic tests 真实穿过第一方 direct adapter injected fetch，但 provenance 固定 `synthetic_test`；focused
  `11/11`、AI wire/export `25/25`、Agent full `1289/1289`；
- R2 新增 `qwen_retrieval/final_response_stream` 两个第一方 wire family 与一次性 recovery session；Qwen 将
  Provider/envelope/embedding/usage 分域，FinalResponse 将 stream/terminal/false-tool/usage 分域；
- 第一条实际 stream event 即使畸形，也只形成 `response_observed + stream_event_invalid`；full stream 为空才是
  `response_not_observed`，两者都不能形成成功或正文 authority；
- forged/reused/active/cross-family/out-of-order capability 与 hostile getter/Proxy 均 fail-closed；focused
  compatibility `58/58`、AI full `345/345`、Agent full `1301/1301`；
- R3 固定 `16 guards + 64 calls`，以 source-admitted guard-first runner 绑定 `providerWire/runnerWire`、本地
  ranking/citation/Trace/delivery/result、双 Provider usage/CNY、完整分母与 aggregate-null 规则；
- Rewrite/Qwen/FinalResponse observation 由三个模块私有 WeakMap 签发，精确绑定 `callId + phase + family`；共享
  模块不再提供 callable issuer，forged/active/reused/cross-call/cross-family/out-of-order 全部 fail-closed；
- exclusive marker、reservation-before-dispatch、fsynced hash-chain journal、hard-link artifact、strict validator、
  crash-only seal 与 run-terminal publication recovery 已在临时 synthetic root 验证；正式 R3 namespace 仍为 0；
- R0--R3 focused `39/39`、Agent full `1318/1318`、AI full `345/345`、typecheck/lint 通过；external
  Provider/credential/approved tag/formal marker/journal/artifact/recovery claim 均为 0；
- R4 又把 Task 8 production node/ledger 与 prompt-only reviewed Mock 接入 R3 runner，得到 guards `16/16` zero-call、
  双 wire `64/64/64/64`、diagnostic `64 applied`、rewrite/FinalResponse `16/16`；gate 固定为
  `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`。Provider、credential、formal evidence
  均为 0，synthetic cost 仅用于本地预算回归，verified provider cost 保持 `null`；
- 其后唯一 R5 run `34eb99be...fc68` 在第二个 rewrite pair 的 DeepSeek `provider_dispatch / unknown` 后以
  `architecture_recovery_quality_gate_failed / qualityAuthority=none` durable seal。External calls `4`，rewrite
  strict `1/16`、FinalResponse `0/16`，正式 semantic/P95/verified aggregate 全为 `null`；R5 不得重跑，产品/main
  与后续阶段继续阻断。
- Transport Evidence Recovery T0/T1/T2/T3 已完成：T0 冻结 `30`-case zero-provider stage/boundary/reason/wire contract，
  T1 落地 strict no-raw parser、双 wire 单调校验与 rewrite/Qwen/FinalResponse 私有 single-consume capability，T2
  又完成 `30/30` matrix、`15/15` classifier、partial/terminal prefix 与 publication recovery、multiple-marker
  rejection、hard-link artifact、strict validator 和 Windows/Bun fsync compatibility。T2 focused `11/11`、Agent
  `1348/1348`、typecheck/lint/Prettier 均通过，authority 为
  `zero_provider_transport_evidence_t2 / qualityAuthority=none`；不形成 Provider health、Agent semantic 或产品
  authority，也不反向解释 R5 的 `provider_dispatch / unknown`。唯一 T3 controlled run
  `075e2d5f-682b-426d-847e-f5a6ce5b97c6` 随后在 late-bound credential gate 以 `configuration_invalid` durable seal，
  planned/started/completed=`3/0/0`、Provider/credential=`0/0`、journal `7`、validator `ok=true`，
  authority=`controlled_live_transport_evidence_t3 / qualityAuthority=none`。这是 CLI/configuration 失败，不归因
  Provider 根因；T3 一次性名额已消费，不得重跑、追加探测或把它写成语义质量证据。

完整设计、计划、Task 0--9C 与 Architecture Recovery R0--R5 证据见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-agents-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-agents.md` 与
`docs/acceptance/phase-6-9-8-task-0-retriever-final-response-contract.md`、
`docs/acceptance/phase-6-9-8-task-1-shared-communication-contracts.md`、
`docs/acceptance/phase-6-9-8-task-2-canonical-principal-chat-access.md`、
`docs/acceptance/phase-6-9-8-task-3-retriever-node-deterministic-baseline.md`、
`docs/acceptance/phase-6-9-8-task-4-verified-evidence-projector.md`、
`docs/acceptance/phase-6-9-8-task-5-retriever-query-rewrite-candidate.md` 与
`docs/acceptance/phase-6-9-8-task-6-final-response-stream-contract.md` 与
`docs/acceptance/phase-6-9-8-task-7-chat-composition-terminal-trace.md` 与
`docs/acceptance/phase-6-9-8-task-8-retriever-final-response-reviewed-mock-static.md` 与
`docs/acceptance/phase-6-9-8-task-9a-qwen-embedding-transport-price-contract.md` 与
`docs/acceptance/phase-6-9-8-task-9b-runner-durability-admission.md` 与
`docs/acceptance/phase-6-9-8-task-9c-controlled-live-quality-gate-failure.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-controlled-canary-failure.md`、
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-architecture-recovery-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-architecture-recovery.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r0-zero-provider-design.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r1-zero-provider-tdd.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r2-zero-provider-robustness.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r5-controlled-live.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t0-zero-provider-design.md`、
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t1-zero-provider-tdd.md`。

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
