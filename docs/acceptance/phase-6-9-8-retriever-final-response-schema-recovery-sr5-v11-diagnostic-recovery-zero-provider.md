# Phase 6.9.8 SR5 V11 diagnostic recovery（zero-provider）

日期：2026-08-17
功能分支：`drb/phase-6-9-8-sr5-v11-recovery`
收口分支：`drb/phase-6-9-8-sr5-v11-closeout`
基线：`main=610598c44ffa5a729c8ea5a212792322141a0447`
功能提交：`1773625a`；功能 merge：`7cf12916`

## 目的

V10 controlled-Live 将 DeepSeek candidate 的失败压成 `schema_invalid`，且外层 wire 不能稳定区分 Provider response
是否已经到达。DQ1/DQ2 已补上 bounded diagnostic，但只覆盖 direct adapter 到 Task9 RuntimeError。本阶段把同一诊断
通过 SR5 runner 的 durable path 回归，验证失败仍能保留有限分类、response wire 和 terminal 顺序，同时不泄漏 Provider 原文。

## V11 合同

- V10 run `da94b83b-3638-4e23-aefc-9e3423bf4c77` 与其 marker/journal/report/artifact 永久只读，V11 不扫描为当前 lineage、
  不 retry/replay/recover/seal、不复用旧授权。
- V11 使用独立 `phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v11` lineage/evidence namespace，
  `...-live-v11-approved` tag identity 与 `V11_DEEPSEEK_AND_QWEN_DATA_BOUNDARY`/`V11_CONTROLLED_LIVE_ONCE` receipt；
  当前仅定义合同，尚未创建 tag、读取 credential 或执行 Live。
- DeepSeek direct adapter V2 兼容合同只接受非思考模式下显式 `reasoning_content: null`；非空 reasoning、正数 reasoning
  tokens、JSON/object/type/usage 违规仍 fail-closed。旧 V1 adapter 和 DQ1/DQ2 历史矩阵保持原语义。

## 验收证据

- V11 focused bridge：`8/8`，`68 expect()`。V2 nullable reasoning 成功路径实际穿过 Task9 candidate 和独立 V11 synthetic SR5 runner；五类
  代表 shape（object missing、JSON parse、type validation、response audit、usage validation）均实际进入 runner；失败
  candidate entry 保留 bounded category/stage 和 wire `1/1/0`，后续 lane 被 quality breaker 固定为 not-started。
- 每例 journal 顺序为 `call_reserved -> dispatch_started -> response_received -> call_terminal`；publish 后 strict bundle
  validator 为 `ok=true`。report、journal、artifact 均不含 raw sentinel。
- 既有 V10 SR5 live zero-provider focused：`28/28`；V10 contract/source/validator 保持原 namespace。AI direct-adapter focused：V1/V2 测试通过，V2 null reasoning 成功、非空
  reasoning 仍为 `response_audit`。
- Agent full `1671/1671`（`25804 expect()`，`206 files`）、AI full `346/346`（`2667 expect()`，`28 files`）、Agent/AI
  typecheck、lint 通过。
- 本阶段已完成 format、focused/full zero-provider parity 与 V10/V11 identity isolation；功能分支已推送并以 `--no-ff` 合并为
  `main=7cf12916`，merged-main Agent `1671/1671`、AI `346/346` 全量结果保持通过。收口分支仅完成 CRLF-aware Prettier 复核并同步文档，
  不改变运行语义；本阶段仍未创建 V11 annotated tag、未接受 fresh authorization、未执行 controlled-Live，也未进行 SR6 Docker/API/browser 验收。

## 边界

Provider/credential/formal evidence/business writes=`0/0/0/0`；未读取根 `.env`，未调用 DeepSeek/Qwen，未启动或清理
Docker、PostgreSQL、Redis、MinIO、API、browser，未写产品 Trace/BackgroundJob/Outbox。`qualityAuthority=none`，本记录不
宣称真实模型语义、产品可用、P95/SLA 或 main authority。

## 后续 controlled-Live preflight 结果

zero-provider 收口后的 `main == origin/main == c077d6546709c6af2e796ec861e8376355437466` 创建并推送 annotated tag
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v11-approved`，tag object=
`20e2abfcedd5cbb759694f59cce92cae4ef9fc80`，peeled commit=`c077d6546709c6af2e796ec861e8376355437466`。
用户随后接受 V11 DeepSeek/Qwen 数据边界并授权唯一入口。

production CLI 在 authorization 后、source admission 与 credential projection 前返回 `proxy_preflight_not_ready`。bounded
proxy 结果为 `loopback_proxy_unavailable / loopback_proxy / configuredProxyVariables=4 / listener=unavailable /
listenerProbeCalls=1 / providerCalls=0`；宿主 Git Bash 环境的 `http_proxy/https_proxy` 指向
`http://127.0.0.1:7897`，当时无监听。终态 credential/provider/formal evidence/business writes=`0/0/0/0`，没有
marker、journal、report、artifact 或 runId；未读取根 `.env`，未调用 DeepSeek/Qwen，未操作 Docker/API/browser。

该结果不能归因 Provider、账号、余额、模型、schema 或语义质量。本次唯一授权入口已使用，不得直接重跑、改为直连、
retry/replay/backfill、curl、单 case或追加 Provider 探测。

同一仓库随后通过 FastCtx `login_shell=false` 的 no-profile host 运行共享 proxy diagnostic，得到
`direct_ready / mode=direct / configuredProxyVariables=0 / listener=not_required / listenerProbeCalls=0 /
providerCalls=0`。这将根因收敛到 login-shell profile 注入的失效 loopback proxy；不是 Provider、Docker 或源码问题。

## 下一步

zero-provider 功能、文档与 merged-main 重点 parity 已收口。下一步从最新 `main` 新开独立 source lineage，保留 V11 tag 与
本次授权不动，并把已验证的 no-profile/direct host 作为前置门；合并后重新核对 annotated tag/source bundle，并取得 fresh
DeepSeek/Qwen 数据边界与唯一 controlled-Live 授权。Live
成功或失败都要 durable seal，再决定是否进入 SR6 Docker/API/可见浏览器验收。
