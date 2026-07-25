# Phase 6.9.7 Tutor / Organizer V3 R3 Crash-safe Evidence 验收

日期：2026-07-25

状态：R3 已完成；本轮严格停止在 R4 前。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 目标与必要性

R2 已能在首个 runtime contract failure 后熔断后续 Provider dispatch，但进程在 marker、dispatch、
terminal 或 evidence 发布之间崩溃时，只有内存 ledger 仍不足以证明哪些 lane 从未开始、哪些 lane
可能已经调用但 usage 未知。直接恢复或补跑又可能形成第二次 Provider 调用，破坏一次性质量证据。

R3 为 V3 新增完全独立的 CLI、授权、marker、append-only journal、零网络 sealer 与 immutable
evidence publisher。核心规则是：**调用前先持久化，崩溃后只封存、不恢复、不重放。**

## 2. 独立一次性入口

- runner、confirmation、授权变量、marker、journal、evidence prefix 与 validator 均为 V3 专用；
  V1/V2 CLI 和历史文件不接受 V3 字段，V3 validator 也拒绝 V1/V2。
- Live 仍需同时提供精确确认词
  `I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V3_CONTROLLED_LIVE_ONCE` 与进程级
  `PHASE_6_9_7_V3_CONTROLLED_LIVE_APPROVED=true`；R3 没有设置或消费它们。
- Live marker 使用 `wx`，包含固定 runner/dataset/run/scope、`attempt_reserved` 与
  `ownerProcessId`；并发预留只有一个 winner。
- journal 必须在 executor 创建前完成初始化记录写入与 `fsync`；任一 journal 初始化失败都保留
  已消费 marker，并退出为可封存失败，不允许绕过 journal 继续调用。

## 3. Durable journal 与状态机

- journal 为 append-only JSONL；每条记录包含单调 sequence、前一记录 SHA-256 与自身 SHA-256，
  parser 会复算整条 hash chain。
- 生命周期固定为 `journal_initialized -> guard_terminal* -> dispatch_started -> runtime_terminal ->
pair_terminal -> breaker_opened? -> run_completed? -> evidence_sealed`；乱序、重复 terminal、重复
  dispatch、seal 后追加或 marker/journal identity 不一致均 fail-closed。
- 每个 `dispatch_started` 必须完成写入和 `fsync` 后才允许对应 executor 运行；因此 journal 中出现
  dispatch 而没有 terminal 时，只能保守解释为 `attempted_orphaned + unknown_after_attempt`。
- 未出现 dispatch 的 runtime 使用 `not_started_orphaned + absent_not_attempted`；已持久化 terminal
  保留原有 bounded 结果。重建 report 始终维持 72/24/48 固定分母，不补跑缺失 case。
- report 的 `completedPairs`、`terminalEntries` 与 reserved dispatch 分开计算；不能把仅已预留或仅单
  lane terminal 的 pair 伪装成完整 pair。

## 4. Recovery claim 与并发边界

- marker owner 仍存活时 sealer 固定返回 `live_attempt_in_progress`，不能误封正在执行的 run。
- marker owner 已死亡时，sealer 使用带随机 owner token 的 recovery claim；已有 claim owner 存活时
  拒绝第二个 sealer，死亡 owner 才允许原子接管。
- 同一 claim 只能 reserve 一个 journal appender；takeover 后旧 appender 每次 append 前都会重新验证
  token，不能继续写 seal。
- release 先验证 canonical claim 仍属于当前 token；测试明确要求“已在前置检查发现失去 claim”的
  stale release 不进入 rename。在单主机 PID liveness 合同中，仍存活 owner 不允许被 takeover；
  该机制不承诺在 false-liveness、测试 override 或跨主机文件系统上原子消除
  `assertOwned -> rename` 之间的全部 TOCTOU。
- journal writer 串行化 append，`close()` 会等待已接受的 append 全部落盘；并发 close 不丢失已接收
  记录。

## 5. 零网络 orphan seal 与 Evidence 发布

- `seal` 命令不读取 `.env`/credential、不创建 executor、不接受 Live approval、不调用 Provider；
  只读取固定 marker/journal 并生成 `quality_gate_failed` 的完整 evidence。
- marker 后、journal 前崩溃可封存为 `journal_missing_sealed`；journal 已完成或部分完成则分别封存为
  `completed_run` / `orphan_sealed`。任何路径都不 resume、replay、retry 或补跑。
- evidence 先通过 V3 strict envelope、report 派生字段、marker/journal SHA 与敏感字段扫描，再写入
  随机 temp `wx`、执行文件 `fsync`，最后以 hard link 发布固定 final。
- final 已存在时仅同字节 SHA 可幂等接受；不同字节、非普通文件、symlink、错误 filename、路径冲突
  或普通 I/O 均 fail-closed，不覆盖既有 authority。
- final link 已成功但 seal journal append 尚未完成时，后续 sealer 只验证同一 final，并补齐 seal；
  不创建第二份 evidence。

## 6. 故障与安全覆盖

| 边界                               | 固定结果                                      |
| ---------------------------------- | --------------------------------------------- |
| journal open/init/fsync 失败       | marker 保留；Provider 0-call；后续只允许 seal |
| dispatch 已 fsync、terminal 缺失   | `attempted_orphaned / unknown_after_attempt`  |
| 从未 dispatch                      | `not_started_orphaned / absent_not_attempted` |
| marker owner 存活                  | `live_attempt_in_progress`，不写 evidence     |
| 两个 sealer 并发                   | 单 recovery owner、单 appender、单 seal       |
| dead owner takeover                | 新 token 胜出；旧 appender/release 均被 fence |
| journal sequence/hash/状态机篡改   | contract invalid，拒绝封存                    |
| final `EEXIST`                     | same bytes 幂等；different bytes 冲突失败     |
| marker/journal/evidence SHA 不一致 | validator fail-closed                         |
| V1/V2/V3 identity 混用             | 三版 validator 双向拒绝                       |

## 7. 验收结果

| 门禁                                           | 结果                         |
| ---------------------------------------------- | ---------------------------- |
| R3 durability focused                          | `21 passed / 228 expect()`   |
| V3 contract + runner + durability              | `50 passed / 360 expect()`   |
| Agent full                                     | `629 passed / 6710 expect()` |
| AI full                                        | `199 passed / 1054 expect()` |
| Agent / AI typecheck、lint                     | exit `0`                     |
| V1 evidence validator                          | `ok=true, filesChecked=1`    |
| V2 evidence validator                          | `ok=true, filesChecked=1`    |
| V1/V2 evidence + marker SHA                    | 四项保持不变                 |
| V3 Live marker/journal/evidence/recovery claim | `0`                          |

V1/V2 SHA-256 仍为：

- V1 evidence `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5`；
  marker `7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`；
- V2 evidence `0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77`；
  marker `ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504`。

## 8. 能证明与不能证明的边界

R3 证明单主机进程崩溃与受测 I/O 故障下，V3 能保守保存 dispatch/terminal 边界并形成不可覆盖的
一次性本地证据；recovery claim 依赖同一主机 PID liveness，不是跨主机分布式 lease。它也不声明
突然断电后的目录元数据持久性或 Provider exactly-once。`delegate_started` 只表示调用可能越过本地
边界，不等于 Provider 已收到或已计费，供应商账单仍是费用 authority。

本任务没有读取根 `.env` 或真实 credential，没有调用 DeepSeek/其它 Provider，没有启动 Docker、
API 或可见浏览器，没有创建真实 V3 Live artifact，没有修改 PostgreSQL、Redis、MinIO 或业务数据，
也没有开始 Task 13、main 合并、远程推送或 Phase 6.10。V1/V2 失败历史没有重跑或改写。

## 9. 下一步与回顾问题

该检查点当时下一步只能执行 R4：在同一分支完成 static/Mock checkpoint、受影响全量门与两路独立
终审。后续 R4 已完成，唯一 V3 R5 又以 `quality_gate_failed` 封存；V3 不得重跑，R6--R9 不得
开始。

回顾时可以问：

- 为什么 `dispatch_started` 必须先 fsync，再创建或调用 executor？
- 为什么 journal 中有 dispatch、没有 terminal 时不能记成零调用或零费用？
- 为什么崩溃后只能 seal，不能从最后一个 pair 继续跑？
- recovery claim 的 owner token、活进程检查与旧 lease fence 分别防什么？
- 为什么 hard-link final 可以防覆盖，却仍不能证明 Provider exactly-once？
- 为什么 R3 完成后仍不能启动 controlled-Live 或宣称 Agent 已生产可用？

本交付与源码、测试、相关文档使用一个原子提交：
`feat(agent): make phase 6.9.7 v3 evidence crash safe`。
