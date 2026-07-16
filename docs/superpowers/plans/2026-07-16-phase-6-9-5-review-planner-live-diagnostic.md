# Phase 6.9.5 Review / Planner 真实模型诊断与项目内启用实施计划

> **2026-07-16 execution amendment:** Tasks 1-6 remain historical engineering
> work and Task 7's v1/v2 attempts are terminal. Its original exact-confirmation
> command must not be run again. The only authorized continuation is the new
> v3 plan
> [`2026-07-16-phase-6-9-5-controlled-live-v3-profile.md`](2026-07-16-phase-6-9-5-controlled-live-v3-profile.md),
> which requires fresh zero-network proof and independent review before its own
> v3-only confirmation can create a new profile/evidence/lock lineage. Do not
> use the original Task-7 text as v3 execution instructions.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 fresh `main` 上让 ReviewAgent / PlannerAgent 以受控真实模型候选在项目内可验证运行，同时保持本地 facts、权限和回退权威，并在合并 `main` 后推送远程。

**Architecture:** 先重新建立只读、index-only Review/Planner candidate 与 Server composition；再为 provider failure 增加仅枚举化的诊断通道。新的诊断和 controlled-Live 都由 Server 创建 executor、保留严格脱敏 evidence，随后仅在 Docker 验收时短暂打开业务 gate，以 Trace 与浏览器证明真实模型被本地 merger 接受。

**Tech Stack:** Bun workspace、TypeScript、Zod、NestJS 11、Next.js 16、Vercel AI/OpenAI-compatible executor、DeepSeek JSON object mode、PostgreSQL、Docker Compose、Jest、Bun test。

---

## 固定边界

- 参考旧分支 `codex/phase-6-9-5-review-planner` 的源码时，只通过例如 `git show codex/phase-6-9-5-review-planner:packages/agent/src/model-candidates/review-planner-model-candidate.ts` 和 `git show codex/phase-6-9-5-review-planner:apps/server/src/review-agent/review-planner-model-config.ts` 逐文件审阅和重新落地；不得 cherry-pick 整个分支、复制其 `docs/acceptance/evidence/`，或复用其 Live run id、统计、gate 决定。
- 生产业务 gate 默认并最终恢复为 `false`；诊断 gate 和 controlled-Live gate 仅存在于独立短进程，均为一次 attempt、零 retry。
- Review/Planner 模型只能返回当前 deterministic snapshot 的索引与枚举。不可写 Card、ReviewLog、ReviewTask、ReviewPreference、WrongQuestion、deck 或数据库其他业务事实。
- 任何测试、Trace、HTTP DTO、CLI stdout、Git 文档和 evidence 都不得保存 key、base URL、prompt、用户事实、模型文本、raw provider error、headers、cookie、stack 或完整 fixture。
- 不执行 `docker compose down -v`、prune、Redis flush、数据库 reset、MinIO wipe；浏览器验收后保留窗口。

## 文件结构

| 文件 | 责任 |
| --- | --- |
| `packages/ai/src/model-agent-contract.ts`、`model-agent-runtime.ts` | 共享任务、不可变 budget、结构化 runtime 和安全 provider category |
| `packages/agent/src/model-candidates/review-planner-model-candidate.ts` | 纯函数 Review/Planner index-only candidate、prompt 和本地 merge |
| `packages/agent/src/evals/phase-6-9-review-planner-*.ts` | 固定 48 case、Mock/Live contract、纯 injected runner |
| `apps/server/src/review-agent/review-planner-*.ts` | env allowlist、runtime factory、observation、Trace、诊断/evidence/CLI |
| `apps/server/src/review-agent/review-agent.service.ts` | owner-scoped facts → deterministic → candidate → deterministic merge 编排 |
| `apps/web/src/lib/review-agent-model-status.ts` | 安全 applied/degraded/no-status 投影 |
| `apps/web/src/components/review-agent/review-agent-suggestion-card.tsx` | 仅展示固定模型状态，不展示 provider 或内容 |
| `docker/docker-compose.dev.yml` | 按 server/web 最小 allowlist 投影 gate 与 timeout |
| `docs/acceptance/*`、`AGENTS.md`、`DEVLOG.md` 等 | 验收结论、运行方法、后续路线与回顾入口 |

### Task 1: 重新建立共享模型任务与 index-only 候选

**Files:**
- Create: `packages/agent/src/model-candidates/review-planner-model-candidate.ts`
- Create: `packages/agent/tests/review-planner-model-candidate.test.ts`
- Modify: `packages/ai/src/model-agent-contract.ts`
- Modify: `packages/ai/src/model-agent-runtime.ts`
- Modify: `packages/ai/src/index.ts`
- Modify: `packages/agent/src/model-candidates/production.ts`
- Modify: `packages/agent/src/index.ts`
- Test: `packages/ai/tests/model-agent-runtime.test.ts`
- Test: `packages/agent/tests/production-model-candidates.test.ts`

- [ ] **Step 1: 写 RED 测试，证明模型不能产生业务事实或写动作。**

  ```ts
  const result = await runReviewModelCandidate({
    deterministic,
    runtime: mockRuntime({ focusIndexes: [1], diagnosis: 'review_pressure' }),
    budget: createModelAgentBudget({ maxCalls: 2, maxInputTokens: 1950, maxOutputTokens: 440 }),
  });

  expect(result.value.weakPoints.map((point) => point.id)).toEqual([deterministic.weakPoints[1].id]);
  expect(JSON.stringify(result)).not.toMatch(/minutes|href|ReviewTask|prompt|apiKey/i);
  ```

  同时覆盖 credential、instruction override、system prompt material、空数据、低压力、pre-abort、预算不足全部为零 runtime 调用；覆盖越界 index、额外字段、timeout、schema/provider/telemetry 失败均保留原 deterministic result。

- [ ] **Step 2: 运行 RED。**

  Run: `bun --filter @repo/agent test -- review-planner-model-candidate.test.ts`

  Expected: FAIL，因为 `runReviewModelCandidate`、`runPlannerModelCandidate` 和 strict schema 尚不存在。

- [ ] **Step 3: 实现最小 shared task 与 candidate contract。**

  在 `MODEL_AGENT_TASKS` 增加固定任务名，并仅允许这两种输出：

  ```ts
  export const reviewDecisionSchema = z.object({
    focusIndexes: z.array(z.int().nonnegative()).min(1).max(3),
    diagnosis: z.enum(['review_pressure', 'stability_risk', 'knowledge_gap']),
  }).strict();

  export const plannerDecisionSchema = z.object({
    blockOrder: z.array(z.int().nonnegative()).min(1).max(MAX_PLAN_BLOCKS),
    strategy: z.enum(['relieve_capacity', 'protect_overdue', 'steady_progress']),
  }).strict();
  ```

  Candidate 在调用前复制/验证 deterministic snapshot，按 `900/220`（Review）和 `1050/220`（Planner）预留共享预算。成功时只以本地数组重建顺序；任何非成功分支返回 `{ value: deterministic, observation: fixedFallback }`，绝不传播 provider text。

- [ ] **Step 4: 运行 GREEN 与静态门。**

  Run: `bun --filter @repo/agent test && bun --filter @repo/ai test && bun --cwd packages/types typecheck`

  Expected: Agent/AI tests 0 failure，types typecheck exit 0；无模型时既有 deterministic Review/Planner 行为不变。

- [ ] **Step 5: 提交。**

  ```powershell
  git add packages/ai packages/agent packages/types
  git commit -m "feat(agent): add bounded review planner candidates"
  ```

### Task 2: 固定 paired evaluation 与可归因诊断 contract

**Files:**
- Create: `packages/agent/src/evals/phase-6-9-review-planner-cases.ts`
- Create: `packages/agent/src/evals/phase-6-9-review-planner-contract.ts`
- Create: `packages/agent/src/evals/run-phase-6-9-review-planner-paired.ts`
- Create: `packages/agent/scripts/phase-6-9-review-planner-paired-cli.ts`
- Create: `packages/agent/tests/phase-6-9-review-planner-contract.test.ts`
- Create: `packages/agent/tests/phase-6-9-review-planner-paired.test.ts`
- Create: `packages/agent/tests/phase-6-9-review-planner-cli.test.ts`
- Modify: `packages/agent/package.json`
- Modify: `packages/agent/src/index.ts`

- [ ] **Step 1: 写 RED 测试，冻结 dataset 和 gate。**

  ```ts
  expect(report.caseEntries).toHaveLength(48);
  expect(report.caseEntries.filter((entry) => entry.executionKind === 'zero_call')).toHaveLength(26);
  expect(report.productionDecision).toBe('mock_quality_not_evidence');
  expect(() => phase695ReportSchema.parse({ ...report, prompt: 'secret' })).toThrow();
  ```

  测试还必须验证候选 case 共享 `2/1950/440` budget、最多一次 runtime invoke、Live 结果需要 strict success 100%、quality ≥90%、critical=0、P95≤4500 才能生成 `quality_gate_passed`；Mock 永远不能通过 production decision。

- [ ] **Step 2: 运行 RED。**

  Run: `bun --filter @repo/agent test -- phase-6-9-review-planner-contract.test.ts phase-6-9-review-planner-paired.test.ts`

  Expected: FAIL，因为固定 case、report schema 与 runner 尚不存在。

- [ ] **Step 3: 实现纯 runner 和安全诊断枚举。**

  定义不可扩展的诊断类别并禁止自由文本：

  ```ts
  export const reviewPlannerDiagnosticCodeSchema = z.enum([
    'preflight_invalid', 'executor_init', 'http_auth', 'http_rate_limit',
    'http_client', 'http_server', 'transport', 'structured_output',
    'invalid_response', 'usage_unverifiable', 'evidence_io',
  ]);
  ```

  Runner 的 `mode: 'mock'` 不读 env 或创建 executor；注入的 Live 依赖只接收 runtime、provider/model identity、safe usage 和 diagnostic category。所有 fixture 语义 rubric 只存内存，持久 report 只存 case id、lane、attempt/counter、strict/quality bool、duration、usage 和 gate。

- [ ] **Step 4: 运行 GREEN。**

  Run: `bun --filter @repo/agent eval:review-planner -- --mode mock --out .tmp/phase-6-9-5-diagnostic-mock.json; bun --filter @repo/agent test`

  Expected: 新 Mock evidence 为 48 entries / 26 zero-call / strict successes 48 / `mock_quality_not_evidence`；全部 Agent tests 通过。

- [ ] **Step 5: 提交。**

  ```powershell
  git add packages/agent
  git commit -m "feat(agent): add review planner paired diagnostics"
  ```

### Task 3: Server-owned gate、runtime、只读 orchestration 与 Trace

**Files:**
- Create: `apps/server/src/review-agent/review-planner-model-config.ts`
- Create: `apps/server/src/review-agent/review-planner-model-runtime.factory.ts`
- Create: `apps/server/src/review-agent/review-planner-model-observation.ts`
- Create: `apps/server/src/review-agent/review-planner-trace.ts`
- Create: `apps/server/src/review-agent/review-planner-model-config.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-model-runtime.factory.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-model-observation.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-trace.spec.ts`
- Modify: `apps/server/src/config/env.ts`
- Modify: `apps/server/src/review-agent/review-agent.module.ts`
- Modify: `apps/server/src/review-agent/review-agent.service.ts`
- Modify: `apps/server/src/review-agent/review-agent.service.spec.ts`
- Modify: `apps/server/src/agent-traces/agent-traces.module.ts`
- Modify: `apps/server/src/agent-traces/agent-traces.service.spec.ts`
- Modify: `apps/server/test/review-agent.e2e-spec.ts`

- [ ] **Step 1: 写 RED 测试，锁定 configuration 和 owner 行为。**

  ```ts
  expect(resolveReviewPlannerModelConfig({
    AI_PROVIDER_MODE: 'live', AI_ENABLE_LIVE_CALLS: 'true',
    REVIEW_AGENT_MODEL_ENABLED: 'true', DEEPSEEK_API_KEY: 'test-key',
  })).toMatchObject({ reviewEnabled: true, plannerEnabled: false, mode: 'live' });

  await service.getSuggestions(userA.id, query);
  expect(runtimeFor(userB.id).invoke).not.toHaveBeenCalled();
  expect(trace.steps.map((step) => step.name)).toEqual([
    'deterministic_review', 'review_candidate', 'deterministic_planner', 'planner_candidate',
  ]);
  ```

  覆盖缺失 global gate、业务 gate、HTTPS base URL、provider/key 不匹配和 executor 初始化失败均为 `attempted=false/local_deterministic`；覆盖 attempted fallback 不阻断 suggestions、Trace 写入失败不阻断 API、response/Trace 无 prompt/facts/provider text/credential。

- [ ] **Step 2: 运行 RED。**

  Run: `bun --filter @repo/server test -- review-agent.service.spec.ts review-planner-model-config.spec.ts review-planner-model-runtime.factory.spec.ts --runInBand`

  Expected: FAIL，因为 runtime factory、safe observation 和 candidate orchestration 不存在。

- [ ] **Step 3: 实现 allowlist composition 和服务编排。**

  `review-planner-model-config.ts` 只读取以下键：

  ```ts
  const ENV_KEYS = [
    'AI_PROVIDER_MODE', 'AI_ENABLE_LIVE_CALLS',
    'REVIEW_AGENT_MODEL_ENABLED', 'PLANNER_AGENT_MODEL_ENABLED',
    'AI_MODEL', 'AI_BASE_URL', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY',
    'REVIEW_AGENT_MODEL_TIMEOUT_MS', 'PLANNER_AGENT_MODEL_TIMEOUT_MS',
  ] as const;
  ```

  仅当 global Live、对应 component gate、安全 HTTPS base URL、合法模型名和匹配 key 全部成立时，factory 才创建 JSON-object executor；否则创建 `mode: 'mock'`、`liveCallsEnabled: false` runtime。服务使用 JWT 给出的 `userId`，每请求创建 fresh `createModelAgentBudget({ maxCalls: 2, maxInputTokens: 1950, maxOutputTokens: 440 })`，顺序执行 deterministic Review → eligible Review candidate → deterministic Planner → eligible Planner candidate。

- [ ] **Step 4: 运行 GREEN。**

  Run: `bun --filter @repo/server test -- review-agent.service.spec.ts review-planner-model-config.spec.ts review-planner-model-runtime.factory.spec.ts review-planner-model-observation.spec.ts review-planner-trace.spec.ts --runInBand; bun --filter @repo/server lint; bun --filter @repo/server build`

  Expected: focused tests、lint、build 均 exit 0；默认 env 的 suggestions observation 是 `attempted=false/local_deterministic`。

- [ ] **Step 5: 提交。**

  ```powershell
  git add apps/server packages/types
  git commit -m "feat(server): orchestrate review planner model suggestions"
  ```

### Task 4: Server-only diagnostic、atomic evidence 与一次 Live runner

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval.factory.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-evidence.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-cli.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval.factory.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-evidence.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-cli.spec.ts`
- Create: `apps/server/scripts/review-planner-controlled-live-eval.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: 写 RED 测试，证明诊断不会泄漏或重试。**

  ```ts
  await expect(runControlledLiveCli(['--confirm-controlled-live'])).resolves.toMatchObject({
    gate: 'closed', providerAttemptCount: 1, usageKnown: false,
  });
  expect(readEvidence()).toEqual(expect.objectContaining({ gate: 'closed' }));
  expect(JSON.stringify(readEvidence())).not.toMatch(/prompt|api[_-]?key|authorization|cookie|stack/i);
  expect(secondProviderAttempt).not.toHaveBeenCalled();
  ```

  覆盖无 `--confirm-controlled-live`、eval gate 为 false、Mock mode、global gate false、invalid env、unknown price、已有 evidence target、write/discard race、schema canary、provider category映射和 stdout 不含 raw diagnostic。

- [ ] **Step 2: 运行 RED。**

  Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval.factory.spec.ts review-planner-controlled-live-eval-evidence.spec.ts review-planner-controlled-live-eval-cli.spec.ts --runInBand`

  Expected: FAIL，因为 controlled diagnostic factory、reservation state machine 和 exact-confirmation CLI 尚不存在。

- [ ] **Step 3: 实现诊断与 evidence state machine。**

  CLI 只能接受精确 argv `--confirm-controlled-live`。运行开始前以 `wx` 保留新 evidence 路径，写入可解析基线；状态转换为 `reserved -> attempted -> finalized` 或 `reserved -> discarding`，任何并发 write/discard 均拒绝或回退至可安全重试的 reservation，不能删除 finalized evidence。只允许输出以下摘要：

  ```ts
  type SafeCliSummary = Readonly<{
    status: 'complete' | 'invalid_attempted' | 'diagnostic_blocked';
    gate: 'open' | 'closed';
    providerAttemptCount: number;
    usageKnown: boolean;
    diagnosticCode?: ReviewPlannerDiagnosticCode;
  }>;
  ```

  Server factory 创建单一 JSON-object executor；诊断固定使用无用户事实的 schema request、单 attempt、0 retry，后续 48-case run 仅在诊断可继续时执行。业务 `REVIEW_AGENT_MODEL_ENABLED` / `PLANNER_AGENT_MODEL_ENABLED` 在此过程始终为 false。

- [ ] **Step 4: 运行 GREEN。**

  Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval.factory.spec.ts review-planner-controlled-live-eval-evidence.spec.ts review-planner-controlled-live-eval-cli.spec.ts --runInBand; bun --filter @repo/server lint; bun --filter @repo/server build`

  Expected: focused tests、lint、build exit 0；测试中 provider error 只映射固定 diagnostic enum，证据 JSON 可解析且无 canary。

- [ ] **Step 5: 提交。**

  ```powershell
  git add apps/server
  git commit -m "feat(server): add review planner live diagnostics"
  ```

### Task 5: Docker allowlist、前端真实性状态与静态验收

**Files:**
- Create: `apps/web/src/lib/review-agent-model-status.ts`
- Create: `apps/web/src/lib/review-agent-model-status.test.mts`
- Modify: `apps/web/src/components/review-agent/review-agent-suggestion-card.tsx`
- Modify: `docker/docker-compose.dev.yml`
- Modify: `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts`
- Modify: `apps/server/src/worker-readiness/worker-readiness-cli.spec.ts`
- Modify: `apps/web/src/lib/ai-cost-estimator.ts`
- Modify: `packages/ai/src/ai-cost-estimator.ts`
- Modify: `packages/ai/src/index.ts`
- Test: `packages/ai/tests/ai-cost-estimator.test.ts`

- [ ] **Step 1: 写 RED 测试，验证 UI 不会把 fallback 说成模型。**

  ```ts
  assert.equal(getReviewPlannerModelStatus(undefined), null);
  assert.equal(getReviewPlannerModelStatus(allApplied), 'applied');
  assert.equal(getReviewPlannerModelStatus(oneAttemptedFallback), 'degraded');
  assert.doesNotMatch(renderedCard, /DeepSeek|API key|token|provider|raw error/i);
  ```

  Docker contract 测试必须断言：server 仅接收 Review/Planner gate 和 timeout；worker 不接收它们；web 不接收 Review/Planner key/base URL；缺省四个值为 `false/false/4500/4500`。

- [ ] **Step 2: 运行 RED。**

  Run: `bun --filter @repo/web test -- review-agent-model-status.test.mts; bun --filter @repo/server test -- docker-compose-readiness.spec.ts --runInBand`

  Expected: FAIL，因为 status projector 和 Compose allowlist 尚不存在。

- [ ] **Step 3: 实现安全 UI 与 Compose 投影。**

  前端只消费版本化 `modelObservations`：两个 candidate 都未尝试时返回 `null`；全部 attempted 且 `candidate_applied` 时显示“模型建议已应用”；任一 attempted fallback 时显示“模型建议已降级，已保留基于学习数据的建议”。将价格表唯一实现放在 `@repo/ai`，未知模型保持 `pricingKnown=false`。Compose 以 `${REVIEW_AGENT_MODEL_ENABLED:-false}`、`${PLANNER_AGENT_MODEL_ENABLED:-false}` 和两个 `${...:-4500}` 只投影到 HTTP server。

- [ ] **Step 4: 运行 GREEN。**

  Run: `bun --filter @repo/web test; bun --filter @repo/web lint; bun --filter @repo/web build; bun --filter @repo/server test -- docker-compose-readiness.spec.ts --runInBand; docker compose --env-file E:\PrepMind_ai智能备考助手\.env -f docker/docker-compose.dev.yml --profile worker config --quiet`

  Expected: Web test/lint/build、Compose readiness test、静态 Compose parse 均 exit 0；解析命令不打印完整配置。

- [ ] **Step 5: 提交。**

  ```powershell
  git add apps/web apps/server docker packages/ai
  git commit -m "feat(web): surface verified review planner model state"
  ```

### Task 6: 无凭据门、Mock evidence 与独立质量复审

**Files:**
- Create: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/dev-start.md`

- [ ] **Step 1: 运行所有无凭据门。**

  Run:

  ```powershell
  bun --filter @repo/agent test
  bun --filter @repo/ai test
  bun --filter @repo/server test
  bun --filter @repo/server lint
  bun --filter @repo/server build
  bun --filter @repo/web test
  bun --filter @repo/web lint
  bun --filter @repo/web build
  bun --cwd packages/types typecheck
  ```

  Expected: 所有命令 exit 0；出现失败时停止，不进入诊断或 Live。

- [ ] **Step 2: 写入新的 Mock evidence。**

  Run:

  ```powershell
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
  bun --filter @repo/agent eval:review-planner -- --mode mock --out ".tmp/phase-6-9-5-live-diagnostic-mock-$stamp.json"
  ```

  Expected: 新文件名未覆盖历史输出；48 cases、26 zero-call、48 strict successes、`mock_quality_not_evidence`。

- [ ] **Step 3: 独立复审静态 diff 与运行边界。**

  检查 `git diff main...HEAD --check`、env allowlist、no-secret canary、用户 owner isolation、默认 false gate、CLI 的 zero retry；把通过/未通过的客观结果写入 acceptance 草案，不能写“Live passed”。

- [ ] **Step 4: 提交阶段文档。**

  ```powershell
  git add docs/acceptance-checklist.md docs/ai-behavior-acceptance.md docs/dev-start.md docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md
  git commit -m "docs(agent): prepare review planner live diagnostics"
  ```

### Task 7: 单次诊断、单次 controlled-Live 与项目内真实模型验收

> 2026-07-16 执行状态：v1 profile 发现本地 probe/schema 不匹配后，先经独立零网络 schema-contract 修复与复审才创建 v2 profile。v1/v2 各自一次 provider attempt 都以 `invalid_attempted / structured_output`、`gate=closed`、`usageKnown=false` 关闭。两个 once marker 与 evidence 必须保留且计数不可合并；不得重跑任一 profile，也不得继续 48-case、Docker 或浏览器验收。

**Files:**
- Create: `docs/acceptance/evidence/phase-6-9-5-live-diagnostic/` (runtime atomically creates one strictly sanitized JSON evidence file)
- Modify: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/data-flow.md`

- [ ] **Step 1: 对一个新的、已批准 profile 运行一次诊断进程。**

  在单独 PowerShell 子进程加载未跟踪的根 `.env`，仅临时设置 Live 诊断变量，并保持两个 production gate 为 false：

  ```powershell
  & {
    $env:AI_PROVIDER_MODE = 'live'
    $env:AI_ENABLE_LIVE_CALLS = 'true'
    $env:REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED = 'true'
    $env:REVIEW_AGENT_MODEL_ENABLED = 'false'
    $env:PLANNER_AGENT_MODEL_ENABLED = 'false'
    bun --env-file=E:\PrepMind_ai智能备考助手\.env --filter @repo/server eval:review-planner:live -- --confirm-controlled-live
  }
  ```

  CLI 仅输出安全 summary；不得打印 env、key 或 raw error。

  Expected: 恰好一次 provider diagnostic attempt，产生新 parseable evidence。若为 `diagnostic_blocked` 或 `invalid_attempted`，记录固定 category、保持 gate 关闭、停止本任务，不运行 Live 或 Docker gate-on。

- [ ] **Step 2: 仅在诊断可继续时运行一次新的 48-case controlled-Live。**

  Run: 同一独立进程中的 exact-confirmation Live command；不重试、不改 dataset、不提高预算或 timeout、不拼接历史 evidence。

  Expected: 若通过，独立 evidence 显示 strict success 100%、quality≥90%、critical=0、P95≤4500、usage/cost known、26 zero-call；任一失败立即 closed gate 并停止。

- [ ] **Step 3: 仅在 Live 通过时验收项目内真实模型。**

  使用 Docker 的 root `.env` 插值、显式 `COMPOSE_BAKE=false`（仅当遇到既知 Bake gRPC 错误），逐服务 build 后 `up -d --no-build`。对合成账号只临时开启 Review/Planner gate，执行 authenticated `GET /review-agent/suggestions` 和 `GET /review-tasks/plan`；验证至少一个 owner-scoped Trace 为 `candidate_applied`，浏览器卡片显示“模型建议已应用”。再验证一个 forced fallback 不阻断页面。结束后恢复 gate false，精确删除账号与 Trace，count=0，浏览器保持打开。

- [ ] **Step 4: 写证据并提交。**

  acceptance 必须分别记录诊断类别、Live quality decision、Docker Trace/浏览器结果、清理、默认 gate 恢复和未执行项；不得将 Docker 成功写成 Live quality 成功。

  ```powershell
  git add AGENTS.md DEVLOG.md docs/roadmap.md docs/data-flow.md docs/acceptance
  git commit -m "docs(acceptance): record review planner live diagnostics"
  ```

### Task 8: 分支复审、合并 main、main 复验与远程推送

**Files:**
- Modify: only files required to fix findings from independent review
- Verify: all files changed by Tasks 1–7

- [ ] **Step 1: 独立规格与质量复审。**

  对 `main...HEAD` 复核：模型只选择 index/enum；JWT owner 不能替换；所有 zero-call gate 先于 runtime；默认 gate false；evidence 没有敏感正文；没有混入旧分支 evidence、无关 worker-readiness 修改或 Docker destructive command。

- [ ] **Step 2: 运行最终分支门。**

  Run: Task 6 的完整无凭据门，以及已通过的 Task 7 Docker/浏览器验收记录复核。

  Expected: 所有静态命令 exit 0；只有 Task 7 的 Live gate decision=`open` 时才可进入合并。

- [ ] **Step 3: 合并 main 并在 main 复验。**

  ```powershell
  git -C E:\PrepMind_ai智能备考助手 checkout main
  git -C E:\PrepMind_ai智能备考助手 merge --no-ff codex/phase-6-9-5-review-planner-live-diagnostics
  ```

  在 main 重跑 Agent、Server、Web 静态门和 Docker authenticated browser/Trace smoke；确认 production/default-off state 已恢复、合成数据为 0。

- [ ] **Step 4: 推送远程。**

  ```powershell
  git -C E:\PrepMind_ai智能备考助手 push origin main
  ```

  Expected: 仅在 main merge 和 main 复验均成功后推送；记录 merge SHA、main 验收结果和 push 成功结果。
