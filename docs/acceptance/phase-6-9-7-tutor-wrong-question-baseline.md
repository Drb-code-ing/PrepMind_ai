# Phase 6.9.7 Tutor / WrongQuestionOrganizer Deterministic Baseline

日期：2026-07-23

## 1. 结论

Task 1 已完成。`phase-6.9-tutor-wrong-question-v1` 冻结为 72 条纯合成 case，并直接运行当前未修饰的 `buildTutorStrategy()` / `organizeWrongQuestion()`：

- 48 个 runtime case 只有 `6/48` 完整命中，全部 6 条都来自 Tutor；
- Tutor semantic score 为 `0.44186666666666674`；
- WrongQuestionOrganizer semantic score 为 `0.278125`；
- informational combined semantic score 为 `0.3599958333333334`；
- critical failure 为 `0`；
- provider invocation、input/output token 与 estimated CNY 都为 `0`。

这证明当前 deterministic policy 能保留安全回退，却不足以理解大部分隐含教学意图和低置信错题语义。它不证明未来 model candidate、zero-call guard、产品 API、Docker 或真实模型路径已经完成。

## 2. 冻结数据集

| 项目 | 冻结值 |
| --- | --- |
| dataset version | `phase-6.9-tutor-wrong-question-v1` |
| canonical SHA-256 | `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e` |
| total cases | `72` |
| Tutor | `12 zero-call + 24 runtime` |
| WrongQuestionOrganizer | `12 zero-call + 24 runtime` |
| paired indexes | `0..23`，每个 index 各有一个 Tutor/Organizer runtime case |
| Organizer decisions | `32`：index `0..19` 各 1 条，`20..23` 各 3 条 |

case 只使用中英文、专业课和错题组织的合成文本/ID。完整对象深冻结，case ID 唯一；credential、认证 header、cookie、email、private key 和真实用户材料扫描均通过。critical tags 覆盖 hint 不得给最终答案、prompt injection、credential、cross-owner、locked name 和模型不得产生写命令。

24 条 zero-call case 在本任务只被冻结，未穿过尚不存在的 candidate/preflight guard；后续 Task 9 必须用独立 runtime counter 实际证明 `24/24` provider invocation 为 0。不得把本 baseline 的 `providerInvocations=0` 冒充该验收。

## 3. 未修饰 baseline

### 3.1 总体

| 指标 | 值 |
| --- | ---: |
| 完整命中 | `6/48` |
| 未完整命中 | `42/48` |
| critical failure | `0` |
| provider invocation | `0` |
| input/output tokens | `0 / 0` |
| estimated cost | `0 CNY` |

完整命中为 Tutor `runtime-10`、`runtime-15` 和 `runtime-21..24`；Organizer 没有任何 case 同时满足 subject、deck action/index、topic、confidence 与 evidence 全部标注。失败仍全部保留在指标分母。

### 3.2 Tutor

| 子指标 | 值 |
| --- | ---: |
| intent macro-F1 | `0.19733333333333336` |
| depth accuracy | `0.7916666666666666` |
| context-use accuracy | `1` |
| pedagogy-policy accuracy | `0.25` |
| weighted semantic score | `0.44186666666666674` |
| scored / invalid | `24 / 0` |

现有关键词规则能保留 active context 和少量冲突/general follow-up，但多数“我卡住了”“带我往下走”“完整捋一遍”等隐含表达仍落入错误 intent，因此 intent 与完整教学策略是主要缺口。

### 3.3 WrongQuestionOrganizer

| 子指标 | 值 |
| --- | ---: |
| subject accuracy | `0.25` |
| deck action accuracy | `0.8125` |
| existing-deck precision | `0` |
| topic-label macro-F1 | `0` |
| evidence/confidence accuracy | `0` |
| weighted semantic score | `0.278125` |
| scored / invalid decisions | `32 / 0` |

`deck action accuracy=0.8125` 主要来自规则对 26 条 expected create-topic decision 统一选择“创建”，并不表示语义专题正确；它没有命中任何语义复用 deck，topic label 与受限 evidence/confidence 也均未达到标注。

## 4. RED / GREEN 与验证

RED：先新增三份测试，源文件尚不存在时得到 `0 pass / 3 fail / 3 module-not-found errors`。

GREEN：

- focused cases/metrics/baseline：`14 pass / 0 fail / 514 expect()`；
- Agent full：`483 pass / 0 fail / 5035 expect()`；
- Agent `typecheck`：exit `0`；
- Agent `lint`：exit `0`；
- baseline CLI 连续运行两次，stdout 字节一致；
- `git diff --check` 在提交前通过。

复现命令：

```bash
bun test packages/agent/tests/phase-6-9-tutor-wrong-question-cases.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-metrics.test.ts packages/agent/tests/phase-6-9-tutor-wrong-question-baseline.test.ts
bun --cwd packages/agent eval:phase-6-9-7:baseline
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
bun --cwd packages/agent test
```

## 5. 安全与交付边界

本任务没有读取根 `.env`、API key 或 provider 配置，没有创建 executor、调用真实模型、启动 Docker/浏览器或修改数据库/MinIO/Redis。两个未来 production gate 仍不存在；现有产品继续运行原 deterministic policy。

后续 Task 2 已完成 strict output contract 与完整字段安全投影，Task 3 已完成 Tutor package candidate eligibility 与本地权威 merger；证据分别见 `docs/acceptance/phase-6-9-7-tutor-wrong-question-contracts.md` 与 `docs/acceptance/phase-6-9-7-tutor-model-candidate.md`。当前下一任务是 Task 4 WrongQuestionOrganizer candidate；仍不得读取 credential 或调用真实 provider。

回顾时可以问：

- 为什么 `6/48` 完整命中不等于当前规则完全不可用？
- 为什么 Organizer 的 `deck action accuracy=0.8125` 仍不能证明专题语义正确？
- 为什么本 baseline 的零 provider usage 不能替代后续 `24/24` zero-call guard 验收？
- dataset SHA-256 和 `32 decision units` 分别防止什么指标漂移？
