# Phase 6.9.8 Retriever / FinalResponse Transport Re-entry V2 实施计划

> 设计来源：[Transport Re-entry V2 设计](../specs/phase-6-9-8-retriever-final-response-transport-reentry-v2-design.md)
> 当前状态：D0、C1、C2 zero-provider runner/durability、S1 reviewed Mock/static、L1 implementation 与唯一 L1
> controlled-Live 均已完成；run `ce0c3257-a5d9-4389-90ec-814d5e9cde34` 已以
> `transport_reentry_v2_l1_controlled_canary_passed / qualityAuthority=none` durable seal。P1 zero-provider
> semantic-gate 设计已另立普通分支冻结，当前下一步为 G1。
> 历史实现分支：`drb/phase-6-9-8-retriever-final-response-contract`
> 当前 authority：L1 `controlled_live_transport_reentry_v2 / qualityAuthority=none`；implementation/root-env diagnosis 与
> S1 的 zero-provider authority 均保留为历史 checkpoint

## 执行原则

- V2 是全新 lineage，不是 T3 retry、seal、recovery、replay 或 backfill。
- 继续复用当前功能分支，因为 Task 0--9B 基线尚未进入 `main`；禁止从该分支再开嵌套分支或 worktree。
- D0/C1/C2/S1 全程 zero-provider；不读取真实 `.env`、credential，不启动 Docker/API/browser，不写业务/Trace。
- 只有 L1 才能在新的数据边界接受和 exact authorization 后读取受控 credential 并调用最多三个 Provider slot。
- 每个阶段单独提交、推送，并同步 AGENTS、DEVLOG、README、roadmap、acceptance checklist 与相关设计文档。
- 任何 Mock/synthetic/transport authority 都不能替代 semantic/product/main authority。

## D0：设计与边界冻结（已完成）

- 冻结 V2 lineage、confirmation、证据前缀、generic-to-dedicated projection 和 gate 顺序；
- 冻结 `rewrite -> qwen -> final_response` 三槽、`0.024096 CNY` cap、hard timeout、首错 breaker 和 no-retry；
- 明确旧 T3/R5/Task 9C 只读 parity 与不可复用边界；
- 形成 acceptance 记录与 reader questions。

验收：文档互链、停止门、权限矩阵和事实/未知事实口径一致；Provider/credential/formal evidence 均为 `0`。

## C1：root launcher 与 dedicated projection contract（已完成）

责任范围：新建 `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-*`
模块和 focused tests；旧 T3 文件只读复用。

- root package script 只负责启动 launcher，不使用 ambient `bun --env-file`；launcher 根据自身位置解析共享根 `.env`，使用
  selective credential profile，只提取固定 generic key 与既有 Qwen 宿主别名；strict synthetic parser 仍保留固定
  allowlist/unknown-field fail-closed contract；
- exact argv、source、T2/T3-C parity、proxy、data-boundary、authorization 在 credential 前执行；
- synthetic env fixture 验证 path/cwd 独立性与 BOM/CRLF/引号/重复键边界；hostile ambient `process.env` 不得影响来源；
  credential reader 使用 data-property、无 getter、无 raw 输出；
- generic key 仅投影为 module-owned dedicated capability，single-use、lineage/family/call 绑定，不能伪造/复用/跨界；
- capability consumer 只返回不含 raw key 的 opaque receipt，密钥留在模块私有状态，不进入 runtime/adapter 或 evidence；
- C1 focused、Agent full、typecheck/lint/Prettier/diff check 通过，正式 marker/evidence 保持 `0`。

实现落点：

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts`
- `packages/agent/scripts/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.test.ts`

验收摘要：focused `10/10`（38 assertions），Agent full `1372/1372`（23864 expect()，171 files），C1 synthetic CLI
输出 `providerCalls=0 / credentialReads=0 / formalEvidence=0`；typecheck/lint/Prettier/diff check 与旧 T3 只读
validator（`ok=true`）均通过。未读取真实 `.env`、未调用 Provider、未创建 marker/journal/artifact/recovery claim，也未
启动 Docker/API/browser。下一步解锁 C2；V2 L1 仍需要新的数据边界接受与 exact authorization。

## C2：V2 runner/durability（已完成）

- C1 三项 dedicated capability 已收口为 module-owned、single-use opaque configuration capability；invalid projection 在
  marker 前 fail-closed，不创建 marker/journal/report/artifact/recovery claim；
- 固定 source admission、exclusive marker、reservation-before-dispatch、fsynced hash-chain journal、hard-link
  artifact、strict validator 与 crash-only seal；
- marker 后的 dispatch/response/usage 每槽只允许一次，首错 breaker/no-retry；fault matrix 覆盖
  `missing/invalid/conflict/abort/timeout/transport/schema/usage/publication` 与 reserved/dispatch crash prefix；
- focused `15/15`（88 assertions）、Agent full `1387/1387`（23957 expect()，172 files）、typecheck/lint/Prettier
  通过；旧 T3/R5/Task 9C validator/SHA parity 只读通过；Provider/credential/formal evidence 均为 `0`。
- 验收：`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-zero-provider-runner-durability.md`。

## S1：reviewed Mock/static（已完成）

- 三个 bounded synthetic first-party adapter 通过同一 C2 runner 的 synthetic ports，固定顺序为
  `rewrite -> qwen -> final_response`；
- 记录 Provider/credential/formal evidence=`0/0/0`，success wire=`3/3/3/3 + 3/3/3/3`，usage=`480/120/600`、
  factory/report SHA 与 no-raw audit；
- fault matrix 覆盖 timeout/transport/schema/usage 与 `abort_before_qwen`，首错 breaker、no-retry、suffix 不补发和
  isolated temp-root cleanup 全部通过；
- focused（S1+C2）`22/22`（136 assertions），Agent full `1394/1394`（24011 expect()，173 files），typecheck/lint/
  Prettier/diff check 通过；
- source admission 只统计占用当前 V2 marker/journal/recovery/report/root artifact 路径的目录项；历史 `.tmp` 文件忽略，
  缺失 `.tmp` 视为空，其他读取失败 fail-closed；clean-source CLI 为 `git_verified / formalArtifactCount=0`；
- 主代理完成 contract/security/operations 静态复核。三路只读子代理尝试均因服务端 `429 Too Many Requests` 超过
  重试上限，未形成独立复审证据，文档不声称子代理复审通过；
- gate 固定 `transport_reentry_v2_s1_mock_quality_not_evidence / qualityAuthority=none`。

验收：`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock-static.md`。

## L1：唯一 controlled canary（已封存）

### L1 implementation checkpoint（已完成，zero-provider）

- 新增 production-shaped launcher、strict source/proxy/data-boundary/authorization gate 与 fixed three-slot
  runner；真正 adapter constructor 延后到 durable marker/reservation 之后；
- 新增 dispatch/response/usage journal state machine、hash-chain validator、lineage path fence、reserved/dispatch
  crash-only recovery、existing-artifact publication recovery 与 recovery-claim integrity check；
- focused L1 `13/13`（44 assertions）、C1+C2+S1+L1 `47/47`（224 assertions）、Agent full `1409/1409`（24069
  assertions，174 files）、targeted ESLint/Prettier/Bun build 通过；Provider/credential/formal evidence=0；
- 该 checkpoint 不消费 L1 marker，不形成 transport/semantic/product authority；提交并推送后需要对新 source commit
  重新接受数据边界并给出 exact authorization。

### Root `.env` admission diagnosis and compatibility fix（2026-08-08）

- 首次受控入口在 root-env composition 以 `credential_configuration_invalid / unknown_key` 停止：共享根 `.env` 含
  正常项目设置，并使用兼容别名 `Qwen_API_KEY`；没有 marker、credential read、Provider call 或正式 evidence；
- production root selector 现在忽略非 credential 项目字段，只把 `DEEPSEEK_API_KEY` 与
  `QWEN_API_KEY`/`Qwen_API_KEY`/`DASHSCOPE_API_KEY` 投影为 canonical 两字段；Qwen alias 多源并存时
  `alias_conflict` fail-closed，目标值仍遵守原 bounded value rules；
- 该修复是独立 zero-provider compatibility checkpoint，不改写 C1 synthetic parser/历史验收，也不消费或恢复前次
  L1 一次性名额；修复提交推送后必须重新做 source/proxy/data-boundary gate 并取得新的 exact authorization。
- 详见 `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-root-env-diagnosis-zero-provider.md`。

以下是 Live 前历史授权门；它已在新 source 上完成一次且不可重用：

```text
I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_DEEPSEEK_AND_QWEN_DATA_BOUNDARY
I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_CONTROLLED_CANARY_ONCE
```

L1 最多三次 Provider call，失败即 durable seal；不得 retry/resume/replay/backfill、curl、单 case 或追加探测。
成功也只解锁 P1 zero-provider semantic-gate design，不直接进入产品或 `main`。

### L1 controlled-Live sealed result（2026-08-08）

- source：`ee3dbf91c863a3a5cd95c810a9c0cec0b26f64c6`；run：`ce0c3257-a5d9-4389-90ec-814d5e9cde34`；proxy：`direct_ready`；
- runtime：`3/3` slots completed，Provider/credential reads=`3/3`，usage=`145/28/173`，费用=`0.000573 CNY`，
  breaker closed，recoveryRequired=`false`；
- durability：journal=`16`，final=`evidence_published`，validator=`ok=true`，artifact SHA=`472c727d...4718`；
- authority：`controlled_live_transport_reentry_v2 / qualityAuthority=none`，仅为 transport diagnostic，不形成 semantic、
  product、Docker/API/browser、Trace、SLA 或 `main` authority；
- marker 已 durable，唯一名额已消费，禁止任何 retry/resume/replay/backfill、recovery/seal 或追加 Provider 探测；
- 完整证据：`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-controlled-live-sealed.md`。

## P1：L1 终态后的下一决策（下一原子任务）

- L1 完整 transport success（当前终态）：另立 zero-provider 小样本 semantic gate，先冻结 manifest/baseline/质量门与
  reviewed Mock，再决定是否申请独立语义样本；
- 任一 transport/configuration/durability failure（本 run 未发生）：保留 bounded evidence，禁止重跑，重新做架构决策；
- 不论结果如何，旧 T3/R5/Task 9C bytes 与 authority 永不改写。

## 当前停止边界

T3 controlled canary 已失败封存，T3-C guard、V2 D0/C1/C2/S1 与唯一 L1 controlled-Live 已完成。当前允许读取旧
validator、运行 zero-provider 回归和同步文档；禁止旧 T3/L1 重跑、产品 Docker/API/browser 语义验收、Task 10/11 或
任何追加 Provider 调用。P1 设计已完成；下一任务必须从最新 `main` 新建普通分支，完成 G1 zero-provider
manifest/subset baseline/scorer。P1 文档见
`docs/superpowers/specs/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate-design.md`、
`docs/superpowers/plans/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md` 与
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md`。
