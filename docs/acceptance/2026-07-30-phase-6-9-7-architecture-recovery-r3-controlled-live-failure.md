# Phase 6.9.7 Architecture Recovery R3 Controlled-Live 诊断失败封存

日期：2026-07-30

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

运行 ID：`253a5df5-c443-4950-b517-849efb941728`

终态：`transport_failed / connection_refused / evidenceSealed=true`

Authority：`controlled_live / diagnostic_only / qualityAuthority=none`

## 1. 结论

用户已接受本次 DeepSeek 当前账号的数据保留/训练边界，并在 Windows evidence-root 修复提交推送后，
重新给出唯一一次 R3 exact confirmation。该授权已经消费，不得 retry、resume、replay、backfill 或换入口
重跑。

本次 fact-free health canary 完成一次 executor invocation 与一次 Provider dispatch，但没有观察到 HTTP
Response。受限 diagnostic adapter 将终态分类为 `transport / connection_refused`；最后完成的 wire stage 是
`provider_dispatch_started`。因此 artifact 的 attempt disposition 为 `dispatched_no_response`，usage、实际 token、
可验证费用与 hard-cap 判定全部为 `null`，不能写成 `0 CNY`。

Marker、7 条 hash-chain journal 与 artifact 已由正常 runtime 路径封存并通过 bundle validation；没有
recovery claim，也不需要、不允许运行 crash-only seal。该证据不是 Provider health、Tutor/Organizer 语义、
48-case、产品 API、Docker 或浏览器可用性证明。

## 2. 授权与运行前门

正式运行前核对：

- branch 为 `codex/phase-6-9-7-tutor-wrong-question-agents`；
- local HEAD 与 tracking commit 均为
  `9c297da3fb945200d337cf32c65b84b06c908c6c`，ahead/behind=`0/0`；
- tracked worktree clean；未跟踪 `.codex/config.toml` 保持未提交；
- 正式 R3 marker、journal、recovery claim、artifact 数量均为 `0`；
- 修复后 R3 focused `18/18`（`123` assertions）、R2 regression `14/14`（`218` assertions）、AI full
  `264/264`（`1927` assertions）；AI typecheck/lint、Prettier 与 diff check 通过；
- 根 `.env` 的 `DEEPSEEK_API_KEY` 只在单个进程内映射为 R3 dedicated credential，值未输出、记录、提交或
  写入 artifact。

正式边界固定为 DeepSeek `deepseek-v4-pro` non-thinking JSON、fact-free `{ "ok": true }`、`5000ms`、
`1 call / 512 input / 16 output / 0.00200000 CNY`，并且 no tools/stream/retry/resume/replay。

## 3. 固定运行结果

| 项目                                   | 结果                             |
| -------------------------------------- | -------------------------------- |
| CLI ok                                 | `false`                          |
| CLI exit                               | `1`                              |
| evidence sealed                        | `true`                           |
| report outcome                         | `transport_failed`               |
| attempt disposition                    | `dispatched_no_response`         |
| provider failure / subtype             | `transport / connection_refused` |
| last completed wire stage              | `provider_dispatch_started`      |
| response observed                      | `false`                          |
| executor / dispatch / response / usage | `1 / 1 / 0 / 0`                  |
| reserved calls                         | `1`                              |
| actual input / output tokens           | `null / null`                    |
| verified usage                         | `null`                           |
| estimated cost / within cap            | `null / null`                    |
| completion / publication               | `runtime_terminal / runtime`     |
| recovery claim                         | `null`                           |

`providerDispatches=1` 只证明代码越过一次 dispatch 记账边界；`providerResponses=0` 表示本进程没有观察到
HTTP Response。它不能证明请求是否离开本机、DeepSeek 服务端是否收到请求或是否产生账单。没有 verified usage
时，token 与费用必须保持 `null`。

## 4. Durable evidence

| Artifact | 路径 / SHA-256                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| marker   | `.tmp/phase-6-9-7-architecture-recovery-r3-provider-canary.once.json` / `6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a`                                 |
| journal  | `.tmp/phase-6-9-7-architecture-recovery-r3-provider-canary.journal.jsonl` / `426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b`                             |
| artifact | `.tmp/phase-6-9-7-architecture-recovery-r3-provider-canary-253a5df5-c443-4950-b517-849efb941728.json` / `56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4` |

Journal 固定 7 条记录：

```text
attempt_reserved
  -> executor_entered
  -> request_validated
  -> provider_dispatch_started
  -> runtime_terminal(transport_failed)
  -> publication_started
  -> evidence_published
```

Terminal sequence 为 `5`，terminal report SHA-256 为
`a461e0e051616bab8552212b08733803b7ff144a5b99014fdb3e090868fed618`。Artifact 内 marker SHA、terminal
record hash/report SHA、最终 evidence SHA 与 journal 均一致；独立只读复审重新计算 hash chain 通过。正常
runtime publication 已完成，`recoveryClaimSha256=null`。

这些 `.tmp` 文件是本机不可变运行证据，不提交到 Git，也不得删除、覆盖、改写或拼接。

## 5. Zero-network 本地相关条件

封存后仅做了不发网络请求的本地检查：

- 代码将 endpoint 固定为 `https://api.deepseek.com/v1/chat/completions`；调用方不能覆盖 URL；
- 当前进程的 `HTTP_PROXY`、`HTTPS_PROXY`、`http_proxy`、`https_proxy` 均存在，指向无认证的 loopback
  `127.0.0.1:7897`；
- 检查时本机 TCP `7897` 端口监听数为 `0`；
- 根 `.env` 没有定义上述 proxy 变量，因此它们来自父进程、shell/profile 或其它外部环境注入，而不是项目
  credential 文件。

该本地条件与 `connection_refused` 高度一致，是当前最可信的相关因素，但不是 sealed evidence 已证实的
socket 目标。Diagnostic adapter 有意不保存 raw error、message、stack、URL、header 或连接 peer，因此不能
把“loopback proxy 无监听”升级为唯一根因，也不能反向归因 DNS、TLS、代理软件崩溃、路由、防火墙、
DeepSeek 服务端、API key、账号、余额、模型权限或限流。

为了保护一次性 authority，本阶段没有通过 curl、DNS/TLS、单 case、代理绕过、清空 proxy 或第二次 Provider
调用来验证该推断。

## 6. 当前工程边界

R1 transport subtype、R2 synthetic canary contract 与 R3 one-shot/durability 工程能力继续成立；本次还证明
正常 runtime 可以 durable reserve、进入一次 dispatch、写 terminal 并发布 strict diagnostic artifact。

但本次没有 HTTP Response，所以不能迁移 Tutor/Organizer 到 diagnostic adapter，不能启动小样本 semantic
gate、48-case、产品 Docker/API/可见浏览器、main merge/default-off replay、Phase 6.9.8、Phase 6.10、
Phase 8/9 或博客收尾。原规划 R4 保持被阻断。

下一项安全工作只能是独立的 zero-provider proxy/preflight 架构复盘：明确父进程 proxy authority、监听检查、
fail-closed 诊断与未来新路线的授权边界。它不得删除本次 marker/artifact，也不得伪装成 R3 retry。若未来
需要新的外部调用，必须由用户作出新的路线决策、提交新的工程边界，并另行授权。

## 7. 回顾时可以问

- 为什么 `1/1/0/0` 证明 dispatch 发生，却不能证明 Provider 收到请求或产生费用？
- `connection_refused` 是如何从 bounded own-data error code 得出的？
- 为什么 loopback proxy 无监听只能写成高度相关条件，不能直接写成唯一根因？
- 为什么正常 runtime publication 后不能再运行 crash-only seal？
- 为什么 health canary 失败会继续阻断 Tutor/Organizer semantic 与产品验收？
