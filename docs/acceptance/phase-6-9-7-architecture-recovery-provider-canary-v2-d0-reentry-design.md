# Phase 6.9.7 Architecture Recovery Provider Canary V2 D0 Re-entry 设计验收

日期：2026-07-30

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：D0 已完成；zero-provider；下一原子任务仅 C1

Authority：`design_checkpoint / diagnostic_only / qualityAuthority=none`

## 1. 结论

宿主代理程序恢复 loopback listener 后，唯一允许重跑的本地 preflight 得到：

```json
{
  "ok": true,
  "code": "loopback_proxy_ready",
  "mode": "loopback_proxy",
  "configuredProxyVariables": 4,
  "listener": "listening",
  "listenerProbeCalls": 1,
  "providerCalls": 0
}
```

本次没有手工清空/绕过或改写当前进程 proxy/`NO_PROXY`，也没有读取模型 credential、调用 Provider 或触碰
Docker。只启动已安装的 Clash Verge 应用，让其按自身既有配置恢复 core；preflight 仍只执行一次 250ms
本地 TCP connect，无 payload。Listener ready 不证明代理转发、DNS、TLS、DeepSeek、账号、余额、模型权限、
限流或服务端健康。

基于该结果，D0 冻结新的 **Provider Canary V2** 设计。V2 不复用 R3/R4 identity，不运行 48-case，未来最多
执行一次 fact-free canary，并使用全新的 approval、credential、confirmation、marker、journal、artifact 和
validator。D0 本身没有实现或授权该真实路径。

## 2. 为什么不能直接重跑 R3

R3 run `253a5df5-c443-4950-b517-849efb941728` 已完成一次 dispatch 并正常发布 immutable diagnostic
artifact。其一次性授权、marker namespace 和 normal-runtime publication 均已消费；proxy listener 后续恢复
不能让旧授权重新生效。

R3 证据只证明当时 `1/1/0/0` 与 `connection_refused`，没有记录 socket peer；当前 ready 也不能反向证明
R3 的唯一根因。直接再次运行 R3 会破坏“一份 exact authorization 对应一个 immutable attempt”的证据边界。

## 3. D0 冻结内容

- 独立 namespace：`phase-6.9.7-architecture-recovery-provider-canary-v2`；
- 独立阶段：D0/C1/C2/S1/L1/P1，避免把旧 R4 或 R3 retry 包装成新任务；
- 固定顺序：exact args -> 八变量 proxy snapshot -> preflight -> source -> dedicated credential -> marker ->
  single dispatch -> terminal -> publication；
- preflight 失败时 credential/source/marker/Provider 全部 0-call；
- preflight success 只产生进程内 single-consume attestation，不保存 proxy URL/port；
- fact-free `{ "ok": true }`、DeepSeek V4 Pro、5000ms、`1/512/16`、`0.00200000 CNY`、no retry；
- 新专用 approval/credential/confirmation/evidence prefix；
- R3 SHA/validator parity、V2/R3 双向 lineage rejection 与 no-raw evidence；
- S1 后必须停在 L1 exact authorization，普通“继续/开始/同意”不能替代。

## 4. R3 sealed parity

D0 前重新计算并验证：

| Artifact | SHA-256                                                            |
| -------- | ------------------------------------------------------------------ |
| marker   | `6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a` |
| journal  | `426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b` |
| artifact | `56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4` |

R3 bundle validator 为 `ok=true / runId=253a5df5-c443-4950-b517-849efb941728`。D0 不删除、覆盖、修改、
重新 seal、恢复或拼接上述文件。

## 5. 本次明确没有做什么

- 没有读取、打印、修改或提交 `.env`/credential；
- 没有调用 DeepSeek、curl、DNS/TLS、产品 API、Tutor/Organizer 或其它 Provider；
- 没有创建 V2 marker、journal、artifact、recovery claim 或 reservation；
- 没有运行 R3/V1--V9 Live、seal、recovery、retry、resume、replay 或 backfill；
- 没有启动 Docker/API/browser，没有修改 PostgreSQL、Redis、MinIO 或业务数据；
- 没有执行 Tutor/Organizer 小样本、48-case、产品验收、main 合并或后续 Phase；
- 没有把 `loopback_proxy_ready` 记为 Provider health、Agent semantic 或产品 authority。

## 6. 下一停止门

下一原子任务仅 C1：实现 proxy-capability-bound zero-network contract 与 synthetic fault matrix。C1/C2/S1
全程仍须 `providerCalls=0`。只有 S1 完成、提交、推送并经过独立终审后，才向用户展示 L1 数据边界和 exact
confirmation；在此之前不得读取 credential 或调用 Provider。

权威设计与计划：

- `docs/superpowers/specs/phase-6-9-7-architecture-recovery-provider-canary-v2-design.md`
- `docs/superpowers/plans/phase-6-9-7-architecture-recovery-provider-canary-v2.md`

回顾时可以问：

- 为什么 listener ready 不能恢复已经消费的 R3 authorization？
- 为什么 V2 要在 credential read 之前运行 proxy preflight？
- 为什么 V2 只做 fact-free 单调用，而不再次运行 48-case？
- 为什么 V2 complete 也只能解锁小样本 semantic 设计？
