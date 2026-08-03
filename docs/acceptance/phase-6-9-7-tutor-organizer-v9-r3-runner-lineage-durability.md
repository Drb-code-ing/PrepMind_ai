# Phase 6.9.7 Tutor / WrongQuestionOrganizer V9 R3 Runner / Lineage / Durability 验收

日期：2026-07-29

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起始提交：`e288f19386f64331e641fc27dfcbee058685ee67`

## 1. 结论

V9 R3 已完成，结论严格限定为 **zero-provider runner / lineage / durability checkpoint**。

R3 将 R1/R2 的本地合法 option authority 与 exact selection contract 绑定到独立 V9 report、paired
runner、CLI、一次性授权、marker、hash-chain journal、hard-link evidence、crash-only recovery 和 validator。
固定 `72 cases / 24 guard / 48 runtime / 24 pair / 32 Organizer decisions`、guard-first、pair 串行、pair
内双 lane、single dispatch、no retry 与首个 runtime contract failure breaker 均已进入可执行合同。

本 checkpoint 没有调用 Provider，也没有执行正式 V9 Mock/Live。测试中的 synthetic fetch、故障 executor
和临时 marker/journal/evidence 只存在于系统临时目录，用于验证 runner/wire/durability 合同；仓库正式 V9
artifact 数量保持 `0`。R3 不证明真实模型质量、Provider 延迟/usage/费用或产品可用性。

下一原子任务仅 R4 reviewed Mock/full checkpoint；R4 才会让 reviewed Mock 穿过正式 V6 Tutor
candidate、V9 option authority/selection candidate、V6 merger 与第一方 direct adapter。R5 controlled-Live
尚未授权，R6 产品 Docker/API/可见浏览器、R7 main、Phase 6.9.8 与后续阶段继续阻断。

## 2. Runner 与固定分母

- 先完整执行 24 条 guard；任一 guard failure 时，48 条 runtime 均为
  `not_started_case_guard`，executor/dispatch/response/usage 保持 0；
- runtime 按 24 个 pair 串行推进；pair 内 Tutor/Organizer 使用独立 abort、预算、wire 与故障归属；
- 每个 lane 只能 reserve/dispatch 一次，不 retry/resume/replay/backfill；
- 首个 runtime contract failure 收口当前 pair 后打开 `quality_gate_impossible` breaker，后续 case 保留在
  固定 48 分母并成为 `not_started_quality_breaker`；
- success lane 必须完成继承的 V7 8-stage wire 并取得 verified usage；
- 任一 runtime 不完整时，正式 semantic、四项 P95、token 与 CNY 聚合全部为 `null`；
- `runtimeAccounting` 显式记录 `reservedEntries / terminalEntries / orphanedEntries /
notStartedEntries`，并强制 `terminalEntries + orphanedEntries = reservedEntries`、
  `reservedEntries + notStartedEntries = 48`。`terminalEntries` 只统计已持久化 `runtime_terminal`；
  `attempted_orphaned` 是 recovery 生成的报告终态，只进入 `orphanedEntries`，不与 `terminalEntries`
  重叠。未 reserve 的 case 只进入 `notStartedEntries`。

## 3. R3 故障矩阵

新增独立 zero-provider fault matrix，覆盖：

- 24 guard 中任一失败后 48 条 runtime 全部保持未启动；
- transport、HTTP、schema、usage 与 selection/option authority 的固定 terminal/stage；
- breaker 在 first/middle/last pair 触发时仍保持固定 48 分母；
- single dispatch、no retry、no backfill；
- sibling abort 只记录本 lane 的本地归属，不复制另一 lane 的 transport 或 bounded diagnostic；
- not-started、transport 与 abort 不伪造 option diagnostic；
- ledger 与公开 accounting 同向少报也会被固定分母不变量拒绝；外层 report `safeParse` 对该恶意输入
  返回失败，不从 refinement 内抛异常；
- 任一不完整故障下 semantic/P95/token/CNY 全为 `null`。

该矩阵使用进程内 synthetic wire/executor，只验证 R3 runner 对既定 runtime result 的调度、计数和证据
投影。它不是 R4 的 reviewed candidate Mock/fault matrix，不能证明正式 Tutor/Organizer candidate、prompt、
schema、merger 或模型语义质量。

## 4. Durability 与 crash-only recovery

- marker 使用 exclusive-create；初始 journal 写入并 fsync 后才允许构造正式 Live runtime；
- 每个 `lane_reserved` 必须 append + fsync 成功后才允许进入 executor；正常 reservation 必须恰好形成一个
  `runtime_terminal`；
- `first_party_deepseek_v4_pro_direct` provenance 如果缺少完整
  `recordGuardTerminal / recordLaneReserved / recordWireStage / recordRuntimeTerminal /
recordPairTerminal / recordBreakerOpened / recordRunCompleted` lifecycle，会在 guard/executor 前以
  `PHASE_6_9_7_V9_DURABLE_LIVE_LIFECYCLE_REQUIRED` 拒绝，不能绕过 durable reservation；
- journal 使用 sequence + SHA-256 hash chain；wire、terminal、pair、breaker、run completion 和 seal
  任一身份或顺序漂移均 fail-closed；
- evidence 使用随机 temp、file fsync 与 hard-link final；same bytes 可幂等确认，不同 bytes/path 冲突拒绝；
- recovery 对活 owner 返回 `live_attempt_in_progress`；dead owner 只能由一个 recovery claim 接管，旧
  appender 与 stale release 被 fence；
- recovery 只依据持久化 journal 生成固定分母 failure evidence，不创建 executor、不读取 credential、
  不 resume/replay/retry；
- reserved 但无 terminal 的 lane 只能 seal 为
  `attempted_orphaned / orphaned / fallback_runtime_error`；未 reserve 的 case 按持久化事实区分
  `not_started_case_guard / not_started_quality_breaker / not_started_orphaned`。

已知边界保持诚实：当前实现 fsync 文件内容，但不声明父目录 fsync；PID/file fencing 是单机进程合同，
不是跨主机 lease，也不证明 Provider exactly-once 或断电后的目录项持久性。

## 5. V9 Identity 与 source authority

独立版本：

- runner：`phase-6.9.7-tutor-organizer-runner-v9`；
- runtime evidence：`phase-6.9.7-v9-runtime-evidence-v1`；
- marker：`phase-6.9.7-v9-live-marker-v1`；
- journal：`phase-6.9.7-v9-journal-v1`；
- evidence：`phase-6.9.7-v9-evidence-envelope-v1`；
- recovery claim：`phase-6.9.7-v9-recovery-claim-v1`；
- source manifest：`phase-6.9.7-v9-source-manifest-v1`；
- evidence prefix：`phase-6-9-7-tutor-organizer-v9`。

冻结 SHA：

- source manifest：
  `sha256:dfb13b9dc97b0bb2c2d80920bdbb1147467a40a53eab24098d7d376788976651`；
- selection contract：
  `sha256:85fdf2cde033e90922d62956b921b64816eaf3a41060f40d0a39cc183ff89050`；
- runner runtime contract：
  `sha256:861121455a8365662186e0a821e88ed002095da403af8061a3bb8bea651226d3`；
- V7 wire alias：
  `sha256:6ff323dfa548d4ca73ba5e8bb1ed7fa0d72be2de9ee3fe57b1080c0f98991f17`；
- bounded diagnostic contract：
  `sha256:8d66f5a198060b44579c80e823d686814fa5fff6a582faa78cab2059f7ebba7f`；
- eval policy：
  `sha256:ab8ed3539f4868d773930777c89cfc66138e44c3899c6f7ae7d6e8697386d74a`；
- semantic authority：
  `sha256:1982561f3e01b4bd1f15f525866df2d34e124c18cd7fb20917c4e004c264f951`。

Source manifest 同时记录实际
`WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256`，并在 module load 时将实际 prompt、estimator 与
option-rules SHA 分别和 frozen SHA 比较。这样 estimator 算法漂移不能只更新 manifest 后静默进入 runner。

V9 改的是 Organizer option selection，不是 HTTP transport；因此显式继承 V7 8-stage wire capability 与
failure taxonomy，并以独立 alias SHA 记录复用关系，不伪造新的 `@repo/ai` V9 wire export。V1--V8
runner/runtime/marker/journal/evidence/recovery token 在 V9 artifact 任意层出现都会被拒绝；旧 validators 也
拒绝 V9 report。

## 6. 验证证据

R3 focused：

```text
phase-6-9-tutor-organizer-v9-runner-contract.test.ts
phase-6-9-tutor-organizer-v9-durability.test.ts
phase-6-9-tutor-organizer-v9-lineage.test.ts
phase-6-9-tutor-organizer-v9-cli.test.ts
phase-6-9-tutor-organizer-v9-fault-matrix.test.ts
29 pass / 0 fail / 393 assertions
```

全量与静态门：

- Agent：`967/967`，`14667` assertions；
- AI：`226/226`，`1459` assertions；
- Agent typecheck、lint：通过；
- 受影响 TypeScript/JSON/Markdown Prettier：通过；
- `git diff --check`：通过。

历史只读门：

- Phase 6.9.6 validator：`ok=true / evidenceCount=4`；
- Phase 6.9.7 V1--V8 canonical sealed evidence：八版均
  `ok=true / filesChecked=1`；
- 没有运行 V9 `mock/live/seal`，也没有修改任何历史 marker/journal/evidence/recovery artifact。

正式 V9 artifact 精确检查：

- marker：0；
- journal：0；
- evidence：0；
- recovery claim：0。

## 7. 明确未发生与下一步

本任务未读取根 `.env`/credential，未调用 Provider，未执行正式 V9 Mock/Live，未启动 Docker/API/
浏览器，未接入产品 gate/composition，未修改 PostgreSQL/Redis/MinIO/业务数据，未修改 V1--V8
artifact/SHA，未执行正式 seal/recovery，未合并 main。

下一原子任务仅 V9 R4：接入 reviewed Mock factory，使 Mock 真正穿过正式 V6 Tutor candidate、V9
option authority/selection candidate、V6 merger 与第一方 direct adapter；运行 fresh baseline/Mock、正式
candidate fault matrix、Agent/AI/Types/Server/Web 全量、Organizer PostgreSQL concurrency、Compose
default-off、历史 validators、Reader Testing 与双路独立终审。Mock evidence 校验后必须精确删除，正式 V9
artifact 继续保持 0。

R4 clean/committed/pushed 前不得进入 R5；普通“继续”不构成 V9 R5 controlled-Live 授权。R5 必须在
运行当时重新取得用户对 DeepSeek 数据边界与唯一 branch run 的精确授权。

回顾时可以问：

- 为什么 `lane_reserved` 必须在 executor 前 durable，而不能只依赖进程内 dispatch counter？
- 为什么 `attempted_orphaned` 是报告终态，却只计入 `orphanedEntries`，不能同时计入
  `terminalEntries` 或 `notStartedEntries`？
- 为什么 V9 复用 V7 wire protocol仍必须使用独立 report/artifact lineage？
- 为什么 transport/abort/not-started 不能携带 option diagnostic？
- 为什么 R3 synthetic fault matrix 不等于 R4 reviewed candidate Mock？
- 为什么正式 V9 artifact=0 是 R3 的通过条件，而不是“缺少验收证据”？
