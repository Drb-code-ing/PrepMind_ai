# Phase 6.9.8 Retriever / FinalResponse SR5 production proxy port recovery（zero-provider）

日期：2026-08-11  
分支：`drb/phase-6-9-8-sr5-proxy-port-recovery`  
范围：修复正式 SR5 Live CLI 丢弃 production `runProxyPreflight` port 的确定性组装缺陷；本文不是 controlled-Live、真实模型质量或产品可用性结果。

本分支的新 source contract 预留待创建的 immutable tag identity
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v2-approved`；历史 `live-v1` tag 保留为不可变的上一份
zero-provider source checkpoint，不能移动、覆盖或复用。该 v2 Git tag 当前尚未创建；此处只声明将由最终 parity commit
占用的 contract identity。

## 结论

上一轮唯一入口在 proxy 前门返回 `proxy_preflight_not_ready`，但独立 preflight 已返回
`loopback_proxy_ready`。只读追踪确认这不是代理 listener、Bun dotenv、cwd、账号或 Provider 问题：

1. `packages/agent/scripts/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-cli.ts` 将生产
   `runProxyPreflight` 注入 `PRODUCTION_PORTS`。
2. `packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-cli-core.ts`
   的 `createPorts` 却无条件安装 `PROXY_PREFLIGHT_PORT_NOT_BOUND` 抛错桩，丢弃了 override。
3. 调用点把该异常统一收口为 `proxy_preflight_not_ready`，因此永远不会进入 credential、reservation 或 runner。

修复将 port 组装改为：

```text
overrides?.runProxyPreflight ?? default fail-closed stub
```

生产 wrapper 现在真正使用共享 proxy preflight；没有 override 的测试/非生产路径仍保持 fail-closed。

独立复审还发现 v2 source schema 已升级、但 production observation 曾残留手写 `source-v1`，会让未来真实 Git admission
恒定返回 `source_admission_invalid`。现已改为共享 `LIVE_SOURCE_SCHEMA_VERSION`，并抽取 production 与测试共用的
observation validator；新增 production-shaped v2 observation 回归，确认 branch/tag/schema 都进入同一生产解析路径。

## 零 Provider 验收

新增回归测试注入 `loopback_proxy_ready`，断言 preflight 被调用一次、随后只到达 synthetic credential
projection，并确认不会 reservation、创建 harness、runner、读取真实 credential 或写 formal evidence。
原有 not-ready 测试继续断言 credential gate 之前停止。

```text
SR5 Live focused：16/16 tests，63 expect() calls
SR5 + Task 9B boundary：54/54 tests，191 expect() calls
Agent full：1529/1529 tests，25224 expect() calls，196 files
Agent typecheck：通过
Agent lint：通过
git diff --check：通过
providerCalls：0
credentialReads：0
formalEvidence：0
businessWrites：0
```

本分支 tag/source contract 的当前摘要（最终 parity commit 合并后仍需重新计算 Git-tree bundle）：

```text
approved tag：phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v2-approved
source manifest：sha256:61afe007f588c62833a10d6c66934bcd90bd3061f4005d1b66e943088afa2829
live manifest：372abb4656885536a080cccc98226d41bce083a0fafc6ab54b104eed81df67a4
live policy：e979f30c6979e1e4ff17a439f77820ff4ded5882189d58ba753fa02b9e6f74b1
```

复现/验证命令：

```powershell
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live.test.ts
bun test packages/agent/tests
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
```

本次没有读取根 `.env`、调用 DeepSeek/Qwen、创建 marker/journal/report/artifact、写 Trace/BackgroundJob/Outbox，
也没有启动、清空或重建 Docker/PostgreSQL/Redis/MinIO/API/browser。

## 一次性边界与后续顺序

源码已经改变，历史 SR5 `live-v1` tag 与此前授权不可复用；上一轮 proxy fail-closed 没有消费一次性名额，当前
formal namespace 仍为 `0`。必须按以下顺序收口：

1. 提交并推送本分支。
2. 从本分支以 `--no-ff` 合并 `main`，推送 `origin/main`。
3. 在 `main` 做合并后二次 zero-provider 回归，并确认 `main == origin/main`。
4. 在最终 parity commit 创建并推送 annotated tag
   `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v2-approved`，核对 tag object、peeled commit 与 source bundle。
5. 用户针对新的 tag/source 重新接受 DeepSeek/Qwen 数据边界，并发送绑定该 source 的两行 exact authorization。
6. 仅执行一次新的 controlled-Live；成功或失败均 durable seal，禁止 retry/replay/curl/单 case/追加 Provider 探测。

controlled-Live 通过语义门后，才进入独立 SR6 产品验收：在另行授权后启动现有 Docker 服务，验证真实 `/api/chat`、
Trace/usage/cost、错误回退、权限隔离，并打开可见浏览器验收 Web/PWA；保留浏览器窗口和精确本轮数据清理证据。
截至本文，Docker/API/浏览器产品验收尚未执行，因此不能宣称产品链路已可用。
