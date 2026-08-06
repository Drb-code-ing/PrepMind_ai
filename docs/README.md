# PrepMind AI 文档中心

这里是项目文档的导航页。文档数量较多，是因为每个阶段都保留了设计、计划、验收和复盘证据；这不是要求读者逐篇阅读，而是为了让每个结论都能回到可复现的来源。

## 从哪里开始

1. [当前状态](./current-status.md)：现在做到哪里、什么能做、什么不能做。
2. [分支关系](./branch-map.md)：哪些任务已经合并、哪些分支有意隔离，以及如何复核合并后回放。
3. [开发启动](./dev-start.md)：本地服务、Docker、环境变量和常用命令。
4. [统一验收清单](./acceptance-checklist.md)：改完功能后如何验证页面、API、Agent、worker 和数据清理。
5. [数据流](./data-flow.md)：当前 owner、业务事实、RAG、Agent、Trace、BackgroundJob 和 Outbox 的边界。
6. [路线图](./roadmap.md)：阶段顺序、当前阻断与后续计划。
7. [文档规范](./documentation-guide.md)：如何新增、更新、引用和封存文档。
8. [开发日志](../DEVLOG.md)：按时间记录已提交的工作；它是时间线，不是唯一状态源。

## 当前阶段入口

| 阶段                        | 当前结论                                                                       | 首要证据                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Phase 6.9.7 Tutor/Organizer | 主线已完成；SR5 语义 authority、SR6 产品 default-off、SR7 main replay 分开记录 | [SR7 main acceptance](./acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr7-main-acceptance.md)    |
| Phase 6.9.8 Task 9C         | 唯一 Live 失败封存，不得重跑                                                   | [Task 9C failure](./acceptance/phase-6-9-8-task-9c-controlled-live-quality-gate-failure.md)                         |
| Phase 6.9.8 Recovery R0--R4 | R4 Mock-only 完成，`qualityAuthority=none`                                     | [R4 acceptance](./acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md) |
| Phase 6.9.8 R5              | fresh admission 未授权、未开始                                                 | [当前状态](./current-status.md)                                                                                     |
| Phase 6.10                  | 分层记忆尚未启动                                                               | [路线图](./roadmap.md)                                                                                              |

分支是否已经进入 `main` 不看“完成”字样，而看 [分支关系](./branch-map.md) 中的 source tip、merge commit 和 main replay 三项证据。

## 文档类型与阅读目的

| 目录/文件                       | 用途                                                   | 是否能单独证明当前实现                       |
| ------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `docs/acceptance/`              | 某次 checkpoint 的输入、命令、结果、authority 和副作用 | 只有对应结论范围内可以；先看日期和 authority |
| `docs/superpowers/specs/`       | 设计、边界、决策和不变量                               | 不能替代运行验收                             |
| `docs/superpowers/plans/`       | 分步实施计划和预期证据                                 | 计划不是完成证明；旧计划按 as-of 阅读        |
| `docs/blogs/`、`docs/dev-blog/` | 面试学习与工程复盘                                     | 以引用的验收文档为事实来源                   |
| `AGENTS.md`、`CLAUDE.md`        | 协作快速上下文                                         | 只保留当前指针和关键规则，细节回链到证据     |
| `README.md`                     | 项目总览和能力索引                                     | 不承载完整历史运行数字                       |

## 历史文档怎么读

历史验收、计划和设计默认是不可改写的 as-of 记录。看到“下一步”“尚未实现”“不得进入产品”等句子时，先检查：

- 文档日期和分支；
- 当前状态页是否已经标记该 checkpoint 后续完成；
- 是否存在新的 lineage、authority 或 sealed failure；
- 文档是设计/计划，还是实际验收证据。

历史事实只做最小的链接、编码或明确 as-of 修复；不把后续结果倒灌进旧报告，也不删除失败证据。

## 按问题检索

```powershell
# 当前状态与 R5 边界
rg -n "当前状态|R5 fresh admission|qualityAuthority" docs README.md AGENTS.md CLAUDE.md

# 某阶段全部设计/计划/验收
rg --files docs | rg "phase-6-9-8|phase-6-9-7"

# 只读检查链接和历史路径
rg -n "docs/(acceptance|superpowers)|\.\.\/" docs README.md AGENTS.md CLAUDE.md
```

如果问题涉及真实模型、费用、P95、业务写入或浏览器结果，必须继续打开对应 `docs/acceptance/*.md`，不能只依据搜索摘要。

## 文档变更入口

新增或修改文档时遵循 [文档规范](./documentation-guide.md)，并在同一任务中同步：

- 当前状态/路线（若阶段状态变化）；
- `DEVLOG.md`（做了什么、为什么、证据和下一步）；
- 对应设计/计划（若边界或决策变化）；
- 对应 acceptance（若执行了验收）；
- 链接、敏感信息和读者问题检查。
