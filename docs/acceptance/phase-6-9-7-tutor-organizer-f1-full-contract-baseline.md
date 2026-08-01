# Phase 6.9.7 Tutor / Organizer F1 Full Contract / Baseline 验收

日期：2026-08-01

状态：F1 验收完成，zero-provider；下一任务仅 F2 one-shot runner/durability/evidence

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论与 authority

F1 已把 P2 冻结的全量质量门设计编码为独立、严格、可重算的 manifest、deterministic baseline、report、
scorer、gate 与安全 baseline writer。它没有读取 credential、调用 Provider、创建 approved tag 或正式 Live
证据，也没有启动 Docker/API/browser、修改业务数据或合并 main。

```text
authority: zero_provider_full_contract_baseline
lineage: phase-6.9.7-tutor-organizer-full-gate-v1
providerCalls: 0
approved tag: 0
formal marker/journal/artifact/recovery claim: 0/0/0/0
project-root baseline file: 0
```

F1 只解锁 F2 的 zero-provider one-shot runner/durability/evidence 实现；不授权 S3 Mock、L3
controlled-Live、产品 Docker/API/可见浏览器、main 或后续 Phase。

## 2. 本次交付

新增：

- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-baseline.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-contract.ts`；
- `packages/agent/scripts/phase-6-9-7-tutor-organizer-full-gate-baseline.ts`；
- `packages/agent/tests/phase-6-9-tutor-organizer-full-gate-f1.test.ts`。

更新 `packages/agent/package.json`，新增安全的本地 baseline 命令
`eval:phase-6-9-7:full-gate:baseline`。该命令没有 Live/Provider 参数，只能在 fixed ignored path 写入 canonical
bytes；本次收口没有在项目根执行它，writer 行为由系统临时目录测试验证，因此项目根 baseline 文件保持 0。

## 3. 固定 manifest、baseline 与 policy

| Authority                     | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| Source dataset                | `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b` |
| Source eval policy            | `b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d` |
| Full manifest                 | `e68e6e27211f4fdfb4a0ac35d4295693b33466163b0aefa4aa14b3b97ae12c78` |
| Source deterministic baseline | `0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca` |
| Baseline authority            | `2ab1030f352096d995527e85b415a33c2111576aee3a786f8958593ecc5ba5f2` |
| F1 baseline logical report    | `16c574b1cf9f22beace9ac4c60fb098989795752fb57421ef957795b5f4782c9` |
| F1 baseline physical file     | `16aa1773d3774380eac7e7379601c1f812d9c920ef8f81e6f91a6ab5ae8a6f73` |
| Full eval policy              | `11371d1698cf3009bae243e93ffca802a004f4251e71d789ad4c5e5944baf503` |
| L2 anchor manifest            | `ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61` |

Manifest 从冻结 V2 dataset 重建并精确绑定：

```text
72 entries
24 guards = 12 Tutor + 12 Organizer
24 runtime pairs = 48 runtime lanes
32 Organizer decision units
L2 anchor pair indexes = 0/7/9/11/14/18/22/23
```

未修饰 deterministic functions 重算的 full baseline 继续为：

```text
complete/failed runtime: 12/36
Tutor semantic: 0.6629642857142858
Organizer semantic: 0.278125
Combined semantic: 0.4705446428571429
Provider/input/output/CNY: 0/0/0/0
```

F1 没有把 P2 的 baseline authority SHA 冒充 logical/physical evidence。Logical SHA 对 canonical report payload
计算；physical SHA 对包含 file envelope 与末尾换行的原始 `Uint8Array` 计算。Validator 拒绝 BOM、CRLF、任意
byte/payload/source drift，二者不能互换。

## 4. Strict report、scorer 与 gate

正式 report 只接受完整 72-entry 顺序，并从 entries 重算 fixed denominator、wire、usage、安全、语义、延迟、
预算与 gate；调用方不能用自报 aggregate 覆盖重算结果。

- guard/runtime reserved/terminal/orphan/not-started 固定为 `24/48/48/0/0`；
- executor/dispatch/response/verified usage 与 strict runtime 都要求 `48/48`；
- Full Tutor/Organizer/Combined semantic 各 `>=0.85`，Tutor/Organizer 相对 full baseline 各提升
  `>=0.15`；
- 同一次 full run 的 L2 anchor subset 也必须通过 P1 semantic/improvement/safety 门；
- invalid/critical/permission/mutation/broader fallback/locked-name/write leakage 全为 0；
- 24-sample nearest-rank P95 固定取第 23 个值：Tutor `<=2500ms`、Organizer/paired `<=4500ms`、Tutor
  local orchestration `<=6500ms`；
- 预算固定 `48 calls / 112800 input / 26400 output / 0<CNY<=0.55`，no
  retry/resume/replay/backfill；
- 任一正式分母不完整时，full/anchor semantic、四项 P95、token 与 CNY aggregate 全为 `null`；
- semantic mismatch 不打开 breaker；contract/safety failure 只能在当前 pair 两 lane terminal 后打开 breaker。

Gate authority 固定为：

```text
mock/synthetic -> full_gate_mock_quality_not_evidence / qualityAuthority=none
live incomplete or failed -> full_gate_quality_gate_failed / qualityAuthority=none
complete deepseek_network pass -> full_gate_quality_gate_passed / full_gate_semantic_gate
```

因此，F1 测试中的 passing report 只能证明 contract 派生正确；它不是 Provider、48-case 或产品质量证据。

## 5. Source、lineage 与写入安全

七个 candidate/adapter 内容 SHA 与 L2 approved source 保持一致：

| Source                     | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| Tutor prompt               | `72fe93b2408a0b587c07cb4845159e009ef4a1bcd911a61b20b7677fb267d406` |
| Tutor schema               | `441793e5ce76b27e35661263ab0b843d77d12e74f40646fecc22e84f3e392f70` |
| Tutor merger               | `e2d181ae9b34740cd43c0070ad041ea0f06f647b0352a6cc4f1afc6f3721ba4a` |
| Organizer prompt           | `edf716f0acdf0e6120726bd3af47470e8bb7838af0dae18882200dc40c1e64e9` |
| Organizer schema           | `5d6289bb34381868f1ed2996b8cbbf2a7ba775352ded5a7a115a76d12a5cbfa9` |
| Organizer merger           | `752557a1a33fc610d3e62e8f7d23ba0f4aedf1c4ef57947d8682cd14dabbaa8d` |
| First-party direct adapter | `f275fb41a06c2980800979b1e522e964b56ab81fddb4eb820b01f611f60f2658` |

Full-gate parser 双向拒绝 V1--V9、Architecture Recovery R3、Provider Canary L1 与 small-sample
P1/G1/G2/S2/L2 lineage；旧 parser 也不能把 full-gate report 当成自己的 evidence。

Baseline writer 使用 root containment、非 symlink parent、exclusive create、open handle 与 path 的 dev/inode
identity 复核、写后 fsync 和二次 identity 检查。既有文件只有 exact canonical bytes 才返回 `same_bytes`；冲突、
父路径漂移、symlink 或 TOCTOU identity 变化全部 fail-closed。

F1 source 还通过 exact import allowlist、credential/Provider/network/dynamic import 静态门与 runtime
`globalThis.fetch` spy；spy 实际调用次数为 0。

## 6. 验证记录

```text
Focused F1: 14 pass / 0 fail / 87 assertions
Agent full: 1076 pass / 0 fail / 18048 assertions / 128 files
Agent typecheck: PASS
Agent lint: PASS
Changed-file Prettier: PASS
git diff --check: PASS
changed-content credential/conflict scan: 0
formal marker/journal/artifact/recovery claim: 0/0/0/0
approved tag / project-root baseline file: 0/0
```

四路独立只读复审均为 `APPROVED`：

- contract/scorer/gate：完整分母、anchor、P95、预算、authority 与 breaker 语义无阻断；
- baseline/writer：canonical SHA、raw-byte physical hash、path/inode/TOCTOU fail-closed 无阻断；
- test/lineage/security：exact import allowlist、runtime fetch spy、历史双向拒绝与 BOM/raw-byte 负例无阻断；
- fresh no-context Reader：F2 可从 F1 contract 唯一解释分母、aggregate、gate 与停止边界。

以上验证没有读取 `.env` 或 credential，没有调用 Provider，也没有执行 Docker/API/browser。

## 7. 本阶段未做

F1 没有：

- 实现 F2 one-shot runner、source admission、marker、journal、artifact、validator 或 crash-only seal；
- 执行正式 reviewed Mock、controlled-Live、curl、单 case 或其它网络探测；
- 创建/move/rebuild full-gate approved tag；
- 重跑或改写 V1--V9、R3、Canary L1 或 Small-sample L2 sealed evidence；
- 启动产品、创建测试账号/Trace/业务数据，或验收 Tutor Chat/Organizer API/页面；
- 合并 main、推送 main 或解锁 Phase 6.9.8/6.10/8/9。

## 8. 下一步

下一原子任务仅 F2：实现 full one-shot runner/source/marker/hash-chain journal/hard-link artifact/strict
recomputing validator/crash-only seal 与并发/取消/崩溃 fault matrix。F2 仍必须 zero-provider，正式 full-gate
marker/journal/artifact/recovery claim 保持 0。

只有 F2 完成并独立提交推送后，才允许进入 S3 reviewed Mock/static；S3 完成也不能自动调用 Provider。未来 L3
仍需 fresh 数据边界接受和 exact authorization，且 L3 pass 后才可能解锁独立产品验收。

回顾时可以问：

- F1 为什么要把 baseline authority、logical report 和 physical file 分成三个 SHA？
- 为什么 24-sample P95 取第 23 个值，而 8-pair L2 不能生成 P95 authority？
- 为什么 semantic mismatch 不 breaker，contract/safety failure 才 breaker？
- 为什么 Mock 的全部门通过仍只能得到 `full_gate_mock_quality_not_evidence`？
- F2 怎样用 durable reservation、单 terminal 与 crash-only seal 证明 48 条 lane 没有丢失或回放？
