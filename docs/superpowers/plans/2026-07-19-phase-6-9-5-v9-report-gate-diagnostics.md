# Phase 6.9.5 V9 Report Gate Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一次性 V9 lineage，在不改变 Review/Planner 模型、数据集、预算、阈值和权限的前提下，durable 定位 paired report gate，并在成功后完成既有 branch/main 产品验收。

**Architecture:** V9 复用 V8 provider composition并新增 internal safe diagnostic callback。Canonical evidence leaf 在 `.080` 后写 strict aggregate，`.085` 以 hash commitment绑定，`.090` 对 pass/fail 都提交；failure直接关闭，pass-only进入既有 complete/seal。Product composition只参数化 paired-evidence authority。

**Tech Stack:** Bun, TypeScript, Zod, Jest, Bun native tests, Windows no-reparse durable I/O, DeepSeek OpenAI-compatible runtime, Docker Compose, Prisma, Playwright.

---

## 文件职责

- `review-planner-controlled-live-eval-v9-gate-diagnostics.contract.ts`：strict safe aggregate、gate derivation 与 serializer。
- `review-planner-controlled-live-eval-v9-gate-diagnostics.factory.ts`：V9 identity 与 V8 evaluator wrapper，恰好捕获一次 aggregate。
- `review-planner-controlled-live-eval-v9-gate-diagnostics.evidence.ts`：V1--V8 snapshot、V9 reservation、`.085` commitment、reader/finalizer。
- `review-planner-controlled-live-eval-v9-gate-diagnostics.cli.ts`：`.010-.090` orchestration、failure close 与 pass-only finalization。
- `scripts/review-planner-controlled-live-eval-v9-gate-diagnostics.ts`：唯一命令入口。
- `review-planner-v8-product-acceptance-composition.ts`：最小 paired-evidence authority adapter；其余 runner语义不变。

### Task 1: Strict Safe Aggregate Contract

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.contract.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.contract.spec.ts`

- [ ] **Step 1: 写 RED contract tests**

```ts
expect(deriveV9GateDiagnostic(passingInput)).toMatchObject({
  state: 'diagnostic_candidate',
  terminalReason: 'passed',
  gates: {
    schema: 'passed', quality: 'passed', p95: 'passed',
    usage: 'passed', attempt: 'passed', admission: 'passed', cost: 'passed',
  },
});
expect(() => v9GateDiagnosticSchema.parse({
  ...passingDiagnostic,
  prompt: 'forbidden',
})).toThrow();
```

分别覆盖 report schema、48/26/22、strict/quality/critical、semantic、P95、usage、attempt、admission、cost；schema invalid 后 quality/P95 必须 `not_evaluated`，usage unknown 后 cost 必须 `not_evaluated`。

- [ ] **Step 2: 运行 RED**

Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-v9-gate-diagnostics.contract.spec --runInBand`

Expected: module/export 缺失导致失败。

- [ ] **Step 3: 实现最小 strict contract**

```ts
export const v9GateDiagnosticSchema = z.object({
  schemaVersion: z.literal('phase-6.9.5-review-planner-v9-gate-diagnostic-v1'),
  datasetVersion: z.literal('phase-6.9-review-planner-v2'),
  state: z.literal('diagnostic_candidate'),
  status: z.literal('invalid_attempted'),
  gate: z.literal('closed'),
  provider: z.literal('deepseek'),
  model: z.literal('deepseek-v4-pro'),
  attempts: attemptsSchema,
  report: reportAggregateSchema,
  usage: usageAggregateSchema,
  cost: costAggregateSchema,
  gates: gatesSchema,
  terminalReason: terminalReasonSchema,
}).strict().superRefine(assertV9GateConsistency);
```

Forbidden corpus 固定拒绝 `caseEntries/caseId/prompt/output/response/reasoning/rawError/stack/header/url/key/cookie/perCaseUsage/perCaseDuration`。

- [ ] **Step 4: 运行 GREEN 与提交**

Run: focused spec、targeted ESLint、Server build、`git diff --check`。

Commit: `feat(agent): add V9 safe report diagnostics`

### Task 2: Capture Aggregate From the Existing Provider Run

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.factory.ts`
- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.factory.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.factory.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.factory.spec.ts`

- [ ] **Step 1: 写 callback/profile override RED**

```ts
const diagnostics: unknown[] = [];
const evaluator = createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(env, {
  onGateDiagnostic: (value) => diagnostics.push(value),
});
await evaluator.runCanary();
const paired = await evaluator.runPaired();
expect(diagnostics).toHaveLength(1);
expect(paired.diagnostic).toEqual(diagnostics[0]);
expect(providerAttempts).toBe(23);
expect(pairedAdmissions).toBe(22);
```

V8 default evaluator必须仍无 callback/profile drift；测试不得运行网络。

- [ ] **Step 2: 运行 RED**

Run: V8/V9 factory specs。

- [ ] **Step 3: 实现 optional internal capture**

为 V8 factory dependency增加默认 `undefined` 的 internal callback与 runId profile override；每个 `runPairedSafely` 返回分支在返回前只投影一次 safe aggregate。V9 wrapper固定新 profile id，并返回：

```ts
type V9PairedResult = Readonly<{
  diagnostic: V9GateDiagnostic;
  result: ReviewPlannerControlledLiveV8PairedResult;
}>;
```

禁止 callback 接收 raw case entry、prompt、output或 error。

- [ ] **Step 4: 运行 GREEN 与提交**

Run: V8/V9 factory specs、AI/Agent focused、lint/build/diff。

Commit: `feat(agent): capture V9 paired gate aggregate`

### Task 3: V9 Durable Evidence and Reader

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.evidence.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.evidence.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.evidence.native.bun.test.ts`

- [ ] **Step 1: 写 V1--V8 pin、`.085` commitment 与 reader RED**

```ts
expect(V9_STAGES).toContain('.stage-085-safe-aggregate-committed.json');
const committed = await commitV9GateDiagnostic(reservation, diagnostic);
expect(committed.diagnosticSha256).toMatch(/^[a-f0-9]{64}$/);
expect((await readV9Evidence(root)).terminalReason).toBe('p95_exceeded');
```

V8 pin 固定 once SHA `c014e04a...9733d`、provisional SHA `82813d58...e0a7`、89/231 bytes、`.010-.080` 八个空 marker和唯一 leaf名。

- [ ] **Step 2: 运行 RED**

Run: focused Jest + native test；预期 module/export 缺失。

- [ ] **Step 3: 实现 reservation、commitment 与 reader**

`.010-.080` 为零字节 stage；diagnostic checked-close replace后，`.085` 以 strict JSON exclusive rename绑定 `evidenceLeaf/diagnosticSha256/historicalTreeHash`；`.090` 为零字节 validation-completed。`.090` failed record关闭 capability且不覆盖 evidence；pass-only允许 `.100-.150` finalizer。

- [ ] **Step 4: 故障与攻击 GREEN**

覆盖 write/flush/close/reopen/rename/hard-exit、`.085` 前后、`.090` pass/fail、strict-valid tamper、unknown leaf、reparse、伪 complete/seal、V1--V8 drift和并发 reservation。

- [ ] **Step 5: 提交**

Run: Jest/native、ESLint、Server build、diff。

Commit: `feat(agent): add V9 durable gate evidence`

### Task 4: V9 CLI, Script, and One-Shot Entry

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.cli.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.cli.spec.ts`
- Create: `apps/server/scripts/review-planner-controlled-live-eval-v9-gate-diagnostics.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: 写 exact confirmation/stage-order RED**

```ts
expect(V9_CONFIRMATION).toBe('--confirm-controlled-live-v9-deepseek-v4-pro-gate-diagnostics');
expect(blocked.providerAttemptCount).toBe(0);
expect(order).toEqual(['080', 'diagnostic-write', '085', '090']);
```

每个 stage false/throw、diagnostic failure、pass-only finalization、provider count 23/22 admission、零 retry均独立覆盖。

- [ ] **Step 2: 实现 CLI 与 package script**

```json
"eval:review-planner:live:v9:gate-diagnostics": "bun scripts/review-planner-controlled-live-eval-v9-gate-diagnostics.ts"
```

Script只输出 strict safe summary；不得输出 aggregate正文、env、key、prompt、response、URL或 raw error。

- [ ] **Step 3: 运行 GREEN 与提交**

Run: V9 CLI/factory/evidence specs、negative exact CLI、lint/build/diff。

Commit: `feat(agent): add V9 controlled Live entry`

### Task 5: Parameterize Product Evidence Authority

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.spec.ts`

- [ ] **Step 1: 写 V9 authority RED**

```ts
expect(await preflightWith(v9CommittedSuccess)).toMatchObject({ ok: true });
expect(await preflightWith(v9DiagnosticOnly)).toMatchObject({ ok: false });
expect(readV8Evidence).not.toHaveBeenCalled();
```

- [ ] **Step 2: 实现最小 adapter**

```ts
type PairedEvidenceAuthority = Readonly<{
  profile: 'v9';
  readCommittedSuccess(repoRoot: string): Promise<Readonly<{
    evidenceSha256: string;
    providerAttemptCount: 23;
  }>>;
}>;
```

Default production acceptance composition固定使用 V9 authority；diagnostic/evidence_io/unknown profile在 ledger、Prisma、Docker、fetch、browser前零副作用。其余 runner不变。

- [ ] **Step 3: 运行 GREEN 与提交**

Run: composition/runner/ledger focused、lint/build/Compose config/diff。

Commit: `fix(agent): bind product acceptance to V9 evidence`

### Task 6: Full Offline Gates, Reviews, and Docs

- [ ] **Step 1:** 运行 V9 contract/factory/evidence/CLI、V8 regression、Windows native、Agent、AI、types、Server full+Review E2E、Web、lint/build、Compose `config --quiet`、diff。
- [ ] **Step 2:** contract/security 与 acceptance/operations 两轮独立复审，关闭全部 Critical/Important。
- [ ] **Step 3:** 更新 AGENTS、DEVLOG、roadmap、AI behavior、checklist、acceptance，明确 V9 Live 尚未运行、两个产品 gate false。
- [ ] **Step 4:** 提交 `docs(agent): record V9 offline gates`。

### Task 7: Execute the Unique V9 Controlled-Live

- [ ] **Step 1:** 零网络 preflight确认 clean HEAD、V1--V8 pin、V9目录不存在、exact provider/model/base/nonthinking/4500ms、23 calls、CNY1.00、产品 gate false。
- [ ] **Step 2:** 只执行一次：

```powershell
bun --filter @repo/server eval:review-planner:live:v9:gate-diagnostics -- --confirm-controlled-live-v9-deepseek-v4-pro-gate-diagnostics
```

- [ ] **Step 3:** Fresh reader读取 V9；complete才进入 Task 8。Failure记录 safe aggregate并永久停止 V9，不重跑。
- [ ] **Step 4:** 提交 `test(agent): record V9 controlled Live evidence`。

### Task 8: Branch Product Acceptance

- [ ] **Step 1:** 使用现有 executable runner启动 default-off Compose全栈。
- [ ] **Step 2:** 使用 branch durable ledger完成 Review API + `/plan`、restore、Planner API + `/today`、restore，共4次产品请求。
- [ ] **Step 3:** 验证 Trace唯一、facts unchanged、owner isolation、CNY<=0.10、正式 acceptance schema、精确清理与零残留。
- [ ] **Step 4:** 提交 `test(agent): accept Review Planner on branch`。

### Task 9: Merge Main, Replay, Push

- [ ] **Step 1:** 完整分支门、default-off、零残留后 `git merge --no-ff codex/phase-6-9-5-review-planner-live-diagnostics`。
- [ ] **Step 2:** main不重跑 V9 paired；fresh reader + 静态门 + 全新4-request product replay。
- [ ] **Step 3:** 更新全部权威文档，明确仅 Phase 6.9.5 Review/Planner完成，其余 Agent/Phase6.10未完成。
- [ ] **Step 4:** 提交、`git push origin main`，核对本地/远程 SHA、工作树 clean、default-off和零残留。

---

## 自检

- 每个生产行为先 RED 后 GREEN并独立提交。
- V8及更早 lineage无写入路径；V9恰好一次、最多23 provider attempts。
- Safe diagnostic不能取得 product authority；只有 V9 committed success可以。
- Main只做 product replay，不重跑 paired lineage。
