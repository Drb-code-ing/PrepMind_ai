# Phase 6.9.8 Task 1 Shared Communication Contracts 验收

日期：2026-08-04

分支：`drb/phase-6-9-8-retriever-final-response-contract`

起始提交：`c6cd10a2e6887bbee49da9233f85d1dc946f9c1b`

状态：Task 1 shared contract 完成；尚未接入 Web/Server runtime、Retriever/FinalResponse executor、Mock、Live
或产品链路

Authority：`zero_provider_retriever_final_response_shared_contract`

## 1. 结论

Task 1 已在 `@repo/agent` 落地 Phase 6.9.8 的共享通信地基。它把 canonical principal、跨 Agent envelope、
Retriever request/result、VerifiedEvidenceBundle、FinalResponse request 与结构化 stream event 写成 strict Zod
contract，并统一使用 bounded plain clone、跨字段验证和 deep-freeze 处理不可信输入。

本任务没有把现有 RAG 或 Chat helper 改名后冒充 Agent，也没有创建任何 executor。它只证明后续 Task 2--7
可以在同一组权限、证据和 terminal contract 上接线；不能证明 Retriever/FinalResponse 已能在产品中运行。

## 2. 交付文件

| 文件                                                                                       | 作用                                                                               |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `packages/agent/src/contracts/realtime-chat.ts`                                            | shared schema、parser、local constructor、model projector 与 stream validator      |
| `packages/agent/tests/realtime-chat-contract.test.ts`                                      | principal/envelope/Retriever/Bundle/FinalResponse 的 strict/hostile negative tests |
| `packages/agent/src/index.ts`                                                              | 从 `@repo/agent` root 导出 shared contract                                         |
| `packages/agent/package.json`                                                              | 新增 `@repo/agent/realtime-chat` subpath export                                    |
| `packages/agent/tests/phase-6-9-tutor-organizer-schema-recovery-sr5-authority-cli.test.ts` | 将 SR5 历史校验绑定不可变 approved Git authority                                   |

## 3. Contract 与权限边界

### 3.1 Canonical principal

- `AgentExecutionContextV1` 只接受 strict `anonymous | authenticated` union；authenticated owner 必须是
  `server_jwt` authority。
- `createAgentAuthReceiptV1()` 通过进程内 `WeakMap` receipt，把 owner 与同一个 auth response、request 和 bearer
  token 对象引用绑定；替换任一引用、伪造 receipt 或 owner 不一致都返回 `principal_binding_invalid`。
- `AbortSignal` 只作为进程内不可枚举、不可写字段附着在 context 上，不进入 JSON DTO。
- anonymous context 不得携带 authenticated receipt/binding；返回 context 与 principal 均 deep-freeze。

Task 1 只提供 construction/binding contract；真实 `/auth/me` 与 `/api/chat` canonical principal 接线属于 Task 2。

### 3.2 Agent envelope 与 usage attribution

- `AgentMessageEnvelopeV1` 固定 schema version、producer/consumer、status、reason、degraded、payload 与可选
  `usageRef`；unknown key 和非法状态组合 fail-closed。
- `skipped` 不允许 payload、degraded 或任何 `usageRef`；`completed/degraded/failed` 分别执行独立组合校验。
- 批量 parser 限制最多 64 条、同一 runId、messageId 唯一；同一 `modelCallId` 最多出现一个 direct
  attribution，避免重复计费归属。

### 3.3 Retriever 与 verified evidence

- `RetrieverRequestV1` 固定 bounded original query、最多 4 条 recent turn、untrusted active context、
  `requiresRag` 与本地 policy；topK 最大 8、source 只允许 `knowledge_document`、document status 只允许 `DONE`。
- `RetrieverResultV1` 固定 original/executed query hash、rewrite disposition、hybrid metadata、usage attribution 与
  最多 8 条 candidate；citation 和 document/chunk identity 必须唯一，score/latency/integer 均有界。
- `VerifiedEvidenceBundleV1` 最多 4 条，只能由本地 constructor 创建；ordinal sourceLabel 必须精确为
  `资料 1..N`，blocked/unknown/tool-write instruction 等不安全 excerpt 无法进入 verified bundle。
- `FinalResponseRequestV1` 拒绝非本地构造的 bundle。RAG budget 整层省略时，bundle 与 citation allowlist 必须
  同步为空，避免“上下文已丢但引用仍保留”。

### 3.4 FinalResponse model projection 与 stream

- model evidence projection 精确限制为 `citationId/sourceLabel/excerpt/trustLabel`；本地
  `documentId/chunkId/sourceRef/safetyCodes` 不进入 model input。
- `modelRef` 只接受 `mock-local-v1` 或 `deepseek-v4-pro-nonthinking-v1`，并与 mock/live mode 精确匹配；endpoint、
  base URL、credential 或 provider raw metadata 无表达位置。
- stream sequence 必须从 0 连续递增，runId/responseId 全程一致，只允许一个 terminal 且 terminal-last。
- citation event 最多一个；每个 `citationId -> sourceLabel` 必须精确命中本地 allowlist，不能只凭 citationId
  冒用另一条本地 label。
- 首 token 前失败、首 token 后 partial 失败与 abort 分别检查 text/citation/user message/terminal 不变量；失败流
  不能发布 citation，完成流必须携带 direct verified usage reference。

## 4. 不可信输入与不可变性

所有 public parser 先通过 `clonePlainEvidenceData()` 建立 bounded plain snapshot，再进入 strict Zod 与跨字段
校验，最后 deep-freeze 返回值。因此测试覆盖并拒绝：

- accessor/getter 与 hostile Proxy；
- unknown key、控制字符、非法 Unicode、NaN、Infinity 与 unsafe integer；
- 重复 reason、message、citation、evidence identity、source label 或 direct usage attribution；
- owner/token/raw error 泄露字段与不安全 verified excerpt；
- 调用方输入对象被 parser 修改或通过返回对象反向修改。

## 5. SR5 历史 Authority 兼容修复

新增 `packages/agent/package.json` subpath export 后，旧 SR5 测试若继续从当前 worktree 重算 runnable bundle，
会把 Phase 6.9.8 的合法后续改动误报成已封存 SR5 source drift。Task 1 没有修改 SR5 production source、artifact、
marker、journal 或历史常量，而是把回归测试绑定到不可变 approved Git authority：

- approved tag 精确解析到 commit `67661f5f3a302b547e804c2c1839ec89898d4441`；
- 按 manifest 顺序读取 approved-tag Git blobs，bundle SHA-256 固定为
  `91b52eb28c88d08faa65e5d37aeddf172c16137d19be182292e191c66bb04c56`；
- approved commit 内 detached manifest anchor 仍为
  `61e6bb60fa2c5aa2a74d511b4ba8fbaf86ed186d8993afb9e5ddb844bb05d08c`，并与导入常量一致。

这使历史测试验证“当时批准的 Git 对象是否仍一致”，而不是要求未来 worktree 永远不能演进。独立历史复审确认
没有改写 sealed authority。

最终 Agent full 还暴露另一项 Windows-only 历史测试耦合：SR2 fixture 冻结的是 LF Git blob SHA，但
`core.autocrlf=true` 的工作文件是 CRLF，五个源文件的 Git blob SHA 都与 fixture 精确一致，只有 raw worktree
bytes 不同。测试现在只在哈希前规范化 `CRLF -> LF`；不规范化空格、正文或 lone CR，因此仍会发现任何真实
source drift。SR2 fixture、production source 与 sealed evidence 均未修改，独立复审无 Critical/Important。

## 6. 验证

| 验证                                 | 结果                                |
| ------------------------------------ | ----------------------------------- |
| focused realtime contract            | `15/15`，`88` assertions            |
| SR5 approved-tag history parity      | `8/8`，`64` assertions              |
| SR2 source identity compatibility    | `4/4`，`134` assertions             |
| Agent full                           | `1204/1204`，`22380` assertions     |
| Agent typecheck                      | 通过                                |
| Agent lint                           | 通过                                |
| 本次 17 个 TS/JSON/Markdown Prettier | 通过                                |
| `git diff --check`                   | 通过                                |
| 仓库 Markdown 相对链接               | `350 files / 152 links / missing=0` |
| 最终 docs/current-status 独立复审    | `APPROVED`，无 Critical/Important   |
| 最终 authority/security 独立复审     | `APPROVED`，无 Critical/Important   |

本任务全程没有读取 `.env`/credential，没有调用 Qwen/DeepSeek Provider，没有启动 Docker/API/browser，也没有
创建 marker、journal、artifact 或修改业务数据。`.codex/` 保持未跟踪且不进入提交。

## 7. 没有形成的 Authority

Task 1 不证明：

- canonical principal 已接入 `/api/chat`，或固定 `web-chat-user` 已删除；
- Retriever node、query rewrite、SafetyGuard/Verifier projector 或 FinalResponse executor 已实现；
- current AI SDK streaming 已满足 exact DeepSeek endpoint、non-thinking、abort、verified usage 与 Trace terminal；
- Qwen/DeepSeek Provider 健康、真实模型语义、Recall/nDCG、grounded/citation、P95、token/CNY 或 SLA；
- Docker/API/可见浏览器、产品权限、业务写入、main 或生产可用；
- Phase 6.9.8、6.9.9、6.9.10、6.10、8、9 或两篇博客已经完成。

## 8. 唯一下一原子任务

Task 1 只解锁 Task 2 canonical principal / Chat access：把服务器认证结果投影为
`AgentExecutionContextV1.principal`，删除 `/api/chat` 的固定 `web-chat-user`，并验证 no-token Mock、valid-token
Mock、invalid/expired/cross-owner token、同一 bearer binding 与并发 owner 隔离。Task 2 仍为 zero-provider，不接
Retriever/FinalResponse model runtime。

完整设计与计划见：

- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 正式化设计](../superpowers/specs/phase-6-9-8-retriever-final-response-agents-design.md)
- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 实施计划](../superpowers/plans/phase-6-9-8-retriever-final-response-agents.md)

回顾时可以问：

- “为什么 principal 必须绑定同一 auth response、request 和 bearer reference？”
- “为什么 `AbortSignal` 不应该进入可序列化 Agent DTO？”
- “为什么 VerifiedEvidenceBundle 必须带本地 construction brand？”
- “为什么 citation 要同时校验 citationId 和本地 sourceLabel？”
- “为什么 SR5 回归必须读取 approved Git blobs，而不能哈希当前 worktree？”
- “Task 1 已有 FinalResponse stream contract，为什么仍不能算 FinalResponseAgent 已完成？”
