# Phase 6.9.8 Retriever / FinalResponse P1 L2 implementation 验收

> 后续状态（2026-08-09）：本文记录的 zero-provider implementation 已被唯一 P1 L2 controlled-Live run
> `ff035203-500f-4744-b33c-3c375ae4c785` 取代为历史前置 checkpoint。该 run 在 approved source/tag `fa502925...` 上
> 正常 durable seal，但以 `p1_l2_quality_gate_failed / qualityAuthority=none` 结束；不得把本文的“Live 尚未执行”解读为
> 当前状态。正式终态、journal/report/artifact SHA、validator 和停止门见
> `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-controlled-live-quality-gate-failure.md`；随后以 `f4fac048`
> 合并到 `main` 并完成二次 zero-provider parity，详见
> `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-main-parity-zero-provider.md`。

> 日期：2026-08-09
> 状态：已完成（zero-provider implementation；controlled-Live 尚未执行）
> 分支：`drb/phase-6-9-8-p1-l2-controlled-live`
> implementation commit：`146d2107`
> 远程状态：当前分支 HEAD 与其 upstream/origin 分支一致；工作树 clean

## 1. 结论

P1 L2 的 production-shaped runner、受控 CLI、source admission 与 crash-only durability 已完成修复并通过静态回归，当前只等待本次已收到的精确数据边界接受与授权进入唯一 controlled-Live。此次实现修复没有读取根 `.env`、credential，也没有调用 DeepSeek/Qwen、创建正式 marker/journal/report/artifact/recovery claim，或写入 Docker、数据库、Redis、MinIO、Trace、BackgroundJob、Outbox 和业务数据。

## 2. 本次修复内容

此前 source admission 会把仓库 `.tmp` 中其它阶段的历史 sealed 文件当作当前 L2 formal evidence，并让 publication validator 把普通仓库根文件误判为非法。修复后的边界如下：

- 只将当前 P1 L2 命名空间识别为 formal path：当前 marker、journal、report、recovery claim、artifact 临时文件和根 hard-link artifact；
- 历史 Phase 6.9.7、Task 9、旧 G2/T3/R5/SR5 等 sealed evidence 保持原地、只读、不可改写，不阻断新的 L2 admission；
- 当前 L2 命名空间出现文件、目录、symlink、读取错误或 publication 冲突时仍 fail-closed；
- 缺失 `.tmp` 目录按空目录处理，非 `ENOENT` 读取错误仍阻断；
- runner、journal、artifact、validator、recovery claim 继续绑定同一 L2 lineage，禁止 retry/resume/replay/backfill 或第二个 winner。

首次受控入口在 source gate 以 `source_admission_invalid` 停止。只读诊断确认原因是 Windows/Bun 下 clean
`git status --porcelain` 返回合法空字符串，而实现把空字符串当作失败；它发生在 credential、marker 和 Provider 之前，因此本次
授权未消费。修复提交 `146d2107` 用显式 `null`/empty distinction 收口并加入回归测试；修复后 tag 必须重新绑定到该 source，才允许再次进入
唯一 Live 入口。

## 3. 固定运行边界

```text
8 zero-call guards
-> 6 DeepSeek query-rewrite lanes
-> 6 DeepSeek FinalResponse lanes
```

- 最大并发：`1`；每条 candidate lane 最多一次 dispatch，不 retry；
- Qwen embedding policy calls：`0`（仅保留固定 retrieval/evidence contract）；
- candidate invocation cap：`12`；input/output cap：`37,600 / 8,800` tokens；
- cost cap：`0.176 CNY`（`176,000` micro-CNY，Live admission 时重新核价）；
- 真实 key 只在 source、data-boundary、authorization、credential、marker/reservation gates 通过后 late-bind；
- Live 成功也只形成 `p1_semantic_gate` / P1 semantic authority，不自动形成产品、Docker/API/browser、Trace、SLA 或 `main` authority。

## 4. 回归证据

```text
P1 L2 focused             14 pass / 0 fail / 47 expect() calls
Agent full                1436 pass / 0 fail / 24314 expect() calls / 180 files
@repo/agent typecheck     passed
@repo/agent lint          passed
changed-file Prettier    passed
git diff --check          passed
Provider calls            0
credential reads          0
formal evidence          0
```

重点覆盖：历史 `.tmp` 兼容、当前命名空间冲突、source/tag/parity drift、hostile accessor、single-use admission、journal tamper、reserved-only crash recovery、credential alias conflict 和安全 CLI 输出。

## 5. 变更文件

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-l2-contract.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-l2-durability.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-l2-source-admission.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-p1-l2.test.ts`
- 本验收文档与同步后的协作/路线/数据流/行为/清单文档

## 6. 历史 Live 前停止门（已由后续 sealed run 收口）

以下命令和“授权未消费”只描述本 zero-provider 记录生成时的时点，不是当前指令。随后文档 parity、approved tag
绑定与唯一 controlled-Live 已完成，正式终态见独立失败验收文档：

`phase-6.9.8-retriever-final-response-p1-l2-approved`，唯一命令为：

```text
bun run --cwd packages/agent eval:phase-6-9-8:p1:l2:live
```

进程若中断，只能在进程退出后执行一次 crash-only recovery；不得重跑、补跑、curl、单 case 或追加 Provider 探测。该
停止门已由 run `ff035203-500f-4744-b33c-3c375ae4c785` 的 `evidence_published`、strict validator 和失败验收文档收口。
