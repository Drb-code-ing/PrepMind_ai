# Phase 6.9.7 Tutor / WrongQuestionOrganizer V8 R1 Fixed-shape 与脱敏诊断验收

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：R1 已完成，zero-provider；下一原子任务仅 R2。

## 1. 本任务解决的问题

V7 唯一 controlled-Live 已证明 Organizer response 到达并完成 JSON parse，但在本地
`provider_type_validation` 失败。脱敏证据没有保留具体字段，因此本任务不猜测某个字段值；可确认的工程
缺口是：Direct adapter 只要求 Provider 返回 `json_object`，旧 V6 Organizer 却要求模型生成 nested
conditional union，而 V7 ideal Mock 只生成完全合法对象，没有覆盖真实模型常见 Shape 漂移。

R1 将模型侧合同收敛为始终同形的四字段 ordinal decision，并在本地分两层校验：静态 Shape 只验证 JSON
结构与有界类型，动态 authority 再验证当前 owner shortlist 暴露的 question/subject/deck/topic ordinal。
这消除了“不同 action 需要生成不同嵌套对象”的结构脆弱点，但 R1 没有调用 Provider，因此不能宣称真实
模型已经通过质量门。

## 2. 固定合同与身份

固定输出：

```json
{
  "shortlistFingerprint": "sha256:<64 lowercase hex>",
  "decisions": [
    {
      "questionIndex": 0,
      "subjectIndex": null,
      "deckAction": "reuse_existing",
      "targetIndex": 0
    }
  ]
}
```

- contract SHA：`b21a6dd357ecc19e87869541c7ae6cb52adff130ce32173fd8422ad2f6506545`；
- prompt SHA：`9b85b0a9a310f128d35250e83b3927df8de87f159dac8aac8f412d1189ca6af9`；
- candidate version：`wrong-question-organizer-model-candidate-v8`；
- public subpath：`@repo/agent/wrong-question-organizer-v8`。

Schema 使用 exact keys、JSON number integer bounds、nullable `subjectIndex` 和固定 `deckAction` enum；不接受
numeric string、wrapper、snake_case、Markdown、prose、额外字段或旧 V6 nested shape，也不执行 coercion、
自动修复或字段补全。

## 3. 本地权威与运行时边界

V8 动态 validator 只接受当前实际 shortlist 暴露的 ordinal。合法 decision 被转换为既有 V6 validated
decision，并继续使用原 V6 merger。下列能力没有交给模型：

- owner/snapshot/fingerprint 与调用前后 actual-shortlist stale fence；
- subject/deck/topic eligibility、真实 ID、locked name 与 confidence；
- Trace admission、持久化与任何写命令；
- budget、usage、timeout/abort、no-retry 与 provider dispatch 权限。

Runtime adapter 保留原 Organizer `1/3500/800` 预算、usage、Trace、abort 和 V6 candidate 的前后 fence。
V8 输入、authority 或 runtime 在适配前被拒时，V8 会用不可调用的本地 fallback runtime 取得 deterministic
结果；不会把原 runtime 再交给旧 V6 nested schema，因此拒绝路径保持 Provider zero-call。
动态拒绝若超出旧 V6 条件分支的静态上限，只生成一个保证 fingerprint mismatch 的内部拒绝 Shape，使旧
sanitizer 能安全返回失败；原模型 decision 不会被修复、应用或送入 merger，最终 reason 恢复为真实 V8
动态失败分类。

## 4. Bounded diagnostic

诊断优先级固定为：

`top_level_shape -> top_level_keys -> fingerprint_type -> fingerprint_format -> decisions_type -> decisions_count -> decision_shape -> decision_keys -> question_index -> subject_index -> deck_action -> target_index -> dynamic_authority -> unknown`

诊断只保留固定 reason、缺失/额外/类型错误计数、decision count bucket、顶层 Shape 与基于类型类别生成的
SHA-256。Shape hash 不包含字段值或未知字段名；所有记录固定 `rawDataRetained=false`。原始模型输出、
prompt、未知 key、error、stack、credential、URL、owner/user/deck ID 均不进入诊断。Accessor、Proxy、
malformed runtime envelope 或任何诊断异常统一 fail-closed 为固定 `unknown`。

## 5. 验证证据

聚焦回归：

```text
wrong-question-organizer-v8-model-contract.test.ts
wrong-question-organizer-v8-model-candidate.test.ts
wrong-question-organizer-v6-model-candidate.test.ts
20 pass / 0 fail / 560 assertions
```

覆盖固定 SHA、exact Shape/no coercion、全部静态 reason 顺序、动态 authority、V6 merger 映射、预算/Trace/
stale、provider 前 zero-call、malformed runtime、abort、hostile getter/proxy、no-raw/no-key diagnostic 和
旧 V6 candidate 回归。

静态门：

- `bun --filter @repo/agent typecheck`：通过；
- `bun --filter @repo/agent lint`：通过；
- `bun --filter @repo/ai typecheck`：通过；
- `bun --filter @repo/ai lint`：通过；
- 本轮源码/测试/manifest Prettier：通过；
- `git diff --check`：通过。

历史不可变证据使用各自已封存的 canonical evidence 路径运行只读 validator：

- Phase 6.9.4.3：`ok=true / profile=live / runStatus=incomplete`；
- Phase 6.9.6：`ok=true / evidenceCount=4`；
- Phase 6.9.7 V1--V7：各 `ok=true / filesChecked=1`。

这些 validator 只证明既有 evidence 仍满足各自历史合同，不改变其成功/失败语义，也没有执行 seal、
recovery、Mock、Live 或 Provider 调用。

## 6. 明确未发生与下一步

本任务未读取 `.env`/credential，未调用 Provider，未执行正式 Mock/Live，未启动 Docker/API/浏览器，未
创建 V8 marker/journal/evidence，未接产品 composition/gate，未修改 PostgreSQL/Redis/MinIO/业务数据，
未合并 main。V1--V7 artifact/SHA、V2 dataset、V6 authority/merger、预算/timeout/quality/P95/no-retry
保持不变。

下一原子任务仅 R2：新增独立 Provider-like schema-negative、metamorphic、held-out 与 anti-overfit
robustness；仍为 zero-provider。R3 runner、R4 reviewed Mock、R5 controlled-Live、R6 产品验收和 R7 main
合并继续按级阻断。
