# Phase 6.9.7 Tutor / WrongQuestionOrganizer V6 Remediation Plan

**目标：** 在 V1--V5 历史完全不可变的前提下，分离 Tutor 硬取消与质量 P95，消除 Tutor depth 与
Organizer confidence 的 authority/评分耦合，并保留模型对 Tutor 歧义 intent 和 Organizer
subject/deck/topic ordinal 的真实语义职责。

**当前状态：** R0--R4 已完成且均为 zero-provider。V6 已冻结 dataset/eval/deadline、model-owned
metrics、Tutor preferred-depth/Organizer confidence source contracts、两条 bounded candidate、独立
robustness、runner/CLI/approval/marker/hash-chain journal/hard-link evidence/validator lineage，以及
reviewed Mock checkpoint。R4 没有创建 V6 Live artifact、调用 Provider 或接产品；也没有新的 Provider
授权。下一原子任务仅 R5 branch controlled-Live。

**设计 authority：**
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v6-remediation-design.md`

## 执行不变量

- 继续在 `codex/phase-6-9-7-tutor-wrong-question-agents` 工作，不创建 worktree 或子分支；
- main agent 编辑、决策、验证和提交；subagent 只读取证；
- 一个 R-task、一次相关文档同步、一个原子提交并推送功能分支；
- V1--V5 run/marker/journal/evidence/dataset bytes/SHA 不改、不删、不重跑、不拼接；
- R0--R4 全部 zero-provider；R5 前不得读取 component credential、创建 V6 Live marker 或调用 Provider；
- 固定 72/24/48/24/32 分母、guard-first、单 pair/最多双 lane、首个 contract failure breaker、
  no-retry、incomplete aggregate=`null`；
- gates/live/component key 默认关闭；禁止 Docker prune、`down -v`、volume/database reset、Redis flush
  或 MinIO wipe。

## R0：V5 零 Provider 复盘与 V6 设计

**状态：** [x] 已完成，zero-provider。

**交付：**

- 固定 V5 run、三份 artifact SHA、`24/24` guard、12 calls、`11/48` strict 与全部 `null` 聚合；
- 区分 Tutor executor hard timeout、candidate P95、candidate orchestration 和 paired latency；
- 记录前 11 strict latency 分布，明确当前证据不能唯一归因 Provider/SDK/event loop；
- 冻结 V6 Tutor `3500ms` hard timeout，Tutor `2500ms` P95 不变；Organizer `5000/4500ms` 不变；
- 冻结 Tutor preferred-depth local authority、Organizer confidence local authority 与 model-owned axis gate；
- 冻结 V6 identity、R1--R7 原子路线、停止条件与文档边界。

**验收：**

- [x] V5 evidence/journal/marker SHA 与 validator 仍一致；
- [x] 未修改 V2 dataset/expected 或 V5 source/artifact；
- [x] 未读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据；
- [x] 用户允许时延边界重评估被记录为设计许可而不是 Live 授权。

**验收文档：**
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r0-zero-provider-design.md`

**提交：** `docs(agent): design phase 6.9.7 v6 remediation`

## R1：Deadline / eval policy 与 local authority contracts

**状态：** [x] 已完成，zero-provider。

- 新建 V6 dataset binding/eval policy identity，复用 V2 bytes/SHA 与 baseline SHA；
- Tutor hard timeout 改为 `3500ms`，Organizer 维持 `5000ms`；质量 P95 阈值全部不变；
- nearest-rank P95 固定为 `sorted[ceil(0.95 * n) - 1]`；四类 24-sample gate 均取第 23 个值；
- 增加单调、安全、有限的 executor/runtime/orchestration/paired duration 与 overshoot contract；
- 冻结 `tutor-preferred-depth-authority-v1`，每个本地 eligible intent 绑定唯一 preferred depth；
- 冻结 `wrong-question-organizer-confidence-authority-v1`，confidence 由结构化信号和 shortlist evidence
  本地派生；
- 新增 Tutor intent `>=0.85`（24 case，至少 21 条）与 Organizer subject decision、deck action、target
  ordinal 各自 `>=0.85`（32 decision units，每项至少 28 条）的 model-owned exact-match 门；
- clock rollback/jump、NaN/negative/overflow、timeout 边界、缺 terminal 与 authority SHA drift fail-closed。

**完成证据：**

- dataset binding/eval policy SHA 分别冻结为 `3306cc399730...` 与 `5066decfc88e...`；Tutor depth 与
  Organizer confidence rules SHA 分别为 `b57a828e1429...` 与 `a46eda402e8c...`；
- 调用方不能覆盖固定 24 样本门；23/25/null/NaN/hostile accessor 均 fail-closed；
- 任一 latency lane 不完整时四个 P95 同时为 `null`；V5 `3000ms` 与 V6 `3500ms` 隔离测试通过；
- focused `15/15`、Agent full `768/768`、typecheck/lint exit 0，两路独立复审 `APPROVED`；
- actual shortlist/fingerprint/stale composition 尚未实现，明确留给 R2。

**验收文档：**
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r1-source-contracts.md`

**停止点：** 未实现模型 candidate、产品 composition、V6 runner/marker/Mock/Live；未读取 credential、
调用 Provider 或启动 Docker/API/browser。

## R2：V6 bounded candidates 与独立 robustness

**状态：** [x] 已完成，zero-provider。

- Tutor 模型只选择本地 eligible intent ordinal；depth 与策略字段由本地 authority 重建；
- Organizer 模型只选择 subject/deck/topic ordinal；confidence 由本地 authority 重建；
- Topic prompt 只使用通用 shortlist tie-break，不写 case/expected/Live 文本；
- 双 Agent strict schema、projection、validator、merger、budget、abort、stale/no-retry 保持 fail-closed；
- Organizer 把 R1 的 confidence input 绑定到实际 owner shortlist fingerprint，并完成 pre/post stale、ABA、
  locked-name、subject/deck/topic ordinal association；
- 独立 held-out/metamorphic 覆盖双语、否定、干扰、reorder、单变量 mutation、taxonomy、topic overlap、
  locked name、owner/snapshot/ordinal ABA；
- actual prompt 递归泄漏扫描拒绝 V1--V5 identity、case ID、expected 与历史结果。

**停止点：** 不接产品 composition/gate/Trace persistence，不创建 Live runner，不调用 Provider。

**完成证据：**

- Tutor strict output 仅 `{ intentIndex }`；24 个冻结 V2 runtime intent 全部通过，本地重建 preferred
  depth、context/guiding/final-answer 与 answer structure；
- Organizer 32 个冻结 model-owned decisions 全部通过；实际 owner shortlist 在 runtime 前后重派生，
  owner/snapshot/fingerprint/stale/ABA/locked-name/ordinal association 全部 fail-closed；
- confidence、真实 ID、locked name、reason/description、command binding 与写权限保持本地；
- public merger 二次完整验证，hostile accessor 零读取，跨语言 overlap 使用有界本地等价组；
- actual prompt leakage/contamination、五类 Tutor intent、六学科 Organizer、reorder/owner/stale/ABA 覆盖；
- focused `24/24`（989 assertions）、Agent full `792/792`（10458 assertions）、typecheck/lint 与独立
  复审通过；没有 credential、Provider、Docker/API/browser、Live artifact 或业务数据操作。

**验收文档：**
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r2-bounded-candidates.md`

## R3：V6 runner、lineage 与生产极端边界

**状态：** [x] 已完成，zero-provider。

- 独立 V6 runner/CLI/approval 与 marker/hash-chain journal/hard-link evidence/validator contract；
- V1--V5/V6 双向 lineage 拒绝和历史 SHA 校验；
- 24 guard 先行、固定分母、单 dispatch、双 lane、首个 contract failure breaker；
- dispatch-before-call、usage unknown、sibling abort、deadline overshoot、crash-only orphan seal；
- 活 owner 防误封、dead owner 单胜者 recovery、ABA/tail drift、same-byte idempotency；
- synthetic Live 永远 `quality_gate_failed`，只有未来 `deepseek_network` 可能成为 authority。

**停止点：** 不创建实际 Live marker/journal；无 Provider、Docker/API/browser 或产品数据操作。

**完成证据：**

- 固定 `72/24/48/24/32` 分母、guard-first、pair 串行、pair 内最多双 lane、首个 runtime contract
  failure breaker、usage unknown 与 complete-only aggregate=`null` 已由原生 V6 report 重算；
- Tutor hard timeout `3500ms`、Organizer `5000ms`，单调 duration/overshoot 与固定 24-sample
  nearest-rank P95 已接 runner；Tutor intent `21/24` 和 Organizer 三轴各 `28/32` 保持独立质量门；
- marker `wx`、journal 初始化/dispatch-before-call 文件 fsync、append queue/hash-chain、live-owner、
  dead-owner 单胜 recovery、ABA/tail drift、crash-only seal 与 same-byte hard-link evidence 已实现；
- synthetic Live 只能生成 `quality_gate_failed`；该 R3 检查点当时公共 Mock 没有正式 factory，并以
  `mock_harness_unavailable_before_r4` 停止，后续 R4 已完成；只有未来 `deepseek_network` 才可能成为
  质量 authority；
- V6 validator 完整拒绝 V1--V5 runner/prompt/projection/policy/marker/journal/evidence/recovery lineage，
  V1--V5 validators 同样拒绝 V6 envelope；
- focused `32/32`（225 assertions）、Agent full `824/824`（10727 assertions）、typecheck/lint/
  Prettier 与三路只读复审通过，无 P0/P1 阻断；
- 已知边界被显式保留：当前只有文件 fsync、没有父目录 fsync；recovery claim 的 journal tail 二次
  校验发生在 appender/seal；尚缺 stale claim rename 后再次崩溃的专门测试。三项都不冒充已解决。

**验收文档：**
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r3-runner-lineage.md`

## R4：分支 static / Mock checkpoint

**状态：** [x] 已完成，zero-provider。

- fresh V2 deterministic baseline 与 fresh V6 Mock；
- `24/24` zero-call、`48/48` strict runtime、完整 semantic/model-owned axes/P95/usage contract；
- Agent/AI/Types/Server/Web focused/full/typecheck/lint/build；
- Organizer PostgreSQL concurrency E2E、Compose default-off/worker isolation；
- V1--V5 artifact SHA/validators 不变，V6 Live artifact=0；
- contract/security/concurrency 与 docs/history/operations 两路独立复审；
- 原子提交并推送功能分支、确认远程 parity。

**完成证据：**

- fresh baseline `12/48`，semantic `0.6629642857/0.278125/0.4705446429`，dataset/baseline SHA 不变；
- fresh Mock `24/24` zero-call、`48/48` strict runtime、semantic/model-owned `1/1/1`，gate
  `mock_quality_not_evidence`；
- Mock duration 使用单调时钟，usage `37020/1882`、synthetic invocation `48`、费用 `0 CNY`；
- V6 focused `36/36`、Agent `828/828`、AI `199/199`、Types `42/42`、Server boundary `3/3`、Web
  `439/439`、Organizer PostgreSQL `12/12`、Compose default-off 与相关 typecheck/lint/build 通过；
- V1--V5 validators 保持 `ok=true`；Mock evidence 精确删除，V6 Live marker/journal/evidence/recovery
  claim 与测试账号残留均为 0；
- contract/security/concurrency 与 docs/history/operations 两路只读复审均 `APPROVED`、无 P0/P1；
- 未读取 credential、调用 Provider、启动产品 Docker/API/browser、接产品 composition 或把 V6
  `3500ms` 接入产品 executor；R3 durability 已知边界仍保留。

**验收文档：**
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r4-static-mock.md`

**停止点：** 没有新的精确授权不得开始 R5。Mock 满分只证明工程合同，不证明 DeepSeek 语义、网络
P95、Provider token/账单或产品可用性。

## R5：唯一 V6 branch controlled-Live

**状态：** [ ] 未授权、不得开始。

必须同时满足：R4 clean/pushed、V6 marker/journal/evidence/recovery claim 为 0、历史 SHA 通过、用户重新
接受运行当时 DeepSeek 数据保留/训练边界，并明确授权唯一一次 **V6 branch controlled-Live**。

执行顺序固定：zero-network preflight -> 进程内 component credential 映射 -> marker/journal -> 24 guard
-> 24 sequential pairs（pair 内最多双 lane）-> report/evidence seal -> validator。R5 以前不得创建 marker；
只有取得本节精确授权且 zero-network preflight 通过后，才在首次 Provider 调用前创建 marker/journal。
任一终态只执行一次；失败立即封存，不 retry/resume/replay。

## R6：产品 Docker / API / 可见浏览器验收

**状态：** [ ] 被 R5 全门通过阻断。

- Tutor Chat：双语歧义 intent、明确指令 zero-call、timeout/schema/provider fallback、Trace/usage/price；
- Organizer：single/batch、topic ordinal、authority confidence、owner/locked/stale/concurrency；
- headed `/chat` 与 `/error-book`，窗口保留供用户观察；
- 只精确清理本轮 synthetic user/question/deck/item/Trace/session/storage；
- 恢复 default-off，不删除 Docker 容器、镜像、卷或持久数据。

## R7：分支收尾、main 合并与回放

**状态：** [ ] 被 R5/R6 阻断。

- 同步最终数值、SHA、边界、DEVLOG 与 acceptance；
- 原子提交并推送功能分支；
- 切到最新 main 后 `git merge --no-ff`，不在功能分支上再开分支；
- main 只重跑 static/Mock 与 default-off Docker/API/可见浏览器，不重跑已消费 Live；
- 精确清理、gates=false、credentials absent、volumes retained；
- 推送 main 并确认本地/远程 SHA parity。

只有 R7 完成，Phase 6.9.7 才能进入阶段完成判断；此前 Phase 6.9.8、Phase 6.10、Phase 8/9 与两篇
面试学习博客收尾全部不得开始。
