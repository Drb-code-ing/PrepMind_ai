# Phase 6.9.8 Retriever / FinalResponse SR5 Live proxy snapshot fix（zero-provider）

日期：2026-08-10

## 结论

SR5 controlled-Live 的首次入口尝试在 proxy 前门 fail-closed，未进入 credential、reservation 或 Provider：

```text
code=proxy_preflight_not_ready
providerCalls=0
credentialReads=0
formalEvidence=0
businessWrites=0
```

因此没有 run id、marker、journal、report、artifact 或 recovery claim；旧 approved tag、历史 evidence 与 Docker/PostgreSQL/Redis/MinIO
均未被删除或改写。本次不是 Provider、账号、余额、模型权限或语义质量结论。

## 根因与修复

Bun 1.3.14 在 Windows 上把继承的 `HTTP_PROXY`/`HTTPS_PROXY` 等环境项暴露为 getter/setter accessor descriptor。SR5 CLI 原先
只读取 descriptor 的 `value`，不能可靠地把代理配置物化给共享 preflight；AI 独立 preflight CLI 已使用直接读取并冻结 data-property
的兼容模式。修复提交 `b531adef`：

- 只读取固定的六个 proxy/NO_PROXY key；
- 通过 `Reflect.get` 读取 accessor，并立即写入不可变 data-property；
- getter 异常写入 `null`，由共享 preflight 继续 fail-closed；
- 不输出代理 URL，不读取 credential，不改变 Provider adapter 或质量门。

## 零 Provider 回归

```text
SR5 Live focused：11/11 tests，39 assertions
Agent typecheck：通过
Agent lint：通过
Prettier：通过
git diff --check：通过
独立 proxy preflight：loopback_proxy_ready / configuredProxyVariables=4 / listenerProbeCalls=1 / providerCalls=0
```

新增回归以 accessor-backed 环境对象验证快照后得到四个一致的 loopback proxy data-properties，并由共享 preflight 返回
`loopback_proxy_ready`；整个测试使用 stub listener，无网络 payload、credential 或正式 evidence。

## 当前停止门

修复改变了 Live source bundle，旧
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-approved` tag 仍指向修复前的 `ca9a9eb0`，不可移动或复用。
修复已以 merge=`671188bb` 合并回 `main`、推送并完成 parity；合并后二次 zero-provider 回归通过。接下来必须让功能分支同步到该最终
source，再重新接受当前 source 的 DeepSeek/Qwen 数据边界并给出新的两行 exact authorization，创建新的 approved tag 并执行唯一一次
controlled-Live。旧授权不适用于新 source。

在新的 exact authorization 前禁止 Live retry/replay/curl/单 case/追加 Provider 探测。下一次运行无论质量通过、schema、transport、usage、
timeout、abort 或 I/O 失败，都必须 durable seal 后停止；成功也只产生分支 semantic authority，不自动解锁产品、Docker/API/browser、Trace、SLA
或博客收尾。
