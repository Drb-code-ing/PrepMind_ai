# Phase 6.9.8 Task 4 VerifiedEvidenceBundle / Evidence Projector 验收

日期：2026-08-04

分支：`drb/phase-6-9-8-retriever-final-response-contract`

起始提交：`3c0dd6ae23eace892f12c47e26cd14ff2486e989`

状态：Task 4 exact-context-bound evidence projector、Verifier/SafetyGuard 保守收紧与本地 structured
citation/Markdown adapter 完成；legacy `/api/chat` RAG composition 尚未替换，query rewrite、FinalResponseAgent、
structured stream terminal、Live、产品与 main authority 尚未形成

Authority：`zero_provider_verified_evidence_projector`

Quality authority：仅本地 safety/permission/projection contract；不形成 Provider、语义、产品或 SLA authority

## 1. 结论

Task 4 已把 Task 3 的正式 `RetrieverResultV1` 收敛为可供未来 FinalResponse 使用的本地证据 authority。Retriever
result、正式 `VerifiedEvidenceBundleV1`、citation projection、`FinalResponseRequestV1` 与 model projection 必须绑定
同一个 exact `AgentExecutionContextV1`；仅复制结构、调用低层 constructor 或替换 owner/context 均不能获得正式
projector authority。

Projector 先执行本地 owner/SafetyGuard，再应用 KnowledgeVerifier 五态。模型、Retriever 或调用方都不能升级
证据、改变 owner、伪造 citation、扩大条数或绕过 context budget。Task 4 全程 zero-provider；兼容 Markdown 只是
本地 projection，没有把 legacy Chat RAG 接到新 Retriever/FinalResponse composition。

## 2. 交付文件

| 文件                                                          | 作用                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/agent/src/nodes/evidence-projector.ts`              | 本地 projector、Verifier 收紧、4×700、citation/Markdown 与脱敏 Trace      |
| `packages/agent/src/contracts/verified-evidence-authority.ts` | 正式 bundle 到 exact execution context 的进程内 WeakMap authority         |
| `packages/agent/src/contracts/realtime-chat.ts`               | FinalResponse request/model projection 的 context/run/request/deadline 门 |
| `packages/agent/src/nodes/retriever.ts`                       | 正式 Retriever result 到 exact execution context 的 WeakMap binding       |
| `packages/agent/tests/evidence-projector.test.ts`             | owner、安全、Verifier、长度、排序、citation、drop 与 no-leak 回归         |
| `packages/agent/tests/realtime-chat-contract.test.ts`         | 低层 bundle、缺失/跨 context 与 no-RAG FinalResponse contract 回归        |
| `packages/agent/package.json` / `src/index.ts`                | `@repo/agent/evidence-projector` 与 root export                           |

## 3. Exact Execution-Context Authority

```text
Task 3 RetrieverAgent result
  -> WeakMap(result -> exact AgentExecutionContextV1)
  -> Task 4 projector requires the same context reference
       -> authenticated principal only
       -> clone / forged result / cross-owner context => fail-closed
  -> local projector creates structurally valid bundle
  -> internal registrar binds bundle -> same exact context
       -> low-level constructor alone has no formal authority
  -> FinalResponse request parser requires same context
       -> exact runId / requestId / deadlineAt correlation
  -> model projection requires the same validated request/context pair
```

`createVerifiedEvidenceBundleV1()` 继续作为低层 strict schema helper，但不会自行注册正式 projector authority。
正式 registrar 没有从 package root 或 public subpath 导出。独立安全复审确认：外部不可信输入无法调用 registrar；
已取得同包任意代码执行后主动调用 internal registrar 属于本 Task 外部输入威胁模型之外的防御性边界，不构成
blocker/high。

## 4. SafetyGuard 与 Verifier 收紧

### 4.1 本地先行安全门

只有 `ownerScope=matched` 且 safety status 为 `safe/caution` 的候选可继续。以下正文在 bundle 前删除：

- `blocked` 或 `unknown_safety`；
- `prompt_injection`、`credential_material`、`high_risk`、`control_character`；
- cross-owner candidate；
- 完整字段扫描发现的 instruction、credential、控制字符、非法 UTF-16 或其它不安全形态。

被删除项只影响固定 `removedCount/unsafe_evidence_removed`，不会把正文、动态 key、owner 或原始错误写入 Trace。

### 4.2 Verifier 五态

| Verifier 输入              | 本地结果                                                                 |
| -------------------------- | ------------------------------------------------------------------------ |
| `trusted`                  | 仅全部本地安全时可保持 trusted；caution 或 unavailable 收紧为 suspicious |
| `suspicious`               | 保持 suspicious                                                          |
| `conflict`                 | 保持 conflict，并生成固定核对提示                                        |
| `insufficient`             | entries 清空，不能用弱证据填充                                           |
| `skipped`                  | 无候选时保持 skipped；有候选时收紧为 insufficient                        |
| `availability=unavailable` | 只能维持或收紧，并增加固定 `verifier_unavailable` reason                 |

Verifier failure/unavailable 不能把 suspicious/conflict/insufficient 升级为 trusted，也不能恢复已被 SafetyGuard
删除的正文。

## 5. Bundle、Citation 与 Trace

- Bundle 最多 4 条；每条 excerpt 最多 700 UTF-16 code units，截断不会留下孤立 surrogate。
- 排序固定比较 total/keyword/vector score，再比较 `documentId/chunkId`；输入重排不改变 citation identity。
- Citation identity 继续来自 Retriever 的本地 `documentId + chunkId` authority；显示 label 只使用
  `资料 1..N`。
- 模型只可见 `citationId/sourceLabel/excerpt/trustLabel`；`documentId/chunkId/sourceRef/safetyCodes/owner` 不进入
  model projection。
- 本地 adapter 生成 structured allowlist/citation 与 legacy UI 可消费的 Markdown fragment；模型伪造 citation ID
  仍由 strict stream ledger 拒绝。
- `ragIncluded=false` 时 bundle、allowlist、citation 和 Markdown 作为一层全部清零，不允许留下孤立引用。
- Trace summary 只保存固定 schema/projector version、run/request、disposition/status/reason、bundleId 与计数；
  `providerCalls=0`，不保存 evidence 正文、owner、token、credential、prompt 或 raw error。

## 6. 验证

| 验证                                    | 结果                                      |
| --------------------------------------- | ----------------------------------------- |
| Task 4 focused                          | `30/30 / 250 expect()`                    |
| Agent full                              | `1223/1223 / 22577 expect()`              |
| Agent typecheck / lint                  | 通过                                      |
| Web full                                | `462/462`                                 |
| AI full / typecheck / lint              | `325/325`；通过                           |
| Types full / typecheck                  | `42/42`；通过                             |
| Types lint                              | 既有 Bun/PATH eslint 问题；非 Task 4 回归 |
| 受影响 TS/JSON/Markdown Prettier        | 通过                                      |
| `git diff --check`                      | 通过                                      |
| 仓库 Markdown 相对链接                  | `missing=0`                               |
| 独立 architecture/security/test reviews | 无 blocker/high                           |

Task 4 测试覆盖 exact context、clone/伪造/cross-owner、abort、context budget、五态 Verifier、安全删除、4×700、
稳定重排、local citation allowlist、伪造 citation 拒绝、deep-freeze 与 no-leak。最终全量 Agent 回归使用完成后的
context binding 源码运行，不能用修复前的旧结果替代。

## 7. Zero-Provider 与未形成的 Authority

本任务未读取 `.env`/credential，未调用 Qwen、DeepSeek 或其它 Provider，未启动产品 Web/Server Docker、API 或
可见浏览器，未创建 Live marker/journal/artifact，未修改业务数据，也未合并 main。`.codex/` 保持未跟踪。

Task 4 不证明：

- legacy `/api/chat` RAG composition 已切换到 Task 3 Retriever 与 Task 4 projector；
- Task 5 query rewrite candidate、rewrite uplift、真实 Qwen/DeepSeek 或 verified usage/cost；
- Task 6 FinalResponseAgent、stream adapter、TTFT/total P95、tool/citation terminal authority；
- Task 7 Chat composition、end-to-end Trace finalization、并发/取消/no-loss 已完成；
- 48-case reviewed Mock/controlled-Live、产品 Docker/API/browser、main 或后续阶段已完成。

## 8. 唯一下一原子任务

Task 4 只解锁 Task 5 Retriever query rewrite candidate。Task 5 仍为 zero-provider：实现 default-off DeepSeek V4 Pro
non-thinking strict JSON candidate、独立 gate/credential/budget/timeout、eligibility-before-credential、最多一次调用、
本地 validator/merger 与 reviewed Mock；不得提前执行真实 Provider、FinalResponse、产品验收或 main 合并。

完整设计与计划见：

- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 正式化设计](../superpowers/specs/phase-6-9-8-retriever-final-response-agents-design.md)
- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 实施计划](../superpowers/plans/phase-6-9-8-retriever-final-response-agents.md)

回顾时可以问：

- “为什么低层 bundle constructor 通过 schema 仍不能获得正式 evidence authority？”
- “为什么 Retriever result、bundle、FinalResponse request 必须绑定同一个 exact execution context？”
- “为什么 Verifier unavailable 只能收紧，不能把资料默认当作 trusted？”
- “为什么 `ragIncluded=false` 必须同时删除 bundle、citation allowlist 和 Markdown？”
- “为什么 Task 4 已生成兼容 Markdown，仍不能说 legacy Chat RAG 已完成切换？”
- “为什么模型只能看到 ordinal source label，而真实 document/chunk identity 留在本地？”
