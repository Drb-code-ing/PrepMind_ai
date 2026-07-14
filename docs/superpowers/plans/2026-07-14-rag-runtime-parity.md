# RAG Runtime Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bun, Docker API, and Docker worker use the same explicit Qwen embedding contract, fail closed before the first request when configuration is invalid, and prove real queue processing plus both branches of hybrid retrieval.

**Architecture:** Keep provider selection inside `EmbeddingService`, but move provider-specific credential and URL requirements into startup validation. Docker API and worker receive the same narrow RAG allowlist; no service loads the whole root `.env`, and no runtime fallback changes provider. Extend the existing RAG smoke to verify queue/background-job execution and the keyword/vector evidence already returned in hit metadata.

**Tech Stack:** Bun workspace, NestJS 11, Zod, OpenAI-compatible SDK, Docker Compose, PostgreSQL/pgvector, BullMQ/Redis, Jest, TypeScript.

---

## File map

- `apps/server/src/config/env.ts`: provider-aware startup contract and production explicitness checks.
- `apps/server/src/config/env.spec.ts`: positive and negative startup configuration cases.
- `apps/server/src/knowledge-documents/embedding.service.ts`: canonical timeout use and stable provider selection.
- `apps/server/src/knowledge-documents/embedding.service.spec.ts`: OpenAI/Qwen client construction and no-fallback tests.
- `docker/docker-compose.dev.yml`: identical RAG allowlist for API and worker.
- `docker/.env.example`: non-secret Qwen/queue configuration template.
- `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts`: static guard against API/worker drift and full env-file loading.
- `apps/server/scripts/rag-eval-smoke.ts`: queue/background-job and hybrid evidence assertions.
- `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.ts`: smoke evidence policy as pure functions.
- `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.spec.ts`: deterministic smoke policy tests.
- `AGENTS.md`, `README.md`, `docs/dev-start.md`, `docs/acceptance-checklist.md`, `docs/data-flow.md`, `docs/roadmap.md`: current Qwen runtime contract and operating instructions.
- `docs/acceptance/2026-07-14-rag-runtime-parity.md`: branch and main verification evidence without credentials or user content.

### Task 1: Add provider-aware startup validation

**Files:**
- Modify: `apps/server/src/config/env.spec.ts`
- Modify: `apps/server/src/config/env.ts`

- [ ] **Step 1: Write failing production and Qwen configuration tests**

Add cases that distinguish a legacy implicit development default from an explicitly selected provider:

```ts
const productionQwenEnv = {
  ...requiredEnv,
  NODE_ENV: 'production',
  RAG_EMBEDDING_PROVIDER: 'qwen',
  RAG_EMBEDDING_MODEL: 'text-embedding-v4',
  RAG_EMBEDDING_BASE_URL:
    'https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
  QWEN_API_KEY: 'test-qwen-key',
};

it('requires an explicit production embedding provider and model', () => {
  expect(() => parseEnv({ ...requiredEnv, NODE_ENV: 'production' })).toThrow(
    'production RAG embedding provider must be explicit',
  );
  expect(() =>
    parseEnv({
      ...productionQwenEnv,
      RAG_EMBEDDING_MODEL: undefined,
    }),
  ).toThrow('production RAG embedding model must be explicit');
});

it.each([
  ['key', { QWEN_API_KEY: undefined }],
  ['base URL', { RAG_EMBEDDING_BASE_URL: undefined }],
  ['HTTPS base URL', { RAG_EMBEDDING_BASE_URL: 'http://example.com/v1' }],
])('rejects qwen without a safe %s', (_name, override) => {
  expect(() => parseEnv({ ...productionQwenEnv, ...override })).toThrow();
});

it('keeps qwen selected when an OpenAI key is also present', () => {
  expect(
    parseEnv({
      ...productionQwenEnv,
      OPENAI_API_KEY: 'unused-openai-key',
    }).RAG_EMBEDDING_PROVIDER,
  ).toBe('qwen');
});

it('requires an OpenAI key when OpenAI is explicitly selected', () => {
  expect(() =>
    parseEnv({
      ...requiredEnv,
      RAG_EMBEDDING_PROVIDER: 'openai',
      RAG_EMBEDDING_MODEL: 'text-embedding-3-small',
    }),
  ).toThrow('OpenAI embedding provider requires OPENAI_API_KEY');
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```powershell
bun --filter @repo/server test -- --runInBand config/env.spec.ts
```

Expected: new tests fail because `parseEnv()` still accepts implicit production defaults and does not validate Qwen/OpenAI startup credentials.

- [ ] **Step 3: Implement raw-config explicitness and provider validation**

Call an assertion after Zod parsing and before returning the normalized environment:

```ts
export function parseEnv(config: Record<string, unknown>): ServerEnv {
  const env = envSchema.parse(config);
  assertEmbeddingRuntimeConfig(config, env);

  return {
    ...env,
    // existing normalized feature gates remain unchanged
  };
}

function assertEmbeddingRuntimeConfig(
  raw: Record<string, unknown>,
  env: ParsedServerEnv,
) {
  const explicitProvider = readExplicitString(raw.RAG_EMBEDDING_PROVIDER);
  const explicitModel = readExplicitString(raw.RAG_EMBEDDING_MODEL);

  if (env.NODE_ENV === 'production' && !explicitProvider) {
    throw new Error('production RAG embedding provider must be explicit');
  }
  if (env.NODE_ENV === 'production' && !explicitModel) {
    throw new Error('production RAG embedding model must be explicit');
  }

  if (explicitProvider === 'qwen') {
    const qwenKey = env.QWEN_API_KEY ?? env.Qwen_API_KEY ?? env.DASHSCOPE_API_KEY;
    if (!qwenKey) {
      throw new Error('Qwen embedding provider requires QWEN_API_KEY');
    }
    if (!env.RAG_EMBEDDING_BASE_URL || !isSafeHttpsProviderUrl(env.RAG_EMBEDDING_BASE_URL)) {
      throw new Error('Qwen embedding provider requires a credential-free HTTPS base URL');
    }
  }

  if (explicitProvider === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error('OpenAI embedding provider requires OPENAI_API_KEY');
  }
}

function readExplicitString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}
```

Keep the existing production `fake` prohibition. Host aliases remain accepted for backward-compatible local loading, but documentation and Docker normalize the in-container name to `QWEN_API_KEY`.

- [ ] **Step 4: Run tests and type/build checks**

Run:

```powershell
bun --filter @repo/server test -- --runInBand config/env.spec.ts
bun --filter @repo/server build
```

Expected: focused suite passes and Nest build exits 0.

- [ ] **Step 5: Commit the startup contract**

```powershell
git add -- apps/server/src/config/env.ts apps/server/src/config/env.spec.ts
git commit -m "fix(rag): fail closed on invalid embedding config"
```

### Task 2: Enforce embedding request timeout without provider fallback

**Files:**
- Modify: `apps/server/src/knowledge-documents/embedding.service.spec.ts`
- Modify: `apps/server/src/knowledge-documents/embedding.service.ts`

- [ ] **Step 1: Write failing OpenAI and Qwen client timeout tests**

Extend the test config pick with `QWEN_API_KEY`, `DASHSCOPE_API_KEY`, and `EMBEDDING_REQUEST_TIMEOUT_MS`, then assert both client constructors receive the timeout:

```ts
EMBEDDING_REQUEST_TIMEOUT_MS: 12_345,
QWEN_API_KEY: undefined,
DASHSCOPE_API_KEY: undefined,
```

```ts
expect(mockOpenAI).toHaveBeenCalledWith({
  apiKey: 'test-openai-key',
  timeout: 12_345,
});

expect(mockOpenAI).toHaveBeenCalledWith({
  apiKey: 'test-qwen-key',
  baseURL:
    'https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
  timeout: 12_345,
});
```

Also add a no-fallback assertion: configure provider `qwen`, omit every Qwen key, provide an OpenAI key, call `embedChunks(['query'])`, and expect `KNOWLEDGE_EMBEDDING_FAILED` while `mockOpenAI` remains uncalled.

- [ ] **Step 2: Run the focused test and confirm failure**

```powershell
bun --filter @repo/server test -- --runInBand knowledge-documents/embedding.service.spec.ts
```

Expected: constructor assertions fail because timeout is not yet supplied.

- [ ] **Step 3: Pass the configured timeout to both OpenAI-compatible clients**

Add one helper and use it in both constructors:

```ts
private getRequestTimeoutMs() {
  return this.configService.get('EMBEDDING_REQUEST_TIMEOUT_MS', {
    infer: true,
  });
}
```

```ts
const client = new OpenAI({
  apiKey: apiKey.trim(),
  timeout: this.getRequestTimeoutMs(),
});
```

```ts
const client = new OpenAI({
  apiKey,
  baseURL: baseURL.trim(),
  timeout: this.getRequestTimeoutMs(),
});
```

Do not add catch-and-switch logic. `createProvider()` continues to select exactly one provider from `RAG_EMBEDDING_PROVIDER`.

- [ ] **Step 4: Run focused and neighboring search tests**

```powershell
bun --filter @repo/server test -- --runInBand knowledge-documents/embedding.service.spec.ts knowledge-documents/knowledge-search.service.spec.ts knowledge-documents/hybrid-search.spec.ts
```

Expected: all suites pass.

- [ ] **Step 5: Commit timeout enforcement**

```powershell
git add -- apps/server/src/knowledge-documents/embedding.service.ts apps/server/src/knowledge-documents/embedding.service.spec.ts
git commit -m "fix(rag): bound embedding provider requests"
```

### Task 3: Keep Docker API and worker on one RAG allowlist

**Files:**
- Modify: `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts`
- Modify: `docker/docker-compose.dev.yml`
- Modify: `docker/.env.example`

- [ ] **Step 1: Write a failing Compose parity test**

Add a test that checks both service sections for the same entries and prevents full env loading:

```ts
it('keeps Docker API and worker on the same explicit Qwen RAG contract', () => {
  const compose = readRepoFile('docker/docker-compose.dev.yml');
  const server = extractYamlSection(compose, '  server:', 2);
  const worker = extractYamlSection(compose, '  worker:', 2);
  const entries = [
    'RAG_EMBEDDING_PROVIDER: ${RAG_EMBEDDING_PROVIDER:-qwen}',
    'RAG_EMBEDDING_MODEL: ${RAG_EMBEDDING_MODEL:-text-embedding-v4}',
    'RAG_EMBEDDING_BASE_URL: ${RAG_EMBEDDING_BASE_URL:-}',
    'RAG_EMBEDDING_DIMENSIONS: ${RAG_EMBEDDING_DIMENSIONS:-1536}',
    'RAG_EMBEDDING_BATCH_SIZE: ${RAG_EMBEDDING_BATCH_SIZE:-32}',
    'QWEN_API_KEY: ${QWEN_API_KEY:-${Qwen_API_KEY:-${DASHSCOPE_API_KEY:-}}}',
    'RAG_CHUNK_TARGET_TOKENS: ${RAG_CHUNK_TARGET_TOKENS:-650}',
    'RAG_CHUNK_OVERLAP_TOKENS: ${RAG_CHUNK_OVERLAP_TOKENS:-80}',
    'RAG_CHUNK_MAX_TOKENS: ${RAG_CHUNK_MAX_TOKENS:-900}',
    'RAG_MAX_CHUNKS_PER_DOCUMENT: ${RAG_MAX_CHUNKS_PER_DOCUMENT:-500}',
    'EMBEDDING_REQUEST_TIMEOUT_MS: ${EMBEDDING_REQUEST_TIMEOUT_MS:-30000}',
  ];

  for (const entry of entries) {
    expect(server).toContain(entry);
    expect(worker).toContain(entry);
  }
  expect(server).not.toContain('env_file:');
  expect(worker).not.toContain('env_file:');
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

```powershell
bun --filter @repo/server test -- --runInBand worker-readiness/docker-compose-readiness.spec.ts
```

Expected: the new parity test fails because the RAG entries are missing.

- [ ] **Step 3: Add the shared allowlist to server and worker**

Add the exact entries from the test to both `environment:` maps. Keep `NODE_ENV=production` on server and add it to worker so both roles run identical production validation. Do not add `env_file` to either service and do not remove any volume.

- [ ] **Step 4: Expand the non-secret Docker template**

Add this section to `docker/.env.example` with dummy values only:

```dotenv
# RAG embedding (server and worker)
RAG_EMBEDDING_PROVIDER=qwen
RAG_EMBEDDING_MODEL=text-embedding-v4
RAG_EMBEDDING_BASE_URL=https://your-workspace.example.com/compatible-mode/v1
RAG_EMBEDDING_DIMENSIONS=1536
RAG_EMBEDDING_BATCH_SIZE=32
QWEN_API_KEY=replace-with-local-secret
EMBEDDING_REQUEST_TIMEOUT_MS=30000
RAG_CHUNK_TARGET_TOKENS=650
RAG_CHUNK_OVERLAP_TOKENS=80
RAG_CHUNK_MAX_TOKENS=900
RAG_MAX_CHUNKS_PER_DOCUMENT=500
KNOWLEDGE_PROCESSING_MODE=queue
```

- [ ] **Step 5: Verify static Compose safety**

```powershell
bun --filter @repo/server test -- --runInBand worker-readiness/docker-compose-readiness.spec.ts
docker compose -f docker/docker-compose.dev.yml config --quiet
git diff --check
```

Expected: Jest passes, Compose exits 0 without printing resolved secrets, and diff check is clean.

- [ ] **Step 6: Commit Docker parity**

```powershell
git add -- docker/docker-compose.dev.yml docker/.env.example apps/server/src/worker-readiness/docker-compose-readiness.spec.ts
git commit -m "fix(rag): align Docker embedding runtime"
```

### Task 4: Strengthen the RAG smoke for queue and hybrid evidence

**Files:**
- Modify: `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.spec.ts`
- Modify: `apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.ts`
- Modify: `apps/server/scripts/rag-eval-smoke.ts`

- [ ] **Step 1: Write failing pure-policy tests for hybrid evidence**

Add a typed metadata reader and test all three guarantees. Uniqueness is checked inside each query result, because the same relevant chunk may legitimately appear in different queries:

```ts
expect(
  assertRagEvalSmokeEvidence({
    exactKeywordHits: [hit('chunk_1', 0.72, 0.8)],
    semanticHits: [hit('chunk_2', 0.91, 0)],
    crossLanguageHits: [hit('chunk_3', 0.88, 0)],
  }),
).toEqual({ mode: 'hybrid', checkedHitCount: 3 });

expect(() =>
  assertRagEvalSmokeEvidence({
    exactKeywordHits: [hit('chunk_1', 0.72, 0)],
    semanticHits: [hit('chunk_2', 0.91, 0)],
    crossLanguageHits: [hit('chunk_3', 0.88, 0)],
  }),
).toThrow('exact keyword smoke case requires keywordScore > 0');
```

The `hit()` fixture must create `metadata.retrieval = { mode: 'hybrid', vectorScore, keywordScore }`. Add separate cases for a missing positive vector score and duplicate chunk IDs inside one query result.

- [ ] **Step 2: Run the smoke-config test and confirm failure**

```powershell
bun --filter @repo/server test -- --runInBand knowledge-documents/evals/rag-eval-smoke-config.spec.ts
```

Expected: import or assertion failure because `assertRagEvalSmokeEvidence()` does not exist.

- [ ] **Step 3: Implement a strict metadata-only smoke assertion**

Export a function with this interface:

```ts
type SmokeEvidenceInput = {
  exactKeywordHits: RagEvalHit[];
  semanticHits: RagEvalHit[];
  crossLanguageHits: RagEvalHit[];
};

export function assertRagEvalSmokeEvidence(input: SmokeEvidenceInput) {
  const allHits = [
    ...input.exactKeywordHits,
    ...input.semanticHits,
    ...input.crossLanguageHits,
  ];
  const retrieval = allHits.map(readHybridRetrieval);
  if (!retrieval.some((item, index) =>
    index < input.exactKeywordHits.length && item.keywordScore > 0,
  )) throw new Error('exact keyword smoke case requires keywordScore > 0');
  for (const hits of [input.semanticHits, input.crossLanguageHits]) {
    if (!hits.some((hit) => readHybridRetrieval(hit).vectorScore > 0)) {
      throw new Error('semantic smoke cases require vectorScore > 0');
    }
  }
  for (const hits of [
    input.exactKeywordHits,
    input.semanticHits,
    input.crossLanguageHits,
  ]) {
    const ids = hits.map((hit) => hit.chunkId);
    if (new Set(ids).size !== ids.length) {
      throw new Error('RAG smoke returned duplicate chunkId values');
    }
  }
  return { mode: 'hybrid' as const, checkedHitCount: allHits.length };
}
```

`readHybridRetrieval()` must reject missing/non-object metadata, a mode other than `hybrid`, and non-finite scores. It must not inspect or print hit content.

- [ ] **Step 4: Make the API smoke prove queue execution**

Change `processDocument()` to return `KnowledgeDocumentProcessResponse`. Require `processing?.mode === 'queue'`, capture `backgroundJobId`, and poll `/background-jobs/:id` until `SUCCEEDED`; fail immediately for `FAILED` or `STALE_SKIPPED`.

```ts
const processResult = await processDocument(baseUrl, accessToken, documentId);
if (processResult.processing?.mode !== 'queue') {
  throw new Error('RAG eval smoke requires queue processing mode.');
}
const backgroundJobId = processResult.processing.backgroundJobId;
// waitForDocumentDone(...), then waitForBackgroundJobSucceeded(...)
```

After gathering hits, call:

```ts
assertRagEvalSmokeEvidence({
  exactKeywordHits: hitsByCaseId['exact-blue-lantern'] ?? [],
  semanticHits: hitsByCaseId['semantic-review-pressure'] ?? [],
  crossLanguageHits: hitsByCaseId['cross-language-weak-points'] ?? [],
});
```

Keep the current document cleanup in `finally`; never print the access token or hit content.

- [ ] **Step 5: Run smoke policy tests, full server tests, and build**

```powershell
bun --filter @repo/server test -- --runInBand knowledge-documents/evals/rag-eval-smoke-config.spec.ts knowledge-documents/evals/rag-eval-runner.spec.ts knowledge-documents/evals/rag-eval-report.spec.ts
bun --filter @repo/server test
bun --filter @repo/server build
```

Expected: all tests pass and build exits 0.

- [ ] **Step 6: Commit smoke hardening**

```powershell
git add -- apps/server/scripts/rag-eval-smoke.ts apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.ts apps/server/src/knowledge-documents/evals/rag-eval-smoke-config.spec.ts
git commit -m "test(rag): verify queue hybrid runtime"
```

### Task 5: Synchronize operational documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/dev-start.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Replace obsolete runtime claims**

Make these facts consistent in every listed document:

```text
Current real RAG embedding: Qwen text-embedding-v4, 1536 dimensions.
Retrieval: pgvector cosine candidates + PostgreSQL full-text keyword candidates, deduplicated by chunkId and hybrid-ranked.
Production: provider and model must be explicit; qwen requires a credential-free HTTPS base URL and QWEN_API_KEY; no provider fallback.
Local deterministic tests: RAG_EMBEDDING_PROVIDER=fake remains allowed only outside production.
```

Replace `bge-m3`, “default OpenAI”, and the three-name Qwen key recommendation. Explain that host aliases are compatibility inputs only and Docker normalizes them to `QWEN_API_KEY`.

- [ ] **Step 2: Add safe Docker/Bun startup instructions**

Document this sequence without commands that print resolved secrets:

```powershell
$env:KNOWLEDGE_PROCESSING_MODE='queue'
docker compose -f docker/docker-compose.dev.yml config --quiet
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker
bun --filter @repo/server smoke:rag-eval
```

Explicitly state that normal verification must not use `docker compose down -v`, volume deletion, database reset, or Redis/MinIO clearing.

- [ ] **Step 3: Review documentation consistency**

```powershell
rg -n "bge-m3|默认 OpenAI|default OpenAI|Qwen_API_KEY.*DASHSCOPE_API_KEY" AGENTS.md README.md docs/dev-start.md docs/acceptance-checklist.md docs/data-flow.md docs/roadmap.md
git diff --check
```

Expected: no obsolete current-state claim remains; historical plan/acceptance evidence is not rewritten.

- [ ] **Step 4: Commit documentation synchronization**

```powershell
git add -- AGENTS.md README.md docs/dev-start.md docs/acceptance-checklist.md docs/data-flow.md docs/roadmap.md
git commit -m "docs(rag): document explicit Qwen runtime"
```

### Task 6: Run branch acceptance and record evidence

**Files:**
- Create: `docs/acceptance/2026-07-14-rag-runtime-parity.md`

- [ ] **Step 1: Run branch static verification**

```powershell
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --cwd packages/types typecheck
docker compose -f docker/docker-compose.dev.yml config --quiet
git diff --check
```

Expected: all commands exit 0. Record only command, exit status, and suite counts.

- [ ] **Step 2: Start the real queue stack without deleting existing data**

```powershell
$env:KNOWLEDGE_PROCESSING_MODE='queue'
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker
docker compose -f docker/docker-compose.dev.yml ps server worker
```

Expected: server is running and worker becomes healthy. Do not run `down -v`, prune, volume removal, or database reset.

- [ ] **Step 3: Verify only non-secret container parity**

```powershell
docker compose -f docker/docker-compose.dev.yml exec -T server sh -lc 'printf "%s|%s|%s\n" "$RAG_EMBEDDING_PROVIDER" "$RAG_EMBEDDING_MODEL" "$RAG_EMBEDDING_DIMENSIONS"'
docker compose -f docker/docker-compose.dev.yml exec -T worker sh -lc 'printf "%s|%s|%s\n" "$RAG_EMBEDDING_PROVIDER" "$RAG_EMBEDDING_MODEL" "$RAG_EMBEDDING_DIMENSIONS"'
```

Expected: both print `qwen|text-embedding-v4|1536`. Do not inspect or print base URL/key.

- [ ] **Step 4: Run the real Qwen queue and hybrid smoke**

```powershell
bun --filter @repo/server smoke:rag-eval
```

Expected: document reaches `DONE`, background job reaches `SUCCEEDED`, exact keyword evidence has positive `keywordScore`, semantic evidence has positive `vectorScore`, mode is `hybrid`, no duplicate chunk IDs, and the temporary document is deleted.

- [ ] **Step 5: Run zero-provider-call negative startup checks**

Run isolated `docker compose run --rm --no-deps` checks with qwen key, qwen base URL, and explicit provider removed one at a time. Assert each exits non-zero with only the field-level safe validation message. Do not print environment variables or resolved Compose output. Restore the normal environment after each command and confirm the running server/worker remain unchanged.

- [ ] **Step 6: Clean only the synthetic smoke account**

Identify the exact `rag-eval-smoke-<timestamp>@example.com` created by this run, verify the prefix and one-row count, then delete that user through a scoped Prisma/PostgreSQL transaction so cascades remove its background job. Do not use wildcard deletion, truncate, schema reset, Redis flush, MinIO wipe, or volume removal.

- [ ] **Step 7: Write and commit the acceptance record**

The record must contain branch SHA, command exits, test counts, safe provider/model/dimensions, queue/background-job result, hybrid evidence booleans, negative startup outcomes, exact cleanup scope, and remaining limitations. It must not contain keys, base URLs, tokens, document content, raw provider responses, or full container environments.

```powershell
git add -- docs/acceptance/2026-07-14-rag-runtime-parity.md
git commit -m "docs(rag): record runtime parity acceptance"
```

### Task 7: Review, merge, main re-verification, and push

**Files:**
- Modify if required by review only: files already listed above

- [ ] **Step 1: Review the completed branch**

Use the repository code-review workflow. Confirm no provider fallback, secret output, full `env_file`, destructive Docker command, unrelated refactor, or uncommitted change exists. If review requires a fix, write a failing regression test, make the minimal correction, rerun affected verification, and commit the fix separately.

- [ ] **Step 2: Re-run final branch gates**

```powershell
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --cwd packages/types typecheck
docker compose -f docker/docker-compose.dev.yml config --quiet
git status --short
```

Expected: gates pass and working tree is clean.

- [ ] **Step 3: Merge only from updated main**

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff codex/rag-runtime-parity -m "merge: RAG runtime parity"
```

Expected: merge succeeds without starting a new branch from the feature branch.

- [ ] **Step 4: Re-run main verification**

Repeat Task 7 Step 2 on `main`, then run the real smoke once more against the unchanged Docker stack. Record the main SHA and main results in the acceptance document; if that changes the document, commit the evidence update on `main` before pushing.

- [ ] **Step 5: Push and verify remote SHA**

```powershell
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: local and remote main SHAs match. Leave Docker volumes and user services intact.
