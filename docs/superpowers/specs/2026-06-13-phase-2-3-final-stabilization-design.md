# Phase 2.3 Final Stabilization 设计：Dexie 离线队列与历史图片策略

> 日期：2026-06-13  
> 阶段：Phase 2.3 收尾  
> 目标：在进入 Phase 3 之前，补齐 Phase 2.3 业务 API 迁移后的本地缓存、乐观更新、离线失败恢复和历史图片策略。

## 1. 背景

Phase 2.3 已经完成 WrongQuestion、ChatMessage、OCRRecord、Uploads API 的服务端迁移。当前权威数据源已经从 Dexie 转为 PostgreSQL / MinIO：

- WrongQuestion：服务端 `/wrong-questions` 为权威来源，Dexie 作为本地缓存。
- ChatMessage：服务端 `/chat-messages` 为历史权威来源，Dexie 作为本地缓存。
- OCRRecord：服务端 `/ocr-records` 为权威来源，Dexie 作为本地缓存。
- 新 OCR 图片：通过 `/uploads/images` 上传到 MinIO，OCRRecord / WrongQuestion 优先保存服务端图片 URL。

剩余问题是：前端已经“读服务端 + 缓存 Dexie”，但还缺少统一的本地写入失败处理。用户在弱网、后端短暂不可用、刷新页面、重复点击时，仍可能遇到 UI 状态和服务端状态短时间不一致的问题。

本设计只处理 Phase 2.3 的工程化收尾，不提前实现 Phase 8 的完整离线优先 PWA，也不引入后台同步 Worker。

## 2. 目标

1. 让 WrongQuestion CRUD 具备稳定的乐观更新体验。
2. 让 OCRRecord 创建和删除在服务端失败时有清晰的本地缓存状态。
3. 增加 Dexie mutation queue，用于记录需要补偿同步的业务写操作。
4. 明确 ChatMessage 不进入通用 mutation queue，继续使用现有批量幂等 sync。
5. 明确历史 base64 图片的保留、清理和后续迁移策略。
6. 保持“服务端为权威，Dexie 为缓存和离线兜底”的 Phase 2 数据流边界。

## 3. 非目标

- 不做完整离线优先应用。
- 不引入 Service Worker Background Sync。
- 不在 Phase 2.3 做复杂冲突编辑器。
- 不自动批量上传旧 Dexie base64 图片。
- 不把 `/api/chat` 和 `/api/ocr` 迁移到 NestJS。
- 不重构 AI prompt、structured output 或 tool calling，这些留到 Phase 3。

## 4. 推荐方案

采用“服务端优先 + Dexie 乐观缓存 + mutation queue 补偿同步”的轻量工程化方案。

用户执行 CRUD 时：

```text
用户操作
  -> TanStack Query mutation
  -> 立即更新 UI / Dexie 乐观缓存
  -> 调用 NestJS API
  -> 成功：用服务端返回值覆盖本地缓存，移除队列项
  -> 失败：写入 mutationQueue，标记本地记录 syncStatus
  -> 后续网络恢复 / 登录恢复 / 页面聚焦时 flush queue
```

核心原则：

- 用户体验上先响应，不让按钮长时间无反馈。
- 数据最终以服务端返回为准。
- 本地队列只保存可重放、可幂等或可安全降级的操作。
- 失败状态必须可见，不能静默丢失用户操作。

## 5. Dexie Schema 设计

新增表：`mutationQueue`

字段建议：

```ts
type MutationEntity = 'wrongQuestion' | 'ocrRecord';
type MutationOperation = 'create' | 'update' | 'delete';
type MutationStatus = 'pending' | 'syncing' | 'failed';

type MutationQueueItem = {
  id: string;
  userId: string;
  entity: MutationEntity;
  operation: MutationOperation;
  entityId?: string;
  dedupeKey?: string;
  payload: unknown;
  status: MutationStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  nextRetryAt?: string;
};
```

建议索引：

```text
mutationQueue: '&id, userId, [userId+status], [userId+entity], dedupeKey, nextRetryAt, updatedAt'
```

现有本地业务记录补充运行态字段：

```ts
type LocalSyncStatus = 'synced' | 'pending' | 'failed';

{
  syncStatus?: LocalSyncStatus;
  syncError?: string;
  pendingOperation?: 'create' | 'update' | 'delete';
}
```

这些字段只属于前端本地状态，不提交给服务端 API。

## 6. WrongQuestion 写入策略

### 6.1 创建错题

推荐流程：

```text
用户点击保存错题
  -> 构造本地记录 localRecord，syncStatus='pending'
  -> 乐观写入 Dexie / TanStack Query cache
  -> POST /wrong-questions
  -> 成功：服务端记录替换本地记录，syncStatus='synced'
  -> 失败：保留本地记录，写入 mutationQueue(create)，syncStatus='failed'
```

重复保存处理：

- 如果服务端返回 `WRONG_QUESTION_DUPLICATED`，前端应视为“已存在”，用服务端已有记录或重新拉取列表合并缓存。
- `sourceGroupId` 继续作为同一 OCR 来源防重复的主要依据。
- UI 不应再次展示“保存中但实际失败”的模糊状态，应显示“已存在”或“待同步失败”。

### 6.2 更新错题

包括：

- 标记掌握 / 取消掌握。
- 修改备注。
- 后续可能增加标签、分类、复习状态。

推荐流程：

```text
用户更新字段
  -> 乐观更新 Query cache 和 Dexie
  -> PATCH /wrong-questions/:id
  -> 成功：服务端记录覆盖本地记录
  -> 失败：写入 mutationQueue(update)，本地记录 syncStatus='failed'
```

队列合并：

- 同一个 `wrongQuestion.id` 的连续 update 可以合并为最后一次 payload。
- 备注输入保存失败时保留用户输入，不回滚到旧值。
- 标记掌握失败时可保留当前 UI 状态，但显示轻提示“已暂存，稍后同步”。

### 6.3 删除错题

删除比更新更敏感，推荐使用“软乐观删除”：

```text
用户确认删除
  -> 本地记录标记 pendingOperation='delete'
  -> UI 从列表隐藏该记录
  -> DELETE /wrong-questions/:id
  -> 成功：删除 Dexie 记录，移除队列项
  -> 失败：写入 mutationQueue(delete)，保留隐藏状态并显示同步失败入口
```

如果 flush delete 时服务端返回 404：

- 视为删除成功。
- 清理 Dexie 本地记录和队列项。

## 7. OCRRecord 写入策略

OCRRecord 的写入来源主要是 OCR 完成后的自动保存，不适合给用户大量手动编辑入口。

### 7.1 创建 / Upsert OCRRecord

推荐流程：

```text
OCR 完成
  -> 先用本地 preview 和识别结果写 Dexie
  -> POST /ocr-records
  -> 成功：服务端记录覆盖本地记录
  -> 失败：写入 mutationQueue(create)，本地记录 syncStatus='failed'
```

约束：

- 请求服务端前继续剥离 `data:` base64 imageUrl。
- 如果图片已经上传到 MinIO，则 payload 携带服务端 imageUrl。
- 如果图片上传失败，OCRRecord 仍可创建，但 imageUrl 不传给服务端；Dexie 保留本地 preview。

### 7.2 删除 OCRRecord

```text
用户删除 OCR 历史
  -> UI 隐藏该记录
  -> DELETE /ocr-records/:id
  -> 成功：删除 Dexie 记录
  -> 失败：写入 mutationQueue(delete)，本地记录 pendingOperation='delete'
```

服务端 404 同样视为成功清理本地。

## 8. ChatMessage 策略

ChatMessage 不进入通用 mutation queue。

原因：

- 聊天是流式生成结果，不是简单 CRUD。
- 一次 AI 响应可能被用户停止、切换页面、重新生成，重放 mutation 容易制造重复消息或错乱上下文。
- 当前 `/chat-messages/sync` 已经是按会话快照幂等替换，适合继续承担聊天历史同步。

保留现有策略：

- 页面运行时继续把完整消息写入 Dexie。
- 输出完成后触发 `/chat-messages/sync`。
- 同一消息快照去重，避免重复 sync。
- sync 失败只做降级日志和后续重试入口，不进入通用 CRUD queue。

后续如果需要更强聊天可靠性，应单独设计“conversation draft / streaming session recovery”，不和 CRUD mutation queue 混在一起。

## 9. Queue Flush 策略

触发时机：

- `AuthSessionProvider` 成功恢复 session 后。
- 浏览器从 offline 变为 online。
- 页面重新 focus。
- 用户手动触发重试。
- 业务 mutation 成功后可顺手尝试 flush 同实体队列。

重试策略：

```text
retryCount = 0: 立即重试
retryCount = 1: 10 秒后
retryCount = 2: 30 秒后
retryCount = 3: 2 分钟后
retryCount >= 4: 保持 failed，等待用户手动重试或下次会话
```

flush 约束：

- 同一用户串行 flush，避免并发写同一记录。
- `syncing` 超过一定时间可重置为 `pending`，避免页面崩溃后永久卡住。
- 401 / 403 不重试，等待 session 恢复或重新登录。
- 400 / schema 错误标记 failed，并展示明确错误。
- 5xx / 网络错误按退避重试。

## 10. 冲突处理

Phase 2.3 不做复杂冲突编辑器，采用简单规则：

| 场景 | 处理 |
| --- | --- |
| create 重复 | 使用 `sourceGroupId` 合并，重复视为已存在 |
| update 404 | 本地记录标记 failed，提示服务端记录不存在 |
| delete 404 | 视为删除成功 |
| update 后又 delete | 队列合并为 delete |
| create 后未同步又 delete | 直接删除本地记录和 create 队列，不请求服务端 |
| 多端同时更新 | 服务端最后写入为准，本端下次拉取后覆盖 Dexie |

## 11. 历史 Base64 图片策略

当前不自动迁移历史 base64 图片。

原因：

- 历史 `data:` 图片可能体积很大，自动批量上传会造成启动卡顿和网络占用。
- 旧数据可能来自 Phase 1 本地模拟账号，缺少可靠服务端记录对应关系。
- 静默上传本地历史图片不利于用户理解隐私边界。

Phase 2.3 收尾策略：

- 新数据继续走 MinIO URL。
- 旧 Dexie base64 图片继续只作为当前设备本地预览兜底。
- 同步到 `/ocr-records` 和 `/wrong-questions` 前继续剥离 base64。
- 当服务端记录缺少 imageUrl 时，前端可按 `groupId` 使用本地 preview 补图。
- 文档明确：历史图片迁移留到后续显式入口，例如“迁移本机历史图片到云端”。

可选清理策略：

- 后续设置页提供“清理本机历史图片缓存”。
- 清理只删除 Dexie 中的 base64 preview，不删除服务端记录。
- 清理前给用户确认，避免误删唯一可见图片。

## 12. UI 反馈约定

CRUD 成功：

- 使用轻提示，例如“已保存”“备注已更新”“已删除”。
- 不使用浏览器原生 `alert` / `confirm`。

CRUD 失败但已进入队列：

- 轻提示：“网络异常，已暂存，稍后自动同步”。
- 对应记录可显示轻量同步状态，不打断用户主流程。

删除确认：

- 使用项目内确认弹层或底部 action sheet。
- 默认按钮文案明确区分“取消”和“删除”。
- 删除后列表立即反馈，但失败时保留恢复路径。

同步失败：

- 列表项显示“同步失败”状态。
- 提供“重试”或下一次进入页面自动重试。

## 13. 模块边界

建议新增或调整的前端模块：

```text
apps/web/src/lib/mutation-queue.ts
  -> 队列 item 类型、入队、合并、状态更新、清理

apps/web/src/lib/mutation-queue-flush.ts
  -> 按实体调用 API，处理成功/失败/退避

apps/web/src/hooks/useMutationQueueFlush.ts
  -> session 恢复、online、focus 等触发 flush

apps/web/src/lib/server-cache-sync.ts
  -> 保留服务端列表替换 Dexie 缓存能力，必要时兼容 syncStatus
```

业务 API mapping 继续放在现有模块：

- `wrong-question-api`
- `ocr-record-api`
- `chat-message-api`

不让通用 queue 模块直接 import 页面组件，也不让页面组件直接操作复杂队列细节。

## 14. 测试与验收

单元测试建议：

- `mutation-queue.test.mts`
  - create 入队
  - update 合并
  - create 后 delete 直接清理
  - update 后 delete 合并为 delete
  - retryCount / nextRetryAt 计算

- `mutation-queue-flush.test.mts`
  - wrongQuestion create 成功清队列
  - wrongQuestion duplicated 合并为成功
  - delete 404 视为成功
  - 401 不重试
  - 5xx 退避重试

- `server-cache-sync.test.mts`
  - 服务端空列表清空本地缓存
  - 服务端无 imageUrl 时补回本地 preview
  - syncStatus 本地字段不上传服务端

手动验收：

1. 登录后创建错题，成功提示正常，刷新后仍存在。
2. 停后端或断网，创建错题后 UI 有反馈，恢复后自动同步。
3. 备注保存失败时用户输入不丢失，恢复后可同步。
4. 删除错题不再出现浏览器原生弹窗，失败时状态可恢复或重试。
5. OCR 完成但 OCRRecord 保存失败时，本地历史仍可见。
6. 服务端 OCRRecord / WrongQuestion 列表为空时，当前用户 Dexie 缓存被正确清理。
7. 旧 base64 图片不会被提交给 `/ocr-records` 或 `/wrong-questions`。

全量验证命令：

```powershell
node --experimental-strip-types apps/web/src/lib/mutation-queue.test.mts
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
node --experimental-strip-types apps/web/src/lib/server-cache-sync.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

## 15. 文档更新范围

实现完成后需要同步更新：

- `docs/data-flow.md`
- `docs/roadmap.md`
- `DEVLOG.md`
- `CLAUDE.md`
- `AGENTS.md`
- `README.md`：若 Phase 2.3 正式完成，需要更新当前进度。
- `Blog/`：写当天开发博客，继续保持不跟踪。

## 16. 完成标准

Phase 2.3 可以收官的条件：

- WrongQuestion / OCRRecord 已具备基础离线失败补偿能力。
- ChatMessage 同步边界已明确，不被错误塞入 CRUD queue。
- 历史 base64 图片策略已实现并写入文档。
- 关键自动化测试和全量 lint/build/test 通过。
- 文档、开发日志、协作说明和 README 状态一致。

