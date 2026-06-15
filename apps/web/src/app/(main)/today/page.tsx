'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { ReviewRating } from '@repo/types/api/review';
import type { ReviewTaskItemResponse } from '@repo/types/api/review-task';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Camera,
  CalendarCheck,
  Check,
  CheckCircle2,
  ClipboardList,
  Eye,
  Loader2,
  MessageCircle,
  PencilLine,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

import MarkdownRenderer from '@/components/markdown/markdown-renderer';
import {
  useReopenReviewTask,
  useSkipReviewTask,
  useSubmitReviewTaskRating,
  useTodayReviewTaskList,
} from '@/hooks/use-review-tasks';
import { useMutationQueueFlush } from '@/hooks/use-mutation-queue-flush';
import { useReviewTaskPendingRatings } from '@/hooks/use-review-task-pending-ratings';
import { db } from '@/lib/db';
import { enqueueMutationQueueItem, getMutationErrorMessage } from '@/lib/mutation-queue';
import {
  buildReviewRatingFeedback,
  getReviewRatingOptions,
  type ReviewRatingFeedback,
} from '@/lib/review-feedback';
import {
  createReviewTaskRatingQueueItem,
  isRetryableReviewTaskRatingError,
} from '@/lib/review-task-offline';
import {
  getReviewRatingLabel,
  getReviewTaskStatusFeedback,
  groupReviewTasksByStatus,
  mergeLocalPendingRatings,
  type LocalPendingRatingFields,
} from '@/lib/review-task-view';
import {
  TODAY_TASKS,
  createEmptyTodayState,
  getLocalDateKey,
  getTodayTaskToggleFeedback,
  getTodayNextAction,
  getTodayProgress,
  readTodayTaskState,
  toggleTaskCompletion,
  writeTodayTaskState,
  type TodayTaskKind,
  type TodayTaskTemplate,
} from '@/lib/today-tasks';
import { formatWrongQuestionFieldForDisplay } from '@/lib/wrong-question-parser';
import { useUserStore } from '@/stores/userStore';

type NoticeTone = 'success' | 'neutral';
type ReviewTaskDisplayItem = ReviewTaskItemResponse & Partial<LocalPendingRatingFields>;

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

const noticeStyles: Record<NoticeTone, { icon: typeof Check; className: string }> = {
  success: {
    icon: Check,
    className:
      'border-emerald-100 bg-white/95 text-emerald-700 shadow-[0_18px_45px_rgba(40,120,96,0.18)]',
  },
  neutral: {
    icon: RotateCcw,
    className:
      'border-slate-200 bg-white/95 text-slate-600 shadow-[0_18px_45px_rgba(50,45,60,0.14)]',
  },
};

export default function TodayPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const userId = currentUser?.id ?? '';
  const dateKey = useMemo(() => getLocalDateKey(), []);
  const [taskState, setTaskState] = useState(() => createEmptyTodayState(dateKey));
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [revealedTaskIds, setRevealedTaskIds] = useState<Set<string>>(new Set());
  const [reviewFeedbacks, setReviewFeedbacks] = useState<Record<string, ReviewRatingFeedback>>({});
  const noticeTimerRef = useRef<number | null>(null);
  const timezoneOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const todayReviewTasks = useTodayReviewTaskList({
    date: dateKey,
    timezoneOffsetMinutes,
    includeCompleted: true,
  });
  const { pendingByTaskId, pendingCount: pendingRatingSyncCount } =
    useReviewTaskPendingRatings(userId);
  const { flush } = useMutationQueueFlush();
  const reviewTasksWithPendingRatings = useMemo(
    () => mergeLocalPendingRatings(todayReviewTasks.data?.tasks ?? [], pendingByTaskId),
    [pendingByTaskId, todayReviewTasks.data?.tasks],
  );
  const groupedReviewTasks = groupReviewTasksByStatus(reviewTasksWithPendingRatings);
  const submitReviewRating = useSubmitReviewTaskRating();
  const skipReviewTask = useSkipReviewTask();
  const reopenReviewTask = useReopenReviewTask();

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

  const showNotice = useCallback((message: string, tone: NoticeTone = 'success') => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice({ message, tone });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const toggleAnswer = useCallback((taskId: string) => {
    setRevealedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const rateTask = useCallback(
    async (task: ReviewTaskItemResponse, rating: ReviewRating) => {
      const request = {
        rating,
        reviewedAt: new Date().toISOString(),
        clientMutationId: crypto.randomUUID(),
      };

      try {
        const result = await submitReviewRating.mutateAsync({
          taskId: task.id,
          request,
        });
        const feedback = buildReviewRatingFeedback({
          rating,
          nextReview: result.card.nextReview,
        });
        setReviewFeedbacks((prev) => ({
          ...prev,
          [task.id]: feedback,
        }));
        setRevealedTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        showNotice(`${feedback.title}，${feedback.description}`);
      } catch (error) {
        if (userId && isRetryableReviewTaskRatingError(error)) {
          try {
            await enqueueMutationQueueItem(
              createReviewTaskRatingQueueItem({
                userId,
                task,
                request,
              }),
            );
            showNotice(`已选择：${getReviewRatingLabel(rating)}，等待同步`, 'neutral');
          } catch (queueError) {
            showNotice(getMutationErrorMessage(queueError), 'neutral');
          }
          return;
        }

        showNotice(getMutationErrorMessage(error), 'neutral');
      }
    },
    [showNotice, submitReviewRating, userId],
  );

  const skipTask = useCallback(
    async (taskId: string) => {
      try {
        await skipReviewTask.mutateAsync(taskId);
        const feedback = getReviewTaskStatusFeedback('skip');
        showNotice(feedback.message, feedback.tone);
      } catch (error) {
        showNotice(getMutationErrorMessage(error), 'neutral');
      }
    },
    [showNotice, skipReviewTask],
  );

  const reopenTask = useCallback(
    async (taskId: string) => {
      try {
        await reopenReviewTask.mutateAsync(taskId);
        const feedback = getReviewTaskStatusFeedback('reopen');
        showNotice(feedback.message, feedback.tone);
      } catch (error) {
        showNotice(getMutationErrorMessage(error), 'neutral');
      }
    },
    [reopenReviewTask, showNotice],
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      if (!userId) return;
      const next = toggleTaskCompletion(taskState, taskId);
      const feedback = getTodayTaskToggleFeedback(next.completedTaskIds.includes(taskId));

      setTaskState(next);
      writeTodayTaskState(userId, next);
      showNotice(feedback.message, feedback.tone);
    },
    [showNotice, taskState, userId],
  );

  const NoticeIcon = notice ? noticeStyles[notice.tone].icon : Check;

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

      {notice ? (
        <div
          aria-live="polite"
          role="status"
          className={`fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold backdrop-blur-xl ${noticeStyles[notice.tone].className}`}
        >
          <NoticeIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{notice.message}</span>
        </div>
      ) : null}

      <main className="mx-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-3xl">
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

          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="待复习" value={`${todayReviewTasks.data?.pendingCount ?? 0} 张`} />
            <MiniStat label="已完成" value={`${todayReviewTasks.data?.completedCount ?? 0} 张`} />
            <MiniStat label="已跳过" value={`${todayReviewTasks.data?.skippedCount ?? 0} 张`} />
          </div>
        </section>

        <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
                  <Brain className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">今日复习</h2>
                  <p className="mt-0.5 text-xs text-[var(--pm-muted)]">
                    来自错题本的到期复习卡
                  </p>
                </div>
              </div>
            </div>
            {pendingRatingSyncCount > 0 ? (
              <button
                type="button"
                onClick={() => void flush()}
                className="tap-target shrink-0 rounded-full bg-[#fff7df] px-3 py-1 text-xs font-semibold text-[#9a6a18] ring-1 ring-amber-100 transition-all hover:bg-[#ffefbf] active:scale-95"
              >
                {pendingRatingSyncCount} 条待同步，重试
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#315f86] ring-1 ring-[var(--pm-line)]">
                {todayReviewTasks.data?.pendingCount ?? 0} 张
              </span>
            )}
          </div>

          <div className="mt-3 space-y-3">
            {todayReviewTasks.isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在读取复习卡...
              </div>
            ) : todayReviewTasks.isError ? (
              <p className="rounded-2xl bg-red-50/80 px-3 py-3 text-sm text-red-600 ring-1 ring-red-100">
                复习任务读取失败，稍后再试。
              </p>
            ) : groupedReviewTasks.pending.length ? (
              groupedReviewTasks.pending.map((task) => (
                <ReviewTaskCard
                  key={task.id}
                  task={task}
                  revealed={revealedTaskIds.has(task.id)}
                  feedback={reviewFeedbacks[task.id] ?? null}
                  ratingPending={submitReviewRating.isPending}
                  actionPending={skipReviewTask.isPending || reopenReviewTask.isPending}
                  onToggleAnswer={() => toggleAnswer(task.id)}
                  onRate={(rating) => void rateTask(task, rating)}
                  onSkip={() => void skipTask(task.id)}
                />
              ))
            ) : (
              <p className="rounded-2xl bg-white/70 px-3 py-3 text-sm leading-6 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
                今天没有到期复习卡。可以从错题详情里把重要题目加入复习计划。
              </p>
            )}

            {groupedReviewTasks.completed.length ? (
              <ReviewTaskSummary title="今日已完成" tasks={groupedReviewTasks.completed} />
            ) : null}

            {groupedReviewTasks.skipped.length ? (
              <ReviewTaskSummary
                title="已跳过"
                tasks={groupedReviewTasks.skipped}
                actionLabel="恢复"
                actionPending={reopenReviewTask.isPending}
                onAction={(taskId) => void reopenTask(taskId)}
              />
            ) : null}
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
                轻学习手账状态保存在本机浏览器；复习卡任务已接入服务端 ReviewTask，评分后会同步更新复习统计。
              </p>
            </div>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
          <Link
            href="/stats"
            className="tap-target flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/75 text-sm font-semibold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98]"
          >
            <BarChart3 className="h-4 w-4" />
            学习统计
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 px-3 py-2 ring-1 ring-[var(--pm-line)]">
      <p className="text-[11px] font-medium text-[var(--pm-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[var(--pm-ink)]">{value}</p>
    </div>
  );
}

function ReviewTaskCard({
  task,
  revealed,
  feedback,
  ratingPending,
  actionPending,
  onToggleAnswer,
  onRate,
  onSkip,
}: {
  task: ReviewTaskDisplayItem;
  revealed: boolean;
  feedback: ReviewRatingFeedback | null;
  ratingPending: boolean;
  actionPending: boolean;
  onToggleAnswer: () => void;
  onRate: (rating: ReviewRating) => void;
  onSkip: () => void;
}) {
  const wrongQuestion = task.wrongQuestion;
  const ratingOptions = getReviewRatingOptions();
  const isLocalRatingPending = task.localStatus === 'LOCAL_RATING_PENDING';

  return (
    <article className="rounded-[1.25rem] bg-white/72 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff6d8] text-[#6f5212] ring-1 ring-[#ead68c]">
          <CalendarCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#eef7ff] px-2 py-0.5 text-[11px] font-semibold text-[#315f86]">
              {wrongQuestion?.subject ?? '复习卡'}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
              {task.card.state}
            </span>
          </div>
          <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-[var(--pm-ink)]">
            {wrongQuestion?.questionText ?? '这张复习卡暂时没有题干'}
          </p>
          {wrongQuestion?.knowledgePoints.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {wrongQuestion.knowledgePoints.slice(0, 3).map((point) => (
                <span
                  key={point}
                  className="rounded-full bg-[#eafff9] px-2 py-0.5 text-[11px] font-semibold text-[#247269]"
                >
                  {point}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {revealed && wrongQuestion ? (
        <div className="mt-3 space-y-3 rounded-2xl bg-white/75 p-3 text-sm leading-6 ring-1 ring-[var(--pm-line)]">
          <div>
            <p className="text-xs font-semibold text-[var(--pm-muted)]">参考答案</p>
            <div className="mt-1">
              <MarkdownRenderer
                content={formatWrongQuestionFieldForDisplay(wrongQuestion.answer || '暂无答案')}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--pm-muted)]">解析</p>
            <div className="mt-1">
              <MarkdownRenderer
                content={formatWrongQuestionFieldForDisplay(wrongQuestion.analysis || '暂无解析')}
              />
            </div>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#effdf9] px-3 py-2 text-sm text-[#247269] ring-1 ring-[#bdeee5]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold">{feedback.title}</p>
            <p className="mt-0.5 text-xs font-semibold text-[#347d70]">{feedback.description}</p>
          </div>
        </div>
      ) : null}

      {isLocalRatingPending && task.pendingRatingLabel ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#fff7df] px-3 py-2 text-sm text-[#9a6a18] ring-1 ring-amber-100">
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-semibold">已选择：{task.pendingRatingLabel}，等待同步</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggleAnswer}
        className="tap-target mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-white/75 text-sm font-semibold text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98]"
      >
        <Eye className="h-4 w-4" />
        {revealed ? '收起答案' : '查看答案'}
      </button>

      <button
        type="button"
        disabled={actionPending || ratingPending || isLocalRatingPending}
        onClick={onSkip}
        className="tap-target mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-white/65 text-sm font-semibold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-white active:scale-[0.98] disabled:opacity-60"
      >
        {actionPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        今天先跳过
      </button>

      {revealed ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ratingOptions.map((option) => (
            <button
              key={option.rating}
              type="button"
              disabled={ratingPending || isLocalRatingPending}
              onClick={() => onRate(option.rating)}
              className={`tap-target min-h-14 rounded-2xl px-2 text-left ring-1 transition-all active:scale-[0.96] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:ring-[var(--pm-line)] ${option.className}`}
            >
              {ratingPending ? (
                <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold opacity-75">
                    {option.effect}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ReviewTaskSummary({
  title,
  tasks,
  actionLabel,
  actionPending,
  onAction,
}: {
  title: string;
  tasks: ReviewTaskDisplayItem[];
  actionLabel?: string;
  actionPending?: boolean;
  onAction?: (taskId: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-white/55 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-[var(--pm-muted)]">{title}</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-[var(--pm-muted)]">
          {tasks.length} 张
        </span>
      </div>
      <div className="mt-2 space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 rounded-xl bg-white/65 px-2 py-2">
            <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-[#6f5212]" />
            <p className="min-w-0 flex-1 truncate text-xs font-semibold">
              {task.wrongQuestion?.questionText ?? '复习卡'}
            </p>
            {actionLabel && onAction ? (
              <button
                type="button"
                disabled={actionPending}
                onClick={() => onAction(task.id)}
                className="tap-target min-h-8 rounded-xl px-2 text-xs font-bold text-[#247269] transition-all hover:bg-[#eafff9] disabled:opacity-60"
              >
                {actionPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
