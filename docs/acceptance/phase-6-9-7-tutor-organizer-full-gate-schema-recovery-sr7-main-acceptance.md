# Phase 6.9.7 Tutor / Organizer Schema Recovery SR7 Main 验收

> 验收日期：2026-08-04（Asia/Shanghai）<br>
> SR6 功能提交：`64d4ff45337be6802db9cba5f19af76d2a143da2`<br>
> 首次 main 合并：`510bbc94c1a202a08487ffb2a54524a44d5e3482`<br>
> 精确 step-check 修复：`43af2e85`<br>
> 修复后 main：`006f54e910e6e8fe49e7474679bb13b7016982d7`<br>
> Authority：zero-provider main/default-off product acceptance

## 1. 结论

SR7 已完成 SR6 功能分支到 `main` 的合并、远程发布，以及 `main` 上的 default-off static、Docker、API、
可见浏览器和 Trace 回放。验收期间没有重跑 SR5，没有再次启用 SR6 sealed replay，没有执行额外 Provider
探测；Tutor、Organizer、Router、Verifier、Review/Planner 与 Knowledge Agent 模型 gate 及全局 Live gate
均保持关闭。

首次 main 浏览器回放发现一个真实确定性路由缺口：精确句“我算到 `f'(2)=4`，这一步对吗？请只检查
这一步。”被旧关键词表路由到 Chat。修复只为 Tutor 规则补充“这一步/这步”，并加入精确回归用例；修复
从最新 `main` 新开普通分支完成、单独提交和推送，再 `--no-ff` 合并回 `main`。修复后同一句稳定得到
`route=tutor / intent=step_check`，Tutor model candidate 为 `attempted=false`、模型调用/token 全 0、原因
`LIVE_CALLS_DISABLED`，Trace 为 Mock、成本 0。

因此 Phase 6.9.7 TutorAgent / WrongQuestionOrganizerAgent 正式收口。SR5 的真实模型 full-gate semantic
authority、SR6 的分支 zero-provider product authority 与 SR7 的 main/default-off authority 各自独立，互不替代。
下一原子阶段是 Phase 6.9.8 RetrieverAgent / FinalResponseAgent 正式化与通信 contract；Phase 6.10 分层
记忆、Phase 8/9 与博客收尾仍不得提前开始。

## 2. 为什么需要单独做 SR7

SR5 只证明固定评测集上的真实模型 schema、语义、P95、usage 与预算门；SR6 只证明功能分支上的产品
composition、权限、Trace、降级和 UI。二者都不能证明：

- 代码已经进入 `main` 并发布到远程；
- 默认关闭配置在 `main` 镜像中仍然 fail-closed；
- 普通用户在不产生模型调用和费用时仍能使用 Tutor/Organizer 的本地路径；
- 合并后是否出现只在真实句式、Docker 或可见页面中暴露的回归。

SR7 只补齐这些发布与默认关闭证据，不重复消费已经封存的模型证据。

## 3. Git 收口

| 节点          | 结果                                                         |
| ------------- | ------------------------------------------------------------ |
| SR6 功能提交  | `64d4ff45337be6802db9cba5f19af76d2a143da2`                   |
| SR6 合并 main | `510bbc94c1a202a08487ffb2a54524a44d5e3482`                   |
| 路由修复分支  | `drb/phase-6-9-7-sr7-step-check-route`，从当时最新 main 新建 |
| 路由修复提交  | `43af2e85`，功能分支与远程已发布                             |
| 修复合并 main | `006f54e910e6e8fe49e7474679bb13b7016982d7`                   |

路由修复没有从功能分支再开分支，也没有创建 worktree。`.codex/` 始终保持本地未跟踪，没有进入任何
提交。最终文档提交后另行复核 `HEAD == upstream == origin/main`。

## 4. 静态与路由增量验证

精确回归用例固定为：

```text
我算到 f'(2)=4，这一步对吗？请只检查这一步。
```

期望为 Tutor route、`requiresRag=false`、`requiresHumanApproval=false`。验证结果：

| 验证                                                   | 结果                          |
| ------------------------------------------------------ | ----------------------------- |
| Router focused                                         | `6/6` passed，`15` assertions |
| Router/runtime + Web Chat 受影响回归                   | passed                        |
| Web server-only 相关测试（项目规定的 Node runner）     | `25/25` passed                |
| Agent typecheck / lint / Prettier / `git diff --check` | passed                        |

一次使用 Bun 混跑 server-only Web test 的失败属于错误 runner，不是产品失败；改用项目既有 Node test runner
后 `25/25` 通过。已完成的 SR5、SR6、Organizer 与其它 Agent 验收没有重复执行。

## 5. Docker main/default-off 回放

Docker Desktop 对 server/web 并行 Compose Bake 再次出现 shared-key gRPC 会话错误；改为逐个构建后，server
与 web 镜像均成功。第一次 recreate 漏传根 `.env`，server 因 Qwen key/base URL 为空按预期 fail-closed，
没有模型调用、业务写入或数据损坏。随后使用正确命令精确重建 server/web：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d --no-build --no-deps --force-recreate server web
```

最终运行态：

| 检查         | 结果                                                  |
| ------------ | ----------------------------------------------------- |
| server       | healthy，`GET /health=200`                            |
| web          | running，`GET /login=200`                             |
| worker       | healthy，未重建、未接收 Tutor/Organizer 能力          |
| 数据基础设施 | PostgreSQL、Redis、MinIO 保持运行                     |
| AI mode      | `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false` |
| 模型 gate    | Router/Tutor/Organizer 及其它 Agent gate 均为 false   |
| SR6 replay   | `PHASE_6_9_7_SR6_PRODUCT_REPLAY_ENABLED=false`        |

没有执行 `docker compose down -v`、Docker prune、数据库 reset、Redis `FLUSH*` 或 MinIO wipe。

## 6. API、可见浏览器与 Trace

### 6.1 Organizer default-off

在首次 main 合成账号中创建一条错题并调用 Organizer。结果固定为：

```text
source=local_deterministic
disposition=gate_disabled
degraded=false
traceId absent
```

Organizer 调用前后该账号的 Organizer Trace 均为 0；`/error-book` 可见页面显示“本地规则”。这证明默认
关闭不会把本地整理误标为模型路径，也不会制造零调用 Trace。

### 6.2 Tutor 精确 step-check

修复后的第二个合成账号在可见 `/chat` 发送固定句后，页面显示
`Agent route: TutorAgent tutoring path` 与 `TutorAgent strategy: step_check`。`POST /api/chat` 响应头为：

| 字段                           | 结果                  |
| ------------------------------ | --------------------- |
| `x-prepmind-agent-route`       | `tutor`               |
| `x-prepmind-tutor-intent`      | `step_check`          |
| `x-prepmind-ai-mode`           | `mock`                |
| `x-prepmind-model-agent-calls` | `0`                   |
| Tutor attempted                | `false`               |
| Tutor input/output tokens      | `0 / 0`               |
| Tutor disposition              | `not_eligible`        |
| Tutor reason                   | `LIVE_CALLS_DISABLED` |
| Tutor pricing known            | `false`               |
| Agent Trace recorded           | `true`                |

在线 Trace API 返回 `route=tutor / mode=mock / status=completed / costEstimate=0 / degraded=false`，步骤为
RouterAgent、RouterModelCandidate、TutorModelCandidate、TutorAgent。TutorModelCandidate 的安全摘要为：

```text
attempted=false disposition=not_eligible durationMs=0
inputTokens=0 outputTokens=0 reason=LIVE_CALLS_DISABLED pricing=unknown
```

Trace 顶层 `pricingKnown=true` 只表示本地 `mock-prepmind-chat` 的零价估算；Tutor candidate 自身仍为
`pricing=unknown`。Trace 顶层的 `390/1200` 是本地 Mock 展示预算估算，不是 Provider verified usage；不得与
candidate 的真实零调用、零 token 混称。

### 6.3 本地截图证据

截图保存在本机忽略目录 `.playwright-mcp/prepmind-sr7-main-evidence/`，不属于 Git 跟踪文件：

| 文件                                       | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `organizer-local-rule.png`                 | `23b5ba00617379c52b85ec5c451307f582c3d767c44548ed0a3ce9b31c404582` |
| `agent-trace-mock-zero-cost.png`           | `44ac3837b5b5872ef40d5104f6d9aaf9fe4a469b664120cf522e1ff33c0bd088` |
| `tutor-default-off-route.png`              | `e2fc6aa85ddba40be285a76621dffcef020dc757335a2de7d87b0504fad798b9` |
| `agent-trace-tutor-default-off-detail.png` | `ee00670ddc2dd18b2b2cdb08c898613af2137ab0b4040f58cb896bb0f7ce46db` |

错误路由时期的截图、Playwright page snapshot 与 console 临时文件已精确删除；浏览器窗口没有关闭。

## 7. 合成数据与浏览器精确清理

两个 main 回放账号均按唯一邮箱定位，并在删除前后核对关联行与 tracked Outbox：

| 账号                | 删除前关联数据                                                                                                         | 删除后                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 首次 main 回放      | refresh token 7、错题 1、会话 1、消息 6、分组 1、专题 1、关联项 1、Trace 3、TraceStep 10；其余关联 0；tracked Outbox 0 | User、全部关联与 Outbox residue 0           |
| step-check 修复回放 | refresh token 2、会话 1、消息 2、Trace 1、TraceStep 4；其余 `userId` 关联 0；tracked Outbox 0                          | User、全部 `userId` 关联与 Outbox residue 0 |

最终浏览器状态：

```text
URL=/login
cookies=0
localStorage=0
sessionStorage=0
IndexedDB databases=1 / stores=5 / rows=0
Cache Storage=0
service workers=0
```

登录页会自动重建 PrepMind Dexie database/store schema，因此验收以所有 store row=0 为准，不把空 schema
误写成数据残留。可见浏览器最终保留在空白 `/login`，供用户查看。

## 8. Authority 与后续路线

| 结论                                                               | Authority                                         |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| SR5 固定 72-case/24-pair 真实模型 schema/语义/P95/usage/预算门     | `schema_recovery_full_gate_semantic_gate`，不可变 |
| SR6 分支 composition/权限/Trace/降级/UI                            | zero-provider branch product acceptance           |
| SR7 main 合并、远程发布、default-off Docker/API/browser/Trace/清理 | zero-provider main/default-off product acceptance |
| 真实模型最终产品回答、HTTP/页面 SLA、生产部署                      | 未形成                                            |

SR7 不修改 SR5 marker、628 条 journal、artifact、approved tag，或旧 L3/SR4/V1--V9 的任何历史
authority；也不把 Mock 估算、默认关闭回放或 deterministic Organizer 写成新的模型质量证据。

Phase 6.9.7 至此完成。下一步只从最新 `main` 新建普通分支进入 Phase 6.9.8，先冻结 RetrieverAgent /
FinalResponseAgent 的职责、输入输出、通信、Trace、权限和失败降级 contract，再按任务逐步实现与验收。

## 9. 回顾时可以问

- “为什么 SR5、SR6、SR7 必须分别形成语义、分支产品和 main/default-off 三类 authority？”
- “为什么 Tutor candidate 的 token 是 0，而 Trace 顶层仍显示 Mock token 估算？”
- “为什么精确句式的 Router 回归必须在可见浏览器中再验证一次？”
- “为什么 Organizer gate-off 不应创建 Trace，而 Tutor Mock Chat 可以 best-effort 创建 Trace？”
- “为什么 SR7 完成后下一步是 RetrieverAgent / FinalResponseAgent，而不是直接做分层记忆或博客？”
