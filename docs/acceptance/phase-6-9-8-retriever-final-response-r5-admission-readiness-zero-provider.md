# Phase 6.9.8 Retriever / FinalResponse R5 准入前检查（Zero-Provider）

---

id: phase-6-9-8-r5-admission-readiness-zero-provider
phase: 6.9.8
kind: acceptance
status: completed_zero_provider
as_of: 2026-08-06
branch: drb/docs-governance-main
authority: none
replay: allowed_read_only
source_of_truth: docs/current-status.md

---

## 1. 结论

本检查只验证 R5 controlled-Live 的前置条件，不是 R5，也没有创建 R5 marker、journal、artifact 或 recovery claim。

- 当前文档治理分支 `drb/docs-governance-main` 与其远程 `0/0` 对齐，工作树 clean。
- `main` 与 `origin/main` 仍为 `185b8171`，R4 功能分支仍未合入 main。
- R4 lineage 的精确 formal recovery 文件计数为 `0`。
- zero-provider proxy preflight 返回 `direct_ready`，`providerCalls=0`。
- 在当前文档治理分支调用 R4 source-admission 返回 `source_admission_invalid`；这是预期的 fail-closed 结果，不是 R4 失败。R4 source-admission 绑定固定功能分支，防止在文档审阅分支上误发 controlled-Live capability。

因此当前仍然是：R5 **未授权、未开始**；本检查不读取 credential、不调用 DeepSeek/Qwen、不启动 Docker/API/浏览器，也不授权产品或 main 验收。

## 2. Authorization / 数据边界

- 本检查没有读取任何 `.env`、API key 或 credential。
- 本检查没有接受或消费 R5 的 DeepSeek/Qwen 数据边界确认，也没有执行 R5 exact authorization。
- 没有进行网络 Provider 调用；`providerCalls=0`。
- 任何历史 Task 9C sealed evidence 仅保持只读，不重跑、不 replay、不 backfill、不追加探测。

## 3. Source / 分支与证据

| 项目                      | 结果                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| 当前分支                  | `drb/docs-governance-main`                                                               |
| 当前 HEAD / upstream      | `c2fd7c5a` / `c2fd7c5a`，parity=`0/0`                                                    |
| 工作树                    | clean                                                                                    |
| `main` / `origin/main`    | `185b8171` / `185b8171`，parity=`0/0`                                                    |
| R4 功能分支               | `drb/phase-6-9-8-retriever-final-response-contract`，tip=`5c4d27d9`，已推送但未合入 main |
| R4 formal recovery 文件   | `0`                                                                                      |
| 当前分支 source-admission | `source_admission_invalid`（固定 lineage 分支不匹配，fail-closed）                       |

R4 source-admission 的职责是核对固定 branch、HEAD/upstream/remote/approved source、clean tree、formal evidence=0 和 source bundle。它不是通用“任意分支授权器”。因此不能在 `drb/docs-governance-main` 上直接执行 R5，也不能通过把分支名改成看似匹配来绕过检查。

## 4. Execution / 可复核命令

以下命令均为零 Provider、只读或 listener-only 操作：

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse '@{upstream}'
git rev-parse main
git rev-parse origin/main
bun --filter @repo/ai diagnose:phase-6-9-7:recovery:proxy-preflight
```

proxy preflight 的安全输出为：

```json
{
  "ok": true,
  "code": "direct_ready",
  "mode": "direct",
  "configuredProxyVariables": 0,
  "listener": "not_required",
  "listenerProbeCalls": 0,
  "providerCalls": 0
}
```

source-admission 的安全输出为：

```json
{ "ok": false, "reasonCode": "source_admission_invalid" }
```

后一个输出不包含 raw error、URL、credential 或路径细节；它只说明当前分支没有获得 R4 fixed-lineage admission capability。

## 5. Authority 与副作用

本检查的 authority 固定为 `none`：它只能证明当前本地 Git/代理前置检查的结果和 fail-closed 分支保护，不能证明 Provider health、真实模型语义、RAG 质量、费用、SLA、产品可用性或 main 可用性。

本轮没有：

- 读取 credential、调用 Provider 或创建网络 evidence；
- 写入 PostgreSQL、Redis、MinIO、BackgroundJob、Outbox、Trace 或业务数据；
- 启动/重建/清空 Docker 服务、卷、镜像，或打开产品浏览器；
- 修改任何历史 sealed marker/journal/artifact。

## 6. R5 分支交接规则

R5 不是一个可以从 `drb/docs-governance-main` 随手派生的普通文档任务，而是 R4 fixed lineage 的一次性延续。正式 R5 前必须：

1. 切换到已推送的 R4 功能分支，并重新核对 clean、HEAD/upstream/remote/approved source parity；
2. 在该固定 lineage 上确认 formal evidence 仍为 `0`，再做 fresh proxy preflight；
3. 用户重新接受当次 DeepSeek + Qwen 数据保留/训练边界；
4. 用户给出与本 lineage 完全匹配的精确一次性授权；
5. credential 只在授权后的受控子进程 late-binding，失败也必须 durable seal；
6. R5 通过后才讨论产品分支、main 合并与 post-merge 回放。

这是一条 lineage 保护例外，不是从功能分支再开子分支：当前不创建 R5 子分支，也不把 R4 代码或本治理分支偷偷合入 main。若要强制“每个新任务都从 main 开分支”，必须先另做 zero-provider source-admission 参数化任务，不能在本次 R5 中临时改变 lineage。

## 7. Reader questions

- 为什么 proxy preflight `direct_ready` 仍不能说明 Provider 健康？
- 为什么当前分支的 `source_admission_invalid` 是保护，而不是 R4 失败？
- R5 为什么要沿用固定 R4 lineage，而不能从文档治理分支派生？
- R5 exact authorization 与普通“继续”在证据和副作用上有什么区别？

## 8. Next boundary

当前唯一可进入的下一步是：在用户明确授权后，按上面的固定 lineage 规则进行 R5 fresh admission。未授权前继续禁止 Provider、credential、产品 Docker/API/browser、Trace 产品验收和 main 合并。
