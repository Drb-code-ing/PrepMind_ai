# Phase 6.9.7 Architecture Recovery Proxy Preflight 验收

## 1. 结论

本原子任务已完成一个独立、可重复、zero-Provider 的代理前置检查。它不复用已消费的 R3
confirmation、marker、journal、artifact 或 recovery claim，也不调用 `fetch`、DeepSeek、Tutor、
WrongQuestionOrganizer、产品 API 或 Docker 服务。

当前进程的实际诊断结果为：

```json
{
  "ok": false,
  "code": "loopback_proxy_unavailable",
  "mode": "loopback_proxy",
  "configuredProxyVariables": 4,
  "listener": "unavailable",
  "listenerProbeCalls": 1,
  "providerCalls": 0
}
```

这只证明四个当前生效的 HTTP(S) proxy 变量形成同一 loopback authority，但本次 250ms
本地 TCP 检查未发现对应 listener。它与 R3 的 `connection_refused` 高度相关，但不是 R3 sealed
evidence 已证明的唯一根因，也不能证明或否定 Provider、DNS、TLS、代理转发、账号、余额、模型权限、
限流或服务端健康。

## 2. 为什么需要这个门

R3 已在一次 durable Provider dispatch 后、HTTP Response 前以
`transport_failed / connection_refused` 封存。继续用新的 Provider run 试错会同时消耗一次性授权、
预算和不可变 evidence，却无法先排除本机代理 authority 自相矛盾或 loopback 端口无人监听。

因此未来任何新的 Provider reservation、credential mapping、marker 创建或 dispatch 之前，必须先通过
这个本地门。当前模块只建立并验收该门，不自动修改系统代理、不清空 `NO_PROXY`、不绕过代理、不启动
代理软件，也不授权新的外部调用。

## 3. 冻结合同

| 维度          | 规则                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| 版本          | `phase-6.9.7-architecture-recovery-proxy-preflight-v1`                                                  |
| 允许的 direct | 八个固定代理变量均未配置；不执行 listener probe                                                         |
| 允许的 proxy  | 所有已配置 proxy 变量必须严格等于同一个显式 `http://127.0.0.1:<port>` 或 `http://[::1]:<port>`          |
| `NO_PROXY`    | `NO_PROXY` / `no_proxy` 只允许 absent 或空；非空即 fail-closed，不猜测 Provider bypass 语义             |
| URL 安全      | 拒绝 userinfo、非 HTTP scheme、非 loopback host、缺失/非法端口、path、query、fragment、空白和控制字符   |
| 冲突处理      | uppercase/lowercase/HTTP(S)/ALL proxy authority 任一不一致即 fail-closed                                |
| listener      | 仅向已验证的 loopback host/port 建立一次 TCP 连接；250ms；连接成功后立即销毁 socket，不发送 payload     |
| watchdog      | 核心 runner 自己强制 250ms，不信任注入 probe 遵守 timeout；挂起、throw、异常返回和 abort 均有界收口     |
| 输出          | 只包含固定 version、enum、boolean 和计数；不包含 proxy URL、credential、raw error、socket peer 或 stack |
| Provider      | `providerCalls` 永远为 `0`；无 fetch/URL/model/credential/reservation/marker/artifact 入口              |

Windows/Bun 的 `process.env` 使用 accessor descriptor。纯 contract 继续拒绝 accessor/hostile getter；只有
正式 CLI composition root 会读取八个固定 proxy key，并复制为 own-data snapshot 后交给 contract。该适配
不会枚举整份环境，也不会读取 `.env` 或任何模型 credential。

## 4. 数据流与权限顺序

```text
trusted CLI composition
  -> snapshot only 8 proxy/NO_PROXY variables
  -> own-data / exact-key / control-character validation
  -> direct OR one coherent loopback HTTP proxy
  -> core-owned 250ms watchdog
  -> one loopback TCP listener probe, no payload
  -> bounded diagnostic result, providerCalls=0

future external-call composition（本任务未实现、未授权）
  -> proxy preflight must be ok
  -> credential/source/branch checks
  -> marker/reservation
  -> Provider dispatch
```

Preflight 失败必须在 credential、marker、reservation 和 Provider 之前停止；它本身不创建 crash-only
recovery 状态，也不能把 `loopback_proxy_ready` 升级为 Provider health、HTTP response 或质量 authority。

## 5. 实现范围

- `packages/ai/src/phase-6-9-7-architecture-recovery-proxy-preflight.ts`
  - 纯 contract、env authority resolver、URL parser、核心 watchdog 和有界结果；
- `packages/ai/src/phase-6-9-7-architecture-recovery-proxy-preflight-cli.ts`
  - argument-free CLI、Windows/Bun 八变量快照和本地 TCP probe；
- `packages/ai/tests/phase-6-9-7-architecture-recovery-proxy-preflight.test.ts`
  - direct/IPv4/IPv6、冲突、`NO_PROXY`、URL/credential、hostile descriptor、throw、hang、abort、CLI 脱敏；
- `packages/ai/src/index.ts` 与 `packages/ai/package.json`
  - 导出纯 contract，并提供 `diagnose:phase-6-9-7:recovery:proxy-preflight` 命令。

没有修改 R3 contract/runner/durability/CLI、V1--V9 report/schema/validator、产品 composition、Docker
allowlist、业务数据库或任何 gate。

## 6. 验收证据

| 验收项                        | 结果                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| proxy preflight focused       | `14/14`，`108` assertions                                              |
| R3 focused regression         | `18/18`，`123` assertions                                              |
| `@repo/ai` full               | `278/278`，`2035` assertions                                           |
| AI typecheck                  | exit `0`                                                               |
| AI lint                       | exit `0`                                                               |
| Prettier / `git diff --check` | exit `0`                                                               |
| 实际 CLI                      | exit `1`（预期 fail-closed），`loopback_proxy_unavailable / 4 / 1 / 0` |
| Provider / fetch / credential | `0 / 0 / 未读取`                                                       |
| marker / journal / artifact   | 本任务新增 `0 / 0 / 0`                                                 |

R3 sealed 文件在本任务后保持物理 SHA-256 不变：

- marker：`6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a`；
- journal：`426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b`；
- artifact：`56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4`。

两路独立 implementation/test 复审确认核心 watchdog 修复后无未关闭 Critical/Important；独立安全复审确认
固定 key、loopback、无 payload、脱敏输出、zero-Provider 与 R3 隔离边界成立。

## 7. 未完成与下一步

- 当前环境仍是 `loopback_proxy_unavailable`，因此不具备任何新 Provider run 的环境前置条件；
- 本任务没有修复或启动代理软件，也没有修改宿主 proxy/`NO_PROXY`；
- R3 仍然失败封存且不得 retry/resume/replay/backfill、Live/seal、删除或改写 artifact；
- R4、小样本、48-case、产品 Docker/API/可见浏览器、main、Phase 6.9.8 与后续阶段仍被阻断；
- 后续只能先让宿主环境满足 direct 或 coherent loopback-listener 条件，再重复运行本地 preflight；即使
  preflight 变为 ready，也仍需新的设计边界、静态 checkpoint、用户重新接受运行时数据边界并给出新的
  exact controlled-Live 授权，才能讨论任何 Provider 调用。

## 8. 回顾时可以问

- “为什么 R3 已经是 `connection_refused`，仍不能把无监听 `127.0.0.1:7897` 写成唯一根因？”
- “为什么 proxy preflight 必须在 credential、marker 和预算 reservation 之前？”
- “为什么 `NO_PROXY` 非空时选择 fail-closed，而不是自动判断 DeepSeek 是否绕过代理？”
- “为什么 TCP listener ready 只能证明本地端口接受连接，不能证明 Provider、TLS 或账号健康？”
- “为什么 watchdog 必须由核心 runner 强制，而不能只把 `250ms` 传给 probe？”
