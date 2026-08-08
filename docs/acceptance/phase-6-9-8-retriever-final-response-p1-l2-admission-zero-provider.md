# Phase 6.9.8 Retriever / FinalResponse P1 L2 admission contract 验收

> 日期：2026-08-08  
> 状态：已完成（zero-provider contract；未执行 Live）  
> 分支：`drb/phase-6-9-8-l2-admission-contract`  
> 基线：`main / origin/main = 313d6e48`  
> 代码提交：`67199acf`

## 1. 结论

本任务只实现 L2 的独立 admission contract，不执行 controlled-Live。它把未来唯一一次 L2 运行所需的四组输入收口为
一个严格、单次、不可伪造的 zero-provider capability：

```text
source/remote parity + approved tag + frozen S2 identity
  -> exact DeepSeek/Qwen data-boundary receipt
  -> exact lineage/source-bound authorization
  -> frozen bounded budget profile
  -> zero-provider admission record / single-use capability
```

admission record 明确 `mode=zero_provider_admission`、`providerDispatchAllowed=false`、
`providerCalls=0`、`credentialReads=0`、`formalEvidence=0`。即使四组输入都通过，也不会读取 `.env`、构造 Provider
adapter、创建正式 tag/marker/journal/artifact/recovery claim，或写入产品数据。

## 2. 固定 contract

| 项目             | 固定值                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| lineage          | `phase-6.9.8-retriever-final-response-p1-l2-v1`                             |
| schema           | `phase-6.9.8-retriever-final-response-p1-l2-admission-v1`                   |
| authority        | `zero_provider_retriever_final_response_p1_l2_admission_contract`           |
| gate             | `l2_admission_zero_provider`                                                |
| qualityAuthority | `none`                                                                      |
| approved branch  | `drb/phase-6-9-8-p1-l2-controlled-live`（协议值，当前未创建）               |
| approved tag     | `phase-6.9.8-retriever-final-response-p1-l2-approved`（协议值，当前未创建） |
| candidate cap    | `12`                                                                        |
| input/output cap | `37600 / 8800` tokens                                                       |
| budget cap       | `176000` micro-CNY（`0.176 CNY`，Live 前仍须重新核价）                      |

数据边界和授权字符串只是严格 contract 的协议常量；代码中的常量不表示用户已经接受边界或已经授权本次 Live。

## 3. Fail-closed 门

- source 必须是固定 L2 branch，`HEAD == upstream == origin`，tracked clean，approved tag commit 与 HEAD 一致；
- manifest、policy、baseline、S2 factory 与 final_11 compatibility SHA 必须保持冻结值；
- formal evidence paths 与 old-lineage paths 必须为空；
- data-boundary receipt 必须同时声明 DeepSeek/Qwen、`current_account` scope 和精确 confirmation；
- authorization 必须精确绑定 L2 lineage、branch、source commit 和 confirmation；
- budget 只能接受冻结 cap 与 price-profile SHA，不能扩容、降价或注入自报值；
- root/嵌套 Proxy、getter、额外字段、字段缺失、类型漂移、tag/source/hash 漂移均 fail-closed；
- capability 用 WeakMap 私有状态单次消费，伪造对象或二次消费均拒绝。

任何 gate 失败只返回 bounded code，不保留 raw token、credential、用户正文或 Provider 输出。

## 4. 验收结果

```text
L2 admission focused       4 pass / 0 fail / 19 expect() calls
G1 + G2 + S2 + L2 focused 18 pass / 0 fail / 142 expect() calls
@repo/agent typecheck      passed
@repo/agent lint           passed
git diff --check           passed
providerCalls              0
credentialReads            0
formal evidence            0
```

测试覆盖正常 tuple、source/tag/parity/anchor drift、错误 data-boundary、错误 authorization、budget expansion、
root/nested hostile Proxy、capability single-use、输入不可变和 raw confirmation 不进入 admission record。

## 5. 变更面

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-p1-l2-admission.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-p1-l2-admission.test.ts`
- `packages/agent/package.json`：新增 `./phase-6-9-8-p1-l2-admission` public subpath

## 6. 停止门与下一步

当前仍未创建 approved tag，也未读取 credential、执行 proxy/network preflight、调用 Provider、启动 Docker/API/browser
或接入 `/api/chat`。本 contract 不是 L2 semantic authority，也不是 Live authorization。

下一步是完成相关文档 parity、推送并合并 `main`，在 `main` 上做一次 zero-provider 回归。只有之后用户重新接受当次
DeepSeek/Qwen 数据边界并提供新的、精确绑定 source/lineage/confirmation 的 authorization，才可另立唯一 L2 controlled-Live。
已封存 L1/T3/R5/Task 9C/SR5 evidence 不得重跑或改写，Docker 容器、镜像和卷保持原状。
