# Phase 6.9.8 Retriever / FinalResponse Schema Recovery 实施计划

日期：2026-08-09

当前状态：SR4 已在独立普通分支完成 zero-provider reviewed Mock/static；没有读取凭据、调用 Provider、创建正式 evidence
或启动产品。当前只解锁 fresh SR5 admission。

设计来源：
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-schema-recovery-design.md`

当前分支：`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr4`

当前基线：`main@421015dbf472e008fad32200fa8a89e240818fcf`

lineage：`phase-6.9.8-retriever-final-response-schema-recovery-v1`

SR3 authority：`zero_provider_retriever_final_response_schema_recovery_runner_durability / qualityAuthority=none`

SR3 identity：manifest SHA=`d14c08455126fad492f9f01ed07a1a4fd911241c62384fbd07537e4ffda1bede`，policy SHA=
`6c1f1b0388b2b595f141061cb3d0d34607b6214a4772e7cb4a17309e431cebf8`；分母 `8/6/6/12/20`，最大并发 `1`，预算
`37600/8800/0.176 CNY`。

SR4 identity：factory SHA=`sha256:7bc32c8ed68c3c8d76c9c983b40e771f24c0181cda7976cbc97ab1fb4c26d157`；固定结果
`8/8` guards、`12/12/12/12` reservations/dispatches/responses/verifiedUsage、schema `4 canonical + 2 extension discarded
+ 0 rejected`、FinalResponse strict `6`、节点路径 `18/6/6/6/6`、synthetic Qwen port `18`；gate=
`schema_recovery_mock_quality_not_evidence / qualityAuthority=none`。

## 1. 执行纪律

- 每个 SR 阶段从最新已推送 `main` 建立普通 git 分支；不在功能分支上再开分支，不使用 worktree。
- 一阶段一提交；提交前同步 `AGENTS.md`、`README.md`、`DEVLOG.md`、roadmap、data-flow、dev-start、统一
  acceptance checklist、AI behavior、spec/plan/acceptance。
- SR0--SR4 必须 zero-provider：不读根 `.env`/credential，不构造真实 DeepSeek/Qwen adapter，不调用网络，不启动或
  清理 Docker/PostgreSQL/Redis/MinIO，不写 Trace/BackgroundJob/Outbox/业务数据。
- P1 L2、T3、R5、Phase 6.9.7 SR5 的 marker/journal/report/artifact/tag/SHA/authority 不可修改；新 lineage 的
  namespace、source manifest、approval、validator 均独立。
- 已完成的 sealed validator 只做只读复核；不反复重跑已完成的 Live、产品验收或全量回归。

## 2. SR0：设计冻结（已完成的历史 checkpoint）

### 2.1 交付

- [x] 只读复盘 P1 L2 `rewrite_03 / schema / runtime_untrusted` 的可证边界，不猜测 raw shape；
- [x] 冻结 `phase-6.9.8-retriever-final-response-schema-recovery-v1` 与独立 authority；
- [x] 冻结 Provider content → envelope → rewrite projection → local safety/authority 四步合同；
- [x] 冻结 strict canonical `rewrittenQuery`、extension 有界丢弃、alias/duplicate/wrapper/limit fail-closed；
- [x] 冻结 bounded diagnostic enum/bucket/hash 与 `rawDataRetained=false`；
- [x] 冻结 Retriever、Qwen/evidence projector、FinalResponse、Router、runner/validator 的权限与通信边界；
- [x] 冻结并发、reservation、breaker、abort/stale、lost task、PID/signal/publication/claim 停止门；
- [x] 冻结 SR1--SR7 原子路线、数据边界/精确授权门与文档回顾问题；
- [x] 同步项目入口文档与 SR0 acceptance。

### 2.2 本阶段不做

- 不实现 parser、candidate wrapper、runner、validator 或 recovery CLI；
- 不运行任何 `live`、`controlled`、`seal`、`recover`、`replay`、`backfill` 命令；
- 不创建 SR0 marker/journal/report/artifact/recovery claim/approved tag；
- 不启动项目浏览器验收；本阶段没有产品行为改动可供浏览器验收。

### 2.3 SR0 验收门

1. 只读执行已封存 P1 L2 validator，确认 `ok=true / bundle_valid`，不读取 `.env`、不调用 Provider；
2. `git rev-parse` 与 `git rev-list --left-right --count` 证明基线、分支和远程关系；
3. 对新 SR namespace 做精确文件名扫描，marker/journal/report/artifact/recovery claim 均为 `0`；旧 lineage 文件不计入；
4. Markdown Prettier、`git diff --check`、相对链接和文档冲突检查通过；
5. 不重复 Agent full、Docker/API/browser 或历史 Live 验收，因为本阶段没有源码变化且这些证据已封存。

## 3. SR1：Strict parser、projection 与 TDD

状态：已完成（从 SR0 合并后的最新 `main` 新开 `...-sr1`）。SR1 交付实际落在
`packages/agent/src/model-candidates/retriever-schema-recovery-contract.ts`、
`packages/agent/src/model-candidates/retriever-schema-recovery.ts`、query-rewrite candidate 与对应 tests；diagnostic
只在 candidate outcome 顶层 sidecar，Retriever node 只保留 observation。

### 3.1 实现边界

- 新增 module-owned exact schema identity、bounded native JSON parser 和 duplicate-key scanner；
- 复用 `requireModelAgentBoundedJsonContentParser` 的 WeakMap capability，但不修改通用 trace 的公开字段；
- 输出 canonical plain `{ rewrittenQuery }`，记录最多一个 bounded diagnostic；
- 复用现有 local safety/authority/merger，不让 parser 接触 expected/oracle；
- generic runtime/adapter failure 只映射到固定 stage/reason，不保存 raw runtime result；usage/trace 不一致或无法细分的
  sanitizer failure 统一为 bounded `projected_schema/unknown`。

### 3.2 RED/GREEN matrix

- canonical/extension/alias/missing/type/empty/overlong；
- duplicate key（顶层与嵌套）、multiple values、wrapper、fence、BOM、trailing/prose；
- byte/depth/node/key/UTF-16/control limits；
- hostile getter/Proxy/Symbol/cycle/non-plain object；
- unchanged/protected-term/tool/write/credential safety；
- runtime `provider_json_parse/provider_type_validation/provider_object_missing`、usage、timeout、transport、abort；
- deep-freeze、no alias mutation、single dispatch/no retry、fallback 原 query。

SR1 GREEN：contract `9/9`（153 assertions）、candidate `13/13`（171 assertions）、AI strict policy `4/4`（16 assertions）、
Retriever node boundary `9/9`（90 assertions），合计 `35/35`（430 assertions）；Agent `1450/1450`、AI `345/345`、
typecheck、lint、变更范围 Prettier 与 `git diff --check` 均已回放通过。

### 3.3 只解锁

只解锁 SR2 robustness；不解锁正式 runner、Mock、Live、产品或 main。

## 4. SR2：Provider-like robustness 与 anti-oracle（历史已完成）

- 状态：已完成。新增 `phase-6.9.8-retriever-schema-recovery-sr2-robustness-v1` fixture 与
  `phase-6.9.8-retriever-schema-recovery-sr2-prompt-derived-responder-v1` responder；fixture SHA=
  `sha256:59010e16fd665df6d497517276dbeacb3f5973036a07e8cf00010569da171505`，覆盖 `5` held-out、`24` Provider-like
  shape（5 accepted/19 rejected）、`7` fault、`4` metamorphic case；不是正式 full-gate 分母。
- extension Unicode/emoji/NFC/NFD 只能影响 enum/bucket count，不能泄漏 raw；
- responder 只读取真实 bounded prompt 与公开 protected terms，不 import expected、scorer、baseline、oracle；合成 runtime
  固定 `reviewed_mock/mock/mock`，不构造第一方 adapter；
- fault matrix 覆盖 schema/transport/HTTP/usage/abort/deadline/parent cancel；
- 证明 `globalThis.fetch=0`、credential reads=0、formal evidence=0；每个 eligible dispatch 一次且无 retry，hostile
  context/pre-abort/expired deadline 在 runtime 前 zero-call。

SR2 GREEN：focused `12/12`（329 assertions）；SR1+SR2/node/query-rewrite 组合 `43/43`（743 assertions）；AI full
`345/345`（2662 expect()，28 files）、Agent typecheck/lint、AI typecheck/lint、变更范围 Prettier 与 `git diff --check`
通过。验收见 `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr2-zero-provider-robustness.md`。

只解锁 SR3；不提高 P1 分母、预算或 timeout。

## 5. SR3：独立 runner、source admission 与 durability（已完成）

- 固定 `8 guards + 6 rewrite + 6 FinalResponse`、最大并发 `1`、每 lane single dispatch、首错 breaker；
- 为 bounded schema stage 增加 fsynced hash-chain journal、strict report/scorer/validator；
- 使用本计划顶部的新 marker/journal/report/claim/artifact namespace；
- 实现 crash-only prefix recovery，不创建 executor、不恢复 Provider call、不重放 sibling；
- 增加 PID start identity、SIGINT/SIGTERM、claim/event 单边崩溃、publication prefix、foreign temp、hard-link inode、
  artifact conflict、二次 recovery 幂等测试；
- source admission 在 credential/marker 前验证 clean/parity/manifest/authority/formal namespace=0。

SR3 GREEN：focused `15/15`（49 assertions，5 files）；SR1+SR2+SR3+Task 9B 组合 `63/63`（635 assertions，14 files）；Agent full
`1477/1477`（24908 expect()，189 files）、AI full `345/345`（2662 expect()，28 files），Agent typecheck/lint 与 `git diff --check`
通过。CLI synthetic run 为 `12/12/12/12` reservations/dispatches/responses/verifiedUsage、`journalRecords=72`，
`providerCalls=0 / credentialReads=0 / businessWrites=0`；正式 evidence=0。新增公开 validate/recover(seal) token，脚本
默认临时 root，SIGINT/SIGTERM 映射为 AbortSignal。SR3 只解锁 SR4 reviewed Mock/static。

只解锁 SR4；SR3 仍没有 semantic/product/main/P95/SLA authority。验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr3-zero-provider-runner-durability.md`。

## 6. SR4：Reviewed Mock/static

- [x] 实际穿过 recovery parser、Retriever original/query-rewrite node、synthetic Qwen port、evidence projector、
  FinalResponse stream、local authority/merger 和 SR3 runner；
- [x] responder 只消费实际 bounded prompt；expected/oracle/caseId/baseline/credential/provider 不可见；
- [x] extension 只记录 bounded `extension_fields_discarded` 计数并丢弃 raw content/hash；
- [x] 固定 `8/6/6/12/20` 分母、最大并发 `1`、single dispatch、首错 breaker 与 schema/usage/transport/timeout/abort/
  cross-owner fail-closed fault matrix；
- [x] 固定结果 `8/8` guards、`12/12/12/12` wire、schema `4/2/0`、FinalResponse strict `6`、节点路径 `18/6/6/6/6`，
  gate=`schema_recovery_mock_quality_not_evidence / qualityAuthority=none`；
- [x] 临时 evidence `1` 创建后精确清理为 `0`，正式 SR5 namespace/tag/marker/journal/artifact/claim 保持 `0`；
- [x] 完成 Agent/AI/Types/Server/Web 与 historical validator/SHA parity 的最终回放；提交/推送、合并 `main` 后二次验收仍待收口。

只解锁 fresh SR5 admission，不解锁 Provider。

## 7. SR5：唯一 controlled-Live（未来、无预授权）

只有 SR1--SR4 各自提交、推送并在 clean source 上验收后，才可重新接受当次 DeepSeek/Qwen 数据边界并取得新的
exact authorization。SR5 使用新 approved tag/credential mapping/marker/journal/artifact，最多一次；无论成功、schema、
transport、usage、timeout、abort 或 I/O failure 都 durable seal，禁止 retry/resume/replay/backfill/recovery 或单 case
补证。即使完整 gate pass，也只形成新分支 semantic authority，不自动解锁产品或 main。

## 8. SR6/SR7 停止门

- SR6 只有 SR5 完整 quality pass 后才做分支 Docker/API/可见浏览器/Trace/权限/精确清理；不清理 Docker 数据卷。
- SR7 只有 SR6 完成、提交并推送后，从最新 `main` 合并；合并后必须 main 二次 zero-provider 回放并推送远程。
- 任何阶段失败都记录 bounded evidence 与 authority，不重跑旧名额，不把 Mock/transport/partial prefix 拼成质量通过。

## 9. 文档同步清单

- 设计：`docs/superpowers/specs/phase-6-9-8-retriever-final-response-schema-recovery-design.md`；
- 计划：本文；
- 验收：`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr0-zero-provider-design.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr1-zero-provider-tdd.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr2-zero-provider-robustness.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr3-zero-provider-runner-durability.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock-static.md`；
- 入口：`AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`、`docs/data-flow.md`、`docs/dev-start.md`、
  `docs/acceptance-checklist.md`、`docs/ai-behavior-acceptance.md`；
- [x] SR2 fixture/responder SHA、shape/fault/metamorphic matrix 与 zero-provider authority 已记录；
- [x] SR2 focused/组合/AI/typecheck/lint/Prettier/diff evidence 已记录；
- [x] SR4 factory SHA、production-shaped node path、schema accounting、anti-oracle、fault matrix 与 zero-provider authority 已记录；
- [ ] SR4 Agent/AI/Types/Server/Web/historical validator parity、分支推送、`main --no-ff` 合并与合并后二次回归完成后勾选；
- 历史 P1 spec/plan 与 Agents 设计计划只更新“当前状态/下一步”指针，不改写已封存事实。
