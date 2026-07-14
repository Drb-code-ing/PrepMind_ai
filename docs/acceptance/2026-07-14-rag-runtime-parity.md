# Phase 7.8.5 RAG Runtime Parity 真实验收记录

## 1. 结论

Phase 7.8.5 的真实 Qwen embedding、queue worker 与 hybrid retrieval 闭环验收通过。

最终验收分支为 `codex/rag-runtime-parity`，验收 SHA 为 `d43b332673c786cd48e45295302744b56025090a`。server 与 worker 容器内安全字段对齐为 `qwen` / `text-embedding-v4` / `1536`；official smoke 以 queue 模式完成上传、worker 处理、真实 embedding、hybrid 检索与自动文档删除，3/3 case 通过。

本次结论不依赖 provider fallback；三项缺配置启动检查均在 provider 调用前 fail-closed。验收过程未记录或输出 key、完整 base URL、token、文档正文、provider 原始响应、完整 env 或完整 Compose 解析配置。

## 2. Git 与 fresh gates

| 项目 | 结果 |
| --- | --- |
| 验收日期 | 2026-07-14 |
| 分支 | `codex/rag-runtime-parity` |
| 最终验收 SHA | `d43b332673c786cd48e45295302744b56025090a` |
| `bun --filter @repo/server test` | exit 0；76 suites passed，2 skipped；734 tests passed，2 skipped |
| focused smoke/readiness tests | exit 0；49/49 |
| `bun --filter @repo/server lint` | exit 0；lint 后无 textual/cached diff |
| `bun --filter @repo/server build` | exit 0 |
| `bun --cwd packages/types typecheck` | exit 0 |
| Compose `config --quiet` | exit 0；使用根 `.env` 做变量插值，未输出完整配置 |
| `git diff --check` / worktree / index | exit 0 / clean |

初始 lint 发现的机械格式化已在独立提交中处理；最终 SHA 上的 lint 只触发 Windows line-ending/stat 刷新，独立核对无 textual diff，刷新 index 后工作树保持 clean。

## 3. Docker 启动与运行时对齐

### 3.1 容器与数据边界

验收只重建 server/worker；PostgreSQL、Redis 和 MinIO 复用既有容器与 volume。web/admin 未被重建或关闭。全程未执行 `down -v`、prune、volume 删除、DB reset/truncate、Redis flush 或 MinIO wipe。

当前 Docker Desktop 在同时构建 server/worker 的 Compose Bake 会话初始化阶段会出现 gRPC shared-key header 非打印字符错误。该错误发生在 Dockerfile 构建之前，与仓库代码和 provider 配置无关。本次使用以下等价、非破坏性路径：

1. 分别构建 server 和 worker，两个 build 均 exit 0；
2. 对精确服务列表执行 `up -d --no-build`；
3. 通过根 `.env` 显式参与 Compose 插值，避免 service 的显式空变量覆盖 `env_file` 值。

启动后 server 为 `running`，worker 为 `running/healthy`。最终修复只改动 host smoke/config 脚本与测试，未改动容器内 API/worker 运行时，因此按评审决定复用已构建且健康的 server/worker 镜像执行最终 official smoke。

### 3.2 安全 parity 输出

| 服务 | provider | model | dimensions |
| --- | --- | --- | --- |
| server | `qwen` | `text-embedding-v4` | `1536` |
| worker | `qwen` | `text-embedding-v4` | `1536` |

该检查只读取上表三个字段，没有读取或输出 base URL 与 key。

## 4. Official RAG eval smoke

### 4.1 结果

| 项目 | 结果 |
| --- | --- |
| 命令 | `bun --filter @repo/server smoke:rag-eval` |
| exit | 0 |
| duration | 2561 ms |
| cases | 3/3 passed |
| Recall@K | 100.0% |
| Top1 Accuracy | 100.0% |
| Safety Pass Rate | 100.0% |
| No-hit Pass Rate | N/A（0 个 no-hit case） |
| runtime evidence | `mode=hybrid`, 3 hits checked |
| exact keyword case | 1 hit，`keywordScore > 0` |
| semantic review-pressure case | 1 hit，`vectorScore > 0` |
| cross-language weak-points case | 1 hit，`vectorScore > 0` |
| duplicate chunk | 每个 query 均无重复 `chunkId` |
| processing mode | queue |
| BackgroundJob | 1/1 `SUCCEEDED` |
| document cleanup | 账号删除前已为 0，证明 smoke 自动删文档 |

`assertRagEvalSmokeEvidence` 在输出 runtime evidence 前依次检查每个 hit 的 hybrid mode、有限数值 score、每 query 无重复 chunk，exact case 的正 keyword score，以及两个 semantic case 的正 vector score。本次命令 exit 0 且输出 runtime evidence，因此上表不是只从 HTTP 2xx 或 Document DONE 推断。

### 4.2 前置诊断与最小修复

首轮真实 smoke 的 queue BackgroundJob 已经 `SUCCEEDED`且文档已自动删除，但 host evidence 门禁返回固定子码 `exact_keyword_score_missing`。安全 SQL 诊断证明 smoke exact query 的额外 filler terms 被全 AND 组合，使关键词候选行为空；这不是 embedding provider 失败，也不应通过放宽生产检索算法来掩盖。

最小修复只将 host smoke exact query 收窄到纯精确术语，并将 allowlisted evidence 子码透传给安全诊断；综合 eval case、生产检索 SQL、融合排序和 provider runtime 均未改动。修复后 focused tests 49/49、全量 server tests 734 passed，official smoke 3/3 passed。

## 5. Fail-closed 负向启动检查

三个检查均使用 `docker compose run --rm --no-deps`，均在配置解析阶段非 0 退出，未构造 embedding provider 调用。只提取以下固定字段类别：

| 场景 | exit | 安全错误字段 | 结果 |
| --- | --- | --- | --- |
| 缺少显式 provider | 1 | `RAG_EMBEDDING_PROVIDER` | fail-closed |
| Qwen 缺少 canonical/supported key | 1 | `QWEN_API_KEY` | fail-closed |
| Qwen 缺少 base URL | 1 | `RAG_EMBEDDING_BASE_URL` | fail-closed |

负向检查未输出实际变量值、完整日志或 provider 响应。

## 6. 精确数据清理

最终 official smoke 前记录 UTC 时间水位 `2026-07-14T13:15:42.1599192Z`，并确认已有 7 个旧 smoke 合成账号。smoke 后使用“时间水位 + 固定前缀”只读定位，先验证本轮账号 count 恰好为 1，再读取该行的 exact id 与 exact email 执行单行删除。

清理结果：

- exact target count：1；
- exact deleted count：1；
- 同一水位后剩余账号：0；
- 旧 smoke 账号仍为 7；
- 未使用 wildcard delete，未删除任何旧 smoke 账号。

修复前的诊断 run 也每次先验证水位后 count=1，再按 exact id+email 删除，每次复核水位后为 0、旧账号仍为 7。

## 7. 局限与后续

- 本次证明当前固定 smoke 资料与 3 个 case 在真实 Qwen/1536 runtime 上闭环通过，不等于所有语言、文档格式、query 或 provider 故障都已覆盖。
- official smoke 的 3 个 case 均为 `shouldHaveHit=true`，没有 no-hit case；因此 No-hit Pass Rate 为 N/A，本次验收不证明真实 provider 下的 no-hit 行为。
- Docker Desktop 的多服务 Compose Bake gRPC 会话缺陷仍是宿主工具限制；本次使用分离 build + `up --no-build` 完成等价验收，未把宿主 workaround 固化进生产 Compose 或 Dockerfile。
- 在从 `docker/` Compose 文件启动时，根 `.env` 必须显式参与 Compose 插值；仓库脚本已将该边界固化并有 readiness 回归测试。
- 后续若修改 embedding model/dimensions、hybrid SQL、queue processor、smoke fixture/query 或 Docker 变量传递，应重跑本验收并重新执行同样的精确数据清理。

## 8. Main 合并后复验（2026-07-14）

Phase 7.8.5 通过 `--no-ff` 合并进 main 后，在 `731a63e5e0b392b74ff0df2195f8043e2dfa16fd` 上重新执行静态门禁与真实 Docker runtime parity smoke。本节只记录 main 复验，不替换前文的功能分支证据。

### 8.1 Main 静态门禁

| 项目 | 结果 |
| --- | --- |
| server tests | 734 passed，2 skipped |
| server lint | exit 0 |
| server build | exit 0 |
| `packages/types` typecheck | exit 0 |
| Compose `config --quiet` | exit 0 |
| `git diff --check` / worktree | exit 0 / clean |

Compose 静态检查仍只使用显式 `--env-file .env` 与 `config --quiet`，没有输出完整解析配置。

### 8.2 Docker runtime 与 official smoke

复验显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`，并使用如下非构建命令：

```powershell
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --no-build server worker
```

命令 exit 0；server 为 `running`，worker 为 `running/healthy`。web/admin 未重建或停止，PostgreSQL、Redis、MinIO 与现有 volume 保持不变。server/worker 的非敏感 parity 字段均为 `qwen` / `text-embedding-v4` / `1536`；未读取或输出 base URL 与 key。

`bun --filter @repo/server smoke:rag-eval` 结果：

| 项目 | 结果 |
| --- | --- |
| exit / duration | 0 / 2699 ms |
| cases | 3/3 passed |
| Recall@K | 100.0% |
| Top1 Accuracy | 100.0% |
| Safety Pass Rate | 100.0% |
| No-hit Pass Rate | N/A（0 个 no-hit case） |
| runtime evidence | `mode=hybrid`, 3 hits checked |
| exact keyword / semantic vector | `keywordScore > 0`；2 个 semantic case 均 `vectorScore > 0` |
| duplicate chunk | 每个 query 均无重复 `chunkId` |
| BackgroundJob | 1/1 `SUCCEEDED` |
| document cleanup | 账号删除前已为 0 |

fresh case inspection 确认 official smoke 选中 3 个 case，且 no-hit case count 为 0，因此本节不把 runner 的空分母默认值写作真实 no-hit 证据。

### 8.3 Main 复验清理

official smoke 前记录 UTC 时间水位 `2026-07-14T15:07:44.0455283Z`，并确认已有 7 个旧 smoke 合成账号。smoke 后通过“时间水位 + 固定前缀”只读定位到唯一账号，先验证 count=1，再仅使用该行的 exact id+email 删除。删除后同一水位的剩余账号为 0，7 个旧 smoke 账号保持不变。全程未使用 wildcard delete、DB reset/truncate、Redis flush、MinIO wipe、volume 删除或 `down -v`。
