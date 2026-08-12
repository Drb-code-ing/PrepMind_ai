# Phase 6.9.8 SR5 run-bound source revalidation recovery

日期：2026-08-12  
分支：`drb/phase-6-9-8-sr5-run-bound-source-revalidation`  
authority：`zero_provider_sr5_run_bound_source_revalidation_recovery`  
qualityAuthority：`none`

## 1. 问题与边界

旧 v2 controlled-Live run `9eb57600-97e2-4513-8654-8686b38e856e` 已消费并永久 sealed。它在 reservation 创建
self-marker 后，因 admission capability 再次要求 formal namespace=0 而在首 guard 前自拒绝；Provider calls=`0`。
本任务只修复该 architecture boundary，不恢复旧名额、不改写旧 tag/evidence、不读取 credential、不调用 Provider，亦不启动
Docker/API/browser 或写入 Trace、BackgroundJob、Outbox、业务数据。

## 2. 实现

- reservation/admission opaque capability 共享私有 runId binding，reservation 先绑定 UUID，admission 只接受同一 UUID。
- admission-time 与 reservation-time 仍要求 namespace=0；run-bound revalidation 只允许当前 marker 与当前 run journal。
- marker 严格绑定 runId、authority、credential count、source 与 source binding。
- durability 与 revalidation 复用同一 strict journal Zod schema；事件完整 shape、datetime、sequence、marker SHA、previous hash 与
  record hash 均需匹配。
- marker/journal 通过已打开文件读取并比较 `dev/ino`；root、`.tmp`、目录流均做身份复核。
- 8 guards 与首个 `call_reserved` 后签发一次性 dispatch capability；消费后形成一次性 permit。在 Provider adapter 前再次校验
  完整 source/durable prefix。late mutation 在 `invokeCall=0 / wire.dispatches=0` 前 fail-closed。
- dispatch lease 只阻止遵守本合同的协作进程重复进入，不宣称是 OS 全局文件系统锁。Node/Windows 没有 portable
  `openat`/descriptor-relative enumeration；路径、目录流和句柄身份校验只能缩小同用户恶意进程 race，不能把它消灭。

## 3. 回归证据

实现最终收口前已通过：

- focused Live：`25/25`，`80 expect()`；
- SR5 六文件组合：`50/50`，`163 expect()`；
- Agent full：`1538/1538`，`25245 expect()`，`196 files`；
- Agent typecheck、lint、`git diff --check`；
- 旧 sealed bundle 只读 validator：`ok=true`，runId 与 logical/physical SHA 均未变化。

分支/main parity 在提交与合并后补入本文件。

关键 fault regression：额外 formal evidence、marker identity mismatch、hash-valid unknown journal field、journal mutation、
`.tmp` junction replacement、guard 后插入 artifact、capability 签发后 late mutation。上述路径均未触发 synthetic adapter；
late mutation journal 中不存在 `wire_stage`。

## 4. Authority 与下一步

本任务形成的只有 zero-provider architecture recovery authority。它不证明 DeepSeek/Qwen transport、schema/semantic quality、
verified usage/cost、P95、RAG/FinalResponse 产品行为或 Docker/API/Trace/浏览器可用。

提交并推送功能分支后，使用 `--no-ff` 合并并推送 `main`，再在 `main` 完成二次 zero-provider parity。旧 v2 run/tag/evidence
继续不可变、不可重跑。未来若评估新的 controlled-Live，必须先作独立 lineage/source/tag 设计决策并取得绑定该新 source 的
数据边界接受与 exact authorization；不能直接把本 recovery 当作授权入口。SR6 产品验收继续阻断。
