# Phase 2.5 Product Experience Design

> 目标：在进入 Phase 3 AI 工程化之前，补齐当前产品壳层、页面最小功能和视觉体验，把 PrepMind 从“功能可用的 MVP”推进到“面试可展示、用户愿意每天打开”的移动端 AI 备考 App。

## 1. 背景

Phase 2.3 已完成业务 API 迁移：Auth、WrongQuestion、ChatMessage、OCRRecord、Uploads、Dexie mutationQueue 与服务端同步主链路都已落地。当前主要风险不再是数据能否保存，而是产品体验还不完整：

- AI 对话页是事实主入口，但视觉上还偏普通工具页。
- 今日任务仍是静态模板，能用但缺少“下一步学习建议”的产品感。
- 错题本功能已可用，但视觉和交互还可以更像复习工具，而不是普通 CRUD 列表。
- 个人中心目前是占位页，只显示标题，无法承担账号、偏好和本地数据说明。
- 侧边栏已经存在，但还没有形成完整的导航与产品识别系统。

Phase 3 会引入 structured output、tool calling、RAG、LangGraph 等复杂能力。如果 Phase 2.5 不先补齐产品壳层，后续新增 AI 能力会被薄弱页面承载，体验和演示效果都会打折。

## 2. 设计决策

最终视觉方向确定为：

**亮色软萌日漫风的 AI 学习搭子。**

产品结构保持：

**AI 对话为主入口，侧边栏作为导航层，今日任务 / 错题本 / 个人中心作为从对话流中抽出的学习工具页。**

这意味着不把今日任务改成首页，也不做重 dashboard。用户打开应用后仍优先进入 AI 对话；其他页面服务于学习闭环，而不是抢主入口。

## 3. 设计原则

### 3.1 Chat-first

PrepMind 的核心不是任务管理器，而是 AI 备考助手。AI 对话页继续是第一屏：

- 拍照识题、追问、保存错题都围绕对话发生。
- 侧边栏承担导航，不改成复杂桌面式布局。
- 今日任务和错题本提供学习闭环，但不替代对话主线。

### 3.2 亮色软萌，但不幼稚

视觉可以更有个性，但不能牺牲学习工具的效率：

- 基底使用明亮柔和的粉、蓝、薄荷、奶白色。
- 引入原创 mascot / 学习搭子感，但不引用任何现成动漫 IP。
- 避免大面积廉价渐变、过度装饰、模板化 dashboard。
- 页面仍以阅读、复习、操作效率为核心。

### 3.3 面试展示感

Phase 2.5 需要体现前端能力：

- 统一视觉系统。
- 移动端优先布局。
- 有节制的微交互和动效。
- 明确的 CRUD 状态反馈。
- 清楚的数据同步状态表达。

### 3.4 工程边界清晰

这不是 Phase 3 AI 工程化：

- 不做 RAG。
- 不做 LangGraph。
- 不做 tool calling。
- 不新增复杂后端学习画像模型。
- 不做多会话完整管理。
- 不做成就系统、主题切换商店或复杂角色养成。

## 4. 范围

### 4.1 In Scope

Phase 2.5 第一轮包含：

1. **主聊天页轻视觉升级**
   - 保留现有 AI 聊天、OCR、流式输出、保存错题逻辑。
   - 调整页面视觉为亮色软萌日漫风。
   - 增加轻量 mascot / 状态感，但不影响主要输入区域。
   - 保持流式 Markdown、自动滚动、停止生成等既有交互。

2. **侧边栏升级**
   - 形成明确导航层：AI 对话、今日任务、错题本、个人中心。
   - 展示当前用户信息和同步状态说明。
   - 保留退出登录。
   - 移动端打开/关闭要顺滑，不遮挡关键操作。

3. **今日任务页重做**
   - 从静态任务页升级为轻量学习手账。
   - 展示当天任务、完成进度、预计学习时间。
   - 基于本地任务状态和错题未掌握数量生成下一步建议。
   - 继续使用当前 Dexie / localStorage 方案，不新增服务端表。

4. **错题本视觉微调**
   - 保留当前服务端 CRUD、Dexie 缓存、mutationQueue。
   - 优化卡片信息层级：题目、学科、知识点、错因、掌握状态。
   - 详情页保持全屏覆盖，不再出现半透明叠底问题。
   - 继续保留自定义删除确认、备注保存、标记掌握和待同步状态。

5. **个人中心补齐**
   - 从占位页补成可用页面。
   - 展示用户昵称、邮箱、账号状态。
   - 支持修改昵称，调用现有 `/users/me`。
   - 增加学习偏好设置：备考目标、讲解风格、每日学习强度。
   - 学习偏好第一阶段保存在本地，按 userId 隔离。
   - 显示本地缓存 / 待同步说明。
   - 保留退出登录入口。

6. **统一轻提示与动效规范**
   - 保存、更新、删除、标记掌握、修改昵称、保存偏好都要有轻提示。
   - 操作中按钮要有 loading / disabled 状态。
   - 待同步状态用温和文案表达，不吓用户。
   - 页面进入、卡片出现、气泡进入使用短动效。

7. **文档更新**
   - 更新 `docs/roadmap.md`：新增 Phase 2.5。
   - 更新 `docs/data-flow.md`：补充个人中心本地偏好数据流。
   - 更新 `AGENTS.md` / `CLAUDE.md` 当前进度和下一步。
   - 实现完成后更新 `DEVLOG.md` 和本地 `Blog/`。

### 4.2 Out of Scope

第一轮不做：

- 多会话列表和会话重命名。
- 成就系统、连续学习天数、宠物养成。
- 主题切换器。
- 服务端学习偏好表。
- 真正的学习计划生成算法。
- AI 自动生成每日任务。
- Phase 3 structured output schema。

这些可以作为 Phase 2.6 或 Phase 3 后的体验增强。

## 5. 视觉系统

### 5.1 色彩

基础方向：

- 背景：奶白、浅粉、浅蓝、浅暖黄。
- 主状态：Sakura Pink，用于主要强调和 mascot。
- 同步状态：Mint，用于已同步、待同步、恢复中。
- 信息状态：Sky Blue，用于上下文、AI 正在处理。
- 提醒状态：Soft Amber，用于待完成、未掌握。
- 文字：深紫灰，不使用纯黑大面积压迫感。

颜色要避免“一页全粉”。粉色只做品牌记忆点，蓝、薄荷、暖黄负责分散层级。

### 5.2 形状

- 页面容器可以有较柔和圆角，但不做所有东西都圆成气泡。
- 工具页卡片圆角控制在 16px 左右。
- 小状态 chip 使用 pill。
- 详情页和抽屉保留清楚边界，避免看起来像漂浮贴纸堆叠。

### 5.3 字体与密度

- 继续使用系统字体栈，不引入网络字体。
- 移动端正文保持清晰，不能为了可爱牺牲可读性。
- 工具页要比样本更紧凑，避免卡片过大导致滚动疲劳。
- 按钮文字不能挤压，最小触摸目标继续遵循项目现有 44x44px 约束。

### 5.4 图形语言

允许：

- 原创 mascot 符号，例如“学”字小助手。
- 星标、贴纸感边框、柔和网格背景。
- 手账感分割和状态条。

不允许：

- 现成动漫 IP。
- 大面积装饰插画压过内容。
- 与学习无关的过度可爱文案。
- 模板化渐变 orb / bokeh 背景。

## 6. 页面设计

### 6.1 Chat Page

目标：让 AI 对话页成为“学习搭子主入口”。

保留：

- 当前消息列表。
- OCR 上传和流式识别。
- AI 流式输出。
- 停止生成。
- 保存错题。
- 自动滚动与用户滚动中断逻辑。
- activeStudyContext 追问承接能力。

新增或调整：

- 顶部栏更有品牌识别，显示 PrepMind AI 和当前上下文状态。
- 侧边栏按钮更明显，但不抢输入区。
- 空状态从普通欢迎语升级为轻量学习搭子欢迎状态。
- OCR / Chat 工具入口统一为亮色软萌按钮。
- 保存错题成功、暂存待同步、非题目识别等反馈更轻、更可读。

风险控制：

- 不重写流式输出核心逻辑。
- 不改变 `/api/chat` 和 `/api/ocr` 请求协议。
- 不影响 Markdown / KaTeX 渲染。

### 6.2 Chat Sidebar

目标：成为移动端主导航层。

内容：

- 用户头像 / 昵称 / 邮箱。
- 导航：AI 对话、今日任务、错题本、个人中心。
- 同步状态说明：服务端同步、本地暂存、网络恢复自动同步。
- 退出登录。

交互：

- 打开时有柔和 slide 动效。
- 背景遮罩足够明确。
- 关闭按钮和导航项触摸目标不低于 44px。
- 当前路由高亮。

### 6.3 Today Page

目标：从静态模板升级为轻学习手账。

数据来源：

- `TODAY_TASKS` 静态模板。
- localStorage 中按 userId/dateKey 隔离的完成状态。
- Dexie wrongQuestions 中当前用户未掌握数量。

展示：

- 日期和当天进度。
- 下一步建议：
  - 如果有未掌握错题，优先建议复习错题。
  - 如果没有错题，建议拍照识题或总结。
- 任务列表：复盘知识点、错题回看、拍照识题、学习总结。
- 任务完成状态和预计时间。
- 快捷进入 AI 对话 / 错题本。

操作反馈：

- 勾选任务后轻提示。
- 任务卡片状态有短动效。
- 本地保存失败时提示用户重试，但 localStorage 失败概率很低。

### 6.4 Error Book Page

目标：在现有 CRUD 基础上提升复习感和状态表达。

保留：

- 服务端读取错题。
- Dexie 离线缓存。
- 更新备注。
- 标记已掌握 / 未掌握。
- 删除确认。
- 待同步 badge。
- 详情页全屏覆盖。

调整：

- 卡片更像复习卡，而不是普通列表。
- 学科、知识点、错因、状态层级更清楚。
- 删除确认更贴合新视觉系统。
- 备注保存和标记掌握成功提示统一为轻提示。
- 空状态更有引导感，但不夸张。

### 6.5 Profile Page

目标：从占位页补成个人中心。

数据来源：

- 当前用户：Zustand auth session / `/auth/me`。
- 昵称更新：现有 `/users/me` PATCH。
- 学习偏好：localStorage，按 userId 隔离。

内容：

- 用户卡：昵称、邮箱、账号创建时间（如前端已能拿到则展示，否则不展示）。
- 昵称编辑。
- 学习偏好：
  - 备考目标。
  - AI 讲解风格：先结论后推导 / 苏格拉底引导 / 详细步骤。
  - 每日学习强度：轻量 / 标准 / 强化。
- 本地数据说明：
  - 聊天、OCR、错题已接入服务端。
  - 离线失败会暂存在本机并自动补偿同步。
  - 今日任务和学习偏好仍是本地数据。
- 退出登录。

本阶段不需要后端新增表。学习偏好后续如果要影响 AI prompt，再在 Phase 3 或 Phase 3.1 设计注入规则。

## 7. 数据流

### 7.1 用户资料

```text
ProfilePage
  -> useMe / useUserStore 读取当前用户
  -> 用户修改昵称
  -> PATCH /users/me
  -> 成功后更新 TanStack Query auth/me cache
  -> 更新 Zustand currentUser
  -> 显示轻提示
```

### 7.2 学习偏好

```text
ProfilePage
  -> readLearningPreferences(userId)
  -> localStorage: prepmind-preferences:{userId}
  -> 用户保存偏好
  -> writeLearningPreferences(userId, preferences)
  -> 显示轻提示
```

偏好 schema 第一阶段只在前端定义。字段要稳定，方便后续迁移到服务端：

```ts
type LearningPreference = {
  examGoal: string;
  explanationStyle: 'direct' | 'socratic' | 'detailed';
  dailyIntensity: 'light' | 'standard' | 'intense';
  updatedAt: number;
};
```

### 7.3 今日任务

今日任务继续使用已有 `today-tasks.ts`：

```text
TodayPage
  -> getLocalDateKey()
  -> readTodayTaskState(userId, dateKey)
  -> db.wrongQuestions.where(userId)
  -> 计算进度和下一步建议
  -> toggleTaskCompletion()
  -> writeTodayTaskState(userId, state)
```

### 7.4 错题本

不改变 Phase 2.3 已完成的数据权威关系：

```text
WrongQuestion API / PostgreSQL = 权威
Dexie = 离线缓存 + 乐观更新 + mutationQueue 补偿
```

Phase 2.5 只调整展示和交互反馈，不改服务端模型。

## 8. 动效规范

动效用于降低操作生硬感，不做炫技：

- 页面进入：内容区轻微上浮，150-220ms。
- 侧边栏：slide + fade，180-240ms。
- 聊天气泡：新消息轻微上浮，不影响流式文本稳定渲染。
- 任务勾选：按钮缩放和状态颜色变化。
- CRUD 成功：轻提示出现 / 消失。
- 待同步：小 badge 或文案状态，不做持续闪烁。

可访问性边界：

- 支持 `prefers-reduced-motion: reduce`，减少非必要动画。
- 不使用长时间循环大幅位移动画。
- 不让动画影响文本可读性和输入响应。

## 9. 组件与文件边界

建议新增或拆分：

- `apps/web/src/lib/learning-preferences.ts`
  - 负责学习偏好的 schema、默认值、读写、校验。

- `apps/web/src/lib/learning-preferences.test.mts`
  - 覆盖默认值、按 userId 隔离、非法数据回退。

- `apps/web/src/components/ui/app-toast.tsx` 或沿用现有轻提示实现
  - 如果现有轻提示已足够，优先复用，不重复造。

- `apps/web/src/components/layout/app-shell-motion.tsx`（可选）
  - 如果动效 class 重复明显，再抽，不提前抽象。

主要修改：

- `apps/web/src/app/(chat)/chat/page.tsx`
- `apps/web/src/components/chat/chat-sidebar.tsx`
- `apps/web/src/components/chat/chat-top-bar.tsx`
- `apps/web/src/components/chat/chat-input-bar.tsx`
- `apps/web/src/app/(main)/today/page.tsx`
- `apps/web/src/app/(main)/error-book/page.tsx`
- `apps/web/src/app/(main)/profile/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/lib/today-tasks.ts`
- `apps/web/src/hooks/use-auth.ts` 或 `apps/web/src/lib/auth-api.ts`（仅在昵称更新需要前端 API 封装时）

## 10. 验收标准

### 10.1 功能

- 未登录用户仍正确进入登录/注册流程。
- 登录后默认进入 AI 对话。
- 侧边栏能打开和关闭，导航到今日任务、错题本、个人中心。
- 今日任务可勾选，刷新后保留当天状态。
- 错题本 CRUD 行为不回退，待同步状态仍可见。
- 个人中心可修改昵称并同步到后端。
- 学习偏好可保存，刷新后仍存在，切换用户后隔离。
- 登出后清理当前 session，不误删服务端数据。

### 10.2 体验

- 移动端首屏不拥挤，主要输入区始终清楚。
- 触摸目标不低于 44px。
- 文本不溢出按钮、卡片和详情页。
- 页面风格统一为亮色软萌日漫风。
- 页面不出现廉价 dashboard 感。
- 动效可感知但不影响操作。

### 10.3 技术

- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- 新增前端纯函数测试通过。
- 现有 API / mutationQueue / Markdown / auto-scroll 测试不回退。
- 如修改文档，提交前运行 `git diff --check`。

## 11. 风险与应对

### 风险 1：视觉升级影响聊天稳定性

应对：

- 不重写流式请求逻辑。
- 不改 chat runtime provider 的核心数据结构。
- 样式调整和布局调整分提交完成。

### 风险 2：软萌风格变幼稚

应对：

- 文案保持学习工具口吻。
- mascot 只是辅助符号，不做夸张角色设定。
- 卡片密度保持适中，避免贴纸堆叠。

### 风险 3：动效导致卡顿

应对：

- 只动画 opacity / transform。
- 避免 layout-affecting 动画。
- 支持 reduced motion。

### 风险 4：本地偏好后续迁移成本

应对：

- 定义稳定前端 schema。
- key 按 userId 隔离。
- 后续服务端化时可直接迁移字段。

## 12. 执行顺序建议

1. 先补 `learning-preferences` 纯函数和测试。
2. 补个人中心功能，因为它当前是最大占位缺口。
3. 重做侧边栏，建立导航和视觉基准。
4. 重做今日任务页，形成轻学习手账。
5. 微调错题本视觉和反馈，不重写数据逻辑。
6. 轻升级聊天页视觉，确保不破坏流式输出。
7. 跑完整验证并更新文档 / Blog。

## 13. 外部设计约束参考

- [WCAG 2.2 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)：触控目标不能过小，项目实现继续坚持不低于 44x44px。
- [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)：动效需要尊重用户系统级减少动态效果设置。
