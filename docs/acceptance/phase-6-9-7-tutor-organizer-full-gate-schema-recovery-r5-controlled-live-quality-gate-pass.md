# Phase 6.9.7 Tutor / Organizer Full-gate Schema Recovery SR5 Controlled-Live 质量门通过验收

日期：2026-08-02

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

结论：唯一 SR5 controlled-Live run `63f8a76b-1c2a-403d-b774-0235caae04cb` 已通过完整
Schema Recovery full gate，并由正常 runtime publication durable seal。最终 gate 为
`schema_recovery_quality_gate_passed`，quality authority 为
`schema_recovery_full_gate_semantic_gate`。该 authority 证明固定 72-case / 24-pair 分支评测中的真实模型语义、
strict schema、24-sample P95、verified usage、预算和安全门通过；不等于 Tutor Chat、Organizer single/batch、
Trace、业务写入、Docker API、可见浏览器、SLA、main 或生产可用性已经验收。

SR5 一次性名额已经消费。禁止 retry、resume、replay、backfill、crash seal、recovery、单 case、curl、产品 API
或其它追加 Provider 探测，也禁止删除、移动、覆盖或改写 marker、journal、artifact、approved tag 和历史 L3
证据。当前只解锁 SR6 分支产品 Docker/API/可见浏览器验收；SR7/main 与 Phase 6.9.8 继续阻断。

## 1. 为什么需要 SR5

旧 full-gate L3 已永久保持 `full_gate_quality_gate_failed / qualityAuthority=none`：Tutor runtime 11 在
Provider content 已解析后、strict schema 完成前失败。SR0--SR4 因此建立了独立 Schema Recovery lineage：

- Provider content 先进入有界 native JSON envelope parser；
- 只有 canonical own-data safe integer `intentIndex` 被投影为模型选择；
- 本地重新构造 strict projected decision；
- Tutor V6 local signal、preferred depth、`answer_direct` 权限和 merger 保持本地权威；
- Organizer 继续复用 V9 本地合法 option authority、V6 validator/merger 与写权限隔离；
- extension fields 只能形成 bounded no-raw diagnostic 后丢弃，missing/alias/type/range/duplicate/wrapper 仍
  fail-closed；
- SR4 reviewed Mock 虽得到 `48/48` 与接近满分 semantic，但 authority 固定为 Mock-only。

SR5 的职责是用新的 source admission、独立 credential、第一方 DeepSeek V4 Pro direct adapter 与
`deepseek_network` provenance，验证上述修复是否能在完整真实模型 full gate 中成立。

## 2. Fresh Admission 与一次性边界

### 2.1 冻结源码与远端一致性

| 项目                           | 结果                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| Source commit                  | `67661f5f3a302b547e804c2c1839ec89898d4441`                         |
| HEAD / upstream / remote       | 同一 source commit                                                 |
| Approved tag                   | `phase-6-9-7-tutor-organizer-schema-recovery-sr5-approved`         |
| Local / remote tag             | 同一 source commit                                                 |
| Tracked worktree               | clean                                                              |
| SR5 formal files before run    | `0`                                                                |
| SR3 source manifest SHA-256    | `1a811394b6e6c182ef33bb22c8aa5545400e8083a5f226d9d5eab5e7c40adfbb` |
| SR5 admission manifest SHA-256 | `ce3ecceed09dd76d9bd0788cf3b28daf9329fb007523dc15bb3979de4e6d5ddf` |
| Runnable bundle SHA-256        | `61e6bb60fa2c5aa2a74d511b4ba8fbaf86ed186d8993afb9e5ddb844bb05d08c` |

Runnable bundle 包含 SR5 authority、production CLI、live harness、runner、durability、Tutor Schema Recovery、
Organizer V9、本地 authority/merger、第一方 adapter 与 proxy preflight 等 34 个执行/权威文件。SHA anchor 使用独立
detached manifest，避免 authority 文件自引用；approved commit/tag 与远端 parity 绑定该 anchor。

### 2.2 历史 L3 不可变性

Admission 前由旧 strict validator 重新确认：

- run：`2b0ac3a0-631f-4c7f-9781-ce0cda94149a`；
- gate：`full_gate_quality_gate_failed`；
- quality authority：`none`；
- journal：`296 / evidence_published`；
- physical artifact SHA-256：
  `e081939bb7f4b17235b1d9afb61d78031879bb80b9d64c952e4b86531cd7dbe5`。

SR5 没有修改、恢复、拼接或重解释 L3；两个 lineage 的 gate、artifact 与 validator 继续独立。

### 2.3 Proxy、授权与 credential

- fresh 通用 zero-provider preflight：`loopback_proxy_ready / listenerProbeCalls=1 / providerCalls=0`；
- 隔离 SR5 子进程没有加载整份根 `.env`，只映射专用 SR5 credential 与 exact authorization；该进程自己的
  opaque preflight attestation 为 `direct_ready / providerCalls=0`，并在 reservation 时单次消费；
- credential 未打印、未写入命令输出、artifact、journal、文档或 Git；generic/其它 Agent key 不能替代专用
  SR5 credential；
- approval、credential、marker 的读取顺序固定在 proxy/source admission 之后。

第一次进入 production CLI 时，source reader 在 marker 前 fail-closed 为
`source_invalid / providerCalls=0 / evidenceSealed=false`。该事件没有读取 credential、没有创建正式文件、没有
reserved lane 或调用 Provider，因此不属于 SR5 Live attempt，也没有消耗一次性 reservation。随后只用零 Provider
命令逐项确认 branch/tag remote parity、bundle SHA、历史 L3 validator 与正式文件计数，正式 source reader 再次
完整通过后，才创建唯一 SR5 reservation。该前门拒绝没有与正式 run 的质量证据拼接。

## 3. 固定生产执行路径

```text
SR5 production CLI
  -> opaque proxy attestation
  -> source / remote tag / history / zero-artifact admission
  -> exact approval + dedicated credential
  -> exclusive marker + fsynced journal
  -> 24 guards：本地 authority，Provider 0-call
  -> 24 serial pairs / 48 runtime lanes
       -> Tutor：Schema Recovery envelope -> intentIndex projection
          -> strict projected decision -> V6 local authority/merger
          -> first-party DeepSeek V4 Pro direct adapter
       -> Organizer：V9 legal option selection -> V6 validator/merger
          -> first-party DeepSeek V4 Pro direct adapter
  -> strict scorer / L2 anchor / 24-sample P95 / usage / CNY / safety
  -> run terminal -> hard-link artifact -> evidence_published
  -> strict bundle validator recomputation
```

模型固定 `deepseek-v4-pro` non-thinking JSON，single dispatch、no tools、no retry。Tutor 每 lane 保持
`1/1200/300` 与 3500ms hard timeout；Organizer 保持 `1/3500/800` 与 5000ms hard timeout；总 cap 仍为
`48 calls / 0.55 CNY`。模型只拥有本地预先给出的 ordinal selection 权限，不拥有 route、answer、owner、真实
ID、locked name、stale fence、Trace admission 或写命令。

## 4. Controlled-Live 固定结果

| 维度                                                             | 结果                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| Run / mode / provenance                                          | `63f8a76b...04cb / live / deepseek_network`              |
| cases / guards / runtime lanes / pairs / Organizer decisions     | `72 / 24 / 48 / 24 / 32`                                 |
| guard verified zero-call                                         | `24/24`                                                  |
| reserved / terminal / orphan / not-started                       | `48 / 48 / 0 / 0`                                        |
| executor / dispatch / response / verified usage                  | `48 / 48 / 48 / 48`                                      |
| strict runtime success                                           | `48/48`                                                  |
| schema canonical / extension-discarded / rejected / not-observed | `48 / 0 / 0 / 0`                                         |
| Tutor semantic / absolute improvement                            | `0.9736111111111112 / 0.3106468253968254`                |
| Organizer semantic / absolute improvement                        | `0.9515968406593407 / 0.6734718406593407`                |
| Combined semantic                                                | `0.962603975885226`                                      |
| Tutor / Organizer full matches                                   | `23/24 / 30/32`                                          |
| Tutor invalid cases / Organizer invalid decisions                | `0 / 0`                                                  |
| L2 anchor Tutor / Organizer / Combined                           | `0.9141666666666668 / 0.9041666666666667 / 0.9091666667` |
| L2 anchor passed                                                 | `true`                                                   |
| Tutor candidate / Organizer / paired P95                         | `1836 / 2240 / 2240 ms`                                  |
| Tutor orchestration P95                                          | `1836.9308999999994 ms`                                  |
| input / output tokens                                            | `20966 / 789`                                            |
| verified runtime cases / Provider invocations                    | `48 / 48`                                                |
| estimated cost                                                   | `0.067632 CNY`                                           |
| critical / permission / mutation / broader fallback              | `0 / 0 / 0 / 0`                                          |
| locked-name changes / write-command leaks                        | `0 / 0`                                                  |
| breaker                                                          | `closed / null`                                          |
| gate                                                             | `schema_recovery_quality_gate_passed`                    |
| quality authority                                                | `schema_recovery_full_gate_semantic_gate`                |

固定门要求 Tutor/Organizer/Combined semantic 均至少 `0.85`、两条 lane 相对 baseline 各提升至少 `0.15`，Tutor /
Organizer / paired P95 分别不超过 `2500 / 4500 / 4500ms`，Tutor orchestration P95 不超过 `6500ms`，且
strict/wire/usage、L2 anchor、安全与费用全部完整。SR5 逐项通过，未依靠降低阈值、删除失败 case 或拼接历史 run。

## 5. Durable Evidence 与严格重算

| 项目                         | 结果                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Artifact                     | `phase-6-9-7-tutor-organizer-schema-recovery-sr5-branch-controlled-live-63f8a76b-1c2a-403d-b774-0235caae04cb.json` |
| Marker SHA-256               | `fef6bf7c4cf1bae95f5b25559f9defcf4beda2b4574ffef4e1f9dbad3a8e4459`                                                 |
| Journal records              | `628`                                                                                                              |
| Final journal event          | `evidence_published`                                                                                               |
| Runtime terminal sequence    | `626`                                                                                                              |
| Runtime terminal record hash | `3a69fdb1a28893e455bfbb0dda24347461e02f2262afbc7de90af85a8b1e6d5a`                                                 |
| Report logical SHA-256       | `ca8884c3e500ab493d113ac4d446290bfcb9ce591b7c63ee775374b3c282b15e`                                                 |
| Physical artifact SHA-256    | `87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be`                                                 |
| Completion / publication     | `runtime / runtime`                                                                                                |
| Recovery claim               | `null / 0`                                                                                                         |
| Strict bundle validator      | `ok=true`                                                                                                          |

Strict validator 从 marker、628 条 hash-chain journal 与 hard-link artifact 重新计算 source、preflight、固定分母、
schema/wire/usage、semantic、anchor、P95、费用、安全、breaker、logical/physical SHA 与 publication terminal。`.tmp`
中正式 SR5 文件恰好为 marker、该 run journal 与该 run artifact；没有 recovery claim 或第二个 artifact。

## 6. 代码与静态门

- SR5 targeted authority/CLI：`8/8`，`61` assertions；
- Agent full：`1184/1184`，`22252` assertions；
- AI full：`325/325`，`2378` assertions；
- Agent/AI typecheck、lint、定向 Prettier 与 `git diff --check`：通过；
- Live/authority、durability、source manifest/testing 四路独立复审：无 Critical/Important；
- admission source commit 与 approved tag 已推送远端；`.codex/` 保持本地未跟踪且未提交。

这些静态证据证明 SR5 production entry、单次 reservation、source admission、运行时 composition 与 durability
合同；真实模型质量 authority 只来自上述唯一 sealed Live artifact。

## 7. 权限、产品与副作用边界

SR5 没有启动产品 Docker service、Nest API、Next Web、worker、admin 或浏览器，也没有创建测试账号、Agent
Trace、WrongQuestion、deck/item、Review、Knowledge、BackgroundJob、Outbox、MinIO object 或浏览器 storage。
因此：

- SR5 pass 不证明 `/api/chat` 最终 Router/RAG/流式回答；
- 不证明 Tutor legacy product gate 已切换到 Schema Recovery composition；
- 不证明 Organizer single/batch 的 snapshot、三阶段 stale fence、Trace admission 与最终写事务；
- 不证明 default-off、forced failure、owner/locked-name/write isolation 的 Docker product parity；
- P95 是固定 full-gate candidate/orchestration 指标，不是 HTTP、页面或最终流式 Chat SLA；
- 估算费用来自冻结价格表与 verified usage，不替代 Provider 账单；
- 没有清空、删除或重置 Docker container、image、volume、PostgreSQL、Redis 或 MinIO。

## 8. 下一任务与停止门

当前唯一下一原子任务是 SR6 分支产品验收：

1. 先设计并静态验证 SR5 authority 到 Tutor Web / Organizer Nest composition 的受限接线；
2. Docker 中按 Tutor-only -> default-off -> Organizer-only -> default-off -> 双路/forced failure 顺序验收；
3. 使用 authenticated 合成账号验证 Tutor Chat、Organizer single/batch、Trace、owner/locked-name/write isolation；
4. 使用 headed 浏览器保持窗口可见，验收 `/chat` 与 `/error-book`；
5. 精确清理本轮合成账号、业务记录、Trace、对象和隔离浏览器 storage；
6. 恢复 tracked/runtime gates 为默认关闭，并保留 Docker volume 与用户数据；
7. SR6 完成后单独提交并推送当前功能分支。

SR6 不重跑 SR5 Live。只有 SR6 验收、文档、提交与远程推送全部完成后，才允许 SR7 从 main 新建/执行合并
与 default-off 回放；当前不合并 main，不推进 Phase 6.9.8/6.10/8/9 或博客收尾。

回顾时可以问：

- 为什么第一次 `source_invalid / providerCalls=0` 不属于已消费的 controlled-Live？
- 为什么 SR5 的 `48/48` 必须同时具备完整 wire、verified usage、schema 与本地 authority 才能算 strict success？
- 为什么真实 Provider 返回 48 个 canonical envelope，而 SR4 Mock 的 6 个 extension case 仍有保留价值？
- 为什么 `schema_recovery_full_gate_semantic_gate` 仍不能直接证明产品可用？
- 为什么 SR6 只能回放 SR5 sealed authority，不能再次调用 Provider来“确认一下”？
- 为什么 SR5 artifact、旧 L3 artifact 与 SR4 Mock authority 必须彼此独立、不能拼接或覆盖？
