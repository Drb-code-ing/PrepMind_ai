# Phase 6.9.7 Tutor / Organizer Full-gate Schema Recovery SR1 Zero-provider TDD 验收

日期：2026-08-02

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起始提交：`237cfa0068a3842ffab1e78cf9feedcb9b353fdd`

Checkpoint authority：`zero_provider_full_gate_schema_recovery_tdd`

## 1. 范围与结论

SR1 已完成 Provider envelope/parser、canonical selection projection、strict projected decision、bounded
diagnostic 与 Tutor V6 candidate seam 的 zero-provider TDD。它只证明新 schema recovery contract 在本地
synthetic boundary 可执行、fail-closed，并保持旧 V6 权限、预算和 Trace 边界。

SR1 不证明 DeepSeek 当前输出质量、Full-gate semantic/P95、Tutor/Organizer 产品可用、Docker/API/browser、
main 或后续 Phase。旧 L3 仍是 `full_gate_quality_gate_failed / qualityAuthority=none`，不得重跑、重解释或
改写。

## 2. 冻结身份

- contract：`phase-6.9.7-tutor-schema-recovery-contract-v1`；
- candidate：`phase-6.9.7-tutor-schema-recovery-candidate-v1`；
- public subpath：`@repo/agent/tutor-schema-recovery`；
- frozen contract SHA：
  `e2453faeb077faa76ab018a038790cd5a7e73f617be800c0958c098361511579`；
- 未来 lineage 仍为：`phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1`。

SR1 没有创建 source tag、approval、marker、journal、artifact、validator 或 recovery namespace；这些只允许在
后续 SR3/SR5 对应门内建立。

## 3. Envelope 与 parser contract

`@repo/ai` 新增只绑定 exact in-process schema identity 的 bounded raw-content parser capability，不修改普通
strict JSON schema 的历史路径。第一方 DeepSeek V4 Pro direct adapter 只在该 identity 上调用 capability；
若 JSON 已解析但 selection/type validation 失败，wire 先提交 `content_parsed`，再投影
`provider_type_validation`。

Tutor parser 固定限制：

- UTF-8 最大 `8192` bytes；
- 最大 depth `8`；
- 最大 nodes `128`；
- 最大 keys `64`；
- 只接受一个 native JSON object；
- 在任何 whole-document `JSON.parse` 前拒绝任意层重复 key，包含 escaped-equivalent key；
- BOM、Markdown fence、prose、trailing/multiple top-level、非法 escape/number 与结构超限均 fail-closed。

## 4. Selection projection 与本地权威

只有 canonical own-data `intentIndex` safe integer `0..4` 获得模型选择权。missing、alias、string、boolean、
null、fraction、`-0`、越界和 wrapper 均拒绝；不 coercion、default、clamp、repair 或 retry。

合法 envelope 会重新构造 strict `{intentIndex}`，再进入既有 Tutor V6：

1. local signal authority；
2. local preferred-depth authority；
3. V6 decision validator；
4. V6 local merger。

Depth、教学策略、answer structure、`answer_direct`、route、tool、permission、真实 ID 与写权限均未交给模型。
Runtime seam 最多 dispatch 一次，并保持 V6 budget、abort、usage 与 Trace fail-closed。

## 5. Bounded diagnostic 隐私边界

Diagnostic 只允许：version、fixed stage/reason、projection disposition、top-level type、`intentIndex` type、
extra-field count bucket、枚举化 shape fingerprint 与 `rawDataRetained=false`。

扩展字段完成有界结构审计后直接丢弃；raw completion/hash、unknown key 名/value、Zod path/value、prompt、
credential、用户正文、case ID、expected/oracle 均不保存、不返回、不进入 Trace/report/log。

## 6. RED / GREEN 与回归证据

RED：

```powershell
bun test packages/ai/tests/model-agent-strict-json-content-policy.test.ts packages/agent/tests/tutor-schema-recovery-contract.test.ts packages/agent/tests/tutor-schema-recovery-model-candidate.test.ts
```

初始结果为 `0 pass / 3 fail`；失败原因均为新 parser API、public subpath、contract/candidate 尚不存在。

GREEN 与兼容回归：

- SR1 + direct adapter focused：`41/41`，`569` assertions；
- Tutor V6、Organizer V8/V9、F1/S3 compatibility：`70/70`，`1204` assertions；
- Agent full：`1135/1135`；
- AI full：`325/325`；
- Agent/AI typecheck：通过；
- Agent/AI lint：通过；
- Prettier 与 `git diff --check`：通过；
- 两路独立代码/安全和文档边界复审：通过，无未关闭 finding。

这些测试只使用 injected synthetic fetch/runtime 或隔离临时目录，没有调用 global fetch/Provider，也没有发布
正式 Mock/Live evidence。

## 7. 旧 L3 不可变性

只读命令：

```powershell
bun packages/agent/scripts/validate-phase-6-9-7-tutor-organizer-full-gate-evidence.ts
```

结果仍为：

- `ok=true`；
- run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a`；
- gate `full_gate_quality_gate_failed`；
- `qualityAuthority=none`；
- journal `296`，final event `evidence_published`；
- logical report SHA `595e9fce929aa1cbfe3ed3982edd27fcf81f9672395ba070328b4c869f974683`；
- physical artifact SHA `e081939bb7f4b17235b1d9afb61d78031879bb80b9d64c952e4b86531cd7dbe5`。

SR1 未修改、移动或删除 L3 approved tag、marker、journal、artifact、validator 或任何已封存 evidence。

## 8. Zero-provider 与副作用边界

- `.env` / credential read：`0`；
- Provider / global fetch call：`0`；
- 正式 Mock/Live/production CLI：`0`；
- Docker/API/browser：`0`；
- 新正式 tag/marker/journal/artifact/recovery claim：`0`；
- 业务数据写入：`0`；
- `.codex/`：保持既有本地未跟踪状态，不进入提交。

## 9. 下一任务与停止门

SR2 zero-provider Provider-like/held-out/metamorphic/no-leak/fault matrix 现已完成：覆盖全部 24 个 Tutor
runtime、`tutor-v2-runtime-11`、18 个 Provider shape、Unicode/shape/limit/abort/fault 与 anti-oracle source scan，
且不读取 L3 raw output。验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r2-zero-provider-robustness.md`。

SR2 当时只解锁 SR3 runner/lineage/durability；SR3 后续已 zero-provider 完成。当前下一原子任务仅 SR4
reviewed Mock/static。SR4 仍禁止 credential、Provider、正式 Live、Docker/API/browser、业务数据与 main；
SR5--SR7 与后续阶段继续按设计门禁阻断。最新验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r3-runner-durability.md`。

## 10. 主要文件

- `packages/ai/src/model-agent-structured-output-policy.ts`；
- `packages/ai/src/first-party-deepseek-v4-pro-direct.ts`；
- `packages/agent/src/model-candidates/tutor-schema-recovery-contract.ts`；
- `packages/agent/src/model-candidates/tutor-schema-recovery-model-candidate.ts`；
- `packages/agent/src/model-candidates/tutor-schema-recovery.ts`；
- `packages/agent/tests/tutor-schema-recovery-contract.test.ts`；
- `packages/agent/tests/tutor-schema-recovery-model-candidate.test.ts`。
