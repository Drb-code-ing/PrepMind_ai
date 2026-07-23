# Phase 6.9.7 Task 2 — Tutor / WrongQuestionOrganizer 模型合同与安全投影

## 1. 本任务完成了什么

Task 2 只建立模型调用前后的结构边界，不创建 executor，也不接入产品 runtime：

- Tutor 输出只能是五类教学 intent、三档 depth、medium/high confidence 与固定 evidence code；`answer_direct` 不在模型权限内；
- WrongQuestionOrganizer 输出只能引用 `questionIndex=0..11`、`deckIndex=0..19`、固定 subject/action/confidence/evidence enum 与安全 topic label；
- 动态 validator 拒绝缺失、部分、重复/越界 question、跨 subject deck、违反本地 subject 权威、危险 label 与错误 evidence 关联；
- Tutor 输入先完整扫描 latest text / active context，再裁剪为 `480/640` 个 Unicode scalar，并在组装后重验 1200 input-token 工程预算；
- Organizer 在完整扫描 subject/category/knowledge point/error type/question/analysis/answer/userNote 以及全部 deck name/keyword 后，才构造最多 `q0..q11` / `d0..d19` 的深冻结投影；完整 answer/userNote、UUID、owner、图片 URL 与写能力不进入投影；
- 公开 Organizer projection 不含真实 ID；ordinal 到 ID 的深冻结 map 只由 candidate/merger 内部入口保留。

## 2. 安全顺序与拒绝边界

固定顺序是：普通自有属性 descriptor clone -> strict source parse -> 完整字段扫描 -> safety metadata 合并 -> eligibility/关联检查 -> 裁剪 -> ordinal -> token 预算 -> deep freeze。

descriptor clone 不读取 getter，拒绝 proxy 异常、accessor、数组洞、额外 symbol、非普通 prototype 与循环/过深结构，并设置 `array<=256 / keys<=512 / nodes<=4096 / depth<=8` 的预解析工作上限。这样 Zod 的业务数组上限生效前也不会按攻击者提供的巨大稀疏数组分配或遍历。

完整扫描会在裁剪前拒绝：credential/private key、instruction override、system prompt exfiltration、工具/写操作指令、控制/format 字符、畸形 UTF-16、unsafe/unknown metadata 与过长字段。Organizer topic label 还拒绝 URL、Markdown/HTML、credential 词形和未分类/默认等保留名称。

复审同时发现既有 Knowledge projection 的 descriptor clone 存在超大数组预解析风险，且空 summary 可以形成无语义证据投影。本任务让 Knowledge projection 复用同一有界 clone、要求至少一条 summary，并补了超大稀疏数组、空 summary 与末尾高位 surrogate 回归；其 ordinal/pair/ID 隔离语义未改变。

## 3. RED / GREEN 与验证

RED：先加入四份 focused tests，在生产文件不存在时得到 `0 pass / 4 fail / 4 module-not-found errors`。

GREEN：

- Task 2 四份 focused tests：`19 pass / 0 fail`；
- 加上既有 Knowledge projection safety 回归：`25 pass / 0 fail / 103 expect()`；
- Agent full：`502 pass / 0 fail / 5126 expect()`；
- Agent `typecheck` / `lint`：exit `0`；
- 两路独立规格/质量复审最终均无 Critical/Important。

复现命令：

```bash
bun test packages/agent/tests/tutor-model-contract.test.ts packages/agent/tests/tutor-model-projection.test.ts packages/agent/tests/wrong-question-organizer-model-contract.test.ts packages/agent/tests/wrong-question-organizer-model-projection.test.ts packages/agent/tests/knowledge-model-projection.test.ts
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
```

## 4. 本任务没有做什么

- 没有读取 `.env`、generic key 或 component-specific credential；
- 没有创建 `ModelAgentRuntime` executor、调用 provider 或产生 token/CNY；
- 没有实现 candidate eligibility、merger、gate/config、Trace、API/UI 或数据库写入；
- 没有启动 Docker/浏览器，也没有创建或修改业务数据。

因此 Task 2 证明的是“模型即使以后被调用，也只能看安全投影并返回受限决定”，不证明 Tutor/Organizer 已能使用真实模型。后续 Task 3 已完成 Tutor package candidate eligibility 与本地权威 merger，证据见 `docs/acceptance/phase-6-9-7-tutor-model-candidate.md`；当前下一任务是 Task 4 WrongQuestionOrganizer candidate，仍只使用无网络 Mock/注入式 executor。

## 5. 后续状态同步（不改写 Task 2 边界）

Task 4 已完成 WrongQuestionOrganizer package candidate 与本地权威 merger，证据见 `docs/acceptance/phase-6-9-7-wrong-question-organizer-model-candidate.md`。Tutor/Organizer 两个 package candidate 现在都已完成，但产品 composition、真实 provider 与生产验收仍未完成；当前下一任务是 Task 5 Tutor Web server-only default-off runtime、Chat 编排与安全 Trace。
