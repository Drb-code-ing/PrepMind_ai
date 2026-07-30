# Phase 6.9.7 Architecture Recovery R3 — Controlled-Live Canary Zero-provider Checkpoint

日期：2026-07-30

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：R3 controlled-Live 工程边界已完成；首次授权 CLI 在 reservation 前 zero-call 失败，根因已修复，等待新的 exact confirmation

Authority：`zero-provider engineering evidence`，不是 Provider health、Live quality、Agent 语义或产品可用性证据

## 1. 为什么需要 R3

R2 已把 fact-free request、`1/512/16` 单次预算、`0.00200000 CNY` hard cap、strict report 和
zero-network synthetic fault matrix 固定下来，但它有意没有 credential resolver、真实 transport、一次性
marker、journal 或 artifact publisher。直接给 R2 CLI 加一个 `live` 参数，会把 synthetic authority、真实
Provider authority 和 durability 混在一起，也无法回答“进程在 dispatch 后崩溃时是否会重放”这一生产问题。

R3 因此只完成一条独立的低成本 controlled-Live 边界：未来获得用户精确授权后，它最多执行一次
fact-free health canary，并将 dispatch 前后发生了什么持久化。它不迁移 Tutor/Organizer，不运行 48-case，
也不改写 V1--V9 的任何封存证据。

## 2. 固定授权与调用边界

正式 CLI 只接受一个 exact confirmation，且内部固定使用 production ports；调用方不能注入 clock、UUID、
Git source reader、transport、fetch、URL、model、writer、retry、resume、replay 或 output path。测试专用 ports
只存在于模块私有执行函数，公开导出不会暴露它们。

受控真实路径必须同时满足：

| 边界                    | 固定值                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| branch                  | `codex/phase-6-9-7-tutor-wrong-question-agents`                         |
| source                  | tracked worktree clean，`HEAD == @{u}`                                  |
| approval env            | `PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CONTROLLED_LIVE_APPROVED=true`    |
| dedicated credential    | `PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_DEEPSEEK_API_KEY`                 |
| exact confirmation      | `I_AUTHORIZE_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CONTROLLED_LIVE_ONCE` |
| timeout                 | `5000ms`                                                                |
| request                 | 复用 R2 fact-free request，只允许 `{ "ok": true }`                      |
| budget                  | `1 call / 512 input / 16 output / 0.00200000 CNY`                       |
| retry / resume / replay | 全部 `false`                                                            |

缺少精确参数、approval、专用 credential、clean/tracking source 或未消费的一次性 evidence namespace 时，
均在 Provider dispatch 前 fail-closed。公开 CLI 不读取通用 `DEEPSEEK_API_KEY`，也不借用 Tutor、Organizer
或其它 Agent credential。

## 3. Durable 一次性状态机

R3 在任何 Provider dispatch 前先 exclusive-create 固定 marker，并把 marker SHA 绑定到 hash-chain journal：

```text
source preflight
  -> exclusive marker + owner PID/token
  -> attempt_reserved + fsync
  -> monotonic wire_stage records
  -> runtime_terminal(report + report SHA)
  -> publication_started
  -> exclusive hard-link artifact publish
  -> evidence_published
  -> strict bundle validation
```

Marker 记录 owner process id/token、source commit、单调用预算和 `retry/resume/replay=false`。Journal 只允许
`attempt_reserved / wire_stage / recovery_claimed / runtime_terminal / publication_started /
evidence_published` 六类事件；每条记录绑定前序 hash，terminal 内嵌完整 bounded report，避免只有 outcome
却无法验证 report 内容。

`publication_started` 是永久不可逆边界。一旦它已 durable append，后续 artifact link、journal append、stdout
或 validator I/O 即使失败，也不会再次 publish 或创建第二份 evidence；系统宁可 fail-closed，也不冒重复
证据和错误 authority 的风险。

## 4. Crash-only seal，不是 Provider recovery

R3 提供独立 crash-seal confirmation：

`I_SEAL_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_INTERRUPTED_ATTEMPT_WITHOUT_PROVIDER`

它只适用于已经存在 R3 marker/journal、但 owner 进程已不再存活的中断尝试。Sealer：

- 不读取任何 credential，不创建 transport，不调用 Provider；
- 不 retry、resume、replay 或 backfill；
- 只从 durable wire prefix 重建 `not_dispatched / dispatched_no_response / response_observed`；
- 用 owner PID/token 阻止误封仍存活的进程；
- 用 exclusive recovery claim 保证单胜者，并允许 dead stale claim 有界 takeover；
- 在 claim 后再次核对 marker SHA、原始 journal tail 与 claim ownership，防止 ABA/journal drift；
- 若 terminal 已 durable、但尚未进入 `publication_started`，只恢复同一 terminal 的 artifact publication；
- 若 `publication_started` 已存在，永久返回 evidence I/O failure，不再次发布。

所以这里的 recovery 只表示“把已持久化的尝试安全封存”，不表示恢复网络调用，更不表示重新获得一次
Provider 名额。

## 5. Evidence authority 与 validator

任何未来正式 artifact 都固定：

```text
authority=controlled_live
status=diagnostic_only
qualityAuthority=none
```

Artifact 只允许 `not_dispatched / dispatched_no_response / response_observed` 三种 attempt disposition；真实
report outcome、wire counters、verified usage 与费用仍按 R2/R1/V7 合同严格计算。Bundle validator 会重新关联：

- source branch、commit、tracking commit 与 clean 状态；
- marker bytes/SHA、attempt reservation 与 journal hash chain；
- terminal outcome、terminal 内嵌 report、report SHA 与 artifact report；
- runtime/crash completion mode 与 runtime/recovery publication mode；
- recovery claim SHA、claim 绑定的原始 journal tail 与 `recovery_claimed` 记录；
- artifact bytes/SHA、exclusive hard-link 发布与 `evidence_published` 记录。

即使未来 canary 返回 `complete`，该 artifact 也只能证明这一次 fact-free request 观察到了完整、可验证的
Provider response 和 usage；它仍不能证明 Tutor/Organizer 语义质量、48-case 通过、产品 API 或浏览器可用。

## 6. Zero-provider 验证结果

| 验证                                      | 结果                                  |
| ----------------------------------------- | ------------------------------------- |
| R3 focused tests                          | `18 pass / 0 fail / 123 assertions`   |
| R2 regression                             | `14 pass / 0 fail / 218 assertions`   |
| AI package full                           | `264 pass / 0 fail / 1927 assertions` |
| `@repo/ai` typecheck / lint               | 通过                                  |
| 独立实现、安全与测试缺口复审              | 无未关闭 Critical/Important           |
| 仓库正式 R3 marker/journal/claim/artifact | `0`                                   |

Focused tests 覆盖目录 URL 尾分隔符标准化、exact input/authority、单调用/no-retry、marker/journal 失败、wire monotonicity、report 与
artifact 篡改、hard-link 与 `publication_started` 永久 fail-closed、并发 terminal/publication、活 owner 拒绝、
死 owner crash seal、单胜者 claim、stale claim takeover、journal tail drift，以及已有 terminal 的 publication
recovery。所有网络行为都由进程内 synthetic transport/fake ports 提供。

格式化后的实现与测试 SHA-256：

| 文件                   | SHA-256                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `canary-contract.ts`   | `68a3edf6aa8203e56123717013a87721cd3a3f080eb3fa9b59cc867b08e5929c` |
| `canary-runner.ts`     | `a30ca1957549bad4f03b26642950ad1def3f91a6a84e112506e4ca1e4cdee82a` |
| `canary-durability.ts` | `7e069af4312eb1f9c9730ba91ffbc2bb3d9afa7c4ad71dd822e37034b1fccf7d` |
| `canary-cli.ts`        | `af31301addb8fff0d54b4b3f9a5a010c9a6a3a0f57cee4f2b1ffe177501bf24d` |
| contract test          | `6797070028d270a95aba8eaee1efeb5e283e3aafdc1a331941b0bb6a02b430dc` |
| runner test            | `c4c221a3d75b95de4e6f46878086dc020c7c186fa19d8f987f05c46115b5c307` |
| durability / CLI test  | `b6caf76b4cf6fa1610ef5870367e078896fae437630bf8356a205604427c4cd2` |

## 7. 首次授权 CLI 的 pre-reservation 终态

用户给出旧 exact confirmation 并接受 DeepSeek 数据边界后，正式 source preflight 通过：分支正确、tracked
worktree clean、`HEAD == @{u}`，当时 commit/tracking commit 均为
`7f8871bd08ec6fc204c52ed886c13aa077ad2d03`；仓库正式 R3 artifact 数量为 0。根 `.env` 中的
`DEEPSEEK_API_KEY` 只被映射为本进程专用变量，值没有输出、记录或写入 artifact。

唯一 CLI 进程返回：

```text
r3_live_once_already_consumed_or_evidence_io
evidenceSealed=false
exit=1
```

失败发生在 reservation、marker/journal 创建和 transport 构造之前。Provider invocation/dispatch 均为 0；
marker、journal、recovery claim、artifact 均没有创建，所以不适用 crash-only seal。这个终态不能判断
DeepSeek、DNS/TLS、代理、账号、余额、模型权限或服务端健康。

根因是 Windows 下目录 URL 生成的默认 root 带尾部 `\\`，旧实现又用
`startsWith(root + "\\")` 检查子路径，形成双反斜杠并把合法 `.tmp` 路径误判为越界。修复后的
`requireRoot()` 先用 `node:path.resolve()` 标准化 root；`resolveRelative()` 再用 `resolve + relative`
containment 拒绝空 child、父目录和绝对逃逸。该边界是受信工作区内的词法 containment，不扩张为对恶意
本地 symlink/TOCTOU 的防御承诺。

旧 exact confirmation 已用于一次 CLI 进程，且此后源码发生变化，因此不得复用。用户已重新接受本次
DeepSeek 数据边界；修复提交并推送后仍需新的 exact confirmation，才能执行新的唯一 canary。

## 8. 当前明确没有做什么

- 没有打印、记录、提交或修改任何 credential；
- 没有调用 DeepSeek、curl、DNS/TLS 探测、产品 API 或其它 Provider；
- 没有越过 reservation 进入正式 R3 Provider runner，也没有执行 crash seal；
- 没有运行 Tutor/Organizer 48-case、V1--V9 retry/recovery 或额外 Provider 探测；
- 没有启动 Docker、API、浏览器，未修改 PostgreSQL、Redis、MinIO 或业务数据；
- 没有创建仓库正式 R3 marker、journal、recovery claim 或 artifact；
- 没有修改、删除、重算或回填任何 V1--V9 sealed evidence/schema/validator/artifact；
- 没有合并 main，也没有解除 Phase 6.9.8、6.10、Phase 8/9 或博客收尾阻断。

因此本 checkpoint 不能回答当前失败究竟来自 DNS、TLS、代理、账号、余额、模型权限、服务端还是其它
Provider transport 环节；也不能声称真实 Tutor/Organizer 已可用。

## 9. 下一停止门

R3 路径修复任务到此结束。当前数据边界已重新接受；下一步仅在修复提交推送后由用户给出新的上表 exact
confirmation，才允许从 clean、已推送且与 tracking commit 一致的当前分支执行唯一一次低成本 health
canary。未获得该新授权前，不再次读取 credential、不调用 Provider，也不运行 crash seal。

真实 canary 无论成功或失败都必须先封存并解释自己的 diagnostic artifact；不能自动启动小样本或 48-case。
只有观察到真实 HTTP Response，才允许另行规划小样本 Tutor/Organizer semantic gate，并再次取得授权。
V1--V9 历史始终保持不可变。

回顾时可以问：

- 为什么 R3 不能直接给 R2 synthetic CLI 增加 `live` 参数？
- 为什么 marker 必须在 Provider dispatch 前 durable reserve？
- 为什么 terminal journal 必须内嵌完整 bounded report？
- 为什么 `publication_started` 后宁可永久 fail-closed，也不能再试一次发布？
- crash-only seal 与 retry/resume/replay 有什么本质区别？
- 为什么 health canary `complete` 仍不能证明 Tutor/Organizer 可用？
- 为什么 reservation 前 zero-call 失败仍必须使用新的 exact confirmation？
