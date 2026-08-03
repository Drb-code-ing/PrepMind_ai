# Phase 6.9.7 Task 6 — WrongQuestionOrganizer owner snapshot 与授权写命令

日期：2026-07-23

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：owner-scoped snapshot、三阶段 stale fence 与 model-free 写命令完成；产品仍使用 deterministic decision，Organizer runtime、Trace 与 controlled-Live 尚未开始

## 1. 为什么需要这一任务

Task 4 只证明 package candidate 能对受限 ordinal 做语义判断。Organizer 与只读 Agent 不同：它最终会写 `WrongQuestionSubjectGroup`、`WrongQuestionDeck` 和 `WrongQuestionDeckItem`。如果直接把候选结果交给 Prisma，模型调用期间发生的错题编辑、用户移动、专题重命名或另一请求的并发整理都可能被旧结果覆盖。

Task 6 因此先建立与模型无关的写入边界：决策只能基于当前 owner 的不可变快照，写入前必须证明快照仍然有效，最终事务还要重新确认用户权威。这样 Task 7 接入真实模型时，只能把受治理建议送进同一个本地 command，不能获得数据库身份或写权限。

## 2. 完成内容

### 2.1 Owner-scoped 不可变快照

- `wrong-question-organizer-owner-snapshot-v1` 在单个 PostgreSQL `REPEATABLE READ`、`READ ONLY` 事务中读取最多 12 个目标错题；
- missing 与 cross-owner target 都返回同一 `404 / WRONG_QUESTION_NOT_FOUND`，不泄露其它账号资源是否存在；
- snapshot 包含会影响 policy、projection、merger 和 write 的目标错题字段、当前 item、最多 20 个 subject group、最多 20 个 deck 及有界关键词摘要；
- raw `userId` 不进入 snapshot，owner 绑定使用以 JWT secret 派生的域分离 HMAC；
- fingerprint 绑定 snapshot/policy/projection version、目标顺序、错题完整相关字段、group/deck/item identity、名称、`nameLocked`、confidence、时间和关键词；
- snapshot、嵌套对象与数组全部深冻结，调用方不能在决策后改写 command 依据。

### 2.2 事务外双 stale fence

当前产品仍执行本地 `organizeWrongQuestion()`，但已按未来模型路径固定顺序：

```text
READ ONLY owner snapshot
  -> provider/decision 前重建 fingerprint
  -> deterministic decision（Task 7 可在这里插入受治理 candidate）
  -> candidate/decision 后再次重建 fingerprint
  -> build model-free OrganizerCommand
  -> short write transaction
```

- 两次 revalidation 都是事务外短查询；任一错题、item、group、deck、名称、锁定状态、版本或选择窗口漂移都会丢弃旧 decision；
- Task 6 最多基于 fresh snapshot 本地重建一次，不做任意循环；
- 当前没有 provider，未来 Task 7 的 provider 也只能位于两次 fence 之间，不能持有数据库事务或 advisory lock。

### 2.3 Model-free command 与第三次 fence

- `wrong-question-organizer-command-v1` 只携带 snapshot fingerprint、owner HMAC、目标、force、受本地验证的 subject/deck/reason/confidence/signals；不含 prompt、provider、API key、userId 或模型原文；
- command builder 拒绝伪造目标、重复目标、跨 subject deck、snapshot 外真实 ID、非法 confidence 与不完整输入，并把校验后的字段复制到深冻结命令；
- 写事务先按 owner HMAC 取得 PostgreSQL advisory transaction lock，再在事务内第三次重建完整 fingerprint；
- stale 时不写入任何 group/deck/item；若当前 owner 已经存在 organizer item，则返回该账号的当前权威组织结果；
- 非 force 的批量命令只要任一目标已有 owner-scoped 当前 item，就整批 fail-closed，不把同一次决策拆成部分写入。Task 7 需要 fresh snapshot 后重新编排；
- `force=true` 仍先删除同题其它 deck relation，再按 `userId + wrongQuestionId` 唯一键 upsert，保证一个错题只有一条 organizer relation。

### 2.4 并发、专题复用与用户权威

- command 写事务使用 `Serializable`，只对 Prisma `P2034` / PostgreSQL `40001` 做最多 3 次 bounded transaction retry；重试只重放本地事务，不重算或重调 provider；
- rename、move 和 remove 用户操作也使用同一 owner advisory lock 与 bounded retry，因此无论谁先取得锁，最终都不会由旧 Organizer command 覆盖用户操作；
- 同 owner 同主题并发请求串行进入第三次 fence，不创建重复空 deck；
- 创建新 deck 前先做不受窗口限制的精确名称查询，再扫描最近 100 个 canonical variant；若 owner 已超过该有界窗口且没有安全结论，则返回 stale，不冒险创建可能重复的旧专题；
- 已存在的精确同名旧 deck 即使不在最近 100 个窗口内也会被复用。

## 3. 验证证据

| 验证项 | 结果 |
| --- | --- |
| Task 6 focused（snapshot / command / service） | `23/23` |
| Server full | `2122 passed / 30 skipped` |
| 真实 PostgreSQL Organizer E2E | `9/9` |
| Database package | `7/7`，TypeScript noEmit 通过 |
| Server lint | exit 0 |
| Server build | exit 0 |
| `git diff --check` | exit 0 |
| 独立复审 | 代码/安全与文档/验收两路均 PASS，无 Critical/Important |

E2E 使用现有 Docker PostgreSQL/Redis，覆盖基础整理、owner isolation、用户锁定名称、唯一 relation、同 owner 同主题并发、missing/cross-owner 同一 404、force 唯一性，以及并发 rename/move 的用户权威。测试账号和记录由套件精确清理；没有清空容器、镜像、volume、PostgreSQL、Redis 或 MinIO。

## 4. 本任务没有完成什么

- 没有读取根 `.env` 或 API key，没有创建 Live executor，也没有调用真实 provider；
- 没有接入 `WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED`、component credential、5000ms runtime、价格或预算；
- 没有把 Task 4 candidate 编排到 single/batch API，没有 Organizer model runtime metadata、`command_pending -> final` Trace 或 HTTP abort 传播；
- 没有执行 controlled-Live、Docker API 产品验收或可见 `/error-book` 浏览器验收；
- 当前 API 的语义 decision 仍是 deterministic policy，只是读取与写入已经进入新的 owner/fence/command 安全边界；
- 没有证明 Phase 6.9.7、全部 Agent、可执行 LangGraph 或 Phase 6 已完成。

## 5. 下一步与回顾问题

下一任务是 Task 7：接入 Organizer server-only default-off runtime、single/batch 最多一次 candidate、独立 gate/credential/预算、两阶段 Trace admission/finalization 与 HTTP abort。Task 7 必须复用本任务的 snapshot 和 command，不允许 provider 进入事务，也不能让 Trace 失败的模型结果影响写入。

回顾时可以问：

- owner snapshot、事务外双 fence 和写事务内第三次 fence 分别防什么？
- 为什么模型结果必须先变成 model-free command，不能直接调用 Prisma？
- 为什么用户 rename/move/remove 也需要取得同一 owner advisory lock？
- 为什么批量命令遇到任一 owner-scoped 当前 item 时要整批 fail-closed，而不是部分写入？
- 为什么超过 canonical scan 窗口时宁可返回 stale，也不能创建一个可能重复的专题？
- 为什么 Task 6 完成仍不能声称 WrongQuestionOrganizer 已接入真实模型？
