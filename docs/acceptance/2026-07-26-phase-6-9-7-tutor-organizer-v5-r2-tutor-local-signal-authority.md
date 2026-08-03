# Phase 6.9.7 Tutor / WrongQuestionOrganizer V5 R2 Tutor Local-Signal Authority 验收

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论

V5 R2 已完成，仍为 zero-provider。

- 新增独立 `tutor-local-signal-authority-v1`，由本地代码识别 primary signal、否定、引用干扰、
  context availability 与固定 precedence；
- 模型输出从旧版自报 evidence 收敛为严格的 `intent/depth/confidence` 三字段；
- validator 只接受 local authority 中的 eligible intent/depth，具体 primary intent 不得降级成
  `general_follow_up`；
- merger 在本地重建完整 `TutorStrategy`，模型不能取得答案、route、tool、permission 或写权限；
- 32 条独立 held-out/metamorphic fixture 与冻结 V2 的 24 条 Tutor runtime 全部命中；
- 保持单次调用、零重试、独立 `1/1200/300` 预算、abort、usage、schema 与安全失败关闭；
- 新增 `@repo/agent/tutor-v5` 子路径，但没有接入 Web 产品 composition、Provider、gate 或 V5 paired
  runner。

本轮不是 Mock/Live、Docker/API/浏览器或产品可用性验收。Phase 6.9.7 仍未完成，下一原子任务仅
V5 R3 WrongQuestionOrganizer ordinal shortlist。

## 2. 冻结 identity

| authority / artifact         | version                                         | SHA-256                                                            |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| local authority schema       | `tutor-local-signal-authority-v1`               | 每次 authority 由 canonical 内容单独计算 `authoritySha256`         |
| local detector rules         | `tutor-local-signal-rules-v1`                   | `a1e9a3b0489e5be5f2c64205128231887cf26b6f151028c2cb8324ddb65f4892` |
| model projection             | `tutor-model-projection-v5`                     | 由冻结 rules SHA 与 runtime contract 绑定                          |
| model prompt policy          | `tutor-model-candidate-v5`                      | `7c7442ffa96f78f23e75a34f8526e65c48f9dce5efe2b344d58cd68d5b6c5f87` |
| independent held-out fixture | `phase-6.9.7-tutor-v5-local-signal-held-out-v1` | `d08e8ed5a6c47f8b2fc2d0f1b108e309484814804232979a6ce6eba891d8ab55` |

Rules SHA 覆盖的不只是正向关键词，还覆盖 NFKC/小写/空白归一化、否定窗口、成对引号与 ASCII
双引号策略、latest-text-only 输入、precedence、general follow-up、ambiguous signal、answer-direct 与
明确本地指令。更改任一冻结字节都会在模块加载时 fail-fast。

## 3. 本地权威数据流

```text
latest text + optional active context + safety metadata
  -> plain clone + strict schema + 完整字段安全扫描
  -> latest text 本地 signal detector
  -> fixed precedence: step > explain > concept > hint > general
  -> deep-frozen local authority + canonical SHA
  -> zero-call guard 或 bounded projection
  -> injected ModelAgentRuntime，最多一次调用
  -> strict { intent, depth, confidence }
  -> local authority validator
  -> local TutorStrategy merger
  -> candidate_applied 或完整 deterministic fallback
```

### 3.1 Local authority

本地 authority 保存：

- rules version/SHA 与 detector provenance；
- latest text 的不可逆 SHA 和 active context 是否可用；
- 命中的 signal ID、被否定的 signal ID 与本地 evidence；
- primary intent、eligible intent/depth、confidence 与 reason code；
- canonical authority SHA。

Validator 不只比较 SHA，还重算并检查 signal/evidence association、顺序、深度集合、reason、
confidence 与 eligible choices。测试中的伪造对象即使重新计算 authority SHA，语义不一致仍会被拒绝。

### 3.2 Precedence 与 context 边界

V5 precedence 冻结为：

```text
step_check > explain_solution > concept_bridge > socratic_hint > general_follow_up
```

Active context 不参与 primary signal 检测。它只能表明当前 follow-up 是否有可用上下文，并允许模型在
本地给定的 compatible depth 中选择；context 中出现 “hint / step / explain” 不能创建或提升 intent。
模型也不能把已识别的具体 primary intent 降级为 general。

`answer_direct` 不在模型 schema 中。直接答案与五类完全明确的本地指令在 Provider 前结束；引用语境中
出现 “just give me the answer” 不会错误取得答案权限。

## 4. Model contract、预算与权限

模型唯一允许返回：

```json
{
  "intent": "step_check",
  "depth": "standard",
  "confidence": "high"
}
```

禁止 extra field、evidence code、答案正文、解释、route、tool、permission、identifier 或写命令。运行边界：

- `finalRoute=tutor`；
- 每次 `maxCalls=1`；
- input/output 上限 `1200/300`；
- 请求前与返回后都检查 abort；
- schema、usage、Trace 或 runtime result 不可验证时整体 fallback；
- 不 retry、不局部应用、不修正非法模型输出；
- 输入对象、authority、budget 与 deterministic fallback 不被 mutation。

`TutorStrategy` 的兼容解析仍允许历史本地 `answer_direct`，因为它负责验证 canonical deterministic
fallback；V5 模型 decision schema 从未允许该 intent。两者属于不同权限边界。

## 5. 独立 held-out 与 differential 覆盖

32 条 fixture 与冻结 72-case dataset 双向隔离，不进入未来 Live 分母或费用：

| 维度              | 配额 |
| ----------------- | ---: |
| 中文              |   13 |
| 英文              |   12 |
| 混合语言          |    7 |
| positive          |   15 |
| context           |    5 |
| negative          |    5 |
| quoted distractor |    3 |
| conflict          |    4 |

覆盖内容：

- 四类具体 intent、general follow-up 与 ambiguous signal；
- 中英/混合表达、否定、引号内 distractor、无关安全噪声；
- 两两与四类冲突信号的固定 precedence；
- context 删除、空字符串、重排、无关插入与单变量 mutation；
- active context 不创建具体 intent；
- strict schema、authority 伪造、深冻结和 public export；
- route/abort/safety/budget/direct/explicit/no-signal 的 Provider 前 zero-call；
- success、schema invalid、usage unavailable、throw、post-call abort 的单调用/无重试；
- 固定 runtime 下两次完整 result/observation 等价；
- 实际 system/user prompt 不含 V2 case ID、expected、oracle、paired index 或 V1--V4 prompt identity。

此外，冻结 V2 dataset 的 24 条 Tutor runtime 逐条通过 local detector differential 对照，结果为
`24/24`。

## 6. 验证证据

- R2 聚焦测试：`12 pass / 0 fail / 859 expect()`；
- Agent 全量：`702 pass / 0 fail / 8478 expect()`；
- Agent typecheck/lint：通过；
- 本轮 TypeScript/JSON 的 Prettier：通过；
- V1--V4 四个历史 evidence file validator：均为 `ok=true / filesChecked=1`；
- 实现边界终审：无 Critical/Important；
- 测试覆盖终审提出的 context mutation、配额和重复运行缺口已补齐，复审最终 PASS；
- 没有修改 V1--V4 dataset、runner、marker、journal、evidence 或 Live authority。

## 7. 本轮未做

- 未读取 `.env`、credential 或真实用户内容；
- 未调用 Provider，未创建 V5 Mock/Live report、marker、journal 或 evidence；
- 未接 Web product composition、production gate 或 component credential；
- 未启动/停止 Docker、API 或浏览器；
- 未创建账号、错题、deck、Trace/session；
- 未修改 PostgreSQL、Redis、MinIO、Docker volume 或业务数据；
- 未执行 prune、`down -v`、volume/database reset、Redis flush 或 MinIO wipe；
- 未开始 R3、R4--R8、Task 13/main、Phase 6.10 或博客收尾。

## 8. 下一步

下一原子任务是 V5 R3：为 WrongQuestionOrganizer 建立本地 topic/deck ordinal shortlist、owner snapshot
fingerprint 与 reorder/ABA/stale fail-closed；模型只能选择 bounded subject/deck/topic ordinal 与
confidence，merger 仍不执行 mutation。

回顾时可以问：

- “为什么 V5 不再让 Tutor 模型自报 evidence code？”
- “local authority SHA 和 frozen rules SHA 分别保护什么？”
- “active context 为什么只能影响 availability/depth，不能创建 intent？”
- “为什么兼容 fallback schema 仍有 answer_direct，而模型 schema 必须没有？”
- “R2 已有 no-network candidate，为什么还不能声称 TutorAgent 已真实模型可用？”
