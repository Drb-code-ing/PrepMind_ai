# Phase 6.9.7 Tutor / WrongQuestionOrganizer V5 R0 零 Provider 根因取证

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论

V4 第 6 对失败与前 5 对语义偏差不是单一的验收 adapter bug。

- **确认存在验收 fixture 缺陷：** `tutor-runtime-06` 是中文代数步骤，却携带英文微积分 active
  context，并因数组奇偶被标成 `en`。该输入不符合产品中“当前消息与当前 OCR/学习上下文属于同一道
  题”的不变量。
- **确认 adapter 没有单独误判：** 相同 raw decision 先经过产品
  `runTutorModelCandidate()`；缺 primary evidence 或使用错误 evidence 时，产品自身就返回
  `fallback_schema_invalid / invalid_evidence_association`。V4 diagnostic 只把它映射为
  `dynamic_contract`。
- **确认还有真实语义问题：** V4 前 5 条中文 Tutor hint 全部落为 `general_follow_up`，两条英文
  hint 全部命中；Organizer 前 5 条只有 2 条 topic canonical 命中，并出现一次
  `major -> computer`。

所以不能只修脚本后重跑，也不能把 V4 failure 改成通过。后续使用独立 V5 dataset、candidate、
runner 和 evidence 修复。

## 2. 历史 authority

V4 唯一 run `0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` 保持：

- `24/24` guard zero-call；
- 6 pair / 12 executor started；
- `10/48` strict runtime；
- Tutor 第 6 对 `fallback_schema_invalid / invalid_evidence_association`；
- Organizer sibling `attempted_aborted / unknown_after_attempt`；
- `quality_gate_failed` durable seal；
- 不得重跑、补跑、resume、replay、删除或改写。

V1 dataset/SHA 保持：
`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`。

## 3. 源码根因

### 3.1 Dataset 构造缺陷

V1 Tutor runtime definitions 只保存 intent/text/tags。`activeStudyContext` 由
`tutorContext(pairedRunIndex)` 在四种题目上下文中独立轮转，language tag 由
`pairedRunIndex % 2` 推断。

因此 `tutor-runtime-06` 实际为：

```text
latestUserText: 我把 x 移到左边后得到 2x=6，这里有没有算偏？
activeStudyContext: Synthetic calculus exercise: inspect the next derivative step.
tags: runtime, step_check, en
expectedIntent: step_check
```

这不是模型或产品创建的数据，而是 benchmark fixture 的构造问题。冻结 V1 不原地改写；V5 新建
显式 language/exercise-family/coherent-context 的 V2 dataset。

### 3.2 Product candidate 与 adapter 边界

paired runner 调用和产品 Chat 相同的 `runTutorModelCandidate()`。顺序是：

```text
projection -> runtime structured object -> product schema/dynamic contract/merger
           -> candidate observation -> paired bounded diagnostic
```

V4 adapter 不读取或改写 raw Provider object。`invalid_evidence_association` 来自产品 candidate
validator/precedence，之后才被 diagnostic 投影。

### 3.3 Evidence 合同过度冗余

V4 projection 已由本地文本检测得到 `submitted_step`，但模型仍必须在 JSON 中复述
`evidenceCodes`。对 `step_check`，primary `submitted_step` 必须存在，且 evidence 必须落在
`submitted_step/contextual_reference/ambiguous_intent` 内。漏写或换成 `concept_gap` 都会被拒绝。

该 fail-closed 行为符合 V4 冻结合同，但模型自报本地已知 evidence 是脆弱的重复 authority。V5 改为
本地产生 eligible intents/evidence authority，模型只做 intent/depth/confidence 有界选择。

## 4. 零网络差分回归

新增：
`packages/agent/tests/phase-6-9-tutor-wrong-question-v5-root-cause.test.ts`

结果：`7 pass / 0 fail / 34 expect()`。

覆盖：

1. exact V1 fixture、错误 tag 与冻结 SHA；
2. exact input 加合法 primary evidence -> `candidate_applied`；
3. exact input 加合法 primary+context evidence -> `candidate_applied`；
4. 缺 primary 或错误 evidence -> 产品 candidate
   `fallback_schema_invalid / invalid_evidence_association`；
5. 实际 user prompt 同时包含代数 latest text、微积分 active context、deterministic
   `general_follow_up` 和 local `submitted_step`；
6. product rejection 进入 canonical adapter 后保持
   `dynamic_contract / invalid_evidence_association`。

这组回归证明：坏 fixture 会真实污染模型输入，但 rejection 不是 adapter 凭空制造。

历史 evidence 复核：V1、V2、V3、V4 四个专用 file validator 均为
`ok=true / filesChecked=1`。V4 evidence/journal/marker SHA-256 仍分别为
`6ec60be1...d94608`、`8cc65e21...3188e`、`601f62b6...dae2`，与 V4 failure seal 一致。

影响面验证：Agent 全量 `682 pass / 0 fail / 7244 expect()`，Agent typecheck/lint、16 个本轮文件的
Prettier check 与 `git diff --check` 通过。三路只读复审在补齐 local detector authority、shortlist
fingerprint/ordinal ABA、固定取消/孤儿终态、跨版本递归隔离、lane failure attribution 和 crash-only
seal 后均无未关闭 Critical/Important。

## 5. Live bounded 语义证据

V4 已执行前 5 个 Tutor：

| case       | input language | expected        | actual              |
| ---------- | -------------- | --------------- | ------------------- |
| runtime-01 | zh             | `socratic_hint` | `general_follow_up` |
| runtime-02 | en             | `socratic_hint` | `socratic_hint`     |
| runtime-03 | zh             | `socratic_hint` | `general_follow_up` |
| runtime-04 | en             | `socratic_hint` | `socratic_hint`     |
| runtime-05 | zh             | `socratic_hint` | `general_follow_up` |

前三个中文样本的 intent/guiding/structure 都发生联动偏差，不能由第 6 条 fixture 缺陷解释。

Organizer 前 5 个 strict success 中，subject 大多正确，但 canonical topic 只命中 2/5；第 5 条
expected `major`、actual `computer`。这说明自由文本 topic 与 taxonomy 边界仍需独立修复。

## 6. 本轮未做事项

- 未读取 `.env` credential，未调用 DeepSeek 或任何 Provider；
- 未创建 V5 marker/journal/evidence；
- 未启动/停止 Docker service、API 或浏览器；
- 未创建测试账号、错题、deck、Trace/session；
- 未修改 PostgreSQL、Redis、MinIO 或 Docker 持久数据；
- 未执行 prune、`down -v`、volume/database reset、Redis flush 或 MinIO wipe。

## 7. 下一步

下一原子任务是 V5 R1：建立独立 V2 dataset authority 与 coherence validator，显式绑定 language、
exercise family 和 active context，并冻结新 SHA/baseline/quality gate。R1 仍为 zero-provider；没有新的
V5 精确授权不得调用 Provider。

V5 的具体 metrics/thresholds 当前尚未冻结；必须在 R1、任何 V5 candidate 实现和任何 Live 结果之前
完成，不能根据未来模型结果回调门槛。

回顾时可以问：

- “V4 第 6 对到底是验收脚本问题还是模型问题？”
- “为什么发现坏 fixture 后仍不能把 V4 改判为通过？”
- “为什么 V5 要移除 Tutor 模型自报 evidence codes？”
- “Organizer 为什么改成 local shortlist + ordinal-only？”
