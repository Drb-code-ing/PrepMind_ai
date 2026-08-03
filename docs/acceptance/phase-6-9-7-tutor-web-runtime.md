# Phase 6.9.7 Task 5 — Tutor Web runtime 与 Chat 编排

日期：2026-07-23

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：Tutor 产品 composition 的静态/Mock 接入完成；production gate 默认关闭，尚未执行 controlled-Live、Docker API 或可见浏览器验收

## 1. 为什么需要这一任务

Task 3 只证明 Tutor package candidate 能在受限输入上选择教学策略。若没有产品 composition，`/api/chat` 仍不会创建 Tutor 专属 runtime，也无法证明登录、最终 Router route、独立预算、request abort、header、Trace 和原有 RAG/streaming 链路协作正确。

Task 5 把 candidate 接到真实 Web Route Handler，但不打开生产开关，也不调用真实模型。目标是先把“何时可以创建 executor、何时允许调用、失败后如何回退、能观测什么”固化成可回归的工程合同。

## 2. 完成内容

### 2.1 独立、server-only、default-off composition

- `tutor-model-config.ts` 与 `tutor-model-runtime.ts` 都使用 `server-only`，不会进入 Client Component；
- profile 固定为 `deepseek-v4-pro`、`https://api.deepseek.com/v1`、`tutor-model-candidate-v1`、non-thinking JSON object、`maxRetries=0`、无 tools、3000ms；
- 完整 Live conjunction 必须同时满足 `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`、`TUTOR_AGENT_MODEL_ENABLED=true`、精确 base URL、已知价格、合法 timeout 和非空 `TUTOR_AGENT_DEEPSEEK_API_KEY`；
- 只读取 Tutor component-specific credential，不检查或借用通用 `DEEPSEEK_API_KEY`、Router/Verifier、Review/Planner、Knowledge 或 Organizer credential；
- gate、全局 Live、URL、credential、timeout、价格或依赖构造任一异常均返回 disabled Mock bundle，不创建 Live executor。

### 2.2 独立预算、价格与失败边界

- 每个 Tutor 请求创建全新冻结预算：`1 call / 1200 input / 300 output`；
- DeepSeek 价格快照固定为 input `3 CNY/1M`、output `6 CNY/1M`，请求硬上限 `0.006 CNY`；
- input/output usage 必须都是正安全整数且不超过 reservation；`0` token、缺失/非法 usage、未知或篡改价格均不可形成成功或零成本记录；
- Tutor 预算与 Router -> Verifier 的既有共享预算物理分开，Tutor 调用不会消耗或污染后者；
- runtime/schema/usage/budget/timeout/abort 失败保留 canonical Tutor route 和原 deterministic strategy，不阻断 Chat。

### 2.3 Chat 编排顺序

```text
parse request / resolve Chat provider
  -> live access + conversation-context preparation
  -> create Router/Verifier bundle + register lazy Tutor bundle factory
  -> canonical Router decision
  -> final route=tutor ?
       -> explicit intent: deterministic zero-call
       -> implicit/contextual/conflicting: create Tutor bundle -> bounded candidate
            -> create Live executor/runtime only on invokeStructured
       -> strict admission + local TutorStrategy merger
  -> existing RAG / Verifier
  -> context budget / 413 guard
  -> best-effort Trace
  -> existing Mock or Live final streaming response
```

- Tutor factory 只在访问校验和 conversation prepare 之后注册；final canonical route 非 `tutor` 时，bundle/runtime/credential 都不会读取或创建；
- Live executor/runtime 采用单请求 Promise memo 惰性构造，只有 candidate 真正调用 `invokeStructured` 才解析 credential closure 并构造一次；明确教学指令、不安全输入或 request 已 abort 时 executor counter 保持 0；
- 同一个 `req.signal` 贯穿 Tutor candidate；
- candidate 只改变本地重建的 TutorStrategy/prompt guidance，不改变 route、RAG、approval、登录、413、最终回答模型或数据库权限。

### 2.4 安全 header 与 Agent Trace

- 新增 Tutor model observation，并与最终 TutorStrategy、response header 和 Trace step 使用同一 canonical envelope；
- header 只包含 attempted、固定 disposition/reason、正 usage、`pricingKnown`、可验证 CNY 和 currency；
- Trace 只保存固定 agent/version/disposition/reason/latency/usage/CNY provenance，不保存题目正文、active context、prompt、provider output、credential、base URL、raw error 或 stack；
- Tutor CNY 不写入现有 AgentTrace 顶层 USD `costEstimate`，避免币种混淆；
- Trace 仍是 Chat 的 best-effort 观测：写入失败只影响 recorded 状态，不中断流式回答。

### 2.5 Docker 能力边界

- `docker/.env.example` 增加 Tutor gate、3000ms timeout 与空 credential 示例；
- Compose 只把这三个 Tutor 变量投影给 `web` service；`server`、`worker`、`admin` 不接收；
- gate 默认值是 `false`，credential 默认空；本任务只用受版本控制的 `docker/.env.example` 做 `config --quiet`，未读取根 `.env`。

## 3. 验证证据

| 验证项 | 结果 |
| --- | --- |
| Task 5 focused（config/runtime/orchestration/route/observation/Trace） | `27/27` |
| Web full | `432/432` |
| Agent full | `529/529`，`5479 expect()` |
| AI full | `194/194`，`1020 expect()` |
| Web lint | exit 0 |
| Web production build | exit 0，包含 Next.js TypeScript 检查 |
| Compose tracked-example parse | `config --quiet` exit 0 |
| `git diff --check` | exit 0 |
| 独立复审 | 两路均 APPROVED，无 Critical/Important |

重点回归覆盖：完整 Live conjunction、generic key 不可替代、hostile env/dependency、executor 首次调用才构造且并发只构造一次、构造失败 fail-closed、fresh budget、正 usage/CNY、final route 顺序、非 Tutor bundle factory 零调用、明确指令/不安全/abort provider 零调用、失败 deterministic fallback、Router/Verifier 预算隔离、header/Trace 脱敏、Tutor CNY 与顶层 USD 隔离、Docker web-only allowlist。

## 4. 本任务没有完成什么

- 没有读取根 `.env` 或任何 API key，没有调用真实 provider；
- 没有执行 Tutor controlled-Live、Docker API、可见浏览器或人工回答质量验收；
- 没有打开 production gate；当前默认仍走 deterministic Tutor strategy；
- 没有接入 WrongQuestionOrganizer NestJS product composition；owner snapshot、双 stale fence 和授权写 command 属于 Task 6，Organizer runtime/Trace 属于 Task 7；
- 没有证明 72-case Live 质量门、Phase 6.9.7、全部 Agent 或 Phase 6 已完成。

## 5. 下一步与回顾问题

下一任务是 Task 6：在 NestJS Organizer 路径建立 owner-scoped `REPEATABLE READ + READ ONLY` 不可变快照、provider 前与 candidate 后 stale fence，以及事务内第三次 revalidation 的 model-free 授权写命令。模型调用不得位于数据库事务内，冲突只能做 bounded DB retry/权威重读，不能重调 provider。

回顾时可以问：

- 为什么 Tutor bundle factory 必须在 live access/context prepare 后注册，并等到 final Tutor route 后才执行？
- 为什么明确教学指令仍然 zero-call？
- 为什么 Tutor 使用独立预算，不能复用 Router -> Verifier 的共享预算？
- 为什么 Tutor Trace 可以 best-effort，而 Organizer model-influenced write 必须以 Trace 作为 admission？
- 为什么 Task 5 完成仍不能宣称真实 Tutor 模型已在产品中验收可用？
