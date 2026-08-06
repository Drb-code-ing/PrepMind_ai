# Phase 6.9.8 Transport Evidence Recovery T3-C

## CLI configuration composition zero-provider checkpoint

> 日期：2026-08-07  
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`  
> authority：`zero_provider_transport_evidence_t3_configuration_guard`  
> qualityAuthority：`none`

## 1. 背景

T3 唯一 controlled canary 在 Provider slot 启动前的 late-bound credential gate 以
`configuration_invalid` 失败。该 run 已一次性封存，不能通过重跑验证修复。因此本 checkpoint 只验证“生产入口不会再次
因为 package cwd 与仓库根 `.env` 路径漂移而失配”，不读取真实 key、不调用 Provider、不创建 marker/journal/artifact，
也不是 T3 retry 或 recovery。

## 2. 固定契约

- `@repo/agent` controlled package script 必须包含 `bun --env-file=../../.env`；该路径从 package cwd 解析到仓库根 `.env`。
- CLI 脚本不能嵌入 credential 值，也不能通过命令参数覆盖 root、URL、model、output 或 retry 选项。
- crash-only seal CLI 不读取 `process.env`，不导入 fetch/Provider port，只接受固定 seal confirmation。
- 该 guard 只检查源码/package command composition；不读取实际 `.env` 内容，不产生 credential read 计数。

## 3. 实现范围

新增：

```text
packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-t3-configuration.test.ts
```

测试读取 tracked `package.json` 与 CLI source，验证 root `.env` 相对路径、controlled command 的显式 env-file、seal CLI
的无 credential/Provider 端口边界和 exact confirmation。它不启动 controlled script，不调用 Docker/API/browser，不访问网络。

## 4. 验收证据

| 检查                                                | 结果                         |
| --------------------------------------------------- | ---------------------------- |
| focused configuration guard                         | `2/2` tests，`10` assertions |
| `bun --filter @repo/agent typecheck`                | 通过                         |
| `bun --filter @repo/agent lint`                     | 通过                         |
| `git diff --check`                                  | 通过                         |
| Provider calls / credential reads / formal evidence | `0 / 0 / 0`                  |
| Docker/API/browser/业务写入                         | 未执行，`0`                  |

## 5. 结论与边界

T3-C 证明修复后的 CLI 配置入口在静态层面可重算，避免同类 `.env` 路径回归；它不改变已封存 T3 的 gate、runId、marker、
journal、report 或 artifact，也不形成 Provider health、semantic、P95、成本、产品或 `main` authority。

T3 controlled canary 的一次性名额仍已消费。任何新的真实模型调用都必须另立 lineage、重新接受数据边界并取得新的精确授权；
本 checkpoint 不授予该权限，也不自动解锁 Phase 6.9.8 Task 10/11、产品验收或后续阶段。

## 6. 回顾问题

1. 为什么 package script 显式 `--env-file` 能修复入口，却不能恢复已消费的一次性 marker？
2. 为什么静态读取 package/source 不等于读取真实 credential？
3. 为什么 seal CLI 必须和 controlled CLI 分离？
