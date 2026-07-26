# Phase 6.9.7 Tutor / WrongQuestionOrganizer V5 R3 Organizer Ordinal Shortlist 验收

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论

V5 R3 已完成，仍为 zero-provider。

- 新增独立 `wrong-question-organizer-shortlist-v5`，本地生成 subject、topic 与 existing-deck
  authority；
- question、deck、knowledge point、keyword 均稳定排序和规范化去重；同 subject、同规范化名称的
  重复 deck 被折叠，最低 ID 作为本地解析 authority，全部 folded ID 仍进入 fingerprint；
- 每个 shortlist fingerprint 绑定 owner domain、owner snapshot version/fingerprint、完整
  question/deck/topic 序列、规则版本与 SHA；
- 模型只能返回 question、subject、deck/topic ordinal 与 confidence，不能自由生成 subject、deck/topic
  名称、真实 ID、evidence、权限或写命令；
- structured subject、computer/major/other taxonomy、same-subject association、locked deck name 和
  owner snapshot 始终由本地 validator/merger掌权；
- Provider 前后各有一次 source revalidation；post-call stale、分页/ordinal 位移和 ABA 内容变化均
  fail-closed，不重试、不应用旧 ordinal；
- merger 只把 ordinal 解析回当前本地 authority，并生成 command binding；它不执行数据库 mutation。

本轮没有接产品 composition、Provider、gate、paired runner、Trace 持久化、Docker/API 或浏览器。
Phase 6.9.7 仍未完成；下一原子任务仅 V5 R4 runner、lineage 与生产极端边界。

## 2. 为什么需要 R3

V1--V4 Organizer 让模型输出自由 topic label，再用精确 accepted label 评分。这会把语义判断、产品命名
权与 benchmark 字符串绑在一起：合理同义词可能被误判，模型也承担了不必要的自由文本权限。

R3 将职责切开：

1. 本地代码从 owner snapshot 产生可选 subject、topic 与 existing deck；
2. 模型只在这些候选中选择 ordinal；
3. 本地 validator 校验 ordinal 与 question/subject/deck/topic 的动态关联；
4. 本地 merger 解析真实值并保留 locked name、owner 与全部写权限。

因此未来 semantic metric 可以评估“是否选对本地候选”，而不是评估字符串是否恰好相等；同时模型
无法凭空发明专题、跨用户引用 ID 或绕过用户最终确认。

## 3. 冻结 identity

| authority / artifact         | version                                          | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| local shortlist              | `wrong-question-organizer-shortlist-v5`          | 每个 owner snapshot 由 canonical 完整内容单独计算 fingerprint      |
| shortlist rules              | `wrong-question-organizer-shortlist-rules-v1`    | `9747383ca2ad9dfdc143a55d23ccb62ba14dc7d84ff82d3c7bfe21f0371299d3` |
| model projection             | `wrong-question-organizer-model-projection-v5`   | 由 shortlist fingerprint 与冻结投影 contract 绑定                  |
| model prompt policy          | `wrong-question-organizer-model-candidate-v5`    | `915084a80f1cf4f96fca08987d4dc228f0e73e1dc299bd1368033d37f6ac69ab` |
| independent held-out fixture | `phase-6.9.7-organizer-v5-shortlist-held-out-v1` | `49336b123cb56741b3aab0fb23c2e9341e938a3f1b4c4e4f48774a94365ee097` |

修改冻结 rules、prompt policy 或 held-out 字节会在模块加载或测试中 fail-fast。每次 owner snapshot 的
shortlist fingerprint 不是全局常量；它必须随着 owner、question、deck、topic、版本或完整字段变化而变化。

## 4. 本地权威数据流

```text
trusted owner snapshot source
  -> plain clone + strict schema + 完整字段安全扫描
  -> question/deck 稳定排序 + label/keyword 规范化去重
  -> structured subject 或 bounded taxonomy candidates
  -> bounded topic candidates + folded existing deck authority
  -> deep-frozen shortlist + canonical fingerprint
  -> provider 前 revalidateSource
  -> ordinal-only model projection
  -> candidate budget preflight
  -> injected ModelAgentRuntime，最多一次调用
  -> strict ordinal decision
  -> provider 后 revalidateSource
  -> dynamic subject/deck/topic association validator
  -> local merger + command binding
  -> candidate_applied 或完整 deterministic fallback
```

R3 接受的是调用方提供的 owner snapshot source，不在 package 内读取 PostgreSQL。当前 validator 会从
保存的 source 重新构建 authority，能拒绝“修改候选后重算 fingerprint”的伪造；产品接入时仍必须由
NestJS owner-scoped snapshot、事务外 fence 与 command transaction 提供外部事实 authority，不能把
自洽 fingerprint 当成数据库签名。

## 5. Fingerprint、去重与 stale/ABA

Fingerprint 覆盖：

- `ownerDomain`、`ownerSnapshotVersion`、`ownerSnapshotFingerprint`；
- 完整 question ID、subject/category/knowledgePoints/errorType/text/analysis/status/updatedAt 序列；
- 完整 deck ID、subject/name/nameLocked/keywords/updatedAt 序列；
- 去重后的 subject candidates、topic candidates、eligible actions 与 deck folding 结果；
- shortlist/rules version、rules SHA 与 provenance。

输入顺序变化不会改变 canonical fingerprint；实际集合、内容、分页边界、duplicate folding、owner 或
snapshot 变化会改变 fingerprint。Candidate 在调用前后都重新派生 authority 并比较 fingerprint：

- pre-call stale：Provider 零调用；
- post-call stale：记录为 attempted fallback，不应用 ordinal、不重调 Provider；
- 同时间戳但正文变化：仍因完整内容进入 fingerprint 而拒绝；
- 新的排序更靠前 question/deck：ordinal 指向变化即 stale；
- 重复 deck 折叠：选中最低 ID，全部 folded ID 保留在 binding authority 中。

## 6. Model contract、预算与权限

模型唯一允许返回：

```json
{
  "shortlistFingerprint": "sha256:<64 hex>",
  "decisions": [
    {
      "questionIndex": 0,
      "subjectDecision": { "action": "keep_local" },
      "deckDecision": { "action": "create_topic", "topicIndex": 0 },
      "confidence": "medium"
    }
  ]
}
```

动态合同要求：

- 每个 projected question 恰好一条 decision，不能重复、缺失或越界；
- structured subject 只能 `keep_local`；无 structured subject 只能选择本题暴露的 subject ordinal；
- reuse/create action 必须 eligible，deck/topic 必须存在且与 resolved subject 相同；
- extra field、非法 action、自由名称、真实 ID、evidence、answer、route、tool、permission、write command
  全部拒绝；
- 任一条非法则整批 fallback，不局部修复或应用。

预算固定为 `1 call / 3500 input / 800 output`，无 retry。Candidate 的 reserve 只是调用前 fail-fast
preview；`ModelAgentRuntime` 接收未消费的 caller budget 并执行唯一实际 reservation。把 preview 后
budget 再传给 runtime 会造成双扣，因此测试明确断言 request budget 未预先消费、runtime result budget
只消费一次。

模型 projection 不包含 owner domain/fingerprint、question ID、deck ID、folded ID、V2 expected/oracle
或 V1--V4 runner/prompt identity。Merger 返回的真实 ID、名称与 command binding 只来自本地 authority。

## 7. 独立 held-out 与边界覆盖

24 条 fixture 与冻结 V2 dataset 双向隔离，不进入未来 Live 分母或费用：

| 维度     | 配额 |
| -------- | ---: |
| 中文     |    8 |
| 英文     |    8 |
| 混合语言 |    8 |
| batch    |    4 |
| taxonomy |   10 |
| topic    |    6 |
| locked   |    2 |
| dedupe   |    2 |

覆盖内容：

- 24 条独立 authority 与 canonical/reordered fingerprint byte-equivalence；
- 冻结 V2 Organizer 的全部 32 decision units 候选可用性，不读取 expected ordinal；
- structured subject、computer/major/other taxonomy、中英/混合语义；
- 同学科/跨学科 batch 单调用，question ordinal 不串题；
- locked name、重复 deck folding、pagination/ordinal 位移与 ABA 内容变化；
- authority 语义伪造并重算 hash、fingerprint drift 与 owner/snapshot drift；
- duplicate/missing/out-of-range question、subject/deck/topic 越界、cross-subject deck/topic、非法 action
  与 nested extra field；
- unsafe、empty、pre-abort、budget exhausted 与 pre-stale provider 前 zero-call；
- schema、throw、post-abort、post-stale 的单调用/无重试整体 fallback；
- source/budget/runtime/decision 不被 mutation，prompt 不泄漏 ID、oracle 或历史 identity。

## 8. 验证证据

- R3 聚焦测试：`13 pass / 0 fail / 469 expect()`；
- Agent 全量：`715 pass / 0 fail / 8965 expect()`；
- Agent typecheck/lint：通过；
- 根 Web/Server lint：通过；
- 本轮 TypeScript/JSON/Markdown 的 Prettier：通过；
- V1--V4 四个历史 evidence validator：均为 `ok=true / filesChecked=1`；
- 独立代码终审与测试终审：无 Critical；唯一预算 Important 经 runtime 源码复核为 preview/actual
  reservation 的正确分层，已补注释和显式回归；其余 R3 范围缺口已补齐；
- 没有修改 V1--V4 dataset、runner、marker、journal、evidence 或 Live authority。

## 9. 本轮未做

- 未读取 `.env`、credential 或真实用户内容；
- 未调用 Provider，未创建 V5 Mock/Live report、marker、journal 或 evidence；
- 未接 Web/NestJS product composition、production gate、component credential 或 Trace persistence；
- 未启动/停止 Docker、API 或浏览器；
- 未创建账号、错题、deck、Trace/session；
- 未修改 PostgreSQL、Redis、MinIO、Docker volume 或业务数据；
- 未执行 prune、`down -v`、volume/database reset、Redis flush 或 MinIO wipe；
- 未开始 R4--R8、Task 13/main、Phase 6.10 或博客收尾。

## 10. 下一步

下一原子任务是 V5 R4：建立与 V1--V4 双向隔离的 runner/CLI/approval/marker/journal/evidence/
validator，并一次性收口 fixed denominator、single dispatch、lane budget/abort/failure attribution、usage
unknown、orphan/crash seal、重复 dispatch、stale shortlist 与历史 identity 拒绝。R4 仍为 zero-provider。

回顾时可以问：

- “为什么 V5 Organizer 不再让模型自由生成 topic label？”
- “shortlist fingerprint 与 owner snapshot fingerprint 分别保护什么？”
- “为什么输入重排 fingerprint 不变，分页/去重/ordinal 位移却必须变化？”
- “为什么 candidate 做 budget preview，runtime 还必须基于原 budget 做实际 reservation？”
- “为什么 self-consistent fingerprint 不能代替数据库 owner authority？”
- “R3 已有 no-network candidate，为什么还不能声称 Organizer 已在产品中使用真实模型？”
