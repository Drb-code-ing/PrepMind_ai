# Phase 6.9.7 Tutor / Organizer Small-sample G2 Runner / Durability 验收

日期：2026-07-31

状态：G2 已完成，zero-provider；其后 S2 与唯一 L2 已完成，G2 authority 保持不变

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 本次实际完成

G2 把 G1 的纯 report/scorer/gate 接成一次性执行与可恢复证据链，但没有执行正式 Mock 或 L2：

- 新增 guard-first、pair-serial、pair 内双 lane 的固定分母 runner；
- 新增固定 production CLI、source/approval/dedicated credential gate 与独立 Live composition；
- 新增 exclusive marker、fsynced hash-chain journal、hard-link artifact、strict bundle validator；
- 新增 dead-owner single-winner crash-only seal 与 terminal publication recovery；
- 新增 authority/CLI、runner/failure、durability/recovery、history-lineage 四组 G2 测试；
- 保持项目根正式 L2 marker、journal、artifact、recovery claim 全部为 0。

主要入口：

- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-authority.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-cli-core.ts`；
- `packages/agent/src/evals/run-phase-6-9-tutor-organizer-small-sample.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-live.ts`；
- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-durability.ts`；
- `packages/agent/scripts/phase-6-9-7-tutor-organizer-small-sample-cli.ts`；
- `packages/agent/scripts/validate-phase-6-9-7-tutor-organizer-small-sample-evidence.ts`。

## 2. Authority、CLI 与 source 顺序

Public production CLI 的调用方只能提供 `args + AbortSignal`。Repository root、`process.env` reader、clock、
UUID、stdout writer、model、base URL、fetch、transport、retry、runner、validator 和 durability ports 全部由模块
内部固定；带多余 own key、getter/Proxy、额外参数或错误 confirmation 的输入在 preflight/marker 前拒绝。

正式顺序固定为：

```text
exact CLI argument
  -> zero-provider proxy preflight
  -> synchronous single-consume proxy attestation
  -> source branch/clean/HEAD/upstream/remote/L2-admission-tag/hash admission
  -> exact approval
  -> dedicated L2 credential
  -> exclusive marker + attempt journal
  -> 8 guards
  -> 8 runtime pairs
  -> run terminal
  -> hard-link publication + strict validator
```

Proxy capability 使用两段 module-private `WeakMap` 状态：preflight 结果只能消费一次，已消费 capability 也只能
在 marker reservation 边界 claim 一次。Plain object、clone、replay、cross-authority 与第二次 claim 均拒绝。

Source reader 要求固定分支、tracked source clean、`HEAD == upstream == remote`，并要求本地与远程
`refs/tags/phase-6-9-7-tutor-organizer-small-sample-s2-approved` 都指向同一 commit；同时重新计算 Tutor
prompt/schema/merger、Organizer prompt/schema/merger 和第一方 adapter SHA。该 tag 名称保留既有 contract，
但只允许未来独立 L2 admission 在已推送且 parity 的 S2 commit 上创建/绑定；G2 与 S2 都不创建该 tag，
所以 G2/S2 收口时 production L2 路径会在 approval/credential/marker 前 fail-closed。

`small-sample:cli` 与 `small-sample:live` 是同一固定 production 入口的显式别名，前者不是可绕过授权的
普通模式。G2 入口固定 `runScope=branch`；main replay 不属于 G2/S2 范围，仍由后续独立验收门阻断。

## 3. Runner、失败和取消

Runner 始终先执行全部 8 个 guard。任一 guard 不能证明 executor/dispatch/response/usage 四维全 0 时，16 条
runtime lane 全部保留在固定分母并写为 `not_started_quality_breaker`，不会启动 runtime。

Guard 全部通过后，8 个 pair 串行推进；同一 pair 的 Tutor 与 Organizer 使用独立 AbortController、hard
timeout、budget、wire capability 和 terminal。普通 semantic mismatch 不打开 breaker；transport、HTTP、schema、
usage、timeout、abort 或其它 contract failure 会先等待/收口 sibling terminal，再把后续 pair 写成
`not_started_quality_breaker`。成功 sibling 不会被失败 lane 的 category 覆盖。

外部父请求取消和 lane 内部 abort 已显式区分：

- 已进入的 lane 使用 `attempted_aborted / external_abort`；
- 尚未进入的后续 lane 使用 `not_started_external_abort`；
- lane 自身取消才使用内部 `abort`；
- 任一不完整 runtime 都使 semantic/latency/token/CNY aggregate 全为 `null`。

测试覆盖 transport、HTTP、schema、usage 四类 failure terminal，以及首失败后的 sibling success、14 条后续
not-started、semantic mismatch 继续跑满、精确 Tutor timeout 和父级运行中取消。

## 4. Journal、publication 与 recovery

Marker 使用 `wx` exclusive-create。Journal 的每条 record 都绑定 sequence、previous hash、record hash、marker
SHA 与固定 lineage；`lane_reserved` 必须先 fsync，wire stage 再按单调顺序记录。Lane、pair、run terminal 与
publication 都只有一个合法胜者。

Artifact 使用 temporary regular file + fsync + exclusive hard-link 发布。`publication_started` 一旦 durable，
后续 I/O failure 永久 fail-closed，禁止第二次 publication。Validator 不相信 artifact 自报 aggregate，而是从
marker、journal、source 和 embedded report 重新校验 entry order、runtime accounting、wire、usage、semantic、
费用、gate、logical SHA、journal terminal hash 与 physical artifact SHA。

Crash-only seal 只读取 marker/journal/claim 的 durable prefix，不运行 preflight，不读取 approval/credential，
不创建 harness/transport，不调用 Provider。活 owner 必须拒绝；死 owner 通过与 journal tail 绑定的 exclusive
claim 选出唯一 sealer。两个关键 recovery anchor 已固定：

1. 第一条 lane 已 durable reservation，而 sibling 尚未 reservation：只补 sibling 的零-wire reservation，
   当前 pair 两条 lane 立即写为 `attempted_aborted`；
2. 8 guards 已完成，而首对 lane 尚未 reservation：只为首对创建两条零-wire reservation 并立即
   `attempted_aborted`。

两种情况都把剩余 14 条 lane 写为 `not_started_quality_breaker`，随后生成 recovery-mode terminal 与证据。
这是对同一 attempt 的保守封存，不是 resume/replay/retry，也不会 backfill Provider response/usage/费用。
如果 runtime terminal 已 durable 但尚未 publication，recovery 只能原样发布既有 report，不能重写结论。

## 5. 文件系统与 lineage 边界

- 新 marker/report/artifact 拒绝 V1--V9、Architecture Recovery R3/R4 和 Canary V2 L1 identity；历史
  validator 也继续拒绝新 small-sample lineage。
- Validator 拒绝 truncated journal、CRLF、尾部空行、hash 重写、重复 recovery claim、隐藏 completion mode、
  非普通 marker 和额外正式文件。
- 路径围栏使用 root-bound `lstat + realpath + dev/ino`、ordinary-file 检查与写后 identity 复核。
- Node 没有跨平台 `openat/dirfd + O_NOFOLLOW`，因此同一用户主动并发换位仍是 trusted single-user
  workspace 下的极窄 TOCTOU 边界。该实现不宣称跨主机 lease、Provider exactly-once 或断电后的目录项
  durability。

## 6. 验证结果

```text
G2 focused:        32/32 tests, 857 assertions
G1 + G2 focused:   52/52 tests, 992 assertions
Agent full:        1027/1027 tests, 17337 assertions
Agent typecheck:   PASS
Agent lint:        PASS
baseline CLI:      same_bytes
baseline logical:  ad3aa54d61a5890c777358edebdfd3a65c6faa2ba7f68ff562afbad09259d002
baseline physical: e8bcbcb57afd23b9ec3dd8f3614550a13df629bd8105a4d350b5ada4b0aa658b
```

V1--V9 sealed bundle validators 全部保持 `ok=true / filesChecked=1`。Architecture Recovery R3 validator
保持 `ok=true`，artifact SHA 为
`56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4`；Canary V2 L1 validator
保持 `ok=true`，artifact SHA 为
`98368de16429923dafe99d8f60affdf74880adbfea59c78c5f66d7f1eec8a7e4`。项目根新的正式 L2
marker/journal/artifact/recovery claim 数量为 0。

## 7. 本阶段明确未做

- 未读取根 `.env`、任何 DeepSeek credential 或 runtime secret；
- 未调用 Provider，未执行正式 small-sample Mock/Live、48-case 或产品 API 探测；
- 未启动 Docker、API、Web 或可见浏览器；
- 未创建测试账号、Trace、数据库/对象存储业务数据或修改生产 gate；
- 未创建 S2 approved tag、正式 L2 marker/journal/artifact/recovery claim；
- 未合并 main，也未解锁 Phase 6.9.8、6.10、8、9 或博客收尾。

G2 authority 仅为 `zero_provider_runner_durability`。Synthetic fault tests 中的成功 publication 只发生在自动
清理的临时目录，不能证明真实 TutorAgent / WrongQuestionOrganizerAgent 语义、Provider 健康、产品 API/页面
可用或生产就绪。

## 8. 下一步

G2 当时的下一原子任务仅 S2，继续 zero-provider：建立 reviewed Mock factory，真实穿过 Tutor V6、
Organizer V9、第一方 adapter、strict validator、本地 merger 与本 G2 runner；完成 fresh baseline、fault
matrix、受影响全量静态门、历史 validator/SHA、正式 artifact=0、三路独立复审和无上下文 Reader Testing。

上述 S2 现已 zero-provider 完成；验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-s2-reviewed-mock-static.md`。S2 未创建 approved
tag、未读取 credential、未执行 L2。S2 独立提交并推送后仍停止在 L2 admission 门前；未来独立 L2
admission 才能在已推送且 parity 的 commit 上创建/绑定 tag，并仍需重新接受运行当时 DeepSeek 数据边界
与给出 exact confirmation。普通“继续”“开始”“同意”“所有权限”都不授权 L2。上述内容保留 G2/S2 当时
边界；后续唯一 L2 已按独立 admission 完成。

### 8.1 后续 L2 sealed checkpoint

唯一 run `6918df4f-a4ae-4de0-aa21-c7614ed5861d` 已以 guard `8/8`、runtime `16/16/0/0`、
strict/wire/verified usage `16/16/16/16`、Tutor/Organizer/Combined semantic
`0.9141666666666668 / 1 / 0.9570833333333334`、usage `7032/244`、费用 `0.02256 CNY` 通过并 durable
seal。Journal `180` 条并以 `evidence_published` 收口；validator `ok=true`，artifact SHA
`a1b51f...eb0d`，无 recovery claim。完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live.md`。

L2 的 `small_sample_semantic_gate` 不升级或改写 G2 的 `zero_provider_runner_durability` authority。8-pair 不
产生 P95/SLA/产品 authority；L2 不得重跑。其后 P2 已只在 zero-provider 边界冻结新的 full-gate durability
要求，F1/F2 已完成 full contract/baseline 与 runner/durability/evidence；三者不回写 G2 历史。当前下一任务
仅 S3 reviewed Mock/static，48-case Live、产品与 main 仍被阻断。P2/F1/F2 验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`、
`docs/acceptance/phase-6-9-7-tutor-organizer-f1-full-contract-baseline.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-f2-runner-durability-evidence.md`。

回顾时可以问：

- 为什么 public CLI 只允许 `args + AbortSignal`？
- 为什么 source reader 必须绑定未来 L2 admission 创建/绑定的 approved tag，而不能只检查当前 branch clean？
- 为什么 semantic mismatch 不开 breaker，contract failure 才开？
- 为什么 crash 后要为当前待锚定 pair 补零-wire reservation，而不是继续执行 candidate？
- 为什么 `publication_started` 后失败必须永久 fail-closed？
- 为什么 G2 全量测试通过仍不能证明 Agent 真实语义或进入 L2？
