# Phase 6.9.8 SR6 Docker/API/Trace/可见浏览器功能验收

日期：2026-08-19  
分支：`drb/phase-6-9-8-sr6-docker-api-browser-acceptance`  
基线：`main=a1663ecf1a87333183571270336b3b8822d60df5`

说明：工作树另有 3 个预先存在且与本阶段无关的 `wrong-question-organizer` 未提交修改；它们未被读取、暂存、修改或提交。
SR6 文档提交只包含本文件及相关开发文档，合并后的验证基线为 `main=d7a62094`。

## 结论

SR6 功能验收通过。当前结论限定为 Docker、API、认证、Mock Chat、Trace 持久化、移动端布局和降级边界可用；
不建立 Provider 语义质量、计费、SLA 或产品质量 authority。结果保持 `semantic=not_established`、
`qualityAuthority=none`。

## 验收范围

- Docker Desktop 已启动；未执行 `down -v`、prune、volume/image/container 删除、Prisma reset、Redis flush 或 MinIO wipe。
- Compose 静态配置通过；server、worker、web、admin、PostgreSQL、Redis、MinIO 均启动。
- server 显示 `healthy`，worker 显示 `healthy`；web `3000`、admin `3100`、server health `3001` 可访问。
- 使用合成账号完成 `/auth/register`、`/auth/me` 和带 Bearer token 的 `/api/chat` Mock 流式请求。
- Chat 返回 `200`、`x-prepmind-ai-mode=mock`、`x-prepmind-agent-trace-recorded=true`；Trace 查询返回一条
  `completed`、`route=chat`、`modelProvider=mock`、`qualityAuthority=none` 记录。
- 可见 Playwright 浏览器完成 `/login -> /chat -> /agent-trace` 流程；发送 Mock 问题后页面显示用户消息和
  `本地 mock 模型回复`，Trace 调试台显示 Mock 调用摘要。浏览器随后调整到 `390x844`，主要文本、输入框和操作按钮
  未发生重叠，窗口保持打开。
- Trace 只保留摘要、哈希、计数、模式、provider/model 标识和固定 authority；未验证或持久化完整 prompt、provider 原文、
  完整回答、credential 或 raw error。

## 可复核证据

以下输出来自合并前分支和合并后 `main` 的同一默认关闭环境；命令均未打印解析后的 Compose 环境：

```text
docker compose ... config --quiet                 exit 0
docker compose ... ps                             server healthy, worker healthy, web/admin Up
GET http://127.0.0.1:3001/health                  200 {"success":true,"data":{"status":"ok"}}
prisma migrate status                             Database schema is up to date! (18 migrations)
```

合并后复验使用匿名化前缀 `sr6-evidence-*` 的一次性账号，账号在输出后立即删除：

```text
chatStatus=200 mode=mock traceRecorded=true
runId=e6ed2ac4-3780-4c8c-be49-fed41dcfb6ae
status=completed route=chat provider=mock qualityAuthority=none
DELETE 1
```

可见浏览器证据为 Playwright MCP 页面快照：`/login`、`/chat`、`/agent-trace`，以及 `390x844` 快照；浏览器窗口保持
打开，未将包含账号或回答正文的截图写入仓库。首次缺迁移时 `/agent-traces` 返回 `500`，迁移后同一 API 返回上述成功结果。

## 发现并修复的问题

首次验收时 `/api/chat` 仍返回 `200`，但 Trace best-effort 写入失败；直接查询 `/agent-traces` 返回 `500`。
检查 Docker 数据卷后确认数据库缺少仓库已有迁移：`20260805090000_realtime_agent_trace_lifecycle`。

该迁移为 `AgentTraceRun` 增加 realtime lifecycle、usage、price、authority 字段和约束。使用容器内标准命令：

```text
bunx prisma migrate deploy --schema prisma/schema.prisma
```

迁移成功后再次执行 API 验收，Trace 写入恢复为 `true`，列表和详情均正常。该修复只补齐 schema，不删除或重置已有业务数据。

## 清理

本轮创建的 7 个 `sr6-*` 合成账号及其级联数据已精确删除，删除后不保留测试账号、Trace 或会话业务记录。Docker 容器、
命名卷、数据库原有数据、Redis、MinIO 与浏览器窗口均保留。

## 边界与遗留

- Docker/Mock/API/Trace/浏览器功能通过，不等于 Retriever/FinalResponse 真实 Provider 语义通过。
- 本轮未开启真实 Provider，也未读取根 `.env` 中的 credential；没有新的 Provider、billing 或 semantic evidence。
- 浏览器控制台曾出现一次登录页遗留 refresh cookie 的 `401`，不影响随后重新登录、Chat 或 Trace 页面功能；该现象记录为
  浏览器状态清理问题，不修改生产认证逻辑。
- 合并后 `main=d7a62094` 已重复完成默认关闭的 Docker/API/可见浏览器验收；该复验仍不建立 Provider 语义 authority。

