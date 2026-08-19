# Phase 6.9.8 真实模型产品运行时可用性验收

日期：2026-08-19  
分支：`drb/phase-6-9-8-real-model-usable`  
基线：`main=cb833cdd58fa9c34f306c2d96baa31b185398b98`

说明：工作树另有 3 个用户预先留下的 `wrong-question-organizer` 未提交修改；本任务未修改、暂存或提交它们。

## 结论

Phase 6.9.8 的产品 `/api/chat` 已实际使用 DeepSeek 返回回答，结果为 `HTTP 200`、`mode=live`、
`traceRecorded=true`。这证明当前本地 Docker 产品链路可以使用真实模型，不再只有 Mock 可用。

本结论是单次产品 smoke 的运行时可用性证据，不替代 SR5 封存评测，也不建立完整语义基准、计费准确性、SLA 或
`qualityAuthority`。历史 V12 evidence、tag、授权和失败结论均保持只读。

## 问题与修复

真实模型首次启动时 server 分别报告 `live model calls require a supported provider API key` 和
`live model provider and credential selection is ambiguous`。根因不是 DeepSeek 不可用，而是 Compose 只把
`REVIEW_PLANNER_PRODUCT_DEEPSEEK_API_KEY` 投影为 server 通用 key，根 `.env` 已配置的 `DEEPSEEK_API_KEY` 没有进入
server；Retriever/FinalResponse 又强制要求重复填写组件专用 key。

修复后的优先级为：

1. 显式组件专用 key 优先，便于生产按能力隔离或轮换 secret。
2. 本地 Docker 未提供组件 key 时，可回退到根 `DEEPSEEK_API_KEY`。
3. 显式非空组件 key 若格式非法则 fail-closed，不允许 fallback 掩盖配置错误。
4. 模型 gate 仍默认关闭；只有 `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true` 和对应组件 gate 同时开启才调用模型。

Compose 只把回退结果投影到对应服务和组件变量，浏览器 client bundle、worker 和 admin 不接收这些能力凭据。仓库、日志、
文档和提交均不保存 key 值。

## 分支验收证据

使用一次性合成账号发送关于幂等性的中文问题。响应内容为 DeepSeek 生成的中文解释，不是本地 Mock 固定文本：

```text
status=200
mode=live
trace=true
```

请求后精确删除该合成账号及其级联数据：

```text
DELETE 1
```

工程门：

```text
Web tests                         491 passed, 0 failed
Server Compose boundary tests     25 passed, 0 failed
docker compose config --quiet     exit 0
Web lint                          exit 0
Web production build              exit 0
git diff --check                  exit 0
```

## 默认关闭恢复

Live smoke 后只使用 `--force-recreate server web` 恢复日常环境，未执行 `down -v`、prune、数据库 reset、Redis flush 或
MinIO wipe。恢复后：

```text
server health                                  healthy
server AI_PROVIDER_MODE                        mock
server AI_ENABLE_LIVE_CALLS                    false
web AI_PROVIDER_MODE                           mock
web AI_ENABLE_LIVE_CALLS                       false
web RETRIEVER_QUERY_REWRITE_MODEL_ENABLED      false
web FINAL_RESPONSE_AGENT_MODEL_ENABLED         false
```

Docker 命名卷和已有数据保持不变，可见浏览器窗口保持打开。

## 待完成

- 合并并推送 `main` 后，再执行一次真实模型产品 smoke；随后立即恢复默认 Mock、精确清理合成账号，并记录最终 commit parity。
