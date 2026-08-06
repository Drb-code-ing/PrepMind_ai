# Phase 6.9.8 Retriever / FinalResponse Transport Evidence Recovery T2 验收

## 1. 结论

T2 已在独立 lineage `phase-6.9.8-retriever-final-response-transport-evidence-v1` 下完成
`zero_provider_transport_evidence_t2 / qualityAuthority=none`。固定 30-case matrix 与 15 个 classifier fixture
全部通过，最终 gate 为 `transport_evidence_t2_zero_provider_passed`。

本任务只证明本地 transport/evidence contract、权限隔离和 synthetic durability 能够 fail-closed。它不证明
DeepSeek/Qwen Provider 健康、R5 历史 `provider_dispatch / unknown` 的具体根因、Retriever/FinalResponse 真实模型
语义质量、产品 `/api/chat` 可用性、Trace、P95、SLA 或 main authority。

T2 全程未读取 credential、未调用 Provider、未访问产品 API、未启动 Docker/browser、未修改业务数据，也未创建
仓库正式 marker/journal/artifact/recovery claim。测试只在系统临时目录创建 synthetic bundle，并在每个 case 后精确
清理。

## 2. 实现范围

新增文件只属于 Transport Evidence Recovery lineage：

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t2.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t2-durability.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-t2.test.ts`

旧 R5、Task 9C 的 source/tag/marker/journal/artifact/validator 未修改、未恢复、未重跑，也没有被新 synthetic bundle
复用写入。

## 3. Robustness matrix

### 3.1 固定分母

- `rewrite`、`qwen`、`final_response` 三个 family 各 8 个 case，共 24 个；
- 每个 family 固定覆盖四个 Provider boundary：`not_dispatched`、`dispatched_no_response`、
  `response_observed`、`response_and_usage_observed`；
- 每个 family 固定覆盖 `aborted`、`timeout`、代表性 transport failure 与 contract failure；
- 额外 6 个 case 覆盖 parent-abort/child-timeout 竞态、dispatch 前后 abort、forged/reused/cross-family capability
  与 publication 缺字段；
- `15` 个独立 classifier fixture 覆盖 bounded
  `aborted/timeout/dns/tls/proxy/connection_refused/connection_reset/network_unreachable/http_status/
envelope_invalid/schema_invalid/stream_event_invalid/usage_invalid/applied/unknown`；classifier 不扩大 30-case
  runtime 分母。

### 3.2 权限与数据最小化

Actual 必须穿过 T1 的 family-private single-consume capability seam 和 strict diagnostic parser。跨 family、伪造、
重放或缺字段输入只能形成 bounded rejection；`providerWire/runnerWire`、stage prefix 与 Provider boundary 必须一致。
报告固定 `rawDataRetained=false`，不保存 raw response/error、prompt/query/chunk/answer、credential、URL、unknown key、
Zod path/value 或 raw-derived hash。

## 4. Synthetic durability

T2 durability 只允许 basename 以 `phase-698-transport-evidence-t2-` 开头的系统临时目录，并将可写路径限定为本
lineage 的 UUID marker、journal、report snapshot 与 artifact。实现并验证：

- exclusive marker 与唯一 marker 发现；多个 marker 直接拒绝，不静默选择；
- file fsync、Windows/Bun 可写文件句柄与受控 directory-fsync `EPERM/EINVAL` 兼容；
- 单队列串行 case terminal、重复 case/terminal 拒绝；
- fsynced hash-chain journal、严格事件顺序、case identity/terminal/report snapshot 一致性；
- exclusive temp file + hard-link artifact、canonical bytes 与 logical/physical SHA 绑定；
- strict bundle validator 复算 marker/report/journal/artifact 关系并拒绝 hash-chain tamper 或额外文件；
- crash-only recovery 可补齐空 prefix 或部分 case prefix，且不会重复 case；
- terminal-prefix recovery 会复用并校验幂等 report snapshot；
- artifact 已落盘但 `evidence_published` 尚未 durable 写入时，只补齐 publication，不重跑 matrix；
- 已完成 bundle 再次 recovery 固定返回 `already_published`。

这些 synthetic marker/journal/artifact 只验证实现形态，`formalEvidence=0`，不能作为 controlled-Live evidence。

## 5. 验收证据

| 检查                                            | 结果                                            |
| ----------------------------------------------- | ----------------------------------------------- |
| T2 focused tests                                | `11/11` pass，`39` assertions                   |
| 固定 matrix / classifier                        | `30/30` / `15/15`                               |
| `@repo/agent` 全量测试                          | `1348/1348` pass，`23746` expect()，`168` files |
| `bun --filter @repo/agent typecheck`            | 通过                                            |
| `bun --filter @repo/agent lint`                 | 通过                                            |
| 受影响文件 Prettier / `git diff --check`        | 通过                                            |
| CodeGraph update/ensure                         | 通过；索引可用                                  |
| Provider / global fetch / credential reads      | `0/0/0`                                         |
| Docker / API / headed browser / business writes | `0/0/0/0`                                       |
| formal marker/journal/artifact/recovery claim   | `0/0/0/0`                                       |
| synthetic temp-root residue                     | `0`                                             |
| quality authority                               | `none`                                          |

安全重算命令：

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-t2.test.ts
bun --filter @repo/agent test
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
```

这些命令不读取 `.env`、不构造 Provider transport，也不创建仓库正式 evidence。

## 6. 当前边界与下一步

T0/T1/T2 已完成，只说明现在可以讨论是否设计 T3；T3 仍未授权、未实现、未执行。若后续确有必要，必须先建立
全新 source admission、fresh proxy preflight、DeepSeek/Qwen 当次数据边界接受、独立 credential 与 exact one-shot
authorization，最多执行 rewrite、Qwen、FinalResponse 各一个 transport-only slot，首个失败即停止且不补跑。

T2 不自动解锁 T3，也不解锁 R6/R7、Task 10/11、产品 Docker/API/browser、main、Phase 6.9.9/6.9.10/6.10、
Phase 8/9 或博客收尾。不得 retry/resume/replay/backfill/seal/recovery R5 或 Task 9C，也不得用 curl、单 case、产品
API 或修改 gate 追加 Provider 探测。

## 7. 回顾时可以问

- 为什么 30-case matrix 与 15 个 classifier fixture 分开计数？
- 为什么 `unknown` 分类稳定仍不能反向证明 R5 的具体失败根因？
- 为什么 synthetic marker/journal/artifact 不属于 formal evidence？
- partial prefix、terminal prefix 和 artifact-publication prefix 分别如何恢复，为什么都不重跑 Provider？
- Windows directory fsync 为什么只容忍 `EPERM/EINVAL`，其它错误仍 fail-closed？
- T2 通过后，为什么 T3 仍需要新的数据边界接受和 exact authorization？
