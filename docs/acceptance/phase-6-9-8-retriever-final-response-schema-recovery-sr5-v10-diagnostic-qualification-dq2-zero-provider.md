# Phase 6.9.8 SR5 v10 diagnostic qualification DQ2（zero-provider）

## 结论

DQ2 在 DQ1 生产形状 diagnostic seam 上完成 held-out Provider shape robustness qualification。authority 固定为
`zero_provider_sr5_v10_diagnostic_qualification_dq2`，gate 固定为
`schema_adapter_diagnostic_robustness_not_evidence`，`qualityAuthority=none`。

DQ2 不改生产 `createPhase698Task9LiveHarness`、shared adapter 或 runtime；唯一变更是独立测试矩阵。每个 synthetic response
仍实际穿过：

```text
synthetic Provider Response
-> first-party DeepSeek v4-pro direct adapter
-> ModelAgentRuntime
-> Retriever query-rewrite candidate
-> V7 wire diagnostic snapshot
-> Task9 bounded RuntimeError projection
```

## Held-out matrix

矩阵共 `27` 个不复用 DQ1 canonical payload 的 shape：

| family | count | examples | expected bounded category |
| --- | ---: | --- | --- |
| object/envelope missing | 5 | empty/multiple choices, null choice/message, numeric content | `provider_object_missing` |
| content JSON parse | 5 | prose, uppercase/CRLF fence, trailing text, truncated array | `provider_json_parse` |
| rewrite type/schema | 6 | null, array, numeric/object/empty query, wrapper | `provider_type_validation` |
| non-thinking response audit | 4 | reasoning field, positive/malformed reasoning details | `response_audit` |
| usage validation | 7 | missing, zero, negative, fractional, unsafe integer, string | `usage_validation` |

每例断言：

- synthetic fetch 恰好调用一次；
- Task9 reason 与 bounded category/stage 保持固定映射；
- `providerWire={dispatches:1,responses:1,verifiedUsage:0}`；
- diagnostic 深冻结；
- 逐 case raw sentinel 和 `provider_secret` 不进入 Error 或序列化 diagnostic。

## 回归

```text
DQ2 focused: 1 pass / 0 fail / 190 expect()
DQ1 + DQ2: 2 pass / 0 fail / 210 expect()
Agent full: 1663 pass / 0 fail / 25706 expect() / 205 files
typecheck passed
lint passed
CRLF-aware Prettier passed
git diff --check passed
```

## 边界

Provider calls=`0`、credential reads=`0`、formal evidence writes=`0`、business writes=`0`。没有读取根 `.env`，没有调用
DeepSeek/Qwen，没有启动或清理 Docker、PostgreSQL、Redis、MinIO、API 或浏览器，没有写 Trace、BackgroundJob 或
Outbox，也没有修改 v10 marker、journal、report、artifact 或 recovery claim。

V10 run `da94b83b-3638-4e23-aefc-9e3423bf4c77` 继续永久封存。DQ2 不能从 held-out 分类稳定性反推该 run 的实际 Provider
shape，也不形成真实模型质量、Retriever/FinalResponse 语义、SR6 产品链路、SLA 或生产可用性 authority。

## 收口顺序

DQ2 不创建 tag、不接受数据边界、不请求或执行 controlled-Live。固定顺序仍为：原子功能提交并推送普通分支 -> `--no-ff`
合并并推送 `main` -> merged-main focused/typecheck/lint/full replay -> 文档 parity。之后如决定建立新 recovery lineage，必须
从最新 `main` 创建新 source/tag，并重新取得当次数据边界接受与 fresh exact authorization；V10 tag、授权和 evidence
均不可复用。

本次功能收口已完成：功能提交=`9209a8e7`，merge=`2c3bcd17d2fabccacdcf052185d5d8a670dcf998`，功能验收时
main/origin parity 通过。merged-main DQ1+DQ2=`2/2`（`210 expect()`）、Agent full=`1663/1663`
（`25706 expect()`，`205 files`），typecheck/lint、CRLF-aware Prettier 与 diff check 均通过。
