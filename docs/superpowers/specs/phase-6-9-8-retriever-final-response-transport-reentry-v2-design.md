# Phase 6.9.8 Retriever / FinalResponse Transport Re-entry V2 设计

> 日期：2026-08-07
> 状态：D0、C1、C2 zero-provider runner/durability、S1 reviewed Mock/static、L1 implementation 与唯一 L1 controlled-Live
> 均已完成；run `ce0c3257-a5d9-4389-90ec-814d5e9cde34` 在 source `ee3dbf91c863a3a5cd95c810a9c0cec0b26f64c6` 上
> 以 `transport_reentry_v2_l1_controlled_canary_passed / qualityAuthority=none` durable seal。root `.env` 的
> `unknown_key` 是 Live 前历史诊断，当前下一任务为 P1 zero-provider semantic-gate
> 当前分支：`drb/phase-6-9-8-retriever-final-response-contract`
> Lineage：`phase-6.9.8-retriever-final-response-transport-reentry-v2`
> 当前 checkpoint authority：`controlled_live_transport_reentry_v2 / qualityAuthority=none`；L1 implementation/root-env diagnosis
> 与 S1 的 zero-provider authority 保留为历史 checkpoint

## 1. 决策摘要

Transport Evidence Recovery T3 的唯一 controlled canary 已在
`configuration_invalid` 封存，旧 run、marker、journal、artifact、授权和一次性名额均不可重用。T3-C
只提供了静态配置入口 guard，不能把修复假设升级为真实 Provider 证据。

本设计建立全新的 V2 re-entry lineage，目标是先验证“配置组合、凭据隔离、source/proxy gate 和 crash-only
边界”能够在零 Provider 条件下稳定工作，然后才决定是否申请一次新的最多三槽 transport canary。V2
不重跑 T3，不恢复旧 artifact，不接入 `/api/chat`，不启动 Docker/API/browser，不修改业务数据。

## 2. 目标与非目标

### 2.1 目标

- 用新 namespace、new confirmation、new marker/journal/artifact 和新 source manifest 隔离旧 T3；
- 把 root `.env` 的 operator-friendly generic keys 只在受控 launcher 内投影为 V2 dedicated credential，
  使 runtime core 不读取产品 gate、其它 Agent key 或任意 `process.env`；
- 在 credential 读取前完成 exact args、source、T2/T3-C parity、proxy 和数据边界 gate；
- 在 Provider authority 消费前完成 credential shape/configuration preflight；configuration failure 不创建
  marker、不启动 Provider、不污染正式 evidence；
- 固定三槽顺序 `rewrite -> qwen -> final_response`、独立预算、首错 breaker、dispatch-before-call journal、
  hard-link artifact、strict validator 与 crash-only seal；
- 明确区分 transport evidence、semantic quality、产品验收和 main authority。

### 2.2 非目标

- 不读取或改写 T3/R5/Task 9C 的 sealed artifact、marker、journal、tag、SHA 或 validator；
- 不自动读取真实 `.env`、credential 或调用 Provider；D0/C1/C2/S1 全部使用 synthetic env/ports；
- 不执行真实 Retriever/FinalResponse 语义评测、不计算质量门、P95、verified cost 或产品 SLA；
- 不把 root generic key 的存在写成模型可用，不把 proxy ready 写成 Provider health；
- 不在 V2 完成前进入 Task 10/11、产品 Docker/API/browser、`main`、Phase 6.10 或博客收尾。

## 3. 独立身份与不可复用边界

V2 顶层 identity 固定为：

```text
phase-6.9.8-retriever-final-response-transport-reentry-v2
```

未来受控入口的固定确认文本只在代码/验收中以常量存在，不在 D0 执行：

```text
I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_DEEPSEEK_AND_QWEN_DATA_BOUNDARY
I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_CONTROLLED_CANARY_ONCE
```

V2 证据路径使用独立前缀：

```text
.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.once.json
.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.journal.jsonl
.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2-<runId>.json
.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.recovery.json
```

任何 V2 reader/validator 必须双向拒绝旧 T3、R5、Task 9C 和其它 Agent lineage 的 version、confirmation、
marker、journal、artifact 和 recovery claim。V2 只读复用纯 parser、wire projection、fsync、hard-link 和
source parity 工具，不导入旧 top-level authority。

## 4. Credential composition 与权限边界

### 4.1 两层入口

V2 将 operator convenience 与 runtime isolation 分成两层：

1. **root launcher**：由仓库根 `package.json` 的命令启动，但不使用会在进程启动前注入全部变量的 ambient
   `bun --env-file`。只有 exact data-boundary + authorization 通过后，launcher 才根据自身 `import.meta.url`
   解析仓库根 `.env`，用有界 parser 提取两个宿主兼容输入：`DEEPSEEK_API_KEY` 与 `QWEN_API_KEY`；只保存在授权
   进程内存，不输出、不写日志。
2. **V2 runtime core**：只接收 module-owned、single-use 的 dedicated projection capability，不读取
   `process.env`，不接收 generic key、其它 Agent key、gate、URL、model、retry 或 persistence port。

strict synthetic parser 继续只接受 UTF-8/UTF-8 BOM、CRLF/LF、单行 `KEY=value` 与有界单/双引号值；不做变量插值、
不接受 multiline，冲突重复键、空值、越界、非 ASCII、未知 key、accessor-backed 或 extra-field 均 fail-closed。
生产 root launcher 另有 selective root profile：共享根 `.env` 可以包含正常的数据库、RAG、Chat 等项目设置，但只
提取 `DEEPSEEK_API_KEY`、`QWEN_API_KEY`、宿主兼容 `Qwen_API_KEY`/`DASHSCOPE_API_KEY`；其它字段不进入 projection。
Qwen alias 统一为 canonical `QWEN_API_KEY`，多个 alias 同时存在时 `alias_conflict` fail-closed。目标值仍执行同一
有界、无插值、无 multiline、ASCII 约束，raw file/raw value 不进入 report。Launcher 把一个 DeepSeek 宿主 key 投影
为两个 capability-scoped 字段（rewrite 与 FinalResponse），把 Qwen 宿主 key 投影为 embedding 字段；投影不会改变
底层 secret，也不会把 generic key 注入 Web/server/worker/admin 或产品 Chat。

这两个 parser profile 的分离是对真实 root `.env` admission diagnosis 的修复，不放宽 C1 synthetic hostile-input
contract，也不是旧 T3 retry。诊断记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-root-env-diagnosis-zero-provider.md`。

### 4.2 读取顺序

```text
exact argv
  -> source branch/HEAD/upstream/origin parity
  -> T2 + T3-C zero-provider parity
  -> fresh proxy preflight
  -> data-boundary acceptance
  -> exact authorization
  -> resolve root .env from launcher location
  -> bounded root-env parse/credential composition
  -> dedicated capability projection
  -> exclusive marker/reservation
  -> provider slots
```

任何前置 gate 失败都不得读取 credential。credential composition 失败发生在 marker 前，因此不消费 V2
一次性 marker；只有 marker durable reservation 后才允许构造第一方 transport。该顺序与旧 T3 不同，是本 V2
re-entry 的主要架构修复，但不改写旧 T3 的事实。

### 4.3 观察与持久化权限

| 模块               | 可做                                                                       | 禁止                                                                   |
| ------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| root launcher      | 读取固定 generic key、生成一次性 dedicated projection、输出 bounded status | 输出 key/value、读取其它 env、写业务/Trace、调用 Provider              |
| V2 runtime core    | 消费一次 projection、运行固定三槽、写 V2 evidence                          | 读取 `process.env`、接受调用方 URL/model/fetch、改写旧 lineage         |
| transport adapters | 使用固定 model/endpoint/timeout/预算，签发 provider wire                   | 读取 credential、重试、写 marker/journal、改变 owner/answer            |
| crash-only seal    | 读取 durable prefix 并发布同一 attempt 的 bounded terminal                 | 读取 credential、构造 transport、补发 Provider call、recovery 成功结果 |
| 产品 `/api/chat`   | 维持 default-off 现状                                                      | 接入 V2、创建 BackgroundJob/Outbox/Trace 或业务写入                    |

## 5. 固定 canary contract（仅未来 L1）

V2 未来 L1 最多三个 Provider slots，固定顺序和预算，不接受 CLI 覆盖：

| slot | adapter                       | model/endpoint                                          | hard timeout |                input/output |       cost cap |
| ---- | ----------------------------- | ------------------------------------------------------- | -----------: | --------------------------: | -------------: |
| 1    | DeepSeek rewrite              | `deepseek-v4-pro` / fixed `/v1/chat/completions`        |       4000ms |                  1200 / 160 |    `0.005 CNY` |
| 2    | Qwen embedding                | `text-embedding-v4` / fixed Beijing compatible endpoint |       5500ms | fixed synthetic text / 1536 | `0.004096 CNY` |
| 3    | DeepSeek FinalResponse stream | `deepseek-v4-pro` / fixed stream endpoint               |      20000ms |                 2500 / 1200 |    `0.015 CNY` |

总 cap 固定 `0.024096 CNY`。每个 slot 最多一次；首个 strict/transport failure 打开 breaker，未启动 suffix
保留在分母；不 retry/resume/replay/backfill。输入使用 fact-free synthetic payload，不携带用户正文、真实题目、
知识库 chunk 或产品 Trace。

V2 L1 的通过最多只能形成
`controlled_live_transport_reentry_v2 / qualityAuthority=none` transport authority：必须同时有
strict response、verified usage、wire/stage 完整、artifact validator `ok=true` 和无安全/预算/持久化异常；即使
通过，也不能直接宣称 Retriever/FinalResponse semantic 或产品可用。

## 6. 阶段与交付顺序

| 阶段 | 交付                                                                   | Provider calls | 解锁                              |
| ---- | ---------------------------------------------------------------------- | -------------: | --------------------------------- |
| D0   | 本设计、计划、停止边界和 reader questions                              |              0 | C1                                |
| C1   | root-launcher path/credential projection contract、hostile-input tests |              0 | C2                                |
| C2   | V2 runner、marker/journal/artifact、strict validator、crash-only seal  |              0 | S1                                |
| S1   | 三个 synthetic adapter、wire/usage/fault matrix、reviewed Mock/static  |              0 | L1 授权门                         |
| L1   | 新数据边界 + exact authorization 下唯一三槽 controlled canary          |             ≤3 | 仅 transport authority 或失败封存 |
| P1   | 依据 L1 终态冻结小样本 semantic gate                                   |              0 | 新的语义路线决策                  |

每个阶段单独提交并推送当前 feature branch；不从该分支再开嵌套分支，不合并 `main`，除非后续形成完整
semantic/product authority 并完成 Docker/API/browser/main 回放。

## 7. Zero-provider D0/C1/C2/S1 通过定义

- 真实 `providerCalls=0`、`credentialReads=0`、formal marker/journal/artifact/recovery claim=`0`；
- synthetic env fixture 能证明 root launcher 的 `.env` 路径来自自身位置，而不是 package cwd 或 ambient process env；
- parser 对 BOM/CRLF/引号/重复键/插值/多行/未知字段保持固定 fail-closed 行为；
- hostile ambient `process.env` 即使预先注入同名或其它 Agent key，也不能成为 V2 credential 来源；
- hostile/accessor/extra-field/empty/alias-conflict credential input 全部 fail-closed，且 raw value 不进入输出；
- dedicated projection capability 为 module-owned、single-use、lineage-bound，伪造、复用、跨 family/call 均拒绝；
- C2 opaque configuration capability 在 marker 前消费，fixed three-slot synthetic runner 首错 breaker/no-retry；
- S1 三个 bounded synthetic first-party adapter 必须通过同一 C2 runner，success wire=`3/3/3/3 + 3/3/3/3`、
  usage=`480/120/600`，fault matrix 与 abort/no-retry 均 fail-closed；
- S1 source admission 只统计当前 V2 marker/journal/recovery/report/root artifact 的路径占用；历史 lineage 与普通日志
  不参与计数，匹配名称的任意目录项均阻断，缺失 `.tmp` 视为空且其他读取错误 fail-closed；
- S1 reviewed Mock 的 gate 固定为 `transport_reentry_v2_s1_mock_quality_not_evidence`，不得写成 semantic/product
  authority；子代理复审若因工具 429 未形成证据，必须如实记录；
- synthetic marker/journal/report/hard-link artifact/strict validator 与 crash-only recovery 只存在隔离临时目录并精确清理；
- T3 validator 只读通过，T3/R5/Task 9C SHA parity 不变；
- 文档明确记录：D0/C1/C2/S1 不证明 Provider health、模型语义、产品/API/browser、SLA 或 main。

## 8. 停止门

任一 gate、预算、wire、journal、artifact、validator 或安全边界失败，停止当前阶段并封存 bounded diagnostic；
不能自动推进下一阶段。L1 一次性名额一旦 marker durable 即消费，无论结果成功或失败均不得重跑。

当前 S1 完成后的 L1 授权门已被唯一 run 消费；不得再次读取 credential 或调用 Provider。下一原子任务是 P1
zero-provider semantic-gate 设计，不能把本次 transport success 当作 semantic/product authority。

## 9. L1 implementation checkpoint（2026-08-08，zero-provider，Live 前历史）

L1 的 production-shaped launcher、固定三槽 runner、source/proxy/data-boundary/authorization gate、deferred
adapter handoff、strict journal state machine、existing-artifact recovery 与 recovery-claim validator 已完成。
focused `13/13`、C1+C2+S1+L1 `47/47`、Agent full `1409/1409` 通过；targeted ESLint、Prettier、Bun build
通过。实现阶段未读取真实 `.env`、credential、Provider，也未创建正式 evidence。真正的 adapter constructor 只在
exclusive marker/reservation durable 后执行，marker 前仅做 capability shape/lineage/family/call preflight。

该 checkpoint 不是 Live authority；随后唯一 controlled-Live 已在新 source 上执行并封存。无论终态如何，不能解锁
semantic/product/Docker/API/browser、SLA 或 `main`。

## 10. L1 controlled-Live sealed result（2026-08-08）

唯一 run `ce0c3257-a5d9-4389-90ec-814d5e9cde34` 在 `direct_ready` proxy 下完成 `rewrite -> qwen -> final_response` 三槽：
Provider/credential reads=`3/3`、usage=`145/28/173`、verified cost=`0.000573 CNY`、journal=`16`、validator=`ok=true`，
gate=`transport_reentry_v2_l1_controlled_canary_passed`，authority=`controlled_live_transport_reentry_v2`、
`qualityAuthority=none`。marker、journal、report 与 root hard-link artifact 已 durable seal；marker SHA、logical/physical
report SHA 与 artifact SHA 的完整值见 sealed acceptance。

该终态只证明受限 transport/wire/usage/durability，不能证明 Retriever/FinalResponse 语义、P95/SLA、产品/API/browser、
Trace、BackgroundJob/Outbox 或 `main`。一次性名额已消费，禁止 retry/resume/replay/backfill、recovery/seal 或追加探测。
完整记录见 `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-controlled-live-sealed.md`。

## 11. Reader questions

1. 为什么 generic root key 可以作为 operator input，却不能进入 V2 runtime core 或产品容器？
2. 为什么 V2 要在 marker 前完成 configuration preflight，而旧 T3 的 sealed 结果不能被修复后重跑？
3. 为什么三槽 transport 全部成功仍不能证明 Retriever/FinalResponse 的语义质量？
4. 哪些字段会被持久化，哪些 raw/provider/credential 信息必须永久丢弃？
5. 为什么 V2 必须使用新 confirmation、source manifest 和 evidence prefix？
