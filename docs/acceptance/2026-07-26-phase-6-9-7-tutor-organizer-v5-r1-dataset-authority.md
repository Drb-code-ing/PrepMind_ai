# Phase 6.9.7 Tutor / WrongQuestionOrganizer V5 R1 Dataset Authority 验收

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论

V5 R1 已完成，仍为 zero-provider。

- 新建独立 `phase-6.9-tutor-wrong-question-v2`，没有修改 V1 cases、版本或 SHA；
- Tutor 24 个 runtime fixture 显式绑定 language、exercise family、latest text 与同题 active context；
- Organizer 显式绑定 structured subject、taxonomy subject、topic candidates、topic ordinal 与 batch relation；
- dataset coherence 在模块加载时 fail-fast，错误 language/context、paired index、subject、topic ordinal 或
  batch relation 不能进入后续 candidate；
- prompt-safe projection 不包含 expected、selected ordinal、case ID、owner ID 或 V1 identity；
- 72/24/48/24 分母、语义门槛、延迟、usage、费用与 breaker 规则已在 candidate 前冻结；
- deterministic baseline 已运行并冻结，新数据缺失或不匹配仍保留在固定分母。

本轮没有实现 V5 Tutor/Organizer candidate、paired Mock/Live runner、marker、journal、evidence 或
network CLI，不构成 Mock、Live 或产品可用性验收。

## 2. 冻结 identity

| authority                 | version                             | SHA-256                                                            |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| V1 历史 dataset           | `phase-6.9-tutor-wrong-question-v1` | `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e` |
| V5 使用的 V2 dataset      | `phase-6.9-tutor-wrong-question-v2` | `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b` |
| V5 eval policy            | `phase-6.9.7-v5-eval-policy-v1`     | `b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d` |
| V5 deterministic baseline | `deterministic`                     | `0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca` |

V1 SHA 同时通过导出常量和对 canonical V1 dataset 的现场重算。V2、policy、baseline 均有运行时
SHA assertion 和测试中的固定字面量；任意字节变化会直接失败，不能把常量与内容一起静默修改后继续。

## 3. Dataset 与 coherence

### 3.1 固定分母

| 维度                     |                       数量 |
| ------------------------ | -------------------------: |
| 总 cases                 |                         72 |
| zero-call guard          |                         24 |
| runtime                  |                         48 |
| paired requests          |                         24 |
| Tutor cases              | 36 = 12 guard + 24 runtime |
| Organizer cases          | 36 = 12 guard + 24 runtime |
| Organizer decision units |                         32 |

每个 `pairedRunIndex=0..23` 必须且只能有 Tutor/Organizer 各一条。非整数、负数、超过 23、缺 pair、
重复 ID 或额外 runtime 均 fail-closed。

### 3.2 Tutor

Tutor runtime language 分布冻结为：

- `zh=12`；
- `en=10`；
- `mixed=2`。

language 不再由数组奇偶推断。每条 runtime definition 自带 language、exercise family、latest text 与
active context；validator 同时检查：

- case tag、authority language 与 context language 一致；
- authority family 与 context family 一致；
- input active context 与冻结 context bytes 一致；
- 中文、英文、混合文本符合对应语言特征；
- context 含当前 exercise family 信号；
- 非 general-follow-up 的 latest text 也含相同题族信号。

新的 `tutor-v2-runtime-06` 是中文线性方程 `2x=6`，绑定中文线性方程 context，不再混入英文
derivative context。

### 3.3 WrongQuestionOrganizer

每个 question 显式保存：

- request language 与 exercise family；
- structured subject authority；
- taxonomy subject authority；
- 本地 subject candidates；
- 3 个稳定、规范化唯一且同 subject 的 topic candidates；
- expected topic ordinal 只保存在 oracle，projection 不导出；
- single、same-subject batch 或 cross-subject batch relation。

20 个 single、1 个 same-subject batch、3 个 cross-subject batch 共 24 个 runtime case。Reuse case 的
topic ordinal 必须解析到同一 owner snapshot 中的现有 deck；topic reorder 会触发
`organizer_topic_ordinal_mismatch`，不能按变化后的 ordinal 继续。

R1 只冻结 dataset authority。owner snapshot fingerprint、稳定去重、分页/重排/ordinal ABA 与 command
三重 fence 的生产实现仍属于 R3。

## 4. Prompt-safe projection

R1 新 projection 只导出后续本地 detector/shortlist 所需输入：

- Tutor：language、exercise family、latest text、active context；
- Organizer：question ordinal、结构化字段、subject/topic candidates 与 deck ordinal。

它不导出 `expected`、`canonicalTopicLabel`、`acceptedTopicLabels`、
`topicCandidateIndex`、case ID、ownerRef、question/deck ID、V1 dataset version/SHA。

历史文件名中的 “V2 candidate” 属于早期 V2 remediation，继续读取 V1 dataset 是历史设计；V5
使用的 “V2 dataset” 是新的 dataset identity，两者不能混称或互相改写。

## 5. 冻结质量门

| 门                                                     | 冻结值                                                |
| ------------------------------------------------------ | ----------------------------------------------------- |
| strict runtime                                         | `48/48`                                               |
| Tutor semantic                                         | `>= 0.85`                                             |
| Organizer semantic                                     | `>= 0.85`                                             |
| combined semantic                                      | `>= 0.85`                                             |
| Tutor / Organizer absolute improvement                 | 各 `>= 0.15`                                          |
| verified guard zero-call                               | `24/24`                                               |
| critical/provider/permission/mutation/broader-fallback | 全部 `0`                                              |
| Tutor P95                                              | `<= 2500ms`                                           |
| Organizer / paired P95                                 | `<= 4500ms`                                           |
| orchestration P95                                      | `<= 6500ms`                                           |
| verified runtime usage                                 | `48/48`                                               |
| provider calls                                         | `<= 48`                                               |
| input/output token cap                                 | `112800 / 26400`                                      |
| estimated cost cap                                     | `0 < CNY <= 0.55`（`estimatedCostCnyExclusiveMin=0`） |

P95 每 lane 必须有完整 24 个样本。usage、pricing 或固定分母不完整时，aggregate P95/费用必须为
`null` 并关闭质量门。Invalid/missing output 保留在分母；semantic mismatch 不提前 breaker，第一个
runtime contract failure 才打开 breaker；禁止 retry、resume、replay 或 backfill。

`estimatedCostCnyExclusiveMin` 的 `ExclusiveMin` 表示 Live 质量门要求费用严格大于 0；本节后面的
zero-provider deterministic baseline 成本为 0，但 baseline 不进入 Live 质量门，因此两者不冲突。

## 6. Deterministic baseline

命令：

```powershell
bun run --cwd packages/agent eval:phase-6-9-7:v5:baseline
```

结果：

- complete case：`12/48`；
- failed：`36/48`；
- critical failure：`0`；
- Tutor semantic：`0.6629642857142858`；
- Organizer semantic：`0.278125`；
- combined semantic：`0.4705446428571429`；
- scored Tutor cases：`24`；
- scored Organizer decisions：`32`；
- Provider/input/output/cost：`0/0/0/0`。

baseline 连续构建结果 byte-equivalent，完整 report SHA 已冻结。该结果只描述未修饰 deterministic
能力，不证明 guard、Mock、Live 或 Provider 质量。

## 7. 验证

- V5 R1 聚焦测试：`8 pass / 0 fail / 346 expect()`；
- Agent 全量测试：`690 pass / 0 fail / 7600 expect()`；
- Agent typecheck/lint：通过；
- Prettier、`git diff --check` 与 14 个本轮 Markdown 文件的本地链接检查：通过；
- V1--V4 四个历史 evidence validator：均为 `ok=true / filesChecked=1`；
- 两路只读复审最终无未关闭 Critical/Important；
- V1 dataset 现场重算 SHA 保持不变；
- 未读取 credential、未调用 Provider、未创建 V5 Live artifact；
- 未启动/停止 Docker service、API 或浏览器；
- 未创建测试账号、错题、deck、Trace/session；
- 未修改 PostgreSQL、Redis、MinIO 或 Docker 持久数据；
- 未执行 prune、`down -v`、volume/database reset、Redis flush 或 MinIO wipe。

## 8. 下一步

下一原子任务是 V5 R2：实现 `tutor-local-signal-authority-v1`，冻结 detector
schema/version/content SHA/provenance，并让 Tutor 模型只选择
`intent/depth/confidence`。R2 仍为 zero-provider，不实现 V5 paired Mock/Live runner，也不调用真实模型。

回顾时可以问：

- “V2 dataset 怎样避免 V1 的 language/context 错配？”
- “为什么 topic candidates 可以进入 projection，但 expected topic ordinal 不可以？”
- “V5 的质量门和 baseline 在什么时候冻结，为什么 Live 后不能调整？”
- “R1 完成后为什么仍不能启动 Docker 或 controlled-Live？”
