# Phase 6.9.8 Retriever / FinalResponse P1 L2 main parity 零 Provider 验收

## 1. 结论

P1 L2 controlled-Live 的失败证据、根 artifact 与相关源码已经从受控分支提交并合并到 `main`；随后 parity 文档又以
独立提交合并，最终 `main` 已推送到远程并完成一次只读、零 Provider 回归。该验收确认的是源码、文档和封存证据的分支一致性与工程回归，
不是把失败的 Live 提升为语义或产品通过。

固定结论：

- production/evidence merge commit：`f4fac048919461c26957c1aed11488fda7e5dbee`；
- parity documentation commit：`6c5831518673ff2bbc95ae1141d6ad9525edc2b4`；
- final documentation merge commit：`613cc7721f02b577e35b595a2b2d47a2d0d91cfd`；
- `HEAD == main == origin/main`：`613cc7721f02b577e35b595a2b2d47a2d0d91cfd`；
- 来源提交：`1f3c0d9b`（`docs(phase-6.9.8): seal P1 L2 controlled-live failure`）；
- 来源分支：`drb/phase-6-9-8-p1-l2-controlled-live`，已推送到 `origin`；
- 封存 run：`ff035203-500f-4744-b33c-3c375ae4c785`；
- 封存 gate：`p1_l2_quality_gate_failed / qualityAuthority=none / semanticGate=none`；
- sealed bundle validator：`ok=true / code=bundle_valid`；
- 本次 parity 回归中的 Provider、credential、Qwen embedding、产品写入：`0 / 0 / 0 / 0`。

因此，当前允许从最新 `main` 开立新的 zero-provider schema-recovery/diagnostic 任务；不允许把它命名为本次 L2
retry，也不允许重跑、recovery、seal、curl、单 case 或追加 Provider 探测。

## 2. 合并与远程证据

收口顺序遵循仓库约定：

1. 在 `drb/phase-6-9-8-p1-l2-controlled-live` 上提交 sealed report、root artifact 与全量文档 parity，得到
   `1f3c0d9b`；
2. 将该分支推送到 `origin/drb/phase-6-9-8-p1-l2-controlled-live`；
3. 从干净的 `main` 使用 `--no-ff` 合并生产/证据分支，生成 `f4fac048` 并推送 `origin/main`；
4. 从该最新 `main` 新开文档 parity 分支，提交 `6c583151` 并再次 `--no-ff` 合并，生成最终文档 merge `613cc772`；
5. 推送 `origin/main`，随后在最终 `main` 执行本文件第 3 节的零 Provider 验收。

合并没有移动、删除或改写受控 Live 的 approved tag、marker、journal、report 或 root artifact。Docker 容器、镜像、
卷、PostgreSQL、Redis、MinIO、BackgroundJob、Outbox 与浏览器业务数据均未被清空或改写。

## 3. main 二次验收

### 3.1 封存 bundle 只读 validator

```text
bun run --cwd packages/agent eval:phase-6-9-8:p1:l2:validate
{"ok":true,"code":"bundle_valid","runId":"ff035203-500f-4744-b33c-3c375ae4c785","providerCalls":2,"credentialReads":2,"gate":"p1_l2_quality_gate_failed"}
```

该命令只读取并重新计算已发布 bundle；输出中的 `providerCalls=2` 是封存 run 的历史计数，不是本次 parity 新增
调用。本次 validator 没有读取 `.env`、credential，也没有网络或产品端口。

### 3.2 工程回归

```text
bun --filter @repo/agent test       1437 pass / 0 fail
bun --filter @repo/agent typecheck pass
bun --filter @repo/agent lint      pass
git diff --check                    pass
```

测试使用仓库内的 deterministic/synthetic seam；它们验证 contract、parser、runner、strict validator、文档引用和
历史 artifact parity，不产生 Provider、Docker/API/browser 或业务写入 authority。

### 3.3 工作树与远程 parity

```text
git status --porcelain        ## 空
git rev-parse HEAD main origin/main  ## 三者均为 613cc772...
git rev-list --left-right --count main...origin/main  ## 0 0
```

approved tag `phase-6.9.8-retriever-final-response-p1-l2-approved` 仍指向原 approved source
`fa50292509d7c3e2e4ad017e7e730fd434a29cde`，没有被移动到文档或合并提交。root artifact SHA
`9b79c4902ff53ada7b144b0c120908cd2945de347dfd3c73c2d47bbbc3aef58b` 与封存验收记录一致。

## 4. 当前能力与停止门

这次 main parity 证明：

- P1 L2 的 source admission、固定 12-candidate runner、首错 breaker、journal/hash-chain、hard-link publication 与
  strict validator 代码已进入 `main`；
- 唯一真实 run 的失败证据在 main 上可复核，`bundle_valid` 与 `p1_l2_quality_gate_failed` 的双层结论保持不变；
- 文档入口（`AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`、`docs/data-flow.md`、
  `docs/ai-behavior-acceptance.md`、`docs/acceptance-checklist.md`、P1 spec/plan/admission/implementation）已指向
  当前失败封存与本 parity 记录。

这次 main parity 不证明：

- P1 Retriever/FinalResponse 的完整真实语义质量、Qwen embedding 质量、P95/SLA、供应商账单或网络根因；
- `/api/chat` 产品链路、Docker/API/可见浏览器、Trace、BackgroundJob、Outbox 或业务写入可用；
- `main` 产品 authority、Phase 6.9.8 完成、Phase 6.10 分层记忆或博客收尾。

## 5. 下一原子任务

如继续推进，必须从本次最新 `main` 新建独立、zero-provider 的 schema-recovery/diagnostic lineage，先补齐
`recovery claim`、owner-dead/abort/crash 边界与严格 schema 诊断，再由独立复审决定是否需要新的数据边界接受和
一次性 controlled-Live。当前 sealed run 的任何 retry/resume/replay/backfill 都禁止。
