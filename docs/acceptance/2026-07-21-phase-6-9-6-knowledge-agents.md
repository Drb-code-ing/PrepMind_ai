# Phase 6.9.6 Knowledge Agents Branch Checkpoint

## 结论

Phase 6.9.6 Task 12 的分支静态与 Mock checkpoint 已完成。`KnowledgeDedupAgent` / `KnowledgeOrganizerAgent` 的 72-case deterministic/Mock 合同、分支级测试、类型、lint、build 与 strict evidence validator 均通过；本检查点没有调用真实模型，也没有执行 Docker API 或可见浏览器产品验收。

当前仍不是 Phase 6.9.6 最终完成态。`KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=false` 与 `KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=false` 继续是生产默认值；Task 13 必须在用户重新明确授权一次 controlled-Live 后才可开始。

## 范围与仓库状态

- 日期：2026-07-21
- 分支：`codex/phase-6-9-6-knowledge-agents`
- Task 12 起点：`180fa15 docs(agent): operate knowledge semantic agents`
- 与 `origin/main` 的起点关系：behind `0` / ahead `13`
- 本检查点只覆盖静态、Mock、文档与兼容性测试修复；不覆盖真实 provider、Docker API、可见 `/knowledge`、合成账户/资料、main 合并或远程推送。

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

### Strict Mock

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

## Evidence SHA-256

| 文件 | SHA-256 |
| --- | --- |
| `docs/acceptance/phase-6-9-6-1-knowledge-agent-baseline.md` | `4ab83ed5b763993880a4b3ba4bce23fcad0e52a892fb4f59be0216ada10241ef` |
| `.tmp/phase-6-9-6-knowledge-agent-branch-mock.json` | `8647b2a1e7f8e2882730b6363520c7dd5e2ca2be47f8036aa1ab8bf67c829ebf` |
| `packages/agent/src/evals/phase-6-9-knowledge-agent-cases.ts` | `2d7d6d30415796f43fa10bc571641fb02318732096a77b6e0c57d10ea943c12e` |
| `packages/agent/scripts/validate-phase-6-9-6-knowledge-agent-evidence.ts` | `f83e9a4a9152f2ceefd768f9283c1936c789b09eaf5bdb0b4fe4edb02d206571` |

## 本轮发现与收口

1. Windows checkout 会把历史 acceptance evidence 的 LF 字节转换为 CRLF，破坏已有 SHA-256 authority。新增 `.gitattributes` 将 `docs/acceptance/evidence/**` 固定为 `-text`，并把工作区 evidence 恢复为 Git blob 字节；历史 evidence 内容、结论和索引没有被改写。
2. V9 CLI spec 原先把 LF-only 源码片段当作跨平台合同。测试读取脚本后只做 `CRLF -> LF` 归一化，生产脚本未修改。
3. V17--V22 Bun authority bridge tests 原先依赖真实历史 evidence 目录；该目录对旧 lineage pin/运行时顺序保持严格 fail-closed。host factory 现在只增加可选 `pairedEvidenceAuthority` 测试依赖，生产默认仍创建真实 Bun authority；bridge tests 注入 strict synthetic authority fixture，不放宽 evidence reader，也不伪造、重跑或改写 V1--V22 历史。
4. `production-model-candidates.test.ts` 补齐 Knowledge candidates、contracts、projection、paired runner 等公共导出检查，防止功能已实现但 package surface 未被回归保护。

## 权限、运行与清理边界

- 没有读取或打印 `.env` 中的 API key，没有调用 DeepSeek、Qwen embedding 或其它真实 provider。
- 没有设置 `PHASE_6_9_6_CONTROLLED_LIVE_APPROVED=true`，没有启用两个 Knowledge gate。
- 没有执行 Docker API/worker/web/admin 或可见浏览器产品验收；仅恢复既有 PostgreSQL service 以完成全量 Server integration gate。
- 没有创建合成账号、Document、Chunk、MinIO object、BackgroundJob、Agent Trace 或浏览器 storage，因此没有业务对象需要清理。
- 没有执行 `docker compose down -v`、Docker prune、volume/database reset、Redis flush 或 MinIO wipe；既有 Docker 数据卷保持不变。
- Agent 仍是只读 adviser：不自动删除、替换、合并、改名、分类或持久化标签/集合，真实 ID、权限、事实、schema、预算、价格与写入边界继续由本地代码权威控制。

## 阶段判定与下一步

- Task 12：分支静态/Mock checkpoint 已完成。
- Phase 6.9.6：未完成。
- production gate：保持 `false / false`。
- 下一步：获得用户一次新的明确授权后，按 Task 13 仅执行一次 branch controlled-Live；随后才允许 Docker API、可见 `/knowledge`、精确合成数据清理、独立复审、分支提交、`--no-ff` 合并 main、main default-off 回放与远程推送。

## 回顾时可以问

- “为什么 Mock semantic=1 仍是 `quality_gate_failed`？”
- “24/24 zero-call 是怎样避免靠 expected reason 自证的？”
- “为什么 Knowledge Agent 只让模型返回 ordinal 与受限关系？”
- “为什么 V17--V22 测试要注入 synthetic authority，而生产仍保持 Bun evidence fail-closed？”
- “Task 12 为什么启动了 PostgreSQL，却仍不算 Docker 产品验收？”
- “controlled-Live 前还需要哪些显式门与 provider retention 前提？”
