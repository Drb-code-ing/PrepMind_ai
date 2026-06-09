# Phase 2 Backend Foundation And Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 backend foundation with Bun workspace scripts, NestJS core infrastructure, Prisma auth schema, and a working register/login/refresh/logout flow.

**Architecture:** Bun is the package manager and workspace command entrypoint, while NestJS continues to run on Node.js. The backend uses a small core layer for config, request IDs, errors, response envelopes, and Prisma access, then adds Auth and Users modules on top. Refresh tokens are opaque random values stored in httpOnly cookies and saved in PostgreSQL only as hashes.

**Tech Stack:** Bun, NestJS 11, Prisma, PostgreSQL, Zod, JWT, argon2, Jest, Supertest.

---

## Scope

This plan implements the first Phase 2 slice only:

- Bun workspace migration.
- Backend core foundation.
- Prisma schema changes for users, refresh tokens, conversations, OCR records, and self-contained wrong questions.
- Auth API with refresh token rotation.
- Users current-profile API.

This plan does not migrate the frontend, wrong-question CRUD UI, chat history, OCR history, or AI SSE routes. Those should be handled by follow-up plans after this backend auth slice is verified.

## File Map

Create:

- `packages/types/src/api/common.ts`: shared response envelope and error schemas.
- `packages/types/src/api/auth.ts`: auth request and response schemas.
- `apps/server/src/config/env.ts`: typed environment parsing.
- `apps/server/src/config/config.module.ts`: Nest config provider module.
- `apps/server/src/common/errors/app-error.ts`: typed business error class.
- `apps/server/src/common/interceptors/response-envelope.interceptor.ts`: wraps successful responses.
- `apps/server/src/common/filters/http-exception.filter.ts`: normalizes errors.
- `apps/server/src/common/middleware/request-id.middleware.ts`: attaches request IDs.
- `apps/server/src/common/decorators/current-user.decorator.ts`: reads authenticated user from request.
- `apps/server/src/database/database.module.ts`: exports Prisma service.
- `apps/server/src/database/prisma.service.ts`: Prisma lifecycle integration.
- `apps/server/src/health/health.controller.ts`: health endpoint.
- `apps/server/src/health/health.module.ts`: health module.
- `apps/server/src/auth/auth.controller.ts`: auth endpoints.
- `apps/server/src/auth/auth.module.ts`: auth module wiring.
- `apps/server/src/auth/auth.service.ts`: register/login/refresh/logout logic.
- `apps/server/src/auth/jwt-auth.guard.ts`: access-token guard.
- `apps/server/src/auth/password.service.ts`: password hashing and verification.
- `apps/server/src/auth/token.service.ts`: JWT and refresh token utilities.
- `apps/server/src/users/users.controller.ts`: current-user endpoints.
- `apps/server/src/users/users.module.ts`: users module wiring.
- `apps/server/src/users/users.service.ts`: current-user reads and updates.
- `apps/server/src/auth/auth.service.spec.ts`: auth unit tests.
- `apps/server/test/auth.e2e-spec.ts`: auth HTTP smoke tests.

Modify:

- `package.json`: replace pnpm root scripts with Bun workspace scripts.
- `apps/web/package.json`: remove nested `packageManager` override.
- `apps/server/package.json`: add backend dependencies and scripts used by this plan.
- `packages/database/package.json`: align Prisma scripts with Bun.
- `packages/types/src/index.ts`: export shared API schemas.
- `packages/database/prisma/schema.prisma`: add Phase 2 auth and app models.
- `apps/server/src/main.ts`: install global middleware, filters, interceptors, validation, and CORS.
- `apps/server/src/app.module.ts`: replace default starter module wiring.
- `apps/server/src/app.controller.ts`: remove starter controller or stop importing it.
- `apps/server/src/app.service.ts`: remove starter service or stop importing it.
- `apps/server/test/jest-e2e.json`: keep e2e config compatible with new modules.

Delete after replacement:

- `package-lock.json`: legacy npm lockfile.
- `pnpm-lock.yaml`: legacy pnpm lockfile.
- `pnpm-workspace.yaml`: legacy pnpm workspace config once Bun workspace install passes.

Keep untouched:

- `apps/web/src/lib/user-scope.test.mts`: this file has a pre-existing user change and is unrelated to this plan.

---

### Task 1: Migrate Workspace Scripts To Bun

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `packages/database/package.json`
- Delete: `package-lock.json`
- Delete: `pnpm-lock.yaml`
- Delete: `pnpm-workspace.yaml`

- [ ] **Step 1: Confirm Bun is available**

Run:

```powershell
bun --version
```

Expected: prints a Bun version and exits with code 0.

- [ ] **Step 2: Replace root scripts**

Modify `package.json` to this script section:

```json
{
  "scripts": {
    "dev": "bun --filter @repo/web dev",
    "dev:server": "bun --filter @repo/server start:dev",
    "dev:all": "bun --filter '*' --parallel dev",
    "build": "bun --filter @repo/web build && bun --filter @repo/server build",
    "lint": "bun --filter '*' lint",
    "test": "bun --filter '*' test",
    "db:migrate": "bun --filter @repo/database prisma:migrate",
    "db:studio": "bun --filter @repo/database prisma:studio",
    "db:generate": "bun --filter @repo/database prisma:generate",
    "docker:up": "docker compose -f docker/docker-compose.dev.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.dev.yml down"
  },
  "packageManager": "bun@1.2.0"
}
```

Keep the existing root `"name"`, `"private"`, and `"workspaces"` fields.

- [ ] **Step 3: Remove nested package-manager override**

In `apps/web/package.json`, remove this field:

```json
"packageManager": "npm@10.0.0"
```

- [ ] **Step 4: Align database scripts**

In `packages/database/package.json`, keep the existing script names and add a test placeholder that exits successfully because the package has no tests yet:

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "tsc --noEmit"
  }
}
```

- [ ] **Step 5: Install with Bun**

Run:

```powershell
bun install
```

Expected:

- `bun.lock` exists.
- Dependencies install successfully.
- No pnpm store permission error appears.

- [ ] **Step 6: Remove legacy package-manager files**

After `bun install` succeeds, delete:

```text
package-lock.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

Use PowerShell native deletion:

```powershell
Remove-Item -LiteralPath package-lock.json
Remove-Item -LiteralPath pnpm-lock.yaml
Remove-Item -LiteralPath pnpm-workspace.yaml
```

- [ ] **Step 7: Verify workspace scripts resolve**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/server test
```

Expected:

- Web lint exits with code 0.
- Server starter tests exit with code 0 before later tasks replace them.

- [ ] **Step 8: Commit**

Run:

```powershell
git add package.json apps/web/package.json packages/database/package.json bun.lock package-lock.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "chore: migrate workspace scripts to Bun"
```

---

### Task 2: Add Shared API Schemas

**Files:**
- Create: `packages/types/src/api/common.ts`
- Create: `packages/types/src/api/auth.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add common response schemas**

Create `packages/types/src/api/common.ts`:

```ts
import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const apiSuccessSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
    requestId: z.string().min(1),
  });

export const apiFailureSchema = z.object({
  success: z.literal(false),
  error: apiErrorSchema,
  requestId: z.string().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiFailure = z.infer<typeof apiFailureSchema>;
export type ApiSuccess<T> = {
  success: true;
  data: T;
  requestId: string;
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

- [ ] **Step 2: Add auth schemas**

Create `packages/types/src/api/auth.ts`:

```ts
import { z } from 'zod';

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(3).nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['STUDENT', 'ADMIN']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(50).optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const authResponseSchema = z.object({
  user: authUserSchema,
  accessToken: z.string().min(1),
});

export const updateMeRequestSchema = z.object({
  name: z.string().min(1).max(50).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;
```

- [ ] **Step 3: Export schemas**

Modify `packages/types/src/index.ts`:

```ts
// @repo/types - shared TypeScript types and Zod schemas
export * from './user';
export * from './question';
export * from './review';
export * from './rag';
export * from './api/common';
export * from './api/auth';
```

- [ ] **Step 4: Typecheck shared types**

Run:

```powershell
bun --filter @repo/types typecheck
```

Expected: exits with code 0.

- [ ] **Step 5: Commit**

Run:

```powershell
git add packages/types/src/api/common.ts packages/types/src/api/auth.ts packages/types/src/index.ts
git commit -m "feat: add shared auth API schemas"
```

---

### Task 3: Add Server Dependencies

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add runtime dependencies**

Run:

```powershell
bun add --filter @repo/server @nestjs/config @nestjs/jwt cookie-parser argon2 zod @repo/database @repo/types
```

Expected: `apps/server/package.json` includes:

```json
{
  "dependencies": {
    "@nestjs/config": "^4.0.0",
    "@nestjs/jwt": "^11.0.0",
    "@repo/database": "*",
    "@repo/types": "*",
    "argon2": "^0.44.0",
    "cookie-parser": "^1.4.7",
    "zod": "^3.23.0"
  }
}
```

The exact installed versions may be newer. Keep the versions selected by Bun.

- [ ] **Step 2: Add cookie-parser types**

Run:

```powershell
bun add --filter @repo/server -d @types/cookie-parser
```

Expected: `apps/server/package.json` includes `@types/cookie-parser` in `devDependencies`.

- [ ] **Step 3: Verify dependency graph**

Run:

```powershell
bun --filter @repo/server build
```

Expected: build still passes before code changes.

- [ ] **Step 4: Commit**

Run:

```powershell
git add apps/server/package.json bun.lock
git commit -m "chore: add server auth dependencies"
```

---

### Task 4: Update Prisma Schema For Phase 2

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Replace auth-related user fields**

Modify `model User` so it includes `phone`, `passwordHash`, `refreshTokens`,
`conversations`, and `ocrRecords`:

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  phone         String?   @unique
  passwordHash  String
  name          String?
  avatarUrl     String?
  role          Role      @default(STUDENT)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts       Account[]
  sessions       Session[]
  refreshTokens  RefreshToken[]
  questions      Question[]
  wrongQuestions WrongQuestion[]
  cards          Card[]
  documents      Document[]
  conversations  Conversation[]
  chatMessages   ChatMessage[]
  ocrRecords     OcrRecord[]
}
```

- [ ] **Step 2: Add RefreshToken model**

Add this model after `Session`:

```prisma
model RefreshToken {
  id          String    @id @default(cuid())
  userId      String
  tokenHash   String    @unique
  familyId    String
  expiresAt   DateTime
  revokedAt   DateTime?
  lastUsedAt  DateTime?
  userAgent   String?
  ipAddress   String?
  createdAt   DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@index([familyId])
}
```

- [ ] **Step 3: Add enums**

Add these enums near the existing `Role` enum:

```prisma
enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum OcrStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}

enum WrongQuestionSource {
  OCR
  MANUAL
  CHAT
}

enum WrongQuestionStatus {
  UNRESOLVED
  RESOLVED
}
```

- [ ] **Step 4: Replace WrongQuestion model**

Replace the current `WrongQuestion` model with:

```prisma
model WrongQuestion {
  id              String              @id @default(cuid())
  userId          String
  source          WrongQuestionSource @default(OCR)
  sourceRecordId  String?
  sourceGroupId   String?
  imageUrl         String?
  questionText     String              @db.Text
  subject          String
  category         String
  knowledgePoints  String[]
  analysis         String              @db.Text
  answer           String              @db.Text
  errorType        String?
  userNote         String?             @db.Text
  rawContent       String?             @db.Text
  status           WrongQuestionStatus @default(UNRESOLVED)
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, sourceGroupId])
  @@index([userId, createdAt])
  @@index([userId, status])
  @@index([userId, subject])
}
```

- [ ] **Step 5: Replace ChatMessage model and add Conversation**

Replace the current `ChatMessage` model with:

```prisma
model Conversation {
  id        String   @id @default(cuid())
  userId    String
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages ChatMessage[]

  @@index([userId, updatedAt])
}

model ChatMessage {
  id             String      @id @default(cuid())
  userId         String
  conversationId String
  role           MessageRole
  content        String      @db.Text
  order          Int
  metadata       Json?
  createdAt      DateTime    @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@unique([conversationId, order])
  @@index([userId, conversationId])
  @@index([userId, createdAt])
}
```

- [ ] **Step 6: Add OcrRecord model**

Add this model after `ChatMessage`:

```prisma
model OcrRecord {
  id         String    @id @default(cuid())
  userId     String
  groupId    String
  imageUrl   String?
  rawText    String    @db.Text
  parsedJson Json?
  status     OcrStatus @default(DONE)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, groupId])
  @@index([userId, createdAt])
}
```

- [ ] **Step 7: Format and generate Prisma client**

Run:

```powershell
bun --filter @repo/database prisma format
bun --filter @repo/database prisma:generate
```

Expected:

- Prisma schema formats successfully.
- Prisma Client generation exits with code 0.

- [ ] **Step 8: Create migration**

Start Postgres:

```powershell
docker compose -f docker/docker-compose.dev.yml up -d postgres
```

Run:

```powershell
bun --filter @repo/database prisma:migrate --name phase_2_auth_foundation
```

Expected:

- A migration directory is created under `packages/database/prisma/migrations/`.
- Prisma reports that the database is in sync.

- [ ] **Step 9: Commit**

Run:

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations packages/database/src/index.ts
git commit -m "feat: add Phase 2 Prisma auth schema"
```

---

### Task 5: Build Server Core Foundation

**Files:**
- Create: `apps/server/src/config/env.ts`
- Create: `apps/server/src/config/config.module.ts`
- Create: `apps/server/src/common/errors/app-error.ts`
- Create: `apps/server/src/common/interceptors/response-envelope.interceptor.ts`
- Create: `apps/server/src/common/filters/http-exception.filter.ts`
- Create: `apps/server/src/common/middleware/request-id.middleware.ts`
- Create: `apps/server/src/database/database.module.ts`
- Create: `apps/server/src/database/prisma.service.ts`
- Create: `apps/server/src/health/health.controller.ts`
- Create: `apps/server/src/health/health.module.ts`
- Modify: `apps/server/src/main.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Add environment parser**

Create `apps/server/src/config/env.ts`:

```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  REFRESH_COOKIE_NAME: z.string().default('prepmind_refresh'),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function parseEnv(config: Record<string, unknown>): ServerEnv {
  return envSchema.parse(config);
}
```

- [ ] **Step 2: Add config module**

Create `apps/server/src/config/config.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { parseEnv } from './env';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: parseEnv,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
```

- [ ] **Step 3: Add app error**

Create `apps/server/src/common/errors/app-error.ts`:

```ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}
```

- [ ] **Step 4: Add response envelope interceptor**

Create `apps/server/src/common/interceptors/response-envelope.interceptor.ts`:

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

type RequestWithId = {
  requestId?: string;
};

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        requestId: request.requestId ?? 'unknown',
      })),
    );
  }
}
```

- [ ] **Step 5: Add exception filter**

Create `apps/server/src/common/filters/http-exception.filter.ts`:

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

import { AppError } from '../errors/app-error';

type RequestWithId = {
  requestId?: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = request.requestId ?? 'unknown';

    const normalized = this.normalize(exception);

    response.status(normalized.statusCode).json({
      success: false,
      error: {
        code: normalized.code,
        message: normalized.message,
      },
      requestId,
    });
  }

  private normalize(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
  } {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      return {
        statusCode: exception.getStatus(),
        code: 'HTTP_EXCEPTION',
        message: exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'DATABASE_UNIQUE_CONSTRAINT',
          message: '数据已存在',
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误',
    };
  }
}
```

- [ ] **Step 6: Add request ID middleware**

Create `apps/server/src/common/middleware/request-id.middleware.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & {
  requestId?: string;
};

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const requestId = req.header('x-request-id') ?? `req_${randomUUID()}`;
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
```

- [ ] **Step 7: Add Prisma service**

Create `apps/server/src/database/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@repo/database';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 8: Add database module**

Create `apps/server/src/database/database.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

- [ ] **Step 9: Add health endpoint**

Create `apps/server/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: 'ok'; service: 'prepmind-server' } {
    return {
      status: 'ok',
      service: 'prepmind-server',
    };
  }
}
```

Create `apps/server/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 10: Wire app module**

Modify `apps/server/src/app.module.ts`:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 11: Wire main bootstrap**

Modify `apps/server/src/main.ts`:

```ts
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { AppModule } from './app.module';
import type { ServerEnv } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<ServerEnv, true>);

  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  await app.listen(config.get('PORT', { infer: true }));
}

bootstrap();
```

- [ ] **Step 12: Build server**

Run:

```powershell
bun --filter @repo/server build
```

Expected: build exits with code 0.

- [ ] **Step 13: Run server health smoke**

Run server:

```powershell
bun --filter @repo/server start:dev
```

In another terminal:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/health
```

Expected response shape:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "prepmind-server"
  },
  "requestId": "req_..."
}
```

- [ ] **Step 14: Commit**

Run:

```powershell
git add apps/server/src
git commit -m "feat: add NestJS backend foundation"
```

---

### Task 6: Implement Auth Services And Guards

**Files:**
- Create: `apps/server/src/auth/password.service.ts`
- Create: `apps/server/src/auth/token.service.ts`
- Create: `apps/server/src/auth/auth.service.ts`
- Create: `apps/server/src/auth/jwt-auth.guard.ts`
- Create: `apps/server/src/common/decorators/current-user.decorator.ts`
- Create: `apps/server/src/auth/auth.module.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Add current user decorator**

Create `apps/server/src/common/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: 'STUDENT' | 'ADMIN';
};

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new Error('CurrentUser decorator used without authenticated request');
    }

    return request.user;
  },
);
```

- [ ] **Step 2: Add password service**

Create `apps/server/src/auth/password.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
```

- [ ] **Step 3: Add token service**

Create `apps/server/src/auth/token.service.ts`:

```ts
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { ServerEnv } from '../config/env';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: 'STUDENT' | 'ADMIN';
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET', { infer: true }),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', { infer: true }),
    });
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: this.configService.get('JWT_SECRET', { infer: true }),
    });
  }

  createRefreshToken(): { token: string; tokenHash: string; familyId: string } {
    const token = randomBytes(48).toString('base64url');

    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      familyId: randomUUID(),
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getRefreshExpiresAt(now = new Date()): Date {
    const days = this.configService.get('REFRESH_TOKEN_DAYS', { infer: true });
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
```

- [ ] **Step 4: Add JWT guard**

Create `apps/server/src/auth/jwt-auth.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TokenService } from './token.service';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = await this.tokenService.verifyAccessToken(token);

    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return true;
  }
}
```

- [ ] **Step 5: Add auth service**

Create `apps/server/src/auth/auth.service.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { LoginRequest, RegisterRequest } from '@repo/types';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  async register(input: RegisterRequest, response: Response, meta: RequestMeta) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new AppError('AUTH_EMAIL_EXISTS', '该邮箱已注册', HttpStatus.CONFLICT);
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name ?? null,
      },
    });

    return this.issueSession(user, response, meta);
  }

  async login(input: LoginRequest, response: Response, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new AppError(
        'AUTH_INVALID_CREDENTIALS',
        '邮箱或密码错误',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordOk = await this.passwordService.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordOk) {
      throw new AppError(
        'AUTH_INVALID_CREDENTIALS',
        '邮箱或密码错误',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.issueSession(user, response, meta);
  }

  async refresh(refreshToken: string | undefined, response: Response, meta: RequestMeta) {
    if (!refreshToken) {
      throw new AppError('AUTH_REFRESH_MISSING', '登录状态已失效', HttpStatus.UNAUTHORIZED);
    }

    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !tokenRecord ||
      tokenRecord.revokedAt ||
      tokenRecord.expiresAt.getTime() <= Date.now()
    ) {
      throw new AppError('AUTH_REFRESH_INVALID', '登录状态已失效', HttpStatus.UNAUTHORIZED);
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    return this.issueSession(tokenRecord.user, response, {
      ...meta,
      familyId: tokenRecord.familyId,
    });
  }

  async logout(refreshToken: string | undefined, response: Response): Promise<{ ok: true }> {
    if (refreshToken) {
      const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
    }

    response.clearCookie(this.getRefreshCookieName(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction(),
      path: '/',
    });

    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return this.toAuthUser(user);
  }

  private async issueSession(
    user: AuthUserRecord,
    response: Response,
    meta: RequestMeta,
  ) {
    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refresh = this.tokenService.createRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.tokenHash,
        familyId: meta.familyId ?? refresh.familyId,
        expiresAt: this.tokenService.getRefreshExpiresAt(),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    response.cookie(this.getRefreshCookieName(), refresh.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction(),
      path: '/',
      expires: this.tokenService.getRefreshExpiresAt(),
    });

    return {
      user: this.toAuthUser(user),
      accessToken,
    };
  }

  private toAuthUser(user: AuthUserRecord) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private getRefreshCookieName(): string {
    return this.configService.get('REFRESH_COOKIE_NAME', { infer: true });
  }

  private isProduction(): boolean {
    return this.configService.get('NODE_ENV', { infer: true }) === 'production';
  }
}

type AuthUserRecord = {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: 'STUDENT' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
};

export type RequestMeta = {
  userAgent?: string;
  ipAddress?: string;
  familyId?: string;
};
```

- [ ] **Step 6: Add auth module**

Create `apps/server/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthService, PasswordService, TokenService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, TokenService],
})
export class AuthModule {}
```

- [ ] **Step 7: Import AuthModule**

Modify `apps/server/src/app.module.ts`:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, AuthModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 8: Build server**

Run:

```powershell
bun --filter @repo/server build
```

Expected: build exits with code 0.

- [ ] **Step 9: Commit**

Run:

```powershell
git add apps/server/src/auth apps/server/src/common/decorators apps/server/src/app.module.ts
git commit -m "feat: add auth services and JWT guard"
```

---

### Task 7: Add Auth Controller And Users Module

**Files:**
- Create: `apps/server/src/auth/auth.controller.ts`
- Create: `apps/server/src/users/users.controller.ts`
- Create: `apps/server/src/users/users.module.ts`
- Create: `apps/server/src/users/users.service.ts`
- Modify: `apps/server/src/auth/auth.module.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Add auth controller**

Create `apps/server/src/auth/auth.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { loginRequestSchema, registerRequestSchema } from '@repo/types';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() request: Request,
  ) {
    const input = registerRequestSchema.parse(body);

    return this.authService.register(input, response, {
      userAgent,
      ipAddress: request.ip,
    });
  }

  @Post('login')
  login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() request: Request,
  ) {
    const input = loginRequestSchema.parse(body);

    return this.authService.login(input, response, {
      userAgent,
      ipAddress: request.ip,
    });
  }

  @Post('refresh')
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.authService.refresh(request.cookies?.prepmind_refresh, response, {
      userAgent,
      ipAddress: request.ip,
    });
  }

  @Post('logout')
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(request.cookies?.prepmind_refresh, response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}
```

- [ ] **Step 2: Register auth controller**

Modify `apps/server/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, TokenService],
})
export class AuthModule {}
```

- [ ] **Step 3: Add users service**

Create `apps/server/src/users/users.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { UpdateMeRequest } from '@repo/types';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateMe(userId: string, input: UpdateMeRequest) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl,
      },
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
```

- [ ] **Step 4: Add users controller**

Create `apps/server/src/users/users.controller.ts`:

```ts
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { updateMeRequestSchema } from '@repo/types';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = updateMeRequestSchema.parse(body);
    return this.usersService.updateMe(user.id, input);
  }
}
```

- [ ] **Step 5: Add users module**

Create `apps/server/src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 6: Import users module**

Modify `apps/server/src/app.module.ts`:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, AuthModule, UsersModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 7: Build server**

Run:

```powershell
bun --filter @repo/server build
```

Expected: build exits with code 0.

- [ ] **Step 8: Commit**

Run:

```powershell
git add apps/server/src/auth/auth.controller.ts apps/server/src/auth/auth.module.ts apps/server/src/users apps/server/src/app.module.ts
git commit -m "feat: add auth and user HTTP endpoints"
```

---

### Task 8: Add Auth Tests

**Files:**
- Create: `apps/server/src/auth/auth.service.spec.ts`
- Create: `apps/server/test/auth.e2e-spec.ts`

- [ ] **Step 1: Add auth service unit test**

Create `apps/server/src/auth/auth.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Response } from 'express';

import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

describe('AuthService', () => {
  const response = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  const user = {
    id: 'user_1',
    email: 'student@example.com',
    phone: null,
    passwordHash: 'hash',
    name: 'Student',
    avatarUrl: null,
    role: 'STUDENT' as const,
    createdAt: new Date('2026-06-09T00:00:00.000Z'),
    updatedAt: new Date('2026-06-09T00:00:00.000Z'),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function createService() {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string | number> = {
                JWT_SECRET: 'test-secret-that-is-long-enough',
                JWT_ACCESS_EXPIRES_IN: '15m',
                REFRESH_TOKEN_DAYS: 30,
                REFRESH_COOKIE_NAME: 'prepmind_refresh',
                NODE_ENV: 'test',
              };
              return values[key];
            }),
          },
        },
      ],
    }).compile();

    return moduleRef.get(AuthService);
  }

  it('registers a new user and writes refresh cookie', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});

    const service = await createService();
    const result = await service.register(
      {
        email: 'student@example.com',
        password: 'password123',
        name: 'Student',
      },
      response,
      { userAgent: 'jest', ipAddress: '127.0.0.1' },
    );

    expect(result.user.email).toBe('student@example.com');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(response.cookie).toHaveBeenCalledWith(
      'prepmind_refresh',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects duplicate registration', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const service = await createService();

    await expect(
      service.register(
        {
          email: 'student@example.com',
          password: 'password123',
          name: 'Student',
        },
        response,
        {},
      ),
    ).rejects.toMatchObject({ code: 'AUTH_EMAIL_EXISTS' });
  });

  it('revokes refresh token on logout', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const service = await createService();
    await service.logout('refresh-token', response);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      'prepmind_refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
```

- [ ] **Step 2: Run auth unit test**

Run:

```powershell
bun --filter @repo/server test -- auth.service.spec.ts
```

Expected: test exits with code 0.

- [ ] **Step 3: Add auth e2e test**

Create `apps/server/test/auth.e2e-spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, reads me, refreshes, and logs out', async () => {
    const email = `student-${Date.now()}@example.com`;

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        name: 'Student',
      })
      .expect(201);

    expect(registerResponse.body.success).toBe(true);
    expect(registerResponse.body.data.accessToken).toEqual(expect.any(String));
    const cookie = registerResponse.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const accessToken = registerResponse.body.data.accessToken;

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.email).toBe(email);
      });

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(201);

    expect(refreshResponse.body.data.accessToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshResponse.headers['set-cookie'])
      .expect(201)
      .expect((res) => {
        expect(res.body.data.ok).toBe(true);
      });
  });
});
```

- [ ] **Step 4: Run e2e test**

Ensure Postgres is running and migrations have been applied:

```powershell
docker compose -f docker/docker-compose.dev.yml up -d postgres
bun --filter @repo/database prisma:migrate
```

Run:

```powershell
bun --filter @repo/server test:e2e -- auth.e2e-spec.ts
```

Expected: e2e test exits with code 0.

- [ ] **Step 5: Run final backend checks**

Run:

```powershell
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
```

Expected: all commands exit with code 0.

- [ ] **Step 6: Commit**

Run:

```powershell
git add apps/server/src/auth/auth.service.spec.ts apps/server/test/auth.e2e-spec.ts
git commit -m "test: cover Phase 2 auth flow"
```

---

### Task 9: Update Phase 2 Docs After Implementation

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `DEVLOG.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Update project command docs**

In `AGENTS.md` and `CLAUDE.md`, replace npm/pnpm primary command guidance with Bun commands:

```text
bun install
bun --filter @repo/web dev
bun --filter @repo/server start:dev
bun --filter @repo/web lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/database prisma:migrate
bun --filter @repo/database prisma:generate
```

- [ ] **Step 2: Update data-flow docs**

In `docs/data-flow.md`, add a Phase 2 section with this backend auth flow:

```text
register/login
  -> NestJS Auth API
  -> PostgreSQL User + RefreshToken
  -> accessToken returned to frontend memory
  -> refreshToken stored in httpOnly cookie

app startup
  -> POST /auth/refresh
  -> valid cookie returns new accessToken and user
  -> invalid cookie means logged out
```

- [ ] **Step 3: Update roadmap**

In `docs/roadmap.md`, mark Phase 2 first slice as in progress:

```text
Phase 2 - 后端工程化
- [x] Bun workspace 迁移
- [x] NestJS 工程底座
- [x] Prisma Phase 2 auth schema
- [x] Auth API with refresh token rotation
- [ ] WrongQuestions API
- [ ] ChatMessages API
- [ ] OcrRecords API
- [ ] Frontend apiClient + TanStack Query
```

- [ ] **Step 4: Update DEVLOG**

Append one concise same-day entry to `DEVLOG.md` under 2026-06-09:

```md
### Phase 2 后端工程化第一阶段

- 统一 Bun workspace 作为包管理和脚本入口。
- 建立 NestJS 后端工程底座：配置、请求 ID、统一响应、统一错误、健康检查。
- 调整 Prisma schema：User 认证字段、RefreshToken、Conversation、OcrRecord、自包含 WrongQuestion。
- 完成 Auth API：注册、登录、刷新、退出、当前用户。
- 增加 Auth 单元测试和 e2e smoke test。
```

Keep all remaining planning items at the bottom of `DEVLOG.md`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add AGENTS.md CLAUDE.md DEVLOG.md docs/data-flow.md docs/roadmap.md
git commit -m "docs: update Phase 2 backend foundation notes"
```

---

## Final Verification

Run these commands before claiming the implementation is complete:

```powershell
bun --filter @repo/types typecheck
bun --filter @repo/database typecheck
bun --filter @repo/database prisma:generate
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
```

Expected:

- Every command exits with code 0.
- `GET /health` returns a response envelope.
- `POST /auth/register` creates a user and sets the refresh cookie.
- `POST /auth/login` returns an access token and sets the refresh cookie.
- `POST /auth/refresh` rotates refresh tokens.
- `POST /auth/logout` revokes the refresh token and clears the cookie.
- `GET /auth/me` and `GET /users/me` require a valid access token.

## Self-Review Notes

- Spec coverage: This plan covers Bun migration, NestJS foundation, shared Zod schemas, Prisma auth models, refresh token rotation, auth endpoints, user profile endpoints, tests, and documentation updates.
- Deliberate deferral: WrongQuestion API, frontend `apiClient`, TanStack Query restoration, chat APIs, OCR APIs, and AI SSE migration are outside this first implementation slice.
- Risk to watch during execution: Bun command syntax and Prisma migration behavior on Windows should be verified before deleting legacy lockfiles.
