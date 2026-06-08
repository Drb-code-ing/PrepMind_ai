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
} from 'lucide-react';

import { db } from '@/lib/db';
import {
  TODAY_TASKS,
  createEmptyTodayState,
  getLocalDateKey,
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
  review: 'bg-blue-50 text-blue-700 ring-blue-100',
  'wrong-question': 'bg-amber-50 text-amber-700 ring-amber-100',
  capture: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  summary: 'bg-slate-100 text-slate-700 ring-slate-200',
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
  const totalMinutes = TODAY_TASKS.reduce((sum, task) => sum + task.estimateMinutes, 0);

  const toggleTask = useCallback(
    (taskId: string) => {
      if (!userId) return;
      setTaskState((prev) => {
        const next = toggleTaskCompletion(prev, taskId);
        writeTodayTaskState(userId, next);
        return next;
      });
    },
    [userId],
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
            aria-label="返回聊天"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight">今日任务</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatTodayLabel(dateKey)}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">今日进度</p>
              <p className="mt-1 text-2xl font-semibold leading-none">
                {progress.completed}/{progress.total}
              </p>
            </div>
            <div className="flex min-h-10 items-center rounded-full bg-primary/10 px-3 text-sm font-medium text-primary">
              {progress.percent}% 完成
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>预计 {totalMinutes} 分钟</span>
            <span>{unresolvedCount} 道未掌握错题</span>
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">任务清单</h2>
            <span className="text-xs text-muted-foreground">本地保存，按账号隔离</span>
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

        <section className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">完成建议</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                先处理未掌握错题，再新增拍照识题。最后把今天的薄弱点发给 AI，总结成明天的优先级。
              </p>
            </div>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/chat"
            className="tap-target flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" />
            AI 对话
          </Link>
          <Link
            href="/error-book"
            className="tap-target flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:bg-muted active:scale-[0.98]"
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
      className={`rounded-lg border p-3 transition-colors ${
        completed ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={`tap-target mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-95 ${
            completed
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
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
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${taskAccentClasses[task.kind]}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold leading-5">{task.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {task.estimateMinutes} 分钟
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-xs text-muted-foreground">
              {completed ? '已完成' : '待完成'}
            </span>
            <Link
              href={task.href}
              className="tap-target flex min-h-9 items-center justify-center rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              {task.actionLabel}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
