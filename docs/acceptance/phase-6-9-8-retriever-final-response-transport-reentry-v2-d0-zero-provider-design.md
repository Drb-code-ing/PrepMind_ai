# Phase 6.9.8 Transport Re-entry V2 D0 Zero-provider Design 验收

> 日期：2026-08-07
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> lineage：`phase-6.9.8-retriever-final-response-transport-reentry-v2`
> authority：`zero_provider_transport_reentry_v2_design`
> qualityAuthority：`none`
> 后续：C1 launcher/projection 已在独立验收记录完成；本文件为不可改写的 D0 设计快照。
> 后续状态：C2 runner/durability 也已在独立 zero-provider 验收记录完成；下一步为 S1，V2 L1 仍未授权。

## 1. 本任务范围

D0 只冻结新 V2 re-entry 的 identity、credential composition、权限、三槽 transport contract、阶段顺序和停止门。
它不读取真实 `.env` 或 credential，不调用 Provider，不创建 marker/journal/artifact，不启动 Docker/API/browser，
不写业务数据或 Trace，也不改写旧 T3/R5/Task 9C evidence。

## 2. 已确认的设计事实

- 新 lineage：`phase-6.9.8-retriever-final-response-transport-reentry-v2`；
- 新 confirmation 与 evidence prefix 与 T3/R5/Task 9C 完全不同；
- root launcher 未来不使用 ambient `bun --env-file`；只在 gate 通过后按自身位置解析根 `.env`，只允许
  `DEEPSEEK_API_KEY`、`QWEN_API_KEY` 两个宿主兼容输入，runtime core 只接收 dedicated
  module-owned projection；
- parser 未来固定覆盖 UTF-8 BOM、CRLF/LF、单行有界值、重复键、插值、多行和未知字段 fail-closed，D0 不运行真实 parser；
- C1 必须加入 hostile ambient `process.env` 断言，证明预注入的 generic/Agent key 不会绕过 root-file composition；
- exact args、source、T2/T3-C parity、proxy、data-boundary、authorization 均先于 credential composition；
- configuration failure 在 marker 前停止，不消费 V2 一次性 marker；
- 未来 L1 固定 `rewrite -> qwen -> final_response`、最多 3 calls、总 cap `0.024096 CNY`、首错 breaker、no-retry；
- 即使 L1 transport 全部成功，也只形成 transport authority，不形成 Agent semantic、产品或 main authority。

## 3. 旧证据保护

旧 T3 run `075e2d5f-682b-426d-847e-f5a6ce5b97c6`、R5 run `34eb99be-bdeb-41e5-85cf-3c651ecefc68` 与 Task 9C run
`28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2` 只允许只读 validator/parity。D0 不移动、删除、覆盖、拼接或重新解释
它们的 marker、journal、artifact、SHA、授权和质量结论。

## 4. D0 通过定义

| 门                                            | 结果                                                   |
| --------------------------------------------- | ------------------------------------------------------ |
| Provider calls                                | `0`（设计阶段无运行）                                  |
| credential reads                              | `0`                                                    |
| formal marker/journal/artifact/recovery claim | `0`                                                    |
| 产品/Docker/API/browser/业务写入              | `0`                                                    |
| 旧 T3 validator/SHA                           | 只读保持不变                                           |
| 下一步                                        | 仅 C1 zero-provider launcher/projection implementation |

## 5. 读者验收问题

1. V2 为什么不是 T3 的修复后重跑？
2. generic root key 为什么只在 launcher 里存在，不能进入 runtime core？
3. configuration preflight 为什么要放在 marker 前？
4. transport authority 为什么不能直接解锁 `/api/chat` 产品验收？
5. 如果 L1 失败，哪些东西必须封存且禁止重试？

## 6. 结论

D0 已完成并只形成 `zero_provider_transport_reentry_v2_design / qualityAuthority=none`。后续 C1 已完成，但在 C2/S1
完成、新数据边界接受和新 exact authorization 之前，仍不得执行 V2 controlled canary，也不得进入产品或 `main`。

C1 结果见 [`Transport Re-entry V2 C1 launcher/projection 验收`](./phase-6-9-8-retriever-final-response-transport-reentry-v2-c1-zero-provider-launcher-projection.md)。

C2 结果见 [`Transport Re-entry V2 C2 runner/durability 验收`](./phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-zero-provider-runner-durability.md)。
