# Phase 6.9.6 Knowledge Agents Checkpoint, V2 Live, Product, and Main Acceptance

## 结论

Phase 6.9.6 Task 12 的分支静态与 Mock checkpoint、V2 remediation、唯一 V2 controlled-Live、R7 Docker/API 以及可见 `/knowledge` 分支验收均已完成。唯一 `knowledge-agents-v1` controlled-Live 因语义质量门失败而只读封存；唯一 V2 controlled-Live 的不可变结论为 `quality_gate_passed`。R1--R6 的失败终态仍完整保留，R7 成功不覆盖或改写任何历史 attempt。

Phase 6.9.6 已完成。`KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=false` 与 `KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=false` 继续是生产默认值；V1/V2 controlled-Live 与 R1--R7 都不得重跑。R6 暴露的真实 PostgreSQL `ntile(bigint)` shortlist 缺陷已修复；R7 在修复镜像上证明完整产品链路可用，可见浏览器与精确清理也已通过。分支收尾、`--no-ff` main 合并、main default-off 静态/Docker/API/浏览器回放、精确清理和远程推送均已完成。

## 范围与仓库状态

- 日期：2026-07-21 至 2026-07-22
- 分支：`codex/phase-6-9-6-knowledge-agents`
- Task 12 起点：`180fa15 docs(agent): operate knowledge semantic agents`
- R7 / browser pinned HEAD：`1ce77ff3e6e75ff4d7bb6e97a354113f1c2b068f`
- Task 12 checkpoint 当时与 `origin/main` 的起点关系：behind `0` / ahead `13`
- 分支验收覆盖静态、Mock、唯一 V2 provider run、Docker/API、可见 `/knowledge`、合成数据精确清理与独立复审；main 增量章节另记录合并后的 default-off 回放、最终清理与远程 parity。

Task 12 当时的“无 provider/Docker/browser”边界只描述该历史 checkpoint；后续增量结果分别记录在 V1/V2 Live、R1--R7 和浏览器章节中，不得用后续成功改写早期 evidence。

## 2026-07-22 V1 controlled-Live 增量结论

- run ID：`35cef6a3-97ee-4cb3-accb-ff8fa6bd59cd`
- prompt：`knowledge-agents-v1`
- evidence：`.tmp/phase-6-9-6-knowledge-agent-branch-live-35cef6a3-97ee-4cb3-accb-ff8fa6bd59cd.json`
- counts：72 cases / 24 zero-call / 48 runtime / 24 paired requests
- safety：critical / permission / mutation / broader fallback 全部为 0
- canonical schema success：41 / 48；7 个无效 runtime 均为 Dedup `07..11, 13, 16`
- Dedup：macro-F1 `0.6807692307692308`，revision recall `0`
- Organizer：subject top-1 `0.75`，tag micro-F1 `0.619718309859155`，collection pairwise-F1 `1`
- latency P95：Dedup `1420ms` / Organizer `2066ms` / endpoint `2068.2995ms`
- verified usage：input `22882` / output `3993`
- cost：`0.092604 CNY`
- gate：`quality_gate_failed`
- evidence SHA-256：`9d56d4b474065b7476feb16a0509b755c032c6a346d63a894fe91b4b18f74923`
- marker SHA-256：`228016fcd52ca2dc411e2d9e96c12d18d01aa63e87a8c8ef1605c1e973b0b246`

V1 evidence 没有保存 provider 原始 evidenceCodes，因此只能证明 7 个条目 raw relation 可解析但 candidate 未应用，不能追写具体 provider 数组。源码诊断同时发现：V1 prompt 未列 relation/evidence 关联矩阵；eval projection 把 revision 时间错误压成 `same_time`；Organizer prompt 缺少 subject/topic 精度边界，且 evaluator 计入了产品 merger 不会应用的第二 topic label。V2 R1--R3 已分别修复这些合同并增加布尔/枚举诊断；没有放宽任何安全或质量阈值。

## Focused 验收

| 范围 | 命令 | 结果 | 耗时 |
| --- | --- | ---: | ---: |
| Agent Knowledge | `bun test packages/agent/tests/knowledge-*.test.ts packages/agent/tests/phase-6-9-knowledge-agent-*.test.ts` | 114 / 114 | 0.925s |
| Types Knowledge | `node --experimental-strip-types --test packages/types/tests/knowledge-agent.test.mts` | 1 / 1 | 0.177s |
| Server Knowledge | `bun --filter @repo/server test -- knowledge-agent --runInBand` | 50 / 50 | 2.634s |
| Web Knowledge | `node --experimental-strip-types --test apps/web/src/lib/knowledge-agent-*.test.mts "apps/web/src/app/(main)/knowledge/page.test.mts"` | 7 / 7 | 0.246s |
| Review/Planner 历史兼容 | focused V9、V17--V22 suites | 71 / 71 | 通过 |

Web focused runner 使用 Node test runner；原计划中的 Bun 命令不能正确代表这些 `.mts` Node tests，已在实施计划中修正。

## 分支级静态门禁

| 包/门禁 | 结果 |
| --- | --- |
| Agent tests | 465 / 465，5.94s |
| Agent typecheck | exit 0，2.687s |
| Agent lint | exit 0，4.805s |
| Types tests | 39 / 39，1.879s |
| Server tests | 2110 passed / 30 skipped，219 suites passed / 3 skipped，85.268s |
| Server build | exit 0 |
| Web tests | 413 / 413，1.815s |
| Web lint | exit 0 |
| Web production build | exit 0 |
| `git diff --check` | exit 0 |

Server 全量第一次运行暴露 7 个历史跨平台/fixture 测试问题和 1 个 PostgreSQL 环境阻塞。7 个测试问题按下述兼容性边界修复；随后只启动 Docker Desktop 和既有 `postgres` service（保留原卷、不重置数据）补跑完整 Server gate，数据库 integration 与其余 suite 一并通过。这里不是 Docker 产品验收，没有启动 API/Web/worker 验收流程。

## Deterministic 与 Mock 证据

### 未修饰 deterministic baseline

- dataset：`phase-6.9-knowledge-agents-v1`
- cases：72（24 zero-call contract + 48 runtime quality）
- paired requests：24
- 完整 runtime pass：12 / 48
- critical failures：0
- semantic score：`0.2322452551`
- provider / token / cost：0 / 0 / 0 CNY

### Task 12 Strict Mock（V1 历史 checkpoint）

- run ID：`1db4491a-7e13-43d4-83ee-317b4dbec045`
- evidence：`.tmp/phase-6-9-6-knowledge-agent-branch-mock.json`
- zero-call：24 / 24，独立 executor counter 为 0
- canonical schema：48 / 48
- semantic score：`1`
- 相对 baseline 的绝对提升：`0.7677547449`
- P95：Dedup `286ms` / Organizer `348ms` / endpoint `348ms`
- verified usage：input `14472` / output `4185`
- 估算成本：`0.068526 CNY`
- safety：critical / permission / mutation / broader fallback 均为 0
- validator：`{"ok":true,"evidenceCount":1}`
- report gate：`quality_gate_failed`

Mock 的 `quality_gate_failed` 是固定生产门设计：`computeKnowledgeGate()` 只允许 `mode=live`、`provider=deepseek`、`model=deepseek-v4-pro` 且全部质量/延迟/usage/价格/安全阈值满足时通过。Mock 满分只能证明工程合同和安全门，不得被写成真实语义质量或生产启用证据。

### V2 R4 Strict Mock checkpoint

- run ID：`05516dae-e8d3-42df-ba6b-3ffd41e99db6`
- prompt：`knowledge-agents-v2`
- evidence：`.tmp/phase-6-9-6-knowledge-agent-branch-mock-v2.json`
- counts：72 cases / 24 zero-call / 48 runtime / 24 paired requests
- zero-call：24 / 24，独立 executor counter 为 0
- runtime：48 / 48
- Dedup macro-F1 / revision recall：`1 / 1`
- Organizer subject / tag / collection：`1 / 1 / 1`
- semantic score / absolute improvement：`1 / 0.7677547449`
- P95：Dedup `286ms` / Organizer `348ms` / endpoint `348ms`
- verified usage：input `14472` / output `4185`
- 估算成本：`0.068526 CNY`
- validator：`{"ok":true,"evidenceCount":3}`
- evidence SHA-256：`2dfa326018bba9912b8e8faf35b7fb9f2c41b33d7e655e4e5e8c8472ecc23958`
- report gate：`quality_gate_failed`（Mock 的 Live-only production gate 预期结果）

R4 还通过 Knowledge focused `117/117`、Agent 全量测试/typecheck/lint、Types `39/39` + typecheck、Server Knowledge `50/50` + build、Web Knowledge `7/7` + lint。V2 Mock 使用独立文件，不覆盖 Task 12 Mock 或 V1 Live evidence；本轮没有设置 V2 Live 授权变量，没有创建 V2 Live evidence/marker，也没有调用 provider。

## Evidence SHA-256

| 文件 | SHA-256 |
| --- | --- |
| `docs/acceptance/phase-6-9-6-1-knowledge-agent-baseline.md` | `4ab83ed5b763993880a4b3ba4bce23fcad0e52a892fb4f59be0216ada10241ef` |
| `.tmp/phase-6-9-6-knowledge-agent-branch-mock.json` | `8647b2a1e7f8e2882730b6363520c7dd5e2ca2be47f8036aa1ab8bf67c829ebf` |
| `.tmp/phase-6-9-6-knowledge-agent-branch-mock-v2.json` | `2dfa326018bba9912b8e8faf35b7fb9f2c41b33d7e655e4e5e8c8472ecc23958` |
| `packages/agent/src/evals/phase-6-9-knowledge-agent-cases.ts` | `2d7d6d30415796f43fa10bc571641fb02318732096a77b6e0c57d10ea943c12e` |
| `packages/agent/scripts/validate-phase-6-9-6-knowledge-agent-evidence.ts` | `f2dbe6b7098a844be5c161ded3cec4e435bd49f14e09c2f8b7b434e157bb63eb` |

## 本轮发现与收口

1. Windows checkout 会把历史 acceptance evidence 的 LF 字节转换为 CRLF，破坏已有 SHA-256 authority。新增 `.gitattributes` 将 `docs/acceptance/evidence/**` 固定为 `-text`，并把工作区 evidence 恢复为 Git blob 字节；历史 evidence 内容、结论和索引没有被改写。
2. V9 CLI spec 原先把 LF-only 源码片段当作跨平台合同。测试读取脚本后只做 `CRLF -> LF` 归一化，生产脚本未修改。
3. V17--V22 Bun authority bridge tests 原先依赖真实历史 evidence 目录；该目录对旧 lineage pin/运行时顺序保持严格 fail-closed。host factory 现在只增加可选 `pairedEvidenceAuthority` 测试依赖，生产默认仍创建真实 Bun authority；bridge tests 注入 strict synthetic authority fixture，不放宽 evidence reader，也不伪造、重跑或改写 V1--V22 历史。
4. `production-model-candidates.test.ts` 补齐 Knowledge candidates、contracts、projection、paired runner 等公共导出检查，防止功能已实现但 package surface 未被回归保护。

## 权限、运行与清理边界

以下前四项是 Task 12 checkpoint 当时的历史事实；V1 与 V2 R4 段也只描述各自 checkpoint，不是 Task 13 最终状态。当前状态以本节末尾的 Task 13 增量和后续 R7/浏览器章节为准。

- 没有读取或打印 `.env` 中的 API key，没有调用 DeepSeek、Qwen embedding 或其它真实 provider。
- 没有设置 `PHASE_6_9_6_CONTROLLED_LIVE_APPROVED=true`，没有启用两个 Knowledge gate。
- 没有执行 Docker API/worker/web/admin 或可见浏览器产品验收；仅恢复既有 PostgreSQL service 以完成全量 Server integration gate。
- 没有创建合成账号、Document、Chunk、MinIO object、BackgroundJob、Agent Trace 或浏览器 storage，因此没有业务对象需要清理。
- 没有执行 `docker compose down -v`、Docker prune、volume/database reset、Redis flush 或 MinIO wipe；既有 Docker 数据卷保持不变。
- Agent 仍是只读 adviser：不自动删除、替换、合并、改名、分类或持久化标签/集合，真实 ID、权限、事实、schema、预算、价格与写入边界继续由本地代码权威控制。

V1 增量：真实 DeepSeek 调用只发生于独立 CLI 合成评测，没有创建账号、Document、Chunk、MinIO object、BackgroundJob、Agent Trace 或浏览器 storage，因此没有业务对象可清理；没有启动 Docker 产品验收，也没有执行任何破坏性 Docker/数据库/Redis/MinIO 操作。根 `.env` 的 key 值没有打印、写入 evidence、文档或 Git。两个产品 gate 和全局运行配置保持 default-off。

V2 R4 增量：本轮只执行本地测试、Mock runner、evidence validator 与只读状态核对。V1 Live evidence/marker SHA-256 仍为 `9d56d4b474065b7476feb16a0509b755c032c6a346d63a894fe91b4b18f74923` / `228016fcd52ca2dc411e2d9e96c12d18d01aa63e87a8c8ef1605c1e973b0b246`；V2 Live evidence 与 `.tmp/phase-6-9-6-knowledge-agents-v2-controlled-live.marker` 不存在。根环境未显式设置两个 Knowledge gate，代码/Compose 继续解析为 default-off；既有 Docker 服务与 `docker_pgdata` / `docker_miniodata` 卷只读核对后保持原状，没有启停、重建或清理。

Task 13 当前增量：唯一 V2 Live evidence/marker 已按用户授权创建并封存，随后只有 R7 产品 run 产生真实模型调用。浏览器验收没有新增模型调用。R7 与浏览器专用合成数据已精确清理，API 恢复 mock/live=false/双 gate=false/Knowledge credential absent，worker 未接收 Knowledge 能力，Docker 卷保持原状。key 值从未进入 evidence、文档、Git 或安全 stdout；本地精确清理不宣称删除外部 provider retention/log。

## V2 授权后零调用 preflight 修复

用户于 2026-07-22 接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权唯一一次 V2 branch controlled-Live。执行前的 credential-isolation 复核发现 standalone eval CLI 仍读取通用 `DEEPSEEK_API_KEY`，与 Task 11 已完成的独立 `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY` 边界不一致；因此没有运行 Live，也没有创建 V2 marker/evidence。

修复后 CLI 只接受 dedicated Knowledge credential。新增测试证明 generic-only 配置会在 marker/executor 前返回 `live_configuration_invalid` 且 provider invocation 为 0；RED/GREEN 为 `7 pass / 2 fail -> 9/9`，Agent 全量 `469/469`、typecheck/lint/diff 通过。该修复未修改 V2 prompt、dataset、schema、预算、价格、timeout、质量门、marker/evidence contract 或根 `.env`，所以不消耗、扩展或替代用户已经给出的唯一一次 V2 授权。

## V2 controlled-Live 权威

- run ID：`10ae2f36-69f6-422c-a99f-6bf6b3aeb226`
- prompt：`knowledge-agents-v2`
- gate：`quality_gate_passed`
- counts：72 cases / `24/24` zero-call / `48/48` runtime
- semantic score：`0.9875`
- estimated cost：`0.117498 CNY`
- evidence SHA-256：`c0a6d06a94438dddedb24b78e271eb7b4df1bd6089949bd0b7692d8570c707ff`
- marker SHA-256：`0940cee101cc219b8a691e8eba6ddc9dc33197e2eec20048ac46d269ef8d7ac5`

该 evidence 与 marker 是唯一 V2 语义质量 authority，不得重跑、删除、覆盖、重建或与产品验收 attempt 拼接。它证明受治理 candidate 在固定 72-case 上达到质量门，不自动证明 Docker composition、产品 API、浏览器 UI、Trace 持久化、owner isolation 或 default-off 回滚。

## Docker/API 产品验收 R1--R6 与 shortlist 根因

| Attempt | 终态 | 最窄可证边界 |
| --- | --- | --- |
| R1 `b3a667f2-d907-4a0e-9792-377b9c75192b` | pre-provider operation failure | 外层 Docker 命令超时；未创建 fixture、未进入模型阶段；cleanup passed |
| R2 `4e4c06e2-978a-4814-8d24-31536003262e` | Live startup failure | 上传/处理/列表/检索通过，raw cosine `0.957066`；ConversationSummary 错误要求通用 DeepSeek key，provider 0 次 |
| R3 `d2ddc946-b457-429f-8d33-56ba83f2b726` | first endpoint unexpected | 发出 1 个 Dedup endpoint 请求，但旧 harness 未先保存 runtime；只能记为 `unknown_zero_or_one`，不得推断成功或零调用 |
| R4 `ea76481c-5a8b-4cbe-91f7-3ac81d621fd3` | fixture guarded | `exact_hash_only / not_eligible / attempted=false / 0 token / 0 CNY`，证明旧夹具混入 exact clone；provider 0 次 |
| R5 `e76022d0-3d26-4d4f-8de7-a9693c2a41af` | pre-fixture health timeout | Git Bash 继承 loopback proxy 且缺少 `NO_PROXY`；`modes=[]`、provider 0 次、零资源 cleanup passed |
| R6 `0899a8f2-91e6-4a5a-93a7-4928fac2f020` | semantic shortlist empty | API compatibility 与语义夹具通过，但 Dedup 为 `no_semantic_pair / attempted=false / 0 CNY`；精确清理 passed |

R5 之后的 launcher 只为宿主 `127.0.0.1,localhost,::1` 设置进程级 `NO_PROXY`；Compose 不向 server 注入该变量，因此不会改变 DeepSeek HTTPS 网络边界。R6 的两份新处理资料各有 1 个 Chunk，provenance 精确为 Qwen `text-embedding-v4 / 1536`，safety 为 `low / safeForPrompt=true`，content hash 不同，raw max 与 top-3 mean 都为 `0.9570656393209498`，仍然得到空 shortlist。

真实 PostgreSQL 诊断进一步确认 source 第一条查询抛出 Prisma `P2010 / SQLSTATE 42883`。原因是 Prisma 将 `ntile(${6})` 的数字参数绑定为 `bigint`，而 PostgreSQL 只有 `ntile(integer)`；source 按既定 fail-closed 语义捕获查询异常并返回空 shortlist，因此 provider 正确保持 0-call。修复只把表达式改为 `ntile(${6}::integer)`，其余 owner、DONE、vector dimensions、provenance、safety、exact-hash、target 和 top-3 mean 条件均未改变。

验证证据：

- RED：focused Jest `11 passed / 1 failed`，新断言证明旧 SQL 仍为 `ntile(?)`。
- GREEN：focused Jest `12/12`；相关 Knowledge Server `32/32`；Server build、focused ESLint 与 `git diff --check` 通过。
- 修复前真实 PostgreSQL：manual eligible/pair rows 为 `2/1`，source telemetry 为 `P2010/42883`，shortlist `0/0`。
- 修复后真实 PostgreSQL：source 两条参数化查询分别返回 `2/1` rows；shortlist 为 `2` selected chunks、`1` high pair，score `0.957065639321`。
- 每次诊断均只使用合成账号/资料，User/Document/Chunk/MinIO object/Trace/Job residue 为 0；没有清空或重置 Docker、PostgreSQL、Redis 或 MinIO。

## Docker/API 产品验收 R7

- run ID：`38748577-f250-4a7a-ab17-8fd14a63b2a3`
- scope / product attempt：`branch / v2-r7`
- pinned branch / HEAD：`codex/phase-6-9-6-knowledge-agents@1ce77ff3e6e75ff4d7bb6e97a354113f1c2b068f`
- evidence：`.tmp/phase-6-9-6-knowledge-agent-branch-product-v2-38748577-f250-4a7a-ab17-8fd14a63b2a3.json`
- evidence SHA-256：`ad8b242562d73d2a697648e66cc9c6ac755d1ae7db00149e3a631f1191016468`
- marker SHA-256：`0c62a62f210aedcf7348478ed6d60da565d5b89316e67da0b10370728d8bc9db`
- result：`status=passed`

R7 在包含 `ntile(?::integer)` 修复的新 server 镜像上运行，先绑定唯一 V2 Live authority，再按独立 lineage 验证产品：

| 模式 | Dedup | Organizer | usage / cost |
| --- | --- | --- | --- |
| Dedup-only | `candidate_applied / possible_revision` | `gate_disabled` | `820/59`，`0.002814 CNY` |
| Organizer-only | `gate_disabled` | `candidate_applied / semantic_organization` | `1065/164`，`0.004179 CNY` |
| Both enabled | `candidate_applied / possible_revision` | `candidate_applied / semantic_organization` | `1885/223`，`0.006993 CNY` |
| Forced provider failure | `fallback_runtime_error / provider_error` | `gate_disabled` | `0/0`，unknown cost，安全降级 |
| Default-off | `gate_disabled` | `gate_disabled` | `0/0`，无 Trace step |

聚合为 `5` 个 attempted agent calls、`4` 个 `candidate_applied`、input/output `3770/446`、`0.013986 CNY`。每个 attempted success 都有 API/Trace usage parity、`pricingKnown=true` 和一个 parent + 两个 candidate step；forced failure 保持本地建议且不伪造 usage/cost。上传、处理、列表、检索均通过，语义夹具 pair score 为 `0.957066`。

provider 前 guard 全部通过：exact hash 为 `exact_hash_only`，credential 与 prompt injection 为 `target_projection_blocked`，unsafe metadata 为 `no_semantic_pair`，cross-owner target 为统一 404 且 Trace delta 0。五类 guard 均为 zero-call。产品前后只读 fingerprint 相同，automatic Document/Chunk/tag/collection mutation 为 0。worker 没有 Knowledge credential/gate；Review/Planner gate 保持关闭。

清理删除的范围精确绑定本轮 2 个 synthetic owner、7 份 synthetic Document 与 2 个匹配 MinIO object。清理后 User/Document/Chunk/BackgroundJob/Trace/TraceStep/Session/RefreshToken/MinIO residue 全为 0；没有 database reset、volume delete 或 Redis flush。API 恢复 `mock / live=false / dedup=false / organizer=false / credential absent`。R7 evidence 与 marker 不得重跑、删除、覆盖、重建或解释为 V2 quality authority。

## 可见 `/knowledge` 浏览器验收

- run ID：`012bc3ce-486e-4dce-be32-d29c246f47cd`
- evidence：`.tmp/phase-6-9-6-knowledge-agent-branch-browser-v2-012bc3ce-486e-4dce-be32-d29c246f47cd.json`
- evidence SHA-256：`5a9a4cba005ba3ec10e031ed17e5f41981a685dc62c6672695db41cabc024299`
- marker SHA-256：`6a75430f8aebfa8c7278c641504ff5fa5d6d0502d103088c98cb3927846cfe79`
- bound R7 authority：run `38748577-f250-4a7a-ab17-8fd14a63b2a3`，evidence/marker hashes 与上节一致
- Live calls during browser acceptance：`0`

初次检查发现 Docker `web` 使用约 40 小时前的旧镜像：API 已返回严格来源状态，但页面还没有新 badge。只从 pinned HEAD 重新构建并替换 web 容器后恢复；server authority、数据库和数据卷没有变化。

实际 Docker 路径注册一个专用合成账号，完成 TXT 上传、处理、列表和 Qwen 混合检索命中；default-off 页面显示“本地规则建议”，建议面板自动操作按钮为 0。semantic、degraded 与 failure 使用符合当前 strict response schema、并绑定 R7 authority 的 UI replay，只验证渲染，不再次调用 provider，也不声称第二份语义质量证据。空态、失败态、local/semantic/degraded、上传、处理和检索均覆盖。

桌面宽度为 1440px，移动宽度为 510px / 390px；无横向溢出，390px 建议面板 `scrollWidth=clientWidth=357`。四张截图及 SHA-256：

- `.tmp/phase-6-9-6-browser-mobile-local.png`：`acaec1a902c7f20df015deea92bf8af7acf7c56204c2e821ac2f7552278385f6`
- `.tmp/phase-6-9-6-browser-desktop-local.png`：`5300e2c5ec9bc9ad7b9df1648fdcebffc81e6347e4f212bc3e2604be9d3be62b`
- `.tmp/phase-6-9-6-browser-desktop-semantic-replay.png`：`7400c709dafb53953173f51708a5c6340d99cf8ccd6daea3456cd5a4ebc8c6bb`
- `.tmp/phase-6-9-6-browser-desktop-degraded-replay.png`：`76d1ce1e5984164157af8d416441626293a9c4ba799fafbf8634b7bcb7855e17`

浏览器验收后 synthetic User/Document/Chunk/BackgroundJob/Trace/TraceStep/Session/RefreshToken 与 R7 synthetic users 均为 0；匹配 MinIO object 为 0；cookie、localStorage、sessionStorage、IndexedDB 和 cache 均清空。`docker_pgdata`、`docker_miniodata` 保留，未执行 prune、`down -v`、database/volume reset、Redis flush 或 MinIO wipe。API/worker isolation 和默认关闭状态与 R7 清理结果一致。

两个独立只读复审分别检查 evidence/marker/hash/lineage 和安全/权限/清理/响应式结果，结论均为 APPROVED，无 Critical/Important。

## main default-off 回放与最终清理

- 分支文档收尾提交：`33604040`
- main merge：`f31335c6068554d0f272562c1fbbf8da2184cd32`（`--no-ff`）
- 真实模型调用：`0`；唯一 V2 Live、R7 和分支浏览器 authority 均未重跑或改写
- main focused：Agent `118/118`，Types `1/1`，Server `50/50`，Web `7/7`；相关 typecheck/lint/build 均为 exit `0`

main 从当前源码重建 server/worker/web。Compose BuildKit 在构建前两次因宿主会话字段 `x-docker-expose-session-sharedkey contains value with non-printable ASCII characters` 失败，均未进入业务或数据步骤；随后使用同一 Dockerfile 的 legacy builder（`DOCKER_BUILDKIT=0`）成功构建，并以 `--no-build --force-recreate` 启动。server/worker 健康，PostgreSQL、Redis、MinIO、Admin 与 `docker_pgdata` / `docker_miniodata` 均保留。

可见浏览器在 main 真实 Docker 路径创建一个独立合成账号，完成 TXT 上传、Qwen embedding 处理、资料列表、混合检索和建议读取。HTTP 结果为 suggestions `200`、upload `201`、process `201`、search `201`；资料最终为 `DONE`、1 个 Chunk，检索页面相似度 `0.55`。default-off 页面显示“本地规则建议”、不显示“语义建议”，没有自动合并、删除、替换、重命名或分类控件。移动端 `390x844` 的 html/body 均为 `scrollWidth=clientWidth=390`；桌面 `1440x900` 为 `1430=1430`，均无横向溢出。控制台只有登录前 refresh `401` 和普通账号访问 admin-only worker observability 的预期 `403`。

main 截图及 SHA-256：

- `.tmp/phase-6-9-6-main-replay-mobile-default-off.png`：`626b8da913d3f581e2f4438d11bbcad7b7cad6cfbab6b337cb4e56479e9e60d9`
- `.tmp/phase-6-9-6-main-replay-desktop-default-off.png`：`b46fb4c40b913053813b92fed9b8b91e632af62b9a18d3871cde0ffc80f65d27`

清理先通过 owner-scoped `DELETE /knowledge/documents/:id` 删除唯一 Document/Chunk 与精确 MinIO object，再删除唯一合成 User 并级联清理 refresh token。User/Document/Chunk/ACCOUNT BackgroundJob/AgentTraceRun/AgentTraceStep/Session/RefreshToken 与匹配 MinIO object residue 全为 `0`；浏览器 cookie/localStorage/sessionStorage/IndexedDB/cache 全为 `0`，窗口保留在登录页。server 最终为 `AI_PROVIDER_MODE=mock`、live=false、Dedup=false、Organizer=false、Review=false、Planner=false、Knowledge credential absent；worker 不含 Knowledge gate/credential。没有 prune、`down -v`、database/volume reset、Redis flush 或 MinIO wipe。最终远程 parity 为 `origin/main...HEAD = 0 0`。

## 阶段判定与下一步

- Task 12：分支静态/Mock checkpoint 已完成。
- Phase 6.9.6：已完成。
- production gate：保持 `false / false`。
- V1 controlled-Live：已完成一次，结论失败且不可重跑。
- V2 controlled-Live：唯一 run 已 `quality_gate_passed`，不得重跑。
- V2 product R1--R6：历史终态全部保留；R6 暴露的 shortlist PostgreSQL 参数类型缺陷已按 TDD 修复并通过真实数据库诊断。
- V2 product R7：Docker/API、Trace、只读权限、worker isolation、zero-call guards、精确清理均已通过且不得重跑。
- 可见浏览器：真实上传/处理/检索、local/semantic/degraded/error/响应式与清理已通过；本轮新增 Live call 为 0。
- 独立复审：两项均 APPROVED，无 Critical/Important。
- main 收尾：`--no-ff` 合并、default-off 静态/Docker/API/可见 `/knowledge` 回放、精确清理和远程 parity 均已通过；没有重跑 V2 controlled-Live 或 R7。
- 下一步：从最新 main 新建普通 `codex/` 分支进入 Phase 6.9.7 TutorAgent / WrongQuestionOrganizerAgent 混合模型路径；不得提前进入 Phase 6.10。

## 回顾时可以问

- “为什么 Mock semantic=1 仍是 `quality_gate_failed`？”
- “24/24 zero-call 是怎样避免靠 expected reason 自证的？”
- “为什么 Knowledge Agent 只让模型返回 ordinal 与受限关系？”
- “为什么 V17--V22 测试要注入 synthetic authority，而生产仍保持 Bun evidence fail-closed？”
- “Task 12 为什么启动了 PostgreSQL，却仍不算 Docker 产品验收？”
- “controlled-Live 前还需要哪些显式门与 provider retention 前提？”
- “V1 与 V2 为什么必须使用不同的授权变量、evidence 文件和一次性 marker？”
- “为什么 raw cosine 0.957 仍然可能在 provider 前返回 `no_semantic_pair`？”
- “Prisma 参数化 SQL 为什么会把 `ntile(6)` 变成 PostgreSQL 不接受的 `ntile(bigint)`？”
- “为什么 R7 成功必须新增 lineage，而不能覆盖 R1--R6？”
- “为什么浏览器 semantic/degraded 采用绑定 R7 authority 的 response replay，而不再次调用真实模型？”
- “为什么 gate 恢复关闭表示安全回滚，而不表示 Knowledge Agent 不能使用真实模型？”
