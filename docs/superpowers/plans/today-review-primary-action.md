# Today Review Primary Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Review/Planner primary action on `/today` move the user to the current day's review tasks instead of silently navigating to the same URL.

**Architecture:** `ReviewAgentSuggestionCard` receives an optional local primary-action callback. It may use that callback only when its normalized first-block target is `/today`; `/today` supplies it to scroll and focus with a stable section ref and first pending-task wrapper ref. Every non-`/today` target, including `/error-book` and `/plan`, and every caller without the callback retains the existing normalized Next `Link` behavior. No API, data model, task mutation, or model-gate behavior changes.

**State safety:** The empty-task notice is emitted only after a successful task query. Loading and errors retain their existing status views; offline or paused queries render a neutral unavailable state rather than the no-due-cards empty state. Both the review section fallback and the first pending-task wrapper—the two possible `scrollIntoView()` targets—carry scroll margin for the sticky header.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node built-in test runner, Bun.

---

## File map

- `apps/web/src/components/review-agent/review-agent-suggestion-card.tsx` — keeps cross-page suggestion navigation and adds the optional local-action rendering branch.
- `apps/web/src/app/(main)/today/page.tsx` — owns same-page scroll, focus, and empty-task feedback because it owns the review-task data and existing notice state.
- `apps/web/src/lib/review-agent-ui-integration.test.mts` — source-level regression contract matching the existing Web test style.
- `DEVLOG.md` — records the user-visible defect, bounded fix, verification evidence, and retained product behavior.

### Task 1: Prove and fix the suggestion-card local-action contract

**Files:**
- Modify: `apps/web/src/lib/review-agent-ui-integration.test.mts`
- Modify: `apps/web/src/components/review-agent/review-agent-suggestion-card.tsx`

- [ ] **Step 1: Write the failing source-contract test**

Add these assertions at the end of `testSuggestionCardExists`:

```ts
  assert.match(source, /onPrimaryAction\?: \(\) => void/);
  assert.match(source, /onPrimaryAction \? \([\s\S]*?<button[\s\S]*?onClick=\{onPrimaryAction\}[\s\S]*?: \([\s\S]*?<Link/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
bun --filter @repo/web test -- src/lib/review-agent-ui-integration.test.mts
```

Expected: the suggestion-card contract fails because `onPrimaryAction` does not exist; no production code has changed.

- [ ] **Step 3: Implement the minimal optional callback**

Extend the props and function parameters:

```tsx
type ReviewAgentSuggestionCardProps = {
  suggestion: ReviewAgentSuggestionResponse;
  compact?: boolean;
  onPrimaryAction?: () => void;
};

export function ReviewAgentSuggestionCard({
  suggestion,
  compact = false,
  onPrimaryAction,
}: ReviewAgentSuggestionCardProps) {
```

Replace the existing primary `Link` branch with a target-gated callback branch that retains the exact visual children and class string. `hasLocalPrimaryAction` is true only when the standardized `actionHref` is `/today` and the caller supplied a callback:

```tsx
{hasLocalPrimaryAction ? (
  <button
    type="button"
    onClick={onPrimaryAction}
    className="tap-target mt-3 inline-flex min-h-11 max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98]"
  >
    <Sparkles className="h-4 w-4" />
    <span className="break-words">{firstBlock.title}</span>
    <ChevronRight className="h-4 w-4" />
  </button>
) : (
  <Link
    href={actionHref}
    className="tap-target mt-3 inline-flex min-h-11 max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98]"
  >
    <Sparkles className="h-4 w-4" />
    <span className="break-words">{firstBlock.title}</span>
    <ChevronRight className="h-4 w-4" />
  </Link>
)}
```

- [ ] **Step 4: Run focused and full Web tests to verify GREEN**

Run:

```powershell
bun --filter @repo/web test -- src/lib/review-agent-ui-integration.test.mts
bun --filter @repo/web test
```

Expected: focused source contract and all Web tests pass.

- [ ] **Step 5: Commit the isolated component change**

```powershell
git add -- apps/web/src/components/review-agent/review-agent-suggestion-card.tsx apps/web/src/lib/review-agent-ui-integration.test.mts
git commit -m "fix(web): support local review suggestion actions"
```

### Task 2: Connect `/today` to review-task focus and empty feedback

**Files:**
- Modify: `apps/web/src/lib/review-agent-ui-integration.test.mts`
- Modify: `apps/web/src/app/(main)/today/page.tsx`

- [ ] **Step 1: Write the failing `/today` integration assertions**

Append these assertions to `testTodayPageUsesCompactReviewAgentSuggestion`:

```ts
  assert.match(source, /id="today-review"/);
  assert.match(source, /onPrimaryAction=\{focusTodayReview\}/);
  assert.match(source, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /今天暂时没有待复习任务，可先按今日清单学习。/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
bun --filter @repo/web test -- src/lib/review-agent-ui-integration.test.mts
```

Expected: `/today` fails for the absent id, callback, focus behavior, and empty-state notice.

- [ ] **Step 3: Add ref-owned local focus behavior**

Near the existing refs in `TodayPage`, add:

```tsx
  const todayReviewSectionRef = useRef<HTMLElement | null>(null);
  const firstPendingReviewTaskRef = useRef<HTMLDivElement | null>(null);
```

After `showNotice`, add this callback:

```tsx
  const focusTodayReview = useCallback(() => {
    const focusTarget = firstPendingReviewTaskRef.current ?? todayReviewSectionRef.current;

    if (!focusTarget) return;

    focusTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    focusTarget.focus({ preventScroll: true });

    if (
      !firstPendingReviewTaskRef.current &&
      !todayReviewTasks.isLoading &&
      !todayReviewTasks.isError
    ) {
      showNotice('今天暂时没有待复习任务，可先按今日清单学习。', 'neutral');
    }
  }, [showNotice, todayReviewTasks.isError, todayReviewTasks.isLoading]);
```

Pass the callback to the compact card:

```tsx
<ReviewAgentSuggestionCard
  suggestion={reviewAgentSuggestions.data}
  compact
  onPrimaryAction={focusTodayReview}
/>
```

Mark the review section and its first pending task wrapper as programmatically focusable:

```tsx
<section
  id="today-review"
  ref={todayReviewSectionRef}
  tabIndex={-1}
  className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4"
>
```

```tsx
{groupedReviewTasks.pending.map((task, index) => (
  <div
    key={task.id}
    ref={index === 0 ? firstPendingReviewTaskRef : undefined}
    tabIndex={index === 0 ? -1 : undefined}
  >
    <ReviewTaskCard
      task={task}
      revealed={revealedTaskIds.has(task.id)}
      feedback={reviewFeedbacks[task.id] ?? null}
      ratingPending={submitReviewRating.isPending}
      actionPending={skipReviewTask.isPending || reopenReviewTask.isPending}
      onToggleAnswer={() => toggleAnswer(task.id)}
      onRate={(rating) => void rateTask(task, rating)}
      onSkip={() => void skipTask(task.id)}
    />
  </div>
))}
```

- [ ] **Step 4: Run tests, lint, and build to verify GREEN**

Run:

```powershell
bun --filter @repo/web test -- src/lib/review-agent-ui-integration.test.mts
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all commands exit `0`; no API, Agent, or task-mutation tests change because this is client-only focus behavior.

- [ ] **Step 5: Commit the page behavior**

```powershell
git add -- 'apps/web/src/app/(main)/today/page.tsx' apps/web/src/lib/review-agent-ui-integration.test.mts
git commit -m "fix(web): focus today review from agent suggestion"
```

### Task 3: Record evidence and finish the branch safely

**Files:**
- Modify: `DEVLOG.md`

- [ ] **Step 1: Add the DEVLOG entry**

Add a short entry that states: the card had a same-route link on `/today`; the new callback scrolls and focuses without mutating review state; `/plan` retains navigation; and the verification stack includes focused/full Web tests, lint, build, visible browser interaction, and main replay.

- [ ] **Step 2: Verify the branch in a visible browser**

Start or reuse the local Docker/Web stack without destructive Docker commands. In a headed browser, open `/today` with a test account that has a pending review task, click “先完成今日复习”, and confirm viewport movement plus focus on the first pending card. The ordinary no-pending product state intentionally changes the Planner target away from `/today`, so it cannot render this button naturally; cover the callback's loaded-empty guard with the source contract and do not fabricate a browser response. Leave the browser window visible after validation.

- [ ] **Step 3: Re-run branch regression gates and inspect the diff**

Run:

```powershell
git diff --check main...HEAD
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
git status --short --branch
```

Expected: no whitespace errors, all Web checks exit `0`, and only this fix's source/test/documentation changes are present.

- [ ] **Step 4: Commit the evidence record**

```powershell
git add -- DEVLOG.md
git commit -m "docs(web): record today review action verification"
```

- [ ] **Step 5: Integrate, replay, and push**

After branch review approval, merge from `main` using `git merge --no-ff codex/fix-today-review-action`; re-run the Web test, lint, and build on `main`; repeat the visible `/today` interaction; push with `git push origin main`; and verify `git rev-list --left-right --count origin/main...HEAD` reports `0 0`.
