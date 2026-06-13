# Phase 2.5 Product Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2.5 product experience layer: bright soft anime-style Chat-first UI, complete profile center, improved sidebar navigation, notebook-style today tasks, polished error-book interactions, and unified motion/feedback without changing Phase 2.3 server data authority.

**Architecture:** Keep AI chat as the primary route and use the sidebar as the navigation layer. Add small pure frontend modules for learning preferences and UI feedback state, reuse the existing NestJS `/users/me` endpoint for profile name updates, and keep WrongQuestion/OCR/Chat data flows unchanged. Visual changes are applied through Tailwind classes plus a small set of global theme/motion utilities in `globals.css`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, lucide-react, zustand, TanStack Query, Dexie, Bun, Node direct `.mts` tests.

---

## File Structure

Create:

- `apps/web/src/lib/learning-preferences.ts`
  - Pure localStorage-backed learning preference helpers.
- `apps/web/src/lib/learning-preferences.test.mts`
  - Node direct tests for preference defaults, validation, persistence, and per-user isolation.
- `apps/web/src/lib/profile-feedback.ts`
  - Pure helpers for profile/today notice messages and local status labels if repeated text starts spreading across pages.
- `apps/web/src/lib/profile-feedback.test.mts`
  - Node direct tests for those small helpers.

Modify:

- `apps/web/src/stores/userStore.ts`
  - Extend `CurrentUser` with optional `avatarUrl`, `role`, `createdAt`, `updatedAt`.
- `apps/web/src/lib/auth-user-mapper.ts`
  - Preserve more auth user metadata for profile display.
- `apps/web/src/lib/auth-api.ts`
  - Add `updateMe(request, accessToken)` using existing `/users/me` backend API.
- `apps/web/src/lib/auth-api.test.mts`
  - Update mapper expectations.
- `apps/web/src/hooks/use-auth.ts`
  - Add `useUpdateMe()` mutation and cache/store updates.
- `apps/web/src/app/globals.css`
  - Add Phase 2.5 theme tokens, reduced-motion rules, and reusable animation utilities.
- `apps/web/src/components/chat/chat-sidebar.tsx`
  - Redesign sidebar as the main navigation drawer.
- `apps/web/src/components/chat/chat-top-bar.tsx`
  - Apply new bright anime-style top bar.
- `apps/web/src/components/chat/chat-input-bar.tsx`
  - Apply new input visual styling and keep stop/send behavior.
- `apps/web/src/app/(main)/profile/page.tsx`
  - Replace the current two-line stub page with a working personal center.
- `apps/web/src/lib/today-tasks.ts`
  - Add `getTodayNextAction()` helper and refresh task copy if needed.
- `apps/web/src/lib/today-tasks.test.mts`
  - Add next-action tests.
- `apps/web/src/app/(main)/today/page.tsx`
  - Redesign as light study notebook.
- `apps/web/src/app/(main)/error-book/page.tsx`
  - Visual polish only; keep CRUD and mutation queue behavior.
- `apps/web/src/app/(chat)/chat/page.tsx`
  - Light visual polish around empty state, message wrappers, save question feedback surfaces.
- `docs/roadmap.md`
  - Insert Phase 2.5 before Phase 3.
- `docs/data-flow.md`
  - Add learning preferences local data flow.
- `AGENTS.md`
  - Update current progress and next step.
- `CLAUDE.md`
  - Update current progress and next step.
- `DEVLOG.md`
  - Add Phase 2.5 implementation entry after work completes.
- `Blog/2026-06-13-phase-2-5-product-experience.md`
  - Local ignored blog entry after work completes.

Do not modify:

- `apps/server/**` unless a frontend call exposes an existing bug.
- `packages/database/prisma/schema.prisma`.
- `/api/chat` and `/api/ocr` protocols.
- WrongQuestion/OCR mutation queue semantics.

---

### Task 1: Learning Preferences Pure Module

**Files:**
- Create: `apps/web/src/lib/learning-preferences.ts`
- Create: `apps/web/src/lib/learning-preferences.test.mts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/learning-preferences.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LEARNING_PREFERENCES,
  createLearningPreferenceStorageKey,
  normalizeLearningPreferences,
  readLearningPreferences,
  writeLearningPreferences,
} from './learning-preferences.ts';

function installLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    },
    configurable: true,
  });
  return store;
}

test('builds per-user learning preference storage keys', () => {
  assert.equal(
    createLearningPreferenceStorageKey('user-a'),
    'prepmind-preferences:user-a',
  );
  assert.equal(
    createLearningPreferenceStorageKey('user-b'),
    'prepmind-preferences:user-b',
  );
});

test('normalizes partial and invalid learning preferences', () => {
  const normalized = normalizeLearningPreferences({
    examGoal: '高数期末强化',
    explanationStyle: 'invalid',
    dailyIntensity: 'intense',
    updatedAt: 'bad',
  });

  assert.deepEqual(normalized, {
    ...DEFAULT_LEARNING_PREFERENCES,
    examGoal: '高数期末强化',
    dailyIntensity: 'intense',
  });
});

test('reads defaults when no browser storage exists', () => {
  Reflect.deleteProperty(globalThis, 'window');
  assert.deepEqual(readLearningPreferences('user-a'), DEFAULT_LEARNING_PREFERENCES);
});

test('persists preferences per user', () => {
  installLocalStorage();

  writeLearningPreferences('user-a', {
    examGoal: '考研数学一',
    explanationStyle: 'socratic',
    dailyIntensity: 'light',
    updatedAt: 100,
  });
  writeLearningPreferences('user-b', {
    examGoal: '英语六级',
    explanationStyle: 'detailed',
    dailyIntensity: 'intense',
    updatedAt: 200,
  });

  assert.deepEqual(readLearningPreferences('user-a'), {
    examGoal: '考研数学一',
    explanationStyle: 'socratic',
    dailyIntensity: 'light',
    updatedAt: 100,
  });
  assert.deepEqual(readLearningPreferences('user-b'), {
    examGoal: '英语六级',
    explanationStyle: 'detailed',
    dailyIntensity: 'intense',
    updatedAt: 200,
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/learning-preferences.test.mts
```

Expected: FAIL because `apps/web/src/lib/learning-preferences.ts` does not exist.

- [ ] **Step 3: Implement learning preference helpers**

Create `apps/web/src/lib/learning-preferences.ts`:

```ts
export type ExplanationStyle = 'direct' | 'socratic' | 'detailed';
export type DailyIntensity = 'light' | 'standard' | 'intense';

export interface LearningPreferences {
  examGoal: string;
  explanationStyle: ExplanationStyle;
  dailyIntensity: DailyIntensity;
  updatedAt: number;
}

export const DEFAULT_LEARNING_PREFERENCES: LearningPreferences = {
  examGoal: '高数期末强化',
  explanationStyle: 'direct',
  dailyIntensity: 'standard',
  updatedAt: 0,
};

const explanationStyles = new Set<ExplanationStyle>(['direct', 'socratic', 'detailed']);
const dailyIntensities = new Set<DailyIntensity>(['light', 'standard', 'intense']);

export function createLearningPreferenceStorageKey(userId: string) {
  return `prepmind-preferences:${userId}`;
}

export function normalizeLearningPreferences(value: unknown): LearningPreferences {
  const input =
    value && typeof value === 'object'
      ? (value as Partial<Record<keyof LearningPreferences, unknown>>)
      : {};

  const examGoal =
    typeof input.examGoal === 'string' && input.examGoal.trim()
      ? input.examGoal.trim().slice(0, 80)
      : DEFAULT_LEARNING_PREFERENCES.examGoal;
  const explanationStyle = explanationStyles.has(input.explanationStyle as ExplanationStyle)
    ? (input.explanationStyle as ExplanationStyle)
    : DEFAULT_LEARNING_PREFERENCES.explanationStyle;
  const dailyIntensity = dailyIntensities.has(input.dailyIntensity as DailyIntensity)
    ? (input.dailyIntensity as DailyIntensity)
    : DEFAULT_LEARNING_PREFERENCES.dailyIntensity;
  const updatedAt =
    typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : DEFAULT_LEARNING_PREFERENCES.updatedAt;

  return {
    examGoal,
    explanationStyle,
    dailyIntensity,
    updatedAt,
  };
}

export function readLearningPreferences(userId: string): LearningPreferences {
  if (typeof window === 'undefined' || !userId) return DEFAULT_LEARNING_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(createLearningPreferenceStorageKey(userId));
    if (!raw) return DEFAULT_LEARNING_PREFERENCES;
    return normalizeLearningPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_LEARNING_PREFERENCES;
  }
}

export function writeLearningPreferences(userId: string, preferences: LearningPreferences) {
  if (typeof window === 'undefined' || !userId) return;
  const normalized = normalizeLearningPreferences({
    ...preferences,
    updatedAt: preferences.updatedAt || Date.now(),
  });
  window.localStorage.setItem(
    createLearningPreferenceStorageKey(userId),
    JSON.stringify(normalized),
  );
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/learning-preferences.test.mts
```

Expected: PASS all tests. Node may print `MODULE_TYPELESS_PACKAGE_JSON` warnings; those are acceptable for direct `.mts` tests in this repo.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/lib/learning-preferences.ts apps/web/src/lib/learning-preferences.test.mts
git commit -m "feat: add learning preferences storage"
```

---

### Task 2: Auth Profile Update Plumbing

**Files:**
- Modify: `apps/web/src/stores/userStore.ts`
- Modify: `apps/web/src/lib/auth-user-mapper.ts`
- Modify: `apps/web/src/lib/auth-api.ts`
- Modify: `apps/web/src/lib/auth-api.test.mts`
- Modify: `apps/web/src/hooks/use-auth.ts`

- [ ] **Step 1: Update mapper tests first**

Edit `apps/web/src/lib/auth-api.test.mts` so the first expectation preserves metadata:

```ts
assert.deepEqual(
  mapAuthUserToCurrentUser({
    ...baseUser,
    name: '小明',
    avatarUrl: 'https://example.com/avatar.png',
  }),
  {
    id: 'user_1',
    username: '小明',
    email: 'student@example.com',
    phone: undefined,
    avatarUrl: 'https://example.com/avatar.png',
    role: 'STUDENT',
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  },
);

assert.deepEqual(
  mapAuthUserToCurrentUser({
    ...baseUser,
    name: null,
  }),
  {
    id: 'user_1',
    username: 'student',
    email: 'student@example.com',
    phone: undefined,
    avatarUrl: undefined,
    role: 'STUDENT',
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  },
);
```

- [ ] **Step 2: Run the mapper test and verify it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/auth-api.test.mts
```

Expected: FAIL because `mapAuthUserToCurrentUser()` does not yet return `avatarUrl`, `role`, `createdAt`, or `updatedAt`.

- [ ] **Step 3: Extend `CurrentUser`**

In `apps/web/src/stores/userStore.ts`, change `CurrentUser` to:

```ts
export interface CurrentUser {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  role?: 'STUDENT' | 'ADMIN';
  createdAt?: string;
  updatedAt?: string;
}
```

Do not re-enable local simulated auth methods.

- [ ] **Step 4: Update mapper implementation**

In `apps/web/src/lib/auth-user-mapper.ts`, return the extra fields:

```ts
export function mapAuthUserToCurrentUser(user: AuthUser): CurrentUser {
  return {
    id: user.id,
    username: user.name?.trim() || user.email.split('@')[0] || '用户',
    email: user.email,
    phone: user.phone ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
```

- [ ] **Step 5: Add profile update API**

In `apps/web/src/lib/auth-api.ts`, import `updateMeRequestSchema` and `type UpdateMeRequest`:

```ts
import {
  authResponseSchema,
  authUserSchema,
  updateMeRequestSchema,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
  type UpdateMeRequest,
} from '@repo/types/api/auth';
```

Add this method inside `authApi`:

```ts
async updateMe(request: UpdateMeRequest, accessToken: string): Promise<CurrentUser> {
  const body = updateMeRequestSchema.parse(request);
  const response = authUserSchema.parse(
    await apiClient.patch('/users/me', body, {
      accessToken,
    }),
  );

  return mapAuthUserToCurrentUser(response);
},
```

Keep existing `authApi.me()` using `/auth/me`.

- [ ] **Step 6: Add `useUpdateMe()` hook**

In `apps/web/src/hooks/use-auth.ts`, import `type UpdateMeRequest` and add:

```ts
export function useUpdateMe() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);
  const setCurrentUser = useUserStore((state) => state.setCurrentUser);

  return useMutation({
    mutationFn: async (request: UpdateMeRequest) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }

      return authApi.updateMe(request, accessToken);
    },
    onSuccess: (user) => {
      queryClient.setQueryData<CurrentUser>(authQueryKeys.me, user);
      setCurrentUser(user);
    },
  });
}
```

- [ ] **Step 7: Run focused verification**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/auth-api.test.mts
bun --filter @repo/web lint
```

Expected: mapper test passes; lint exits with code 0.

- [ ] **Step 8: Commit**

```powershell
git add -- apps/web/src/stores/userStore.ts apps/web/src/lib/auth-user-mapper.ts apps/web/src/lib/auth-api.ts apps/web/src/lib/auth-api.test.mts apps/web/src/hooks/use-auth.ts
git commit -m "feat: add profile update client plumbing"
```

---

### Task 3: Theme Tokens And Motion Utilities

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add Phase 2.5 theme tokens**

Append these tokens below the existing `:root` block in `apps/web/src/app/globals.css`:

```css
:root {
  --pm-ink: #2b2335;
  --pm-muted: #7f728c;
  --pm-paper: #fffdf8;
  --pm-soft: #fff7fb;
  --pm-line: rgba(101, 78, 120, 0.14);
  --pm-line-strong: rgba(101, 78, 120, 0.22);
  --pm-pink: #ff8fc7;
  --pm-pink-strong: #e9579f;
  --pm-blue: #81c8ff;
  --pm-mint: #7ce2ca;
  --pm-lavender: #b8a7ff;
  --pm-lemon: #ffe59b;
  --pm-shadow: 0 26px 72px rgba(164, 123, 177, 0.18);
}
```

- [ ] **Step 2: Add reusable visual utilities**

Append:

```css
.pm-anime-bg {
  background:
    linear-gradient(rgba(255, 255, 255, 0.38) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.38) 1px, transparent 1px),
    radial-gradient(circle at 12% 9%, rgba(255, 143, 199, 0.3), transparent 28%),
    radial-gradient(circle at 87% 14%, rgba(129, 200, 255, 0.25), transparent 27%),
    radial-gradient(circle at 60% 90%, rgba(124, 226, 202, 0.2), transparent 32%),
    linear-gradient(180deg, #fff7fb 0%, #f8fbff 48%, #fffaf0 100%);
  background-size: 28px 28px, 28px 28px, auto, auto, auto, auto;
}

.pm-glass-card {
  border: 1px solid var(--pm-line);
  background: rgba(255, 253, 248, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78), var(--pm-shadow);
}

.pm-soft-chip {
  border: 1px solid rgba(233, 87, 159, 0.24);
  background: #fff1f8;
  color: #a43b75;
}

.pm-sync-chip {
  border: 1px solid rgba(124, 226, 202, 0.42);
  background: #effdf9;
  color: #347d70;
}

.pm-enter {
  animation: pm-enter 180ms ease both;
}

.pm-bubble-in {
  animation: pm-bubble-in 180ms ease both;
}

.pm-mascot-float {
  animation: pm-mascot-float 3s ease-in-out infinite;
}

@keyframes pm-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pm-bubble-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes pm-mascot-float {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-5px) rotate(2deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pm-enter,
  .pm-bubble-in,
  .pm-mascot-float {
    animation: none;
  }
}
```

- [ ] **Step 3: Run CSS-level verification through lint/build**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: both exit with code 0.

- [ ] **Step 4: Commit**

```powershell
git add -- apps/web/src/app/globals.css
git commit -m "style: add phase 2.5 visual tokens"
```

---

### Task 4: Complete Profile Page

**Files:**
- Modify: `apps/web/src/app/(main)/profile/page.tsx`
- Modify: `apps/web/src/lib/profile-feedback.ts`
- Modify: `apps/web/src/lib/profile-feedback.test.mts`

- [ ] **Step 1: Add pure feedback tests**

Create `apps/web/src/lib/profile-feedback.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDailyIntensityLabel,
  getExplanationStyleLabel,
  getProfileSuccessMessage,
} from './profile-feedback.ts';

test('maps explanation style labels', () => {
  assert.equal(getExplanationStyleLabel('direct'), '先结论后推导');
  assert.equal(getExplanationStyleLabel('socratic'), '引导式追问');
  assert.equal(getExplanationStyleLabel('detailed'), '详细步骤拆解');
});

test('maps daily intensity labels', () => {
  assert.equal(getDailyIntensityLabel('light'), '轻量 20 分钟');
  assert.equal(getDailyIntensityLabel('standard'), '标准 35 分钟');
  assert.equal(getDailyIntensityLabel('intense'), '强化 60 分钟');
});

test('builds profile success messages', () => {
  assert.equal(getProfileSuccessMessage('name'), '昵称已更新');
  assert.equal(getProfileSuccessMessage('preferences'), '学习偏好已保存');
});
```

- [ ] **Step 2: Run the feedback test and verify it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/profile-feedback.test.mts
```

Expected: FAIL because `profile-feedback.ts` does not exist.

- [ ] **Step 3: Add profile feedback helpers**

Create `apps/web/src/lib/profile-feedback.ts`:

```ts
import type { DailyIntensity, ExplanationStyle } from './learning-preferences.ts';

const explanationStyleLabels: Record<ExplanationStyle, string> = {
  direct: '先结论后推导',
  socratic: '引导式追问',
  detailed: '详细步骤拆解',
};

const dailyIntensityLabels: Record<DailyIntensity, string> = {
  light: '轻量 20 分钟',
  standard: '标准 35 分钟',
  intense: '强化 60 分钟',
};

const profileSuccessMessages = {
  name: '昵称已更新',
  preferences: '学习偏好已保存',
} as const;

export type ProfileSuccessAction = keyof typeof profileSuccessMessages;

export function getExplanationStyleLabel(style: ExplanationStyle) {
  return explanationStyleLabels[style];
}

export function getDailyIntensityLabel(intensity: DailyIntensity) {
  return dailyIntensityLabels[intensity];
}

export function getProfileSuccessMessage(action: ProfileSuccessAction) {
  return profileSuccessMessages[action];
}
```

- [ ] **Step 4: Run pure tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/profile-feedback.test.mts
node --experimental-strip-types apps/web/src/lib/learning-preferences.test.mts
```

Expected: both pass.

- [ ] **Step 5: Replace profile stub with working page**

Replace `apps/web/src/app/(main)/profile/page.tsx` with a client component that:

- reads `currentUser` and `accessToken` from `useUserStore`
- uses `useUpdateMe()` for nickname saves
- uses `readLearningPreferences()` and `writeLearningPreferences()`
- shows local notice state for success/error
- calls `useLogout()` and `router.replace('/login')` for logout

Use this component structure:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  LogOut,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  User,
} from 'lucide-react';

import { useLogout, useUpdateMe } from '@/hooks/use-auth';
import {
  DEFAULT_LEARNING_PREFERENCES,
  readLearningPreferences,
  writeLearningPreferences,
  type DailyIntensity,
  type ExplanationStyle,
  type LearningPreferences,
} from '@/lib/learning-preferences';
import {
  getDailyIntensityLabel,
  getExplanationStyleLabel,
  getProfileSuccessMessage,
} from '@/lib/profile-feedback';
import { useUserStore } from '@/stores/userStore';

type Notice = { type: 'success' | 'danger'; message: string };

const explanationStyles: ExplanationStyle[] = ['direct', 'socratic', 'detailed'];
const dailyIntensities: DailyIntensity[] = ['light', 'standard', 'intense'];

export default function ProfilePage() {
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const userId = currentUser?.id ?? '';
  const updateMe = useUpdateMe();
  const logout = useLogout();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [nickname, setNickname] = useState(currentUser?.username ?? '');
  const [preferences, setPreferences] = useState<LearningPreferences>(
    DEFAULT_LEARNING_PREFERENCES,
  );

  useEffect(() => {
    setNickname(currentUser?.username ?? '');
  }, [currentUser?.username]);

  useEffect(() => {
    if (!userId) return;
    setPreferences(readLearningPreferences(userId));
  }, [userId]);

  const avatarText = useMemo(() => {
    return (currentUser?.username || currentUser?.email || 'P').slice(0, 1).toUpperCase();
  }, [currentUser?.email, currentUser?.username]);

  async function handleSaveName() {
    const nextName = nickname.trim();
    if (!nextName) {
      setNotice({ type: 'danger', message: '昵称不能为空' });
      return;
    }

    await updateMe
      .mutateAsync({ name: nextName })
      .then(() => setNotice({ type: 'success', message: getProfileSuccessMessage('name') }))
      .catch(() => setNotice({ type: 'danger', message: '昵称更新失败，请稍后重试' }));
  }

  function handleSavePreferences() {
    if (!userId) return;
    const nextPreferences = { ...preferences, updatedAt: Date.now() };
    writeLearningPreferences(userId, nextPreferences);
    setPreferences(nextPreferences);
    setNotice({ type: 'success', message: getProfileSuccessMessage('preferences') });
  }

  async function handleLogout() {
    await logout.mutateAsync().catch(() => undefined);
    router.replace('/login');
  }

  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <Link href="/chat" className="tap-target flex h-11 w-11 items-center justify-center rounded-full bg-white/80 ring-1 ring-[var(--pm-line)]" aria-label="返回聊天">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight">个人中心</h1>
            <p className="mt-0.5 text-xs text-[var(--pm-muted)]">学习偏好与本机数据</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {notice && (
          <div className={`pm-enter rounded-2xl px-3 py-2 text-sm ring-1 ${notice.type === 'success' ? 'pm-sync-chip' : 'bg-red-50 text-red-700 ring-red-100'}`}>
            {notice.message}
          </div>
        )}

        <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-[var(--pm-pink)] to-[var(--pm-blue)] text-lg font-bold text-white shadow-lg shadow-pink-200">
              {avatarText}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{currentUser?.username ?? 'PrepMind 学员'}</p>
              <p className="truncate text-xs text-[var(--pm-muted)]">{currentUser?.email ?? '邮箱未读取'}</p>
            </div>
            <Sparkles className="h-5 w-5 text-[var(--pm-pink-strong)]" />
          </div>
        </section>

        <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-[var(--pm-pink-strong)]" />
            <h2 className="text-sm font-semibold">昵称</h2>
          </div>
          <div className="flex gap-2">
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} className="min-h-11 flex-1 rounded-2xl border border-[var(--pm-line)] bg-white px-3 text-sm outline-none focus:border-[var(--pm-pink)]" />
            <button type="button" onClick={handleSaveName} disabled={updateMe.isPending} className="tap-target flex min-h-11 items-center gap-1 rounded-2xl bg-[var(--pm-pink-strong)] px-3 text-sm font-medium text-white disabled:opacity-60">
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </section>

        <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--pm-pink-strong)]" />
            <h2 className="text-sm font-semibold">学习偏好</h2>
          </div>
          <label className="block text-xs font-medium text-[var(--pm-muted)]">备考目标</label>
          <input value={preferences.examGoal} onChange={(event) => setPreferences((prev) => ({ ...prev, examGoal: event.target.value }))} className="mt-1 min-h-11 w-full rounded-2xl border border-[var(--pm-line)] bg-white px-3 text-sm outline-none focus:border-[var(--pm-pink)]" />

          <div className="mt-4 grid gap-3">
            <PreferenceSegment title="AI 讲解风格" value={preferences.explanationStyle} options={explanationStyles} getLabel={getExplanationStyleLabel} onChange={(value) => setPreferences((prev) => ({ ...prev, explanationStyle: value }))} />
            <PreferenceSegment title="每日学习强度" value={preferences.dailyIntensity} options={dailyIntensities} getLabel={getDailyIntensityLabel} onChange={(value) => setPreferences((prev) => ({ ...prev, dailyIntensity: value }))} />
          </div>

          <button type="button" onClick={handleSavePreferences} className="tap-target mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--pm-ink)] text-sm font-medium text-white">
            <CheckCircle2 className="h-4 w-4" />
            保存学习偏好
          </button>
        </section>

        <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>
              <h2 className="text-sm font-semibold">数据同步</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">聊天、OCR 和错题已接入服务端。离线失败会暂存在本机，网络恢复后自动补偿同步。今日任务和学习偏好当前保存在本机并按账号隔离。</p>
            </div>
          </div>
        </section>

        <button type="button" onClick={handleLogout} disabled={logout.isPending} className="tap-target flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 text-sm font-medium text-red-600 disabled:opacity-60">
          <LogOut className="h-4 w-4" />
          {logout.isPending ? '退出中...' : '退出登录'}
        </button>
      </main>
    </div>
  );
}
```

Add this helper component below the page component:

```tsx
function PreferenceSegment<TValue extends string>({
  title,
  value,
  options,
  getLabel,
  onChange,
}: {
  title: string;
  value: TValue;
  options: TValue[];
  getLabel: (value: TValue) => string;
  onChange: (value: TValue) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--pm-muted)]">{title}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`tap-target rounded-2xl px-2 py-2 text-xs font-medium ring-1 transition-all active:scale-[0.98] ${
                selected
                  ? 'bg-[var(--pm-pink-strong)] text-white ring-[var(--pm-pink-strong)]'
                  : 'bg-white text-[var(--pm-muted)] ring-[var(--pm-line)]'
              }`}
            >
              {getLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run profile verification**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/profile-feedback.test.mts
node --experimental-strip-types apps/web/src/lib/learning-preferences.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: tests pass, lint exits 0, build exits 0.

- [ ] **Step 7: Commit**

```powershell
git add -- apps/web/src/app/(main)/profile/page.tsx apps/web/src/lib/profile-feedback.ts apps/web/src/lib/profile-feedback.test.mts
git commit -m "feat: complete profile center"
```

---

### Task 5: Sidebar Navigation Redesign

**Files:**
- Modify: `apps/web/src/components/chat/chat-sidebar.tsx`
- Modify: `apps/web/src/components/chat/chat-top-bar.tsx`

- [ ] **Step 1: Update sidebar nav structure**

In `apps/web/src/components/chat/chat-sidebar.tsx`, import `MessageCircle`, `Sparkles`, and `CheckCircle2`:

```ts
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  LogOut,
  MessageCircle,
  Sparkles,
  User,
  X,
} from 'lucide-react';
```

Replace `navItems` with:

```ts
const navItems = [
  { href: '/chat', label: 'AI 对话', icon: MessageCircle },
  { href: '/today', label: '今日任务', icon: CalendarDays },
  { href: '/error-book', label: '错题本', icon: BookOpen },
  { href: '/profile', label: '个人中心', icon: User },
];
```

- [ ] **Step 2: Replace sidebar markup**

Use this visual structure inside the `aside`:

```tsx
<aside
  aria-hidden={!open}
  className={`fixed right-0 top-0 z-50 flex h-full w-[19rem] max-w-[86vw] flex-col border-l border-[var(--pm-line)] bg-white/90 shadow-2xl shadow-pink-100/60 backdrop-blur-xl transition-transform duration-300 ${
    open ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
  }`}
>
  {open && (
    <>
      <div className="pm-anime-bg border-b border-[var(--pm-line)] px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="pm-mascot-float flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-[var(--pm-pink)] to-[var(--pm-blue)] text-base font-bold text-white shadow-lg shadow-pink-200">
              {(currentUser?.username || 'P').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--pm-ink)]">
                {currentUser?.username || '未登录'}
              </p>
              <p className="truncate text-xs text-[var(--pm-muted)]">
                {currentUser?.email || currentUser?.phone || 'PrepMind Study Buddy'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/70 ring-1 ring-[var(--pm-line)]" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = item.href === '/chat' ? pathname.startsWith('/chat') : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} onClick={onClose} className={`tap-target flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all active:scale-[0.98] ${isActive ? 'bg-gradient-to-r from-pink-50 to-sky-50 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)]' : 'text-[var(--pm-muted)] hover:bg-pink-50/70'}`}>
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-3 mb-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 text-xs leading-5 text-emerald-700">
        <div className="mb-1 flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          同步保护已开启
        </div>
        离线保存失败时会暂存在本机，网络恢复后自动补偿同步。
      </div>

      <div className="space-y-1 border-t border-[var(--pm-line)] px-3 py-4">
        <button type="button" disabled={logout.isPending} onClick={async () => { await logout.mutateAsync().catch(() => undefined); onClose(); router.replace('/login'); }} className="tap-target flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60">
          <LogOut className="h-5 w-5" />
          {logout.isPending ? '退出中...' : '退出登录'}
        </button>
      </div>
    </>
  )}
</aside>
```

Use `Sparkles` only if adding a small brand title; remove unused imports after implementing.

- [ ] **Step 3: Update top bar**

In `apps/web/src/components/chat/chat-top-bar.tsx`, replace the header with:

```tsx
<header className="sticky top-0 z-40 border-b border-[var(--pm-line)] bg-white/80 px-4 py-3 backdrop-blur">
  <div className="flex items-center justify-between">
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--pm-pink)] to-[var(--pm-blue)] text-sm font-bold text-white shadow-md shadow-pink-200">
      P
    </div>

    <div className="flex flex-col items-center">
      <h1 className="text-base font-semibold text-[var(--pm-ink)]">PrepMind AI</h1>
      <span className="text-[11px] text-[var(--pm-muted)]">正在陪你备考</span>
    </div>

    <button
      type="button"
      onClick={onMenuClick}
      className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/70 ring-1 ring-[var(--pm-line)] transition-all hover:bg-pink-50 active:scale-95"
      aria-label="打开菜单"
    >
      <Menu className="h-5 w-5" />
    </button>
  </div>
</header>
```

- [ ] **Step 4: Verify**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: both exit with code 0.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/components/chat/chat-sidebar.tsx apps/web/src/components/chat/chat-top-bar.tsx
git commit -m "style: redesign chat navigation drawer"
```

---

### Task 6: Today Page Study Notebook

**Files:**
- Modify: `apps/web/src/lib/today-tasks.ts`
- Modify: `apps/web/src/lib/today-tasks.test.mts`
- Modify: `apps/web/src/app/(main)/today/page.tsx`

- [ ] **Step 1: Add next-action tests**

Append to `apps/web/src/lib/today-tasks.test.mts`:

```ts
import { getTodayNextAction } from './today-tasks.ts';

test('recommends wrong question review when unresolved questions exist', () => {
  const state = createEmptyTodayState('2026-06-13');
  assert.deepEqual(getTodayNextAction(state, 3), {
    title: '先复习未掌握错题',
    description: '当前还有 3 道未掌握错题，建议先回看错因和备注。',
    href: '/error-book',
  });
});

test('recommends the first incomplete task when no unresolved question exists', () => {
  const state = {
    date: '2026-06-13',
    completedTaskIds: [TODAY_TASKS[0].id],
    updatedAt: 1,
  };
  assert.equal(getTodayNextAction(state, 0).title, TODAY_TASKS[1].title);
});

test('recommends summary after all tasks are completed', () => {
  const state = {
    date: '2026-06-13',
    completedTaskIds: TODAY_TASKS.map((task) => task.id),
    updatedAt: 1,
  };
  assert.deepEqual(getTodayNextAction(state, 0), {
    title: '今天的学习闭环已完成',
    description: '可以回到 AI 对话，让 PrepMind 帮你总结明天的优先级。',
    href: '/chat',
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/today-tasks.test.mts
```

Expected: FAIL because `getTodayNextAction` is not exported.

- [ ] **Step 3: Add next-action helper**

In `apps/web/src/lib/today-tasks.ts`, add:

```ts
export interface TodayNextAction {
  title: string;
  description: string;
  href: string;
}

export function getTodayNextAction(
  state: TodayTaskState,
  unresolvedCount: number,
): TodayNextAction {
  if (unresolvedCount > 0 && !state.completedTaskIds.includes('wrong-question-review')) {
    return {
      title: '先复习未掌握错题',
      description: `当前还有 ${unresolvedCount} 道未掌握错题，建议先回看错因和备注。`,
      href: '/error-book',
    };
  }

  const nextTask = TODAY_TASKS.find((task) => !state.completedTaskIds.includes(task.id));
  if (nextTask) {
    return {
      title: nextTask.title,
      description: nextTask.description,
      href: nextTask.href,
    };
  }

  return {
    title: '今天的学习闭环已完成',
    description: '可以回到 AI 对话，让 PrepMind 帮你总结明天的优先级。',
    href: '/chat',
  };
}
```

Refresh `TODAY_TASKS` text to clean Chinese copy:

```ts
export const TODAY_TASKS: TodayTaskTemplate[] = [
  {
    id: 'knowledge-review',
    kind: 'review',
    title: '复盘薄弱知识点',
    description: '花 20 分钟回顾一个最近最容易卡住的知识点。',
    estimateMinutes: 20,
    actionLabel: '找 AI 梳理',
    href: '/chat',
  },
  {
    id: 'wrong-question-review',
    kind: 'wrong-question',
    title: '错题回看',
    description: '优先复习未掌握错题，记录这次卡住的原因。',
    estimateMinutes: 15,
    actionLabel: '打开错题本',
    href: '/error-book',
  },
  {
    id: 'capture-new-question',
    kind: 'capture',
    title: '拍照识题',
    description: '新增识别 1 道题，把有价值的题保存到错题本。',
    estimateMinutes: 10,
    actionLabel: '去识题',
    href: '/chat',
  },
  {
    id: 'daily-summary',
    kind: 'summary',
    title: '学习总结',
    description: '用 3 句话总结今天的薄弱点和明天优先级。',
    estimateMinutes: 5,
    actionLabel: '让 AI 总结',
    href: '/chat',
  },
];
```

- [ ] **Step 4: Redesign today page**

In `apps/web/src/app/(main)/today/page.tsx`:

- import `getTodayNextAction`
- compute `const nextAction = getTodayNextAction(taskState, unresolvedCount)`
- use `pm-anime-bg`, `pm-glass-card`, `pm-enter`
- keep `TaskCard` click behavior exactly the same
- add notice state for task toggles:

```ts
const [notice, setNotice] = useState<string | null>(null);

function showNotice(message: string) {
  setNotice(message);
  window.setTimeout(() => setNotice(null), 1800);
}
```

In `toggleTask`, after `writeTodayTaskState(userId, next)`, call:

```ts
showNotice(next.completedTaskIds.includes(taskId) ? '任务已完成' : '已标记为待完成');
```

Use this page section order:

1. sticky header with back button and date
2. notice bar
3. progress hero with next action
4. task list
5. small data note
6. AI 对话 / 错题本 shortcuts

Do not introduce a bottom tab bar in this task.

- [ ] **Step 5: Verify**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/today-tasks.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/src/lib/today-tasks.ts apps/web/src/lib/today-tasks.test.mts apps/web/src/app/(main)/today/page.tsx
git commit -m "feat: redesign today study notebook"
```

---

### Task 7: Error Book Visual Polish

**Files:**
- Modify: `apps/web/src/app/(main)/error-book/page.tsx`
- Test existing: `apps/web/src/lib/crud-feedback.test.mts`
- Test existing: `apps/web/src/lib/server-cache-sync.test.mts`
- Test existing: `apps/web/src/lib/mutation-queue-flush.test.mts`

- [ ] **Step 1: Re-read current behavior before editing**

Run:

```powershell
rg "handleUpdate|handleDelete|pendingDeleteId|ActionNoticeBar|WrongQuestionDetail" "apps/web/src/app/(main)/error-book/page.tsx" -n
```

Expected: find current update/delete/notice/detail sections. Keep those control flows.

- [ ] **Step 2: Apply visual-only page shell changes**

In `apps/web/src/app/(main)/error-book/page.tsx`, change the outer shell to use:

```tsx
<div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
```

Change header/card backgrounds to `bg-white/75`, `pm-glass-card`, `border-[var(--pm-line)]`, and use `text-[var(--pm-muted)]` for secondary text.

Keep these unchanged:

- query hooks
- Dexie cache sync
- `pendingOperation === 'delete'` filtering
- update/delete mutation queue fallback
- detail full-screen fixed overlay
- delete confirm state machine

- [ ] **Step 3: Polish cards**

For list cards:

- subject/category chips use `pm-soft-chip`
- sync status badge uses `pm-sync-chip`
- unresolved status uses soft amber classes
- action buttons keep same handlers and disabled states
- card hover/active transitions use `active:scale-[0.99]`

Implementation pattern:

```tsx
<article className="pm-glass-card pm-enter rounded-[1.35rem] p-3">
  ...
</article>
```

- [ ] **Step 4: Polish detail overlay**

For detail overlay:

- outer overlay remains `fixed inset-0 z-50`
- background becomes `pm-anime-bg`
- header uses `bg-white/80 backdrop-blur`
- detail cards use `pm-glass-card`
- delete confirmation uses soft red panel but keeps current confirm buttons and handlers

- [ ] **Step 5: Verify behavior tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/crud-feedback.test.mts
node --experimental-strip-types apps/web/src/lib/server-cache-sync.test.mts
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all tests pass, lint/build exit 0.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/src/app/(main)/error-book/page.tsx
git commit -m "style: polish error book experience"
```

---

### Task 8: Chat Page Light Visual Upgrade

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/page.tsx`
- Modify: `apps/web/src/components/chat/chat-input-bar.tsx`

- [ ] **Step 1: Re-read chat regression-sensitive logic**

Run:

```powershell
rg "activeStudyContext|isGenerating|AbortController|StreamingMarkdownRenderer|saveWrongQuestion|handleStop|useStreamingAutoScroll" "apps/web/src/app/(chat)/chat/page.tsx" -n
```

Expected: identify the logic that must not be rewritten.

- [ ] **Step 2: Upgrade chat page shell**

In `apps/web/src/app/(chat)/chat/page.tsx`, apply:

- outer page `pm-anime-bg`
- assistant message bubble `pm-bubble-in`
- user message bubble soft pink/blue gradient
- assistant message bubble white paper card with `border-[var(--pm-line)]`
- empty state becomes bright anime learning buddy state

Do not change:

- message state shape
- OCR runtime provider usage
- `activeStudyContext` creation and injection
- auto-scroll hook
- stop generation behavior
- save wrong question API calls
- Dexie writes

- [ ] **Step 3: Upgrade input bar styling**

In `apps/web/src/components/chat/chat-input-bar.tsx`, change only classes and visible copy:

- root background `bg-white/80 backdrop-blur`
- textarea container `rounded-[1.4rem] border-[var(--pm-line)] bg-white/85`
- plus/camera/send buttons use soft anime colors
- stop button stays visually distinct and accessible
- menu cards use `rounded-[1.25rem] bg-white ring-1 ring-[var(--pm-line)]`

Keep file input behavior and selected image preview logic unchanged.

- [ ] **Step 4: Verify chat-focused tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/chat-context.test.mts
node --experimental-strip-types apps/web/src/lib/chat-sync.test.mts
node --experimental-strip-types apps/web/src/lib/chat-content-formatter.test.mts
node --experimental-strip-types apps/web/src/lib/streaming-markdown.test.mts
node --experimental-strip-types apps/web/src/lib/streaming-scroll.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all tests pass, lint/build exit 0.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/app/(chat)/chat/page.tsx apps/web/src/components/chat/chat-input-bar.tsx
git commit -m "style: refresh chat study buddy UI"
```

---

### Task 9: Manual Playwright Smoke Test

**Files:**
- No source file changes unless defects are found.

- [ ] **Step 1: Start infrastructure**

Run:

```powershell
$env:POSTGRES_PORT='5433'; docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

Expected: postgres/redis/minio running. Docker compose may warn that `version` is obsolete; that warning is acceptable.

- [ ] **Step 2: Start backend and frontend**

Run in two terminals:

```powershell
$env:POSTGRES_PORT='5433'; bun --filter @repo/server start:dev
```

```powershell
bun --filter @repo/web dev
```

Expected: server listens on 3001, web listens on 3000.

- [ ] **Step 3: Browser smoke path**

Use Playwright or the in-app browser:

1. Clear browser cookies/localStorage/IndexedDB for localhost.
2. Open `http://localhost:3000`.
3. Register a temporary test user.
4. Confirm login redirects to `/chat`.
5. Open sidebar.
6. Navigate to `/today`.
7. Toggle a task and confirm notice appears.
8. Navigate to `/profile`.
9. Edit nickname and save.
10. Save learning preferences.
11. Navigate to `/error-book`.
12. Confirm empty state renders.
13. Return to `/chat`.
14. Type a short message and stop generation if it starts.

Expected:

- no runtime overlay
- no console errors except unauthenticated `/auth/refresh` 401 before login
- sidebar opens/closes
- profile is no longer a two-line stub
- task state persists after refresh
- main input remains visible and usable on mobile viewport

- [ ] **Step 4: Clean temporary data**

If a temporary test user was created, remove it from the Docker PostgreSQL database:

```powershell
@'
delete from "User" where email='codex-phase25-smoke@example.com';
'@ | docker exec -i docker-postgres-1 psql -U prepmind -d prepmind
```

Expected: `DELETE 1` if the user exists or `DELETE 0` if it was already removed.

- [ ] **Step 5: Stop project dev processes**

Stop only the frontend/backend dev processes started for smoke testing. Leave Docker running unless the user asks to stop it.

Run:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq 'Listen' } |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

Expected: no `Listen` entries remain for ports 3000 or 3001.

- [ ] **Step 6: Commit only if smoke fixes were needed**

If this task produced source fixes:

```powershell
git add -- <fixed-files>
git commit -m "fix: address phase 2.5 smoke issues"
```

If no source changes were needed, do not create an empty commit.

---

### Task 10: Documentation And Final Verification

**Files:**
- Modify: `docs/roadmap.md`
- Modify: `docs/data-flow.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `DEVLOG.md`
- Create: `Blog/2026-06-13-phase-2-5-product-experience.md`

- [ ] **Step 1: Update roadmap**

In `docs/roadmap.md`:

- Insert Phase 2.5 between Phase 2.3 and Phase 3.
- Mark Phase 2.5 as completed after implementation.
- Keep Phase 3 as next priority.

Use this wording:

```md
### Phase 2.5 — 产品体验补全

- Chat-first 亮色软萌日漫风视觉系统。
- 侧边栏导航升级。
- 今日任务轻学习手账。
- 个人中心与本地学习偏好。
- 错题本视觉与反馈微调。
- 统一轻提示、动效和 reduced-motion 边界。
```

- [ ] **Step 2: Update data flow**

In `docs/data-flow.md`, add:

```md
### Learning Preferences

ProfilePage
  -> readLearningPreferences(userId)
  -> localStorage prepmind-preferences:{userId}
  -> writeLearningPreferences(userId, preferences)

学习偏好当前是前端本地数据，按 userId 隔离。它不参与 Phase 2.3 mutationQueue，也不影响 `/api/chat` prompt；后续如需让偏好影响 AI 讲解风格，需要在 Phase 3 单独设计 prompt 注入边界。
```

- [ ] **Step 3: Update AGENTS and CLAUDE**

In both `AGENTS.md` and `CLAUDE.md`:

- current progress includes Phase 2.5 completed
- data-flow summary includes local learning preferences
- next step remains Phase 3 OCR structured output schema

- [ ] **Step 4: Update DEVLOG**

Add one concise `2026-06-13` entry under the existing same-day section if present. Keep todo/planning at the bottom.

Include:

- Phase 2.5 product shell completed
- profile center completed
- today notebook completed
- sidebar/chat/error-book visual polish
- verification commands
- commit hashes

- [ ] **Step 5: Write local ignored blog**

Create `Blog/2026-06-13-phase-2-5-product-experience.md` with:

```md
# 2026-06-13：Phase 2.5 产品体验补全

今天没有急着进入 Phase 3，而是先把 PrepMind 的产品壳层补完整。

核心决策是保持 Chat-first：AI 对话仍然是主入口，侧边栏作为导航层，今日任务、错题本、个人中心是围绕对话流展开的学习工具页。

视觉方向最终定为亮色软萌日漫风的 AI 学习搭子。它不是单纯换皮，而是让保存、待同步、任务完成、错题复习这些状态都变得更轻、更有陪伴感。

这一步补齐后，Phase 3 的 structured output、tool calling 和讲题系统会有更稳定的产品承载层。
```

Confirm `Blog/` remains ignored:

```powershell
git check-ignore -v Blog/2026-06-13-phase-2-5-product-experience.md
```

Expected: `.gitignore` rule is printed.

- [ ] **Step 6: Full verification**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/learning-preferences.test.mts
node --experimental-strip-types apps/web/src/lib/profile-feedback.test.mts
node --experimental-strip-types apps/web/src/lib/today-tasks.test.mts
node --experimental-strip-types apps/web/src/lib/auth-api.test.mts
node --experimental-strip-types apps/web/src/lib/crud-feedback.test.mts
node --experimental-strip-types apps/web/src/lib/server-cache-sync.test.mts
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
node --experimental-strip-types apps/web/src/lib/chat-context.test.mts
node --experimental-strip-types apps/web/src/lib/chat-sync.test.mts
node --experimental-strip-types apps/web/src/lib/chat-content-formatter.test.mts
node --experimental-strip-types apps/web/src/lib/streaming-markdown.test.mts
node --experimental-strip-types apps/web/src/lib/streaming-scroll.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
git diff --check
```

Expected:

- direct `.mts` tests pass
- web lint/build pass
- server lint/build/test/e2e pass
- `git diff --check` exits 0
- known warnings: Node module type warnings and Docker compose obsolete `version` warning are acceptable

- [ ] **Step 7: Commit docs**

Do not stage `Blog/`.

```powershell
git add -- docs/roadmap.md docs/data-flow.md AGENTS.md CLAUDE.md DEVLOG.md
git commit -m "docs: record phase 2.5 product experience"
```

- [ ] **Step 8: Final status**

Run:

```powershell
git status --short
git log --oneline -8
```

Expected:

- clean tracked worktree
- `Blog/2026-06-13-phase-2-5-product-experience.md` not shown because ignored
- recent commits show Phase 2.5 implementation and docs commits

---

## Self-Review

- Spec coverage: Tasks cover learning preferences, user profile update plumbing, visual tokens, profile page, sidebar, today page, error-book polish, chat polish, smoke testing, and documentation.
- Scope boundary: The plan does not add RAG, LangGraph, tool calling, server learning preference tables, multi-session management, achievements, or theme switching.
- Type consistency: `LearningPreferences`, `ExplanationStyle`, and `DailyIntensity` are defined in Task 1 and reused by profile page and feedback helpers.
- Risk control: Chat/OCR/streaming/mutationQueue logic is explicitly preserved and verified with existing tests.
