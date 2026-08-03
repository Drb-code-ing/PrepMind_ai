# Phase 6.9.7 Task 10 — Tutor / WrongQuestionOrganizer Docker runtime boundaries

日期：2026-07-23

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：Docker allowlist、tracked environment example、API/worker/admin 角色隔离与运维回滚已完成；两个生产 gate 仍默认关闭，未读取根 `.env`/credential，未调用 provider，未启动 Docker service 或执行 API/浏览器产品验收

## 1. 为什么需要这一任务

Task 5/7 已在应用代码中实现 Tutor Web composition 与 WrongQuestionOrganizer NestJS composition，但“代码可启用”不等于“容器能够安全启用”。Task 10 开始前存在两个部署缺口：

- Compose 的 `server` 没有投影 WrongQuestionOrganizer gate、5000ms timeout 与独立 credential，因而 Docker API 即使配置完整也只能停在 default-off；
- `admin` 仍使用 `env_file: ../.env`，会把根环境整份注入后台容器，与“admin 不接收 Agent gate/credential”的权限边界冲突。

如果不先修复，后续 controlled-Live 会出现两种相反风险：目标组件无法启动，或无关容器拿到不需要的能力凭据。Task 10 因此只收口部署权限，不打开模型、不运行产品验收。

## 2. 最终服务 allowlist

根 `.env` 或宿主环境只作为 Compose `${...}` 插值输入；四个应用 service 都不再使用 service `env_file` 导入整份文件。

| Service | 允许的 Phase 6.9.7 能力 | 明确禁止 |
| --- | --- | --- |
| `web` | Tutor gate、3000ms、`TUTOR_AGENT_DEEPSEEK_API_KEY` | WrongQuestionOrganizer gate/key |
| `server` | WrongQuestionOrganizer gate、5000ms、`WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY` | Tutor gate/key |
| `worker` | 无；仅保留 RAG、队列与运维 allowlist | Tutor/Organizer gate/key；模块层 `SERVER_ROLE=worker` 也强制关闭 Organizer |
| `admin` | 后台 API/学习端 URL | 任一 Agent gate、DeepSeek/OpenAI credential、整份根 `.env` |

两个组件变量都使用精确 default：gate=`false`、Tutor timeout=`3000`、Organizer timeout=`5000`、credential=空。Compose 没有 generic key、另一组件 key或其它 Agent key fallback。

## 3. 双层防护

### 3.1 Compose 投影

`docker/docker-compose.dev.yml` 只在目标 service 的显式 `environment` 中列出对应变量。resolved Compose fixture 会在合成根 env 中同时放入 Tutor/Organizer/generic credential，并验证：

- `web` 只得到 Tutor 三项；
- `server` 只得到 Organizer 三项；
- `worker/admin` 两组都得不到；
- `admin` 也得不到 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`。

### 3.2 应用运行时

部署隔离不是唯一安全门：

- Tutor config 只读取 `TUTOR_AGENT_DEEPSEEK_API_KEY`；generic 或 Organizer key 不能替代；
- Organizer config 只读取 `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`；generic 或 Tutor key 不能替代；
- Organizer 只有 `SERVER_ROLE=api|both` 才可启用，worker role 即使被容器外额外伪造注入也强制 gate=false；
- 真实 executor 仍要求全局 Live 双开关、组件 gate、精确 `https://api.deepseek.com/v1`、已知价格、合法 timeout、请求安全/eligibility 与预算同时成立。

因此 service allowlist 负责最小暴露，应用 config/module 负责 fail-closed；任何一层都不能替代另一层。

## 4. Tracked example 与静态解析

`docker/.env.example` 现在显式记录：

- `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`；
- 所有当前模型 Agent gate 默认 `false`；
- Tutor/Organizer 固定 timeout 与空 component credential；
- 固定 DeepSeek base URL/model 只作为非敏感配置示例。

本任务只用 tracked example 执行无输出解析：

```powershell
docker compose --env-file docker/.env.example -f docker/docker-compose.dev.yml --profile worker config --quiet
```

命令 exit 0 且 stdout 为空。没有运行会展开环境值的 `docker compose config` 输出，也没有读取根 `.env`。

## 5. 回滚与产品验收前置

日常和失败回滚固定为：

1. `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`；
2. Tutor/Organizer gate 均恢复 `false`；
3. 两条 component credential 从当前 shell、宿主 env 与容器投影中移除；
4. 只精确重建受影响的 `web server`，worker/admin 不接收这些能力；
5. 只精确清理本轮 synthetic user/question/group/deck/item/Trace/session/browser storage；
6. 保留容器、镜像、network、PostgreSQL/MinIO volume 与既有数据。

后续 controlled-Live 仍必须在 Task 11 checkpoint 后重新获得用户授权，并先确认 DeepSeek 账号的数据保留/训练边界。只能使用合成数据；本地清理不能声称删除供应商日志。产品验收期间除 Tutor/Organizer 当前目标 gate 外，Router、Verifier、Review、Planner 与 Knowledge gate 必须全部关闭。

禁止 Docker prune、`down -v`、container/image/volume 删除、database reset、Redis flush 或 MinIO wipe。

## 6. 验证证据

| 验证项 | 结果 |
| --- | --- |
| 新 boundary test RED | `3/3` 按预期失败：缺 Organizer server projection、缺 tracked defaults、admin 仍全量 env_file |
| Compose/default boundary GREEN | 新 spec `3/3`；与既有 readiness 合跑 `24/24` |
| Server config + Compose focused | `29/29` |
| Tutor component/generic/cross-key isolation | `5/5` |
| tracked Compose `config --quiet` | exit 0、无输出 |
| Server build | exit 0 |
| Web production build | exit 0，17 routes 生成完成 |

上述验证使用的 key 全是测试 canary，不是供应商 credential。没有调用 DeepSeek/OpenAI、创建 Live marker/evidence、启动/重建容器、创建业务数据或打开浏览器。

## 7. 下一步与回顾问题

下一任务是 Task 11：分支全量静态/Mock checkpoint 与两路独立终审。Task 11 通过后才重新申请 Task 12 唯一 controlled-Live 授权。

回顾时可以问：

- 为什么应用已有 worker-off 仍要做 Compose allowlist？
- 为什么 `--env-file .env` 不等于 service `env_file`？
- 为什么 admin 不调用模型也不能接收整份根 `.env`？
- 为什么 generic key 与另一组件 key 都不能作为 fallback？
- 为什么 `config --quiet` 通过仍不等于 Docker/真实模型验收？
- 为什么本地精确清理不能承诺删除 provider retention 数据？
