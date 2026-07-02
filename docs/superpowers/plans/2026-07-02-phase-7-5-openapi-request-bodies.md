# Phase 7.5 OpenAPI Request Bodies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Swagger UI easier to read in Chinese and add request body examples for the highest-value debug endpoints.

**Architecture:** Keep `@repo/types` Zod schemas as the runtime contract. Add NestJS Swagger decorators only as documentation metadata, with safe examples and no sensitive raw payloads.

**Tech Stack:** NestJS 11, `@nestjs/swagger`, Jest, Bun workspace.

---

### Task 1: OpenAPI request body regression tests

**Files:**
- Modify: `apps/server/src/config/swagger.spec.ts`

- [ ] **Step 1: Write the failing test**

Add a test that generates OpenAPI JSON from `coreApiControllers` and asserts:

```ts
const jsonBodyOperations = [
  ['post', '/auth/register'],
  ['post', '/auth/login'],
  ['post', '/knowledge/documents/{id}/process'],
  ['post', '/knowledge/search'],
  ['post', '/review-tasks/{taskId}/rating'],
  ['post', '/agent-traces'],
] as const;

const multipartBodyOperations = [
  ['post', '/knowledge/documents'],
  ['put', '/knowledge/documents/{id}/file'],
] as const;

for (const [method, path] of jsonBodyOperations) {
  const operation = getSwaggerOperation(document, path, method);
  expect(operation?.requestBody).toBeDefined();
  expect(JSON.stringify(operation?.requestBody)).toContain('application/json');
  expect(JSON.stringify(operation?.requestBody)).toContain('example');
}

for (const [method, path] of multipartBodyOperations) {
  const operation = getSwaggerOperation(document, path, method);
  const requestBodyText = JSON.stringify(operation?.requestBody);
  expect(requestBodyText).toContain('multipart/form-data');
  expect(requestBodyText).toContain('file');
}
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `bun --filter @repo/server test -- swagger`

Expected: FAIL because the listed operations do not yet expose request body metadata.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/config/swagger.spec.ts
git commit -m "test(server): require openapi request bodies"
```

### Task 2: Add safe request body metadata and Chinese descriptions

**Files:**
- Modify: `apps/server/src/auth/auth.controller.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-documents.controller.ts`
- Modify: `apps/server/src/knowledge-documents/knowledge-search.controller.ts`
- Modify: `apps/server/src/review-tasks/review-tasks.controller.ts`
- Modify: `apps/server/src/agent-traces/agent-traces.controller.ts`

- [ ] **Step 1: Add minimal Swagger imports**

Add `ApiBody` and `ApiConsumes` only where needed.

- [ ] **Step 2: Add JSON examples**

Use safe values such as `student@example.com`, `password123`, `数学函数极限复习`, `client-rating-001`, `chat`, and `mock` route metadata. Do not include raw prompt, full answer, full chunk, API key, cookie, or bearer token examples.

- [ ] **Step 3: Add multipart examples**

For upload and replacement, document `multipart/form-data` with a binary `file` field.

- [ ] **Step 4: Chineseize high-value operation text**

Use Chinese for human-readable `summary`, `description`, and response descriptions while keeping field names and paths unchanged.

- [ ] **Step 5: Run focused test**

Run: `bun --filter @repo/server test -- swagger`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/config/swagger.spec.ts apps/server/src/auth/auth.controller.ts apps/server/src/knowledge-documents/knowledge-documents.controller.ts apps/server/src/knowledge-documents/knowledge-search.controller.ts apps/server/src/review-tasks/review-tasks.controller.ts apps/server/src/agent-traces/agent-traces.controller.ts
git commit -m "docs(server): add openapi request body examples"
```

### Task 3: Update project docs

**Files:**
- Modify: `DEVLOG.md`
- Modify: `docs/dev-start.md`
- Modify: `docs/blogs/phase-7-openapi-docs.md`

- [ ] **Step 1: Document Phase 7.5**

Explain that `/api-docs` now has Chinese descriptions and safe request body examples for the first set of high-value endpoints.

- [ ] **Step 2: Keep the boundary explicit**

State that Swagger remains a debug/documentation layer and `@repo/types` remains the contract source of truth.

- [ ] **Step 3: Run doc/code checks**

Run:

```bash
bun --filter @repo/server test -- swagger
bun --filter @repo/server build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add DEVLOG.md docs/dev-start.md docs/blogs/phase-7-openapi-docs.md
git commit -m "docs: document phase 7 openapi request bodies"
```
