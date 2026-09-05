# Phase 6 Worker Readiness 恢复验收

更新时间：2026-09-05

分支：`drb/worker-readiness-recovery`
范围：本地 Compose 冗余容器清理、Worker readiness 恢复语义和 Bun CLI 入口。

## 目的

恢复本地 Worker 的可信健康状态，同时保留失败历史用于排查。Readiness 应回答“当前 Worker 是否可以接流量”，不能因为 BullMQ
按策略保留一条已经被后续成功覆盖的历史失败而连续数天保持 `unhealthy`；但最新失败、时间未知、队列不可读或暂停仍必须
fail closed。

## 诊断证据

- 当前规范 Compose project 是 `docker`，配置来自 `docker/docker-compose.dev.yml`。规范服务为
  `docker-{postgres,redis,minio,minio-init,server,worker,web,admin}-1`。
- Docker Desktop 中多出的 `priceless_yonath`、`elated_wozniak` 和 `practical_fermat` 是 2026-08-25 创建、已经退出的两个旧
  Server 和一个旧 Web 容器。它们没有挂载卷、没有占用端口，也缺少当前 Compose 的完整路径标签。
- 修复前 `docker-worker-1` 连续 healthcheck 失败 300 次。唯一非通过项是 Audit maintenance queue：
  `failed=1 / delayed=1`；Redis、知识任务队列、审计导出队列、Worker heartbeat、Outbox 和维护新鲜度均通过。
- 保留的失败任务完成于 `2026-09-04T20:02:37Z`，失败原因是 Prisma interactive transaction 超过默认 5 秒；后续维护已在
  `2026-09-05T06:00:00Z` 成功。旧代码只检查 `failed > 0`，没有判断后续恢复，因此仍返回 `degraded` 和退出码 `1`。
- 本机 `readiness:worker` 仍使用 `ts-node`，会被 workspace 内合法的 `.ts` import 触发 `TS5097`，导致推荐运维命令在进入
  readiness 检查前失败。既有 subprocess 回归也因此得到错误的进程退出码，而不是受控 CLI 输出。

## 修复合同

- 只为 Audit maintenance queue 有界读取最多 10 条近期失败任务的安全时间元数据，并在本地取其中最新时间；不读取任务
  payload、用户正文或原始业务数据，也不依赖 BullMQ 返回顺序判断恢复状态。
- 当 PostgreSQL `lastSucceededAt` 严格晚于最新 BullMQ failure 时，队列检查返回 `pass`，但继续暴露 retained
  `failed` count 和恢复说明；失败历史没有被删除或伪装为不存在。
- 当最新 failure 晚于最近成功、failure 时间不可验证、队列不可读或队列暂停时，继续返回 `warn/fail`，不会错误报告 ready。
- `readiness:worker` 和真实 subprocess 回归统一改用 Bun，从而支持当前 workspace TypeScript import 合同；Docker 仍运行构建后的
  `dist/scripts/worker-readiness.js`。
- 同步修正 Phase 6.9.7 Docker 边界回归的旧预期：Chat 链 gate 在本地 ready，但基础模式仍是 Mock、Live calls 仍关闭；
  Review/Planner/Knowledge/Organizer 等 Server gate 不因此打开。

## 验证证据

### 自动化与静态检查

| 检查                     | 结果                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| Worker readiness focused | `4 suites / 51 tests passed`                                      |
| Docker runtime boundary  | `1 suite / 4 tests passed`                                        |
| Server full Jest         | `240 suites passed / 3 skipped`；`2262 tests passed / 30 skipped` |
| Server build             | 通过                                                              |
| 目标 ESLint / Prettier   | 通过                                                              |
| `git diff --check`       | 通过                                                              |
| 独立只读复审             | 无 P1/P2/P3 findings                                              |

修复前的同一 CLI 反馈环稳定返回 `Worker readiness: degraded`、退出码 `1`；重建后的同一命令返回
`Worker readiness: ready`、退出码 `0`。保留计数仍为 `failed=1 / delayed=1`，输出明确说明失败已被更新的成功运行覆盖。

### Docker 运行态

- 精确删除三个已退出且无挂载的旧容器；没有删除镜像、网络、volume、数据库记录、Redis key 或 MinIO object。
- 候选镜像从 `main` 的干净归档叠加本任务两项运行时改动（Server package 入口与 readiness service）构建，避免把七个
  用户 dirty 文件带入验收镜像。
- 只用 `--no-deps --no-build --force-recreate worker` 替换 Worker。Server、Web、Admin、PostgreSQL、Redis 和 MinIO 容器 ID
  保持不变；`docker_pgdata` 与 `docker_miniodata` 仍挂载在原位置。
- 最终 `docker-worker-1` 为 `healthy`，Server `/health=200`，Web `/login=200`。没有启动 Chat 或创建合成账号。

## 证据等级与边界

本任务形成 `implemented + mock/static validated + local Docker runtime validated`。它证明本地 Worker readiness 能识别“历史失败后
已恢复”的状态，并证明 CLI、Compose Worker、Server 和 Web 当前可用；不证明真实模型 Worker、Provider 质量、计费、SLA 或
production-used。

Compose 使用根 `.env` 为既有 Worker 注入配置，但没有查看或输出任何 key、连接串或 token；没有调用 DeepSeek、Qwen 或其他
Provider，费用为 0。没有执行 `prune`、`down -v`、数据库 reset、Redis flush 或 MinIO wipe。

## Git 回执

功能提交、分支推送、`--no-ff` 合并和 merged-main 复验在收口后回填。
