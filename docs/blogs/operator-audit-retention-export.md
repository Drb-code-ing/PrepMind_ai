# 从审计日志到可下载证据包：事务型 Outbox、租约 fencing 与保留水位

## 这篇文章解决什么问题

后台有了 `OperatorAuditLog`，不代表事故发生时就能安全地把一段记录交给排障人员。真正的证据包
还要回答：按哪个时间范围取数、如何保证一次导出内部一致、请求提交后进程崩溃会不会丢任务、
两个 Worker 会不会互相覆盖、下载是否经过权限与审计、文件何时失效、原始审计何时删除。

PrepMind 的第一版方案是：ADMIN 申请最长 31 天、最多 50,000 条脱敏记录；后台异步生成只含
`records.csv` 和 `manifest.json` 的 ZIP；READY 后可下载 24 小时；审计日志默认保留 180 天。

## 为什么不能直接导出数据库

一条 `SELECT ...` 加“下载 CSV”会遗漏四类边界：

- 长查询期间数据继续变化，count 和分页可能不属于同一观察时点。
- HTTP 请求与 Redis enqueue 是双写，任一侧失败都会留下不可恢复的半成功。
- CSV 会触发公式注入，内部 metadata、来源或错误正文也可能被顺手带出。
- 大文件占用请求进程，失败后没有可恢复的领域状态，也没有过期和物理清理闭环。

因此请求路径只创建可靠事实，真正的归档由受限 Worker 异步执行。

## 三份事实为什么缺一不可

这里的三份核心事实是：

| 事实                          | 回答的问题                                       |
| ----------------------------- | ------------------------------------------------ |
| `OperatorAuditExport`         | 导出什么、当前状态、归档摘要、何时失效           |
| `BackgroundJob(scope=SYSTEM)` | 后台执行状态、attempt、错误码和运维可观测性      |
| `OutboxEvent`                 | PostgreSQL 已承诺但尚未跨到 Redis 的可靠投递意图 |

Export 不是队列 job：Redis 丢数据后，领域事实仍需存在。BackgroundJob 也不是 Export：它不应承载
筛选范围、归档 hash 等业务语义。Outbox 更不是领域模型：消费成功后仍需要 Export 支持查询、下载
和维护。三者使用稳定 id 关联，并在状态迁移时校验组合不变量。

## 事务型 Outbox 如何消除 PostgreSQL 与 Redis 双写窗口

申请的 202 成功边界是一个 Serializable PostgreSQL 事务：

```ts
await prisma.$transaction(
  async (tx) => {
    await lockRetentionAndQuota(tx);
    await tx.operatorAuditExport.create({ data: exportFact });
    await tx.backgroundJob.create({ data: systemJob });
    await tx.outboxEvent.create({ data: safeDeliveryIntent });
    await audit.recordSuccessStrict(requestAudit, tx);
  },
  { isolationLevel: 'Serializable' },
);
```

API 不调用 `queue.add()`。Worker 内的 Dispatcher claim Outbox 后，显式 handler 复核 Export 与 SYSTEM
job，再用确定性 job id 投递：

```ts
if (exportStatus === 'QUEUED' && jobStatus === 'QUEUED') {
  await exportQueue.add('generate', safePayload, { jobId: backgroundJobId });
}
```

Redis 暂时不可用只会让 Outbox retry/dead-letter；PostgreSQL 承诺没有丢。Serializable 冲突则做
有上限的 whole-transaction retry，每次重新取数据库时钟和 advisory lock，不在事务外制造副作用。

## Worker 如何用 lease、processing token 和 delayed retry 防止僵尸覆盖

BullMQ lock 只能约束 Redis delivery，不能撤销已经在 PostgreSQL、磁盘或 MinIO 上运行的旧进程。
Worker claim 时把随机 `processingToken` 同时写入 Export 和 SYSTEM job，并定期续租。所有终态更新都
带 token CAS：

```ts
const updated = await tx.operatorAuditExport.updateMany({
  where: { id, status: 'PROCESSING', processingToken: token },
  data: { status: 'READY', objectKey, processingToken: null },
});
if (updated.count !== 1) throw new LostLeaseError();
```

对象 key 也带 attempt token：`.../<exportId>/attempts/<token>.zip`。旧 Worker 最多上传一个未被选中
的 attempt，不能覆盖数据库已选择的对象。遇到 live lease 或数据库结果不确定时，job 使用
`moveToDelayed + DelayedError` 延迟，不把等待误算成业务失败 attempt；orphan 由维护任务回收。

## REPEATABLE READ、稳定游标与 manifest 能证明什么

Worker 在只读 REPEATABLE READ 事务中先 count，再按 `(createdAt,id)` 稳定游标分批读取。manifest
记录 export id、筛选范围、`snapshotAt`、记录数和 CSV SHA-256，因此接收方能验证 ZIP 内 CSV 未被
意外改变，也能知道这份文件由哪次工程流程产生。

但它不能证明法律意义上的数据库快照：数据库在 snapshot 前后的事实、运行环境可信度、密钥托管、
时间戳权威、保全链和签署身份都不在本方案证明范围内。证据包是工程上一致的观察结果。

SHA-256 同样只用于完整性检查，不是数字签名，也不提供身份认证或不可抵赖。

## CSV 公式注入和敏感字段泄漏怎么防

CSV 单元格以 `= + - @` 或控制字符开头时，Excel 可能把它当公式。检测必须发生在清控制字符前，
否则攻击者可以用前导控制字符绕过：

```ts
function formulaSafe(value: string) {
  const dangerous = /^[\u0000-\u001f\u007f]*[=+\-@]/u.test(value);
  const cleaned = sanitizeSecrets(value).replace(/[\u0000-\u001f\u007f]/gu, ' ');
  return dangerous ? `'${cleaned}` : cleaned;
}
```

查询只 select 固定 13 列，不读 metadata；safe DTO、CSV mapper 和日志都排除 payload、objectKey、
prompt、RAG chunk、模型回答、token、cookie、原始 IP/User-Agent。来源只保存 secret 驱动的 HMAC
指纹。指纹可用于关联同一来源，所以它仍是关联数据，不是匿名数据。

## 24 小时下载、48 小时 lifecycle 与 180 天保留如何配合

三个时间不是重复配置：

- READY 后 24 小时是产品逻辑边界；数据库时钟判定过期后立即 410。
- 小时维护负责正常物理删除对象、orphan、stale job 和过期明文目录。
- MinIO 2 天 lifecycle 是维护异常时的 48 小时兜底，不承担 24 小时语义。
- 180 天是原始 OperatorAuditLog 的默认保留周期。

维护删除审计前计算活跃导出水位：

```sql
delete_before = least(
  database_now - interval '180 days',
  oldest_active_export.start_at
)
```

每个删除批次重新取得 retention advisory lock、数据库时钟和水位。这样新申请提交点之前需要的
记录不会被维护踩掉；代价只是故障时可能暂时多保留，而不是提前删除。

## 为什么申请和下载 fail-closed，但 Outbox requeue 仍 best-effort

申请审计与 Export/Job/Outbox 同事务：审计写失败，申请整体回滚。下载先打开 MinIO 流并核对
DB size/stat size，再 strict 写 `AUDIT_EXPORT_DOWNLOAD`，成功后才把流交给框架；审计失败就销毁流。
这是因为两个动作本身就在创建或释放证据，无法审计时宁可拒绝。

Outbox requeue 是恢复控制面。若审计存储短暂故障就禁止恢复，可能扩大事故，所以它保留
best-effort audit，并输出脱敏 warning。两者不是不一致，而是风险模型不同。下载审计只表示服务端
已授权并准备流，不保证浏览器最终把全部字节持久化成功。

## 一次真实故障怎样恢复

假设 Redis 中断：申请事务仍提交 Export、SYSTEM job、Outbox 和 request audit；Dispatcher 将事件
重试，最终可能进入 DEAD。管理员修复 Redis 后，在 24 小时恢复窗口内通过受审计的 Outbox Ops
requeue。Dispatcher 复核 linked facts，重新用确定性 id 投递。若旧 Worker 仍存活，token CAS 和
attempt-fenced key 会阻止它覆盖新结果。READY 超时后，维护删除对象并把状态推进为 EXPIRED。

真实 Docker 验收还发现了四个“单测看不见”的部署问题：API 容器默认 `both` 会重复注册 processor；
Compose 把 `minio-init` shell 参数拆错；worker UID/GID 与 `0700` tmpfs 不一致；smoke 遗漏 BullMQ
`prepmind` prefix。这正是全栈验收存在的价值。

## 面试时怎么讲

可以用 60 秒版本：

> 我把管理员审计导出做成了一个有领域事实、可靠投递和保留策略的异步系统。请求在 Serializable
> 事务内原子写 Export、SYSTEM BackgroundJob、Outbox 和 strict audit，Dispatcher 是唯一
> PostgreSQL 到 Redis 的桥。Worker 用 BullMQ 全局单并发、数据库 lease/processing token CAS 和
> attempt-fenced MinIO key 防僵尸覆盖，在 REPEATABLE READ 快照内生成 formula-safe CSV 与 manifest。
> 下载是 ADMIN-only、POST/no-store、服务端流式返回并在出字节前 fail-closed 审计；24 小时逻辑过期、
> 小时维护和 48 小时 lifecycle 分层清理，180 天删除用活跃导出水位保护。

## 常见追问

**为什么不用 presigned URL？** 因为浏览器直连对象存储会绕过每次下载的服务端授权、size 复核和
strict audit，本阶段选择服务端流式返回。

**为什么既要 BullMQ lock 又要数据库 lease？** 前者保护 Redis job ownership，后者 fencing 外部副作用；
旧进程即使还在跑，也不能通过 token CAS 选择对象。

**manifest 能防篡改吗？** 它能配合 SHA-256发现字节变化，但攻击者若能同时替换 CSV 和 manifest，
没有签名就无法证明发布者身份。

**为什么 SYSTEM job 不挂 requester？** 请求人可能被删除，而系统级导出仍需完成、过期和被审计；
因此 SYSTEM job 要求 `userId=null`，账号级 job 才随用户级联删除。

## 还可以继续优化什么

- 使用 KMS/HSM 管理签名密钥，对 manifest 做数字签名和可信时间戳。
- 对象存储启用并验证 versioning、Object Lock/WORM 与 legal hold 流程。
- 把生产 gate 开启流程、secret rotation、告警阈值和多副本故障演练纳入 runbook。
- 大规模导出可增加分片、流式加密、带宽限流和独立审计归档域。
- 为下载完成增加客户端确认只能改善产品观测，不能替代可信接收证明。

## 回顾时可以问

- 为什么同时需要 Export、SYSTEM BackgroundJob 和 OutboxEvent？
- 为什么申请 API 不能在 PostgreSQL commit 后直接调用 `queue.add()`？
- processing token CAS 与 attempt-fenced object key 分别防住什么？
- 为什么 REPEATABLE READ + manifest 仍不是法律级数据库快照？
- 为什么 SHA-256 不是数字签名，HMAC 指纹也不是匿名数据？
- 活跃导出水位如何避免 180 天清理踩到长时间导出？
- 为什么下载 fail-closed，而 Outbox requeue 仍是 best-effort？
- 为什么 24 小时逻辑过期不能只依赖 48 小时 MinIO lifecycle？
