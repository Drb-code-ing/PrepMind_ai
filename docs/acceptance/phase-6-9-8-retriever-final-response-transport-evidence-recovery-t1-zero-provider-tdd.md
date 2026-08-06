# Phase 6.9.8 Retriever / FinalResponse Transport Evidence Recovery T1 验收

## 1. 结论

T1 已在独立 lineage `phase-6.9.8-retriever-final-response-transport-evidence-v1` 下完成
`zero_provider_transport_evidence_tdd / qualityAuthority=none`。本任务把 T0 冻结的诊断合同落成可执行的
strict parser、阶段/边界/wire 校验和三条 family 私有 capability seam；它只证明本地合同与权限边界能够
fail-closed，不证明 Provider 健康、真实模型语义质量、产品 Chat 可用性或任何 SLA。

T1 全程没有读取 credential、调用 DeepSeek/Qwen、访问 global fetch、启动 Docker/API/browser、创建正式
marker/journal/artifact/recovery claim、写 Trace/BackgroundJob/Outbox 或修改业务数据。R5 与 Task 9C 的 sealed
artifact、approved tag 和一次性授权保持不可变。

## 2. 实现范围

新增文件只属于 Transport Evidence Recovery lineage：

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-contract.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-rewrite.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-qwen.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-final-response.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-contract.test.ts`

旧 R5/Task 9C 模块、marker、journal、artifact、validator 与 approved tag 未被修改或复用写入。

## 3. T1 冻结并实现的合同

### 3.1 Diagnostic schema

- lineage 固定为 `phase-6.9.8-retriever-final-response-transport-evidence-v1`；
- family/phase 固定为 `rewrite`、`qwen`、`final_response` 之一且必须相等；
- stage 只能按 `preflight -> dispatch_started -> response_observed -> usage_observed -> terminal` 单调推进；
- `reasonCode` 按 stage 使用有界枚举，未知情况保持 `unknown`，不会从缺失信号猜测 DNS、TLS、代理、账号或服务端根因；
- `providerBoundary` 只能为 `not_dispatched`、`dispatched_no_response`、`response_observed`、
  `response_and_usage_observed` 或 `unknown`；
- `providerWire` 与 `runnerWire` 为四位 0/1 计数，必须单调且与已知 boundary 精确一致；
- `diagnosticStages` 只允许当前阶段之前的固定前缀；`applied` 只能在 terminal 且完整五阶段时出现；
- schema 使用 `.strict()`，`rawDataRetained` 强制为 `false`，解析结果为 plain-data、deep-frozen snapshot；
- 不保留模型原文、prompt/query、credential、URL、raw error、未知字段或 raw-derived hash。

### 3.2 Capability / authority

rewrite、Qwen、FinalResponse 各自拥有 module-private `WeakMap` 状态和 `WeakSet` single-consume 标记。capability
由对应模块签发，并绑定 `callId + family + phase + lineage`；伪造对象、跨 family/call、重放、active/共享
issuer、乱序 snapshot 和非法 call id 均 fail-closed。transport-evidence issuer 没有通过 `@repo/agent`
公共 barrel 暴露，调用方不能自行提升 observation authority。

## 4. 验收证据

| 检查                                            | 结果                                            |
| ----------------------------------------------- | ----------------------------------------------- |
| T1 focused contract tests                       | `8/8` pass，`51` assertions                     |
| `@repo/agent` 全量测试                          | `1337/1337` pass，`23700` expect()，`167` files |
| `bun --filter @repo/agent typecheck`            | 通过                                            |
| `bun --filter @repo/agent lint`                 | 通过                                            |
| 受影响文件 Prettier / `git diff --check`        | 通过                                            |
| CodeGraph update/ensure                         | 通过；索引可用                                  |
| Provider / global fetch / credential reads      | `0/0/0`                                         |
| Docker / API / headed browser / business writes | `0/0/0/0`                                       |
| formal marker/journal/artifact/recovery claim   | `0/0/0/0`                                       |
| quality authority                               | `none`                                          |

focused tests 特别覆盖 canonical applied snapshot 的深冻结、四类 known boundary wire、raw/unknown/accessor/
Proxy hostile input、`unknown` 诚实终态、三 family capability 隔离与 single-consume、乱序不消耗 capability、
公共 barrel 不暴露 issuer，以及非法 call id 在 provider-shaped seam 创建前被拒绝。

## 5. 当前边界与下一步

T1 不扩大 T0 的 30-case 分母，也不创建可执行 Live CLI。当前只解锁 T2 zero-provider robustness + durability
static checkpoint：完成 30-case synthetic matrix、abort/timeout/capability/publication 竞态、classifier fixture
与临时目录 crash-only durability 验证。T2 通过后仍需新的 DeepSeek/Qwen 数据边界接受和全新 exact authorization，
才可评估最多三个 transport-only canary slots；canary 即使通过，也不能自动解锁 R6 产品 Docker/API/browser、
main 或 Agent semantic gate。

不得 retry/resume/replay/backfill/seal/recovery R5、Task 9C 或任何已封存 artifact，也不得以单 case、curl、产品
API 或修改 gate 的方式追加 Provider 探测。

## 6. 回顾时可以问

- 为什么 strict parser 对未知字段直接拒绝，而不是静默保留或把它映射成新的诊断类型？
- 为什么 `unknown` 是正确的证据终态，T1 仍不能把 R5 的 `provider_dispatch / unknown` 归因到代理？
- 为什么 providerWire 和 runnerWire 必须分开，且 boundary 不一致要 fail-closed？
- 为什么 capability 必须由三个 family 模块各自私有签发并 single-consume？
- T1 的 `8/8` 与 `1337/1337` 分别证明什么，又没有证明什么？
- T2 通过后，新的 canary 还需要哪些授权和数据边界接受？
