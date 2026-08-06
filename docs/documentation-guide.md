# PrepMind AI 文档规范

## 目标

文档要让协作者在几分钟内回答三件事：

1. 现在的实现和 authority 到哪里；
2. 某一步为什么做、实际做了什么；
3. 下一步如何安全复现、验收和提问。

本规范服务于当前文档和新文档。历史 sealed evidence 不因为规范升级而重写事实。

## Source of truth 层级

按以下顺序判断事实：

1. **运行验收文档**：某一次运行的输入、命令、结果和 authority。
2. **当前状态页**：把多个验收结论压缩成当前可行动摘要。
3. **数据流/架构文档**：解释当前边界与职责，不替代运行证据。
4. **路线图/DEVLOG**：解释顺序、原因和时间线；遇到冲突回到验收文档。
5. **计划/设计**：说明预期，不自动表示已实现。
6. **博客**：用于学习和复盘，所有事实必须链接回以上来源。

`README.md`、`AGENTS.md` 和 `CLAUDE.md` 只做入口与短摘要，不能成为唯一证据源。

## 新文档最小元数据

新建设计、计划或验收文档时，文件头部应包含以下信息（历史文件不强制回填）：

```yaml
---
id: phase-6-9-8-r4-reviewed-mock
phase: 6.9.8
kind: acceptance # design | plan | acceptance | blog | guide
status: completed_mock_only
as_of: 2026-08-06
branch: drb/docs-example
authority: architecture_recovery_mock_quality_not_evidence
replay: forbidden
source_of_truth: docs/acceptance/example.md
---
```

字段含义：

- `status` 描述生命周期，不描述质量高低；
- `authority` 描述这份证据能否被后续阶段使用；
- `replay` 明确是否允许重跑；sealed Live 默认 `forbidden`；
- `as_of` 防止历史“下一步”被误读为当前状态；
- `source_of_truth` 必须指向可读的具体文件，不写模糊目录。

## 状态与 authority 词汇表

### 生命周期状态

| 值                        | 含义                                                 |
| ------------------------- | ---------------------------------------------------- |
| `design_only`             | 只有设计决策，没有实现或运行证据                     |
| `planned`                 | 计划已写，尚未完成                                   |
| `completed_zero_provider` | 代码/测试完成，但没有外部 Provider 调用              |
| `completed_mock_only`     | reviewed Mock 通过，不能证明真实模型                 |
| `controlled_live_passed`  | 一次受控真实模型评测通过，范围仍限于该 lineage       |
| `controlled_live_failed`  | 一次性真实模型评测失败并封存，不得自动重试           |
| `product_default_off`     | 产品路径已验收，但生产 gate 恢复关闭                 |
| `main_replayed`           | main 上完成了独立 default-off 回放                   |
| `blocked`                 | 受授权、环境或上游失败边界阻断                       |
| `superseded`              | 被新 lineage 替代，旧文档仍保留                      |
| `reference_snapshot`      | 只读维护入口（例如分支图），不承载运行质量 authority |

### Authority

| 值                            | 可以证明                        | 不能推导                       |
| ----------------------------- | ------------------------------- | ------------------------------ |
| `none`                        | 只有结构/流程自洽               | 真实模型、产品质量、费用       |
| `deterministic_baseline_only` | 本地规则的可重复基线            | 模型净收益                     |
| `mock_quality_not_evidence`   | Mock contract 和 scorer 自洽    | Provider 语义、P95、账单       |
| `diagnostic_only`             | 受限 transport/usage 诊断       | Agent 语义或产品健康           |
| `*_semantic_gate`             | 指定数据集/lineage 的真实语义门 | 全产品或 main 部署             |
| `product_default_off`         | 产品接线、权限、降级和清理      | 默认启用生产模型               |
| `main_default_off`            | main 回放和默认关闭状态         | 真实模型持续可用性             |
| `documentation_only`          | 文档/分支拓扑与复核入口         | 代码行为、模型质量或产品可用性 |

不要把 `status=completed_mock_only` 写成“Agent 已可用”，也不要把一次 `controlled_live_passed` 扩大为所有 Agent 或产品已通过。

## 验收文档固定结构

每份新 acceptance 至少包含：

1. **Scope / as-of**：阶段、lineage、分支和日期；
2. **Authorization**：是否读取 credential、是否有精确一次性授权；
3. **Source / contract**：manifest、prompt/schema/policy、commit 或 SHA；
4. **Execution**：命令、调用次数、预算、超时、取消和 breaker；
5. **Result**：guard、strict、wire、usage、semantic、P95、费用和失败原因；
6. **Authority**：明确 gate、qualityAuthority、可被谁使用；
7. **Side effects**：Docker、数据库、Trace、Outbox、业务写入和清理；
8. **Reader questions**：至少 3 个回顾时可以追问的问题；
9. **Next boundary**：下一步、需要的授权、禁止的动作。

没有真实 usage 时，费用必须写 `null`；synthetic cost 必须注明是预算回归，不能伪装成账单。

## 写作规则

- 先写结论，再写证据；每个数字都给来源。
- 当前事实与历史事实分区；历史段落使用 `as-of YYYY-MM-DD` 或“当时”。
- 一个段落只表达一个边界，不把设计、Mock、Live、产品和 main 混成“完成”。
- 统一使用 `providerCalls`、`credentialReads`、`verified usage`、`qualityAuthority` 等固定字段名。
- 不保存 prompt、完整回答、RAG chunk、raw error、URL、token、cookie、API key 或真实用户正文。
- 相对链接从当前文件目录计算；链接目标必须存在；命令中的历史路径也要注明“计划/未创建”。
- 读者需要知道“怎么问”：为阶段文档提供 3--8 个可复制问题。

## Git 与文档同步

每个原子任务按以下顺序：

1. 从规定基线分支创建普通 git 分支，不在 worktree 中套分支；分支 source、merge commit 和 main replay 另记在 [`docs/branch-map.md`](./branch-map.md)；
2. 先改代码/证据，再同步 `DEVLOG.md`、当前状态、路线图和对应 acceptance；
3. 跑 focused 测试、相关全量测试、Prettier、`git diff --check`、链接和敏感信息检查；
4. 一项任务一个清晰 commit；
5. 在允许的阶段边界合并 main 并推送。Live 未授权时只推送功能分支，不擅自合并 main；不要把“有意未合入”误报成遗漏；
6. 提交后记录 commit、远程 parity、浏览器/容器是否启动以及残留清理结果。

## Reader Testing

完成文档后，使用无上下文读者按以下问题测试：

- 现在的 authority 是什么？
- 这份文档能证明什么、不能证明什么？
- 下一步需要什么授权，哪些命令禁止执行？
- 如何从文档找到真实运行证据和对应代码？
- 如果看到“未完成”，如何判断它是历史 as-of 还是当前阻断？

读者无法回答时，优先补入口、状态、authority 和链接，不要继续堆叠背景段落。

## 历史文档修复边界

允许：修复坏链接、明显编码损坏、补充 as-of 标签、增加指向当前状态页的导航。
禁止：用后续结果改写旧 run、删除失败证据、重新计算 sealed 数字、补写不存在的 Provider response 或把历史计划标成完成。
