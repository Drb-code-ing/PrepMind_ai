# Phase 6.9.7 Architecture Recovery Provider Canary V2 L1 验收

日期：2026-07-30

状态（L1 封存时）：唯一 L1 controlled-Live 已成功封存；authority 仅为
`diagnostic_only / qualityAuthority=none`，当时下一步停在 P1 zero-provider 设计门

后续状态（2026-07-31）：P1 zero-provider 小样本语义门设计已完成，未调用 Provider；当前下一任务仅 G1
zero-provider contract/baseline。该补注不改写本页 L1 run、artifact 或 authority。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

Source commit：`8d463e8cb5c9210ad5f9e140e00cba6743a9672a`

Run ID：`dc09214c-0300-4153-8273-e548ac768d20`

## 1. 授权与执行边界

用户在本次运行前重新接受了运行当时 DeepSeek 当前账号的数据保留/训练边界，并给出冻结的 exact
confirmation。执行前 fresh zero-provider preflight 为：

```text
loopback_proxy_ready / configured=4 / probe=1 / providerCalls=0
```

Source reader 同时确认固定分支、tracked clean、`HEAD == upstream == remote`、正式 V2 artifact 为 `0`、R3
bundle `ok=true` 且三份 SHA 保持不变。专用 approval/credential 只映射到本次授权进程，没有写回 `.env`、
命令行、日志、marker、journal 或 artifact。

第一次启动器命令在进入 Bun 前因 Bash 引号解析失败而退出；随后立即确认正式 V2 文件仍为 `0`，因此它没有
读取 credential、创建 marker 或调用 Provider，不构成 L1 attempt。之后使用不含密钥的临时启动器执行正式
public CLI；启动器在进程退出后已删除。

## 2. 唯一 controlled-Live 结果

固定请求保持 fact-free：DeepSeek V4 Pro non-thinking、JSON object、5000ms、no tools、no retry，预算为
`1 call / 512 input / 16 output / 0.00200000 CNY`。

正式结果：

```text
outcome: complete
authority: controlled_live
status: diagnostic_only
qualityAuthority: none
providerHealth: strict_response_with_verified_usage
responseObserved: true
strictResponseObserved: true
wire executor/dispatch/response/usage: 1/1/1/1
usage input/output: 49/5
estimatedCostCny: 0.00017700
withinHardCap: true
attemptDisposition: response_observed
```

该结果证明这一次 fact-free 请求在当时分支、凭据与网络路径下获得 strict response、verified usage 和完整
evidence。它不是 TutorAgent / WrongQuestionOrganizerAgent 的语义质量结果，也不证明 Provider 长期健康、
DNS/TLS/代理历史根因、账号 SLA、RAG、业务写入或产品可用。

## 3. Durability 与验证

Marker 创建后一次性名额已消费。Journal 共 `12` 条记录：

```text
attempt_reserved
executor_entered
request_validated
provider_dispatch_started
provider_response_received
response_audit_passed
content_parsed
schema_validated
usage_validated
runtime_terminal
publication_started
evidence_published
```

Terminal sequence 为 `10`，completion/publication 均为 `runtime`，无 recovery claim。Strict bundle validator
结果为：

```text
ok=true
evidenceCount=1
journalRecords=12
finalJournalEvent=evidence_published
outcome=complete
providerHealth=strict_response_with_verified_usage
```

物理 SHA-256：

```text
V2 marker:   c3e5ac9486ac7c530aa9e64f5612184c9d2fe935890ea5428fac9e23d4b287e5
V2 journal:  c19abf46cb9a7b0faa334684d929e9795c81ecdd0b02c2712a337d5a72b903d7
V2 artifact: 98368de16429923dafe99d8f60affdf74880adbfea59c78c5f66d7f1eec8a7e4
```

R3 validator 复核仍为 `ok=true`，历史物理 SHA 保持：

```text
R3 marker:   6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a
R3 journal:  426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b
R3 artifact: 56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4
```

Artifact 和 journal 只保留固定 enum、boolean、counter、verified usage/cost 与 SHA 关联；没有 prompt、response
body、credential、URL、header、socket peer、raw error 或 stack。

## 4. 停止门与下一步

L1 已消费并成功封存，禁止 retry/resume/replay/backfill、第二次 Provider canary、crash seal、删除或改写
marker/journal/artifact。该结果只解锁 P1：以 zero-provider 方式设计并审查新的小样本 Tutor/Organizer semantic
gate，冻结独立 dataset、预算、质量门、lineage 和未来再次授权条件。

当前仍禁止：

- 直接运行小样本或 48-case semantic eval；
- 启动产品 Docker/API/可见浏览器验收；
- 合并 main 或进入 Phase 6.9.8/6.10/8/9；
- 把 L1 health canary 写成 Agent、RAG、写隔离或产品 production authority；
- 改写 V1--V9、R3 或本次 V2 sealed evidence。

回顾时可以问：

- 为什么 `1/1/1/1` 只能证明这一次 Provider health canary，而不是 Agent 语义通过？
- 为什么 strict response 与 verified usage 仍保持 `qualityAuthority=none`？
- 为什么一次性 L1 成功后也不能直接运行 48-case 或产品验收？
- P1 小样本 semantic gate 应如何重新冻结 dataset、预算、quality gate 与授权边界？
