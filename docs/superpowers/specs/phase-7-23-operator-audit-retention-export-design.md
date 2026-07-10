# Phase 7.23 Operator Audit 保留周期与证据包导出设计

> 状态：设计已由用户确认，尚未实现
> 日期：2026-07-10
> 目标版本：Phase 7.23
> 设计定位：事故排障证据包，不是通用数据分析或长期合规归档系统

## 1. 背景

Phase 7.14 到 Phase 7.22 已经完成 OperatorGuard、`OperatorAuditLog`、Outbox requeue 审计、脱敏查询 API、独立 Admin Console、审计详情、Outbox Ops、Worker Readiness 和 Docker 全栈验收。

当前系统可以回答“某个管理员做过什么”，但仍缺少两个生产边界：

1. `OperatorAuditLog` 没有明确保留周期，数据会持续增长。
2. 管理员只能在页面查看记录，无法安全地把一次事故相关记录交给其他负责人复盘。

直接导出数据库不是可接受方案。数据库裸导出会绕过现有 DTO 脱敏边界，也无法说明导出人、筛选范围、生成时间和文件完整性。另一方面，导出文件本身也是敏感数据，如果永久放在 MinIO，又会形成一个没有生命周期治理的新审计库。

Phase 7.23 因此聚焦两件事：

- 为 Operator Audit 建立默认 180 天的保留与清理策略。
- 提供受控、脱敏、可校验、24 小时过期的事故证据包。

## 2. 已确认的产品决策

| 决策 | 结论 |
| --- | --- |
| 首要使用场景 | 事故排障与复盘证据包 |
| 默认审计保留周期 | 180 天，受控配置 |
| 证据包格式 | ZIP，包含 `records.csv` 与 `manifest.json` |
| 执行方式 | 异步 BackgroundJob + BullMQ Worker |
| 可靠投递 | PostgreSQL 事务型 Outbox 驱动 BullMQ enqueue |
| 证据包下载有效期 | READY 后 24 小时；应用在下一次小时维护中物理删除，48 小时 lifecycle 兜底 |
| legal hold | 第一版不支持 |
| 单次时间范围 | 必填，最多 31 天 |
| 单包记录上限 | 默认 50,000 条 |
| 审计写入失败 | 导出申请与下载失败关闭 |
| Admin Console 入口 | 现有 `/audit` 内增加“审计记录 / 证据包”标签页 |

## 3. 目标

1. ADMIN 可以按明确时间范围和脱敏筛选条件申请证据包。
2. 导出申请、任务事实和可靠投递事件必须在同一 PostgreSQL 事务内落库。
3. Redis 或 BullMQ 暂时不可用时，任务不能静默丢失。
4. Worker 只读取允许公开的脱敏审计字段，不读取 `metadata`。
5. 证据包提供 CSV 和 ZIP 完整性摘要，但不把 SHA-256 描述成数字签名。
6. 每次申请和下载必须成功写入 Operator Audit，否则拒绝操作。
7. ZIP 到期后自动删除，审计记录和导出元数据按 180 天分批清理。
8. 清理任务不能删除仍被活跃导出所需的临界数据。
9. Admin Console 能展示导出状态、错误、校验值、过期时间和下载入口。

## 4. 非目标

- 不做法律意义上的 WORM、数字签名、公证或不可否认性平台。
- 不做长期对象归档；需要长期保存时，由管理员把证据包转交外部受控归档。
- 不做 legal hold、审批流、双人复核或解除冻结。
- 不做通用 BI、全库导出或任意 SQL 查询。
- 不导出 `metadata`、Outbox payload、`aggregateId`、用户正文、prompt、RAG chunk、模型回答、API key、token、cookie、原始 IP 或原始 User-Agent。
- 不支持手动延长 ZIP 有效期、恢复过期文件、修改导出结果或直接编辑 MinIO object key。
- 不把系统维护任务伪装成某个 ADMIN 的操作审计。
- 不在本阶段完成 Prometheus / Grafana 指标；只为后续指标保留清晰状态和错误码。

## 5. 领域边界

本阶段使用三份持久化事实和两个执行组件：

| 组件 | 权威职责 |
| --- | --- |
| `OperatorAuditLog` | 管理员执行过什么高权限操作 |
| `OperatorAuditExport` | 一次证据包的筛选条件、领域状态、文件摘要和过期时间 |
| `BackgroundJob` | 导出 Worker 的排队、执行、重试和终态 |
| `OutboxEvent` | 保证数据库中的导出任务最终进入 BullMQ |
| MinIO | READY 后提供 24 小时下载；应用下一次小时维护物理删除，prefix lifecycle 保证 48 小时兜底上限 |

`OperatorAuditExport` 不能被 `BackgroundJob.resultSummary` 替代。BackgroundJob 是通用执行事实，不适合承担下载状态、过期时间、证据包 hash 和筛选条件的长期语义。

Outbox 也不能替代导出领域模型。Outbox 只负责可靠投递，不是管理员查询任务或下载文件的产品状态。

## 6. 数据模型

### 6.1 状态机

```text
QUEUED -> PROCESSING -> READY -> EXPIRED
            |    |        -> FAILED (READY file missing)
            |    -> FAILED
            -> QUEUED (retry)
            -> PROCESSING (expired lease reclaim)
```

状态含义：

| 状态 | 含义 |
| --- | --- |
| `QUEUED` | 数据库事实已创建，等待 Outbox/BullMQ 或等待重试 |
| `PROCESSING` | Worker 已 claim，正在查询和生成文件 |
| `READY` | ZIP 已上传，数据库已保存文件摘要，允许下载 |
| `FAILED` | 非重试错误或重试耗尽，不允许下载 |
| `EXPIRED` | 24 小时有效期已过，MinIO 文件已删除或确认不存在 |

`expiresAt = completedAt + 24 hours`，从 export 成功进入 READY 的数据库时间起算，不从申请时间或 Worker 开始时间起算。Export 元数据的 180 天保留从 `createdAt` 起算，但维护任务只能删除 `FAILED/EXPIRED` 且对象已确认不存在的记录；仍可下载的 READY 元数据不会先于文件被清理。

### 6.2 Prisma 草案

```prisma
enum OperatorAuditExportStatus {
  QUEUED
  PROCESSING
  READY
  FAILED
  EXPIRED
}

model OperatorAuditExport {
  id                    String                    @id @default(cuid())
  requestedByUserId     String?
  clientRequestId       String                    @db.VarChar(80)
  requestHash           String                    @db.VarChar(71)
  backgroundJobId       String                    @unique
  status                OperatorAuditExportStatus @default(QUEUED)

  startAt               DateTime
  endAt                 DateTime
  snapshotAt            DateTime
  filterAction          OperatorAuditAction?
  filterStatus          OperatorAuditStatus?
  filterTargetType      String?                   @db.VarChar(120)
  filterTargetId        String?                   @db.VarChar(200)
  filterActorUserId     String?
  reason                String                    @db.VarChar(240)

  objectKey             String?                   @unique @db.VarChar(500)
  fileName              String?                   @db.VarChar(180)
  archiveSize           Int?
  recordCount           Int?
  csvSha256             String?                   @db.VarChar(71)
  archiveSha256         String?                   @db.VarChar(71)
  schemaVersion         Int                       @default(1)

  errorCode             String?                   @db.VarChar(120)
  errorPreview          String?                   @db.VarChar(240)
  processingToken       String?                   @db.VarChar(80)
  leaseExpiresAt        DateTime?
  requestedAt           DateTime                  @default(now())
  startedAt             DateTime?
  completedAt           DateTime?
  expiresAt             DateTime?
  expiredAt             DateTime?
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt

  requestedBy User? @relation(fields: [requestedByUserId], references: [id], onDelete: SetNull)

  @@unique([requestedByUserId, clientRequestId])
  @@index([requestedByUserId, createdAt])
  @@index([status, expiresAt])
  @@index([status, startAt])
  @@index([createdAt, id])
}
```

`backgroundJobId` 是跨生命周期关联 id，第一版不建立 Prisma 外键。后台任务记录可以按独立生命周期清理，导出元数据仍按 180 天策略保留。

`User` model 需要补充 `operatorAuditExports` 反向关系；请求人删除时只把 `requestedByUserId` 置空，不删除 export 元数据。

当前 `BackgroundJob.userId` 使用 Cascade，不适合系统级导出任务。Phase 7.23.2 同步演进为：

```prisma
enum BackgroundJobScope {
  ACCOUNT
  SYSTEM
}

model BackgroundJob {
  userId String?
  scope  BackgroundJobScope @default(ACCOUNT)

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

既有知识库任务继续使用 `scope=ACCOUNT` 和非空 userId，保留用户删除时的数据库级 Cascade 语义；账号级 `/background-jobs` API 必须固定查询 `scope=ACCOUNT AND userId=currentUserId`。审计导出使用 `scope=SYSTEM, userId=null`，请求人只保存在 `OperatorAuditExport.requestedByUserId`，因此请求人删除不会让正在运行的 export/job 失去执行事实。

数据库约束无法直接表达“ACCOUNT 必须有 userId、SYSTEM 必须没有 userId”的条件，migration 使用 PostgreSQL CHECK constraint 固定该不变量，并为 `scope/status/createdAt` 增加系统任务索引。

现有 `BackgroundJobsService` 的账号级方法继续要求非空 userId。导出 Worker 使用单独的内部 system-job repository/service，所有查询都固定 `scope=SYSTEM`；不能为了支持 null owner 而把现有账号级方法改成可省略 userId。

维护任务增加单例持久状态，不为每小时运行伪造一个账号级 BackgroundJob：

```prisma
enum OperatorAuditMaintenanceStatus {
  IDLE
  RUNNING
  SUCCEEDED
  FAILED
}

model OperatorAuditMaintenanceState {
  name               String   @id
  lastStartedAt      DateTime?
  lastSucceededAt    DateTime?
  lastFinishedAt     DateTime?
  status             OperatorAuditMaintenanceStatus @default(IDLE)
  expiredExportCount Int      @default(0)
  deletedAuditCount  Int      @default(0)
  deletedExportCount Int      @default(0)
  errorCode          String?  @db.VarChar(120)
  errorPreview       String?  @db.VarChar(240)
  updatedAt          DateTime @updatedAt
}
```

Worker Readiness 在 maintenance 启用时检查 `lastSucceededAt`；超过两个调度周期没有成功记录时进入 degraded，避免 24 小时删除承诺静默失效。

`OperatorAuditLog` 增加：

```prisma
@@index([createdAt, id])
```

用于无附加筛选时的稳定导出分页和分批清理。

### 6.3 Operator Audit action

```prisma
enum OperatorAuditAction {
  OUTBOX_REQUEUE
  AUDIT_EXPORT_REQUEST
  AUDIT_EXPORT_DOWNLOAD
}
```

`AUDIT_EXPORT_DOWNLOAD` 表示服务端已完成授权、成功打开 MinIO 对象流并准备返回响应，不声称客户端一定完整保存了全部字节。

## 7. 配置与权限

新增受控配置：

```text
OPERATOR_AUDIT_EXPORT_ENABLED=false
OPERATOR_AUDIT_MAINTENANCE_ENABLED=false
OPERATOR_AUDIT_RETENTION_DAYS=180
OPERATOR_AUDIT_EXPORT_TTL_HOURS=24
OPERATOR_AUDIT_EXPORT_MAX_RANGE_DAYS=31
OPERATOR_AUDIT_EXPORT_MAX_RECORDS=50000
OPERATOR_AUDIT_EXPORT_MAX_ARCHIVE_BYTES=67108864
OPERATOR_AUDIT_EXPORT_PER_ADMIN_ACTIVE_LIMIT=2
OPERATOR_AUDIT_EXPORT_PER_ADMIN_HOURLY_LIMIT=10
OPERATOR_AUDIT_EXPORT_GLOBAL_ACTIVE_LIMIT=10
OPERATOR_AUDIT_EXPORT_WORKER_CONCURRENCY=1
OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS=600000
OPERATOR_AUDIT_EXPORT_LEASE_MS=300000
OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS=3600000
OPERATOR_AUDIT_EXPORT_DELIVERY_RECOVERY_HOURS=24
OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS=120000
OPERATOR_AUDIT_FINGERPRINT_SECRET=<production secret>
```

production 中导出和维护默认关闭。部署启用导出时，还必须显式启用：

```text
OUTBOX_DISPATCHER_ENABLED=true
```

否则 Outbox 事件不会进入 BullMQ。Docker dev 栈在实现阶段应显式配置这些开关，不能依赖 `NODE_ENV` 默认值。

当 `SERVER_ROLE=worker|both` 且导出开关开启时，启动配置必须同时满足 `OUTBOX_DISPATCHER_ENABLED=true` 和 `OPERATOR_AUDIT_MAINTENANCE_ENABLED=true`，否则进程拒绝启动。API-only 进程不要求在本进程启动 Dispatcher，但 Worker Readiness 必须能观察到 export queue、maintenance queue 和最近维护成功时间。

创建接口要求客户端提供 UUID `clientRequestId`。服务端对规范化后的时间、筛选条件和 reason 计算 `requestHash`；同一 ADMIN 重试相同 id 与相同 hash 时返回已有 export，不重复创建任务或审计，相同 id 携带不同 hash 时返回 409。限制每 ADMIN 同时 2 个、每小时 10 个申请，以及全局 10 个活跃任务。Worker 在记录数限制之外继续检查 64 MiB archive 上限和可用临时磁盘预算，防止队列、内存、磁盘或 MinIO 被高频导出耗尽。

现有来源 hash 使用无密钥 SHA-256，不能被描述成匿名化数据。实现阶段把新写入改为带独立 secret 的 HMAC-SHA256，前缀使用 `hmac-sha256:`；历史 `sha256:` 值不做不可行的原值回填。证据包把两类值都当作敏感的关联指纹，仍只允许 ADMIN 获取。

HTTP guard 顺序：

```text
OperatorAuditEnabledGuard
  -> OperatorAuditExportEnabledGuard
  -> JwtAuthGuard
  -> OperatorGuard
```

feature gate 关闭时先返回 404；开启后未登录返回 401，非 ADMIN 返回 403。

## 8. API contract

### 8.1 创建导出

```text
POST /operator-audit-exports
```

请求：

```json
{
  "clientRequestId": "1f01912c-7a3e-4e90-a26d-e49c9a314f63",
  "startAt": "2026-07-01T00:00:00.000Z",
  "endAt": "2026-07-10T00:00:00.000Z",
  "reason": "INC-2026-0710 Outbox 重试事故复盘",
  "action": "OUTBOX_REQUEUE",
  "status": "FAILED",
  "targetType": "OutboxEvent",
  "targetId": "optional-safe-id",
  "actorUserId": "optional-user-id"
}
```

约束：

- `startAt`、`endAt` 必填，且 `startAt < endAt`。
- `clientRequestId` 必须是 UUID，并在当前 ADMIN 范围内幂等。
- 范围最多 31 天。
- `startAt` 不能早于本次请求计算出的 180 天保留边界。
- `endAt` 不能晚于同一事务取得的数据库当前时间；不接受未来时间窗。
- `reason` 去空格后长度为 3 到 240。
- 所有可选筛选字段复用 `@repo/types/api/operator-audit` schema。
- 创建成功返回 `202 Accepted` 和脱敏 export DTO。

### 8.2 查询

```text
GET /operator-audit-exports
GET /operator-audit-exports/:id
```

列表 query 固定为：

```text
status?
requestedByUserId?
createdFrom?
createdTo?
limit=20 (1..100)
cursor?
```

时间筛选对应 export 的 `createdAt`。cursor 复用仓库稳定分页方式：客户端传最后一条 export id，服务端查询其 `createdAt`，再按 `createdAt DESC, id DESC` 继续读取。详情返回：

- export id、状态、申请人。
- 显式筛选条件和申请原因。
- BackgroundJob id。
- 记录数、文件名、文件大小。
- CSV / ZIP SHA-256。
- 申请、开始、完成、过期时间。
- 脱敏错误 code / preview。
- `canDownload`。

`canDownload` 只在以下条件全部满足时为 true：`status=READY`、`expiresAt>databaseNow`、`objectKey/archiveSha256/fileName` 均存在。它是界面提示，不替代下载接口的服务端复检。

导出记录是系统级 operator 资源，不按当前管理员账号隔离。任一通过 guard 的 ADMIN 都可以查看或下载其他 ADMIN 申请的证据包；每次下载都记录实际下载者，便于事故交接与追责。

永不返回：

- `objectKey`。
- Outbox payload 或 aggregateId。
- `OperatorAuditLog.metadata`。
- 任何被现有审计 DTO 禁止的敏感字段。

### 8.3 下载

```text
POST /operator-audit-exports/:id/download
```

使用 POST 而不是普通链接，避免预取、缓存或误点击把一次高权限文件访问伪装成无副作用导航。

下载前必须：

1. export 存在。
2. 状态为 `READY`。
3. `expiresAt > now`。
4. MinIO 对象能够成功打开。
5. `AUDIT_EXPORT_DOWNLOAD` 审计能够成功写入。

响应：

```text
Content-Type: application/zip
Content-Disposition: attachment; filename="..."
Cache-Control: no-store, private
X-Content-SHA256: sha256:<64 hex chars>
```

文件名完全由服务端生成：

```text
prepmind-operator-audit-<YYYYMMDD>-<YYYYMMDD>-<shortExportId>.zip
```

不拼接 reason、targetId 或客户端文件名，并剔除 CR/LF，避免 `Content-Disposition` header injection。CORS 只额外暴露 `Content-Disposition` 与 `X-Content-SHA256` 给已允许的 Admin Console origin。

错误码：

| 场景 | HTTP | code |
| --- | --- | --- |
| 时间范围、reason、UUID 非法 | 400 | `OPERATOR_AUDIT_EXPORT_INVALID_REQUEST` |
| 超出活跃任务配额 | 429 | `OPERATOR_AUDIT_EXPORT_LIMIT_REACHED` |
| clientRequestId 已用于不同请求 | 409 | `OPERATOR_AUDIT_EXPORT_IDEMPOTENCY_CONFLICT` |
| export 不存在 | 404 | `OPERATOR_AUDIT_EXPORT_NOT_FOUND` |
| 状态不是 READY | 409 | `OPERATOR_AUDIT_EXPORT_NOT_READY` |
| 已过期 | 410 | `OPERATOR_AUDIT_EXPORT_EXPIRED` |
| 文件缺失或 MinIO 不可用 | 502 | `OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE` |
| 强制审计写入失败 | 503 | `OPERATOR_AUDIT_EXPORT_AUDIT_FAILED` |

全局 `ResponseEnvelopeInterceptor` 当前会包装所有响应。实现二进制下载时必须显式支持 `StreamableFile` 旁路 envelope，并补回归测试。OpenAPI 文档要说明二进制下载是全局 JSON envelope 的例外。

## 9. 事务型 Outbox

### 9.1 为什么当前 best-effort Outbox 不够

当前知识库处理链路在 `queue.add()` 成功后 best-effort 写 requested outbox event，而且对应 handler 不会重新投递 BullMQ。它适合观测，但不能消除“数据库提交成功、Redis enqueue 失败”的双写窗口。

审计导出必须使用真正的事务型 Outbox。

### 9.2 原子创建

```text
BEGIN
  INSERT OperatorAuditExport(status=QUEUED)
  INSERT BackgroundJob(status=QUEUED, resourceType=OPERATOR_AUDIT_EXPORT)
  INSERT OutboxEvent(status=PENDING)
  INSERT OperatorAuditLog(action=AUDIT_EXPORT_REQUEST, status=SUCCEEDED)
COMMIT
```

任何一步失败都回滚，不返回一个无法追踪或无法审计的导出任务。

`OperatorAuditExport` 与 `BackgroundJob` 互相保存关联 id。Service 在进入事务前使用 `randomUUID()` 生成 `exportId` 和 `backgroundJobId`，再显式写入两张表，避免依赖数据库 insert 后才返回的默认 id 造成循环创建顺序。`BackgroundJob.resourceId = exportId`，`OperatorAuditExport.backgroundJobId = backgroundJobId`。

创建事务先取得共享的 PostgreSQL transaction advisory lock `prepmind:operator-audit-retention`，再使用数据库时间计算 retention cutoff 与 `snapshotAt`。客户端不能传入 snapshot 时间。申请审计使用 `targetType = 'OperatorAuditExport'` 和 `targetId = exportId`。

维护任务删除每一批审计记录前也取得同一个 transaction advisory lock，并在锁内重新计算活跃水位。这样维护任务不能在“导出已通过时间校验但尚未提交、因此还不可见”的窗口抢先删除数据；导出提交后，后续清理批次一定能看到它。

当前 `OutboxService.enqueue()` 和 `OperatorAuditService.recordSuccess()` 都直接使用 `PrismaService`，且审计方法会吞掉写入错误。实现阶段需要增加明确的 transaction-aware 写入能力：

- 普通 Outbox 调用仍可使用现有 `enqueue()`。
- 导出申请使用传入 Prisma transaction client 的严格写入方法。
- 现有 Outbox requeue 继续保持 best-effort audit，不被本阶段意外改成 fail-closed。

### 9.3 Outbox event

```text
type: operator.audit.export.requested
aggregateType: OperatorAuditExport
aggregateId: <exportId>
idempotencyKey: operator-audit-export-requested:<exportId>
payload:
  exportId
  backgroundJobId
```

payload 只包含安全 id，不包含筛选结果、审计正文、MinIO object key 或敏感 metadata。

### 9.4 Dispatcher handler

handler 流程：

1. 校验 payload schema。
2. 查询 `OperatorAuditExport` 与 `BackgroundJob`。
3. 确认 export/job 仍允许投递。
4. 使用 `jobId = backgroundJobId` 调用 BullMQ `queue.add()`。
5. Queue 中已有相同 jobId 时按幂等成功处理。
6. 成功后由 Dispatcher 把 OutboxEvent 标记为 `SUCCEEDED`。
7. Redis 失败时复用现有 retry / dead-letter 状态机。

幂等状态规则：

- export/job 都是 `QUEUED`：正常执行 `queue.add()`。
- BullMQ 中已存在相同 jobId：视为已投递成功。
- export 已是 `PROCESSING/READY` 且 job 已是 `ACTIVE/SUCCEEDED`：视为已投递成功。
- export 已是 `FAILED/EXPIRED`：按 stale no-op 成功，不重新唤醒终态任务。
- export、BackgroundJob 缺失或关联 id 不匹配：视为无效持久化事实，进入脱敏 retry/dead-letter，而不是猜测修复。

API 请求不再直接调用 `queue.add()`。PostgreSQL 是请求成功后的可靠事实，Outbox Dispatcher 是进入 BullMQ 的唯一桥接入口。

BullMQ 拓扑固定为：

```text
queue: operator-audit-export
job:   generate-operator-audit-export
payload:
  exportId
  backgroundJobId
attempts: 3
backoff: exponential, 5000ms
removeOnComplete: age 48h, count 1000
removeOnFail: age 7d, count 3000

queue: operator-audit-maintenance
job:   maintain-operator-audit
schedule: hourly, deterministic scheduler id
concurrency: 1
```

Export queue 的完成记录保留时间必须明显长于 Outbox lock/retry 窗口。这样 `queue.add()` 成功但 Outbox 标记成功前进程崩溃时，Dispatcher 重放仍能看到相同 jobId；即使领域状态已经进入 `PROCESSING/READY`，handler 也按已投递成功处理，绝不重新执行终态 export。

processor 只在 `SERVER_ROLE=worker|both` 注册。Worker heartbeat/readiness 需要扩展为声明 knowledge、audit-export 和 audit-maintenance 三项能力，并读取两个新队列的 paused/backlog/failed 状态。

## 10. Worker 生成流程

### 10.1 claim 与重试

Worker 使用 compare-and-swap：

```text
OperatorAuditExport QUEUED -> PROCESSING(token, leaseExpiresAt)
BackgroundJob QUEUED/ACTIVE -> ACTIVE
```

Export 与 BackgroundJob 的 claim、retry 和终态更新都放在同一数据库事务中，避免一张表已经进入 `PROCESSING`、另一张表仍停在 `QUEUED`。如果任一事实不再匹配，任务按 stale 处理，不生成文件。

每次 BullMQ attempt 生成新的 `processingToken`。允许 claim：

- export 为 `QUEUED`；或
- export 为 `PROCESSING`，但 `leaseExpiresAt <= databaseNow`，表示上一个 Worker 硬崩溃或失去 BullMQ lock。

成功、重试和失败更新都必须匹配当前 token。数据库 lease 默认 5 分钟，短于 BullMQ 10 分钟 `lockDuration`，正常 Worker 每隔 lease 的三分之一续租。硬崩溃时数据库 lease 会先过期，BullMQ 在 lock 失效后重新派发 stalled attempt 时能够立即 reclaim。

正常 Worker 每隔 lease 的三分之一使用当前 token 续租，并在开始上传 MinIO、更新 READY 之前再次确认 token 仍归自己。续租或 token 检查失败时立即中止当前 attempt、清理临时文件且不写终态，避免失去执行权的旧 Worker 覆盖新 attempt 的结果。

如果异常情况下新 attempt 到达时旧 lease 仍有效，它不能完成、失败或标记 stale；processor 使用 BullMQ 的 delayed-job primitive 把 job 延迟到 lease 到期后，并以 `DelayedError` 结束当前调用，不消耗业务 attempts。implementation plan 必须先用当前锁定的 BullMQ 5 版本验证该 API 行为并补子进程测试。

状态对应关系：

| 场景 | OperatorAuditExport | BackgroundJob |
| --- | --- | --- |
| claim | `PROCESSING` | `ACTIVE` |
| retryable failure | `QUEUED`，清 token/lease | `QUEUED` |
| success | `READY`，清 token/lease | `SUCCEEDED` |
| final failure | `FAILED`，清 token/lease | `FAILED` |
| 关联事实已终止或被替换 | `FAILED / STALE_EXPORT_STATE` | `STALE_SKIPPED` |
| READY 后文件确认丢失 | `FAILED / EXPORT_FILE_MISSING` | 保持 `SUCCEEDED`，因为生成任务曾成功 |

重试错误：

- PostgreSQL 临时错误。
- MinIO / 网络临时错误。
- 临时文件系统错误。

非重试错误：

- 匹配记录超过 50,000 条。
- payload 或 export 状态非法。
- schema 不兼容。

### 10.2 查询边界

Worker 查询条件固定为：

```text
startAt <= createdAt <= min(endAt, snapshotAt)
```

再叠加 action、status、targetType、targetId、actorUserId 筛选。

Worker 在 PostgreSQL `REPEATABLE READ` 只读事务中取得一致 snapshot，并按 `createdAt ASC, id ASC` 分页。导出并发固定为 1，事务设置明确的 statement/transaction timeout；超时按可重试失败处理。这样分页过程中晚提交的记录不会让前后页漂移，retention 删除也不会改变该事务已经看到的 MVCC snapshot。

只 select 当前脱敏列表 DTO 对应字段：

```text
id
actorUserId
action
status
targetType
targetId
reason
requestId
ipAddressHash
userAgentHash
errorCode
errorPreview
createdAt
```

禁止读取 `metadata`。

### 10.3 临时文件与 ZIP

实现使用成熟 CSV 与 ZIP 库，不手写协议解析器。

流程：

1. 在 `os.tmpdir()` 创建权限为 `0700` 的 export id 专属临时目录，文件权限为 `0600`。
2. 分页把 CSV 写入临时文件，并同步计算 CSV SHA-256。
3. 写入 `manifest.json`。
4. 生成 ZIP，同时计算 archive SHA-256。
5. 上传到包含 processing token 的 attempt-fenced key。
6. 数据库 CAS 更新 export/job 为成功。
7. `finally` 删除本地临时目录。

即使预统计没有超过 50,000 条，分页写入时仍要再次检查累计记录数。这样可以防止统计完成后出现并发新增记录导致实际文件突破上限。

本阶段不把证据包描述成法律级数据库快照。`snapshotAt`、REPEATABLE READ、稳定游标和 retention advisory lock 用于提供工程上可解释的一致观察边界；manifest 记录实际 `queryStartedAt`、`queryFinishedAt`、`effectiveEndAt` 和最终 `recordCount`，让接收者知道证据包对应的观察窗口。

attempt-fenced object key：

```text
operator-audit-exports/<exportId>/attempts/<processingToken>.zip
```

每个 Worker attempt 只写自己的 key。上传后，当前 processing token 通过数据库 CAS 把该 key 选为 export 的 `objectKey`；失去 lease 的旧 Worker 即使稍后恢复，也只能写自己的旧 key，不能覆盖 READY export 已选择的对象。

成功上传后，export `READY + objectKey` 与 BackgroundJob `SUCCEEDED` 必须在同一事务内按 processing token 更新；事务失败或 token 已失效时，当前 attempt best-effort 删除自己的 attempt key 并退出。维护任务按 export prefix 列举并删除未被 READY 记录选中的孤儿 attempt object。

## 11. 证据包格式与安全

```text
operator-audit-export.zip
├── records.csv
└── manifest.json
```

### 11.1 records.csv

- UTF-8 BOM。
- 固定列顺序：`id,actorUserId,action,status,targetType,targetId,reason,requestId,ipAddressHash,userAgentHash,errorCode,errorPreview,createdAt`。
- null 编码为空单元格；布尔/数字不得本地化；时间统一为 UTC ISO 8601。
- 标准 CSV 引号、逗号、换行转义。
- 空结果仍生成表头和 `recordCount = 0` 的有效证据包。
- 单元格去除不允许的控制字符。
- CSV SHA-256 覆盖最终落盘字节，包括 UTF-8 BOM 和结尾换行。
- 文本先经过现有 secret/token/cookie sanitizer，再处理控制字符；如果首个非空白字符是 `=`、`+`、`-`、`@`，或字段以 tab/CR 等公式触发控制符开头，则在原值前增加单引号安全前缀，最后交给 CSV 库引用。测试必须覆盖前导空格、tab、CR 和 Unicode 空白绕过样本。

字段 allowlist 不代表自由文本天然匿名。`reason`、`targetId` 和 `errorPreview` 只允许既有截断、脱敏后的诊断摘要；证据包仍标记为敏感 operator 数据。来源 fingerprint 只用于关联，不宣传为不可逆匿名标识。

### 11.2 manifest.json

schema v1 固定字段：

```json
{
  "schemaVersion": 1,
  "exportId": "...",
  "generatedAt": "...",
  "queryStartedAt": "...",
  "queryFinishedAt": "...",
  "effectiveEndAt": "...",
  "requestedByUserId": "...",
  "reason": "...",
  "snapshotAt": "...",
  "range": { "startAt": "...", "endAt": "..." },
  "filters": {
    "action": null,
    "status": null,
    "targetType": null,
    "targetId": null,
    "actorUserId": null
  },
  "recordCount": 0,
  "recordsFile": "records.csv",
  "recordsSha256": "sha256:..."
}
```

v1 字段均必须存在；无筛选值使用 JSON `null`，不得省略。`requestedByUserId` 在申请人已删除时允许为 JSON `null`。后续新增可选字段需要递增 `schemaVersion`，不能悄悄改变 CSV header、null 编码或 hash 范围。

ZIP 自身的 SHA-256 不能循环写入 ZIP 内部，因此保存在 `OperatorAuditExport.archiveSha256`、详情 DTO 和下载响应头中。

SHA-256 只能帮助接收者发现文件是否变化，不等于数字签名、可信时间戳或法律意义上的不可否认性。

## 12. StorageService 边界

复用现有 MinIO 配置和 bucket，但不放宽普通图片或知识库文件读取规则。只增加三个严格的 export 专用方法：

```text
writeOperatorAuditExport(exportId, file)
readOperatorAuditExport(objectKey)
deleteOperatorAuditExport(objectKey)
listOperatorAuditExportObjects(exportId)
```

这些方法只接受：

```text
operator-audit-exports/<safe-export-id>/attempts/<safe-processing-token>.zip
```

普通 `/uploads/images/*`、知识库读取接口和公开 URL 生成逻辑不能读取该前缀。

应用清理之外，MinIO 部署必须为 `operator-audit-exports/` 前缀配置对象 lifecycle 兜底，最迟在对象创建 48 小时后物理过期。若 production bucket 开启 versioning，规则还必须清理 noncurrent versions 和 delete markers；不能把写入 delete marker 当作敏感内容已经物理删除。

Worker/maintenance 启动时执行 crash janitor：只扫描固定的 `prepmind-audit-export-*` 临时目录，解析其中的 export id / processing token，并确认数据库 lease 已失效且 BullMQ job 不再 active 后才删除；不能只凭目录年龄删除。容器部署优先为该目录使用有容量上限的临时卷，避免硬崩溃留下明文 CSV/ZIP 长期占用宿主机磁盘。

## 13. fail-closed audit

现有 Outbox requeue 的审计继续 best-effort：审计失败不能改变原 requeue 结果。

证据包申请和下载采取更严格规则，因为它们会创建或释放可离线传播的审计数据：

- 申请审计在创建事务内强制写入；失败则整个事务回滚。
- 下载在成功打开 MinIO 对象后、返回响应前强制写入。
- 下载审计写入失败则关闭对象流并返回安全 503。
- 下载前置条件失败可 best-effort 记录 `FAILED`，但不能把未授权请求写成成功访问。

这是一条有意的差异化规则，不能把通用 `recordSuccess()` 静默吞错行为直接复用到导出下载。

## 14. 保留与维护任务

### 14.1 调度

使用 BullMQ repeatable maintenance job，每小时运行一次。它是系统任务，没有 ADMIN actor，因此第一版不写账号级 `BackgroundJob`，也不写 `OperatorAuditLog`。

BullMQ 保留安全的完成/失败状态，服务端只记录脱敏日志。后续接入 Prometheus 时增加：

- 到期对象删除数。
- 审计日志删除数。
- 清理持续时间。
- 清理失败次数。
- 最近成功时间。

### 14.2 ZIP 过期

查询：

```text
status = READY AND expiresAt <= now
```

维护任务同时扫描 `FAILED/EXPIRED` 和 lease 已确认失效的 export，按严格 export prefix 列举并清理可能由“上传成功、数据库更新前崩溃”留下的 attempt objects；不能只扫描 READY。

每条执行：

1. 删除数据库选中的 objectKey，并列举 export prefix 清理其它 orphan attempt objects；对象已经不存在按幂等成功。
2. CAS `READY -> EXPIRED`。
3. 清空 `objectKey`，设置 `expiredAt`。
4. 保留文件名、记录数和 hash，供 180 天内复盘。

下载接口始终先检查 `expiresAt`，因此即使清理任务暂时失败，也不能继续下载已过期文件。

### 14.3 活跃导出水位

如果维护任务直接按 `now - 180 days` 删除，刚在保留边界前申请的导出可能在 Worker 读取期间丢数据。

维护任务在共享 transaction advisory lock 内查询 `QUEUED/PROCESSING` 导出的最早 `startAt`：

```text
baseCutoff = now - retentionDays
effectiveCutoff = min(baseCutoff, oldestActiveExport.startAt)
```

只删除：

```text
OperatorAuditLog.createdAt < effectiveCutoff
```

这样最多暂时多保留一小段数据；活跃导出进入终态后，下次维护会自动追上正常水位。

每个删除批次都在新的短事务中重新取得 advisory lock、重新计算数据库当前时间和活跃水位，再删除该批 id。导出申请使用同一把锁，因此不存在“维护已读完活跃列表、未提交导出随后才出现”的不可见窗口。

### 14.4 分批删除

- 每批默认 1,000 条。
- 先按 `createdAt ASC, id ASC` 读取 id，再 `deleteMany({ id: { in: ids } })`。
- 每次运行设置最大批次数，避免长期占用连接。
- 事务只覆盖单批，不使用一个横跨全部历史的大事务。
- 终态 `OperatorAuditExport` 元数据按同一 180 天策略清理。
- 删除 export 元数据前必须先确认 export prefix 下没有任何对象；MinIO 删除或列举失败时保留数据库记录，避免制造无法追踪的孤儿对象。
- 长时间卡在 `QUEUED/PROCESSING` 的 export 先标记为 `FAILED`，再进入正常保留周期。

“卡死”不能只按年龄判断：

- `QUEUED` 只有在关联 Outbox 已 `DEAD`，或持久化关联事实缺失时，才能由维护任务标记失败。
- `PROCESSING` 必须同时检查 BackgroundJob 和 BullMQ job 状态；仍是 active 的任务不能被维护任务抢先终止。
- stale 修复默认阈值为 1 小时，必须长于 Outbox retry/lock timeout、10 分钟 BullMQ lock、5 分钟 processing lease 和 2 分钟一致性查询 timeout；实现时不能把这些相对大小拆成互相矛盾的默认值。

这样既能解除真正卡死任务对 retention 水位的长期阻塞，也不会在 Redis 短暂故障或 Worker 正常执行时误杀任务。

Outbox `DEAD` 之后保留 24 小时人工恢复窗口。在窗口内，Outbox Ops requeue 可以继续投递原 export；维护任务不能把它提前改成 FAILED。窗口结束仍未恢复时，维护任务以同一事务写入 `OperatorAuditExport=FAILED / DELIVERY_ABANDONED` 和 `BackgroundJob=FAILED`。此后 requeue 只会被 handler 作为终态 stale no-op；管理员需要使用新的 `clientRequestId` 创建一份新导出，不能复活旧任务。

## 15. 错误与恢复矩阵

| 场景 | 处理 |
| --- | --- |
| Redis 不可用 | Outbox 保持 `PENDING` 并重试 |
| Outbox 重试耗尽 | `DEAD`，24 小时内可通过 Outbox Ops 修复；超窗后任务终止并需重新申请 |
| 重复 dispatch | 相同 BullMQ jobId，按幂等成功 |
| Worker 临时失败 | export/job 回到 `QUEUED`，BullMQ 重试 |
| 超过 50,000 条 | `FAILED / EXPORT_TOO_LARGE`，不重试 |
| 查询 0 条 | 正常生成只有表头的证据包 |
| ZIP 上传后 DB 更新失败 | 删除当前 attempt key；残留对象由 prefix cleanup / lifecycle 兜底 |
| 本地临时目录清理失败 | 脱敏 warning，不打印文件内容 |
| READY 文件已过期 | `410 Gone`，不延长 TTL |
| READY 但对象丢失 | 失败下载审计，安全错误，export CAS 为 `FAILED` |
| 申请 audit 写失败 | 事务回滚，返回安全 503 |
| 下载 audit 写失败 | 不返回文件，关闭流，返回安全 503 |
| MinIO 删除时对象不存在 | 按幂等成功并标记 `EXPIRED` |

错误预览继续复用 `sanitizeJobError()` 并限制长度，不保存连接串、key、token、cookie 或原始依赖错误。

## 16. Admin Console

现有 `/audit` 增加：

```text
审计记录 | 证据包
```

### 16.1 申请表单

- 默认继承当前审计列表的 action/status/target/actor 筛选。
- 起止时间必须重新确认。
- reason 必填。
- 页面明确显示 31 天和 50,000 条边界。
- 提交期间禁用重复提交。
- 成功后切换到证据包详情并显示 `QUEUED`，不声称文件已经生成。

### 16.2 任务列表与详情

- 列表按 `createdAt DESC, id DESC` cursor 分页。
- `QUEUED/PROCESSING` 才轮询，进入终态立即停止。
- 详情展示筛选条件、reason、BackgroundJob id、记录数、hash、完成和过期时间。
- `READY` 显示下载命令和复制 hash 按钮。
- `FAILED` 显示脱敏错误与收窄范围建议。
- `EXPIRED` 说明对象已删除，不提供延期、恢复或直接重新生成。
- 不显示 object key、payload、metadata 或原始错误。

Admin API client 需要单独的 authenticated blob 下载方法：成功响应读取 ZIP `Blob`，错误响应才按现有 JSON error envelope 解析。不能把二进制响应塞进当前只接受 JSON 的通用 `apiClient.request<T>()`。

### 16.3 可访问性

- 使用 `tablist / tab / tabpanel` 语义。
- 表单控件保留 label 和错误关联。
- 状态不能只靠颜色表达。
- 下载和复制按钮使用图标、可访问名称和 tooltip。
- 列表、详情和弹层尺寸稳定，避免状态变化引起布局跳动。

## 17. 测试计划

### 17.1 Contract

- request 时间范围、reason、筛选字段和严格对象测试。
- export 状态、列表、详情和 cursor 测试。
- DTO 明确拒绝 `objectKey`、metadata 和 payload。

### 17.2 Service / transaction

- Export、BackgroundJob、OutboxEvent、OperatorAuditLog 同事务创建。
- 任一写入失败时全部回滚。
- `clientRequestId + requestHash` 重放返回同一 export；相同 id 的不同请求返回 409。
- 每 ADMIN / 全局活跃任务配额。
- 用户删除后 SYSTEM BackgroundJob 与 export 元数据仍存在，账号级 BackgroundJob API 不泄露系统任务。
- ACCOUNT BackgroundJob 仍随用户 Cascade 删除，不产生 orphan account jobs。
- 导出申请不直接调用 BullMQ。
- 现有 Outbox requeue audit 仍是 best-effort。

### 17.3 Dispatcher

- payload schema 校验。
- queue.add 使用 BackgroundJob id。
- 重复 handler 调用不生成重复 job。
- enqueue 后、Outbox 标成功前崩溃的重放不会重新执行 ACTIVE/READY export。
- BullMQ 完成记录保留策略长于 Outbox retry/lock 窗口。
- Redis 失败进入 Outbox retry/dead-letter。

### 17.4 Worker

- 零记录证据包。
- 50,000 上限与超限失败。
- 稳定分页和 snapshotAt 上界。
- 中文、引号、逗号、换行。
- `= + - @` CSV formula injection 样本。
- manifest 字段与 CSV SHA-256。
- archive SHA-256。
- processing-token fenced object key、zombie Worker 覆盖防护和上传后 DB 失败补偿。
- Worker 硬崩溃后 lease 到期可由 stalled attempt 重新 claim；旧 token 不能写终态。
- lease 尚有效的新 attempt 使用 delayed primitive，不消耗业务 attempts 或误标 stale。
- 旧 token 的 zombie Worker 只能写自己的 attempt key，不能覆盖 READY export 选中的 ZIP。
- Export 与 BackgroundJob 的 claim/retry/success/failure 同事务。
- 64 MiB archive 和临时磁盘预算。
- 临时目录 finally 清理。

### 17.5 Maintenance

- 24 小时过期。
- 对象不存在幂等。
- 180 天 cutoff。
- 活跃 export 水位保护。
- export request 与 retention batch 共享 advisory lock 的并发交错测试。
- 1,000 条分批和最大批次。
- 卡死 export 修复。
- FAILED/EXPIRED 孤儿对象、crash 临时目录和 MinIO lifecycle 配置。
- maintenance state 与 readiness 过期信号。
- Outbox DEAD 的 24 小时恢复窗口和超窗终止语义。

### 17.6 Download / security

- feature gate、401、403、404。
- READY、过期、FAILED 和文件丢失。
- 其他 ADMIN 可以下载并记录真实下载者，STUDENT 始终返回 403。
- 下载 audit fail-closed。
- `StreamableFile` 不被 response envelope 包装。
- `Cache-Control: no-store` 和 hash header。
- 解压真实测试 ZIP，确认不存在所有禁止字段和测试密钥。
- HMAC fingerprint 与 legacy SHA-256 前缀边界。

### 17.7 Admin

- 筛选条件继承。
- reason 必填和 31 天限制。
- 活跃状态轮询、终态停止。
- READY/FAILED/EXPIRED 的按钮边界。
- 页面不存在原始 payload/objectKey 文案或危险操作入口。

## 18. 验收

定向自动化：

```powershell
bun test packages/types/tests/operator-audit-export.test.mts
bun --cwd packages/types typecheck
bun --filter @repo/server test -- operator-audit-export outbox background-jobs worker-readiness --runInBand
bun --cwd apps/server eslint src/operator-audit src/outbox src/background-jobs src/worker-readiness src/uploads
bun --filter @repo/server build
bun --filter @repo/admin test
bun --filter @repo/admin lint
bun --filter @repo/admin build
git diff --check
```

Docker 全栈：

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

浏览器/API 路线：

```text
ADMIN 登录 /audit
  -> 申请 31 天内证据包
  -> 看到 QUEUED / PROCESSING
  -> Worker 完成后看到 READY
  -> 下载并校验 ZIP/CSV/manifest/hash
  -> /audit 中看到 REQUEST 与 DOWNLOAD 审计
  -> 普通用户请求返回 403
  -> 构造过期 export，下载返回 410
  -> 维护任务删除对象并标记 EXPIRED
```

验收结束后清理临时 export、BackgroundJob、OutboxEvent、OperatorAuditLog 和 MinIO 对象，并确认 Worker Readiness 恢复预期状态。

按仓库流程，功能分支验收通过后合并 `main`，再在 `main` 上重复相关自动化和 Docker 核心链路验收。

## 19. 实施拆分与提交

每项任务单独提交，并同步更新实施计划或阶段文档：

1. Phase 7.23.1：设计文档。
2. Phase 7.23.2：Contract + Prisma schema / migration。
3. Phase 7.23.3：事务型 Outbox + BullMQ 投递 handler。
4. Phase 7.23.4：ZIP 生成 Worker + MinIO 临时存储。
5. Phase 7.23.5：24 小时过期与 180 天维护任务。
6. Phase 7.23.6：列表、详情、下载 API + fail-closed audit。
7. Phase 7.23.7：Admin Console 审计/证据包标签页。
8. Phase 7.23.8：Docker 全栈验收、文档收口与面试博客。

设计批准后先编写独立 implementation plan，不在设计提交里提前落实现代码。

## 20. 文档与面试博客

实现完成后新增：

```text
docs/blogs/operator-audit-retention-export.md
```

重点讲清：

- 为什么 BackgroundJob 不能解决数据库到 Redis 的双写窗口。
- 为什么必须让 Outbox handler 真正负责 BullMQ 投递。
- 为什么审计导出采用 fail-closed，而 requeue audit 仍是 best-effort。
- 如何用活跃导出水位避免 retention 与 export 竞态。
- 为什么 CSV 也有 formula injection 风险。
- 为什么 SHA-256 完整性不等于数字签名。
- 为什么临时证据包必须有独立 TTL。

## 21. 回顾时可以问

- “为什么审计导出需要 OperatorAuditExport、BackgroundJob 和 Outbox 三份事实？”
- “当前知识库 requested outbox 为什么不能防止 BullMQ enqueue 丢失？”
- “事务型 Outbox 如何消除 PostgreSQL 与 Redis 的双写窗口？”
- “为什么证据包下载要 fail-closed，但 Outbox requeue audit 仍然 best-effort？”
- “清理任务如何避免删掉正在导出的 180 天边界数据？”
- “CSV formula injection 是什么，为什么审计 CSV 也需要防护？”
- “ZIP SHA-256 能证明什么，不能证明什么？”
- “为什么下载不直接暴露 MinIO 预签名 URL？”
