# Phase 6.9.5 V8 Durable Product Acceptance Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. 正文复选框保留为最初计划模板；当前进度只以紧随其后的“执行状态”为准，未勾选不表示任务尚未执行。

> **执行状态（2026-07-18）：** Task 1--4 已完成离线实现、最终门和 contract/security + acceptance/operations 双复审；未运行 V8 Live、Docker 产品验收或浏览器。后续 branch/main 产品验收必须继续使用本 runner，不得回退为手工或纯内存流程。

**Goal:** 为 V8 branch/main 产品验收补齐不可重跑的 durable slot/usage ledger、真实 executable composition、headed browser close/drain、verified default-off restore 与 Trace/cleanup 证据。

**Architecture:** 使用本机固定 NTFS no-reparse HANDLE 和 exclusive rename 保存 branch/main 一次性 ledger；runner 在外部请求前同步持久消费 slot，响应后写 strict result。真实 Bun CLI 组合 Docker server recreate、authenticated API、Prisma synthetic fixtures/cleanup 和 system Chrome headed Playwright；依赖可注入以保证离线 TDD。

**Tech Stack:** Bun, TypeScript, Zod, Bun FFI/Windows NT API, NestJS/Prisma, Docker Compose, built-in fetch, playwright-core, Jest, Bun native tests.

---

## 文件职责

- `review-planner-v8-product-acceptance-ledger.ts`：ledger profile、strict record、reservation capability、slot/result/restore/owner/cleanup/final reader。
- `review-planner-v8-product-acceptance-recovery.ts`：本机 recovery manifest/journal、Windows lifetime owner lock、fresh-process recovery-only orchestration 与 strict receipt。
- `review-planner-v8-product-acceptance-ledger.native.bun.test.ts`：真实 NTFS durability、crash、reparse、concurrency、recovery 与 branch/main budget。
- `review-planner-v8-product-acceptance-runner.ts`：输入 snapshot、durable ledger orchestration、Trace 聚合、origin/drain/restore contract。
- `review-planner-v8-product-acceptance-runner.spec.ts`：依赖注入、hostile/fault、顺序、零额外 dispatch。
- `review-planner-v8-product-acceptance-composition.ts`：Docker/API/Prisma/Playwright adapters 与 strict safe summary。
- `review-planner-v8-product-acceptance-composition.spec.ts`：fake adapters 的真实 composition contract。
- `scripts/review-planner-v8-product-acceptance.ts`、`scripts/review-planner-v8-product-acceptance-recovery.ts` 与 `apps/server/package.json`：产品验收与 recovery-only 两个互斥 executable entry。

### Task 1: Durable branch/main ledger

**Files:**
- Create: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.ts`
- Create: `apps/server/src/review-agent/review-planner-v8-product-acceptance-recovery.ts`
- Create: `apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.native.bun.test.ts`

- [ ] **Step 1: 写 reservation/slot/result RED**

使用临时 repo root 创建历史 V8 complete fixture，断言 `reserve(environment)` 后再次 reserve 失败；先 durable 写入固定 `.tmp/.../recovery-manifest.json`，再允许 fixture side effect；`claim(review-api)` durable 创建 marker；没有 API result 时 `review-browser` claim 失败；browser result 还必须依赖对应 default-off receipt。每个 result 恰好绑定一条 Trace，四条 Trace id 全局唯一。

- [ ] **Step 2: 运行 RED**

Run: `bun test apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.native.bun.test.ts`

Expected: FAIL，module/export 缺失；不得触达真实 evidence 目录。

- [ ] **Step 3: 实现最小 ledger**

复用 `WindowsNoReparseChildDirectory.commitExclusiveDurableFileViaRename()`；产品/恢复共用固定 `owner.lock` 的 Windows `CreateFile` share-mode 0 生命周期 HANDLE，产品从 reserve 前持有到终止，recovery 只能在 HANDLE 已由 OS 释放后 non-blocking 接管。公开 reservation 只暴露 fixed methods，私有 directory/nonce/state/owner HANDLE 保存在 WeakMap。每次 slot claim 都验证 owner HANDLE 仍有效并反查 recovery stages/terminal absent，再同步 durable commit；manifest/result/restore/owner-isolation/cleanup/evidence/success seal 都使用 strict schema 与 exclusive commit。每 slot限制 `1950/440`、每环境 `7800/1760`；main reserve fresh 读取 branch sealed ledger 和 evidence。固定 recovery path 使用 strict manifest 与 append-only stage leaf；public `.recovery-only.json` 是 terminal failed proof，不能恢复验收资格。success/recovery finalizer 各自反查另一终态及全部对方 stage 不存在，reader 遇到双终态固定 `evidence_io`。

- [ ] **Step 4: 增加 fault/crash/reparse/budget GREEN**

覆盖 prepare create/write/flush/close/reopen/rename、post-rename cleanup、duplicate/concurrent、slot 无 result、hard exit、branch incomplete、main aggregate cap、unknown leaf。child process 分别在 activation、fixture、API/browser claim、restore、cleanup 后 hard exit；fresh recovery process 只允许 default-off recreate/probe/exact cleanup，断言 provider、acceptance dispatch 与 browser continue 恒为 0。增加 product/recovery 两 child 竞争：active owner 时 recovery 固定 `owner_active`，owner crash 释放 HANDLE 后 recovery 才可接管，接管后产品不能继续；双终态 fixture 必须 `evidence_io`。产品 ledger 任何失败零 delete/reset/retry；recovery 的幂等零模型动作允许按 append-only journal 继续。

- [ ] **Step 5: 验证并提交**

Run: native test、targeted non-fix ESLint、server build、`git diff --check`。

Commit: `feat(agent): add durable V8 product acceptance ledger`

### Task 2: Harden runner around ledger and verified receipts

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-runner.ts`
- Modify: `apps/server/src/review-agent/review-planner-v8-product-acceptance-runner.spec.ts`

- [ ] **Step 1: 写 metadata/Trace/origin/drain/restore RED**

测试必须证明 invalid/hostile commit/SHA/capability 在 `activateComponent` 前固定失败；重复 Trace id、作者手填 identity、错误 origin、browser resolve 后晚到第二请求、未关闭 context、void restore 或非 deterministic probe 均不能写 evidence。

- [ ] **Step 2: 运行 RED**

Run: focused runner spec，确认每类缺口以预期原因失败。

- [ ] **Step 3: 实现最小 contract**

入口先 safe snapshot；runner 依赖 ledger reservation。Trace port 增加稳定 id并返回实际 provider/model/steps/usage；每个 request 只绑定对应的一条 Trace，四条 id 全局唯一。browser 返回 close/drain receipt；restore 返回 strict default-off receipt。唯一顺序为 API claim/request -> API trace/result -> browser claim/request/close-drain -> immediate restore/probe/receipt -> browser trace/result -> facts-after；finally 仅补未验证 restore。

- [ ] **Step 4: 运行 GREEN 并提交**

Run: runner/evidence/admission/env focused、non-fix ESLint、server build、Compose config。

Commit: `fix(agent): bind V8 product acceptance to durable receipts`

### Task 3: Executable Docker/API/Prisma/headed-browser composition

**Files:**
- Create: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.ts`
- Create: `apps/server/src/review-agent/review-planner-v8-product-acceptance-composition.spec.ts`
- Create: `apps/server/scripts/review-planner-v8-product-acceptance.ts`
- Create: `apps/server/scripts/review-planner-v8-product-acceptance-recovery.ts`
- Modify: `apps/server/package.json`
- Modify: `apps/server/package.json` / `bun.lock`，显式增加 exact `playwright-core@1.61.1` devDependency，不下载 bundled browser。

- [ ] **Step 1: 写 exact CLI/composition RED**

产品入口只接受 `--confirm-v8-review-planner-product-acceptance`，恢复入口只接受 `--confirm-v8-review-planner-product-acceptance-recovery-only`；两者均要求精确 environment。产品入口的 V8 committed evidence reader、clean Git、default-off Compose、Chrome path 与 synthetic prefix 缺一项时，断言零 ledger/Prisma/process/fetch/browser side effect；恢复入口不满足 public reservation + local manifest identity、无法取得 owner HANDLE 或已存在 success 时同样零副作用。

- [ ] **Step 2: 实现 synthetic fixture adapter**

先预生成两个 synthetic email、所有可控 fixture/profile id 和 recovery probe email，并 durable 写 recovery manifest；再由 API 注册两个随机 synthetic 账号，Prisma 创建最小 owner-scoped Review/Planner facts并记录精确 ids；所有 password/token 只存在进程内。facts digest只包含相关表的 canonical id/version/count hash。

- [ ] **Step 3: 实现 Compose/API/Trace/restore adapter**

只执行精确 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --no-deps --force-recreate server`；activation使用 exact V4 Pro/单组件/2 requests/capability hash。restore 显式清空 DeepSeek/OpenAI credential并设置 Mock/off/无 capability，记录前后 container id，再以 `docker compose ps -q server` + safe-parsed `docker inspect` 验证新容器、精确 env，并把 port/health 响应绑定到该 container；禁止输出 inspect 原文。容器证明通过后才用 authenticated suggestions probe完成 strict receipt，receipt 绑定 container id hash + inspected facts + health + deterministic response。增加 stale Live container RED：inspect/identity 不通过时 suggestions/provider 均为0。

- [ ] **Step 4: 实现 headed Playwright adapter**

显式使用仓库锁定的 `playwright-core@1.61.1` 和 system Chrome `headless:false`；从 `http://127.0.0.1:3000` UI 登录；只对精确 `http://127.0.0.1:3001/review-agent/suggestions` 追加 capability；仅一个 suggestions request可 continue；截图后关闭 acceptance context并等待全部 route callbacks。adapter 只有 strict close/drain receipt后返回。唯一 Chrome executable path 与临时 `user-data-dir` 在 recovery manifest 中预留；正常 cleanup 与 recovery 都只终止 executable + command line 绑定该 exact profile 的 process tree，等待 PID 退出/profile handle drain后删除并验证 profile，不得全局 kill 浏览器。

- [ ] **Step 5: 实现 Trace、cleanup、safe evidence**

每次 suggestions 调用前保存 owner 当前 Trace id baseline；随后用现有 `route=review_analysis&mode=live` 有界轮询新 id且禁止重发 suggestions，id 差集必须恰好1，再读取 detail，并以四个固定 steps 中仅一个 candidate step 为 `candidate_applied` 推导 component，不假设 API 支持 component/time filter。default-off/owner probe 的 Mock Trace 不进入 Live 差集但纳入 cleanup。每个 slot 恰好一条、每 component 两条、每 environment 四条且全局唯一；owner isolation/facts unchanged 必须先写独立 durable proof，再按精确 ids 删除并断言合成账号、业务记录、Trace、browser storage为0；最后写 ledger cleanup和strict `acceptance.json`。

实现 recovery-only composition：fresh process non-blocking 取得同一 owner HANDLE 后读取 public reservation + local recovery manifest，并反查 success absent；先精确终止/清除 manifest profile，再以显式空 provider credential、Mock/off/无 capability 重建 server并验证新 container id + inspect env；用 manifest 预留的 recovery probe email 注册临时账号、在内存中使用 token 完成 deterministic suggestions probe，再精确删除 probe 与原 synthetic ids。它不得 claim slot、发 acceptance header、continue browser route 或调用 provider；成功只写 `.recovery-only.json`，不写 success evidence，并在进程退出时释放 owner HANDLE。

- [ ] **Step 6: 运行 fake composition GREEN并提交**

Run: composition/runner/ledger focused、targeted lint/build/Compose、negative exact CLI，确认没有真实 Docker/browser/provider/evidence副作用。

Commit: `feat(agent): add executable V8 product acceptance runner`

### Task 4: Full offline gates, independent reviews, and docs

- [ ] **Step 1:** 运行原 V8 Task 6 全部门、Review E2E、ledger native 与 composition focused。
- [ ] **Step 2:** contract/security 独立复审；关闭所有 Critical/Important。
- [ ] **Step 3:** acceptance/operations 独立复审；关闭所有 Critical/Important。
- [ ] **Step 4:** 更新原 V8 design/plan、`DEVLOG.md`、acceptance doc、roadmap、AGENTS 与 checklist，明确仍未运行 V8 Live。
- [ ] **Step 5:** 独立提交 `docs(agent): record V8 durable runner offline gates`。

完成 Task 4 后才恢复原计划 Task 7 的唯一 V8 controlled-Live；Task 8/9 必须使用本计划的唯一 executable runner。
