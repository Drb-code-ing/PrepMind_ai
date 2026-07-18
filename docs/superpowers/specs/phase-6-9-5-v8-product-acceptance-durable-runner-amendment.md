# Phase 6.9.5 V8 Durable Product Acceptance Runner Amendment

## 1. 背景与结论

V8 Task 5 的第一版 product acceptance control plane 已具备 server-only、component-bound、capability-bound 的两请求 admission，但 2026-07-18 独立复审证明它还不能安全执行 Task 8/9：runner 只有内存状态和 dependency port，进程崩溃后可以重新获得四个 slot；浏览器没有 close/drain 证明；default-off restore 没有实际 probe；Trace 没有稳定 id；仓库也没有真实 executable composition。

本 amendment 选择本机固定 NTFS durable ledger，而不是业务 PostgreSQL 表或继续使用纯内存计数：

- 纯内存方案不能跨进程崩溃约束 4+4 次请求，拒绝；
- PostgreSQL ledger 会为一次本地受控验收引入生产 migration、清理和权限面，范围过大，拒绝；
- 本地 NTFS ledger 复用 V8 已审计的 no-reparse HANDLE、write-through、flush、close 与 HANDLE-relative exclusive rename，在不污染业务 schema 的前提下阻止重跑，采用。

本 amendment 不改变 V8 paired Live 的 48/26/22、23 attempts、4500ms、CNY 1.00 或 V1--V7 immutability；它只收紧 paired complete 之后的 branch/main 产品验收。

## 2. Durable ledger

ledger 固定在：

```text
docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch/
docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/main/
```

每个 environment 使用固定、不可覆盖的 public leaves：

```text
.acceptance-reserved
manifest.json
.slot-01-review-api
.slot-01-review-api.result.json
.slot-02-review-browser
.slot-02-review-browser.result.json
.review-default-off.json
.slot-03-planner-api
.slot-03-planner-api.result.json
.slot-04-planner-browser
.slot-04-planner-browser.result.json
.planner-default-off.json
.owner-isolation-verified.json
.cleanup-verified.json
.recovery-only.json
acceptance.json
.acceptance-success
plan.png
today.png
```

规则：

- `.acceptance-reserved` 在任何 Docker、HTTP、浏览器或 provider 行为前 durable exclusive commit；存在 public/prepare leaf 即拒绝任何新的产品模型 invocation，但不拒绝下文单独定义的 recovery-only 路径。
- 本机 recovery journal 固定在 `.tmp/phase-6-9-5-v8-product-acceptance/<branch|main>/`。`recovery-manifest.json` 使用 strict schema，并在任何可能留下 Docker gate、synthetic account、fixture、Trace 或浏览器 profile 残留的操作前 durable exclusive commit；它预先记录 environment、精确 synthetic email、预生成 fixture/profile id 与 public ledger 路径，不保存 password、JWT、provider key、capability、prompt 或 response。后续恢复 stage 只写 append-only leaf，不覆盖 manifest。
- 产品验收进程必须在 reserve 前以 Windows `CreateFile` share-mode 0 取得该 environment 固定 `owner.lock` 的进程生命周期独占 HANDLE，并持续持有到 success 或失败清理完成；不得用仅存在内存的布尔值、PID 文件或可删除 marker 代替。进程硬崩溃时由 OS 自动释放 HANDLE，但 lock leaf 不删除。
- `manifest.json` 在 synthetic fixture 完成、任何产品模型请求前 immutable commit，绑定 environment、commit/paired evidence SHA、固定模型/价格/预算、账号与 fixture id SHA。精确 synthetic selector 只保存在上述未跟踪 recovery journal，用于正常 cleanup 或崩溃后的 cleanup-only，不进入提交证据。
- 四个 slot 只能按固定顺序消费。每次 claim 前必须证明当前 reservation 仍持有原 product owner HANDLE，并 fresh 反查 recovery stages/public terminal 均不存在；slot marker 必须在 API dispatch 或 browser `route.continue()` 前 durable commit，任一检查或 commit 失败不得调用外部依赖。
- 每个 request 返回并完成对应持久化 Trace 核对后，写 strict result record；每个 result 恰好保存一个 Trace id SHA-256，并保存 slot、实际 provider/model、正整数 usage、duration、disposition/provenance 和 screenshot SHA（browser slot）。四个 result 的 Trace id 必须全局唯一，并与四个 request 一一对应。不得保存 token、cookie、email、JWT、capability、URL、prompt、response、用户 facts 或 raw error。
- marker 已存在但 result 缺失表示“请求可能已发生但结果不可验证”，该 environment 永久 fail-closed，不删除、不重置、不重跑。
- branch/main 每轮上限为 `7_800 / 1_760`，四个 slot 的固定 reservation 为每 slot `1_950 / 440`。单 slot 或累计 verified usage 超限时关闭；main reserve 前必须读取完整 branch ledger/evidence，并确认两轮合计不超过 `15_600 / 3_520` 和未舍入 CNY `0.10000000`。
- branch 与 main 各只有一次 ledger；main 不重跑 paired V8，只读取 paired committed evidence SHA。
- `.owner-isolation-verified.json` 必须在删除 synthetic 数据前 durable commit，绑定两个 owner 的 facts-before/facts-after digest、四条唯一 Trace、跨账号不可见证明与零业务写入证明；cleanup 不能代替或事后重建该 proof。
- `acceptance.json` 先由 fresh ledger reader 聚合并 durable commit；只有绑定 manifest、四个 claim/result、两个 restore proof、`.owner-isolation-verified.json`、`.cleanup-verified.json`、截图 SHA、acceptance SHA 与 paired lineage 的 `.acceptance-success` exclusive seal 存在时，public reader 才能投影 complete。
- `.recovery-only.json` 只表示 hard-crash 后已恢复 default-off 并完成精确 cleanup；它是 terminal failed evidence，不允许补写 request result、`acceptance.json` 或 success seal，也不把 environment 恢复为可验收状态。
- `.acceptance-success` 与 `.recovery-only.json` 是双向互斥终态：success finalizer 必须在仍持有 product owner HANDLE 时 fresh 反查所有 recovery stage/public terminal 均不存在；recovery 在持有同一 exclusive HANDLE 时 fresh 反查 success 不存在。public reader 若发现两者并存，固定返回 `evidence_io`，绝不选择其一。

durability 口径与 V8 一致：只声明 local fixed NTFS process crash/restart recovery，不声明物理断电一致性。

## 3. Runner contract 收紧

`runReviewPlannerV8ProductAcceptance()` 在任何 slot reservation 前完成安全 snapshot：environment、commit SHA、paired evidence SHA、两个不同账号 id SHA、两个非空 capability 和固定 API origin。hostile getter、非法 metadata 或 raw dependency error统一折叠为固定安全码，不触发 Docker/HTTP/browser。

runner 不再把 Trace evidence 由作者常量拼出：

- `PersistedTrace` 必须包含稳定 `traceId`；同一 component 的两个 id 必须不同；
- provider/model/steps/pricing/disposition/usage 从两条已验证的持久化 Trace 聚合；
- API/browser response usage 必须与对应 Trace usage 一致；
- evidence 只从聚合结果构建。

浏览器必须从 `http://127.0.0.1:3000` 打开学习端，route guard 固定绑定 `http://127.0.0.1:3001/review-agent/suggestions` 的 scheme、host、port、pathname；`localhost` 或其他 origin 即使 pathname 相同也 abort，不能收到 capability。browser adapter 只有在 acceptance context 已关闭、所有 route callback settled、无晚到第二请求时才返回 strict close/drain receipt；runner 在 receipt 后再判定 browser slot 成功。

每个 component 的顺序固定为：

```text
activate exact Live server
-> facts-before digest
-> durable API slot + API request
-> poll/verify unique API Trace + durable API result
-> durable browser slot + headed request + close/drain
-> immediately clear capability/gates and recreate default-off server
-> authenticated deterministic suggestions probe
-> durable default-off receipt
-> poll/verify unique browser Trace + durable browser result
-> read facts-after
```

正常路径只 restore 一次；异常路径的 `finally` 只在尚未取得 verified receipt 时做 fail-safe restore。`Promise<void>` 不再证明恢复，composition 必须返回 strict receipt。restore 先记录 Live container id，使用显式空 provider credential 与全部 gate off 强制重建 server，再通过 `docker compose ps -q server` + `docker inspect` 的机器读取结果证明 container id 已更换且精确环境为：`AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、两个业务 gate false、acceptance gate false、component/capability hash 为空、max requests 0、DeepSeek/OpenAI credential 为空；inspect 原始环境不得写 stdout/evidence。还必须把 server port/health 响应绑定到该 inspected container。只有上述容器证明成立后才做 authenticated suggestions probe，并要求 target suggestion `local_deterministic`。strict receipt 绑定新 container id SHA-256、inspected config facts、health proof 与 deterministic response；仅有 deterministic response 或计划传入的 env 不能证明恢复成功。

### 3.1 Fresh-process recovery-only contract

硬崩溃不能依赖 `finally`。仓库必须提供独立 package entry `recover:review-planner:v8:product`，只接受 exact literal `--confirm-v8-review-planner-product-acceptance-recovery-only` 与 `branch|main`：

- fresh process 先以 no-reparse reader 同时读取 public reservation 与本机 recovery manifest；任一 identity/schema/path 不匹配即零副作用关闭；
- recovery 必须以 non-blocking 方式取得与产品进程相同的 `owner.lock` exclusive HANDLE；锁仍被持有表示产品进程尚存活，立即以固定 `owner_active` 零副作用退出。只有锁已释放且 `.acceptance-success` 不存在时，才取得 recovery ownership，并持有到 public `.recovery-only.json` commit 或本次恢复进程退出；
- recovery 可以幂等重做 server default-off recreate、default-off probe 与 exact synthetic cleanup，但不得 claim request slot、补 result、调用 acceptance HTTP dispatch、执行 browser `route.continue()` 或触达 provider；provider/runtime invocation count 必须恒为 0；
- default-off probe 使用恢复进程新建的临时 synthetic probe account：其 exact email 在 recovery manifest 中预留，注册响应只在内存中持有 token，probe 后按 exact email 删除；如果 recovery 再次硬崩溃，下一次先按该 exact email 删除残留，再重新执行零模型恢复；
- recovery journal 至少包含 append-only `restore.claimed` / `restore.verified.json` / `cleanup.claimed` / `cleanup.verified.json` stages；claim 后崩溃允许重复对应的幂等零模型动作，但禁止删除、覆盖或重置任何 stage；
- 只有 verified default-off receipt 与所有 exact residue count 为 0 时，才 durable commit public `.recovery-only.json`。该 receipt 必须证明两个业务 gate false、acceptance gate false、capability absent、mode mock 与 deterministic suggestion probe；
- recovery manifest 预先绑定该环境唯一 browser executable path 与 `user-data-dir`。fresh recovery 必须只枚举 executable 与 command line 同时匹配、且含该 exact profile path 的 Chrome/Edge process tree，精确终止并等待这些 PID 退出及 profile handle drain，禁止按进程名全局 kill；随后删除并验证该 exact profile 不存在。profile identity/path 不匹配时 fail-closed，不操作其他浏览器。
- native/child-process 测试必须在 activation、fixture create、API claim、browser claim、restore 与 cleanup 边界模拟 hard exit，并由 fresh process recovery command 证明零 provider、精确新 default-off container、零 synthetic/browser residue；另以两个 child process 竞争证明 active owner 时 recovery 为 `owner_active`、recovery ownership 后产品不能继续、success/recovery 两终态不能并存且恶意双终态 fixture 被 reader 判为 `evidence_io`。

## 4. 真实 executable composition

仓库新增唯一产品验收 package entry `accept:review-planner:v8:product`。它只接受 exact literal `--confirm-v8-review-planner-product-acceptance` 和 `branch|main`，并实现 runner 的真实 dependencies；恢复使用上一节独立的 recovery entry 与不同 literal：

- 在 recovery manifest 中先冻结两个 `phase695-v8-accept-<UTC>` exact email 和所有可预生成 fixture id，再用 API 注册 synthetic 账号；凭据只保存在当前进程；
- 用 Prisma 创建并记录最小 Card/ReviewLog/ReviewTask/ReviewPreference/WrongQuestion/deck fixture ids；
- 用精确 Compose 命令只 `--force-recreate server`，不得 down、删除 container/image/volume、reset、flush 或 wipe；
- 用 authenticated fetch 调用 suggestions 和 Trace API；
- 仓库以 exact `playwright-core@1.61.1` devDependency 锁定 repo-owned browser adapter，用它启动 system Chrome `headless:false` 和 manifest 绑定的唯一临时 profile；通过 `http://127.0.0.1:3000` UI 登录、打开 `/plan` 或 `/today`、限制唯一 `127.0.0.1:3001` suggestions route、保存截图并关闭 acceptance context；不下载 bundled browser。为便于用户观察，可在安全恢复后打开不含 capability 的静态 evidence 预览窗口；
- suggestions 前保存该 owner 当前 Trace id 基线；响应后有界轮询 `GET /agent-traces?limit=50&route=review_analysis&mode=live`，禁止重发 suggestions；id 差集必须恰好为 1，再读取 detail，并以四个固定 steps 中仅 `review_candidate` 或仅 `planner_candidate` 的 `candidate_applied` disposition 判定 component。现有 Trace API 不支持 component/time filter，不得假设存在这些过滤参数；default-off/owner probes 产生的 Mock Trace 不进入 Live 差集，但必须纳入 exact cleanup；
- 用 Prisma 对 owner-scoped facts 做 before/after digest、验证隔离，并按精确 ids 清理；
- 在 cleanup 零残留后由 strict serializer 写 `acceptance.json`。

CLI stdout 只允许固定 stage/status/count/usage/cost 摘要，不输出 email、password、token、capability、URL、Trace id、数据库 id、provider raw error 或 stack。任何失败不自动重试，不删除 ledger，也不启动另一个 environment。

## 5. TDD 与验收门

在真实产品请求前必须通过：

- native ledger：duplicate/concurrent reserve、四 slot 顺序、prepare/write/flush/close/reopen/rename fault、hard exit、result 缺失、branch/main aggregate、reparse、recovery journal 与 fresh-process recovery-only；
- runner：hostile input、Trace id 唯一、identity/usage/steps 聚合、wrong origin、晚到第二 route、close/drain、immediate verified restore、failure cleanup 和固定错误脱敏；
- composition：fake process/fetch/browser/Prisma adapters 验证精确命令、无副作用 preflight、fixture id 记录、default-off 顺序、exact cleanup 和 safe stdout；
- server focused/full tests、Windows native tests、Agent/AI/Web、types、non-fix lint、build、Compose config、Review E2E；
- contract/security 与 acceptance/operations 两轮独立复审均无未关闭 Critical/Important。

只有这些离线门通过，才保留 V8 unique paired Live 的执行资格；只有 paired committed complete，才运行 branch product acceptance。
