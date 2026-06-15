# 从 MinIO 到 Zod：一个 AI 备考助手里的数据边界设计

在做 PrepMind AI 的过程中，我越来越明显地感受到：一个 AI 应用真正难的地方，不只是“接上模型”，而是要把模型输出、用户输入、服务端数据、本地缓存、文件资源和异步任务放在各自正确的位置。

如果边界不清楚，项目很快就会变成这样：

```text
图片塞进数据库
接口返回直接相信
前端到处手写 loading 和 error
弱网失败后数据丢失
AI 输出格式稍微变动就保存失败
统计数据和本地状态互相打架
```

这篇文章不按官方文档介绍技术，而是结合 PrepMind AI 这个项目，讲清楚几个关键工具在真实项目里的职责：

- MinIO：文件和图片的对象存储。
- TanStack Query：前端服务端数据层。
- Mutation：一次写操作的完整生命周期。
- Zod：运行时数据边界的守门员。
- Redis：异步任务、缓存和调度的基础设施。

它们不是为了“技术栈看起来高级”才被加入项目，而是分别解决不同层的数据边界问题。

## 先看整体数据分工

当前 PrepMind AI 的核心数据流可以粗略分成几类：

```text
结构化业务数据
  -> PostgreSQL

图片和文件资源
  -> MinIO

前端服务端数据请求和缓存
  -> TanStack Query

本地快速恢复和离线补偿
  -> Dexie / IndexedDB

运行时 UI 状态
  -> Zustand / React state

数据契约和运行时校验
  -> Zod

后续异步任务、缓存、限流、提醒调度
  -> Redis / BullMQ
```

这个分工的关键是：不要让一个工具承担它不该承担的职责。

PostgreSQL 负责权威业务数据，但不适合直接存大图片。MinIO 适合存文件，但不适合查询错题状态。TanStack Query 管 API 请求和缓存，但不是数据库。Dexie 可以做离线补偿，但不能变成长期权威来源。Zod 能校验数据结构，但不负责保存数据。Redis 适合临时状态和队列，但不应该在当前阶段承载 Auth 或复习记录的权威数据。

理解这一点，后面的设计就会清晰很多。

## MinIO：不要把图片塞进数据库

PrepMind AI 有一个核心场景：用户上传题目图片，AI 识别题目，再把题目保存到 OCR 历史或错题本。

最早期开发时，图片可以用 base64 暂存在前端本地，这对 MVP 很方便。但一旦接入后端和数据库，继续把 base64 存进业务表就会带来问题：

- 数据库字段变得非常大。
- 查询 OCRRecord 或 WrongQuestion 时会顺带拉出巨大图片字符串。
- 同一张图片在多个业务记录里可能重复保存。
- 后续迁移到云存储会很麻烦。

所以项目在 Phase 2.3 引入 MinIO，用本地对象存储模拟生产环境的 OSS / S3 / R2。

现在图片链路是：

```text
用户选择题目图片
  -> 前端上传到 NestJS /uploads/images
  -> 后端写入 MinIO
  -> 返回 imageUrl
  -> OCRRecord / WrongQuestion 保存 imageUrl
```

这个设计里，PostgreSQL 只保存图片地址，而不是图片本体。

MinIO 的价值不是“本地多起一个服务”，而是让开发阶段就建立正确的文件边界：

```text
业务表：保存结构化字段和 imageUrl
对象存储：保存图片二进制内容
```

这样以后从 MinIO 迁移到阿里云 OSS、腾讯 COS、Cloudflare R2 或 AWS S3，业务数据模型不需要大改。我们换的是文件存储后端，不是整个业务表结构。

## TanStack Query：前端服务端数据的管家

在一个前后端分离的应用里，前端页面最常见的问题不是“怎么发请求”，而是：

- loading 怎么处理？
- error 怎么处理？
- 数据什么时候缓存？
- mutation 成功后哪些列表要刷新？
- 用户切页面回来要不要重新请求？
- 多个组件用同一份数据时怎么避免重复请求？

如果这些都手写，页面会很快变乱。

PrepMind AI 用 TanStack Query 管服务端数据请求。它的定位是：

```text
PostgreSQL：服务端权威数据
NestJS API：数据读写入口
TanStack Query：前端请求、缓存、刷新服务端数据
```

在项目里，典型 query 包括：

- `/wrong-questions`：错题列表。
- `/reviews/stats`：学习统计。
- `/reviews/logs`：最近复习记录。
- `/review-tasks/today`：今日复习任务。
- `/review-tasks`：复习任务列表。

比如今日任务页读取 ReviewTask：

```text
页面进入 /today
  -> useTodayReviewTaskList()
  -> GET /review-tasks/today
  -> TanStack Query 缓存结果
  -> 页面渲染待复习、已完成、已跳过任务
```

当用户评分、跳过、恢复后，页面不是手动拼一堆状态，而是通过 query invalidation 回到服务端权威数据：

```text
用户评分成功
  -> invalidate reviewTasks query
  -> 重新请求 /review-tasks/today
  -> 页面拿到服务端最新状态
```

这对复习系统尤其重要。因为 Card、ReviewLog、ReviewTask 和统计都以服务端为权威，前端应该尽量通过重新请求来对齐，而不是在多个组件里手写同步逻辑。

## Mutation：不只是 POST 请求

很多人第一次接触 TanStack Query 时，会把 mutation 理解成“发 POST 请求”。这个理解太窄了。

在项目里，mutation 表示一次会改变数据的操作。它包括完整生命周期：

```text
用户触发
  -> pending 状态
  -> 调用 API
  -> 成功处理
  -> 失败处理
  -> 刷新相关 query
  -> 给用户反馈
  -> 必要时进入离线队列
```

PrepMind AI 里的 mutation 包括：

- 创建错题。
- 更新错题状态。
- 删除错题。
- 上传图片。
- 创建复习卡。
- ReviewTask 评分。
- ReviewTask 跳过。
- ReviewTask 恢复。
- 保存用户资料。

以今天完成的 ReviewTask rating 为例：

```text
用户点击“掌握”
  -> useSubmitReviewTaskRating().mutateAsync()
  -> POST /review-tasks/:taskId/rating
  -> 成功：刷新今日任务和学习统计
  -> 失败：判断是否可重试
  -> 可重试失败：写入 Dexie mutationQueue
```

这不是一个简单请求，而是一套写操作策略。

Phase 4.4 里 mutation 的失败路径尤其关键。评分请求失败后，不能简单丢掉，也不能直接假装成功。最终设计是：

```text
评分失败且可重试
  -> 写入 mutationQueue
  -> 页面展示“已选择：掌握，等待同步”
  -> 评分按钮和跳过按钮禁用
  -> 网络恢复 / 页面聚焦 / 手动重试时 flush
  -> 同步成功后刷新 query
```

这个设计让用户知道“我的点击被记录了”，同时又不提前改变 FSRS、ReviewLog 和统计。

## Zod：运行时数据边界的守门员

TypeScript 很有用，但它只在编译期工作。

真实项目里，很多数据是在运行时才进入系统的：

- 用户输入。
- 后端接口返回。
- AI structured output。
- Dexie 里的历史缓存。
- localStorage 里的旧版本偏好配置。
- mutationQueue 里的离线任务 payload。

这些数据不能只靠 TypeScript 相信它们“应该是对的”。Zod 的作用就是在运行时验证它们“实际是不是对的”。

在 PrepMind AI 里，Zod 主要放在 `@repo/types` 中，作为前后端共享 API contract。

比如 ReviewTask rating 请求可以描述成：

```text
rating：1 到 4
reviewedAt：合法 datetime
clientMutationId：合法 uuid
```

这类 schema 的价值有两层：

第一，前后端共享类型，减少接口字段漂移。

第二，运行时解析真实数据，不让脏数据进入业务逻辑。

Phase 4.4 的离线评分队列就是一个很典型的例子。Dexie 里可能存在旧版本、损坏或非法 payload。如果 flush 时直接拿出来发给服务端，可能会造成无限重试或奇怪错误。

所以我们会在处理 mutationQueue 时做校验：

```text
读取本地 queue item
  -> 用 Zod 校验 payload
  -> 合法：尝试同步
  -> 非法：标记为 terminal，不再重复重试
```

Zod 在这里不是“锦上添花”，而是边界防线。尤其是 AI 应用里，模型输出并不天然稳定。OCR structured output、错题字段、知识点、答案、解析，都需要 schema 帮我们把“可展示文本”和“可入库结构”分开。

## Redis：现在不抢权威，后面负责异步

Redis 在项目里已经通过 Docker Compose 接入，但当前主业务链路没有重度依赖它。

这点很重要。Redis 很强，但不能因为它强，就把所有东西都塞进去。

当前这些权威数据不依赖 Redis：

```text
Auth refresh token rotation
  -> PostgreSQL

WrongQuestion / ChatMessage / OCRRecord
  -> PostgreSQL

Card / ReviewLog / ReviewTask
  -> PostgreSQL

离线 mutationQueue
  -> 浏览器 Dexie

图片资源
  -> MinIO
```

也就是说，Redis 目前不是登录态主链路，也不是复习数据的权威来源。

那为什么还要准备 Redis？

因为后续阶段会有很多适合异步队列和短期状态的场景：

- OCR 异步任务。
- PDF 解析。
- 文档切片。
- Embedding 生成。
- RAG 索引构建。
- AI 调用限流。
- 复习提醒调度。
- 任务状态缓存。

这些任务不应该卡在一次 HTTP 请求里。

未来 OCR 可以变成：

```text
用户上传图片
  -> 创建 OCRRecord，状态 pending
  -> BullMQ 写入 Redis 队列
  -> worker 异步调用 AI OCR
  -> 完成后更新 OCRRecord
  -> 前端轮询或订阅状态
```

Redis 的定位是：

```text
短期状态
队列
限流
缓存
调度
```

不是：

```text
长期业务事实
复习记录权威来源
用户错题主数据
图片文件本体
```

这个边界如果守住，后续加异步能力会比较自然。如果一开始就让 Redis 和 PostgreSQL 共同承担权威数据，系统复杂度会快速上升。

## 把这些工具放到同一条链路里

以“用户上传图片识题并保存为错题，再加入复习计划”为例，这些工具可以串起来看：

```text
图片上传
  -> MinIO 保存图片
  -> 返回 imageUrl

OCR 识别
  -> AI 返回 display Markdown + structured JSON
  -> Zod 校验 structured output
  -> OCRRecord 写 PostgreSQL

保存错题
  -> TanStack mutation 调用 /wrong-questions
  -> 成功后 invalidate wrongQuestions query
  -> 失败时进入 Dexie mutationQueue

加入复习
  -> mutation 调用 /reviews/cards
  -> PostgreSQL 写 Card

今日复习
  -> TanStack Query 请求 /review-tasks/today
  -> 用户评分触发 mutation
  -> 服务端事务更新 Card + ReviewLog + ReviewTask
  -> 失败时 ReviewTask rating 进入 Dexie mutationQueue

后续异步扩展
  -> Redis + BullMQ 处理 OCR / Embedding / PDF / Reminder
```

从这个链路能看出来，每个工具都在自己的位置上：

- MinIO 管文件。
- Zod 管数据结构是否可信。
- TanStack Query 管前端 API 数据。
- mutation 管写操作生命周期。
- Dexie 管浏览器本地兜底和离线补偿。
- PostgreSQL 管权威业务事实。
- Redis 为后续异步和调度做准备。

## 一个判断原则：谁是权威来源

做这类项目时，我觉得最重要的问题不是“用什么库”，而是每一份数据都要回答：

```text
谁是它的权威来源？
```

比如：

```text
错题正文
  -> PostgreSQL

错题图片文件
  -> MinIO

错题列表的前端缓存
  -> TanStack Query

离线待同步错题操作
  -> Dexie mutationQueue

ReviewTask 是否完成
  -> PostgreSQL

ReviewTask 离线评分意图
  -> Dexie mutationQueue

FSRS 下一次复习时间
  -> 服务端事务计算后写 PostgreSQL

学习统计
  -> 服务端基于 ReviewLog 聚合
```

Phase 4.4 最关键的取舍也是这个问题：离线评分时，Dexie 只记录“评分意图”，不成为 FSRS 和统计的权威来源。

这就是为什么离线评分不会本地推进 Card、ReviewLog 和统计。因为一旦本地也开始推进，就会出现两个权威来源：浏览器和服务端。短期看页面更“爽”，长期看数据会更难维护。

## 小结

这几个工具在 PrepMind AI 里的作用可以压缩成一句话：

```text
MinIO 存文件，
TanStack Query 管服务端数据缓存，
mutation 管写操作生命周期，
Zod 守住运行时数据边界，
Redis 为异步队列和调度做准备。
```

真正重要的不是把这些技术名词堆进简历或 README，而是知道它们分别解决什么问题，以及什么时候不该用它们。

一个 AI 应用越往后做，越不能只依赖“模型能回答”。项目需要可靠的数据边界、稳定的失败补偿、清晰的权威来源和可演进的异步能力。PrepMind AI 现在还在继续推进，但从图片存储、结构化 OCR、错题 CRUD、ReviewTask、离线评分队列这些阶段看下来，整个项目的数据边界已经逐渐清晰起来。

这也是今天讨论这些工具最大的收获：工具本身不难，难的是把它放在正确的位置。
