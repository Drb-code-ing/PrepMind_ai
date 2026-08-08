# Phase 6.9.8 Retriever / FinalResponse Architecture Recovery R3 验收

## 1. 结论

R3 已以
`zero_provider_retriever_final_response_architecture_recovery_runner_durability_admission / qualityAuthority=none`
完成独立 report/runner、三模块 observation authority、source admission、durability、strict validator 与
zero-provider maintenance CLI。

本阶段解决的是“怎样让 Rewrite、Qwen Retrieval 与 FinalResponse 的第一方 bounded diagnostic 进入固定分母、
可中断、可重算且不可伪造的 evidence lifecycle”，不是 reviewed Mock、controlled-Live、产品、Docker/API/browser、
Trace 或 main 验收。R3 完成后只解锁 R4 reviewed Mock / static checkpoint。

## 2. 实现范围

R3 新增或补强：

- 独立 lineage `phase-6.9.8-retriever-final-response-architecture-recovery-v1` 的 strict report、scorer 与 gate；
- 固定 `16 guards + 16 rewrite pairs + 16 FinalResponse cases = 64 Provider call slots` 的 guard-first runner；
- runner reservation/dispatch/harness-return/verified-result 与第一方 Provider executor/dispatch/response/usage 的双层
  accounting；
- Rewrite、Qwen 与 FinalResponse 三个模块私有的 opaque、single-use runner observation；
- source bundle、clean/parity/formal-evidence-zero admission 与 admission/reservation 双 capability；
- 在隔离临时 evidence root 验证 exclusive marker、reservation-before-dispatch、fsynced hash-chain diagnostic
  journal；
- 在同一临时 root 验证 exclusive temp + hard-link artifact publication、strict replay/recompute validator 与
  crash-only seal；
- `run_terminal` 后和 `publication_started` 后的 terminal publication recovery；
- 只允许 validate/seal 两个固定 zero-provider maintenance argv 的 CLI。

R3 没有创建正式 approved tag、marker、journal、artifact 或 recovery claim；没有执行正式 R3 validate/seal CLI，
也没有新增 Live/retry/replay/resume/backfill 命令。

## 3. Runner 与双 Wire authority

### 3.1 固定调度

Runner 先执行 16 个 zero-call guard，再串行执行 16 个 rewrite pair：

```text
original Qwen retrieval
  -> DeepSeek rewrite candidate
  -> candidate Qwen retrieval
```

正常全成功路径只有在全部 rewrite pair 成功后才执行 16 个 DeepSeek FinalResponse case。固定分母为 Qwen 32
calls、DeepSeek 32 calls；不并发 sibling，不补跑，不通过完成前缀拼接整份结果。

首个 guard/call failure 会打开对应 breaker：当前 pair 的未开始 sibling 与后续 schedule 全部以明确 not-started
terminal 收口，且 `runnerWire/providerWire/diagnostic/usage/cost/duration` 保持零值或 `null`。不完整分母下：

- rewrite / FinalResponse semantic 为 `null`；
- 五项 P95 为 `null`；
- 两个 Provider 的 aggregate token/CNY 与总费用为 `null`；
- gate 必为 failure，`qualityAuthority=none`。

### 3.2 两层观察不能互相代替

`runnerWire` 记录：

```text
reservations -> dispatches -> harnessReturns -> verifiedResults
```

`providerWire` 记录：

```text
executions -> dispatches -> responses -> verifiedUsage
```

单 call 只有在 runner/provider 两条前缀、bounded diagnostic=`applied`、verified usage/cost 与本地 strict result
同时成立时才成功。Provider 已响应但本地 contract 失败不会冒充 verified result；harness 返回也不能冒充 Provider
response 或 usage。

## 4. 第一方 observation 防伪

复审发现并修复了一个 authority 缺口：早期 R3 草案把共享 observation issuer 作为可导入函数暴露，虽然 WeakMap
能防伪造 token，却不能认证是谁调用了 issuer。

最终实现不再导出共享 issuer：

- Rewrite、Qwen、FinalResponse 各自在模块私有 WeakMap 中签发并保存 observation；
- 共享 observation 模块只校验已经从模块私有 map 取回的 bounded record；
- capability 精确绑定 `callId + phase + family`，并且只能消费一次；
- forged、active、reused、cross-call、cross-family 与 out-of-order capability 全部 fail-closed；
- `createPhase698ArchitectureRecoveryControlledOutcome()` 不能接收调用方自报的 diagnostic 或 Provider wire；
- synthetic outcome 永远是 `synthetic_test`，不能升级为 controlled-Live authority。

## 5. Source admission

Production admission contract 固定校验：

- 当前分支必须是 `drb/phase-6-9-8-retriever-final-response-contract`；
- HEAD、upstream、origin branch 与新 approved ref commit 必须相等；
- working tree clean，正式 Recovery evidence 文件数为 0；
- Task 8 manifest、Task 9 policy/baseline、价格与 endpoint profile、旧 Task 9C run/report/artifact identity 不变；
- 完整 source path bundle SHA 与观察值一致；
- admission/reservation capability 均为 module-owned、opaque、single-use。

R3 测试只使用 `synthetic_fixture` admission。真实 `git_verified` admission 在该 checkpoint 尚未执行，也没有创建
approved tag；该 production contract 当时只为未来 R5 fresh admission 提供 fail-closed 前门。后续 R5 已独立完成
admission 并以失败封存，本文件不授权任何重跑或追加 Provider 探测。

## 6. Durability 与 Crash-only recovery

### 6.1 正常路径

正常路径固定为：

```text
exclusive marker
  -> attempt_reserved
  -> guards
  -> call_reserved (durable before dispatch)
  -> runner/diagnostic stages
  -> call/rewrite/final terminal
  -> run_terminal
  -> publication_started
  -> exclusive temp + hard-link artifact
  -> evidence_published
```

每条 journal record 使用 strict allowlist schema、canonical bytes、`previousHash` 与 `recordHash`。Journal 只含固定
identity/stage/reason/bucket/wire/聚合，不含 request、response、query、prompt、chunk、answer、credential、URL、raw
error、unknown key 或 raw-derived hash。

### 6.2 Recovery 路径

Crash-only seal 只解释当前 durable prefix，不创建 Provider executor、不读取 credential、不执行未开始 call，也不
retry/resume/replay/backfill：

- active call 以 bounded recovery terminal 收口；
- 后续 call 全为 not-started breaker；
- `run_terminal` 已 durable 但 publication 未开始时，只恢复 publication；
- `publication_started` 已 durable、artifact 尚未 link 时，重建同一 canonical artifact 后发布；
- canonical artifact 已存在时，只验证 bytes 并补齐 `evidence_published` journal terminal；
- 正常 published run、active owner、duplicate claim、不同 bytes、path traversal、foreign lineage 与旧 Task 9C namespace
  写入全部拒绝。

Recovery claim 的 `journalTailRecordHash` 必须等于 `recovery_claimed.previousHash`。即使攻击者篡改 tail 后重新计算
所有后续 record hash，claim-tail drift 仍不能通过 validator。

## 7. CLI 与权限边界

公开 R3 CLI 只接受：

```text
VALIDATE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R3_BUNDLE_ZERO_PROVIDER
I_SEAL_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R3_CRASH_ONLY_ONCE
```

CLI argv 不接受 Live、retry、replay、resume、backfill、credential、env、URL、run-id 或文件路径。R3 本阶段没有
执行这两个正式命令；测试只向注入的 zero-provider operation seam 验证 argv/输出合同。

同步 `/api/chat` 流不创建 `BackgroundJob` 或 `Outbox`；R3 也没有修改产品 gate、Compose、`.env`、PostgreSQL、
Redis、MinIO 或业务数据。

## 8. Task 9C 不可变性

R3 只读验证旧 sealed bundle；没有运行 Task 9C CLI/seal/recovery，也没有写入旧 namespace。结果保持：

- run：`28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；
- gate：`task9_quality_gate_failed / qualityAuthority=none`；
- journal：`134 / evidence_published`；
- report logical SHA：`c612d6f7164d5491e54422abb2e8504cbb707aeea3b641e8c57285d957b8b4a4`；
- physical artifact SHA：`7d45329debde6def4c5bc8bbda28609b507a71766ae06e00806e44eaf7b3614c`；
- validator：`ok=true`。

R3 的新阶段机不能反向恢复 Task 9C 的 Provider response、具体字段或 raw，也不能把旧失败归因 transport、账号、
余额、模型权限或服务端。

## 9. Authority 与副作用计数

| 项目                                          |   R3 结果 |
| --------------------------------------------- | --------: |
| External Provider calls                       |       `0` |
| DeepSeek/Qwen network calls                   |     `0/0` |
| Credential reads                              |       `0` |
| Task 9C evidence writes                       |       `0` |
| Recovery formal marker/journal/artifact/claim | `0/0/0/0` |
| Recovery approved tag                         |       `0` |
| Formal R3 validate/seal CLI executions        |     `0/0` |
| Docker/API/browser                            |   `0/0/0` |
| Business/BackgroundJob/Outbox writes          |   `0/0/0` |
| Quality authority                             |    `none` |

测试中的 injected fetch/stream、synthetic runner 和临时 evidence root 都是 `synthetic_test`，不访问外部 Provider，
也不形成正式 evidence 或质量证据。

## 10. 验证结果

| 检查                            | 结果                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R0--R3 focused                  | `39/39`；7 files；455 assertions                                                                                     |
| Agent full                      | `1318/1318`；164 files                                                                                               |
| AI full                         | `345/345`；28 files                                                                                                  |
| Agent typecheck / lint          | 通过 / 通过                                                                                                          |
| Task 9C sealed bundle validator | `ok=true`；run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；journal `134 / evidence_published`；两个 SHA 与封存值完全一致 |
| Prettier / `git diff --check`   | 通过 / 通过                                                                                                          |
| Markdown / stale / secret scan  | `14` 个变更 Markdown 相对链接有效；无当前状态回退；无 secret match；正式 R3 evidence 为 `0`                          |
| 独立 Reader Testing             | 8 个关键问题均可准确回答；未发现坏链接或自相矛盾；已澄清临时 synthetic artifact 与正式 artifact=0 的差异             |
| 独立安全复审                    | 无 blocking finding；记录同机恶意文件系统并发替换不属于 R3 authority 的 residual boundary                            |

以上静态与 Reader Testing 结果只验证当前文档和 zero-provider 工程合同，不提升本阶段 authority。

## 11. 明确未完成

- R4 16-guard/64-call reviewed Mock/static 与 Reader Testing quality checkpoint；
- R5 controlled-Live、R6 产品 Docker/API/可见浏览器/Trace、R7 main；
- Task 10/11、Phase 6.9.8 收口与 Phase 6.9.9/6.9.10/6.10/8/9；
- Qwen/DeepSeek 外部健康、真实语义、P95、verified aggregate token/CNY、产品、SLA 或生产 authority；
- hostile same-user 进程并发替换 `.tmp`/子路径的文件系统 race、跨主机 lease 或 Provider exactly-once authority；
- 《多 Agent 架构》与《记忆系统》面试学习博客收尾。

## 12. 停止边界

- 禁止重跑、resume、replay、backfill、seal 或修改 Task 9C；
- 禁止 curl、单 case、产品 API 或其它 Provider 探测；
- 不读取 `.env`/credential，不创建 approved tag 或正式 Recovery evidence；
- 不启动 Docker/API/browser，不修改产品 gate、业务数据、BackgroundJob 或 Outbox；
- R3 独立提交并推送后，下一步只能开始 R4 zero-provider reviewed Mock / static checkpoint；
- 不得提前执行 R5--R7、Task 10/11、main 或后续 Phase。

## 13. 回顾时可以问

- `runnerWire` 与 `providerWire` 分别证明什么，为什么不能互相替代？
- 为什么共享 WeakMap token 仍不足以证明 issuer 是第一方模块？
- 三个模块私有 observation map 怎样拒绝 forged、reused、cross-call 与 cross-family？
- 为什么首个失败后必须冻结完整分母，并把 semantic/P95/token/CNY 全置为 `null`？
- reservation 为什么必须在 dispatch 前 fsync？
- `run_terminal` 后崩溃为什么只恢复 publication，而不能改成 crash report？
- recovery claim 为什么必须绑定 `recovery_claimed.previousHash`？
- 为什么 R3 CLI 只有 validate/seal，却仍不能在本阶段运行正式命令？
- 为什么 R3 完成不等于 R4 reviewed Mock、R5 Live 或产品/main 可用？
- 为什么新阶段机不能反向补全 Task 9C 的 sealed failure？
