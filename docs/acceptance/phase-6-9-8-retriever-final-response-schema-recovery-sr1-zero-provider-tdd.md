# Phase 6.9.8 Retriever / FinalResponse Schema Recovery SR1 Zero-provider TDD 验收

日期：2026-08-09

分支：`drb/phase-6-9-8-retriever-final-response-schema-recovery-sr1`

起始提交：`e5d575214dce636c89db69a26c934019da06a013`（最新 `main == origin/main`）

Checkpoint authority：`zero_provider_retriever_final_response_schema_recovery_tdd`

qualityAuthority：`none`

## 1. 范围与结论

SR1 已完成 Retriever query-rewrite 的 module-owned exact schema identity、bounded native JSON parser、duplicate-key
scanner、canonical `{ rewrittenQuery }` projection、bounded diagnostic collector 与 actual candidate dispatch seam 的
zero-provider TDD。原有 `RETRIEVER_QUERY_REWRITE_MODEL_SCHEMA` 兼容导出保持不变；只有候选运行时在通过本地 eligibility 和
budget gate 后，才为本次 dispatch 创建 fresh collector schema，并把它交给 runtime。diagnostic 现在只作为 candidate
outcome 顶层的内部 sidecar 返回；Retriever node 只投影 observation，产品 Chat/FinalResponse/账单/Trace 不会接收该
字段。

SR1 只证明 synthetic raw-content boundary 的可执行性与 fail-closed 行为：fence/BOM/prose/trailing/multiple value、
重复键、alias、类型漂移、wrapper、结构/UTF-16/byte limits、hostile projected object 与 extension no-leak 均有测试；
candidate 的 single dispatch/no retry、fallback original、local safety/unchanged/protected-term、usage/trace unknown
fallback 与 Retriever node sidecar boundary 也有回归。它不证明 DeepSeek 当前输出质量、Qwen 检索、FinalResponse grounded/citation、P95/SLA、产品 Docker/API/browser、
`main` 或任何后续阶段 authority。

SR0、P1 L2、T3、R5 与 Phase 6.9.7 SR5 的 sealed namespace、artifact、validator、tag 和历史计数均保持只读；SR1
没有读取 `.env`/credential、没有调用 Provider、没有创建正式 evidence，也没有启动或清理 Docker、PostgreSQL、Redis、
MinIO、API、browser、Trace、BackgroundJob、Outbox 或业务写入。

## 2. 冻结身份与实现文件

- contract：`phase-6.9.8-retriever-schema-recovery-contract-v1`；
- diagnostic：`phase-6.9.8-retriever-schema-diagnostic-v1`；
- authority：`zero_provider_retriever_final_response_schema_recovery_tdd`；
- contract SHA：`4248db580e60ccf4b851d46ab692c867b04ba23c4bdb4b86e64bcb3b99fecf4e`；
- limits：`8192` UTF-8 bytes / depth `8` / nodes `128` / keys `64` / `rewrittenQuery` `2000` UTF-16 code units；
- public subpath：`@repo/agent/retriever-schema-recovery`；
- 实现：
  - `packages/agent/src/model-candidates/retriever-schema-recovery-contract.ts`；
  - `packages/agent/src/model-candidates/retriever-schema-recovery.ts`；
  - `packages/agent/src/model-candidates/retriever-query-rewrite-model-candidate.ts`；
  - `packages/agent/src/index.ts` 与 `packages/agent/package.json`（root/subpath export）；
  - `packages/agent/tests/retriever-schema-recovery-contract.test.ts`；
  - `packages/agent/tests/retriever-query-rewrite-model-candidate.test.ts`（SR1 接线回归）；
  - `packages/agent/tests/retriever-node.test.ts`（sidecar 产品边界回归）。

SR1 没有创建 source tag、approved tag、marker、journal、report、artifact、validator 或 recovery claim；正式
schema-recovery lineage 仍只允许在后续 SR3/SR5 对应门内建立。

## 3. Parser、projection 与权限合同

1. **response content**：只接受 adapter 提供的单 completion string；空/非字符串、非法 UTF-16、BOM 或 `8192` bytes
   超限 fail-closed；不 trim、不从 prose/fence 抽取、不访问 prompt/credential/用户正文。
2. **JSON/envelope**：只接受一个 native JSON 顶层 object；手写 bounded parser 在 `JSON.parse`/last-key-wins 之前拒绝
   duplicate key（包括 escaped-equivalent 和嵌套 duplicate）、非法 escape/number、trailing/multiple top-level、结构
   超限和 wrapper。
3. **canonical projection**：只接受 ASCII、大小写敏感、顶层 own-data `rewrittenQuery: string`；missing、alias/alias+
   canonical、number/boolean/null/array/object、empty、overlong 均拒绝；extension 经过有界结构审计后丢弃并计数；
   输出重新构造的冻结 plain `{ rewrittenQuery }`，不复用 Provider object，不 coercion/default/clamp/round/retry。
4. **local authority**：现有 candidate 继续执行 trim、Unicode/control、tool/write、credential、unchanged 与
   protected-term 检查；失败回退原 query。collector 最多保留一条 fixed enum/bucket diagnostic，extension 成功只在
   `recordApplied` 后变为 `stage=applied`。usage/trace accounting 不一致、transport/timeout/abort 或无法安全分类的
   generic sanitizer failure 统一收口为 `projected_schema/unknown`，不伪造更细的 Provider 事实。

模型仍只能提出检索 query 候选，不能设置 owner、route、RAG policy/topK/filter、document/citation、tool/write、usage、
budget、terminal 或 diagnostic。bounded diagnostic 不进入产品 Chat Trace；当前 web Trace 仍只投影既有固定摘要字段。

## 4. Bounded diagnostic 隐私合同

每条 attempted lane 最多一条 immutable diagnostic；成功 canonical lane 可为 `null`。它只存在于 candidate outcome 的
内部 sidecar，不属于 exported observation；Retriever node/API boundary 会丢弃它。固定字段为：

```json
{
  "diagnosticVersion": "phase-6.9.8-retriever-schema-diagnostic-v1",
  "stage": "rewrite_projection",
  "reasonCode": "extension_fields_discarded",
  "projectionDisposition": "extensions_discarded",
  "topLevelType": "object",
  "rewrittenQueryType": "string",
  "extraFieldCountBucket": "1",
  "shapeFingerprint": "sha256:<64 lowercase hex>",
  "rawDataRetained": false
}
```

fingerprint 只对固定 stage/reason/disposition/type/bucket tuple 做 SHA-256；不得 hash 或保存 raw completion、unknown
key/value、Zod path/value、prompt、用户正文、case ID、expected/oracle、URL、credential、stack 或错误消息。collector、
candidate outcome 与测试结果均验证冻结和 no-raw 边界。

## 5. RED / GREEN 与回归证据

SR1 focused 命令：

```powershell
bun test packages/ai/tests/model-agent-strict-json-content-policy.test.ts `
  packages/agent/tests/retriever-schema-recovery-contract.test.ts `
  packages/agent/tests/retriever-query-rewrite-model-candidate.test.ts `
  packages/agent/tests/retriever-node.test.ts
```

当前 GREEN 结果：

- contract：`9/9`，`153` assertions；
- Retriever candidate（含 raw-content parser 接线、extension/applied、fence failure、local authority、usage/trace unknown、single dispatch）：
  `13/13`，`171` assertions；
- AI exact-schema policy compatibility：`4/4`，`16` assertions；
- Retriever node/API sidecar boundary：`9/9`，`90` assertions；
- focused 合计：`35/35`，`430` assertions；
- Agent/AI typecheck：通过；
- Agent/AI lint：通过；
- 变更文件 Prettier：通过；
- `git diff --check`：通过。

阶段收口全量回归：Agent `1450/1450`（`24512` expect()，181 files）、AI `345/345`（`2662` expect()，28 files）。

测试只使用 in-memory synthetic runtime、raw-content policy 与 provider-failure signal；`globalThis.fetch`、credential reader、
真实 DeepSeek/Qwen、正式 Mock/Live CLI、Docker/API/browser 与业务写入均为 `0`。SR1 不执行历史 sealed Live validator 的
写入性命令，不重复 P1 L2/T3/R5/SR5。

## 6. Formal namespace 与历史 parity

新 lineage `phase-6.9.8-retriever-final-response-schema-recovery-v1` 的正式 marker/journal/report/root artifact/
recovery claim 精确扫描为 `0`；旧 P1/T3/R5/SR5 文件不计入。历史 P1 L2 只读 validator 仍以其原 sealed run、SHA、
authority 和 `providerCalls=2 / credentialReads=2` 保持不可变，不能把历史计数算入 SR1。

SR1 未修改任何历史 marker、journal、report、artifact、approved tag 或产品数据；Docker 容器、镜像、卷、PostgreSQL、
Redis、MinIO 保持用户现状。

## 7. Authority 形成与未形成

本页形成：`zero_provider_retriever_final_response_schema_recovery_tdd / qualityAuthority=none`，只解锁下一阶段
SR2 zero-provider Provider-like/held-out/metamorphic/anti-oracle robustness。

本页没有形成：DeepSeek/Qwen transport 或 semantic authority、Retriever recall/nDCG、FinalResponse grounded/citation、
P95/SLA、成本/账单、产品 `/api/chat`、Docker/API/browser、Trace、`main` 或生产可用性。任何 Provider 调用前仍必须完成
SR2--SR4 独立提交/推送、source/upstream/origin/manifest parity、formal namespace=0、fresh proxy/data-boundary 与新的
exact authorization；SR1 不提供预授权。

## 8. 下一任务与回顾问题

下一步是从最新、已推送的 `main` 新开普通分支完成 SR2 zero-provider robustness；不在本分支继续开分支，不使用 worktree，
不执行 `live`、`controlled`、`seal`、`recover`、`replay`、`backfill`，不清理 Docker。

回顾时可以问：

- 为什么 SR1 不能直接从 generic runtime result 恢复 `rewrite_03` 的 raw JSON shape？
- 为什么 parser 必须绑定 module-owned exact schema，而不能由调用者传入 expected/oracle？
- 为什么 duplicate key 必须在 JSON.parse 前拒绝，extension 却可以只计数后丢弃？
- 为什么 candidate 的 local unchanged/protected-term rejection 不能伪装成 Provider schema success？
- 为什么 `schemaRecoveryDiagnostic` 不能直接进入产品 Trace、FinalResponse prompt 或账单字段？
- 为什么 SR1 通过仍不解锁 SR2 之外的 Provider、Docker/API/browser、main 或博客收尾？
