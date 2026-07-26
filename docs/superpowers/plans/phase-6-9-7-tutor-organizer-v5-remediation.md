# Phase 6.9.7 Tutor / WrongQuestionOrganizer V5 Remediation Plan

**目标：** 在保持 V1–V4 历史不可变的前提下，修复不真实 dataset fixture、Tutor 中文语义与冗余
evidence 自证合同、Organizer 自由文本 topic/taxonomy 不稳定；建立独立 V5 dataset、candidate、runner、
evidence 和生产验收路径。

**当前状态：** R0 已完成，zero-provider。尚未实现 V5 dataset/candidate/runner，尚未读取 credential、
调用 Provider、启动产品 Docker/API/浏览器或修改业务数据。

**设计 authority：**
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v5-remediation-design.md`

## 执行不变量

- 只在 `codex/phase-6-9-7-tutor-wrong-question-agents` 工作，不创建 worktree 或子分支；
- main agent 编辑、决策、验证和提交；subagent 只读取证；
- 一个 R-task、一次相关文档同步、一个原子提交并推送功能分支；
- V1–V4 Live、marker、journal、evidence、dataset bytes/SHA 不改、不删、不重跑、不拼接；
- R0–R5 无 Provider；R6 必须重新取得 V5 精确一次性授权；
- 不保存 prompt、raw model output、credential、真实用户原文/ID 或自由文本失败；
- 24 guard 先行、固定分母、单 pair 最多双并发、lane 独立、首个 contract failure 熔断；
- semantic mismatch 不提前 breaker；无 retry、补跑、resume 或 replay；
- gates/live/component key 默认关闭；禁止 Docker prune、`down -v`、volume/database reset、Redis
  flush 或 MinIO wipe。

## R0：V4 零 Provider 根因与 V5 设计

**状态：** [x] 已完成。

**交付：**

- 新增 exact `tutor-runtime-06` product-candidate differential regression；
- 证明 V1 fixture 的跨题/跨语言 context 与错误 language tag；
- 证明合法 evidence 通过、非法 evidence 在产品 candidate 被拒，adapter 未凭空改判；
- 保留 V4 failure authority，不猜 raw evidence；
- 冻结 V5 dataset/candidate/runner/evidence 方向与 R1–R8 原子路线；
- 同步仓库协作、入口、路线、数据流、启动与验收文档。

**验收：**

- [x] V1 dataset SHA 仍为 `7ac2f4b...2207e`；
- [x] exact fixture 与四组 synthetic decision 差分测试通过；
- [x] product rejection 与 bounded diagnostic 一致；
- [x] 无 credential、Provider、Docker/API/browser 或业务数据操作。

**提交：** `docs(agent): diagnose phase 6.9.7 v4 live failure`

## R1：V2 dataset authority 与 coherence validator

**状态：** [ ] 待开始。

- 新建 `phase-6.9-tutor-wrong-question-v2`，不修改 V1；
- Tutor definition 显式绑定 language、exercise family、latest text、coherent active context；
- Organizer definition 显式绑定 structured subject authority、taxonomy boundary 与 topic candidates；
- 在任何 V5 candidate 实现前冻结新 dataset SHA、72/24/48 分母、metrics/thresholds 和 baseline；
- coherence、language、family、prompt-leakage、deep-freeze 与 V1 historical isolation 测试。

**停止点：** 只完成 dataset/baseline，不接 candidate/provider。

## R2：Tutor V5 bilingual bounded choice

**状态：** [ ] 待开始。

- 本地 projection 派生 primary signals、precedence 与 `eligibleIntents`；
- 冻结 `tutor-local-signal-authority-v1` schema/version/content SHA/provenance；
- 加入 detector 误报/漏报、中英/混合、否定、干扰、context reorder、单变量 mutation 与
  detector-policy differential oracle；
- V5 output 移除模型自报 evidence codes，只保留 intent/depth/confidence；
- validator 以 local authority 校验 intent/depth，不允许 general 压过具体 signal；
- 中英双语 policy formatter、positive/negative/counterexample；
- 中文 held-out、混合语言、context reorder、否定、干扰和 metamorphic tests；
- Chat route、答案、tool、permission 与 deterministic fallback 边界不变。

## R3：Organizer V5 ordinal shortlist

**状态：** [ ] 待开始。

- 本地生成 bounded topic candidates 和 existing deck ordinals；
- shortlist 稳定排序/去重并绑定 owner+question+deck+topic 序列 fingerprint；
- 模型只返回 subject decision、deck action、deck/topic ordinal、confidence；
- structured subject、computer/major/other taxonomy、locked name 与 owner authority 不变；
- candidate 缺失、越界、cross-subject、unsafe、stale、分页/重排/去重漂移与 ordinal ABA
  fail-closed；projection、Trace pending、decision 与 command 必须绑定同一 fingerprint；
- merger 不自由改名、不补非法输出、不执行 mutation。

## R4：V5 runner、lineage 与生产极端边界

**状态：** [ ] 待开始。

- 独立 V5 runner/CLI/approval/marker/journal/evidence/validator；
- V1–V4/V5 双向拒绝与历史 SHA 校验；
- dispatch-before-call journal、单胜者 marker、hash chain、fsync、hard-link final；
- marker 后任一 journal/evidence failure 消费名额；crash-only orphan seal、活 owner 防误封、dead
  owner 单胜者 recovery、ABA fence、same-byte idempotency；
- 固定分母、首错 breaker、sibling abort/usage unknown、lane budget/timeout/credential 隔离；
- lane-specific failure attribution 与 aggregate usage/pricing/P95 incomplete fail-closed；
- non-tutor/pre-abort/post-dispatch-abort/orphan/duplicate-dispatch/stale-shortlist 的固定 terminal、usage、
  ledger assertions；
- 递归拒绝 V1–V4 runId、partial metrics/usage/cost、source case ID、旧 dataset/prompt SHA 与 artifact path。

## R5：分支 static/Mock checkpoint

**状态：** [ ] 待开始。

- V5 focused/full/static、Agent/AI/Types/Server/Web 受影响门；
- fresh deterministic baseline 与 fresh V5 Mock；
- `24/24` verified zero-call、`48/48` strict runtime；
- Organizer PostgreSQL concurrency E2E 与 Compose quiet/default-off；
- V1–V4 artifacts/validators/SHA 不变，V5 Live artifact 为 0；
- 两路独立复审：contract/security/concurrency 与 docs/history/operations。

**停止点：** 全部通过后停止；没有新的 V5 精确授权不得执行 R6。

## R6：唯一 V5 branch controlled-Live

**状态：** [ ] 未授权、不得开始。

前置必须同时满足：R5 clean/pushed；用户重新接受当时 DeepSeek 数据边界；用户明确授权唯一一次
V5 branch controlled-Live；V5 marker/journal/evidence 不存在；历史 SHA 和 default-off 全通过。

执行：zero-network preflight -> component credential 映射 -> marker/journal -> 24 guard -> 24 pair ->
evidence seal/validator。任何终态都只执行一次；失败即封存并停止。

## R7：产品 Docker/API/可见浏览器验收

**状态：** [ ] 仅 R6 全门通过后允许。

- Tutor Chat：中文/英文 specific intent、explicit zero-call、forced fallback、Trace/usage/price；
- Organizer：single/batch、known/unknown subject、create/reuse、owner/locked/stale/concurrency；
- headed `/chat`、`/error-book`，保留可见窗口供用户观察；
- 精确清理本轮 synthetic user/question/deck/item/Trace/session/storage；
- 恢复 default-off，不删除 Docker 容器、镜像、卷或持久数据。

## R8：分支收尾、main 合并与 main 回放

**状态：** [ ] 仅 R7 通过后允许。

- 同步全部开发/验收/运维文档并完成最终复审；
- 原子提交并推送功能分支；
- 从 main 合并功能分支，不在功能分支上再开分支；
- main 运行静态、Docker/API、可见浏览器 default-off 回放；
- main 精确清理、恢复 gates=false、推送远程并确认 parity；
- 完成 Phase 6.9 全部 Agent 后才进入 Phase 6.10 分层记忆；两篇博客按后续用户要求分别收尾。
