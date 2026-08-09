# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR0 Zero-provider 设计验收

日期：2026-08-09

分支：`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr0`

基线：`main@6dbe96e2eb72382ba2c25522e86cbc7e17b2f610`

lineage：`phase-6.9.8-retriever-final-response-schema-recovery-v1`

Authority：`zero_provider_retriever_final_response_schema_recovery_design`

qualityAuthority：`none`

状态：SR0 文档与设计 checkpoint 完成；未实现 parser、candidate wrapper、runner、Mock、Live、产品 wiring 或
正式 evidence。

## 1. 结论

SR0 只读复盘了 P1 L2 的唯一封存结果，并冻结了新的 Retriever schema-recovery/diagnostic 路线。可证事实仍仅为：

- P1 L2 run `ff035203-500f-4744-b33c-3c375ae4c785` 的 gate 是
  `p1_l2_quality_gate_failed / qualityAuthority=none`；
- 8/8 guards zero-call；`rewrite_01` strict 成功，`rewrite_03` 以 bounded `schema / runtime_untrusted` 终止，
  10 条 suffix lane 没有启动；
- 历史 Provider/credential/Qwen calls=`2/2/0`，usage=`343/40`，aggregate verified cost=`null`；
- journal `41` 条并以 `evidence_published` 收口，validator=`ok=true / bundle_valid`，recovery claim=`null`；
- sealed artifact SHA 继续是 `9b79c490...3aef58b`。

这些事实不能恢复 `rewrite_03` 的 JSON shape，不能归因网络/账号/权限/服务端，也不能形成 semantic、P95、成本、产品、
Docker/API/browser、Trace、main 或生产 authority。SR0 不重跑旧 L2，不称为 L2 retry/recovery。

## 2. 本 checkpoint 冻结的设计

### 2.1 独立身份

- 新 lineage：`phase-6.9.8-retriever-final-response-schema-recovery-v1`；
- 新 authority：`zero_provider_retriever_final_response_schema_recovery_design`；
- 新 branch：从 `main@6dbe96e2` 创建的普通 git branch；
- P1 L2、T3、R5、Phase 6.9.7 SR5 的 namespace、tag、marker、journal、report、artifact 和 SHA 不复用。

### 2.2 两层四步合同

- Provider content：瞬时、有界、无 raw retention；
- JSON syntax/envelope：单 native object、duplicate/multiple/trailing/fence/BOM/limit fail-closed；
- rewrite projection：只接受精确 own-data `rewrittenQuery: string`，复制成新的 strict plain object；extension 只在
  有界审计后丢弃并计数，alias/歧义/类型错误拒绝；
- local safety/authority：保留现有 trim、Unicode/control、tool/write、unchanged、protected-term 与 owner/RAG policy
  权限；FinalResponse stream contract 不变。

### 2.3 Diagnostic 合同

固定 `stage/reasonCode/projectionDisposition/topLevelType/rewrittenQueryType/extraFieldCountBucket/
shapeFingerprint/rawDataRetained=false`；fingerprint 只 hash enum/bucket canonical tuple，禁止 raw、key 名、path/value、
prompt、用户内容、credential、URL、stack、oracle。

### 2.4 生产边界

继承 P1 L2 `8 guards + 6 rewrite + 6 FinalResponse / 12 candidate invocations / concurrency=1 /
37_600 input + 8_800 output / 0.176 CNY`。reservation-before-dispatch、首错 breaker、suffix no-dispatch、abort/stale/
owner fence、claim/publication/hash-chain 与 SR3 新 namespace 已冻结；SR0 不创建其中任何正式文件。

## 3. 只读证据与验证命令

### 3.1 已封存 P1 L2 validator（历史 bundle，只读）

```powershell
bun run --cwd packages/agent eval:phase-6-9-8:p1:l2:validate
```

预期/实际边界：`ok=true / bundle_valid / gate=p1_l2_quality_gate_failed`。该命令只重算已发布 bundle，不读 `.env`、
不读新 credential、不调用 Provider、不创建 recovery claim；其 `providerCalls=2` 是历史 run 计数，不能算 SR0 调用，
运行 validator 本身也不计入 SR0 Provider calls。

### 3.2 source parity（文档阶段）

```powershell
git rev-parse --show-toplevel
git rev-parse HEAD main origin/main
git rev-list --left-right --count main...origin/main
git status --short --branch
git diff --check
```

SR0 入口要求 branch clean；合并前后再分别记录 `HEAD == main == origin/main`，不以 ignored `.tmp` 文件推断 evidence=0。

### 3.3 新 namespace 精确零计数

SR0 冻结后才使用以下 exact patterns；历史 P1/T3/R5 文件不得计入：

```powershell
$lineage = 'phase-6-9-8-retriever-final-response-schema-recovery-v1'
Get-ChildItem .tmp -File -Force -ErrorAction Stop |
  Where-Object { $_.Name -eq "$lineage.marker" -or $_.Name -like "$lineage-*.journal.jsonl" -or
    $_.Name -like "$lineage-*.report.json" -or $_.Name -like "$lineage-*.recovery.claim" } |
  Select-Object -ExpandProperty FullName
Get-ChildItem . -File -Force -ErrorAction Stop |
  Where-Object { $_.Name -like "$lineage-*.json" } |
  Select-Object -ExpandProperty FullName
```

任何目录不可读、匹配结果不确定、symlink/non-file 或 unexpected current namespace entry 都是 fail-closed；不能把空
`git status` 当作 formal evidence 证明。

### 3.4 文档质量门

```powershell
bunx prettier --check `
  docs/superpowers/specs/phase-6-9-8-retriever-final-response-schema-recovery-design.md `
  docs/superpowers/plans/phase-6-9-8-retriever-final-response-schema-recovery.md `
  docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr0-zero-provider-design.md
git diff --check
```

本阶段不重复 Agent full、Docker/API/browser 或任何 Live；没有源码变化，历史完成证据只读复核即可。

### 3.5 实际结果

```text
P1 L2 validator: ok=true / code=bundle_valid
runId: ff035203-500f-4744-b33c-3c375ae4c785
historical providerCalls / credentialReads: 2 / 2
gate: p1_l2_quality_gate_failed

HEAD/main/origin/main: 6dbe96e2eb72382ba2c25522e86cbc7e17b2f610 /
  6dbe96e2eb72382ba2c25522e86cbc7e17b2f610 /
  6dbe96e2eb72382ba2c25522e86cbc7e17b2f610
main...origin/main: 0 0
formal_namespace_match_count: 0
git diff --check: pass
new SR0 design/plan/acceptance Prettier check: pass
```

仓库中若对全部历史 Markdown 运行同一 Prettier 版本，已有长行/换行会报告 warning；本提交没有把整仓历史文档重排，
只对三个新增 SR0 文档执行并记录通过。该格式差异不影响 source、runtime 或任何 Provider 边界。

## 4. 验收清单

- [x] P1 L2 sealed facts、不可重跑边界与“不能推断 raw shape”写清楚；
- [x] 新 lineage/branch/authority 与 P1 L2 namespace 完全分离；
- [x] Provider content、envelope、projection、local authority 四步职责和权限固定；
- [x] extension discard 只保留 enum/bucket 计数，不扩大模型权限；alias/duplicate/wrapper/limit fail-closed；
- [x] diagnostic 固定 enum/bucket/hash，`rawDataRetained=false`，无 raw/key/path/value/prompt/credential/oracle；
- [x] 并发、丢失任务、route、owner、abort、breaker、预算、durability 与 Outbox 边界固定；
- [x] PID reuse、signal、claim/event、publication/artifact、foreign temp、二次 recovery 缺口明确交给 SR3；
- [x] SR1--SR7 原子路线、fresh data-boundary/exact authorization 停止门与文档同步清单已记录；
- [x] 未读取 `.env`、未调用 Provider、未启动/清理 Docker/API/browser、未创建 formal evidence、未写产品数据；
- [x] 未修改任何 P1 L2 sealed marker/journal/report/root artifact/tag。

## 5. 形成与未形成的 authority

本页形成：`zero_provider_retriever_final_response_schema_recovery_design`，`qualityAuthority=none`，只解锁 SR1
zero-provider TDD。

本页没有形成：parser 实现、真实模型可用性、Retriever/FinalResponse 语义、Qwen 检索质量、P95/SLA、Provider health、
计费、产品 `/api/chat`、Docker/API/browser、Trace、BackgroundJob/Outbox、业务写入、`main` authority 或博客收尾。

## 6. 回顾时可以问

- P1 L2 为什么只能说“strict contract 未成立”，不能说“模型返回了 extra field”？
- extension discard 如何兼顾容错与权限最小化？
- 为什么 parser、local safety、usage 要分 stage，而不是继续统一成 `schema`？
- SR3 的 recovery claim 为什么必须绑定 journal tail、marker SHA 和进程身份？
- 为什么 SR0 完成后仍不能启动项目做真实模型验收？
