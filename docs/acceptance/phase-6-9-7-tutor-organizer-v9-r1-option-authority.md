# Phase 6.9.7 Tutor / WrongQuestionOrganizer V9 R1 Option Authority 验收

日期：2026-07-29

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

实现起点：`780c5037435ea62b43417a8a5cae9577fe4c7abc`

状态：R1 已完成，zero-provider；下一原子任务仅 R2。

## 1. 本任务解决的问题

V8 已把 Organizer 模型输出收敛为固定四字段，但模型仍需自由组合
`subjectIndex + deckAction + targetIndex`。唯一 V8 Live 的第二条 Organizer response 已通过 fixed-shape
schema，却在本地 `dynamic_authority` 失败。脱敏证据不能恢复具体 ordinal，因此 R1 不猜测失败字段，也
不追加 Provider 探测；它把权限组合从模型输出移回本地预枚举。

R1 由本地先构造每题完整合法 decision option，模型只选择
`questionIndex + optionIndex`。模型仍负责多个合法 option 之间的语义选择；本地只限定权限空间，并继续用
V6 validator/merger 作为最终 authority。

## 2. Option authority

新增 `wrong-question-organizer-option-authority-v9`，只从通过
`validateWrongQuestionOrganizerV5Shortlist` 的 authority 派生：

- structured subject 只保留本地 subject；非 structured subject 只遍历题目已有 subject candidates；
- `reuse_existing` 只指向相同 resolved subject 的现有 deck；
- `create_topic` 只指向相同 resolved subject 的 topic candidate；
- 已有 canonical deck 或 locked-name collision 不再生成 create option；
- option 按 question、subject ordinal、action rank、target ordinal 稳定排序并 canonical 去重；
- 每个 option 都以本地 shortlist fingerprint 穿过完整 V6 decision validator；
- authority、projection、option mapping 与 fingerprint 均为 plain-data、deep-frozen、本地确定性结果。

Allocator 先为每个 `(question, resolvedSubject, eligibleAction)` 保留一个 mandatory option，再按稳定顺序
补齐；每题最多 24、每请求最多 144，并共用 Organizer 3500 input-token estimator。Mandatory coverage
无法装入任一 hard cap 时整体 zero-call 回退，不会静默删掉整个 subject/action bucket。

Option rules SHA：
`1013c43950c4b351e5ffa77286ec732ef522b38a4f294dd507ecac7a42c28eec`。

## 3. Exact selection contract 与本地映射

模型唯一允许的原生 JSON 输出为：

```json
{
  "decisions": [
    {
      "questionIndex": 0,
      "optionIndex": 1
    }
  ]
}
```

顶层与 decision 都使用 strict exact keys；index 必须是 JSON safe integer。Partial/duplicate question、越界
option、string/fraction/null、wrapper、snake_case、Markdown、prose、fingerprint 或任何额外字段均
fail-closed，不 coercion、clamp、repair、default 或 partial apply。

合法 selection 只在同一闭包捕获的 option authority 内映射。本地随后注入原 V5 shortlist fingerprint，
再次运行完整 V6 validator 和 merger，重建真实 question/deck ID、locked name、confidence、reason 与 write
binding。Owner、snapshot/stale fence、Trace admission、预算、usage、abort 和任何写命令均未交给模型。

Prompt SHA：
`ef2ff007cb55aedf5710c86a9a70e68368e24cc06afd8a09af84024f12e5586c`。

Estimator SHA：
`06caeb2d5b957ce122ea11db417b65c90e852e029f1fb1e2484dbffa6fbdbada`。

Candidate 与 runtime adapter 共用同一个三段 parts builder：system prompt、canonical projection、schema
descriptor。估算公式仍是 `64 + ceil(utf8Bytes(parts.join('\n')) / 3)`；它只是 Provider 前预算，不冒充
verified usage。

## 4. 安全字段边界与终态

V9 只接受 validated V5 authority。V5 对允许的 model-facing source 文本先执行完整 plain-data、安全与
文本扫描，再构造 bounded projection；尾部 credential、malformed Unicode、C0/DEL、Unicode `Cf`、
instruction/tool/write 内容均 fail-closed，`status/updatedAt` 不进入 prompt。`answer/userNote` 不属于 V5
source schema，出现时作为未知额外字段直接 `invalid_input`；R1 没有扩展 V5 schema，因此历史 shortlist
fingerprint/SHA 不变。

Prompt 不包含真实 ID、owner、shortlist/option-set fingerprint、locked-name authority、confidence、Trace、
permission 或 command。公开 target label 最多 80 Unicode scalar，但完整允许字段必须先通过 V5 扫描，
不能先裁剪再隐藏危险尾部。

固定 Provider 前终态：

- 任一题无合法 option：`attempted=false / not_eligible /
candidate_option_authority_empty`，保留 deterministic binding/suggestions 与 `usage=0/0`；
- mandatory coverage 超 cap：`fallback_budget_exceeded /
candidate_option_authority_budget_exceeded`；
- authority/version/rules/fingerprint/estimator identity 异常：`fallback_invalid_input /
candidate_option_authority_invalid`。

Bounded diagnostic 只保存固定 reason、计数/type-shape hash 和 `rawDataRetained=false`；不保存原始 index、
模型 output、prompt、未知 key、ID、error/body/header 或 credential。

## 5. 验证证据

聚焦回归：

```text
wrong-question-organizer-v9-option-authority.test.ts
wrong-question-organizer-v9-model-contract.test.ts
wrong-question-organizer-v9-model-candidate.test.ts
11 pass / 0 fail / 124 assertions
```

Agent 全量：`918 pass / 0 fail / 13885 assertions`。

静态门：

- `bun --filter @repo/agent typecheck`：通过；
- `bun --filter @repo/agent lint`：通过；
- `bun --filter @repo/ai typecheck`：通过；
- `bun --filter @repo/ai lint`：通过；
- 仓库本地 Prettier：通过；
- `git diff --check`：通过。

历史只读证据：

- Phase 6.9.7 V1--V8 sealed validators：8 份均 `ok=true / filesChecked=1`；
- Phase 6.9.6：`ok=true / evidenceCount=4`；
- Phase 6.9.4.3 Mock：`ok=true / runStatus=complete`；
- Phase 6.9.4.3 Live Attempts B--E：保持 `ok=true / runStatus=incomplete`；
- Phase 6.9.4.3 canonical complete Live：`ok=true / runStatus=complete`；
- Phase 6.9.4.3 Attempt A：按历史文档预期继续因 filename identity mismatch 返回
  `profile_mismatch`，没有放宽 validator 或改写 evidence。

Source/authority 与 security/no-leak 两路实现复审均为 `APPROVED`；最终代码/文档双路终审无
Critical/Important。上述 validator 只读取历史 artifact，不执行 seal、recovery、Mock、Live 或 Provider
调用。

## 6. 明确未发生与下一步

本任务未读取 `.env`/credential，未调用 Provider，未执行正式 Mock/Live，未创建 V9 marker/journal/
evidence，未启动 Docker/API/浏览器，未接产品 gate/composition，未修改 PostgreSQL/Redis/MinIO/业务
数据，未合并 main。V1--V8 artifact/SHA、V2 dataset/baseline、Tutor、预算/timeout/quality/P95/no-retry
保持不变。

下一原子任务仅 R2：独立 Provider-like/held-out/metamorphic/schema-negative/anti-overfit/no-leak、option
reorder、cap/token boundary、stale/abort/concurrency fault matrix；仍为 zero-provider。R3 runner、R4
reviewed Mock、R5 controlled-Live、R6 产品验收和 R7 main 合并继续按级阻断。

## 7. 回顾时可以问

- “为什么 V8 fixed-shape 通过后，本地 dynamic authority 仍会失败？”
- “V9 为什么让模型只选 optionIndex，而不是继续输出 subject/action/target？”
- “本地枚举合法 option 会不会把模型退化成 deterministic 规则？”
- “mandatory bucket 与 24/144/token cap 如何避免静默删除一种合法语义选择？”
- “为什么 selection 映射后还必须再跑 V6 validator/merger？”
- “`answer/userNote` 的 strict fail-closed 与允许字段的完整扫描有什么区别？”
- “R1 通过为什么仍不能声称真实模型或产品可用？”
