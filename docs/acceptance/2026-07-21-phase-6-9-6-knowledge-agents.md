# Phase 6.9.6 Knowledge Agents Branch Checkpoint, V1 Live Verdict, and V2 R4

## 结论

Phase 6.9.6 Task 12 的分支静态与 Mock checkpoint 已完成。随后经用户明确授权执行了唯一一次 `knowledge-agents-v1` controlled-Live：工程、安全、延迟、usage 与费用门通过，但 Dedup/Organizer 语义质量未达到固定阈值，最终不可变结论为 `quality_gate_failed`。

当前仍不是 Phase 6.9.6 最终完成态。`KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=false` 与 `KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=false` 继续是生产默认值；V1 不得重跑，Docker API 与可见浏览器产品验收尚未开始。独立 V2 remediation 的 R1--R4 静态/Mock checkpoint 已完成，当前停在一次新的 V2 Live 明确授权门前。

## 范围与仓库状态

- 日期：2026-07-21
- 分支：`codex/phase-6-9-6-knowledge-agents`
- Task 12 起点：`180fa15 docs(agent): operate knowledge semantic agents`
- 与 `origin/main` 的起点关系：behind `0` / ahead `13`
- 本检查点只覆盖静态、Mock、文档与兼容性测试修复；不覆盖真实 provider、Docker API、可见 `/knowledge`、合成账户/资料、main 合并或远程推送。

以上范围描述是 Task 12 当时的 checkpoint 边界；2026-07-22 的 V1 controlled-Live 增量证据见下节，Docker/API/浏览器/main 边界仍未改变。

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

以下前四项是 Task 12 checkpoint 当时的历史事实；V1 Live 之后以本节末尾的增量说明为当前状态。

- 没有读取或打印 `.env` 中的 API key，没有调用 DeepSeek、Qwen embedding 或其它真实 provider。
- 没有设置 `PHASE_6_9_6_CONTROLLED_LIVE_APPROVED=true`，没有启用两个 Knowledge gate。
- 没有执行 Docker API/worker/web/admin 或可见浏览器产品验收；仅恢复既有 PostgreSQL service 以完成全量 Server integration gate。
- 没有创建合成账号、Document、Chunk、MinIO object、BackgroundJob、Agent Trace 或浏览器 storage，因此没有业务对象需要清理。
- 没有执行 `docker compose down -v`、Docker prune、volume/database reset、Redis flush 或 MinIO wipe；既有 Docker 数据卷保持不变。
- Agent 仍是只读 adviser：不自动删除、替换、合并、改名、分类或持久化标签/集合，真实 ID、权限、事实、schema、预算、价格与写入边界继续由本地代码权威控制。

V1 增量：真实 DeepSeek 调用只发生于独立 CLI 合成评测，没有创建账号、Document、Chunk、MinIO object、BackgroundJob、Agent Trace 或浏览器 storage，因此没有业务对象可清理；没有启动 Docker 产品验收，也没有执行任何破坏性 Docker/数据库/Redis/MinIO 操作。根 `.env` 的 key 值没有打印、写入 evidence、文档或 Git。两个产品 gate 和全局运行配置保持 default-off。

V2 R4 增量：本轮只执行本地测试、Mock runner、evidence validator 与只读状态核对。V1 Live evidence/marker SHA-256 仍为 `9d56d4b474065b7476feb16a0509b755c032c6a346d63a894fe91b4b18f74923` / `228016fcd52ca2dc411e2d9e96c12d18d01aa63e87a8c8ef1605c1e973b0b246`；V2 Live evidence 与 `.tmp/phase-6-9-6-knowledge-agents-v2-controlled-live.marker` 不存在。根环境未显式设置两个 Knowledge gate，代码/Compose 继续解析为 default-off；既有 Docker 服务与 `docker_pgdata` / `docker_miniodata` 卷只读核对后保持原状，没有启停、重建或清理。

## V2 授权后零调用 preflight 修复

用户于 2026-07-22 接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权唯一一次 V2 branch controlled-Live。执行前的 credential-isolation 复核发现 standalone eval CLI 仍读取通用 `DEEPSEEK_API_KEY`，与 Task 11 已完成的独立 `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY` 边界不一致；因此没有运行 Live，也没有创建 V2 marker/evidence。

修复后 CLI 只接受 dedicated Knowledge credential。新增测试证明 generic-only 配置会在 marker/executor 前返回 `live_configuration_invalid` 且 provider invocation 为 0；RED/GREEN 为 `7 pass / 2 fail -> 9/9`，Agent 全量 `469/469`、typecheck/lint/diff 通过。该修复未修改 V2 prompt、dataset、schema、预算、价格、timeout、质量门、marker/evidence contract 或根 `.env`，所以不消耗、扩展或替代用户已经给出的唯一一次 V2 授权。

## 阶段判定与下一步

- Task 12：分支静态/Mock checkpoint 已完成。
- Phase 6.9.6：未完成。
- production gate：保持 `false / false`。
- V1 controlled-Live：已完成一次，结论失败且不可重跑。
- V2 R1--R4：代码/合同修复与全量静态/Mock checkpoint 已完成，尚未调用 V2 provider。
- 下一步：由用户接受当前 provider retention/训练边界，并明确设置 `PHASE_6_9_6_V2_CONTROLLED_LIVE_APPROVED=true` 授权唯一一次 V2 Live。只有 V2 全部门通过后，才允许 Docker API、可见 `/knowledge`、精确清理、独立复审、分支提交、`--no-ff` 合并 main、main default-off 回放与远程推送。

## 回顾时可以问

- “为什么 Mock semantic=1 仍是 `quality_gate_failed`？”
- “24/24 zero-call 是怎样避免靠 expected reason 自证的？”
- “为什么 Knowledge Agent 只让模型返回 ordinal 与受限关系？”
- “为什么 V17--V22 测试要注入 synthetic authority，而生产仍保持 Bun evidence fail-closed？”
- “Task 12 为什么启动了 PostgreSQL，却仍不算 Docker 产品验收？”
- “controlled-Live 前还需要哪些显式门与 provider retention 前提？”
- “V1 与 V2 为什么必须使用不同的授权变量、evidence 文件和一次性 marker？”
