# Domain Docs

这是一个 single-context 仓库。工程 skills 在探索或实现前按以下顺序读取：

1. 根目录 `CONTEXT.md`：ChatTurn、owner-scoped、durable answer 和 Worker 等术语的唯一词汇表。
2. `docs/adr/`：只读取与当前模块相关的架构决策；目录不存在时不强制创建。
3. 当前阶段的 `docs/acceptance/` 与 `docs/project-status.md`：确认实现、Mock、controlled-Live 和产品证据边界。

新的领域术语先补充到 `CONTEXT.md`；不可逆的架构决定再创建 ADR。不要在 `.scratch/` 复制一份 glossary。
