# Phase 6 ChatTurn Enqueue API

更新时间：2026-09-04
状态：ticket 01 已实现、推送并以 `--no-ff` 合并 `main`；merged-main 复验通过。

## 1. 目的

现有 `ChatTurnEnqueueService` 已能在一个 Serializable 事务中写入 `ChatTurn`、`BackgroundJob` 和
`chat.response.requested` Outbox，但此前没有认证的 HTTP 写入口。本任务提供最小公共 seam，让 Web 后续可以拿到稳定
`turnId`，再连接状态查询、事件回放和后台执行；它不改变当前 `/api/chat` 同步链路。

## 2. 公共接口

`POST /chat-turns` 需要 `JwtAuthGuard`。请求只允许提交已经持久化的事实：

| 字段                  | 约束                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `conversationId`      | trim 后为 1-128 位安全 id，字符集与共享 `CHAT_TURN_ID_PATTERN` 一致 |
| `clientRequestId`     | trim 后 1-120 位，同一 owner 下幂等                                 |
| `inputHash`           | `sha256:` 加 64 位小写十六进制                                      |
| `inputMessageIds`     | 1-1000 个唯一、bounded、安全 id                                     |
| `budgetPolicyVersion` | trim 后 1-80 位                                                     |

响应为 `202 Accepted`，并经过全局 response envelope：

```json
{
  "success": true,
  "data": {
    "kind": "created",
    "turn": {
      "id": "turn_safe_id",
      "conversationId": "conversation_safe_id",
      "status": "QUEUED",
      "createdAt": "2026-09-04T00:00:00.000Z",
      "updatedAt": "2026-09-04T00:00:00.000Z"
    },
    "backgroundJob": {
      "id": "job_safe_id",
      "status": "QUEUED",
      "attempt": 0,
      "maxAttempts": 3,
      "progress": 0,
      "requestedAt": "2026-09-04T00:00:00.000Z"
    }
  },
  "requestId": "request-safe-id"
}
```

`data.kind` 为 `created` 或 `existing`。响应不会包含 `userId`、输入消息正文、`inputHash`、Outbox 行、Outbox payload、
凭据或 Provider 原文。

## 3. 权限与一致性边界

- owner 只从 JWT 的 `AuthenticatedUser.id` 取得，body 中的 `userId` 等未知字段由 strict Zod schema 拒绝。
- Repository 在同一 owner 下校验 conversation 和每个 input message；不存在或跨 owner 的 id fail-closed。
- Controller 只调用既有 `ChatTurnEnqueueService`，不创建第二个事务，不直接调用 BullMQ、Redis、Provider 或 Worker。
- Service 在一个 Serializable 事务中按 `turn -> backgroundJob -> outbox` 顺序提交；任一步失败都回滚整个 admission。
- `(userId, clientRequestId)` 是幂等键。相同事实返回同一组已持久化事实；事实变化返回冲突；缺少已配对 Job/Outbox 的历史孤儿 turn
  返回受限服务错误，而不会偷偷创建第二份工作。
- 有限重试只处理 Serializable 冲突，不重试业务冲突或 Provider 调用。

## 4. 改动范围

- `packages/types/src/api/chat-turn.ts`：strict 请求/响应 Zod contract 和共享 ID pattern；
- `packages/types/tests/chat-turn.test.mts`：字段边界、trim、重复 id、hash、响应安全字段和状态约束；
- `apps/server/src/chat-turns/chat-turns.controller.ts`：认证 POST seam、202 元数据、envelope-aware Swagger 和安全投影；
- `apps/server/src/chat-turns/chat-turns.controller.spec.ts`：JWT metadata、成功/幂等、malformed/oversized、owner binding、冲突透传；
- `apps/server/src/config/swagger.spec.ts`：operation、request pattern 和安全 response schema 回归；
- `.scratch/chat-turn-enqueue-api/issues/01-authenticated-enqueue.md`：ticket 状态与回执。

本任务不迁移 `/api/chat`，不改 `/chat-messages/sync`，不写 snapshot，不实现浏览器 replay、全链路 budget ledger 或真实模型 Worker。

## 5. 验证证据

功能分支执行结果：

```text
ChatTurn focused: 10 suites / 52 tests passed
Controller + Swagger focused: 2 suites / 13 tests passed
@repo/types: 44 tests passed; typecheck passed
Server build: passed
Server target ESLint: passed
Target Prettier check: passed
git diff --check: passed
```

Server 全量 Jest（环境未启动 PostgreSQL）：`237 passed / 2 failed / 3 skipped` suites，`2243 passed / 2 failed / 30 skipped`
tests。两个失败与本任务无关：既有 `worker-readiness-cli` 在当前运行环境返回码为 `1` 而历史断言期望 `2`，以及既有
operator-audit integration 无法连接 `127.0.0.1:5433`。`@repo/types lint` 当前脚本在该 package 目录找不到 `eslint` 可执行文件，
因此以通过的 typecheck、完整类型测试、目标 server ESLint 和 Prettier 记录为准；这不是本任务代码失败。

## 6. 证据等级与安全记录

证据等级：`implemented` + `mock/static validated`。本任务没有读取 `.env` 或任何凭据，没有调用 DeepSeek/Qwen/其他 Provider，
没有启动、清理或重建 Docker，没有触碰 PostgreSQL/Redis/MinIO 业务数据，也没有创建 controlled-Live 证据。`202` 只证明 durable
admission，不证明 Worker 已执行、模型已返回或产品 `/api/chat` 已切换。

## 7. Git 与合并回执

```text
base main: a8a0697a0087e68ae3369dd690bcccfa6b6a4c30
feature branch: drb/chat-turn-enqueue-api
feature commit: 4511d3ee9b2602b9f9b8e55d8c04c4a09c229a40
feature remote: origin/drb/chat-turn-enqueue-api (pushed)
main merge: 582f2aefc922edee9f31475424e09cbe93c83e42
main == origin/main: yes
merged-main controller + Swagger: 13/13 passed
merged-main @repo/types: 44 tests passed; typecheck passed
merged-main Server build: passed
merged-main target ESLint: passed
merged-main target Prettier (`--end-of-line=crlf`): passed
merged-main git diff --check: passed
```

合并后二次复验没有重复调用 Provider。Server 全量 Jest 的既有 `worker-readiness` 退出码断言和本地
`127.0.0.1:5433` operator-audit integration 仍分别失败；它们不是本 ticket 引入，详见上面的验证说明。工作区中
用户预先修改的 ReviewAgent、WrongQuestionOrganizer 文件和 `docs/agents/triage-labels.md` 均未暂存或提交。

## 8. 后续

Web enqueue adapter（ticket 02）已在独立普通分支实现、推送、合并并完成 merged-main 复验，详见
[`phase-6-chat-turn-web-enqueue-adapter.md`](phase-6-chat-turn-web-enqueue-adapter.md)。ticket 03 也已完成 `/api/chat` gated
admission/handoff，详见 [`phase-6-chat-turn-api-bridge.md`](phase-6-chat-turn-api-bridge.md)。之后是浏览器 replay、
ChatRunBudget/Trace ledger 和真实模型 Worker gate。每张 ticket 仍从最新已推送 `main` 开普通分支，
并在合并 `main` 后再次复验。
