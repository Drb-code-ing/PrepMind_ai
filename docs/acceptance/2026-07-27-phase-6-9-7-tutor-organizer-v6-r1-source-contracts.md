# Phase 6.9.7 Tutor / WrongQuestionOrganizer V6 R1 Source Contracts 验收

日期：2026-07-27

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

基线提交：`7550ee29`

## 1. 结论

V6 R1 已完成，且全程 zero-provider。本任务只建立 V6 独立 dataset/eval/deadline、model-owned metrics、
Tutor preferred-depth local authority 与 Organizer confidence local authority 的源码合同；没有实现 V6
candidate、产品 composition、runner、CLI、approval、marker、journal、evidence、validator、Mock 或 Live。

用户允许放宽的边界已准确落为 V6 Tutor executor hard timeout `3500ms`。Tutor candidate P95 仍为
`<=2500ms`，Organizer hard timeout/P95 仍为 `5000/4500ms`，paired 与 Tutor orchestration P95 也未
放宽。该许可不是 Provider、Docker、产品验收或 main 合并授权。

## 2. 独立 identity 与不可变输入

V6 直接绑定已冻结的 V2 dataset/baseline，不复制或修改 expected bytes：

- source dataset：`phase-6.9-tutor-wrong-question-v2`；
- source dataset SHA：`42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b`；
- deterministic baseline SHA：
  `0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca`；
- 固定分母：`72 cases / 24 guards / 48 runtime / 24 pairs / 32 Organizer decision units`。

R1 冻结的 V6 identity：

| Contract                        | Version / SHA-256                                                  |
| ------------------------------- | ------------------------------------------------------------------ |
| dataset binding                 | `phase-6.9.7-v6-dataset-binding-v1`                                |
| dataset binding SHA             | `3306cc399730f85b3281c90f226f629873d9755325415b69a0263a0f57b96153` |
| eval policy                     | `phase-6.9.7-v6-eval-policy-v1`                                    |
| eval policy SHA                 | `5066decfc88e3d36671a60b3d269ae9e93e061207d44927bca9e0d2551973d89` |
| Tutor preferred-depth authority | `tutor-preferred-depth-authority-v1`                               |
| Tutor preferred-depth rules SHA | `b57a828e14294f712a6547be2ac168b1d58b79cdc5b9aecbb071304f4e5ae7af` |
| Organizer confidence authority  | `wrong-question-organizer-confidence-authority-v1`                 |
| Organizer confidence rules SHA  | `a46eda402e8c39cdc965277375e8a2aeea27e41c98cda7fd4ba513a9cb520475` |

V5 Tutor lane 仍固定为 `3000ms`，V5 frozen eval-policy SHA 仍为
`b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d`。R1 没有修改、重跑或
拼接 V1--V5 source、dataset、marker、journal 或 evidence。

## 3. Deadline 与完整聚合合同

R1 新增以下 fail-closed 规则：

1. 只接受单调时钟读数；clock throw、NaN、Infinity、负值、rollback 与超过 `60000ms` 的 jump 均返回
   固定错误码，不抛出 raw error。
2. executor、runtime trace、candidate orchestration 与 paired request 分层记录有限非负 duration；有
   deadline 时额外记录 `deadlineExceeded` 与 overshoot，不生成 retry 语义。
3. nearest-rank P95 的调用方不能覆盖样本数；每一类必须恰好 24 个有限非负样本，固定计算
   `sorted[ceil(0.95 * 24) - 1]`，即升序第 23 个值。
4. Tutor candidate、Organizer candidate、paired candidate 或 Tutor orchestration 任一 lane 缺样本、
   timeout 后无 terminal、NaN 或越界时，aggregate `complete=false`，四个 P95 必须同时为 `null`；不能
   丢弃 timeout 后继续计算。
5. `null`、非对象、数组、hostile accessor 与 malformed observation 均安全失败，不向调用方传播异常。

当前 `3500ms` 只冻结在 V6 eval policy 中，尚未接入任何 V6 executor factory。实际 runtime wiring 属于
后续任务，不能据此声称 V6 已可调用模型。

## 4. 模型职责与本地 authority

### 4.1 Tutor

模型在后续 candidate 中只允许从本地 eligible intent ordinal 中选择真实语义 intent。R1 的
`tutor-preferred-depth-authority-v1` 根据 intent 与 active-context availability 本地重建唯一
preferred depth、guiding/final-answer boundary、context use 与 answer structure。模型不能注入这些最终
教学策略字段，也不能获得 route、tool、权限或答案写入权。

Tutor model-owned intent 使用固定 24 case exact-match 门：至少 `21/24`。缺失、非法、fallback 或
breaker 后未启动均留在分母并计 false；本地 depth/structure 不能抵消 intent 失败。

### 4.2 WrongQuestionOrganizer

模型在后续 candidate 中只负责 subject decision、deck action 与 target deck/topic ordinal。R1 的
`wrong-question-organizer-confidence-authority-v1` 只根据结构化 subject、knowledge point、category、
error type、同 subject deck overlap 与 bounded topic provenance 本地生成 `medium | high`。模型返回的
confidence 不属于最终 authority。

Organizer 三个 model-owned 门彼此独立，分母都固定为 32：

- subject decision action/ordinal：至少 `28/32`；
- deck action：至少 `28/32`；
- target ordinal：至少 `28/32`，且 deck action 错误时该 ordinal 同时计 false。

R1 只验证 authority input 中 shortlist fingerprint 的格式、snapshot stable、subject/target 一致性与规则
SHA。它**尚未证明**这些输入来自对应的真实 owner shortlist，也没有完成 pre/post stale fence、ABA、
locked-name 或实际 ordinal association。真实 shortlist/fingerprint/stale composition 绑定属于 V6 R2，
不得把 R1 contract 冒充为已接产品 candidate。

## 5. 验证证据

执行并通过：

```text
bun test packages/agent/tests/phase-6-9-tutor-organizer-v6-r1-policy.test.ts \
  packages/agent/tests/tutor-v6-preferred-depth-authority.test.ts \
  packages/agent/tests/wrong-question-organizer-v6-confidence-authority.test.ts
=> 15 pass / 0 fail / 160 expect()

bun --filter @repo/agent test
=> 768 pass / 0 fail / 9430 expect() / 85 files

bun --filter @repo/agent typecheck
=> exit 0

bun --filter @repo/agent lint
=> exit 0
```

本地仓库已安装的 Prettier 3.8.3 对 9 个新增源码/测试文件完成格式化检查。两路独立只读复审在刷新到
当前文件后均为 `APPROVED`，无 P0/P1/P2 阻断；其中发现并修复了可覆盖 24 样本门、hostile accessor
抛错、缺少 complete-only latency aggregate 与 V5/V6 timeout 隔离测试等问题。

## 6. 当前停止点

- 没有 V6 candidate、产品 composition、public runtime export、runner、CLI、approval 或 durability
  artifact；
- 没有创建 V6 marker/journal/evidence，也没有读取根 `.env` 或 component credential；
- 没有调用 Provider，Mock invocation 与 Live invocation 均为 0；
- 没有启动 Docker/API/browser，没有账号、Trace、PostgreSQL、Redis、MinIO 或业务数据操作；
- 没有合并 main，也没有开始 Task 13、Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾。

下一原子任务仅 V6 R2：实现 intent-only Tutor candidate、ordinal-only Organizer candidate、actual
shortlist/fingerprint/stale composition 与独立 robustness/prompt-leakage。R2 仍必须 zero-provider；R4
static/Mock checkpoint 通过并取得新的精确 V6 Live 授权前，不得读取 credential、创建 Live artifact 或
调用 Provider。

## 7. 回顾时可以问

- 为什么 Tutor hard timeout 可以是 3500ms，而 P95 仍必须小于等于 2500ms？
- 为什么 24 个样本的 nearest-rank P95 取第 23 个值，而不是平均或插值？
- 哪些字段由模型真正判断，哪些字段必须由本地 authority 重建？
- 为什么任一 latency lane 不完整时，四个 P95 都必须是 `null`？
- R1 已验证了哪些 shortlist 边界，哪些必须等到 R2 composition 才算完成？
