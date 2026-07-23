# Phase 6.9.7 Task 8 — WrongQuestionOrganizer API 与来源状态

日期：2026-07-23

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：strict request-level runtime 与 `/error-book` 来源状态已完成；生产 gate 仍关闭，未调用真实 provider，未执行 controlled-Live、Docker 产品或可见浏览器验收

## 1. 为什么需要这一任务

Task 7 已让 Organizer 的受治理 candidate 可以穿过 owner snapshot、Trace admission 和本地授权 command，但产品 response 还无法安全回答“这次整理是语义候选、本地规则，还是模型失败后的安全回退”。如果直接把内部 runtime/Trace 原样透传，客户端会接触 token、费用、provider error、prompt、真实 ID 映射等不属于产品合同的字段；batch 若逐题返回模型细节，也会制造一次请求存在多个互相冲突来源的假象。

Task 8 因此只发布一个严格、可解释的 request-level 结论。它不打开模型 gate，也不改变组织层写权限：模型是否尝试、是否通过 admission 与最终数据库事实仍由 Task 6/7 的本地边界决定；前端只展示已经被服务端收口后的安全状态。

## 2. 完成内容

### 2.1 Strict shared API contract

single 与 batch response 顶层统一返回：

```text
runtime = {
  source: local_deterministic | hybrid_model
  disposition: 固定枚举
  degraded: boolean
  traceId?: string
}
```

- `hybrid_model` 只允许 `candidate_applied + degraded=false + persisted traceId`；
- 正常 gate-off、高置信或不满足 candidate eligibility 的 zero-call 路径为 `local_deterministic + degraded=false`；
- safety、schema、budget、usage、timeout、abort、stale、Trace 或 runtime 失败为 `local_deterministic + degraded=true`；
- 本地 runtime 不允许携带 `traceId`，`candidate_applied` 不能伪装成本地或降级状态；
- schema 使用 `.strict()`，拒绝 provider error、API key、token、费用、prompt、owner/question/deck 映射和所有未知字段；
- single 在 organized item 外携带 runtime；batch 只在 request 顶层携带一次，逐题 item 不包含 runtime。

### 2.2 Batch 来源聚合

```text
candidate scope（最多 12 条）
  -> 得到 request-level runtime
  -> deterministic remainder 分批执行本地 command
  -> 只合并 items，不覆盖 candidate scope runtime
```

若 candidate 成功并通过 Trace admission 与授权 command，即使同一 batch 还有本地 remainder，response 仍是 hybrid；若 candidate 失败，后续本地 remainder 也不能把 degraded 覆盖成正常本地状态。command 返回并发用户 authority 时，已有用户事实继续作为输出权威；候选已完成 admission 并进入授权 command 的 provenance 仍保留为 hybrid，不表示模型覆盖了用户结果或必然创建了新记录。

### 2.3 Web API fail-closed

- `createWrongQuestionOrganizerApi()` 在成功 envelope 解包后，对 single/batch 分别执行 shared Zod response schema；
- focused 测试校验真实 POST path、Bearer token、request body 与两类 response parse；
- single 顶层 `providerError`、batch runtime `apiKey`、batch item `ownerId` 均被 unknown-field guard 拒绝；
- 客户端不会静默 strip 未知模型字段后继续展示，contract 漂移直接失败。

### 2.4 `/error-book` 来源状态

来源状态只在用户主动点击“整理历史错题”且 batch 成功后显示；下一次主动整理开始前先清空旧状态，请求失败不会继续展示过期结论。

| runtime | 产品文案 | 含义 |
| --- | --- | --- |
| hybrid + candidate_applied | 语义整理 | 使用了受治理语义判断，最终分类仍由本地规则确认 |
| local + non-degraded | 本地规则 | 本次由确定性规则完成，模型不是依赖 |
| 任一 degraded | 安全回退 | 语义路径未通过安全门，已使用本地规则完成 |

degraded 的显示优先级最高。状态组件使用 `w-full + min-w-0 + flex-wrap + break-words`，静态断言覆盖 390、510、1440px；页面不显示 token、费用、provider、Trace ID、prompt 或真实 ID，不提供“重试模型”、自动删除、移动、改名或其它 mutation。

## 3. 验证证据

| 验证项 | 结果 |
| --- | --- |
| Types focused runtime/response strict schema | `3/3` |
| Types full + typecheck | `42/42`，exit 0 |
| Web API/view/page focused | `10/10` |
| Web full | `438/438` |
| Web lint / production build | exit 0 / exit 0 |
| Server service/controller focused | `24/24` |
| Server full | `226/226` suites；`2149 passed / 30 skipped` |
| Organizer PostgreSQL E2E | `10/10` |
| Server lint / build | exit 0 / exit 0 |
| 390 / 510 / 1440px 静态布局断言 | PASS |
| `git diff --check` | exit 0 |

重点回归包括：

- candidate admission、Trace 与 command 成功后才生成 hybrid runtime；
- Trace admission 失败、candidate 后 stale 和 runtime throw 均返回 local degraded；
- final Trace replacement 失败仍返回首次已持久化的 admission runId，不伪造 final Trace；
- command 返回既有用户 authority 时保留用户事实与已准入 candidate provenance；
- batch candidate 失败且还有本地 remainder 时，request-level degraded 不被覆盖；
- default-off PostgreSQL E2E 返回本地非降级 runtime，模型 Trace 仍为 0；
- API/UI 不泄露 provider、token、费用、prompt、Trace ID 或真实映射，也没有模型重试/自动 mutation。

## 4. 本任务没有完成什么

- 没有读取根 `.env`、API key 或 provider credential；
- 没有调用 DeepSeek，没有执行 72-case paired Mock/Live runner；
- 没有执行 controlled-Live，因此不证明 Tutor/Organizer 真实语义质量；
- 没有启动或重建 Docker 产品栈，没有打开可见 `/error-book` 浏览器；390/510/1440 只是静态布局合同，不冒充真实浏览器验收；
- 没有修改 Compose/env allowlist、运维回滚或 Live evidence 配置；
- 没有证明 Phase 6.9.7、全部 Agent、可执行 LangGraph 或 Phase 6 已完成。

## 5. 下一步与回顾问题

下一任务是 Task 9：基于冻结的 72 cases 实现 Tutor/Organizer strict paired runner、一次性 CLI 与 evidence validator。Task 9 先完成 Mock/零网络工程证据；没有新的明确授权，不得执行 controlled-Live。

回顾时可以问：

- 为什么 batch 只返回一个 request-level runtime，而不是每道错题各带模型详情？
- 为什么 `hybrid_model` 必须绑定 persisted Trace，模型只是被调用过还不够？
- 为什么安全回退必须优先于语义整理显示？
- 为什么本地 runtime 不能返回 traceId？
- 为什么 Web API 要拒绝未知字段，而不是静默丢弃后继续展示？
- 为什么 command 返回用户 authority 时可以保留 candidate provenance，却不能声称模型覆盖了用户结果？
- 为什么 390/510/1440 静态断言不能替代后续可见浏览器验收？
