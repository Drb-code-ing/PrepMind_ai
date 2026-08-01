# Phase 6.9.7 Tutor / Organizer P2 Zero-provider 全量质量门验收

日期：2026-08-01

状态：P2 设计验收完成；下一任务仅 F1 full contract/baseline

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论

P2 已在 zero-provider 边界内冻结独立的 24-pair/48-runtime full-gate 设计。它没有重跑 L2，也没有读取
credential、调用 Provider、启动 Docker/API/browser 或修改业务数据。

本次 authority：

```text
authority: zero_provider_full_gate_design
route: phase-6.9.7-tutor-organizer-full-gate-v1
providerCalls: 0
formal full-gate marker/journal/artifact/recovery claim: 0/0/0/0
```

P2 完成只解锁 F1 实现，不授权 full-gate Live、产品验收、main 或后续 Phase。

## 2. 冻结数据、baseline 与 policy

现场复核并冻结：

| Authority                         | 结果                                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| Source dataset                    | `phase-6.9-tutor-wrong-question-v2`                                |
| Dataset SHA                       | `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b` |
| Source eval policy SHA            | `b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d` |
| Full manifest SHA                 | `e68e6e27211f4fdfb4a0ac35d4295693b33466163b0aefa4aa14b3b97ae12c78` |
| Source deterministic baseline SHA | `0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca` |
| P2 baseline authority SHA         | `2ab1030f352096d995527e85b415a33c2111576aee3a786f8958593ecc5ba5f2` |
| P2 full eval policy SHA           | `11371d1698cf3009bae243e93ffca802a004f4251e71d789ad4c5e5944baf503` |
| F1 baseline logical report SHA    | `not_generated_in_p2`                                              |
| F1 baseline physical file SHA     | `not_generated_in_p2`                                              |

后两项只能在 F1 对实际生成的 logical payload 与 physical bytes 分别计算；P2 authority/document hash 不能
代填，因此当前缺省是明确的阶段边界。

固定分母为 `72 entries / 24 guards / 24 pairs / 48 runtime lanes / 32 Organizer decisions`。Fresh
deterministic full baseline 现场重算为：

```text
complete/failed: 12/36
Tutor semantic: 0.6629642857142858
Organizer semantic: 0.278125
Combined semantic: 0.4705446428571429
invalid/critical: 0/0
Provider/input/output/CNY: 0/0/0/0
```

## 3. 冻结质量、延迟和预算门

Full-gate 要求：

- `24/24` actual guard zero-call；
- runtime reserved/terminal/orphan/not-started `48/48/0/0`；
- executor/dispatch/response/verified usage `48/48/48/48`；
- strict runtime `48/48`；
- Tutor/Organizer/Combined semantic 各 `>=0.85`；
- Tutor/Organizer 相对 full baseline 各提升 `>=0.15`；
- L2 anchor subset 也须按 P1 门独立通过，但不要求复现 L2 随机实际分数；
- invalid/critical/permission/mutation/broader fallback/locked-name/write leakage 全为 0；
- `executorProvenance=deepseek_network`，Mock/synthetic 永远不能 quality pass。

24-sample nearest-rank P95 固定取排序后第 23 个值：Tutor `<=2500ms`，Organizer/paired
`<=4500ms`，Tutor local orchestration `<=6500ms`。Tutor/Organizer hard timeout 为 `3500/5000ms`。L2 的 8
个 duration 没有被复用或伪装成 full P95。

预算固定为：

```text
48 calls
Tutor: 28800 input / 7200 output tokens
Organizer: 84000 input / 19200 output tokens
Total: 112800 input / 26400 output tokens
mathematical worst-case: 0.528 CNY
0 < total CNY <= 0.55
no retry/resume/replay/backfill
```

`0.55 CNY` 是便于配置与告警的独立 round-number run-level fail-closed ceiling；它和 `0.528 CNY` 数学
最坏合计必须同时检查，两者之间的 `0.022 CNY` 不是额外消费额度，也不放宽 per-lane token/CNY、48-call、
verified-usage 或 known-pricing 门。

## 4. 并发、任务丢失与证据门

P2 已冻结：guard-first、24 pairs 串行、pair 内最大并发 2、独立 sibling AbortController/budget/terminal、
semantic mismatch 不 breaker、contract/safety failure 在当前 pair 收口后 breaker，以及后续 entry 保持固定
`not_started_quality_breaker`。

未来 F2 必须证明：dispatch 前 reservation/hash-chain/fsync、wire 单调、每 lane 单 terminal、external abort 与内部
abort 分离、exclusive marker、hard-link single publication、crash-only zero-wire seal、严格重算 validator，以及
runtime accounting 不丢任务、不缩小分母。

Full-gate 使用全新 report/marker/journal/artifact/validator/source tag/approval/credential/confirmation namespace；
历史 V1--V9/R3/L1/P1--L2 identity 与新路线双向拒绝。

## 5. L2 source continuity

L2 approved tag 仍固定解析到：

```text
phase-6-9-7-tutor-organizer-small-sample-s2-approved
4c6084455d0cea6b4a5ddd94511bce29c22af1c4
```

P2 没有移动或重建该 tag。Tutor projection/schema/merger、Organizer projection/schema/merger 与第一方 adapter
七个内容 SHA 已从该 commit 现场复核并写入设计。未来 full-gate source admission 若发现任一 hash 漂移，必须
fail-closed，不能借用 L2 pass。

## 6. 本阶段未做

本次没有：

- 读取 `.env`、DeepSeek credential 或任何 runtime secret；
- 调用 Provider、执行 Mock/synthetic Live、24-pair Live、curl 或单 case 探测；
- 创建 full-gate approved tag、marker、journal、artifact 或 recovery claim；
- 删除、改写、seal 或 recovery 已完成的 L2 bundle；
- 启动 Docker/API/Web/可见浏览器，创建账号、Trace 或业务数据；
- 修改 candidate/runtime/product source、生产 gate、数据库、Redis 或 MinIO；
- 合并 main 或解锁 Phase 6.9.8/6.10/8/9。

## 7. 验证记录

P2 收口必须完成并记录：

- [x] 当前分支与 HEAD/upstream/remote parity；
- [x] L2 approved tag 本地/远程 commit parity；
- [x] V2 full deterministic baseline 现场重算与 frozen SHA parity；
- [x] 72/24/48/24/32 fixed denominator 与 manifest canonical SHA 重算；
- [x] baseline authority 与 full eval policy canonical SHA 重算；
- [x] 七个 candidate/adapter source hash 现场重算；
- [x] 新增/更新 Markdown Prettier、local link、conflict marker、sensitive assignment 与 `git diff --check`；
- [x] 无上下文 Reader Testing 与独立 consistency/security/operations 复审；
- [x] 文档独立提交、推送及最终 HEAD/upstream/remote/tag parity。

收口证据：18 个 Markdown 文件 Prettier 通过；三个 canonical JSON hash `3/3`；本地链接
`18 files / 103 links / 0 missing`；changed-content conflict/sensitive scan 为 0；独立数值、并发安全、
authority/lineage、现行文档冲突复审与 fresh 无上下文 Reader Testing 均 `APPROVED`，无未关闭
Critical/Important。提交前分支 HEAD/upstream/remote 为 `08c15f8...cc3bb2cb`，L2 approved tag 本地/远程仍为
`4c608445...c22af1c4`；提交后的最终 parity 由本次收口命令复核。

以上验证不包含 Provider、Docker 或产品测试。

## 8. 下一步

下一原子任务仅 F1：实现 full manifest/baseline/report/scorer/gate，并复现三个 P2 canonical SHA。F1 仍
zero-provider，不读取 credential、不创建 approved tag/正式 evidence、不启动产品。

完整设计与计划：

- `docs/superpowers/specs/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate-design.md`；
- `docs/superpowers/plans/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`。

回顾时可以问：

- P2 为什么增加 L2 anchor subset 门，却不要求复现 L2 的实际分数？
- 24-pair P95、hard timeout 与产品端到端 P95 分别是什么？
- 为什么 full-run worst-case 是 `0.528 CNY`，hard cap 却保留为 `0.55 CNY`？
- pair 内并发和 pair 间串行怎样避免任务丢失与扩大爆炸半径？
- P2 完成后为什么还不能调用 Provider或启动产品验收？
