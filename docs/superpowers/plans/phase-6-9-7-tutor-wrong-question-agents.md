# Phase 6.9.7 Tutor / Wrong-Question Organizer Implementation Plan

**目标：** 把 TutorAgent 与 WrongQuestionOrganizerAgent 从 deterministic-only policy 升级为可生产回滚的 DeepSeek V4 Pro 混合模型路径，同时保持 Chat 最终输出、JWT/owner、错题事实和所有数据库写入由本地代码掌握。

**架构：** Tutor 在最终 `route=tutor` 后仅对隐含/上下文/冲突教学意图调用一个受限 candidate，再由本地重建完整 TutorStrategy；WrongQuestionOrganizer 在 owner-scoped immutable snapshot 上对最多 12 个低置信错题做一次 batch candidate，再经双 stale fence、Trace admission 和短授权事务执行本地组织命令。两者使用独立 gate、component-specific credential 入口、不可变预算、strict Zod、零重试和 default-off 回退。

**技术栈：** TypeScript strict、Bun、Zod、Next.js 16 Route Handler、NestJS 11、Prisma/PostgreSQL、共享 `ModelAgentRuntime`、DeepSeek V4 Pro non-thinking JSON-object、Agent Trace、Docker Compose。

**当前状态（2026-07-24）：** Task 0--11 已完成。Task 12 V1 run `39a62241...` 与 V2 R7 run `67ce18dd...` 均已分别以 `quality_gate_failed` 封存且不得重跑。V2 R0--R6 已完成 prompt/contract、anti-overfit、独立 runner/evidence lineage、marker/evidence 并发恢复、Chat abort、Organizer failed Trace、同题 normal/force 与 single/batch PostgreSQL 收敛；fresh Mock 为 `24/24` zero-call、`48/48` strict runtime、semantic `1/1`。唯一 V2 Live 保持 `24/24` guard zero-call，但 48 个 runtime 全部在结构化对象形成前 `fallback_runtime_error`，最终 `0/48` strict runtime、semantic `0/0`、verified usage `0`、critical `1`。V2 marker/evidence 已封存，R8 产品 Docker/API/浏览器未启动，两个 tracked gate 仍关闭，Phase 6.9.7 未完成。下一步只能先做零 Provider 失败复盘并另起 V3 identity/设计，不是 Task 13/main 合并。

R4/R5/R6 的工程复审与 R7 失败终态分别记录在对应 acceptance；R6 的通过结论不替代 R7 真实质量门。

权威设计：`docs/superpowers/specs/phase-6-9-7-tutor-wrong-question-agents-design.md`

V2 remediation：`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v2-remediation-design.md` 与
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v2-remediation.md`

---

## 执行不变量

- 只在 `codex/phase-6-9-7-tutor-wrong-question-agents` 工作；该分支从已推送且与远程一致的 `main@2af7e510` 创建，不使用 worktree，也不从功能分支继续开分支。
- 每个 Task 完成 focused RED/GREEN、必要的影响面验证、文档同步和一个提交后，才开始下一个 Task。
- Task 0--11 不读取 `.env`/密钥、不调用真实 provider；Task 12 必须先取得新的、精确的用户授权。
- 历史 Phase 6.9.5/6.9.6 evidence、marker、失败 lineage、Live authority 和产品 acceptance 不得重跑、删除、覆盖、改写或拼接。
- 模型不得拥有 userId、真实数据库 ID、权限、工具、FSRS、WrongQuestion 事实或写命令；任何模型影响的 Organizer 写入都必须先通过本地 merger、Trace admission 和授权事务。
- Tutor 的模型失败只回退 deterministic strategy，不影响 Chat；Organizer 的模型失败只回退 deterministic organization，不影响错题保存。
- 不记录 prompt、用户题目/答案正文、active context、provider output/body/header、credential、base URL、cookie、token、stack 或 raw error。
- 禁止 Docker prune、`down -v`、volume/database reset、Redis flush、MinIO wipe；验收只精确清理本轮合成资源。
- 每个 meaningful checkpoint 同步 `AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md` 和相关数据流/验收/启动文档，并写明“为什么、完成什么、验证什么、下一步、回顾时可以问”。
- 编号中 Task 0 是设计/计划冻结 checkpoint；Task 1--13 是 13 个原子执行与验收任务，因此全文共有 14 个编号条目但只有 13 个 implementation/acceptance commits。

## 计划文件结构

| 关注点 | 计划文件 |
| --- | --- |
| Dataset / metrics / baseline | `packages/agent/src/evals/phase-6-9-tutor-wrong-question-*.ts` 与对应 tests |
| Strict schemas / projections | `packages/agent/src/model-candidates/tutor-model-*.ts`、`wrong-question-organizer-model-*.ts` |
| Tutor candidate / merger | `packages/agent/src/model-candidates/tutor-model-candidate.ts` 与 tests |
| Organizer candidate / merger | `packages/agent/src/model-candidates/wrong-question-organizer-model-candidate.ts` 与 tests |
| Tutor product composition | `apps/web/src/lib/tutor-model-*.ts`、Chat orchestration/Trace/header files 与 tests |
| Organizer snapshot / command | `apps/server/src/wrong-question-organizer/*snapshot*`、`*command*`、service specs/e2e |
| Organizer composition / Trace | server config/runtime/trace/module/controller/service 与 tests |
| API / UI source state | `packages/types` organizer contract、web API/hooks/view/page tests |
| Paired eval / evidence | agent runner/CLI/validator、acceptance evidence/tests |
| Docker / operations | `.env.example`、Compose、`docs/dev-start.md`、验收/运维文档 |

## Task 0：冻结专项设计、任务拆分和当前文档入口

**文件：**

- 新建设计与本计划；
- 修改 `AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`、`docs/data-flow.md`；
- 只修复 Phase 6.9.6 已完成但仍写“只剩 Task 13”的当前入口，不改写历史 checkpoint/evidence。

**验证：**

- [x] 设计明确两个 Agent 的职责、模型权限、通信、zero-call、预算、Trace、Organizer 写隔离和数值质量门；
- [x] 计划每个 Task 只有一个主要关注点并对应一个 commit；
- [x] `git diff --check`；
- [x] 新读者只读设计/计划即可回答模型能做什么、不能做什么、如何验收和为什么仍 default-off。

**提交：** `docs(agent): plan phase 6.9.7 hybrid agents`

## Task 1：冻结 72-case 数据集、专项指标和 deterministic baseline

**状态：已完成。** 冻结值与验证见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-baseline.md`；后续 Task 2--6 也已完成，当前下一任务为 Task 7。

**文件：**

- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-cases.ts`
- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-metrics.ts`
- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-baseline.ts`
- 对应 `packages/agent/tests/phase-6-9-tutor-wrong-question-*.test.ts`
- `packages/agent/scripts/run-phase-6-9-7-baseline.ts`
- `packages/agent/package.json`
- `docs/acceptance/phase-6-9-7-tutor-wrong-question-baseline.md`
- checkpoint 文档

**RED：** 先断言 datasetVersion、Tutor `12+24`、Organizer `12+24`、24 paired indexes、唯一 ID、critical tags 和 metric 公式；文件尚不存在时失败。

**GREEN：**

- 构造纯合成中英文/专业课 fixture，不复制真实用户文本或 ID，并冻结设计 §10.2 所列全部 expected/accepted metric annotations；Organizer runtime index `0..19` 各 1 个、`20..23` 各 3 个 projected question，共 `32` decision units；
- canonical dataset JSON 递归排序键后固定 SHA-256；baseline/后续 runner 同时校验 `72 cases / 32 Organizer decisions / hash`；
- runtime baseline 直接调用现有 `buildTutorStrategy()` / `organizeWrongQuestion()`；
- 固定未修饰的两个 lane 指标、`0.5 * Tutor + 0.5 * Organizer` informational combined score、critical failure 和零 provider usage/cost；
- 把实际 baseline 两个 lane、combined 与子指标写入 acceptance 并由核心文档链接；Task 0 不预填数值；
- baseline 报告不穿过未来 candidate guard，不把 deterministic 结果包装成模型证据。

**验证：** focused cases/metrics/baseline tests、Agent typecheck/lint、baseline CLI 两次字节稳定、`git diff --check`。

**提交：** `test(agent): baseline tutor organizer semantics`

## Task 2：建立 strict output contract 与完整字段安全投影

**状态：已完成。** 四份 Task 2 focused tests `19/19`，连同 Knowledge projection 安全回归为 `25/25`；Agent full `502/502`，typecheck/lint exit 0，两路独立复审无 Critical/Important。证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-contracts.md`；后续 Task 3--6 已完成，当前下一任务为 Task 7。

**文件：**

- `tutor-model-contract.ts` / `tutor-model-projection.ts`
- `wrong-question-organizer-model-contract.ts` / `wrong-question-organizer-model-projection.ts`
- production export 与对应 tests

**RED：** 额外字段、非法 enum、重复/越界 ordinal、跨 subject deck、非法 label、credential 在裁剪后部、instruction/control、hostile getter/proxy 均先失败；断言首次 runtime 调用前已经扫描每个完整字段。

**GREEN：**

- 使用普通自有属性 descriptor clone，拒绝 getter/proxy/非预期 prototype；
- full scan -> safety metadata combine -> eligibility -> truncation -> ordinal assignment -> deep freeze；
- 模型投影不含 userId、conversationId、真实 UUID、图片 URL、token、完整 answer/rawContent 或写操作；
- strict schemas 与动态 validator 分离，所有拒绝返回固定 reason code。

**验证：** focused tests、Agent full typecheck/lint、已有 candidate safety tests、`git diff --check`。

**提交：** `feat(agent): add tutor organizer model contracts`

## Task 3：实现 Tutor candidate eligibility 与本地权威 merger

**状态：已完成。** Tutor focused `16/16`（含冻结 12 zero-call + 24 runtime eligibility 全量回放），Agent full `518/518`，AI full `193/193`，Agent/AI typecheck/lint exit 0；两路独立复审最终无 Critical/Important。证据见 `docs/acceptance/phase-6-9-7-tutor-model-candidate.md`；后续 Task 4--6 已完成，当前下一任务为 Task 7。

**文件：**

- `packages/agent/src/model-candidates/tutor-model-candidate.ts`
- candidate shared helper/production export
- focused tests

**RED：** 明确五类教学指令、非 tutor route、不安全文本、abort、预算失败必须 runtime counter=0；隐含/contextual fixture 必须恰好调用一次；模型不得输出/提升 `answer_direct`；schema/usage/timeout/runtime 失败必须返回原 deterministic strategy。

**GREEN：**

- eligibility 只接纳 implicit/contextual/conflicting/general-follow-up learning intent；
- reservation 在 runtime 前完成，max `1200/300`；
- local merger 重建 booleans、answerStructure、promptAddition 与 debug reason；
- hint 不含 final answer，active context 和 route permissions 继续本地权威；
- envelope 只含 fixed disposition/reason、usage、duration 和 budget snapshot。

**验证：** [x] candidate focused tests；[x] 现有 Tutor tests；[x] Agent/AI full test/typecheck/lint；[x] Node ESM production export；[x] 两路独立复审；[x] `git diff --check`。

**提交：** `feat(agent): govern tutor model candidate`

## Task 4：实现 WrongQuestionOrganizer candidate 与本地 merger

**状态：已完成。** Candidate focused 与 companion tests `24/24`；冻结 24 条 Organizer runtime fixture 均恰好调用一次，Task 4 自有 existing/exact/high-confidence/owner/stale/abort/budget/safety 路径保持 runtime 前零调用。Agent `529/529`、AI `194/194`、typecheck/lint、Native Node ESM export、`git diff --check` 与两路独立复审均通过；证据见 `docs/acceptance/phase-6-9-7-wrong-question-organizer-model-candidate.md`。后续 Task 5--8 已完成，当前下一任务是 Task 9。

**文件：**

- `packages/agent/src/model-candidates/wrong-question-organizer-model-candidate.ts`
- pure local merger/helper/production export
- focused tests

**RED：** 已有 item、高置信结构字段、精确 deck、安全拒绝、owner-ineligible、abort/budget 必须零调用；runtime 只可选择 q/d ordinal 或安全 topic label；跨 owner ID、自由写命令、用户锁定名称修改、非法 label 和重复 question 决策必须拒绝。

**GREEN：**

- 单次 candidate 支持最多 12 个 question、20 个 existing deck；
- subject 非空时本地保持，缺失时只允许固定 taxonomy；
- model deck ordinal 映射只存在于本地 merger；
- reason/description/confidence/source 全由固定本地模板生成；
- schema/usage/timeout/stale/runtime 失败返回对应 deterministic result，不重试。

**验证：** [x] candidate focused 与现有 organizer policy tests；[x] 冻结 24 runtime fixture 单调用回放；[x] schema/usage/timeout/abort/runtime fallback；[x] Agent/AI full/typecheck/lint；[x] Native Node ESM production export；[x] 两路独立复审；[x] `git diff --check`。

**提交：** `feat(agent): govern wrong question organizer candidate`

## Task 5：接入 Tutor 独立 default-off runtime、Chat 编排与安全 Trace

**状态：已完成。** Web server-only composition 固定 DeepSeek V4 Pro non-thinking JSON、3000ms、独立 `1/1200/300` 预算与 `0.006 CNY` cap；只读取 `TUTOR_AGENT_DEEPSEEK_API_KEY`。live access/context prepare 后仅注册惰性 factory；非 Tutor final route 不创建 Tutor bundle/runtime 或读取 component credential，Live executor/runtime 仅在 final Tutor candidate 真正调用时构造一次。明确指令、不安全/abort/配置失败保持 provider zero-call；失败保留 deterministic Tutor strategy。安全 Tutor header/Trace、CNY 与顶层 USD 隔离、Router/Verifier 预算隔离及 Docker web-only allowlist 均已验证。focused `27/27`、Web `432/432`、Agent `529/529`、AI `194/194`、Web lint/build、Compose tracked-example quiet parse 与两路复审通过。未读取根 `.env`、调用 provider 或执行 Docker/浏览器产品验收；production gate 仍默认关闭。证据见 `docs/acceptance/phase-6-9-7-tutor-web-runtime.md`。后续 Task 6--8 已完成，当前下一任务是 Task 9。

**文件：**

- `apps/web/src/lib/tutor-model-config.ts`
- `apps/web/src/lib/tutor-model-runtime.ts`
- `chat-agent-runtime.ts` / `chat-model-agent-orchestration.ts` / `/api/chat/route.ts`
- `agent-trace-payload.ts` / observation headers
- Web tests

**RED：** gate/global/key/model/url/timeout/price 任一无效则 zero executor；final route 非 tutor 不调用；candidate applied 时策略/header/Trace observation 一致；Trace 失败不打断流；Router/Verifier 既有预算与行为不被 Tutor 独立 budget 污染。

**GREEN：**

- fixed `deepseek-v4-pro` non-thinking JSON、3000ms、no tools/retry；
- web server-only composition 只读取 `TUTOR_AGENT_DEEPSEEK_API_KEY`，不得回退借用 generic/其它 Agent key，API key 留在 executor closure；
- Router 完成后按 final canonical route 调 Tutor candidate；
- `tutorObservation` 进入安全 header/Trace，raw input/output/error 永不进入；
- final Chat streaming、RAG/Verifier、登录、413、conversation prepare 和 abort 语义保持不变。

**验证：** [x] Web focused runtime/orchestration/route/trace tests；[x] Web full test/lint/build；[x] Agent/AI tests；[x] Compose tracked-example quiet parse；[x] 两路独立复审；[x] `git diff --check`。

**提交：** `feat(web): integrate hybrid tutor strategy`

## Task 6：建立 Organizer owner snapshot、双 stale fence 与授权写 command

**状态：已完成。** 已建立 bounded `REPEATABLE READ + READ ONLY` owner snapshot、域分离 HMAC/fingerprint、事务外双 revalidation、owner advisory-lock 写事务内第三次 fence、深冻结 model-free command、用户 authority、force 唯一关系、P2034/40001 bounded retry 与 canonical deck 溢出 fail-closed。focused `23/23`、Server `2122 passed / 30 skipped`、真实 PostgreSQL E2E `9/9`、Database `7/7`、Server lint/build/diff 通过；代码/安全与文档/验收两路独立复审无 Critical/Important。没有读取 key 或调用 provider。证据见 `docs/acceptance/phase-6-9-7-wrong-question-organizer-owner-command.md`。后续 Task 7/8 已完成，当前下一任务是 Task 9。

**文件：**

- server `wrong-question-organizer-owner-snapshot.ts`
- server `wrong-question-organizer-command.ts`
- service/refactor 与 specs/e2e

**RED：** 跨 owner/missing 同一 404、provider 前后 wrongQuestion/deck/nameLocked/version 漂移 fail-closed、provider 不得运行在事务中、并发同 owner 同 topic 不创建重复空 deck、force item 唯一、用户 rename/move 胜出。

**GREEN：**

- bounded `REPEATABLE READ + READ ONLY` snapshot 与域分离 owner HMAC；
- fingerprint 覆盖所有 policy/projection/merger/write 相关事实；
- provider 前与 candidate 后短查询重建 fingerprint；
- 写事务取得 owner advisory xact lock，事务内第三次 revalidation；
- model-free `OrganizerCommand` 才能 upsert group/deck/item；冲突只做 bounded DB retry/权威重读，不重新调用 provider。

**验证：** focused unit/integration、真实 PostgreSQL 并发 e2e、Server lint/build、database tests、`git diff --check`。

**提交：** `feat(server): fence organizer write commands`

## Task 7：接入 Organizer default-off runtime、single/batch dispatch、Trace 与 HTTP abort（已完成）

**文件：**

- server organizer model config/runtime factory/trace
- module/controller/service/spec/e2e

**RED：** server-only `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`；`SERVER_ROLE=api|both` positive control 与 `worker` 强制关闭；single 最多一 call、batch 最多一 call/12 eligible；reservation 先于 Promise/dispatch；abort listener 清理；Trace 失败时 model candidate 不得影响写入；同 owner/runId 的 `command_pending -> final` 必须走真实 `AgentTracesService` upsert/step replacement，finalize 事务失败保留 pending，跨 owner 不能替换；runtime metadata 与实际 Trace/usage/price 一致。

**GREEN：**

- fixed V4 Pro、5000ms timeout、`3500/800`、0.016 CNY request cap；
- default-off/high-confidence/existing/unsafe/owner/stale 路径零调用；
- batch 一次 project/candidate，再在一个受控 command flow 应用本地结果；
- 同一稳定 runId 先持久化 candidate + `command_pending` admission Trace，成功后才写；command 完成后原子 upsert 最终 step，最终 upsert 失败仍保留 admission trace；
- HTTP disconnect/abort 贯穿 snapshot/candidate/command preflight，事务开始后仅执行不可中断的最小本地 command。

**验证：** server focused config/service/controller/e2e、Server full test/lint/build、Agent/AI tests、`git diff --check`。

**完成记录（2026-07-23）：** 已实现独立 default-off gate/credential、固定 V4 Pro non-thinking JSON、5000ms、`1/3500/800` 与 `0.016 CNY` cap；worker 强制关闭。single/batch 单次 dispatch、最多 12 eligible、candidate 后 stale fence、两阶段 Trace admission/final replacement、HTTP abort/listener cleanup 与 Task 6 model-free command 已接通。focused 单测 `126/126`、真实 PostgreSQL AgentTrace/Organizer E2E `16/16`、Server full `226/226 suites / 2146 passed / 30 skipped`、Agent `529/529`、AI `194/194`、相关 typecheck/lint/build/diff 门及两路独立复审通过；未读取根 `.env`/key、调用 provider 或执行 controlled-Live/Docker/浏览器。完整证据见 `docs/acceptance/phase-6-9-7-wrong-question-organizer-runtime.md`。Task 8--10 后续均已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

**提交：** `feat(server): integrate hybrid wrong question organizer`

## Task 8：增加 strict API runtime metadata 与 `/error-book` 来源状态（已完成）

**文件：**

- `packages/types/src/api/wrong-question-organizer.ts`
- Web API/hook/view/page 与 focused tests

**RED：** strict schema 拒绝 providerError/token/cost/prompt/raw IDs；local/hybrid/degraded 三态优先级；single/batch response 都可解析；移动端来源 badge 不溢出；未知 runtime 字段 fail-closed。

**GREEN：**

- runtime 只含 source/disposition/degraded/可选 traceId；
- batch response 以 request-level runtime 为权威，不逐题泄露模型细节；
- `/error-book` 在用户主动批量整理后展示“语义整理/本地规则/安全回退”；
- 不增加“强制重试模型”、自动删除/移动/改名等操作；已有错误/空状态/学科/deck 交互保持不变。

**验证：** Types test/typecheck、Web focused/full/lint/build、Server contract tests、390/510/1440px 静态布局断言、`git diff --check`。

**完成记录（2026-07-23）：** single/batch response 已增加 request-level strict runtime，只允许 `source / disposition / degraded / 可选 traceId`；只有已通过 usage/价格、Trace admission 与本地授权 command 的 candidate 才能返回 `hybrid_model / candidate_applied`。batch item 不携带 runtime，candidate scope 的 degraded 结论不会被 deterministic remainder 覆盖；Web API 在 envelope 解包后继续 strict parse，未知或敏感字段 fail-closed。`/error-book` 仅在用户主动批量整理成功后显示“语义整理 / 本地规则 / 安全回退”，degraded 优先，390/510/1440px 静态布局具备安全换行，且没有模型重试或自动 mutation。Types `42/42`、Web `438/438`、Server `2149 passed / 30 skipped` 以及 focused/typecheck/lint/build/diff 门通过；未读取 key、调用 provider 或执行 controlled-Live/Docker/可见浏览器，gate 仍默认关闭。证据见 `docs/acceptance/phase-6-9-7-wrong-question-organizer-api-source.md`；Task 9/10 后续均已完成，当前下一任务为 Task 11。

**提交：** `feat(web): show organizer decision source`

## Task 9：实现 72-case strict paired runner、CLI 与 evidence validator（已完成）

**文件：**

- paired contract/runner
- one-shot CLI
- evidence writer/validator
- tests/package scripts

**RED：** expected reason 回显、自报 zero-call、失败样本丢分母、0/0 usage、价格篡改、duplicate/cross-scope runId、Live filename/mode mismatch、敏感 key、二次 marker、未授权 Live 都必须拒绝。

**GREEN：**

- 24 条 zero-call 实际过 guard，独立 counter=0；
- 48 runtime 按 24 paired index 并行运行且全部进入分母；
- 重算 dataset/prompt/schema、两个 semantic score、critical、P95、usage、逐 case/aggregate CNY；
- Mock 永远不打开 production gate；
- Live 需要 fresh `PHASE_6_9_7_CONTROLLED_LIVE_APPROVED=true`、完整 conjunction 和独立 marker；
- evidence immutable publish，stdout 只输出安全聚合。

**验证：** focused cases/contract/runner/CLI/validator、Mock CLI 两次、validator、Agent full/typecheck/lint、AI tests、`git diff --check`。

**完成记录（2026-07-23）：** 已实现固定 72-case / 24 zero-call / 48 runtime / 24 paired index / 32 Organizer decision units 的 strict report。zero-call 实际穿过 candidate/preflight guard并由独立 counter 证明 0 调用；48 runtime 在每个 paired index 内并行，throw/schema/usage 失败仍保留分母。报告重算 dataset SHA、prompt/schema/projection identity、两个 semantic score、critical、P95、usage 与 CNY；Mock 两次均为 `24/24`、`48/48`、Tutor/Organizer semantic `1/1`、P95 `246/328/328/276ms`、synthetic usage `21948/5647`、cost `0.099726 CNY`，但 `executorProvenance=mock_synthetic` 使 Live-only gate 保持 `quality_gate_failed`。终审把并非真实 Router/API 链路的 `chatProduct*` 更名为 `tutorOrchestration*`，并把公共 Live CLI 的 executor 注入移到 `synthetic_test` 专用入口；production gate 只接受 `deepseek_network`。focused `14/14`、Agent `543/543`、AI `194/194`、typecheck/lint、两次 Mock CLI、bundle validator 与 diff 门通过。未读取 key、调用 provider、创建 Live marker/evidence 或执行 Docker/浏览器；两个生产 gate 仍默认关闭。证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-paired-eval.md`。Task 10 后续已完成，Task 11 后续已完成；该 checkpoint 当时停在 Task 12 新授权门前；后续 V1 失败终态见当前摘要。

**提交：** `test(agent): evaluate tutor organizer candidates`

## Task 10：固定 Docker allowlist、环境示例和运维回滚（已完成）

**文件：**

- `.env.example`
- `docker/docker-compose.dev.yml`
- runtime boundary tests
- `docs/dev-start.md`、`docs/ai-behavior-acceptance.md`、`docs/acceptance-checklist.md`、data-flow/docs

**RED：** web/server positive control、worker/admin negative control、generic key 或另一组件 key 不得替代当前 component-specific key、默认 gates false、Compose config 无 secret 输出、产品验收禁止其他 Agent gate 同开。

**GREEN：**

- web 只接 Tutor config/credential；`SERVER_ROLE=api|both` 的 server 只接 Organizer config/credential；worker/admin 不接，worker role 对伪造注入也强制关闭；
- 根 `.env` 是宿主输入，Compose service environment 仍为显式 allowlist；
- 文档固定 model/profile/timeout/budget/cost、rollback、provider retention 前置、synthetic-only、exact cleanup 和非破坏 Docker 禁令；
- `docker compose ... config --quiet`，不打印解析后的 secret。

**验证：** focused config/Compose tests、Compose `config --quiet`、Web/Server build、`git diff --check`。

**完成证据：** 新 boundary RED `3/3` 精确暴露 Organizer server projection、tracked defaults 与 Admin 整份 env 注入缺口；GREEN `3/3`，与既有 Compose readiness 合跑 `24/24`。Server config/Compose focused `29/29`、Tutor config `5/5`、tracked `config --quiet`、Server/Web build 均通过。`admin` service `env_file` 已移除并保留显式 URL；resolved synthetic Compose fixture 证明 web/server 正向投影和 worker/admin 负向隔离，generic/cross-component key 均不可替代。未读取根 `.env`/key、调用 provider、启动 Docker service 或执行 API/浏览器；Task 10 完成时的下一任务 Task 11 现已完成。证据见 `docs/acceptance/phase-6-9-7-runtime-boundaries.md`。

**提交：** `chore(agent): wire phase 6.9.7 runtime boundaries`

## Task 11：分支全量静态/Mock checkpoint 与独立复审

**状态：已完成。** focused `97/97`、Agent `543/543`、AI `194/194`、Types `42/42 + tsc`、Server `2152 passed / 30 skipped`、Web `438/438`、Organizer PostgreSQL E2E `10/10` 与 Compose quiet config 通过。fresh Mock run `0c33c01f-802a-4f53-a6e6-538b7af9abc7` 为 `24/24` zero-call、`48/48` runtime、semantic `1/1/1`；Live-only gate 按设计为 `quality_gate_failed`。无 credential/provider/Live/产品 Docker/浏览器，当前停在 Task 12 新授权门。证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-agents.md`。

**动作：**

- 重跑两个 Agent focused、Agent/AI/Types/Server/Web full tests；
- typecheck、lint、build、必要 e2e、Compose quiet config、Mock runner/validator；
- 两个互相独立的只读复审：contract/security；operations/acceptance；
- 修复所有 Critical/Important 后重跑受影响门；
- 写 `docs/acceptance/phase-6-9-7-tutor-wrong-question-agents.md` 的分支 checkpoint；
- 确认没有 provider call、marker、Live evidence 或业务残留。

**停止条件：** checkpoint 全部通过后停止，向用户报告 deterministic baseline、Mock、权限、预算和仍未完成项；重新申请唯一 controlled-Live 明确授权。

**提交：** `docs(agent): checkpoint phase 6.9.7 hybrid agents`

## Task 12：唯一 controlled-Live、Docker/API 与可见浏览器分支验收

**当前状态（2026-07-24）：V1 已完成失败终态。** 零网络 preflight 先修复 Router/Verifier 真实 gate 名称漏检并提交 clean hardening；随后唯一 run `39a62241-0f51-45be-a423-0d13b0b60ae4` 使用 `deepseek_network` 完成 72 cases。zero-call、安全、延迟、usage 与 `0.086418 CNY` 费用门通过，但 strict runtime 仅 `27/48`；Tutor semantic `0.3485119048`、绝对提升 `-0.0933547619`，Organizer semantic `0.7000000000`、绝对提升 `0.4218750000`，最终 `quality_gate_failed`。marker/evidence 与 SHA 已封存且不得重跑。依照本任务第 3 步，Docker/API/浏览器与 synthetic 产品数据阶段未启动。证据见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-controlled-live.md`。

**前置：** 用户在 Task 11 后明确接受当前 DeepSeek 数据保留/训练边界，并授权一次 `Phase 6.9.7 Tutor/Organizer branch controlled-Live`。没有该句不得运行。

**顺序：**

1. zero-network preflight：branch/commit/clean、history immutable、env/gates/model/price/budget、evidence/marker absence；
2. 唯一 72-case Live；不论成功失败立即封存 marker/evidence，不重跑；
3. 只有 quality gate passed 才进入产品验收；
4. Tutor-only Docker Chat：candidate_applied、explicit-intent zero-call、forced failure fallback；
5. Organizer-only API：single、batch、existing/high-confidence zero-call、owner/locked-name、Trace/usage/price、只改组织层；
6. 可见浏览器 `/chat` 与 `/error-book`，覆盖 1440/510/390px，窗口保留；
7. 精确清理 synthetic user/question/group/deck/item/Trace/session/storage；
8. 恢复 mock、gates=false、两条 component-specific credential 均 absent，保留 volumes/services。

**复审：** Live evidence 独立复核确认 gate 失败且不得进入 product/cleanup；原计划中的 product/cleanup 复审因产品验收未启动而不适用。

**提交：** `docs(agent): seal phase 6.9.7 v1 live failure`

## Task 13：分支收尾、main 合并复验与远程推送

**当前状态：不得开始。** Task 12 V1 与 V2 R7 都未通过阶段完成定义，不能把失败分支合并为 Phase 6.9.7 完成。V2 一次性 marker/evidence 已封存且不得重跑；当前只能先做零 Provider V3 失败复盘设计。只有未来新的质量 authority、产品验收与分支最终文档全部通过后，才能另行恢复 main 合并复验与远程推送计划。

**分支：**

- 同步 AGENTS/README/DEVLOG/roadmap/data-flow/AI behavior/checklist/dev-start/acceptance 的最终数值、SHA、边界和回顾问题；
- 确认 Live/evidence 不重跑、工作区干净；
- 提交最终文档。

**main：**

- 切回最新 `main`，确认 remote parity；
- `git merge --no-ff codex/phase-6-9-7-tutor-wrong-question-agents`；
- 读取 committed Live/product authority，不重跑已消费 controlled-Live；
- 重跑 focused/static/Mock、default-off Docker API 与可见 `/chat`/`/error-book`；
- 精确清理，确认 gates=false/key absent/volumes retained；
- 推送 `main`，核对 `origin/main...HEAD = 0 0` 与远程 SHA；
- 清理已合并普通本地分支仅在确认用户不需要保留时执行，不创建/遗留 worktree。

**提交：** `docs(agent): complete phase 6.9.7 main acceptance`

## 阶段完成定义

只有同时满足以下条件，才能称 Phase 6.9.7 完成：

- 72-case deterministic/Mock/唯一 controlled-Live 证据齐全且质量门通过；
- Tutor 真实模型与 deterministic 混合路径在实际 Chat 可用；
- Organizer single/batch 真实模型路径、owner/locked-name/并发/Trace/组织层写隔离在实际 API 可用；
- default-off、zero-call、timeout/schema/usage/cost/abort/stale/Trace failure 降级可复现；
- Docker 与可见浏览器通过且只精确清理合成资源；
- 分支与 main 验收、文档、远程推送全部完成；
- 两个 production gate 最终恢复 `false`。

随后进入 Phase 6.9.8，不进入 Phase 6.10，也不提前写两篇博客。
