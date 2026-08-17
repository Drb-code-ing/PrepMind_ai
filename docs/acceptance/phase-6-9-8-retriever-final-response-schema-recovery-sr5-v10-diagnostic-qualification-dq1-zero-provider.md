# Phase 6.9.8 SR5 v10 diagnostic qualification DQ1（zero-provider）

## 结论

DQ1 在不读取 `.env`/credential、不调用 DeepSeek/Qwen、不修改封存 evidence 的边界内，完成了 postmortem bounded
diagnostic 的生产形状 qualification。authority 固定为 `zero_provider_sr5_v10_diagnostic_qualification`，gate 固定为
`schema_adapter_diagnostic_qualification_not_evidence`，`qualityAuthority=none`。

测试实际穿过以下链路：

```text
synthetic Provider Response
-> first-party DeepSeek v4-pro direct adapter
-> ModelAgentRuntime
-> Retriever query-rewrite candidate
-> V7 wire diagnostic snapshot
-> Task9 bounded RuntimeError projection
```

生产 `createPhase698Task9LiveHarness` 仍使用固定第一方 adapter，不接受 fetch、prompt、model、clock 或 scorer 注入。DQ1 仅由
test-only helper 将 synthetic fetch 传入共享内部实现；adapter provenance 必须为 `synthetic_test`，生产路径仍必须为
`first_party_deepseek_v4_pro_direct`。

## 覆盖

同一真实调用链覆盖五类 Provider-like response：

| synthetic case | Task9 reason | adapter failure category | structured output stage |
| --- | --- | --- | --- |
| content 不是合法 JSON | `schema_invalid` | `provider_json_parse` | `provider_json_parse` |
| message 缺少 content | `schema_invalid` | `provider_object_missing` | `provider_object_missing` |
| JSON 不满足 rewrite schema | `schema_invalid` | `provider_type_validation` | `provider_type_validation` |
| 非 thinking 响应包含 reasoning | `response_invalid` | `response_audit` | `null` |
| usage token 非正数 | `usage_invalid` | `usage_validation` | `null` |

每个 case 都确认 `providerWire={dispatches:1,responses:1,verifiedUsage:0}`。synthetic payload 额外携带逐 case 敏感哨兵，
断言 Error 字符串与序列化 diagnostic 均不包含该值；没有保存 raw response、字段值、prompt 或 credential。

## 回归

分支验证：

```text
DQ1 focused + SR5 regression: 39 pass / 0 fail / 148 expect()
Agent full: 1662 pass / 0 fail / 25516 expect() / 204 files
typecheck passed
lint passed
Prettier passed
git diff --check passed
```

收紧 no-leak fixture 后的最小回放另外为 `5 pass / 0 fail / 32 expect()`，覆盖 DQ1 与 SR5 runner，不改变上述全量结果。

## 边界

Provider calls=`0`、credential reads=`0`、formal evidence writes=`0`、business writes=`0`。本任务没有读取根 `.env`，
没有启动或清理 Docker、PostgreSQL、Redis、MinIO、API 或浏览器，没有写 Trace、BackgroundJob 或 Outbox，也没有修改
v10 marker、journal、report、artifact 或 recovery claim。

V10 run `da94b83b-3638-4e23-aefc-9e3423bf4c77` 继续永久封存。DQ1 不重跑、恢复、补写或解释该 run，也不使用 curl、
单 case或产品 API 追加 Provider 探测。本结果只能证明“未来同类失败可由新诊断链路有界区分”，不能证明 v10 当时属于其中
哪一类，不能证明真实模型质量、Retriever/FinalResponse 语义、SR6 产品链路、SLA 或生产可用性。

## 收口顺序

DQ1 不创建 tag、不接受数据边界、不请求或执行 controlled-Live。固定收口顺序为：原子功能提交并推送当前普通分支 ->
`--no-ff` 合并并推送 `main` -> merged-main focused/typecheck/lint 与必要全量回放 -> 文档 parity 提交。之后如决定继续
schema recovery，必须从最新 `main` 创建独立 lineage/source/tag，并重新取得当次数据边界接受与 fresh exact
authorization；V10 tag、授权和 evidence 均不可复用。

本次功能收口已完成：功能提交=`243a4b97`，merge=`dde5c24a13274d3c647fa7830839de8923b97ed8`，功能验收时
main/origin parity 通过。merged-main focused=`39/39`（`148 expect()`）、Agent full=`1662/1662`
（`25516 expect()`，`204 files`），typecheck/lint、CRLF-aware code Prettier 与 diff check 均通过。
