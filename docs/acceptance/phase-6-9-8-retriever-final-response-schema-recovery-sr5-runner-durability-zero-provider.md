# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR5 runner/durability 验收

日期：2026-08-10

证据分支：`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner`

基线：`main@42abbbbd`（SR5 admission contract 已合并并推送）

状态：**zero-provider runner/durability 已完成；已以 `--no-ff` 合并到 `main`（merge=`b2b5b9c9`），合并后二次回放通过；controlled-Live 未授权、未执行**

## 1. 这一步解决什么问题

SR5 admission 只证明“未来运行是否有资格开始”。本 checkpoint 把准入能力接到一个可审计的 production-shaped
runner，并把每一个 reservation、dispatch、response、usage、breaker 与 publication 持久化为可重算的 durable
bundle。这样可以在任务并发、进程崩溃、重复恢复、外来文件或 journal 损坏时 fail-closed，而不会把未完成的 lane
当成成功，也不会重放 Provider 调用。

本 checkpoint 仍然是 synthetic reviewed Mock：它验证调度与 durability，不验证 DeepSeek/Qwen 的语义质量。

```text
source-bound admission/reservation capability
  -> 8 zero-call guards
  -> 6 pair-serial rewrite lanes + 6 FinalResponse lanes
  -> reservation/fsync before every dispatch
  -> first-error breaker and suffix accounting
  -> fsynced hash-chain journal
  -> hard-link report/artifact publication
  -> strict recomputing validator / crash-only recovery
```

## 2. 固定身份、分母与预算

| 项目                                   | 固定值                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| lineage                                | `phase-6.9.8-retriever-final-response-schema-recovery-sr5-v1`                  |
| runner authority                       | `zero_provider_retriever_final_response_schema_recovery_sr5_runner_durability` |
| gate                                   | `schema_recovery_mock_quality_not_evidence`                                    |
| qualityAuthority                       | `none`                                                                         |
| guards / rewrite / FinalResponse       | `8 / 6 / 6`                                                                    |
| report entries / candidate invocations | `20 / 12`                                                                      |
| concurrency                            | maximum `1`；pair serial；lane single dispatch                                 |
| budget                                 | input `37,600`；output `8,800`；总成本 `0.176 CNY`                             |
| retry / resume / replay / backfill     | `false / false / false / false`                                                |
| BackgroundJob / Outbox                 | `false / false`                                                                |
| runner manifest SHA                    | `d50e27729d873833fc857efe648ba8a56fda19a4d70212a22aa01dbe02b53ea3`             |
| runner policy SHA                      | `ff05b647a4c00a3943c18c70d02650aad3d4b880209ac35f04e60d1d9e31f803`             |
| admission manifest SHA                 | `sha256:f71bdee19cf4509395566d8bf54d85ad1f37cf867ca2cbf37211b1daef8fa38b`      |

runner 在运行时再次核对 admission budget 与 runner policy，避免上游合同和 runner 分母发生静默漂移。当前 CLI
只创建 `synthetic_test` capability；代码层仍保留 `git_verified` 的 source-bound 接口，但没有 approved tag，也没有
把真实 source capability 暴露给 CLI。

## 3. Durability 与权限边界

- marker 在 `.tmp/` 中独占创建，并绑定 lineage、source bundle、runner manifest/policy SHA、PID/start identity；
- 每条 journal record 都包含递增 sequence、previous hash、record hash，并在写入后 fsync；`attempt_reserved`、
  `lane_reserved` 必须先于对应 dispatch；
- report 与 root artifact 使用 hard link，validator 重新计算 report SHA、artifact SHA、journal hash-chain、wire
  前缀、预算和固定分母；CRLF、symbolic link、foreign basename、外来 formal 文件与不一致 artifact 均 fail-closed；
- 首个 guard/lane 错误打开 breaker，后缀 lane 只写 `not_started_*`，不复制 sibling 结果、不重试、不并发补发；
- crash-only recovery 只补齐可证明的 durable prefix，并写单次 recovery claim；已发布 bundle 的第二次 seal 返回
  `already_published`；recovery 不创建 executor、不会重新调用 Provider；
- runner 只接收 `args + AbortSignal`、opaque capability 与 synthetic harness。它不读取 `.env`、credential、用户正文，
  也没有 BackgroundJob/Outbox 旁路。

正式 namespace 在本次回放中保持空；测试使用 OS 临时目录，退出后精确清理。

## 4. 代码与 CLI

新增：

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-contract.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-cli-core.ts`
- `packages/agent/scripts/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-cli.ts`
- runner、durability、CLI focused tests；`@repo/agent` exports 与 package script

安全 CLI（必须从仓库根执行）如下。第一条只运行临时 reviewed Mock；后两条只对当前 runner bundle 做只读校验或
crash-only publication recovery，不是 Live、seal、replay，也不会访问 Provider：

```powershell
bun run --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr5:runner -- --help
bun run --cwd packages/agent eval:phase-6-9-8:schema-recovery:sr5:runner
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner*.test.ts
```

CLI exact command tokens：

```text
RUN_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_RUNNER_ZERO_PROVIDER_ONCE
VALIDATE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_RUNNER_BUNDLE_ZERO_PROVIDER
RECOVER_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_RUNNER_CRASH_ONLY_ONCE
```

## 5. 验收证据

本轮 focused 回放：`25/25` tests、`82` assertions；contract/source/runner/durability/CLI 全部通过。另行通过：

```text
@repo/agent typecheck                         passed
@repo/agent lint                              passed
CLI --help                                    passed
CLI reviewed-Mock run                         passed
CLI runtime                                   12 reservations / 12 dispatches / 12 responses / 12 verifiedUsage
CLI runtime                                   12 succeeded / 0 failed / 0 notStarted
CLI accounting                                providerCalls=0 / credentialReads=0 / businessWrites=0
CLI evidence                                  temporarySyntheticEvidence=1 / formalEvidence=0（临时 root 已清理）
CLI gate                                      schema_recovery_mock_quality_not_evidence
CLI qualityAuthority                          none
git diff --check                              passed
```

durability tests 还覆盖：tampered journal/artifact 不修复、crash-only prefix、terminal-publication recovery、二次
seal 拒绝、CRLF journal、foreign current-lineage artifact、reservation capability 二次消费。整个 checkpoint 未读取
根 `.env`，未调用 DeepSeek/Qwen，未启动或清理 Docker/PostgreSQL/Redis/MinIO/API/browser，未写 Trace、BackgroundJob、
Outbox 或产品数据。

## 6. 当前停止门与下一步

本次 runner/durability 已完成以下交付收口：

1. 代码、测试、入口文档已在功能提交 `d077bf9d` 提交并推送；
2. 功能分支已从最新 `main` 以 `--no-ff` 合并为 `b2b5b9c9`；
3. 合并后的 `main` 已重新通过 focused `25/25`、typecheck、lint、CLI zero-provider smoke 与 `git diff --check`，
   runtime 仍为 `12/12/12/12` wire、`12/0/0` succeeded/failed/notStarted；
4. 当前停止在新的 source-bound controlled-Live 授权门：必须先重新接受当次 DeepSeek/Qwen 数据保留/训练边界，并给出
   绑定新 source/tag 的 exact authorization。controlled-Live 即使通过，也只形成分支 semantic authority，之后才进入独立
   SR6 Docker/API/可见浏览器/Trace 验收。任何终态均不得 retry/resume/replay/backfill、recovery、curl、单 case 或追加
   Provider 探测。

禁止修改历史 P1 L2/T3/R5/L3/Phase 6.9.7 SR5 sealed evidence；禁止清理 Docker 数据卷、数据库、Redis 或 MinIO。

## 7. 回顾问题

- 为什么 reservation 和 journal 必须在 dispatch 前 durable？如果进程在 response 前退出，哪些字段可以安全恢复？
- 为什么 hard-link 与 report SHA 要同时校验，单独校验其中一个有什么漏洞？
- 为什么 `synthetic_test` runner 通过不等于 DeepSeek/Qwen 质量通过？要开放 `git_verified` 需要哪些新门？
- 为什么第二次 recovery 必须返回 `already_published`，而不是重新生成一份 artifact？
- 为什么后缀 lane 要保留 `not_started_quality_breaker`，不能删除或复制前一条结果？
