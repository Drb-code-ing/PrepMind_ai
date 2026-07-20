# Phase 6.9.5 V8 Stage Diagnostics Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. 正文复选框保留为最初计划模板；当前进度只以紧随其后的“执行状态”为准，未勾选不表示任务尚未执行。

> **执行状态：** Task 1--6 与补充 runner 离线工程已完成；Task 7 唯一 V8 controlled-Live 已消费并在 `.stage-080-paired-returned / invalid_response` 关闭，无 success seal。Task 8/9 产品验收、main 合并/replay 与 push 按计划被阻断；不得重跑 V1--V8。

**Goal:** 在不重跑或改写 V1--V7 的前提下，为 ReviewAgent / PlannerAgent 建立可定位、一次性、durable 的 V8 controlled-Live lineage，并完成默认关闭、只读、owner-scoped 的 Docker/API/可见浏览器/Trace 产品验收。

**Architecture:** V8 复用现有 DeepSeek V4 Pro non-thinking evaluator 和 48-case paired contract，但使用全新 evidence profile、15 个零字节 stage markers、独立 once marker、strict candidate 与 hash-bound success seal。普通 JSON evidence 通过 no-reparse HANDLE、write-through、`NtFlushBuffersFile` 与成功 close 形成 durability barrier；once、stage 与 final seal 的公开 leaf 都先 durable-close private prepare leaf，再以同一绑定目录下的 HANDLE-relative exclusive rename 作为唯一 commit 点。生产验收另加默认关闭、双层原子 admission，确保分支和 main 各最多 4 次产品 Live 请求。

**Tech Stack:** Bun, TypeScript, NestJS 11, Jest, Bun native tests, Zod, Bun FFI/Windows NT API, Docker Compose, PostgreSQL, DeepSeek OpenAI-compatible API, headed browser acceptance.

---

## 文件职责映射

- `apps/server/src/review-agent/windows-reparse-safe-relative-io.ts`：扩展现有 no-reparse Windows HANDLE 边界，新增 durable exclusive-create/replace，不改变旧方法语义。
- `apps/server/src/review-agent/windows-reparse-safe-relative-io.bun.test.ts`：证明 write-through、flush、close、duplicate、reparse 与故障注入边界。
- `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.ts`：V8 profile、strict schemas、history snapshot、reservation、stage state machine、finalizer 与 public reader。
- `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.spec.ts`：纯 contract、schema、marker prefix、strict whitelist 与 public projection 测试。
- `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.native.bun.test.ts`：真实 Windows 文件系统 durability、concurrency、reparse、drift、seal 测试。
- `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.cli.ts`：唯一 V8 orchestration、stage 顺序、完整质量门与安全 summary 序列化。
- `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.cli.spec.ts`：每个 stage 的 false/throw 注入、provider attempt 计数、零重试与成功路径。
- `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.factory.ts`：V8 identity、双开关 preflight、non-thinking executor、canary、paired evaluator、usage/CNY 聚合。
- `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.factory.spec.ts`：blocked/closed/ready、23 attempts、48/26/22、usage/cost 与 strict transport 测试。
- `apps/server/scripts/review-planner-controlled-live-eval-v8-stage-diagnostics.ts` 与 `apps/server/package.json`：唯一命令入口。
- `apps/server/src/review-agent/review-planner-product-acceptance-admission.ts`：默认关闭、component-bound、capability-bound 的 provider 前原子 admission。
- `apps/server/src/review-agent/review-planner-product-acceptance-admission.spec.ts`：并发、耗尽、错误 capability、worker/default-off 与零调用测试。
- `apps/server/src/review-agent/review-agent.module.ts`、`review-agent.controller.ts`、`review-agent.service.ts`、`apps/server/src/config/env.ts`、`docker/docker-compose.dev.yml`：只把 admission 接入 Nest server；controller 读取临时 header，service 在 runtime 前 hash/claim，Web/worker 不接收 capability。
- `apps/server/src/review-agent/review-planner-v8-product-acceptance-evidence.ts`：branch/main acceptance JSON strict schema、价格快照、SHA 与禁存字段。
- `apps/server/src/review-agent/review-planner-v8-product-acceptance-evidence.spec.ts`：schema、费用、截图 SHA、JSON 不自哈希与敏感字段拒绝测试。
- `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/{branch,main}/`：最终安全 JSON 与两张 headed browser 截图。

### Task 1: Durable Windows Evidence I/O

**Files:**
- Modify: `apps/server/src/review-agent/windows-reparse-safe-relative-io.ts`
- Modify: `apps/server/src/review-agent/windows-reparse-safe-relative-io.bun.test.ts`

- [ ] **Step 1: 写 durable API 的失败测试**

```ts
expect(typeof directory.createExclusiveDurableFile).toBe('function');
expect(typeof directory.replaceDurableFile).toBe('function');
directory.createExclusiveDurableFile('stage-010', '');
expect(directory.readRegularFile('stage-010')).toEqual(Buffer.alloc(0));
expect(() => directory.createExclusiveDurableFile('stage-010', '')).toThrow();
```

- [ ] **Step 2: 运行 native test 并确认 RED**

Run: `bun test apps/server/src/review-agent/windows-reparse-safe-relative-io.bun.test.ts`

Expected: FAIL，错误明确指向 `createExclusiveDurableFile` / `replaceDurableFile` 尚不存在，而不是 fixture 或权限错误。

- [ ] **Step 3: 实现最小 durable HANDLE 边界**

在 `WindowsNoReparseChildDirectory` 增加：

```ts
createExclusiveDurableFile(leafName: string, contents: string): void;
replaceDurableFile(
  temporaryLeafName: string,
  targetLeafName: string,
  contents: string,
): void;
commitExclusiveDurableFileViaRename(
  committedLeafName: string,
  contents: string,
):
  | { committed: true; cleanupStatus: 'closed' | 'close_unverified' }
  | { committed: false; stage: 'prepare_create' | 'prepare_write' | 'prepare_flush' | 'prepare_close' | 'prepare_reopen' | 'rename' };
```

创建/替换的新 HANDLE 使用 `FILE_WRITE_THROUGH | FILE_SYNCHRONOUS_IO_NONALERT | FILE_NON_DIRECTORY_FILE`，写完调用 `NtFlushBuffersFile`；只有 write、flush、close 全部成功才返回。publication primitive 从 `committedLeafName` 内部唯一派生 `${committedLeafName}.prepare`，拒绝非 safe leaf、`.prepare` 输入、目标已存在或覆盖；先 durable-close prepare，再从同一绑定 directory HANDLE 重开、复核并用 `NtSetInformationFile` + `ReplaceIfExists=false` rename。rename 成功即 committed，之后 close 只返回 cleanup 状态。任何 commit 前失败只返回固定 stage，不重试、不删除、不回显路径或原始错误。

- [ ] **Step 4: 增加 write/flush/close 故障注入与 reparse 测试并保持 GREEN**

Run: `bun test apps/server/src/review-agent/windows-reparse-safe-relative-io.bun.test.ts`

Expected: PASS；duplicate、junction/reparse、write denied、flush denied、close denied 均 fail-closed；prepare/reopen/rename failure 不产生 public leaf，rename 后 close failure 返回 `committed:true/close_unverified` 且 fresh reader 可验证。额外 child-process tests 只在 local fixed NTFS 运行：rename 前 hard-exit 不得有 public leaf，rename 后 cleanup 前 hard-exit 必须被新进程 reader 识别为 committed；其他 volume preflight fail-closed。

- [ ] **Step 5: 提交 durable I/O**

```powershell
git add -- apps/server/src/review-agent/windows-reparse-safe-relative-io.ts apps/server/src/review-agent/windows-reparse-safe-relative-io.bun.test.ts
git commit -m "feat(agent): add durable Windows evidence writes"
```

### Task 2: V8 Evidence Contract and Stage State Machine

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.native.bun.test.ts`

- [ ] **Step 1: 写 profile、strict schema 与 15-stage RED tests**

```ts
expect(REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.id).toBe(
  'phase-6.9.5-review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics',
);
expect(REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES).toHaveLength(15);
expect(
  safeReviewPlannerControlledLiveV8SummarySchema.safeParse({
    state: 'finalized',
    status: 'complete',
    prompt: 'forbidden',
  }).success,
).toBe(false);
```

- [ ] **Step 2: 运行 focused tests 并确认 RED**

Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.spec --runInBand`

Expected: FAIL，V8 evidence module/export 缺失。

- [ ] **Step 3: 实现 profile、schema、history snapshot 与 capability reservation**

实现并导出以下固定入口：

```ts
snapshotReviewPlannerControlledLiveV8HistoricalEvidence(root?: string)
verifyReviewPlannerControlledLiveV8HistoricalEvidence(input)
reserveReviewPlannerControlledLiveV8Evidence(input)
advanceReviewPlannerControlledLiveV8Stage(reservation, exactStage)
finalizeReviewPlannerControlledLiveV8Evidence(input)
readReviewPlannerControlledLiveV8Evidence(root?: string)
serializeReviewPlannerControlledLiveV8Evidence(value)
```

V8 snapshot 必须固定 V1--V7 tree，并 pin V7 marker SHA `1920c68d8fd10d77af1cf63731e46ed8e9c02270093a024302b24eb97fa85bda` 与 terminal SHA `79c07fed05a011a6344e7df3aecd9c616824c6a7cd07873693f3ddfaab1a63ba`。reservation 的 public keys 仅为 `relativePath` 与 `markAttempted`；stage/finalizer capability 保存在私有 `WeakMap`。

- [ ] **Step 4: 实现 durable candidate/terminal/seal 与 public reader**

`once marker` 与 15 个 stage marker 使用 `commitExclusiveDurableFileViaRename` 发布零字节 public leaf；safe provisional、candidate、terminal 使用 checked-close durable replacement并由后继 committed stage 证明；seal 同样使用 rename commit，固定 private prepare leaf 不进入 public schema。success seal strict 字段仅为：

```ts
schemaVersion, evidenceLeaf, candidateSha256, historicalTreeHash,
stageManifestSha256, onceMarkerSha256, commitNonce
```

public reader 每次 fresh existing-only/no-reparse 读取 once marker、15-stage manifest、candidate、seal 与 V1--V7 tree；任何缺失、gap、unknown marker、hash mismatch、unsealed candidate 或 reparse 只投影 `evidence_io`。

- [ ] **Step 5: 运行 Jest 与 native tests**

Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.spec --runInBand`

Run: `bun test apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.native.bun.test.ts`

Expected: PASS；once/stage/seal 的 prepare/reopen/rename failure 不公开目标 leaf；rename 后 cleanup close failure 不撤销 committed。candidate/terminal replacement 的 write/flush/close 失败均停止且零重试，且无后继 committed stage 时 reader 只投影 `evidence_io`。

- [ ] **Step 6: 提交 V8 evidence/state machine**

```powershell
git add -- apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.spec.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.native.bun.test.ts
git commit -m "feat(agent): add V8 durable stage evidence"
```

### Task 3: V8 CLI Orchestration

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.cli.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.cli.spec.ts`

- [ ] **Step 1: 写 exact confirmation 与 stage-order RED tests**

```ts
expect(REVIEW_PLANNER_CONTROLLED_LIVE_V8_CONFIRMATION).toBe(
  '--confirm-controlled-live-v8-deepseek-v4-pro-stage-diagnostics',
);
expect(await runV8({ argv: [], env: readyEnv })).toMatchObject({
  state: 'blocked',
  gate: 'closed',
  providerAttemptCount: 0,
});
```

为 `.stage-010` 至 `.stage-150` 每个边界分别注入 false/throw，断言后续 dependency 未调用、provider count 不增加、没有 retry。

- [ ] **Step 2: 运行 CLI spec 并确认 RED**

Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-v8-stage-diagnostics.cli.spec --runInBand`

Expected: FAIL，CLI module/export 缺失。

- [ ] **Step 3: 实现唯一 orchestration**

严格实现：

```text
confirmation -> preflight -> V1--V7 snapshot -> reserve/.010 -> attempted/.020
-> evaluator/.030 -> history/.040 -> canary .050/.060 -> paired .070/.080
-> report validation/.090 -> finalizer .100-.150 -> exclusive seal
```

完整成功门固定为 `48/26/22/48/48/0`、semantic `>=90`、P95 `<=4500`、attempts `23`、usage `<=42996/9712`、cost `<=1.00 CNY`。输出只通过 safe Zod summary serializer。

- [ ] **Step 4: 运行 CLI tests 并确认 GREEN**

Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-v8-stage-diagnostics.cli.spec --runInBand`

Expected: PASS；complete 路径恰好 1 canary + 22 paired attempts；所有失败路径无 provider/file retry。

- [ ] **Step 5: 提交 CLI**

```powershell
git add -- apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.cli.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.cli.spec.ts
git commit -m "feat(agent): orchestrate V8 stage diagnostics"
```

### Task 4: V8 Factory, Script, and Package Entry

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.factory.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.factory.spec.ts`
- Create: `apps/server/scripts/review-planner-controlled-live-eval-v8-stage-diagnostics.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: 写 V8 identity/preflight/fake evaluator RED tests**

```ts
expect(validateV8Preflight(readyEnv)).toEqual({ ok: true });
expect(createV8Evaluator(blockedEnv).state).toBe('closed');
expect(fakeComplete.report.counters).toEqual({
  caseEntries: 48,
  zeroCallCases: 26,
  runtimeInvocations: 22,
  strictSuccesses: 48,
  qualityPasses: 48,
  criticalFailures: 0,
});
```

- [ ] **Step 2: 运行 factory spec 并确认 RED**

Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-v8-stage-diagnostics.factory.spec --runInBand`

Expected: FAIL，V8 factory/export 缺失。

- [ ] **Step 3: 实现 V8 typed non-thinking factory**

只接受 exact `deepseek / deepseek-v4-pro / https://api.deepseek.com/v1`，`REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED=true`，两个产品 gate `false`，4500ms，SDK retries 0。请求禁止 tools、tool_choice、json_schema 与 reasoning content；usage 缺失/非法/0 立即失败。

- [ ] **Step 4: 增加 script 与 package entry**

```json
"eval:review-planner:live:v8:stage-diagnostics": "bun scripts/review-planner-controlled-live-eval-v8-stage-diagnostics.ts"
```

script 只调用 V8 CLI 并输出 safe serializer；不得输出 env、key、prompt、response、base URL 或 raw error。

- [ ] **Step 5: 运行 focused + paired Mock tests**

Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-v8-stage-diagnostics.factory.spec review-planner-controlled-live-eval-v8-stage-diagnostics.cli.spec --runInBand`

Run: `bun --cwd packages/agent test`

Expected: PASS；Mock 为 `48 cases / 26 verified zero-call / 22 runtime / 48 strict / 48 quality / 0 critical`，provider attempts 0。

- [ ] **Step 6: 提交 factory/entry**

```powershell
git add -- apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.factory.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.factory.spec.ts apps/server/scripts/review-planner-controlled-live-eval-v8-stage-diagnostics.ts apps/server/package.json
git commit -m "feat(agent): add V8 controlled Live entry"
```

### Task 5: Product Acceptance Admission and Evidence Schema

**Files:**
- Create: `apps/server/src/review-agent/review-planner-product-acceptance-admission.ts`
- Create: `apps/server/src/review-agent/review-planner-product-acceptance-admission.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-v8-product-acceptance-evidence.ts`
- Create: `apps/server/src/review-agent/review-planner-v8-product-acceptance-evidence.spec.ts`
- Modify: `apps/server/src/review-agent/review-agent.module.ts`
- Modify: `apps/server/src/review-agent/review-agent.controller.ts`
- Modify: `apps/server/src/review-agent/review-agent.service.ts`
- Modify: `apps/server/src/review-agent/review-agent.service.spec.ts`
- Modify: `apps/server/test/review-agent.e2e-spec.ts`
- Modify: `apps/server/src/config/env.ts`
- Modify: `apps/server/src/config/env.spec.ts`
- Modify: `docker/docker-compose.dev.yml`
- Modify: `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts`

- [ ] **Step 1: 写默认关闭与原子 claim RED tests**

```ts
expect(createAdmission({ enabled: false }).claim('review', 'x')).toBe(false);
const admission = createAdmission(valid);
expect(admission.claim('review', capability)).toBe(true);
expect(admission.claim('planner', capability)).toBe(false);
expect([admission.claim('review', capability), admission.claim('review', capability)]).toEqual([true, false]);
```

并发 Promise/worker test 必须证明第三次和错误 capability 在 `ModelAgentRuntime.invoke` 前为零调用。

- [ ] **Step 2: 运行 focused tests 并确认 RED**

Run: `bun --filter @repo/server test -- review-planner-product-acceptance-admission review-agent.service --runInBand`

Expected: FAIL，admission provider/export 尚不存在。

- [ ] **Step 3: 实现 server-only admission**

配置只接受：

```text
REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED=false
REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT=review|planner
REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256=<64 lowercase hex>
REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS=2
```

controller 只从 `x-prepmind-review-planner-acceptance` 读取临时 capability，并以独立参数传给 service，不把它放入 query/response/Trace。service 先对 capability 做 SHA-256，再在 `runReviewModelCandidate` 或 `runPlannerModelCandidate` 前同步 compare-and-decrement；任何无效状态返回限制性 deterministic observation。worker 强制 disabled，Web 不接收这些变量，Trace 不保存 capability/header。

- [ ] **Step 4: 实现 strict acceptance evidence schema**

固定 `priceProfileId=deepseek-v4-pro-cny-noncached-2026-07-18-v8-product-acceptance`、`3/6 CNY per million`、verified integer tokens、unrounded cap compare、8 位 `ROUND_HALF_UP`。JSON 只含 paired evidence SHA 与两个 screenshot SHA，不含自身 SHA。

- [ ] **Step 5: 运行 admission/config/evidence tests**

Run: `bun --filter @repo/server test -- review-planner-product-acceptance-admission review-planner-v8-product-acceptance-evidence review-agent.service docker-compose-readiness env.spec --runInBand`

Run: `bun --filter @repo/server test:e2e -- review-agent.e2e-spec.ts`

Expected: PASS；Compose 只把 acceptance vars 传给 server，默认 false，worker/web/admin 不接收 capability。

- [ ] **Step 6: 提交 product acceptance control plane**

```powershell
git add -- apps/server/src/review-agent/review-planner-product-acceptance-admission.ts apps/server/src/review-agent/review-planner-product-acceptance-admission.spec.ts apps/server/src/review-agent/review-planner-v8-product-acceptance-evidence.ts apps/server/src/review-agent/review-planner-v8-product-acceptance-evidence.spec.ts apps/server/src/review-agent/review-agent.module.ts apps/server/src/review-agent/review-agent.controller.ts apps/server/src/review-agent/review-agent.service.ts apps/server/src/review-agent/review-agent.service.spec.ts apps/server/test/review-agent.e2e-spec.ts apps/server/src/config/env.ts apps/server/src/config/env.spec.ts docker/docker-compose.dev.yml apps/server/src/worker-readiness/docker-compose-readiness.spec.ts
git commit -m "feat(agent): guard Review Planner product acceptance"
```

### Task 6: Offline Gates and Independent Implementation Reviews

> 2026-07-18 独立复审补充：进入本 Task 前必须先完成 `phase-6-9-5-v8-product-acceptance-durable-runner.md` Task 1--3。branch/main 单轮上限为 `7_800 / 1_760`，两轮合计为 `15_600 / 3_520`，共同受未舍入 CNY `0.10000000` hard cap；产品验收不得继续使用纯内存 runner。

**Files:**
- Modify only when a failing test identifies a defect; each defect follows its own RED/GREEN cycle and commit.

- [ ] **Step 1: 运行完整离线门**

```powershell
bun --filter @repo/server test -- --runInBand
bun test apps/server/src/review-agent/windows-reparse-safe-relative-io.bun.test.ts
bun test apps/server/src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence.native.bun.test.ts
bun --cwd packages/agent test
bun --cwd packages/ai test
bun --cwd packages/types typecheck
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet
git diff --check
```

Expected: 全部 exit 0；V8 Mock 48/26/22/48/48/0；V8 once marker/evidence 目录仍不存在；两个产品 gate false。

- [ ] **Step 2: contract/security 独立复审**

审查 strict schema、durability、marker 顺序、WeakMap capability、history pin、budget、zero-retry、secret/redaction 与 V7 immutability。未关闭 Critical/Important 必须先写失败测试、修复、重跑相关门并单独提交。

- [ ] **Step 3: acceptance/operations 独立复审**

审查 provider 前双层 admission、4+4 cap、Review-only/Planner-only server 重建、visible browser、Trace、owner isolation、价格、证据 SHA、精确清理、main 不重跑 paired lineage 与 Compose stop。未关闭 Critical/Important 同样先 RED 再修复并单独提交。

- [ ] **Step 4: 提交离线门文档证据**

更新 `DEVLOG.md` 与 `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`，只记录真实命令/计数，明确尚未调用 Live。

```powershell
git add -- DEVLOG.md docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md
git commit -m "docs(agent): record V8 offline gates"
```

### Task 7: Execute the Unique V8 Controlled-Live

**Files:**
- Create by the command: `docs/acceptance/evidence/phase-6-9-5-controlled-live-v8-deepseek-v4-pro-stage-diagnostics/*`
- Modify: `DEVLOG.md`
- Modify: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 做零网络 preflight**

确认 HEAD/工作树、V1--V7 SHA、V8 evidence 不存在、exact provider/model/base、non-thinking、4500ms、retries 0、两个产品 gate false、usage/CNY reservation、key 仅在当前进程可用且不输出。

- [ ] **Step 2: 执行唯一命令一次**

```powershell
bun --filter @repo/server eval:review-planner:live:v8:stage-diagnostics -- --confirm-controlled-live-v8-deepseek-v4-pro-stage-diagnostics
```

禁止 shell retry、runner retry、SDK retry、第二次命令或拼接历史结果。

- [ ] **Step 3: 读取 committed evidence**

Expected success: `finalized / complete / closed / 23 / true`，完整 15-stage manifest、success seal、48/26/22/48/48/0、semantic >=90、P95 <=4500、positive usage <=42996/9712、cost <=1.00。若任一不成立，按 terminal evidence 停止，不进入 Task 8。

- [ ] **Step 4: 更新证据文档并提交**

只记录 safe aggregate、evidence SHA、marker SHA、commit SHA 与 gate=false；不得记录 prompt、response、key、raw error 或账单断言。

```powershell
git add -- AGENTS.md DEVLOG.md docs/roadmap.md docs/ai-behavior-acceptance.md docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md docs/acceptance/evidence/phase-6-9-5-controlled-live-v8-deepseek-v4-pro-stage-diagnostics
git commit -m "test(agent): record V8 controlled Live evidence"
```

### Task 8: Branch Docker/API/Visible Browser/Trace Acceptance

**Files:**
- Create: `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch/acceptance.json`
- Create: `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch/plan.png`
- Create: `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch/today.png`
- Modify: `DEVLOG.md`
- Modify: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`

- [ ] **Step 1: 启动 default-off Docker 全栈**

Run: `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin`

Expected: server/web/admin 200，Review/Planner deterministic，V8 paired evidence 只读未改写。

- [ ] **Step 2: 创建两个隔离 synthetic fixtures 并记录精确 ids**

前缀 `phase695-v8-accept-<UTC>`；记录账号、Card、ReviewLog、ReviewTask、ReviewPreference、WrongQuestion、deck、Trace ids。evidence 只保存账号 id SHA-256。

- [ ] **Step 3: Review-only 双请求验收**

在当前进程设置 Review=true、Planner=false、acceptance component=review、随机 capability commitment、max=2，`--force-recreate server`。runner 在任何 await/dispatch/route.continue 前 claim；显式 API 一次，headed `/plan` 一次并保存 `plan.png`。目标必须 `candidate_applied/live_candidate/positive usage`，Planner deterministic，Trace 差值恰好 2，facts/分钟/链接/DB 不变。随后立即清 capability、两个 gate=false，并重建/探测 default-off server。

- [ ] **Step 4: Planner-only 双请求验收**

对称设置 Review=false、Planner=true、component=planner；显式 API 一次，headed `/today` 一次并保存 `today.png`。Trace 差值恰好 2；随后再次恢复 default-off server。

- [ ] **Step 5: gate-off owner isolation、cleanup 与 acceptance JSON**

在无 capability、两个 gate=false 下执行 owner-scoped suggestions/Trace/DB read，新增 Live attempts 必须为 0。精确删除所有 synthetic ids 和 browser storage并断言零残留。按 strict schema写 branch `acceptance.json`，包含 paired evidence SHA、两个 screenshot SHA、价格 profile/rates/source/rounding、4 requests、verified usage 与 CNY <=0.10；Trace 必须 `pricingKnown=false/costEstimate=0`。

- [ ] **Step 6: 提交分支产品验收**

```powershell
git add -- DEVLOG.md docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch
git commit -m "test(agent): accept Review Planner on branch"
```

### Task 9: Merge Main, Reverify, Push, and Safe Shutdown

**Files:**
- Create: `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/main/acceptance.json`
- Create: `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/main/plan.png`
- Create: `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/main/today.png`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`

- [ ] **Step 1: 分支最终门与 `--no-ff` 合并**

确认工作树 clean、完整静态门 exit 0、default-off server、synthetic residue 0；切换 main，执行 `git merge --no-ff codex/phase-6-9-5-review-planner-live-diagnostics`。不得重跑 V8 paired command。

- [ ] **Step 2: main 静态门与 committed evidence reader**

重新运行 Task 6 全部门；fresh reader 核对 once marker、stage manifest、candidate/seal、V1--V7 tree 与 evidence SHA。V8 paired provider attempts 必须保持原值 23。

- [ ] **Step 3: main 产品 replay**

按 Task 8 使用全新 synthetic fixtures、全新 acceptance capability 与 main 独立 4-request/CNY 0.10 cap，保存 main `plan.png`、`today.png`、`acceptance.json`。这不是 paired eval，不改写 V8 evidence。

- [ ] **Step 4: 更新最终权威文档并提交**

只有 main replay、default-off restore、cleanup 为零全部成立，才把 Phase 6.9.5 Review/Planner 子阶段标为完成；同时明确 Phase 6.9 其余 Agent 与 Phase 6.10 仍未完成。

```powershell
git add -- AGENTS.md DEVLOG.md docs/roadmap.md docs/ai-behavior-acceptance.md docs/acceptance-checklist.md docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/main
git commit -m "docs(agent): close Review Planner production acceptance"
```

- [ ] **Step 5: 推送并核对 SHA**

Run: `git push origin main`

Expected: `git rev-parse HEAD` 与 `git rev-parse origin/main` 完全一致，工作树 clean。

- [ ] **Step 6: 精确清理与安全停机**

清除当前 PowerShell 的 provider key、Live/eval/product gate/capability；重建 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、Review=false、Planner=false 的 server 并探测 deterministic。关闭 headed browser、Playwright、临时 Bun/API/Web/Admin 辅助进程；确认 synthetic DB/Trace/browser storage 为零。

Run: `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker stop`

禁止 `down`、`down -v`、prune、container/image/volume 删除、数据库 reset、Redis flush 或 MinIO wipe。记录最终进程/Compose/Git 状态后，再按用户要求调度 Windows 关机。

---

## 实施自检

- 设计的 15-stage durability、once/candidate/terminal/seal barrier、V1--V7 immutability、strict schema、预算、质量门、双重 admission、价格、branch/main evidence、visible browser、cleanup、push 与 shutdown 均有对应任务。
- V8 paired Live 只出现在 Task 7 一次；main 明确只读 committed evidence，不重跑 lineage。
- 每个生产行为变更都有先 RED、再 GREEN 的 focused test；每个逻辑阶段独立提交。
- 文档不包含未决实现项；任何实际失败以新失败测试收敛，不能通过重跑 provider 或扩大预算绕过。
