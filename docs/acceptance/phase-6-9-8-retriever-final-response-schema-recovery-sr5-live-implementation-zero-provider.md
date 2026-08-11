# Phase 6.9.8 Retriever / FinalResponse SR5 Live implementation（zero-provider）

日期：2026-08-10

> 状态更正（2026-08-11）：本文是 implementation checkpoint。随后 tag compatibility 已完成，但又发现并修复了
> production `runProxyPreflight` override 被 core 端口组装丢弃的确定性缺陷；最新 zero-provider 证据见
> `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-proxy-port-recovery-zero-provider.md`。本文末尾“尚未执行”
> 段落只保留该 checkpoint 时点事实，不代表当前 source/tag 状态。

## 结论

后续首次 controlled-Live 尝试已在 proxy 前门 fail-closed；该故障与零 Provider 修复不改变本文件对“实现完成、尚未形成质量 authority”的结论。
修复与诊断单独记录在
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-proxy-snapshot-fix-zero-provider.md`；后续历史/Live tag 分离见
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-tag-compatibility-zero-provider.md`，避免把实现回归和 Live 结果混为一谈。

SR5 controlled-Live 的初始生产形状实现已以 `--no-ff` 合并到 `main`（历史 merge=`1d0f798d`）。其后的 proxy/tag compatibility
与本页所列边界 hardening 在当前功能分支继续收口；这里记录的是“实现完成、尚未执行 Live”的验收，
不是 Provider 质量结果：本次 providerCalls、credentialReads、formalEvidence、businessWrites 均为 `0`，没有读取真实根
`.env`，没有调用 DeepSeek/Qwen，也没有启动或清理 Docker、
PostgreSQL、Redis、MinIO、API 或浏览器。

## 固定合同

| 项目                                        | 固定值                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| Live lineage                                | `phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v1`        |
| Live authority（仅运行后可出现）            | `controlled_live_retriever_final_response_schema_recovery_sr5`            |
| semantic authority（仅完整 gate pass）      | `schema_recovery_sr5_branch_semantic_gate`                                |
| 分母                                        | 8 guards + 6 rewrite pairs + 6 FinalResponse                              |
| Provider slots                              | DeepSeek 12 + Qwen embedding 12 = 24                                      |
| 最大并发 / 调度                             | 1 / pair-serial / single-dispatch                                         |
| 预算                                        | 37,600 input / 8,800 output / 0.176 CNY                                   |
| 重试/恢复重放                               | retry、resume、replay、backfill 全部为 `false`                            |
| Live approved tag                           | `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v1-approved` |
| Live manifest SHA                           | `bc7e191529735cd0fab2746e995130a9a74da9fb232f754678b539dbc0434d80`        |
| Live policy SHA                             | `e979f30c6979e1e4ff17a439f77820ff4ded5882189d58ba753fa02b9e6f74b1`        |
| Live source manifest SHA                    | `sha256:d1129b3caf414c5561df425f1a2ffdfcde7d29468a568845d1c110908559ccdd` |
| 历史 SR5 admission manifest SHA（保持不变） | `sha256:f71bdee19cf4509395566d8bf54d85ad1f37cf867ca2cbf37211b1daef8fa38b` |

Live source fence 使用独立 Git-object bundle：根 `package.json`、`bun.lock` 与
`packages/agent`、`packages/ai`、`packages/types` 整棵树。这样 proxy preflight、Task9
第一方 adapter、Retriever/FinalResponse 及其传递依赖都被绑定，同时不改写历史 SR5
zero-provider admission manifest。

## 前门与权限顺序

```text
exact argv
  -> data-boundary receipt + exact authorization
  -> Git branch/HEAD/upstream/origin/tag/source bundle parity
  -> current Live formal namespace fence
  -> direct/loopback proxy preflight（只做 127.0.0.1/::1 listener probe）
  -> selective root .env projection（仅 3 个 SR5 credential，bun --no-env-file）
  -> opaque single-use admission/reservation capability
  -> exclusive marker + fsynced hash-chain journal
  -> 8 guards -> pair-serial 24 slots -> local scorer/gate
  -> hard-link artifact -> strict validator / crash-only recovery
```

CLI 的 `--help`、`VALIDATE_...` 和 `RECOVER_...` 路径不会加载 dotenv 或 credential；只有
`RUN` 在所有前门通过后才 late-bind 根 `.env`。credential 值、prompt、Provider 原文不进入
journal/report/artifact；报告只保留受限哈希、计数、schema/usage/质量指标。

## 代码交付

- `...sr5-live-contract.ts`：24-slot manifest、预算、严格 wire/report/schema/semantic gate。
- `...sr5-live-source-manifest.ts`：独立 Live Git-object source binding。
- `...sr5-live-source-schema.ts`：独立 Live tag/ref、strict source/parity/manifest contract。
- `...sr5-live-source-admission.ts`：data-boundary、授权、source drift、historical lineage
  coexistence 与 WeakMap/WeakSet single-use capability。
- `...sr5-live-runner.ts`：guard-first、pair-serial、breaker、timeout/abort、DeepSeek/Qwen
  accounting 与本地质量门。
- `...sr5-live-durability.ts`：exclusive marker、fsync journal、hard-link artifact、严格
  validator、crash-only seal/recovery。
- `...sr5-live-cli-core.ts` / `...sr5-live-cli.ts`：生产入口、proxy-before-credential、
  selective credential projection、Bun accessor 物化与安全输出。
- `...sr5-live-source-admission.ts`：root/`.tmp` canonical-path 与 symlink/junction namespace fence。

## Zero-provider 验收证据

```text
SR5 contract/source/Live focused：26/26 tests，102 assertions
Agent full：1527/1527 tests，25213 expect() calls，196 files
SR5 + Task 9B boundary 组合：52/52 tests，180 expect() calls
Agent typecheck：通过
Agent lint：通过
git diff --check：通过
历史 admission manifest SHA：f71bdee19cf4509395566d8bf54d85ad1f37cf867ca2cbf37211b1daef8fa38b
```

可复现的组合命令（均 zero-provider）：

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-cli.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-contract.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-lineage-cli.test.ts `
  packages/agent/tests/phase-6-9-8-retriever-final-response-task9b-live-config.test.ts
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
```

历史实现组合实际为 `48 pass / 0 fail / 164 expect() calls`；tag compatibility hardening 尚未完成时曾有一轮
`23 pass / 0 fail / 94 expect() calls` 的中间回归（不作为最终验收门）；最终 SR5 contract/source/Live focused 回归为
`26 pass / 0 fail / 102 expect() calls`，SR5 + Task 9B boundary 组合为
`52 pass / 0 fail / 180 expect() calls`；Agent full 为 `1527 pass / 0 fail / 25213 expect() calls`。

覆盖项包括 reviewed Mock 全 24-slot 调度、预取消、argv/data-boundary/proxy 顺序、当前
namespace 临时文件 fence、journal tamper、crash-only prefix/二次 seal、root `.env` 白名单投影、
Qwen alias 冲突、检索/引用指标不足时拒绝 semantic authority，以及历史 manifest 与独立 Live
tree bundle 不相互污染。

## 该 checkpoint 时点尚未执行与下一停止门（历史记录）

以下事项在本验收中刻意保持为 `0`：approved annotated tag、真实 credential read、Provider
dispatch、formal marker/journal/report/artifact、usage/cost、Docker/API/browser/Trace 与产品
数据写入。源码、文档、远程和 `main` parity 稳定后，必须先在最终 parity commit 创建并推送新 annotated tag，再重新接受
该 tag/peeled commit/source bundle 绑定的数据边界并给出两行 exact authorization；随后使用
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v1-approved`，在 clean source + proxy ready 下执行唯一一次
controlled-Live。成功也只产生分支 semantic authority，不自动解锁产品、
`main`、SLA 或博客收尾；失败则 durable seal 后停止，禁止 retry/replay/curl/追加 Provider 探测。

相关历史记录：

- `phase-6-9-8-retriever-final-response-schema-recovery-sr5-admission-zero-provider.md`
- `phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability-zero-provider.md`
- `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-tag-compatibility-zero-provider.md`
