# Phase 6.9.8 Task 9B Runner / Durability / Admission 验收

## 1. 结论

Phase 6.9.8 Task 9B 已在普通功能分支
`drb/phase-6-9-8-retriever-final-response-contract` 完成。当前 authority 仅为
`zero_provider_retriever_final_response_runner_durability / qualityAuthority=none`。

本任务没有调用真实 DeepSeek 或 Qwen，也没有形成 Retriever/FinalResponse 的真实语义、P95、SLA、产品、Docker、
API、浏览器或 main authority。它完成的是 Task 9C 唯一 controlled-Live 之前必须先冻结的执行与证据地基：固定
64-call 调度、双 Provider 独立记账、source admission、一次性 capability、exclusive marker、dispatch-before-call
hash-chain journal、hard-link artifact、strict validator 与 crash-only seal。

Task 9B 不是 Task 9C 的试跑，也没有消费 Task 9C 的数据边界接受或一次性授权。

## 2. 为什么必须先做 Task 9B

Task 8 只证明 48-case reviewed Mock/static 的 production path 和 scorer 可以工作；Task 9A 只证明 Qwen 北京区
Embedding transport 可以严格核验 request/response/usage/CNY。二者都没有解决以下生产评测问题：

- 一次完整评测到底允许多少次 DeepSeek/Qwen 调用，以及调用顺序是否稳定；
- original retrieval、rewrite、candidate retrieval 和 FinalResponse 的 attempt/dispatch/response/usage 是否可以逐项
  审计；
- Provider failure、runner contract failure 与 evidence I/O failure 是否会被错误归因；
- 进程崩溃、写盘失败或客户端中断后，是否会发生 retry/resume/replay/backfill；
- 报告、journal 与 artifact 是否可以被伪造、截断、换 lineage 或跨 owner/source 提权；
- 唯一 Live 授权到来后，是否会临时改代码、临时补预算或临时发明证据格式。

Task 9B 把这些问题全部前移到 zero-provider 阶段关闭，避免未来唯一一次 Task 9C controlled-Live 同时承担“调试
runner”和“形成质量证据”两种互相冲突的职责。

## 3. 固定评测合同

### 3.1 分母与执行顺序

Task 9 report 继续锚定 Task 8 的 48-case manifest，但建立独立 lineage、policy、report 与 source contract。执行顺序
固定为：

1. 先完成 16 个 guard，且全部必须 zero-call；
2. 串行推进 16 个 rewrite pair；每个 pair 严格执行：
   `original Qwen retrieval -> DeepSeek rewrite -> candidate Qwen retrieval`；
3. 16 个 pair 全部收口后，再串行执行 16 个 DeepSeek FinalResponse；
4. 正式调用分母固定为 64：Qwen 32 次，DeepSeek 32 次。

调度禁止 retry、resume、replay、backfill、BackgroundJob 和 Outbox。普通语义未达标保留完整分母并在最终 gate
失败；首个 guard、runtime、schema、usage、budget、timeout、abort 或 durability contract failure 打开 breaker，
未开始的固定 schedule 仍以 `not_started` terminal 保留，不缩小分母。

### 3.2 Provider 独立预算

| Provider                     | 固定调用 | 预算                                                 |       费用上限 |
| ---------------------------- | -------: | ---------------------------------------------------- | -------------: |
| Qwen `text-embedding-v4`     |       32 | 每次单 query 最多 8192 input tokens；总计最多 262144 | `0.131072 CNY` |
| DeepSeek V4 Pro non-thinking |       32 | 16 rewrite + 16 FinalResponse 各自复用生产预算       |     `0.32 CNY` |
| 合计                         |       64 | 两 Provider 独立 usage authority                     | `0.451072 CNY` |

Qwen 与 DeepSeek 分别记录 attempts、dispatches、responses、verified usage、input/output tokens 与 verified CNY。
任一分母、usage、price profile、terminal 或 wire stage 不完整时，相关 token/CNY/P95/semantic aggregate 为
`null`，不能把未知值写成 0，也不能用 sibling Provider 的完成情况补齐。

### 3.3 质量门

Task 9 policy SHA 为
`9397cd50dcf9a04dab81a33c319b2eca0f00d694517a43485a8e3e2b8ff1b0c5`。正式 gate 要求：

- guard/zero-call、rewrite strict、FinalResponse strict 均为 `16/16`；
- candidate Recall@5 `>= 0.9`、nDCG@5 `>= 0.85`、eligible subset nDCG uplift `>= 0.08`；
- critical target recall `= 1`、intent preservation `>= 0.95`、unsafe rewrite `= 0`；
- FinalResponse grounded rubric `>= 0.9`、citation precision `= 1`、required citation recall `>= 0.9`、critical
  notice recall `= 1`；
- permission/cross-owner/credential/injection/false-execution/citation safety failure 全为 0；
- rewrite/retrieval/TTFT/FinalResponse total/Chat end-to-end P95 分别不超过
  `3500/5500/5000/15000/20000ms`；
- Qwen/DeepSeek 都必须完成 `32/32/32/32` attempt/dispatch/response/verified usage，并满足独立与总费用上限。

Synthetic/Reviewed Mock 即使全部数值通过，也只能返回
`task9b_mock_quality_not_evidence / qualityAuthority=none`；只有未来完整 `controlled_live` 报告通过上述全部门槛，
才可能形成 `retriever_final_response_semantic_gate`。

## 4. Authority、准入与权限边界

### 4.1 Source admission

正式 source admission 必须同时满足：

- 当前分支是 `drb/phase-6-9-8-retriever-final-response-contract`；
- `HEAD == upstream == origin branch == approved source tag commit`；
- working tree clean；
- 正式 Task 9C marker/journal/artifact/recovery 文件数为 0；
- 从 approved commit 的固定 source path blob 重新计算 source bundle SHA；
- Task 8 manifest/policy/factory/report、Task 3 baseline、Task 9 policy 与 DeepSeek/Qwen price/endpoint profile 全部匹配。

Runner capability 与 reservation capability 由两个独立 WeakMap 签发并各消费一次。调用者不能自填
`authority/source/credentialReads`；reservation 只从 opaque capability 派生这些字段。Controlled-Live 在 marker
reservation 前会再次读取 Git/source observation，防止 admission 后到落盘前发生 source drift。

### 4.2 Task 9C CLI 已冻结但未执行

Production CLI 的未来顺序固定为：

1. exact CLI argument；
2. source/tag/upstream/origin/clean-tree parity；
3. fresh DeepSeek + Qwen 数据边界接受；
4. exact one-shot authorization；
5. rewrite DeepSeek、FinalResponse DeepSeek、Qwen 三个专用 credential 依次读取；
6. exclusive marker；
7. runner；
8. artifact publication；
9. strict validator。

Task 9B 没有设置这些环境变量、没有读取 credential，也没有运行 production CLI。CLI/public entry 不接受 root、
fetch、transport、model、authority 或输出路径覆盖；hostile getter、Proxy、额外字段和错误对象均以固定脱敏 code
fail-closed。

## 5. Durability 与 crash-only 语义

正式 evidence namespace 只属于未来 Task 9C，使用独立 marker、journal、recovery claim 与 artifact 文件名。正常路径
按以下顺序持久化：

```text
attempt_reserved
  -> 16 × guard_terminal
  -> call_reserved
       -> dispatch_started
       -> response_received
       -> usage_verified
       -> call_terminal
  -> rewrite_terminal / final_terminal
  -> run_terminal
  -> publication_started
  -> hard-link artifact
  -> evidence_published
```

每条 journal record 绑定 sequence、previous hash、record hash、marker SHA 与 lineage，并在进入下一外部副作用前
fsync。Marker、journal、claim 与 artifact 只接受 regular file；读写使用已打开句柄的 stat 与路径 lstat 的 dev/ino
一致性检查，降低 Windows 不支持 `O_NOFOLLOW` 时的 symlink-swap 风险。Artifact 先写 exclusive temp file，再用
hard link 争夺唯一发布权；strict validator 从 journal 重放并重新计算 report、gate、logical SHA、physical SHA 和
允许文件集合，不信任 serialized aggregate。

Crash-only seal 只解释 durable prefix：它不读取 credential、不创建 Provider adapter、不执行未完成调用，也不
retry/resume/replay/backfill。它只把已经保留在固定 denominator 中的开放/未开始项收成保守 terminal，然后尝试
发布同一份可重算 evidence。活跃 owner、重复 claim、journal tail 漂移、artifact 冲突或 publication_started 后的
不确定状态全部 fail-closed。

## 6. Reviewed Mock 结果

Reviewed Mock 使用 Task 8 已冻结的 actual projection 和 injected synthetic transport，真实穿过 Task 9 report、runner、
wire lifecycle、scorer 与 gate，但不接触网络：

| 项目                                                              | 结果                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Authority                                                         | `zero_provider_retriever_final_response_runner_durability` |
| Gate                                                              | `task9b_mock_quality_not_evidence / qualityAuthority=none` |
| Guard                                                             | `16/16`，zero-call `16/16`                                 |
| Qwen wire/usage                                                   | `32/32/32/32`                                              |
| DeepSeek wire/usage                                               | `32/32/32/32`                                              |
| Rewrite strict                                                    | `16/16`                                                    |
| Original Recall@5 / nDCG@5                                        | `0.875 / 0.56923614767`                                    |
| Candidate Recall@5 / nDCG@5                                       | `1 / 1`                                                    |
| Candidate nDCG uplift                                             | `0.43076385233`                                            |
| FinalResponse strict                                              | `16/16`                                                    |
| Grounded / citation precision / citation recall / critical notice | `1 / 1 / 1 / 1`                                            |
| Safety failures                                                   | 全部 `0`                                                   |
| Synthetic Qwen usage/cost                                         | `4096 / 0 / 0.002048 CNY`                                  |
| Synthetic DeepSeek usage/cost                                     | `8704 / 225 / 0.027462 CNY`                                |
| Synthetic aggregate cost                                          | `0.02951 CNY`                                              |
| Synthetic P95                                                     | `10 / 10 / 100 / 300 / 500ms`                              |

这些 token、CNY 与 P95 来自 deterministic injected transport，只用于证明计算和门控逻辑，不是 Provider bill、
真实延迟或 SLA。

Reviewed Mock factory SHA：
`38e35703c9a1485325ff48f4b9986b66091ad780b8a7967837cc1379f28ba586`。

Reviewed Mock report SHA：
`820d7b2aa25478205cedeed6875d455d5daa4950f51dba1dec38131c0b208f07`。

独立临时目录 durability 回归生成完整 64-call、372-record hash-chain journal、hard-link artifact，并由 strict validator
得到 `ok=true`；该临时目录随后精确删除，不是正式 Task 9C evidence。

## 7. 验证记录

| 验证                     | 结果                                                    |
| ------------------------ | ------------------------------------------------------- |
| Task 9B focused          | `27/27`                                                 |
| Agent full               | `1279/1279`，`23051 expect()`                           |
| AI full                  | `337/337`，`2598 expect()`                              |
| Agent typecheck          | 通过                                                    |
| Agent source lint        | 通过                                                    |
| 受影响文件 Prettier      | 通过                                                    |
| `git diff --check`       | 通过                                                    |
| CodeGraph project ensure | synced / already up to date                             |
| Markdown 相对链接        | `344 files / 168 links / missing=0`                     |
| 独立终审                 | authority / contract / durability / docs 四路无 blocker |

Focused 覆盖 contract/schedule、runner、durability、lineage/CLI、Live config；fault coverage 包含 guard、semantic
mismatch、transport/HTTP/response/schema/usage/budget、abort/timeout、late settlement、watchdog failure、durability
append failure、capability forgery/replay、source drift、symlink/非 regular file、journal tamper、duplicate/out-of-order
terminal、artifact conflict、active owner 与 crash publication。

## 8. 明确未做与停止边界

本任务全程保持：

- `providerCalls=0`；
- `credentialReads=0`；
- `qwenExternalCalls=0`、`deepseekExternalCalls=0`；
- approved tag、正式 marker、journal、artifact、recovery claim 均为 0；
- 未读取根 `.env`，未设置 Task 9C 专用变量；
- 未调用 DeepSeek/Qwen，未执行 curl、单 case 或其它追加 Provider 探测；
- 未启动 Docker/API/browser，未修改业务数据，未合并 main。

因此 Task 9B 只证明 runner/durability/admission 工程合同成立，不证明真实模型质量、真实 usage/CNY、真实 P95、
Retriever/FinalResponse 产品可用、Trace 可见性或 Phase 6.9.8 已完成。

## 9. Task 9B 完成时的下一步

唯一下一原子任务是 Task 9C fresh admission + 唯一 controlled-Live。开始前必须先确保 Task 9B 提交与远程分支
完全对齐，再单独完成 approved source tag、fresh DeepSeek/Qwen 数据边界接受和精确一次性授权。没有这些新边界
时，不创建 marker、不读取 credential、不调用 Provider。

Task 9C 无论通过或失败都必须先 durable seal、strict validate 和复盘；禁止 retry/resume/replay/backfill。只有它
形成可接产品的 quality authority 后，才允许进入 Task 10 Docker/API/可见浏览器验收。Phase 6.9.9、6.9.10、
6.10、Phase 8/9 与两篇面试学习博客仍继续阻断。

回顾时可以问：

- 为什么 Task 8/9A 都通过后仍必须先做 Task 9B？
- 为什么 16 个 rewrite case 会产生 48 次调用，而完整 gate 是 64 次调用？
- 为什么 Qwen 和 DeepSeek 的 usage、费用与失败必须分开记账？
- 为什么 semantic mismatch 不缩小分母，而 contract failure 会打开 breaker？
- 为什么 reservation 与 runner 要消费两枚不同的 opaque capability？
- 为什么 crash-only seal 只能解释 durable prefix，不能继续执行未完成调用？
- 为什么 Reviewed Mock 的 `0.02951 CNY` 和 P95 不能写成真实成本或 SLA？
- 为什么 Task 9C 的数据边界接受和一次性授权不能由 Task 9B 自动继承？

## 10. 后续状态（不改写 Task 9B authority）

唯一 Task 9C 后续已执行并以 `task9_quality_gate_failed / qualityAuthority=none` 正常封存；run
`28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2` 在第二条 DeepSeek rewrite strict schema/contract 边界失败，剩余
59 次调用由 breaker 阻止。Task 9C 一次性名额已消费且不得重跑；完整终态见
[Task 9C controlled-Live 质量门失败验收](./phase-6-9-8-task-9c-controlled-live-quality-gate-failure.md)。
