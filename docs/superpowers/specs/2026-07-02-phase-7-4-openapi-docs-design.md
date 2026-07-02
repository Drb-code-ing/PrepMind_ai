# Phase 7.4 Swagger / OpenAPI Design

## 背景

PrepMind AI 已经完成 Phase 7.0 到 Phase 7.3：知识库文档处理可以在 inline / BullMQ queue 双模式下运行，后台任务有 `BackgroundJob` 控制面，RAG SafetyGuard 会在 chunk 级别标记 prompt injection 风险，EventBus 和后台任务 summary 也补上了第一层可观测能力。

现在的问题不在于“缺少接口”，而在于接口越来越多以后，联调和面试展示都缺少一个统一入口。当前项目已经有 `@repo/types` Zod contract，前后端也基本遵循共享 schema；但新人或面试官想快速理解 REST API 时，仍需要在 Controller、types、README、data-flow 文档和测试之间来回跳。Phase 7.4 要补的是一个低风险、可维护的 OpenAPI 调试入口，让工程链路更完整。

## 目标

1. 在 NestJS 后端接入 Swagger / OpenAPI 文档入口。
2. 默认只在非 production 环境暴露 `/api-docs` 和 `/api-docs-json`；production 必须显式打开开关才允许暴露。
3. 为核心 Controller 补充稳定的分组、认证说明和常用响应说明。
4. 明确 OpenAPI 是调试和展示入口，`@repo/types` Zod schema 仍是前后端 contract 的优先事实来源。
5. 覆盖至少这些业务域：Auth、User、Chat Messages、OCR Records、WrongQuestion、WrongQuestion Organizer、Review / ReviewTask / Plan、Knowledge Documents / Search、Knowledge Agent、Memory Agent、Agent Trace、BackgroundJob。
6. 补充自动化测试，锁定“开发可开启、生产默认关闭、核心 API 可发现、不会泄露密钥或 cookie”的边界。
7. 更新项目文档和写一篇面试学习博客，讲清为什么需要 API 文档、如何避免双事实源，以及 Swagger 在真实项目中的边界。

## 非目标

- 不生成前端客户端代码。
- 不把 Zod contract 全量自动转换为 OpenAPI schema。
- 不重写现有 Controller、DTO 或响应 envelope。
- 不改变任何 REST API 的请求路径、鉴权逻辑、响应结构或错误码。
- 不暴露 access token、refresh token、cookie、API key、完整 prompt、完整 RAG chunk、后台任务原始 payload 或真实用户内容示例。
- 不要求真实模型 live smoke；本阶段不改 Chat prompt、RAG prompt、模型选择或流式回答逻辑。

## 设计方案

### 1. Swagger 启动边界

新增一个小的 bootstrap helper，例如 `apps/server/src/config/swagger.ts`，由 `main.ts` 在全局 filter / interceptor 配置后调用。

开关规则：

- `NODE_ENV !== 'production'` 时默认启用。
- `NODE_ENV === 'production'` 时默认禁用。
- `SWAGGER_ENABLED=true` 可以显式启用。
- `SWAGGER_ENABLED=false` 可以显式禁用。

这样本地和测试环境容易调试，生产环境不会因为忘记配置而暴露 API 文档。

### 2. 文档路径

第一版固定使用：

- HTML UI：`/api-docs`
- JSON：`/api-docs-json`

`/api-docs-json` 用于测试和后续工具集成；`/api-docs` 用于浏览器联调和面试展示。

### 3. 认证说明

当前项目登录态权威来自 NestJS Auth API、httpOnly cookie、refresh token rotation 和 access token。Swagger 第一版只做说明和手动调试支持，不试图模拟完整浏览器 cookie 登录流。

OpenAPI 中提供：

- Bearer auth scheme：用于手动填入 access token 调试受保护接口。
- 文档描述中说明实际 Web 主链路仍依赖 httpOnly cookie + refresh token。
- Auth endpoints 标注注册、登录、刷新、退出、当前用户。

不得在 examples 中写真实 token、cookie 或密钥。

### 4. Controller 分组策略

使用 `@ApiTags()` 给 Controller 分组，标签优先按产品能力而不是技术层：

- `Auth`
- `Users`
- `Wrong Questions`
- `Wrong Question Organizer`
- `Chat Messages`
- `OCR Records`
- `Reviews`
- `Review Tasks`
- `Plan`
- `Review Preferences`
- `Review Agent`
- `Knowledge Documents`
- `Knowledge Search`
- `Knowledge Agent`
- `Memory Agent`
- `User Memories`
- `Agent Traces`
- `Background Jobs`
- `Uploads`

第一版不追求每个字段都完美展开，但每个核心 Controller 要能在 Swagger 页面中被发现，并能看到 method、path、认证要求和主要响应含义。`/review-tasks/plan` 是复习计划只读预览的核心接口，需要明确归到 `Plan` 或 `Review Tasks` 标签下，避免被误认为普通任务 CRUD。

### 5. Zod 与 OpenAPI 的关系

`@repo/types` 仍是优先 contract。Swagger 装饰器只作为 NestJS 层的调试说明，不能成为新的事实来源。

为了降低漂移风险：

- 字段变更必须先改 `@repo/types` schema 和对应测试，Swagger 装饰器随后同步；Swagger 不能反向驱动前端 contract。
- 不复制复杂业务 schema 的完整字段含义。
- 对稳定响应可以补简洁 `@ApiOkResponse()` / `@ApiCreatedResponse()` 描述。
- 对上传、分页、summary、只读 suggestions 等重点接口补更明确说明。

### 6. 响应 envelope 边界

后端已启用全局 `ResponseEnvelopeInterceptor`，成功响应实际形态是：

```ts
{
  success: true,
  data: unknown,
  requestId: string,
}
```

错误响应实际形态是：

```ts
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: unknown,
  },
  requestId: string,
}
```

`@repo/types/api/common.ts` 中的 envelope schema 是事实来源。Swagger 第一版必须至少在文档描述或轻量 schema 中说明 envelope，避免读者误以为 Controller 返回的是裸数据。为了控制改动面，不要求每个接口都手写完整泛型 envelope schema，但核心响应说明必须保持“业务 data 包在 envelope 里”的语义。

### 7. 安全和脱敏

Swagger 文档不能包含：

- 真实 API key。
- 真实 access token / refresh token。
- 真实 cookie。
- 完整用户输入、完整 prompt、完整模型回答。
- 完整 RAG chunk。
- `BackgroundJob.payloadPreview` 以外的原始 payload。

受保护接口需要标注认证，但不因为接入 Swagger 放宽 `JwtAuthGuard`。
production 显式开启 Swagger 只用于受控环境、内网或临时诊断，不代表公开调试入口，也不改变任何鉴权策略。

### 8. 测试策略

后端新增 focused tests：

- `shouldEnableSwaggerOutsideProductionByDefault`
- `shouldDisableSwaggerInProductionByDefault`
- `shouldRespectExplicitSwaggerEnabledFalse`
- `shouldRespectExplicitSwaggerEnabledTrue`
- 生成 OpenAPI document 时包含核心 tag，例如 `Auth`、`Knowledge Documents`、`Background Jobs`、`Agent Traces`。
- 生成 OpenAPI document 时包含 `Chat Messages`、`OCR Records`、`Wrong Question Organizer` 和 `Plan` / `Review Tasks`，证明核心链路可发现。
- 生成 OpenAPI document 的 JSON 字符串不得包含 `DEEPSEEK_API_KEY`、`OPENAI_API_KEY`、`Authorization: Bearer`、`Cookie:`、`refreshToken` 示例、`rawPayload`、`fullPrompt`、`fullChunk` 等敏感或原始内容字段。
- 生成 OpenAPI document 需要在描述中包含 response envelope 说明，或包含统一 envelope schema 名称。

如果直接测试 Nest app bootstrap 成本太高，可以优先测试 swagger config helper 和 document options builder，再用一个轻量 app 测试确保 setup 函数不会破坏 bootstrap。

### 9. 文档更新

需要同步更新：

- `AGENTS.md`：Phase 7.4 状态、环境变量、常用启动说明。
- `docs/roadmap.md`：Phase 7.4 已完成后标记。
- `docs/data-flow.md`：新增 OpenAPI 调试入口边界。
- `docs/dev-start.md`：说明本地如何打开 `/api-docs`。
- `docs/ai-behavior-acceptance.md`：说明此阶段不需要 live 模型 smoke。
- `DEVLOG.md`：收尾时记录阶段级日志。
- `docs/blogs/phase-7-openapi-docs.md`：面试学习文档。

## 验收标准

1. 本地开发启动后可以访问 `/api-docs`。
2. `/api-docs-json` 能返回 OpenAPI JSON，并包含核心 tags。
3. production 默认不暴露 Swagger，除非显式设置 `SWAGGER_ENABLED=true`，且文档说明该用法只适合受控环境。
4. 核心 Controller 在文档中可发现，至少包括 Chat Messages、OCR Records、Wrong Question Organizer、Plan / Review Tasks、Knowledge、Agent Trace 和 BackgroundJob。
5. 不改变现有业务 API 行为。
6. 文档说明全局 response envelope，避免把响应误导为裸 data。
7. 自动化测试确认 OpenAPI JSON 不包含密钥、cookie、完整 prompt、完整 RAG chunk、后台任务原始 payload 或真实用户内容示例。
8. 后端 focused tests、build、文档自检通过。

## 实施顺序

1. 增加 Swagger 配置 helper 和环境变量解析测试。
2. 接入 `@nestjs/swagger` 与 `/api-docs` bootstrap。
3. 给核心 Controller 补 tags 和认证/响应说明。
4. 增加 OpenAPI document generation 测试。
5. 更新协作文档、路线图和开发启动文档。
6. 写面试学习博客。
7. 运行 focused verification，按任务提交。
