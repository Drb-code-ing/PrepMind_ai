# Phase 6.9.7 Architecture Recovery R2 — Zero-network Provider Health Canary

日期：2026-07-30

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：R2 已完成；停在新的真实 canary 授权门前

Authority：`synthetic_test`，不是 Provider health、Live quality 或产品可用性证据

## 1. 为什么需要 R2

V9 唯一 controlled-Live 已按 run `c530ca02-3ece-4f11-898c-5695c8252bd5` 失败封存。现有证据只把
故障边界收窄到 durable dispatch 之后、HTTP Response 之前，不能继续归因为 DNS、TLS、代理、账号、余额、
模型权限或服务端。R1 只新增安全 transport subtype wrapper；它没有 canary request、预算、报告或 CLI。

R2 的目标是先在完全不接触 Provider 的前提下，关闭一个最小 health canary 的工程合同：请求是否 fact-free、
是否只有一次调用、transport/HTTP/response/schema/usage/abort/timeout 是否可区分、报告是否严格脱敏，以及未来
真实 canary 是否有独立 namespace 和成本上限。这样，下一步若获得用户授权，只需新增受控 Live composition，
而不是再次复制 Tutor/Organizer 48-case runner、marker、journal 或 recovery。

## 2. 完成范围

R2 新增以下独立 identity：

| 合同            | 版本                                                               |
| --------------- | ------------------------------------------------------------------ |
| request         | `phase-6.9.7-architecture-recovery-r2-provider-canary-request-v1`  |
| budget          | `phase-6.9.7-architecture-recovery-r2-provider-canary-budget-v1`   |
| report          | `phase-6.9.7-architecture-recovery-r2-provider-canary-report-v1`   |
| artifact schema | `phase-6.9.7-architecture-recovery-r2-provider-canary-artifact-v1` |
| CLI             | `phase-6.9.7-architecture-recovery-r2-provider-canary-cli-v1`      |

请求固定为：

```text
system: Return exactly one JSON object with ok=true. Use no tools or external facts.
user: Run the fact-free provider health canary.
output: { "ok": true }
```

Transport profile 固定 `deepseek-v4-pro`、non-thinking JSON object、`stream=false`、no tools、no retry、
`maxOutputTokens=16`。预算按每次 runner invocation 独立冻结为：

```text
1 call / 512 input tokens / 16 output tokens / 0.00200000 CNY hard cap
```

`scope=per_invocation` 是有意设计：R2 可以并行运行多个纯内存测试，但每个 invocation 最多一次 synthetic
dispatch。未来真实 canary 的全局一次性授权、marker 和 artifact writer 属于下一阶段，不由 R2 冒充。

## 3. Zero-network 保证

最终 runner 只接受四个 exact own-data 字段：

```text
mode=synthetic
scenario=<closed enum>
timeoutMs=1..5000
signal=<AbortSignal>
```

20 个 synthetic scenario 只在模块内部映射为 `Response`、固定 throw 或等待 abort 的 Promise。Runner 内部还会
核对 exact DeepSeek URL、Authorization sentinel、JSON content type 和完整 fact-free request body；任何漂移都
不能得到 `complete`。

初版实现曾暴露 injected `fetch/createTransport` factory。独立审查指出，调用方理论上可把真实网络 fetch 注入
该 factory，却仍获得 `synthetic_test` provenance，这与 zero-network 保证冲突。最终实现删除了这个接口；调用方
额外提供 `fetch`、`createTransport`、credential、URL、Live mode 或输出路径时，strict input reader 会在 executor
前返回 `config_invalid`。R2 自身没有 env reader、credential resolver、默认 network delegate 或 Provider factory。

## 4. Report 与故障边界

Strict report 只允许以下 outcome：

| Outcome             | 含义                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `complete`          | synthetic Response、schema、usage 与预算均完成                      |
| `response_observed` | 已观察 synthetic HTTP Response，但 HTTP/content/schema/usage 未完成 |
| `transport_failed`  | Response 前失败，并带一个 R1 fixed transport subtype                |
| `response_invalid`  | delegate 返回非 `Response`                                          |
| `aborted`           | pre-dispatch 或 in-flight external abort                            |
| `timeout`           | runner timeout 与 `runtime_timeout` wire terminal 一致              |
| `budget_exceeded`   | verified synthetic usage 超过 token reservation                     |
| `config_invalid`    | strict config 在 executor 前拒绝                                    |
| `harness_internal`  | 其它本地 invariant failure 的安全收口                               |

每个 report 都保留 V7 的四类独立计数：executor invocation、Provider dispatch、Response observed、verified
usage。计数只能是 `0/1` 且单调；budget reservation、actual usage、`withinBudget` 和 outcome 必须互相一致。
取消/timeout 不能与 succeeded wire 拼接；迟到 external abort 不能覆盖先完成的 success terminal。

Report 与 artifact schema 都拒绝 raw error、message、stack、prompt、response body、URL、header、credential、
API key 和任意额外字段。Artifact builder 只构造内存对象，固定
`status=diagnostic_only / qualityAuthority=none`；R2 没有文件 writer，也没有创建正式 `.tmp` artifact。

## 5. CLI 与 fault matrix

CLI 只允许：

```powershell
bun --filter @repo/ai eval:phase-6-9-7:recovery-r2:canary -- mock
bun --filter @repo/ai eval:phase-6-9-7:recovery-r2:canary -- fault-matrix
```

`live`、`--mode live`、`--out`、重复、缺失、帮助或未知参数全部返回
`r2_cli_argument_invalid`。CLI 没有 artifact publisher、retry、seal、recovery 或 credential path；输出 port 抛错
也只返回 exit code `1`。

固定 fault matrix 为 `21/21`：

- 九类 transport：aborted、timeout、DNS、TLS、proxy、connection refused/reset、network unreachable、unknown；
- HTTP：auth、rate limit、client、server；
- response：non-Response、invalid JSON、schema invalid、usage invalid；
- budget exceeded、pre-abort、runner timeout；
- 每项同时检查 authority、outcome、subtype/category、wire 四计数、reservation、usage presence、冻结与 no-raw。

## 6. 验证结果

| 验证                           | 结果                                                    |
| ------------------------------ | ------------------------------------------------------- |
| R2 focused tests               | `14 pass / 0 fail / 218 assertions`                     |
| AI package tests               | `246 pass / 0 fail / 1804 assertions`                   |
| R2 Mock CLI                    | `ok=true / outcome=complete / authority=synthetic_test` |
| R2 fault matrix                | `21/21`                                                 |
| `@repo/ai` typecheck / lint    | 通过                                                    |
| `@repo/agent` typecheck / lint | 通过                                                    |

实现与测试 SHA-256：

| 文件                 | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `canary-contract.ts` | `55d9765558ab9c00f1fd80f124929ab14341fe64c0cb1a1261af3bd2e491f59c` |
| `canary-runner.ts`   | `225d5420faf08afb8c8d00c63f8f98c7ebb5a9702121683a95f44b33b4269fec` |
| `canary-cli.ts`      | `41152598bcc24b55b916df0f062cb19a1175d51b3094f6e05863cff732e976f2` |
| contract test        | `858dcc5e25eab03e28062b33abd47140cf8a17fd54546d09dc2c9565af557726` |
| runner test          | `4c3cd05cc45aa8fc37912c5257ebf789db36a47103ef15056774236d0ce2435a` |
| CLI test             | `845d8bb9a7701cd18e8eb4efda7d4b46acf52c64f8d0e378312a1698c6ae1346` |

首次格式化命令使用 `bunx prettier` 时只在包清单下载阶段得到 `ConnectionRefused`，随后改用仓库本地
Prettier。该现象没有进入 R2 report，也不能被解释为 V9 或 DeepSeek 的 DNS/TLS/TCP 根因。

## 7. 明确没有做什么

- 没有读取、打印或修改根 `.env` 与任何 credential；
- 没有调用 DeepSeek、curl、DNS/TLS 探测、产品 API 或其它外部 Provider；
- 没有运行 V1--V9 Live、seal、recovery、resume、retry、replay 或 backfill；
- 没有启动 Docker、API、浏览器，未修改 PostgreSQL、Redis、MinIO 或业务数据；
- 没有创建正式 canary artifact、marker、journal、evidence 或 recovery claim；
- 没有合并 main，也没有解除产品验收、Phase 6.9.8/6.10、Phase 8/9 或博客阻断。

Synthetic `complete` 只说明固定本地 responder 让 request/response/report 合同走通。Synthetic usage `32/4`、
timeout 和任何本地耗时都不是 Provider telemetry，不能证明 HTTP、DNS/TLS、代理、账号、余额、模型权限、
服务端健康、真实费用、Tutor/Organizer 语义或产品可用。

## 8. 下一停止门

R2 到此结束。下一原子任务只能是：用户另行明确授权后，设计并执行一次低成本真实 Provider health
canary。该真实路径必须拥有独立 controlled-Live authority、credential boundary、一次性限制和正式 artifact
writer，不能给当前 R2 CLI 临时增加 `live` 参数。

只有真实 canary 观察到 HTTP Response，才允许另行规划小样本 Tutor/Organizer semantic gate；只有小样本通过
且再次获得授权，才讨论最终完整验收。任何结果都不得回填或改写 V9 sealed evidence。

回顾时可以问：

- 为什么 health canary 必须与 48-case semantic eval 分开？
- 为什么 injected fetch 即使标记 synthetic 仍会破坏 zero-network 保证？
- 为什么 per-invocation budget 不等于一次性 Live 授权？
- 为什么 `response_observed` 与 `complete` 必须分开？
- 为什么 synthetic `complete` 不能证明 Provider 健康？
