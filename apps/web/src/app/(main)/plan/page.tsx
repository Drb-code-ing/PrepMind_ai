'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { ReviewTaskPlanDayResponse, ReviewTaskPlanResponse } from '@repo/types/api/review-task';
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { BaseEChart } from '@/components/charts/base-echart';
import { useReviewTaskPendingRatings } from '@/hooks/use-review-task-pending-ratings';
import { useReviewTaskPlan } from '@/hooks/use-review-tasks';
import {
  buildPlanBarOption,
  getPlanIntensityClassName,
  getPlanIntensityLabel,
  shouldShowPlanEmptyState,
} from '@/lib/review-plan-view';
import { getLocalDateKey } from '@/lib/today-tasks';
import { useUserStore } from '@/stores/userStore';

export default function PlanPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const userId = currentUser?.id ?? '';
  const startDate = useMemo(() => getLocalDateKey(), []);
  const timezoneOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const planQuery = useReviewTaskPlan({ startDate, days: 7, timezoneOffsetMinutes });
  const { pendingCount: pendingRatingSyncCount } = useReviewTaskPendingRatings(userId);
  const plan = planQuery.data;

  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/chat"
            aria-label="返回聊天"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--pm-muted)]">Review plan</p>
            <h1 className="text-lg font-semibold leading-tight">复习计划</h1>
            <p className="mt-0.5 text-xs text-[var(--pm-muted)]">
              未来 7 天到期节奏与复习压力
            </p>
          </div>
          <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
            <CalendarClock className="h-5 w-5" />
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-3xl">
        {planQuery.isLoading ? (
          <div className="flex min-h-20 items-center gap-2 rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取未来 7 天复习计划...
          </div>
        ) : planQuery.isError ? (
          <section className="rounded-2xl bg-red-50/85 px-4 py-4 text-sm leading-6 text-red-600 ring-1 ring-red-100">
            <p className="font-semibold">复习计划读取失败，请稍后重试。</p>
            <button
              type="button"
              onClick={() => void planQuery.refetch()}
              className="tap-target mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-red-600 ring-1 ring-red-100 transition-all hover:bg-red-50 active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              重新读取
            </button>
          </section>
        ) : plan && shouldShowPlanEmptyState(plan) ? (
          <EmptyPlan />
        ) : plan ? (
          <PlanContent plan={plan} pendingRatingSyncCount={pendingRatingSyncCount} />
        ) : null}
      </main>
    </div>
  );
}

function PlanContent({
  plan,
  pendingRatingSyncCount,
}: {
  plan: ReviewTaskPlanResponse;
  pendingRatingSyncCount: number;
}) {
  const totalPressure =
    plan.summary.overdueCount + plan.summary.todayDueCount + plan.summary.upcomingDueCount;
  const chartOption = useMemo(() => buildPlanBarOption(plan.days), [plan.days]);

  return (
    <>
      <section className="pm-glass-card pm-enter rounded-[1.6rem] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--pm-muted)]">未来复习压力</p>
            <p className="mt-1 text-3xl font-black leading-none text-[var(--pm-ink)]">
              {totalPressure}
            </p>
            <p className="mt-1 text-xs text-[var(--pm-muted)]">
              已逾期、今日到期与未来到期合计
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getPlanIntensityClassName(
              plan.summary.intensity,
            )}`}
          >
            {getPlanIntensityLabel(plan.summary.intensity)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="已逾期" value={`${plan.summary.overdueCount} 张`} />
          <MiniStat label="今日到期" value={`${plan.summary.todayDueCount} 张`} />
          <MiniStat label="未来到期" value={`${plan.summary.upcomingDueCount} 张`} />
          <MiniStat label="待同步" value={`${pendingRatingSyncCount} 条`} />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[var(--pm-muted)]">
          <span>预计 {plan.summary.estimatedTotalMinutes} 分钟</span>
          <span>
            高峰日{' '}
            {plan.summary.peakDay
              ? `${plan.summary.peakDay.date.slice(5)} · ${plan.summary.peakDay.count} 张`
              : '暂无'}
          </span>
        </div>
      </section>

      <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
        <SectionTitle
          icon={CalendarClock}
          title="未来 7 天"
          subtitle={`${plan.startDate} 到 ${plan.endDate}`}
        />
        <BaseEChart
          option={chartOption}
          className="mt-3 h-56 w-full rounded-[1.25rem] bg-white/70 p-2 ring-1 ring-[var(--pm-line)]"
          ariaLabel="未来 7 天复习压力柱状图"
        />
      </section>

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">每日安排</h2>
          <span className="text-xs text-[var(--pm-muted)]">未来日期会在当天入口处理</span>
        </div>
        <div className="space-y-3">
          {plan.days.map((day) => (
            <PlanDayItem key={day.date} day={day} startDate={plan.startDate} />
          ))}
        </div>
      </section>

      <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff7d6] text-[#8a6815] ring-1 ring-[#f3e6a8]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{plan.suggestion.title}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--pm-muted)]">
              {plan.suggestion.description}
            </p>
            <Link
              href={plan.suggestion.actionHref}
              className="tap-target mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98]"
            >
              {plan.suggestion.actionLabel}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function PlanDayItem({
  day,
  startDate,
}: {
  day: ReviewTaskPlanDayResponse;
  startDate: string;
}) {
  const isToday = day.date === startDate;

  return (
    <article className="pm-enter rounded-[1.35rem] bg-white/72 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
          <span className="text-[10px] font-bold leading-none">{day.date.slice(5, 7)}</span>
          <span className="mt-0.5 text-sm font-black leading-none">{day.date.slice(8, 10)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{day.label}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${getPlanIntensityClassName(
                day.intensity,
              )}`}
            >
              {getPlanIntensityLabel(day.intensity)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--pm-muted)]">{day.date}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--pm-muted)]">
            <span className="rounded-full bg-white/70 px-2 py-1 ring-1 ring-[var(--pm-line)]">
              到期 {day.dueCount} 张
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1 ring-1 ring-[var(--pm-line)]">
              逾期 {day.overdueCount} 张
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1 ring-1 ring-[var(--pm-line)]">
              预计 {day.estimatedMinutes} 分钟
            </span>
          </div>
        </div>
        {isToday ? (
          <Link
            href="/today"
            className="tap-target flex min-h-11 shrink-0 items-center justify-center rounded-2xl bg-[#eafff9] px-3 text-xs font-bold text-[#247269] ring-1 ring-[#bdeee5] transition-all hover:bg-[#d8fbf3] active:scale-[0.98]"
            aria-label={`${day.label}，去今日任务处理到期复习`}
          >
            去今日任务
          </Link>
        ) : (
          <span
            className="flex min-h-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 px-3 text-xs font-bold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]"
            aria-label={`${day.label}，未来复习计划预览，到期后在今日任务处理`}
          >
            到期后处理
          </span>
        )}
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

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-[var(--pm-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyPlan() {
  return (
    <section className="pm-glass-card pm-enter rounded-[1.5rem] p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <BookOpen className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold">未来 7 天还没有复习压力</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--pm-muted)]">
        从错题本把重要题目加入复习，系统会按到期时间生成计划，并在今日任务里完成评分。
      </p>
      <Link
        href="/error-book"
        className="tap-target mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98]"
      >
        去错题本
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
