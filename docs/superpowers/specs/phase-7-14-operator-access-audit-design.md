# Phase 7.14 Operator Access 与操作审计设计

## 背景

Phase 7 已经把后台任务、BullMQ worker、Durable Outbox、Worker Observability、Worker Readiness 和 Docker Compose 全栈验收串起来了。现在系统已经有一批“诊断入口”：

- `GET /outbox-events`
- `GET /outbox-events/:id`
- `POST /outbox-events/:id/requeue`
- `GET /worker-observability/summary`
- `GET /worker-readiness`
- `/api-docs` / `/api-docs-json`
- `/agent-trace`

这些入口不是普通学习功能。它们会暴露系统级队列、worker、outbox 状态，甚至允许把 `FAILED / DEAD` outbox event 重置为 `PENDING`。当前保护方式主要是 feature gate 加 `JwtAuthGuard`。这比公开接口安全，但还不够像生产系统：普通登录用户不应该默认看到系统级诊断信息，更不应该执行 requeue 这类运维操作。

Phase 7.14 的目标是补上 operator 权限模型与操作审计，让“能排障”升级为“安全、可追责地排障”。

## 目标

1. 明确普通用户、operator、admin 的边界。
2. 为系统级诊断入口增加 operator 级访问控制。
3. 对会改变系统状态的诊断操作记录审计日志。
4. 审计日志只记录安全元数据，不保存 payload、prompt、RAG chunk、API key、token、cookie 或用户正文。
5. 保持本地开发可用，但不能让开发开关绕过生产权限边界。

## 非目标

- 不做完整后台管理系统。
- 不做复杂 RBAC 菜单、租户权限或组织权限。
- 不开放 outbox payload 查看、payload 编辑、强制成功、删除事件或直接 dispatch。
- 不把 Worker Readiness CLI 改成需要登录。CLI 是部署机器检查入口，HTTP 入口才走 operator 访问控制。
- 不把普通用户的学习数据暴露给 operator。operator 只能看到诊断元数据。

## 角色模型

当前 Prisma 已有：

```prisma
enum Role {
  STUDENT
  ADMIN
}
```

Phase 7.14 第一版不新增复杂角色表，直接复用 `User.role`：

| 角色 | 可访问能力 |
| --- | --- |
| `STUDENT` | 普通学习功能、自己的学习数据、自己的 Agent Trace |
| `ADMIN` | 普通学习功能，加 operator 诊断入口和安全 requeue |

命名上，代码里可以叫 `OperatorGuard` 或 `RequireOperatorGuard`，但第一版判定条件是 `request.user.role === 'ADMIN'`。这样面试时也好解释：先用最小权限模型闭环，后续如果有组织和团队，再扩展为 `OPERATOR`、`ADMIN`、`SUPER_ADMIN` 或权限位。

## 接口分级

### 普通账号级接口

继续只用 `JwtAuthGuard` 和当前用户 `userId` 隔离：

- 错题、复习、知识库文档、聊天记录
- `/background-jobs`
- `/background-jobs/summary`
- `/agent-traces`
- `/memory-agent`
- `/knowledge-agent/suggestions`

这些接口读取的是当前账号范围，不需要 operator guard。

### 系统级只读诊断接口

需要 feature gate + `JwtAuthGuard` + `OperatorGuard`：

- `GET /outbox-events`
- `GET /outbox-events/:id`
- `GET /worker-observability/summary`
- `GET /worker-readiness`

原因：

- outbox 列表和详情是系统级事件状态，不按当前用户隔离。
- worker observability 暴露系统级 queue counts 和 worker heartbeat。
- HTTP worker readiness 是给部署和排障看的机器友好摘要，不是普通学习页面能力。

Guard 顺序建议：

```ts
@UseGuards(FeatureEnabledGuard, JwtAuthGuard, OperatorGuard)
```

这样 feature gate 关闭时仍然优先隐藏为 404，避免暴露诊断入口是否存在；feature gate 开启后，必须先认证，再检查 operator 权限。

### 系统级写诊断接口

需要 feature gate + `JwtAuthGuard` + `OperatorGuard` + audit log：

- `POST /outbox-events/:id/requeue`

它会把 `FAILED / DEAD` 事件重置成 `PENDING`，属于真实状态变更。即使它不立即执行 handler，也必须留痕。

## OperatorGuard 设计

新增一个可复用 Guard，建议位置：

```text
apps/server/src/auth/operator.guard.ts
```

职责：

1. 从 `request.user` 读取 `role`。
2. 只允许 `ADMIN`。
3. 非 admin 返回 403。
4. 不读取数据库，不做额外查询，避免每个诊断请求增加不必要成本。

伪代码：

```ts
@Injectable()
export class OperatorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Operator permission required');
    }

    return true;
  }
}
```

注意：`OperatorGuard` 必须放在 `JwtAuthGuard` 后面，因为它依赖 `request.user`。

## 操作审计模型

新增 Prisma model：

```prisma
enum OperatorAuditAction {
  OUTBOX_REQUEUE
}

enum OperatorAuditStatus {
  SUCCEEDED
  FAILED
}

model OperatorAuditLog {
  id             String              @id @default(cuid())
  actorUserId    String
  action         OperatorAuditAction
  status         OperatorAuditStatus
  targetType     String
  targetId       String?
  reason         String?             @db.VarChar(240)
  metadata       Json?
  errorCode      String?
  errorPreview   String?             @db.VarChar(240)
  requestId      String?             @db.VarChar(80)
  ipAddressHash  String?             @db.VarChar(80)
  userAgentHash  String?             @db.VarChar(80)
  createdAt      DateTime            @default(now())

  actor User @relation(fields: [actorUserId], references: [id], onDelete: Cascade)

  @@index([actorUserId, createdAt])
  @@index([action, createdAt])
  @@index([targetType, targetId, createdAt])
  @@index([status, createdAt])
}
```

同时在 `User` model 上补一行反向关系：

```prisma
operatorAuditLogs OperatorAuditLog[]
```

第一版只记录 `OUTBOX_REQUEUE`。后续如果有更多操作，再扩展 action 枚举。

### 为什么不记录原始 IP / User-Agent

它们对排障有用，但也可能变成隐私数据。第一版使用 hash：

- `ipAddressHash`
- `userAgentHash`

这样可以判断“是否同一来源连续操作”，但不直接暴露原始值。

### metadata 允许内容

允许：

- outbox event 脱敏状态快照：`previousStatus`、`nextStatus`
- attempts 前后变化
- `payloadHash`
- `lastErrorCode`
- 操作入口：`source: 'http'`

禁止：

- outbox `payload`
- `aggregateId`
- 用户输入正文
- prompt
- RAG chunk
- 模型回答
- API key
- access token / refresh token
- cookie

## Audit service 设计

新增模块建议：

```text
apps/server/src/operator-audit/operator-audit.module.ts
apps/server/src/operator-audit/operator-audit.service.ts
apps/server/src/operator-audit/operator-audit.service.spec.ts
```

Service 暴露两个主方法：

```ts
recordSuccess(input)
recordFailure(input)
```

也可以设计成一个 `record(input)`，但成功和失败分开更容易在调用处表达意图。

失败审计必须 best-effort：

- requeue 主操作失败时，要尽量记录失败审计，然后把原错误抛回。
- 审计写入失败不能把原本成功的 requeue 变成失败。
- 审计写入失败只记录脱敏 warning，不打印 payload 或 token。

## Outbox requeue 接入方式

Controller 当前：

```ts
async requeue(@Param('id') id: string, @Body() body: unknown) {
  outboxEventRequeueRequestSchema.parse(body ?? {});
  return this.service.requeue(id, new Date());
}
```

Phase 7.14 应改为：

1. 解析 reason。
2. 从 `@CurrentUser()` 获取 actor。
3. 调用 service requeue。
4. 成功后记录 `OUTBOX_REQUEUE / SUCCEEDED`。
5. 如果 requeue 抛错，记录 `OUTBOX_REQUEUE / FAILED`，再抛错。

伪代码：

```ts
async requeue(
  @CurrentUser() actor: AuthenticatedUser,
  @Param('id') id: string,
  @Body() body: unknown,
  @Req() request: Request,
) {
  const parsed = outboxEventRequeueRequestSchema.parse(body ?? {});

  try {
    const result = await this.service.requeue(id, new Date());
    await this.audit.recordSuccess({
      actorUserId: actor.id,
      action: 'OUTBOX_REQUEUE',
      targetType: 'OutboxEvent',
      targetId: id,
      reason: parsed.reason,
      request,
      metadata: {
        nextStatus: result.status,
        payloadHash: result.payloadHash,
      },
    });
    return result;
  } catch (error) {
    await this.audit.recordFailure({
      actorUserId: actor.id,
      action: 'OUTBOX_REQUEUE',
      targetType: 'OutboxEvent',
      targetId: id,
      reason: parsed.reason,
      request,
      error,
    });
    throw error;
  }
}
```

## 测试计划

### Guard 单测

- `OperatorGuard` 允许 `role=ADMIN`。
- `OperatorGuard` 拒绝 `role=STUDENT`。
- `OperatorGuard` 在没有 `request.user` 时返回 403。

### Controller metadata 单测

- Outbox Ops controller guard 顺序为：
  `OutboxOpsEnabledGuard -> JwtAuthGuard -> OperatorGuard`
- Worker Observability controller guard 顺序为：
  `JwtAuthGuard -> OperatorGuard`
- Worker Readiness controller guard 顺序为：
  `WorkerReadinessEnabledGuard -> JwtAuthGuard -> OperatorGuard`

如果后续决定 worker observability 也做 feature gate guard，可以调整为：
`WorkerObservabilityEnabledGuard -> JwtAuthGuard -> OperatorGuard`。

### Audit service 单测

- 成功审计会写入 actor、action、target、status、reason。
- 失败审计会脱敏并截断 error preview。
- metadata 不允许保存 payload / token / API key。
- IP 和 User-Agent 只保存 hash。

### Outbox requeue 单测

- 非 admin 不能 requeue。
- admin requeue 成功会写审计。
- requeue 失败会写失败审计，并继续抛出原错误。
- 审计写失败不影响 requeue 成功返回。

## 验收命令

```powershell
bun --filter @repo/server test
bun --filter @repo/server build
bun --filter @repo/server test:e2e
```

如果改到 Prisma schema：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
```

Docker 验收：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d postgres redis minio server worker web
docker compose -f docker/docker-compose.dev.yml --profile worker ps
```

手动验收：

1. 用普通学生账号访问 `/outbox-events`，应返回 403 或前端隐藏入口。
2. 用 admin 账号访问 `/outbox-events`，应能看到脱敏列表。
3. 用 admin 对 `FAILED / DEAD` outbox event 调 requeue，应成功写入 audit log。
4. 确认 audit log 不包含 payload、prompt、chunk、API key、token 或 cookie。

## 实施拆分

### Phase 7.14.1 设计文档

当前文档。只定边界，不改业务逻辑。

### Phase 7.14.2 OperatorGuard

- 新增 `OperatorGuard`。
- 接入 Outbox Ops、Worker Observability、Worker Readiness。
- 补 controller guard 顺序测试。

### Phase 7.14.3 OperatorAuditLog

- Prisma schema 新增 enum 和 model。
- 生成 Prisma Client。
- 新增 `OperatorAuditService`。
- 补审计脱敏测试。

### Phase 7.14.4 Outbox requeue 审计

- `POST /outbox-events/:id/requeue` 接入 audit。
- 成功和失败都留痕。
- 审计写入失败只影响日志，不影响主操作。

### Phase 7.14.5 前端与文档收尾

- 如果已有入口页面，隐藏普通用户不可用入口或展示受控提示。
- 更新 `DEVLOG.md`、`docs/data-flow.md`、`docs/dev-start.md` 和 `AGENTS.md`。
- 写一篇面试学习博客，解释“诊断接口为什么不能只靠登录态”。

## 面试讲法

这一步可以这样讲：

> 我们做到 outbox、worker readiness 以后，系统已经不只是业务 API，还有运维诊断 API。第一版用 feature gate 和登录态保护，但这不够生产化，因为普通登录用户不应该看到系统级队列状态，也不应该执行 requeue。后续我补了 operator guard 和审计日志：只允许 admin 访问诊断入口，所有会改变状态的操作都记录 actor、action、target、结果和脱敏错误摘要，同时明确禁止保存 payload、prompt、chunk、token、cookie 和 API key。这样排障能力既可用，又有最小权限和可追责性。
