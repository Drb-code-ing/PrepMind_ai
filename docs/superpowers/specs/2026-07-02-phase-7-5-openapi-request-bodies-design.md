# Phase 7.5 OpenAPI 中文化与请求体示例设计

## 背景

Phase 7.4 已经接入 Swagger / OpenAPI，提供 `/api-docs` 和 `/api-docs-json`，并覆盖核心 tag、鉴权标记、响应 envelope 说明和敏感信息防泄露测试。当前不足是：部分接口在 Swagger UI 中只看到路径和响应说明，`POST /auth/register`、`POST /knowledge/search` 等高频调试接口缺少 request body 示例；另外面向人的描述仍以英文为主，不够适合学习、面试讲解和本地调试。

## 目标

把 Swagger 从“接口地图”推进到“可读、可调试的中文接口文档”，但不改变 API contract 的权威来源。

## 范围

- 中文化核心高频接口的 `summary`、`description` 和成功响应说明。
- 为高频写接口补 `@ApiBody` / `@ApiConsumes` 示例。
- 示例只展示结构和安全占位值，不放真实 token、cookie、完整 prompt、完整回答、完整 RAG chunk 或真实用户资料。
- 继续以 `@repo/types` 的 Zod schema 作为真实校验和契约来源，Swagger 示例只是展示层。

## 首批覆盖接口

- `POST /auth/register`
- `POST /auth/login`
- `POST /knowledge/documents`
- `PUT /knowledge/documents/:id/file`
- `POST /knowledge/documents/:id/process`
- `POST /knowledge/search`
- `POST /review-tasks/:taskId/rating`
- `POST /agent-traces`

这些接口覆盖注册登录、知识库上传/替换/处理/检索、复习评分和 Agent Trace 写入，是开发者最常用来调试链路、也最适合面试讲清楚工程边界的接口。

## 设计原则

- 中文给人看：Swagger UI 的说明尽量中文化，降低阅读门槛。
- 英文给程序用：路径、字段名、header、env、错误码保持英文，避免破坏调用约定。
- 示例不等于契约：不创建新的 DTO 层替代 Zod schema，避免双源维护。
- 脱敏优先：示例使用 `student@example.com`、`sample-question`、`trace-run-id` 等占位值。
- 小步可验收：先补高频写接口，后续再逐步扩展查询参数和响应 schema。

## 测试策略

- 增加 OpenAPI JSON 生成测试，断言首批覆盖接口都存在 `requestBody`。
- 对 multipart 上传接口断言 `multipart/form-data` 和 `file` 字段存在。
- 对 JSON 写接口断言 `application/json` 示例存在。
- 保留敏感信息防泄露测试，并补充中文描述不会引入原始 prompt / chunk / cookie 示例。

## 非目标

- 不生成完整 DTO class tree。
- 不把 Swagger 作为前端生成 client 的唯一来源。
- 不改变任何接口运行时行为。
- 不启动真实模型验收，因为本阶段只影响接口文档元数据。
