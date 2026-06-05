# PrepMind AI — 完整架构设计文档

> 基于 Phase 0 输出标准 · 可直接用于开发落地

---

## 1. 系统总体架构

### 1.1 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                              │
│  Web (Next.js 15)  │  PWA  │  浏览器 DevTools                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        接入层                                │
│  Next.js App Router (API Routes)  │  WebSocket (SSE)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        应用层 (NestJS)                       │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ Auth │ │ Chat │ │Question│ │Review│ │  RAG │ │ Agent│  │
│  │Module│ │Module│ │ Module │ │Module│ │Module│ │System│  │
│  └──────┘ └──────┘ └────────┘ └──────┘ └──────┘ └──────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        领域层 (Packages)                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ AI   │ │ FSRS │ │ RAG  │ │Agent │ │ MCP  │ │Shared│   │
│  │ Core │ │ Core │ │ Core │ │Graph │ │Tools │ │Types │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        基础设施层                            │
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐      │
│  │PostgreSQL│ │Redis │ │BullMQ│ │MinIO │ │pgvector│ ...  │
│  └──────────┘ └──────┘ └──────┘ └──────┘ └────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 关键数据流

| 场景 | 数据流路径 |
|------|-----------|
| 用户提问 | Web → Chat API → Agent System (LangGraph) → LLM → SSE 返回 |
| 拍照识题 | Web → Question OCR API → BullMQ (OCR Worker) → 结果回调 |
| 复习推荐 | Web → Review API → FSRS Core → 计算今日卡片 → 返回 |
| 知识库检索 | Web → RAG Search → Embedding → pgvector → Rerank → LLM 生成 |

---

## 2. Monorepo 结构与模块职责

### 2.1 完整目录树

```
prepmind/
├── apps/
│   ├── web/                         # Next.js 前端应用
│   │   ├── app/                     # App Router 页面
│   │   │   ├── (auth)/              # 登录/注册
│   │   │   ├── (dashboard)/         # 主面板（聊天/错题本/复习）
│   │   │   ├── api/                 # Next.js API 路由（代理到 NestJS）
│   │   │   └── layout.tsx
│   │   ├── components/              # UI 组件
│   │   │   ├── chat/                # 聊天组件（流式渲染）
│   │   │   ├── ocr/                 # 图片上传 + 识题
│   │   │   ├── review/              # 复习卡片组件
│   │   │   └── rag/                 # 知识库管理
│   │   ├── lib/                     # 前端工具
│   │   │   ├── api-client.ts        # 后端调用封装
│   │   │   ├── store/               # Zustand stores
│   │   │   └── workers/             # Web Workers (OCR/FSRS)
│   │   └── public/
│   │
│   └── server/                      # NestJS 后端服务
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── common/               # 通用模块
│       │   │   ├── guards/           # JWT/RBAC
│       │   │   ├── interceptors/     # 日志/转换
│       │   │   ├── pipes/            # 验证
│       │   │   └── filters/          # 异常处理
│       │   ├── modules/
│       │   │   ├── auth/             # 认证模块
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   └── strategies/   # GitHub OAuth, JWT
│       │   │   ├── chat/             # 聊天模块
│       │   │   │   ├── chat.controller.ts  (SSE)
│       │   │   │   ├── chat.service.ts
│       │   │   │   └── dto/
│       │   │   ├── question/         # 题目管理
│       │   │   │   ├── question.controller.ts
│       │   │   │   ├── ocr.service.ts
│       │   │   │   └── wrong-question.service.ts
│       │   │   ├── review/           # 复习模块 (FSRS)
│       │   │   │   ├── review.controller.ts
│       │   │   │   ├── fsrs.service.ts
│       │   │   │   └── scheduler.service.ts
│       │   │   ├── rag/              # 知识库模块
│       │   │   │   ├── rag.controller.ts
│       │   │   │   ├── embedding.service.ts
│       │   │   │   ├── search.service.ts
│       │   │   │   └── workers/      # BullMQ consumers
│       │   │   └── agent/            # Agent 系统
│       │   │       ├── agent.controller.ts
│       │   │       ├── graph/        # LangGraph 定义
│       │   │       └── tools/        # 工具注册
│       │   └── config/               # 配置模块
│       └── test/
│
├── packages/
│   ├── database/                     # Prisma + 数据访问
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   └── repositories/         # 数据访问层
│   │   └── package.json
│   │
│   ├── ai/                           # AI 调用封装
│   │   ├── src/
│   │   │   ├── llm-factory.ts        # OpenAI/DeepSeek 统一接口
│   │   │   ├── streaming.ts
│   │   │   ├── structured-output.ts  # Zod -> JSON Schema
│   │   │   └── prompts/              # Prompt 模板
│   │   └── package.json
│   │
│   ├── fsrs/                         # FSRS 算法核心
│   │   ├── src/
│   │   │   ├── fsrs.ts               # 间隔重复计算
│   │   │   ├── scheduler.ts
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── rag/                          # RAG 核心
│   │   ├── src/
│   │   │   ├── chunker.ts            # 文档分块
│   │   │   ├── embedder.ts           # 向量化
│   │   │   ├── retriever.ts          # 混合检索
│   │   │   └── reranker.ts           # 重排序
│   │   └── package.json
│   │
│   ├── agent/                        # LangGraph Agent
│   │   ├── src/
│   │   │   ├── graph/                # 状态图定义
│   │   │   ├── nodes/                # Router, Tutor, Planner, Reviewer
│   │   │   ├── state.ts              # Agent 状态类型
│   │   │   └── memory/               # 长期记忆
│   │   └── package.json
│   │
│   ├── mcp/                          # MCP 工具协议
│   │   ├── src/
│   │   │   ├── registry.ts           # 工具注册中心
│   │   │   ├── tools/                # SearchTool, OCRTool, FSRSTool...
│   │   │   └── server.ts             # JSON-RPC 服务
│   │   └── package.json
│   │
│   ├── types/                        # 共享 TypeScript 类型 + Zod
│   │   ├── src/
│   │   │   ├── user.ts
│   │   │   ├── question.ts
│   │   │   ├── review.ts
│   │   │   ├── rag.ts
│   │   │   └── api/                  # 请求/响应 DTO schemas
│   │   └── package.json
│   │
│   └── ui/                           # 共享 React 组件
│       ├── src/
│       │   ├── button.tsx
│       │   ├── card.tsx
│       │   ├── markdown.tsx
│       │   └── streaming-text.tsx
│       └── package.json
│
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.server
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   └── .env.example
│
├── infra/                            # 基础设施即代码
│   ├── k6/                           # 压测脚本
│   ├── grafana/                      # 仪表盘配置
│   └── prometheus/                   # 监控规则
│
└── docs/                             # 设计文档
    ├── architecture/
    ├── database/
    ├── api/
    ├── agent/
    └── deployment/
```

### 2.2 模块依赖关系（严格）

```
web → server          (通过 HTTP 调用)
server → database, ai, fsrs, rag, agent, mcp, types
agent → ai, fsrs, rag, mcp, types
rag → database, ai, types
fsrs → database, types
ai → types
mcp → ai, fsrs, rag, types
```

**规则：**
- `packages/` 内模块**不可依赖** `apps/`
- 同层 `packages` 可按上图方向依赖（**无循环**）
- `types` 是所有模块的**基础依赖**

---

## 3. 数据库设计（Prisma Schema）

### 3.1 完整 Schema

```prisma
// packages/database/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 启用 pgvector 扩展
// 运行: CREATE EXTENSION IF NOT EXISTS vector;

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  avatarUrl     String?
  role          Role      @default(STUDENT)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // 关联
  accounts       Account[]
  sessions       Session[]
  questions      Question[]
  wrongQuestions WrongQuestion[]
  cards          Card[]
  documents      Document[]
  chatMessages   ChatMessage[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum Role { STUDENT  ADMIN }

// ---------- 题目与错题 ----------
model Question {
  id              String   @id @default(cuid())
  content         String   @db.Text
  imageUrl        String?
  answer          String?  @db.Text
  analysis        String?  @db.Text          // AI 生成的解析
  knowledgePoints String[]                    // 标签数组
  difficulty      Float?                      // 题目难度 (1-5)
  source          String?                     // 来源: upload/ocr/import
  createdAt       DateTime @default(now())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  wrongQuestions  WrongQuestion[]
  cards           Card[]
}

model WrongQuestion {
  id            String   @id @default(cuid())
  questionId    String
  userAnswer    String   @db.Text
  correctAnswer String   @db.Text
  errorReason   String?  @db.Text
  correctedAt   DateTime?
  createdAt     DateTime @default(now())
  userId        String
  question      Question @relation(fields: [questionId], references: [id])
  user          User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([createdAt])
}

// ---------- FSRS 记忆系统 ----------
model Card {
  id              String    @id @default(cuid())
  userId          String
  questionId      String    @unique            // 一题一张卡
  difficulty      Float     @default(5.0)      // 难度 [1,10]
  stability       Float     @default(0.0)      // 稳定性（天数）
  retrievability  Float     @default(1.0)      // 可提取度 [0,1]
  lastReview      DateTime  @default(now())
  nextReview      DateTime  @default(now())    // 下次复习时间
  reviewCount     Int       @default(0)
  lapses          Int       @default(0)        // 忘记次数
  state           CardState @default(NEW)      // NEW/LEARNING/REVIEW/RELEARNING
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  user            User      @relation(fields: [userId], references: [id])
  question        Question  @relation(fields: [questionId], references: [id])
  logs            ReviewLog[]

  @@index([userId, nextReview])   // 查询今日待复习
  @@index([userId, state])
}

enum CardState { NEW  LEARNING  REVIEW  RELEARNING }

model ReviewLog {
  id              String   @id @default(cuid())
  cardId          String
  rating          Int       // 1=Again, 2=Hard, 3=Good, 4=Easy
  scheduledDays   Int       // 本次调度间隔天数
  stabilityBefore Float
  stabilityAfter  Float
  difficultyBefore Float
  difficultyAfter  Float
  reviewedAt      DateTime @default(now())
  card            Card     @relation(fields: [cardId], references: [id])

  @@index([cardId])
  @@index([reviewedAt])
}

// ---------- RAG 知识库 ----------
model Document {
  id         String         @id @default(cuid())
  name       String
  type       DocumentType
  size       Int
  mimeType   String
  storageKey String                              // MinIO 对象键
  status     ProcessStatus @default(PENDING)
  userId     String
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  user       User           @relation(fields: [userId], references: [id])
  chunks     Chunk[]
}

enum DocumentType { PDF  DOCX  MD  TXT }
enum ProcessStatus { PENDING  PROCESSING  DONE  FAILED }

model Chunk {
  id         String   @id @default(cuid())
  documentId String
  content    String   @db.Text
  embedding  Unsupported("vector")?   // pgvector: 1536维
  metadata   Json                     // 页码、标题等
  index      Int                      // 块序号
  userId     String                   // 冗余字段，便于RLS
  createdAt  DateTime @default(now())
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([userId])
  // 向量索引: CREATE INDEX ON chunk USING ivfflat (embedding vector_cosine_ops);
}

// ---------- 聊天历史 ----------
model ChatMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // user / assistant / system
  content        String   @db.Text
  toolCalls      Json?    // 记录调用的工具
  createdAt      DateTime @default(now())
  userId         String
  user           User     @relation(fields: [userId], references: [id])

  @@index([userId, conversationId])
  @@index([createdAt])
}
```

### 3.2 关键索引与优化

```sql
-- 1. 今日复习查询 (高频)
CREATE INDEX CONCURRENTLY idx_card_next_review
ON card(next_review) WHERE state != 'NEW';

-- 2. RAG 向量检索 (需安装 pgvector)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX idx_chunk_embedding ON chunk
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 3. 错题本排序
CREATE INDEX idx_wrong_question_user_date
ON wrong_question(user_id, created_at DESC);

-- 4. 聊天历史拉取
CREATE INDEX idx_chat_message_conversation
ON chat_message(conversation_id, created_at);
```

---

## 4. API 设计（OpenAPI 核心）

### 4.1 认证与安全

- 认证方式：JWT Bearer Token（放在 `Authorization` header）
- 刷新机制：`/api/auth/refresh` 返回新 token
- RBAC：基于 `User.role`，普通用户只能访问自己的数据

### 4.2 核心端点定义

```yaml
openapi: 3.0.0
info:
  title: PrepMind AI API
  version: 1.0.0
servers:
  - url: http://localhost:3001/api
    description: 开发环境
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
security:
  - bearerAuth: []

paths:
  # ========== 聊天 ==========
  /chat/stream:
    post:
      summary: 流式对话（SSE）
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                conversationId:
                  type: string
                context:
                  type: object
                  properties:
                    includeRAG:
                      type: boolean
                    includeFSRS:
                      type: boolean
      responses:
        200:
          description: SSE 事件流
          content:
            text/event-stream:
              schema:
                type: string
        401:
          description: 未授权

  # ========== 题目与 OCR ==========
  /question/ocr:
    post:
      summary: 上传图片，识别题目
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                image:
                  type: string
                  format: binary
      responses:
        200:
          description: 识别结果
          content:
            application/json:
              schema:
                type: object
                properties:
                  text:
                    type: string
                  knowledgePoints:
                    type: array
                    items:
                      type: string
                  suggestedAnswer:
                    type: string
        202:
          description: 异步处理中（返回 taskId）

  /question:
    post:
      summary: 创建题目（手动或OCR后）
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateQuestionDto'
      responses:
        201:
          description: 创建成功

  /question/wrong:
    get:
      summary: 获取错题本
      parameters:
        - name: page
          in: query
          schema:
            type: integer
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        200:
          description: 分页错题列表

  # ========== 复习 (FSRS) ==========
  /review/today:
    get:
      summary: 获取今日待复习卡片
      responses:
        200:
          description: 卡片列表

  /review/feedback:
    post:
      summary: 提交复习反馈
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                cardId:
                  type: string
                rating:
                  type: integer
                  enum: [1, 2, 3, 4]
      responses:
        200:
          description: 更新后的卡片信息

  # ========== RAG 知识库 ==========
  /rag/upload:
    post:
      summary: 上传文档（PDF/DOCX/MD）
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
      responses:
        202:
          description: 异步处理，返回 documentId

  /rag/search:
    post:
      summary: 语义搜索知识库
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  type: string
                topK:
                  type: integer
                  default: 5
      responses:
        200:
          description: 检索结果

components:
  schemas:
    CreateQuestionDto:
      type: object
      required:
        - content
      properties:
        content:
          type: string
        imageUrl:
          type: string
        answer:
          type: string
        knowledgePoints:
          type: array
          items:
            type: string
    Question:
      type: object
      properties:
        id:
          type: string
        content:
          type: string
        answer:
          type: string
        knowledgePoints:
          type: array
        createdAt:
          type: string
          format: date-time
    Card:
      type: object
      properties:
        id:
          type: string
        question:
          $ref: '#/components/schemas/Question'
        nextReview:
          type: string
          format: date-time
        difficulty:
          type: number
```

### 4.3 DTO 实现（Zod）

```typescript
// packages/types/src/api/review.ts
import { z } from 'zod';

export const ReviewFeedbackSchema = z.object({
  cardId: z.string().cuid(),
  rating: z.enum([1, 2, 3, 4])
});

export const TodayReviewResponseSchema = z.object({
  cards: z.array(z.object({
    id: z.string(),
    question: z.object({
      id: z.string(),
      content: z.string(),
      answer: z.string().optional()
    }),
    nextReview: z.date(),
    difficulty: z.number()
  })),
  total: z.number()
});
```

---

## 5. 模块间通信设计

### 5.1 同步调用

- **Web → Server**：HTTP + SSE（聊天流）
- **Server → Packages**：直接函数调用（NestJS 注入）

### 5.2 异步队列（BullMQ）

| 队列名称 | 消费者 | 触发事件 | 处理内容 |
|---------|--------|---------|---------|
| `ocr-queue` | OCR Worker | 图片上传 | 调用 OCR API，提取题目信息 |
| `embedding-queue` | Embedding Worker | 文档上传 / 分块完成 | 生成向量并存入 pgvector |
| `review-scheduler` | Scheduler Worker | 每日定时 / 反馈后 | 更新 FSRS 卡片下次复习时间 |

**示例：事件驱动流程**

```
用户上传 PDF → Document 记录创建 → 触发 'document.uploaded' 事件
→ BullMQ 发布任务到 embedding-queue
→ Worker 消费：分块 → 调用 embedding API → 写入 Chunk 表
→ 完成后触发 'document.processed' 事件 → 更新状态
```

### 5.3 事件总线设计（EventBus）

NestJS 内置 `EventEmitter` 作为事件总线，用于模块间解耦：

```typescript
// server/src/common/events/event-bus.ts
export enum SystemEvents {
  QUESTION_CREATED = 'question.created',
  CARD_DUE = 'card.due',
  REVIEW_SUBMITTED = 'review.submitted',
  DOCUMENT_PROCESSED = 'document.processed'
}

// 使用示例
eventEmitter.emit(SystemEvents.QUESTION_CREATED, { questionId, userId });
```

---

## 6. Agent 系统设计（LangGraph）

### 6.1 Agent 状态图

```
┌─────────────┐
│   START     │
└──────┬──────┘
       ▼
┌─────────────┐
│ RouterAgent │   (决定意图: 讲题/复习/计划/知识库)
└──────┬──────┘
       │
       ├──→ intent: tutor ──→ ┌────────────┐
       │                        │ TutorAgent │ (苏格拉底式讲题)
       │                        └─────┬──────┘
       │                              │
       ├──→ intent: review ─→ ┌─────────────┐
       │                        │ ReviewAgent │ (分析错因)
       │                        └─────┬───────┘
       │                              │
       ├──→ intent: plan ───→ ┌─────────────┐
       │                        │ PlannerAgent│ (生成学习计划)
       │                        └─────┬───────┘
       │                              │
       └──→ intent: search ─→ ┌──────────┐
                                │ RAGAgent  │ (知识库检索)
                                └─────┬────┘
                                      │
                                      ▼
                              ┌─────────────┐
                              │ MemoryAgent │ (更新长期记忆)
                              └─────┬───────┘
                                    │
                                    ▼
                               ┌────────┐
                               │  END   │
                               └────────┘
```

### 6.2 Agent 状态定义

```typescript
// packages/agent/src/state.ts
import { Annotation } from '@langchain/langgraph';

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  intent: Annotation<string>(),
  currentQuestion: Annotation<Question>(),
  retrievedDocs: Annotation<Chunk[]>(),
  reviewPlan: Annotation<ReviewPlan>(),
  memory: Annotation<Memory>(),
  next: Annotation<string>()  // 路由
});
```

### 6.3 节点实现示例（TutorAgent）

```typescript
// packages/agent/src/nodes/tutor.ts
export async function tutorNode(state: typeof AgentState.State) {
  const { currentQuestion, messages } = state;

  const prompt = `
    你是一位苏格拉底式导师。学生问了一道题：${currentQuestion.content}
    请通过引导性问题帮助学生自己发现答案，而不是直接给出解答。

    历史对话：${messages.slice(-3).map(m => m.content).join('\n')}
  `;

  const response = await llm.generate(prompt);

  return {
    messages: [new AIMessage(response)],
    next: 'memory'
  };
}
```

---

## 7. MCP 工具体系设计

### 7.1 工具清单

| 工具名 | 功能 | 输入参数 | 输出 |
|--------|------|---------|------|
| `search_knowledge` | 知识库检索 | `query`, `topK` | 相关文档片段 |
| `ocr_question` | 识别图片题目 | `imageBase64` | 文本 + 知识点 |
| `schedule_review` | FSRS 调度 | `cardId`, `rating` | 下次复习时间 |
| `create_plan` | 生成学习计划 | `goal`, `days` | 每日任务列表 |
| `save_memory` | 保存长期记忆 | `key`, `value` | 成功标识 |
| `get_wrong_questions` | 获取错题 | `limit` | 错题列表 |

### 7.2 工具注册与 JSON-RPC

```typescript
// packages/mcp/src/registry.ts
export const toolRegistry = {
  search_knowledge: {
    handler: async ({ query, topK }) => ragSearch(query, topK),
    schema: z.object({ query: z.string(), topK: z.number().default(5) })
  },
  ocr_question: {
    handler: async ({ imageBase64 }) => ocrService.recognize(imageBase64),
    schema: z.object({ imageBase64: z.string() })
  }
  // ...
};

// JSON-RPC 端点
// POST /mcp
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_knowledge",
    "arguments": { "query": "牛顿第二定律", "topK": 3 }
  },
  "id": 1
}
```

### 7.3 Agent 调用 MCP 示例

```typescript
// Agent 中调用工具
const result = await mcpClient.callTool('search_knowledge', { query: '微积分' });
```

---

## 8. 部署与可观测性设计

### 8.1 Docker Compose（开发版）

```yaml
# docker/docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: prepmind
      POSTGRES_USER: prepmind
      POSTGRES_PASSWORD: devpass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin

  server:
    build:
      context: ..
      dockerfile: docker/Dockerfile.server
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
      - minio
    environment:
      DATABASE_URL: postgresql://prepmind:devpass@postgres:5432/prepmind
      REDIS_URL: redis://redis:6379

  web:
    build:
      context: ..
      dockerfile: docker/Dockerfile.web
    ports:
      - "3000:3000"
    depends_on:
      - server

volumes:
  pgdata:
```

### 8.2 可观测性

| 组件 | 工具 | 收集内容 |
|------|------|---------|
| 日志 | Pino + Sentry | 结构化日志，错误捕获 |
| 链路追踪 | OpenTelemetry + Jaeger | LLM 调用链、数据库查询 |
| 指标 | Prometheus + Grafana | 请求 QPS、LLM 延迟、队列长度 |
| 健康检查 | `/health` 端点 | 数据库、Redis、AI API 状态 |

**关键 Metric 示例：**

```typescript
// 自定义 Prometheus metric
const llmRequestDuration = new Histogram({
  name: 'llm_request_duration_seconds',
  help: 'Duration of LLM requests',
  labelNames: ['model', 'success']
});
```

---

## 9. 开发流程与里程碑

### 9.1 Phase 0 第一周任务

| 天数 | 任务 |
|------|------|
| Day 1 | 初始化 Monorepo (`pnpm create next-app`, `nest new`) |
| Day 2 | 配置 Prisma + PostgreSQL，运行首次迁移 |
| Day 3 | 实现 JWT 认证模块（GitHub OAuth） |
| Day 4 | 搭建基础 API 网关（NestJS 控制器 + Swagger） |
| Day 5 | 编写共享类型包，前后端联调测试 |

### 9.2 代码质量门禁

- **Pre-commit hook**：ESLint + Prettier + TypeScript 类型检查
- **PR 合并前**：单元测试（Jest）覆盖率 > 70%
- **每日自动**：`pnpm audit` 检查依赖漏洞

---

## 10. 下一步行动

现在架构设计已完成，你可以直接：

1. **生成 Prisma Schema 文件** → 复制 3.1 节内容到 `packages/database/prisma/schema.prisma`

2. **运行初始化命令：**
   ```bash
   pnpm install
   cd packages/database && npx prisma migrate dev --name init
   ```

3. **启动基础设施：**
   ```bash
   docker-compose -f docker/docker-compose.dev.yml up -d
   ```

4. **开始 Phase 1（MVP 开发）**：按照 API 设计实现第一个聊天接口
