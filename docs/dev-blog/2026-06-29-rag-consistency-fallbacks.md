# 2026-06-29：RAG 资料链路的一致性兜底

这轮收尾不是继续扩功能，而是把多代理审查中暴露的边界问题补实：资料上传、替换、处理、分块写入这些链路已经能跑通，但如果用户在处理过程中重新上传资料，或者两个请求同时替换同一张资料卡片，旧流程可能把状态或 chunks 写到新资料上。

## 发现的问题

审查重点放在三个地方：

- `/api/chat` 和 live 调用边界，避免客户端伪造 system prompt 或 body token。
- Auth refresh token rotation，避免并发刷新重复签发。
- RAG 资料管理，避免上传去重、公开图片读取、处理和替换链路在并发下污染数据。

最后风险最高的是 RAG 资料处理和替换。旧实现的典型问题是：`processDocument` 先读取一个 `Document` 快照，后续用这个旧快照读取文件、分块、embedding；如果中途用户替换了资料，旧处理流仍可能继续写 chunks 或把当前文档标记为 `DONE / FAILED`。替换上传也有类似问题：事务内裸 `id` 更新会覆盖已经进入 `PROCESSING` 的文档，或覆盖另一个替换请求。

## 修复方式

这次没有引入新的状态机字段，而是先用现有字段做 compare-and-swap：

- 处理 claim 必须匹配 `id + userId + status + storageKey + contentHash`。
- 清 chunks、写 chunks 前必须确认仍是同一个 `PROCESSING` 快照。
- chunk 替换事务使用 `SELECT ... FOR UPDATE` 锁定当前 `Document` 行，避免校验后到 delete/insert 之间被替换请求穿插。
- 标记 `DONE / FAILED` 必须继续匹配同一 `PROCESSING + storageKey + contentHash` 快照。
- 替换上传事务使用 `status + updatedAt + storageKey + contentHash` 条件更新；成功后才删除旧 chunks，事务成功后才尽力删除旧 MinIO 对象。
- 并发冲突返回 `KNOWLEDGE_DOCUMENT_PROCESSING`，只清理本次新上传对象，不删除旧对象。

这样做的结果是：旧处理流可以失败，但不能污染新资料；并发替换可以失败，但不能覆盖已更新的资料卡片。

## 测试与复审

修复按 TDD 拆成多次小提交：先补失败用例，再实现最小修复，再跑 targeted test、server 全量 test 和 build。

覆盖的关键用例包括：

- 处理完成前文档快照变化，不能无条件标记 `DONE`。
- 处理失败时文档快照变化，不能覆盖新资料为 `FAILED`。
- claim 前资料已被替换，不能把新资料误改成 `PROCESSING`。
- chunk 写入事务必须先锁定匹配的 processing 快照。
- 替换上传事务内条件更新失败时，不删除旧 chunks、不删除旧对象，只清理本次新上传对象。

最后再用只读子代理复审这三个服务的并发一致性，结论是当前限定范围内无 P0/P1/P2。

## 验收命令

```powershell
bun --filter @repo/server test
bun --filter @repo/server build
```

两条命令均已通过。
