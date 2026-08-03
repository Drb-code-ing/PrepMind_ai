# Phase 6.9.7 Tutor / WrongQuestionOrganizer V9 R0 Zero-provider 复盘验收

日期：2026-07-29

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起始提交：`6f37b34aa54642da43171e6e2e1a854cbd304d4b`

终态：R0 文档与设计 checkpoint 完成；未实现 V9 源码、runner、Mock、Live 或产品 wiring。

## 1. 结论

V8 唯一 run `7ff09c36-50f2-445a-b309-dc9500e5e13c` 永久保持
`quality_gate_failed`。R0 没有重跑 Provider、读取 raw output 或补探测，只读对照 sealed acceptance、
V5 shortlist、V6 validator/merger、V8 fixed-shape contract/adapter，以及产品 snapshot/command 权限链。

V8 已证明四条真实 response 都通过 fixed-shape static schema；第二条 Organizer 随后在本地
`dynamic_authority` 失败。由于 bounded evidence 不含具体 ordinal 或内部 reason，R0 不能断言是
fingerprint、question coverage、subject、action、deck/topic index 或 cross-subject 中的哪一项。

可以确认的工程缺口是：模型仍需自由组合 `subjectIndex + deckAction + targetIndex`，静态合法字段不保证
组合后属于该题的合法权限空间。V9 冻结新的本地 option authority：本地先枚举完整合法决策，模型只
返回 `questionIndex + optionIndex`，再由本地恢复 V6 decision、真实 ID、confidence 与写权限。

## 2. V8 不可变证据

| 项目                  | 固定值                                                             |
| --------------------- | ------------------------------------------------------------------ |
| run                   | `7ff09c36-50f2-445a-b309-dc9500e5e13c`                             |
| guard / wire / strict | `24/24` / `4/4/4/4` / `3/48`                                       |
| breaker / unstarted   | `quality_gate_impossible` / `44`                                   |
| failure               | `fallback_schema_invalid / dynamic_contract / dynamic_authority`   |
| aggregate             | semantic/P95/token/CNY 全 `null`                                   |
| evidence SHA-256      | `377b82a7ea8c1bbeea69208df422affdb99bfafd15acf0a14857712658971a85` |
| marker SHA-256        | `85caaa575d77475ea12f0dba225c2fe7e7a1b9cc23454588e994eeb5d8ba5da7` |
| journal SHA-256       | `3caaa82de75366fa3929713e988235c47b41b672427ecfe3b7399a656acfefda` |
| durability            | journal `0..69`，末条 `evidence_sealed`，无 recovery claim         |

这些 artifact 不删除、不改写、不 seal/recover、不 replay，也不能与 V9 Mock/Live 或三条 V8 success 拼接。

## 3. 源码差分结论

| 证据                            | 结论                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| V8 model schema                 | 固定字段为 fingerprint/question/subject/action/target                     |
| V8 dynamic validator            | static 后检查完整覆盖、subject、eligible action、target 与 cross-subject  |
| V8 runtime adapter              | valid decision 映射回 V6；dynamic failure 通过 fail-closed rejection 返回 |
| V5 shortlist                    | 本地已有 owner-scoped subject/deck/topic ordinal、真实 ID 与 fingerprint  |
| V6 validator/merger             | 可二次校验完整 decision，并由本地重建 confidence、名称、ID 与 binding     |
| Server snapshot/service/command | READ ONLY snapshot、事务外双 fence、Serializable + owner lock 最终 fence  |

因此 V9 不需要替换本地 authority 或产品写链，只需在 Provider 前新增 option builder/projection，并在
Provider 后把 selection 映射回既有 V6 contract。

## 4. 冻结的 V9 修复

模型 exact output：

```json
{
  "decisions": [{ "questionIndex": 0, "optionIndex": 1 }]
}
```

本地 option authority：

- 从 validated V5 shortlist 派生，不接受客户端/模型提供的 authority；
- 每个 option 是完整 `resolvedSubject + subjectDecision + deckDecision`，生成时已经满足同 subject、eligible
  action、存在的 deck/topic、canonical duplicate 与 locked-name 边界；
- prompt-safe projection 可展示 bounded subject/action/target label 供模型语义选择，但不展示真实 ID、
  owner、confidence、permission 或 command；
- 模型不回显 shortlist/option fingerprint；本地闭包绑定当前 authority，并在映射后注入本地 shortlist
  fingerprint；
- selection 必须完整、唯一、整数且每题 optionIndex 存在；未知 option 不 clamp、不 repair、不默认选择；
- 映射后仍运行完整 V6 validator 与 merger，不因 option builder 跳过历史安全检查；
- 每题最多 24 option、每请求最多 144 option，并受确定性 `3500` input-token estimator 约束；mandatory
  subject/action bucket 无法完整保留时在 Provider 前 zero-call 回退。

Zero-option/failure 终态已经冻结：

- V5 shortlist 无效继续使用历史 `fallback_invalid_input` 与 `EMPTY_RESULT`，不伪装成 V9 no-option；
- shortlist 有效但任一题零合法 option 时，固定
  `attempted=false / not_eligible / candidate_option_authority_empty / usage=0/0`，不创建 runtime Trace，并
  保留 binding 与逐题 `selection.source=deterministic` suggestions；产品公开状态为
  `local_deterministic / not_eligible / degraded=false`；
- mandatory bucket 因 option cap/token cap 无法保留时固定
  `fallback_budget_exceeded / candidate_option_authority_budget_exceeded`，保留本地 suggestions、公开为
  degraded fallback，不删 bucket 后调用 Provider；
- option authority identity/plain-data/fingerprint 无效时固定
  `fallback_invalid_input / candidate_option_authority_invalid`；任一题失败均整请求回退，不返回 partial
  batch。

Prompt-safe projection 继续复用现有完整字段安全链：plain-data clone 限制为 depth `8`、array `256`、
object keys `512`、nodes `4096`；V5 允许的 model-facing 文本在裁剪前最多 `16384` UTF-16 code unit，并
拒绝 malformed UTF-16、C0/DEL、Unicode `Cf`、credential、instruction/system-prompt 与 tool/write
instruction；`status/updatedAt` 不进入 prompt。
`answer/userNote` 不属于 V5 source schema，出现时作为未知额外字段 strict fail-closed 为 `invalid_input`；
不扩展 V5 schema 或改变历史 fingerprint/SHA。最终 option 只允许固定 key，subject/action/source
只来自本地 enum，target 只来自已扫描 deck/topic；所有公开 label 最多 `80` Unicode scalar。任意额外 key
或 credential/token/cookie/authorization/secret 类 key 都整份 fail-closed；真实 ID、owner/fingerprint map、
locked-name、confidence、Trace、permission 和 command 不进入 projection。

Input estimator 不是 DeepSeek tokenizer，而是冻结的
`phase-6.9.7-v9-candidate-input-estimator-v1`：

```text
64 + ceil(utf8Bytes([system, canonical projection, schema].join("\n")) / 3)
```

ASCII/CJK/合法 surrogate pair 分别按现有手写 UTF-8 规则计算，parts 顺序、稳定 option 排序、字段构造顺序
和 `JSON.stringify` 固定；`>3500` 拒绝、`=3500` 允许 reservation。Candidate 与 runtime adapter 必须共用
同一 parts builder 并重算完全相等，estimator/helper SHA 与 prompt/policy/option rules 一起绑定。Provider
reported usage 仍独立验证，不能用 estimate 伪造 token、P95 或费用。

## 5. 为什么仍然是 Agent

本地代码只枚举“允许做什么”，不决定“哪一个语义方案最好”。一个题目仍可同时拥有多个合法学科候选、
多个已有 deck 与多个新 topic option；模型依据题目、知识点、错因和 bounded label 选择 option。随后本地
代码负责权限、事实、ID、confidence、Trace 和写入。

因此 V9 是模型语义选择与 deterministic authority 的混合架构，不是把 Organizer 退回纯规则，也不把
写权限交给模型。

## 6. 并发、任务丢失与路由边界

- owner snapshot 继续使用 `REPEATABLE READ + READ ONLY`；
- Provider 前、candidate 后和 owner-lock `Serializable` 写事务内的三阶段 fence 全部保留；
- option set 由同一 snapshot 确定性派生，post-provider 必须重新派生并比较；
- single/batch 每 HTTP request 最多一次 Organizer dispatch，Provider 不 retry；
- abort、timeout、Trace admission failure、snapshot/option drift、command conflict 或进程故障均使用本地
  fallback，不补发模型任务、不写部分 batch；
- rename/move/remove/force 与 Organizer command 继续共用 owner advisory lock；
- locked name、真实 ID、user authority、WrongQuestion/FSRS 事实与 mutation command 不进入模型输出；
- Tutor 路由、candidate、prompt、预算和产品 composition 完全不变。

产品 Organizer 是同步 HTTP request-scope candidate，不写 `BackgroundJob` 或 Outbox，也不承诺跨进程
Provider exactly-once。进程在 dispatch 后退出时连接可能中断，没有可保证的 HTTP terminal，也不会后台
补发；已经 commit 的数据库 command 仍以 PostgreSQL 与 owner lock 为 authority，后续客户端请求属于新
request，不是旧 task resume。

后续 V9 runner 则必须 durable 记录：executor 前 `lane_reserved`、单调 wire stage、恰好一个
`runtime_terminal`。Reserved 但因 crash 无 terminal 的 entry 只能 zero-provider seal 为
`attempted_orphaned / orphaned / fallback_runtime_error`；未 reserved 的 entry 按 journal 区分
`not_started_case_guard`、`not_started_quality_breaker`、`not_started_orphaned`。Transport/HTTP/abort/schema/
usage failure 必须形成显式 terminal 与真实 last stage，不能伪造 option reason。报告固定重算 reserved/
terminal/orphaned/not-started、pair、breaker 与 executor/dispatch/response/verified-usage 计数；固定 48 分母
与 incomplete aggregate 全 `null` 不变。

## 7. 独立 Lineage 与质量门

- V1--V8 runner/approval/marker/journal/evidence/recovery/validator/SHA 保持只读；
- V9 后续使用独立 runner/report/source manifest、approval、artifact prefix 与 bundle validator；
- V9 与 V1--V8 必须双向拒绝 lineage 混用；
- V2 dataset/baseline、`72/24/48/24/32`、semantic/model-owned/P95、预算与总 `0.55 CNY` cap 不放宽；
- 24 guard 仍需实际 `24/24` Provider 前 zero-call；
- 首 contract failure breaker、固定 48 分母与 incomplete aggregate 全 `null` 不变；
- reviewed Mock 即使满分也只能是 `mock_quality_not_evidence`；
- V9 R5 仍需运行当时新的精确授权，本次“好的”只授权 zero-provider R0，不授权未来 Live。

## 8. R0 验收

- [x] V8 static success 与 dynamic authority failure 已精确区分；
- [x] 没有从 bounded evidence 猜测具体 ordinal 或 Provider 外部根因；
- [x] 模型 output 已收敛为 exact `questionIndex + optionIndex`，fingerprint 保持本地；
- [x] option builder 的合法性、排序、去重、cap、token 与 fail-closed 规则已冻结；
- [x] no-option 的固定 reason/disposition、本地 fallback payload 与产品公开状态已冻结；
- [x] 完整字段 pre-scan、strict key allowlist、Unicode/control/credential 与 label cap 已冻结；
- [x] input estimator 的公式、parts、舍入、边界、identity/SHA 和 provider usage 分工已冻结；
- [x] V6 validator/merger、真实 ID/confidence/locked-name/write authority 继续复用；
- [x] snapshot、双外部 fence、Serializable + advisory lock 最终 fence、abort/no-retry 保持不变；
- [x] 同步 HTTP task-loss 边界与 runner durable terminal/orphan/counter 映射已冻结；
- [x] bounded no-raw diagnostic 与 Provider-like/held-out/metamorphic/anti-overfit matrix 已冻结；
- [x] V9 R1--R7、独立 lineage 与逐级授权门已记录；
- [x] 未修改 Agent/AI/Server/Web 源码或 V1--V8 artifact；
- [x] 未读取 `.env`/credential、调用 Provider、执行 Mock/Live、启动 Docker/API/browser、修改业务数据或
      合并 main。

## 9. 后续原子任务

R0 checkpoint 当时的下一任务仅 V9 R1：以 TDD 实现 option authority/projection、exact selection
schema/prompt、validator、V6 runtime adapter 与 bounded diagnostic。R1 后续已按 zero-provider 边界完成，
验收见 `docs/acceptance/phase-6-9-7-tutor-organizer-v9-r1-option-authority.md`；当前下一任务仅 R2，仍不读取
credential、不执行正式 Mock/Live、不启动产品 Docker/API/browser。

回顾时可以问：

- “V8 fixed-shape 为什么仍可能生成非法动态组合？”
- “为什么 V9 不再要求模型回显 fingerprint？”
- “option builder 如何保证模型仍在做语义判断，而不是被规则替代？”
- “模型返回未知 optionIndex 时为什么不能 clamp 或默认选择？”
- “V9 如何复用 V6 merger 与三阶段 stale/write authority？”
- “R0 完成后还需要哪些门，才能再次申请唯一 controlled-Live？”
