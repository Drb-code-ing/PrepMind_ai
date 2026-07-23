# Phase 6.9.7 Task 4 — WrongQuestionOrganizer governed model candidate

日期：2026-07-23

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：Task 4 package 级实现与静态/Mock 验收完成；尚未接入 NestJS owner snapshot、写 command、生产 gate 或真实 provider

## 1. 为什么需要这一任务

既有 `organizeWrongQuestion()` 对知识点、分类和错因等结构化字段稳定，但对缺少 subject、依赖题干语义、同义专题复用或专业课术语的错题只能落入固定字符串规则。Task 4 让模型在严格边界内判断“这道错题属于哪个固定学科、应复用哪个已投影专题或建议什么安全短标签”，同时把 owner、真实 ID、用户锁定名称、原因、置信度和所有写权限保留在本地。

## 2. 完成内容

### 2.1 Eligibility 与 provider 前零调用

- 输入最多 12 道错题、20 个已有专题；candidate 不读取数据库、环境变量或用户身份，只接收上游认证/快照层给出的 `ownerEligible`、`snapshotCurrent`、`hasExistingItem` 与 `force` 本地事实；
- `force=false` 且已有组织 item、同 subject 的安全结构化字段精确命中已有专题、subject 非空且 deterministic confidence `>=0.72`（知识点，或 category + errorType）、owner 不合格、snapshot stale、pre-abort、预算不足、无语义正文或完整字段安全失败时，runtime counter 保持 0；
- 高置信规则不会被模糊 substring 匹配抬高：只有知识点，或 category + errorType，才满足固定高置信零调用条件；
- mixed eligibility 的筛选属于后续 Server composition；Task 4 candidate 对传入的一批候选采用整批 fail-closed，避免把部分模型决定混入一次授权 command。

### 2.2 受治理 runtime 与 strict output

- 新增 `ModelAgentTask='wrong_question_organization'`，预算固定为 `1 call / 3500 input / 800 output`；candidate admission preview 不修改 caller budget，共享 runtime 执行唯一权威 reservation；
- 模型 prompt 只含 `q0..q11` / `d0..d19` ordinal、固定 subject hint、受限结构字段、题干/解析摘要和安全专题名称/关键词，不含 userId、UUID、完整 answer/userNote、图片、数据库时间或写命令；
- strict schema 要求每个投影 question 恰好出现一次，只允许固定 subject/action/confidence/evidence enum、已有 deck ordinal 或 `2..24` 字符安全 topic label；
- 部分 batch、重复/越界 question、跨 subject deck、额外字段、自由写命令、非法 label、错误 evidence 关联、timeout、abort、畸形 usage、schema/runtime 异常均整批回退 deterministic，且不重试。

### 2.3 本地权威 merger

- 非空原 subject 只能 `keep_local`；subject 缺失时才允许映射 `math / english / politics / computer / major / other` 固定 taxonomy，并由本地转为产品学科名；
- question/deck ordinal 与真实 ID 的映射只存在于 candidate/merger 内部，模型响应和 observation 均不返回映射；
- 复用已有专题时，本地按 authority map 还原真实 deck ID 与原始名称；`nameLocked` 不进入 prompt，且模型没有 rename/description 字段；
- 新专题只采用通过安全校验的短 label；subjectKey、subjectDisplayName、description、reason、数值 confidence、signals 全由固定本地模板重建；
- 用户锁定的完整专题名在 `deckName` 中原样保留，reason/description 只使用最多 80 Unicode scalar 的展示片段，避免放大超长文本；
- candidate 只返回组织结果，不生成 SQL、Prisma 参数、tool call 或数据库 command，也不修改 WrongQuestion、Card、ReviewLog、ReviewTask 或 ReviewPreference。

## 3. 验证证据

- RED：目标模块缺失时 focused 为 `0 pass / 1 fail / 1 module-not-found error`；
- GREEN focused + companion：`24/24`、`220 expect()`；
- 冻结 Organizer runtime：24 条 fixture 全部 runtime=1、`candidate_applied`，含单题与三题 batch、六类学科、语义复用、locked deck 和 no-write critical case；
- Agent full：`529/529`，`5479 expect()`；
- AI full：`194/194`，`1020 expect()`，新增 task 被共享 runtime 接受；
- Agent/AI typecheck 与 lint：通过；
- Native Node ESM `@repo/agent/model-candidates` export：通过；
- `git diff --check`：通过；
- 两路独立只读复审：无 Critical/Important。安全复审提出的超长 authority deck 名模板放大问题已修复，真实 locked name 仍不变。

## 4. 明确未完成的范围

- 没有读取根 `.env`、API key 或 provider 配置，没有创建 Live executor、调用真实模型、启动 Docker/浏览器或创建/修改业务数据；
- `ownerEligible` 与 `snapshotCurrent` 当前是 package contract 输入；真实 owner-scoped `REPEATABLE READ + READ ONLY` snapshot、fingerprint、双 stale fence、advisory-lock 写 command 属于 Task 6；
- production default-off gate、独立 credential、DeepSeek V4 Pro executor、single/batch Server dispatch、Trace admission 与 HTTP abort 属于 Task 7；
- Task 4 不证明 Organizer 已在当前产品中使用真实模型，也不证明 Phase 6.9.7、Phase 6.9 或可执行 LangGraph 已完成。

## 5. 下一步与回顾问题

下一任务是 Task 5：把已经完成的 Tutor package candidate 接入 Web server-only、独立 default-off runtime、Chat 编排与安全 Trace。该任务仍先用 Mock/注入式 executor 验证 production composition，不会自动获得 controlled-Live 授权。

回顾时可以问：

- 为什么已有 item、精确专题和高置信结构字段不需要模型？
- 为什么模型只能返回 ordinal，真实 question/deck ID 只能由本地还原？
- 为什么 partial batch 必须整批回退，而不能把部分模型决定直接写入？
- 为什么 locked deck 可以被选择，却绝不能被模型改名？
- 为什么 Task 4 完成仍不能声称错题组织产品已经启用真实模型？
