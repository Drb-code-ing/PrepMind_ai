# Phase 6.9.7 Architecture Recovery R1 — Transport 可诊断边界

日期：2026-07-30

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起点：`dd8321b371ceeaa4eae75dae5ed04bd45b0c9236`

状态：已完成（zero-provider）

## 1. 为什么进入 Architecture Recovery

V9 唯一 controlled-Live 已按 run `c530ca02-3ece-4f11-898c-5695c8252bd5` 失败封存且不得重跑。
封存证据把故障锁定在 `provider_dispatch_started` 之后、`provider_response_received` 之前：Tutor 在
`20.4014ms` 内成为 `provider_runtime / transport`，远低于 `3500ms` deadline；Organizer 只是在 Tutor
失败后由 paired runner 以 `post_dispatch_abort` 收口。现有 V1 direct adapter 对 fetch delegate 的任意
throw 使用空 catch 并统一投影为 `transport`，因此 V9 artifact 无法再区分 DNS、TLS、代理、连接拒绝、
连接重置或网络不可达。

用户明确决定停止 V10/V11 式整套重试，先定位具体故障链路，再决定是否调整 Agent 或 Provider 架构。
本任务由此建立独立 Architecture Recovery；它不是 V9 retry，不改变 V9 marker、journal、evidence、
validator、report 或任何历史质量结论。

## 2. 已定位链路

| 链路阶段                                 | 结论                                                        |
| ---------------------------------------- | ----------------------------------------------------------- |
| 根凭据到 component credential 映射       | V9 preflight 已通过；只证明格式与映射成立，不证明账号有效性 |
| Live config / adapter / request contract | 已通过                                                      |
| Tutor candidate / runtime / budget       | 已进入                                                      |
| durable lane reservation / dispatch      | 已通过，wire `1/1/0/0`                                      |
| Runner 主动 abort Tutor                  | 已排除；Runner 只在 Tutor terminal 后 abort Organizer       |
| Tutor timeout                            | 已排除；`20.4014ms < 3500ms`，`deadlineExceeded=false`      |
| Bun fetch -> HTTP Response               | 当前最小故障域                                              |
| HTTP auth / rate limit / provider status | 未进入                                                      |
| JSON / schema / option / semantic        | 未进入                                                      |

实现 R1 前的故障域复核曾得到聚焦 zero-network `36/36`、`1632` assertions 与扩展回归
`143/143`、`2450` assertions；这组数字用于定位调用链，不是 R1 最终代码门。相同 V1 direct
adapter 在 V7/V8 历史 Live 中曾收到真实 response，因此现有证据不支持
把 V9 归因为确定性的 Tutor contract、Runner 或 adapter 请求构造缺陷。

## 3. 新诊断合同

新增独立模块：

- adapter：`first-party-deepseek-v4-pro-transport-diagnostic-adapter-v1`；
- diagnostic：`first-party-deepseek-v4-pro-transport-diagnostic-v1`；
- provenance：默认 delegate 才是 `first_party_deepseek_v4_pro_transport_diagnostic`，任何注入 delegate
  永久标记为 `synthetic_test`；
- 固定 subtype：`aborted / timeout / dns / tls / proxy / connection_refused / connection_reset /
network_unreachable / unknown`。

该 adapter 包装而不修改 sealed V1 direct adapter。公共 `ModelAgentProviderFailureCategory` 继续只看到
`transport`，V7/V8/V9 wire schema、source identity、report 和 validator 均不增加字段。新 subtype 只保存在
新 adapter 实例内存中，通过 `readTransportDiagnostic()` 读取；本任务没有把它写入 Trace、日志、artifact、
历史 evidence 或产品 API。

默认 global fetch 的 first-party provenance 属于新 wrapper 外层诊断合同。Wrapper 必须把有界闭包
注入 sealed V1 adapter，因此内层 V1 仍按旧规则把该注入 delegate 视为 `synthetic_test`。这防止新
executor 被误冒充为历史 V1 production identity；未来 R2/canary 必须显式设计新 wrapper provenance
的 allowlist，不能把它当成 V1 的透明替换。

分类器只读取 thrown value / `cause` 链最多四个对象的 own data descriptor 中的固定
`code/name`；不会调用 accessor getter、`toString` 或读取 `message/stack`，单个分类 token
最长 128 字符。未知、循环、primitive 和越界链统一成为 `unknown`；JavaScript 反射边界下 Proxy
descriptor trap 可能执行，但 trap 失败会被捕获且不能通过诊断结果暴露原始数据。Signal 已 abort
时固定为 `aborted`，但不会覆盖已有公共
`post_dispatch_abort` terminal。第一条诊断一旦写入即不被后续错误替换。

Subtype 是本地 bounded classification，不是外部根因事实。只有未来独立 canary 的同一次实际 throw 被该
版本分类时，才能写入新版本诊断 artifact；它仍不能证明 Provider 内部原因。

## 4. RED / GREEN 与安全验证

RED：只加入新测试时，模块加载以
`Export named 'FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION' not found` 失败，证明当前代码没有
伪装成已有诊断能力。

GREEN：新 focused suite 为 `6/6`、`127` assertions，覆盖：

- 九个固定 subtype 与 nested cause；
- public `transport` 和 sealed wire `1/1/0/0` 保持不变；
- in-flight abort 不覆盖公共 abort terminal；
- hostile getter/Proxy trap、循环 cause、primitive、超长/未知 code fail-closed；
- forged dependency 在 claim wire capability 前被拒绝；
- 默认 delegate 不执行也能证明 production provenance，注入 delegate 永久为 synthetic；
- diagnostic、public failure 与 wire bytes 不含 synthetic credential、prompt 或 raw error。

最终验证结果：

- `bun test packages/ai/tests`：`232/232`、`1586` assertions；
- V7/V8/V9 direct adapter / fault matrix / runner / V9 option-security 零网络合同：`59/59`、
  `3555` assertions；
- `@repo/ai` 与 `@repo/agent` typecheck/lint 全部通过；
- V7、V8、V9 历史 evidence validator 分别为 `ok=true / filesChecked=1`；
- 三路独立只读复审均无 Critical/Important。

历史 validator 别名未传 evidence path 时首次按合同返回 `evidence_read_failed / filesChecked=0`；
补上明确的只读 artifact path 后三版均通过。该调用错误没有运行 Live/seal/recovery，也没有改写
artifact。V9 evidence/journal/marker 前后 SHA-256 分别保持：

- `6b296660e1467fbb96ffda359a9a0cd6ff6a02bc60ed48e4d69ae03dbc5ce9ac`；
- `8fccbc26160c568e46061843491f8009d7bb054666a98f8900a43009382be376`；
- `8eda89cffda6436c778e0068016870886a5b9dce18c346842be33753974c123b`。

## 5. 本地出站旁证

本任务没有访问 DeepSeek。格式化阶段首次调用 `bunx prettier` 时，Bun 访问包仓库立即返回
`ConnectionRefused`；随后改用仓库已有本地 Prettier 完成格式化。该现象只能作为“当前 Bun 出站路径也出现
快速连接拒绝”的旁证，不能证明它与 V9 使用同一 DNS/TLS/TCP 根因，也不能回填或改写 V9 evidence。

当前环境与根 `.env` 均未设置 `HTTP_PROXY / HTTPS_PROXY / ALL_PROXY / NO_PROXY`，也未设置自定义 TLS CA
或 TLS 绕过变量；Windows user proxy 与 WinHTTP proxy 均为 direct。没有 DNS cache 命中或系统 Schannel/
WinHTTP 事件可用于进一步归因。这些只读观察不替代未来可诊断 canary。

## 6. 未做事项与下一步

本任务没有读取或打印 credential，没有调用 Provider、DNS/TLS 探测、curl、产品 API，也没有启动 Docker、
Server、Web 或浏览器；没有执行 V9 Live/seal/recovery，V9 artifact 字节和 SHA 保持不变。

该检查点当时的下一原子任务仅为 Architecture Recovery R2。R2 后续已完成独立 Provider health canary
request/report/CLI/预算与 artifact contract。实现审查发现公开 injected fetch 会留下真实网络注入口，因此
最终改为 closed scenario enum + 模块内 synthetic responder，而不是沿用初始 injected-fetch 设想。R2 仍未
读取 credential 或调用 Provider；是否授权一次低成本真实 canary 由用户另行决定。canary 未先获得 HTTP
Response 时，禁止启动 Tutor/Organizer 48-case、产品 Docker/API/browser 或 main 合并。后续证据见
`docs/acceptance/2026-07-30-phase-6-9-7-architecture-recovery-r2-provider-health-canary.md`。

## 7. 回顾时可以问

- “为什么 V9 `20.4014ms` transport 能排除 timeout，却不能区分 DNS 与 TLS？”
- “为什么新 subtype 不直接加入 `ModelAgentTrace` 或 V9 evidence？”
- “own data descriptor、四层 cause 和 128 字符上限分别防什么？”
- “为什么 `bunx` 的 ConnectionRefused 只是旁证，不能回填 V9 根因？”
- “Provider health canary 与 Tutor/Organizer semantic acceptance 为什么必须拆开？”
