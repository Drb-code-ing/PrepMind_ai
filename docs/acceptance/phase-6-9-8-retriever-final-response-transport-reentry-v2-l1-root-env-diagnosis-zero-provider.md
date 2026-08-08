# Phase 6.9.8 Transport Re-entry V2 L1 root `.env` admission 诊断与兼容修复

> 历史 Live 前 checkpoint：本文件记录的 `unknown_key` 是修复前 configuration-only 入口诊断；修复后唯一
> controlled-Live 已在新 source 上成功封存，当前终态见
> `phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-controlled-live-sealed.md`。

> 日期：2026-08-08  
> Branch：`drb/phase-6-9-8-retriever-final-response-contract`  
> Source commit（诊断时）：`c278d8c7686d2b321af95eff365d35478321c0b0`  
> Lineage：`phase-6.9.8-retriever-final-response-transport-reentry-v2`

## 1. 诊断结论

在 L1 implementation checkpoint 完成后，唯一受控入口曾按用户给出的 exact authorization 进入一次
preflight。进程在 **root `.env` credential composition** 阶段返回：

```text
code=credential_configuration_invalid
parser reason=unknown_key
```

这是配置入口的可复现问题，不是 Provider、DNS、TLS、代理、账号、余额、模型权限或服务端故障。根 `.env` 是整个
PrepMind 的共享开发配置，包含正常的数据库、Redis、MinIO、OAuth、RAG、Chat 等项目字段（共 24 个非注释赋值）；
其中 DeepSeek 使用规范 `DEEPSEEK_API_KEY`，Qwen 使用项目既有宿主兼容别名 `Qwen_API_KEY`。原实现把共享文件交给
“只允许两个规范字段”的 synthetic strict parser，因此在遇到普通项目字段时先以 `unknown_key` fail-closed，尚未
走到别名归一化。

## 2. 安全与一次性边界

- 该尝试没有创建 V2 marker、journal、report、artifact 或 recovery claim；一次性 marker 未消费；
- `providerCalls=0`、`credentialReads=0`、verified usage/cost/semantic/P95 均不存在；没有 Docker/API/browser、Trace、
  BackgroundJob、Outbox 或业务写入；
- 诊断只记录失败分类、字段类别和计数，不记录 root `.env` 原文、任何 key/value、raw error 或用户数据；
- 旧 T3/R5/Task 9C 的 sealed bytes、marker、authorization、SHA 和 authority 不读取、不改写、不复用；本次不是旧
  T3 retry/resume/replay/backfill。

## 3. 修复 contract（zero-provider）

修复将两个边界明确分开：

1. `parsePhase698TransportReentryV2DotEnv()` 继续作为 strict synthetic/credential-object contract；unknown、duplicate、
   empty、interpolation、multiline、非 ASCII、accessor 和 extra-field 仍然 fail-closed，C1 历史验收不变。
2. 生产 root launcher 改用 selective root parser：只从 launcher 定位的根 `.env` 提取
   `DEEPSEEK_API_KEY`、`QWEN_API_KEY`、宿主兼容 `Qwen_API_KEY` 或 `DASHSCOPE_API_KEY`；其它项目配置字段被忽略且不
   进入 projection/runtime/report/journal/artifact。
3. `Qwen_API_KEY`/`DASHSCOPE_API_KEY` 只归一化为 canonical `QWEN_API_KEY`；同一文件出现多个 Qwen 名称时以
   `alias_conflict` fail-closed，重复 DeepSeek 以 `duplicate_key` fail-closed；目标值仍使用原有有界 ASCII/无插值/无
   反斜杠/单行规则。
4. 解析、data-boundary、authorization、dedicated capability、marker/reservation 与 Provider slot 顺序不变；raw
   credential 仍只留在模块私有 WeakMap 内。

## 4. Zero-provider 回归

新增 C1 fixture 覆盖共享项目字段、`Qwen_API_KEY` 归一化、Qwen alias 冲突、重复 DeepSeek、空值、缺失和插值；strict
synthetic parser 的 hostile unknown-field 断言继续通过。修复后的真实根 `.env` 只做脱敏 parser diagnosis，输出的唯一
状态为 `ok=true / keys=[DEEPSEEK_API_KEY,QWEN_API_KEY]`，不回显值。

## 5. 下一停止门

本文件本身不是 controlled-Live 证据，也不形成 transport/semantic/product/main authority。修复提交并推送后，必须重新验证
当前 source 的 clean/parity、fresh proxy preflight，再次接受当次 DeepSeek/Qwen 数据边界并给出新的两条 exact
authorization；不得复用本次 configuration-blocked 尝试继续 dispatch。获得新授权前不得调用 Provider、启动产品
Docker/API/browser 或进入 `main`。

> 以上是本诊断发生时的历史停止门；唯一 L1 run `ce0c3257-a5d9-4389-90ec-814d5e9cde34` 已随后 durable seal，
> 不得据此重新申请或重跑任何 Provider。
