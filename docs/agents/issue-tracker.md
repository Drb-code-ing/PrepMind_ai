# Issue Tracker

本仓库使用本地 Markdown 作为 Matt Pocock engineering skills 的 issue tracker。

## 约定

- 一个 feature 一个目录：`.scratch/<feature-slug>/`
- feature spec：`.scratch/<feature-slug>/spec.md`
- 每张实现 ticket 独立成文件：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`
- ticket 的 `Status:` 记录 triage/实现状态；依赖写在 `Blocked by:`
- 讨论和验收回执追加在 ticket 的 `## Comments` 下

本地 tracker 不调用 GitHub CLI，也不保存凭据、用户正文或 Provider 原文。
