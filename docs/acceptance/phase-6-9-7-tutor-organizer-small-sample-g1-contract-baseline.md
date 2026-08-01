# Phase 6.9.7 Tutor / Organizer Small-sample G1 Contract / Baseline 验收

日期：2026-07-31

状态：G1 已完成，zero-provider；后续 G2/S2 与唯一 L2 已完成，G1 authority 保持不变

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 本次实际完成

G1 把 P1 文档冻结的小样本设计落成了可执行、可校验的纯本地合同，但没有创建任何 Provider 执行能力：

- 深冻结独立 `phase-6.9.7-tutor-organizer-small-sample-v1` manifest；
- 从既有 V2 数据集复现未修饰 deterministic subset baseline，并冻结 authority、logical report 与 physical
  file 三层 SHA；
- 新增 24-entry strict report、scorer、派生 aggregate、scheduler、breaker、budget、pricing 与 quality gate；
- 新增固定路径、exclusive-create 的 baseline CLI；
- 导出既有 Tutor / Organizer deterministic evaluator，供固定子集复用；全量 baseline 算法和原 SHA 未改；
- 新增 focused contract/security/regression 测试，并完成独立 contract 与 security 复审。

源码入口：

- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-manifest.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-baseline.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-contract.ts`；
- `packages/agent/scripts/phase-6-9-7-tutor-organizer-small-sample-baseline.ts`；
- `packages/agent/tests/phase-6-9-tutor-organizer-small-sample-g1.test.ts`。

## 2. 冻结 identity 与 baseline

G1 从运行时源码重新校验 4+4 guards、8 pairs、16 runtime lanes 与 12 Organizer decisions。Manifest 只保存
case ID、pair index 和 selection tags，不保存 expected、答案正文或 Provider projection。

```text
source dataset SHA:
  42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b
source eval policy SHA:
  b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d
manifest SHA:
  ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61
baseline authority SHA:
  d36d0789a19b89f814f66130c6ca8e92ab7eaf76bde597ccba80454e93fd9f4e
baseline logical report SHA:
  ad3aa54d61a5890c777358edebdfd3a65c6faa2ba7f68ff562afbad09259d002
baseline physical file SHA:
  e8bcbcb57afd23b9ec3dd8f3614550a13df629bd8105a4d350b5ada4b0aa658b
eval policy SHA:
  1cab7786af49a6a6111927f3849b283e9e9c1c143eea6d4fecfd7adb02bf399a
```

正式实现复现 P1 数值：

```text
Tutor:    8 cases / 5 full / semantic 0.7070238095238095
Organizer: 12 decisions / 0 full / semantic 0.2375
Combined: 0.47226190476190477
provider/token/CNY: 0 / 0 / 0
```

Baseline 文件内部记录 logical report SHA；physical SHA 由 validator 对实际 UTF-8 bytes 计算并返回。Physical
SHA 不写回自身文件，避免自引用 hash。CLI 固定只处理：

```text
.tmp/phase-6-9-7-tutor-organizer-small-sample-baseline.json
```

本机首次生成结果为 `created`；最终复核为 `same_bytes`，返回 logical/physical SHA 与上述值精确一致。该 `.tmp`
文件被忽略，不是 Live marker、journal、artifact 或质量证据。

## 3. Report、scorer 与 gate

Report schema 固定 8 guard entries + 16 runtime entries，按 manifest 原顺序逐条验证；unknown、duplicate、missing、
wrong agent/case/pair、旧 lineage 和自报 aggregate 漂移全部拒绝。Aggregate 必须从 entries 重算：

- guard 误 dispatch 记为 critical failure，但不混入 16-lane runtime wire 分母；
- 每个 pair 恰好 Tutor + Organizer 两条 lane；首个 contract terminal 后，后续 pair 只能使用固定 breaker 或
  external-abort not-started 状态；
- 普通 semantic mismatch 保留完整分母，不提前打开 contract breaker；
- 任一 runtime/wire/duration/usage/pricing 不完整时，semantic、latency、token、CNY 正式 aggregate 全为
  `null`；
- 8 个样本只产生 median/max，所有 P95 字段固定 `null / insufficient_sample_size_8`；
- usage 必须与 verified wire 一致，逐 lane、逐 pair和全局 token/CNY cap 都由本地合同验证；
- Mock 永远只能得到 `mock_quality_not_evidence`；Live pass 还要求
  `executorProvenance=deepseek_network`、16/16 strict、三个 semantic `>=0.85`、Tutor/Organizer 各提升
  `>=0.15`，以及全部安全/预算门通过。

G1 的 pure builder 可以在单元测试中构造各种 report，因此单独一个 schema pass 不是 Provider provenance 或质量
authority。后续 G2 已把这些合同接到不可注入的 one-shot runner、durable journal、marker、artifact 和重算
validator；G1 本身仍不声称运行过 candidate，G2 也没有执行正式 Mock/Live。

## 4. Oracle、权限与历史隔离

- Manifest 不导入 baseline、contract、candidate、Mock、Live 或 Provider。
- Candidate 源码不导入 small-sample manifest/baseline/scorer；expected 只由本地 scorer 在 runtime observation
  形成后读取。
- Baseline CLI 不读取 `process.env`、`.env`、DeepSeek credential、Provider、Mock、Live 或 candidate。
- 新 report 拒绝 V1--V9 sealed run ID、Architecture Recovery R3/R4 与 Canary V2 L1 identity；V1--V9 旧
  report schemas 也拒绝新 report。
- G1 没有增加 Tutor 或 Organizer 权限，没有产品 composition、数据库写入或自动重试。

## 5. Baseline 文件安全边界

Writer 在 fixed root 下创建 `.tmp`，并执行：

1. 写前校验 parent `lstat + realpath`，拒绝 symlink 和 root 外路径；
2. `open(..., "wx", 0600)` exclusive-create；existing path 只以 read-only handle 进入 same-bytes 校验；
3. exclusive open 后、写入前，再校验 parent、final path、handle `stat`，并要求 path/handle `dev + ino`
   身份一致；
4. `write -> fsync` 后再次执行完整 identity 校验，不允许 path 已换位却返回 `created`；
5. same-bytes 在 handle read + strict bytes validator 后也再次校验 identity；失败均关闭 handle，CLI 只输出固定
   失败文案，不泄露 raw path/error。

Focused tests 已覆盖 parent 在 open 后换位时 `wrote=false / closed=true`、existing symlink 不读不写，以及
post-sync 换位不得误报 `created`。

剩余边界如实保留：通用 Node 文件 API 没有跨平台 `openat(dirfd, O_NOFOLLOW)`。同一用户恶意并发者仍可在
最后一次 identity check 与 return/close 之间 unlink/rename；已打开 handle 不会因此写入新的 symlink 目标，但
可能形成短暂 orphan inode 或返回后路径变化。G1 将仓库视为 trusted single-user workspace；若未来要求抵御同
用户主动攻击，需要原生 dirfd/openat 或独占目录锁，不能靠无限追加 lstat 消除竞态。

## 6. 验证结果

```text
G1 focused:             20/20 tests, 135 assertions
V2 baseline regression: 11/11 tests, 371 assertions
Agent full:             995/995 tests, 16462 assertions
Agent typecheck:        PASS
Agent lint:             PASS
baseline CLI:           same_bytes + exact logical/physical SHA
```

另外完成 Prettier、`git diff --check`、依赖隔离扫描和敏感赋值扫描。独立 contract 复审确认 pair scheduler、
aggregate、budget、P95、Mock/Live authority 与历史 lineage 无阻断；独立 security 复审确认 open 前后 identity
校验无 G1 阻断，并把上述 Node 同用户竞态保留为 trusted-workspace 边界。

## 7. 本阶段明确未做

- 未读取根 `.env`、任何 DeepSeek credential 或运行时 secret；
- 未调用 Provider，未运行 small-sample Mock/Live、48-case 或旧 V1--V9 runner；
- 未创建正式 marker、journal、artifact、recovery claim 或 L2 authorization；
- 未启动 Docker、API、Web 或可见浏览器；
- 未创建测试账号、修改数据库/业务数据或生产 gate；
- 未合并 main，也未解锁 Phase 6.9.8、6.10、8、9 或博客收尾。

所以本次 authority 仅为 `zero_provider_contract_baseline`，不能证明 TutorAgent / WrongQuestionOrganizerAgent
真实模型语义、Provider 稳定性、产品 API/页面可用或生产就绪。

## 8. 下一步

G2 已 zero-provider 完成 one-shot runner、不可注入 production composition、guard-first/pair-serial 调度、独立
sibling terminal、dispatch-before-call hash-chain journal、exclusive marker/publication、crash-only seal 与 strict
recomputing validator；验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-g2-runner-durability.md`。

G1 之后的 S2 reviewed Mock/static 已 zero-provider 完成；验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-s2-reviewed-mock-static.md`。G1 的历史
`zero_provider_contract_baseline` authority 与上述数值不因 S2 结果而改写。

S2 不创建 approved tag。只有 S2 独立提交并推送后，未来独立 L2 admission 才能针对已推送且
HEAD/upstream/remote parity 的 commit 创建/绑定 tag，并重新取得数据边界接受与 exact authorization。
普通“继续/开始/同意/所有权限”不授权 L2。上述内容保留 G1/S2 当时边界；后续唯一 L2 已按独立 admission
完成。

### 8.1 后续 L2 sealed checkpoint

唯一 run `6918df4f-a4ae-4de0-aa21-c7614ed5861d` 已以 guard `8/8`、strict/wire/verified usage
`16/16/16/16`、Tutor/Organizer/Combined semantic
`0.9141666666666668 / 1 / 0.9570833333333334`、费用 `0.02256 CNY` 通过
`small_sample_quality_gate_passed` 并 durable seal。Authority 仅 `small_sample_semantic_gate`；8-pair P95 仍
为 `null`。完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live.md`。

L2 结果不改写 G1 的 `zero_provider_contract_baseline` authority、baseline 数值或 SHA。其后 P2 已
zero-provider 完成 full-gate design，F1/F2 已完成 full contract/baseline 与 runner/durability/evidence；它们都
不改写 G1 历史。当前下一任务仅 S3 reviewed Mock/static；L2 重跑、48-case Provider 调用、产品验收与 main
均未获授权。P2/F1/F2 验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-f1-full-contract-baseline.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-f2-runner-durability-evidence.md`。

回顾时可以问：

- baseline authority SHA、logical report SHA 和 physical file SHA 为什么必须分开？
- 为什么 G1 的 pure report builder 通过不能证明 `deepseek_network` provenance？
- 为什么 semantic mismatch 不开 breaker，而 runtime contract failure 必须开？
- 为什么 8 条 guard 不进入 16-lane wire 分母？
- 为什么 8 个样本只记录 median/max，不能生成 P95？
- Node 没有 openat/dirfd 时，baseline writer 还保留什么可信工作区边界？
