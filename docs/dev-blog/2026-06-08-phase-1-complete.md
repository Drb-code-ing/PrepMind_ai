# Day 4：Phase 1 收官 - 从前端 MVP 到可迁移的数据流

> 日期：2026-06-08  
> 阶段：Phase 1 MVP 完成  
> 主题：本地数据流、错题本 CRUD、今日任务静态版、Phase 2 迁移准备

## 今日目标

今天的目标不是继续堆新页面，而是把 Phase 1 做成一个能稳定演示、能解释数据流、也能平滑迁移到后端的前端 MVP。

Phase 1 仍然坚持纯前端方案：不接入数据库服务端，不提前做复杂 API 抽象。核心判断是，当前业务数据源都在浏览器本地，过早封装请求/响应拦截器只会制造一层没有真实价值的结构。真正的 `apiClient`、认证拦截、错误响应规范和 TanStack Query 缓存，应当在 Phase 2 接入 NestJS API 后统一设计。

## 本地数据流收口

Phase 1 的数据分层已经明确：

- `localStorage` 只保存登录态、输入草稿和今日任务完成状态。
- Dexie / IndexedDB 保存业务数据：聊天消息、OCR 记录、错题本。
- 所有业务数据都带 `userId`，按当前本地账号隔离。
- 聊天消息和 OCR 记录合并成统一时间线，刷新后仍按真实创建时间恢复。

这个设计解决了一个重要问题：清空 localStorage 之后重新注册账号，不应该再看到旧账号的聊天、OCR 或错题数据。旧版无 `userId` 的历史数据只在能够明确归属时迁移，否则保持无主状态，不展示给新账号。

## 错题本 CRUD

错题本在 Phase 1 中选择 Dexie 作为唯一数据源，来源只开放 OCR 识别结果。流程是：

```text
拍照 / 上传图片
  -> MIMO OCR 流式识别
  -> AI 按固定 Markdown schema 输出
  -> 前端解析题目字段
  -> 用户预览确认
  -> 写入 Dexie wrongQuestions
```

错题记录包含题目、学科、知识点、分析思路、参考答案、错因建议、图片、备注、掌握状态等字段。保存时用 `userId + sourceGroupId` 防止同一次 OCR 重复保存；保存成功后按钮会进入已保存状态，避免重复点击。

错题本页面支持列表查看、学科/状态筛选、详情查看、删除、标记掌握、保存备注。详情页改成全屏覆盖式页面，避免底层列表透出造成视觉混乱。

## OCR 输出规范

前端不直接把 AI 的一整段原始回答当作错题数据。当前方案是让 OCR 提示词要求固定 Markdown schema：

- `题目`
- `学科`
- `知识点`
- `分析思路`
- `参考答案`
- `错因建议`

前端通过 `parseOcrResult()` 提取字段，并用 `getMissingWrongQuestionFields()` 检查关键字段是否缺失。这样页面只展示题目相关内容，原始文本保留在 `rawContent`，方便 Phase 2 后续迁移为后端 schema 校验或结构化 JSON 输出。

## 今日任务静态版

今日任务作为 Phase 1 最后一个模块，先做静态模板，不做 AI 推荐和后端任务调度。页面包含四类任务：

- 知识点复盘
- 错题回看
- 拍照识题
- 学习总结

完成状态保存到 `prepmind-today:{userId}:{yyyy-mm-dd}`，按账号和日期隔离。页面还会读取当前用户未掌握错题数量，用来增强“错题回看”任务提示。

这个版本的价值是建立任务入口和交互骨架；Phase 2/4 后可以自然迁移到后端任务 API、FSRS 复习调度和 AI 学习计划。

## 质量收尾

今天还完成了几项收尾：

- 修复 Hydration warning：登录态改为客户端 effect 后读取。
- 移除 Phase 1 不合适的 TanStack Query 层，避免把本地 Dexie 数据再包装成 server state。
- 修复 Dexie `sourceGroupId` 索引缺失导致的保存错题异常。
- 统一 Markdown、GFM 和数学公式渲染，提升 OCR 结果可读性。
- 将关键图片预览改为 `next/image` + `unoptimized`，保留 base64 本地预览能力。
- 补齐 `user-scope`、`today-tasks`、`wrong-question-parser` 回归测试。

## 审查结论

本次收尾审查没有发现 P0/P1 阻塞问题。当前 Phase 1 的主要技术债是页面职责偏大，尤其是聊天页同时承担聊天、OCR、持久化和错题保存预览逻辑。这个问题不影响 Phase 1 演示，但 Phase 2 接入 API 时应拆成更清晰的 hooks 和业务组件。

另一个残留风险是浏览器关闭时的本地 flush 只能尽力执行，不能像后端写入一样保证完成。Phase 1 可以接受；Phase 2 应以服务端保存结果作为真实数据源。

## 验证结果

本阶段收尾验证：

```text
node --test apps/web/src/lib/user-scope.test.mts apps/web/src/lib/today-tasks.test.mts apps/web/src/lib/wrong-question-parser.test.mts
npm --workspace @repo/web run lint
npm --workspace @repo/web run build
```

以上均已通过。

## Phase 2 入口

Phase 1 到这里已经完整收口。下一步进入 Phase 2：后端工程化。

优先级建议：

1. NestJS AuthModule，建立真实用户身份。
2. WrongQuestion CRUD API，将本地错题迁移到 PostgreSQL。
3. ChatMessage / OCRRecord API，替换当前 Dexie 主数据源。
4. 重新引入 TanStack Query 管理 API server state。
5. 将 Dexie 降级为离线缓存和乐观更新层。

Phase 1 的价值是把产品主链路跑通；Phase 2 的重点是把它变成真正可维护、可扩展、可上线的工程系统。
