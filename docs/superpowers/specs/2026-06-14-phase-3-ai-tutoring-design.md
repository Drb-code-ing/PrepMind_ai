# Phase 3 AI 讲题系统设计

> 目标：把当前“拍照识题 -> Markdown 输出 -> 前端文本解析 -> 保存错题”的链路升级为“结构化题目识别 -> 稳定讲题上下文 -> 用户确认保存错题”，为后续 tool calling、FSRS、RAG 和 Agent 系统预留边界。

## 1. 背景

Phase 2.3 已完成 WrongQuestion、ChatMessage、OCRRecord、Uploads 和 Dexie mutationQueue。Phase 2.5 已完成 Chat-first 产品壳层和主要页面体验打磨。当前主链路能用，但 AI 讲题系统还有一个结构性问题：

- `/api/ocr` 让模型按 Markdown 标题输出。
- 前端用 `parseOcrResult()` 从 Markdown 中推断题干、学科、知识点、解析、答案和是否可保存。
- `activeStudyContext` 也由这些解析字段生成。
- 多题图片目前只能在同一个 Markdown 块内用（1）（2）（3）分段。

这个方案在 MVP 阶段合理，但继续推进会遇到几个问题：

- 模型稍微偏离 Markdown 标题，前端字段就可能解析错误。
- 多题图片缺少一题一对象的数据结构，用户无法自然选择保存单题或批量保存。
- 非题目、不清晰题、半题场景缺少稳定状态字段。
- 后续 tool calling 如果仍依赖文本解析，会把不稳定性放大到写库、复习任务和知识检索。

Phase 3 第一轮不直接做完整 Agent，而是先稳定题目结构化识别和讲题上下文。

## 2. 设计原则

### 2.1 结构化数据为主，Markdown 为展示

OCR 模型输出必须有稳定结构化字段。前端保存错题、生成上下文、判断可保存状态时优先使用结构化数据。Markdown 只作为展示内容和兜底文本，不再是主要数据来源。

### 2.2 Human-in-the-loop

AI 可以识别、讲解和建议，但不能绕过用户确认直接写入错题本或复习任务。保存错题、批量保存、创建复习任务都必须由用户明确触发。

### 2.3 先稳定主链路，再接 Agent

本阶段预留 tool calling 边界，但不实现完整 LangGraph Agent、不接入 RAG、不真正创建 FSRS ReviewTask。Phase 3 的成功标准是稳定地识题、讲题、追问和保存错题。

### 2.4 移动端优先

多题拆分、保存确认和讲题内容必须适合手机操作：题目卡片要清楚，批量操作要克制，不能把识别结果做成桌面端表格。

## 3. 范围

### 3.1 In Scope

1. 定义 OCR structured output schema。
2. 让 OCR 结果支持单题、多题、非题目和不清晰题。
3. 让 `activeStudyContext` 从结构化题目对象生成。
4. 优化 AI 讲题 prompt：分步骤讲解、公式规范、承接当前题目上下文。
5. 设计多题保存策略：单题保存、勾选批量保存、非题目不显示保存入口。
6. 为 `createWrongQuestion`、`searchKnowledge`、`createReviewTask` 预留 tool action 形态。
7. 保留现有 Markdown / KaTeX / 渐进流式渲染体验。

### 3.2 Out of Scope

第一轮不做：

- 完整 LangGraph Agent。
- 真正自动调用数据库写入工具。
- RAG 知识库检索。
- FSRS 复习任务落库。
- 多会话管理重构。
- OCR 历史图片自动跨设备迁移。
- 大规模 UI 重设计。

这些能力会在 Phase 4 ~ Phase 6 继续推进。

## 4. 核心数据模型

建议新增共享 contract：`@repo/types/api/ocr-question`。

### 4.1 OCR 结果

```ts
type OcrRecognitionType = 'question' | 'multi_question' | 'non_question' | 'unclear';

type OcrQuestionResult = {
  id: string;
  index: number;
  questionText: string;
  options: string[];
  subject: '数学' | '英语' | '物理' | '化学' | '生物' | '计算机' | '其他';
  questionType: 'single_choice' | 'multiple_choice' | 'blank' | 'calculation' | 'proof' | 'short_answer' | 'essay' | 'unknown';
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  knowledgePoints: string[];
  answer: string;
  analysis: string;
  errorSuggestion: '概念不清' | '审题错误' | '计算错误' | '方法不会' | '记忆遗漏' | '其他';
  saveStatus: 'savable' | 'needs_review' | 'not_savable';
  confidence: number;
  displayMarkdown: string;
  warnings: string[];
};

type OcrStructuredResult = {
  recognitionType: OcrRecognitionType;
  summary: string;
  questions: OcrQuestionResult[];
  rawText: string;
  displayMarkdown: string;
  modelVersion: string;
};
```

字段约定：

- `recognitionType='question'`：`questions.length === 1`。
- `recognitionType='multi_question'`：`questions.length > 1`。
- `recognitionType='non_question'`：`questions.length === 0`，`summary` 说明图片内容。
- `recognitionType='unclear'`：图片疑似题目但字段不完整，允许展示，不默认建议保存。
- `confidence` 范围为 `0` 到 `1`。
- `displayMarkdown` 用于前端可读展示，不参与保存字段解析。
- `warnings` 放不确定点，例如“题干下半部分模糊”“答案疑似缺失”。

### 4.2 与现有 OcrRecord 的关系

现有 `OcrRecord.parsedJson` 已是 passthrough schema，可以兼容新结构。Phase 3 第一轮建议：

- 保留 `rawText` 字段，继续存模型原始文本或结构化结果的可读序列化。
- `parsedJson` 保存 `OcrStructuredResult`。
- 前端读取历史 OCR 时，优先识别新结构；如果是旧数据，则继续走 `parseOcrResult()` 兜底。

这样可以避免立刻改 Prisma schema。

### 4.3 与 WrongQuestion 的关系

保存错题时使用 `OcrQuestionResult` 映射到 `CreateWrongQuestionRequest`：

```text
questionText -> questionText
subject -> subject
knowledgePoints[0] or subject -> category
knowledgePoints -> knowledgePoints
analysis -> analysis
answer -> answer
errorSuggestion -> errorType
displayMarkdown/rawText -> rawContent
sourceRecordId -> OcrRecord.id
sourceGroupId -> `${ocrGroupId}:${question.id}`
```

多题保存时，每一道题必须有独立 `sourceGroupId`，避免同一张图中多题互相误判重复。

## 5. OCR 输出协议

### 5.1 模型请求

`/api/ocr` 仍保持 SSE 流式输出，避免破坏现有体验。模型提示词需要明确：

- 先判断图片类型。
- 输出结构化 JSON 数据。
- 同时提供 `displayMarkdown` 用于展示。
- 不确定字段使用空字符串、`unknown` 或 warnings，不编造。
- 非题目只描述图片内容，不输出题目框架。
- 多题必须拆成 `questions[]`。

### 5.2 流式展示策略

结构化 JSON 天然不适合边流边解析。Phase 3 第一轮采用双层策略：

1. 流式阶段：继续展示模型的 `displayMarkdown` 或可读讲解文本。
2. 完成阶段：解析最终结构化 JSON，更新 OCRRecord、activeStudyContext 和保存入口。

如果模型只返回 JSON，前端流式体验会变差。因此 prompt 应要求模型输出一个可解析 envelope，其中展示内容和结构化数据分区明确。

推荐协议：

```text
<PREPMIND_DISPLAY_MARKDOWN>
面向用户的识别与讲解 Markdown
</PREPMIND_DISPLAY_MARKDOWN>

<PREPMIND_STRUCTURED_JSON>
{ ...OcrStructuredResult }
</PREPMIND_STRUCTURED_JSON>
```

前端完成后提取 JSON。如果 JSON 提取或校验失败，降级到旧 `parseOcrResult()`，并记录 `warnings`。

## 6. AI 讲题 Prompt

### 6.1 基础讲题要求

`/api/chat` 的系统提示继续保留当前中文备考助手定位，并强化：

- 解题时给出思路，不只给答案。
- 优先使用有序步骤，每一步单独成段。
- 数学公式统一 `$...$` 和 `$$...$$`。
- 多行推导使用独立公式块。
- 用户问“为什么这样做”时，解释关键推理依据。
- 不确定时明确说明不确定，不编造。

### 6.2 activeStudyContext 来源

`activeStudyContext` 从 `OcrQuestionResult` 生成：

```ts
type ActiveStudyContext = {
  type: 'ocr-question';
  sourceGroupId?: string;
  questionId?: string;
  questionText: string;
  subject?: string;
  questionType?: string;
  difficulty?: string;
  knowledgePoints?: string[];
  analysis?: string;
  answer?: string;
  warnings?: string[];
  rawContent?: string;
  updatedAt?: number;
};
```

多题场景下，用户点开或选择某一道题时，当前题变为 active context。用户没有选择时，默认使用第一道题，但 UI 应提示“已识别多道题，可切换讨论对象”。

## 7. 保存错题策略

### 7.1 单题

识别完成后：

- `saveStatus='savable'`：显示保存入口。
- `saveStatus='needs_review'`：显示“检查后保存”，进入确认弹层时突出不确定字段。
- `saveStatus='not_savable'`：不显示保存入口。

### 7.2 多题

识别完成后展示题目列表：

- 每题一个简短卡片，显示题号、学科、知识点、可保存状态。
- 用户可进入单题详情后保存。
- 支持勾选多题批量保存，但默认不自动全选。
- 批量保存逐题调用现有 WrongQuestion 创建逻辑；部分失败时保留失败项提示，并进入 mutationQueue 兜底。

### 7.3 非题目

- 不生成 activeStudyContext。
- 不显示保存错题入口。
- 展示自然语言说明和继续上传/提问引导。

### 7.4 不清晰题

- 展示识别结果和 warnings。
- 默认不建议保存。
- 用户手动确认后可以保存为 `needs_review` 的错题，`rawContent` 保留不确定说明。

## 8. Tool Action 预留

本阶段只设计边界，不让 AI 自动写库。

### 8.1 createWrongQuestion

当前落地方式：用户点击保存按钮触发现有 `POST /wrong-questions`。

预留形态：

```ts
type ToolActionProposal = {
  type: 'createWrongQuestion';
  label: string;
  reason: string;
  payload: CreateWrongQuestionRequest;
  requiresUserConfirmation: true;
};
```

### 8.2 searchKnowledge

Phase 5 RAG 接入后使用。当前只预留字段：

```ts
type SearchKnowledgeProposal = {
  type: 'searchKnowledge';
  query: string;
  knowledgePoints: string[];
  requiresUserConfirmation: false;
};
```

### 8.3 createReviewTask

Phase 4 FSRS 接入后使用。当前只预留字段：

```ts
type CreateReviewTaskProposal = {
  type: 'createReviewTask';
  questionId: string;
  knowledgePoints: string[];
  reason: string;
  requiresUserConfirmation: true;
};
```

后续真实 tool calling 可以复用这些 proposal 类型，但执行层必须校验用户权限和 payload schema。

## 9. 前端体验设计

### 9.1 OCR 结果展示

- 单题：继续以聊天气泡形式展示讲解内容，下方显示保存入口。
- 多题：气泡内先显示识别摘要，再展示多题卡片列表。
- 非题目：只显示图片内容说明。
- 不清晰题：显示不确定提示，不默认鼓励保存。

### 9.2 保存确认弹层

确认弹层从结构化字段读取数据：

- 题干。
- 学科。
- 知识点。
- 答案。
- 解析。
- 错因建议。
- 不确定 warnings。

用户可以在保存前查看和编辑备注，但不要求在本阶段编辑结构化字段。

### 9.3 追问体验

- 单题自动成为当前讨论题。
- 多题允许用户切换“当前讨论题”。
- 当前题上下文在顶部栏或气泡附近给出轻提示。

## 10. 兼容与迁移

### 10.1 旧 OCR 历史

旧 `parsedJson` 只有 `isQuestion`、`questionText`、`analysis` 等字段，继续兼容：

- 读取历史时，如果符合旧结构，用 adapter 转成单题 `OcrStructuredResult`。
- 如果 adapter 失败，回退到 `parseOcrResult(rawText)`。

### 10.2 旧 WrongQuestion

错题本现有数据结构不需要迁移。新结构只影响创建错题时的字段来源。

### 10.3 API 边界

第一轮尽量不改 NestJS OcrRecord API 和 WrongQuestion API。结构化结果通过现有 `parsedJson` 进入服务端。

## 11. 测试策略

新增或调整测试：

1. `@repo/types`：OCR structured schema 校验。
2. 前端 OCR structured parser：能从 envelope 提取 display Markdown 和 JSON。
3. 旧数据 adapter：旧 `OcrParsedPayload` 能转成单题结构。
4. activeStudyContext：结构化题目能生成上下文，多题可切换当前题。
5. wrong question mapping：`OcrQuestionResult` 能稳定映射到 `CreateWrongQuestionRequest`。
6. 非题目门禁：非题目不显示保存入口，不生成 active context。
7. 多题保存：每题生成独立 `sourceGroupId`。

验证命令延续当前项目习惯：

```powershell
bun --cwd packages/types typecheck
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
node --experimental-strip-types apps/web/src/lib/chat-context.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

如改动后端，再补：

```powershell
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
```

## 12. 风险与应对

### 风险 1：模型不稳定输出合法 JSON

应对：

- 使用明确 envelope 标签。
- 完成阶段做 JSON 提取和 Zod 校验。
- 失败时回退旧 `parseOcrResult()`，不中断用户体验。

### 风险 2：多题 UI 变复杂

应对：

- 多题列表只展示题号、简短题干、知识点和保存状态。
- 详情仍复用现有聊天/保存弹层模式。
- 不做桌面表格。

### 风险 3：提前做 tool calling 扩大范围

应对：

- 本阶段只做 proposal 类型和用户确认式 action。
- 不接 LangGraph，不自动写库，不创建复习任务。

### 风险 4：破坏现有 OCR 历史

应对：

- 新结构通过 `parsedJson` 兼容进入服务端。
- 旧数据 adapter 保留。
- 旧 `parseOcrResult()` 作为兜底，不立即删除。

## 13. 验收标准

- OCR 输出完成后能得到稳定 `OcrStructuredResult`。
- 单题、多题、非题目、不清晰题都有明确状态和 UI 行为。
- 保存错题优先使用结构化字段，不再主要依赖 Markdown 猜字段。
- 多题图片支持选择单题保存和批量保存。
- 追问上下文来自结构化题目对象，用户问“这一步为什么这样做”时能稳定承接。
- 非题目输入不显示保存错题入口。
- 旧 OCR 历史仍可展示和保存，不出现数据断层。
- Phase 4/5/6 可以基于 tool action proposal 继续接 FSRS、RAG 和 LangGraph。

## 14. 执行顺序建议

1. 新增共享 OCR structured schema。
2. 新增前端 envelope 提取、schema adapter 和映射测试。
3. 改造 `/api/ocr` prompt，让模型输出 display Markdown + structured JSON。
4. 改造 OCR runtime，完成阶段优先解析结构化结果。
5. 改造 `activeStudyContext` 生成逻辑。
6. 改造保存错题弹层和创建请求映射。
7. 增加多题列表和批量保存入口。
8. 保留旧解析兜底并补齐回归测试。
9. 更新 `docs/data-flow.md`、`docs/roadmap.md`、`AGENTS.md`、`CLAUDE.md`、`DEVLOG.md`。
