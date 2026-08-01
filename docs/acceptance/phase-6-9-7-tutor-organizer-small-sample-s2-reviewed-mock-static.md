# Phase 6.9.7 Tutor / Organizer Small-sample S2 Reviewed Mock / Static 验收

## 1. 结论

Phase 6.9.7 Small Gate S2 已完成。该 checkpoint 在 **zero-provider** 边界内建立了可复核的 reviewed
Mock composition，真实穿过 Tutor V6、WrongQuestionOrganizer V9、本地 authority、strict validator、V6
merger、第一方 DeepSeek V4 Pro direct adapter 的 synthetic fetch seam，以及 G2 fixed-denominator runner。

正常 reviewed Mock 得到：

- guard `8/8` actual zero-call；
- runtime `16/16` strict success；
- wire executor/dispatch/response/verified usage `16/16/16/16`；
- Tutor / Organizer / Combined semantic `1 / 1 / 1`；
- critical / permission / mutation / broader fallback / locked-name / write-command failure 全为 `0`；
- gate 固定为 `mock_quality_not_evidence`。

该结果只证明本地工程合同、scorer 和安全降级链自洽；S2 本身不证明 DeepSeek 真实语义、Provider 稳定性、
产品 API/页面可用、生产就绪或 L2 已获授权。后续 L2 的独立结果见第 10 节。

## 2. 为什么需要 S2

G1 只冻结 manifest、deterministic baseline、report/scorer/gate；G2 只冻结 production CLI、source
authority、runner 与 evidence durability。两者都没有证明正式 candidate、adapter、validator 和 merger 串起来后，
scorer 观察到的 `actual` 真来自运行结果。

S2 关闭的核心风险是评测 oracle 污染：Mock responder 或 mapper 如果读取 `expected` 后直接合成
`actual*`，即使 candidate 输出错误，semantic 也会被伪造为 `1`。因此 S2 必须把 responder 输入、运行结果、
本地 authority 重建和后置 scorer 比较拆开。

## 3. Reviewed Mock composition

新增：

- `packages/agent/src/evals/phase-6-9-tutor-organizer-small-sample-mock.ts`；
- `packages/agent/tests/phase-6-9-tutor-organizer-small-sample-s2-reviewed-mock.test.ts`。

小样本 reviewed Mock identity：

```text
version: phase-6.9.7-tutor-organizer-small-sample-reviewed-mock-v1
sha256: 8fa86be5416815006b92761fb7b06c1a347fc37e55255a7eee49a417b19b7e6a
upstream V9 reviewed Mock:
  sha256:e0918cbfa23ee4463c569f49db69b026d97f47597ab7cf9621579bf10465bf08
```

执行链：

```text
frozen small-sample manifest
  -> G2 guard-first / pair-serial runner
  -> Tutor V6 candidate
       -> real bounded projection/prompt
       -> first-party direct adapter + in-process synthetic fetch
       -> strict schema
       -> local preferred-depth / pedagogy merger
  -> Organizer V9 candidate
       -> local legal option authority
       -> real bounded projection/prompt
       -> first-party direct adapter + in-process synthetic fetch
       -> exact questionIndex + optionIndex contract
       -> V6 validator + local merger
  -> rebuild actual from modelOwnedDecision + local authority
  -> recompute V6 semantic axes and cross-check runtime axes
  -> G1 scorer compares expected vs rebuilt actual
```

Synthetic responder 只读取真实 bounded system/user prompt；不读取 frozen `expected`、accepted topic labels、
case answer table、真实 owner/ID、credential 或写 command。`expected` 只在 candidate/validator/merger 返回后由
独立 scorer observation 使用。

## 4. Oracle 与本地 authority 修复

独立复审发现初版 mapper 会用 `entry.expected` 合成部分 `actual*`，并把 locked-name/write-command 安全字段
硬编码为 `false`。该版本未被接受。最终实现改为：

- Tutor 从真实 `modelOwnedDecision.intent`、本地 signal/preferred-depth authority 和
  `mergeTutorV6ModelDecision()` 重建完整 `TutorStrategy`；
- Organizer 从真实 model-owned decision、本地 V5 shortlist 与 canonical option authority 重映射
  subject/deck/topic ordinal，再执行 `mergeWrongQuestionOrganizerV6ModelDecision()`；
- 重建后的 model-owned decision 必须与 runtime decision canonical 一致；
- Tutor/Organizer semantic axes 由重建结果重新计算，并与 runtime axes 逐轴一致；
- locked-name 由实际 suggestion 与本地 `nameLocked` deck 原名比较；
- write-command shape 由严格 model-owned-decision schema 检测，不能伪造为安全零；
- 任一重建失败、axes drift 或写命令 shape 都以 `dynamic_authority` + critical failure 收口，semantic/usage
  aggregate 不生成。

同时修正 small-sample Live scorer 对现有本地 signals 的兼容识别：`question_semantic`、
`v6LocalShortlist`、`knowledge_point` 与 `error_type`。该修改只影响后置 evidence-code 观察，不改变
Provider、credential、adapter、budget、timeout 或 Live 调用边界。

## 5. Fresh baseline 与正常 Mock

Baseline CLI fresh check 返回 `same_bytes`：

```text
baseline authority: d36d0789a19b89f814f66130c6ca8e92ab7eaf76bde597ccba80454e93fd9f4e
logical report:      ad3aa54d61a5890c777358edebdfd3a65c6faa2ba7f68ff562afbad09259d002
physical file:       e8bcbcb57afd23b9ec3dd8f3614550a13df629bd8105a4d350b5ada4b0aa658b
```

一次无 artifact 的进程内 reviewed Mock observation 得到：

```text
guards / pairs / lanes / organizer decisions: 8 / 8 / 16 / 12
reserved / terminal / orphan / not-started:    16 / 16 / 0 / 0
wire executor / dispatch / response / usage:   16 / 16 / 16 / 16
strict runtime:                                16 / 16
Tutor / Organizer / Combined semantic:         1 / 1 / 1
Tutor / Organizer improvement:                 0.2929761904761905 / 0.7625
verified usage:                                5949 input / 180 output
synthetic estimated cost:                      0.018927 CNY
gate:                                          mock_quality_not_evidence
```

本次 8-sample 仍不生成 P95 authority；P95 字段保持 `null / insufficient_sample_size_8`。本机 synthetic
median/max 只是工程观测，不能外推 Provider 或产品延迟。

## 6. Fault、取消、并发与写隔离

S2 focused 覆盖：

- 25 类 transport / HTTP / response / schema / selection / usage fault；
- semantic axes drift 与 write-command-shaped decision；
- pre-abort 保持 runtime reservation/dispatch 为 0；
- mid-pair parent abort 只收口已 admission 的两条 lane，后续 14 lane 为 external-abort not-started；
- Tutor `3500ms` 与 Organizer `5000ms` hard timeout，各自保留已完成 sibling terminal；
- 单 lane 只 reserve/terminal 一次，无 retry、resume、replay、backfill 或额外 request；
- 首个 runtime contract failure 后固定分母仍为 16，后续 14 lane 不启动；
- runtime 不完整时 semantic/latency/token/CNY aggregate 全 `null`。

V9 上游 reviewed Mock fault matrix 继续覆盖 `wait_for_abort`、ignored sibling abort、selection negative matrix、
first/middle/last breaker 和 bounded no-raw diagnostic；S2 不复制另一套实现。

## 7. 验证结果

```text
S2 focused:                 35/35 tests, 603 assertions
G1 + G2 + S2 focused:       87/87 tests, 1595 assertions
Agent affected V6/V9/S2:    148/148 tests, 4764 assertions
Agent full:                 1062/1062 tests, 17953 assertions
AI full:                    323/323 tests, 2366 assertions
Types contract:             42/42 tests + tsc --noEmit
Web contract:               439/439 tests
Agent / AI typecheck+lint:  PASS
Web lint:                   PASS
Prettier / git diff --check: PASS
baseline CLI:               same_bytes
```

V1--V9 sealed bundle validators 均保持 `ok=true / filesChecked=1`。Architecture Recovery R3 validator 为
`ok=true / evidenceCount=1`，artifact SHA 仍为
`56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4`。Provider Canary V2 L1
validator 为 `ok=true / evidenceCount=1`，artifact SHA 仍为
`98368de16429923dafe99d8f60affdf74880adbfea59c78c5f66d7f1eec8a7e4`。

项目根正式 L2 marker、journal、artifact 与 recovery claim 数量为 `0`。

## 8. 独立终审与 Reader Testing

三路独立只读终审结果：

- composition/oracle：`APPROVED`；actual 已由真实 decision + local authority/merger 重建；
- security/permission：`APPROVED`；prompt 不含 oracle/credential/owner/真实 ID，locked-name/no-write 可观测；
- fault/concurrency：初审发现 Organizer `5000ms` timeout 缺专门测试，补齐后复审 `APPROVED`。

无上下文 Reader Testing 可用以下问题回顾：

1. **为什么 Mock semantic 1/1/1 仍不能执行 L2？** 因为 provenance 是 `mock_synthetic`，gate 固定
   `mock_quality_not_evidence`，没有真实 Provider 质量 authority。
2. **如何防止 responder 偷看答案？** Responder 只读实际 bounded prompt；expected 仅在运行链完成后进入
   scorer。测试同时扫描 responder source 与真实 request bytes。
3. **如何证明 actual 不是 expected 的复制？** Actual 从 model-owned ordinal、local authority 和正式 merger
   重建，并必须通过 runtime semantic axes 交叉核验。
4. **为什么 timeout 要分别测 3500/5000ms？** Tutor 与 Organizer 是独立 lane/预算/时限；一条超时不能
   抹掉或复制另一条已完成 sibling 的终态。
5. **为什么 S2 不创建 approved tag？** S2 只冻结 zero-provider checkpoint。未来 L2 admission 必须在新的
   数据边界接受与 exact authorization 下，单独把已推送的 S2 commit 绑定到 source tag；当前不得预授权。

## 9. 明确未做与下一门

本阶段没有：

- 读取根 `.env`、DeepSeek credential 或任何 runtime secret；
- 调用 Provider、执行 small-sample L2/48-case、Live/seal/recovery 或追加网络探测；
- 创建 S2 approved tag、正式 L2 marker/journal/artifact/recovery claim；
- 启动 Docker、API、Web server 或可见浏览器；
- 创建测试账号、Trace、数据库/MinIO/Redis 业务数据或修改生产 gate；
- 合并 main 或解锁 Phase 6.9.8、6.10、8、9 与博客收尾。

S2 收口时要求提交并推送后停止在未来 L2 admission 门。L2 仍需运行当时重新接受 DeepSeek 当前账号数据边界、
给出冻结 exact confirmation，并由独立 source/tag admission 证明 pushed commit、远程 parity、tracked clean、
历史 evidence parity 与 formal artifact=0。普通“继续/开始/同意/所有权限”不构成 L2 授权。

## 10. 后续唯一 L2 sealed checkpoint

上述第 7--9 节保留 S2 收口时的 zero-provider 事实，不回写成 S2 已调用 Provider。S2 commit 推送后，独立
L2 admission 将 approved source/tag 固定到
`4c6084455d0cea6b4a5ddd94511bce29c22af1c4`，并在 fresh 数据边界接受与 exact authorization 下执行唯一
run `6918df4f-a4ae-4de0-aa21-c7614ed5861d`。

L2 得到 guard `8/8`、runtime reserved/terminal/orphan/not-started `16/16/0/0`、strict/wire/verified usage
`16/16/16/16`，Tutor/Organizer/Combined semantic
`0.9141666666666668 / 1 / 0.9570833333333334`，usage `7032/244`、费用 `0.02256 CNY`，安全失败全 0。
最终 gate 为 `small_sample_quality_gate_passed`，authority 为 `small_sample_semantic_gate`。

Journal `180` 条并以 `evidence_published` 收口；validator `ok=true`，artifact SHA `a1b51f...eb0d`，无
recovery claim。8-pair P95 仍为 `null / insufficient_sample_size_8`。完整证据见
`docs/acceptance/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live.md`。

L2 不得重跑或追加 Provider 探测，approved tag 不随文档提交移动。其后 P2 已 zero-provider 完成 full-gate
design，并保持 S2/L2 authority 不变。当前下一任务仅 F1 full contract/baseline；不得直接执行 48-case Live、
产品 Docker/API/browser 或 main。P2 验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-p2-zero-provider-full-gate.md`。
