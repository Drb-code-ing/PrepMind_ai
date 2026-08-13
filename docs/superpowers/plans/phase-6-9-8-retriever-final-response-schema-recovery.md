# Phase 6.9.8 Retriever / FinalResponse Schema Recovery 实施计划

> 2026-08-12 current override 2：独立普通分支已完成 zero-provider run-bound source revalidation recovery。self-marker
> allowlist、runId-bound capabilities、共享 strict journal schema、guard 后首 dispatch capability/permit 与 late-mutation
> `invokeCall=0 / wire.dispatches=0` 已实现。旧 v2 run/tag 不变且禁止重跑；本任务不创建新 tag、不接受授权、不执行 Live，
> SR6 保持阻断。完成分支/main 推送及 main parity 后，是否开展新真实运行必须另立 lineage/source/tag 决策。

> 2026-08-12 current override：SR5 唯一 v2 controlled-Live run
> `9eb57600-97e2-4513-8654-8686b38e856e` 已在 reservation 后、首个 guard/Provider dispatch 前异常退出，并由
> crash-only recovery 封存为 `schema_recovery_sr5_branch_quality_gate_failed / qualityAuthority=none`。根因是
> reservation 创建的 current-run marker 被后续 namespace=0 source revalidation 当作 drift。该 run 禁止重跑或追加
> Provider 探测；下述 SR6/SR7 保持阻断。下一任务必须另立 zero-provider run-bound source revalidation recovery，详见
> `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-recovery-sealed.md`。

日期：2026-08-09

当前状态：SR4 reviewed Mock/static、SR5 zero-provider admission/runner/durability、Live implementation、proxy snapshot fix 与
Live tag compatibility recovery 已完成。
首次 controlled-Live 在 proxy 前门 fail-closed（Provider/credential/formal evidence/business writes 均为 `0`）；修复提交 `b531adef` 与文档
提交 `c0155ca1` 已以 merge=`671188bb` 合并回 main 并推送，合并后二次 zero-provider 回归通过；当前 tag compatibility
源码/文档尚待提交、合并和最终 source 授权。

设计来源：
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-schema-recovery-design.md`

当前分支：`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr5`

当前基线：功能分支、`main` 与 `origin/main` 在本任务开始时均为 `034ec363`；tag compatibility 变更必须先完成提交、
main 合并、远程推送与合并后二次 zero-provider 回归。

SR5 lineage：`phase-6.9.8-retriever-final-response-schema-recovery-sr5-v1`；Live implementation lineage：
`phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v1`（SR3/SR4 lineage 仍作为上游 identity 保留）

SR3 authority：`zero_provider_retriever_final_response_schema_recovery_runner_durability / qualityAuthority=none`

SR3 identity：manifest SHA=`d14c08455126fad492f9f01ed07a1a4fd911241c62384fbd07537e4ffda1bede`，policy SHA=
`6c1f1b0388b2b595f141061cb3d0d34607b6214a4772e7cb4a17309e431cebf8`；分母 `8/6/6/12/20`，最大并发 `1`，预算
`37600/8800/0.176 CNY`。

SR4 identity：factory SHA=`sha256:7bc32c8ed68c3c8d76c9c983b40e771f24c0181cda7976cbc97ab1fb4c26d157`；固定结果
`8/8` guards、`12/12/12/12` reservations/dispatches/responses/verifiedUsage、schema `4 canonical + 2 extension discarded

- 0 rejected`、FinalResponse strict `6`、节点路径 `18/6/6/6/6`、synthetic Qwen port `18`；gate=
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
- [x] 完成 Agent/AI/Types/Server/Web 与 historical validator/SHA parity 的最终回放；SR4 提交/推送、`main --no-ff` 合并、合并后二次 focused/static/typecheck 回放与 `origin/main` 推送已完成（历史 merge=`d5029f90`）。

只解锁 fresh SR5 admission，不解锁 Provider。

## 7. SR5：admission、runner/durability 与唯一 controlled-Live

### 7.1 Zero-provider admission contract（已完成）

- [x] 固定 approved branch/annotated tag、tag object id、SR3/SR4 identity 与 Git blob source bundle；
- [x] source/HEAD/upstream/origin/tag/clean tree/formal namespace fail-closed；
- [x] 固定 DeepSeek/Qwen data-boundary receipt、source-bound exact authorization 与 confirmation SHA-only record；
- [x] 固定 12 次候选调用、37,600/8,800 token、0.176 CNY、最大并发 1 与 no retry/resume/replay/backfill；
- [x] source-bound API 将 source、boundary、authorization、budget 组合为 module-owned single-use
      admission/reservation capability，并在 reservation 时重查 source drift；
- [x] zero-provider admission CLI 只开放 source-only help/admission/validate；live/seal/recover/replay/credential 参数关闭；
- [x] focused `12/12`（50 assertions）、typecheck/lint、CLI help smoke 与 diff check 通过。

authority=`zero_provider_retriever_final_response_schema_recovery_sr5_admission`、gate=`sr5_admission_zero_provider`、
`qualityAuthority=none`。approved tag 尚未创建，provider dispatch=false；验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-admission-zero-provider.md`。

### 7.2 Runner/durability checkpoint（已完成，zero-provider）

- [x] 固定 `8 guards + 6 rewrite + 6 FinalResponse`、`20` report entries、`12` candidate invocations、最大并发 `1`、
      pair serial、single dispatch、预算 `37,600/8,800/0.176 CNY`；
- [x] runner 在运行时核对 admission budget 与 runner policy，首错 breaker 保留 suffix denominator，不重试、不复制 sibling；
- [x] 独立 marker/journal/report/recovery/artifact namespace，reservation/fsync-before-dispatch、fsynced hash-chain、
      hard-link publication、strict recomputing validator 与 crash-only recovery；
- [x] fail-closed 覆盖 tamper、CRLF、foreign artifact、publication prefix、二次 seal、PID/start identity 与 capability
      二次消费；recovery 不创建 executor、不重放 Provider call；
- [x] CLI 只开放 synthetic reviewed Mock、validate、crash-only recover；focused `25/25`（82 assertions）、typecheck/lint、
      CLI help/run smoke 与 `git diff --check` 通过，runtime `12/12/12/12` wire、`12/0/0` succeeded/failed/notStarted；
- [x] runner manifest SHA=`d50e27729d873833fc857efe648ba8a56fda19a4d70212a22aa01dbe02b53ea3`，policy SHA=
      `ff05b647a4c00a3943c18c70d02650aad3d4b880209ac35f04e60d1d9e31f803`；正式 evidence=`0`。

authority=`zero_provider_retriever_final_response_schema_recovery_sr5_runner_durability`、gate=
`schema_recovery_mock_quality_not_evidence`、`qualityAuthority=none`。验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability-zero-provider.md`。

### 7.3 Live implementation（已完成，zero-provider）

- [x] 新增独立 Live Git-object source manifest，绑定根 `package.json`、`bun.lock` 与 `packages/agent`、`packages/ai`、
      `packages/types`；最终 source bundle 在 parity commit 上重算，不沿用 proxy 修复前的 SHA；
      历史 admission manifest 保持 `sha256:f71bdee19cf4509395566d8bf54d85ad1f37cf867ca2cbf37211b1daef8fa38b` 不变；
- [x] 新增 production-shaped Live CLI/core，显式 `bun --no-env-file`，执行 exact argv/data-boundary/authorization/formal
      namespace/source/tag/proxy 前门，credential 只在前门通过后 selective-read；
- [x] 固定 `8 guards + 6 rewrite pairs + 6 FinalResponse`、DeepSeek `12` + Qwen `12`、最大并发 `1`、pair-serial、预算
      `37600/8800/0.176 CNY` 与 no retry/resume/replay/backfill；
- [x] 接入 exclusive marker、fsynced hash-chain journal、hard-link artifact、strict validator 与 crash-only recovery；
- [x] 原实现 focused Live `10/10`（36 assertions）、SR5 + Task 9B boundary 组合 `48/48`（164 assertions）；proxy 快照修复后 focused
      `11/11`（39 assertions），Agent typecheck/lint/Prettier/diff check 通过；当前 `providerCalls=0 / credentialReads=0 / formalEvidence=0 /
businessWrites=0`；
- [x] 新增 implementation acceptance，并将 AGENTS/README/DEVLOG/roadmap/data-flow/dev-start/checklist/AI/spec/plan 纳入同步清单。

这是 zero-provider implementation checkpoint（runtime authority 尚未产生，`qualityAuthority=none`）；实现完成不形成
controlled-Live、semantic/product/main/P95/SLA authority。验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-implementation-zero-provider.md`。

### 7.3.1 Proxy snapshot fix（已完成，zero-provider）

- [x] 复现 Bun/Windows accessor-backed proxy environment 与 SR5 `proxy_preflight_not_ready` 前门停止；确认未读取 credential、未创建 marker、
      未调用 Provider；
- [x] 将固定 proxy allowlist 通过 `Reflect.get` 物化为不可变 data-properties，getter 异常写入 `null` 并保持 shared preflight fail-closed；
- [x] 新增 accessor-backed regression，proxy 修复后 focused Live `11/11`（39 assertions），typecheck/lint/Prettier/diff check 通过；
- [x] 新增零 Provider 故障与修复 acceptance；旧 approved tag/source 不改写。

修复只恢复 proxy 前门的生产兼容性，不形成 Provider/semantic/product/main authority。回执见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-proxy-snapshot-fix-zero-provider.md`。

### 7.3.2 Live tag compatibility recovery（已完成，zero-provider）

- [x] 保留历史 `phase-6-9-8-retriever-final-response-schema-recovery-sr5-approved` tag 与 historical admission
      manifest，不移动、不覆盖、不复用；
- [x] 新增 `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v1-approved` tag/ref 合同与 strict Live
      source schema；
- [x] Live Git observation/admission 重算独立 tree bundle，绑定 source-manifest SHA
      `sha256:d1129b3caf414c5561df425f1a2ffdfcde7d29468a568845d1c110908559ccdd`；
- [x] report、CLI、durability、synthetic reviewed Mock 均消费 Live source 类型；历史 source-admission 行为不改写；
- [x] SR5 contract/source/Live focused `26/26`（102 assertions）、Agent full `1527/1527`（25213 expect()，196 files）、Agent typecheck/lint/Prettier/diff check 通过；
      Provider/credential/formal evidence/business writes=`0`。

验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-tag-compatibility-zero-provider.md`。

### 7.3.3 Environment and namespace fence hardening（已完成，zero-provider）

- [x] 生产 CLI 将 Bun/Windows accessor-backed authorization entries 物化为不可变 data-properties；getter 异常生成 invalid
      sentinel 并 fail-closed，不执行二次读取。
- [x] Live source admission 对 root 与 `.tmp` 做 `lstat`/canonical-path 校验，symlink/junction、非目录与读取错误统一
      fail-closed，避免 formal namespace fence 跟随链接到仓库外。
- [x] 增加 own-descriptor proxy/authorization regression、`.tmp` replacement durability fence；SR5 contract/source/Live focused
      `26/26`（102 assertions），Agent full `1527/1527`（25213 expect()，196 files），typecheck/lint/Prettier/diff check 通过；
      Provider/credential/formal evidence/business writes=`0`。

本小步仍不创建 approved tag、不读取真实 `.env`、不调用 Provider；只在最终 main parity 后进入唯一 controlled-Live 停止门。

### 7.3.4 Production proxy port recovery（当前，zero-provider）

- [x] 定位正式入口与独立 preflight 不一致的确定性根因：`createPorts` 丢弃 production `runProxyPreflight` override；
- [x] 改为 `overrides?.runProxyPreflight ?? default fail-closed stub`，保留未绑定 port 的安全默认值；
- [x] 新增 ready/not-ready 双向回归，确认 ready 后仅进入 synthetic credential stop，不 reservation、不运行 Provider；
- [x] 保留已推送 `live-v1` tag 不动，将当前 source contract 预留到待创建的 immutable
      `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v2-approved`；source manifest=
      `sha256:61afe007f588c62833a10d6c66934bcd90bd3061f4005d1b66e943088afa2829`，Live manifest=
      `372abb4656885536a080cccc98226d41bce083a0fafc6ab54b104eed81df67a4`；
- [x] focused SR5 Live `16/16`（63 assertions）、typecheck/lint/diff check 通过，Provider/credential/formal evidence/
      business writes=`0`。

验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-proxy-port-recovery-zero-provider.md`。

### 7.4 唯一 controlled-Live（等待修复后的新 source 授权）

功能分支先提交并推送、合并并推送最终 `main`，完成 source/upstream/origin parity 与二次 zero-provider 回归；随后在最终 commit
创建并推送 approved annotated tag
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v2-approved`，核对 tag object/peeled commit，再重新接受该 tag/source
的 DeepSeek/Qwen 数据边界并取得新两行 exact authorization。SR5 使用新 tag/credential mapping/marker/journal/artifact，最多一次；无论成功、schema、
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
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock-static.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-admission-zero-provider.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability-zero-provider.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-implementation-zero-provider.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-proxy-snapshot-fix-zero-provider.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-tag-compatibility-zero-provider.md`、
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-proxy-port-recovery-zero-provider.md`；
- 入口：`AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`、`docs/data-flow.md`、`docs/dev-start.md`、
  `docs/acceptance-checklist.md`、`docs/ai-behavior-acceptance.md`；
- [x] SR2 fixture/responder SHA、shape/fault/metamorphic matrix 与 zero-provider authority 已记录；
- [x] SR2 focused/组合/AI/typecheck/lint/Prettier/diff evidence 已记录；
- [x] SR4 factory SHA、production-shaped node path、schema accounting、anti-oracle、fault matrix 与 zero-provider authority 已记录；
- [x] SR4 Agent/AI/Types/Server/Web/historical validator parity、分支推送、`main --no-ff` 合并与合并后二次回归已完成；
- 历史 P1 spec/plan 与 Agents 设计计划只更新“当前状态/下一步”指针，不改写已封存事实。

## Current execution override (2026-08-12)

SR5 next-lineage D0/C1 is implemented, pushed as `87dd1e24`, merged with `--no-ff` as `001770ff`, and pushed to `main`. Merged-main Git admission plus focused/full/typecheck/lint parity passed. Do not create the future v3 tag or request Live authorization in this task; those remain separate next-lineage decisions.

C2 now freezes the annotated-tag contract and post-tag verifier on `drb/phase-6-9-8-sr5-next-lineage-tag-contract`. Required closeout: feature commit/push -> `--no-ff` merge/push final `main` -> compute bundle -> create/push v3 tag -> actual local/origin tag parity. No commit follows the tag in C2, and no Live authorization is requested.

D1 freezes v3-bound boundary/authorization schemas on `drb/phase-6-9-8-sr5-next-lineage-authorization-contract`; focused zero-provider checks pass. Closeout is feature push, `--no-ff` merge/push, and merged-main regression. No user authorization is requested in D1; later runner composition and a new complete-source tag are separate tasks.

D2 composes C2/D1/proxy zero-call gates on `drb/phase-6-9-8-sr5-next-lineage-runner-preflight`. It ends at a dispatch-disabled preflight capability and creates no durability state. Closeout requires focused/full/typecheck/lint/Prettier, feature push, `--no-ff` merge/push, and merged-main regression before any runner/durability task.

D3 freezes a non-self-referential v4 runtime-source contract. Final commit/bundle/tag-object are supplied after complete-source tagging by a future Git verifier, then matched to exact authorization fields. D3 issues no Git authority or execution capability. D4 now adds the v4-native zero-provider runner/durability boundary with one-shot source consumption, `8` guards, `12` reserved zero-dispatch lanes, strict journal/report/artifact validation, and no Live argv. The final Git verifier remains a separate zero-provider task before tag creation or authorization.

### D5 final Git verifier (implemented 2026-08-13)

D5 adds a read-only verifier for the future v4 annotated tag. It computes the dynamic source receipt only after complete-source
merge/tag parity and can issue a single-use Git/source-only capability. It does not create or push the tag, read credentials,
request authorization, call Providers, invoke the runner, or write evidence. The feature must be merged and revalidated on `main`
before a separate Git-operation task creates/pushes v4; only afterward may D5 inspect the real tag.
The D5 feature commit `7a2dfced` is merged/pushed as `31b17fe9`; merged-main focused D5+D3+D4 validation passed `48/48`.

### v4 post-tag test recovery (2026-08-13)

The immutable v4 tag passed real D5 Git inspection, but the immediate tagged-source replay exposed one repository-lifecycle test
assumption and passed `21/22`. v4 is Git-valid but blocked from authorization/Live. Recovery moves the final approved tag and exact
boundary/authorization vocabulary to v5, replaces the real-checkout pre-tag assertion with isolated temporary-root coverage, and
requires feature merge/push plus merged-main validation before a separate v5 tag operation. The v4 tag is never moved or deleted.
