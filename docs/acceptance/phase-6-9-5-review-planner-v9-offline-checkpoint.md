# Phase 6.9.5 Review / Planner V9 离线 checkpoint

> 历史范围：本文件第 1--8 节记录 `683a209` 时的运行前离线 checkpoint。其后唯一 V9 controlled-Live 已消费并以 `quality_gate_failed` 封存；当前终态以 `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md` 为准。

## 1. 状态摘要与非结论

截至代码 checkpoint `683a209`，V9 Task 1--5 已完成离线实现：paired gate aggregate、durable evidence、一次性 controlled-Live CLI，以及只接受 V9 committed success 的 product acceptance authority 已进入仓库。V9 controlled-Live 尚未运行；V9 evidence directory、once marker、diagnostic/success candidate 与 success seal 均不存在。

`REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED`、`REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 当前均未设置。缺省状态全部关闭，产品继续返回 deterministic Review/Planner 只读建议。本 checkpoint 不证明 provider quality、真实 token/成本、`candidate_applied`、Docker 产品可用性或 Phase 6.9.5 完成。

## 2. 提交范围与只读历史

本 checkpoint 覆盖从 `ef0cf5f` 到 `683a209` 的五个 V9 Task 1--5 提交：

- `ef0cf5f`：固定 V9 strict safe aggregate contract。
- `36fb988`：捕获 V9 paired gate aggregate。
- `25b1a3e`：增加 V9 durable gate evidence。
- `697ca9f`：增加 V9 controlled-Live 一次性入口。
- `683a209`：把 product acceptance authority 从 V8 历史结果改绑到 V9 committed success。

V1--V8 的 evidence、marker、计数和失败边界全部保持只读。V9 是独立 lineage，不是 V8 retry，不覆盖、重命名、删除或拼接任何历史文件，也不允许用 V8 CLI stdout、provisional 文件或 public reader 结果替代自己的成功证据。

## 3. V9 paired aggregate 与 gate contract

V9 复用既有 Review/Planner 48-case 质量边界，但新增独立 eval gate 与安全 aggregate diagnostic。完整候选需要恰好 23 次 provider attempt，其中 1 次 canary 加 22 次 paired runtime admission；26 条 zero-call 仍必须由 runtime counter 实际证明为零。quality、安全、权限、P95、positive provider usage、预算、费用或 evidence 任一门失败，都只能形成关闭诊断。

V9 eval gate 不进入普通产品配置 allowlist。缺失、非法或未显式设置为 `true` 时，factory 在 provider 前关闭；它也要求外部 V8 eval gate 缺失或显式为 `false`。Review/Planner 两条产品 gate 在 V9 paired run 中仍必须保持 `false`，eval 授权不能打开产品建议路径。

## 4. Durable evidence 与一次性 CLI

V9 使用独立 profile、confirmation、evidence directory、once marker、固定 stage manifest、hash-bound diagnostic commitment 和 success seal。CLI 顺序固定为 confirmation/preflight、V1--V8 snapshot、reservation、stage advancement、paired aggregate、diagnostic commitment、validation 与 finalization；没有自动 provider/file retry。

公开 reader 只有在 once marker、唯一 evidence leaf、diagnostic commitment、stage manifest、V1--V8 fresh history 和 success seal 全部一致时，才可投影 committed success。任何缺失、未知 leaf、reparse/hard-link、hash/history 不匹配、rename/write fault 或不完整 stage 都 fail-closed，且不输出 prompt、模型原文、用户 facts、credential、endpoint、header、raw error、stack 或失败 token/cost。

## 5. Product acceptance authority 与 Git 绑定

Product acceptance 只接受以下 V9 投影：

- `schemaVersion=phase-6.9.5-review-planner-v9-gate-diagnostic-v1`
- `state=finalized`
- `status=complete`
- `gate=closed`
- `terminalReason=passed`
- `attempts.providerCount=23`
- `attempts.pairedAdmissionCount=22`
- `evidenceSha256` 为 lowercase 64-hex

读取 authority 前后都必须列举完整 V9 leaf 集合并执行 `git ls-files -v --full-name -- <evidence-directory>`。实际 leaf 必须被精确跟踪且每条都是 ordinary `H`；lowercase assume-unchanged、`S` skip-worktree、缺失 tracked leaf、额外 untracked leaf、前后 leaf 漂移，或 commit/branch/clean 漂移都会关闭。失败在 owner/ledger reservation、Prisma fixture、Docker recreate、headed browser 与 provider 产品请求前返回；不回退 legacy V8 reader，也不使用 `git show` 拼装历史成功。

## 6. 离线验证证据

本轮离线结果为：

- V9 focused：`136/136`。
- Server：`1381 passed / 30 skipped`。
- Review E2E：`3/3`；Web：`409/409`。
- AI：`190/190`；Agent：`406/406`；shared types typecheck exit 0。
- Review/Planner Windows native 按各自正确 cwd 合计 `133/133`。V5/V6 的 cwd 约束是命令入口契约，不是代码失败。
- Product acceptance：`131/131`。
- targeted/full lint、build、Compose config 与 `git diff --check` 均 exit 0。
- contract/security 复审 PASS，无未关闭 Critical 或 Important。

这些计数只证明离线 contract、durability、权限、预算、失败关闭和 product admission 可复核，不得被写成 V9 Live 或真实模型质量证据。

## 7. 未执行项与当前产品状态

本 checkpoint 没有运行 V9 package script，没有读取或调用真实 provider，没有创建 V9 evidence/once/seal，没有启动或重建 Docker，没有执行 authenticated suggestions、`/plan`、`/today`、headed browser、Trace、合成账号、产品 cleanup、main replay 或远程 push。

因此当前没有 V9 provider attempts、usage、cost、quality decision 或产品 `candidate_applied` 结论。Review/Planner 产品路径仍 deterministic；两条产品 gate 保持缺省 `false`；Phase 6.9.5 状态仍是“验收未完成”。

## 8. 后续授权与失败停止规则

任何 V9 controlled-Live 必须由用户单独、明确授权，并在运行前重新核对 clean commit、V1--V8 immutable snapshot、独立 V9 eval gate、产品 gates=false、provider/model/transport/timeout、23-attempt ceiling、positive usage、P95、预算与费用上限。唯一 package script 与 exact confirmation 分别为 `eval:review-planner:live:v9:gate-diagnostics` 和 `--confirm-controlled-live-v9-deepseek-v4-pro-gate-diagnostics`；实际从根目录加载凭据的完整命令是 `bun --env-file=.env --filter @repo/server eval:review-planner:live:v9:gate-diagnostics -- --confirm-controlled-live-v9-deepseek-v4-pro-gate-diagnostics`。文档记录这些字符串本身不构成运行授权；未授权时不得以单测、Mock、Docker 或手工 provider 请求代替。

Reserve 前的纯 preflight 阻断必须保持 `0-call / 0-reservation / 0-once / 0-evidence`；它不会消费 V9 lineage，但任何再次尝试仍需重新获得明确授权。V9 一旦产生 reservation 或 once marker，任一后续 provider、aggregate、quality、安全、权限、usage/cost、durable I/O 或 success-seal 失败都必须永久封存已有关闭证据；同一 V9 不得重跑、覆盖、删除或重建。只有 public reader 返回本文件第 5 节定义的 committed success，才有资格另行申请 product acceptance。即使 V9 Live 成功，也不自动开启产品 gate、不自动进入 main/push，更不表示 Phase 6.9.5 已完成。

## 9. 运行后的 immutable V9 终态

首次 workspace script 因根 `.env` 未注入到 `apps/server` 而在 reserve 前返回 `preflight_invalid / 0-call / 0-reservation / 0-once / 0-evidence`，没有消费 V9。使用根 `.env` 显式注入的唯一运行创建 once/evidence 并完成 `23` provider attempts、`22` paired admissions、`26` verified zero-call、`48` strict successes。durable reader 返回 `finalized / invalid_attempted / closed / quality_gate_failed`：quality `30/48`、semantic `4/22`、critical `2`；P95 `1396ms`、usage `7943/510`、CNY `0.026889/1.00` 及 schema/attempt/admission/cost gates 均通过。

因此 V9 没有 success seal，不能获得 product authority，且不得重跑、覆盖、删除或重建。Review/Planner 产品 gate 保持默认关闭；Docker、browser、Trace 产品验收、main replay 和 push 均未执行。下一步只能从该 aggregate 进行最小质量根因修复并建立新 lineage。
