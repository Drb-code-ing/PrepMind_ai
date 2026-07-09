# Admin Console：把后台管理从“能调接口”做成“能运维”

这篇文章复盘 PrepMind AI 今天做完的一整套后台管理产品化工作。它不是只讲某一个按钮，也不是只讲某个页面样式，而是讲我们怎么把 Phase 7 里逐步搭起来的后台能力串成一个真正像企业项目的 Admin Console。

如果面试官问“你这个项目除了 AI 聊天，还有什么工程化亮点”，这部分很好讲，因为它覆盖了：

- 独立管理员后台。
- Docker admin service。
- Outbox Ops 排障和 requeue。
- Operator Audit 操作审计。
- Worker Readiness 部署前检查。
- 控制台真实运维总览。
- 权限、脱敏、审计和状态机边界。

## 先说结论

今天后台管理最终形成了这样的结构：

```text
学习端 web:     http://127.0.0.1:3000
后端 API:       http://127.0.0.1:3001
管理员后台:     http://127.0.0.1:3100
worker 进程:    Docker worker service
```

管理员登录后，可以在 Admin Console 里做三类事情：

| 页面 | 作用 |
| --- | --- |
| 控制台 `/` | 聚合 Worker、Outbox、Audit 的当前状态，告诉管理员是否有风险 |
| Outbox Ops `/outbox` | 查看 FAILED / DEAD 事件，确认根因后安全 requeue |
| 操作审计 `/audit` | 查看管理员诊断写操作的脱敏审计记录 |
| Worker Readiness `/worker` | 检查 Redis、BullMQ、worker heartbeat 和 outbox readiness |

这背后的核心思想是：

> 后台管理不是把 API 结果堆到页面上，而是把“发现问题、处理问题、验证恢复、复盘操作”做成一个闭环。

## 为什么要做独立 Admin Console

一开始管理员能力是在学习端里逐渐出现的，比如移动端 `/operator-audit`。这在早期很方便，因为我们可以快速验证后端 admin-only API 是否可用。

但继续把所有管理员功能塞进学习端，会出现几个问题：

1. 学习端是给普通学生用的，侧边栏不应该堆满运维入口。
2. Outbox requeue 这种操作需要大屏信息密度，手机页面不适合展示完整上下文。
3. 后续如果继续加审计详情、worker metrics、队列延迟、告警、保留周期配置，学习端会越来越不像学习产品。
4. 面试讲架构时，`web / admin / server / worker` 拆开会更清楚。

所以 Phase 7.16 做了独立 `apps/admin`：

```text
apps/web    学生学习端
apps/admin  管理员后台
apps/server NestJS API
worker      后台任务进程
```

这也是企业项目里常见的边界：用户产品和运维后台不是同一个入口。

## Docker admin service 解决了什么

独立 app 只是第一步。如果只能本机跑：

```powershell
bun run dev:admin
```

那它还不算完整部署拓扑。

Phase 7.17 继续补了 Docker Admin Console Service：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

这样本地完整栈就有四个关键服务：

| 服务 | 职责 |
| --- | --- |
| `web` | 学习端 PWA |
| `admin` | 管理员后台 |
| `server` | NestJS API |
| `worker` | BullMQ worker / outbox dispatcher |

这里还有一个很真实的工程坑：monorepo 根 workspace 是 `apps/*`，所以 Dockerfile 的 deps 层必须复制所有 workspace package manifest，包括 `apps/admin/package.json`。否则 `bun install --frozen-lockfile` 会认为 lockfile 需要变化，镜像构建失败。

这个点面试时可以讲成：

> monorepo Docker 镜像不能只复制当前 app 的 package.json，还要复制 workspace 声明里所有包的 manifest，否则包管理器无法验证 lockfile。

## 返回学习端为什么会重新登录

做独立 admin 后，我们遇到过一个看起来像鉴权失效的问题：从后台点击“返回学习端”，有时又要重新登录。

根因不是后端 `JwtAuthGuard` 坏了，而是本机 host 混用：

```text
localhost:3100  ->  127.0.0.1:3000
```

浏览器会把 `localhost` 和 `127.0.0.1` 当成不同 host。refresh cookie、前端状态和 API base 一旦混用，就可能导致 session recovery 不稳定。

所以 Phase 7.17.1 做了 host 对齐：

- 如果 admin 是 `localhost:3100`，返回学习端就是 `localhost:3000`。
- 如果 admin 是 `127.0.0.1:3100`，返回学习端就是 `127.0.0.1:3000`。
- 仍然保留 `NEXT_PUBLIC_LEARNING_APP_URL` 显式覆盖。

这个问题很适合面试，因为它提醒我们：

> 本地开发里的登录态问题，不一定是鉴权模型错了，也可能是浏览器 host、cookie 和 CORS 混用。

## Outbox Ops 为什么重要

PrepMind 做了 Durable Outbox，用 `OutboxEvent` 持久化内部事件。这样事件失败后不会只丢在日志里，而是有状态机：

```text
PENDING -> PROCESSING -> SUCCEEDED
                     -> FAILED -> PENDING
                     -> DEAD
```

但是有了状态机，还需要管理员能安全处理失败事件。

Phase 7.18 把 `/outbox` 做成了 Outbox Ops 页面。它不是只给一个 requeue 按钮，而是拆成五个分区：

1. 生命周期：状态、attempts、创建/更新时间、下次运行时间。
2. 事件身份：事件 ID、事件类型、payloadHash。
3. 诊断建议：根据错误类型给出不同处理建议。
4. 重新入队操作：原因输入、显式确认、requeue 按钮。
5. 后续验证：跳到 Worker Readiness 和 Audit。

这里最关键的是：不同失败不能都当成“重试一下”。

| 错误类型 | 页面应该怎么引导 |
| --- | --- |
| handler missing | 先修代码或注册 handler，不要盲目 requeue |
| invalid payload | 先修生产方数据契约，不要继续污染队列 |
| Redis / DB timeout | 依赖恢复后可以考虑 requeue |
| unknown error | 先看日志和 readiness，再决定 |

requeue 的语义也很克制：

```text
FAILED / DEAD -> PENDING
```

它不立即执行 handler，不修改 payload，不把事件强制标记成功，也不跳过状态机。

## 为什么 requeue 必须写审计

Outbox requeue 是诊断写操作。它虽然不直接改业务数据，但会改变系统级事件状态，可能触发后续 worker 消费。

所以 Phase 7.14 已经做了 Operator Audit：

```text
OperatorAuditLog
```

记录的信息包括：

- actorUserId
- action，例如 `OUTBOX_REQUEUE`
- status，成功或失败
- targetType / targetId
- reason
- requestId
- IP / User-Agent hash
- errorCode / errorPreview

不记录：

- outbox payload
- aggregateId
- 用户正文
- prompt
- RAG chunk
- 模型回答
- API key
- access token / refresh token / cookie
- 原始 IP / User-Agent

这体现了一个后台系统的基本要求：

> 管理员操作要可复盘，但复盘日志不能变成新的敏感数据泄露点。

## 为什么审计还需要详情页

一开始 `/audit` 只有列表。列表能回答“最近有哪些操作”，但很难回答“一次具体操作到底发生了什么”。

比如管理员看到一条 requeue 记录时，真正想知道的是：

- 这次操作是成功还是失败？
- 操作的是哪个 `OutboxEvent`？
- 管理员当时填写的 reason 是什么？
- 这次请求的 requestId 是什么？
- 来源指纹是什么？
- 如果失败，错误 code 和错误摘要是什么？

所以 Phase 7.20 补了审计详情闭环：

```text
GET /operator-audit-logs/:id
```

前端 `/audit` 也从纯列表升级为双栏结构：

```text
左侧：审计列表
右侧：审计详情
```

详情分成四块：

| 分区 | 展示内容 |
| --- | --- |
| 操作上下文 | 审计 ID、action、status、reason、createdAt |
| 目标对象 | targetType、targetId |
| 来源指纹 | actorUserId、requestId、IP hash、User-Agent hash |
| 错误摘要 | errorCode、errorPreview |

这里最重要的不是“多查一条数据”，而是继续坚持脱敏边界。

详情接口复用脱敏 DTO，不返回：

- `metadata`
- outbox payload
- aggregateId
- 用户正文
- prompt
- RAG chunk
- 模型回答
- API key
- access token / refresh token / cookie
- 原始 IP / 原始 User-Agent

也就是说，审计详情让管理员更容易复盘，但不会把后台页面变成敏感数据查看器。

这个设计也让 Outbox Ops 的后续验证更顺：requeue 后去 `/audit`，点开记录，就能看到这次操作的 reason、target、requestId 和结果。后台闭环从“能看到列表”变成了“能解释一次操作”。

## Worker Readiness 在后台里的角色

`/worker` 页面复用了 Phase 7.11 的 Worker Readiness。

它检查四类信号：

1. Redis 是否可用。
2. BullMQ queue counts 是否正常。
3. worker heartbeat 是否在线。
4. outbox 是否有 DEAD 或 backlog 风险。

它和 `/health` 不一样：

| 入口 | 回答什么问题 |
| --- | --- |
| `/health` | API 进程是否活着 |
| `/worker-readiness` | 后台任务链路能不能接流量 |
| `/worker-observability/summary` | 给开发者看的详细排障信息 |

这在后台管理里很重要。因为 requeue 后，管理员不能只看按钮成功，还要去 `/worker` 验证：

- worker 是否在线。
- outbox backlog 是否下降。
- queue 是否有 failed jobs。
- readiness 是否回到 Ready。

## 控制台首页为什么不能只是导航页

今天最后做的 Phase 7.19，就是把首页从静态入口页升级成真实控制台。

之前首页本质上是：

```text
这里有三个入口：Outbox、Audit、Worker
```

这当然能用，但不像真正的后台。真正的后台首页应该先回答：

```text
现在系统有没有需要我处理的风险？
```

所以控制台现在会读取三个后端入口：

```ts
workerReadinessApi.get()
outboxApi.list({ status: 'FAILED' })
outboxApi.list({ status: 'DEAD' })
operatorAuditApi.list({ action: 'OUTBOX_REQUEUE' })
```

然后聚合成几个核心指标：

| 指标 | 来源 |
| --- | --- |
| Worker 状态 | `/worker-readiness` |
| FAILED Outbox 数量 | `/outbox-events?status=FAILED` |
| DEAD Outbox 数量 | `/outbox-events?status=DEAD` |
| 最近审计数量 | `/operator-audit-logs?action=OUTBOX_REQUEUE` |
| 关注项 | readiness issue + failed/dead outbox + failed audit |

简化后的聚合逻辑大概是：

```ts
if (hasReadError) return '控制台数据读取异常';
if (readiness.status === 'not_ready' || deadOutboxCount > 0) return '需要立即处理';
if (readiness.status === 'degraded' || failedOutboxCount > 0) return '有待关注项';
if (readiness.status === 'ready') return '后台任务链路当前健康';
```

这让管理员一打开后台就能知道：

- 当前是不是健康。
- 有多少 FAILED / DEAD 事件。
- 最近有没有 requeue 审计。
- 如果有问题，应该先去哪个页面。

## 为什么读取失败也是一种状态

控制台读取数据时，可能遇到：

- server 没启动。
- 诊断开关没开。
- accessToken 失效。
- 当前账号不是 ADMIN。
- CORS 或 host 配置错误。

这时不能用假数据兜底成“健康”。否则管理员会被误导。

所以控制台把读取失败显示成明确的 danger 状态：

```text
控制台数据读取异常：请先确认后端服务、诊断开关和管理员权限
```

这也是后台产品和普通展示页的区别：后台宁可明确告诉你“我读不到”，也不能装作没问题。

## 前端好看和工程边界怎么平衡

今天也做了不少 UI 体验收尾。

比如后台之前的控制台像跳转卡片，点击也有完整跳转的闪屏感。我们改成：

- 左侧固定导航。
- 右侧工作区独立滚动。
- 内部导航用 Next `Link`。
- 主工作区隐藏粗原生滚动条。
- Outbox 列表和详情保持独立滚动。

这里不是为了“炫”，而是为了后台的可操作性：

- 管理员看详情时，左侧事件列表不能跟着乱滚。
- 管理员在控制台、Outbox、Audit、Worker 之间跳转要像一个 app。
- 粗原生滚动条会让页面显得像临时 demo。
- 但是不能直接 `overflow: hidden` 破坏可滚动能力。

所以最后做的是“保留滚动能力，优化滚动呈现”。

## 为什么筛选控件也值得认真做

Phase 7.21 做了一个看起来很小、但后台体验上很关键的收口：把 `/outbox` 和 `/audit` 里的原生下拉框换成 Admin Console 自己的筛选控件。

这个点不是为了“炫 UI”。原生 `select` 在 Windows 浏览器里会弹出系统样式的下拉层：蓝色选中、高对比边框、字体和间距都跟页面不统一。普通页面里这可能只是不好看，但后台管理里会带来两个问题：

1. 它让页面像临时拼出来的调试工具，而不是一个稳定的运维控制台。
2. 它打断了管理员的操作节奏，尤其是在 Outbox / Audit 这种需要反复筛选、对照详情和复盘操作的页面里。

所以我们新增了一个轻量的 `AdminFilterSelect`：

```tsx
<AdminFilterSelect
  label="状态"
  value={status}
  options={statusOptions}
  onChange={setStatus}
/>
```

它做了几件事：

- 用后台统一的边框、阴影、圆角和强调色。
- 选中项用浅底和左侧细强调条，不再使用系统蓝色高亮。
- 保留 `role="combobox"`、`role="listbox"`、`role="option"`、label 关联、`aria-selected` 和 `aria-activedescendant`，并支持上下键切换、Enter 选择、Escape 关闭，不是只顾好看的假控件。
- 下拉内容使用项目里的 `pm-scrollbar`，和页面其它滚动区域保持一致。

这类细节面试时可以讲成“产品化收口”：后台页面不是把接口字段摆出来就结束了，还要让管理员稳定、高效、少误操作。

同时我们把 Outbox requeue 的前端流程也收紧了。后端 `reason` 仍然保持 contract 兼容，可以是可选字段；但前端管理员操作台要求必须填写原因并勾选确认，按钮才会可用：

```ts
const reasonRequired = reason.trim().length > 0;
const canRequeue =
  detail &&
  isOutboxEventRequeueable(detail.status) &&
  detail.canRequeue &&
  confirmChecked &&
  reasonRequired;
```

为什么这么设计？因为 requeue 会改变系统级事件状态。管理员今天可能知道“我已经修了 Redis 超时”，但一周后复盘审计时，如果 reason 是空的，就很难解释当时为什么允许这条事件重新入队。前端必填 reason 是产品层的防误操作，后端状态机和 `OperatorGuard` 才是真正安全边界。

还有一个容易忽略的小坑：reason 不能在事件之间残留。如果管理员先点了 A 事件并输入原因，再切到 B 事件，旧 reason 必须清空。否则 B 事件虽然也满足“有 reason”，但审计记录里的原因其实描述的是 A 事件。这类问题不是后端安全漏洞，却会让事故复盘变脏，所以我们在切换事件和筛选条件时都会重置 reason、确认框和提示状态。

我们还给这件事加了静态 contract test，防止以后页面又退回原生 `<select>`，或者 requeue 按钮绕过 reason guard。这不是为了测试 CSS，而是为了锁住后台操作流程的关键约束。

## 安全边界在哪里

这一点一定要讲清楚：Admin Console 前端不是安全边界。

前端可以：

- 隐藏普通用户入口。
- 显示 admin-only 标签。
- 引导管理员输入 reason。
- 禁用危险按钮。
- 避免展示敏感字段。

但真正的权限边界在后端：

```text
feature gate -> JwtAuthGuard -> OperatorGuard -> service 状态机
```

也就是说：

- 诊断入口 production 默认关闭。
- 未登录会被 JWT guard 拦。
- 非 ADMIN 会被 OperatorGuard 拦。
- requeue service 只允许 `FAILED / DEAD -> PENDING`。
- 审计写入失败不影响主操作，但会记录脱敏 warning。

这个分层很重要。前端负责体验和防误操作，后端负责事实权限和状态机约束。

## 今天做完后，后台管理链路是什么样

现在管理员处理一个 outbox 问题的路径是：

```text
进入 Admin Console
  -> 控制台看到 FAILED / DEAD 或 readiness 风险
  -> 进入 Outbox Ops 看事件详情
  -> 根据错误类型判断是否适合 requeue
  -> 输入 reason 并显式确认
  -> requeue 写入审计
  -> 去 Worker Readiness 看链路是否恢复
  -> 去 Audit 点开详情，复盘谁在什么时候对哪个 target 做了什么
```

这就是完整闭环。

## 这部分面试怎么讲

如果面试官问“你们后台管理做了什么”，可以这样回答：

> 我们把后台任务和可靠事件做成了一个独立 Admin Console。它不是普通用户学习端的一部分，而是单独的 Next app 和 Docker service。控制台首页会聚合 Worker Readiness、Outbox FAILED/DEAD 和 Operator Audit，Outbox Ops 支持脱敏详情、错误分类建议、reason + confirm 后 requeue，所有诊断写操作都会进入 OperatorAuditLog。真正权限边界在后端 feature gate、JwtAuthGuard 和 OperatorGuard，前端只负责呈现和防误操作。

如果问“为什么不直接在数据库里改状态”，可以回答：

> 因为数据库直改没有业务状态机、没有权限、没有审计，也容易改错 payload 或绕过并发保护。我们的 requeue 只允许 `FAILED / DEAD -> PENDING`，通过服务层 compare-and-swap 更新，成功或失败都写审计，后续由 worker dispatcher 正常 claim。

如果问“控制台首页有什么价值”，可以回答：

> 它把多个诊断入口聚合成一个运维视图。管理员不用逐页翻，首页就能看到 worker 是否 ready、outbox 是否有 failed/dead、最近 requeue 审计是否失败。读取失败本身也会显示为异常状态，不会用假数据装健康。

如果问“你怎么避免后台页面泄露敏感信息”，可以回答：

> 后端 DTO 本身就脱敏，不返回 metadata、payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。审计里只存 IP/User-Agent hash 和截断后的 error preview。列表和详情都复用这套脱敏 DTO，前端页面只消费这些字段。

如果问“这和普通 CRUD 后台有什么区别”，可以回答：

> 这里重点不是 CRUD，而是围绕后台任务可靠性的运维闭环：readiness 判断能否接流量，outbox ops 处理 dead-letter，operator audit 复盘高权限操作，dashboard 聚合风险。它更接近生产系统的 operator console。

## 今天这轮的价值

今天这轮最大的价值是把 Phase 7 的工程化能力收成了一个可以被人使用、可以被面试讲清楚的后台系统。

之前我们已经有很多底层能力：

- BullMQ。
- Worker heartbeat。
- Worker Readiness。
- Durable Outbox。
- Outbox Dispatcher。
- OperatorGuard。
- OperatorAuditLog。
- Docker web / server / worker。

但这些能力如果只停留在 API 和日志里，用户或者面试官很难感受到它们组成了什么。

Admin Console 把它们串起来了：

- 首页发现风险。
- Outbox 处理风险。
- Audit 复盘操作。
- Audit 详情解释单次操作。
- Worker 验证恢复。
- Docker 还原部署拓扑。

这就是从“工程能力堆积”到“后台管理产品化”的区别。
