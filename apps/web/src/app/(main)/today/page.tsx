'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  PencilLine,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

import { db } from '@/lib/db';
import {
  TODAY_TASKS,
  createEmptyTodayState,
  getLocalDateKey,
  getTodayNextAction,
  getTodayProgress,
  readTodayTaskState,
  toggleTaskCompletion,
  writeTodayTaskState,
  type TodayTaskKind,
  type TodayTaskTemplate,
} from '@/lib/today-tasks';
import { useUserStore } from '@/stores/userStore';

const taskIcons: Record<TodayTaskKind, typeof BookOpen> = {
  review: BookOpen,
  'wrong-question': RotateCcw,
  capture: Camera,
  summary: PencilLine,
};

const taskAccentClasses: Record<TodayTaskKind, string> = {
  review: 'bg-[#f0f8ff] text-[#3475a7] ring-blue-100',
  'wrong-question': 'bg-[#fff7df] text-[#9a6a18] ring-amber-100',
  capture: 'bg-[#effdf9] text-[#347d70] ring-emerald-100',
  summary: 'bg-[#f4f0ff] text-[#6954b8] ring-violet-100',
};

function formatTodayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

export default function TodayPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const userId = currentUser?.id ?? '';
  const dateKey = useMemo(() => getLocalDateKey(), []);
  const [taskState, setTaskState] = useState(() => createEmptyTodayState(dateKey));
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    window.setTimeout(() => {
      if (!cancelled) {
        setTaskState(readTodayTaskState(userId, dateKey));
      }
    }, 0);

    db.wrongQuestions
      .where('userId')
      .equals(userId)
      .toArray()
      .then((items) => {
        if (!cancelled) {
          setUnresolvedCount(items.filter((item) => item.status === 'unresolved').length);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dateKey, userId]);

  const progress = getTodayProgress(taskState);
  const nextAction = getTodayNextAction(taskState, unresolvedCount);
  const totalMinutes = TODAY_TASKS.reduce((sum, task) => sum + task.estimateMinutes, 0);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 1800);
  }, []);

  const toggleTask = useCallback(
    (taskId: string) => {
      if (!userId) return;
      setTaskState((prev) => {
        const next = toggleTaskCompletion(prev, taskId);
        writeTodayTaskState(userId, next);
        showNotice(next.completedTaskIds.includes(taskId) ? '任务已完成' : '已标记为待完成');
        return next;
      });
    },
    [showNotice, userId],
  );

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
            <p className="text-xs font-medium text-[var(--pm-muted)]">Study notebook</p>
            <h1 className="text-lg font-semibold leading-tight">今日任务</h1>
            <p className="mt-0.5 text-xs text-[var(--pm-muted)]">{formatTodayLabel(dateKey)}</p>
          </div>
          <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff7d6] text-sm font-black text-[#247269] ring-1 ring-[#f3e6a8]">
            记
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-3xl">
        {notice ? (
          <div className="pm-enter mb-3 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/90 px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm">
            <Check className="h-4 w-4" />
            {notice}
          </div>
        ) : null}

        <section className="pm-glass-card pm-enter rounded-[1.6rem] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--pm-muted)]">今日进度</p>
              <p className="mt-1 text-3xl font-black leading-none text-[var(--pm-ink)]">
                {progress.completed}/{progress.total}
              </p>
            </div>
            <div className="rounded-2xl bg-[#eafff9] px-3 py-2 text-sm font-bold text-[#247269] ring-1 ring-[#bdeee5]">
              {progress.percent}% 完成
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70 ring-1 ring-[var(--pm-line)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#78d6c8] via-[#a9d8ff] to-[#ffe89a] transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="mt-4 rounded-[1.25rem] bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#effdf9] text-[#347d70] ring-1 ring-emerald-100">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{nextAction.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">
                  {nextAction.description}
                </p>
              </div>
              <Link
                href={nextAction.href}
                className="tap-target flex min-h-10 shrink-0 items-center justify-center rounded-2xl bg-[#2b2335] px-3 text-xs font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-95"
              >
                去处理
              </Link>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-medium text-[var(--pm-muted)]">
            <span>预计 {totalMinutes} 分钟</span>
            <span>{unresolvedCount} 道未掌握错题</span>
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">任务清单</h2>
            <span className="text-xs text-[var(--pm-muted)]">本地保存，按账号隔离</span>
          </div>

          <div className="space-y-3">
            {TODAY_TASKS.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                completed={taskState.completedTaskIds.includes(task.id)}
                unresolvedCount={unresolvedCount}
                onToggle={() => toggleTask(task.id)}
              />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[1.35rem] border border-[var(--pm-line)] bg-white/55 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-[var(--pm-line)]">
              <ClipboardList className="h-5 w-5 text-[var(--pm-muted)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">数据说明</p>
              <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">
                今日任务仍是 Phase 1 静态模板，状态保存在本机浏览器。Phase 3 之后再接入 AI
                动态规划和服务端任务表。
              </p>
            </div>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/chat"
            className="tap-target flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#86dccf] text-sm font-semibold text-[#173b37] shadow-sm transition-all hover:bg-[#70cfc1] active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" />
            AI 对话
          </Link>
          <Link
            href="/error-book"
            className="tap-target flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/75 text-sm font-semibold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98]"
          >
            <BookOpen className="h-4 w-4" />
            错题本
          </Link>
        </div>
      </main>
    </div>
  );
}

function TaskCard({
  task,
  completed,
  unresolvedCount,
  onToggle,
}: {
  task: TodayTaskTemplate;
  completed: boolean;
  unresolvedCount: number;
  onToggle: () => void;
}) {
  const Icon = taskIcons[task.kind];
  const description =
    task.kind === 'wrong-question'
      ? unresolvedCount > 0
        ? `当前有 ${unresolvedCount} 道未掌握错题，优先复习 3 道并补充备注。`
        : '当前没有未掌握错题，可以回看已掌握题或新增识题。'
      : task.description;

  return (
    <article
      className={`pm-enter rounded-[1.35rem] p-3 transition-all active:scale-[0.99] ${
        completed
          ? 'border border-emerald-100 bg-emerald-50/75'
          : 'pm-glass-card hover:bg-white/92'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={`tap-target mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 transition-all active:scale-95 ${
            completed
              ? 'bg-[#7ce2ca] text-[#174d43] ring-emerald-200'
              : 'bg-white/80 text-[var(--pm-muted)] ring-[var(--pm-line)] hover:bg-[#eafff9] hover:text-[#247269]'
          }`}
          aria-label={completed ? '标记为未完成' : '标记为已完成'}
        >
          {completed ? <Check className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ring-1 ${taskAccentClasses[task.kind]}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold leading-5">{task.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--pm-muted)]">{description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[11px] font-semibold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
              {task.estimateMinutes} 分钟
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--pm-line)] pt-2">
            <span className="text-xs font-medium text-[var(--pm-muted)]">
              {completed ? '已完成' : '待完成'}
            </span>
            <Link
              href={task.href}
              className="tap-target flex min-h-9 items-center justify-center rounded-xl px-2 text-xs font-semibold text-[#247269] transition-all hover:bg-[#eafff9] active:scale-95"
            >
              {task.actionLabel}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
