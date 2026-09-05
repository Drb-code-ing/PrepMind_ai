# Phase 6 本地 AI 模式切换验收

更新时间：2026-09-05

分支：`drb/ai-mode-switch-defaults`
范围：本地 Docker Web 的 `/agent-trace` Mock/Live 控件与 `/api/chat` 模式接线。

## 目的

让本地验收可以在不编辑 `.env`、不重启 Web 的情况下切换 Chat 的 Mock/Live 模式，同时保持 Mock 安全启动默认。Live 选择只
在当前 Web 进程内生效，不改变根 `.env`，也不把一次手工切换动作当作 controlled-Live 质量证据。

## 根因

原 Docker Web allowlist 没有注入 `AI_DEV_MODE_SWITCH_ENABLED`，而模式页又把 `AI_ENABLE_LIVE_CALLS != true` 当成按钮禁用条件。于是
本地容器返回 `GET /api/dev/ai-mode = 404`，即使根 `.env` 已有开关和 DeepSeek key，控件仍不可见。

## 实现合同

- 非 production runtime 默认显示开关；Docker standalone 仅在 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 时允许 production image 显示。
- `AI_DEV_MODE_SWITCH_ENABLED=false` 是唯一的显式关闭值；未设置或空值在本地视为开启。
- 基础环境仍为 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`。进程启动不会自动调用 Provider。
- 选择 Live 后，composition root 生成一份统一的 effective environment：设置 `AI_PROVIDER_MODE=live`、
  `AI_ENABLE_LIVE_CALLS=true`，规范化 DeepSeek `/v1` 地址，补齐未设置的 Chat-chain gate，并让 Tutor/Rewrite/FinalResponse
  专用 key 回退到通用 `DEEPSEEK_API_KEY`。显式 `MODEL_ENABLED=false` 不会被覆盖。
- 同一 effective environment 传给 Router/Verifier、Tutor、Retriever query rewrite 和 FinalResponse，避免页面状态与实际 Chat
  runtime 分离。
- Live 按钮不因全局 guard 或缺少 key 而禁用。缺少有效 key 时仍保持用户选择，但 provider configured gate 返回明确错误；不会伪造
  Live 或静默回退 Mock。登录校验、HTTPS/provider 合同、预算、timeout、schema 和安全 eligibility 继续由服务端掌握。

## 验证证据

### 自动化

| 检查                      | 结果                                         |
| ------------------------- | -------------------------------------------- |
| Web 模式/Provider focused | `22/22`                                      |
| Web 全量测试              | `542/542`，14 suites                         |
| Server Compose readiness  | `21/21`                                      |
| Web lint                  | 通过                                         |
| Web production build      | 通过；包含 `/api/dev/ai-mode` 与 `/api/chat` |
| `git diff --check`        | 通过                                         |

### Docker 与可见浏览器

- `docker compose config` 脱敏检查确认 Web 收到 `AI_DEV_MODE_SWITCH_ENABLED=true`、Mock/off 基础值、五个 Chat-chain gate=true，
  以及通用 DeepSeek key 的三个组件回退值；没有把 Review/Planner/Organizer 的 server-only secrets 投影到 Web。
- 只重新创建了 `web` 容器，使用 `up -d --no-deps --no-build web`；PostgreSQL、Redis、MinIO、Server、Worker 和 Admin 未重建，
  volume 未删除。
- headed 可见浏览器打开 `/agent-trace`：控件初始显示 `当前：Mock`，Live 按钮可点击；点击后显示 `当前：Live`，Live 按钮成为
  当前态；再点击 Mock 后恢复 `当前：Mock`。整个过程没有发送 Chat 请求，因此没有 Provider 调用或费用。
- 创建的合成账号只用于登录控件，未创建 ChatTurn/BackgroundJob/Outbox/Trace；退出后按邮箱前缀精确删除 1 个 User，数据库确认
  目标 turn 为 `0`、Outbox 删除 `0`。浏览器窗口按用户要求保留在可见登录页。

## 证据等级与限制

本任务形成 `implemented + mock/static validated + Mock Docker/可见浏览器产品验收`。它证明本地控件可见、状态可切换且 Chat runtime
接线使用同一 effective environment；不证明真实 Provider 回答质量、计费、SLA、生产持续运行或 Chat Worker 真实模型能力。真实模型
调用仍需用户在 Chat 中主动发起，并按对应 acceptance 的数据边界和一次性授权执行。

已知无关状态：现有 `docker-worker-1` 的 readiness 仍显示 `unhealthy`，源于历史 audit maintenance 事务超时；本任务没有清理、重置或
改写该队列。
