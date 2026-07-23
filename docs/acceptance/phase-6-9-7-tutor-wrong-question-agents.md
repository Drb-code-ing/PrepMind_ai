# Phase 6.9.7 Task 11 — Tutor / WrongQuestionOrganizer Branch Checkpoint

日期：2026-07-23

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

checkpoint 起点：`3e85fcc449d9a80034f886b06cb2e1ad4461b4b7`

状态：分支 focused、全量静态、deterministic baseline、strict Mock、Organizer PostgreSQL E2E、Compose quiet config 与残留核对均通过；两个生产 gate 仍默认关闭。没有读取根 `.env`/credential、调用 provider、创建 Live marker/evidence、启动产品 API/Web 或执行浏览器验收。下一步必须先取得 Task 12 唯一 controlled-Live 的新授权。

## 1. 为什么 Task 9/10 通过后还需要 checkpoint

Task 9 证明 72-case runner、zero-call guard、Mock runtime、usage/CNY 重算和 evidence contract 可以工作；Task 10 证明部署 allowlist 与 default-off 配置正确。它们仍是局部门，不会自动证明此前 Task 1--8 的候选、owner/write fence、Trace、API contract、Web 来源状态，以及仓库内其它 Agent/AI/Server/Web 代码在同一分支 HEAD 上没有回归。

Task 11 因此固定四个目标：

1. 在同一提交上重跑两个 Agent 的 focused 与仓库级全量门；
2. 重新生成未修饰 deterministic baseline 和一份 fresh strict Mock，并独立校验报告；
3. 用现有 PostgreSQL 只验证 Organizer owner/write/default-off contract，精确核对测试残留；
4. 在任何真实模型调用前让 contract/security 与 operations/acceptance 两路独立终审同一份 checkpoint。

Task 11 不把 Mock 满分解释为真实模型可用，也不提前消费 Task 12 的一次性授权。

## 2. 仓库与运行边界

- checkpoint 起点相对本地 `origin/main` 引用：behind `0` / ahead `11`；该数字只描述当前本地 remote-tracking ref，不替代 Task 13 的 fresh fetch 与远程 parity。
- checkpoint 开始时源码工作区为 clean；所有验证命令完成后先确认没有源码改动，此后只新增本验收记录并同步当前态文档。
- 只复用已运行的 `docker-postgres-1`（创建于 11 天前，本轮检查时已运行约 6 小时）完成 Organizer E2E；没有启动、重建、停止或删除任何 Docker service。
- 没有启动 Nest API、Next Web、worker 或 admin 产品进程，没有执行 HTTP 产品验收或浏览器验收。
- 没有执行 Docker prune、`down -v`、container/image/volume 删除、database reset、Redis flush 或 MinIO wipe。

## 3. Focused 与数据库验收

| 范围 | 结果 |
| --- | --- |
| Tutor + WrongQuestionOrganizer contract/projection/candidate/policy + Phase 6.9.7 cases/metrics/runner/CLI | `97/97`，`1105 expect()` |
| Task 10 Server config/Compose focused | `29/29` |
| Tutor Web config focused | `5/5` |
| WrongQuestionOrganizer PostgreSQL E2E | `10/10` |

Organizer E2E 覆盖：default-off batch 不产生模型 Trace、owner isolation、locked deck name、唯一 item relation、同 owner 并发同主题、missing/cross-owner 统一 404、force 唯一关系，以及并发 rename/move 的用户 authority。E2E 完成后数据库中 `wrong-question-organizer-%@example.com` 测试账号计数为 `0`；级联组织层与 Trace 数据没有本轮残留。

## 4. 分支全量静态门

| 包/门禁 | 结果 |
| --- | --- |
| Agent tests | `543/543`，`5593 expect()` |
| Agent typecheck / lint | exit `0` / exit `0` |
| AI tests | `194/194`，`1020 expect()` |
| AI typecheck / lint | exit `0` / exit `0` |
| Types tests + typecheck | `42/42`，`tsc --noEmit` exit `0` |
| Server tests | `227` suites passed / `3` skipped；`2152` tests passed / `30` skipped |
| Server lint / build | exit `0` / exit `0` |
| Web tests | `438/438` |
| Web lint / production build | exit `0` / exit `0`；17 routes |
| Compose tracked example | `config --quiet` exit `0`，无 stdout |
| `git diff --check` | exit `0` |

Node test runner 对尚未声明 package `type=module` 的 TypeScript package 输出 `MODULE_TYPELESS_PACKAGE_JSON` 性能 warning；测试、类型检查和构建仍为成功。该 warning 不改变 contract 结果，也不被误写成零 warning。

## 5. 未修饰 deterministic baseline

- dataset：`phase-6.9-tutor-wrong-question-v1`
- SHA-256：`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`
- cases：72（24 zero-call contract + 48 runtime）
- paired requests：24
- Organizer decision units：32
- 完整 runtime pass：`6/48`
- critical failures：`0`
- Tutor semantic：`0.44186666666666674`
- WrongQuestionOrganizer semantic：`0.278125`
- combined semantic：`0.3599958333333334`
- provider invocation / input / output / cost：`0 / 0 / 0 / 0 CNY`

该 baseline 仍直接调用未修饰 deterministic policy，不经过候选 guard；它用于量化受治理模型候选要解决的语义缺口，不能替代后续 zero-call 或 Live 质量证据。

## 6. Fresh strict Mock checkpoint

- run ID：`0c33c01f-802a-4f53-a6e6-538b7af9abc7`
- runner：`phase-6.9.7-tutor-organizer-runner-v1`
- executor provenance：`mock_synthetic`
- counts：72 cases / `24/24` verified zero-call / `48/48` runtime / 24 paired requests / 32 Organizer decisions
- Tutor semantic / absolute improvement：`1 / 0.5581333333333333`
- Organizer semantic / absolute improvement：`1 / 0.721875`
- combined semantic：`1`
- P95：Tutor `246ms` / Organizer `328ms` / paired candidate `328ms` / Tutor orchestration `276ms`
- verified usage：input `21948` / output `5647`
- estimated cost：`0.099726 CNY`
- report gate：`quality_gate_failed`
- validator：`{"ok":true,"filesChecked":1}`
- transient evidence SHA-256：`d04e41cda0d6e46d25cb0c63dd4f389824a79d8dbf6383f142f972634c0583f2`

`quality_gate_failed` 是冻结的 Live-only production gate：只有 `mode=live`、真实 `deepseek_network` provenance、全部质量/安全/延迟/usage/价格门同时通过，才可能得到 `quality_gate_passed`。Mock 满分只证明工程 contract，不证明供应商语义、网络 P95、真实 token 或真实账单。

Mock evidence 在 validator 通过并记录精确 run ID/hash 后，只删除本轮唯一精确文件；没有清空 `.tmp`。最终 `.tmp/phase-6-9-7-tutor-organizer-*` 匹配数为 `0`，controlled-Live marker 与 Live evidence 都不存在。

## 7. 权限、预算与降级结论

| 组件 | 模型可决定 | 本地继续权威 | 单请求上限 |
| --- | --- | --- | --- |
| Tutor | 隐含/上下文/冲突意图的受限教学 intent/depth/evidence | final route、明确教学指令、`answer_direct` 禁止、TutorStrategy、prompt 结构、最终流式回答、RAG/Verifier | `1 call / 1200 input / 300 output / 0.006 CNY / 3000ms` |
| WrongQuestionOrganizer | 最多 12 道低置信安全错题的 subject/action/deck ordinal/topic/evidence | owner、真实 ID、locked name、snapshot/三 fence、model-free command、SubjectGroup/Deck/Item 写入、用户 rename/move authority | `1 call / 3500 input / 800 output / 0.016 CNY / 5000ms` |

- Tutor 与 Organizer 使用独立 gate、credential 和预算；generic/cross-component key 都不能替代。
- Tutor 只进入 Web server runtime；Organizer 只进入 Nest API server；worker/admin 不接收两组能力，worker 模块再次强制关闭。
- 明确 Tutor 指令、已有/high-confidence Organizer、unsafe、abort、owner/stale、预算或配置失败保持 provider 前 zero-call。
- schema、usage、timeout、runtime、Trace 或 post-candidate stale 失败都回到本地限制性结果；不会自动重试模型。
- Organizer 模型结果只有先持久化 admission Trace、再通过本地三阶段 fence 和 owner lock 才能影响组织层；不能改 WrongQuestion、Card、ReviewLog、ReviewTask、ReviewPreference 或用户锁定名称。

## 8. 本 checkpoint 明确没有完成什么

- 没有读取、打印或复制根 `.env`、`apps/*/.env*` 或真实 API key；
- 没有调用 DeepSeek、OpenAI、Qwen embedding 或其它 provider；
- 没有设置 controlled-Live 授权变量，没有创建 Live marker/evidence；
- 没有启用 Tutor/Organizer 生产 gate，tracked default 继续是 `false / false`；
- 没有证明真实 DeepSeek 语义质量、真实网络延迟、真实 token/CNY 或 provider retention 行为；
- 没有执行 Docker API/Web、Tutor Chat、Organizer authenticated API 或可见 `/chat`、`/error-book`；
- 没有合并 main、执行 main default-off 回放或推送远程。

## 9. 独立终审

Task 11 文档完成后已执行两路互相独立的只读终审：

- contract/security：初审只指出本节仍保留“待最终记录”的 Important 文档闭环缺口；补齐结果后复核为 `APPROVED`，无未解决 Critical/Important。确认 static/Mock 未冒充 Live，独立 gate/credential/budget、zero-call、owner/write fence、Trace admission、default-off 与 Task 12 新授权门一致；
- operations/acceptance：`APPROVED`，无 Critical/Important。确认全量数字、Compose config-only 边界、PostgreSQL E2E/残留、Mock evidence 精确删除、生产 gate=false、未执行产品 Docker/API/浏览器、Task 13 main merge/push 尚未完成，以及非破坏性 Docker 约束均一致。

终审没有触发源码或运行配置修改；只修复上述结果占位并重跑文档 diff/Compose quiet 门。Task 11 不带未解决 Critical/Important 进入授权申请。

## 10. 停止条件与下一步

Task 11 checkpoint 完成后必须停在授权门前。下一步 Task 12 才包含：唯一 72-case controlled-Live、通过质量门后的 Docker/API、headed 可见浏览器、Trace/权限/费用核对、精确合成数据清理和 default-off 恢复。

继续 Task 12 需要用户在本 checkpoint 之后重新确认，建议使用：

> 我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7 Tutor/Organizer branch controlled-Live。

没有这次新授权，不得读取 credential、创建 marker、调用 provider、启动产品验收或把 Mock 解释为真实可用。

回顾时可以问：

- 为什么 Task 9 的 Mock 满分后仍要做 Task 11 全量 checkpoint？
- deterministic `6/48` 与 Mock `48/48` 分别证明什么、又不证明什么？
- 为什么 Tutor 和 Organizer 需要独立 credential、预算与容器 allowlist？
- Organizer 的 admission Trace、三次 fence 和 owner lock 分别阻止什么？
- 为什么 Mock evidence 可以精确删除，而 controlled-Live marker/evidence 必须不可变封存？
- 为什么 Task 11 完成后必须重新申请授权，而不能沿用此前任何一次 Live 授权？
