'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  BookOpenCheck,
  Check,
  ChevronRight,
  Clock3,
  Pencil,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { MemoryAgentPanel } from '@/components/memory-agent/memory-agent-panel';
import { useUpdateMe } from '@/hooks/use-auth';
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
  type ProfileSuccessAction,
} from '@/lib/profile-feedback';
import { useUserStore } from '@/stores/userStore';

const explanationStyles: ExplanationStyle[] = ['direct', 'socratic', 'detailed'];
const dailyIntensities: DailyIntensity[] = ['light', 'standard', 'intense'];

function formatDate(value?: string) {
  if (!value) return '尚未同步';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未同步';

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function ProfilePage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const updateMe = useUpdateMe();
  const userId = currentUser?.id ?? '';
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<LearningPreferences>(DEFAULT_LEARNING_PREFERENCES);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const displayName = displayNameDraft ?? currentUser?.username ?? '';

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    window.setTimeout(() => {
      if (!cancelled) {
        setPreferences(readLearningPreferences(userId));
      }
    }, 0);

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const initials = useMemo(() => {
    const source = currentUser?.username || currentUser?.email || '学';
    return source.slice(0, 1).toUpperCase();
  }, [currentUser?.email, currentUser?.username]);

  function showNotice(action: ProfileSuccessAction) {
    setNotice(getProfileSuccessMessage(action));
    window.setTimeout(() => setNotice(null), 1800);
  }

  async function handleSaveName() {
    if (!currentUser) return;

    setError(null);
    try {
      await updateMe.mutateAsync({
        name: displayName.trim() || null,
      });
      setDisplayNameDraft(null);
      showNotice('name');
    } catch {
      setError('昵称保存失败，请稍后重试');
    }
  }

  function handleSavePreferences() {
    if (!userId) return;

    writeLearningPreferences(userId, {
      ...preferences,
      updatedAt: Date.now(),
    });
    setPreferences(readLearningPreferences(userId));
    showNotice('preferences');
  }

  function updatePreference<K extends keyof LearningPreferences>(
    key: K,
    value: LearningPreferences[K],
  ) {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/chat"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
            aria-label="返回聊天"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--pm-muted)]">Personal center</p>
            <h1 className="text-lg font-semibold leading-tight">我的学习档案</h1>
          </div>
          <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff7d6] text-sm font-black text-[#247269] ring-1 ring-[#f3e6a8]">
            学
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {notice ? (
          <div className="pm-enter flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/90 px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm">
            <Check className="h-4 w-4" />
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="pm-enter rounded-2xl border border-red-100 bg-red-50/90 px-3 py-2 text-sm font-medium text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] bg-[#fff7d6] text-2xl font-black text-[#247269] ring-1 ring-[#f3e6a8]">
              {currentUser?.avatarUrl ? <UserRound className="h-8 w-8" /> : initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--pm-muted)]">
                {currentUser?.role === 'ADMIN' ? '管理员账号' : '学生账号'}
              </p>
              <h2 className="mt-1 truncate text-2xl font-semibold leading-tight">
                {currentUser?.username ?? '学习者'}
              </h2>
              <p className="mt-2 truncate text-sm text-[var(--pm-muted)]">
                {currentUser?.email ?? '邮箱尚未同步'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--pm-muted)]">
                <Clock3 className="h-4 w-4" />
                加入时间
              </div>
              <p className="mt-2 text-sm font-semibold">{formatDate(currentUser?.createdAt)}</p>
            </div>
            <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--pm-muted)]">
                <Sparkles className="h-4 w-4" />
                当前目标
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{preferences.examGoal}</p>
            </div>
          </div>
        </section>

        <Link
          href="/agent-trace"
          className="pm-glass-card pm-enter tap-target flex min-h-20 items-center gap-3 rounded-[1.5rem] p-4 transition-all hover:bg-white/80 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
            <Activity className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Agent 调试台</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--pm-muted)]">
              查看路由、降级和估算成本
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--pm-muted)]" />
        </Link>

        <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-[#247269]" />
            <h2 className="text-base font-semibold">昵称</h2>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={displayName}
              onChange={(event) => setDisplayNameDraft(event.target.value)}
              maxLength={50}
              className="min-h-11 min-w-0 flex-1 rounded-2xl border border-[var(--pm-line)] bg-white/80 px-3 text-base outline-none transition-all placeholder:text-[var(--pm-muted)] focus:border-[#6fcbbf] focus:ring-4 focus:ring-[#d8f8f0]"
              placeholder="给自己起一个学习昵称"
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={updateMe.isPending || !currentUser}
              className="tap-target rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#3a3047] active:scale-95 disabled:opacity-50"
            >
              {updateMe.isPending ? '保存中' : '保存'}
            </button>
          </div>
        </section>

        <section className="pm-glass-card pm-enter rounded-[1.5rem] p-4">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-[#347d70]" />
            <h2 className="text-base font-semibold">学习偏好</h2>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-medium">备考目标</span>
            <input
              value={preferences.examGoal}
              onChange={(event) => updatePreference('examGoal', event.target.value)}
              maxLength={80}
              className="mt-2 min-h-11 w-full rounded-2xl border border-[var(--pm-line)] bg-white/80 px-3 text-base outline-none transition-all focus:border-[#6fcbbf] focus:ring-4 focus:ring-[#d8f8f0]"
              placeholder="例如：考研数学一 / 高数期末强化"
            />
          </label>

          <div className="mt-4">
            <p className="text-sm font-medium">AI 讲解风格</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {explanationStyles.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => updatePreference('explanationStyle', style)}
                  className={`tap-target rounded-2xl px-3 py-2 text-sm font-semibold ring-1 transition-all active:scale-95 ${
                    preferences.explanationStyle === style
                      ? 'bg-[#eafff9] text-[#247269] ring-[#bdeee5]'
                      : 'bg-white/70 text-[var(--pm-muted)] ring-[var(--pm-line)] hover:bg-white'
                  }`}
                >
                  {getExplanationStyleLabel(style)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium">每日强度</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {dailyIntensities.map((intensity) => (
                <button
                  key={intensity}
                  type="button"
                  onClick={() => updatePreference('dailyIntensity', intensity)}
                  className={`tap-target rounded-2xl px-3 py-2 text-sm font-semibold ring-1 transition-all active:scale-95 ${
                    preferences.dailyIntensity === intensity
                      ? 'bg-[#effdf9] text-[#347d70] ring-emerald-200'
                      : 'bg-white/70 text-[var(--pm-muted)] ring-[var(--pm-line)] hover:bg-white'
                  }`}
                >
                  {getDailyIntensityLabel(intensity)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={!userId}
            className="tap-target mt-4 w-full rounded-2xl bg-[#86dccf] px-4 py-2 text-sm font-semibold text-[#173b37] shadow-sm transition-all hover:bg-[#70cfc1] active:scale-[0.99] disabled:opacity-50"
          >
            保存学习偏好
          </button>
        </section>

        {userId ? <MemoryAgentPanel userId={userId} /> : null}

        <section className="rounded-[1.35rem] border border-[var(--pm-line)] bg-white/55 p-4 text-sm leading-6 text-[var(--pm-muted)]">
          账号资料以服务器为准；学习偏好暂时只保存在本机浏览器，并按当前账号隔离。后续如果要让
          AI 固定采用这些偏好，需要单独设计 prompt 注入边界。
        </section>
      </main>
    </div>
  );
}
