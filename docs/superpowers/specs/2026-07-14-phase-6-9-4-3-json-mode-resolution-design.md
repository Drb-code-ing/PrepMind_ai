# Phase 6.9.4.3 JSON Mode Resolution Design

> 日期：2026-07-14
> 状态：零网络实施、Mock 验收与唯一 controlled-Live 已完成；Router 延迟门槛失败，终局 deterministic fallback，待本分支文档合并 main
> 范围：Router / Verifier controlled-Live paired eval transport 收敛

## 1. 目标与终局

Phase 6.9.4.3 已完成 deterministic、Mock、预算/安全 contract、四次历史 JSON-mode/structured-output Live、Attempt E strict-tool Live，但仍未得到 complete Live 质量证据。Attempt E 在首个 eligible case 以 `http_client` 4xx 停止；现有低基数分类无法区分参数、余额或模型级 Provider compatibility。

本设计的目标不是继续增加 transport 变体，而是用已经在 Phase 6.9.3.5 真实验证过的 DeepSeek JSON Output 路径完成一次收敛验收：

- controlled-Live 固定使用 OpenAI-compatible `response_format: { type: 'json_object' }`；
- canonical Zod 仍是最终结构、长度、关联约束与安全语义的权威；
- 保留不可变预算、10 秒超时、`maxRetries=0`、usage provenance、成本上限、zero-call safety gate 和脱敏 Trace；
- `deepseek_strict_tool_v1` 保留为历史实验 transport，不与新的 JSON-mode evidence 拼接；
- 新一轮如果仍未达到完整门槛，本阶段停止继续更换 transport，结论固定为“DeepSeek 当前模型未达到 Router / Verifier candidate 门槛”，生产继续 deterministic。

## 2. 证据与公开 API 约束

官方 DeepSeek JSON Output 文档说明：请求需使用 `response_format` 的 `json_object`，并在 system/user message 中明确要求 JSON；Chat Completion 文档说明该模式保证消息内容为合法 JSON，但 `finish_reason=length` 时内容仍可能被截断。官方 Quick Start 列出 `deepseek-v4-flash` 为可用模型，普通 OpenAI-compatible base URL 为 `https://api.deepseek.com`。

本仓库已有真实证据：Phase 6.9.3.5 的 DeepSeek Live 摘要使用共享 executor 的 JSON mode 成功返回，并通过 strict Zod、预算、超时与双开关；对应 mocked-fetch contract 已验证 `response_format=json_object`、无 tools、JSON instruction 和非法对象拒绝。

这些事实证明 JSON mode 是当前最有根据的兼容路径，但不预先承诺 Router / Verifier 100 条 case 的语义质量。真实质量仍必须由完整 paired run 证明。

## 3. 方案比较与决策

### 方案 A：继续 strict-tool

保留 Beta endpoint 和 synthetic function，先扩展 4xx 分类再重跑。优点是 Provider schema 约束强；缺点是当前失败发生在 Provider 接收边界，模型级兼容性未知，会继续消耗轮次。

### 方案 B：JSON mode + canonical Zod（采用）

回到已在同一模型和共享 executor 上真实通过的 `json_object` 路径。Provider 只保证合法 JSON，所有结构、长度、权限和 verifier 语义仍由本地 canonical Zod、candidate sanitizer 和 deterministic fallback 验证。优点是兼容证据最强、改动边界最小；缺点是没有 Provider 级 JSON Schema enforcement，模型可能返回合法但语义不合格的 JSON，必须由完整质量门槛拦截。

### 方案 C：直接放弃 Live candidate

保持 deterministic，不再调用真实模型。安全性最高，但无法回答 Router / Verifier 是否可用，不符合当前阶段目标，因此作为 JSON mode 仍失败后的终局，而不是本轮首选。

## 4. 设计

### 4.1 Transport 与 evidence identity

- 新 transport identity：`deepseek_json_object_v1`；
- 新 runner identity：`phase-6.9.4.3-runner-v3`，只读兼容历史 v1/v2；
- provider：`deepseek`；model：`deepseek-v4-flash`；base URL：精确 `https://api.deepseek.com`；
- request 必须包含 `response_format: { type: 'json_object' }`，不得包含 `tools`、`tool_choice` 或 `json_schema`；
- system prompt 与 user prompt 必须包含固定 JSON instruction，避免官方文档警告的空白流；promptVersion 升级，旧 evidence 不可拼接；
- provider output 先由 AI SDK JSON parser 解析，再由 candidate canonical Zod、权限重建和 verifier sanitizer 验证；任一失败按既有 fail-closed 分类停止。

### 4.2 运行边界

保持现有固定值：100 cases、28 eligible、72 design-time zero-call、Router 800/400、Verifier 1600/400、global 28 calls / 96,000 provider input / 11,200 provider output、单 case 10 秒、`maxRetries=0`、USD 0.10 cap。新 run 必须从 case 1 开始，不补跑单 case，不与 Attempt A~E 拼接。

### 4.3 安全与隐私

- API key 仅存在于单次 controlled-Live 子进程；不进入参数、日志、evidence 或文档；
- evidence 只保存固定分类、计数、usage provenance、latency、cost 和 transport identity，不保存 prompt、query、chunk、完整模型输出、raw provider error、status body、headers、stack 或 cookie；
- `http_auth/http_rate_limit/http_client/...` 的既有低基数分类保持不变，本轮不以读取 raw 4xx 作为解决方案；
- candidate、Trace、decision 任一失败都继续 deterministic fallback，Router / Verifier 不因 JSON mode 可调用而自动启用。

### 4.4 验收门槛

只有同时满足以下条件才能完成 Phase 6.9.4.3：

1. evidence validator 接受 `live / complete / runner-v3 / deepseek_json_object_v1`；
2. 28/28 eligible strict local-schema success，72/72 design-time zero-call；
3. Router / Verifier 各自质量、critical、安全、权限边界、p95、token、usage provenance 和成本门槛全部通过；
4. 无 credential/raw-content 泄漏，所有 fallback 和错误保持 fail-closed；
5. 生产 Chat 与现有 deterministic route 不改变，candidate enablement 只由 paired decision contract 决定。

如果 JSON mode 仍在 Provider、解析、schema、质量或成本门槛失败，本阶段不再新增第三种 transport；记录失败证据，保持 `enabled=false`，并将后续工作转为 Provider/模型替换评估或 deterministic 产品路线。

## 5. 测试策略（先 RED 后 GREEN）

1. 在 AI provider contract 中先增加失败测试：JSON-mode profile 使用标准 base URL，发送 `response_format=json_object`，没有 tools/tool_choice/json_schema；strict-tool profile 的现有测试继续保留。
2. 在 Agent contract 中先增加失败测试：runner-v3 只接受 `deepseek_json_object_v1`，拒绝旧 transport、缺失 JSON identity 和带 tools 的 evidence；Mock 不能伪造 Live transport。
3. 在 paired CLI 中先增加失败测试：新的 Live composition 使用 JSON mode、固定 promptVersion、标准 URL 和新的 evidence filename identity；wrong `--env-file` 与缺失 JSON instruction 仍在 Provider 前 fail-closed。
4. 运行 RED，确认失败原因是缺失新 transport contract；实现最小代码后运行 GREEN，再跑 AI/Agent 全量测试、typecheck、lint、validator 和完整 Mock eval。
5. 只有上述零网络门禁通过后，才在用户授权的独立进程中执行一次完整 100-case Live；任何首个失败、usage 不可验证、超时或门槛失败都停止并落证，不重试。

## 6. 文档与分支边界

- 本设计先单独提交；实施仍在从最新 main 创建的同一任务分支中按“一步一提交”推进；
- 实施完成后同步 acceptance、AI acceptance、README、AGENTS、roadmap、DEVLOG 和本设计的结果；
- 完成后先请求复审，再 `--no-ff` 合并 main、main 复验并推送远程；
- 不启动或清理 Docker，不启动浏览器，除非实际需要前端验收；本任务是后端/CLI 纯评测。

## 7. 参考

- [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode)
- [DeepSeek Create Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion)
- [DeepSeek Your First API Call](https://api-docs.deepseek.com/)
- [Phase 6.9.3.5 真实 JSON mode 验收](../../acceptance/2026-07-11-phase-6-9-3-conversation-memory.md)
- [Phase 6.9.4.3 Paired Eval 验收记录](../../acceptance/phase-6-9-4-3-router-verifier-paired-eval.md)
