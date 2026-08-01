# Phase 6.9.7 Tutor / Organizer S3 Reviewed Mock / Static 验收

日期：2026-08-01

状态：S3 已完成并通过 zero-provider checkpoint；下一步仅独立 L3 admission

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论与 authority

S3 已把 F1 的完整 72-entry contract 与 F2 的 one-shot runner 接到 reviewed Mock composition。48 条
runtime lane 真实穿过 Tutor V6、WrongQuestionOrganizer V9、第一方 DeepSeek V4 Pro direct adapter 的
synthetic fetch seam、strict validator、本地 authority/merger 与 F2 fixed-denominator runner；24 条 guard
实际保持 zero-call。

```text
checkpoint: phase-6.9.7-tutor-organizer-full-gate-s3
lineage: phase-6.9.7-tutor-organizer-full-gate-v1
factory: phase-6.9.7-tutor-organizer-full-gate-reviewed-mock-v1
factory SHA-256: sha256:53bcf0d4378f9a6c36b867053201f41bebbc7b05bf14f94edd0f24fc9f22da55
mode / provenance: mock / mock_synthetic
gate: full_gate_mock_quality_not_evidence
qualityAuthority: none
global fetch / Provider calls / credential reads: 0 / 0 / 0
approved tag / formal marker / journal / artifact / recovery claim: 0 / 0 / 0 / 0 / 0
```

该结果证明本地 composition、质量计算、持久化合同和失败收口在完整固定分母上自洽；它不是 DeepSeek
Provider quality、真实模型语义、账单、产品 API/页面、SLA 或生产可用性证据。

## 2. 本次交付

新增：

- `packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-mock.ts`；
- `packages/agent/tests/phase-6-9-tutor-organizer-full-gate-s3-reviewed-mock.test.ts`。

Reviewed factory 复用 S2 已审阅的真实 candidate/validator/local-merger chain，只把结果 envelope 适配到
F2 full-gate runner。Factory 启动时强制检查 small/full pricing、hard timeout 与每 lane budget parity；fault
输入必须同时满足已知 fault、已知 runtime case 和 Agent 兼容，未知或拼写错误 fault 直接 fail-closed。

生产 Live harness 没有导入 reviewed Mock factory；Mock factory 不读取 `process.env`，不接受 URL、model、
credential、clock 或 production executor 注入，也不读取 expected/oracle answer table。Synthetic responder 只读
实际 bounded system/user prompt，actual 由 model-owned decision 与本地 authority/merger 重建后再交给 scorer。

## 3. 正常 full-gate observation

正常进程内 run 的固定结果：

| 项目                     | 结果                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| Manifest                 | `72 entries / 24 guards / 24 pairs / 48 runtime lanes / 32 Organizer decisions` |
| Guard                    | `24/24` actual zero-call                                                        |
| Runtime accounting       | reserved/terminal/orphan/not-started `48/48/0/0`                                |
| Wire                     | executor/dispatch/response/verified usage `48/48/48/48`                         |
| Strict runtime           | `48/48`                                                                         |
| Tutor semantic           | `1`                                                                             |
| Organizer semantic       | `0.9968750000000001`，`31/32` full matches，invalid `0`                         |
| Combined semantic        | `0.9984375000000001`                                                            |
| L2 anchor subset         | Tutor/Organizer/Combined `1/1/1`，passed                                        |
| Latency                  | 四项均为完整 `24` 样本并低于冻结 P95 cap                                        |
| Synthetic usage          | input/output `17732/504`                                                        |
| Synthetic estimated cost | `0.05622 CNY`，低于 `0.55 CNY` cap                                              |
| Safety                   | critical/permission/mutation/broader fallback/locked-name/write leak 全 `0`     |
| Gate                     | `full_gate_mock_quality_not_evidence / qualityAuthority=none`                   |

这里的 `providerInvocations=48` 和四维 wire 只描述 synthetic harness 内的受控 invocation；global fetch spy 为
`0`，因此不能把它写成 48 次外部 Provider 请求。Synthetic token、费用与本机 P95 也不能写成 Provider 账单
或产品 SLA。

## 4. Durability 与任务不丢失

S3 在系统临时隔离目录运行完整 publication，并由 F2 strict validator 从 bundle 重算通过：

- `guard_terminal=24`；
- `lane_reserved=48`；
- `wire_stage=384`，即 48 lane × 8 stages；
- `lane_terminal=48`；
- `pair_terminal=24`；
- 尾部固定为 `run_terminal -> publication_started -> evidence_published`；
- physical artifact SHA 与 publication 返回值一致。

临时 bundle 在测试后精确删除；仓库正式 full-gate marker/journal/artifact/recovery claim 始终为 0。S3 不执行
production CLI、Live、seal 或 recovery，也不创建或移动 approved tag。

## 5. Fault、并发与安全边界

Focused matrix 共 `14/14` 通过，覆盖：

- Organizer transport、HTTP rate limit、malformed JSON、ordinal type drift 与 invalid usage；
- post-candidate semantic axes drift 与 write-command leak；
- contract failure 收口 sibling、打开固定 breaker，并让后续 46 lane 保持
  `not_started_quality_breaker`；
- 普通 semantic mismatch 保留完整 48 分母且不提前 breaker；
- pre-abort 保持 runtime reservation、wire 和 synthetic request 全为 0；
- locked-name/no-write authority；
- unknown case、unknown fault、Agent 不兼容 fault 和非法 contract fault 全部 fail-closed；
- actual prompt 不含 case id、expected intent/depth、owner id 或 credential 名；Live source 不导入 Mock factory。

## 6. Static 与历史证据复核

本次已完成的验证结果：

| 范围                       | 结果                                                         |
| -------------------------- | ------------------------------------------------------------ |
| S3 focused                 | `14/14`                                                      |
| Agent full                 | `1122/1122`，20759 assertions，133 files                     |
| Agent typecheck / lint     | 通过 / 通过                                                  |
| AI full                    | `323/323`，2369 assertions                                   |
| AI typecheck / lint        | 通过 / 通过                                                  |
| Types tests / typecheck    | `42/42` / `tsc --noEmit` 通过                                |
| Web tests                  | `439/439`                                                    |
| Server build / lint        | 通过 / 通过                                                  |
| Server non-database suites | 226 suites、2153 tests 通过                                  |
| F1 baseline focused        | `14/14`                                                      |
| V1--V9 sealed validators   | 全部 `ok=true / filesChecked=1`                              |
| Recovery R3 validator      | `ok=true`，7 journal records，`evidence_published`           |
| Canary V2 L1 validator     | `ok=true`，12 journal records，`evidence_published`          |
| Small-sample L2 validator  | `ok=true`，180 journal records，artifact SHA `a1b51f...eb0d` |
| L2 approved tag parity     | local/remote 均为 `4c6084455d0cea6b4a5ddd94511bce29c22af1c4` |
| Formal full-gate files     | marker/journal/artifact/recovery claim 全 `0`                |

两个环境事实必须如实保留：

1. `@repo/types lint` 在该包运行时找不到 `eslint`，因此本次不能写成 Types lint 通过；tests 与
   `tsc --noEmit` 已通过。该问题是既有 package/PATH 边界，不是 S3 放宽。
2. Server 完整 Jest 的数据库集成套件因本机 PostgreSQL `127.0.0.1:5433` 未启动而失败；非数据库 suites、
   build 与 lint 已通过。本 S3 不授权启动 Docker，因此没有把数据库未运行包装成全量通过。

## 7. AI CLI / CommonJS 回归修复

Server 全量回归发现 `@repo/ai` 共享 runtime barrel 会重导出四个可执行 CLI；Nest/Jest 的 CommonJS 路径
因此会解析 CLI 内 `import.meta` / top-level await。修复后：

- `packages/ai/src/index.ts` 只导出可复用 runtime/contract，不再导出四个 executable CLI；
- CLI 文件与 package scripts 保留，命令行能力没有删除；
- 三个 CLI 测试改为直接导入对应 CLI 文件；
- C2 测试固定共享 barrel 不得重新暴露这些 CLI-only symbols。

修复后的 Server 非数据库全量、AI full/typecheck/lint 均通过；剩余 Server 失败只有未启动 PostgreSQL 的数据库
集成套件。

## 8. 最终只读复审

三路独立终审均为 `APPROVED`，无 P0--P2：

- contract/security reviewer 复核 candidate/adapter/validator/merger、固定分母、fault/abort/breaker、
  durability、Mock authority 与 CLI barrel，并合跑 S3 + R2/R3/C2 CLI focused `37/37`；
- docs/scope reviewer 复核所有相关开发文档、历史 sealed 边界、环境失败事实、链接与 `.codex/` 排除范围；
- 无上下文 Reader Testing 可仅凭 README、AGENTS、roadmap、dev-start、data-flow 与本页唯一回答 S3
  做了什么、没有证明什么、当前下一步、不可重跑历史、安全复核命令与 L3 新授权要求。

## 9. 本阶段未做

S3 没有读取根 `.env` 或 credential，没有调用 Provider，没有创建/移动
`phase-6-9-7-tutor-organizer-full-gate-s3-approved` tag，没有创建正式 full-gate bundle，没有运行 Docker/API/
浏览器，没有创建测试账号、Trace 或业务数据，没有合并 main，也没有推进 Phase 6.9.8/6.10/8/9。

## 10. 下一步与停止门

S3 独立提交并推送后必须停止。下一任务仅独立 L3 admission；该 admission 仍须在未来当前任务中重新取得：

- fresh DeepSeek 当前账号数据保留/训练边界接受；
- exact authorization
  `I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_FULL_GATE_L3_CONTROLLED_LIVE_ONCE`；
- 已推送 commit、HEAD/upstream/remote 与未来 approved tag parity；
- fresh zero-provider proxy preflight、七个 source SHA 与历史 sealed evidence parity；
- 专用 L3 credential 和正式 full-gate artifact=0。

普通“继续/开始/同意/所有权限”不是 L3 authorization。L3 即使通过也只形成 full-gate semantic authority；
产品 Docker/API/可见浏览器与 main 仍需后续独立 R6/R7 验收。

## 11. 回顾问题

- 为什么 48 次 synthetic invocation 不能写成 48 次 Provider call？
- 为什么 full/anchor semantic 和四项 P95 全过，gate 仍是 `mock_quality_not_evidence`？
- 为什么 unknown fault 必须拒绝，而不能静默当成无故障？
- 为什么 shared runtime barrel 不应重导出带副作用的可执行 CLI？
- 为什么 S3 完成后还不能直接创建 approved tag 或执行 L3？
