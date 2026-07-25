# Phase 6.9.7 Tutor / WrongQuestionOrganizer V4 R4 验收记录

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

范围：R4 independent robustness 与独立 V4 evidence lineage；zero-network。

## 1. 结论

V4 R4 已完成。Tutor/Organizer 的 V4 语义规则不只通过冻结 72-case 回归，还通过了与该数据集
隔离的 held-out/metamorphic/schema-negative 测试；实际 candidate prompt 没有泄漏 case ID、
expected、accepted-label、oracle 或冻结答案表。V4 runner/report/CLI/validator、marker、journal、
recovery claim 与 evidence publication 已使用新的 identity，并与 V1/V2/V3 双向隔离。

本结论只证明 R4 工程合同。没有读取 credential、调用 Provider、创建 V4 Live artifact、启动产品
Docker/API/浏览器或修改业务数据。Phase 6.9.7 仍未完成；下一步仅 R5 static/Mock checkpoint 与
独立终审。R5 通过后仍必须取得新的精确一次性 V4 branch controlled-Live 授权。

## 2. Independent robustness

新增 fixture：

- `packages/agent/tests/fixtures/phase-6-9-tutor-wrong-question-v4-independent-robustness-v1.ts`
- version：`phase-6.9.7-v4-independent-robustness-v1`
- 不导入冻结 dataset expected、accepted-label 表或 V3 失败题目；
- relation/变形输入与 72-case semantic authority 分离，不计入未来 Live 分数。

覆盖矩阵：

| 域        | 已验证边界                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------- |
| Tutor     | 中英/混合改写、否定、干扰句、active-context reorder、primary-signal conflict、intent precedence |
| Organizer | known/unknown subject、authority drift、question/deck reorder、locked name、cross-subject deck  |
| Schema    | ordinal 越界/重复、topic/evidence/confidence 不一致、未知字段、unsafe projected content         |
| Runtime   | 两 lane abort/预算隔离、single dispatch、no retry、输入字节不被改写                             |
| 权限      | Tutor 无最终答案/route/tool/write；Organizer 无真实 ID/owner/直接写库或 locked-name 覆盖        |
| 防泄漏    | 扫描实际 V4 system/user prompt 中的 case ID、expected、accepted-label、oracle 与冻结答案表      |

Negative fixture 均在 validator/merger 边界 fail-closed；本地 merger 不补 evidence、不修正越权
subject、不清洗 unsafe topic，也不把模型结果升级为写权限。

## 3. 独立 V4 runner 与 evidence identity

新增或完成：

- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v4-contract.ts`
- `packages/agent/src/evals/run-phase-6-9-tutor-wrong-question-v4-paired.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v4-cli.ts`
- `packages/agent/scripts/validate-phase-6-9-7-tutor-wrong-question-v4-evidence.ts`
- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v4-durability-contract.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v4-durability.ts`
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-v4-journal-lifecycle.ts`

冻结 identity：

| 维度              | V4 值                                                          |
| ----------------- | -------------------------------------------------------------- |
| runner            | `phase-6.9.7-tutor-organizer-runner-v4`                        |
| runtime evidence  | `phase-6.9.7-v4-runtime-evidence-v1`                           |
| marker            | `phase-6.9.7-v4-live-marker-v1`                                |
| journal           | `phase-6.9.7-v4-journal-v1`                                    |
| recovery claim    | `phase-6.9.7-v4-recovery-claim-v1`                             |
| evidence envelope | `phase-6.9.7-v4-evidence-envelope-v1`                          |
| Tutor prompt      | `tutor-model-candidate-v4`                                     |
| Organizer prompt  | `wrong-question-organizer-model-candidate-v4`                  |
| approval env      | `PHASE_6_9_7_V4_CONTROLLED_LIVE_APPROVED`                      |
| confirmation      | `I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V4_CONTROLLED_LIVE_ONCE` |
| marker path       | `.tmp/phase-6-9-7-tutor-organizer-v4-controlled-live.marker`   |

内存调度可以复用 V3 已通过的 guard-first、双 lane、breaker 与固定分母原则，但瞬时结果会立即投影为 V4
entry/report；持久化回调只接收 V4 identity。V4 report 继续固定 `72 total / 24 guard / 48 runtime`，
guard failure 保持 runtime 实际零 dispatch，首个 runtime contract failure 只收口当前 pair 后打开
breaker；semantic-only mismatch 不提前停止。

## 4. Crash-safe durability

V4 没有调用 V3 durability 导出或写入 V3 路径。独立实现验证：

1. marker 通过 `wx` 只允许一个进程获得一次性 run identity；
2. journal 初始化在 executor 创建前 append + fsync；每个 `dispatch_started` 在调用前 append + fsync；
3. `sequence + previousRecordSha256 + recordSha256` 验证 guard、dispatch、runtime/pair terminal、
   breaker、run completed 与 evidence sealed 状态机；
4. 活 marker owner 不能被误封；dead owner 只允许一个 recovery claim 接管；
5. takeover 后旧 owner token 被 fence，ABA claimant 不能覆盖新 owner；
6. dispatch 无 terminal 保守封存为 attempted orphan/unknown usage；从未 dispatch 保持
   not-started/absent usage；永不 resume/replay/retry；
7. evidence 使用随机 temp `wx`、fsync 和 hard-link final；same bytes 幂等，different bytes 拒绝覆盖；
8. hash tamper、乱序、重复 terminal、cross-version journal/evidence 全部 fail-closed。

V4 `live` CLI 即使获得解析层确认词和 approval env，在 R6 前仍固定返回
`live_not_available_before_r6`。R4 因而不能意外创建网络 executor、marker、journal 或 Live evidence。

## 5. 历史不可变性

R4 修复了一处历史 identity 漂移：`PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2` 重新固定为
`wrong-question-organizer-model-candidate-v2`。此前该 V2 常量错误跟随当前产品 V4 常量，会让封存
V2 evidence validator 把当前代码 identity 错当成历史 identity。修复只恢复旧常量，不重建或改写
任何历史 artifact。

只读 SHA-256 复核：

| artifact    | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| V1 evidence | `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` |
| V1 marker   | `7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb` |
| V2 evidence | `0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77` |
| V2 marker   | `ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504` |
| V3 evidence | `e24f4e6dd6fc0d0621eee672210b86fe8fbf5dce4664b1184726319b8e22d25c` |
| V3 journal  | `df141874f9bdb0caffac16bf7d930a64d97dd5521e0c06e5db0ec3dd406d6cff` |
| V3 marker   | `b18a7688494c250cd3f7dc0376f49d5712377240bdc1bd86e9d8dd9a3d8be412` |

V1/V2/V3 file/bundle validator 均通过；旧 report 不接受 V4 字段，V4 validator 也拒绝旧版本。历史
marker/journal/evidence bytes 没有被删除、覆盖、重命名、重建或拼接。

## 6. 验证结果

| 门禁                   | 结果                       |
| ---------------------- | -------------------------- |
| V4 durability          | `6/6`，`41 expect()`       |
| R4/V3 focused          | `68/68`，`548 expect()`    |
| Agent full             | `674/674`，`7094 expect()` |
| Agent TypeScript       | 通过                       |
| Agent lint             | 通过                       |
| V1/V2/V3 validators    | 通过                       |
| 七个历史 artifact SHA  | 与封存值一致               |
| Provider/network calls | `0`                        |
| V4 Live artifacts      | `0`                        |

两路只读终审结果：

- contract/security/concurrency：PASS，无 Critical/Important；
- docs/history/operations/fresh-reader：PASS，无 Critical/Important。

可回放的核心零网络命令：

```powershell
bun test packages/agent/tests/phase-6-9-tutor-wrong-question-v4-independent-robustness.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v4-lineage.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v4-durability.test.ts
bun test packages/agent/tests/phase-6-9-tutor-wrong-question-v3-contract.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v3-runner.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-v3-durability.test.ts
bun test packages/agent/tests
bun run --cwd packages/agent typecheck
bun run --cwd packages/agent lint
```

这些命令只使用 Mock/synthetic executor 与临时目录；不要为 R4 设置 component credential 或执行
`eval:phase-6-9-7:v4:live`。

## 7. 明确未做

- 未读取根 `.env`、component credential 或 Provider 数据；
- 未调用 DeepSeek 或其它真实模型；
- 未创建 V4 Live marker/journal/recovery claim/evidence；
- 未启动或重建 Docker service、API 或可见浏览器；
- 未创建 synthetic 用户/错题/Trace/session；
- 未修改 PostgreSQL、Redis、MinIO、Docker container/image/volume 或业务数据；
- 未执行 R5、R6、产品验收、Task 13/main、Phase 6.10 或博客收尾。

## 8. 下一步与回顾入口

唯一下一步是 R5 static/Mock checkpoint：fresh V4 Mock、breaker/failure Mock、受影响全量静态门、
Organizer PostgreSQL E2E、Compose default-off boundary、V4 Live artifact/recovery claim 为 0、历史 SHA/
validator、两个 gate=false、两路独立终审与 fresh-reader 文档测试。

R5 全部门通过后必须停止。用户可以这样继续询问：

- “按计划执行 Phase 6.9.7 V4 R5 static/Mock checkpoint，完成独立终审，但不要调用真实模型。”
- “R4 为什么可以复用 V3 调度原则，却必须使用独立 marker/journal/evidence？”
- “orphan seal、recovery claim 和 ABA fence 分别防止什么问题？”
- “为什么 actual-prompt 防泄漏通过仍不能证明真实模型语义质量？”
- “R5 通过后，还需要什么精确授权才能执行唯一 V4 controlled-Live？”
