# Phase 6.9.7 Task 12 — Tutor / WrongQuestionOrganizer Controlled-Live 与产品验收

日期：2026-07-24

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：唯一 branch controlled-Live 已执行并以 `quality_gate_failed` 封存；授权已消费，不得重跑。因质量门未通过，Docker/API/可见浏览器产品验收未启动，Phase 6.9.7 尚未完成。

## 1. 本次授权范围

用户授权原文：

> 我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7 Tutor/Organizer branch controlled-Live。

授权只覆盖 Task 12 的固定顺序：零网络 preflight、唯一 72-case Live、质量门通过后的 Docker/API 与 headed 可见浏览器验收、精确合成数据清理和 default-off 恢复。无论 Live 成功或失败，marker/evidence 都必须保留且不得重跑、覆盖、删除或拼接。

## 2. 为什么在唯一 Live 前增加 hardening

Task 9 CLI 试图要求其它已模型化 Agent gate 全部关闭，但 Router/Verifier 使用了不存在的 `ROUTER_AGENT_MODEL_ENABLED` / `KNOWLEDGE_VERIFIER_AGENT_MODEL_ENABLED`；产品实际 gate 是 `ROUTER_MODEL_ENABLED` / `KNOWLEDGE_VERIFIER_MODEL_ENABLED`。旧实现因此不能证明这两个真实产品 gate 已关闭。

该缺口发生在 marker 预留之前，不能用“本次环境碰巧是 false”替代代码修复。唯一 Live 必须运行在已提交、可复验、fail-closed 的正确 preflight 上。

## 3. RED / GREEN 与最终边界

- RED：新增六个其它生产 Agent gate 的参数化测试后，`ROUTER_MODEL_ENABLED=true` 未被识别，synthetic harness 进入 Live 并返回报告；focused 为 `6 pass / 1 fail`，证明缺口真实存在。
- GREEN：CLI 改用 `ROUTER_MODEL_ENABLED` 与 `KNOWLEDGE_VERIFIER_MODEL_ENABLED`；六个其它 gate 任一为 `true` 都返回 `live_configuration_invalid`，executor invocation 为 0，repo 外临时 marker/evidence 由测试 finally 精确清理。
- 覆盖的其它生产 gate：Router、KnowledgeVerifier、Review、Planner、KnowledgeDedup、KnowledgeOrganizer；本阶段目标 Tutor/Organizer 两个 gate 必须为 `true`。
- `REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED` 等独立历史验收入口不属于生产模型 gate；实际 Task 12 进程仍会显式保持其为 `false`，且不会启动任何其它验收 runner。

## 4. 唯一 Live 结果

- run ID：`39a62241-0f51-45be-a423-0d13b0b60ae4`
- runner：`phase-6.9.7-tutor-organizer-runner-v1`
- dataset：`phase-6.9-tutor-wrong-question-v1`
- dataset SHA-256：`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`
- executor provenance：`deepseek_network`
- evidence：`.tmp/phase-6-9-7-tutor-organizer-branch-live-39a62241-0f51-45be-a423-0d13b0b60ae4.json`
- evidence SHA-256：`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5`
- marker：`.tmp/phase-6-9-7-tutor-organizer-controlled-live.marker`
- marker SHA-256：`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`

marker 的 `state=attempt_reserved` 表示一次性名额已经占用，不表示质量通过。evidence 文件名、run ID、strict schema 与敏感信息检查已由独立 validator 验证通过。

| 质量门 | 要求 | 实际 | 结论 |
| --- | --- | --- | --- |
| zero-call | `24/24` | `24/24` | 通过 |
| strict runtime | `48/48` | `27/48` | 失败 |
| Tutor semantic | `>= 0.85` | `0.3485119048` | 失败 |
| Tutor 绝对提升 | `>= 0.15` | `-0.0933547619` | 失败 |
| Organizer semantic | `>= 0.85` | `0.7000000000` | 失败 |
| Organizer 绝对提升 | `>= 0.15` | `0.4218750000` | 通过 |
| critical / permission / mutation / broader fallback | 全部 `0` | 全部 `0` | 通过 |
| Tutor P95 | `<= 2500ms` | `1359ms` | 通过 |
| Organizer P95 | `<= 4500ms` | `2640ms` | 通过 |
| paired candidate P95 | `<= 4500ms` | `2641.6812ms` | 通过 |
| Tutor orchestration P95 | `<= 6500ms` | `1360.8845ms` | 通过 |
| verified usage | `48` | `48` | 通过 |
| 费用 | `0 < cost <= 0.55 CNY` | `0.086418 CNY` | 通过 |
| 最终 gate | `quality_gate_passed` | `quality_gate_failed` | 失败 |

provider 共报告 `21288` input tokens 与 `3759` output tokens，价格 profile 为 `deepseek-v4-pro-cny-2026-07-15`。Tutor 有 `15` 个 invalid case，Organizer 有 `6` 个 invalid decision；所有失败都保留在固定分母中，没有通过删 case 美化指标。当前可确认的失败签名是“provider 输出通过底层 JSON schema，但在 canonical association/merger 后回退为 `fallback_schema_invalid`”；在没有保存原始模型输出的安全边界下，不能把它进一步武断归因于单一 prompt 或 validator 缺陷。

## 5. Preflight hardening 验证结果

| 验证项 | 结果 |
| --- | --- |
| CLI focused RED | `6 pass / 1 fail`，正确暴露真实 gate 漏检 |
| CLI focused GREEN | `7/7`，`41 expect()` |
| Agent full | `543/543`，`5598 expect()` |
| Agent typecheck | exit `0` |
| Agent lint | exit `0` |
| `git diff --check` | exit `0` |
| 独立 gate 名称复核 | 八个生产模型 gate 完整；无旧名称残留 |

本节的 preflight 测试只使用 repo 外临时目录与 synthetic executor，没有触碰仓库唯一 Live marker/evidence；真实 marker/evidence 仅由随后那一次授权 Live 创建。

## 6. 停止条件与下一步

本次结果命中了固定停止条件：V1 marker/evidence 保持不可变，不得删除、覆盖、拼接或再次运行同一 CLI；Docker service、产品 API、可见浏览器与 synthetic 业务数据阶段均未启动。调用只使用进程级覆盖，进程退出后不保留 Live/gate/component-key 变量，仓库 tracked defaults 仍为 mock/live=false、两个目标 gate=false；根 `.env` 未被修改，Docker service/容器/镜像/卷也未清理或重建。

Phase 6.9.7 不能据此宣称完成。下一步只能先做零网络失败归因与 V2 remediation 设计，使用新的 runner/prompt identity、独立 marker/evidence 和新的明确授权；V1 继续作为失败 authority 保留。V2 设计完成前不得申请新 Live，更不得绕过语义门直接做产品验收。

回顾时可以问：

- 为什么环境里实际是 `false` 也不能忽略错误 gate 名称？
- 为什么 gate 校验必须发生在 marker 与 executor 之前？
- 为什么 RED 使用 repo 外 synthetic marker 不会消费真正的一次性授权？
- 为什么 Live 质量失败后不能继续做产品 Docker 验收？
- 为什么 `24/24` zero-call、延迟和费用都通过，仍不能说明 Agent 可用？
- 为什么 `rawSchemaValid=true` 之后还必须经过 canonical association 与本地 merger？
- 为什么 V2 必须使用新 identity/marker，而不能删除 V1 marker 后重跑？
