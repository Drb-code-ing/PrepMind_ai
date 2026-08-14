# Phase 6.9.8 SR5 v10 schema/adapter postmortem（zero-provider）

## 结论

本任务在不读取 `.env`、credential、Provider 原文且不调用 DeepSeek/Qwen 的边界内，完成了 v10 DeepSeek candidate
`schema_invalid` 的源码级事后分析与诊断修复。authority 固定为
`zero_provider_sr5_v10_schema_adapter_postmortem`，`qualityAuthority=none`。

能够确认的事实：

1. 第一方 DeepSeek direct adapter 在 fetch 返回合法 `Response` 后，先记录 `provider_response_received`，再执行 response
   audit、JSON parse、object/type schema 与 usage validation。
2. Retriever candidate/runtime 已保留 bounded `providerFailureCategory`、`structuredOutputStage`；结构化阶段只有
   `provider_json_parse`、`provider_type_validation`、`provider_object_missing`，不含原始内容。
3. v10 运行时的 `runRewriteModel` 将 candidate disposition、trace、usage 和 V7 wire snapshot 的所有失败统一压缩为
   `Phase698Task9RuntimeError('schema_invalid')`，细分类别未进入 SR5 终态。
4. Task9/SR5 旧外层 wire 只在 `invokeCall` 成功返回类型化结果后记录 `response_received`。因此 v10 evidence 中 DeepSeek
   wire=`1/1/0/0` 表示“类型化调用未返回”，不能证明 HTTP response 没有到达 adapter。

因此，封存证据无法再区分 v10 的实际根因究竟是 JSON parse、object missing、type validation、response audit、usage
validation，还是其他在旧边界中被压缩的失败。不得读取、重构或补写 Provider 原文来反向归因。

## 修复

- `Phase698Task9RuntimeError` 新增 bounded diagnostic，只允许 V7 adapter failure enum、structured-output stage 与 0/1 wire
  prefix；不接受 raw error、response body、字段名、字段值或 prompt。
- DeepSeek rewrite failure 现在按固定映射收口：response audit/invalid response -> `response_invalid`；三类 structured
  output -> `schema_invalid`；usage validation -> `usage_invalid`；HTTP/transport/abort/timeout 保留各自类别。
- Task9 与 SR5 runner 在 typed call 抛错时读取 bounded adapter wire；若内层已经观察到 Provider response，则先追加
  durability `response_received` journal stage，再生成失败终态。报告与 hash-chain journal 现在可由同一 prefix 重算。
- Call entry 允许可选的 `adapterFailureCategory` 与 `structuredOutputStage`。历史报告不含这两个字段仍可验证；新失败只有
  category/stage 一致时才能通过 strict schema。
- `verifiedUsage` 仍表示 Task9 成功返回后验证的 usage，不会因为 adapter 内层曾经过 usage stage 而伪造成功样本。

## 回归

专门回归：

```text
38 pass / 0 fail / 128 expect()
```

覆盖：

- JSON parse、type validation、object missing、response audit、usage validation 的固定映射；
- 抛错后 outer response wire=`1`，但 verified usage=`0`；
- SR5 journal 先追加 `response_received` 后再写 terminal，bundle 可严格重算；
- diagnostic 不含 Provider content；
- 旧的 raw throw、invalid returned shape、timeout 与 lifecycle I/O 边界保持不变。

Agent 全量：

```text
1661 pass / 0 fail / 25496 expect() / 203 files
typecheck passed
lint passed
Prettier passed
git diff --check passed
```

## 边界

本任务 Provider calls=`0`、credential reads=`0`、formal evidence writes=`0`、business writes=`0`。没有读取根 `.env`，
没有启动或清理 Docker、PostgreSQL、Redis、MinIO、API 或浏览器，没有写 Trace、BackgroundJob 或 Outbox，也没有修改
v10 marker、journal、report、artifact 或 recovery claim。

v10 run `da94b83b-3638-4e23-aefc-9e3423bf4c77` 继续永久封存，禁止 retry/resume/replay/backfill、recover/seal、curl、
单 case或产品 API 追加 Provider 探测。本 postmortem 不创建新 tag、不接受新授权、不执行 Live，也不形成模型质量、SR6、
产品或 SLA authority。

## 下一步

先完成普通分支提交/推送、`main --no-ff` 合并/推送与 merged-main zero-provider 二次验收。之后再从最新 `main` 独立决定
新的 schema recovery lineage/source/tag；任何 controlled-Live 都必须重新建立 source parity、数据边界与 fresh exact
authorization，不能复用 v10 tag、授权或 evidence。
