# Phase 6.9.7 Tutor / Organizer Small-sample L2 Controlled-Live 验收

日期：2026-08-01

状态：唯一 L2 已完成并 durable seal；质量门通过

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论

在用户重新接受本次运行时 DeepSeek 当前账号的数据保留/训练边界，并给出冻结 exact authorization 后，
Phase 6.9.7 TutorAgent / WrongQuestionOrganizerAgent 唯一 8-pair Small-sample L2 Controlled-Live 已执行一次：

```text
runId: 6918df4f-a4ae-4de0-aa21-c7614ed5861d
gate: small_sample_quality_gate_passed
authority: controlled_live
qualityAuthority: small_sample_semantic_gate
lineage: phase-6.9.7-tutor-organizer-small-sample-v1
```

该结果证明固定 8-pair 小样本在本次真实 Provider 路径上通过了预先冻结的 strict、语义、提升、费用和安全
门。它不产生 48-case、P95/SLA、产品 Docker/API/browser、生产就绪或 main authority。

## 2. Source 与 admission

L2 只在以下 admission 同时成立后进入 marker/runtime：

- approved runnable source commit、HEAD、upstream 与远程分支均为
  `4c6084455d0cea6b4a5ddd94511bce29c22af1c4`；
- 已推送的轻量 tag
  `refs/tags/phase-6-9-7-tutor-organizer-small-sample-s2-approved` 解析到同一 commit；
- tracked source clean，正式 L2 artifact 数量为 0；
- prompt/schema/merger/adapter source hash 与 source contract 一致；
- fresh proxy preflight 为 `direct_ready / providerCalls=0`；
- 数据边界接受与 exact authorization 在本次运行进程中同时成立；
- 根 `.env` 中既有 DeepSeek credential 只映射到 L2 专用子进程变量，没有打印、写回或进入 CLI、journal、
  artifact 与 Git。

Approved tag 冻结的是实际运行源码，不跟随本次后续文档提交移动；不得重建或移动该 tag。

## 3. 固定质量门结果

| 维度                                                          | 实际结果                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| Guard                                                         | `8/8` actual zero-call                                    |
| Runtime accounting                                            | reserved/terminal/orphan/not-started = `16/16/0/0`        |
| Wire                                                          | executor/dispatch/response/verified usage = `16/16/16/16` |
| Strict runtime                                                | `16/16`                                                   |
| Tutor semantic                                                | `0.9141666666666668`                                      |
| Organizer semantic                                            | `1`                                                       |
| Combined semantic                                             | `0.9570833333333334`                                      |
| Tutor / Organizer improvement                                 | `0.2071428571428573 / 0.7625`                             |
| Invalid / critical / permission / mutation / broader fallback | 全部 `0`                                                  |
| Locked-name changes / write-command leaks                     | `0 / 0`                                                   |
| Usage                                                         | input/output = `7032 / 244`                               |
| 估算费用                                                      | `0.02256 CNY`                                             |
| Breaker                                                       | `opened=false`                                            |

三项 semantic 均达到 `>=0.85`；Tutor/Organizer 相对冻结 subset baseline 的提升均达到 `>=0.15`。Verified
usage、known pricing 与逐 lane 费用完整，实际费用低于 `0.176 CNY` 总 cap。

8-pair 样本仍不产生 P95 authority：

```text
Tutor median/max:    871 / 1429 ms
Organizer median/max: 1352.5 / 1719 ms
Paired median/max:   1352.5 / 1719 ms
P95:                 null / insufficient_sample_size_8
```

这些 median/max 只描述本次小样本，不可外推为产品端到端延迟或 SLA。

## 4. Durability 与独立 validator

正式文件计数固定为：

```text
marker / journal / artifact / recovery claim: 1 / 1 / 1 / 0
journal records: 180
final journal event: evidence_published
completion/publication mode: runtime / runtime
```

Logical report SHA：
`a981e18869c0b3214433d2a23aa0ec5de93bace00afe16982a7c707f7f8feeb8`。

Physical artifact SHA：
`a1b51f059ca534a276a420d7693e5e4465c185dc9de7cf80968d7737ea25eb0d`。

只读复核命令：

```powershell
bun run --cwd packages/agent eval:phase-6-9-7:small-sample:validate
```

复核结果为：

```text
ok=true
runId=6918df4f-a4ae-4de0-aa21-c7614ed5861d
gate=small_sample_quality_gate_passed
qualityAuthority=small_sample_semantic_gate
journalRecords=180
finalJournalEvent=evidence_published
```

该 validator 只读已封存 bundle，不读取 credential、不调用 Provider，也不创建 recovery claim。

## 5. 明确未做与停止门

本次没有：

- retry、resume、replay、backfill、单 case 补跑、curl 或其它追加 Provider 探测；
- 执行 crash-only seal、删除、覆盖、改写 marker/journal/artifact；
- 执行 24-pair/48-case Live；
- 启动产品 Docker/API/Web/可见浏览器，创建测试账号、Trace 或修改 PostgreSQL/Redis/MinIO 业务数据；
- 合并 main、开启产品 gate，或进入 Phase 6.9.8/6.10/8/9 与博客收尾。

L2 名额已经消费，禁止再次执行 `live`、`seal` 或 recovery。其后唯一允许的 P2 已以 zero-provider 方式
完成：基于本 sealed 终态冻结新的 24-pair/48-runtime 全量语义门，但没有执行全量 Live、产品验收或 main。
P2 manifest/baseline authority/eval policy SHA 为
`e68e6e27...12c78 / 2ab1030f...a5f2 / 11371d16...f503`，当前下一任务仅 F1 full
contract/baseline。P2 验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`。

## 6. 回顾问题

- 为什么 `small_sample_quality_gate_passed` 仍不能证明产品可用？
- 为什么 8 个样本只能记录 median/max，不能生成 P95/SLA authority？
- approved tag 为什么必须固定在运行源码 commit，而不能随文档提交移动？
- marker/journal/artifact/recovery 为 `1/1/1/0` 分别证明什么？
- 为什么下一步只能先做 P2 zero-provider full-gate design？
