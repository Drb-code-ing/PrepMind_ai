# Phase 6 ChatTurn Browser Replay

更新时间：2026-09-05
状态：ticket 04 功能分支实现、自动化验证、Mock Docker、可见浏览器验收和精确清理完成；等待 Git 收口与 merged-main 复验。

## 1. 任务目的

ticket 03 已让 authenticated `/api/chat` 把后续问题可靠交给 ChatTurn Worker，但浏览器拿到 `202` handoff 后不会自行跟进后台
结果。用户刷新、Redis 暂时不可用或 Worker 延迟时，只能手动刷新才能看到 PostgreSQL 中的最终回答。

本任务把浏览器接到既有 owner-bound 状态和 cursor replay API，使 handoff 成为可恢复的产品状态：

```text
/api/chat -> 202 handoff
  -> Dexie owner/conversation/turn recovery checkpoint
  -> GET /chat-turns/:turnId
  -> GET /chat-turns/:turnId/events?cursor=<redis-stream-id>&limit=100
  -> bounded preview/checkpoint/reconnect
  -> PostgreSQL terminal status + durable assistant response
  -> replace the placeholder in place
```

当前客户端使用 **authenticated JSON cursor replay + polling**，不是长连接 BFF SSE push。SSE push 若继续需要，应作为独立后续优化，
不能用本任务证据宣称已经完成。

## 2. 浏览器恢复合同

### 2.1 持久化与身份边界

- Dexie schema 升到 v10，新增 `chatTurnRecoveries`；记录绑定 `userId + conversationId + turnId`，只保存 handoff、cursor、sequence、
  bounded preview 和时间，不保存 token、Provider 信息或额外 prompt。
- recovery 操作按用户串行化；checkpoint 只前进，不允许旧 sequence 覆盖新进度；terminal remove 后，迟到 checkpoint 不能复活记录。
- 初始化先协调 conversation-state restore 与本地消息读取，再按恢复出的 conversation 精确选择 recovery。另一个会话更新更晚的记录不会
  阻塞当前会话，也不会被误删。
- user、conversation 或 access token 改变会 Abort 当前请求；所有 progress/terminal callback 再检查捕获的身份与 recovery id，迟到结果
  不得写入新身份。

### 2.2 Cursor、降级与终态

- 事件页和状态响应都经过 shared strict Zod schema；turn/conversation 不匹配、foreign event、乱序 sequence/cursor 或 terminal 后事件均
  fail-closed。
- cursor、event id 去重集合上限为 512；每页最多 100 条；即时 drain/recheck 最多连续 4 次，之后进入 `250/500/1000/2000ms`
  capped backoff，避免 hot polling。
- Redis `unavailable`、cursor `expired`、坏页或非重试错误都会降级为 `status_only`。replay 文本只做临时 preview，绝不作为最终回答。
- `SUCCEEDED` 必须同时取得匹配 `responseMessageId`、conversation 和 absolute `order` 的 PostgreSQL assistant response；短暂提交可见性
  延迟最多检查 4 次，之后以固定错误停止，不能无限等待。
- placeholder 存在时原位替换；placeholder 已丢失时仅能按 durable absolute order 插入。缺少前序消息或 order 不一致时拒绝静默压缩
  历史顺序。

### 2.3 与旧同步路径隔离

- handoff/recovery placeholder 不进入 Dexie message snapshot 或旧 `/chat-messages/sync`。
- recovery 存在或 handoff 仍 pending 时，initial sync、定时 snapshot sync 和 submit 都短路；覆盖 placeholder 尚未渲染及 terminal cache
  清理尚未完成的窄窗口。
- 恢复期间 hydration 保留 durable 尾部 USER，避免 completion guard 把输入删除后将 assistant 从数据库 `order=3` 压缩成本地
  `order=2`。
- terminal 成功后先以 PostgreSQL response 更新 runtime、时间戳和 Dexie，再清 recovery；后续一轮继续使用连续绝对 order。

## 3. Redis 故障隔离补强

可见浏览器验收暂停 Redis 时发现：BullMQ 共享 client 的 `XRANGE` 可能等待连接恢复，浏览器无法及时进入 status-only。服务端因此为
Chat Stream Redis client 获取和每条命令增加独立 operation timeout：

```text
CHAT_STREAM_OPERATION_TIMEOUT_MS=1500
允许范围：100..10000 ms
```

超时只返回 bounded `transport=unavailable`，不会改变 PostgreSQL 状态、触发 Provider 重试或清理 Redis。原有 count/bytes/TTL 和 terminal
fence 保持不变。

## 4. 代码范围

- `apps/web/src/lib/chat-turn-replay-api.ts`：Bearer status/events API 与 strict response parse。
- `apps/web/src/lib/chat-turn-replay.ts`：cursor drain、bounded backoff、status-only 和 PostgreSQL terminal authority。
- `apps/web/src/lib/chat-turn-recovery-cache.ts`：Dexie recovery 生命周期、conversation filter 和串行 checkpoint。
- `apps/web/src/lib/chat-turn-recovery-messages.ts`：preview、原位 terminal replacement 和 absolute-order guard。
- `apps/web/src/components/providers/chat-runtime-provider.tsx`：identity fence、Abort、刷新恢复、旧 sync 与重叠 submit 隔离。
- `apps/web/src/app/(chat)/chat/page.tsx`：将严格 handoff/recovery 消息呈现为 streaming 状态。
- `apps/server/src/chat-turns/chat-stream.store.ts`、`apps/server/src/config/env.ts`：Redis operation timeout 与配置注入。

本任务不修改 Worker generator，不启用真实模型，不实现 ChatRunBudget ledger，也不把 Redis 变为业务事实源。

## 5. 验证记录

### 5.1 自动化与静态验证

功能分支已确认：

```text
Web recovery focused（最终边界补强）：30/30 passed
Web full tests（最终）：538/538 passed
Server stream/config focused：94/94 passed
Server full Jest：239 suites passed / 1 failed / 3 skipped
  2257 tests passed / 1 failed / 30 skipped
  唯一失败：既有 worker-readiness direct ts-node CLI 期望 exit 2、实际在入口编译阶段 exit 1
Server build：passed
Web/Server Docker image build：passed
```

Server 全量唯一失败与本任务无关，且已在 2026-08-28、2026-09-04 的 `DEVLOG.md` 记录：direct `ts-node` 在脚本业务
`try/catch` 运行前因 workspace `.ts` extension import 编译失败，进程返回 1，无法进入期望的受控 exit 2。Chat Stream、env focused
和 Server build 均通过；本任务不在 Ticket 04 内扩大范围改写 Readiness CLI。

Web ESLint、Next production build/TypeScript、Server build 和 Server stream/config focused 均通过；Server full 的唯一失败仍为
既有 readiness CLI 退出码断言。owned-file Prettier、Markdown 结构/链接/敏感值扫描和 `git diff --check` 在 Git 收口前补录。

### 5.2 Mock Docker 与可见浏览器

验收配置保持 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、全部 Agent model gate=false，仅临时启用
`PREPMIND_CHAT_TURN_BRIDGE_ENABLED=true`。可见浏览器窗口保持打开，验证了：

1. Worker 停止后提交并刷新，durable 尾部 USER 与 pending placeholder 均保留。
2. Worker 恢复后 cursor replay 继续，PostgreSQL terminal response 原位替换 placeholder；Dexie message order 连续。
3. 恢复完成后的下一轮可以正常 prepare/enqueue，不再因客户端 order 漂移返回 `409`。
4. Redis 暂停时约 1.5 秒进入“实时进度暂不可用，正在从服务器确认后台回答...”状态，而不是永久等待。
5. Redis 恢复并启动 Worker 后，status-only 路径从 PostgreSQL 取得最终回答；不信任 Redis terminal 文本作为业务终态。
6. requested/completed Outbox、ChatTurn、BackgroundJob 和 assistant message 均达到 durable success；无 chat queue backlog。

验收过程中没有读取 Provider credential 值、没有调用 DeepSeek/Qwen/其他 Provider，模型费用为 0。没有执行 volume 删除、数据库
reset、Redis `FLUSHDB/FLUSHALL`、MinIO wipe 或 Docker prune。合成账号 `cmtnr0irv0000my01lopx81py` 的 User、Conversation、ChatMessage、
ChatTurn、BackgroundJob、目标 Outbox、Bull job、Stream key 和浏览器 owner-scoped 数据均已精确清理为 0；无 owner scope 的 chat draft
未删除。

## 6. 证据等级与未完成项

本任务证据等级仅为：

```text
implemented + mock/static validated + Mock Docker/可见浏览器产品验收
```

它不证明真实模型 Worker、Provider SLA、计费、`production-used` 或真正 SSE push。后续顺序：

1. ticket 05：全链路 ChatRunBudget ledger、跨节点 reservation 与 Trace 对账。
2. ticket 06：真实模型 Worker 的独立 gate、usage/cost、受控产品 smoke 和默认关闭回归。
3. SSE push 仅在 polling 延迟/负载证据表明确有价值时再单独设计。

## 7. Git 收口

```text
feature branch: drb/chat-turn-browser-replay
feature commit: Git 收口后补录
feature remote: Git 收口后补录
main merge: Git 收口后补录
main == origin/main: merged-main 复验后补录
```

提交、合并和 merged-main 复验不得包含七个用户预修改文件；最终 SHA、merged-main 结果和分支 parity 由后续只改文档的 closeout 原子提交补录。
