# Phase 7.4 学习博客：为什么多 API 项目需要 Swagger / OpenAPI

## 这次解决的真实问题

PrepMind AI 做到 Phase 7.4 时，问题已经不是“有没有 API”。恰恰相反，API 已经很多了：Auth、WrongQuestion、OCRRecord、ReviewTask、ReviewPreference、Knowledge Documents、Knowledge Search、BackgroundJob、AgentTrace、MemoryAgent、KnowledgeAgent、WrongQuestionOrganizer 等等。

一开始接口少的时候，前端和后端靠 `@repo/types`、Controller、测试和文档一起看，成本还能接受。但到 Phase 7 后，项目进入工程化阶段，接口有几个明显变化：

- API 数量变多。
- 很多接口有认证和当前用户隔离。
- 有些接口是写操作，有些只是只读建议。
- 有些接口返回后台任务状态，不返回完整业务内容。
- 有些接口服务 RAG 或 Agent，但不能泄露 prompt、chunk、token 或 API key。

这时如果没有统一入口，新人或面试官想理解系统，就要在 Controller、Zod schema、前端 api client、测试文件、`docs/data-flow.md` 之间来回跳。能看懂，但很累，也不利于联调。

所以 Phase 7.4 adds Swagger / OpenAPI debug docs。它的目标不是重写 contract 系统，而是补一个“能快速看见 REST API 轮廓”的窗口：

- `/api-docs` 用于浏览器里的 Swagger UI。
- `/api-docs-json` 用于拿到 OpenAPI JSON，方便测试或后续工具读取。
- 默认在非 production 开启，方便本地开发。
- production 默认关闭，避免把内部接口结构随便暴露出去。

到了 Phase 7.5，我又补了一步：给核心写接口加中文说明和 request body 示例。因为只有接口列表还不够，真正联调时大家最常卡住的是“这个 POST 到底传什么”。比如注册登录需要 JSON，知识库上传需要 `multipart/form-data` 和 `file` 字段，复习评分需要 `rating` 和可选的 `clientMutationId`，Agent Trace 只能传已经隐藏敏感内容的摘要，不能传完整 prompt 或完整回答。

这一步的目标很朴素：打开 `/api-docs` 时，开发者不仅能看到“有哪些接口”，还能看到“高频接口怎么试”。但它仍然只是展示层，不改变真实 contract。

这里顺便解释一下“脱敏”：它是安全工程里的说法，意思是把可能泄露隐私或密钥的内容隐藏掉，比如 token、cookie、API key、完整 prompt、完整回答、完整 RAG chunk。这个词在技术文档里可以用，但放在 Swagger UI 这种给人快速看的地方不够直观，所以这次把界面文案改成了“隐藏敏感内容”。

首批补齐的是这些接口：

- `POST /auth/register`
- `POST /auth/login`
- `POST /knowledge/documents`
- `PUT /knowledge/documents/:id/file`
- `POST /knowledge/documents/:id/process`
- `POST /knowledge/search`
- `POST /review-tasks/:taskId/rating`
- `POST /agent-traces`

这件事很适合面试讲，因为它不是为了“看起来高级”，而是典型的多 API 项目协作问题：接口越来越多，怎么让它可发现、可调试、可解释，同时不牺牲安全和单一事实源。

## 为什么不是直接生成前端客户端

很多人看到 OpenAPI 第一反应是：“那是不是可以直接生成前端 SDK？”

在 PrepMind 这个阶段，我没有这么做。原因是项目已经有一套更适合当前架构的 contract 来源：`@repo/types` 里的 Zod schemas。

当前前后端共享 contract 的核心收益是：

- 前端可以直接使用 TypeScript 类型。
- 服务端可以复用 Zod 做 runtime validation。
- 测试可以直接 import schema。
- schema 和业务字段变化放在 monorepo 内，review 起来很集中。

如果这个阶段突然改成“OpenAPI 生成前端客户端”，会引入几个新问题：

- 要决定 OpenAPI 是事实源，还是 Zod 是事实源。
- DTO 装饰器、Zod schema、前端类型可能出现三套口径。
- 生成客户端会改变前端调用方式，带来不必要的迁移成本。
- 很多接口还有统一 response envelope，生成出来的类型不一定比现有 `@repo/types` 更清楚。

所以 Phase 7.4 的判断是：先把 Swagger 当成调试/展示层，而不是代码生成中心。

面试里可以这样讲：

> 我们没有急着从 OpenAPI 生成前端客户端，因为项目已有 `@repo/types` Zod contract。Phase 7.4 的 Swagger 主要解决接口发现和联调，不反向驱动前端 contract。这样可以避免引入第二套事实源，也避免为了文档重构前端调用层。

这句话的重点是“克制”。不是不会生成，而是在当前阶段不值得。

## @repo/types 和 Swagger 怎么分工

这次最重要的边界是：`@repo/types` Zod schemas remain source of truth。

也就是说，字段结构、枚举、请求体、响应体这些核心 contract，优先看 `@repo/types`。Swagger 负责把 NestJS 侧的接口展示出来，帮助开发者快速知道：

- 有哪些 path。
- 每个 path 是 GET、POST、PATCH 还是 DELETE。
- 哪些接口需要认证。
- 接口大概属于哪个模块。
- 响应是否包在统一 envelope 里。
- 哪些字段是调试用 metadata，哪些字段不能包含敏感内容。
- 高频写接口应该传什么格式的 request body。

可以把它们的分工理解成这样：

```text
@repo/types
  -> contract source of truth
  -> Zod schema
  -> TypeScript type
  -> runtime validation
  -> 前后端共享

Swagger / OpenAPI
  -> debug docs
  -> API discovery
  -> 面试展示
  -> 手动联调辅助
  -> 不反向驱动前端 contract
```

这种分工对多端项目很重要。Swagger 很适合“看见接口”，但如果它和代码里的真实 schema 发生冲突，最终还是应该以共享 schema 和测试为准。

一个很实际的例子：如果 `KnowledgeDocument` 增加了一个字段，正确流程应该是：

1. 先更新 `@repo/types` 里的 Zod schema。
2. 更新服务端返回和测试。
3. 更新前端消费逻辑。
4. 最后同步 Swagger 描述。

而不是在 Swagger 装饰器里先加字段，再让前端跟着 OpenAPI 走。那样很容易让文档变成“看起来正确，但代码不认”的幻觉。

Phase 7.5 的 request body 示例也是这个原则：它让 Swagger UI 更好用，但字段约束仍然来自 `@repo/types`。示例可以帮助你手动联调，但不能成为前端代码生成或业务校验的事实源。

## response envelope 为什么容易误导文档

PrepMind 的后端响应不是直接返回裸业务对象，而是有全局 response envelope。

成功响应大致是：

```json
{
  "success": true,
  "data": {
    "id": "doc_123",
    "status": "DONE"
  },
  "requestId": "req_..."
}
```

错误响应大致是：

```json
{
  "success": false,
  "error": {
    "code": "KNOWLEDGE_DOCUMENT_NOT_FOUND",
    "message": "Document not found"
  },
  "requestId": "req_..."
}
```

这类 envelope 对真实系统很有用，因为它让前端统一处理成功、失败和排障信息。`requestId` 尤其适合排查问题：用户截图里有 requestId，后端日志也能按 requestId 查。

但它对 Swagger 有一个坑：NestJS Controller 里通常写的是业务返回类型，比如 `KnowledgeDocumentResponse`，而全局 interceptor 会在外面包一层 envelope。如果 Swagger 文档没写清楚，读者会以为接口直接返回：

```json
{
  "id": "doc_123",
  "status": "DONE"
}
```

这就会误导前端、测试和面试讲解。

所以 Phase 7.4 要明确说明全局 response envelope：成功响应是 `{ success, data, requestId }`，错误响应是 `{ success, error, requestId }`。第一版不一定要给每个接口都手写一个完美泛型 schema，但必须让读者知道业务对象在 `data` 里面。

面试里这个点很好讲，因为它体现了你不是只会“接 Swagger”，还理解框架文档和真实运行时之间可能不一致。

## production 默认关闭的原因

`/api-docs` 和 `/api-docs-json` 默认在非 production 开启。production 默认关闭。

原因很简单：OpenAPI 文档会暴露系统接口结构。即使没有泄露密钥，它也可能告诉外部攻击者：

- 系统有哪些模块。
- 哪些 path 存在。
- 哪些接口需要参数。
- 哪些接口是后台任务、资料处理、trace 或 memory。
- 哪些错误码可能出现。

这些信息对开发者很有价值，对攻击者也有价值。

所以 production 默认关闭是更保守的选择。如果确实需要在生产或类生产环境临时看文档，可以显式设置：

```powershell
$env:SWAGGER_ENABLED='true'
```

但这个开关只适合受控环境、内网或临时诊断。它不应该变成公网常驻入口。

更重要的是，`SWAGGER_ENABLED=true` 不放宽 `JwtAuthGuard`。Swagger 只是把接口展示出来，不应该改变任何接口的认证和授权策略。受保护接口仍然需要登录态、access token，并且服务端查询仍然必须带当前 `userId` 隔离。

可以这样对面试官说：

> 我们把 Swagger 默认限制在非 production，是为了降低接口结构暴露风险。production 即使显式打开，也只适合内网或临时诊断，而且不会绕过 JwtAuthGuard。文档入口和业务鉴权是两件事。

## 安全边界：什么不能写进 OpenAPI

OpenAPI 是文档，但文档也可能泄密。

PrepMind 里有很多和 AI、RAG、Agent 相关的链路，所以尤其要注意不要把下面这些内容写进 OpenAPI 示例或描述：

- `DEEPSEEK_API_KEY`、`OPENAI_API_KEY` 等 API key。
- `Authorization: Bearer ...` 的真实 token 示例。
- `Cookie:`、refresh token 或 httpOnly cookie 示例。
- 完整 Chat prompt。
- 完整模型回答。
- 完整 RAG chunk。
- 用户上传资料原文。
- Agent Trace 的完整 step payload。
- BackgroundJob 的原始 payload。
- 真实用户 id、资料 id、文件内容或个人学习记录示例。

文档里可以写“这里需要认证”，也可以写“这里会隐藏敏感内容后的 metadata”，但不应该为了示例逼真而塞真实敏感内容。

这和 Phase 7.0 到 Phase 7.3 的边界是一致的：BackgroundJob 只保存脱敏 metadata，Agent Trace 不保存完整 prompt，RAG SafetyGuard 把用户资料当低信任证据。Swagger 也必须延续这个边界。

一个好用的安全口径是：

> OpenAPI 只能展示接口形状，不能展示真实秘密、真实用户内容或可复原的 AI 上下文。

## 测试怎么兜底

Phase 7.4 的测试重点不是 live 模型，而是文档入口和文档内容。

因为这次不改：

- Chat prompt。
- RAG prompt。
- 模型路由。
- 流式输出。
- Tutor 输出策略。
- KnowledgeVerifierAgent guidance。

所以本阶段不需要 live 模型 smoke。live smoke 应该用在最终回答体验变化时，而不是每次改工程文档都调用真实模型。

这次更应该验证：

- 非 production 下 `/api-docs` 和 `/api-docs-json` 可用。
- production 默认不暴露 Swagger。
- `SWAGGER_ENABLED=true` 能显式开启，但只改变文档入口，不改变业务鉴权。
- OpenAPI JSON 包含核心 tags，比如 Auth、Knowledge Documents、Background Jobs、Agent Traces、Review Tasks 等。
- OpenAPI 描述包含 response envelope。
- OpenAPI JSON 包含核心写接口 request body 示例，尤其是 JSON body 和 multipart 文件上传 body。
- OpenAPI JSON 不包含密钥、cookie、token、完整 prompt、完整 RAG chunk 或真实用户内容。
- `git diff --check` 不报空白错误。

文档任务的最低验证命令是：

```powershell
bun --filter @repo/server test -- swagger
bun --filter @repo/server build
git diff --check
```

如果源码实现也在同一任务里改了，那还应该跑 server 测试和 build。但当前这篇博客对应的是 Task 6 文档实现，所以重点是文档事实一致、边界讲清楚、没有误导读者。

## 面试可以怎么讲

面试里不要把这件事讲成“我加了 Swagger UI”。这太薄了。

更好的讲法是从问题开始：

> 项目发展到 Phase 7 后，REST API 已经覆盖 Auth、RAG、后台任务、Agent Trace、复习计划、错题组织等模块。接口数量变多后，单靠 Controller 和前端调用层不方便联调，也不方便向新人或面试官解释系统。所以我补了 Swagger / OpenAPI debug docs，提供 `/api-docs` 和 `/api-docs-json` 作为接口发现入口。

然后讲取舍：

> 但我没有让 OpenAPI 反向生成前端客户端，因为项目已有 `@repo/types` Zod schemas 作为前后端共享 contract。Swagger 在这里是展示层，不是事实源。字段变更仍然先改 Zod schema、服务端测试和前端消费，再同步 Swagger 描述。

再讲安全：

> 文档默认只在非 production 开启，production 默认关闭。`SWAGGER_ENABLED=true` 只适合内网或临时诊断，而且不放宽 `JwtAuthGuard`。OpenAPI 文档也不能包含 API key、token、cookie、完整 prompt、完整 RAG chunk 或真实用户内容。

最后讲一个容易被忽略的细节：

> 因为后端有全局 response envelope，Swagger 必须说明成功响应是 `{ success, data, requestId }`，错误响应是 `{ success, error, requestId }`。否则读者会误以为 Controller 返回裸业务对象，联调时就会出错。

如果面试官继续问“只有接口列表够吗”，可以接着讲 Phase 7.5：

> 后来我又补了核心写接口的 request body 示例。比如注册和登录是 JSON，知识库上传和替换是 `multipart/form-data`，复习评分带 `clientMutationId` 做幂等，Agent Trace 只允许已经隐藏敏感内容的摘要和 token / cost 估算。这样 Swagger UI 不只是接口地图，而是能直接帮助联调。但我仍然没有让示例替代 `@repo/types`，因为示例是给人看的，schema 和测试才是系统真正执行的契约。

这套回答能体现三个能力：

- 你知道为什么多 API 项目需要文档入口。
- 你知道 OpenAPI 和共享类型系统之间不能混成双事实源。
- 你知道生产环境和 AI/RAG 场景下的文档安全边界。

一句话总结 Phase 7.4：

> Swagger / OpenAPI 在 PrepMind 里不是 contract 的主人，而是 contract 的窗口。真正的事实源仍然是 `@repo/types` 和测试；文档负责让接口被看见，但不能改变接口的安全边界。
