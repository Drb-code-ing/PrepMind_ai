# Phase 6.9.7 Tutor / WrongQuestionOrganizer V8 R0 Zero-provider 复盘验收

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起始提交：`fe199cf182558f77b55c7c2d4685cafe6820962c`

终态：R0 文档与设计 checkpoint 完成；未实现 V8 源码、runner、Mock、Live 或产品 wiring。

## 1. 结论

V7 唯一 run `81529c2c-79f5-4c21-9cee-e536a2fe78e3` 已永久保持
`quality_gate_failed`。R0 没有重跑或读取 raw output，而是只读对照封存 evidence、V6 Organizer
schema/prompt/validator/merger、V7 direct adapter、reviewed Mock 与 fault matrix，确认：

- Organizer 已收到 response、通过 non-thinking audit 并完成 JSON parse；
- 失败发生在本地静态 Zod `safeParse`，因此固定分类为 `provider_type_validation`；
- dynamic fingerprint/count/subject/deck/topic authority validator 尚未运行；
- 当前证据无法确认具体字段或唯一外部根因。

工程缺口是 Provider 只受 `json_object` 约束，而 V6 static contract 使用 strict nested conditional union；
V7 Mock 又直接从 projection 构造理想合法对象，没有覆盖真实模型常见的条件字段/null/type/extra-key
漂移。V8 不猜测 V7 原始输出，直接消除这类脆弱形状，并为未来失败增加脱敏可定位性。

## 2. 只读证据

| 证据                                    | 结论                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| V7 evidence/journal/marker              | `24/24` guard、wire `2/2/2/1`、strict `1/48`、Organizer `provider_type_validation` |
| `first-party-deepseek-v4-pro-direct.ts` | JSON parse 后调用 request schema `safeParse`；失败统一映射该 stage                 |
| V6 Organizer schema                     | strict 顶层、strict decision、两层 discriminated union 和条件 ordinal 字段         |
| V6 dynamic validator                    | fingerprint/count/duplicate/authority/cross-subject 检查在 static schema 之后      |
| V7 reviewed Mock                        | responder 从 projection 直接构造 canonical valid decision                          |
| V7 fault matrix                         | schema mismatch 只有粗粒度 unexpected object，没有常见 Provider shape variants     |

## 3. 冻结修复

V8 Organizer output 改为始终同形的四字段 decision：

```text
questionIndex + subjectIndex(null|integer) + deckAction + targetIndex
```

本地 validator 根据 authority 解释 `subjectIndex` 和 `targetIndex`，成功后转换为 V6 validated decision 并
复用既有本地 merger。真实 ID、名称、confidence、reason、Trace、snapshot、stale fence 和写 command
仍由本地掌握。

V8 同时新增 bounded schema diagnostic：固定 reason、shape/count/type bucket 与只基于类别的 SHA-256；
`rawDataRetained=false`，禁止保存任何值、未知 key 原文、prompt/output/error/header/credential 或题目正文。

## 4. 历史与运行边界

- V1--V7 artifact、validator、runner identity、prompt/data SHA 与 physical bytes 不修改；
- V7 evidence、marker、journal 保留原路径，不执行 seal/recovery；
- V8 使用全新 identity、approval、marker、journal、evidence 与 validator；
- V2 dataset、V6 local authority/merger、预算、timeout、质量/P95、fixed denominator 和 no-retry 不放宽；
- R0 未读取 `.env`/credential，未调用 Provider，未执行 V7/V8 Mock/Live；
- 未启动 Docker/API/browser，未创建账号或修改 PostgreSQL/Redis/MinIO；
- 未合并 main，未开始 Phase 6.9.8/6.10/8/9 或博客。

## 5. R0 验收

- [x] V7 失败 stage 与 static/dynamic validator 边界已精确区分；
- [x] 没有从脱敏 evidence 推断具体字段或 Provider 外部根因；
- [x] fixed-shape contract 保持 ordinal-only 与本地 authority；
- [x] schema diagnostic 只允许固定枚举/计数/type-shape hash，raw retention=false；
- [x] Provider-like negative、metamorphic、held-out 与 anti-overfit matrix 已冻结；
- [x] V8 R1--R7、独立 lineage 和逐级授权门已记录；
- [x] V7 no-retry/no-probe 与 R5/R6/main 阻断保持不变。

## 6. 下一原子任务

下一任务是 V8 R1：以 TDD 实现 fixed-shape Organizer contract/prompt/validator/candidate adapter 与 bounded
schema diagnostic。R1 全程 zero-provider，不读取 credential，不运行正式 Mock/Live，不启动产品
Docker/API/browser。

回顾时可以问：

- “为什么当前能确认 static schema failure，却不能确认具体字段？”
- “V6 nested union 与 V8 fixed-shape contract 的差别是什么？”
- “为什么 diagnostic 只能保存 shape 类别而不能保存 Zod path/value？”
- “V8 如何继续复用 V6 本地 authority 而不把写权限交给模型？”
