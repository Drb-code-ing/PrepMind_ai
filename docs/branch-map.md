# PrepMind AI 分支与合并关系

---

id: repository-branch-map
phase: cross-phase
kind: guide
status: reference_snapshot
as_of: 2026-08-06
branch: drb/docs-governance-main
authority: documentation_only
replay: not_applicable
source_of_truth: docs/branch-map.md

---

这份文档回答一个容易被误读的问题：某个任务是“已经合并并验收”，还是“只在功能分支完成”，还是“被有意阻断”。它只描述 Git 关系，不提升任何 Agent、Mock 或 controlled-Live 的质量 authority。运行结论仍以对应 `docs/acceptance/*.md` 为准。

## 当前拓扑（2026-08-06）

```text
local origin/main (remote-tracking ref) == main == 185b8171
  ├─ 006f54e9  merge SR7 step-check fix
  │   └─ 43af2e85  drb/phase-6-9-7-sr7-step-check-route
  └─ 510bbc94  merge SR6
      └─ 64d4ff45  codex/phase-6-9-7-tutor-wrong-question-agents

drb/phase-6-9-8-retriever-final-response-contract
  └─ 5c4d27d9  Phase 6.9.8 Architecture Recovery R4
      └─ pushed origin/drb/phase-6-9-8-retriever-final-response-contract

drb/docs-governance-main
  └─ 9a2d6056  explicit merge of 5c4d27d9 for documentation review
      └─ current documentation governance commit on this branch
```

`drb/docs-governance-main` 是从 `main=185b8171` 创建的文档治理分支，然后显式合入已推送的 R4 分支。它不是 `main` 的替代品；因此当前 `main` 仍保持 `185b8171`，不会因为文档审阅而偷偷获得 R4 的产品或 Live authority。

## 已完成并已进入 main 的关键任务

| 任务                | 功能分支                                                         | main 合并提交 | main 后回放                    | 结论                                 |
| ------------------- | ---------------------------------------------------------------- | ------------- | ------------------------------ | ------------------------------------ |
| Tutor/Organizer SR6 | `codex/phase-6-9-7-tutor-wrong-question-agents` @ `64d4ff45`     | `510bbc94`    | SR7 main 回放记录在 `185b8171` | 已合并、已推送、default-off 回放通过 |
| SR7 step-check 修复 | `drb/phase-6-9-7-sr7-step-check-route` @ `43af2e85`              | `006f54e9`    | `185b8171`                     | 已合并、已推送、路由回放通过         |
| Review/Planner 主线 | `codex/phase-6-9-5-review-planner-live-diagnostics` @ `61e049a1` | `3aff6cc6`    | `baf9ecfd`                     | 已合并；只读受限路径，gate 恢复关闭  |

上表的“已完成”只表示该行对应的分支、合并和回放证据都存在，不代表整个 Phase 6.9 或所有 Agent 都已完成。

## 当前有意未合入 main 的任务

| 分支                                                | 当前 tip                 | 状态                           | 为什么不合并                                                                                                                            |
| --------------------------------------------------- | ------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `drb/phase-6-9-8-retriever-final-response-contract` | `5c4d27d9`               | R4 reviewed Mock/static 已完成 | R4 只有 `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`；R5 fresh admission 尚未授权，按准入规则不能合并 main |
| `drb/docs-governance-main`                          | `9a2d6056` + docs commit | 文档治理分支                   | 它包含 R4 基线用于审阅；在 R5/产品边界收口前不把 R4 带入 main                                                                           |

这里的“未合入”是明确的安全决策，不是遗漏。R4 分支已推送，证据和代码可回溯；禁止因为看到 `completed` 就自动合并。

## R5 的固定 lineage 交接（2026-08-06）

R5 不是从 `drb/docs-governance-main` 派生的新普通任务。R4 的 source-admission contract 把 branch、approved
source ref、HEAD/upstream/remote parity 和 source bundle 绑定到
`drb/phase-6-9-8-retriever-final-response-contract`；在文档治理分支上运行会返回
`source_admission_invalid`，从而阻止误发 controlled-Live capability。

因此 R5 若获准，只能切回已经推送的 R4 功能分支，重新做 clean/parity/proxy 检查，再消费新的精确授权。这里的“切回”是继续同一 fixed lineage，不是从功能分支再开子分支；当前不创建 R5 子分支，也不把 R4 或治理分支提前合入 `main`。若未来要坚持所有新任务都从 `main` 开分支，必须先完成独立的 zero-provider source-admission 参数化任务并建立新的 lineage，不能在 R5 运行中临时改 branch identity。

本次准入前检查的独立回执见
[R5 admission readiness](./acceptance/phase-6-9-8-retriever-final-response-r5-admission-readiness-zero-provider.md)。

## 历史分支的处理

- `codex/phase-6-9-5-review-planner` @ `b8c089d0` 是旧的、已发散的本地历史分支。它的 tip 不是 `main` 的祖先，并且相对当前 main 含有大规模删除/旧版 runner 变更；Review/Planner 的已完成结果来自 `3aff6cc6` 合并线，不能把这个旧 tip 当作“未合并任务”再合入。
- 其余保留的 `codex/*` 历史分支和远程跟踪分支在本快照中均为 `main` 的祖先，只用于 provenance；保留分支不会改变 main 内容。
- 当前工作树只有一个 worktree（仓库主目录）；没有嵌套 worktree 或从功能分支再开分支。

## 每次任务的合并闸门

1. 新任务从已推送且验证过的 `main` 创建普通 `drb/` 或约定的 `codex/` 分支；不从功能分支继续开分支。
2. 功能分支先完成 focused/全量静态检查、相关 Docker/API/可见浏览器验收和精确清理，再提交一个原子 commit。
3. 只有阶段授权允许时才用 `--no-ff` 合并 `main`；合并后在 `main` 重跑同一组关键检查，确认 `git diff <pre-merge>..HEAD` 与验收证据一致。
4. main 回放通过后才推送 `origin/main`；若 R5、Live 或产品准入未满足，只推送功能分支，不合并 main。
5. 合并前后都记录 `HEAD`、父提交、远程跟踪 ref、测试结果、Docker/浏览器状态和清理结果；任何失败都停在当前分支，不用重试或“补合并”掩盖失败。

## 本次快照的可复核命令

```powershell
git status --short --branch
git log --graph --decorate --oneline --all -n 30
git merge-base --is-ancestor drb/phase-6-9-7-sr7-step-check-route main
git merge-base --is-ancestor drb/phase-6-9-8-retriever-final-response-contract main
git worktree list --porcelain
```

预期结果是：SR7 分支命令退出 `0`，R4 分支命令非 `0`（有意未合入），worktree 只有主工作目录。网络可用时再用 `git ls-remote --heads origin` 验证远程，而不是把本地 remote-tracking ref 当成刚刚完成的网络检查。

## 回顾时可以这样问

- 这个完成结论对应哪个 commit、哪个 merge commit、哪一次 main 回放？
- 为什么 R4 已推送却不能合入 main？如果授权变化，新的准入证据是什么？
- 旧的 Review/Planner 分支为什么不应该直接 merge？
- 合并后失败会停在哪个分支，如何证明没有把失败结果推到 main？
