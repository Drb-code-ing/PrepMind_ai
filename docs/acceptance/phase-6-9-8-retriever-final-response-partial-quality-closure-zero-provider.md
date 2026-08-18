# Phase 6.9.8 Retriever/FinalResponse partial quality closure（zero-provider）

## 决策

用户明确选择降低当前质量门并优先完成 Phase 6.9.8。由于 V12 controlled-Live 已正常 durable seal，重新复制 V13
Provider runner 会产生新的 tag、授权、费用和脆弱链路，却不会增加对历史 V12 transport 事实的认识。本任务因此采用
read-only retrospective closure：不重跑 Provider，只对 immutable V12 evidence 应用已经评审的 partial gate。

这项决策改变的是当前阶段的验收门槛，不改写 V12 的原始结论。V12 仍是
`schema_recovery_sr5_branch_quality_gate_failed / qualityAuthority=none`。

## 只读绑定

closure 仅接受固定参数
`FINALIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_PARTIAL_CLOSURE_ZERO_PROVIDER_ONCE`，并绑定：

- runId：`49429392-857d-4635-80cc-0bca317cf9ff`
- report logical SHA：`86f4e84e1859d9c77fc3a050095f5123f16cee9a61da60cc19d79b55e2323654`
- artifact physical SHA：`817bc89708813982fdfc258126607f2930f42a6aae0fef81584c35548dd9be81`
- base authority：`controlled_live_retriever_final_response_schema_recovery_sr5_v12`

入口先运行 V12 strict bundle validator，再读取并解析固定 artifact，校验物理/逻辑 SHA、构建并重算 partial report，最后
再次运行 V12 validator。任一差异统一返回 `partial_closure_invalid`。closure 不创建 marker、journal、report、artifact、tag
或 authorization，也不修改 V12 文件。

## 结果

```text
status=partial_completion_closed
authority=retriever_final_response_v12_retrospective_transport_completion_authority
qualityAuthority=none
planned/started/succeeded/response/usage/deferred/failed=24/5/4/5/4/19/1
guards passed/zero-call/safety-failures=8/8/0
providerCalls/credentialReads/formalEvidenceWrites/businessWrites/v12MutationWrites=0/0/0/0/0
semantic=not_established
inputTokens/outputTokens/verifiedCostCny=null/null/null
rawDataRetained=false
```

该 authority 只说明历史 V12 evidence 满足用户降低后的 transport completion 门。它不是新的 Live，不证明 Retriever
Recall/NDCG、FinalResponse grounding/citation、完整成本、billing、产品可用、P95、SLA 或 SR6。

## 验收

- gate + closure focused：`6/6`，`25 expect()`。
- V10/V11/V12 compatibility + partial：`38/38`，`410 expect()`。
- Agent full：`1699/1699`，`25988 expect()`，`210 files`。
- invalid/extra argv 在 repository inspection 前阻断。
- 空 evidence root 固定阻断。
- closure 前后 V12 marker、journal、report bytes 逐字节相同。
- Agent typecheck、lint、Prettier 与 diff check 通过。
- V12 validator 仍为 `ok=true / journal=67 / evidence_published`，logical/physical SHA 不变。

命令：

```bash
cd packages/agent
bun run eval:phase-6-9-8:partial-quality:close
```

## 下一步

Phase 6.9.8 在降低后的门槛下完成工程收口。下一任务是独立 SR6 Docker/API/Trace/可见浏览器功能验收；验收必须继续标明
真实语义质量尚未建立，不能把 partial closure 升级为产品或 SLA authority。
