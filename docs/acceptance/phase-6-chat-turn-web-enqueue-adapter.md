# Phase 6 ChatTurn Web Enqueue Adapter

更新时间：2026-09-04
状态：ticket 02 已完成；功能分支已推送、`--no-ff` 合并并推送 `main`，merged-main 复验通过。

## 1. 目的

ticket 01 已提供认证 `POST /chat-turns`，但 Web 端此前没有一个 typed seam 将已认证、已持久化的会话消息转换成入队合同。本任务补齐
浏览器侧的 canonical request builder、严格 API adapter、兼容路径决策和重试分类，为 ticket 03 的 `/api/chat` turn-backed
切换提供稳定输入。

这一步仍不切换产品 Chat。当前 `ChatRuntimeProvider`、`useChat('/api/chat')` 和回答完成后的
`/chat-messages/sync` snapshot sync 保持原状。

## 2. Web 公共 seam

`apps/web/src/lib/chat-turn-api.ts` 提供三个边界：

1. `prepareChatTurnSubmission`：只有 `conversationId` 已存在且调用方确认消息已在服务端持久化时，才准备 enqueue request；否则显式返回
   `snapshot-sync / conversation-not-ready|messages-not-persisted`。
2. `buildChatTurnEnqueueRequest`：把 owner-bound `StoredMessage[]` 规范化并生成稳定 `inputHash` 与
   `clientRequestId`，最终再经过共享 `chatTurnEnqueueRequestSchema`。
3. `createChatTurnApi(...).enqueue`：携带 Bearer token 调用 `POST /chat-turns`，要求 HTTP `202`，并使用共享
   `chatTurnEnqueueResponseSchema` 拒绝额外或畸形响应字段。

返回给 HTTP adapter 的请求只有：

```text
conversationId
clientRequestId
inputHash
inputMessageIds
budgetPolicyVersion
```

消息正文只进入浏览器内存中的 canonical SHA-256 计算，不进入 enqueue body、日志、错误或响应。

## 3. 稳定身份与有界输入

### 3.1 `inputHash`

`chat-turn-input-v1` canonical value 包含规范化的 conversation id，以及按 `order + id` 稳定排序的消息 id、role、order、ISO
时间和 content。相同持久化输入即使数组读取顺序不同，也得到相同 lowercase SHA-256；正文、角色、顺序或时间变化都会改变 hash。

### 3.2 `clientRequestId`

`web-chat-turn-v1-<sha256>` 从 owner id、conversation id、`inputHash`、有序 message ids 和 budget policy version 派生。它不依赖
access token 或随机数，因此同一 owner/session 的离线重试可复用同一幂等 id；owner 或预算版本改变会产生新的请求身份。

### 3.3 bounds

| 项目      | 浏览器边界                                      |
| --------- | ----------------------------------------------- |
| 消息数量  | `1..1000`                                       |
| id        | trim 后符合共享 safe-id pattern；重复 id 拒绝   |
| 单条正文  | 最大 `100,000` 字符                             |
| 正文总量  | 最大 `2,000,000` 字符                           |
| order     | 非负 safe integer                               |
| createdAt | 有效 safe-integer epoch milliseconds            |
| owner     | 每条消息必须与本次 authenticated owner 完全一致 |

所有输入在 digest 或网络调用前 fail-closed。digest 使用浏览器/Node 共有的 Web Crypto `SHA-256`；不存在 Web Crypto 或 digest
形状不合法时，不退化为弱 hash。

## 4. 兼容、会话与重试边界

- conversation 尚未建立或消息尚未确认服务端持久化时，decision seam 明确保留现有 `/chat-messages/sync` snapshot path；本 ticket
  不自动执行 fallback，也不会在 enqueue 失败后静默改走 snapshot，避免双写或两份回答。
- owner 在 canonicalization 前绑定；任何跨 owner 消息都会在浏览器侧拒绝。若 token/会话在请求期间切换，服务端仍从 JWT 重新绑定
  owner，并对 conversation/message ids fail-closed。ticket 03 负责把这一判断接入产品生命周期。
- 只有网络错误、HTTP `408/425/429` 和 `5xx` 可在同一 owner/session 下复用原 request 重试。
- 用户 abort 映射为 `REQUEST_ABORTED`，与网络离线分开，不能自动重试；`4xx`、鉴权、schema、owner、幂等冲突和本地构建错误均为
  terminal。
- 没有把 ChatTurn 塞入既有错题/OCR/复习评分 mutation queue；持久化离线调度仍属于 ticket 03 的产品桥接设计。

## 5. 验证

功能分支当前结果：

```text
Focused API client + ChatTurn adapter: 9 tests passed
Web full test: 499 tests passed
Web full ESLint: passed
Web production build + Next TypeScript phase: passed
Targeted Prettier: passed
git diff --check: passed
```

两个独立只读 review 先后发现 fetch/response body 两个阶段的 abort 分类边界，以及 retry classifier 的排除边界；现已统一映射
`REQUEST_ABORTED` 并补齐不可重试回归。修复后的两路独立复审均无 blocker/P1/P2；merged-main 再次通过同一组回归。

## 6. 证据等级与安全记录

证据等级：`implemented` + `mock/static validated`。

本任务没有调用 DeepSeek、Qwen 或其他 Provider，没有启动 API/Worker/Docker/PostgreSQL/Redis/MinIO，没有写业务数据，也没有创建
controlled-Live 或 product real-model evidence。未查看或输出任何 credential 值；Web build 使用项目既有 Next 配置，但没有发起模型或
网络业务调用。没有进行浏览器验收，因为 adapter 尚未接入 UI，点击路径要到 ticket 03 才存在。

## 7. Git 收口

```text
base main: ef74c4acd46ed64f42d366b39702478251f33b9d
feature branch: drb/chat-turn-web-enqueue-adapter
feature commit: 27ee08dfdec34860a763da5b05a631357116c043
feature remote: origin/drb/chat-turn-web-enqueue-adapter (pushed)
main merge: 623a7dfa31e82a90685b1fd21cb3b28289dbc759
main == origin/main: yes after merge push
merged-main focused API client + ChatTurn adapter: 9/9 passed
merged-main Web full test: 499/499 passed
merged-main Web full ESLint: passed
merged-main Web production build + Next TypeScript: passed
merged-main targeted Prettier / Markdown links / git diff --check: passed
```

用户预先修改的 ReviewAgent、WrongQuestionOrganizer 和 `docs/agents/triage-labels.md` 不属于本 ticket，保持未暂存、未提交。

## 8. 后续

ticket 03 已把产品提交动作连接为 `append-only prepare -> durable enqueue -> turn id handoff`，增加默认关闭的功能 gate，并完成
Mock Docker/可见浏览器验收，详见 [`phase-6-chat-turn-api-bridge.md`](phase-6-chat-turn-api-bridge.md)。ticket 04 将现有
owner-bound status/replay API 接入浏览器 SSE/recovery。
