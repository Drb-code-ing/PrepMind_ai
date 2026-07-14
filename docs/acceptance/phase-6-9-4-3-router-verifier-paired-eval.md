# Phase 6.9.4.3 Router / Verifier Paired Eval 验收记录

## 1. 阶段结论

Phase 6.9.4.3 的评测工程、Mock 验收与四次受控 Live 尝试已经形成可复核证据；2026-07-14 又完成了 structured-output resilience 的**零网络实施 checkpoint**。但仍**没有得到 complete Live 质量证据，阶段验收未完成**。Router / Verifier 模型候选均为 `enabled=false`，生产 Chat 继续使用 deterministic policy。

本阶段得到的结论是：

- 同一 `phase-6.9-router-verifier-v1` 数据集已经完成 fresh deterministic、Mock 与 controlled-Live 尝试；canonical Live run 明确为 incomplete，dataset digest 始终为 `sha256:b21def37330d2da109901ff9e927a612dc62cdecf1cb9383c3b8bea08c7bb019`。
- deterministic baseline 仍为 74/100、critical failure 2；Mock contract run 为 complete，28 条 eligible case 全部 strict success，72 条 ineligible / safety case 保持零 provider 调用。
- controlled-Live 使用 `deepseek-v4-flash`、固定 JSON structured output、单 case 10 秒、串行执行、无自动重试。
- 四次已越过 provider boundary 的运行均原样保留。Attempt A 在第 3 次 provider attempt 停止；Attempt B/C 都在第 1 次停止；400-token headroom 后的 Attempt D 在第 16 次停止，之前已有 15 次 strict success。
- Attempt D 是当前 canonical Live evidence：identity/schema/privacy validator 全部通过，固定失败 case `router_ambiguous_mixed_chat_16` 由共享 diagnostics 分类为 `PROVIDER_ERROR / structured_output`；它仍为 `incomplete`，Router / Verifier 都是 `enabled=false / usage_unverifiable`。
- Attempt C 与历史 `61/120`、`108/120` output usage 触发了 400/400 headroom 和 11,200 global cap 修复；Attempt D 的 15 条成功 output 为 59~341，证明成功深度明显改善但不支持继续盲目抬高 cap。该证据随后触发的零网络 prompt/schema/provider compatibility 韧性设计与实现现已完成；生产 Chat 仍不接入 candidate。
- 韧性 checkpoint 已把普通 `json_object` 与显式 `deepseek_strict_tool` 分开，完成 Provider schema 兼容投影、Beta strict-tool transport、无副作用的 forced `model_agent_result`、最早 Live preflight 和 runner v2 evidence identity。这些只是零网络工程证据，没有调用真实模型。

## 2. 数据集与调用边界

| 项目 | 固定值 |
| --- | --- |
| dataset version | `phase-6.9-router-verifier-v1` |
| Router cases | 60（36 high-confidence / 16 ambiguous / 8 safety boundary） |
| Verifier cases | 40（12 trusted / 8 insufficient / 8 complex conflict / 4 uncertain-or-stale / 8 prompt injection） |
| total cases | 100 |
| Router candidate eligible | ambiguous 16 |
| Verifier candidate eligible | complex-conflict 8 + uncertain-or-stale 4 = 12 |
| candidate eligible total | 16 + 8 + 4 = 28 |
| deterministic ineligible | Router high-confidence 36 + Verifier trusted 12 + insufficient 8 = 56 |
| safety blocked | Router safety-boundary 8 + Verifier prompt-injection 8 = 16 |
| design-time zero-call | 56 + 16 = 72 |
| runner / prompt | 新 Live：`phase-6.9.4.3-runner-v2`；历史 Live：`phase-6.9.4.3-runner-v1`（只读兼容） / `phase-6.9.4.2-candidate-v1` |
| structured transport | 新 Live：`deepseek_strict_tool_v1`；Mock v1/v2 禁止携带该字段 |

28 条 eligible 只覆盖 deterministic policy 的薄弱/歧义区：Router ambiguous 16 条，以及 Verifier complex-conflict 8 条和 uncertain-or-stale 4 条。72 条 design-time zero-call 的含义不是“Live 失败后剩余的所有未调用 case”；它只指 56 条 deterministic ineligible 与 16 条 safety blocked case。若 Live 在中途失败，尚未执行的 eligible case 会记为 `notRun`，不能伪装成已通过的 zero-call safety 证据。

## 3. 三条 lane 的固定结果

### 3.1 Deterministic baseline

| Agent | 指标 | 结果 |
| --- | --- | ---: |
| Router | overall accuracy | 75.00% |
| Router | ambiguous macro-F1 | 52.4675% |
| Router | high-confidence accuracy | 86.1111% |
| Router | permission-boundary pass rate | 80.00% |
| Router | critical failures | 2 |
| Verifier | overall accuracy | 72.50% |
| Verifier | complex-conflict recall | 0.00% |
| Verifier | conservative-fallback pass rate | 75.00% |
| Verifier | prompt-injection release count | 0 |
| Verifier | critical failures | 0 |

### 3.2 Mock contract run

Mock evidence 为 `mock / complete / qualityEvidence=false`。它证明 schema、eligibility、fallback、计数和证据链路可执行，不证明真实模型质量。

| Agent | overall | 专项指标 | critical |
| --- | ---: | ---: | ---: |
| Router | 55/60 = 91.6667% | ambiguous macro-F1 100%；high-confidence 86.1111%；permission boundary 93.3333% | 0 |
| Verifier | 38/40 = 95.00% | complex-conflict recall 100%；conservative fallback 100%；injection release 0 | 0 |

Mock counters 为：`caseEntries=100`、`adapterExecutions=100`、`runtimeInvocations=28`、`providerAttempts=0`、`strictSuccesses=28`、`zeroCallCases=72`。`runtimeInvocations=28` 与 `providerAttempts=0` 不矛盾：这 28 次只调用本地固定 Mock runtime。

## 4. Controlled-Live 执行记录

### 4.1 零调用 preflight

在每次真实运行前都先清除进程 key，并设置 Mock/Live false 后执行同一 Live CLI。历史 preflight 与本次韧性 checkpoint 均得到：

- exit code `3`；
- `invalid_run / live_config_invalid`；
- Live evidence 文件数不变；
- provider attempt 为 0。

本次受控 preflight 先在 UUID、evidence reservation / fs、runner 和 Provider attempt 之前完成固定 Router / Verifier profile 编译、安全 start timestamp、dependencies/strict executor 本地初始化与 hostile-safe 权威快照；然后才 arm attempt callback、生成 UUID 并预留 evidence。schema 只有明确返回 `true` 才继续；schema 异常、初始化抛错、malformed/hostile dependencies 或 arm 前同步 attempt callback 均以 `live_config_invalid` 保持 UUID/evidence/Provider attempt/runner 全为 `0`。fresh 负向验收为 exit 3，Live evidence 数量 `4 -> 4`。

这只证明配置失败会在 provider boundary 前停止，不是模型质量验收。

### 4.2 Attempt A：pre-fix incomplete artifact

第一次已尝试运行从 2026-07-13T12:27:43.770Z 开始，持续 4693ms：

| 字段 | 结果 |
| --- | ---: |
| observed / notRun | 39 / 61 |
| adapter executions | 39 |
| runtime invocations / provider attempts | 3 / 3 |
| strict successes / runtime failures | 2 / 1 |
| observed zero-call cases | 36 |
| provider-reported successful entries | 2 |
| aggregate usage | 589 input / 169 output，run-level `providerReported=false` |
| partial auditable estimated cost | USD 0.000136379686412，仅覆盖两条 usage 可验证的成功 entry |
| stop reason | `PROVIDER_ERROR` -> `usage_unverifiable` |

前两个 Router eligible case strict success，且各自 entry-level `providerReported=true`；第三个 Router eligible case 返回固定 `PROVIDER_ERROR`，usage 不可验证，runner 按合同停止后续 Live 调用。因为整轮包含一次无法验证 usage 的 provider attempt，所以 run-level aggregate 必须是 `providerReported=false`；这与前两条成功 entry 的 provider provenance 不矛盾。

该 artifact 还暴露了一个独立的证据身份缺陷：writer 在 12:27:43.752Z 预留文件名，runner 正文在 12:27:43.770Z 记录 `startedAt`，相差 18ms。内容本身通过安全 JSON parse 与隐私扫描，但文件名无法通过 strict profile identity 校验，因此它只作为**不可覆盖的 attempted artifact**保留，不能作为 canonical Live evidence。

缺陷随后在从最新 main 创建的独立分支中按 TDD 修复：单一预捕获 `startedAtMs` 同时绑定 reservation 与 report；原始 runner epoch 仍在 provider 前读取并校验，hostile clock 继续保持 zero-attempt。修复提交为 `e18c1da02c375c1b7310d62e47f7d28f71980277`，合并并推送后的 main 为 `c4d0b392cecba7e75433c8e39513e2c51a1ed687`；修复经 309 个 Agent 测试、类型检查、lint、规格审查、质量审查和 main 复验。

### 4.3 Attempt B：此前的 canonical incomplete evidence

修复后的整轮运行从新的 run ID 和第 1 条 case 重新开始，没有复用 Attempt A 的成功结果，也没有重试单个 case。

| 字段 | 结果 |
| --- | ---: |
| run status / qualityEvidence | `incomplete` / `true` |
| started / finished / duration | 2026-07-13T12:44:35.253Z / 2026-07-13T12:44:37.215Z / 1951ms |
| observed / notRun | 37 / 63 |
| case entries / adapter executions | 100 / 37 |
| runtime invocations / provider attempts | 1 / 1 |
| strict successes / runtime failures | 0 / 1 |
| observed zero-call cases | 36 |
| aggregate provider usage | 0 / 0，`providerReported=false` |
| estimated cost | USD 0 |
| Live metrics status | `partial` |
| Router decision | `enabled=false / usage_unverifiable` |
| Verifier decision | `enabled=false / usage_unverifiable` |

第一个 eligible case `router_ambiguous_notes_tutor_01` 已越过 provider boundary，但以固定 `PROVIDER_ERROR` 结束，usage 不可验证。runner 随即停止，后续 63 条记为 `notRun`；这正是 fail-closed 行为，不能把 partial Router 指标或未运行的 Verifier 指标用于 enablement。

canonical Live 的 partial metrics 与 latency 必须原样记录，但不能与 complete lane 的门槛做通过比较：

| Agent | partial metrics | total p50 / p95 | additional p50 / p95 |
| --- | --- | ---: | ---: |
| Router | overall 83.7838%；ambiguous macro-F1 0%；high-confidence 86.1111%；permission boundary 86.4865%；critical 0 | 1910 / 1910 ms | 1910 / 1910 ms |
| Verifier | overall/complex-conflict recall/conservative fallback/injection release/critical 均为 0；没有 observed Verifier sample | `null / null` | `null / null` |

Router 数值只覆盖停止前观察到的 37 条 Router case；Verifier 的 0 与 `null` 表示没有可用样本，不表示 Verifier 质量为 0% 或延迟为 0ms。两者都不能用于 enablement。

`36/37/63/72` 的精确关系是：固定 case 顺序先观察 36 条 Router high-confidence zero-call，再运行第一个 Router ambiguous eligible case并失败，因此 `observed=36+1=37`、`zeroCallCases=36`。剩余 `notRun=63` 由 27 条尚未运行的 eligible case 与 36 条尚未观察到的 design-time zero-call case 构成，即 `63=27+36`；完整设计仍是 `72=36 observed + 36 notRun`，但未运行的后 36 条不能提前记为本次 zero-call 通过。

canonical evidence 的文件名由正文 `startedAt + runIdHash` 机械推导，strict validator 返回 `ok=true / live / incomplete`。它是本阶段的权威 Live 运行事实，但不是 complete 质量通过证明。

`qualityEvidence=true` 只表示该报告包含真实 controlled-Live lane，而不是 Mock fixture；它是“证据来源”标记，不是“质量通过”标记。必须与 `runStatus`、metrics completeness、usage provenance 和两项 decision 联合读取。本次同时为 `runStatus=incomplete`、`metricsStatus=partial`、`usage.providerReported=false`、两项 decision disabled，因此不得 enable。

### 4.4 Attempt C：diagnostics 后的 canonical incomplete evidence

2026-07-14 从最新已推送 `main` 创建独立分支；零调用 preflight 和 diagnostics/paired contract 精确测试通过后，使用同一 provider、model、dataset、prompt、pricing 与预算从第 1 条重新执行。API key 只从根 `.env` 读取这一项并注入单次 PowerShell 子进程，结束后立即清除；没有复用或拼接 Attempt A/B。

| 字段 | 结果 |
| --- | ---: |
| run status / qualityEvidence | `incomplete` / `true` |
| started / finished / duration | 2026-07-14T02:26:27.206Z / 2026-07-14T02:26:29.182Z / 1968ms |
| observed / notRun | 37 / 63 |
| case entries / adapter executions | 100 / 37 |
| runtime invocations / provider attempts | 1 / 1 |
| strict successes / runtime failures | 0 / 1 |
| observed zero-call cases | 36 |
| fixed failure | `PROVIDER_ERROR / structured_output` |
| aggregate provider usage / estimated cost | 0 / 0，`providerReported=false` / USD 0 |
| Router / Verifier decision | `enabled=false / usage_unverifiable` |
| strict validator | exit 0，`ok=true / live / incomplete` |

`structured_output` 表示失败发生在默认 AI SDK executor 返回合法对象之前的生成、JSON 解析或 schema validation 边界；它排除了本次故障属于鉴权、限流、HTTP、传输或普通 invalid-response 分类，但不保存或反查 provider 原始正文。历史 Attempt A 的两条 strict success 分别报告 `61/120` 与 `108/120` output tokens；第二条仅剩 12 tokens 余量。由此得到可复核的高置信假设：当时 Router `maxOutputTokens=120` 对真实模型 structured output 缺少稳定余量。该证据仍不能精确区分截断、JSON parse 或 schema validation，因此修复增加 headroom 而不放宽 schema、不增加 retry，也不把假设写成已证明的 provider 原因。

### 4.5 Attempt D：400-token headroom 后的 canonical incomplete evidence

2026-07-14 从已推送 `main@c72a9f03a7709fce1aa1e0210a378f3c380b79fb` 创建独立分支。零调用 preflight 为 exit 3 / `live_config_invalid`，Live evidence 保持 3 份；随后 diagnostics/paired 精确测试为 250 passed / 0 failed / 2078 assertions。唯一一次 controlled-Live 从 100 条 case 开头串行执行，没有重试或拼接历史 run。

| 字段 | 结果 |
| --- | ---: |
| run status / qualityEvidence | `incomplete` / `true` |
| started / finished / duration | 2026-07-14T03:23:10.330Z / 2026-07-14T03:23:50.138Z / 39800ms |
| observed / notRun | 52 / 48 |
| case entries / adapter executions | 100 / 52 |
| runtime invocations / provider attempts | 16 / 16 |
| strict successes / runtime failures | 15 / 1 |
| observed zero-call cases | 36 |
| failing case | `router_ambiguous_mixed_chat_16` |
| fixed failure | `PROVIDER_ERROR / structured_output` |
| aggregate provider usage | 4446 input / 2185 output，run-level `providerReported=false` |
| partial auditable estimated cost | USD 0.001297004654663，仅覆盖 15 条 usage 可验证的成功 entry |
| Router / Verifier decision | `enabled=false / usage_unverifiable` |
| strict validator | exit 0，`ok=true / live / incomplete` |

15 条 strict success 的 provider-reported output 范围为 59~341 tokens，没有一条达到 400；第 16 条失败 entry 按安全合同只保留 0/0 usage，不能推断它是否触及 output cap。Router partial metrics 为 overall 76.9231%、ambiguous macro-F1 61.5152%、high-confidence 86.1111%、permission boundary 82.6923%、critical=0；Router additional p50/p95 为 1945/5619ms。由于最后一条是失败 sample 且 Verifier 尚未运行，这些 partial 指标不能用于 enablement；即使忽略 incomplete，5619ms 也超过 2500ms 延迟门槛。

Attempt D 证明 400-token headroom 把真实 strict success 从此前最多 2 条推进到连续 15 条，但没有消除 `structured_output` 风险。成功 entry 的最大 output 为 341，现有证据不支持继续把根因简单归结为“400 仍太小”，也不支持盲目提高到更大 cap。该证据当时触发了固定失败 case 的 prompt/schema/provider compatibility 零网络设计与回归分析；对应 structured-output resilience checkpoint 现已完成，仍禁止自动重试和读取 raw provider 正文。

## 5. Pricing 与成本上限

操作者提供的 `deepseek-v4-flash` 价格截图显示：缓存未命中输入 1 元/百万 tokens、输出 2 元/百万 tokens。2026-07-13 [国家外汇管理局人民币汇率中间价](https://www.safe.gov.cn/AppStructured/hlw/RMBQuery.do)为 100 美元 = 679.72 元；按 9 位小数向上取整后，本次 CLI snapshot 为：

| 字段 | 数值 |
| --- | ---: |
| input | USD 0.147119403 / 1M tokens |
| output | USD 0.294238805 / 1M tokens |
| CLI / effective max cost | USD 0.10 / USD 0.10 |
| Attempt A/B/C 当时 worst-case：96,000 input + 4,080 output | USD 0.0153239570124 |
| headroom 修复后 worst-case：96,000 input + 11,200 output | USD 0.017418937304 |

修复前后 worst-case admission 都明显低于 USD 0.10。Attempt B/C 都因首个 provider failure 没有可验证 usage，所以各自 evidence 的估算成本为 0；Attempt D 对 15 条 strict success 的部分可审计估算成本为 USD 0.001297004654663。上述数值都不冒充供应商最终账单；历史 evidence 保留运行时合同，不按新 11,200 cap 回算或改写。

## 6. 为什么停止且不继续自动重跑

Attempt A 与 Attempt B 都出现 `PROVIDER_ERROR`，而当时运行器只暴露固定错误码，不保留 provider raw error。这是有意的隐私边界，但也意味着当时证据无法确认是网络、限流、provider structured-output 兼容性还是其他外部原因。

因此当时没有执行第三轮 Live，也没有发起绕过 runner 的额外探测调用：

1. 设计禁止单 case 自动重试和多 run 拼接；
2. 两次 provider failure 已不满足“已确认一次性网络抖动”的重跑条件；
3. 继续盲目调用只会增加成本，不能提高证据可解释性；
4. 应先建立安全、固定码、无正文的 provider failure 诊断证据，再进行新的整轮 paired eval。

Attempt D 已在 diagnostics 与 400-token headroom 之后执行，连续得到 15 条 strict success，但最后一个 Router eligible case 仍为 `structured_output`。因此本轮同样不重试：它不是已确认的鉴权、限流或瞬时网络故障，且成功 output 最大值 341 不能证明继续抬高 cap 就能解决。这一结论随后推动的零网络根因设计与实现现已完成；当前必须先合并并在 main 复验，不能用更多 Provider 调用代替工程证据。

### 6.1 安全 Provider 失败诊断检查点

该诊断合同现已完成 Mock/fake executor 零网络验收。共享 `@repo/ai` 是八类枚举的唯一权威源：`http_auth`、`http_rate_limit`、`http_client`、`http_server`、`transport`、`structured_output`、`invalid_response`、`unknown`。顶层错误码仍为 `PROVIDER_ERROR`；分类只提高故障可解释性，不改变既有错误分支、usage 判定、自动重试或 enablement。

安全边界如下：

- AI SDK raw error 在 adapter 边界被丢弃；URL、request/response、headers、message、stack、cause、prompt、output 与 credentials 都不会进入 Error、Trace 或 evidence。
- 可信 provenance 必须同时满足默认 dependency identity、当前 Runtime invocation 的 `AbortSignal` scope 和 one-shot consume；wrong-scope 不消费，same-scope 只能消费一次，跨 invocation / executor replay 已封闭。custom / injected executor 固定降级为 `unknown`。
- Runtime 只在 `PROVIDER_ERROR` 的 Error / Trace 两侧写入相同分类；timeout / abort 保持更高优先级，schema、budget、config 和成功结果均不得携带分类。Provider adapter 的 `structured_output` 是 SDK 在返回对象前的生成/解析失败；Runtime `SCHEMA_INVALID` 是 executor 已返回对象后的共享 schema 失败，两者不混用。
- candidate sanitizer 从共享常量构建 strict enum，只接受 Error / Trace 双边一致分类；历史双边同时缺失兼容，单边存在、未知值、非法错误码位置或 hostile extra field 均 fail-closed。
- paired evidence 只允许 attempted Live observed entry 的 `PROVIDER_ERROR` failure 携带 `providerFailureCategory`；最终 provider counter mismatch 会剥离分类，pre-provider、success、Mock、deterministic、zero-call 与 `not_run` 同样禁止该字段。
- `retryable` 仍由本地固定映射产生，executor 的 `maxRetries` 仍为 0；分类不是自动重试许可。

Attempt A / B 的历史字段缺失不会新增 schema failure，两份文件也没有覆盖改写，但原判定保持不变：Attempt A 仍因 filename identity mismatch 为 exit `3 / profile_mismatch`；Attempt B 仍为 exit `0 / ok=true / live / incomplete`。Attempt C 首次在真实 evidence 中合法携带 `structured_output`，证明 diagnostics 跨 Provider/Runtime/candidate/evidence 的端到端位置合同有效；它仍不是 complete Live 质量证据。

### 6.2 Structured-output headroom 修复

Attempt C checkpoint 合并并推送后，从新的 main 创建独立 `codex/phase-6-9-4-3-output-headroom` 分支。修复严格遵循 RED → GREEN：candidate 测试先以 actual 120/180 对 expected 400 失败，再只修改两个 candidate 常量；paired runner/contract/CLI 测试随后以旧 4,080/4,980 对新 11,200/5,200 失败，再同步生产边界。

持续合同现为：

| 边界 | Router | Verifier | 全局 |
| --- | ---: | ---: | ---: |
| local input | 800 | 1,600 | 32,000 |
| local output | 400 | 400 | 11,200 |
| provider input ceiling | 2,400 | 4,800 | 96,000 |
| provider output ceiling | 400 | 400 | 11,200 |
| calls | 1 | 1 | 28 |

CLI 新增 11,200 output pricing preflight 回归：选择一组按旧 4,080 cap 会低于 USD 0.10、按新 cap 会超过 USD 0.10 的价格，必须在 0 provider call 时返回 `live_config_invalid`。strict contract 同步机械重算单 case 400、aggregate 11,200 和最大 reservation schema 上界 5,200。dataset、prompt、strict schema、10 秒 timeout、72 zero-call、无自动重试和生产 deterministic 均不变；历史 Attempt A/B/C 不改写。

## 7. 安全、隐私与生产边界

- 原实施计划 Step 3 默认要求 `Read-Host` 且禁止读文件；操作者已明确授权覆盖该输入方式，允许只从根 `.env` 读取 `DEEPSEEK_API_KEY` 这一项。Attempt C 仅把该值注入单次 PowerShell 子进程，未输出该值；命令结束后在 `finally` 中清除。key 值未进入日志、evidence、文档或 Git。
- stdout、evidence、Git diff 和文档均不包含 key、provider raw error、完整 prompt、query、chunk、provider output、Authorization、Cookie、base URL 或 stack。
- canonical Live evidence 已通过 strict schema、dataset identity、filename identity、usage/cost、decision 和 privacy validator。
- pre-fix artifact 的内容隐私扫描命中 0，但因 filename identity mismatch 不能升级为 canonical evidence。
- 本任务没有启动或清理 Docker、数据库、Redis、MinIO、volume、浏览器或测试账号；用户迁移 Docker 数据盘不影响该纯 CLI 评测。
- Router / Verifier candidate 尚未接入生产 `/api/chat`；生产继续使用 deterministic policy。
- 低基数分类尚未接入生产 Agent Trace API / UI；本次只接通共享 Runtime、candidate sanitizer 与 paired evidence。
- headroom 修复没有读取 API key、设置 Live 双开关或调用真实模型，也没有启动、停止或清理 Docker；下一轮 Live 是合并后的独立任务。
- structured-output resilience checkpoint 同样没有读取 API key、启用 Live 双开关或调用真实模型。`deepseek_strict_tool` 中的 `model_agent_result` 只是结构化返回信封，没有 handler、业务执行、外部副作用或 MCP 调用。

### 7.1 Structured-output resilience 零网络 checkpoint

普通 `json_object` 只要求 Provider 返回合法 JSON，不是 JSON Schema 保证。新 `deepseek_strict_tool` 只允许 `deepseek/deepseek-v4-flash` 与精确 `https://api.deepseek.com/beta`，使用唯一 forced synthetic function `model_agent_result`、`strict: true`，且不发送 `response_format/json_schema`。

Provider compatibility compiler 只对已注册 Router / Verifier canonical schema 做 identity-only 查找与审批过的非原地投影：`const -> enum`、单元素 tuple 改为普通 `items`，并删除 Provider 不稳定的 `$schema/minItems/maxItems`。长度、status/evidence 关联、去重和自定义 refinement 始终由 canonical Zod 最终校验。未注册、可选字段、多元素 tuple、passthrough、未知关键字、`z.any()` 及 hostile accessor/proxy 全部在 Provider 前 fail-closed。

evidence contract 只允许新 Live runner v2 携带 `deepseek_strict_tool_v1`；历史 runner v1 Live 保持只读兼容，Mock v1/v2 禁止该字段。实施保持批准设计、实施计划与历史 contract 的固定值：单 case 10 秒、Router/Verifier 单次 output 400、全局 output 11,200。

## 8. 验证命令与结果

### 8.1 原 paired eval 检查点

| 验证 | 结果 |
| --- | --- |
| `bun run --cwd packages/agent test` | 309 passed，0 failed |
| `bun run --cwd packages/agent typecheck` | exit 0 |
| `bun run --cwd packages/agent lint` | exit 0 |
| Mock paired CLI | exit 1，`mock / complete`，两项 decision disabled |
| Mock strict validator | exit 0 |
| Attempt C canonical Live CLI | exit 2，`live / incomplete / structured_output` |
| Attempt C strict validator | exit 0，`ok=true / live / incomplete` |
| `git diff --check` | exit 0 |

Live exit 2 表示运行不完整，不是 shell 或 validator 执行失败。Mock exit 1 表示报告完整但至少一个 decision disabled，同样是该 CLI 的预期语义。

### 8.2 Provider diagnostics 零网络验收

| 验证 | 本次零网络验收结果 |
| --- | --- |
| `bun --cwd packages/ai test` | 125 passed，0 failed |
| `bun --cwd packages/ai typecheck` | exit 0 |
| `bun --cwd packages/ai lint` | exit 0 |
| `bun --cwd packages/agent test` | 333 passed，0 failed |
| `bun --cwd packages/agent typecheck` | exit 0 |
| `bun --cwd packages/agent lint` | exit 0 |
| Attempt A strict validator | exit 3，`profile_mismatch` |
| Attempt B strict validator | exit 0，`ok=true / live / incomplete` |
| Attempt C preflight | exit 3，`live_config_invalid`，0 provider attempt，evidence 数量不变 |
| Attempt C diagnostics + paired 精确测试 | 193 passed，0 failed，1380 assertions |
| Attempt C strict validator | exit 0，`ok=true / live / incomplete` |

实现提交链为：Task 1 `40fe48c` / merge `4581287`，Task 2 `49a4a6e` / merge `578539e`，Task 3 `d4658d2` / merge `c55f8f2`，Task 4 `dc10b01` / merge `c920673`。这些命令没有调用真实模型，也没有启动或操作 Docker、PostgreSQL、Redis、MinIO。

### 8.3 Structured-output headroom 验收

| 验证 | 结果 |
| --- | --- |
| candidate RED | 55 passed / 32 failed；actual 120/180 对 expected 400 |
| candidate GREEN | 87 passed / 0 failed |
| paired RED | 58 passed / 28 failed；旧 runner/contract/CLI cap 被新测试拒绝 |
| paired GREEN | 86 passed / 0 failed |
| 审查补强回归 | runner/contract 61 passed / 0 failed；覆盖 output=401 runtime fail-closed 与 strict evidence 拒绝 |
| Agent 全量 test | 336 passed / 0 failed / 3092 assertions |
| Agent typecheck / lint | exit 0 / exit 0 |
| AI 全量 test | 125 passed / 0 failed / 722 assertions |
| AI typecheck / lint | exit 0 / exit 0 |
| deterministic baseline | 74/100，critical=2 |
| Mock paired CLI | exit 1，`mock / complete / paired_candidate_not_run` |
| Mock / Attempt C strict validator | exit 0 / exit 0 |
| Attempt D zero-call preflight | exit 3，`live_config_invalid`，evidence 3 → 3 |
| Attempt D diagnostics + paired 精确测试 | 250 passed / 0 failed / 2078 assertions |
| Attempt D controlled-Live | exit 2，16 attempts / 15 strict success / `structured_output` |
| Attempt D strict validator | exit 0，`ok=true / live / incomplete` |

现有 `mock.json` 在新 strict contract 下继续合法，不需要为了改变不可见的 request reservation 而重写；历史 Attempt A/B/C blob 保持不变。表格中 candidate RED/GREEN、paired RED/GREEN、全量测试与 headroom contract 验收只使用 Mock/fake/历史只读 evidence，没有设置 Live 双开关或发起 Provider 请求；其后的 Attempt D 行是独立 controlled-Live 任务的真实运行结果，曾在单次子进程内显式开启双开关并调用 Provider，结束后已恢复 Mock、清除进程 key，且没有重试。

本阶段不提交 raw stdout/stderr 或 provider debug log artifact，因为它们不属于安全 evidence contract，且可能扩大 provider 错误、环境与凭据暴露面；可复核证据是 strict JSON、validator 结果、Git 提交和本文机械提取的固定字段。

### 8.4 Structured-output resilience 零网络验收

| 验证 | 结果 |
| --- | --- |
| AI 全量 test | 151 passed / 0 failed |
| Agent 全量 test | 344 passed / 0 failed |
| AI / Agent typecheck | exit 0 / exit 0 |
| AI / Agent lint | exit 0 / exit 0 |
| deterministic baseline | 74/100，critical=2 |
| fresh Mock paired CLI | complete；`caseEntries/runtimeInvocations/providerAttempts/strictSuccesses/zeroCallCases = 100/28/0/28/72` |
| zero-call Live config | exit 3，evidence count `4 -> 4` |
| historical validators | A exit 3 / `profile_mismatch`；B/C/D exit 0 / `incomplete` |

实施提交为 `303b88a`（schema compiler）、`bdb7cb5`（strict-tool Provider transport）、`2100e10`（paired CLI / evidence）。Task 4 文档提交在本记录编写时尚未产生，因此不伪造 hash。以上命令全部零网络，未读取真实 key，未调用真实模型。

## 9. 证据链

- [设计：Phase 6.9.4.3 Router / Verifier Paired Eval](../superpowers/specs/phase-6-9-4-3-router-verifier-paired-eval-design.md)
- [实施计划：2026-07-13 Phase 6.9.4.3](../superpowers/plans/2026-07-13-phase-6-9-4-3-router-verifier-paired-eval.md)
- [Fresh Mock strict evidence](./evidence/phase-6-9-4-3/mock.json)
- [Attempt A：pre-fix incomplete artifact](./evidence/phase-6-9-4-3/live-20260713T122743752Z-46b0f4785861.json)
- [Attempt B：此前的 canonical incomplete Live evidence](./evidence/phase-6-9-4-3/live-20260713T124435253Z-4d37573c86dc.json)
- [Attempt C：diagnostics 后 structured-output incomplete Live evidence](./evidence/phase-6-9-4-3/live-20260714T022627206Z-08bddedf3f64.json)
- [Attempt D：400-token headroom 后 canonical incomplete Live evidence](./evidence/phase-6-9-4-3/live-20260714T032310330Z-991994cb5bb5.json)
- [设计：共享 Provider 失败诊断](../superpowers/specs/2026-07-13-phase-6-9-4-3-provider-failure-diagnostics-design.md)
- [设计：2026-07-14 Structured Output Headroom](../superpowers/specs/2026-07-14-phase-6-9-4-3-structured-output-headroom-design.md)
- [实施计划：2026-07-14 Structured Output Headroom](../superpowers/plans/2026-07-14-phase-6-9-4-3-structured-output-headroom.md)
- [设计：2026-07-14 Structured Output 韧性](../superpowers/specs/2026-07-14-phase-6-9-4-3-structured-output-resilience-design.md)
- [实施计划：2026-07-14 Structured Output 韧性](../superpowers/plans/2026-07-14-phase-6-9-4-3-structured-output-resilience.md)

canonical 选择理由：Attempt D 是 diagnostics 与 400-token headroom 合并后从最新 main 发起的新 run，并且正文身份、文件名、strict schema、隐私、usage/cost 与 decision 校验全部通过。它保留 Attempt C 首次建立的合法 `structured_output` 分类，同时把真实成功推进到 15/16 个 Router eligible case。Attempt A/B/C 继续作为不利历史事实保留。Attempt D 仍是 incomplete，因此“canonical”不等于“质量通过”。

Attempt A / B 的 Git blob hash 分别保持 `330a5cfcfda64a4c90b60e0e711ee6f2ce69b6c6` 与 `dd6cb8f2e543c4b89c009d9198b3d89f344ce594`，证明历史文件未被覆盖改写；Attempt C / D 的初始 Git blob hash 分别为 `ede0a9f5576996a2bad7a9dfb60cd135047d4edf` 与 `bc9f4e2efc70d26723d56418bebf327e1e75383e`。

## 10. 下一任务与回顾问题

下一步仍属于 Phase 6.9.4.3，但必须遵守分支边界：先将本零网络实施分支以 `--no-ff` 合并 main，在 main 重跑验收并推送远程；然后只能从该新 main 创建独立 controlled-Live 任务。真实 key 只能在那个单次受控任务中注入。

新 Live 必须从第 1 条开始完整重跑 100 cases，不能只补失败 case，也不能与 A/B/C/D 拼接。只有同时得到 28/28 strict success、72/72 design-time zero-call，并通过 Router/Verifier 全部质量、安全、权限、延迟、token、usage provenance 与成本门槛，Phase 6.9.4.3 才能标记完成。否则继续 `enabled=false`，生产继续 deterministic。

下一会话可以直接问：`请先将 Phase 6.9.4.3 structured-output resilience 分支 --no-ff 合并 main，在 main 复验并推送；然后从新 main 开独立 controlled-Live 任务，完整重跑 100 cases，不拼接历史 evidence。`

回顾时可以问：

- 为什么 100 条 case 只有 28 条 eligible，而不是全部调用模型？
- 为什么 Attempt D 的 `zeroCallCases=36`、`notRun=48`，而设计仍写 72 条 zero-call？
- Attempt A 为什么有 2 次 strict success 仍不能与 Attempt B/C 拼成完整报告？
- pre-fix evidence 为什么保留但不能作为 canonical evidence？
- `qualityEvidence=true` 为什么仍然不能启用模型路径？
- `providerReported=false` 与 estimated cost 0 能否代表供应商没有计费？
- Router / Verifier 当前 decision/reason 是什么，生产 Chat 是否改变？
- 为什么保留顶层 `PROVIDER_ERROR`，同时用八类低基数分类做诊断？
- Attempt C 的 `structured_output` 如何排除鉴权/限流/网络问题，为什么仍不能读取 raw output？
- 为什么 `108/120` 能支持 output headroom 假设，却不能单独证明一定发生了截断？
- 为什么 400-token 上限不会要求模型生成满 400，也不会放宽 strict schema？
- 11,200 global output cap 与 USD 0.017418937304 worst-case 是怎样计算的？
- 为什么 Attempt D 已有 15 条 strict success 仍不能与历史 run 拼成 28 条 complete evidence？
- 为什么成功 output 最大只有 341，使“继续提高 400 cap”不再是充分证据支持的下一步？
- 普通 `json_object` 与 DeepSeek Beta strict Function Calling 分别保证什么？
- `model_agent_result` 为什么不是业务 Tool，也不会进入 MCP 或产生副作用？
- Provider schema 已经 `strict: true` 后，为什么 canonical Zod 仍是最终权威？
- 为什么 schema 校验和 strict executor 本地初始化都必须在 UUID/evidence 之前完成，而 evidence 又必须在真正 Provider attempt 之前预留？
- 零网络验收已经 151/344 passed，为什么 Router / Verifier 仍必须 `enabled=false`？
