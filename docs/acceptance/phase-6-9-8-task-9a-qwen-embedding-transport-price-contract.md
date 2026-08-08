# Phase 6.9.8 Task 9A Qwen Embedding Transport / Price Contract 验收

## 1. 结论

Phase 6.9.8 Task 9A 已在普通功能分支
`drb/phase-6-9-8-retriever-final-response-contract` 完成，authority 仅为
`zero_provider_qwen_embedding_transport_price_contract / qualityAuthority=none`。

本任务解决的是 Task 9 controlled-Live 前的一个真实工程缺口：既有 Nest `EmbeddingService` 会丢弃
OpenAI-compatible response 的 usage，且 SDK retry、endpoint region 与可核验费用不属于正式 eval contract。
Task 9A 新增隔离的第一方 direct transport，让后续 runner 能单独记录 Qwen dispatch/response/usage/CNY；它不
替换当前产品 RAG service，也不改 public knowledge API。

本任务没有读取根 `.env` 或任何模型 credential，没有调用 Qwen、DeepSeek 或其它 Provider，没有启动
Docker/API/browser，没有创建 approved tag、正式 marker/journal/artifact/recovery claim，也没有修改业务数据或
合并 main。测试全部使用 injected fetch，实际 Provider calls=0。

## 2. 官方价格与 endpoint 证据

2026-08-05 重新核对以下阿里云百炼官方文档：

- [text-embedding-v4 模型信息](https://help.aliyun.com/zh/model-studio/text-embedding-v4)：华北 2（北京）普通文本
  输入价格为 `0.5 CNY / 1M tokens`；新加坡为不同价格，不能混用；
- [OpenAI Embedding 接口兼容](https://help.aliyun.com/zh/model-studio/embedding-interfaces-compatible-with-openai)：
  北京业务空间 base URL 为
  `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`，legacy
  `https://dashscope.aliyuncs.com` 仍兼容；`text-embedding-v4` 支持 1536 维、单文本 8192 tokens、单次最多
  10 条；示例响应包含 `usage.prompt_tokens` 与 `usage.total_tokens`，二者相等；
- [同步接口 API 详情](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api)：再次确认北京
  OpenAI-compatible `/embeddings` endpoint、model/dimensions/input contract。

据此冻结：

- price profile：`qwen-text-embedding-v4-cn-beijing-cny-2026-08-05`；
- endpoint profile：`aliyun-bailian-openai-compatible-cn-beijing-v1`；
- model/dimensions：`text-embedding-v4 / 1536`；
- input price：`0.5 CNY / 1M verified input tokens`；embedding 输出不计费；
- Task 9 最多 32 次单文本 query embedding，最坏情况 cap 为
  `32 × 8192 = 262144 input tokens / 0.131072 CNY`。

该 cap 是 fail-closed 上限，不是费用预测；正式 run 必须按每次 Provider usage 重算并分别列出 Qwen 与 DeepSeek
attempt/usage/CNY。usage、price、region、分母或 terminal 任一不可验证时，aggregate 必须为 `null`。

## 3. 新增合同

### 3.1 Config / endpoint

`packages/ai/src/qwen-text-embedding-v4-provider.ts` 只接受 exact own-data config：

- 规范 visible-ASCII component credential；
- exact `text-embedding-v4`、1536 与冻结 price profile；
- HTTPS、无 username/password/port/query/hash、exact `/compatible-mode/v1`；
- host 只能是 `{WorkspaceId}.cn-beijing.maas.aliyuncs.com` 或北京 legacy
  `dashscope.aliyuncs.com`；新加坡、任意第三方域名、尾斜杠与路径漂移均在 fetch 前拒绝。

模块不读取环境变量。只有未注入依赖的默认 transport 标记
`first_party_qwen_text_embedding_v4_direct`；任何 injected fetch 永久标记 `synthetic_test`，后续 runner 不得把它
升级为 Live authority。

### 3.2 Request / no-retry

请求固定：

- `POST {baseURL}/embeddings`；
- `model=text-embedding-v4`、`dimensions=1536`、`encoding_format=float`；
- 1--10 条非空、trimmed、每条最多 2000 UTF-16 的输入；Task 9 runner 仍固定每次单文本；
- `redirect=error`、`credentials=omit`、`cache=no-store`；
- 调用方 `AbortSignal` 原样下传；pre-abort 与 in-flight abort 映射为固定 `aborted`；
- direct fetch 只执行一次，无 SDK retry、resume、replay、backfill、BackgroundJob 或 Outbox。

Transport 不拥有 hard timeout；Task 9B runner 必须用独立 Qwen lane watchdog 绑定 hard timeout、dispatch journal 与
terminal。这样 timeout/durability authority 不会被埋进不可观察的 provider helper。

### 3.3 Response / usage / cost

只有 HTTP 200 + JSON content type + bounded JSON body 才进入 strict parser。Parser 要求：

- exact top-level `data/id/model/object/usage`，model/object 必须为
  `text-embedding-v4 / list`；
- data 数量与 input 相等；每项 exact `embedding/index/object`，index 唯一、连续、范围合法；
- 每个向量精确 1536 个 finite number，平方范数 finite 且大于 0；返回结果按 index 重排并 deep-freeze；
- usage exact `prompt_tokens/total_tokens`，均为正安全整数、二者相等，且不超过
  `inputCount × 8192`；
- verified CNY 只由本地冻结价格函数按 input tokens 重算到 9 位小数。

HTTP auth/rate-limit/client/server、transport、response、usage 与 abort 只暴露固定 code；错误对象不保留 provider
raw error、credential、endpoint 或响应正文。

## 4. 测试与验证

- focused provider/export：`8/8`，`179 expect()`；
- 完整 `@repo/ai`：`337/337`，`2598 expect()`；
- `@repo/ai` typecheck：通过；
- `@repo/ai` lint：通过；
- Prettier：通过；
- `git diff --check`：通过；
- 仓库 Markdown 相对链接：`343 files / 167 links / missing=0`；
- 正式 Task 9 approved tag、匹配 `.tmp` 文件、tracked `.tmp` evidence：`0/0/0`；
- 两路独立只读复审：security 无 blocker；contract 复审指出价格必须有官方可审计来源，本文件第 2 节与源码
  `QWEN_TEXT_EMBEDDING_V4_PRICE_SOURCE_URLS` 已补齐该证据；其余 cross-realm 与 additive-field 问题属于本 strict
  Bun runtime/fail-closed 选择，不放宽。

Fault matrix 覆盖：

- Beijing workspace/legacy 与 hostile endpoint/config；
- empty/oversized/batch/policy-drift request 与 pre-abort；
- transport、401/403/429/4xx/5xx/redirect，一次调用且错误脱敏；
- content type、invalid/oversized JSON、unknown/missing top-level/item/usage fields；
- wrong model/object/count/index、duplicate index、维度/类型/零向量；
- usage missing/mismatch/zero/over-limit；
- in-flight abort 与精确 price calculation。

## 5. Authority 与停止边界

Task 9A 只证明 Qwen 北京区 price/endpoint/usage 的源码合同和 injected-fault 工程回归。它不证明：

- 当前 `.env` 中 endpoint/key 与本合同匹配；
- Qwen 网络、账号、余额、权限、usage 或 embedding 语义可用；
- 32 次 paired retrieval 的完整分母、Recall/nDCG/P95 或真实 CNY；
- DeepSeek rewrite/FinalResponse、Trace terminal、产品 Docker/API/browser 或 main 可用；
- Phase 6.9.8、Phase 6.9 或后续记忆/MCP 阶段已完成。

唯一下一任务是 Task 9B zero-provider runner/durability：建立独立 report/gate、16 guard + 16 paired retrieval +
16 FinalResponse scheduler、DeepSeek/Qwen 独立 accounting、source admission、exclusive marker、dispatch-before-call
hash-chain journal、hard-link artifact、strict validator 与 crash-only seal。9B 完成、提交、推送与复审前不创建
approved tag；没有 fresh 数据边界接受和 exact Task 9C authorization 时，仍不得读取 credential 或调用 Provider。

回顾时可以问：

- “为什么已有产品 Qwen embedding 还能缺 Task 9 的 verified usage/费用 authority？”
- “为什么北京与新加坡 endpoint 必须绑定不同 price profile？”
- “为什么 injected fetch 永远只能是 synthetic authority？”
- “为什么 provider transport 不自己拥有 runner timeout、marker 和 journal？”
- “为什么 Qwen cap 使用 32×8192 的最坏情况，而不是把未知 usage 当成 0？”
