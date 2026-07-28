# Phase 6.9.7 Tutor / WrongQuestionOrganizer V8 固定形状与脱敏诊断设计

日期：2026-07-28

状态：R0 zero-provider 复盘与设计已冻结；尚未实现 V8 源码、runner、Mock、Live 或产品接线。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

历史 authority：

- `docs/acceptance/phase-6-9-7-tutor-organizer-v7-controlled-live-failure.md`
- `.tmp/phase-6-9-7-tutor-organizer-v7-branch-live-81529c2c-79f5-4c21-9cee-e536a2fe78e3.json`
- `.tmp/phase-6-9-7-tutor-organizer-v7-controlled-live.marker`
- `.tmp/phase-6-9-7-tutor-organizer-v7-controlled-live-81529c2c-79f5-4c21-9cee-e536a2fe78e3.journal.jsonl`

本文件不授权读取 credential、调用 Provider、执行 V7/V8 Mock/Live/seal/recovery、启动产品
Docker/API/browser 或修改业务数据。

## 1. 决策摘要

V7 已把 V6 的 `provider_runtime / unknown` 盲区收敛到 Organizer 的
`content_parsed -> provider_type_validation`：Provider response 已收到，non-thinking audit 与 JSON parse
已通过，但解析值没有通过冻结的 V6 静态 Zod schema。V7 脱敏证据没有保存 raw output 或 Zod issues，
因此不能诚实声称具体是哪一个字段，也不能把原因归咎于 credential、网络、HTTP、endpoint、SDK、模型
或 Provider 内部行为。

可以确认的工程问题不是“JSON 不可解析”，而是以下组合风险：

1. Direct adapter 只向 Provider 请求 `response_format=json_object`，Provider 不执行本地 Zod schema；
2. V6 Organizer 输出使用嵌套 discriminated union 与条件字段：`keep_local` 不允许 `subjectIndex`，
   `reuse_existing` 不允许 `topicIndex`，`.strict()` 又拒绝任何额外字段；
3. V6 的 compact descriptor 使用 `subjectIndex? / deckIndex? / topicIndex?` 表达条件字段，但没有提供
   一个始终同形的 JSON 合同；模型常见的 `null`、同时输出两个 index、字符串数字或解释字段都会在
   `provider_type_validation` 失败；
4. V7 reviewed Mock responder 从实际 projection 直接构造完全合法的理想对象，能证明本地链路自洽，
   不能代表 Provider generation distribution；原 fault matrix 只有单一 `{ unexpected: true }` schema
   mismatch，未覆盖常见合法 JSON 形态漂移。

V8 采用“固定形状输出 + 本地动态权威 + 脱敏字段级诊断 + Provider-like zero-network 负例”的组合修复，
不放宽任何权限、安全、预算、快照、stale fence 或质量门。

## 2. V8 固定形状模型合同

V8 Organizer 模型只能返回：

```json
{
  "shortlistFingerprint": "sha256:<64 lowercase hex>",
  "decisions": [
    {
      "questionIndex": 0,
      "subjectIndex": null,
      "deckAction": "reuse_existing",
      "targetIndex": 0
    }
  ]
}
```

所有 decision 始终只有四个字段，不再使用嵌套条件对象：

- `questionIndex`：投影问题 ordinal；
- `subjectIndex`：结构化 subject 时必须为 `null`；需要模型选择 subject 时必须为暴露的整数 ordinal；
- `deckAction`：只允许 `reuse_existing | create_topic`；
- `targetIndex`：`reuse_existing` 时解释为 deck ordinal，`create_topic` 时解释为该题 topic ordinal。

静态 schema 只验证固定 JSON 形状、安全整数、最大数组长度和 fingerprint 格式。随后本地动态 validator
继续验证：

- fingerprint 与 owner-scoped shortlist 完全一致；
- decision 数量等于实际 projected questions，questionIndex 不重复且完整；
- structured subject 必须 `subjectIndex=null`，非 structured subject 必须引用该题实际暴露的 ordinal；
- deckAction 必须属于该题 eligible actions；
- targetIndex 必须引用存在且同 resolved subject 的 deck/topic；
- authority revalidation、snapshot/stale/ABA、locked name、confidence、本地 ID 与写入权限不变。

V8 validator 成功后只转换成既有 V6 validated decision，再复用 V6 本地 merger；模型仍不能获得真实
question/deck ID、userId、自由 subject/topic/deck 名、confidence、reason、Trace admission、route、tool
或写 command。

## 3. Prompt 单一规则源

V8 prompt policy、Zod schema、dynamic validator、formatter 与测试 fixture 必须共享同一冻结合同：

- 明确列出顶层与 decision 的 exact keys；
- 明确所有 decision 必须始终包含 `subjectIndex`，结构化 subject 使用 JSON `null`；
- 明确只使用 JSON number，禁止数字字符串；
- 明确 `targetIndex` 的语义由 `deckAction` 决定；
- 提供一个无真实数据的固定 JSON 示例；
- 禁止 Markdown、prose、wrapper、snake_case、额外字段、自由标签、真实 ID、权限或写命令；
- user prompt 仍只包含深冻结 bounded projection，不拼接 expected/oracle。

Prompt SHA、fixed-shape contract SHA、V2 dataset SHA、V6 local authority SHA 与 source manifest 必须分别
记录；不得通过改 expected、缩小分母或放宽 validator 获得分数。

## 4. 脱敏字段级诊断

V8 在新的独立 wire/report 中增加 `boundedSchemaDiagnostic`，只允许固定字段：

```text
version
reason
topLevelShape
missingRequiredFieldCount
unexpectedFieldCount
invalidFieldTypeCount
decisionCountBucket
shapeFingerprint
rawDataRetained=false
```

`reason` 固定为：

- `top_level_shape`
- `top_level_keys`
- `fingerprint_type`
- `fingerprint_format`
- `decisions_type`
- `decisions_count`
- `decision_shape`
- `decision_keys`
- `question_index`
- `subject_index`
- `deck_action`
- `target_index`
- `dynamic_authority`
- `unknown`

`shapeFingerprint` 只散列规范化后的已知 key 类别、未知 key 数量和 primitive type，不散列或保存实际
值、未知 key 原文、prompt、response、error、message、URL、header、credential、题目文本或真实 ID。
任何 hostile getter/proxy、超限结构、诊断 hook 异常或字段缺失都 fail-closed 为 `unknown`，不得影响
Provider failure 的安全收口。

V1--V7 wire、report、validator、marker、journal、evidence 和 physical SHA 全部保持不可变。V8 使用新
version、prefix、approval env、confirmation、marker、journal、evidence、recovery claim 与 validator；
V8/V1--V7 必须双向拒绝 lineage 混用。

## 5. Zero-network robustness

V8 必须在任何 Provider 资格前覆盖：

1. 缺 fingerprint、错误大小写/长度、空 decisions、少一题、重复/越界 questionIndex；
2. `null`、字符串数字、浮点、负数、超限整数；
3. 旧 V6 nested shape、snake_case、wrapper `{data: ...}`、顶层/decision extra fields；
4. Markdown fence、前后 prose、double-encoded JSON、BOM、trailing comma、single quote；
5. subject/deck/topic reorder、candidate reorder、fingerprint mutation、同题跨路由；
6. bilingual labels、Unicode escaped JSON、held-out action combinations；
7. first/middle/last contract failure、sibling abort、timeout、usage unknown 与 fixed denominator；
8. hostile accessor/proxy、超深/超宽对象与 recursive sensitive-key scan；
9. responder 不得 import dataset expected/oracle，也不得直接调用 production validator 来生成答案；
10. Mock 满分仍固定 `mock_quality_not_evidence`。

## 6. 不变的质量、预算和运行门

- dataset：72 cases、24 guard、48 runtime、24 pair、32 Organizer decisions；
- guard：`24/24` verified zero-call；
- runtime：`48/48` strict success，失败项不删除；
- semantic/model-owned/P95 阈值与 V6/V7 相同；
- Tutor `1/1200/300`，Organizer `1/3500/800`；总 Live cap `0.55 CNY`；
- pair 串行、pair 内最多双 lane、single dispatch、no retry/resume/replay/backfill；
- 首个 runtime contract failure 收口当前 pair并熔断后续 pair，固定 48 分母不缩小；
- incomplete semantic/P95/token/CNY 全为 `null`；
- tracked defaults 保持 mock、live=false、Tutor/Organizer gate=false、component credential empty。

## 7. 原子路线

1. **R0**：V7 zero-provider postmortem、固定形状合同、脱敏诊断与 V8 路线。（本次完成）
2. **R1**：实现 V8 fixed-shape Organizer contract/prompt/validator/candidate adapter 与脱敏 schema
   diagnostic；focused TDD，zero-provider。
3. **R2**：独立 schema-negative/metamorphic/held-out/Provider-like robustness 与 no-leak/anti-overfit；
   zero-provider。
4. **R3**：独立 V8 report/runner/CLI/approval/marker/journal/evidence/recovery/validator，V1--V7 双向
   lineage；zero-provider，不创建正式 Mock/Live artifact。
5. **R4**：reviewed V8 Mock、fresh baseline、全量静态/PostgreSQL/Compose 与两路终审；Mock evidence
   精确删除，Live artifact 必须仍为 0。
6. **R5**：只有 R4 clean/pushed、历史 SHA/validators 与 artifact=0 全门通过，且用户重新接受运行时
   数据边界并精确授权唯一 V8 branch controlled-Live，才允许执行一次；任一终态只 seal，不重跑。
7. **R6**：只有 R5 全门通过，才允许产品 Docker/API/可见浏览器、Trace、default-off 与精确清理。
8. **R7**：只有 R6 通过且独立复审无问题，才允许 `--no-ff` 合并 main、main default-off 回放和推送。

每个 R-task 单独提交并推送当前功能分支；不创建 worktree 或子分支。R0--R4 不读取根 `.env`/
credential，不调用 Provider，不启动产品 Docker/API/browser，不修改业务数据。

## 8. 禁止事项

- 不重跑、seal、recover、删除、覆盖、改写或拼接 V1--V7；
- 不通过 curl、单 case、其它 CLI 或产品 API 探测 V7/Provider；
- 不保存 raw prompt/output/error/body/header、credential、URL、题目正文或真实 ID；
- 不把固定形状修复写成已证明具体 V7 字段错误；
- 不放宽 owner、snapshot、stale、locked-name、Trace、budget、timeout、quality 或 write authority；
- 不把 zero-network、Mock、单条 Tutor success 或 validator `ok=true` 写成模型/产品可用；
- 不在 R5 前写入 Live approval、创建 marker/journal/evidence 或调用 Provider；
- 不在 R6 前启动产品验收，不在 R7 前合并 main；
- 不开始 Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾。

## 9. 回顾时可以问

- “为什么 `json_object` 不等于本地 Zod schema enforcement？”
- “为什么 fixed-shape contract 比 nested conditional union 更适合 Provider JSON generation？”
- “为什么 V7 Mock 48/48 没有暴露真实 Provider 的 shape drift？”
- “如何记录字段级失败原因而不保存原始模型输出？”
- “为什么 V8 仍必须保持本地 subject/deck/topic authority 和三阶段 stale fence？”
- “为什么 V8 必须使用新 lineage，而不能修完后补跑 V7？”
