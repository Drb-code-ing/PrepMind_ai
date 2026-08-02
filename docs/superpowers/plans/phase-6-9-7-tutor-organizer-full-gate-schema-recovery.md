# Phase 6.9.7 Tutor / Organizer Full-gate Schema Recovery 实施计划

日期：2026-08-02

当前状态：SR0--SR4 zero-provider 设计、TDD、robustness、独立 runner/durability 与 reviewed Mock/static 已
完成；下一任务仅 SR5 fresh admission。旧 L3 保持失败封存，SR5 尚未授权，任何 Provider、产品、main 与
后续 Phase 仍被阻断。

设计 authority：
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-design.md`

未来 lineage：`phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1`

## SR0：L3 只读复盘与 Schema Recovery 设计

状态：[x] 完成，zero-provider。

交付：

- 冻结 L3 run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 的 stage、counter、SHA 与禁止边界；
- 确认失败在 `content_parsed` 后、`schema_validated` 前，且 sealed evidence 无具体字段或模型原文；
- 对照 Tutor V6 strict `{intentIndex}`、第一方 adapter、F2 runner 与 S3 reviewed Mock，识别
  `json_object -> strict Zod`、粗粒度诊断和 Tutor Provider-like coverage 缺口；
- 冻结 Provider envelope -> selection projection -> strict projected decision -> local authority/merger 两层
  合同；
- 冻结额外无权威字段有界审计后丢弃，缺失/alias/string/fraction/null/out-of-range/duplicate/wrapper 等仍
  fail-closed；
- 冻结 bounded no-raw diagnostic、journal/report/validator invariants、SR1--SR7 与独立 source admission；
- 明确 SR0 不修改 Agent/AI/Server/Web 源码，不读取 credential、不调用 Provider、不运行 Mock/Live、
  Docker/API/browser 或业务写入。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r0-zero-provider-design.md`

## SR1：Envelope、Selection Projection 与 Diagnostic TDD

状态：[x] 完成，zero-provider。Checkpoint authority：
`zero_provider_full_gate_schema_recovery_tdd`。

实施：

- 新增独立 Tutor schema-recovery contract/version/SHA，不修改 Tutor V6/L3 source；
- 实现单个 native JSON object 的有界 parser/inspector，拒绝 BOM/fence/prose/trailing/multiple value、重复 key
  和结构超限；
- selection projection 只读取 canonical own-data integer `intentIndex`，额外字段只形成 enum/bucket
  diagnostic 后丢弃；
- projected decision 重新构造 strict `{intentIndex}`，再走 local signal、preferred depth 和 merger；
- 新增 per-lane bounded diagnostic reducer，只允许 fixed stage/reason/type/bucket/shape hash 和
  `rawDataRetained=false`；
- 新增 adapter/candidate seam，保持 no coercion/default/clamp/retry、预算、timeout、abort、usage 与 Trace
  fail-closed。

RED/GREEN：

- canonical/extension、missing/alias/type/range/top-level/duplicate/structure limit；
- diagnostic no-raw/no-key/no-prompt/no-credential；
- hostile getter/proxy/cycle/symbol/non-plain prototype；
- single dispatch/no retry、budget/abort/timeout/usage failure；
- Tutor local authority、depth、answer structure 与 `answer_direct` 权限不变。

通过门：focused TDD、Agent/AI typecheck/lint、Prettier、`git diff --check`、历史 validators/SHA parity，
`globalThis.fetch=0`、credential read=0、formal artifact=0。

禁止：Provider、正式 Mock/Live、Docker/API/browser、业务数据、tag、marker/journal/artifact。

已冻结身份与验收：

- contract/candidate version 分别为 `phase-6.9.7-tutor-schema-recovery-contract-v1` 与
  `phase-6.9.7-tutor-schema-recovery-candidate-v1`；contract SHA 为
  `e2453faeb077faa76ab018a038790cd5a7e73f617be800c0958c098361511579`；
- focused/direct `41/41`、V6/V8/V9/F1/S3 兼容 `70/70`、Agent `1135/1135`、AI `325/325`、
  Agent/AI typecheck/lint 与 Prettier 均通过；
- 旧 L3 只读 validator 仍为 `ok=true / journalRecords=296 / evidence_published`，physical artifact SHA
  `e081939b...dbe5`；
- 验收：
  `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r1-zero-provider-tdd.md`。

## SR2：Provider-like Robustness 与 Anti-overfit

状态：[x] 完成，zero-provider。Checkpoint authority：
`zero_provider_full_gate_schema_recovery_robustness`。

实施：

- 独立 Provider-like/held-out/metamorphic/schema-negative fixture 与固定 identity/SHA；
- 覆盖 all 24 Tutor runtime cases，包含 `tutor-v2-runtime-11`，但不读取 L3 raw output；
- 覆盖 whitespace/key order/escaped JSON、extra scalar/object/array、string/null/fraction/range、array/double
  encoded/wrapper/fence/BOM/trailing、duplicate key、Unicode 与 byte/depth/node cap；
- 覆盖 pre/in-flight/post abort、transport/HTTP/response audit/usage、pair sibling close 与 breaker；
- Mock responder 只读实际 bounded prompt，不 import expected/oracle、scorer 或 production validator 生成答案；
- 冻结 prompt/parser/projection/diagnostic/merger SHA 和 no-leak source scan。

通过门：focused + Agent/AI full、typecheck/lint/Prettier/diff、V1--V9/R3/Canary/L2/old full-gate
validators/SHA，Provider/credential/formal artifact=0。

已冻结身份与验收：

- fixture/responder version 分别为 `phase-6.9.7-tutor-schema-recovery-sr2-robustness-v1` 与
  `phase-6.9.7-tutor-schema-recovery-sr2-prompt-hash-responder-v1`；fixture SHA 为
  `43248bfa7156c29eafa110b475a8998611209dd808847be79dacd1c02460d41e`；
- 24 个 Tutor runtime、18 个 Provider shape、5 个 held-out、4 个 adapter fault、budget/三阶段 abort 与 F2
  sibling/breaker 均通过；responder 不读取 expected/oracle/L3 raw；
- focused `9/9`（`484` assertions）、兼容 `51/51`（`1133` assertions）、Agent `1144/1144`、AI
  `325/325`、typecheck/Prettier 与旧 L3 validator
  通过；Provider/credential/formal artifact=0；
- 验收：
  `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r2-zero-provider-robustness.md`。

## SR3：独立 Runner、Lineage 与 Durability

状态：[x] 完成，zero-provider。Checkpoint authority：
`zero_provider_full_gate_schema_recovery_runner_durability`。

实施：

- 新 report/runner/CLI/approval/marker/journal/artifact/recovery/validator identity；
- 固定 `72/24/48/24/32`、guard-first、pair 串行、pair 内双 lane、single dispatch/no retry；
- `lane_reserved` 与 Provider dispatch 前全部 stage durable append + fsync；
- journal 新增 bounded schema stage started/succeeded/failed，禁止 free text/raw；
- report 重算 canonical/extension-discarded/rejected schema counts、wire、usage、semantic、anchor、P95、费用与
  breaker；
- incomplete denominator 时 semantic/anchor/P95/token/CNY 全 `null`；
- crash-only recovery 只解释 durable prefix，不读取 credential、创建 executor或 resume/replay；
- 新旧 lineage 双向拒绝，旧 L3 artifact/validator/bytes 不变。

通过门：runner/durability/security fault matrix、focused/full/static、历史 validator/SHA、formal files=0。

已交付与验证：

- 独立 lineage `phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1`，source manifest SHA
  `1a811394b6e6c182ef33bb22c8aa5545400e8083a5f226d9d5eab5e7c40adfbb`；
- report/runner/source/CLI/marker/journal/artifact/validator/crash-only recovery 均使用独立 identity；
- schema started/succeeded/failed 与八阶段 wire 分离 append + fsync + hash-chain；
- hard-link 排他发布、exact validator 重算、claim/ABA/live-owner/PID reuse/journal drift/publication conflict 与
  crash-after-usage 均 fail-closed；
- CLI 仅开放 zero-provider validate/crash-only seal，SR5 confirmation/approval/credential/Provider ports 未开放；
- focused `23/23`、SR2/SR3/F2 兼容 `105/105`、Agent `1167/1167`、AI `325/325`，typecheck/lint/
  Prettier/diff 与独立终审通过；旧 L3 validator/SHA 不变，正式 SR5 files/tag 为 0；
- 验收：
  `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r3-runner-durability.md`。

## SR4：Reviewed Mock 与全量 Checkpoint

状态：[x] 完成，zero-provider。Checkpoint authority：
`schema_recovery_mock_quality_not_evidence / qualityAuthority=none`。

实施：

- fresh deterministic baseline；
- reviewed Mock 穿过新 Tutor envelope/projection/diagnostic、本地 authority/merger、Organizer V9、第一方
  synthetic adapter 与 SR3 runner；
- 24/24 guard zero-call、48/48 runtime/wire/verified usage、完整 semantic/anchor/P95/预算与安全门；
- canonical 与 extension-discarded 都必须透明计数，不能隐藏 contract drift；
- Agent/AI/Types/Server/Web、Organizer PostgreSQL concurrency、Compose default-off、历史 parity、Reader
  Testing 与两路独立终审；
- 临时 Mock evidence 精确删除，正式 SR5 tag/marker/journal/artifact/recovery claim 保持 0。

Mock gate 固定 `schema_recovery_mock_quality_not_evidence / qualityAuthority=none`。SR4 不能形成 Provider、
产品或 main authority。

已交付与验证：

- factory/version/SHA：`phase-6.9.7-tutor-organizer-schema-recovery-reviewed-mock-v1` /
  `8f18c1c2...3d44`，checkpoint SHA `03bb81a6...6960`；
- fixed counts `72/24/48/24/32`，runtime `48/48/0/0`，wire `48/48/48/48`；
- schema accounting `42 canonical + 6 extension fields discarded`，rejected/not-observed `0/0`；
- Tutor/Organizer/Combined semantic `1/0.996875/0.9984375`，L2 anchor `1`，usage `17732/654`，费用
  `0.05712 CNY`；
- focused `9/9`（`506` assertions）、SR1--SR4/F1/F2/S3/Small-sample compatibility `201/201`
  （`5734` assertions），Agent/AI/Types/Web/Server 与 Compose default-off/static 门通过；
- global fetch、credential、Provider、正式 SR5 files/tag、产品 API/browser 与正式业务写入为 0；Reader
  Testing 与两路独立终审均 `APPROVED`；
- 验收：
  `docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r4-reviewed-mock-static.md`。

## SR5：未来唯一 Schema Recovery Controlled-Live

状态：[ ] 阻断。

只有 SR1--SR4 分别验收、提交并推送后，才允许另做 fresh admission。必须重新取得当次 DeepSeek 数据边界
接受与新 lineage exact authorization，并在 credential/marker 前证明：

- tracked clean、HEAD/upstream/remote/new approved tag parity；
- source manifest 与全部 frozen SHA 一致；
- 历史 sealed validators/SHA parity；
- 新正式 marker/journal/artifact/recovery claim 为 0；
- fresh zero-provider proxy preflight ready；
- 专用 credential 只映射到唯一独立进程。

SR5 无论成功、semantic、schema、usage、transport、timeout、abort 或 I/O failure 都只运行一次并 durable
publication。禁止 retry/resume/replay/backfill、单 case、curl、产品 API 或其它 Provider 探测。

本计划不预写 exact confirmation，防止被误当成当前授权。

## SR6：产品 Docker / API / 可见浏览器

状态：[ ] 阻断。

只有 SR5 得到完整新 lineage quality pass 后才能启动。验收范围必须包括 Tutor Chat、Organizer single/batch、
default-off/forced failure、Trace、owner/locked-name/write isolation、headed browser 和本轮合成数据精确清理。
不得清空 Docker、volume、PostgreSQL、Redis 或 MinIO。

## SR7：Main 合并、推送与回放

状态：[ ] 阻断。

只有 SR6 完成、提交并推送当前 Phase 分支后，才能合并 main。main 只做 default-off static、Docker/API、
可见浏览器和历史 evidence replay；不重跑已消费的 SR5 Live。合并后必须推送远程 main。

## 执行纪律

- 每个 SR task 一次提交并推送当前功能分支；不创建 worktree 或子分支；
- SR0--SR4 全程 zero-provider；
- 旧 L3 tag/marker/journal/artifact/validator 不修改、不移动、不删除；
- `.codex/` 保持本地未跟踪，不进入交付；
- 每项完成同步 README、AGENTS、DEVLOG、roadmap、data-flow、dev-start、acceptance checklist、AI behavior、
  spec/plan/acceptance；
- 每项只验证新增风险，已封存证据只运行只读 validator，不重复执行完成过的 Live 或产品验收。
