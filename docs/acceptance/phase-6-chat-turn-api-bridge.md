# Phase 6 ChatTurn API Bridge

更新时间：2026-09-05
状态：ticket 03 实现与功能分支 Mock/Docker/可见浏览器验收通过；精确 Git SHA 以本任务回执和仓库历史为准。

## 1. 目的

ticket 01 已提供认证 `POST /chat-turns`，ticket 02 已提供 Web bounded enqueue adapter，但产品
`/api/chat` 此前仍在 Next.js 进程内同步运行完整 Agent/模型链。ticket 03 将已登录用户的后续聊天提交接到
durable admission：先把输入消息追加到 PostgreSQL，再创建 ChatTurn、BackgroundJob 和 Outbox，最后把 turn id
交还浏览器。

本任务解决的是“请求已被服务端可靠接管”，不是“浏览器已经自动订阅后台结果”。status/events 消费、SSE
重连、cursor 过期恢复仍属于 ticket 04；真实模型 Worker、全链路 ledger 也不在本 ticket 内。

## 2. 当前产品流程

```text
authenticated /api/chat request
  -> canonical /auth/me + owner/bearer binding
  -> PREPMIND_CHAT_TURN_BRIDGE_ENABLED decision
       |- false: existing synchronous Chat path
       |- no conversation id: first-turn compatibility path
       `- true + conversation ready:
            bounded tail <= 1000 messages / <= 2,000,000 content chars
            -> POST /chat-messages/prepare
                 append-only owner-bound Serializable transaction
            -> canonical SHA-256 + stable clientRequestId
            -> POST /chat-turns
                 ChatTurn + BackgroundJob + requested Outbox in one transaction
            -> HTTP 202 data-stream handoff annotation
                 { turnId, conversationId, status, backgroundJobId }
            -> Outbox relay -> BullMQ -> Worker
            -> assistant + terminal Turn/Job/Outbox in PostgreSQL
            -> bounded Redis Stream events
```

BullMQ 入队数据只包含 conversation/message ids、input hash、request id 和 budget policy version。聊天正文不进入
enqueue payload；Worker 按 owner、conversation 和 message ids 回 PostgreSQL 读取权威正文。Redis Stream 只保存
回答事件的短期有界回放，不是输入正文队列，也不是业务事实源。

## 3. 持久化与并发边界

`POST /chat-messages/prepare` 使用 shared strict Zod contract，并满足以下约束：

- owner 只来自 JWT；conversation 和已有消息必须属于该 owner；
- 输入按绝对 `order` 形成连续窗口，非零起点必须已有 durable predecessor；
- 已存在消息必须与 id、role、order、content 和可选 createdAt 完全一致，禁止过期客户端覆盖；
- 新消息只允许 append，不更新或删除历史消息；
- `P2034` 或 PostgreSQL `40001` 才有限重试，`P2002` 唯一冲突直接映射为 `409`；
- bridge 开启后，身份、窗口、prepare 或 enqueue 异常都 fail-closed，不静默退回旧 Provider，避免双写和两份回答。

Web 只取满足数量和正文总量上限的连续尾窗，并保留消息在整个会话中的绝对 order。相同 owner、输入、消息 ids
和预算版本产生稳定 request id，允许安全的短暂网络重试；abort、4xx、schema、owner 或冲突是 terminal。

## 4. 浏览器 handoff 边界

`202` 响应通过 AI SDK data stream 写入 `prepmind-chat-turn-handoff-v1` annotation，并显示临时文本，明确提示用户当前
版本需要稍后刷新页面查看结果。该临时 assistant message：

- 不写入 Dexie；
- 不进入旧 `/chat-messages/sync`；
- 存在时阻止再次提交，避免同一会话产生重叠 turn，并明确提示刷新恢复而不是暗示页面会自动解锁；
- 当前不会主动查询 status/events，也不会自动把 terminal Worker 回答替换进 UI。

在 ticket 04 完成前，刷新页面会重新读取 PostgreSQL 权威消息，因此已完成的 Worker 回答可以在刷新后恢复；这不等于
已经具备 SSE 推送、自动重连或 cursor replay UI。

## 5. 功能分支验证

### 5.1 静态与回归

```text
Web full tests: 513/513 passed
Server affected suites: 42/42 passed
Server ChatMessages service: 19/19 passed
Types: 46/46 passed
Web production build + TypeScript: passed
Server build: passed
Final bridge/provider focused Web tests after UX remediation: 37/37 passed
Targeted Web/Server ESLint, Prettier, Compose config, Markdown structure/links and git diff check: passed
```

两路独立只读复审发现的长会话尾窗、durable predecessor、过期客户端尾部、唯一冲突误重试、bridge 开启后静默
legacy fallback，以及等待占位无法自行解除却暗示只需等待的交互误导，均已修复并补回归；最终无未关闭
blocker/P1/P2。浏览器验收补齐了纯 helper 测试不能证明的 AI SDK `202` annotation 消费和 pending overlap 时序。

### 5.2 Docker/API/可见浏览器

验收使用 retained Docker volumes，运行时显式覆盖：

```text
AI_PROVIDER_MODE=mock
AI_ENABLE_LIVE_CALLS=false
all model component gates=false
PREPMIND_CHAT_TURN_BRIDGE_ENABLED=true
PREPMIND_CHAT_TURN_BUDGET_POLICY_VERSION=chat-budget-v1
```

`server` 与 `worker` healthcheck 均为 healthy，Web `/login` 返回 `200`。现有数据库卷最初缺少
`20260825090000_chat_turn_state_machine`；第一次后续 turn 因 `ChatTurn` 表不存在而未入队。随后只执行增量
`prisma migrate deploy`，迁移成功且 schema up to date；没有 reset、删表、清卷或改写已有业务数据。

迁移后使用一个合成账号完成可见浏览器验收：

1. 首轮没有 conversation id，按兼容路径得到 Mock 流式回答，并建立持久化会话。
2. 第二轮显示 handoff 等待文本；立即再次提交被“上一条回答仍在后台处理”阻止。
3. PostgreSQL 显示唯一 ChatTurn=`SUCCEEDED`、BackgroundJob=`SUCCEEDED`，assistant response 已绑定。
4. requested/completed 两条 Outbox 均为 `SUCCEEDED`，各一次投递；没有重复 turn/job。
5. owner-bound status 返回 terminal success；Redis 初始 replay 返回 3 条事件：`response_started`、
   `text_delta`、`response_completed`。
6. 刷新后页面从 PostgreSQL 恢复“后台回答任务已完成”结果；本次失败前的旧浏览器 warning 没有在成功重跑后新增。

本轮合成账号及其级联 Conversation、ChatMessage、ChatTurn、BackgroundJob、Outbox 和 refresh token 在验收后精确删除，
并验证账号与关联记录残留为 0。可见浏览器窗口按约定保留，不读取或清理其 cookie/storage。

## 6. 证据等级与安全记录

证据等级：`implemented` + `mock/static validated` + Mock 产品链路验收。

- 没有人工打开或输出 API key、模型 URL、cookie、token、prompt 或 Provider 原文；Next production build 按框架默认加载现有
  `.env.local`，但没有发起 Provider 或业务网络调用；
- 没有调用 DeepSeek、Qwen 或其他真实 Provider，没有产生真实模型费用；
- Docker 容器、镜像、build cache、PostgreSQL/Redis/MinIO volume 和已有数据均未清理；
- 只为本次验收创建并精确删除一个合成账号；
- 本证据不升级为 controlled-Live、product real-model smoke 或 production-used。

## 7. 默认开关与回滚

tracked Compose 和 `.env.example` 中 bridge 默认保持 `false`。关闭
`PREPMIND_CHAT_TURN_BRIDGE_ENABLED` 即回到原同步产品路径；开启后只影响已认证且 conversation 已就绪的请求，首轮仍保留
兼容路径。验收结束后 Docker Web 已恢复 bridge=false，全部模型 gate 仍为 false。

## 8. 未完成项

1. ticket 04：浏览器消费 owner-bound status/events，完成 SSE、断线重连、cursor 过期与 PostgreSQL 权威恢复。
2. ticket 05：ChatRunBudget 全链路 ledger、跨节点 reservation 和 Trace 对账。
3. ticket 06：独立真实模型 Worker gate、usage/cost 记录和受控产品 smoke。

复盘时可以直接问：

- “ChatTurn 入队为什么只放引用，不放聊天正文？”
- “ticket 03 的 202 handoff 与 ticket 04 的 SSE/replay 有什么边界？”
- “Outbox、BullMQ、BackgroundJob 和 ChatTurn 各自解决什么问题？”
