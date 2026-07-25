# Phase 6.9.7 Tutor / WrongQuestionOrganizer V3 Remediation Plan

**目标：** 在不改写 V1/V2、不放宽安全/权限/质量门且不增加自动重试的前提下，补齐安全
Provider failure 证据、zero-network compatibility preflight、strict-gate breaker、双 lane
dispatch ledger、崩溃 seal 与独立 V3 evidence lineage；通过 static/Mock checkpoint 后停止并重新
申请一次 V3 controlled-Live，只有全门通过才进入产品验收。

**当前状态：** R0 零 Provider 设计、R1 安全诊断/零网络 compatibility、R2 strict-gate
breaker/双 lane ledger/固定分母与 R3 crash-safe evidence 均已完成；R4 尚未实现。V3 没有读取
credential、调用 Provider、创建真实 Live marker/journal/evidence、启动 Docker/API/browser 或修改
业务数据。下一步仅 R4 static/Mock checkpoint 与独立复审，不是直接执行 Live、R6 产品验收、
Task 13/main 或 Phase 6.10。

**设计 authority：**
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v3-remediation-design.md`

## 执行不变量

- 只在 `codex/phase-6-9-7-tutor-wrong-question-agents` 工作，不创建 worktree 或子分支；
- main agent 拥有编辑、决策、验证与提交；subagent 只读；
- 一个 R-task、一个聚焦交付、一次相关文档同步、一个原子提交；
- 使用 cohesive R1--R4 收口工程问题，不拆成无必要的十几轮微任务；
- 已通过且未受影响的门不机械重跑，验证与风险匹配；
- V1/V2 marker/evidence 不删除、不改名、不覆盖、不重建、不重跑、不拼接；
- dataset/SHA/baseline/threshold/分母/model/price/budget/timeout/retry/权限/写入边界不变；
- 不保存 prompt、用户正文、raw provider output/error、credential、URL、header、stack 或真实 ID；
- V3 R1--R4 不读取根 `.env` 或密钥、不调用 Provider、不启动产品 Docker/API/browser；
- R4 完成后必须停止，只有新的精确用户授权才能执行 R5；
- R5 任一门失败即封存并停止，不继续产品验收；
- 禁止 Docker prune、`down -v`、volume/database reset、Redis flush、MinIO wipe。

## R0：冻结 V3 失败复盘、设计与原子计划

**文件：**

- 新增 V3 remediation design；
- 新增本计划；
- 新增 V3 R0 zero-provider acceptance；
- 更新 `AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`、`docs/data-flow.md`、
  AI/开发/验收入口及 V1/V2 当前引用。

**验收：**

- [x] 复核 V2 evidence/marker SHA 与 clean branch 起点；
- [x] 明确只能确认 structured object 前失败，未猜测 credential/网络/model/endpoint 根因；
- [x] 从源码确认 Provider taxonomy 已存在、paired runner 丢失投影且会继续派发；
- [x] 冻结 V3 identity、diagnostics、breaker、lane isolation、journal/recovery 与停止条件；
- [x] 明确未执行 case 保留固定分母、无 retry、无错误类别复制、unknown usage 不冒充零费用；
- [x] 两个独立只读复审无未关闭 Critical/Important；
- [x] `git diff --check`、文档链接、敏感字段与当前/历史冲突扫描通过；
- [x] 无 source、credential、Provider、Docker/API/browser 或业务数据操作。

**提交：** `docs(agent): design phase 6.9.7 v3 remediation`

## R1：安全诊断投影与零网络 compatibility harness

**状态：** [x] 已完成；该检查点当时下一步为 R2，后续 R2 已完成。

**主要文件：**

- `packages/ai/src/model-agent-provider-failure.ts` 及 tests；
- `packages/ai/src/model-agent-provider.ts` / DeepSeek adapter 及 tests；
- Tutor/Organizer candidate observation/result；
- paired contract/runner 与 V1/V2/V3 report tests。

**RED：**

- runtime Trace 已有 category/stage，但 V2 case evidence 丢失；
- safe wrapper 把外层异常统一写成 `runtimeInvocations=1/fallback_runtime_error`；
- 无法区分 config、executor、request、delegate、response audit 与 structured object；
- 没有 synthetic compatibility harness 证明 request shaping/response classification/abort 全程不出网；
- V1/V2 若被自动补 V3 字段未被拒绝。

**GREEN：**

- V3 case 投影固定 Provider category/structured stage，外层异常保持本地 failure；
- 新增 `lastCompletedStage`、`executionOutcome`、`usageDisposition` 与严格组合；
- runtimeInvocations 来自真实 ledger/counter，不由 catch 猜测；
- config/factory/request/response/schema/abort synthetic matrix 在真实 fetch sentinel 下 zero-network；
- v3 prompt identity 绑定现有深冻结 V2 policy，并记录稳定 content hash/泄漏扫描；
- V1/V2 新字段完全 absent，三版 identity/validator 互斥。

**完成证据：**

- [x] 独立 runner/prompt/runtime-evidence identity 与两个稳定 prompt content hash；
- [x] 固定 Provider category/structured stage、十阶段单调 ledger、execution/usage 组合 fail-closed；
- [x] delegate-boundary invocation recorder 与 outer-harness dispatch 前后真实 `0/1`；
- [x] config/factory/request/non-thinking response audit/schema/abort synthetic matrix 零外部网络；
- [x] V1/V2 report 的全部 V3 字段保持 absent，两个历史 validator 与四个 SHA 不变；
- [x] V3 Live marker/journal/evidence artifact 为 0，无 credential/Provider/Docker/API/browser；
- [x] focused、Agent/AI full、typecheck/lint/format/diff 与两路只读终审通过。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r1-diagnostics-compatibility.md`

**验证：** focused AI/Agent tests、category/stage/combination exhaustive tests、no-network sentinel、
V1/V2 bundle validator 与四个历史 SHA、typecheck/lint/Prettier/diff。

**停止条件：** 不创建 V3 Live CLI/marker/evidence，不读取 credential；完成一个源码+文档提交后进入 R2。

**提交：** `feat(agent): add phase 6.9.7 v3 failure evidence`

## R2：Strict-gate breaker、双 lane ledger 与固定分母

**状态：** [x] 已完成；该检查点当时下一步仅 R3，后续 R3 已完成。

**主要文件：**

- V3 paired scheduler/runner；
- V3 case/report contract 与 metrics；
- breaker/abort/ledger/failure injection tests。

**RED：**

- 当前 24 个 pair 串行推进，每 pair 双并发；首个 runtime contract failure 后仍会继续后续调用；
- throw 可能被写成虚假 invocation，未执行 case/unknown usage 没有独立状态；
- incomplete P95 可因提前失败看起来很低；
- Tutor failure 可能缺少 lane/route 归属。

**GREEN：**

- 24 guard 全部先执行，任一失败则 runtime 0-call；
- `(runId,agent,pairedRunIndex)` ledger 保证本进程单 dispatch；
- 单 pair 最多双并发，下一 pair 只在前一 pair 收口且 gate 仍可能通过时派发；
- 显式 `runtimeContractSuccess` 只检查 invocation/schema/disposition/canonical/latency/usage/safety，
  不读取 fixture expected 或 semantic score；其否定才是 `runtimeContractFailure`；
- 首个 `runtimeContractFailure` 打开 `quality_gate_impossible`，abort in-flight sibling 并停止后续 pair；
- sibling 记录自己的结果，不复制 failure category；
- 未执行 runtime 以 `runtimeInvocations=0/not_started_quality_breaker` 保留在 48 分母；
- runtime case 自身 guard 意外拒绝时记录 `not_started_case_guard` 并打开 breaker，不伪造调用；
- unknown-after-attempt 不声明零费用；无 retry、补跑或预算借用；
- latency/usage sample incomplete 必须使质量门失败；
- strict applied 但语义 expected 不匹配不提前熔断，完整运行后由冻结 metric 判定；
- Tutor/Organizer lane 的 executor/credential/budget/timeout/abort/summary 相互隔离。

**完成证据：**

- [x] 24 guard 全先行、guard failure 时 runtime 真实 0-call；
- [x] 独立 V3 scheduler、固定 72/24/48 report 与 `(runId,agent,pairedRunIndex)` 单 dispatch ledger；
- [x] 首/中/末 failure、Tutor-first/Organizer-first、sibling abort/orphan bounded settlement；
- [x] 语义 mismatch 不触发 breaker，usage/schema/abort/harness failure 触发；
- [x] 未执行 case、unknown usage、不完整 P95/费用与 lane budget 均 fail-closed；
- [x] V1/V2 字段、validator 与四个历史 SHA 不变，V3 Live artifact 仍为 0；
- [x] focused、Agent/AI full、typecheck/lint/format/diff 与两路只读复审通过。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r2-breaker-lane-ledger.md`

**验证：** 首 case/中途/末 case failure、两 lane 不同完成顺序、abort race、duplicate key、budget
freeze、all-success Mock、guard failure、fixed denominator、metrics/P95 completeness、
`candidate_applied + semantic expected mismatch` 继续完整 48、usage/schema/abort failure 才 breaker、
no-leak tests；
Agent full/typecheck/lint/diff。

**提交：** `feat(agent): stop phase 6.9.7 v3 failure storms`

## R3：独立 V3 CLI、journal 与不可重放 evidence

**状态：** [x] 已完成，下一步仅 R4。

**主要文件：**

- V3 CLI/profile/authorization；
- marker/journal/ledger persistence；
- hard-link publisher、orphan sealer、V3 validator；
- concurrency/crash/I/O/cross-version tests。

**RED：**

- V1/V2 identity 不能承载 V3 新字段；
- marker 后崩溃只有“名额消费”，不能形成完整 fixed-denominator failure evidence；
- 没有 durable dispatch-before-call journal，无法区分未开始与 usage unknown；
- 失败恢复若 resume 会造成重复 Provider 调用风险。

**GREEN：**

- 新 runner/prompt/approval/confirmation/marker/journal/evidence/validator 全部与 V1/V2 隔离；
- marker `wx` 单胜者，journal 初始化 fsync 早于任何 executor；
- append-only sequence/hash-chain 记录 bounded dispatch/terminal/breaker/seal；
- evidence temp `wx` + fsync + hard-link final，final EEXIST/hash mismatch fail-closed；
- orphan sealer 零网络、无 executor：in-flight 标 unknown usage，未开始标 orphaned，永不 resume/replay；
- marker/journal/evidence 三者 runId/identity/hash-chain 一致；
- production gate 只接受 V3 authorized `deepseek_network`，synthetic provenance 永远失败。

**完成证据：**

- [x] V3 runner/confirmation/approval env/marker/journal/evidence/validator 与 V1/V2 双向隔离；
- [x] marker `wx`，journal 初始化与每条 `dispatch_started` 均在 executor 前 fsync；
- [x] append-only sequence/hash-chain 与 guard/dispatch/terminal/pair/breaker/run/seal 严格状态机；
- [x] 活 marker owner 防误封，死 owner token recovery claim 单胜者接管，同 claim 单 appender；
- [x] 单主机 PID liveness 下的 stale appender/release takeover fence 与 writer close drain；
- [x] marker-only、dispatch-without-terminal、terminal、run-complete crash 均零网络 seal 且不重放；
- [x] temp `wx` + fsync + hard-link final，同字节幂等、不同字节/路径冲突 fail-closed；
- [x] durability `21/21`、V3 focused `50/50`、Agent `629/629`、AI `199/199`、typecheck/lint；
- [x] V1/V2 validator 与四历史 SHA 不变，V3 Live artifact/recovery claim 为 0；
- [x] 未读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-v3-r3-crash-safe-evidence.md`

**验证：** marker 并发、journal create/append/fsync/sequence/hash、crash before journal/before dispatch/
after dispatch/before final、orphan seal、second seal、link/unlink/EEXIST/orphan temp/I/O、三版 validator
互斥、stdout/evidence sensitive scan、V1/V2 SHA。

**提交：** `feat(agent): make phase 6.9.7 v3 evidence crash safe`

## R4：分支 static/Mock checkpoint 与独立复审

**动作：**

- 运行 V3 focused、Agent/AI/Types/Server/Web 受影响 full gates；
- Organizer PostgreSQL E2E、Compose quiet config、build/lint/typecheck；
- 重跑冻结 deterministic baseline；
- fresh V3 Mock all-success 与 breaker/failure report；
- 验证 V1/V2 四个 SHA 不变、V3 Live marker/journal/evidence 不存在；
- 验证 tracked gates=false、component credential 为空、无业务残留；
- contract/security/concurrency 与 operations/acceptance/history 两路只读终审。

**文档：** 新增 V3 static/Mock acceptance，并同步所有相关当前文档与实际 counts/hash，不复制旧
checkpoint 数值。

**停止条件：** 全部通过后停止，请求一次新的
“Phase 6.9.7 Tutor/Organizer V3 branch controlled-Live”精确授权。没有新授权不得继续。

**提交：** `docs(agent): checkpoint phase 6.9.7 v3 remediation`

## R5：唯一 V3 branch controlled-Live

**前置：**

- 用户重新接受当时 DeepSeek 账号的数据保留/训练边界；
- 用户精确授权一次 V3 branch controlled-Live；
- R4 clean commit，V3 marker/journal/evidence 不存在；
- V1/V2 SHA、V3 Mock、gates/config/model/price/budget/timeout/credential isolation 全通过。

**顺序：**

1. 零网络 preflight；
2. component credential 只做进程级映射，不修改根 `.env`；
3. reserve V3 marker + durable journal；
4. 运行 24 guard，再按 breaker-aware pair scheduler 执行 runtime；
5. 无论完整 pass、breaker early-stop、网络/进程/质量失败，都验证并封存 evidence；
6. 任一门失败停止，不重跑 V3；
7. 只有 `quality_gate_passed` 才允许 R6。

**提交：**

- pass：`docs(agent): seal phase 6.9.7 v3 live authority`
- fail：`docs(agent): seal phase 6.9.7 v3 live failure`

## R6：V3 分支 Docker/API/headed-browser 产品验收

**仅在 R5 pass 后执行。**

- Tutor-only Docker Chat：applied / explicit zero-call / forced fallback；
- Organizer-only API：single/batch、existing/high-confidence zero-call、owner、locked-name、
  Trace/usage/price、组织层唯一写入；
- headed `/chat` 与 `/error-book`，1440/510/390px，窗口保持可见；
- 精确清理 synthetic user/question/group/deck/item/Trace/session/storage；
- 恢复 mock/live=false、目标 gates=false、component keys absent；
- 保留所有既有 Docker 容器、镜像、卷与非本轮数据；
- 两路独立产品/清理复审。

**提交：** `docs(agent): accept phase 6.9.7 v3 product path`

## R7：分支最终文档 checkpoint

- 同步所有当前文档、acceptance、AI behavior/checklist/dev-start 的实际结果；
- 明确 V1/V2 failure、V3 authority 与 V3 产品 lineage 相互独立；
- 确认工作区 clean、gates false、零 synthetic 残留；
- 记录回顾问题和下一阶段，不提前进入 Phase 6.10；
- 两路最终独立复审无 Critical/Important。

**提交：** `docs(agent): complete phase 6.9.7 branch`

## R8：合并 main

- 切回最新 `main`，确认 `origin/main` parity；
- `git merge --no-ff codex/phase-6-9-7-tutor-wrong-question-agents`；
- 不重跑 V1/V2/V3 Live 或 branch product authority。

**提交：** Git `--no-ff` merge commit。

## R9：main default-off 回放、文档与远程推送

- 在 main 运行 focused/static/Mock；
- 读取 committed V3/product authority，不重跑；
- default-off Docker API 与 headed `/chat` / `/error-book` 回放；
- 精确清理 main synthetic 资源，确认 gates=false/keys absent/volumes retained；
- 提交 main acceptance；
- 推送 `main`，核对 `origin/main...HEAD = 0 0` 与远程 SHA；
- 不创建或遗留 worktree。

**提交：** `docs(agent): record phase 6.9.7 main acceptance`

## 完成定义

只有 R0--R9 的适用步骤全部完成、V3 Live 与分支产品验收通过、main default-off 回放通过且远程
同步，才能称 Phase 6.9.7 完成。若 R5 失败，Phase 6.9.7 继续未完成并停止；不得用 R0--R4
工程合同替代真实模型与产品验收。
