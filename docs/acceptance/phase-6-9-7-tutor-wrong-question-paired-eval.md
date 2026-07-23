# Phase 6.9.7 Task 9 — Tutor / WrongQuestionOrganizer strict paired eval

日期：2026-07-23

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：72-case strict paired runner、一次性 CLI 与 evidence validator 已完成；Mock 工程门通过，两个生产 gate 仍默认关闭，未调用真实 provider，未执行 controlled-Live、Docker 产品或可见浏览器验收

## 1. 为什么需要这一任务

Task 1 的 deterministic baseline 只说明现有规则在冻结数据集上的起点，不能证明 Task 3--8 的 candidate guard 真的会阻止不安全调用，也不能证明 runtime 失败后仍保留固定分母。若报告直接接受调用方自报的 zero-call、usage、价格或延迟，Mock 满分就可能被误写成真实模型质量结论；若 Live 测试执行器没有来源身份，合成 executor 还可能伪装成 DeepSeek authority。

Task 9 因此建立同一份可复算合同：zero-call 必须实际穿过生产 candidate/preflight guard，runtime 必须按固定 pair 并发且失败不删样本，报告必须重算 dataset、schema、语义指标、P95、usage 与 CNY。Mock 只验证工程合同；只有后续获得一次新的明确授权并由真实网络 executor 产生的 Live 报告，才有资格进入 production quality gate。

## 2. 固定合同与执行方式

### 2.1 Dataset 与分母

- dataset：`phase-6.9-tutor-wrong-question-v1`；
- SHA-256：`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`；
- Tutor：12 条 zero-call + 24 条 runtime；
- WrongQuestionOrganizer：12 条 zero-call + 24 条 runtime；
- 24 个 `pairedRunIndex=0..23`，每个 index 同时执行一个 Tutor 与一个 Organizer runtime；
- Organizer 固定 32 个 decision units；
- 任一 schema、usage、timeout、runtime 或质量失败仍留在 48 条 runtime 分母中。

### 2.2 Zero-call 不是自报值

24 条 zero-call 不把 expected reason 传给执行结果，也不接受 fixture 自报“没有调用”。Tutor case 实际进入 `runTutorModelCandidate()`；Organizer case进入 server-preflight 或 `runWrongQuestionOrganizerModelCandidate()`。独立 executor counter 必须为 0，runner 再从 candidate observation 或独立 preflight 条件推导 observed reason，并与冻结合同比对。

覆盖的拒绝边界包括：非 Tutor route、五类明确教学指令、空输入、abort、预算不足、credential、instruction override、hostile accessor、已有 Organizer item、精确专题、高置信结构字段、组件 gate/global Live 关闭与 owner mismatch。

### 2.3 Runtime、指标与费用

- 48 条 runtime 组成 24 次 `Promise.all` 并发 pair；
- Tutor semantic 固定重算 intent macro-F1、depth、context use 与 pedagogy policy；
- Organizer semantic 固定重算 subject、deck action、existing-deck precision、topic-label macro-F1 与 evidence/confidence；
- 每条 usage 必须是正安全整数，Tutor 不超过 `1200/300` 与 `0.006 CNY`，Organizer 不超过 `3500/800` 与 `0.016 CNY`，每个 pair 不超过 `0.022 CNY`；
- 价格固定为 `deepseek-v4-pro-cny-2026-07-15`，按 input `3 CNY/M`、output `6 CNY/M` 重算；未知价格、`0/0`、被篡改费用或总 cap 超限均不能通过；
- production gate 只接受 `mode=live + provider=deepseek + model=deepseek-v4-pro + executorProvenance=deepseek_network`。`mock_synthetic` 与 `synthetic_test` 即使 48/48 且语义满分也固定 `quality_gate_failed`。

### 2.4 延迟窗口的准确边界

报告包含四组 nearest-rank P95：Tutor candidate、Organizer candidate、paired candidate 与 Tutor orchestration。

`tutorOrchestrationP95Ms` 从本地 `buildTutorStrategy()` 开始，到 Tutor candidate strict 结果与本地 merger 就绪为止；它包含 Tutor 的本地策略准备和 candidate，不包含真实 Router model、`/api/chat` HTTP、认证、RAG、Verifier、最终 Chat 模型或流式传输。因此它不是“Chat 产品 P95”，也不能替代 Task 12 的 Docker/API 与可见浏览器产品验收。Task 9 终审已把此前会造成过度宣称的 `chatProduct*` 字段改为 `tutorOrchestration*`。

## 3. 一次性 CLI 与不可变证据

Mock 命令可重复生成独立报告，但永远不打开生产 gate。Live CLI 还要求：

```text
PHASE_6_9_7_CONTROLLED_LIVE_APPROVED=true
I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_CONTROLLED_LIVE_ONCE
AI_PROVIDER_MODE=live
AI_ENABLE_LIVE_CALLS=true
TUTOR_AGENT_MODEL_ENABLED=true
WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED=true
两条 component-specific credential
其它已模型化 Agent gate=false
```

Live 在 executor/provider 前以 `wx` 独占创建 `.tmp/phase-6-9-7-tutor-organizer-controlled-live.marker`；第二次尝试固定拒绝。报告先写临时文件，再用 hard link 发布精确的 `scope/mode/runId` 文件名，目标已存在时不覆盖。stdout 只返回版本、聚合 counts/metrics/P95/usage/CNY、gate 与 evidence path，不返回 prompt、题目/答案正文、provider body/header、credential、URL、cookie、token、真实 ID、stack 或 raw error。

公共 Live CLI 不再接受注入 executor。无网络测试使用显式 test-only 入口并固定 `executorProvenance=synthetic_test`；contract 允许验证 marker/聚合输出，却永远不能得到 `quality_gate_passed`。真实 CLI 自建 DeepSeek executor 时才写 `deepseek_network`。

## 4. Mock 结果

两次新合同 Mock CLI 输出相同聚合结果，分别通过精确文件名 validator；报告文件随后按已记录的两个精确路径删除，没有清空 `.tmp`，也没有创建或删除 Live marker。

| 指标 | 结果 |
| --- | ---: |
| verified zero-call | `24/24` |
| strict runtime | `48/48` |
| Tutor semantic | `1` |
| Organizer semantic | `1` |
| combined semantic | `1` |
| Tutor candidate P95 | `246ms` |
| Organizer candidate P95 | `328ms` |
| paired candidate P95 | `328ms` |
| Tutor orchestration P95 | `276ms` |
| synthetic input/output | `21948 / 5647` |
| synthetic estimated cost | `0.099726 CNY` |
| executor provenance | `mock_synthetic` |
| production gate | `quality_gate_failed` |

这里的 `quality_gate_failed` 是 Live-only authority 设计，不是 Mock contract 失败。Mock token、费用与延迟是固定合成观测，只用于验证重算和 evidence contract，不是供应商账单或真实网络性能。

## 5. 验证证据

| 验证项 | 结果 |
| --- | --- |
| Task 9 focused contract/runner/CLI/validator | `14/14` |
| Agent full | `543/543` |
| Agent typecheck / lint | exit 0 / exit 0 |
| AI full | `194/194` |
| AI typecheck / lint | exit 0 / exit 0 |
| Mock CLI | 两次 PASS |
| 两份 Mock evidence bundle validator | `ok=true / filesChecked=2` |
| `git diff --check` | exit 0 |

重点回归包括：

- duplicate case、缺失分母、未知字段、价格/usage 篡改和 `0/0` 均被拒绝；
- expected reason 不能直接回显为 zero-call 证据；
- runtime throw 仍保留原 case 与 decision 分母；
- duplicate/cross-scope runId、filename/mode/scope mismatch 与敏感字段被拒绝；
- 缺授权、配置不完整、generic credential、其它 Agent gate 同开在 marker/executor 前失败；
- synthetic Live 测试报告固定携带 `synthetic_test`，即使语义满分也不能通过生产 gate；
- second marker attempt 不产生第二轮 executor invocation。

## 6. 本任务没有完成什么

- 没有读取根 `.env`、API key 或 provider credential；
- 没有调用 DeepSeek，没有创建 controlled-Live marker 或 Live evidence；
- 没有证明真实模型语义质量、真实 token/CNY 或真实网络 P95；
- 没有启动、重建或清理 Docker 服务、镜像、容器、数据库、Redis、MinIO 或 volume；
- 没有执行 Tutor Chat、Organizer single/batch API 或可见 `/chat`、`/error-book` 产品验收；
- 没有打开两个生产 gate，也没有证明 Phase 6.9.7、全部 Agent、可执行 LangGraph 或 Phase 6 已完成。

## 7. 下一步与回顾问题

下一任务是 Task 10：固定 Docker allowlist、环境变量示例、API/worker 角色隔离和运维回滚说明。Task 10 仍不得读取 credential、调用 provider、启动产品 Docker 或执行浏览器验收；Task 11 完成分支静态/Mock checkpoint 后，才重新向用户申请 Task 12 唯一 controlled-Live 授权。

回顾时可以问：

- 为什么 deterministic baseline 的零 provider 调用不能替代 24 条 guard zero-call？
- 为什么 runtime throw 也必须保留在 48 条分母中？
- 为什么 Mock 满分仍是 `quality_gate_failed`？
- 为什么 synthetic Live executor 必须有独立 provenance，且永远不能打开生产 gate？
- 为什么 Tutor orchestration P95 不能叫 Chat 产品 P95？
- hard-link evidence publish 与一次性 marker 分别防什么？
- 为什么 Task 9 完成后仍不能直接执行 controlled-Live？
