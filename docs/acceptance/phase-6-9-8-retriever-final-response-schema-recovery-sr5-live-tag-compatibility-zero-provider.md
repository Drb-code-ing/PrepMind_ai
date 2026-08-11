# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR5 Live tag compatibility（zero-provider）

日期：2026-08-10
范围：修复 SR5 Live source admission 对不可变历史 tag 的绑定冲突。本文是实现与静态回归记录，不是
controlled-Live 结果。

> 状态更正（2026-08-11）：本文记录的是 tag compatibility checkpoint。当时写入的“尚未创建新 tag/下一步创建”
> 只描述该 checkpoint 的时点；随后已在 `main@284ea354` 创建并推送
> `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v1-approved`，并完成合并后二次 zero-provider 回归。
> 当前最新阻断点与修复见 `...sr5-live-proxy-port-recovery-zero-provider.md`；不得把本页历史下一步当作当前状态。

## 为什么需要这一步

历史 SR5 admission contract 固定绑定 annotated tag
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-approved`，其 peeled commit 为修复前的
`ca9a9eb0`。代理快照修复及后续 Live implementation 已改变 source；移动或覆盖历史 tag 会让封存证据失去
可复现性，也会使旧 admission 的 manifest/source SHA 语义漂移。因此 Live 必须使用独立、版本化的 tag：

```text
phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v1-approved
```

历史 contract/schema/manifest 保持原值；Live 使用独立 source schema、source-ref、tree-object bundle 和
source-manifest binding。两条 lineage 不共享可移动的 tag identity。

## 本次实现

- 在 historical SR5 contract 中仅新增 Live tag/ref 常量；旧 tag 与旧 admission manifest SHA 不变。
- 新增 `phase-...-sr5-live-source-schema.ts`：严格要求 Live lineage、Live tag/ref、Live source-manifest SHA、
  historical manifest SHA、HEAD/upstream/origin parity、clean tree、formal namespace=0。
- Live source manifest 改为绑定新的 Live ref；source objects 仍覆盖 root package/lockfile 与
  `packages/agent`、`packages/ai`、`packages/types` Git trees。
- Live admission 改为独立读取新 tag 的 peeled commit/tag object，重新计算 tree bundle，再校验 boundary、
  source-bound authorization 与 budget；历史 source-admission 函数不被改写。
- Live report/CLI 类型改为消费 Live source schema；synthetic reviewed Mock 使用同一 Live schema，不能借旧
  schema 伪造 Live source。
- Bun/Windows authorization/proxy accessor 只读取 own descriptor 并物化为 immutable own data-property；getter 异常保留为
  invalid sentinel，避免被当成“未配置”。root/`.tmp` 的 symlink、junction、非目录或 canonical-path 漂移在 namespace
  扫描与 durability 读写前后均 fail-closed；非 Windows 文件打开增加 `O_NOFOLLOW`。

## 零 Provider 验收

在本 checkpoint 当时未创建新 tag、未提供新的 source-bound authorization，所有生产 Live 入口仍 fail-closed；本次没有
读取根 `.env`、credential 或 Provider，也没有创建正式 marker/journal/report/artifact/recovery claim，未写入
产品数据，未启动或清理 Docker/PostgreSQL/Redis/MinIO/API/browser。

```text
focused SR5 contract + source admission + Live regression: 26/26 tests
expect assertions: 102
Agent full: 1527/1527 tests, 25213 assertions, 196 files
Agent typecheck: pass
Agent lint: pass
git diff --check: pass
```

Live synthetic schedule 仍固定 `8 guards + 6 rewrite pairs + 6 FinalResponse`、DeepSeek `12` + Qwen `12`、
并发 `1`、总预算 `0.176 CNY`，禁止 retry/resume/replay/backfill。synthetic 结果的 authority 仍为
`qualityAuthority=none`，不代表真实模型质量。

Durability 的目录围栏在每次文件读写前后重新检查 `.tmp` 的 `lstat + realpath`、父目录 canonical identity；非 Windows
文件打开使用 `O_NOFOLLOW`，hard-link 与 cleanup 也只接受 regular file。测试覆盖已预留后替换 `.tmp` 为 junction/symlink
的 fail-closed 路径。该跨平台 Node CLI 不承诺对同机高权限攻击者在单次 syscall 窗口内的原子 `openat` 语义；此类攻击者不在本地
受控评测威胁模型内，发现目录漂移时宁可停止并保留可审计残留，不继续向未知路径写入。

## 本 checkpoint 当时的下一停止门（后续已完成）

1. （已完成）将本次源码与文档合并回 `main`，推送 `origin/main`，并在合并后二次执行相同 zero-provider 回归。
2. （已完成）在最终 parity commit 上创建并推送唯一新的 annotated tag
   `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v1-approved`，核对 tag object 与 peeled commit。
3. （已完成后再次失效）由用户针对该 tag、peeled commit 与 source bundle 重新接受 DeepSeek/Qwen 数据边界，并发送绑定该最终 source 的两行
   exact authorization。
4. （因源码再次变化而需重新执行）仅在所有前门通过后执行一次 controlled-Live；成功、quality gate 失败或 transport/configuration 失败都必须
   durable seal，之后禁止 retry/resume/replay/backfill、curl、单 case 或追加 Provider 探测。

本文件不消费当前授权，也不宣称 Live 已执行。旧 tag、旧 marker/journal/artifact（如存在）均不可移动、覆盖或删除。
