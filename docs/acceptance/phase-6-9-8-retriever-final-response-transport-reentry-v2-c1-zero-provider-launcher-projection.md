# Phase 6.9.8 Transport Re-entry V2 C1 Zero-provider Launcher / Projection 验收

> 日期：2026-08-07  
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`  
> lineage：`phase-6.9.8-retriever-final-response-transport-reentry-v2`  
> authority：`zero_provider_transport_reentry_v2_c1`  
> qualityAuthority：`none`

## 1. 任务范围

C1 落地 root launcher 的配置组合边界与 dedicated credential projection。它只接受 synthetic fixture，不读取真实根
`.env`、不读取真实 credential、不调用 DeepSeek/Qwen/其它 Provider，不创建正式 marker/journal/artifact/recovery
claim，不启动 Docker/API/可见浏览器，也不写 Chat、Trace、BackgroundJob、Outbox 或业务表。

旧 T3 `075e2d5f-682b-426d-847e-f5a6ce5b97c6` 及其 marker/journal/report/artifact 保持只读；C1 不是 T3 retry、
resume、replay、backfill 或 recovery。

## 2. 实现与边界

### 2.1 Launcher / parser

- `resolvePhase698TransportReentryV2RepositoryRoot()` 从 launcher 自身路径（`file:` URL 或绝对路径）向上定位仓库根，
  不依赖 package cwd 或 ambient `process.env`；
- bounded dotenv parser 只接受 `DEEPSEEK_API_KEY` 与 `QWEN_API_KEY`，覆盖 UTF-8/BOM、CRLF/LF、单行有界值、单/双引号；
- duplicate、unknown key、empty value、插值、multiline、非 ASCII、控制字符、超长行/值和 malformed quote 均
  fail-closed；输出不含 raw source、raw value 或 line 内容；
- generic credential reader 只接受两个 own data properties；getter/setter、Proxy/accessor、symbol/extra field、
  非 plain object 与缺失/非法值均拒绝。

### 2.2 Gate 与 capability

- exact C1 zero-provider argument、branch/source/T2/T3-C parity、direct/loopback proxy receipt、数据边界和未来授权
  在 credential composition 前检查；任何失败返回 bounded reason code，不触碰 credential accessor；
- root generic key 只在 launcher 内存中投影为三个 module-private WeakMap capability：`rewrite`、`qwen`、
  `final_response`；capability 暴露 version/lineage/family/callId，不暴露 API key；
- capability 绑定 V2 lineage、family 和 callId，单次消费；伪造、复用、跨 family、跨 call 全部 fail-closed；消费
  只返回 `credentialAvailable=true` 的 opaque receipt，raw API key 永不通过导出 API 返回或进入 report；
- DeepSeek 宿主 key 只被内部投影到 rewrite/final_response，Qwen 宿主 key 只投影到 qwen；runtime core 不读取
  `process.env`，不接收 generic key、URL、model、fetch、retry 或 persistence port。

## 3. 验收命令与结果

```text
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.test.ts
  10 pass / 0 fail / 38 expect()

bun --filter @repo/agent test
  1372 pass / 0 fail / 23864 expect() / 171 files

bun --filter @repo/agent eval:phase-6-9-8:transport-reentry:v2:c1
  providerCalls=0 / credentialReads=0 / formalEvidence=0

bun --filter @repo/agent typecheck
  passed

bun --filter @repo/agent lint
  passed

bunx prettier --check <C1 files>
  passed

git diff --check
  passed

bun --filter @repo/agent eval:phase-6-9-8:transport-evidence:t3:validate
  ok=true / runId=075e2d5f-682b-426d-847e-f5a6ce5b97c6 / journal=7 / providerCalls=0 / credentialReads=0
```

测试额外证明：hostile ambient `process.env` 同名 key 不会替代注入的 launcher-file fixture；package entry 不含
`bun --env-file`；root path 在 package cwd 变化和 `file:` URL 下保持一致；旧 T3 validator 的 sealed SHA/终态未改变。

## 4. 证据计数与停止门

| 项目                                        |                                C1 结果 |
| ------------------------------------------- | -------------------------------------: |
| 真实 Provider calls                         |                                    `0` |
| 真实 credential reads                       |                                    `0` |
| synthetic fixture Provider calls            | `0`（只在内存 parser/projection 测试） |
| 正式 marker/journal/artifact/recovery claim |                                    `0` |
| Docker/API/browser/Trace/业务写入           |                                    `0` |
| semantic/product/main authority             |                                 未形成 |

C1 只解锁 C2 zero-provider runner/durability；它不证明 Provider health、Retriever/FinalResponse 语义、真实模型质量、
P95/SLA、产品 `/api/chat` 可用或 `main` 可合并。没有新的数据边界接受和 exact authorization，不得执行 V2 L1。

## 5. 回顾问题

1. 为什么 root `.env` 可以是 operator convenience，却不能直接进入 runtime core？
2. 为什么 capability 必须同时绑定 lineage、family、callId 并单次消费？
3. 为什么 hostile ambient `process.env` 测试只能证明来源隔离，不能证明 Provider 健康？
4. 为什么 C1 配置失败不会消费 V2 marker，但仍不能成为 L1 授权？
