# Phase 6.9.8 SR5 V12 direct-host recovery（zero-provider）

日期：2026-08-17  
分支：`drb/phase-6-9-8-sr5-v12-direct-host-recovery`  
基线：`main == origin/main == 4b7c663bdd1c87e4c583f3dcfa7c7b146deea018`；功能提交：`4dec1299`；合并提交：`d763f32f`；当前
`main == origin/main == d763f32f`

## 目的

V11 唯一 controlled-Live 入口被 Git Bash login profile 注入的失效 `127.0.0.1:7897` proxy 阻断。no-profile 诊断已证明
同一宿主可以 `direct_ready`，但只在 preflight 参数中隐藏 proxy 会产生新的分裂风险：preflight 可能判定直连，后续真实
`fetch` 却仍继承原进程 proxy。本阶段要让检查与真实 transport 使用同一份 direct-host 环境，并建立不可复用 V11 的 V12
source/tag/authorization/evidence lineage。

## 实现

- 新增独立 V12 contract、source manifest/schema、admission、runner、journal、durability、CLI core、package subpaths 和命令；
  V10/V11 文件与 tag identity 不改写。
- V12 production launcher 的父进程只创建同一 CLI 的子进程。子进程环境保留系统变量和 V12 授权变量，但大小写不敏感地移除
  `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`、`NO_PROXY` 及其大小写变体。
- 子进程使用 `bun --no-env-file`，共享 proxy preflight 从子进程 `process.env` 取快照；后续 Provider transport 也运行在同一
  子进程，因此不会出现 preflight 与真实网络路径不一致。父 shell 与父 `process.env` 不被修改。
- 原有 admission 顺序保持为 authorization -> source -> proxy -> credential -> reservation -> Provider。无 exact argv 或 fresh
  V12 receipt 时仍在 credential 与 Provider 前 fail-closed。

## 验收

- V12 focused：`9/9`，`70 expect()`；覆盖 V10/V11/V12 tag 与 evidence namespace 三向隔离、授权前门、direct-host 子进程
  环境、共享 preflight `direct_ready`、adapter/runner/durability 成功与五类 bounded failure。
- V10/V11/V12 focused 组合：`19/19`，`340 expect()`。
- Agent full：`1680/1680`，`25911 expect()`，`207 files`；AI full：`346/346`，`2667 expect()`，`28 files`。
- Agent/AI typecheck 与 lint 通过；CRLF-aware Prettier 和 `git diff --check` 在提交前复核。
- V12 CLI 无 exact argv 时返回固定 `cli_argument_invalid`，Provider/credential/formal evidence/business writes=`0/0/0/0`。

## 边界

本阶段未读取根 `.env` 或 credential，未调用 DeepSeek/Qwen，未创建 V12 marker/journal/report/artifact/recovery claim，未写
Trace/BackgroundJob/Outbox 或业务数据，未启动、停止、清理 Docker、PostgreSQL、Redis、MinIO、API 或 browser。
`qualityAuthority=none`；本记录不是 controlled-Live、模型语义、产品可用、P95/SLA 或 SR6 authority。

V11 tag object `20e2abfcedd5cbb759694f59cce92cae4ef9fc80`、peeled commit
`c077d6546709c6af2e796ec861e8376355437466`、已使用授权和零证据终态均保持不可变；禁止重跑 V11、移动 tag、复用授权、
curl 或单 case Provider 探测。

## 收口与下一步

V12 功能分支已提交并推送（`4dec1299`），已通过 `--no-ff` 合并并推送 `main`（`d763f32f`），merged-main focused/full/static
parity 已通过：V10/V11/V12 focused `19/19`、Agent `1680/1680`（`25912 expect()`）、AI `346/346`
（`2667 expect()`）、typecheck/lint/diff check 均通过。

下一步是在当前 clean/pushed `main` 创建并推送
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v12-approved` annotated tag，核对 tag object、peeled commit、
local/remote `main` parity 与最终只读 source verifier。完成后再请求 fresh V12 数据边界和 exact authorization；当前不得执行 Provider
调用。Controlled-Live 成功或失败都必须按 V12 独立 namespace durable seal，之后才可评估 SR6 Docker/API/Trace/可见浏览器产品验收。
