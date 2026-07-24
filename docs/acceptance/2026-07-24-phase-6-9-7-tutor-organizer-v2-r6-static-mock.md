# Phase 6.9.7 V2 R6 — Tutor / WrongQuestionOrganizer Static & Mock Checkpoint

日期：2026-07-24

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

checkpoint 起点：`418c5253`

状态：R6 分支静态、fresh V2 Mock、并发/取消/恢复/路由边界与独立复审已完成；V2 Live marker/evidence 仍不存在，两个产品 gate 仍默认关闭。下一步必须取得一次新的 `Phase 6.9.7 Tutor/Organizer V2 branch controlled-Live` 精确授权。本 checkpoint 没有读取真实 credential、调用 provider、启动产品验收或把 Mock 解释为真实可用。

后续状态：上述“V2 Live=0 / 等待 R7”只描述 R6 当时边界。后续唯一 R7 run
`67ce18dd-e2ed-4a05-8507-2a98898b8ede` 已以 `quality_gate_failed` 封存且不得重跑，未进入
产品验收；见
`docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-controlled-live-failure.md`。

## 1. R6 为什么不是再跑一遍测试

R5 建立了与 V1 双向隔离的 runner-v2、CLI、validator、marker 和 evidence 路径，但还留下四类生产风险需要在真实模型授权前关闭：

1. 两个并发进程是否可能同时消费唯一 V2 Live 名额；
2. 临时 evidence、hard-link 发布或清理异常是否会把已发布结果误报为丢失；
3. Chat/Organizer 请求断开、写事务失败或单题/batch 并发时，是否继续计费、丢题或重复写；
4. Tutor final route、Organizer single/batch、组件 gate/credential 是否可能串线。

R6 因此同时做代码加固、真实 PostgreSQL 并发回归、完整静态门和一份 fresh V2 Mock。它仍是零 Provider checkpoint，不消费唯一 V2 Live 名额。

## 2. 生产极端边界与处理结果

| 边界 | 处理与权威结果 | 验证 |
| --- | --- | --- |
| 两个 V2 Live 进程同时启动 | marker 使用 `wx` 原子创建，只有一个进程进入 executor；另一进程固定返回 `live_already_attempted` | 真实 `Promise.all` 竞争测试，最终仅一个成功、48 次 synthetic lane invocation |
| marker 路径为目录或普通 I/O 故障 | 只把既有普通文件解释为已消费；目录、读取失败或其它存储故障返回 `evidence_io_failed` | marker storage failure 测试，executor invocation 为 0 |
| 旧临时文件或进程崩溃残留 | 每次发布使用随机唯一 temp ID；旧 orphan temp 不阻塞新发布 | orphan temp 恢复测试 |
| hard-link 已成功、temp unlink 失败 | hard-link 后的 final evidence 是发布 authority；清理失败只留下可回收临时名字，不把已校验 final evidence 误报为丢失 | unlink 故障注入后 V2 validator 仍通过 |
| final evidence 已存在或普通 link I/O 失败 | `EEXIST` 返回 `evidence_target_exists`；其它错误返回 `evidence_io_failed`，禁止把存储故障伪装成重复结果 | V2 CLI/evidence isolation tests |
| Live marker 后进程崩溃 | marker 永久消费本次 V2 名额；不自动重跑、不删除 marker、不拼接部分证据。若没有 final evidence，本 lineage 按失败终态处理，后续只能新建版本/授权 | one-shot contract 与 V1 历史策略保持一致 |
| Chat 客户端断开 | 同一个 `req.signal` 传到 Tutor orchestration 和最终 `streamText.abortSignal`，停止应用继续拉取/生成最终流；取消前供应商已消耗 token 是否计费仍以账单为准 | Web wiring test + Web full suite |
| Organizer provider 调用中断 | abort 后不落 admission Trace、不执行 command、不自动重试模型 | service in-flight abort test |
| Organizer command commit 失败 | 请求向调用方返回失败并尝试把同一 runId 原子替换为 `failed` terminal Trace；若 Trace store 同时失败则保留 `command_pending`，仍不伪造成功 | service command failure + final Trace fail-safe tests |
| 同题 normal/force 并发 | owner advisory lock、snapshot fence 与唯一 item authority 收敛到一个 deck/item 关系 | PostgreSQL E2E |
| 同题 single/batch 并发 | 两条路由最终读取同一 owner authority；最多一个持久化关系，后续 deck questions 读取可见该题 | PostgreSQL E2E |
| 请求在写入前取消或失败 | 未写入题目仍满足 batch 的 `deckItems: none` 选择条件，可由用户后续 batch 补偿；同步请求没有先返回“已接收”再静默丢任务 | batch recovery contract |
| Tutor/Organizer 路由串线 | Tutor bundle 只在访问/context 准备后按 final route 惰性创建；非 Tutor route 不读/调 Tutor runtime。Organizer single/batch 共用同一 owner snapshot/command authority | Web runtime + Server E2E |
| gate/credential 串线 | Web 只接收 Tutor 三项，API Server 只接收 Organizer 三项；worker/admin 不接收，generic/cross-component key 不能替代 | config tests + Compose resolved boundary |

Organizer 当前是同步请求路径，不是 BullMQ/Outbox 后台任务。并发请求可能各自完成至多一次候选调用，因此 R6 证明的是“不会重复写、不会越权、失败可见、未写题可补偿”，不宣称跨多实例 provider exactly-once。若未来改为自动后台整理，必须另建 durable job/outbox、幂等 key、lease 和 dead-letter 设计，不能沿用本 checkpoint 冒充已完成。

## 3. Focused、全量与数据库门

| 范围 | 结果 |
| --- | --- |
| V2 focused（11 files） | `57/57`，`916 expect()` |
| V2 CLI isolation/hardening | `8/8` |
| Agent full | `578/578` |
| Agent typecheck / lint | exit `0` / exit `0` |
| AI full | `194/194` |
| AI typecheck / lint | exit `0` / exit `0` |
| Types tests + typecheck | `42/42` / exit `0` |
| Server full | `227` suites passed / `3` skipped；`2154` passed / `30` skipped |
| Server lint / build | exit `0` / exit `0` |
| Web full | `439/439` |
| Web lint / production build | exit `0` / exit `0` |
| WrongQuestionOrganizer PostgreSQL E2E | `12/12` |
| Compose tracked example | `config --quiet` exit `0` |
| `git diff --check` / changed TypeScript Prettier | exit `0` / exit `0` |

`packages/types` 现有 `lint` script 没有声明/安装自身 ESLint 依赖；本机 registry 又不可达，因此本轮没有把该旧工具链缺口伪写成 Types 源码失败。Types tests 与 `tsc --noEmit` 均通过，R6 也没有修改 Types 源码。依赖修复应另做独立原子任务和 lockfile 验证。

PostgreSQL E2E 只复用已存在的 `docker-postgres-1`，没有重建、停止或清理任何 Docker service、image 或 volume。结束后 `wrong-question-organizer-%@example.com` 测试账号为 `0`，级联组织层与 Trace 无本轮残留。既有 server/web/worker/admin 容器虽然因 Docker Desktop 启动而保持运行，但本轮没有把它们作为产品 API/浏览器验收证据。

## 4. 冻结 deterministic baseline

- dataset：`phase-6.9-tutor-wrong-question-v1`
- dataset SHA-256：`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`
- cases：72；runtime：48；paired requests：24；Organizer decisions：32
- 完整 runtime：`6/48`；critical failure：`0`
- Tutor semantic：`0.44186666666666674`
- Organizer semantic：`0.278125`
- combined semantic：`0.3599958333333334`
- provider / input / output / cost：`0 / 0 / 0 / 0 CNY`

baseline 未经过模型候选 guard，只量化未修饰本地 policy 的语义缺口；R6 没有因 V2 Mock 满分改写它。

## 5. Fresh V2 Mock

- run ID：`593ee863-3743-4957-96e1-cb90e852a795`
- runner：`phase-6.9.7-tutor-organizer-runner-v2`
- executor provenance：`mock_synthetic`
- `24/24` verified zero-call；`48/48` strict runtime
- Tutor / Organizer / combined semantic：`1 / 1 / 1`
- absolute improvement：Tutor `0.5581333333333333`；Organizer `0.721875`
- P95：Tutor `246ms`；Organizer `328ms`；paired candidate `328ms`；Tutor orchestration `276ms`
- verified usage：input `21948`；output `5647`
- estimated cost：`0.099726 CNY`
- V2 validator：`{"ok":true,"filesChecked":1}`
- V1 validator 对该 V2 report：按设计 `report_contract_invalid`
- report gate：`quality_gate_failed`

Mock 的 `quality_gate_failed` 是 Live-only authority 设计：只有 `mode=live`、`deepseek_network` provenance、真实 usage/价格以及全部语义/延迟/安全门同时通过，才可能得到 `quality_gate_passed`。本轮唯一 Mock evidence 已按精确 run ID 删除，没有清空 `.tmp`。

## 6. 历史不可变性与默认关闭

- V1 evidence SHA-256：`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5`
- V1 marker SHA-256：`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`
- V1 validator：`{"ok":true,"filesChecked":1}`
- V2 Live marker：`0`
- V2 Live evidence：`0`
- tracked `TUTOR_AGENT_MODEL_ENABLED=false`
- tracked `WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED=false`
- 两条 component credential：空值
- generic DeepSeek example key 不能替代任一 component credential

R6 没有设置 V2 approval 变量、读取根 `.env`、复制或打印真实 key，也没有调用 DeepSeek、OpenAI、Qwen 或其它 provider。

## 7. 独立复审

R6 完成代码、运行证据与文档后执行两路互相独立的只读复审：

- contract/security/concurrency/routing：`APPROVED`，无 Critical/Important/Minor。确认 temp 与 marker 均使用 `wx`，并发只产生一个 winner；hard-link final、I/O 分类、Chat abort、Organizer failed/pending Trace、同题跨路由收敛、gate/credential/role 隔离与非 exactly-once 限定一致；
- operations/acceptance/history：初审指出 README、V2 design/plan 顶部仍保留“下一步 R6”的当前态冲突；修复并同步 controlled-Live/data-flow 后复核为 `APPROVED`，无 Critical/Important。确认所有计数、Mock/Live 边界、V1 SHA、V2 Live=0、Docker 非破坏性边界、零测试残留与 R7 新授权门一致。

两路终审均已关闭；R6 不带未解决 blocker 进入授权申请。

## 8. 本 checkpoint 没有完成什么

- 没有执行 V2 controlled-Live，没有真实语义/网络 P95/token/账单证据；
- 没有启用两个产品 gate，没有证明 Tutor/Organizer 产品模型路径可用；
- 没有重建 Docker image/service，没有执行 authenticated API 或可见 `/chat`、`/error-book` 浏览器验收；
- 没有合并 main、执行 main default-off replay 或推送远程；
- 没有完成 Phase 6.9.7、Phase 6 全部 Agent、可执行 LangGraph 或 Phase 6.10 分层记忆。

## 9. 停止条件与下一步

R6 clean commit 后在当时必须停在新授权门前。后续 R7 只能执行唯一一次 V2 72-case controlled-Live；无论 pass/fail 都封存 marker/evidence 且不得重跑。该 R7 后续已失败封存，因此没有进入 R8 Docker/API/可见浏览器产品验收。

继续需要用户重新确认 DeepSeek 当前账号的数据保留/训练边界，并明确授权：

> 我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7 Tutor/Organizer V2 branch controlled-Live。

回顾时可以问：

- 为什么 hard-link 成功后 temp 清理失败不能把 evidence 判成丢失？
- 为什么 marker 后崩溃选择封存失败，而不是自动重跑真实模型？
- single/batch 并发如何保证最终只有一个错题组织关系？
- Organizer 为什么能补偿未写入题目，却不能宣称跨实例 provider exactly-once？
- 为什么 Mock semantic `1/1` 仍不能说明产品真实模型可用？
