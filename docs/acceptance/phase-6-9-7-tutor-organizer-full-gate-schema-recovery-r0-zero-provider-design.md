# Phase 6.9.7 Tutor / Organizer Full-gate Schema Recovery SR0 Zero-provider 设计验收

日期：2026-08-02

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起始提交：`fa29deef9382acb7e7f177f251d76d6f52b0544a`

状态：SR0 文档与设计 checkpoint 完成；未实现新 schema、diagnostic、runner、Mock、Live 或产品 wiring

Authority：`zero_provider_full_gate_schema_recovery_design`

## 1. 结论

L3 唯一 run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 继续永久保持
`full_gate_quality_gate_failed / qualityAuthority=none`。SR0 没有重跑或改写 L3，而是只读对照 sealed
report/journal、Tutor V6 contract/candidate、第一方 direct adapter、F2 runner 与 S3 reviewed Mock，确认：

- `tutor-v2-runtime-11` 已收到 Provider response、通过 response audit 并完成 JSON content parse；
- 失败发生在 adapter 调用 request schema `safeParse` 的边界，没有进入 schema/usage success；
- 当前 evidence 不保存原始 completion、Zod issue/path/value 或字段级诊断，因此不能恢复具体失败 shape；
- Tutor V6 已把模型权限收敛为 strict `{intentIndex}`，本地继续拥有 eligible intent、preferred depth、完整
  TutorStrategy 与 `answer_direct` 权限；
- S3 canonical responder 证明理想 shape 可运行，但没有形成足够的 Tutor Provider-like shape、重复 key、
  extension field 与 bounded diagnostic 证据。

SR0 冻结两类信任层的四步处理合同：不可信 Provider envelope 先做有界 JSON/duplicate/shape audit，selection
projection 只读取 canonical integer `intentIndex`，再重新构造 strict projected decision 并进入可信的本地
authority/merger。Projection 是单向信任转换，不是新增模型权限层；无权威扩展字段在形成枚举化诊断后丢弃。
缺失、alias、字符串、浮点、`null`、越界、重复 key、wrapper、Markdown、prose、BOM、trailing data 与结构超限
仍 fail-closed，禁止 coercion/default/clamp/retry。

## 2. 只读证据

| 证据                                          | SR0 结论                                                         |
| --------------------------------------------- | ---------------------------------------------------------------- |
| L3 report/journal/marker                      | response/content parsed，schema 前失败，wire `1/1/1/0`           |
| L3 bundle validator                           | `ok=true`，journal `296`，最终 `evidence_published`              |
| `tutor-v6-model-contract.ts`                  | strict `{intentIndex: integer 0..4}`                             |
| `tutor-v6-model-candidate.ts`                 | schema/authority/merger 任一失败均安全回退，不授予额外权限       |
| `first-party-deepseek-v4-pro-direct.ts`       | JSON parse 后 `safeParse`；失败压缩为 `provider_type_validation` |
| `phase-6-9-tutor-organizer-full-gate-live.ts` | Provider structured-output failure 最终映射为 `schema`           |
| Full-gate S3 reviewed Mock/fault matrix       | canonical 双 candidate 通过，但 Tutor Provider shape 诊断不足    |

SR0 不声称 extra field 是 L3 的实际失败字段，也不把当前设计写成已修复源码。

## 3. 冻结设计

### 3.1 权限边界

- 模型仍只选择一个本地合法 `intentIndex`；
- depth、guiding question、final answer、answer structure、prompt addition 与事实由本地重建；
- 不允许模型输出 route、tool、permission、真实 ID、owner、业务写 command 或 `answer_direct`；
- Organizer V9 option authority、owner snapshot、三阶段 stale/write fence 与 locked-name 不变。

### 3.2 解析边界

- 只接受单个 native JSON object；
- duplicate key、多个顶层值、fence/prose/BOM/trailing 与结构超限拒绝；
- 只读取 own-data canonical `intentIndex`，不接受 alias/coercion/default/clamp；
- 额外字段只形成计数桶/类型桶/shape fingerprint 后丢弃；
- projected decision 重新 strict parse，并继续经过 local authority 与 merger。

### 3.3 Diagnostic 边界

只允许固定 `stage/reasonCode/projectionDisposition/topLevelType/intentIndexType/
extraFieldCountBucket/shapeFingerprint/rawDataRetained=false`。Shape hash 只基于枚举化摘要，不基于 raw
completion。禁止 raw output、prompt、Zod path/value、unknown key 名、URL、credential、error、用户正文、答案、
真实 ID 或 oracle。

### 3.4 Durability 与 Lineage

- 未来使用 `phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1`；
- 新 approval/tag/marker/journal/artifact/recovery/validator 与 L3 双向隔离；
- journal 记录 bounded schema stage，validator 重算 stage/wire/terminal/breaker/fixed denominator；
- incomplete denominator 时 semantic/anchor/P95/token/CNY 全 `null`；
- crash-only recovery 不读取 credential、不创建 executor、不 resume/replay。

## 4. SR0 验收

- [x] L3 stage、wire、fixed denominator、null aggregate 与不可重跑边界保持不变；
- [x] 明确区分可证 `provider_type_validation` 边界与不可证具体字段/外部根因；
- [x] Tutor model/local authority 边界已按当前源码记录；
- [x] Provider envelope、selection projection 与 strict projected decision 三层职责已冻结；
- [x] extra fields 只允许有界审计后丢弃，不获得业务权限；
- [x] no coercion/default/clamp/retry 与 duplicate/wrapper/shape fail-closed 已冻结；
- [x] bounded diagnostic 不保存 raw、字段名、path/value、prompt、credential 或用户内容；
- [x] Provider-like/held-out/metamorphic/no-leak/anti-oracle matrix 已冻结；
- [x] 新 report/journal/validator invariants 与独立 lineage/source admission 已冻结；
- [x] SR1--SR7、一任务一提交/推送和产品/main 停止门已记录；
- [x] SR0 未修改 packages/apps 源码，未读取 credential、未调用 Provider、未启动 Docker/API/browser、未创建
      marker/journal/artifact/tag 或修改业务数据。

## 5. 本次验证

只读 L3 bundle validator：

```powershell
bun run --cwd packages/agent eval:phase-6-9-7:full-gate:validate
```

实际摘要：

```text
ok=true
runId=2b0ac3a0-631f-4c7f-9781-ce0cda94149a
gate=full_gate_quality_gate_failed
qualityAuthority=none
journalRecords=296
finalJournalEvent=evidence_published
physicalArtifactSha256=e081939bb7f4b17235b1d9afb61d78031879bb80b9d64c952e4b86531cd7dbe5
```

该命令只读既有 bundle，不读取 credential、不调用 Provider、不创建 recovery claim。文档阶段另执行
Prettier、`git diff --check`、链接/状态复核与独立文档/架构审查。

## 6. 没有形成的 Authority

SR0 不证明：

- L3 的具体失败字段或 Provider 原始输出；
- schema recovery 已实现或 Provider 会接受新 contract；
- Tutor/Organizer 完整真实语义、P95、费用或生产质量；
- 产品 Docker/API/可见浏览器、Trace、写入、main 或后续 Phase 可用；
- DeepSeek/network/account/model 的整体健康。

S3 Mock、L2 小样本、L3 21 条 strict success 与 SR0 设计均不能拼接为 full-gate pass。

## 7. 下一原子任务

下一任务仅 SR1：以 zero-provider TDD 实现独立 Provider envelope/parser、selection projection、strict projected
decision、本地 authority adapter 与 bounded diagnostic。SR1 不读取 credential、不调用 Provider、不执行正式
Mock/Live、不启动产品 Docker/API/browser，也不创建新 approved tag 或正式 evidence。

回顾时可以问：

- “为什么 L3 只能定位到 schema boundary，不能知道具体字段？”
- “为什么允许丢弃 extra fields 不等于放宽 `intentIndex` 权限？”
- “为什么 duplicate key 必须在 `JSON.parse` 前拒绝？”
- “为什么 diagnostic 不能保存 raw completion hash？”
- “SR1 为什么必须新建 lineage，而不能修改 Tutor V6/L3？”
