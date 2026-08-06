# PrepMind AI Web

这是 PrepMind AI 的 Next.js App Router 前端与 API Route 层，负责 Chat/OCR 代理、页面交互、PWA 壳层、客户端缓存和可见浏览器验收。

## 先读文档

- [当前状态](../../docs/current-status.md)
- [分支关系](../../docs/branch-map.md)
- [本地启动](../../docs/dev-start.md)
- [当前数据流](../../docs/data-flow.md)
- [统一验收与 headed 浏览器约定](../../docs/acceptance-checklist.md)
- [AI 行为验收](../../docs/ai-behavior-acceptance.md)

## 启动

从仓库根目录执行：

```powershell
bun install
bun --filter @repo/web dev
```

默认地址通常为 `http://127.0.0.1:3000`。前端 API Route 通过环境配置连接 Nest API，不直接 import server 模块。

## 常用命令

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
```

## 运行边界

- Chat 开发默认使用 mock；真实模型必须同时满足 `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`、登录态、组件 gate、预算和安全 eligibility。
- `/api/chat` 先绑定 `/auth/me` 的 canonical owner，再组合 Router/Tutor/Retriever/Verifier/FinalResponse；客户端不能伪造 owner、RAG filter、citation 或 terminal。
- R4 Architecture Recovery 是 zero-provider Mock-only，不能通过前端按钮或环境变量自动开启 R5/真实 Provider。
- headed 浏览器验收应保留可见窗口；headless 只用于快速回归，不能替代用户要求的可见验收。
- 验收结束后恢复 gate 默认关闭并精确清理合成账号、Trace、Outbox 和浏览器 storage；不清空 Docker 数据。
