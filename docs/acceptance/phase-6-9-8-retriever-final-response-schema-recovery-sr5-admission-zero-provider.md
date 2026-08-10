# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR5 admission 验收

日期：2026-08-10
分支：`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr5`
基线：`main@82936a955670a647756940fb398119647064d095`
状态：**zero-provider admission contract 已完成；controlled-Live 尚未授权、尚未执行**

## 1. 这一步完成了什么

SR4 reviewed Mock 只证明 production-shaped Retriever/FinalResponse 链路在 synthetic runtime 下可运行。本阶段把
SR4 到未来唯一一次 SR5 controlled-Live 之间的“准入门”做成了独立、可测试的合同：

```text
Git source/tag observation
  -> source bundle + SR3/SR4 identity parity
  -> DeepSeek/Qwen data-boundary receipt
  -> exact source-bound authorization
  -> fixed budget / concurrency / no-retry policy
  -> source-bound API 组合 boundary/auth/budget
  -> opaque single-use bound admission + reservation capability
```

准入模块不读取根 `.env`，不读取 credential，不创建 Provider adapter，不访问网络 Provider，不创建 marker/journal/report/
artifact/recovery claim，也不写 Trace、BackgroundJob、Outbox 或业务数据。

## 2. 固定身份与边界

| 项目              | 当前合同                                                                            |
| ----------------- | ----------------------------------------------------------------------------------- |
| lineage           | `phase-6.9.8-retriever-final-response-schema-recovery-sr5-v1`                      |
| authority         | `zero_provider_retriever_final_response_schema_recovery_sr5_admission`              |
| gate              | `sr5_admission_zero_provider`                                                       |
| mode              | `zero_provider_admission`                                                           |
| approved branch   | `drb/phase-6-9-8-retriever-final-response-schema-recovery-sr5`                      |
| approved tag      | `phase-6-9-8-retriever-final-response-schema-recovery-sr5-approved`（当前尚未创建；要求 annotated tag） |
| SR3 identity      | manifest/policy 固定绑定                                                            |
| SR4 identity      | factory `sha256:7bc32c8e...b7e6a` 与 acceptance checkpoint SHA 固定绑定             |
| budget            | 12 invocations；input/output `37,600/8,800`；`176,000` micros CNY                   |
| concurrency       | maximum `1`、pair serial、每 lane single dispatch                                   |
| retry/replay      | `false/false/false/false`（retry/resume/replay/backfill）                           |
| provider dispatch | `false`（本阶段）                                                                   |

合同只把 data-boundary/authorization 的 SHA 写入 admission record，不保存确认原文。确认字符串不会进入 report、Trace、
prompt 或产品响应。

## 3. 实现与测试

新增：

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts`
  - strict source/boundary/authorization/budget schema；
  - upstream SR3/SR4 identity；
  - exact CLI argument parser；
  - deep-freeze、hostile accessor fail-closed、synthetic-only tuple seam。
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts`
  - branch/HEAD/upstream/origin/tag/clean tree/formal namespace/source bundle 检查；
  - Git-verified 与 synthetic-test 隔离 capability；source-bound API 将 source、boundary、authorization、budget 组合成单一能力；
  - reservation 时重新检查 Git source drift；
  - source bundle 使用 Git blob 计算，不信任调用者自报 SHA。
- `packages/agent/scripts/phase-6-9-8-retriever-final-response-schema-recovery-sr5-admission-cli.ts`
  - 仅提供 source-only zero-provider help/admission/validate 参数面；不提供 live、seal、recover、replay 或 credential 参数。
- 对应 focused tests 与 `@repo/agent` exports/script。

回归结果：

```text
SR5 focused contract + source admission: 12/12 tests, 50 assertions
Agent typecheck: passed
Agent lint: passed
Agent full: 1500/1500 tests, 25077 expect() calls
CLI --help smoke: passed (providerCalls=0, credentialReads=0); admission/validate CLI 仅做 source-only probe，不签发 bound capability
git diff --check: passed
```

复审另外收紧了 tuple capability：该 seam 仅允许 `synthetic_test` authority；真实 Git source admission 通过
`admitPhase698RetrieverSchemaRecoverySr5SourceBoundZeroProvider` 组合并签发 bound capability，调用者不能通过参数重标任意
输入。approved tag 必须是 annotated tag，tag object id、commit 与 source bundle 一并绑定；SR3/SR4 identity 从上游常量导入，
避免 fixture 与 live source gate 漂移。

测试覆盖 exact tuple、bound source/boundary/authorization/budget、source/tag-object/bundle drift、旧 lineage/formal path
drift、data-boundary drift、authorization drift、budget expansion、hostile accessor、deep-freeze、CLI extra-argument
rejection、run/reservation/bound capability single-use，以及“当前没有 approved tag 时真实 source gate 保持关闭”。

## 4. 当前没有发生的事情

- Provider calls：`0`
- credential reads：`0`
- formal SR5 marker/journal/report/artifact/recovery claim：`0`
- Docker/API/browser/Trace/BackgroundJob/Outbox/业务写入：`0`
- DeepSeek/Qwen 数据边界接受：本阶段只实现合同，未把任何新用户话语当作本次运行授权
- controlled-Live：`0`

因此本回执不形成模型语义、召回、FinalResponse grounded quality、P95/SLA、计费、产品或 `main` authority。

## 5. 下一停止门

1. 完成本阶段代码/文档提交并推送；从最新 `main` 合并后做一次合并后二次 zero-provider 回归并推送 `origin/main`。
2. 在**新的、已推送 source/tag** 上重新接受当次 DeepSeek/Qwen 数据保留/训练边界，并给出绑定该 source commit/bundle 的
   exact authorization。
3. 先做独立 SR5 runner/durability admission；通过后才允许唯一一次 controlled-Live。任何成功、schema、transport、
   usage、timeout、abort 或 I/O 终态都必须 durable seal，且不得 retry/resume/replay/backfill/recovery 或追加单 case
   Provider 探测。
4. SR5 即使 semantic gate 通过，也只形成分支 semantic authority；后续仍需独立 SR6 Docker/API/可见浏览器/Trace 验收。

禁止清理 Docker、数据库、Redis、MinIO；禁止修改历史 P1 L2/T3/R5/L3/Phase 6.9.7 SR5 sealed evidence。

## 6. 回顾问题

- 为什么 SR4 的 synthetic capability 不能直接升级为 SR5 的 Git-verified capability？
- 为什么 authorization 必须同时绑定 commit 与 source bundle，而不是只检查一条 tag 名称？
- 为什么 admission record 只保存 confirmation hash，不能把用户边界原文写进 evidence？
- 为什么当前阶段即使校验了 exact authorization schema，也仍然 `providerDispatchAllowed=false`？
- 如果创建 approved tag 后工作树出现 marker 或未跟踪临时文件，哪一层必须先 fail-closed？
