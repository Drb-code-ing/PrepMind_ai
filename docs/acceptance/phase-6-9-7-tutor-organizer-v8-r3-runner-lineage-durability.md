# Phase 6.9.7 Tutor / WrongQuestionOrganizer V8 R3 Runner / Lineage / Durability 验收

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论

V8 R3 已完成，结论限定为 **zero-provider runner/lineage/durability checkpoint**。

R3 把 R1/R2 的 fixed-shape Organizer candidate 与 bounded diagnostic 接入独立 V8 report、paired runner、
CLI、一次性授权、marker、hash-chain journal、hard-link evidence、crash-only recovery 和 validator。固定
`72 cases / 24 guard / 48 runtime / 24 pair / 32 Organizer decisions`、guard-first、pair 串行、pair 内最多
双 lane、single dispatch、no retry 与首 runtime contract failure breaker 均已进入可执行合同。

本 checkpoint 没有执行正式 Mock，更没有调用 Provider。它证明 V8 的评测与证据工程可以安全承载后续
R4/R5，不证明真实模型质量、Provider 延迟/usage/费用或产品可用性。下一步仅 R4 reviewed Mock/full
checkpoint；R5 controlled-Live 尚未授权，R6 Docker/API/可见浏览器与 R7 main 继续阻断。

## 2. 这次明确并解决的问题

### 2.1 V7 失败与 V8 schema remediation

V7 sealed evidence 只能证明 Organizer response 已通过 JSON parse，随后在
`provider_type_validation` 失败；脱敏 evidence 没有 raw output 或 Zod issues，因此不能诚实恢复具体字段，
也不能把失败唯一归因 credential、网络、HTTP、SDK、模型或 Provider 内部行为。

可证的工程缺口是：`response_format=json_object` 只保证 JSON，不执行本地 Zod；旧 Organizer contract
又是 strict nested conditional union，理想 Mock responder 没有覆盖常见 Provider shape drift。R1/R2 已用
固定四字段 ordinal contract、原生 JSON policy、dynamic local authority 与 Provider-like 负例解决该覆盖
缺口。R3 没有放宽 schema，也没有重跑或改写 V7。

### 2.2 R3 synthetic runner 的误熔断

R3 初始 synthetic Organizer fixture 没有返回 `boundedSchemaDiagnostic`，首 pair 因此被新 V8 report
合同安全拒绝。修复不是放宽 validator，而是补齐 fixture/report 投影，并明确以下强制边界：

- Organizer runtime 在 `fallback_schema_invalid + structured_output/provider_type_validation` 时必须有
  static bounded diagnostic；
- Organizer runtime 在 `fallback_schema_invalid + dynamic_contract` 时必须有 dynamic diagnostic；
- guard、未启动、成功、Tutor、纯 transport/abort/orphan failure 不伪造字段级 diagnostic；
- diagnostic 仍只含固定 reason、计数、shape hash 与 `rawDataRetained=false`。

### 2.3 完成态 recovery 的未调度项误分类

R3 审查发现一个真实 durability 缺口：journal 已经持久化 `run_completed` 与 breaker 时，旧 rebuild
路径仍把后续未 dispatch runtime 重建为 `not_started_orphaned`。这会把“按合同停止”误写成“进程崩溃”。

V8 recovery 现在按持久化终态派生：

- `guard_failed` -> `not_started_case_guard`；
- `quality_gate_impossible` -> `not_started_quality_breaker`；
- 只有尚未完成的 crash/orphan seal -> `not_started_orphaned`。

V1--V7 历史实现和 evidence 没有修改。测试同时证明 bounded diagnostic 的 reason、fingerprint、计数和
`rawDataRetained` 从 report 进入 journal/evidence/recovery，任一漂移都会被拒绝。

## 3. V8 identity 与复用边界

V8 独立 identity：

- runner：`phase-6.9.7-tutor-organizer-runner-v8`；
- runtime evidence：`phase-6.9.7-v8-runtime-evidence-v1`；
- marker：`phase-6.9.7-v8-live-marker-v1`；
- journal：`phase-6.9.7-v8-journal-v1`；
- evidence：`phase-6.9.7-v8-evidence-envelope-v1`；
- recovery claim：`phase-6.9.7-v8-recovery-claim-v1`；
- source manifest：`phase-6.9.7-v8-source-manifest-v1`；
- evidence prefix：`phase-6-9-7-tutor-organizer-v8`。

Source manifest SHA：
`sha256:3ccba6d4d258a4f7356ad448ee2a12ab16d6afd27093063a84b739a09cb2ff52`。

Eval policy SHA：
`sha256:5907133cc86d2cfb2eb811ee62a944435153f19111b49cc6c219d9cb9db07e9d`。

Bounded diagnostic contract SHA：
`sha256:f0301fafcb5fad743957f78fb8b1b996d154b4923cd788e5295d820d0172e681`。

V8 改的是 Organizer schema/diagnostic，不是 HTTP transport。底层因此显式复用 V7 已冻结的 8-stage
wire protocol、capability 与 failure taxonomy；V8 只独立版本化 report/runtime/artifact lineage。这样既不
伪造不存在的 V8 `@repo/ai` export，也能让 source manifest 明确记录复用关系。V1--V7 的
runner/runtime/marker/journal/evidence/recovery token 在 V8 artifact 任意层出现都会被拒绝，旧 validator 也
拒绝 V8 report。

## 4. Runner 与质量门

- 先完整执行 24 条 guard；任一 guard 失败时 48 条 runtime 不 dispatch；
- runtime 按 24 个 pair 串行推进，同 pair 的 Tutor/Organizer lane 各有独立 abort、预算与故障归属；
- 每个 lane 最多一次 dispatch，没有 retry/resume/replay/backfill；
- 首个 runtime contract failure 收口当前 pair 后打开 `quality_gate_impossible`，其余 case 保留在固定 48
  分母；
- success lane 必须完成 V7 8-stage wire 前缀，并有 verified usage；
- 任一 runtime 不完整时，正式 semantic、P95、token、CNY 全为 `null`；
- Mock provenance 永远不能成为 Live quality authority。

R3 默认 Mock CLI 在没有显式 reviewed harness 时返回 `runtime_factory_unavailable`，且不会创建
marker/journal/evidence。只有测试在临时目录显式注入 synthetic harness，才能验证工程合同；R4 才负责接入
reviewed Mock factory 与 fresh Mock evidence。

## 5. Evidence、敏感字段与 crash-only recovery

- marker 使用 exclusive-create；dispatch intent 必须先写入并 fsync hash-chain journal，再允许 executor；
- evidence 使用随机 temp、fsync 与 hard-link final，same bytes 可幂等确认，不同 bytes/path 冲突
  fail-closed；
- recovery 对活 owner 返回 `live_attempt_in_progress`，dead owner 只能由单一 recovery claim 接管；
- recovery 只根据持久化 journal 生成固定分母 failure evidence，不创建 executor，不读取 credential，不
  resume/replay/retry；
- marker/journal/evidence/recovery 的 runId、SHA、tail、claim ownership 或 derived aggregate 漂移均拒绝；
- 通用敏感 evidence scanner 只对白名单安全字段 `organizerPromptSha256` 与
  `rawDataRetained=false` 放行；prompt、response、raw error/body/header、URL、credential、cookie、真实
  owner/question/deck ID 仍禁止进入 evidence。

## 6. 验证证据

R3 runner/lineage/durability/CLI：

```text
phase-6-9-tutor-organizer-v8-runner-contract.test.ts
phase-6-9-tutor-organizer-v8-durability.test.ts
phase-6-9-tutor-organizer-v8-cli.test.ts
phase-6-9-tutor-organizer-v8-lineage.test.ts
24 pass / 0 fail / 215 assertions
```

V8 R1--R3 focused：`46/46`，`888` assertions。

全量与静态门：

- Agent：`902/902`，`12822` assertions；
- AI：`226/226`，`1459` assertions；
- Agent/AI typecheck、lint：通过；
- 受影响 TypeScript/JSON/Markdown Prettier：通过；
- `git diff --check`：通过。

历史不可变证据按 V1--V7 canonical evidence 路径只读复验：七版均
`ok=true / filesChecked=1`。没有执行 seal/recovery 命令，也没有修改历史 artifact。

正式 V8 artifact 精确检查：

- `.tmp/*phase-6-9-7-tutor-organizer-v8*`：0；
- `docs/acceptance/evidence/**/*phase-6-9-7-tutor-organizer-v8*`：0。

两路独立只读审查覆盖 contract/lineage/durability 与 docs/gate；提出的 synthetic request、diagnostic
强制、默认 Mock factory、V7 wire 复用、path identity/sensitive-field 误判和 breaker-aware recovery 问题均已
在提交前修复，无未关闭 Critical/Important。

## 7. 明确未发生与下一步

本任务未读取根 `.env`/credential，未调用 Provider，未执行正式 V8 Mock/Live，未启动 Docker/API/
浏览器，未创建正式 V8 marker/journal/evidence/recovery claim，未修改 V1--V7 artifact/SHA，未执行
seal/recovery，未修改 PostgreSQL/Redis/MinIO/业务数据，也未合并 main。

下一原子任务仅 V8 R4：接入 reviewed Mock factory，运行 fresh baseline/Mock、fault matrix、Agent/AI/
Types/Server/Web 全量、Organizer PostgreSQL concurrency、Compose default-off 与两路独立复审；Mock
evidence 完成校验后精确删除，V8 Live artifact 必须继续为 0。R4 clean/committed/pushed 前不得申请 R5；
普通“继续”不构成 R5 controlled-Live 授权。

回顾时可以问：

- 为什么 V8 schema 变更仍复用 V7 wire protocol，却必须使用独立 report/artifact lineage？
- 为什么 schema/dynamic contract failure 必须有 diagnostic，而 transport failure 必须保持 `null`？
- 为什么 journal 已经完成时，未 dispatch case 不能标为 orphan？
- 为什么 synthetic recovery 测试不等于执行正式 seal/recovery？
- 为什么 R3 artifact=0 仍是通过条件，而不是“缺少验收证据”？
