# Phase 6.9.7 Tutor / WrongQuestionOrganizer V8 R2 Provider-like Robustness 验收

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论

V8 R2 已完成，结论限定为 **zero-provider robustness checkpoint**。

R1 已把 Organizer 输出收敛为固定四字段 decision，但只验证 canonical 对象仍不足以解释真实 Provider
可能返回的 JSON 形态。R2 新增独立 held-out fixture、真实第一方 direct adapter 的进程内 fetch stub、
Provider-like schema-negative 与 metamorphic 测试，并将 V8 标记为必须接收完整原生 JSON content。结果证明：

- canonical、Unicode escaped 与 decision reorder 可以通过同一 V8 contract；
- wrapper、旧 V6 nested Shape、snake_case、类型漂移、缺失/额外字段和动态 authority 越权全部拒绝；
- Markdown fence、prose、BOM、trailing comma、single quote 等非原生 JSON content 在 schema 前拒绝；
- 静态畸形 decision 位于 first/middle/last 任意位置都不会漏过；
- owner/snapshot/stale、真实 ID、locked name、confidence 与写权限仍由本地掌握；
- 诊断和 fallback 不保存或回显 Provider content、未知 key、credential 或私有 ID。

该结论不等于正式 Mock、controlled-Live 或产品可用性验收。R3 runner/lineage/durability、R4 reviewed
Mock/full checkpoint、R5 唯一 Live、R6 产品验收和 R7 main 合并仍按级阻断。

## 2. 独立 fixture 与 anti-overfit

新增 fixture：

`packages/agent/tests/fixtures/phase-6-9-tutor-wrong-question-v8-r2-provider-shapes-v1.ts`

- version：`phase-6.9.7-tutor-organizer-v8-r2-provider-shapes-v1`；
- frozen SHA：`sha256:f0a93a83000cb1f3515057482eca7ebbbb0ce0ef441cfd1cb7075073e000793f`；
- 手写 3 道中英混合 held-out 错题、3 个本地 deck 与 canonical Provider payload；
- fixture 只导入 `node:crypto`，不导入 V2 dataset、expected/oracle、production candidate、validator、
  merger 或 reviewed Mock responder；
- 测试额外扫描 fixture 源码，拒绝 `expected/oracle` 和生产答案生成链进入 fixture。

进程内 synthetic fetch 仍穿过真实
`createFirstPartyDeepSeekV4ProDirectAdapter -> ModelAgentRuntime -> V8 candidate -> V6 local merger`；
executor provenance 固定为 `synthetic_test`，没有访问网络或 Provider。Request 断言不含 owner/question/deck
真实 ID，response 由 fixture 手写，不从 production validator 反向生成。

## 3. 原生 JSON content policy

新增 `model-agent-structured-output-policy.ts`，使用不可序列化、非变异的 WeakSet 按**精确 schema 对象身份**
标记严格 content policy。只有 V8 diagnostic collector 包装后的 schema 被标记：

- V8：Provider message content 必须自身就是完整 JSON；不剥离 Markdown fence 或 prose；
- V7/历史 schema：没有标记，原 exact JSON fence 兼容逻辑保持不变；
- 标记不写入 schema 属性，不改变 contract/prompt SHA，也不会进入 request、Trace 或 evidence；
- 非对象、hostile Proxy 或不同 schema identity 均 fail-closed 为未标记。

Direct adapter 仍保持阶段分离：JSON 解析失败为 `provider_json_parse`，成功解析后 Zod 失败为
`provider_type_validation`。V8 candidate 将后者安全归一为 `fallback_schema_invalid`，保留原
attempted、budget、usage、Trace 与 reason tail；不会把 schema failure 伪装为 zero-call。

## 4. 覆盖矩阵

Provider-like 测试覆盖：

- 顶层：`{data: ...}`、`{output: ...}`、array、null、double-encoded JSON、缺 fingerprint；
- content：Markdown fence、prose prefix、BOM、trailing comma、single quote；
- fingerprint/decisions：类型、大小写、空数组、超过 12、null decision；
- decision Shape：extra key、旧 V6 nested、snake_case、numeric string、浮点、负数、越界整数、未知
  `deckAction`；
- 数组遍历：null、extra key、未知 action，以及 question/subject/target index 的 string、float、负数与
  越界整数均覆盖 first/middle/last；
- 动态 authority：fingerprint mutation、少题、重复/越界 question index、structured subject 越权、
  taxonomy subject 缺失、不可用 action、跨 subject deck、topic/deck ordinal 越界；
- hostile/no-leak：cycle、Proxy、4097-key wide object、未知 key 名和值不进入 diagnostic fingerprint。

Metamorphic 测试覆盖 source/question/deck/keyword/knowledge-point reorder、双语/Unicode、本地 subject
taxonomy、pre/post stale fence、owner snapshot ABA、动态拒绝不修复、真实 ID/locked name/confidence 本地
重建和 zero retry。

## 5. 验证证据

聚焦回归：

```text
model-agent-strict-json-content-policy.test.ts
wrong-question-organizer-v8-r2-provider-shapes.test.ts
wrong-question-organizer-v8-r2-metamorphic.test.ts
wrong-question-organizer-v8-model-contract.test.ts
wrong-question-organizer-v8-model-candidate.test.ts
24 pass / 0 fail / 680 assertions
```

全量与兼容门：

- Agent：`878/878`，`12579` assertions；
- AI：`226/226`，`1459` assertions；
- Agent/AI typecheck、lint：通过；
- V7 direct-adapter compatibility：通过，历史 exact fence 行为不变；
- 受影响源码、测试和文档 Prettier：通过；
- `git diff --check`：通过。

历史不可变证据按原 canonical 路径只读复验：

- Phase 6.9.4.3：`ok=true / profile=live / runStatus=complete`；
- Phase 6.9.6：`ok=true / evidenceCount=4`；
- Phase 6.9.7 V1--V7：各 `ok=true / filesChecked=1`。

两路独立只读审查确认 strict JSON WeakSet policy、V7 默认兼容、V8 disposition 归一、anti-overfit、
no-leak 与动态 authority 均无 Critical/Important。审查指出的静态 malformed decision 首/中/尾覆盖缺口已
在提交前补齐并通过聚焦及 Agent 全量回归。

## 6. 明确未发生与下一步

本任务未读取根 `.env`/credential，未调用 Provider，未执行正式 Mock/Live，未启动 Docker/API/浏览器，
未创建 V8 marker/journal/evidence，未修改 V1--V7 artifact/SHA，未执行 seal/recovery，未接产品 gate，
未修改 PostgreSQL/Redis/MinIO/业务数据，也未合并 main。

下一原子任务仅 V8 R3：建立独立 report/runner/CLI/approval/marker/hash-chain journal/hard-link evidence/
crash-only recovery/validator，并完成 V1--V7 双向 lineage 隔离。R3 仍为 zero-provider，不创建正式
Mock/Live artifact，不读取 credential，不启动产品 Docker/API/browser。

回顾时可以问：

- 为什么 `json_object` 不等于本地 Zod contract？
- 为什么 V8 拒绝 Markdown fence，而 V7 的 exact fence 兼容仍必须保留？
- WeakSet schema identity 如何避免把 transport policy写进公开 schema 或 request？
- 为什么 static Shape 通过后还必须执行 owner-scoped dynamic authority？
- 为什么 synthetic direct adapter 能证明 wire/contract 边界，却不能证明真实模型质量？
- R3 为什么必须使用独立 lineage，而不能复用已经封存的 V7 runner/evidence？
